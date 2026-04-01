'use client';

import { CSSProperties, useEffect, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';
import Printer from '@/components/Printer';
import type { ReceiptResponse } from '@/lib/llm';
import { getMemory, getStreak, setMemory } from '@/lib/memory';
import { moodTheme } from '@/lib/theme';
import type { Intensity, Mood } from '@/lib/types';

type MoodOption = {
  label: string;
  value: Mood;
  icon: string;
  goblinName: string;
  goblinLabel: string;
  goblinSpeech: string;
  promptSeed: string;
  taskLabel: string;
  receiptWorld: string;
  bestLabel: string;
  worstLabel: string;
  footerLine: string;
  statusLines: string[];
};

const moods: MoodOption[] = [
  { label: 'Drama\nQueen', value: 'drama', icon: 'megaphone', goblinName: 'Gossip Goblin', goblinLabel: 'gossip', goblinSpeech: 'what is your job title, celebrity?', promptSeed: 'Roast me like a suspicious coworker with excellent eyeliner.', taskLabel: 'what scandal are we avoiding?', receiptWorld: 'scandal bulletin', bestLabel: 'if you behave', worstLabel: 'if you embarrass us', footerLine: 'witnessed by the whole building', statusLines: ['checking the gossip chain...', 'powdering nose, judging...', 'pulling your scandal file...'] },
  { label: 'Guilt\nTrip', value: 'guilt', icon: 'mug', goblinName: 'Landlord Goblin', goblinLabel: 'landlord', goblinSpeech: 'job title? quickly.', promptSeed: 'Ask if my actual profession is avoiding the obvious.', taskLabel: 'what bill is emotionally overdue?', receiptWorld: 'rent notice', bestLabel: 'paid on time timeline', worstLabel: 'late fee timeline', footerLine: 'filed under avoidable behavior', statusLines: ['reviewing your excuses...', 'checking your payment history...', 'printing the disappointment...'] },
  { label: 'Soft\nHug', value: 'hug', icon: 'heart', goblinName: 'Sweetheart Goblin', goblinLabel: 'sweetie', goblinSpeech: 'baby, what do you do for work?', promptSeed: 'Be sweet but drag me for making one task dramatic.', taskLabel: 'what tiny mountain are we crying over?', receiptWorld: 'concern note', bestLabel: 'if you love yourself', worstLabel: 'if you keep spiraling', footerLine: 'signed by a friend with standards', statusLines: ['warming up the forehead kiss...', 'finding the loving drag...', 'packing concern with sass...'] },
  { label: 'Doom\nForecast', value: 'doom', icon: 'orb', goblinName: 'Oracle Goblin', goblinLabel: 'balcony witch', goblinSpeech: 'state your profession before the omen.', promptSeed: 'Predict my downfall if I keep dodging this task.', taskLabel: 'which omen are we ignoring?', receiptWorld: 'omen report', bestLabel: 'lucky timeline', worstLabel: 'clown timeline', footerLine: 'approved by the balcony oracle', statusLines: ['consulting the omen...', 'reading the cursed timeline...', 'forecasting your nonsense...'] },
  { label: 'Goblin\nGremlin', value: 'goblin', icon: 'spark', goblinName: 'Chaos Goblin', goblinLabel: 'goblin', goblinSpeech: 'what is your alleged profession?', promptSeed: 'Roast me like my job title is a rumor.', taskLabel: 'what mess needs goblin intervention?', receiptWorld: 'incident report', bestLabel: 'if you act right', worstLabel: 'if you stay weird', footerLine: 'reviewed by neighbourhood cats', statusLines: ['rattling through your chaos...', 'collecting goblin evidence...', 'filing a tiny incident report...'] },
  { label: 'Hype\nGoblin', value: 'hype', icon: 'star', goblinName: 'Hype Goblin', goblinLabel: 'publicist', goblinSpeech: 'what dazzling profession are we claiming today?', promptSeed: 'Hype me up like success is already waiting in the parking lot.', taskLabel: 'what move are we making next?', receiptWorld: 'star memo', bestLabel: 'spotlight timeline', worstLabel: 'missed-the-moment timeline', footerLine: 'approved by your imaginary fan club', statusLines: ['ironing your victory speech...', 'warming up the applause...', 'printing your main character memo...'] },
  { label: 'Nice\nGoblin', value: 'nice', icon: 'cloud', goblinName: 'Nice Goblin', goblinLabel: 'helper', goblinSpeech: 'what do you do, sweet pea?', promptSeed: 'Be kind, reassuring, and gently push me to start.', taskLabel: 'what would feel better if we handled it?', receiptWorld: 'support note', bestLabel: 'gentle win timeline', worstLabel: 'tired tomorrow timeline', footerLine: 'signed by a goblin with good intentions', statusLines: ['folding a tiny encouragement note...', 'looking for the gentle nudge...', 'printing something nicer than your inner voice...'] },
];

const intensitySteps: { value: Intensity; label: string }[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'brutal', label: 'Brutal' },
  { value: 'unhinged', label: 'Unhinged' },
];

const jobQuestionPrompts = [
  {
    label: "What's your job title, exactly?",
    placeholder: 'marketing intern, designer, founder, accountant, unemployed but opinionated...',
  },
  {
    label: 'What do you do for work, allegedly?',
    placeholder: 'video editor, student, software engineer, consultant, between plots...',
  },
  {
    label: 'Profession? Be specific.',
    placeholder: 'product designer, recruiter, dentist, copywriter, chaos coordinator...',
  },
  {
    label: 'What is your actual job?',
    placeholder: 'architect, teacher, creator, analyst, professional overthinker...',
  },
];

function nextTicketNumber() {
  return Math.floor(Math.random() * 9000 + 1000).toString();
}

function nextIssuedAt() {
  return new Date().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shiftMood(current: Mood, direction: 1 | -1) {
  const index = moods.findIndex((mood) => mood.value === current);
  const nextIndex = (index + direction + moods.length) % moods.length;
  return moods[nextIndex].value;
}

export default function Home() {
  const [text, setText] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [flowUnlocked, setFlowUnlocked] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [visibleReceipt, setVisibleReceipt] = useState<ReceiptResponse | null>(null);
  const [receiptSide, setReceiptSide] = useState<'front' | 'back'>('front');
  const [receiptMinimized, setReceiptMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(1);
  const [selectedMood, setSelectedMood] = useState<Mood>('guilt');
  const [moodTouched, setMoodTouched] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>('brutal');
  const [ticketNumber, setTicketNumber] = useState('0000');
  const [issuedAt, setIssuedAt] = useState('--');
  const [printedTask, setPrintedTask] = useState('');
  const [printedContext, setPrintedContext] = useState('');
  const [printedMood, setPrintedMood] = useState<Mood>('guilt');
  const [printedIntensity, setPrintedIntensity] = useState<Intensity>('brutal');
  const [lastReceiptTap, setLastReceiptTap] = useState(0);
  const [jobPromptIndex, setJobPromptIndex] = useState(0);
  const [loadingLineIndex, setLoadingLineIndex] = useState(0);
  const [visibleMainLineCount, setVisibleMainLineCount] = useState(0);

  useEffect(() => {
    setStreak(getStreak());
    setTicketNumber(nextTicketNumber());
    setIssuedAt(nextIssuedAt());
    setJobPromptIndex(Math.floor(Math.random() * jobQuestionPrompts.length));
  }, []);

  useEffect(() => {
    if (!visibleReceipt) return;
    const timer = window.setTimeout(() => {
      document.getElementById('receipt')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [visibleReceipt]);

  useEffect(() => {
    if (!loading) {
      setLoadingLineIndex(0);
      return;
    }
    const lines = (moods.find((mood) => mood.value === selectedMood) || moods[0]).statusLines;
    const timer = window.setInterval(() => {
      setLoadingLineIndex((index) => (index + 1) % lines.length);
    }, 950);
    return () => window.clearInterval(timer);
  }, [loading, selectedMood]);

  useEffect(() => {
    if (!visibleReceipt) {
      setVisibleMainLineCount(0);
      return;
    }
    const lines = splitRoastLines(visibleReceipt.main);
    setVisibleMainLineCount(1);
    if (lines.length <= 1) return;
    const timer = window.setInterval(() => {
      setVisibleMainLineCount((count) => {
        if (count >= lines.length) {
          window.clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, 360);
    return () => window.clearInterval(timer);
  }, [visibleReceipt]);

  const activeTheme = moodTheme[selectedMood];
  const activeMood = moods.find((mood) => mood.value === selectedMood) || moods[0];
  const printedMoodOption = moods.find((mood) => mood.value === printedMood) || activeMood;
  const activeJobPrompt = jobQuestionPrompts[jobPromptIndex];
  const intensityIndex = intensitySteps.findIndex((step) => step.value === intensity);
  const canContinue = followUpAnswer.trim().length > 0;
  const canPrint = text.trim().length > 0;
  const visibleRoastLines = visibleReceipt
    ? splitRoastLines(visibleReceipt.main).slice(
        0,
        visibleMainLineCount > 0 ? visibleMainLineCount : splitRoastLines(visibleReceipt.main).length
      )
    : [];
  const stageStyle = {
    '--theme-accent': activeTheme.accent,
    '--theme-soft': activeTheme.soft,
    '--theme-glow': activeTheme.glow,
    '--theme-card': activeTheme.card,
    '--theme-printer': moodTouched ? activeTheme.soft : '#d9f0ff',
  } as CSSProperties;

  async function revealReceipt(nextReceipt: ReceiptResponse) {
    setVisibleReceipt(null);
    setReceiptSide('front');
    setReceiptMinimized(false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setVisibleReceipt(nextReceipt);
  }

  async function generate(input?: string) {
    if (loading) return;

    const finalText = (input || text).trim();
    const details = followUpAnswer.trim();
    if (!finalText) return;

    setLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          text: finalText,
          details,
          mood: selectedMood,
          intensity,
          memory: getMemory(),
          variationSeed: Math.floor(Math.random() * 1000000),
          previousMain: visibleReceipt?.main || receipt?.main || '',
        }),
      });

      const data = await response.json();
      const nextReceipt: ReceiptResponse = {
        main: typeof data.main === 'string' ? data.main : 'printer said no. try again.',
        best: typeof data.best === 'string' ? data.best : 'You do it.',
        worst: typeof data.worst === 'string' ? data.worst : 'You stall again.',
      };

      setReceipt(nextReceipt);
      setTicketNumber(nextTicketNumber());
      setIssuedAt(nextIssuedAt());
      setMemory(finalText);
      setPrintedTask(finalText);
      setPrintedContext(details);
      setPrintedMood(selectedMood);
      setPrintedIntensity(intensity);
      await revealReceipt(nextReceipt);
    } catch {
      const fallback: ReceiptResponse = {
        main: 'printer jammed. try again.',
        best: 'You reset and finish it.',
        worst: 'You stall and spiral.',
      };
      setReceipt(fallback);
      setTicketNumber(nextTicketNumber());
      setIssuedAt(nextIssuedAt());
      setPrintedTask(finalText);
      setPrintedContext(details);
      setPrintedMood(selectedMood);
      setPrintedIntensity(intensity);
      await revealReceipt(fallback);
    }

    setLoading(false);
  }

  async function saveReceipt() {
    const node = document.getElementById('receipt');
    if (!node) return;

    const liveFace = node.querySelector(
      receiptSide === 'front' ? '.receipt-face-panel.front' : '.receipt-face-panel.back'
    ) as HTMLElement | null;
    if (!liveFace) return;

    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const faceRect = liveFace.getBoundingClientRect();
    const exportHeight = Math.max(liveFace.scrollHeight, faceRect.height);
    const previousStyle = liveFace.getAttribute('style') || '';

    liveFace.style.transform = 'none';
    liveFace.style.backfaceVisibility = 'visible';
    liveFace.style.webkitBackfaceVisibility = 'visible';
    liveFace.style.position = 'relative';
    liveFace.style.inset = 'auto';
    liveFace.style.width = `${faceRect.width}px`;
    liveFace.style.height = `${exportHeight}px`;
    liveFace.style.minHeight = `${exportHeight}px`;
    liveFace.style.overflow = 'visible';
    liveFace.style.opacity = '1';
    liveFace.style.visibility = 'visible';
    liveFace.style.background = '#fffdfa';

    try {
      const blob = await toBlob(liveFace, {
        pixelRatio: 3,
        backgroundColor: '#fffdfa',
        cacheBust: true,
        width: Math.ceil(faceRect.width),
        height: Math.ceil(exportHeight),
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'guilttrip-receipt.png';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      const dataUrl = await toPng(liveFace, {
        pixelRatio: 3,
        backgroundColor: '#fffdfa',
        cacheBust: true,
        width: Math.ceil(faceRect.width),
        height: Math.ceil(exportHeight),
      });
      const link = document.createElement('a');
      link.download = 'guilttrip-receipt.png';
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      if (previousStyle) {
        liveFace.setAttribute('style', previousStyle);
      } else {
        liveFace.removeAttribute('style');
      }
    }
  }

  function redo() {
    setReceipt(null);
    setVisibleReceipt(null);
    setReceiptSide('front');
    setReceiptMinimized(false);
    window.setTimeout(() => {
      document.querySelector('.printer-shell')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);
  }

  function tearReceipt() {
    setVisibleReceipt(null);
    setReceiptSide('front');
    setReceiptMinimized(false);
  }

  function handleReceiptTap() {
    const now = Date.now();
    if (now - lastReceiptTap < 320) {
      tearReceipt();
      setLastReceiptTap(0);
      return;
    }
    setLastReceiptTap(now);
  }

  function reopenIntro() {
    setFlowUnlocked(false);
    setJobPromptIndex(Math.floor(Math.random() * jobQuestionPrompts.length));
  }

  return (
    <main className="experience-shell" style={stageStyle}>
      <section className="phone-stage">
        <div className="phone-frame">
          <div className={`device-stage${visibleReceipt ? ' has-receipt' : ''}`}>
            <Printer isPrinting={loading} showPaper={loading || !!visibleReceipt}>
              <div className="printer-screen">
                <div className="screen-header lime">
                  <div>
                    <p className="panel-kicker">day {streak}</p>
                    <p className={`panel-copy${loading ? ' loading-copy' : ''}`}>{loading ? activeMood.statusLines[loadingLineIndex] : activeMood.receiptWorld}</p>
                  </div>
                </div>

                <div className="goblin-card">
                  <button
                    type="button"
                    className={`goblin-avatar mood-${selectedMood} clickable`}
                    onClick={() => {
                      setMoodTouched(true);
                      setSelectedMood(shiftMood(selectedMood, 1));
                    }}
                    aria-label="Change goblin"
                  >
                    <span className="goblin-horn left" />
                    <span className="goblin-horn right" />
                    <span className="goblin-eye left" />
                    <span className="goblin-eye right" />
                    <span className="goblin-blush left" />
                    <span className="goblin-blush right" />
                    <span className="goblin-mouth" />
                  </button>
                  <div className="goblin-copy">
                    <p className="goblin-name">{activeMood.goblinName}</p>
                    <p className="goblin-speech">{activeMood.goblinLabel}. {activeMood.goblinSpeech}</p>
                    <p className="goblin-hint">tap the goblin to switch character</p>
                  </div>
                </div>

                {!flowUnlocked ? (
                  <div className="flow-gate">
                    <label className="prompt-wrap" htmlFor="follow-up">
                      <span>{activeJobPrompt.label}</span>
                      <input
                        id="follow-up"
                        value={followUpAnswer}
                        onChange={(event) => setFollowUpAnswer(event.target.value)}
                        placeholder={activeJobPrompt.placeholder}
                        className="prompt-input detail-input"
                      />
                    </label>

                    <button
                      type="button"
                      className="primary-action flow-continue"
                      disabled={!canContinue}
                      onClick={() => setFlowUnlocked(true)}
                    >
                      Continue
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="context-strip">
                      <span className="context-label">{activeMood.label.replace('\n', ' ')}</span>
                      <p>{followUpAnswer}</p>
                      <button
                        type="button"
                        className="context-edit"
                        onClick={reopenIntro}
                      >
                        edit
                      </button>
                    </div>

                    <div className="control-band single-rail">
                      <div className="task-column">
                        <label className="prompt-wrap" htmlFor="prompt">
                          <span>{activeMood.taskLabel}</span>
                          <textarea
                            id="prompt"
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            placeholder={activeMood.taskLabel}
                            className="prompt-input"
                          />
                        </label>

                        <div className="action-row">
                          <button type="button" className="primary-action" onClick={() => generate()} disabled={!canPrint || loading}>
                            {loading ? 'Printing' : 'Print'}
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => generate(activeMood.promptSeed)}
                          >
                            Surprise
                          </button>
                        </div>

                        <div className="suggestion-row">
                          <button
                            type="button"
                            className={`suggestion-chip${loading ? ' suggestion-chip-live' : ''}`}
                            onClick={() => setText(activeMood.promptSeed)}
                          >
                            {loading ? activeMood.statusLines[loadingLineIndex] : activeMood.promptSeed}
                          </button>
                        </div>
                      </div>

                      <div className="rail-wrap">
                        <span className="rail-top">Soft</span>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={1}
                          value={intensityIndex}
                          onChange={(event) => setIntensity(intensitySteps[Number(event.target.value)].value)}
                          className="rail-slider"
                          aria-label="Roast intensity"
                        />
                        <span className="rail-bottom">Unhinged</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Printer>

            {visibleReceipt ? (
              <div className={`receipt-overlay visible${receiptMinimized ? ' minimized' : ''}`}>
                <div id="receipt" className="receipt-sheet external">
                  {receiptMinimized ? (
                    <button
                      type="button"
                      className="receipt-reopen"
                      onClick={() => {
                        setReceiptSide('front');
                        setReceiptMinimized(false);
                      }}
                    >
                      open ticket #{ticketNumber}
                    </button>
                  ) : (
                  <div
                    className={`receipt-card${receiptSide === 'back' ? ' flipped' : ''}`}
                    onClick={handleReceiptTap}
                  >
                    <section className="receipt-face-panel front">
                      <div className="receipt-cutline">
                        <span>double tap to tear</span>
                        <div className="receipt-cutline-actions">
                          <button
                            type="button"
                            className="receipt-flip"
                            onClick={() => setReceiptSide('back')}
                          >
                            see back
                          </button>
                          <button
                            type="button"
                            className="receipt-flip"
                            onClick={() => {
                              setReceiptSide('front');
                              setReceiptMinimized(true);
                            }}
                          >
                            minimize
                          </button>
                        </div>
                      </div>

                      <div className="receipt-scroll">
                        <p className="receipt-title-thermal">Roast Ticket</p>
                        <p className="receipt-meta stamp">timestamp: {issuedAt}</p>
                        <div className="receipt-lines">
                          {visibleRoastLines.map((line, index) => (
                            <p key={`${ticketNumber}-${index}`} className="receipt-line staggered">{line}</p>
                          ))}
                        </div>
                        <div className="receipt-barcode" aria-hidden="true" />
                      </div>

                      <div className="receipt-dash" />
                      <div className="receipt-footer">
                        <span>ticket #{ticketNumber}</span>
                        <span>{printedMoodOption.footerLine}</span>
                      </div>
                    </section>

                    <section className="receipt-face-panel back">
                      <div className="receipt-cutline">
                        <span>double tap to tear</span>
                        <div className="receipt-cutline-actions">
                          <button
                            type="button"
                            className="receipt-flip"
                            onClick={() => setReceiptSide('front')}
                          >
                            see front
                          </button>
                          <button
                            type="button"
                            className="receipt-flip"
                            onClick={() => {
                              setReceiptSide('front');
                              setReceiptMinimized(true);
                            }}
                          >
                            minimize
                          </button>
                        </div>
                      </div>

                      <div className="receipt-scroll">
                        <p className="receipt-title-thermal small">Outcome Slip</p>
                        <p className="receipt-meta stamp">{printedMoodOption.receiptWorld}</p>
                        <div className="receipt-dash" />
                        <div className="receipt-cases stacked">
                          <div className="receipt-case best">
                            <span className="receipt-case-label">{printedMoodOption.bestLabel}</span>
                            <p className="receipt-case-text">{visibleReceipt.best}</p>
                          </div>
                          <div className="receipt-case worst">
                            <span className="receipt-case-label">{printedMoodOption.worstLabel}</span>
                            <p className="receipt-case-text">{visibleReceipt.worst}</p>
                          </div>
                        </div>
                      </div>

                      <div className="receipt-dash" />
                      <div className="receipt-footer">
                        <span>ticket #{ticketNumber}</span>
                        <span>turn me over</span>
                      </div>
                    </section>
                  </div>
                  )}
                </div>
                {!receiptMinimized ? (
                  <div className="receipt-actions">
                    <button type="button" className="receipt-action-button" onClick={redo}>
                      Ow, again
                    </button>
                    <button type="button" className="receipt-action-button" onClick={saveReceipt}>
                      Save
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function splitRoastLines(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

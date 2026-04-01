'use client';

import { motion } from 'framer-motion';
import Printer from '@/components/Printer';

export default function EndCardPage() {
  return (
    <main className="endcard-shell">
      <section className="endcard-stage">
        <motion.div
          className="endcard-copy"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <p className="endcard-kicker">tiny goblin printer presents</p>
          <h1 className="endcard-title">
            want the judgmental goblin
            <br />
            to read you too?
          </h1>
          <p className="endcard-subtitle">
            comment &quot;link&quot; or check the bio yourself
          </p>
        </motion.div>

        <motion.div
          className="endcard-printer-wrap"
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: 'easeOut' }}
        >
          <Printer isPrinting showPaper>
            <div className="endcard-printer-screen">
              <div className="endcard-status">
                <span>doom report</span>
                <span>read pending</span>
              </div>

              <div className="endcard-goblin-card">
                <div className="endcard-goblin-avatar" aria-hidden="true">
                  <span className="endcard-goblin-horn left" />
                  <span className="endcard-goblin-horn right" />
                  <span className="endcard-goblin-eye left" />
                  <span className="endcard-goblin-eye right" />
                  <span className="endcard-goblin-blush left" />
                  <span className="endcard-goblin-blush right" />
                  <span className="endcard-goblin-mouth" />
                </div>

                <div className="endcard-goblin-copy">
                  <p className="endcard-goblin-name">Judgmental Goblin</p>
                  <p className="endcard-goblin-line">go ahead. i already have notes.</p>
                </div>
              </div>

              <div className="endcard-cta-card">
                <p>comment &quot;link&quot;</p>
                <p>or check the bio yourself</p>
              </div>
            </div>
          </Printer>
        </motion.div>
      </section>
    </main>
  );
}

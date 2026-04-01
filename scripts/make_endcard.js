const fs = require("fs");
const path = require("path");

const WIDTH = 1080;
const HEIGHT = 1920;
const FRAMES = 18;

const outDir = path.join(process.cwd(), "generated", "endcard-frames");
fs.mkdirSync(outDir, { recursive: true });

const headline = "want the judgmental goblin\nto read you too?";
const subhead = 'comment "link" or check the bio yourself';

for (let i = 0; i < FRAMES; i += 1) {
  const t = i / FRAMES;
  const bob = Math.sin(t * Math.PI * 2) * 10;
  const paperDrop = 210 + Math.sin(t * Math.PI * 2) * 8;
  const glow = 0.18 + ((Math.sin(t * Math.PI * 2) + 1) / 2) * 0.08;
  const ctaOpacity = 0.88 + ((Math.sin(t * Math.PI * 2) + 1) / 2) * 0.12;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#232428"/>
        <stop offset="100%" stop-color="#1f2023"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="20%" r="55%">
        <stop offset="0%" stop-color="rgba(185,224,255,${glow})"/>
        <stop offset="100%" stop-color="rgba(185,224,255,0)"/>
      </radialGradient>
      <linearGradient id="printerBody" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#e4f4ff"/>
        <stop offset="100%" stop-color="#c6e6fb"/>
      </linearGradient>
      <linearGradient id="screen" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#c3cdd5"/>
        <stop offset="100%" stop-color="#adb8c2"/>
      </linearGradient>
      <linearGradient id="panel" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#f7f5ef"/>
        <stop offset="100%" stop-color="#f0ece5"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="26" stdDeviation="24" flood-color="rgba(0,0,0,0.28)"/>
      </filter>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

    <g transform="translate(0 ${bob.toFixed(2)})" filter="url(#shadow)">
      <rect x="108" y="320" rx="48" ry="48" width="864" height="1180" fill="url(#printerBody)"/>
      <rect x="132" y="346" rx="42" ry="42" width="816" height="1128" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="4"/>
      <rect x="188" y="486" rx="30" ry="30" width="704" height="912" fill="url(#screen)" stroke="#66717b" stroke-width="10"/>
      <rect x="214" y="516" rx="24" ry="24" width="652" height="858" fill="#c0c8cf" stroke="#8d98a4" stroke-width="10"/>

      <rect x="242" y="560" rx="22" ry="22" width="596" height="118" fill="#f4f0e7" stroke="#69747d" stroke-width="8"/>
      <rect x="238" y="484" rx="26" ry="26" width="604" height="54" fill="#2b3137"/>
      <rect x="540" y="520" rx="0" ry="0" width="96" height="${paperDrop}" fill="#faf8f4"/>
      <rect x="210" y="700" rx="22" ry="22" width="656" height="490" fill="url(#panel)"/>

      <rect x="286" y="812" width="122" height="122" fill="#95b3f4" stroke="#43639a" stroke-width="8"/>
      <rect x="314" y="858" width="16" height="16" fill="#355a2d"/>
      <rect x="362" y="858" width="16" height="16" fill="#355a2d"/>
      <rect x="308" y="898" width="20" height="10" fill="#f2a5b0"/>
      <rect x="364" y="898" width="20" height="10" fill="#f2a5b0"/>
      <rect x="336" y="930" width="28" height="10" fill="#355a2d"/>
      <rect x="300" y="792" width="18" height="16" fill="#355a2d"/>
      <rect x="364" y="792" width="18" height="16" fill="#355a2d"/>

      <text x="450" y="836" font-size="24" font-family="'IBM Plex Mono', monospace" letter-spacing="4" fill="#3d4349">JUDGMENTAL GOBLIN</text>
      <text x="450" y="888" font-size="42" font-family="'DM Sans', sans-serif" font-weight="700" fill="#2d3640">go ahead. i have notes.</text>
      <text x="450" y="944" font-size="24" font-family="'IBM Plex Mono', monospace" letter-spacing="2" fill="#607382">tiny future accountability department</text>

      <text x="184" y="182" font-size="72" font-family="'DM Sans', sans-serif" font-weight="800" fill="#faf8f4">
        ${headline.split("\n").map((line, index) => `<tspan x="184" dy="${index === 0 ? 0 : 84}">${escapeXml(line)}</tspan>`).join("")}
      </text>

      <rect x="184" y="1310" rx="22" ry="22" width="712" height="132" fill="rgba(250,248,244,0.96)" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
      <text x="540" y="1368" text-anchor="middle" font-size="34" font-family="'IBM Plex Mono', monospace" letter-spacing="2" fill="rgba(70,75,82,${ctaOpacity.toFixed(2)})">
        ${escapeXml(subhead)}
      </text>
    </g>
  </svg>`;

  fs.writeFileSync(path.join(outDir, `frame-${String(i).padStart(2, "0")}.svg`), svg);
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

console.log(outDir);

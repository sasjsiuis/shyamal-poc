import fs from 'node:fs';
import path from 'node:path';

const logoPath = path.join(process.cwd(), 'public/assets/shyamal_sylhet_logo.png');
const logoB64 = fs.readFileSync(logoPath).toString('base64');

// Dotted texture for Maroon template
const dots: string[] = [];
for (let y = 30; y < 1060; y += 22) {
  for (let x = 30; x < 1060; x += 22) {
    const inPhotoHole = x > 75 && x < 1008 && y > 80 && y < 718;
    if (inPhotoHole) continue;
    const hash = ((x * 17) ^ (y * 31)) % 100;
    if (hash < 20) {
      const opacity = (0.07 + (hash % 10) * 0.015).toFixed(3);
      dots.push(`<circle cx="${x}" cy="${y}" r="2" fill="#ffffff" opacity="${opacity}" />`);
    }
  }
}

const maroonSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <mask id="maroonHoleMask">
      <rect width="1080" height="1080" fill="white" />
      <rect x="77" y="82" width="929" height="634" fill="black" />
    </mask>

    <linearGradient id="maroonBgGrad" x1="0" y1="0" x2="1080" y2="1080" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#5a0b22" />
      <stop offset="45%" stop-color="#69122c" />
      <stop offset="70%" stop-color="#550c20" />
      <stop offset="100%" stop-color="#420616" />
    </linearGradient>

    <linearGradient id="lightSheen" x1="1080" y1="0" x2="0" y2="1080" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.04" />
      <stop offset="70%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.25" />
    </linearGradient>

    <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.65" />
    </filter>
  </defs>

  <!-- Masked Background: Leaves photo window 100% transparent -->
  <g mask="url(#maroonHoleMask)">
    <rect width="1080" height="1080" fill="url(#maroonBgGrad)" />
    <rect width="1080" height="1080" fill="url(#lightSheen)" />

    <g>
      ${dots.join('\n      ')}
    </g>

    <g stroke="rgba(255,255,255,0.06)" stroke-width="1.5">
      <line x1="0" y1="200" x2="400" y2="0" />
      <line x1="0" y1="600" x2="1080" y2="60" />
      <line x1="200" y1="1080" x2="1080" y2="640" />
      <line x1="700" y1="1080" x2="1080" y2="890" />
    </g>

    <rect x="77" y="726" width="929" height="276" fill="#5c0f24" />
    <rect x="77" y="726" width="929" height="276" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
  </g>

  <!-- Outer Frame with corner notches and top/bottom openings -->
  <g stroke="rgba(255, 255, 255, 0.85)" stroke-width="2.5" fill="none">
    <line x1="54" y1="66" x2="365" y2="66" />
    <line x1="715" y1="66" x2="1026" y2="66" />
    <line x1="54" y1="66" x2="54" y2="1016" />
    <line x1="1026" y1="66" x2="1026" y2="1016" />
    <line x1="54" y1="1016" x2="365" y2="1016" />
    <line x1="715" y1="1016" x2="1026" y2="1016" />

    <line x1="38" y1="66" x2="54" y2="66" />
    <line x1="1026" y1="66" x2="1042" y2="66" />
    <line x1="54" y1="50" x2="54" y2="66" />
    <line x1="1026" y1="50" x2="1026" y2="66" />

    <line x1="38" y1="1016" x2="54" y2="1016" />
    <line x1="1026" y1="1016" x2="1042" y2="1016" />
    <line x1="54" y1="1016" x2="54" y2="1032" />
    <line x1="1026" y1="1016" x2="1026" y2="1032" />
  </g>

  <!-- Crisp Photo Frame Border -->
  <rect x="77" y="82" width="929" height="634" fill="none" stroke="#ffffff" stroke-width="3" />
  <rect x="79" y="84" width="925" height="630" fill="none" stroke="rgba(100, 15, 35, 0.4)" stroke-width="1" />

  <!-- Top Center: Authentic Shyamal Sylhet Logo -->
  <g filter="url(#logoShadow)">
    <image href="data:image/png;base64,${logoB64}" x="375" y="14" width="330" height="70" preserveAspectRatio="xMidYMid meet" />
  </g>

  <!-- Bottom CTA Footer: '••• বিস্তারিত কমেন্টে •••' in golden-yellow -->
  <g id="maroonFooter">
    <text x="540" y="1048" font-family="'Kalpurush', 'Hind Siliguri', sans-serif" font-size="34" font-weight="700" fill="#ffd132" text-anchor="middle" dominant-baseline="middle">&#x2022;&#x2022;&#x2022; বিস্তারিত কমেন্টে &#x2022;&#x2022;&#x2022;</text>
    <line x1="68" y1="1048" x2="350" y2="1048" stroke="#ffd132" stroke-width="2.5" opacity="0.9" />
    <line x1="730" y1="1048" x2="1012" y2="1048" stroke="#ffd132" stroke-width="2.5" opacity="0.9" />
  </g>
</svg>`;

const outputPath = path.join(process.cwd(), 'public/templates/maroon_overlay.svg');
fs.writeFileSync(outputPath, maroonSvg, 'utf8');
console.log('Successfully generated maroon_overlay.svg with size:', maroonSvg.length);

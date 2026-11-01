import fs from 'node:fs';
import path from 'node:path';

const logoPath = path.join(process.cwd(), 'public/assets/shyamal_sylhet_logo.png');
const logoB64 = fs.readFileSync(logoPath).toString('base64');

const greenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000" viewBox="0 0 2000 2000">
  <defs>
    <!-- Hole for news photo -->
    <mask id="greenHoleMask">
      <rect width="2000" height="2000" fill="white" />
      <rect x="62" y="512" width="1864" height="1057" fill="black" />
    </mask>

    <linearGradient id="greenBg" x1="0" y1="0" x2="2000" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#024645" />
      <stop offset="50%" stop-color="#02504f" />
      <stop offset="100%" stop-color="#013f3e" />
    </linearGradient>

    <filter id="subtleShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Masked background leaving photo hole 100% transparent -->
  <g mask="url(#greenHoleMask)">
    <!-- Top banner for headline -->
    <rect x="0" y="0" width="2000" height="512" fill="url(#greenBg)" />
    <!-- Side borders -->
    <rect x="0" y="512" width="62" height="1057" fill="#024645" />
    <rect x="1926" y="512" width="74" height="1057" fill="#024645" />
    <!-- Bottom white card footer -->
    <rect x="0" y="1569" width="2000" height="431" fill="#ffffff" />
  </g>

  <!-- Crisp white border around photo frame -->
  <rect x="62" y="512" width="1864" height="1057" fill="none" stroke="#ffffff" stroke-width="4" />

  <!-- Centered CTA Pill: '••• বিস্তারিত কমেন্টে •••' -->
  <g id="greenCta" filter="url(#subtleShadow)">
    <rect x="695" y="1604" width="610" height="82" rx="41" fill="#01665e" />
    <text x="1000" y="1658" font-family="'Kalpurush', 'Hind Siliguri', sans-serif" font-size="42" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">&#x2022;&#x2022;&#x2022; বিস্তারিত কমেন্টে &#x2022;&#x2022;&#x2022;</text>
    
    <!-- 3 decorative dots left & right -->
    <circle cx="630" cy="1645" r="11" fill="#01665e" />
    <circle cx="590" cy="1645" r="11" fill="#01665e" />
    <circle cx="550" cy="1645" r="11" fill="#01665e" />
    
    <circle cx="1370" cy="1645" r="11" fill="#01665e" />
    <circle cx="1410" cy="1645" r="11" fill="#01665e" />
    <circle cx="1450" cy="1645" r="11" fill="#01665e" />
  </g>

  <!-- Left Website URL in deep maroon -->
  <text x="90" y="1935" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="700" font-size="64" fill="#65142a">shyamalsylhet.net</text>

  <!-- Right: Official Shyamal Sylhet Logo Image -->
  <image href="data:image/png;base64,${logoB64}" x="1320" y="1805" width="590" height="155" preserveAspectRatio="xMaxYMid meet" />
</svg>`;

const outputPath = path.join(process.cwd(), 'public/templates/green_overlay.svg');
fs.writeFileSync(outputPath, greenSvg, 'utf8');
console.log('Successfully generated green_overlay.svg with size:', greenSvg.length);

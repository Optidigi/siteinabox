import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FBF7F0"/>

  <text x="80" y="120"
        font-family="ui-sans-serif, system-ui, sans-serif"
        font-size="22"
        font-weight="500"
        letter-spacing="4"
        fill="#1F1A14">AMICARE-ZORG</text>

  <line x1="80" y1="148" x2="140" y2="148" stroke="#B45A3C" stroke-width="2"/>

  <text x="80" y="320"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="84"
        font-weight="400"
        fill="#1F1A14">Jeugdzorg met</text>
  <text x="80" y="430"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="84"
        font-style="italic"
        font-weight="400"
        fill="#B45A3C">hart en toewijding.</text>

  <text x="80" y="560"
        font-family="ui-sans-serif, system-ui, sans-serif"
        font-size="20"
        fill="#5A4F44">ami-care.nl</text>
</svg>
`;

const out = join(projectRoot, 'public', 'og.png');
await sharp(Buffer.from(svg)).png().toFile(out);
console.log('Wrote', out);

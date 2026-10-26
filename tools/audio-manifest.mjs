// Lists the licensed audio files in public/assets/audio/{sfx,music}/ into manifest.json,
// so the game uses them instead of the synthesized placeholders. Run: npm run audio:manifest
// A file is matched by name: sfx/coin.ogg replaces the "coin" sound, music/village.mp3 the village track.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'public/assets/audio');
const EXT = new Set(['.ogg', '.mp3', '.m4a', '.wav', '.webm']);
const manifest = { sfx: {}, music: {} };

for (const kind of ['sfx', 'music']) {
  const dir = path.join(base, kind);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!EXT.has(ext)) continue;
    const name = path.basename(file, ext);
    if (manifest[kind][name]) console.warn(`aviso: dois arquivos para "${kind}/${name}", usando ${manifest[kind][name]}`);
    else manifest[kind][name] = `${kind}/${file}`;
  }
}

fs.writeFileSync(path.join(base, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const n = Object.keys(manifest.sfx).length + Object.keys(manifest.music).length;
console.log(`manifest.json: ${Object.keys(manifest.sfx).length} efeitos, ${Object.keys(manifest.music).length} músicas (${n} arquivos).`);

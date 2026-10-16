// Builds app/public from the studios: runs the studio build, copies the welcome page, client
// list and each studio, adds the app-only pages (the client review page), and points every
// client's calendar at the app's own server (/api).
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..'), root = join(app, '..'), out = join(app, 'public');

execFileSync('python3', [join(root, 'src/make-springforth.py')], { stdio: 'inherit' });
execFileSync('python3', [join(root, 'src/build.py')], { stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const skip = src => /Canva Photos|\.DS_Store/.test(src);
for (const f of ['index.html', 'clients.js']) cpSync(join(root, f), join(out, f));
for (const d of ['bakken-young', 'mcmillan', 'springforth']) {
  if (existsSync(join(root, d))) cpSync(join(root, d), join(out, d), { recursive: true, filter: src => !skip(src) });
}
cpSync(join(app, 'static'), out, { recursive: true });

// Every client gets the app's calendar, AI drafting, saving and review links.
writeFileSync(join(out, 'clients.js'), readFileSync(join(out, 'clients.js'), 'utf8') + `
// App build: every client's calendar, AI drafting, graphics and review links go through the
// app's own server, with no Google Sheet. Past months live in the app too, and AI drafting
// learns the client's voice from them.
for (const c of window.BI_CLIENTS) {
  const cal = Object.assign({ postDays: ['Mon', 'Wed'] }, c.calendar || {}, { driveEndpoint: '/api' });
  delete cal.sheetId; delete cal.url;
  c.calendar = cal;
}
`);
console.log('app/public built');

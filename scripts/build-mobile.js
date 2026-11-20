const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Server-only pieces (admin push API, watch party API, cron API) can't live in a static export.
const STASH = path.join(__dirname, '..', '.export-stash');
const MOVES = ['src/app/api/admin', 'src/app/api/party', 'src/app/api/cron'];
function stash() { fs.mkdirSync(STASH, { recursive: true }); MOVES.forEach((m, i) => { const s = path.join(__dirname, '..', m); if (fs.existsSync(s)) fs.renameSync(s, path.join(STASH, String(i))); }); }
function restore() { MOVES.forEach((m, i) => { const f = path.join(STASH, String(i)); const s = path.join(__dirname, '..', m); if (fs.existsSync(f)) fs.renameSync(f, s); }); fs.rmSync(STASH, { recursive: true, force: true }); }
process.on('exit', restore);
stash();
fs.rmSync(path.join(__dirname, '..', '.next'), { recursive: true, force: true });

console.log('Building Stream Freak static export for Android (out/)...');
try {
  execSync('npx next build', {
    env: Object.assign({}, process.env, { NEXT_EXPORT: 'true' }),
    stdio: 'inherit'
  });
  console.log('Static export completed in out/');
  console.log('Syncing web assets to android/ project...');
  execSync('npx cap sync android', {
    stdio: 'inherit'
  });
  console.log('Android project is fully synced and ready for Android Studio!');
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}

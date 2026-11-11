// Run a mobile app on your phone with Expo Go — works on a laptop or in GitHub Codespaces.
//   npm run phone:customer      or      npm run phone:astrologer
// Starts Expo with a public tunnel, points the app at the API, and prints the link to open in Expo Go.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = process.argv[2];
if (!['customer', 'astrologer'].includes(app)) {
  console.error('Usage: node scripts/phone.mjs customer|astrologer');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const say = (msg) => console.log(`\n\x1b[1m\x1b[35m▶ ${msg}\x1b[0m`);

// 1. Install mobile dependencies on first run.
if (!existsSync(path.join(root, 'node_modules', 'expo'))) {
  say('Installing mobile app dependencies (first run only, ~2 minutes)…');
  const r = spawnSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 2. Work out the API address the phone should use.
let apiUrl = process.env.EXPO_PUBLIC_API_URL;
const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: domain } = process.env;
if (!apiUrl && CODESPACE_NAME && domain) {
  apiUrl = `https://${CODESPACE_NAME}-4000.${domain}`;
  say('GitHub Codespaces detected — making the API (port 4000) reachable from your phone…');
  const r = spawnSync('gh', ['codespace', 'ports', 'visibility', '4000:public', '-c', CODESPACE_NAME], { stdio: 'inherit' });
  if (r.status !== 0) console.log('   Could not change it automatically. In the PORTS tab, right-click port 4000 → Port Visibility → Public.');
}
if (apiUrl) {
  try {
    // redirect: 'manual' — a private Codespaces port redirects to GitHub sign-in, which a phone can't pass.
    const res = await fetch(`${apiUrl}/health`, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const body = res.ok ? await res.json().catch(() => null) : null;
    if (body?.status !== 'ok') throw new Error(res.status >= 300 && res.status < 400 ? 'port 4000 is still Private' : `HTTP ${res.status}`);
    say(`API reachable at ${apiUrl} ✓`);
  } catch (e) {
    console.log(`\n\x1b[1m\x1b[41m\x1b[37m  ACTION NEEDED  \x1b[0m  The API isn't reachable from your phone (${e.message}).`);
    if (CODESPACE_NAME) console.log('   Open the PORTS tab → right-click port 4000 → Port Visibility → Public, then run this command again.');
    else console.log('   Make sure the server is running: run  npm run dev:all  in the repository root.');
    console.log('');
    process.exit(1);
  }
} else {
  say('Using this computer\'s address for the API (phone and computer must be on the same Wi-Fi).');
}

// 3. The Expo tunnel requires a (free) Expo account — log in here if needed.
const appDir = path.join(root, 'apps', app);
const who = spawnSync('npx', ['expo', 'whoami'], { cwd: appDir, encoding: 'utf8', shell: process.platform === 'win32' });
if (who.status !== 0 || /not logged in/i.test(`${who.stdout}${who.stderr}`)) {
  say('Log in to your Expo account (free — create one at https://expo.dev/signup if you don\'t have it).');
  console.log('   Enter your Expo username, then your password (the password stays invisible while typing).');
  // --no-browser: browser login redirects to localhost, which is unreachable from a Codespace.
  const login = spawnSync('npx', ['expo', 'login', '--no-browser'], { cwd: appDir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (login.status !== 0) { console.log('\nLogin did not complete. Run this command again to retry.'); process.exit(1); }
} else {
  say(`Logged in to Expo as ${who.stdout.trim()} ✓`);
}

// 4. Start Expo with a tunnel and surface the Expo Go link.
say(`Starting the ${app === 'customer' ? 'Jyotish Connect (customer)' : 'Jyotish Partner (astrologer)'} app… this takes about a minute.`);
console.log(`
\x1b[1m\x1b[42m\x1b[30m  WHAT TO DO NEXT  \x1b[0m
  In about a minute a \x1b[1mQR code\x1b[0m and a line \x1b[1m"Metro waiting on exp://…"\x1b[0m appear below.
  • Scan the QR code: Expo Go → "Scan QR code" (Android) or the Camera app (iPhone).
  • Or copy the exp://… address, then in Expo Go tap "Enter URL manually" and paste it.
  Tip: make the terminal panel bigger (drag its top edge up) so the whole QR code fits.
`);
// Expo must write straight to the terminal: it only draws the QR code in an interactive terminal.
const child = spawn('npx', ['expo', 'start', '--tunnel', '--go'], {
  cwd: appDir,
  env: { ...process.env, ...(apiUrl ? { EXPO_PUBLIC_API_URL: apiUrl } : {}) },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));

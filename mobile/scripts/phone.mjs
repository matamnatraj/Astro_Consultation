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
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    say(`API reachable at ${apiUrl} ✓`);
  } catch (e) {
    console.log(`\n⚠  The API at ${apiUrl} isn't answering (${e.message}).`);
    console.log('   Make sure the server is running: open another terminal and run  npm run dev:all  in the repository root.');
    console.log('   In Codespaces, also check port 4000 is Public in the PORTS tab.\n');
  }
} else {
  say('Using this computer\'s address for the API (phone and computer must be on the same Wi-Fi).');
}

// 3. Start Expo with a tunnel and surface the Expo Go link.
say(`Starting the ${app === 'customer' ? 'Jyotish Connect (customer)' : 'Jyotish Partner (astrologer)'} app… this takes about a minute.`);
const child = spawn('npx', ['expo', 'start', '--tunnel', '--go'], {
  cwd: path.join(root, 'apps', app),
  env: { ...process.env, ...(apiUrl ? { EXPO_PUBLIC_API_URL: apiUrl } : {}) },
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
});
let shown = false;
child.stdout.on('data', (buf) => {
  const text = buf.toString();
  process.stdout.write(text);
  const m = !shown && text.match(/exp:\/\/[^\s\x1b]+/);
  if (m) {
    shown = true;
    const httpsLink = m[0].replace(/^exp:\/\//, 'https://');
    console.log('\n\x1b[1m\x1b[42m\x1b[30m  OPEN ON YOUR PHONE  \x1b[0m');
    console.log(`  In Expo Go: tap "Enter URL manually" and paste:  \x1b[1m${m[0]}\x1b[0m`);
    console.log(`  Or scan the QR code above with Expo Go (Android) / the Camera app (iPhone).`);
    console.log(`  (Browser link that also opens Expo Go: ${httpsLink})\n`);
  }
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));

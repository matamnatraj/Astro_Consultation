// Start the API and all three apps in one terminal: `npm run dev:all`
import { spawn } from 'node:child_process';

const procs = [
  ['api', ['run', 'dev:server']],
  ['customer', ['run', 'dev:customer']],
  ['astrologer', ['run', 'dev:astrologer']],
  ['admin', ['run', 'dev:admin']],
];
const children = procs.map(([name, args]) => {
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const out = (d) => d.toString().split('\n').filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  return p;
});
console.log('\nCustomer   → http://localhost:5173\nAstrologer → http://localhost:5174\nAdmin      → http://localhost:5175\n');
const stop = () => { children.forEach((c) => c.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

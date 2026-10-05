// Runs everything live sharing needs on this machine: the Vite dev server and the relay
// (`wrangler dev`, see party/server.js), with their output side by side. Ctrl+C stops both.
// Vite is started with --host so the page also answers on 127.0.0.1 (and on the network): the browser
// keeps a map and a person per origin, so localhost, 127.0.0.1 and a private window are separate clients.
import { spawn, spawnSync } from 'node:child_process';

const processes = [
  ['app  ', 'npx', ['vite', '--host']],
  ['relay', 'npx', ['wrangler', 'dev']],
];

const children = processes.map(([name, cmd, args]) => {
  const child = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) console.log(`[${name}] ${line}`);
    });
  }
  child.on('exit', (code) => {
    console.log(`[${name}] stopped (${code})`);
    stop();
  });
  return child;
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else child.kill();
  }
  process.exit();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(
  [
    '',
    'Live sharing, locally. Open the app twice as different people:',
    '  http://localhost:5173       and       http://127.0.0.1:5173   (or a private window)',
    'Click Share in one, then paste its link into the other. Relay: localhost:8787',
    '',
  ].join('\n'),
);

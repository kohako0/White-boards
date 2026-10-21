const { spawn } = require('node:child_process');
const http = require('node:http');
const url = 'http://127.0.0.1:4317';
function check() { return new Promise(resolve => {
  const req = http.get(url + '/api/health', res => { let body = ''; res.on('data', c => body += c); res.on('end', () => { try { resolve(JSON.parse(body).app === 'freiraum'); } catch { resolve(false); } }); });
  req.on('error', () => resolve(false)); req.setTimeout(1000, () => req.destroy());
}); }
(async () => {
  if (!await check()) {
    const child = spawn(process.execPath, [require('node:path').join(__dirname, 'server.js')], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    for (let i = 0; i < 30 && !await check(); i++) await new Promise(r => setTimeout(r, 200));
    if (!await check()) throw new Error('Die App konnte nicht starten. Ist Port 4317 bereits belegt?');
  }
  spawn('cmd.exe', ['/c', 'start', '', url], { stdio: 'ignore', windowsHide: true });
})().catch(e => { console.error(e.message); process.exitCode = 1; });

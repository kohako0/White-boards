const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ROOT = __dirname;
const DATA = process.env.WHITEBOARD_DATA_DIR || path.join(ROOT, 'boards');
const PORT = Number(process.env.PORT || 4317);
const VALID_ID = /^[a-zA-Z0-9_-]{1,80}$/;
let writes = Promise.resolve();

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 50 * 1024 * 1024) throw Object.assign(new Error('Das Board ist zu groß (maximal 50 MB).'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw Object.assign(new Error('Ungültiges JSON.'), { status: 400 }); }
}
function validate(board) {
  if (!board || typeof board.title !== 'string' || !Array.isArray(board.elements) || board.elements.length > 10000)
    throw Object.assign(new Error('Ungültige Board-Datei.'), { status: 400 });
  if (board.title.length > 200) throw Object.assign(new Error('Der Titel ist zu lang.'), { status: 400 });
  const types = ['path', 'text', 'note', 'rect', 'ellipse', 'arrow', 'image'];
  for (const e of board.elements) {
    if (!e || !types.includes(e.type) || typeof e.id !== 'string' || !Number.isFinite(e.x) || !Number.isFinite(e.y))
      throw Object.assign(new Error('Ungültiges Element im Board.'), { status: 400 });
    if (e.type === 'image' && (typeof e.src !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(e.src)))
      throw Object.assign(new Error('Nur eingebettete PNG-, JPEG-, WebP- und GIF-Bilder sind erlaubt.'), { status: 400 });
    if (['rect','ellipse','arrow','image','note'].includes(e.type) && ![e.w,e.h].every(Number.isFinite))
      throw Object.assign(new Error('Ungültige Abmessungen.'), { status: 400 });
    if (['text','note'].includes(e.type) && (typeof e.text !== 'string' || !Number.isFinite(e.fontSize) || e.fontSize < 1 || e.fontSize > 500))
      throw Object.assign(new Error('Ungültiger Text.'), { status: 400 });
    if (e.type === 'path' && (!Array.isArray(e.points) || !e.points.length || e.points.length > 20000 || !e.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))))
      throw Object.assign(new Error('Ungültige Zeichnung.'), { status: 400 });
    if (e.color && !/^#[0-9a-f]{6}$/i.test(e.color))
      throw Object.assign(new Error('Ungültige Farbe.'), { status: 400 });
  }
}
function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function handle(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      // Keep the file API private to this local origin, including writes from other websites.
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) return reply(res, 403, { error: 'Zugriff verweigert.' });
      if (req.headers['sec-fetch-site'] === 'cross-site') return reply(res, 403, { error: 'Zugriff verweigert.' });
      if (url.pathname === '/api/health') return reply(res, 200, { app: 'freiraum', version: 1 });
      await fs.mkdir(DATA, { recursive: true });
      if (url.pathname === '/api/boards' && req.method === 'GET') {
        const names = (await fs.readdir(DATA)).filter(n => n.endsWith('.json'));
        const results = await Promise.all(names.map(async n => {
          try {
            const b = JSON.parse(await fs.readFile(path.join(DATA, n), 'utf8'));
            return { id: b.id, title: b.title, updatedAt: b.updatedAt, count: b.elements.length, preview: b.preview || '' };
          } catch { return null; }
        }));
        return reply(res, 200, results.filter(Boolean).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
      }
      const match = url.pathname.match(/^\/api\/boards\/([a-zA-Z0-9_-]+)$/);
      if (!match || !VALID_ID.test(match[1])) return reply(res, 404, { error: 'Nicht gefunden.' });
      const id = match[1], file = path.join(DATA, id + '.json');
      if (req.method === 'GET') return reply(res, 200, JSON.parse(await fs.readFile(file, 'utf8')));
      if (req.method === 'PUT') {
        const board = await readBody(req); validate(board);
        board.id = id; board.updatedAt = new Date().toISOString();
        const save = writes.then(async () => {
          const tmp = file + '.' + randomUUID() + '.tmp';
          await fs.writeFile(tmp, JSON.stringify(board), 'utf8');
          await fs.rename(tmp, file);
        });
        writes = save.catch(() => {}); await save;
        return reply(res, 200, { updatedAt: board.updatedAt });
      }
      if (req.method === 'DELETE') {
        const remove = writes.then(() => fs.unlink(file));
        writes = remove.catch(() => {}); await remove;
        return reply(res, 200, { ok: true });
      }
      return reply(res, 405, { error: 'Methode nicht erlaubt.' });
    }
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
    const asset = files[url.pathname];
    if (!asset) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': asset[1] + '; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await fs.readFile(path.join(ROOT, 'public', asset[0])));
  } catch (err) { reply(res, err.status || (err.code === 'ENOENT' ? 404 : 500), { error: err.status ? err.message : err.code === 'ENOENT' ? 'Board nicht gefunden.' : 'Speichern fehlgeschlagen. Bitte erneut versuchen.' }); }
}
const server = http.createServer(handle);
if (require.main === module) server.listen(PORT, '127.0.0.1', () => console.log(`Freiraum läuft: http://127.0.0.1:${PORT}`));
module.exports = { server, validate };

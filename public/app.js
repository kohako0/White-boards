(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const icons = {
    boards:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="m8 21 4-4 4 4M12 17v4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>', upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>', back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
    undo:'<path d="M8 4 3 9l5 5M3 9h11a7 7 0 0 1 0 14" transform="translate(0 -2)"/>',
    redo:'<path d="m16 4 5 5-5 5m5-5H10a7 7 0 0 0 0 14" transform="translate(0 -2)"/>',
    cursor:'<path d="m5 3 14 10-7 1-3 7Z"/>', hand:'<path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8c0 4-3 7-7 7h-1c-3 0-4-2-6-4l-3-5a2 2 0 0 1 3-2l2 2"/>',
    pen:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z"/>',
    eraser:'<path d="m14 3 7 7-11 11H6l-4-4Z"/><path d="m7 12 7 7M10 21h12"/>',
    text:'<path d="M4 6V3h16v3M12 3v18M8 21h8"/>', note:'<path d="M14 21H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10Z"/><path d="M14 21v-7h7"/>',
    rect:'<rect x="4" y="4" width="16" height="16" rx="1"/>', ellipse:'<circle cx="12" cy="12" r="8"/>',
    line:'<path d="m5 19 14-14"/>', arrow:'<path d="m4 20 16-16M9 4h11v11"/>', image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', check:'<path d="m5 12 4 4L19 6"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>', layers:'<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`; }
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  let boards = [], board = null, tool = 'select', color = '#303832', width = 4, font = 24;
  let view = { x: 0, y: 0, zoom: 1 }, selected = null, gesture = null, space = false;
  let undo = [], redo = [], revision = 0, savedRevision = 0, saveTimer, savePromise = null, toastTimer;
  let editing = null, dragDepth = 0, lineCorrection = true;
  try { lineCorrection = localStorage.getItem('freiraum-line-correction') !== 'off'; } catch {}
  const palette = ['#303832','#ef714e','#e0b841','#5b8c68','#5c86b7','#9b78b6'];
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = () => crypto.randomUUID();
  function svg(tag, attrs = {}, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (parent) parent.appendChild(el); return el;
  }
  function toast(message, error = false) { $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, error ? 6500 : 3000); }
  async function api(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...options.headers } });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen.'); return data;
  }
  function status(text, error = false) { $('save-status').textContent = text; $('save-status').classList.toggle('error', error); }
  function history() { undo.push(clone(board.elements)); if (undo.length > 60) undo.shift(); redo = []; }
  function changed() { revision++; status('Wird gespeichert …'); clearTimeout(saveTimer); saveTimer = setTimeout(() => save().catch(e => toast(e.message, true)), 700); updateButtons(); }
  function updateButtons() { $('undo').disabled = !undo.length; $('redo').disabled = !redo.length; }
  async function save() {
    clearTimeout(saveTimer);
    if (!board) return;
    if (savePromise) { await savePromise; if (savedRevision !== revision) return save(); return; }
    if (savedRevision === revision) return;
    const current = board, rev = revision;
    const snapshot = { ...clone(current), view: clone(view) };
    savePromise = (async () => {
      try {
        snapshot.preview = await makePreview(snapshot.elements);
        const result = await api('/api/boards/' + current.id, { method:'PUT', body: JSON.stringify(snapshot) });
        if (board === current) { current.updatedAt = result.updatedAt; current.preview = snapshot.preview; savedRevision = rev; status(revision === rev ? 'Gespeichert' : 'Wird gespeichert …'); }
      } catch (e) { status('Nicht gespeichert · erneut versuchen', true); throw e; }
    })();
    try { await savePromise; } finally { savePromise = null; }
    if (board === current && savedRevision !== revision) return save();
  }
  function elapsed(date) {
    const n = Math.max(0, Date.now() - new Date(date));
    if (n < 60000) return 'Gerade eben'; if (n < 3600000) return `Vor ${Math.floor(n/60000)} Min.`;
    if (n < 86400000) return `Vor ${Math.floor(n/3600000)} Std.`;
    return new Date(date).toLocaleDateString('de-DE', { day:'numeric', month:'short', year:'numeric' });
  }
  async function loadBoards() { boards = await api('/api/boards'); renderDashboard(); }
  function renderDashboard() {
    $('board-count').textContent = boards.length; $('board-count-label').textContent = boards.length;
    $('recent-boards').replaceChildren();
    boards.slice(0,6).forEach(b => {
      const btn = document.createElement('button'); btn.className = 'recent-board'; btn.innerHTML = icon('boards');
      const label = document.createElement('span'); label.textContent = b.title || 'Ohne Titel'; btn.append(label);
      btn.onclick = () => openBoard(b.id).catch(report); $('recent-boards').append(btn);
    });
    const query = $('search').value.toLocaleLowerCase('de');
    const filtered = boards.filter(b => b.title.toLocaleLowerCase('de').includes(query));
    if ($('sort').value === 'name') filtered.sort((a,b) => a.title.localeCompare(b.title,'de'));
    const grid = $('board-grid'); grid.replaceChildren();
    filtered.forEach(b => {
      const card = document.createElement('article'); card.className = 'board-card';
      const preview = document.createElement('div'); preview.className = 'card-preview';
      if (/^data:image\/(png|webp|jpeg|svg\+xml)/.test(b.preview || '')) { const img = document.createElement('img'); img.src = b.preview; img.alt = ''; preview.append(img); }
      else { const empty = document.createElement('span'); empty.className = 'preview-empty'; empty.textContent = 'Deine Ideen, hier.'; preview.append(empty); }
      const content = document.createElement('div'); content.className = 'card-content';
      const title = document.createElement('h3'); title.className = 'card-title'; title.textContent = b.title || 'Ohne Titel';
      const meta = document.createElement('div'); meta.className = 'card-meta';
      meta.textContent = `${elapsed(b.updatedAt)}  ·  ${b.count} ${b.count === 1 ? 'Element' : 'Elemente'}`;
      content.append(title, meta); card.append(preview, content);
      const open = document.createElement('button'); open.className = 'card-open'; open.setAttribute('aria-label', b.title + ' öffnen'); open.onclick = () => openBoard(b.id).catch(report); card.append(open);
      const del = document.createElement('button'); del.className = 'card-delete'; del.innerHTML = icon('trash'); del.setAttribute('aria-label', b.title + ' löschen'); del.onclick = () => deleteBoard(b); card.append(del); grid.append(card);
    });
    const add = document.createElement('button'); add.className = 'new-card';
    add.innerHTML = `<span class="plus-circle">${icon('plus')}</span><strong>Neues Whiteboard</strong><small>Platz für deine nächste Idee</small>`; add.onclick = () => newBoard().catch(report); grid.append(add);
    $('empty-state').hidden = filtered.length > 0;
    $('empty-state').querySelector('h3').textContent = query ? 'Kein Whiteboard gefunden.' : 'Dein erster Freiraum wartet.';
    $('empty-state').querySelector('p').textContent = query ? 'Versuche einen anderen Suchbegriff.' : 'Erstelle ein Whiteboard und gib deinen Ideen Platz.';
  }
  function report(e) { toast(e.message || 'Etwas ist schiefgegangen.', true); }
  async function newBoard() {
    if (board) await save();
    const b = { id:uid(), title:'Ohne Titel', elements:[], view:{x:0,y:0,zoom:1}, createdAt:new Date().toISOString() };
    await api('/api/boards/' + b.id, { method:'PUT', body:JSON.stringify(b) }); await openBoard(b.id);
    $('board-title').focus(); $('board-title').select();
  }
  async function openBoard(id) {
    finishText();
    if (board) await save();
    board = await api('/api/boards/' + id); view = board.view || {x:0,y:0,zoom:1};
    if (![view.x,view.y,view.zoom].every(Number.isFinite) || view.zoom < .15 || view.zoom > 4) view = {x:0,y:0,zoom:1};
    selected = null; gesture = null; undo = []; redo = []; revision = savedRevision = 0;
    $('board-title').value = board.title; $('dashboard').hidden = true; $('editor').hidden = false;
    status('Gespeichert'); setTool('select'); render(); updateButtons(); $('canvas').focus();
  }
  async function goHome() { finishText(); if (board) await save(); board = null; $('editor').hidden = true; $('dashboard').hidden = false; await loadBoards(); }
  async function deleteBoard(b) {
    $('confirm-text').textContent = `„${b.title || 'Ohne Titel'}“ wird dauerhaft von diesem Computer gelöscht. Exportiere es vorher, wenn du es behalten möchtest.`;
    $('confirm-dialog').showModal();
    $('confirm-dialog').onclose = async () => {
      if ($('confirm-dialog').returnValue !== 'delete') return;
      try { await api('/api/boards/' + b.id, { method:'DELETE' }); await loadBoards(); toast('Whiteboard gelöscht.'); } catch(e) { report(e); }
    };
  }
  function elementBounds(e) {
    if (e.type === 'path') {
      const xs = e.points.map(p => p[0]), ys = e.points.map(p => p[1]);
      return { x:e.x + Math.min(...xs), y:e.y + Math.min(...ys), w:Math.max(...xs)-Math.min(...xs) || 1, h:Math.max(...ys)-Math.min(...ys) || 1 };
    }
    if (e.type === 'arrow') return { x:e.x+Math.min(0,e.w), y:e.y+Math.min(0,e.h), w:Math.abs(e.w)||1, h:Math.abs(e.h)||1 };
    if (e.type === 'text') {
      const lines = e.text.split('\n'), f = e.fontSize || 24;
      const ctx = document.createElement('canvas').getContext('2d'); ctx.font = `${f}px "Segoe UI", Arial, sans-serif`;
      return { x:e.x,y:e.y,w:Math.max(24,...lines.map(s => ctx.measureText(s).width)),h:Math.max(f*1.35,lines.length*f*1.35) };
    }
    return { x:e.x, y:e.y, w:e.w || 1, h:e.h || 1 };
  }
  function bounds(elements) {
    if (!elements.length) return {x:0,y:0,w:900,h:600};
    const list = elements.map(elementBounds);
    const x = Math.min(...list.map(b=>b.x)), y = Math.min(...list.map(b=>b.y));
    return { x,y,w:Math.max(...list.map(b=>b.x+b.w))-x,h:Math.max(...list.map(b=>b.y+b.h))-y };
  }
  function noteLines(text, fontSize, maxWidth) {
    const ctx = document.createElement('canvas').getContext('2d'); ctx.font = `${fontSize}px "Segoe UI", Arial, sans-serif`;
    const result = [];
    text.split('\n').forEach(line => {
      let current = '';
      for (const word of line.split(/\s+/)) {
        const next = current ? current + ' ' + word : word;
        if (current && ctx.measureText(next).width > maxWidth) { result.push(current); current = ''; }
        if (ctx.measureText(word).width > maxWidth) {
          for (const char of word) { if (current && ctx.measureText(current + char).width > maxWidth) { result.push(current); current = ''; } current += char; }
        } else current = current ? current + ' ' + word : word;
      }
      result.push(current);
    }); return result;
  }
  function drawElement(e, parent) {
    const g = svg('g', { 'data-id':e.id, transform:`translate(${e.x} ${e.y})` }, parent);
    const style = { stroke:e.color || '#303832', 'stroke-width':e.width || 4, fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round' };
    if (e.type === 'path') {
      svg('path', {...style, d:WhiteboardStroke.pathData(e.points,e.smooth)}, g);
    }
    if (e.type === 'rect') svg('rect', {...style, x:0,y:0,width:e.w,height:e.h,rx:3,fill:e.fill ? e.color : 'none'}, g);
    if (e.type === 'ellipse') svg('ellipse', {...style,cx:e.w/2,cy:e.h/2,rx:e.w/2,ry:e.h/2,fill:e.fill ? e.color : 'none'}, g);
    if (e.type === 'arrow') {
      svg('path', {...style,d:`M0 0L${e.w} ${e.h}`},g);
      const a = Math.atan2(e.h,e.w), size = Math.max(14,(e.width||4)*3);
      svg('path',{...style,d:`M${e.w-size*Math.cos(a-.5)} ${e.h-size*Math.sin(a-.5)}L${e.w} ${e.h}L${e.w-size*Math.cos(a+.5)} ${e.h-size*Math.sin(a+.5)}`},g);
    }
    if (e.type === 'image') svg('image', { href:e.src, width:e.w, height:e.h, preserveAspectRatio:'none' },g);
    if (e.type === 'note') {
      svg('rect',{x:2,y:4,width:e.w,height:e.h,rx:2,fill:'#28351b',opacity:.07},g);
      svg('rect',{width:e.w,height:e.h,rx:2,fill:e.color || '#f7e5a6'},g);
      svg('path',{d:`M${e.w-21} ${e.h}L${e.w} ${e.h-21}V${e.h}Z`,fill:'#000',opacity:.06},g);
    }
    if (e.type === 'text' || e.type === 'note') {
      const f = e.fontSize || 24, pad = e.type === 'note' ? 20 : 0;
      const lines = e.type === 'note' ? noteLines(e.text,f,e.w-40) : e.text.split('\n');
      const text = svg('text', { x:pad,y:pad+f,fill:e.type === 'note' ? '#3d4333' : e.color,'font-family':'Segoe UI, Arial, sans-serif','font-size':f, 'xml:space':'preserve' },g);
      lines.forEach((line,i) => { const span = svg('tspan',{x:pad,dy:i ? f*1.35 : 0},text); span.textContent = line || ' '; });
    }
    return g;
  }
  function render() {
    if (!board) return;
    const scene = $('scene'); scene.replaceChildren();
    scene.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.zoom})`);
    board.elements.forEach(e => {
      const group=drawElement(e,scene);
      if(editing?.id===e.id)group.querySelector('text')?.setAttribute('visibility','hidden');
    });
    const grid = $('grid-pattern'); grid.setAttribute('patternTransform',`translate(${view.x} ${view.y}) scale(${view.zoom})`);
    $('zoom-reset').textContent = Math.round(view.zoom*100) + ' %';
    $('board-hint').hidden = board.elements.length > 0;
    renderSelection();
    positionText();
  }
  function renderSelection() {
    const layer = $('selection-layer'); layer.replaceChildren();
    const e = board?.elements.find(e => e.id === selected);
    $('object-actions').hidden = !e; $('edit-text').hidden = !e || !['text','note'].includes(e.type);
    if (!e) return;
    const b = elementBounds(e), p = 5;
    const x = b.x*view.zoom+view.x-p, y = b.y*view.zoom+view.y-p, w = b.w*view.zoom+2*p,h = b.h*view.zoom+2*p;
    svg('rect',{x,y,width:w,height:h,fill:'none',stroke:'#739963','stroke-width':1.3,'stroke-dasharray':'4 3','pointer-events':'none'},layer);
    if (['image','rect','ellipse','note'].includes(e.type)) for (const [name,cx,cy] of [['nw',x,y],['ne',x+w,y],['sw',x,y+h],['se',x+w,y+h]]) {
      svg('rect',{x:cx-4,y:cy-4,width:8,height:8,fill:'#fff',stroke:'#739963','stroke-width':1.3,'data-handle':name,style:`cursor:${name==='nw'||name==='se'?'nwse':'nesw'}-resize`},layer);
    }
  }
  function point(event) { const r=$('canvas').getBoundingClientRect(); return {x:(event.clientX-r.left-view.x)/view.zoom,y:(event.clientY-r.top-view.y)/view.zoom}; }
  function hit(p) {
    const tol = 7/view.zoom;
    function segment(px,py,ax,ay,bx,by) { const dx=bx-ax,dy=by-ay, t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1))); return Math.hypot(px-ax-t*dx,py-ay-t*dy); }
    for (let i=board.elements.length-1;i>=0;i--) {
      const e = board.elements[i], b=elementBounds(e), margin=tol+(e.width||0)/2;
      if (p.x<b.x-margin||p.x>b.x+b.w+margin||p.y<b.y-margin||p.y>b.y+b.h+margin) continue;
      if (e.type==='path') { const ps=e.points;if(ps.length===1&&Math.hypot(p.x-e.x-ps[0][0],p.y-e.y-ps[0][1])<=margin)return e;for(let j=1;j<ps.length;j++)if(segment(p.x-e.x,p.y-e.y,...ps[j-1],...ps[j])<=margin)return e;continue; }
      if (e.type==='arrow') { if(segment(p.x,p.y,e.x,e.y,e.x+e.w,e.y+e.h)<=margin)return e;continue; }
      return e;
    } return null;
  }
  function setTool(next) {
    finishText();
    tool = next; selected = null;
    document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
    $('canvas').style.cursor = tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
    renderSelection();
    $('tool-hint').textContent = ({select:'Klicken: Text bearbeiten · Ziehen: verschieben',pen:'Linienkorrektur glättet deinen Strich · Umschalt: gerade Linie',line:'Ziehen für eine gerade Linie · Umschalt: 45°-Raster',text:'Klicken und direkt schreiben · Esc: fertig',note:'Klicken und direkt schreiben · Esc: fertig',hand:'Ziehen, um die Arbeitsfläche zu verschieben',eraser:'Auf ein Objekt klicken oder darüberziehen'})[next] || 'Ziehen zum Zeichnen · Umschalt: gleichmäßige Form';
  }
  function select(id) {
    selected = id; const e=board.elements.find(e=>e.id===id);
    if (e) { color=e.color||color; width=e.width||width;font=e.fontSize||font;syncStyle(); }
    renderSelection();
  }
  $('canvas').addEventListener('pointerdown', event => {
    if (!board || (event.button !== 0 && event.button !== 1)) return;
    finishText(); event.preventDefault(); $('canvas').focus(); const p=point(event);
    if (space || tool==='hand' || event.button===1) {
      gesture={type:'pan',startX:event.clientX,startY:event.clientY,view:clone(view)}; $('canvas').style.cursor='grabbing';
    } else if (tool==='select') {
      const handle=event.target.dataset.handle;
      const found=board.elements.find(e=>e.id===selected);
      if(handle && found) { history();gesture={type:'resize',handle,original:clone(found),start:p}; }
      else { const e=hit(p);select(e?.id||null);if(e){gesture={type:'move',start:p,original:clone(e),modified:false};} }
    } else if (tool==='eraser') {
      history();gesture={type:'erase',modified:false};const e=hit(p);if(e){board.elements=board.elements.filter(x=>x.id!==e.id);gesture.modified=true;render();}
    } else if (tool==='text'||tool==='note') { const e=hit(p);openText(e&&['text','note'].includes(e.type)?e:null,p);return; }
    else {
      history();const e={id:uid(),type:tool,x:p.x,y:p.y,color,width,fill:$('fill-shape').checked};
      if(tool==='pen'||tool==='line'){e.type='path';e.points=[[0,0]];}else{e.w=0;e.h=0;}
      board.elements.push(e);gesture={type:'draw',id:e.id,start:p,line:tool==='line',shift:event.shiftKey};render();
    }
    $('canvas').setPointerCapture(event.pointerId);
  });
  $('canvas').addEventListener('pointermove', event => {
    if(!gesture)return;const p=point(event),g=gesture;
    if(g.type==='pan'){view.x=g.view.x+event.clientX-g.startX;view.y=g.view.y+event.clientY-g.startY;render();return;}
    if(g.type==='erase'){const e=hit(p);if(e){board.elements=board.elements.filter(x=>x.id!==e.id);g.modified=true;}render();return;}
    if(g.type==='move'){
      const moved=Math.hypot(p.x-g.start.x,p.y-g.start.y)*view.zoom>3;
      if(!g.modified&&!moved)return;
      if(!g.modified){history();g.modified=true;}
      const e=board.elements.find(e=>e.id===selected);if(e){e.x=g.original.x+p.x-g.start.x;e.y=g.original.y+p.y-g.start.y;}
    }
    if(g.type==='resize'){
      const e=board.elements.find(e=>e.id===selected),o=g.original;
      if(e){let w=o.w+(g.handle.includes('w')?g.start.x-p.x:p.x-g.start.x),h=o.h+(g.handle.includes('n')?g.start.y-p.y:p.y-g.start.y);
        if(e.type==='image'&&!event.shiftKey){const ratio=o.w/o.h;if(Math.abs(w-o.w)>Math.abs(h-o.h)*ratio)h=w/ratio;else w=h*ratio;}
        const min=e.type==='note'?80:15;e.w=Math.max(min,w);e.h=Math.max(min,h);e.x=g.handle.includes('w')?o.x+o.w-e.w:o.x;e.y=g.handle.includes('n')?o.y+o.h-e.h:o.y;
        if(e.type==='note')e.h=Math.max(e.h,40+noteLines(e.text,e.fontSize||24,e.w-40).length*(e.fontSize||24)*1.35);
      }
    }
    if(g.type==='draw'){
      const e=board.elements.find(e=>e.id===g.id);if(!e)return;
      if(e.type==='path'){
        g.shift=event.shiftKey;
        let endpoint=[p.x-e.x,p.y-e.y];
        if(g.line){if(event.shiftKey)endpoint=WhiteboardStroke.snapPoint([0,0],endpoint);e.points=[[0,0],endpoint];}
        else {const last=e.points[e.points.length-1];if(Math.hypot(endpoint[0]-last[0],endpoint[1]-last[1])>.7/view.zoom && e.points.length<20000)e.points.push(endpoint);}
      }else{let dx=p.x-g.start.x,dy=p.y-g.start.y;if(event.shiftKey&&e.type!=='arrow'){const size=Math.max(Math.abs(dx),Math.abs(dy));dx=Math.sign(dx||1)*size;dy=Math.sign(dy||1)*size;}
        if(e.type==='arrow'){e.w=dx;e.h=dy;}else{e.x=g.start.x+Math.min(0,dx);e.y=g.start.y+Math.min(0,dy);e.w=Math.abs(dx);e.h=Math.abs(dy);}}
    }render();
  });
  function endGesture() {
    if(!gesture)return;const g=gesture;gesture=null;
    if(g.type==='draw'){
      const e=board.elements.find(e=>e.id===g.id);
      if(e?.type==='path'&&!g.line){
        if(g.shift&&e.points.length>1){e.points=[e.points[0],WhiteboardStroke.snapPoint(e.points[0],e.points[e.points.length-1])];e.smooth=false;}
        else if(lineCorrection){const fixed=WhiteboardStroke.correct(e.points,view.zoom);e.points=fixed.points;e.smooth=fixed.smooth;}
      }
      if(e&&e.type!=='path'&&Math.abs(e.w)<3&&Math.abs(e.h)<3){board.elements=board.elements.filter(x=>x.id!==e.id);undo.pop();}else changed();
    }
    else if(g.type==='resize'||g.type==='pan'||g.modified)changed();
    else if(g.type==='erase')undo.pop();
    $('canvas').style.cursor=tool==='hand'?'grab':tool==='select'?'default':tool==='text'?'text':'crosshair';render();updateButtons();
    if(g.type==='move'&&!g.modified&&['text','note'].includes(g.original.type))openText(board.elements.find(e=>e.id===g.original.id));
  }
  $('canvas').addEventListener('pointerup',endGesture);$('canvas').addEventListener('pointercancel',endGesture);$('canvas').addEventListener('lostpointercapture',endGesture);
  function openText(e,p) {
    if(editing&&e&&editing.id===e.id){$('inline-text').focus();return;}
    finishText();
    const created=!e;
    if(!e){history();e={id:uid(),type:tool==='note'?'note':'text',x:p.x,y:p.y,text:'',color:tool==='note'?'#f7e5a6':color,fontSize:font};if(e.type==='note'){e.w=280;e.h=220;}board.elements.push(e);changed();}
    editing={id:e.id,checkpoint:created};selected=e.id;
    const input=$('inline-text');input.value=e.text;input.hidden=false;
    input.placeholder=e.type==='note'?'Deine Notiz …':'Hier schreiben …';input.setAttribute('aria-label',e.type==='note'?'Notiz direkt bearbeiten':'Text direkt bearbeiten');
    render();input.focus();input.setSelectionRange(input.value.length,input.value.length);
  }
  function positionText() {
    if(!editing||!board)return;
    const e=board.elements.find(e=>e.id===editing.id);if(!e)return;
    const input=$('inline-text'),b=elementBounds(e),note=e.type==='note';
    Object.assign(input.style,{left:(e.x*view.zoom+view.x)+'px',top:(e.y*view.zoom+view.y)+'px',width:(note?e.w:Math.max(300,b.w+24))+'px',height:(note?e.h:Math.max(font*1.35,b.h)+8)+'px',fontSize:e.fontSize+'px',padding:note?'20px':'0',color:note?'#3d4333':e.color,transform:`scale(${view.zoom})`});
    input.classList.toggle('note-editor',note);input.wrap=note?'soft':'off';
  }
  function finishText() {
    if(!editing)return;const id=editing.id;editing=null;$('inline-text').hidden=true;
    if(board){const e=board.elements.find(e=>e.id===id);if(e&&!e.text.trim()){if(!undo.length)history();board.elements=board.elements.filter(e=>e.id!==id);selected=null;changed();}render();}
  }
  $('inline-text').addEventListener('input',()=>{
    const e=board?.elements.find(e=>e.id===editing?.id);if(!e)return;
    if(!editing.checkpoint){history();editing.checkpoint=true;}
    e.text=$('inline-text').value;
    if(e.type==='note')e.h=Math.max(e.h,48+noteLines(e.text,e.fontSize,e.w-40).length*e.fontSize*1.35);
    changed();render();
  });
  $('inline-text').addEventListener('blur',finishText);
  $('inline-text').addEventListener('keydown',event=>{
    if(event.key==='Escape'||((event.ctrlKey||event.metaKey)&&event.key==='Enter')){event.preventDefault();event.stopPropagation();finishText();$('canvas').focus();}
    // Native selection, typing, Enter, clipboard and undo stay inside the text field.
    else if(!((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'))event.stopPropagation();
  });
  function syncStyle() {
    $('custom-color').value=color;$('stroke-width').value=String(width);$('font-size').value=String(font);
    document.querySelectorAll('.color-swatch').forEach(b=>b.classList.toggle('active',b.dataset.color===color));
    const e=board?.elements.find(e=>e.id===selected);if(e)$('fill-shape').checked=Boolean(e.fill);
  }
  function applyStyle(prop,value) {const e=board?.elements.find(e=>e.id===selected);if(e){history();e[prop]=value;if(e.type==='note')e.h=Math.max(e.h,40+noteLines(e.text,e.fontSize,e.w-40).length*e.fontSize*1.35);changed();render();}syncStyle();}
  palette.forEach(c=>{const b=document.createElement('button');b.className='color-swatch';b.style.background=c;b.dataset.color=c;b.title=c;b.setAttribute('aria-label','Farbe '+c);b.onclick=()=>{color=c;applyStyle('color',c);};$('colors').append(b);});
  $('custom-color').onchange=e=>{color=e.target.value;applyStyle('color',color);};
  $('stroke-width').onchange=e=>{width=Number(e.target.value);applyStyle('width',width);};
  $('font-size').onchange=e=>{font=Number(e.target.value);applyStyle('fontSize',font);};
  $('fill-shape').onchange=e=>applyStyle('fill',e.target.checked);
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  function undoAction() {finishText();if(!board||!undo.length)return;redo.push(clone(board.elements));board.elements=undo.pop();selected=null;changed();render();}
  function redoAction() {finishText();if(!board||!redo.length)return;undo.push(clone(board.elements));board.elements=redo.pop();selected=null;changed();render();}
  function deleteSelected(){if(!selected)return;history();board.elements=board.elements.filter(e=>e.id!==selected);selected=null;changed();render();}
  function duplicate(){const e=board.elements.find(e=>e.id===selected);if(!e)return;history();const copy={...clone(e),id:uid(),x:e.x+28,y:e.y+28};board.elements.push(copy);selected=copy.id;changed();render();}
  $('undo').onclick=undoAction;$('redo').onclick=redoAction;$('delete-object').onclick=deleteSelected;$('duplicate').onclick=duplicate;
  $('edit-text').onclick=()=>{const e=board.elements.find(e=>e.id===selected);if(e)openText(e);};
  $('to-front').onclick=()=>{const e=board.elements.find(e=>e.id===selected);if(e){history();board.elements=board.elements.filter(x=>x.id!==e.id);board.elements.push(e);changed();render();}};
  function zoomTo(z,cx,cy) {
    const r=$('canvas').getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;
    z=Math.min(4,Math.max(.15,z));view.x=cx-(cx-view.x)*z/view.zoom;view.y=cy-(cy-view.y)*z/view.zoom;view.zoom=z;render();changed();
  }
  $('canvas').addEventListener('wheel',event=>{event.preventDefault();const r=$('canvas').getBoundingClientRect();zoomTo(view.zoom*Math.exp(-event.deltaY*.0015),event.clientX-r.left,event.clientY-r.top);},{passive:false});
  $('zoom-in').onclick=()=>zoomTo(view.zoom*1.2);$('zoom-out').onclick=()=>zoomTo(view.zoom/1.2);$('zoom-reset').onclick=()=>zoomTo(1);
  $('fit').onclick=()=>{if(!board.elements.length){view={x:0,y:0,zoom:1};}else{const b=bounds(board.elements),r=$('canvas').getBoundingClientRect();const left=r.width>700?215:145;view.zoom=Math.min(1.5,Math.max(.15,Math.min((r.width-left-90)/(b.w+50),(r.height-190)/(b.h+50))));view.x=left+(r.width-left)/2-(b.x+b.w/2)*view.zoom;view.y=r.height/2+20-(b.y+b.h/2)*view.zoom;}changed();render();};
  function center() {const r=$('canvas').getBoundingClientRect();return{x:(r.width/2-view.x)/view.zoom,y:(r.height/2-view.y)/view.zoom};}
  async function addImages(files,position) {
    if(!board)return;const target=board;let offset=0,added=0;
    for(const file of files){
      if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){toast('Bitte PNG-, JPEG-, WebP- oder GIF-Bilder verwenden.',true);continue;}
      if(file.size>20*1024*1024){toast('Das Bild ist zu groß (maximal 20 MB pro Bild).',true);continue;}
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Bild konnte nicht gelesen werden.'));reader.readAsDataURL(file);});
      const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Bild konnte nicht geöffnet werden.'));img.src=src;});
      if(board!==target)return;
      // Normalize and resize large pictures so board files and exports stay manageable.
      const scale=Math.min(1,2200/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',.9),p=position||center(),w=Math.min(550,canvas.width),h=w*canvas.height/canvas.width;
      if(!added)history();const e={id:uid(),type:'image',x:p.x-w/2+offset,y:p.y-h/2+offset,w,h,src:data};board.elements.push(e);selected=e.id;offset+=25;added++;
    }if(added){tool='select';document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool==='select'));$('canvas').style.cursor='default';changed();render();toast(`${added===1?'Bild':added+' Bilder'} eingefügt.`);}
  }
  $('add-image').onclick=()=>$('image-input').click();$('image-input').onchange=async e=>{try{await addImages([...e.target.files]);}catch(err){report(err);}e.target.value='';};
  const area=$('canvas-area');
  area.addEventListener('dragenter',e=>{if(!e.dataTransfer.types.includes('Files'))return;e.preventDefault();dragDepth++;$('drop-overlay').hidden=false;});
  area.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
  area.addEventListener('dragleave',()=>{dragDepth--;if(dragDepth<=0){dragDepth=0;$('drop-overlay').hidden=true;}});
  area.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-overlay').hidden=true;addImages([...e.dataTransfer.files],point(e)).catch(report);});
  document.addEventListener('paste',e=>{if(!board||isTyping()||document.querySelector('dialog[open]'))return;const images=[...e.clipboardData.items].filter(x=>x.kind==='file'&&x.type.startsWith('image/')).map(x=>x.getAsFile());if(images.length){e.preventDefault();addImages(images).catch(report);}});
  function exportSVG(elements,limit=0) {
    const b=bounds(elements),pad=40,w=Math.max(100,b.w+pad*2),h=Math.max(100,b.h+pad*2);
    const scale=limit?Math.min(1,limit/Math.max(w,h)):Math.min(2,6000/Math.max(w,h));
    const root=svg('svg',{xmlns:NS,width:Math.ceil(w*scale),height:Math.ceil(h*scale),viewBox:`${b.x-pad} ${b.y-pad} ${w} ${h}`});
    svg('rect',{x:b.x-pad,y:b.y-pad,width:w,height:h,fill:'#fcfcf8'},root);elements.forEach(e=>drawElement(e,root));return new XMLSerializer().serializeToString(root);
  }
  async function makePreview(elements){
    const url=URL.createObjectURL(new Blob([exportSVG(elements,500)],{type:'image/svg+xml;charset=utf-8'}));
    try{const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/webp',.75);
    }catch{return '';}finally{URL.revokeObjectURL(url);}
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function filename(){return (board.title||'Whiteboard').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100);}
  $('export-button').onclick=()=>$('export-menu').hidden=!$('export-menu').hidden;
  document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap'))$('export-menu').hidden=true;});
  $('export-json').onclick=async()=>{try{await save();download(new Blob([JSON.stringify({...board,view,version:1},null,2)],{type:'application/json'}),filename()+'.json');$('export-menu').hidden=true;toast('Board-Datei exportiert.');}catch(e){report(e);}};
  $('export-png').onclick=async()=>{const current=board;try{
    const data=exportSVG(board.elements),blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
    try{const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Bildexport fehlgeschlagen.'));image.src=url;});
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw new Error('Bildexport fehlgeschlagen.');if(board===current)download(png,filename()+'.png');toast('PNG exportiert.');
    }finally{URL.revokeObjectURL(url);}$('export-menu').hidden=true;
  }catch(e){report(e);}};
  $('import-board').onclick=()=>$('board-input').click();
  $('board-input').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>50*1024*1024)throw new Error('Board-Datei zu groß (maximal 50 MB).');const b=JSON.parse(await file.text());
    if(typeof b.title!=='string'||!Array.isArray(b.elements))throw new Error('Dies ist keine gültige Board-Datei.');
    // Validate imported geometry before it reaches SVG rendering.
    const types=['path','text','note','rect','ellipse','arrow','image'];
    for(const x of b.elements){if(!x||!types.includes(x.type)||typeof x.id!=='string'||![x.x,x.y].every(Number.isFinite))throw new Error('Ungültige Elemente in der Board-Datei.');
      if(['rect','ellipse','arrow','image','note'].includes(x.type)&&![x.w,x.h].every(Number.isFinite))throw new Error('Ungültige Abmessungen.');
      if(['text','note'].includes(x.type)&&(typeof x.text!=='string'||!Number.isFinite(x.fontSize)||x.fontSize<1||x.fontSize>500))throw new Error('Ungültiger Text.');
      if(x.type==='path'&&(!Array.isArray(x.points)||!x.points.length||x.points.length>20000||!x.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))))throw new Error('Ungültige Zeichnung.');
      if(x.color&&!/^#[0-9a-f]{6}$/i.test(x.color))throw new Error('Ungültige Farbe.');
      if(x.type==='image'&&!/^data:image\/(png|jpeg|webp|gif);base64,/.test(x.src))throw new Error('Ungültiges Bild.');x.id=uid();}
    b.id=uid();b.title=b.title.slice(0,200);b.preview='';await api('/api/boards/'+b.id,{method:'PUT',body:JSON.stringify(b)});await loadBoards();await openBoard(b.id);$('fit').click();toast('Whiteboard importiert.');
  }catch(err){toast(err instanceof SyntaxError?'Die Datei enthält kein gültiges JSON.':err.message,true);}e.target.value='';};
  $('new-board').onclick=()=>newBoard().catch(report);$('start-blank').onclick=()=>newBoard().catch(report);
  $('back').onclick=()=>goHome().catch(report);$('nav-boards').onclick=()=>goHome().catch(report);$('home-link').onclick=e=>{e.preventDefault();goHome().catch(report);};
  $('search').oninput=renderDashboard;$('sort').onchange=renderDashboard;
  $('board-title').oninput=e=>{if(!board)return;board.title=e.target.value;changed();};
  $('board-title').onblur=e=>{if(board&&!e.target.value.trim()){board.title='Ohne Titel';e.target.value=board.title;changed();}};
  $('save-now').onclick=()=>save().then(()=>toast('Whiteboard gespeichert.')).catch(report);
  $('help-button').onclick=()=>$('help-dialog').showModal();
  function isTyping(){return ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;}
  document.addEventListener('keydown',e=>{
    if(!board||document.querySelector('dialog[open]'))return;
    const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
    if(mod&&key==='s'){e.preventDefault();save().then(()=>toast('Whiteboard gespeichert.')).catch(report);return;}
    if(isTyping())return;
    if(mod&&key==='z'){e.preventDefault();e.shiftKey?redoAction():undoAction();return;}
    if(mod&&key==='y'){e.preventDefault();redoAction();return;}
    if(mod&&key==='d'){e.preventDefault();duplicate();return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();return;}
    if(e.code==='Space'){e.preventDefault();space=true;$('canvas').style.cursor='grab';return;}
    if(e.key==='Escape'){selected=null;$('export-menu').hidden=true;renderSelection();return;}
    if(mod||e.altKey)return;
    const tools={v:'select',h:'hand',p:'pen',l:'line',e:'eraser',t:'text',n:'note',r:'rect',o:'ellipse',a:'arrow'};if(tools[key])setTool(tools[key]);
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected){e.preventDefault();const el=board.elements.find(x=>x.id===selected);if(el){history();const step=e.shiftKey?10:1;el.x+=(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0);el.y+=(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0);changed();render();}}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;if(board)$('canvas').style.cursor=tool==='hand'?'grab':tool==='select'?'default':'crosshair';}});
  window.addEventListener('blur',()=>{space=false;endGesture();});
  window.addEventListener('beforeunload',e=>{if(board&&revision!==savedRevision){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&board&&revision!==savedRevision)save().catch(()=>{});});
  window.addEventListener('resize',()=>{if(board)render();});
  $('line-correction').checked=lineCorrection;
  $('line-correction').onchange=event=>{lineCorrection=event.target.checked;try{localStorage.setItem('freiraum-line-correction',lineCorrection?'on':'off');}catch{}};
  syncStyle();loadBoards().catch(report);
})();

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '.test-data');
let server, base, data;
before(async () => {
  await fs.mkdir(root, {recursive:true});
  data = await fs.mkdtemp(path.join(root, 'run-'));
  process.env.WHITEBOARD_DATA_DIR = data;
  server = require('../server').server;
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if(server) { server.closeAllConnections(); await new Promise(r=>server.close(r)); }
  if(data && path.dirname(path.resolve(data)) === root) await fs.rm(data,{recursive:true,force:true});
});
const board = { title:'Testboard mit Umlauten äöü', elements:[{id:'note-1',type:'note',x:20,y:40,w:240,h:200,fontSize:24,text:'Meine Idee\nZweite Zeile',color:'#f7e5a6'}] };
test('Board wird erstellt, auf Dateisystem gespeichert und verlustfrei geladen', async () => {
  let res=await fetch(base+'/api/boards/test-1',{method:'PUT',body:JSON.stringify(board)});
  assert.equal(res.status,200);
  const stored=JSON.parse(await fs.readFile(path.join(data,'test-1.json'),'utf8'));
  assert.equal(stored.id,'test-1');assert.equal(stored.title,board.title);assert.deepEqual(stored.elements,board.elements);
  const loaded=await (await fetch(base+'/api/boards/test-1')).json();assert.deepEqual(loaded.elements,board.elements);
  const list=await (await fetch(base+'/api/boards')).json();assert.equal(list.length,1);assert.equal(list[0].count,1);
});
test('Bestehendes Board lässt sich atomar überschreiben und löschen', async () => {
  const updated={...board,title:'Neuer Titel',elements:[]};
  const result=await fetch(base+'/api/boards/test-1',{method:'PUT',body:JSON.stringify(updated)});assert.equal(result.status,200);
  assert.equal((await (await fetch(base+'/api/boards/test-1')).json()).title,'Neuer Titel');
  assert.equal((await fs.readdir(data)).filter(n=>n.endsWith('.tmp')).length,0);
  assert.equal((await fetch(base+'/api/boards/test-1',{method:'DELETE'})).status,200);
  assert.equal((await fetch(base+'/api/boards/test-1')).status,404);
});
test('Fehlerhafte Inhalte werden abgelehnt und schreiben keine Datei',async()=>{
  for(const invalid of [{title:'X',elements:[{id:'x',type:'text',x:0,y:0,text:'x'}]},{title:'X',elements:[{id:'x',type:'path',x:0,y:0,points:[]}]},{title:'X',elements:[{id:'x',type:'image',x:0,y:0,w:20,h:20,src:'https://example.com/image.png'}]}]){
    assert.equal((await fetch(base+'/api/boards/invalid',{method:'PUT',body:JSON.stringify(invalid)})).status,400);
  }
  assert.equal((await fetch(base+'/api/boards/invalid')).status,404);
});
test('Fremde Webseiten können nicht auf die lokale Board-API zugreifen',async()=>{
  assert.equal((await fetch(base+'/api/boards',{headers:{Origin:'https://example.com'}})).status,403);
  assert.equal((await fetch(base+'/api/boards/test-2',{method:'PUT',headers:{Origin:'https://example.com'},body:JSON.stringify(board)})).status,403);
});
test('App und Assets werden ohne Build oder Installation ausgeliefert',async()=>{
  for(const file of ['/','/app.js','/style.css','/favicon.svg']) assert.equal((await fetch(base+file)).status,200);
  assert.equal((await fetch(base+'/server.js')).status,404);
});

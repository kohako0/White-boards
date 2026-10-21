const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');

// Headless interaction harness: run the real app handlers against a small DOM
// adapter. Layout, caret placement and rendering still need a browser check.
function editor() {
  const ids=new Map(),all=[],records=new Map();let document;
  class Element {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.style={};this.events={};this.value='';this.checked=false;this.hidden=false;this.textContent='';this.classes=new Set();this.classList={toggle:(c,on)=>{if(on??!this.classes.has(c))this.classes.add(c);else this.classes.delete(c);},contains:c=>this.classes.has(c)};all.push(this);}
    setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5)]=String(v);}
    append(...els){this.children.push(...els);}appendChild(el){this.append(el);return el;}
    replaceChildren(...els){this.children=els;}
    querySelector(tag){return this.children.find(c=>c.tagName===tag.toUpperCase())||null;}
    addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
    fire(type,data={}){for(const fn of this.events[type]||[])fn({target:this,preventDefault(){},stopPropagation(){},...data});}
    focus(){const old=document.activeElement;document.activeElement=this;if(old&&old!==this)old.fire('blur');}
    select(){} setSelectionRange(){} setPointerCapture(){} remove(){} click(){return this.onclick?.();}
    getBoundingClientRect(){return{left:0,top:0,width:1200,height:700};}
    getContext(){return{measureText:s=>({width:s.length*12}),drawImage(){}};}
  }
  const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
  const tools=['select','hand','pen','line','eraser','text','note','rect','ellipse','arrow'].map(t=>{const e=new Element('button');e.dataset.tool=t;return e;});
  document={activeElement:null,hidden:false,getElementById:get,querySelector:()=>null,querySelectorAll:selector=>selector==='[data-tool]'?tools:selector==='.color-swatch'?all.filter(e=>e.className==='color-swatch'):[],createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),addEventListener(){},body:new Element('body')};
  for(const tag of ['h3','p'])get('empty-state').append(new Element(tag));
  get('inline-text').tagName='TEXTAREA';get('inline-text').hidden=true;get('canvas').tagName='SVG';
  const fetch=async(url,options={})=>{
    const id=url.split('/').at(-1);let result;
    if(options.method==='PUT'){result=JSON.parse(options.body);result.updatedAt=new Date().toISOString();records.set(id,structuredClone(result));result={updatedAt:result.updatedAt};}
    else if(url==='/api/boards')result=[...records.values()].map(b=>({...b,count:b.elements.length}));
    else result=structuredClone(records.get(id));
    return{ok:true,json:async()=>result};
  };
  const context=vm.createContext({document,window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},crypto:{randomUUID},fetch,URL,Blob,console,setTimeout:()=>1,clearTimeout(){},Image:class{set src(_){queueMicrotask(()=>this.onerror());}},XMLSerializer:class{serializeToString(){return'<svg/>';}}});
  for(const file of ['stroke.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),context,{filename:file});
  const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
  return{get,records,tick,tool:t=>tools.find(e=>e.dataset.tool===t).onclick(),pointer:(type,x,y,extra={})=>get('canvas').fire(type,{clientX:x,clientY:y,button:0,pointerId:1,shiftKey:false,...extra}),save:async()=>{await get('save-now').onclick();await tick();},newBoard:async()=>{await tick();await get('new-board').onclick();},latest:()=>[...records.values()].at(-1)};
}
test('Text entsteht direkt auf der Fläche und bestehender Text wird per Einzelklick bearbeitet',async()=>{
  const app=editor();await app.newBoard();app.tool('text');app.pointer('pointerdown',400,230);
  assert.equal(app.get('inline-text').hidden,false);
  app.get('inline-text').value='Direkt schreiben\nZweite Zeile';app.get('inline-text').fire('input');
  await app.save();assert.equal(app.latest().elements[0].text,'Direkt schreiben\nZweite Zeile');
  app.get('inline-text').fire('keydown',{key:'Escape'});app.tool('select');
  app.pointer('pointerdown',410,240);app.pointer('pointerup',410,240);
  assert.equal(app.get('inline-text').hidden,false);assert.equal(app.get('inline-text').value,'Direkt schreiben\nZweite Zeile');
  app.get('inline-text').value='Überarbeitet';app.get('inline-text').fire('input');app.get('inline-text').fire('keydown',{key:'Enter',ctrlKey:true});
  await app.save();assert.equal(app.latest().elements[0].text,'Überarbeitet');
  app.get('undo').onclick();await app.save();assert.equal(app.latest().elements[0].text,'Direkt schreiben\nZweite Zeile');
});
test('Notizen wachsen beim Schreiben, lassen sich ziehen und leere neue Felder verschwinden',async()=>{
  const app=editor();await app.newBoard();app.tool('note');app.pointer('pointerdown',350,200);
  app.get('inline-text').value=Array(12).fill('Eine weitere Zeile').join('\n');app.get('inline-text').fire('input');app.get('inline-text').fire('keydown',{key:'Escape'});
  await app.save();assert.ok(app.latest().elements[0].h>220);
  app.tool('select');app.pointer('pointerdown',360,210);app.pointer('pointermove',410,260);app.pointer('pointerup',410,260);
  await app.save();assert.equal(app.latest().elements[0].x,400);assert.equal(app.latest().elements[0].y,250);assert.equal(app.get('inline-text').hidden,true);
  app.tool('text');app.pointer('pointerdown',900,500);app.get('inline-text').fire('keydown',{key:'Escape'});
  await app.save();assert.equal(app.latest().elements.length,1);
});
test('Linienwerkzeug und Stiftkorrektur speichern exakte Linien und unterstützen Rückgängig',async()=>{
  const app=editor();await app.newBoard();app.tool('line');app.pointer('pointerdown',300,300);app.pointer('pointermove',600,310,{shiftKey:true});app.pointer('pointerup',600,310,{shiftKey:true});
  await app.save();let line=app.latest().elements[0];assert.equal(line.type,'path');assert.equal(line.points.length,2);assert.equal(line.points[1][1],0);
  app.tool('pen');app.pointer('pointerdown',300,400);for(let i=1;i<=40;i++)app.pointer('pointermove',300+i*5,400+Math.sin(i));app.pointer('pointerup',500,400);
  await app.save();assert.equal(app.latest().elements[1].points.length,2);
  app.get('undo').onclick();await app.save();assert.equal(app.latest().elements.length,1);
  app.get('redo').onclick();await app.save();assert.equal(app.latest().elements.length,2);
});

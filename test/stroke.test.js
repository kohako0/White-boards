const {test}=require('node:test');
const assert=require('node:assert/strict');
const {correct,snapPoint,pathData}=require('../public/stroke');
test('Fast gerade Mausstriche werden ohne Verschieben der Endpunkte begradigt',()=>{
  const points=Array.from({length:51},(_,i)=>[i*4,Math.sin(i)*1.1]);
  const fixed=correct(points);
  assert.equal(fixed.kind,'straight');assert.equal(fixed.points.length,2);
  assert.deepEqual(fixed.points[0],points[0]);assert.deepEqual(fixed.points[1],points[50]);
  assert.equal(points.length,51);
});
test('Kreise bleiben Kurven und werden geglättet',()=>{
  const points=Array.from({length:101},(_,i)=>{const a=i/100*Math.PI*2;return[100*Math.cos(a),100*Math.sin(a)];});
  const fixed=correct(points);
  assert.equal(fixed.kind,'smooth');assert.ok(fixed.points.length>20);
  assert.deepEqual(fixed.points[0],points[0]);assert.deepEqual(fixed.points.at(-1),points.at(-1));
  assert.match(pathData(fixed.points,fixed.smooth),/ Q/);
});
test('Kurze Striche, Punkte und identische Koordinaten bleiben gültig',()=>{
  for(const points of [[[0,0]],[[0,0],[1,1]],[[0,0],[0,0],[0,0]]]){
    const fixed=correct(points);assert.ok(fixed.points.length);assert.ok(fixed.points.flat().every(Number.isFinite));assert.doesNotMatch(pathData(fixed.points,fixed.smooth),/NaN|Infinity/);
  }
});
test('Umschalt rastet Linien auf 45 Grad ein und erhält ihre Länge',()=>{
  const start=[20,40],end=[160,52],snap=snapPoint(start,end);
  assert.equal(snap[1],start[1]);assert.ok(Math.abs(Math.hypot(snap[0]-20,snap[1]-40)-Math.hypot(140,12))<.001);
  const diagonal=snapPoint([0,0],[80,70]);assert.ok(Math.abs(diagonal[0]-diagonal[1])<.001);
});
test('Die Linienkorrektur berücksichtigt den Zoom',()=>{
  const points=Array.from({length:40},(_,i)=>[i*8,Math.sin(i)*.2]);
  for(const zoom of [.15,.5,1,2,4])assert.equal(correct(points,zoom).kind,'straight');
});

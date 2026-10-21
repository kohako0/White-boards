(function (root) {
  'use strict';
  const distance = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);
  function snapPoint(start, end) {
    const length=distance(start,end),angle=Math.round(Math.atan2(end[1]-start[1],end[0]-start[0])/(Math.PI/4))*Math.PI/4;
    return [start[0]+Math.cos(angle)*length,start[1]+Math.sin(angle)*length];
  }
  function correct(points, zoom=1) {
    const input=points.map(p=>p.slice());
    if(input.length<3) return {points:input,smooth:false,kind:'original'};
    const start=input[0],end=input[input.length-1],direct=distance(start,end);
    let length=0,maxDeviation=0;
    for(let i=1;i<input.length;i++) {
      length+=distance(input[i-1],input[i]);
      if(direct) maxDeviation=Math.max(maxDeviation,Math.abs((end[0]-start[0])*(start[1]-input[i][1])-(start[0]-input[i][0])*(end[1]-start[1]))/direct);
    }
    // Only straighten deliberate, open strokes. Circles and bends remain curves.
    if(direct*zoom>=30 && length/direct<1.22 && maxDeviation<=Math.min(18/zoom,Math.max(5/zoom,direct*.025)))
      return {points:[start,end],smooth:false,kind:'straight'};
    // Resample by distance so smoothing does not depend on mouse event frequency.
    const step=Math.max(2/zoom,length/10000),samples=[start];
    let remaining=step;
    for(let i=1;i<input.length;i++) {
      let a=input[i-1].slice(),b=input[i],segment=distance(a,b);
      while(segment>=remaining && segment>0) {
        const t=remaining/segment;a=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];samples.push(a);
        segment=distance(a,b);remaining=step;
      }
      remaining-=segment;
    }
    if(distance(samples[samples.length-1],end)>.001)samples.push(end);
    const weights=[1,2,3,2,1];
    const filtered=samples.map((p,i)=>{
      if(i===0||i===samples.length-1)return p;
      let x=0,y=0,total=0;
      for(let k=-2;k<=2;k++){const j=Math.max(0,Math.min(samples.length-1,i+k)),w=weights[k+2];x+=samples[j][0]*w;y+=samples[j][1]*w;total+=w;}
      return [x/total,y/total];
    });
    return {points:filtered,smooth:true,kind:'smooth'};
  }
  function pathData(points,smooth=false) {
    let d=`M${points[0][0]} ${points[0][1]}`;
    if(points.length===1)return d+' l.01 .01';
    if(smooth&&points.length>2){
      for(let i=1;i<points.length-1;i++){const a=points[i],b=points[i+1];d+=` Q${a[0]} ${a[1]} ${(a[0]+b[0])/2} ${(a[1]+b[1])/2}`;}
      const last=points[points.length-1];return d+` L${last[0]} ${last[1]}`;
    }
    for(let i=1;i<points.length;i++)d+=` L${points[i][0]} ${points[i][1]}`;
    return d;
  }
  const api={correct,snapPoint,pathData};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WhiteboardStroke=api;
})(typeof globalThis!=='undefined'?globalThis:this);

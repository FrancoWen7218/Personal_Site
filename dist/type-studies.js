const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
const bg=new Image();bg.src='assets/environment-v1.png';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode=new URLSearchParams(location.search).get('mode')==='physics'?'physics':'brush',w,h,dpr,bodies=[],drag=null,pointer={x:-999,y:-999},last=0,clock=0;
// Original brush-letter contours, deliberately varied in tilt, size and baseline.
const strokes=[['M18 94 Q22 48 24 10','M22 12 Q54 7 78 4','M22 48 Q49 43 64 47'],['M15 96 L18 12 Q74 -3 75 29 Q76 52 22 55','M45 52 L82 99'],['M4 95 Q24 45 41 5 L52 0 Q66 45 84 100','M19 64 Q51 57 73 63'],['M11 94 L15 10 Q42 37 71 93 L77 8'],['M79 14 Q31 -8 14 31 Q-1 77 39 95 Q61 101 79 86'],['M43 4 Q7 0 10 50 Q7 96 43 97 Q81 102 82 49 Q86 8 43 4']];
const rotations=[-.12,.075,-.075,.09,-.13,.055],offsets=[3,11,-5,8,1,12];
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);reset();}
function reset(){clock=0;drag=null;const size=Math.min(w/7.5,h*.27);bodies='FRANCO'.split('').map((char,i)=>({char,x:w*.5+((i%3)-1)*size*.75,y:reduced?h*.65:-(i*size*.65+size),vx:(i%2?1:-1)*30,vy:0,a:(i%2?1:-1)*.18,av:(i-2.5)*.18,hw:size*.32,hh:size*.47,size,inv:1}));}
function background(){c.fillStyle='#a49b87';c.fillRect(0,0,w,h);if(bg.complete&&bg.naturalWidth){let s=Math.max(w/bg.width,h/bg.height);c.drawImage(bg,(w-bg.width*s)/2,(h-bg.height*s),bg.width*s,bg.height*s);}c.fillStyle='rgba(238,233,216,.06)';c.fillRect(0,0,w,h);}
// Cached paint layer: static letters adhere to the wall instead of floating above it.
const brushLayer=document.createElement('canvas'),bc=brushLayer.getContext('2d');
let brushKey='';
function brush(){
 const key=`${w}/${h}/${bg.naturalWidth}`;
 if(brushKey!==key){
  brushKey=key;brushLayer.width=canvas.width;brushLayer.height=canvas.height;bc.setTransform(dpr,0,0,dpr,0,0);
  const unit=Math.min(w/640,h/290),total=560*unit,x=(w-total)/2,y=h*.37;
  let seed=314;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<6;i++){
   bc.save();bc.translate(x+i*94*unit,y+offsets[i]*unit*.65);bc.rotate(rotations[i]*.7);bc.scale(unit,unit);
   bc.lineCap='butt';bc.lineJoin='round';bc.strokeStyle='#070907';bc.lineWidth=19+(i%3)*1.5;
   for(const d of strokes[i])bc.stroke(new Path2D(d));
   // Bristles leave a broken, irregular fringe rather than an even outline.
   for(let strand=0;strand<14;strand++){
    bc.save();bc.translate((rnd()-.5)*23,(rnd()-.5)*3);bc.lineWidth=.25+rnd()*.8;bc.strokeStyle=`rgba(9,11,8,${.2+rnd()*.45})`;
    for(const d of strokes[i])bc.stroke(new Path2D(d));bc.restore();
   }
   bc.restore();
  }
  // Underlying plaster relief remains visible through the paint film.
  bc.globalCompositeOperation='source-atop';bc.globalAlpha=.18;
  if(bg.complete&&bg.naturalWidth){const scale=Math.max(w/bg.width,h/bg.height);bc.drawImage(bg,(w-bg.width*scale)/2,h-bg.height*scale,bg.width*scale,bg.height*scale);}
  bc.globalAlpha=1;bc.globalCompositeOperation='destination-out';
  // Thin dry-brush gaps and scattered pores expose the same wall underneath.
  for(let j=0;j<1300;j++){
   const px=x+rnd()*total,py=y-15*unit+rnd()*145*unit;
   bc.fillStyle=`rgba(0,0,0,${.08+rnd()*.4})`;
   bc.beginPath();bc.ellipse(px,py,(.18+rnd()*.65)*unit,(.3+rnd()*1.7)*unit,-.12,0,Math.PI*2);bc.fill();
  }
  for(let j=0;j<100;j++){
   const px=x+rnd()*total,py=y+rnd()*115*unit;
   bc.strokeStyle=`rgba(0,0,0,${.12+rnd()*.3})`;bc.lineWidth=(.2+rnd()*.6)*unit;
   bc.beginPath();bc.moveTo(px,py);bc.lineTo(px+(rnd()-.5)*2*unit,py+(3+rnd()*12)*unit);bc.stroke();
  }
  bc.globalCompositeOperation='source-atop';
  // Sparse subdued flecks on paint-loaded areas, without continuous metal-like rims.
  for(let j=0;j<38;j++){
   bc.strokeStyle='rgba(180,184,170,.07)';bc.lineWidth=.5*unit;
   const px=x+rnd()*total,py=y+rnd()*105*unit;bc.beginPath();bc.moveTo(px,py);bc.lineTo(px+(1+rnd()*3)*unit,py-.3*unit);bc.stroke();
  }
  bc.globalCompositeOperation='source-over';
 }
 c.save();c.globalCompositeOperation='multiply';c.drawImage(brushLayer,0,0,w,h);c.restore();
}
function axes(b){return[{x:Math.cos(b.a),y:Math.sin(b.a)},{x:-Math.sin(b.a),y:Math.cos(b.a)}];}
function radius(b,n){const a=axes(b);return b.hw*Math.abs(a[0].x*n.x+a[0].y*n.y)+b.hh*Math.abs(a[1].x*n.x+a[1].y*n.y);}
function collide(a,b){let depth=Infinity,normal;for(const n of [...axes(a),...axes(b)]){const delta=(b.x-a.x)*n.x+(b.y-a.y)*n.y,overlap=radius(a,n)+radius(b,n)-Math.abs(delta);if(overlap<=0)return;if(overlap<depth){depth=overlap;normal={x:n.x*Math.sign(delta||1),y:n.y*Math.sign(delta||1)};}}const ia=a===drag?0:1,ib=b===drag?0:1,sum=ia+ib;if(!sum)return;a.x-=normal.x*depth*ia/sum;a.y-=normal.y*depth*ia/sum;b.x+=normal.x*depth*ib/sum;b.y+=normal.y*depth*ib/sum;const speed=(b.vx-a.vx)*normal.x+(b.vy-a.vy)*normal.y;if(speed<0){const impulse=-speed*1.18/sum;a.vx-=impulse*normal.x*ia;a.vy-=impulse*normal.y*ia;b.vx+=impulse*normal.x*ib;b.vy+=impulse*normal.y*ib;const side=((b.x-a.x)*normal.y-(b.y-a.y)*normal.x);a.av-=side*impulse*.00003*ia;b.av+=side*impulse*.00003*ib;}a.vx*=.993;b.vx*=.993;a.av*=.98;b.av*=.98;}
function physics(dt){const ground=h*.81;for(let sub=0;sub<3;sub++){for(const b of bodies){if(b===drag)continue;b.vy+=900*dt/3;b.x+=b.vx*dt/3;b.y+=b.vy*dt/3;b.a+=b.av*dt/3;const rx=radius(b,{x:1,y:0}),ry=radius(b,{x:0,y:1});if(b.x<rx){b.x=rx;b.vx=Math.abs(b.vx)*.3;}if(b.x>w-rx){b.x=w-rx;b.vx=-Math.abs(b.vx)*.3;}if(b.y+ry>ground){b.y=ground-ry;b.vy=-Math.abs(b.vy)*.18;b.vx*=.90;b.av*=.86;if(Math.abs(b.vy)<8)b.vy=0;}}for(let pass=0;pass<4;pass++)for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)collide(bodies[i],bodies[j]);}
for(const b of bodies){c.save();c.translate(b.x,b.y);c.rotate(b.a);c.font=`900 ${b.size}px Impact,'Arial Black',sans-serif`;c.textAlign='center';c.textBaseline='middle';c.shadowColor='#0008';c.shadowBlur=7;c.shadowOffsetY=5;c.lineWidth=3;c.strokeStyle='#484940';c.strokeText(b.char,0,0);const g=c.createLinearGradient(0,-b.hh,0,b.hh);g.addColorStop(0,'#373a34');g.addColorStop(.18,'#080a08');g.addColorStop(.55,'#161a15');g.addColorStop(1,'#050605');c.fillStyle=g;c.fillText(b.char,0,0);c.shadowBlur=0;c.shadowOffsetY=0;c.restore();}}
function frame(t){const dt=Math.min((t-last)/1000||.016,.03);last=t;clock+=dt;background();if(mode==='brush')brush();else physics(dt);requestAnimationFrame(frame);}
function select(value){mode=value;reset();document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelector('#hint').textContent=mode==='brush'?'墙面宽刷字形 · 静态附着质感 · 无滴落':'拖拽字母后松手，观察下落、碰撞和堆叠（矩形碰撞体原型）';history.replaceState(null,'',`?mode=${mode}`);}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>select(b.dataset.mode));document.querySelector('#reset').onclick=reset;
canvas.onpointermove=e=>{pointer={x:e.clientX,y:e.clientY};if(drag){drag.vx=(pointer.x-drag.x)*8;drag.vy=(pointer.y-drag.y)*8;drag.x=pointer.x;drag.y=pointer.y;}};
canvas.onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY};if(mode!=='physics')return;drag=[...bodies].reverse().find(b=>{let dx=pointer.x-b.x,dy=pointer.y-b.y;return Math.abs(dx*Math.cos(b.a)+dy*Math.sin(b.a))<b.hw&&Math.abs(-dx*Math.sin(b.a)+dy*Math.cos(b.a))<b.hh;});if(drag)canvas.setPointerCapture(e.pointerId);};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;canvas.onpointerleave=()=>pointer={x:-999,y:-999};addEventListener('resize',resize);resize();select(mode);requestAnimationFrame(frame);

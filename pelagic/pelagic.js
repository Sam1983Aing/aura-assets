(()=>{'use strict';
const $=s=>document.querySelector(s),canvas=$('#globe'),ctx=canvas.getContext('2d'),D=Math.PI/180,TAU=Math.PI*2;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let playing=!reduced.matches,selected=0,minutes=560,rotation=.85,target=.85,tilt=.18,tiltTarget=.18,zoom=1,zoomTarget=1,dragging=false,moved=0,lastX=0,lastY=0,vel=0,w=0,h=0,phase=0,last=0,reveal=1,hovered=-1,ptrX=-1,ptrY=-1,dirty=true,frameNo=0,R=0,rot=0,tv=.18,cr=1,sr=0,ct=1,stt=0;
const routes=[
{name:'The Gulf Stream',center:.85,coords:'34° N / 068° W',temp:24.8,speed:1.82,distance:'6,400',flow:.1,note:'Carrying tropical warmth northward, from the Florida Strait to the Atlantic.',path:[[24,-81],[30,-78],[36,-69],[41,-52],[47,-33],[53,-16],[59,-7]]},
{name:'The Kuroshio',center:-2.3,coords:'31° N / 134° E',temp:26.2,speed:1.54,distance:'3,000',flow:.09,note:'A western boundary current tracing the edge of Japan into the open Pacific.',path:[[15,124],[23,123],[29,129],[33,138],[36,149],[37,165]]},
{name:'Antarctic Circumpolar',center:-.8,coords:'56° S / 030° E',temp:2.4,speed:.38,distance:'21,000',flow:.035,note:'An uninterrupted eastward passage linking the Atlantic, Pacific, and Indian oceans.',path:Array.from({length:37},(_,i)=>[-55+Math.sin(i*.7)*3,-180+i*10])}];
// Deliberately simplified coastline silhouettes; no external map or rendering dependencies.
const lands=[ [[-168,70],[-140,71],[-125,60],[-108,68],[-83,68],[-56,53],[-65,44],[-79,28],[-89,21],[-98,18],[-109,29],[-120,48],[-151,60]], [[-81,12],[-66,10],[-49,-2],[-35,-9],[-43,-23],[-53,-34],[-68,-55],[-76,-40],[-79,-17]], [[-53,60],[-42,60],[-20,77],[-39,83],[-60,77]], [[-17,35],[4,37],[12,32],[32,31],[43,12],[51,11],[40,-12],[32,-29],[18,-35],[10,-18],[-1,5],[-16,14]], [[-10,36],[-10,44],[4,49],[8,56],[20,71],[38,69],[48,57],[35,44],[27,36],[13,42]], [[29,42],[44,62],[70,74],[120,73],[170,64],[178,52],[143,49],[131,35],[120,24],[107,7],[97,20],[80,8],[69,25],[49,30]], [[112,-11],[134,-11],[153,-25],[146,-39],[128,-34],[114,-24]], [[46,-13],[50,-16],[47,-26],[44,-24]], [[130,31],[136,35],[141,43],[145,44],[140,34]], [[-180,-72],[-135,-70],[-100,-74],[-60,-65],[-20,-72],[30,-69],[80,-67],[140,-71],[180,-72],[180,-89],[-180,-89]] ];
function inside(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if(((p[i][1]>y)!=(p[j][1]>y))&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c}
const onLand=(lat,lon)=>lands.some(p=>inside(lon,lat,p));
function unit(lat,lon){const a=lat*D,b=lon*D,c=Math.cos(a);return [Math.sin(b)*c,Math.cos(b)*c,Math.sin(a)]}
function catmull(pts,n){const out=[];for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(i-1,0)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(i+2,pts.length-1)];for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1].map(c=>.5*(2*p1[c]+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t3)))}}out.push(pts[pts.length-1].slice());return out}
routes.forEach(r=>{r.pts=catmull(r.path,16);r.units=r.pts.map(p=>unit(p[0],p[1]))});
const land=[];for(let lat=-82;lat<83;lat+=1.8){const step=1.8/Math.max(.2,Math.cos(lat*D));for(let lon=-180;lon<180;lon+=step)if(onLand(lat,lon))land.push(unit(lat,lon))}
const parallels=[],meridians=[];for(let lat=-60;lat<=60;lat+=20)parallels.push(Array.from({length:121},(_,i)=>unit(lat,-180+i*3)));for(let lon=-180;lon<180;lon+=20)meridians.push(Array.from({length:61},(_,i)=>unit(-90+i*3,lon)));
// Ambient surface flow. A synthetic field: westward at the equator, eastward in the westerlies, with meandering gyres.
const N=520,HIST=9,parts=[];
function spawn(p){let t=0;do{p.lat=Math.asin(Math.random()*2-1)/D*.93;p.lon=Math.random()*360-180}while(onLand(p.lat,p.lon)&&++t<24);p.h=[];p.age=0;p.life=5+Math.random()*7;p.j=Math.random()*TAU}
for(let i=0;i<N;i++){const p={};spawn(p);p.age=Math.random()*p.life;parts.push(p)}
function field(lat,lon,t,j){const la=lat*D;const u=-1.5*Math.cos(la*3.2)*(.55+.45*Math.cos(la))+.35*Math.sin(lon*D*3+t*.15+j);const v=.9*Math.sin(lon*D*2.5+t*.2+j)*Math.sin(la*2)+.25*Math.cos(lon*D*4-t*.1);return [v,u/Math.max(.25,Math.cos(la))]}
function stepParts(dt){for(let i=0;i<N;i++){const p=parts[i];p.h.push(unit(p.lat,p.lon));if(p.h.length>HIST)p.h.shift();const f=field(p.lat,p.lon,phase,p.j);p.lat+=f[0]*dt*5.5;p.lon+=f[1]*dt*5.5;if(p.lon>180)p.lon-=360;if(p.lon<-180)p.lon+=360;p.age+=dt;if(p.age>p.life||Math.abs(p.lat)>84||(i%6===frameNo%6&&onLand(p.lat,p.lon)))spawn(p)}}
// View
function setView(){cr=Math.cos(rot);sr=Math.sin(rot);ct=Math.cos(tv);stt=Math.sin(tv);R=Math.min(w*.445,h*.407)*zoom}
function proj(u,lift=1){const x=u[0]*cr+u[1]*sr,z=u[1]*cr-u[0]*sr,yy=u[2]*ct-z*stt,zz=u[2]*stt+z*ct;return [w/2+x*R*lift,h/2-yy*R*lift,zz]}
function sunView(){const u=unit(10,(720-minutes)/4);const x=u[0]*cr+u[1]*sr,z=u[1]*cr-u[0]*sr;return [x,u[2]*ct-z*stt,u[2]*stt+z*ct]}
// Lit sphere, shaded per pixel on a small offscreen and scaled up under a circular clip.
const S=160,off=document.createElement('canvas');off.width=off.height=S;const octx=off.getContext('2d'),img=octx.createImageData(S,S),NX=new Float32Array(S*S),NY=new Float32Array(S*S),NZ=new Float32Array(S*S),RIM=new Float32Array(S*S);
for(let py=0,k=0;py<S;py++)for(let px=0;px<S;px++,k++){let nx=(px+.5)/S*2-1,ny=1-(py+.5)/S*2;const rr=nx*nx+ny*ny;if(rr>1){const l=Math.sqrt(rr);nx/=l;ny/=l;NZ[k]=0;RIM[k]=1}else{const nz=Math.sqrt(1-rr);NZ[k]=nz;RIM[k]=Math.pow(1-nz,2.4)}NX[k]=nx;NY[k]=ny}
const DAY=[64,138,214],NIGHT=[18,48,92],HAZE=[150,210,255];
const sm=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)};
function shade(){const d=img.data,s=sunView(),hx=s[0],hy=s[1],hz=s[2]+1,hl=1/Math.hypot(hx,hy,hz);for(let k=0,i=0;k<S*S;k++,i+=4){const nx=NX[k],ny=NY[k],nz=NZ[k],l=nx*s[0]+ny*s[1]+nz*s[2],day=sm(-.3,.35,l),limb=.72+.28*nz,rim=RIM[k]*.55,spec=Math.pow(Math.max(0,(nx*hx+ny*hy+nz*hz)*hl),90)*day*.45;for(let c=0;c<3;c++){let v=(NIGHT[c]+(DAY[c]-NIGHT[c])*day)*limb;v+=(HAZE[c]-v)*rim;v+=(255-v)*spec;d[i+c]=v}d[i+3]=255}octx.putImageData(img,0,0)}
function drawPath(units,color,width,lift=1,n=units.length){ctx.beginPath();let pen=false;for(let i=0;i<n;i++){const v=proj(units[i],lift);if(v[2]<0){pen=false;continue}if(pen)ctx.lineTo(v[0],v[1]);else ctx.moveTo(v[0],v[1]);pen=true}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
const ease=t=>1-Math.pow(1-t,3);
function fmtLon(l){l=((l+540)%360+360)%360-180;return String(Math.round(Math.abs(l))).padStart(3,'0')+'° '+(l<0?'W':'E')}
const MONO='"Sometype Mono", monospace';
function draw(){setView();ctx.clearRect(0,0,w,h);const cx=w/2,cy=h/2;
// ground shadow
let g=ctx.createRadialGradient(cx,cy+R*1.02,0,cx,cy+R*1.02,R*.8);g.addColorStop(0,'rgba(13,36,64,.2)');g.addColorStop(1,'rgba(13,36,64,0)');ctx.fillStyle=g;ctx.save();ctx.translate(cx,cy+R*1.02);ctx.scale(1,.09);ctx.beginPath();ctx.arc(0,0,R*.8,0,TAU);ctx.fill();ctx.restore();
// dial ring and ticks
ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='rgba(13,36,64,.28)';ctx.lineWidth=.7;ctx.setLineDash([2,6]);ctx.beginPath();ctx.arc(0,0,R*1.12,0,TAU);ctx.stroke();ctx.setLineDash([]);for(let i=0;i<72;i++){const a=i/72*TAU,o=i%6===0?1.135:1.115;ctx.beginPath();ctx.moveTo(Math.cos(a)*R*1.1,Math.sin(a)*R*1.1);ctx.lineTo(Math.cos(a)*R*o,Math.sin(a)*R*o);ctx.stroke()}
// sub-solar marker on the dial
const s=sunView(),sa=Math.atan2(-s[1],s[0]);ctx.fillStyle='#1f5eff';ctx.strokeStyle='#1f5eff';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(Math.cos(sa)*R*1.12,Math.sin(sa)*R*1.12,3.2,0,TAU);if(s[2]>=0)ctx.fill();else ctx.stroke();ctx.restore();
// atmosphere halo
g=ctx.createRadialGradient(cx,cy,R*.97,cx,cy,R*1.085);g.addColorStop(0,'rgba(110,175,240,.5)');g.addColorStop(1,'rgba(110,175,240,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R*1.085,0,TAU);ctx.fill();
// sphere
shade();ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.clip();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(off,cx-R-1,cy-R-1,2*R+2,2*R+2);
// graticule
ctx.lineWidth=.6;for(const p of parallels)drawPath(p,'rgba(255,255,255,.09)',.6);for(const m of meridians)drawPath(m,'rgba(255,255,255,.09)',.6);
// land
const rad=Math.max(.6,R*.0046),buckets=[[],[],[],[],[]];for(const u of land){const v=proj(u);if(v[2]<0)continue;buckets[Math.min(4,Math.floor(v[2]*5))].push(v)}buckets.forEach((b,i)=>{if(!b.length)return;ctx.fillStyle=`rgba(225,238,250,${(.3+i*.16).toFixed(2)})`;ctx.beginPath();for(const v of b){ctx.moveTo(v[0]+rad,v[1]);ctx.arc(v[0],v[1],rad,0,TAU)}ctx.fill()});
// ambient flow
if(!reduced.matches){const P=[];for(let k=0;k<6;k++)P.push(new Path2D());for(const p of parts){const n=p.h.length;if(n<2)continue;const head=proj(p.h[n-1],1.002);if(head[2]<0)continue;const fade=Math.min(1,p.age*1.5,(p.life-p.age)*1.5),a=fade*(.15+.6*head[2]);if(a<.03)continue;const path=P[Math.min(5,Math.floor(a*6))];path.moveTo(head[0],head[1]);for(let i=n-2;i>=0;i--){const v=proj(p.h[i],1.002);if(v[2]<0)break;path.lineTo(v[0],v[1])}}ctx.lineWidth=1;ctx.lineCap='round';P.forEach((path,k)=>{ctx.strokeStyle=`rgba(200,232,255,${((k+1)/6*.75).toFixed(2)})`;ctx.stroke(path)})}
ctx.restore();
// sphere edge
ctx.strokeStyle='rgba(13,36,64,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.stroke();
// routes
ctx.lineCap='round';ctx.lineJoin='round';
routes.forEach((route,idx)=>{const on=idx===selected,hv=idx===hovered&&!on,U=route.units;if(!on){drawPath(U,hv?'rgba(220,242,255,.9)':'rgba(180,220,255,.32)',hv?1.8:1.1,1.004);return}
const n=Math.max(2,Math.floor(U.length*ease(reveal)));
drawPath(U,'rgba(94,195,255,.22)',9,1.004,n);drawPath(U,'rgba(94,195,255,.5)',3.5,1.005,n);drawPath(U,'rgba(240,250,255,.95)',1.4,1.006,n);
ctx.setLineDash([2,10]);ctx.lineDashOffset=-phase*36;drawPath(U,'rgba(255,255,255,.9)',2.4,1.007,n);ctx.setLineDash([]);
const K=4;for(let c=0;c<K;c++){const head=Math.floor(((phase*route.flow+c/K)%1)*n);for(let k=1;k<=12;k++){const i0=head-k,i1=i0+1;if(i0<0)break;const a=proj(U[i0],1.008),b=proj(U[i1],1.008);if(a[2]<0||b[2]<0)continue;const t=1-k/12;ctx.strokeStyle=`rgba(255,255,255,${(.85*t*t).toFixed(3)})`;ctx.lineWidth=.8+3*t;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}const hp=proj(U[head],1.009);if(hp[2]>0){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hp[0],hp[1],2.4,0,TAU);ctx.fill()}}
if(n===U.length){const a=proj(U[U.length-4],1.006),b=proj(U[U.length-1],1.006);if(b[2]>0){ctx.save();ctx.translate(b[0],b[1]);ctx.rotate(Math.atan2(b[1]-a[1],b[0]-a[0]));ctx.fillStyle='#f0faff';ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-4,-4.5);ctx.lineTo(-2,0);ctx.lineTo(-4,4.5);ctx.closePath();ctx.fill();ctx.restore()}}
const m=proj(U[Math.floor(U.length/2)],1.02);if(m[2]>.08&&n>=U.length/2){const t=(phase%2)/2;ctx.strokeStyle=`rgba(94,195,255,${((1-t)*.8).toFixed(3)})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(m[0],m[1],6+t*16,0,TAU);ctx.stroke();ctx.fillStyle='#0d2440';ctx.beginPath();ctx.arc(m[0],m[1],5.5,0,TAU);ctx.fill();ctx.strokeStyle='#eaf6ff';ctx.lineWidth=1.4;ctx.stroke();ctx.fillStyle='#eaf6ff';ctx.font='500 10px '+MONO;ctx.textAlign='left';ctx.fillText('0'+(idx+1),m[0]+12,m[1]+4)}});
// limb longitudes
const front=-rot/D;ctx.fillStyle='#5b7089';ctx.font='8px '+MONO;ctx.textAlign='left';ctx.fillText(fmtLon(front-90),8,cy+3);ctx.textAlign='right';ctx.fillText(fmtLon(front+90),w-8,cy+3);ctx.textAlign='left';
// hover tooltip
if(hovered>=0&&hovered!==selected&&ptrX>=0){const t=routes[hovered].name;ctx.font='500 10px '+MONO;const tw=ctx.measureText(t).width+16;let x=ptrX+14,y=ptrY-30;if(x+tw>w)x=ptrX-tw-14;if(y<0)y=ptrY+14;ctx.fillStyle='#0d2440';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,tw,22,3);else ctx.rect(x,y,tw,22);ctx.fill();ctx.fillStyle='#eef2f6';ctx.fillText(t,x+8,y+15)}
dirty=false}
// Re-measure and re-back the canvas. Returns early when the box has no width yet, which happens in
// preview panes and embeds that lay the page out before the frame has a size. Safe to call often.
function resize(){const rect=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),bw=Math.round(rect.width*d),bh=Math.round(rect.height*d);if(!bw||!bh)return;if(canvas.width===bw&&canvas.height===bh)return;w=rect.width;h=rect.height;canvas.width=bw;canvas.height=bh;ctx.setTransform(d,0,0,d,0,0);draw()}
function update(){const r=routes[selected],cycle=Math.sin(minutes/1440*Math.PI*2),label=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(Math.floor(minutes%60)).padStart(2,'0');$('#timeLabel').textContent=label;$('#time').value=Math.floor(minutes);$('#time').setAttribute('aria-valuetext',label+' UTC');$('#temp').textContent=(r.temp+cycle*.45).toFixed(1);$('#speed').textContent=(r.speed+cycle*.06).toFixed(2)}
function setPlay(v){playing=v;$('#play').textContent=v?'Ⅱ':'▶';$('#play').setAttribute('aria-label',v?'Pause playback':'Play playback')}
function select(i){const changed=i!==selected;selected=i;target=routes[i].center;vel=0;if(changed)reveal=reduced.matches?1:0;if(reduced.matches)rotation=target;document.querySelectorAll('.station').forEach((el,j)=>{el.classList.toggle('active',j===i);el.setAttribute('aria-pressed',j===i)});$('#currentNumber').textContent='0'+(i+1);$('#currentName').textContent=routes[i].name;$('#coordinates').textContent=routes[i].coords;$('#distance').textContent=routes[i].distance;$('#routeNote').textContent=routes[i].note;update();dirty=true}
const hint=on=>$('#hint').classList.toggle('off',!on);
document.querySelectorAll('.station').forEach(el=>el.addEventListener('click',()=>select(+el.dataset.route)));$('#play').onclick=()=>setPlay(!playing);$('#time').oninput=e=>{minutes=+e.target.value;setPlay(false);update();dirty=true};
function zoomBy(d){zoomTarget=Math.max(.75,Math.min(1.25,zoomTarget+d));dirty=true}$('#zoomIn').onclick=()=>zoomBy(.1);$('#zoomOut').onclick=()=>zoomBy(-.1);
function hitRoute(x,y){for(let idx=0;idx<routes.length;idx++){const U=routes[idx].units;for(let i=0;i<U.length;i+=2){const v=proj(U[i],1.005);if(v[2]<.05)continue;const dx=v[0]-x,dy=v[1]-y;if(dx*dx+dy*dy<110)return idx}}return -1}
const local=e=>{const r=canvas.getBoundingClientRect();ptrX=e.clientX-r.left;ptrY=e.clientY-r.top};
canvas.addEventListener('pointerdown',e=>{dragging=true;moved=0;lastX=e.clientX;lastY=e.clientY;vel=0;local(e);try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
canvas.addEventListener('pointermove',e=>{local(e);if(dragging){const dx=e.clientX-lastX,dy=e.clientY-lastY;moved+=Math.abs(dx)+Math.abs(dy);rotation+=dx*.006;vel=dx*.006;tiltTarget=Math.max(-.7,Math.min(.7,tiltTarget+dy*.004));target=rotation;lastX=e.clientX;lastY=e.clientY;if(moved>6)hint(false)}else hovered=hitRoute(ptrX,ptrY);canvas.style.cursor=(!dragging&&hovered>=0&&hovered!==selected)?'pointer':'';dirty=true});
canvas.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;if(moved<6){const i=hitRoute(ptrX,ptrY);if(i>=0)select(i)}});
canvas.addEventListener('pointercancel',()=>dragging=false);canvas.addEventListener('pointerleave',()=>{hovered=-1;ptrX=-1;canvas.style.cursor='';dirty=true});
canvas.addEventListener('keydown',e=>{const k=e.key;if(k==='ArrowLeft'||k==='ArrowRight'){target+=k==='ArrowLeft'?-.18:.18;vel=0}else if(k==='ArrowUp'||k==='ArrowDown')tiltTarget=Math.max(-.7,Math.min(.7,tiltTarget+(k==='ArrowUp'?.08:-.08)));else if(k==='+'||k==='=')zoomBy(.1);else if(k==='-')zoomBy(-.1);else if(k==='Home'){target=routes[selected].center;tiltTarget=.18;zoomTarget=1}else return;e.preventDefault();hint(false);dirty=true});
const dialog=$('#dialog');let downloadURL;function openDialog(field){$('#dialogEyebrow').textContent=field?'Field note / 0'+(selected+1):'The Pelagic perspective';$('#dialogTitle').textContent=field?routes[selected].name:'Everything is connected.';$('#dialogText').textContent=field?routes[selected].note+' Scrub the timeline to inspect a model day, or download the current readings as a field note.':'Ocean currents move heat, nutrients, and life across the planet. Pelagic is an interactive sketch of those invisible connections. Rotate the globe, choose a current, and move through a model day to explore.';$('#download').hidden=!field;if(field){if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(new Blob([`PELAGIC / FIELD NOTE\n${routes[selected].name}\n${routes[selected].coords}\nModel time: ${$('#timeLabel').textContent} UTC\nTemperature: ${$('#temp').textContent} °C\nVelocity: ${$('#speed').textContent} m/s\nEstimated reach: ${routes[selected].distance} km\n\n${routes[selected].note}\n\nDesign concept. Simulated data, schematic routes.\n`],{type:'text/plain;charset=utf-8'}));$('#download').href=downloadURL;$('#download').download='pelagic-field-note-'+(selected+1)+'.txt'}dialog.showModal()}
$('#about').onclick=()=>openDialog(false);$('#explore').onclick=()=>openDialog(true);$('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
reduced.addEventListener('change',()=>{if(reduced.matches)setPlay(false);dirty=true});document.addEventListener('visibilitychange',()=>{last=0;resize();dirty=true});
function frame(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;frameNo++;if(!document.hidden){const rm=reduced.matches;if(playing){minutes=(minutes+dt*5)%1440;update()}if(!rm)phase+=dt;
if(!dragging){if(Math.abs(vel)>.0004){rotation+=vel*Math.min(dt*60,2);target=rotation;vel*=Math.exp(-dt*3.5)}else{vel=0;rotation+=(target-rotation)*(rm?1:Math.min(dt*4.5,1))}}
const k=rm?1:Math.min(dt*7,1);tilt+=(tiltTarget-tilt)*k;zoom+=(zoomTarget-zoom)*k;if(reveal<1)reveal=rm?1:Math.min(1,reveal+dt/1.4);
rot=rotation+(rm?0:Math.sin(phase*.31)*.03);tv=tilt+(rm?0:Math.sin(phase*.23)*.015);
if(!rm){stepParts(dt);draw()}else if(dirty)draw()}
requestAnimationFrame(frame)}
// A ResizeObserver alone is not enough: a document that is not being rendered when it loads (a preview
// pane, a zero-width iframe) can miss the notification entirely and keep a 0-wide bitmap forever.
const ro=new ResizeObserver(resize);ro.observe(canvas);ro.observe(document.querySelector('.visual'));
addEventListener('resize',resize);addEventListener('pageshow',resize);setInterval(resize,400);
setPlay(playing);update();resize();requestAnimationFrame(frame);
})();

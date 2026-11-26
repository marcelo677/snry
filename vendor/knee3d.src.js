/* SNRY · rodilla izquierda 3D anatómica.
   Huesos y músculos: BodyParts3D, © 2008 Life Science Integrated Database Center, CC BY-SA 2.1 JP
   (recortados y simplificados → vendor/knee.bin, misma licencia).
   Tejidos blandos (meniscos, ligamentos, tendones, grasa de Hoffa, bolsa, nervio) modelados sobre referencias anatómicas del mismo modelo. */
import {WebGLRenderer,Scene,PerspectiveCamera,Group,Mesh,MeshStandardMaterial,MeshBasicMaterial,SphereGeometry,CylinderGeometry,TorusGeometry,TubeGeometry,CatmullRomCurve3,Vector3,Vector2,HemisphereLight,DirectionalLight,AmbientLight,Raycaster,Color,BufferGeometry,BufferAttribute,DoubleSide} from 'three';

export const CREDIT='Modelo 3D: BodyParts3D © 2008 LSDB, CC BY-SA 2.1 JP';
const PAL={bone:'#efe6d3',bone2:'#e6dbc3',mus:'#c98477',mus2:'#b9746a',tend:'#f5f2ea',men:'#d6e4f1',lig:'#ebe7dc',fat:'#f2c75c',bursa:'#7fb0e0',nerve:'#f2d14b',hi:'#ff5a36'};
export const ZONES={
  'Suprarrotuliana':{label:'Bolsa suprarrotuliana',parts:['bursa','quadT']},
  'Bajo la rótula':{label:'Grasa de Hoffa y tendón rotuliano',parts:['hoffa','ptend']},
  'Lado interno':{label:'Menisco interno y ligamento colateral medial',parts:['menM','mcl']},
  'Lado externo':{label:'Menisco externo y ligamento colateral lateral',parts:['menL','lcl']},
  'Ciático / Posterior':{label:'Corva, isquiotibiales y nervio ciático',parts:['ham','nerve']},
  'Rótula':{label:'Rótula (articulación patelofemoral)',parts:['pat']},
  'Pata de ganso':{label:'Pata de ganso (inserción interna bajo la rodilla)',parts:['pes']},
  'Cintilla iliotibial':{label:'Cintilla iliotibial (lado externo del muslo)',parts:['itb']},
  'Hueco poplíteo':{label:'Hueco poplíteo y músculo poplíteo',parts:['pop']},
  'Gemelos':{label:'Gemelos y pantorrilla',parts:['gm','gl']}
};
const GROUPS={quad:['rf','vmed','vlat','vint','quadT'],ham:['st','sm','bfl','bfs']};
export const PART_NAMES={pes:'pata de ganso',itb:'cintilla iliotibial',pop:'poplíteo',gm:'gemelo interno',gl:'gemelo externo',quad:'cuádriceps y su tendón',quadT:'tendón del cuádriceps',pat:'rótula',ptend:'tendón rotuliano',hoffa:'grasa de Hoffa',bursa:'bolsa suprarrotuliana',menM:'menisco interno',menL:'menisco externo',mcl:'ligamento colateral medial',lcl:'ligamento colateral lateral',ham:'isquiotibiales',nerve:'nervio ciático',fem:'fémur',tib:'tibia',gast:'gemelos'};
const MUSCLES=new Set(['rf','vmed','vlat','vint','st','sm','bfl','bfs','gm','gl','pop','itb']);
const SHIN=new Set(['tib','fib','gm','gl','pop']);
const partZone={};Object.entries(ZONES).forEach(([z,v])=>v.parts.forEach(p=>(GROUPS[p]||[p]).forEach(q=>partZone[q]=z)));

let R,scene,cam,root,femur,shin,patG,parts={},ptendMesh,ghosts=[],host=null,LM=null,PIV,ready=null,
  state={mode:'show',full:false,angle:0,sel:new Set(),hl:new Set(),rotY:-.5,rotX:.12},onPick=null,raf=0,ro=null,io=null,visible=true;

const V3=a=>new Vector3(a[0],a[1],a[2]);
function mat(col,o={}){const m=new MeshStandardMaterial({color:col,roughness:.72,metalness:0,...o});m.userData.base=new Color(col);m.userData.op=o.opacity??1;m.userData.em=new Color(o.emissive||'#000000');return m}
function add(key,geo,m,parent){const x=new Mesh(geo,m);x.userData.part=key;(parts[key]=parts[key]||[]).push(x);parent.add(x);return x}
function tube(pts,r,seg=48){return new TubeGeometry(new CatmullRomCurve3(pts.map(V3)),seg,r,12,false)}
function between(m,a,b){const d=new Vector3().subVectors(b,a),len=d.length();m.position.copy(a).addScaledVector(d,.5);m.scale.set(1,len,1);m.quaternion.setFromUnitVectors(new Vector3(0,1,0),d.normalize())}
/* pivote: centro de los cóndilos femorales; los hijos de shin/patG se dibujan relativos a él */
function piv(g){g.position.copy(PIV);return g}
function rel(m){m.position.sub(PIV);return m}

async function load(url){
  const buf=await (await fetch(url)).arrayBuffer(),dv=new DataView(buf),hl=dv.getUint32(0,true);
  const head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl))),base=4+hl;
  const geos={};head.parts.forEach(p=>{const o=base+p.o,q=new Int16Array(buf.slice(o,o+p.v*6)),pos=new Float32Array(p.v*3);for(let i=0;i<q.length;i++)pos[i]=q[i]/2000;
    const idx=new Uint16Array(buf.slice(o+p.v*6,o+p.v*6+p.f*6)),g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(pos,3));g.setIndex(new BufferAttribute(idx,1));g.computeVertexNormals();geos[p.k]=g});
  return {geos,L:head.L}}

function build({geos,L}){
  LM=L;PIV=V3(L.pivot);
  scene=new Scene();cam=new PerspectiveCamera(30,1,.1,100);cam.position.set(0,0,15);
  scene.add(new HemisphereLight('#ffffff','#a9b9cf',1.5));const d=new DirectionalLight('#fff4e2',1.9);d.position.set(4,6,8);scene.add(d);const d2=new DirectionalLight('#d6e4ff',.7);d2.position.set(-6,-1,-7);scene.add(d2);scene.add(new AmbientLight('#ffffff',.2));
  root=new Group();scene.add(root);femur=new Group();root.add(femur);
  shin=piv(new Group());root.add(shin);patG=piv(new Group());root.add(patG);
  Object.entries(geos).forEach(([k,g])=>{
    const isM=MUSCLES.has(k),m=isM?mat(k==='itb'?PAL.lig:(['gm','gl','pop'].includes(k)?PAL.mus2:PAL.mus),{transparent:true,opacity:k==='itb'?.35:.3,depthWrite:false}):mat(k==='fib'?PAL.bone2:PAL.bone);
    const parent=k==='pat'?patG:SHIN.has(k)?shin:femur;const x=add(k,g,m,parent);if(parent!==femur)rel(x);x.renderOrder=isM?2:0});
  /* bolsa suprarrotuliana (detrás del tendón del cuádriceps, sobre la rótula) */
  const ps=V3(L.patSup),pi=V3(L.patInf),tb=V3(L.tub);
  const bu=add('bursa',new SphereGeometry(.5,28,20),mat(PAL.bursa,{transparent:true,opacity:.5,depthWrite:false}),femur);bu.position.set(ps.x,ps.y+.75,ps.z-.32);bu.scale.set(1.35,1.25,.5);bu.renderOrder=3;
  /* tendón del cuádriceps (de la diáfisis anterior al polo superior de la rótula; se recalcula con la flexión) */
  add('quadT',new CylinderGeometry(.2,.26,1,18),mat(PAL.tend),root);
  /* tendón rotuliano y grasa de Hoffa */
  ptendMesh=add('ptend',new CylinderGeometry(.17,.21,1,18),mat(PAL.tend),root);
  const hf=add('hoffa',new SphereGeometry(.5,24,18),mat(PAL.fat,{transparent:true,opacity:.95}),shin);
  hf.position.set((pi.x+tb.x)/2,(pi.y+L.tmax)/2-.05,Math.min(pi.z,tb.z)-.38);hf.scale.set(1.05,.62,.55);rel(hf);
  /* meniscos sobre el platillo tibial: C abierta hacia el centro */
  const men=(key,c,r,arc,gapDir)=>{const m=add(key,new TorusGeometry(r*.78,.13,12,48,arc),mat(PAL.men),shin);const gc=(arc+Math.PI*2)/2;m.rotation.set(Math.PI/2,0,gapDir-gc);m.position.set(c[0],c[1]+.09,c[2]);m.scale.set(1,1,.55);rel(m);return m};
  men('menM',L.platM,L.platMr,Math.PI*1.55,0);men('menL',L.platL,L.platLr,Math.PI*1.8,Math.PI);
  /* ligamentos colaterales */
  const eM=V3(L.epiM),eL=V3(L.epiL),tm=V3(L.tibMed),fh=V3(L.fibHead);
  add('mcl',tube([[eM.x-.08,eM.y+.25,eM.z],[eM.x-.12,eM.y-.5,eM.z+.05],[eM.x-.02,L.tmax-.4,eM.z+.12],[tm.x-.08,tm.y,tm.z+.05]],.09),mat(PAL.lig),root);
  add('lcl',tube([[eL.x+.08,eL.y+.15,eL.z-.1],[eL.x+.14,eL.y-.6,eL.z-.25],[fh.x+.08,fh.y+.12,fh.z+.05]],.08),mat(PAL.lig),root);
  /* pata de ganso: sartorio, grácil y semitendinoso se insertan en la cara interna de la tibia */
  add('pes',tube([[tm.x-.05,PIV.y+1.4,PIV.z-.55],[tm.x-.22,L.tmax-.2,tm.z-.25],[tm.x-.06,tm.y-.25,tm.z+.25],[tb.x-.5,tb.y-.55,tb.z-.08]],.1),mat(PAL.tend),root);
  /* nervio ciático → tibial (posterior, entre isquiotibiales y gemelos) */
  const fp=V3(L.femPost);
  add('nerve',tube([[fp.x-.15,4.3,fp.z-.95],[fp.x-.1,2.4,fp.z-1.0],[PIV.x+.05,.6,PIV.z-1.15],[PIV.x,-1,PIV.z-1.25],[PIV.x-.1,-3.4,PIV.z-1.2]],.075),mat(PAL.nerve,{emissive:'#6a4c08',emissiveIntensity:.3}),root);
  /* metas fantasma 0°, 90°, 120° */
  [0,90,120].forEach(a=>{const g=piv(new Group()),gm=new MeshBasicMaterial({color:'#2c5fa6',transparent:true,opacity:.1,depthWrite:false,side:DoubleSide});const s=new Mesh(new CylinderGeometry(.55,.42,3.4,20),gm);gm.color.set('#111111');gm.opacity=.08;s.position.set(0,-2.3-(PIV.y-L.tmax),0);g.add(s);g.rotation.x=a*Math.PI/180;g.visible=false;root.add(g);ghosts.push(g)});
}
function pose(){
  const t=state.angle*Math.PI/180;shin.rotation.x=t;patG.rotation.x=t*.66;
  const P=p=>V3(p).sub(PIV),pi=P(LM.patInf).applyEuler(patG.rotation).add(PIV),ps=P(LM.patSup).applyEuler(patG.rotation).add(PIV),tb=P(LM.tub).applyEuler(shin.rotation).add(PIV);
  between(ptendMesh,pi,tb);
  const fa=V3(LM.femAnt);fa.y=2.4;fa.z-=.05;between(parts.quadT[0],new Vector3(ps.x,ps.y-.05,ps.z-.05),fa);
  root.rotation.set(state.rotX,state.rotY,0);
  ghosts.forEach(g=>g.visible=state.mode==='rom');
  const lit=new Set();[...state.hl].forEach(p=>(GROUPS[p]||[p]).forEach(q=>lit.add(q)));state.sel.forEach(z=>ZONES[z]&&ZONES[z].parts.forEach(p=>(GROUPS[p]||[p]).forEach(q=>lit.add(q))));
  const dim=lit.size>0,musF=state.mode==='rom'?0:Math.max(0,1-Math.max(0,state.angle-20)/30);
  Object.entries(parts).forEach(([k,arr])=>arr.forEach(m=>{const M=m.material,on=lit.has(k),isM=MUSCLES.has(k);
    M.color.copy(on?new Color(PAL.hi):M.userData.base);M.emissive.copy(on?new Color('#4a1204'):M.userData.em);
    let op=M.userData.op;if(isM)op=on?.88:op*musF*(dim?.6:1);else if(dim&&!on&&!['fem','tib','fib','pat'].includes(k))op*=.6;if(on)op=Math.max(op,.92);
    M.transparent=op<.999;M.opacity=op;M.depthWrite=op>.9;m.visible=op>.02}));
}
function frame(){raf=0;if(!host||!visible||!scene)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  const c=R.domElement,pr=R.getPixelRatio();if(c.width!==Math.round(w*pr)||c.height!==Math.round(h*pr)){R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
  const a=w/h;let z=a<.75?23:a<1.2?19.5:18;if(state.full){z*=a<.75?1.12:1.3;cam.position.x=a>1.2?-2.4:0;cam.position.y=a<.75?-1.6:-.4}else{cam.position.x=0;cam.position.y=0}cam.position.z=z;pose();R.render(scene,cam)}
export function draw(){if(!raf)raf=requestAnimationFrame(frame)}

let drag=null;
function ptr(){const c=R.domElement;
  c.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,rx:state.rotX,ry:state.rotY,moved:0};try{c.setPointerCapture(e.pointerId)}catch(_){}});
  c.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));if(drag.moved<4)return;
    state.rotY=drag.ry+dx*.012;state.rotX=Math.max(-.6,Math.min(.7,drag.rx+dy*.006));draw()});
  c.addEventListener('pointerup',e=>{if(!drag)return;const t=drag.moved<6;drag=null;if(t&&state.mode==='pick')pick(e)});
  c.addEventListener('pointercancel',()=>drag=null);c.style.touchAction='pan-y';
}
const ray=new Raycaster();
function pick(e){const r=R.domElement.getBoundingClientRect(),v=new Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(v,cam);
  const hits=ray.intersectObjects(Object.values(parts).flat().filter(m=>m.visible),false);
  const z0=hits.filter(x=>partZone[x.object.userData.part]);if(!z0.length)return;
  /* prioriza estructuras internas (no músculo) si están justo detrás del músculo tocado */
  const solid=z0.find(x=>!MUSCLES.has(x.object.userData.part)),h=solid&&solid.distance-z0[0].distance<1.6?solid:z0[0];const z=partZone[h.object.userData.part];if(z&&onPick)onPick(z)}

/* base: URL de la carpeta vendor/ (para cargar knee.bin) */
export function init(base){if(ready)return ready;
  ready=(async()=>{try{R=new WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})}catch(e){return false}
    if(!R.getContext())return false;R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));R.setClearColor(0x000000,0);R.domElement.className='k3d';
    try{build(await load(new URL('knee.bin',base).href))}catch(e){console.warn(e);return false}
    ptr();ro=new ResizeObserver(()=>draw());io=new IntersectionObserver(es=>{visible=es.some(x=>x.isIntersecting);if(visible)draw()});return true})();
  return ready}
/* opts: {mode:'pick'|'rom'|'show', sel:[zonas], hl:[partes o grupos], angle, rotY, onPick} */
export async function mount(el,opts={},base=import.meta.url){if(!await init(base))return false;host=el;if(R.domElement.parentNode!==el)el.prepend(R.domElement);
  ro.disconnect();ro.observe(el);io.disconnect();io.observe(el);visible=true;
  state.mode=opts.mode||'show';state.full=!!opts.full;state.sel=new Set(opts.sel||[]);state.hl=new Set(opts.hl||[]);if(opts.angle!=null)state.angle=opts.angle;onPick=opts.onPick||null;
  if(opts.rotY!=null)state.rotY=opts.rotY;if(opts.rotX!=null)state.rotX=opts.rotX;draw();return true}
export function set(o={}){if(o.sel)state.sel=new Set(o.sel);if(o.hl)state.hl=new Set(o.hl);if(o.angle!=null)state.angle=o.angle;if(o.rotY!=null)state.rotY=o.rotY;draw()}
export function spin(to,ms=900){const a=state.rotY,t0=performance.now();const st=n=>{const k=Math.min(1,(n-t0)/ms),e=1-Math.pow(1-k,3);state.rotY=a+(to-a)*e;draw();if(k<1)requestAnimationFrame(st)};requestAnimationFrame(st)}
export function animateAngle(to,ms=700){const a=state.angle,t0=performance.now();const st=n=>{const k=Math.min(1,(n-t0)/ms),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;state.angle=a+(to-a)*e;draw();if(k<1)requestAnimationFrame(st)};requestAnimationFrame(st)}

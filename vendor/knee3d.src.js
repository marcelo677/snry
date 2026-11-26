/* SNRY · rodilla izquierda 3D (Three.js, geometría procedimental, render bajo demanda) */
import {WebGLRenderer,Scene,PerspectiveCamera,Group,Mesh,MeshStandardMaterial,MeshBasicMaterial,SphereGeometry,CylinderGeometry,TorusGeometry,TubeGeometry,CatmullRomCurve3,Vector3,Vector2,HemisphereLight,DirectionalLight,AmbientLight,Raycaster,Color,LatheGeometry,DoubleSide} from 'three';

const PAL={bone:'#eef1f6',bone2:'#dfe6f1',men:'#9dbbe0',tend:'#c3cfe2',lig:'#b4c4dc',fat:'#f3c66a',bursa:'#6f9fd2',ham:'#a7b5ec',nerve:'#f1c25f',hi:'#e0603f',quad:'#c7d3e8'};
export const ZONES={
  'Suprarrotuliana':{label:'Bolsa suprarrotuliana',parts:['bursa','quad']},
  'Bajo la rótula':{label:'Grasa de Hoffa y tendón rotuliano',parts:['hoffa','ptend']},
  'Lado interno':{label:'Menisco interno y ligamento colateral medial',parts:['menM','mcl']},
  'Lado externo':{label:'Menisco externo y ligamento colateral lateral',parts:['menL','lcl']},
  'Ciático / Posterior':{label:'Corva, isquiotibiales y nervio ciático',parts:['ham','nerve']}
};
export const PART_NAMES={quad:'tendón del cuádriceps',pat:'rótula',ptend:'tendón rotuliano',hoffa:'grasa de Hoffa',bursa:'bolsa suprarrotuliana',menM:'menisco interno',menL:'menisco externo',mcl:'ligamento colateral medial',lcl:'ligamento colateral lateral',ham:'isquiotibiales',nerve:'nervio ciático',fem:'fémur',tib:'tibia'};
const partZone={};Object.entries(ZONES).forEach(([z,v])=>v.parts.forEach(p=>partZone[p]=z));

let R,scene,cam,root,femur,shin,patG,parts={},mats={},ptendMesh,ghosts=[],host=null,state={mode:'show',angle:0,sel:new Set(),hl:new Set(),rotY:-.5,rotX:.12},onPick=null,dirty=true,raf=0,ro=null,io=null,visible=true;

function mat(key,col,o={}){const m=new MeshStandardMaterial({color:col,roughness:.78,metalness:0,...o});m.userData.base=new Color(col);m.userData.op=o.opacity??1;mats[key]=m;return m}
function mesh(key,geo,m,parent){const x=new Mesh(geo,m);x.userData.part=key;(parts[key]=parts[key]||[]).push(x);parent.add(x);return x}
function cyl(r1,r2,h,seg=28){return new CylinderGeometry(r1,r2,h,seg,1)}
function tube(pts,r){return new TubeGeometry(new CatmullRomCurve3(pts.map(p=>new Vector3(...p))),40,r,10,false)}
function between(m,a,b){const d=new Vector3().subVectors(b,a),len=d.length();m.position.copy(a).addScaledVector(d,.5);m.scale.set(1,len,1);m.quaternion.setFromUnitVectors(new Vector3(0,1,0),d.normalize())}

function build(){
  scene=new Scene();cam=new PerspectiveCamera(30,1,.1,100);cam.position.set(0,0,15.5);
  scene.add(new HemisphereLight('#ffffff','#9db3cf',1.6));const d=new DirectionalLight('#fff6e8',1.7);d.position.set(4,6,8);scene.add(d);const d2=new DirectionalLight('#cfe0ff',.6);d2.position.set(-6,-2,-6);scene.add(d2);scene.add(new AmbientLight('#ffffff',.25));
  root=new Group();scene.add(root);
  const bone=mat('bone',PAL.bone),bone2=mat('bone2',PAL.bone2);
  /* fémur: diáfisis + cóndilos (lateral = +x, anterior = +z) */
  femur=new Group();root.add(femur);
  const shaft=new LatheGeometry([[.0,3.6],[.5,3.6],[.52,3],[.6,2],[.85,1.2],[1.15,.75],[0,.75]].map(([x,y])=>new Vector2(x,y)),32);
  mesh('fem',shaft,bone,femur);
  [[-.62,-.02],[.62,.02]].forEach(([x])=>{const c=mesh('fem',new SphereGeometry(.72,32,24),bone,femur);c.position.set(x,.55,-.08);c.scale.set(.95,.9,1.25)});
  const tro=mesh('fem',new SphereGeometry(.62,28,20),bone2,femur);tro.position.set(0,.95,.45);tro.scale.set(1.25,.9,.7);
  /* bolsa suprarrotuliana y tendón del cuádriceps */
  const bm=mat('bursa',PAL.bursa,{transparent:true,opacity:.42,depthWrite:false});
  const bu=mesh('bursa',new SphereGeometry(.62,28,20),bm,femur);bu.position.set(0,2.05,.62);bu.scale.set(1.25,1.15,.55);
  const qm=mat('quad',PAL.quad);
  const q=mesh('quad',tube([[0,3.5,.66],[0,3.0,.8],[0,2,.98],[0,1.55,1.12]],.26),qm,femur);
  /* isquiotibiales y nervio ciático (posteriores) */
  const hm=mat('ham',PAL.ham);
  mesh('ham',tube([[-.45,3.5,-.8],[-.62,2.2,-.95],[-.88,.6,-.95],[-.95,-.6,-.55]],.17),hm,femur);
  mesh('ham',tube([[.45,3.5,-.8],[.62,2.2,-.95],[.95,.6,-.9],[1.05,-.5,-.4]],.17),hm,femur);
  const nm=mat('nerve',PAL.nerve,{emissive:new Color('#7a5a10'),emissiveIntensity:.25});
  mesh('nerve',tube([[0,3.6,-1.1],[.05,2.4,-1.18],[0,1,-1.2],[-.25,-.4,-1.05],[-.4,-1.6,-.95]],.08),nm,femur);
  /* espinilla (rota con la flexión alrededor del eje de la rodilla) */
  shin=new Group();shin.position.set(0,0,0);root.add(shin);
  const plat=mesh('tib',cyl(1.28,1.08,.42,36),bone,shin);plat.position.set(0,-.38,-.05);plat.scale.set(1,1,.82);
  const ts=mesh('tib',new LatheGeometry([[0,-.55],[1.05,-.55],[.7,-1.3],[.48,-2.4],[.42,-3.6],[0,-3.6]].map(([x,y])=>new Vector2(x,y)),32),bone,shin);ts.scale.set(1,1,.9);
  const tub=mesh('tib',new SphereGeometry(.3,20,14),bone2,shin);tub.position.set(0,-1.05,.68);tub.scale.set(1,1.4,.8);
  const fib=mesh('tib',cyl(.17,.13,2.8,16),bone2,shin);fib.position.set(1.12,-2.1,-.38);
  const fh=mesh('tib',new SphereGeometry(.26,16,12),bone2,shin);fh.position.set(1.08,-.75,-.38);
  /* meniscos: C sobre el platillo */
  const mm=mat('men',PAL.men);
  const mM=mesh('menM',new TorusGeometry(.6,.17,14,40,Math.PI*1.55),mm,shin);mM.rotation.set(Math.PI/2,0,Math.PI*.22);mM.position.set(-.6,-.12,-.05);mM.scale.set(1,1.15,.7);
  const mL=mesh('menL',new TorusGeometry(.55,.17,14,40,Math.PI*1.7),mat('men2',PAL.men),shin);mL.rotation.set(Math.PI/2,0,Math.PI*1.15);mL.position.set(.62,-.12,-.05);mL.scale.set(1,1.05,.7);
  /* ligamentos colaterales */
  const lm=mat('lig',PAL.lig);
  mesh('mcl',tube([[-1.32,1.4,-.1],[-1.38,.4,-.05],[-1.28,-.8,.05],[-1.05,-1.9,.1]],.1),lm,root);
  mesh('lcl',tube([[1.34,1.3,-.2],[1.42,.3,-.3],[1.22,-.65,-.38]],.09),mat('lig2',PAL.lig),root);
  /* grasa de Hoffa (unida a la tibia) */
  const fm=mat('hoffa',PAL.fat,{transparent:true,opacity:.92});
  const hf=mesh('hoffa',new SphereGeometry(.5,24,18),fm,shin);hf.position.set(0,-.05,.78);hf.scale.set(1.15,.85,.6);
  /* rótula (se desliza con la flexión) */
  patG=new Group();root.add(patG);
  const pt=mesh('pat',new SphereGeometry(.62,28,20),mat('pat',PAL.bone),patG);pt.position.set(0,1.05,1.05);pt.scale.set(1,1.1,.45);
  /* tendón rotuliano: cilindro unitario que se estira entre rótula y tuberosidad */
  ptendMesh=mesh('ptend',cyl(.2,.2,1,16),mat('ptend',PAL.tend),root);
  /* fantasmas de meta (0°, 90°, 120°) para el modo ROM */
  [0,90,120].forEach(a=>{const g=new Group(),gm=new MeshBasicMaterial({color:'#2c5fa6',transparent:true,opacity:.1,depthWrite:false,side:DoubleSide});const s=new Mesh(cyl(.5,.42,3.2,20),gm);s.position.y=-2.1;g.add(s);g.rotation.x=a*Math.PI/180;g.visible=false;g.userData.a=a;root.add(g);ghosts.push(g)});
  root.position.y=.15;
}
function pose(){
  const t=state.angle*Math.PI/180;shin.rotation.x=t;
  patG.rotation.x=t*.62;patG.position.set(0,-Math.sin(t*.62)*.15,0);
  const p=new Vector3(0,.52,1.08).applyEuler(patG.rotation).add(patG.position),tb=new Vector3(0,-1.1,.78).applyEuler(shin.rotation);
  between(ptendMesh,p,tb);
  root.rotation.set(state.rotX,state.rotY,0);
  ghosts.forEach(g=>g.visible=state.mode==='rom');
  const lit=new Set([...state.hl]);state.sel.forEach(z=>ZONES[z]&&ZONES[z].parts.forEach(p=>lit.add(p)));
  const dim=lit.size>0;
  Object.entries(parts).forEach(([k,arr])=>arr.forEach(m=>{const M=m.material,on=lit.has(k);
    M.color.copy(on?new Color(PAL.hi):M.userData.base);M.emissive&&M.emissive.set(on?'#5a1606':(k==='nerve'?'#7a5a10':'#000000'));
    const base=M.userData.op;M.transparent=true;M.opacity=on?Math.max(.95,base):dim&&!['fem','tib','pat'].includes(k)?base*.55:base;M.depthWrite=M.opacity>.9}));
}
function frame(){raf=0;if(!host||!visible)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  const c=R.domElement;if(c.width!==Math.round(w*R.getPixelRatio())||c.height!==Math.round(h*R.getPixelRatio())){R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
  cam.position.z=w/h<.75?17:w/h<1.2?14.5:13.2;pose();R.render(scene,cam)}
export function draw(){if(!raf)raf=requestAnimationFrame(frame)}

let drag=null;
function ptr(){const c=R.domElement;
  c.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,rx:state.rotX,ry:state.rotY,moved:0,id:e.pointerId};try{c.setPointerCapture(e.pointerId)}catch(_){}});
  c.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));if(drag.moved<4)return;
    state.rotY=drag.ry+dx*.012;state.rotX=Math.max(-.6,Math.min(.7,drag.rx+dy*.006));draw()});
  const up=e=>{if(!drag)return;const t=drag.moved<6;drag=null;if(t&&state.mode==='pick')pick(e)};
  c.addEventListener('pointerup',up);c.addEventListener('pointercancel',()=>drag=null);
  c.style.touchAction='pan-y';
}
const ray=new Raycaster();
function pick(e){const r=R.domElement.getBoundingClientRect(),v=new Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(v,cam);
  const hits=ray.intersectObjects(Object.entries(parts).filter(([k])=>partZone[k]).flatMap(([,a])=>a),false);
  if(!hits.length)return;const z=partZone[hits[0].object.userData.part];if(z&&onPick)onPick(z)}

export function init(){if(R)return true;try{R=new WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch(e){return false}
  if(!R.getContext())return false;R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));R.setClearColor(0x000000,0);R.domElement.className='k3d';build();ptr();
  ro=new ResizeObserver(()=>draw());io=new IntersectionObserver(es=>{visible=es.some(x=>x.isIntersecting);if(visible)draw()});return true}
/* opts: {mode:'pick'|'rom'|'show', sel:[zonas], hl:[partes], angle, onPick} */
export function mount(el,opts={}){if(!init())return false;host=el;if(R.domElement.parentNode!==el)el.prepend(R.domElement);
  ro.disconnect();ro.observe(el);io.disconnect();io.observe(el);visible=true;
  state.mode=opts.mode||'show';state.sel=new Set(opts.sel||[]);state.hl=new Set(opts.hl||[]);if(opts.angle!=null)state.angle=opts.angle;onPick=opts.onPick||null;
  if(opts.rotY!=null)state.rotY=opts.rotY;draw();return true}
export function set(o={}){if(o.sel)state.sel=new Set(o.sel);if(o.hl)state.hl=new Set(o.hl);if(o.angle!=null)state.angle=o.angle;if(o.rotY!=null)state.rotY=o.rotY;draw()}
export function spin(to,ms=900){const a=state.rotY,t0=performance.now();const st=n=>{const k=Math.min(1,(n-t0)/ms),e=1-Math.pow(1-k,3);state.rotY=a+(to-a)*e;draw();if(k<1)requestAnimationFrame(st)};requestAnimationFrame(st)}
export function animateAngle(to,ms=700){const a=state.angle,t0=performance.now();const st=n=>{const k=Math.min(1,(n-t0)/ms),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;state.angle=a+(to-a)*e;draw();if(k<1)requestAnimationFrame(st)};requestAnimationFrame(st)}

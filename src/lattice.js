import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AXES, blockLabel, monomial } from './algebra.js';
export const COLORS = ['#80e2c2', '#a4baff', '#ffbf7c', '#e29ee5', '#f6df82', '#79d4ef'];
const BG = 0x101a2b;
const sphere = new THREE.SphereGeometry(1, 12, 8);
const selectedMaterials = COLORS.map(color => new THREE.MeshBasicMaterial({ color }));
const ghostMaterial = new THREE.MeshBasicMaterial({color: 0x536985, transparent:true, opacity:0.47});
const originMaterial = new THREE.MeshBasicMaterial({color:0xffffff, wireframe:true});
function textSprite(text, color = '#a9bdd9') {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.font = '28px monospace'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, 64, 41);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture, depthTest:false, transparent:true}));
  sprite.scale.set(0.72,0.36,1); return sprite;
}
export class LatticeGallery {
  constructor(canvas) {
    this.views = []; this.cards = []; this.dirty = true;
    this.renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.autoClear = false;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.tooltip = document.querySelector('#tooltip');
    this.invalidate = () => { this.dirty = true; };
    window.addEventListener('resize', this.invalidate);
    window.addEventListener('scroll', this.invalidate, true);
    this.resizeObserver = new ResizeObserver(this.invalidate);
    this.resizeObserver.observe(document.querySelector('main'));
    this.renderer.setAnimationLoop(() => { if (this.dirty) { this.dirty = false; this.render(); } });
  }
  clear() {
    for (const v of this.views) { v.controls.dispose(); v.el.removeEventListener('pointermove',v.hover); v.el.removeEventListener('pointerleave',v.leave); }
    const geometries = new Set(), materials = new Set();
    for (const v of this.views) v.scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && o.geometry !== sphere) geometries.add(o.geometry); if (o.material && ![...selectedMaterials,ghostMaterial,originMaterial].includes(o.material)) materials.add(o.material); });
    for (const g of geometries) g.dispose(); for (const m of materials) { m.map?.dispose(); m.dispose(); }
    this.views = []; this.cards = []; this.tooltip.hidden = true;
  }
  build(code, checks, settings) {
    this.clear(); this.code = code; this.settings = settings;
    for (const check of checks) {
      const card = document.getElementById(check.id);
      const camera = new THREE.PerspectiveCamera(38,1,0.01,1000);
      const entry = {camera,check,el:card.querySelector('.viewport')};
      this.fit(entry,code,settings);
      const target=entry.target; this.cards.push(entry);
      const slices = code.dimension === 4 ? code.periods[3] : 1;
      for (let slice=0;slice<slices;slice++) {
        const el = card.querySelector(`[data-slice="${slice}"]`);
        const scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
        const content = new THREE.Group(); scene.add(content);
        const controls = new OrbitControls(camera,el); controls.target.copy(target); controls.enableDamping = false;
        controls.enableRotate = code.dimension > 2; controls.minDistance = 0.5; controls.maxDistance=300;
        controls.screenSpacePanning = true; controls.zoomSpeed = 0.8;
        if (code.dimension === 2) controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        controls.addEventListener('change', () => {
          for (const v of this.views) if (v.camera === camera && v.controls !== controls) v.controls.target.copy(controls.target);
          this.invalidate();
        });
        controls.update();
        const view = {el,scene,content,camera,controls,check,slice,selected:[],entry};
        this.populate(view,code,settings);
        view.hover = e => this.hover(e,view); view.leave=()=>{this.tooltip.hidden=true;};
        el.addEventListener('pointermove',view.hover); el.addEventListener('pointerleave',view.leave);
        this.views.push(view);
      }
    }
    this.updateSettings(settings); this.invalidate();
  }
  offset(block, count, separation) {
    // Every block has a distinct decorative displacement within a lattice site.
    if (count > 8) {
      const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count/columns);
      return new THREE.Vector3((block%columns-(columns-1)/2)*.17*separation,(Math.floor(block/columns)-(rows-1)/2)*.17*separation,0);
    }
    const angle = Math.PI * 2 * block / count + Math.PI/4;
    return new THREE.Vector3(Math.cos(angle)*0.22*separation,Math.sin(angle)*0.22*separation,0);
  }
  position(coords,block,code,settings) {
    return new THREE.Vector3(coords[0],coords[1],coords[2]??0).multiplyScalar(settings.spacing).add(this.offset(block,code.blocks.length,settings.blockSpacing));
  }
  populate(v,code,settings) {
    const [lx,ly,lz=1] = code.periods, nodes = lx*ly*lz*code.blocks.length;
    const ghost = new THREE.InstancedMesh(sphere,ghostMaterial,nodes); ghost.frustumCulled=false;
    const dummy = new THREE.Object3D(); let index=0;
    for (let z=0;z<lz;z++) for (let y=0;y<ly;y++) for (let x=0;x<lx;x++) for (let b=0;b<code.blocks.length;b++) {
      dummy.position.copy(this.position([x,y,z],b,code,settings)); dummy.scale.setScalar(Math.min(0.025,0.026*settings.blockSpacing)); dummy.updateMatrix(); ghost.setMatrixAt(index++,dummy.matrix);
    }
    ghost.instanceMatrix.needsUpdate=true; v.content.add(ghost);
    const gridPoints = [];
    const line=(a,b)=>gridPoints.push(...a,...b);
    for (let z=0;z<lz;z++) for(let y=0;y<ly;y++) line([0,y,z],[lx-1,y,z]);
    for (let z=0;z<lz;z++) for(let x=0;x<lx;x++) line([x,0,z],[x,ly-1,z]);
    for (let x=0;x<lx;x++) for(let y=0;y<ly;y++) line([x,y,0],[x,y,lz-1]);
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3)),new THREE.LineBasicMaterial({color:0x35506e,transparent:true,opacity:0.34}));
    grid.scale.setScalar(settings.spacing); grid.visible=settings.grid; v.content.add(grid); v.grid=grid;
    const support = v.check.support.filter(p=>code.dimension!==4 || p.coords[3]===v.slice);
    for (const point of support) {
      const markerRadius = Math.min(0.095,(code.blocks.length>8 ? 0.065 : 0.18*Math.sin(Math.PI/code.blocks.length))*settings.blockSpacing);
      const mesh = new THREE.Mesh(sphere,selectedMaterials[point.polynomial]); mesh.scale.setScalar(markerRadius); mesh.position.copy(this.position(point.coords,point.block,code,settings));
      mesh.userData=point; v.content.add(mesh); v.selected.push(mesh);
      // In 4D only the actual anchor slice carries a check marker and links.
      if (code.dimension !== 4 || v.slice === 0) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),mesh.position.clone()]),new THREE.LineBasicMaterial({color:COLORS[point.polynomial],transparent:true,opacity:0.40}));
        line.visible=settings.links; v.content.add(line);
      }
    }
    if (code.dimension!==4 || v.slice===0) {
      const origin = new THREE.Mesh(new THREE.OctahedronGeometry(0.15),originMaterial); v.content.add(origin);
    }
    const axes = [new THREE.Vector3(Math.max(lx-1,0.7),0,0),new THREE.Vector3(0,Math.max(ly-1,0.7),0)];
    if(code.dimension>2) axes.push(new THREE.Vector3(0,0,Math.max(lz-1,0.7)));
    const axisColors = ['#b8c9e4','#b8c9e4','#b8c9e4'];
    axes.forEach((end,i)=>{
      end.multiplyScalar(settings.spacing); end.setComponent(i,end.getComponent(i)+0.65);
      const start = new THREE.Vector3();
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,end]),new THREE.LineBasicMaterial({color:0x6b819e,transparent:true,opacity:0.7})); v.content.add(line);
      const label=textSprite(AXES[i],axisColors[i]); label.position.copy(end).setComponent(i,end.getComponent(i)+.2); v.content.add(label);
    });
  }
  updateSettings(settings) { this.settings=settings; this.invalidate(); }
  fit(entry,code,settings) {
    // Fit the actual scaled bounds in camera space, including axis labels.
    const padding=(code.blocks.length>8 ? .43 : .3)*settings.blockSpacing;
    const max = new THREE.Vector3(...[0,1,2].map(i=>((code.periods[i]??1)-1)*settings.spacing+(i===2?.12:padding)));
    const min = new THREE.Vector3(-padding,-padding,-0.12);
    const center=min.clone().add(max).multiplyScalar(.5);
    const direction = code.dimension === 2 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1.0,0.65,1.45).normalize();
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right).normalize();
    const rect=entry.el.getBoundingClientRect(),aspect=rect.width/rect.height;
    const tangent=Math.tan(THREE.MathUtils.degToRad(entry.camera.fov/2));
    let distance=1; const points=[];
    for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
      points.push(new THREE.Vector3(x,y,z));
    }
    for(let i=0;i<Math.min(code.dimension,3);i++){
      const point=new THREE.Vector3();point.setComponent(i,Math.max(code.periods[i]-1,.7)*settings.spacing+1.1);points.push(point);
    }
    for(const point of points){
      const p=point.clone().sub(center),depth=p.dot(direction);
      distance=Math.max(distance,depth+Math.abs(p.dot(right))*1.1/(tangent*aspect),depth+Math.abs(p.dot(up))*1.1/tangent);
    }
    entry.target=center;entry.position=center.clone().addScaledVector(direction,distance);
    entry.camera.position.copy(entry.position);entry.camera.lookAt(center);
  }
  rebuildSettings(settings) {
    // Preserve cameras while rebuilding positions for spacing adjustments.
    const saved=this.cards.map(c=>({id:c.check.id,position:c.camera.position.clone(),target:this.views.find(v=>v.entry===c)?.controls.target.clone()}));
    const code=this.code,checks=this.cards.map(c=>c.check);
    this.build(code,checks,settings);
    for (const card of this.cards) { const prev=saved.find(c=>c.id===card.check.id); card.camera.position.copy(prev.position); for(const v of this.views) if(v.entry===card){v.controls.target.copy(prev.target);v.controls.update();} }
    this.invalidate();
  }
  reset() { for(const c of this.cards){this.fit(c,this.code,this.settings); for(const v of this.views) if(v.entry===c){v.controls.target.copy(c.target);v.controls.update();}} this.invalidate(); }
  render() {
    const width=window.innerWidth,height=window.innerHeight;
    if(this.width!==width || this.height!==height){const refit=this.width!==undefined;this.renderer.setSize(width,height,false);this.width=width;this.height=height;if(refit && this.code)this.reset();}
    this.renderer.setScissorTest(false);this.renderer.setClearColor(0x000000,0);this.renderer.clear();this.renderer.setScissorTest(true);
    for(const v of this.views){
      const r=v.el.getBoundingClientRect(),clip=v.el.parentElement.getBoundingClientRect();
      const left=Math.max(0,r.left,clip.left),right=Math.min(width,r.right,clip.right),top=Math.max(0,r.top,clip.top),bottom=Math.min(height,r.bottom,clip.bottom);
      if(right<=left || bottom<=top || !r.width || !r.height) continue;
      v.camera.aspect=r.width/r.height;v.camera.updateProjectionMatrix();
      this.renderer.setViewport(r.left,height-r.bottom,r.width,r.height);
      this.renderer.setScissor(left,height-bottom,right-left,bottom-top);
      this.renderer.render(v.scene,v.camera);
    }
  }
  hover(event,v){
    if(event.buttons){this.tooltip.hidden=true;return;}
    const r=v.el.getBoundingClientRect();this.pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    this.raycaster.setFromCamera(this.pointer,v.camera);const hit=this.raycaster.intersectObjects(v.selected)[0];
    if(!hit){this.tooltip.hidden=true;return;}
    const p=hit.object.userData;
    this.tooltip.textContent=`F${p.polynomial+1} · ${monomial(p.exp)}\nBlock ${blockLabel(this.code.blocks[p.block])} · (${p.coords.join(', ')})`;
    this.tooltip.style.whiteSpace='pre-line';this.tooltip.hidden=false;
    this.tooltip.style.left=`${Math.max(8,Math.min(event.clientX+14,window.innerWidth-this.tooltip.offsetWidth-8))}px`;
    this.tooltip.style.top=`${Math.max(8,Math.min(event.clientY+14,window.innerHeight-this.tooltip.offsetHeight-8))}px`;
  }
}

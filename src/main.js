import './style.css';
import { buildCode, parseIdeal, AXES, blockLabel, monomial } from './algebra.js';
import { PRESETS } from './presets.js';
import { LatticeGallery, COLORS } from './lattice.js';
const $ = s => document.querySelector(s);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dimension=2,filter='all',code,currentPreset=PRESETS[0],gallery;
const settings=()=>({spacing:Number($('#spacing').value),blockSpacing:Number($('#block-spacing').value),grid:$('#show-grid').checked,links:$('#show-links').checked});
try { gallery=new LatticeGallery($('#lattice-canvas')); } catch(error) { $('#webgl-error').hidden=false; console.error('WebGL initialization failed:',error); }
$('#preset').innerHTML=PRESETS.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')+'<option value="custom">Custom code</option>';
function setDimension(n) {
  dimension=n;
  document.querySelectorAll('[data-dim]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.dim)===n));
}
function loadPreset(p){
  currentPreset=p;$('#preset').value=p.id;setDimension(p.dimension);$('#ideal').value=p.ideal;$('#polynomials').value=p.polynomials.join('\n');
  $('#preset-note').textContent=p.note;$('#source-link').textContent=p.source;$('#source-link').href=p.reference;
  apply();
}
function draft(){
  $('#preset').value='custom';currentPreset=null;$('#preset-note').textContent='Define your own periodic lattice and generating polynomials. The current view updates when you apply them.';
  $('#draft-status').textContent='Unapplied changes';
}
function apply(){
  try{
    const next=buildCode({dimension,ideal:$('#ideal').value,polynomials:$('#polynomials').value});
    code=next;$('#input-error').hidden=true;$('#ideal').removeAttribute('aria-invalid');$('#polynomials').removeAttribute('aria-invalid');$('#draft-status').textContent='';
    $('#view-title').textContent=currentPreset ? currentPreset.name.split(' · ')[0] : 'Custom multicycle code';
    $('#dimension-badge').textContent=`${code.dimension}D periodic lattice`;
    $('#stats').innerHTML=[['Lattice size',code.periods.join(' × ')],['Physical qubits',code.n.toLocaleString()],['Qubit blocks',code.blocks.length],['Check families',`${code.checks.filter(c=>c.type==='X').length} X + ${code.checks.filter(c=>c.type==='Z').length} Z`]].map(([name,value])=>`<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${name}</div></div>`).join('');
    $('#polynomial-legend').innerHTML=code.polys.map((poly,i)=>`<span class="poly-key" title="${escape(poly.map(monomial).join(' + ')||'0')}"><i style="background:${COLORS[i]}"></i>F${i+1}<span style="color:#91a3bd"> · ${poly.length} terms</span></span>`).join('');
    $('#slice-spacing-control').hidden=code.dimension!==4;
    if(!currentPreset){$('#source-link').textContent='Construction reference';$('#source-link').href='https://arxiv.org/abs/2601.18879';}
    renderChecks();
  }catch(error){$('#input-error').textContent=error.message;$('#input-error').hidden=false;$('#draft-status').textContent='The view still shows the last valid code.';}
}
function renderChecks(){
  const checks=code.checks.filter(c=>filter==='all'||filter===c.type);
  $('#representative-count').textContent=`${checks.length} representatives · anchor (0${', 0'.repeat(code.dimension-1)})`;
  $('#check-gallery').classList.toggle('four-d',code.dimension===4);
  $('#check-gallery').innerHTML=checks.map(check=>{
    const slices=code.dimension===4?code.periods[3]:1;
    const usedBlocks=[...new Set(check.support.map(p=>p.block))];
    return `<article class="check-card" id="${check.id}"><header><div class="check-heading"><span class="type-tag ${check.type.toLowerCase()}">${check.type}</span><h3>${escape(check.type+' '+blockLabel(check.family))}</h3></div><span class="weight">weight ${check.weight}</span></header><div class="viewport-strip" style="--slice-gap:${$('#slice-spacing').value}px">${Array.from({length:slices},(_,i)=>`<div class="viewport" data-slice="${i}" tabindex="0" role="img" aria-label="${escape(check.label)}, ${code.dimension}D lattice${code.dimension===4?`, w equals ${i}`:''}. The exact support is in the table below.">${code.dimension===4?`<span class="slice-label">w = ${i}</span>`:''}<span class="viewport-hint">${code.dimension===2?'drag to pan':'drag to rotate'}</span>${!check.weight?'<span class="empty-check">Zero check · empty support</span>':''}</div>`).join('')}</div>${code.dimension===4?'<div class="plot-caption">w increases left to right · each slice has the same x, y, z axes</div>':''}<footer><div class="block-legend">Blocks touched ${usedBlocks.map(i=>`<span>${escape(blockLabel(code.blocks[i]))}</span>`).join('')||'none'}</div><details class="support-details"><summary>Inspect ${check.weight} support coordinates</summary><table class="support-table"><thead><tr><th>Term</th><th>Block</th><th>(${AXES.slice(0,code.dimension).join(', ')})</th></tr></thead><tbody>${check.support.map(p=>`<tr><td style="color:${COLORS[p.polynomial]}">F${p.polynomial+1}: ${escape(monomial(p.exp))}</td><td>${escape(blockLabel(code.blocks[p.block]))}</td><td>(${p.coords.join(', ')})</td></tr>`).join('')}</tbody></table></details></footer></article>`;
  }).join('');
  gallery?.build(code,checks,settings());
  // Arrow keys rotate 3D views or pan 2D views; +/- zoom. Exact data is also available without WebGL.
  document.querySelectorAll('.viewport').forEach(el=>el.addEventListener('keydown',event=>{
    const v=gallery?.views.find(v=>v.el===el);if(!v)return;
    const key=event.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(key))return;event.preventDefault();
    const offset=v.camera.position.clone().sub(v.controls.target);
    if(key==='+'||key==='='||key==='-'){offset.multiplyScalar(key==='-'?1.15:0.87);v.camera.position.copy(v.controls.target).add(offset);}
    else if(code.dimension===2){const x=key==='ArrowLeft'?-.3:key==='ArrowRight'?.3:0,y=key==='ArrowUp'?.3:key==='ArrowDown'?-.3:0;v.camera.position.x+=x;v.camera.position.y+=y;v.controls.target.x+=x;v.controls.target.y+=y;}
    else {const axis=key==='ArrowLeft'||key==='ArrowRight'?'y':'x';const a=(key==='ArrowLeft'||key==='ArrowUp'?1:-1)*.13;const c=Math.cos(a),s=Math.sin(a);if(axis==='y'){const x=offset.x;offset.x=x*c+offset.z*s;offset.z=-x*s+offset.z*c;}else{const y=offset.y;offset.y=y*c-offset.z*s;offset.z=y*s+offset.z*c;}v.camera.position.copy(v.controls.target).add(offset);}
    v.controls.update();gallery.invalidate();
  }));
}
$('#preset').addEventListener('change',()=>{const p=PRESETS.find(p=>p.id===$('#preset').value);if(p)loadPreset(p);else draft();});
$('#code-form').addEventListener('submit',e=>{e.preventDefault();apply();});
for(const id of ['ideal','polynomials'])$('#'+id).addEventListener('input',draft);
document.querySelectorAll('[data-dim]').forEach(b=>b.addEventListener('click',()=>{
  const n=Number(b.dataset.dim);if(n===dimension)return;
  let periods;
  try { periods=parseIdeal($('#ideal').value,dimension); } catch { periods=code.periods; }
  setDimension(n);$('#ideal').value=AXES.slice(0,n).map((axis,i)=>`${axis}^${periods[i]??3} - 1`).join(', ');draft();
}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderChecks();}));
let pendingFrame;
for(const id of ['spacing','block-spacing','show-grid','show-links'])$('#'+id).addEventListener('input',()=>{
  $('#spacing-value').textContent=Number($('#spacing').value).toFixed(2).replace(/0$/,'')+'×';$('#block-spacing-value').textContent=Number($('#block-spacing').value).toFixed(2).replace(/0$/,'')+'×';
  cancelAnimationFrame(pendingFrame);pendingFrame=requestAnimationFrame(()=>{if(code)gallery?.rebuildSettings(settings());});
});
$('#slice-spacing').addEventListener('input',()=>{$('#slice-spacing-value').textContent=$('#slice-spacing').value+' px';document.querySelectorAll('.viewport-strip').forEach(el=>el.style.setProperty('--slice-gap',$('#slice-spacing').value+'px'));gallery?.invalidate();});
$('#reset-view').addEventListener('click',()=>gallery?.reset());
loadPreset(PRESETS[0]);

// Starting state recovered from the uploaded page.
const importedLayout={"machines":[{"id":"sem","name":"SEM","x":7.75,"y":0.5,"w":5.04,"h":2.75,"note":"Workbench footprint","table":false},{"id":"afm","name":"AFM-IR","x":29.45,"y":10.5,"w":3.25,"h":4.83,"note":"Measured footprint","table":false},{"id":"saxs","name":"SAXS","x":2.5,"y":5.0,"w":3.5,"h":16.0,"note":"Approximate from supplied drawing","table":false},{"id":"ct","name":"MicroCT","x":16.25,"y":0.75,"w":4.04,"h":2.04,"note":"Measured footprint","table":false},{"id":"oca","name":"Solar Simulator","x":13.5,"y":9.5,"w":1.9,"h":1.5,"note":"Estimated tabletop footprint","table":true},{"id":"nano","name":"Nanoindenter","x":15.75,"y":9.5,"w":1.5,"h":1.67,"note":"Measured tabletop footprint","table":true},{"id":"solar","name":"OCA","x":16.75,"y":11.75,"w":0.59,"h":2.0,"note":"Measured tabletop footprint","table":true},{"id":"robot","name":"RO1 robot","x":9.9,"y":14.8,"w":1.5,"h":1.25,"note":"Base only; reach not modeled","table":false},{"id":"dexter","name":"Dexter","x":13.5,"y":22.0,"w":4.0,"h":2.0,"note":"Estimated; separate from RO1","table":true},{"id":"tensile","name":"Tensile stage","x":13.5,"y":19.5,"w":4.0,"h":1.5,"note":"Estimated; LinkAM per drawing","table":true},{"id":"sem_table","name":"Glovebox","x":2.5,"y":31.25,"w":4.0,"h":2.5,"note":"Wood-frame lab table · 4 ft × 2.5 ft · beside SEM","table":false},{"id":"ct_table","name":"CT table","x":22.5,"y":0.75,"w":4.0,"h":2.5,"note":"Wood-frame lab table · 4 ft × 2.5 ft · beside MicroCT","table":false},{"id":"afm_table","name":"AFM table","x":25.25,"y":15.75,"w":4.0,"h":2.5,"note":"Wood-frame lab table · 4 ft × 2.5 ft · beside AFM-IR","table":false}],"rules":[["sem","afm",2.0],["saxs","ct",2.0],["afm","saxs",1.0],["sem","ct",1.0],["dexter","tensile",1.0],["sem","saxs",3.0]],"score":55};

const initial=[['sem','SEM',30,26,2.75,5.04,'Workbench footprint'],['afm','AFM-IR',29.45,10.5,3.25,4.83,'Measured footprint'],['saxs','SAXS',2.33,7,3.5,16,'Approximate from supplied drawing'],['ct','MicroCT',3,31.4,4.04,2.04,'Measured footprint'],['oca','OCA 25',15.6,10,1.9,1.5,'Estimated tabletop footprint'],['nano','Nanoindenter',13.4,21.7,1.5,1.67,'Measured tabletop footprint'],['solar','Solar sim',13.4,10,2,.59,'Measured tabletop footprint'],['robot','RO1 robot',9.9,14.8,1.5,1.25,'Base only; reach not modeled'],['dexter','Dexter',13.4,12,4,2,'Estimated; separate from RO1'],['tensile','Tensile stage',13.4,14.5,4,1.5,'Estimated; LinkAM per drawing'],['sem_table','SEM table',25.5,26,4,2.5,'Wood-frame lab table · 4 ft × 2.5 ft · beside SEM'],['ct_table','CT table',7.5,31.25,4,2.5,'Wood-frame lab table · 4 ft × 2.5 ft · beside MicroCT'],['afm_table','AFM table',25,10.5,4,2.5,'Wood-frame lab table · 4 ft × 2.5 ft · beside AFM-IR']].map(([id,name,x,y,w,h,note])=>({id,name,x,y,w,h,note,table:['oca','nano','solar','dexter','tensile'].includes(id)}));
const STATE_KEY='cliffLayoutsV8';
const $=id=>document.getElementById(id),m=id=>machines.find(x=>x.id===id);
const table=LabLayouts.table,obstacles=LabLayouts.obstacles;
const startingRules=[['sem','afm',2],['saxs','ct',2],['afm','saxs',1],['sem','ct',1],['dexter','tensile',1]];
let catalog=[],machines=[],rules=[],teams=[],selected=null,history=[],drag=null,remaining=0,timer=null;
let stateReadable=true,storageMessage='';
function validMachines(items){return LabLayouts.validMachines(items)}
function validRules(items){return LabLayouts.validRules(items,machines)}
function currentState(){return {version:8,catalog,machines,rules,teams}}
function applyState(state){
  ({catalog,machines,rules,teams}=structuredClone(state));
  if(!m(selected))selected=machines[0]?.id||null;
  drag=null;
}
function initialState(){
  return LabLayouts.migrate({machines:importedLayout.machines,rules:importedLayout.rules,
    teams:[{version:3,name:'Imported layout',machines:importedLayout.machines,rules:importedLayout.rules,score:importedLayout.score}]});
}
function readState(){
  const stored=localStorage.getItem(STATE_KEY);
  if(stored!==null){
    const state=JSON.parse(stored);
    if(state.version!==8)throw Error('This saved layout format could not be read.');
    return LabLayouts.synchronize(state);
  }
  const draft=JSON.parse(localStorage.getItem('cliffDraftV7')||'null');
  const savedTeams=localStorage.getItem('cliffTeams');
  const savedRules=JSON.parse(localStorage.getItem('cliffAffinity')||'null');
  const fallback=initialState();
  // Legacy keys remain untouched so migration never destroys the old records.
  return LabLayouts.migrate({machines:draft?.machines||fallback.machines,
    rules:draft?.rules||savedRules||fallback.rules,
    teams:savedTeams===null?fallback.teams:JSON.parse(savedTeams)});
}
function persistState(state=currentState()){
  if(!stateReadable){$('status').textContent=storageMessage;return false;}
  try{localStorage.setItem(STATE_KEY,JSON.stringify(state));storageMessage='';return true;}
  catch{storageMessage='Changes could not be saved because browser storage is unavailable or full.';
    $('status').textContent=storageMessage;return false;}
}
function persistDraft(){return persistState()}
function persistAffinity(){return persistState()}
function snapshot(){history.push(JSON.stringify({state:currentState(),selected}));if(history.length>80)history.shift()}
function commitShared(next,message,nextSelected=selected){
  if(!persistState(next))return false;
  snapshot();applyState(next);selected=machines.some(a=>a.id===nextSelected)?nextSelected:machines[0]?.id||null;
  draw(false);renderMatrix();leaderboard();$('status').textContent=message;
  return true;
}
function overlap(a,b){return LabLayouts.overlap(a,b)}
function evaluate(){return LabLayouts.evaluate(machines,rules)}
try{applyState(readState());}
catch(error){stateReadable=false;storageMessage=error.message+' Saving is paused to protect the existing data.';applyState(initialState());}
function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function rect(a,fill,stroke='#546b66'){return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${fill}" stroke="${stroke}" stroke-width=".07"/>`}
function draw(save=true){if(!m(selected))selected=machines[0]?.id||null;let e=evaluate();$('score').textContent=e.score;$('matrix-score').textContent=e.score;$('matrix-count').textContent=rules.filter(r=>r[2]>0).length;$('issues').innerHTML=e.bad.size?`<p class="warn tiny">${e.bad.size} placards conflict with another footprint, the entrance, or their tabletop boundary (−8 points each).</p>`:'<p class="tiny" style="color:#d5f699">✓ No footprint conflicts</p>';let s='<defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#bbc7ba" stroke-width=".025"/></pattern><pattern id="hatch" width=".4" height=".4" patternUnits="userSpaceOnUse"><path d="M0 .4L.4 0" stroke="#d5975c" stroke-width=".08"/></pattern></defs><rect width="32.75" height="34.083" fill="url(#grid)" stroke="#31493e" stroke-width=".13"/>';
s+=rect(table,'#d2dccd')+'<text x="15.45" y="9.15" text-anchor="middle" font-size=".35">FIXED OPTICAL TABLE</text>';obstacles.forEach((o,i)=>s+=rect(o,i===4?'url(#hatch)':'#8a9993'));s+='<text x="16.375" y="33.4" text-anchor="middle" font-size=".4">KEEP ENTRANCE CLEAR</text><line x1="13.375" y1="34.083" x2="19.375" y2="34.083" stroke="#e9eee4" stroke-width=".2"/><path d="M13.375 33.85V34.3 M19.375 33.85V34.3" stroke="#31493e" stroke-width=".1"/><text x="16.375" y="34.8" text-anchor="middle" font-size=".4">6 ft doorway · centered</text>';
if($('lines').checked)rules.forEach(([a,b,w])=>{if(w){a=m(a);b=m(b);s+=`<line x1="${a.x+a.w/2}" y1="${a.y+a.h/2}" x2="${b.x+b.w/2}" y2="${b.y+b.h/2}" stroke="#508e78" stroke-opacity=".55" stroke-width="${.035+w*.035}" stroke-dasharray=".18 .12"/>`}});machines.forEach(a=>{s+=`<g class="machine" data-id="${a.id}"><title>${escapeText(a.name)}</title>${rect(a,e.bad.has(a.id)?'#ffd0b6':a.id===selected?'#c4e981':a.id.endsWith('_table')?'#ead7b2':a.table?'#d9e5ff':'#b8dcd5',a.id===selected?'#34502c':'#527365')}<text x="${a.x+a.w/2}" y="${a.y+a.h/2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(a.id==='solar'?.27:.35,a.h*.65)}" font-weight="650" textLength="${Math.min(a.w-.15,(a.name.length+(a.id==='afm'?8:0))*.19)}" lengthAdjust="spacingAndGlyphs">${escapeText(a.name)}${a.id==='afm'?' (fixed)':''}</text></g>`});$('board').innerHTML=s;$('cards').innerHTML=machines.map(a=>`<button class="card ${a.id===selected?'selected':''}" data-select="${a.id}"><span class="placard-name">${escapeText(a.name)}</span><small>${a.id==='afm'?'Locked':a.id.endsWith('_table')?'Bench':a.table?'Table':'Floor'}</small></button>`).join('');let a=m(selected);$('detail').innerHTML=a?`<div class="chip">Selected placard</div><h2 style="margin-top:8px">${escapeText(a.name)}</h2><p class="tiny">${a.id==='afm'?'Fixed in place. Position, rotation and footprint are locked.<br>':''}${escapeText(a.note||'Custom placard')}<br>${a.w.toFixed(2)} × ${a.h.toFixed(2)} ft</p><div class="tiny">${rules.filter(r=>r[2]>0&&(r[0]===a.id||r[1]===a.id)).map(r=>'Near '+escapeText(m(r[0]===a.id?r[1]:r[0]).name)+' · weight '+r[2]).join('<br>')||'No verified proximity preference assigned.'}</div>`:'<h2>No objects yet</h2><p class="tiny muted">Add an object to include it in every layout.</p>';['rotate','resize','width','depth'].forEach(id=>$(id).disabled=!a||a.id==='afm');$('width').value=a?.w||'';$('depth').value=a?.h||'';$('object-name').value=a?.name||'';['remove-object','rename-object','object-name'].forEach(id=>$(id).disabled=!a||!stateReadable);$('add-object').disabled=!stateReadable;$('save').disabled=!stateReadable;$('undo').disabled=!history.length;$('object-count').textContent=machines.length+' objects · shared across all layouts';renderRules();if(save)persistDraft();}
function renderRules(){$('rules').innerHTML=rules.map(([a,b,w],i)=>`<div class="rule tiny">${escapeText(m(a).name)} ↔ ${escapeText(m(b).name)} <input aria-label="${escapeText(m(a).name)} to ${escapeText(m(b).name)} weight" data-rule="${i}" type="number" min="0" max="100" step="0.5" value="${w}"></div>`).join('');}
$('rules').onchange=e=>{if(e.target.dataset.rule!==undefined){rules[+e.target.dataset.rule][2]=Math.min(100,Math.max(0,Number(e.target.value)||0));persistAffinity();draw()}};$('cards').onclick=e=>{let b=e.target.closest('[data-select]');if(b){selected=b.dataset.select;draw()}};
function pairWeight(a,b){return rules.find(r=>(r[0]===a&&r[1]===b)||(r[0]===b&&r[1]===a))?.[2]||0}

function setPair(a,b,w){if(a===b)return;let r=rules.find(r=>(r[0]===a&&r[1]===b)||(r[0]===b&&r[1]===a));if(r)r[2]=w;else rules.push([a,b,w]);persistAffinity();}
function renderMatrix(){if(!machines.length){$('matrix-page').innerHTML='<option>No objects</option>';$('matrix-page').disabled=true;$('matrix-grid').innerHTML='<p class="muted">Add objects in the layout view to set their connections.</p>';return;}$('matrix-page').disabled=false;let page=Number($('matrix-page').value)||0;let groups=Math.ceil(machines.length/4);page=Math.max(0,Math.min(page,groups-1));$('matrix-page').innerHTML=Array.from({length:groups},(_,i)=>`<option value="${i}">${i*4+1}–${Math.min(machines.length,i*4+4)} of ${machines.length}</option>`).join('');$('matrix-page').value=page;let cols=machines.slice(page*4,page*4+4);$('matrix-grid').innerHTML='<table><thead><tr><th scope="col">Object / partner</th>'+cols.map(a=>`<th scope="col">${escapeText(a.name)}</th>`).join('')+'</tr></thead><tbody>'+machines.map(a=>'<tr><th scope="row">'+escapeText(a.name)+'</th>'+cols.map(b=>a.id===b.id?'<td>—</td>':`<td class="${pairWeight(a.id,b.id)>0?'active':''}"><input type="number" min="0" max="100" step="0.5" data-a="${a.id}" data-b="${b.id}" aria-label="${escapeText(a.name)} and ${escapeText(b.name)} affinity" value="${pairWeight(a.id,b.id)}"></td>`).join('')+'</tr>').join('')+'</tbody></table>';}
function showView(matrix){$('matrix-panel').hidden=!matrix;$('layout-panel').hidden=matrix;$('affinity-tab').setAttribute('aria-selected',String(matrix));$('layout-tab').setAttribute('aria-selected',String(!matrix));if(matrix)renderMatrix();}
$('layout-tab').onclick=$('matrix-back').onclick=()=>showView(false);$('affinity-tab').onclick=()=>showView(true);$('matrix-page').onchange=renderMatrix;
$('matrix-grid').oninput=e=>{let el=e.target;if(!el.dataset.a)return;let w=Number(el.value);if(el.value===''||!Number.isFinite(w)||w<0||w>100){$('matrix-feedback').textContent='Enter a weight from 0 to 100.';return;}setPair(el.dataset.a,el.dataset.b,w);document.querySelectorAll('#matrix-grid input').forEach(other=>{if(other.dataset.a===el.dataset.b&&other.dataset.b===el.dataset.a)other.value=w;if((other.dataset.a===el.dataset.a&&other.dataset.b===el.dataset.b)||(other.dataset.a===el.dataset.b&&other.dataset.b===el.dataset.a))other.parentElement.classList.toggle('active',w>0);});draw();$('matrix-feedback').textContent=m(el.dataset.a).name+' ↔ '+m(el.dataset.b).name+': '+w+'. Score updated.';};
$('restore-affinity').onclick=()=>{snapshot();rules=validRules(startingRules);persistAffinity();draw();renderMatrix();$('matrix-feedback').textContent='Starting weights restored.';};
$('rename-form').onsubmit=e=>{
  e.preventDefault();if(!m(selected))return;
  const name=$('object-name').value.trim();
  if(!name){$('rename-feedback').textContent='Please enter an object name.';return;}
  if(commitShared(LabLayouts.renameObject(currentState(),selected,name),'Object renamed in every layout.'))
    $('rename-feedback').textContent='Name updated in every layout.';
};
$('remove-object').onclick=()=>{
  const a=m(selected);if(!a)return;
  if(commitShared(LabLayouts.removeObject(currentState(),a.id),a.name+' removed from every layout. Use Undo to restore it.'))
    $('placard-feedback').textContent=a.name+' removed from every layout.';
};
function findSpace(placard){return LabLayouts.findSpace(placard,machines)}
$('placard-form').onsubmit=e=>{
  e.preventDefault();
  const name=$('placard-name').value.trim(),w=Number($('placard-width').value),h=Number($('placard-depth').value);
  if(!name||!Number.isFinite(w)||!Number.isFinite(h)||w<.5||w>20||h<.5||h>25){
    $('placard-feedback').textContent='Enter a name, width 0.5–20 ft, and depth 0.5–25 ft.';return;
  }
  const a={id:'custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10),name:name.slice(0,40),
    x:0,y:0,w,h,table:$('placard-tabletop').checked,custom:true,note:'User-defined footprint'};
  try{
    const next=LabLayouts.addObject(currentState(),a);
    const crowded=next.teams.filter(t=>LabLayouts.evaluate(t.machines,t.rules).bad.has(a.id)).length;
    const message=a.name+' added to every layout.'+(crowded?' '+crowded+' saved layout(s) need this object repositioned.':'');
    if(commitShared(next,message,a.id)){
      $('placard-form').reset();$('placard-feedback').textContent=message;
      $('status').textContent=message+' The new object is selected.';
    }else $('placard-feedback').textContent=storageMessage;
  }catch(error){$('placard-feedback').textContent=error.message;}
};
function point(e){let p=$('board').createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform($('board').getScreenCTM().inverse())}function move(a,x,y){if(!a||a.id==='afm')return;a.x=Math.max(0,Math.min(32.75-a.w,Math.round(x*4)/4));a.y=Math.max(0,Math.min(34.083-a.h,Math.round(y*4)/4))}
$('board').onpointerdown=e=>{if(!machines.length)return;let g=e.target.closest('[data-id]'),p=point(e);snapshot();if(g){selected=g.dataset.id;let a=m(selected);if(a.id==='afm'){drag=null;draw();return}drag={dx:p.x-a.x,dy:p.y-a.y};$('board').setPointerCapture(e.pointerId)}else{let a=m(selected);move(a,p.x-a.w/2,p.y-a.h/2)}draw()};$('board').onpointermove=e=>{if(drag){let p=point(e);move(m(selected),p.x-drag.dx,p.y-drag.dy);draw()}};$('board').onpointerup=$('board').onpointercancel=()=>drag=null;$('rotate').onclick=()=>{if(!m(selected)||selected==='afm')return;snapshot();let a=m(selected);[a.w,a.h]=[a.h,a.w];move(a,a.x,a.y);draw()};$('undo').onclick=()=>{
  if(!history.length)return;
  const previous=JSON.parse(history[history.length-1]);
  if(!persistState(previous.state))return;
  history.pop();applyState(previous.state);selected=previous.selected;
  draw(false);renderMatrix();leaderboard();$('status').textContent='Undone. The shared object list is consistent in every layout.';
};
$('reset').onclick=()=>{
  snapshot();machines=LabLayouts.normalizeMachines(catalog,initial);rules=validRules(rules);
  selected=machines[0]?.id||null;draw();renderMatrix();
  if(!storageMessage)$('status').textContent='Original positions restored for the current shared object list.';
};
$('resize').onclick=()=>{if(!m(selected)||selected==='afm')return;let w=+$('width').value,h=+$('depth').value;if(w>=.5&&w<=20&&h>=.5&&h<=25){snapshot();Object.assign(m(selected),{w,h});move(m(selected),m(selected).x,m(selected).y);draw()}};$('lines').onchange=draw;document.onkeydown=e=>{if(!machines.length||$('layout-panel').hidden)return;if(['INPUT','BUTTON','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;let d={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,-.25],ArrowDown:[0,.25]}[e.key];if(d){e.preventDefault();snapshot();let a=m(selected);move(a,a.x+d[0],a.y+d[1]);draw()}};
$('start').onclick=()=>{clearInterval(timer);remaining=180;$('status').textContent='03:00 · Your round is running. Arrange the placards!';timer=setInterval(()=>{remaining--;$('status').textContent=remaining?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')} · Keep improving your layout`:'Time! Save your team score, then pass the screen.';if(!remaining)clearInterval(timer)},1000)};
function loadTeam(t){
  if(!validMachines(t.machines)){$('status').textContent='This saved layout could not be loaded. Its saved data has been kept unchanged.';return;}
  snapshot();machines=LabLayouts.normalizeMachines(catalog,t.machines);rules=validRules(t.rules);
  selected=machines[0]?.id||null;draw();renderMatrix();$('team').value=(t.name+' remake').slice(0,30);
  if(!storageMessage)$('status').textContent='Loaded '+t.name+'. The object list is shared across all layouts.';
}
function leaderboard(){
  $('leaders').replaceChildren();
  [...teams].sort((a,b)=>b.score-a.score).forEach(t=>{
    const row=document.createElement('div');row.className='entry';
    const label=document.createElement('span');label.textContent=t.name+' · '+t.score+' pts';
    const b=document.createElement('button');b.textContent='Load';b.setAttribute('aria-label','Load '+t.name);b.onclick=()=>loadTeam(t);
    row.append(label,b);$('leaders').append(row);
  });
}
$('save').onclick=()=>{
  const next=structuredClone(currentState());
  next.teams.push({version:3,name:$('team').value.trim()||'Team '+(teams.length+1),score:evaluate().score,
    machines:structuredClone(machines),rules:structuredClone(rules)});
  if(!persistState(next))return;
  applyState(next);history=[];draw(false);leaderboard();
  $('status').textContent='Layout saved. Object additions and removals apply to every saved layout.';
};
window.addEventListener('storage',e=>{
  if(e.key!==STATE_KEY||e.newValue===null)return;
  try{
    const next=JSON.parse(e.newValue);if(next.version!==8)return;
    applyState(LabLayouts.synchronize(next));history=[];draw(false);renderMatrix();leaderboard();
    $('status').textContent='Layouts updated from another tab.';
  }catch{$('status').textContent='A change from another tab could not be read. Reload before editing.';}
});
draw(false);leaderboard();renderMatrix();
if(stateReadable)persistState();else $('status').textContent=storageMessage;

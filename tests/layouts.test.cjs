const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../dist/layout-state.js');
const appSource = fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');
const modelSource = fs.readFileSync(path.join(__dirname,'../dist/layout-state.js'),'utf8');
const imported = JSON.parse(appSource.match(/const importedLayout=(.*);/)[1]);
const object = (id,x=7,y=3) => ({id,name:id,x,y,w:1,h:1,table:false});
const ids = machines => machines.map(a=>a.id).sort();
const roundTrip = value => JSON.parse(JSON.stringify(value));
function seed() {
  return model.migrate({machines:[object('a'),object('b',10)],rules:[['a','b',2]],teams:[
    {name:'First',machines:[object('a',8),object('b',11)],rules:[['a','b',2]]},
    {name:'Second',machines:[object('a',9),object('b',12)],rules:[['a','b',5]]}
  ]});
}
function assertShared(state,expected) {
  for(const items of [state.catalog,state.machines,...state.teams.map(t=>t.machines)])
    assert.deepEqual(ids(items),[...expected].sort());
  for(const t of state.teams) assert.equal(t.score,model.evaluate(t.machines,t.rules).score);
}
test('migrates legacy custom objects without dropping saved positions',()=>{
  const state=model.migrate({machines:[object('a')],rules:[],teams:[
    {name:'Older',machines:[object('a',12),object('custom',20)],rules:[['a','custom',3]]}
  ]});
  assertShared(state,['a','custom']);
  assert.equal(state.teams[0].machines.find(a=>a.id==='a').x,12);
  assert.equal(state.teams[0].machines.find(a=>a.id==='custom').x,20);
});
test('adding affects every layout while preserving existing positions and weights',()=>{
  const before=seed(),next=model.addObject(before,object('new'));
  assertShared(next,['a','b','new']);
  assertShared(before,['a','b']);
  before.teams.forEach((t,i)=>{
    for(const a of t.machines) {
      const placed=next.teams[i].machines.find(b=>b.id===a.id);
      assert.equal(placed.x,a.x);assert.equal(placed.y,a.y);
    }
    assert.deepEqual(next.teams[i].rules,t.rules);
  });
});
test('removal prunes every layout and its weights, including after reload and reset',()=>{
  let state=model.addObject(seed(),object('new'));
  state=model.removeObject(state,'a');
  state=model.synchronize(roundTrip(state));
  assertShared(state,['b','new']);
  assert.deepEqual(state.rules,[]);
  assert.ok(state.teams.every(t=>t.rules.length===0));
  assert.deepEqual(ids(model.normalizeMachines(state.catalog,[object('a'),object('b')])),['b','new']);
});
test('removing the final object remains empty after serialization',()=>{
  let state=seed();
  for(const id of ['a','b'])state=model.removeObject(state,id);
  assertShared(model.synchronize(roundTrip(state)),[]);
  assert.equal(model.evaluate(state.machines,state.rules).score,0);
  assertShared(model.addObject(state,object('first')),['first']);
});
test('a crowded saved layout still receives a new object and exposes its conflict',()=>{
  const state=model.migrate({machines:[object('blocker')],rules:[],teams:[{
    name:'Full',machines:[{...object('blocker',0,0),w:32.75,h:34.083}],rules:[]
  }]});
  const next=model.addObject(state,object('new'));
  assertShared(next,['blocker','new']);
  assert.ok(model.evaluate(next.teams[0].machines,[]).bad.has('new'));
});
test('restored imported layout retains its original score',()=>{
  assert.equal(model.evaluate(imported.machines,imported.rules).score,55);
});

// Run the actual event handlers and persistence against a small DOM adapter.
function boot(entries=new Map(),failWrites=false) {
  const elements=new Map();
  const make=()=>({value:'',checked:true,hidden:false,disabled:false,innerHTML:'',textContent:'',children:[],
    setAttribute(){},append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},reset(){}});
  const get=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id)};
  const context=vm.createContext({structuredClone,console,setInterval,clearInterval,
    document:{getElementById:get,createElement:make,querySelectorAll:()=>[],activeElement:{tagName:'BODY'}},
    window:{addEventListener(){}},
    localStorage:{getItem:k=>entries.has(k)?entries.get(k):null,setItem:(k,v)=>{
      if(failWrites)throw Error('QuotaExceededError');entries.set(k,v);
    }}
  });
  vm.runInContext(modelSource,context);vm.runInContext(appSource,context);
  return {entries,get,run:code=>vm.runInContext(code,context),state:()=>JSON.parse(vm.runInContext('JSON.stringify(currentState())',context))};
}
function addViaForm(page,name='New instrument') {
  page.get('placard-name').value=name;page.get('placard-width').value='1';page.get('placard-depth').value='1';
  page.get('placard-tabletop').checked=false;
  page.get('placard-form').onsubmit({preventDefault(){}});
}
test('UI add/remove, save/load, undo and reload use one shared inventory',()=>{
  const page=boot();
  addViaForm(page);
  const added=page.state().catalog.find(a=>a.name==='New instrument').id;
  const expected=[...imported.machines.map(a=>a.id),added];
  assertShared(page.state(),expected);
  page.get('team').value='Second layout';page.get('save').onclick();
  page.run('loadTeam(teams[0])');
  assertShared(page.state(),expected);
  page.run("selected='sem'");page.get('remove-object').onclick();
  assertShared(page.state(),expected.filter(id=>id!=='sem'));
  page.get('undo').onclick();
  assertShared(page.state(),expected);
  page.run("selected='sem'");page.get('remove-object').onclick();
  page.get('reset').onclick();
  const reloaded=boot(page.entries);
  assertShared(reloaded.state(),expected.filter(id=>id!=='sem'));
  reloaded.run('loadTeam(teams[1])');
  assertShared(reloaded.state(),expected.filter(id=>id!=='sem'));
});
test('UI handles deleting every object and adding to an empty inventory',()=>{
  const page=boot();
  for(const a of page.state().catalog){page.run('selected='+JSON.stringify(a.id));page.get('remove-object').onclick();}
  assertShared(page.state(),[]);
  assert.equal(page.get('remove-object').disabled,true);
  const reloaded=boot(page.entries);
  assertShared(reloaded.state(),[]);
  reloaded.get('reset').onclick();assertShared(reloaded.state(),[]);
  addViaForm(reloaded,'First object');
  assert.equal(reloaded.state().catalog.length,1);
  assert.equal(reloaded.state().machines[0].name,'First object');
  assertShared(reloaded.state(),[reloaded.state().machines[0].id]);
});
test('failed persistence cannot apply only part of a global removal',()=>{
  const page=boot(new Map(),true),before=page.state();
  page.run("selected='sem'");page.get('remove-object').onclick();
  assert.deepEqual(page.state(),before);
  assert.match(page.get('status').textContent,/could not be saved/);
});
test('legacy migration retains originals and does not revive deleted objects',()=>{
  const legacyTeams=JSON.stringify([{name:'Old',machines:[...imported.machines,object('legacy_custom')],rules:imported.rules}]);
  const entries=new Map([['cliffTeams',legacyTeams]]),page=boot(entries);
  assert.ok(page.state().machines.some(a=>a.id==='legacy_custom'));
  page.run("selected='legacy_custom'");page.get('remove-object').onclick();
  assert.equal(entries.get('cliffTeams'),legacyTeams);
  assert.ok(!boot(entries).state().catalog.some(a=>a.id==='legacy_custom'));
});
test('unreadable saved data is preserved rather than overwritten',()=>{
  const entries=new Map([['cliffTeams','not valid JSON']]);const page=boot(entries);
  assert.equal(entries.get('cliffTeams'),'not valid JSON');
  assert.equal(entries.has('cliffLayoutsV8'),false);
  assert.equal(page.get('add-object').disabled,true);
  assert.equal(page.get('save').disabled,true);
});

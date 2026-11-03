/* Shared object membership; layouts retain their own placement and weights. */
(function(root) {
  'use strict';
  const copy = value => structuredClone(value);
  const table = {x:13,y:8.6,w:4.92,h:16};
  const obstacles = [
    {x:0,y:5,w:2.33,h:2.25}, {x:0,y:31.75,w:2.25,h:2.33},
    {x:30.75,y:0,w:2,h:9}, {x:29.5,y:15.8,w:3.17,h:2},
    {x:13.375,y:31.083,w:6,h:3}
  ];
  function validMachines(items) {
    return Array.isArray(items) && items.every(a => a && typeof a.id === 'string' &&
      /^[a-zA-Z0-9_-]+$/.test(a.id) && typeof a.name === 'string' && a.name.length > 0 &&
      ['x','y','w','h'].every(k => Number.isFinite(a[k])) && a.w > 0 && a.h > 0) &&
      new Set(items.map(a => a.id)).size === items.length;
  }
  function validRules(items, machines) {
    const ids = new Set(machines.map(a => a.id));
    return (Array.isArray(items) ? items : []).filter(r => Array.isArray(r) &&
      ids.has(r[0]) && ids.has(r[1]) && r[0] !== r[1] &&
      Number.isFinite(r[2]) && r[2] >= 0 && r[2] <= 100).map(r => [...r]);
  }
  function overlap(a,b) {
    return a.x < b.x+b.w-.02 && a.x+a.w > b.x+.02 &&
      a.y < b.y+b.h-.02 && a.y+a.h > b.y+.02;
  }
  function findSpace(placard, occupied) {
    const left = placard.table ? table.x : 0, top = placard.table ? table.y : 0;
    const right = placard.table ? table.x+table.w : 32.75;
    const bottom = placard.table ? table.y+table.h : 34.083;
    for (let y=top; y+placard.h<=bottom+.001; y+=.25) {
      for (let x=left; x+placard.w<=right+.001; x+=.25) {
        const candidate = {...placard,x,y};
        if (!occupied.some(a => overlap(candidate,a)) &&
            !obstacles.some(a => overlap(candidate,a)) &&
            (placard.table || !overlap(candidate,table))) return candidate;
      }
    }
    return null;
  }
  function normalizeMachines(catalog, placements) {
    const existing = new Map(placements.map(a => [a.id,a]));
    const result = new Map();
    // Reserve every existing placement before finding space for new objects.
    for (const item of catalog) {
      const old = existing.get(item.id);
      if (old) result.set(item.id, {...copy(item),...copy(old),name:item.name,
        table:item.table,note:item.note,custom:item.custom});
    }
    const occupied = [...result.values()];
    for (const item of catalog) {
      if (result.has(item.id)) continue;
      // A full layout still receives the object; its ordinary conflict warning
      // makes the required repositioning visible instead of omitting it.
      const placed = findSpace(item,occupied) || copy(item);
      result.set(item.id,placed);
      occupied.push(placed);
    }
    return catalog.map(a => result.get(a.id));
  }
  function evaluate(machines,rules) {
    const bad = new Set(), byId = new Map(machines.map(a => [a.id,a]));
    machines.forEach((a,i) => {
      if (a.x<0 || a.y<0 || a.x+a.w>32.76 || a.y+a.h>34.093 ||
          obstacles.some(b => overlap(a,b))) bad.add(a.id);
      if (a.table) {
        if (a.x<table.x || a.y<table.y || a.x+a.w>table.x+table.w+.01 ||
            a.y+a.h>table.y+table.h+.01) bad.add(a.id);
      } else if (overlap(a,table)) bad.add(a.id);
      machines.slice(i+1).forEach(b => {if(overlap(a,b)){bad.add(a.id);bad.add(b.id);}});
    });
    const active = validRules(rules,machines);
    const total = active.reduce((sum,r) => sum+r[2],0);
    const raw = total ? active.reduce((sum,[a,b,w]) => {
      a=byId.get(a); b=byId.get(b);
      const distance=Math.hypot(a.x+a.w/2-b.x-b.w/2,a.y+a.h/2-b.y-b.h/2);
      return sum+w*Math.max(0,1-distance/35);
    },0)/total*100 : 0;
    return {bad,score:Math.max(0,Math.round(raw-bad.size*8))};
  }
  function synchronize(state) {
    if (!state || !validMachines(state.catalog) || !validMachines(state.machines) ||
        !Array.isArray(state.teams) || state.teams.some(t => !t || !validMachines(t.machines)))
      throw Error('Saved layouts could not be read. Their stored data has been kept unchanged.');
    const next=copy(state);
    next.version=8;
    next.machines=normalizeMachines(next.catalog,next.machines);
    next.rules=validRules(next.rules,next.machines);
    next.teams=next.teams.map(t => {
      const machines=normalizeMachines(next.catalog,t.machines);
      const rules=validRules(t.rules,machines);
      return {...t,version:3,machines,rules,score:evaluate(machines,rules).score};
    });
    return next;
  }
  function migrate({machines,rules,teams}) {
    if (!validMachines(machines) || !Array.isArray(teams) ||
        teams.some(t => !t || !validMachines(t.machines)))
      throw Error('Saved layouts could not be read. Their stored data has been kept unchanged.');
    const catalog=[],seen=new Set();
    // Keep custom objects from older layouts too. Only the first migration
    // unions old records; later loads obey the persisted shared catalog.
    for (const items of [machines,...teams.map(t => t.machines)]) {
      for (const item of items) if (!seen.has(item.id)) {
        catalog.push(copy(item)); seen.add(item.id);
      }
    }
    return synchronize({version:8,catalog,machines,rules,teams});
  }
  function addObject(state,item) {
    if (!validMachines([item]) || state.catalog.some(a => a.id===item.id))
      throw Error('This object could not be added.');
    const placed=findSpace(item,state.machines);
    if (!placed) throw Error('No clear space for that footprint. Move objects or try smaller dimensions.');
    const next=copy(state);
    next.catalog.push(placed);
    next.machines.push(copy(placed));
    return synchronize(next);
  }
  function removeObject(state,id) {
    const next=copy(state);
    next.catalog=next.catalog.filter(a => a.id!==id);
    return synchronize(next);
  }
  function renameObject(state,id,name) {
    const next=copy(state), item=next.catalog.find(a => a.id===id);
    if (!item || !name.trim()) throw Error('Enter an object name.');
    item.name=name.trim().slice(0,40);
    return synchronize(next);
  }
  const api={validMachines,validRules,overlap,findSpace,normalizeMachines,evaluate,
    synchronize,migrate,addObject,removeObject,renameObject,table,obstacles};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.LabLayouts=api;
})(globalThis);

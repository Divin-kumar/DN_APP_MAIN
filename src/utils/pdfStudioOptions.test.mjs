import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePdfStudioOptions, pdfStudioTaskSections, PDF_TEMPLATES } from './pdfStudioOptions.js';

test('Phase 6 Studio chooses compatible Journal Diary and Tasks templates without altering source', () => {
  const source = { template: 'diary', density: 'compact', includeCover: true, includeCompleted: false };
  const snap = JSON.stringify(source);
  const selected = normalizePdfStudioOptions(source, 'journey');
  assert.equal(selected.template,'diary');
  assert.equal(selected.density,'compact');
  assert.equal(selected.includeCover,true);
  assert.equal(selected.includeCompleted,false);
  assert.equal(JSON.stringify(source),snap);
  assert.deepEqual(PDF_TEMPLATES.map(x=>x.label),['Journal','Diary','Tasks']);
  assert.equal(normalizePdfStudioOptions({},'journey').includeCover,true);
  assert.equal(normalizePdfStudioOptions({},'chronicle').includeCover,false);
  assert.equal(normalizePdfStudioOptions({template:'invalid', density:'invalid'},'diary').template,'diary');
});

test('Phase 6 Tasks PDF sections preserve required order and optional cancelled/completed visibility',()=>{
  const groups=[
    {status:'in-progress',entries:[{id:'a'}]},
    {status:'completed',entries:[{id:'b'}]},
    {status:'cancelled',entries:[{id:'c'}]},
  ];
  const hidden=pdfStudioTaskSections(groups,{includeCompleted:false,includeCancelled:false});
  assert.deepEqual(hidden.map(g=>g.status),['in-progress']);
  const visible=pdfStudioTaskSections(groups,{includeCompleted:true,includeCancelled:true});
  assert.deepEqual(visible.map(g=>g.status),['in-progress','completed','cancelled']);
  visible[0].entries.push({id:'external'});
  assert.equal(groups[0].entries.length,1,'source groups remain unchanged');
});

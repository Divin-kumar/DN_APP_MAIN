import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePdfStudioOptions, pdfStudioTaskSections, PDF_TEMPLATES, hasRoomForSinglePdfPhoto } from './pdfStudioOptions.js';

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

test('Phase 6 Tasks PDF sections preserve required order and completed visibility while excluding cancelled',()=>{
  const groups=[
    {status:'in-progress',entries:[{id:'a'}]},
    {status:'completed',entries:[{id:'b'}]},
    {status:'cancelled',entries:[{id:'c'}]},
  ];
  const hidden=pdfStudioTaskSections(groups,{includeCompleted:false,includeCancelled:false});
  assert.deepEqual(hidden.map(g=>g.status),['in-progress']);
  const visible=pdfStudioTaskSections(groups,{includeCompleted:true,includeCancelled:true});
  assert.deepEqual(visible.map(g=>g.status),['in-progress','completed']);
  visible[0].entries.push({id:'external'});
  assert.equal(groups[0].entries.length,1,'source groups remain unchanged');
});

test('a lone image can use a page with 40 percent of its writing height available', () => {
  const writingHeight = 842 - 51 - 43;
  assert.equal(hasRoomForSinglePdfPhoto(writingHeight * .4, writingHeight), true);
  assert.equal(hasRoomForSinglePdfPhoto(writingHeight * .399, writingHeight), false);
  assert.equal(hasRoomForSinglePdfPhoto(0, writingHeight), false);
  assert.equal(hasRoomForSinglePdfPhoto(Number.NaN, writingHeight), false);
});

test('date-based PDF breaks are independent from per-Activity breaks and never rewrite options', () => {
  const source = { template: 'journey', pageBreakBetweenDays: true };
  const before = JSON.stringify(source);
  const journal = normalizePdfStudioOptions(source, 'journey');
  assert.equal(journal.pageBreakBetweenDays, true);
  assert.equal(journal.pageBreakBetweenActivities, false);
  assert.equal(normalizePdfStudioOptions({ template: 'diary', pageBreakBetweenDays: true }).pageBreakBetweenDays, true);
  assert.equal(normalizePdfStudioOptions({ template: 'chronicle', pageBreakBetweenDays: true }).pageBreakBetweenDays, false);
  assert.equal(normalizePdfStudioOptions({ pageBreakBetweenDays: true, pageBreakBetweenActivities: true }).pageBreakBetweenDays, false);
  assert.equal(normalizePdfStudioOptions({ pageBreakBetweenActivities: true }).pageBreakBetweenActivities, true);
  assert.equal(normalizePdfStudioOptions({}).pageBreakBetweenDays, false);
  assert.equal(JSON.stringify(source), before);
});

test('PDF page theme is explicit and defaults safely to light', () => {
  assert.equal(normalizePdfStudioOptions({ colorMode:'dark' }).colorMode,'dark');
  assert.equal(normalizePdfStudioOptions({}).colorMode,'light');
  assert.equal(normalizePdfStudioOptions({ colorMode:'unknown' }).colorMode,'light');
});

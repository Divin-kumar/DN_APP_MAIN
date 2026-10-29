import test from 'node:test';
import assert from 'node:assert/strict';
import { sortMoments } from './userListSort.js';
import { sortTransactions, transactionPayload, toTransactions } from './transactionFilters.js';
import { normalizeFinancialRecord } from './financialRecords.js';
import { normalizeActivityExpense } from './transactionRelations.js';
import { getUserFilterFields } from './userFilterSchema.js';
import { compileConditionGroup } from './conditionEngine.js';
import { createBackupDocument, buildEventGroupsFromBackup } from '../services/backupService.js';
import { DEFAULT_CODE_LISTS } from './codeLists.js';

const entries = () => [
  { id:'late', name:'Evening', date:'2026-10-29', time:'18:30', amount:20 },
  { id:'untimed', name:'Untimed', date:'2026-10-29', amount:30 },
  { id:'early', name:'Morning', date:'2026-10-29', time:'07:20', amount:10 },
];
test('Moments and transactions sort filtered whole-day results by time, leaving untimed records last in both directions', () => {
  const input=entries(), copy=structuredClone(input), transactions=toTransactions([], input);
  for(const [direction, expected] of [['asc',['early','late','untimed']],['desc',['late','early','untimed']]]) {
    assert.deepEqual(sortMoments(input,'date',direction).map(x=>x.id),expected);
    assert.deepEqual(sortTransactions(transactions,`date-${direction}`).map(x=>x.id),expected);
  }
  for(const scope of ['moments','transactions','moment-transactions:m:all']) {
    const fields=getUserFilterFields(scope,input);
    const group={kind:'group',join:'AND',children:[{kind:'rule',id:'day',field:'date',operator:'eq',value:'2026-10-29'}]};
    assert.equal(input.filter(compileConditionGroup(group,fields)).length,3);
    group.children.push({kind:'rule',id:'clock',field:'time',operator:'eq',value:'07:20'});
    assert.deepEqual(input.filter(compileConditionGroup(group,fields)).map(x=>x.id),['early']);
  }
  assert.deepEqual(input,copy);
});
test('income, expense and nested mirrors preserve saved times and explicit clears without adding clocks to old records', () => {
  for(const kind of ['income','expense']) {
    assert.equal(normalizeFinancialRecord({time:'7:20'},kind).time,'07:20');
    assert.equal(Object.hasOwn(normalizeFinancialRecord({},kind),'time'),false);
    assert.equal(normalizeFinancialRecord({time:'',dueTime:'07:20'},kind).time,'');
  }
  assert.equal(normalizeActivityExpense({time:'18:30'}).time,'18:30');
  const form={transactionKind:'expense',title:'Purchase',paymentMethod:'Cash',category:'Other',amount:10,date:'2026-10-29'};
  assert.equal(Object.hasOwn(transactionPayload(form),'time'),false);
  assert.equal(transactionPayload({...form,time:'00:00'}).time,'00:00');
  assert.equal(transactionPayload({...form,time:''},{original:{time:'08:00'}}).time,'');
  assert.equal(transactionPayload(form,{original:{time:'08:00'}}).time,'08:00');
});
test('backup v3 preserves Moment and transaction clocks alongside untouched untimed records', () => {
  const backup=createBackupDocument({moments:entries().map(x=>({...x,activities:[]})), expenses:entries(),incomes:[{id:'income',time:'00:00',amount:50}],codeLists:DEFAULT_CODE_LISTS});
  const restored=buildEventGroupsFromBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(backup.backupVersion,3);
  assert.equal(restored.find(x=>x.id==='early').time,'07:20');
  assert.equal(Object.hasOwn(restored.find(x=>x.id==='untimed'),'time'),false);
  assert.equal(backup.expenses.find(x=>x.id==='late').time,'18:30');
  assert.equal(backup.incomes[0].time,'00:00');
});

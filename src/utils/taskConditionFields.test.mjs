import test from 'node:test';
import assert from 'node:assert/strict';
import { compileConditionGroup, emptyGroup } from './conditionEngine.js';
import { taskDueWindow, taskFilterFields, taskViewConditionGroup } from './taskConditionFields.js';
import { filterTaskResults } from './taskListFilters.js';
import { sortIndependentTasks } from './independentTasks.js';

const tasks = [
  { id:'overdue', title:'Renew passport', notes:'Apply online', status:'in-progress',
    priority:'high', dueDate:'2026-11-01', momentId:'m1', activityId:'a1', createdAt:'2026-10-01T08:30:00Z' },
  { id:'today', title:'Call doctor', notes:'', status:'in-progress',
    priority:'medium', dueDate:'2026-11-03', momentId:'', activityId:'', createdAt:'2026-10-02T08:30:00Z' },
  { id:'week', title:'Book tickets', notes:'With family', status:'in-progress',
    priority:'low', dueDate:'2026-11-07', momentId:'m1', activityId:'', createdAt:null },
  { id:'late', title:'Archive receipts', notes:'', status:'completed',
    priority:'medium', dueDate:'2026-11-02', momentId:'', activityId:'', completedAt:'2026-11-02T11:00:00Z' },
  { id:'undated', title:'Organise notes', notes:'Keep copies', status:'cancelled',
    priority:'high', dueDate:'', momentId:'', activityId:'' },
];
const moments=[{id:'m1',name:'Family trip'}];
const rule=(field,value,operator='eq')=>({id:'r-'+field,kind:'rule',field,operator,value});
const group=(...children)=>({...emptyGroup(),children});
const select=(filterGroup)=>filterTaskResults(tasks,{search:'',group:filterGroup,status:'all',priority:'all',due:'all'},'2026-11-03',moments).map(x=>x.id);

test('Task due presets classify active, closed and undated without changing Tasks',()=>{
  assert.deepEqual(taskDueWindow(tasks[1],'2026-11-03'),['today','next7','next30']);
  assert.equal(taskDueWindow(tasks[0],'2026-11-03'),'overdue');
  assert.deepEqual(taskDueWindow(tasks[2],'2026-11-03'),['next7','next30']);
  assert.equal(taskDueWindow(tasks[3],'2026-11-03'),'closed');
  assert.equal(taskDueWindow(tasks[4],'2026-11-03'),'undated');
  assert.deepEqual(select(group(rule('dueWindow','next7'))),['today','week']);
  assert.deepEqual(select(group(rule('dueWindow','overdue'))),['overdue']);
  assert.deepEqual(select(group(rule('dueWindow','undated'))),['undated']);
});
test('shared Task filters combine Status Priority Moment and rich notes safely',()=>{
  assert.deepEqual(select(group(rule('status','in-progress'),rule('priority','high'))),['overdue']);
  assert.deepEqual(select(group(rule('momentId','m1'))),['overdue','week']);
  assert.deepEqual(select(group(rule('linkType','standalone'))),['today','late','undated']);
  assert.deepEqual(select(group(rule('linkType','activity'))),['overdue']);
  assert.deepEqual(select(group(rule('notes','','not_empty'))),['overdue','week','undated']);
  assert.deepEqual(select(group(rule('title','call','contains'))),['today']);
  assert.deepEqual(select(group(rule('dueDate',['2026-11-01','2026-11-03'],'between'))),['overdue','today','late']);
  assert.equal(taskFilterFields(tasks,moments,'2026-11-03').length,12);
});
test('legacy saved Task shortcuts are converted to removable chip rules with AND preserved',()=>{
  const old={status:'in-progress',priority:'high',due:'overdue'};
  const upgraded=taskViewConditionGroup(old);
  assert.equal(upgraded.join,'AND');
  assert.equal(upgraded.children.length,3);
  assert.deepEqual(select(upgraded),['overdue']);
  const withOr=taskViewConditionGroup({ status:'in-progress',
    group:{...emptyGroup(),join:'OR',children:[rule('title','Call doctor'),rule('title','Archive receipts')]} });
  assert.equal(withOr.join,'AND');
  assert.equal(withOr.children[0].join,'OR');
  assert.deepEqual(select(withOr),['today']);
  assert.deepEqual(old,{status:'in-progress',priority:'high',due:'overdue'});
});
test('Task sort by status, priority and timestamp is deterministic with missing dates last',()=>{
  assert.deepEqual(sortIndependentTasks(tasks,'asc','priority').map(x=>x.id),['overdue','undated','today','late','week']);
  assert.deepEqual(sortIndependentTasks(tasks,'asc','createdAt').slice(0,2).map(x=>x.id),['overdue','today']);
  assert.equal(sortIndependentTasks(tasks,'asc','createdAt').at(-1).createdAt == null,true);
  assert.deepEqual(sortIndependentTasks(tasks,'desc','status').map(x=>x.status),
    ['cancelled','completed','in-progress','in-progress','in-progress']);
});
test('rule evaluator handles the same AND/OR semantics as other Refine sheets',()=>{
  const schema=taskFilterFields(tasks,moments,'2026-11-03');
  const condition={...emptyGroup(),join:'OR',children:[rule('priority','high'),rule('status','completed')]};
  assert.deepEqual(tasks.filter(compileConditionGroup(condition,schema)).map(x=>x.id),['overdue','late','undated']);
});

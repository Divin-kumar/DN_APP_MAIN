import test from 'node:test';
import assert from 'node:assert/strict';
import { activityTime, normalizeActivityTime, compareActivityDateTime } from './activityTime.js';
import { sortedSummaryActivities } from './summaryAttachments.js';
import { projectActivities, selectActivityEntries } from './activityRecords.js';
import { buildMomentStory, groupMomentStoryTasks } from './momentStory.js';
import { getUserFilterFields } from './userFilterSchema.js';
import { createBackupDocument, buildEventGroupsFromBackup } from '../services/backupService.js';
import { DEFAULT_CODE_LISTS } from './codeLists.js';
const fixture = () => [{ id:'late', title:'Late', date:'2026-10-01', time:'18:30', completed:true },
  { id:'unknown', title:'No time', date:'2026-10-01', createdAt:'2026-10-01T02:00:00Z', completed:true },
  { id:'early', title:'Early', date:'2026-10-01', time:'07:20', completed:true },
  { id:'equal', title:'Equal', date:'2026-10-01', time:'07:20', completed:true }];
test('clock parsing validates midnight, invalid historical values and explicit clearing of legacy aliases', () => {
  assert.equal(normalizeActivityTime('0:00'), '00:00');
  for (const value of ['24:00','12:60','1:2','10:10:99',null,{},'']) assert.equal(normalizeActivityTime(value), '');
  assert.equal(activityTime({ dueTime:'7:20' }), '07:20');
  assert.equal(activityTime({ time:'', dueTime:'07:20' }), '');
  assert.equal(activityTime({ createdAt:'2026-10-01T07:20:00Z' }), '');
});
test('shared Story and global list chronology keeps unknowns last, stable equal times and no record mutation', () => {
  const activities=fixture(), before=structuredClone(activities);
  assert.deepEqual(sortedSummaryActivities(activities).map(x=>x.id), ['early','equal','late','unknown']);
  const entries=projectActivities([{id:'m',activities}]);
  assert.deepEqual(selectActivityEntries(entries,{direction:'desc'}).map(x=>x.activity.id), ['late','early','equal','unknown']);
  assert.equal(compareActivityDateTime({date:''},{date:'2026-10-01'},'desc'),1);
  const story=buildMomentStory({id:'m',activities}, {now:new Date(2026,9,29)});
  assert.deepEqual(story.timeline[0].days[0].entries.map(x=>[x.id,x.displayTime]), [['early','07:20'],['equal','07:20'],['late','18:30'],['unknown','']]);
  assert.deepEqual(groupMomentStoryTasks(story).find(x=>x.status==='completed').entries.map(x=>x.id), ['early','equal','late','unknown']);
  assert.deepEqual(activities,before);
});
test('Time catalogue covers every editable date and keeps whole-day Date conditions separate', () => {
  const activities=fixture();
  const field=getUserFilterFields('moment-activities:m',activities,[]).find(x=>x.path==='time');
  assert.equal(field.type,'dropdown');assert.equal(field.readValue(activities[0]),'18:30');
  for (const scope of ['moments', 'transactions', 'moment-transactions:m:all']) assert.equal(getUserFilterFields(scope,[],[]).some(x=>x.path==='time'),true);
});
test('backup v3 retains explicit times and old untimed activities without inventing a time', () => {
  const activities=fixture();
  const backup=createBackupDocument({moments:[{id:'m',name:'Day',activities}],codeLists:DEFAULT_CODE_LISTS});
  const restored=buildEventGroupsFromBackup(JSON.parse(JSON.stringify(backup)))[0];
  assert.equal(backup.backupVersion,3);
  assert.equal(restored.activities.find(x=>x.id==='early').time,'07:20');
  assert.equal(Object.hasOwn(restored.activities.find(x=>x.id==='unknown'),'time'),false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactTaskRefineGroup } from './taskConditionFields.js';
import { conditionCount } from './conditionEngine.js';

test('Task Refine removes only inactive saved placeholders without modifying source',()=>{
  const previous={id:'root',kind:'group',join:'AND',children:[
    {id:'blank-field',kind:'rule',field:'',operator:'contains',value:''},
    {id:'blank-value',kind:'rule',field:'status',operator:'eq',value:''},
    {id:'active',kind:'rule',field:'status',operator:'eq',value:'completed'},
    {id:'group',kind:'group',join:'OR',children:[
      {id:'blank-nested',kind:'rule',field:'notes',operator:'contains',value:''},
      {id:'active-nested',kind:'rule',field:'dueDate',operator:'empty',value:''},
    ]},
  ]};
  const before=JSON.stringify(previous);
  const next=compactTaskRefineGroup(previous);
  assert.equal(conditionCount(next),2);
  assert.equal(next.children.length,2);
  assert.equal(next.children[0].id,'active');
  assert.equal(next.children[1].children[0].id,'active-nested');
  assert.equal(JSON.stringify(previous),before);
  assert.deepEqual(compactTaskRefineGroup({id:'root',kind:'group',join:'AND',children:[previous.children[0]]}).children,[]);
});

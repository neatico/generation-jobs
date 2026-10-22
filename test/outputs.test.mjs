import test from 'node:test';
import assert from 'node:assert/strict';
import {runRecoverableOutputs} from '../dist/index.js';
const outputs=['a','b','c'].map(key=>({key,input:key}));
test('one failure preserves other outputs and retry only runs missing work',async()=>{
 const completed={},calls=[],checkpoints=[];
 const failures=await runRecoverableOutputs({outputs,completed,run:async key=>{calls.push(key);if(key==='b')throw Error('busy');return key;},settled:async()=>{checkpoints.push({...completed});}});
 assert.deepEqual(Object.keys(failures),['b']);assert.deepEqual(completed,{a:'a',c:'c'});assert.equal(checkpoints.length,3);
 await runRecoverableOutputs({outputs,completed,run:async key=>{calls.push(key);return key;},settled:async()=>{}});
 assert.deepEqual(calls,['a','b','c','b']);assert.deepEqual(completed,{a:'a',c:'c',b:'b'});
});
test('checkpoint failure stops before the next output',async()=>{
 const completed={},calls=[];
 await assert.rejects(runRecoverableOutputs({outputs,completed,run:async key=>{calls.push(key);return key;},settled:async()=>{throw Error('quota');}}),/quota/);
 assert.deepEqual(calls,['a']);assert.deepEqual(completed,{a:'a'});
});
test('cancellation retains and checkpoints just-completed output',async()=>{
 let cancelled=false,stored=false;const completed={};
 await assert.rejects(runRecoverableOutputs({outputs,completed,isCancelled:()=>cancelled,run:async key=>{cancelled=true;return key;},settled:async()=>{stored=true;}}),{name:'AbortError'});
 assert.deepEqual(completed,{a:'a'});assert.equal(stored,true);
});
test('duplicate or prototype keys are rejected before running',async()=>{
 for(const keys of [['a','a'],['__proto__']])await assert.rejects(runRecoverableOutputs({outputs:keys.map(key=>({key,input:key})),completed:{},run:async()=>{throw Error('must not run');},settled:async()=>{}}),/INVALID_OUTPUT_KEYS/);
});

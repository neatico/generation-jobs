export interface Checkpoint<T> { version: 1; revision: number; updatedAt: number; value: T }
export interface AtomicCheckpointStorage {
 read(key: string): Promise<unknown>;
 update(key: string, change: (previous: unknown) => unknown): Promise<void>;
}
export class CheckpointError extends Error {
 constructor(public readonly code: 'CHECKPOINT_CONFLICT' | 'CHECKPOINT_INVALID' | 'CHECKPOINT_NOT_LOADED') {super(code);this.name='CheckpointError';}
}
/** A session owns one revision. Atomic compare-and-swap prevents stale tabs
 * from overwriting newer work. The host supplies its storage/auth boundary. */
export function createCheckpointSession<T>(storage: AtomicCheckpointStorage, key: string, accepts: (value: unknown) => value is T) {
 let revision: number | undefined;
 let queue: Promise<unknown> = Promise.resolve();
 const decode=(raw:unknown):Checkpoint<T>|undefined=>{
  if(raw===undefined)return;
  const record=raw as Partial<Checkpoint<T>>;
  if(!record||record.version!==1||!Number.isSafeInteger(record.revision)||record.revision!<1||typeof record.updatedAt!=='number'||!accepts(record.value))throw new CheckpointError('CHECKPOINT_INVALID');
  return record as Checkpoint<T>;
 };
 const ordered=<R>(action:()=>Promise<R>):Promise<R>=>{
  const next=queue.then(action,action);queue=next.catch(()=>{});return next;
 };
 return {
  load:()=>ordered(async()=>{const record=decode(await storage.read(key));revision=record?.revision||0;return record?.value;}),
  save:(value:T)=>{
   // Snapshot before waiting for earlier writes; callers may mutate their job.
   let snapshot:T;
   try { snapshot=(globalThis as unknown as {structuredClone:<V>(value:V)=>V}).structuredClone(value); }
   catch { return Promise.reject(new CheckpointError('CHECKPOINT_INVALID')); }
   if(!accepts(snapshot))return Promise.reject(new CheckpointError('CHECKPOINT_INVALID'));
   return ordered(async()=>{
    if(revision===undefined)throw new CheckpointError('CHECKPOINT_NOT_LOADED');
    const expected=revision;
    await storage.update(key,raw=>{
     const current=decode(raw);
     if((current?.revision||0)!==expected)throw new CheckpointError('CHECKPOINT_CONFLICT');
     return {version:1,revision:expected+1,updatedAt:Date.now(),value:snapshot} satisfies Checkpoint<T>;
    });
    revision=expected+1;
   });
  },
 };
}
export function checkpointKey(owner:string,workspace:string,kind:'presentation'|'social'):string {
 if(!owner||!workspace)throw new CheckpointError('CHECKPOINT_INVALID');
 return JSON.stringify(['neatico-generation-v1',owner,workspace,kind]);
}
export {runRecoverableOutputs} from './runOutputs.js';
export type {OutputRunOptions} from './runOutputs.js';

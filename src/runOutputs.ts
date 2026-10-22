export interface OutputRunOptions<T, R> {
 outputs: readonly {key: string; input: T}[];
 completed: Record<string, R>;
 run(input: T, key: string): Promise<R>;
 isCancelled?(): boolean;
 /** Called after each attempted output. A persistence failure stops the batch. */
 settled(key: string, error?: unknown): Promise<void>;
}
/** Sequential, bounded-memory output recovery. Failed outputs do not discard or
 * prevent unrelated successes. The caller owns persistence and retry policy. */
export async function runRecoverableOutputs<T, R>(options: OutputRunOptions<T, R>): Promise<Record<string, unknown>> {
 const keys = options.outputs.map(output => output.key);
 if (new Set(keys).size !== keys.length || keys.some(key => !key || ['__proto__','constructor','prototype'].includes(key))) throw new Error('INVALID_OUTPUT_KEYS');
 const failures: Record<string, unknown> = {};
 const checkCancelled = () => {if(options.isCancelled?.()){const error=new Error('OUTPUT_CANCELLED');error.name='AbortError';throw error;}};
 for (const {key,input} of options.outputs) {
  checkCancelled();
  if (Object.prototype.hasOwnProperty.call(options.completed,key)) continue;
  let error: unknown;
  try {
   const value=await options.run(input,key);
   // Preserve already finished work even if cancellation arrived concurrently.
   options.completed[key]=value;
  } catch (caught) {error=caught;failures[key]=caught;}
  await options.settled(key,error);
  checkCancelled();
 }
 return failures;
}

# @neatico/generation-jobs

Framework-free, typed recovery checkpoints. A host supplies an atomic storage adapter and runtime validator. No network, React, authentication or browser dependencies.

```ts
const session = createCheckpointSession(storage, checkpointKey(userId, workspaceId, 'social'), isSocialJob);
const previous = await session.load();
await session.save({input, outputs, requestId});
```

Persist before sending an external save. Reuse the request ID after response loss. Atomic `update` must read/check/write within a single transaction. Revision conflicts prevent stale tabs from destroying newer progress; present a reload/recovery action. All failures reject, including unavailable storage and invalid versions. The host must never claim recovery durability before the write resolves. Keep checkpoints scoped to the signed-in user/workspace; do not use this as an authorization mechanism. This stores progress, not a background AI worker. Browser storage can be cleared by users. Hosts define retention and removal policy.

Version 0.1 exports `Checkpoint`, `AtomicCheckpointStorage`, `CheckpointError`, `createCheckpointSession` and `checkpointKey`. Versioned envelopes reject incompatible state rather than guessing. Build supplies ESM, CJS and declarations. npm publishing is deferred; consume the local packed archive.

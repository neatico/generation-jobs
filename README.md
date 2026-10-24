<div align="center">
  <a href="https://www.neatico.com/?utm_source=npm&utm_medium=readme&utm_campaign=generation-jobs">
    <img src="https://www.neatico.com/brand/neatico-logo.svg" width="220" alt="Neatico" />
  </a>
  <h1>@neatico/generation-jobs</h1>
  <p>Versioned, conflict-aware checkpoints and recoverable batch execution for AI generation workflows.</p>
  <p>
    <a href="https://www.npmjs.com/package/@neatico/generation-jobs"><img src="https://img.shields.io/npm/v/@neatico/generation-jobs.svg?style=flat-square&label=npm" alt="npm version" /></a>
    <a href="https://github.com/neatico/generation-jobs"><img src="https://img.shields.io/badge/source-github-111827?style=flat-square" alt="source" /></a>
    <img src="https://img.shields.io/badge/license-MIT-10b981?style=flat-square" alt="license: MIT" />
    <img src="https://img.shields.io/badge/ESM%20%2B%20CJS-yes-6366f1?style=flat-square" alt="ESM and CJS" />
  </p>
</div>

---

`@neatico/generation-jobs` keeps long-running, multi-output generation work recoverable. It solves two problems that bite AI design tools:

1. **Two tabs editing the same job must not clobber each other.** Each session owns a revision; a stale tab that tries to save over newer work is rejected with a conflict.
2. **A batch with one failure must not lose every result.** Outputs run sequentially, each success is checkpointed, and a retry re-runs only the missing pieces.

The library is storage-agnostic and framework-free — you provide an atomic adapter and a runtime validator. There is no network, React, browser, or authentication dependency.

## Installation

```sh
npm install @neatico/generation-jobs
```

Ships as native ES modules, CommonJS, and TypeScript declarations. Requires Node.js 20+ (snapshots use `structuredClone`).

## Conflict-safe checkpoints

```ts
import {
  createCheckpointSession,
  checkpointKey,
  type AtomicCheckpointStorage,
} from "@neatico/generation-jobs";

// You supply the storage boundary. `update` must read/check/write
// inside one atomic transaction.
const store: AtomicCheckpointStorage = {
  async read(key) {
    return indexedDB.get(key);
  },
  async update(key, change) {
    return indexedDB.transaction(key, change); // compare-and-swap
  },
};

type SocialJob = { input: string; outputs: string[] };

const session = createCheckpointSession<SocialJob>(
  store,
  checkpointKey(userId, workspaceId, "social"),
  (value): value is SocialJob =>
    Boolean(value) && typeof (value as SocialJob).input === "string",
);

const draft = await session.load();   // undefined on first run
await session.save({ input: brief, outputs: ["cover"] });
```

Save snapshots the value synchronously with `structuredClone` before the async write, so queued saves preserve order and in-progress editing values such as `NaN` and `undefined` survive a refresh.

**Failure semantics — every failure rejects:**

- `CHECKPOINT_CONFLICT` — another session advanced the revision; reload before saving.
- `CHECKPOINT_NOT_LOADED` — `save` was called before a successful `load`.
- `CHECKPOINT_INVALID` — the stored envelope or the validator rejected the value.

A failed write does not advance the revision, so the same value can be retried after the storage quota clears.

## Recoverable batch runs

```ts
import { runRecoverableOutputs } from "@neatico/generation-jobs";

const outputs = ["cover", "card", "story"].map((key) => ({ key, input: brief }));

const completed: Record<string, Buffer> = {};

const failures = await runRecoverableOutputs({
  outputs,
  completed,
  async run(input, key) {
    return renderOne(input, key);   // one independent generation
  },
  isCancelled: () => cancelSignal.aborted,
  async settled(key, error) {
    if (error) return;             // failed outputs are reported, not saved
    await persistCheckpoint(completed);
  },
});

// failures -> { card: Error }  while cover and story stay in `completed`
```

Behavior guarantees:

- **Independent failures don't discard successes.** The returned map contains only the keys that failed; everything else is already in `completed`.
- **Retry runs only missing work.** Call again with the same `completed` map; successful outputs are skipped. Never reuse a map after the source or settings changed.
- **Cancellation keeps the latest result.** An aborted run still checkpoints the output that finished just before cancellation, then throws an `AbortError`.
- **Persistence failure stops the batch.** A rejected `settled` halts before the next output.
- **Duplicate or prototype-polluting keys are rejected up front** (`INVALID_OUTPUT_KEYS`).

## API reference

| Export | Purpose |
|---|---|
| `createCheckpointSession(storage, key, accepts)` | Returns `{ load, save }` bound to one revision. |
| `checkpointKey(owner, workspace, kind)` | Stable scoped key; `kind` is `"presentation"` or `"social"`. |
| `runRecoverableOutputs(options)` | Sequential, bounded-memory recovery over a list of outputs. |
| `CheckpointError` | Error with a machine-readable `code`. |
| `AtomicCheckpointStorage` | Interface: `read(key)` and atomic `update(key, change)`. |
| `OutputRunOptions<T, R>` | Options for `runRecoverableOutputs`. |

## Scope and responsibilities

This package stores **progress**, not a background worker. It is not an authorization boundary — keep keys scoped to the signed-in user and workspace, and enforce access on the storage layer. Retention, quotas, per-error UX, and the decision to retry or surface an error all belong to the host. Never report recovery as durable until the write resolves.

## Development

```sh
npm install
npm test        # builds ESM/CJS, then runs node:test suites
```

## Meet Neatico

This package is one of the engines inside **[Neatico](https://www.neatico.com/?utm_source=npm&utm_medium=readme&utm_campaign=generation-jobs)** — the AI workspace that turns a single idea into pixel-perfect, fully editable visuals. When Neatico generates a deck or a set of social cards, this checkpoint and recovery layer makes sure a network hiccup or a second tab never destroys finished work.

The `@neatico/*` packages are the framework-independent pieces extracted from that product so you can build your own editor or pipeline. Want the finished experience instead of the primitives? **[Start creating free on neatico.com →](https://www.neatico.com/?utm_source=npm&utm_medium=readme&utm_campaign=generation-jobs)**

## License

MIT. See [LICENSE](./LICENSE).

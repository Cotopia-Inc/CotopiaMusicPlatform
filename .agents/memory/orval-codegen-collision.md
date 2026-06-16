---
name: Orval codegen type collision
description: When a new endpoint has both path params and query params, Orval generates the same name in two places causing a duplicate-export TS error.
---

## The rule

After running `pnpm --filter @workspace/api-spec run codegen`, if a new endpoint has **both path params and query params**, Orval generates a `Get<OperationId>Params` TypeScript type in `lib/api-zod/src/generated/types/<name>.ts` AND a Zod schema with the same name in `lib/api-zod/src/generated/api.ts`. The barrel `lib/api-zod/src/index.ts` re-exports both, causing:

```
error TS2308: Module "./generated/api" has already exported a member named 'Get<OperationId>Params'.
```

## How to apply

The fix is now **automated** via `lib/api-spec/fix-zod-collisions.cjs`, which runs as part of the codegen script:

```
orval --config ./orval.config.ts && node ./fix-zod-collisions.cjs && pnpm -w run typecheck:libs
```

The script strips the known offending lines from `lib/api-zod/src/generated/types/index.ts` after every codegen run. Current collisions handled: `sendDirectMessageBody`, `getChatMessagesParams`.

If a new endpoint with both path AND query params adds a new collision, add its camelCase name to the `collisions` array in `lib/api-spec/fix-zod-collisions.cjs`.

The Zod schema in `api.ts` is the source of truth; the TypeScript type in `types/` is redundant.

**Why:** Orval's zod plugin and its types plugin both generate a `Params`/`Body` symbol for the same path when query params co-exist with path params. There is no Orval config flag to suppress this.

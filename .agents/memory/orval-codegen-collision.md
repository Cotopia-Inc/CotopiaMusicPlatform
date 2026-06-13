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

After codegen, open `lib/api-zod/src/generated/types/index.ts` and delete the lines:

```ts
export * from './getChatMessagesParams';
export * from './sendDirectMessageBody';
```

These two are the persistent offenders — they regenerate on every codegen run and must be removed each time. Additional `Params` types may appear when adding endpoints with both path AND query params; remove those too.

The Zod schema in `api.ts` is the source of truth; the TypeScript type in `types/` is redundant.

**Why:** Orval's zod plugin and its types plugin both generate a `Params` symbol for the same path when query params co-exist with path params. There is no Orval config flag to suppress this; the manual removal is the safest fix.

---
name: Cotopia cross-package zod extend
description: Why you cannot call .extend() on lib/api-zod schemas inside route files, and the correct workaround.
---

## Rule

Never call `UpdateAppSettingsBody.extend({...})` (or any `lib/api-zod`-generated schema `.extend()`) inside an `artifacts/api-server` route file. Define a standalone `z.object({...})` instead.

**Why:** Even though both `lib/api-zod` and route files import from `"zod/v4"`, the two workspace packages resolve to separate module instances. The `ZodOptional<ZodBoolean>` returned by `z.boolean().optional()` in the route file is structurally incompatible with the `ZodType<any, any, any>` shape expected by `.extend()` on a schema created in the lib package. TypeScript raises TS2740 (missing `_type`, `_parse`, `_getType`, etc.) and the route crashes at runtime.

**How to apply:** When a route needs to accept fields not covered by the generated schema (e.g. AI policy additions to `UpdateAppSettingsBody`), write a complete `z.object({...})` in the route file that includes both the existing fields and the new ones. This sidesteps the cross-package type boundary entirely.

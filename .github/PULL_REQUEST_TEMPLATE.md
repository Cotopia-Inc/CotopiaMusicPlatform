## Summary

<!-- Briefly describe what this PR does and why. -->

## Related Issue

<!-- Link any related issues: "Closes #123" or "Relates to #456" -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation update
- [ ] Chore (dependency, tooling, config)

## Checklist

- [ ] `pnpm run typecheck` passes with zero errors
- [ ] `pnpm --filter @workspace/api-server run test` passes
- [ ] If I changed the OpenAPI spec, I ran `pnpm --filter @workspace/api-spec run codegen`
- [ ] If I added a new DB column, I ran `pnpm --filter @workspace/db run push` and updated `replit.md`
- [ ] Error messages are user-friendly (no raw field names, stack traces, or HTTP prefixes)
- [ ] No `console.log` in server code (use `req.log` or `logger`)
- [ ] PR is focused — one feature or fix only

## Screenshots / Demo

<!-- Add screenshots or a short description of how to test this change, if applicable. -->

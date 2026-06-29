# Contributing to Cotopia

Thank you for your interest in contributing to Cotopia! This document covers everything you need to know before submitting a pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Guidelines](#development-guidelines)
- [Pull Request Process](#pull-request-process)
- [Commit Messages](#commit-messages)

---

## Code of Conduct

By participating in this project you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

---

## Getting Started

1. Fork the repository and clone your fork locally.
2. Follow the setup steps in [README.md](README.md) to get the project running.
3. Create a new branch from `main` for your work:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bug-fix
   ```

---

## How to Contribute

### Bug Reports

- Search existing issues before opening a new one.
- Use the **Bug Report** issue template.
- Include steps to reproduce, expected behavior, actual behavior, and your environment.

### Feature Requests

- Search existing issues and discussions first.
- Use the **Feature Request** issue template.
- Explain the problem you're solving, not just the solution you want.

### Code Contributions

- Keep pull requests focused — one feature or fix per PR.
- For large changes, open an issue first to discuss the approach.
- All PRs must pass the typecheck and test suite before review.

---

## Development Guidelines

### Contract-First API Development

The OpenAPI spec in `lib/api-spec/openapi.yaml` is the **source of truth**. When adding or changing an API endpoint:

1. Update `openapi.yaml` first.
2. Run codegen to regenerate hooks and schemas:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
3. Implement the route in `artifacts/api-server/src/routes/`.
4. Use the generated Zod schemas for input validation.
5. Use the generated React Query hooks in the frontend.

### TypeScript

- All code must be written in TypeScript with strict mode enabled.
- Run `pnpm run typecheck` before submitting. Zero type errors required.
- Do not use `any` unless absolutely unavoidable — add a comment explaining why.

### Database Changes

- Add new tables or columns to `lib/db/src/schema/`.
- Run `pnpm run typecheck:libs` after schema changes.
- Apply schema changes with `pnpm --filter @workspace/db run push`.
- Document new columns in `replit.md` under **Gotchas**.

### Logging

- **Never use `console.log` in server code.** Use `req.log` in route handlers and the singleton `logger` for non-request contexts.

### Error Messages

- All user-facing error messages must be plain English, friendly, and actionable.
- Do not expose internal field names, stack traces, or database details in error responses.

### Code Style

- Follow the existing patterns in the codebase.
- Run `pnpm run build` to catch any issues before submitting.
- Keep files focused — split large components into smaller ones.

---

## Pull Request Process

1. Ensure all checks pass:
   - `pnpm run typecheck` — zero errors
   - `pnpm --filter @workspace/api-server run test` — all tests pass
2. Fill out the pull request template completely.
3. Link any related issues in the PR description (`Closes #123`).
4. Request a review from a maintainer.
5. Address all review comments before the PR is merged.
6. Squash or clean up commits before merge if requested.

---

## Commit Messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

**Types:**

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Build, tooling, or dependency changes |
| `refactor` | Code changes that aren't features or fixes |
| `docs` | Documentation only changes |
| `test` | Adding or updating tests |

**Examples:**

```
feat(submissions): allow all authenticated users to submit content
fix(auth): use ilike for case-insensitive username duplicate check
chore(codegen): regenerate Zod schemas after OpenAPI update
docs: add CONTRIBUTING guide
```

---

## Questions?

Open a [GitHub Discussion](../../discussions) or reach out via the [Contact page](https://cotopia.com/contact) on the platform.

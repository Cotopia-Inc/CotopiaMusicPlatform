---
name: Hive AI detection response shapes
description: Hive returns two different response shapes depending on API version; both must be handled
---

## Rule
Always check BOTH response shapes when parsing Hive AI detection results.

**Shape A — nested (older):**
```json
{ "status": [{ "response": { "output": [{ "classes": [...] }] } }] }
```

**Shape B — flat (newer, seen Jul 2026):**
```json
{ "model": "hive/ai-generated-and-deepfake-content-detection", "output": [{ "classes": [...] }] }
```

Classes always use `"value"` (not `"score"`) as the numeric field:
```json
{ "class": "ai_generated", "value": 0.9978 }
{ "class": "not_ai_generated", "value": 0.0021 }
{ "class": "sora", "value": 0.0089 }
```

## How to apply
Use `responseObj?.["output"] ?? raw["output"]` for the output array lookup — already implemented in both `hive-detection.ts` (server) and `parseClassBreakdown` in `ai-review-card.tsx` (UI). Always accept both `cls.score` and `cls.value`.

**Why:** Hive silently changed their response envelope between API calls in production (Jul 2026). The nested shape was documented; the flat shape was not. Both appear in production scan history simultaneously.

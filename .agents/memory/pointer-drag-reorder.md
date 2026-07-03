---
name: Pointer-based drag reorder gotcha
description: Why per-element setPointerCapture fails for React-reordered lists, and how to build a reliable pointer-events drag-to-reorder interaction.
---

When implementing drag-to-reorder with raw Pointer Events (not native HTML5 DnD) on a list that visually re-sorts *during* the drag (live reorder preview), do not rely on per-element `setPointerCapture`.

**Why:** if the dragged item's position in the list changes mid-drag (e.g. because the array driving `.map()` was reordered based on cursor position), React unmounts/reinserts or repositions the DOM node. Browsers (Chromium included) silently release pointer capture when the capturing element is detached/reinserted, which kills the drag with no error — move events simply stop arriving.

**How to apply:**
- Add window-level `pointermove`/`pointerup`/`pointercancel` listeners in a `useEffect` keyed on the "currently dragging" id, instead of capturing on the element.
- Use refs (not just state) for the live order and dragged-id inside those listeners to avoid stale closures.
- Use a real `<button type="button">` for the drag handle (not a bare `<span>` with `aria-label`) — spans aren't reliably exposed as interactive/locatable elements to accessibility tooling or automated test agents, making the handle hard to target precisely. A `<button>` also needs `onClick={(e) => e.preventDefault()}` if it sits inside a clickable row, to avoid double-triggering row click behavior.
- Also double check any GET endpoint backing the list actually orders by the field you're reordering (e.g. a "feature order" column) — otherwise the write succeeds but the list never visually reflects it after a refetch, making a working drag look broken.

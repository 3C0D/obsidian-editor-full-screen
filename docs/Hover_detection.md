# Hover detection — how it works

## Overview

When full screen mode is active, UI elements (top bar, ribbon, status bar, sidebars) are hidden
by setting `height: 0` via CSS. They reappear when the mouse approaches the corresponding
viewport edge, and hide again when it moves away.

This is handled by `HoverDetector`, which listens to `mousemove` on `document` and computes
whether the cursor is inside or outside each side's exit zone on every frame.

---

## Why not mouseenter / mouseleave?

`mouseenter` and `mouseleave` fire on DOM elements. Once an element is hidden (`height: 0`),
it no longer occupies layout space and stops receiving mouse events. Any sentinel strategy
based on entering or leaving the element itself breaks the moment the element disappears.

An alternative would be to place fixed `position: fixed` sentinel divs at the viewport edges,
independent of the hidden elements. But they would need to be created, sized, repositioned on
window resize, and torn down when the mode is deactivated — significant DOM overhead.

`mousemove` on `document` fires regardless of what is visible. Combined with a pre-hide
snapshot of each element's position, it is simpler and more robust.

---

## Pre-hide snapshots

Before hiding any element, `hideManaged()` takes a `getBoundingClientRect()` snapshot of
each element and stores it in `preHideRects`. This must happen before any element is hidden,
because hiding one element can affect the layout of the others (the DOM recalculates live).

Once an element is hidden, its `getBoundingClientRect()` returns `height: 0` and an unreliable
`top`. The snapshot is the only source of truth for where the element was.

All coordinates are relative to the **Obsidian viewport** (the visible application window),
not the physical screen.

---

## getCombinedRect

`getCombinedRect(side)` computes a single bounding rect that wraps all managed elements
on the given side. This is the exit zone: the region the mouse must leave to trigger hiding.

It iterates over all elements on that side and expands a box:

- `left` and `top`: take the minimum (closest to the top-left corner).
- `right`: take the maximum (furthest right).
- `bottom`: reconstructed as `preHideTop + preHideHeight`, because there is no direct
  snapshot of the bottom edge, and `r.bottom` is `0` once the element is collapsed.

A live `getBoundingClientRect()` call (`r`) is still made on each iteration, but only used
as a fallback if no snapshot exists. This covers the defensive case where `getCombinedRect`
is called before `hideManaged()` has run — meaning the element is still visible and live
values are correct. In normal flow this does not happen.

---

## The reveal / hide cycle

```
1. activateMode()
      └─ hideManaged()
            ├─ snapshot all rects into preHideRects   (must happen before any hide)
            └─ add .hide-el to each element

2. mousemove fires on document (every cursor movement)
      └─ HoverDetector checks cursor position against getCombinedRect(side)
            ├─ cursor inside zone  → reveal elements on that side (showBySide)
            └─ cursor outside zone → hide elements on that side  (hideBySide)

3. deactivateMode()
      └─ showAllElements()
            └─ removes .hide-el from all elements, clears preHideRects
```

---

## Sentinel element

`mousemove` fires while the cursor moves inside the window. If the cursor enters the window
very quickly from outside (fast swipe toward the top edge), the first `mousemove` event may
already be several pixels below the threshold, missing the reveal condition entirely.

A thin transparent `div` (`position: fixed`, `top: 0`, `width: 100%`, height = `EDGE_THRESHOLD`)
is appended to the body when the mode activates. Its `mouseenter` event fires even when the
cursor jumps from outside the window straight into the strip, acting as a safety net for fast
entries.

When the top bar is revealed, the sentinel's `pointerEvents` is set to `none` so clicks pass
through to the actual UI. It is restored to `all` when the top bar hides again.

Both the sentinel `mouseenter` and `mousemove` can fire for the same entry. This is harmless:
`revealSide` checks whether the side is already in `shownSides` before doing anything, so
whichever fires second is a no-op. The order does not matter.

The sentinel does not need a resize listener: `position: fixed` with `width: 100%` tracks the
viewport size automatically via CSS.

---

## Snapshot validity across resize

Pre-hide snapshots store the position and size of each element at the moment it was hidden.
For the elements this plugin manages:

- Top bar height and status bar height do not change when the window is resized.
- Ribbon width does not change when the window is resized.

The snapshot therefore remains valid after a resize. The only edge case is Ctrl+/- zoom, which
can slightly affect rendered heights, but the exit padding (`exitPadding` per element config)
provides enough tolerance to absorb it.

---

## Why this works for all sides

`getCombinedRect` is side-agnostic. The top bar may consist of two separate elements
(`tabHeader`, `titleBar`) — the combined rect wraps both into a single exit zone.
The status bar is a single element at the bottom. The ribbon is a single element on the left.
The logic is identical for all of them; only the `Side` enum value differs.

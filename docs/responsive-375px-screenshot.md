# Capturing the 375px mobile screenshot (submission checklist)

Phase 15's checklist asks for a screenshot at **375px wide**. Use the browser's
device emulation — never just shrink the window — so the layout matches a real
phone.

## Steps (Chrome DevTools)

1. Start the app:

   ```bash
   cd frontend
   npm run dev
   ```

   Open <http://localhost:5173> in Chrome.

2. Open DevTools (`F12`) and click the **device toolbar** toggle
   (top-left of DevTools, the phone/tablet icon, or `Ctrl+Shift+M`).

3. At the top of the toolbar, pick a phone preset such as **iPhone 12 Pro** or
   type `375` into the width field and set height to something tall
   (e.g. `812`). Keep the **device pixel ratio** at its preset value (`3`) so
   the capture is crisp — don't force `1x`.

4. Navigate to the Dashboard (or the page you're documenting). Verify the
   **bottom tab bar** is visible and the stat cards stack in a single column.

5. Click the toolbar's **⋮ → Capture full size screenshot** for a full-page
   capture, or **Capture screenshot** for the visible viewport. Save it as
   `docs/screenshots/mobile-375.png` (or wherever your checklist expects it).

## Checklist before capturing

- [ ] Width exactly **375px** (device toolbar, not a resized window).
- [ ] Bottom nav shows all five items with the active section highlighted.
- [ ] Stat cards stack vertically (no horizontal squeeze, no sideways scroll).
- [ ] No horizontal scrollbar on the page; long tables become stacked cards
      (Activity) instead of overflowing.
- [ ] Wallet / primary action buttons are at least ~44px tall (they are, via
      `min-h-11 sm:min-h-0` on mobile).

## Alternative: automated capture

For a repeatable, CI-friendly capture, drive a headless browser at an emulated
viewport — for example Playwright:

```ts
await page.setViewportSize({ width: 375, height: 812 });
await page.goto("http://localhost:5173");
await page.screenshot({ path: "mobile-375.png", fullPage: true });
```

(Same idea works in Puppeteer with `page.setViewport({ width: 375, height: 812 })`.)

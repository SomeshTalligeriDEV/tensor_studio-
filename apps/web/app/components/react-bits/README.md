# React Bits landing effects

GradientASCII, BlurText, FallingText and TrueFocus come from the complete React Bits JavaScript/CSS sources supplied by the user on 2026-10-31. The duplicate TrueFocus attachment is integrated once. License: `apps/web/third-party/ReactBits-LICENSE.md` (MIT + Commons Clause).

Local adaptations:

- Reuse installed `framer-motion` instead of adding a second animation runtime; use duration-based spring options supported by this app.
- Add typed public interfaces next to the supplied JS source and an inline-tag option for semantic heading content in BlurText.
- GradientASCII: explicit pause, 30fps cap, DPR 1 in the landing, reduced-motion updates and WebGL/context-loss fallback.
- TrueFocus: stop cycling and remove blur under reduced motion; the landing provides stationary text when animations are paused.
- FallingText: load on an explicit button press, stop when bodies sleep, stop when the document is hidden, and clean up on reset/navigation. No essential text depends on physics.

`LandingEffects.tsx` handles placement. `useLandingMotion.ts` owns page pause and preference changes. The page keeps its regular content, footer, and idea handoff when WebGL is unavailable or motion is disabled.

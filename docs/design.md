# SATMAKON web design

The app at sat.makonbook.uz. One token set (`app/src/styles.css`), one radius
scale, one font. The phone app keeps its own design (MOBILE-DESIGN.md in
makonbook-mobile); the web no longer follows it.

## Principles
- **One brand colour, a few category colours.** SATMAKON purple (`primary`,
  #3E008E, from the logo) is for primary actions, the active nav item, links
  and counters. Each category (classes, mistakes, the week, vocabulary,
  scores…) has its own hue, used only faintly: a widget's top tint, its label
  and icon chip. Colour means something.
- **Big number, tiny label.** Metrics are a 26–60px bold number (`t-number`)
  beside a 10.5px uppercase label (`t-micro`).
- **Soft, rounded, flat.** White cards on a near-white canvas (`brand`), 1px
  borders (`line`), almost no shadows; radius 10 (nav rows, chips) · 12
  (controls, tiles) · 16 (cards) · 20 (panels, modals) · full (pills).
- **Floating chrome.** The sidebar is a rounded panel with an 8px margin;
  tests, drills and study drop the frame entirely.
- **The test screen stays Bluebook-like** (dashed rules, navigator pill,
  tools row) so test day feels familiar, in our purple.
- **Encouraging copy.** Second person, short, warm, a little witty; empty
  states say what will appear and how. Our own words always.
- **Skeletons match the final layout** (`Skeleton`, shimmer); motion is quick
  and subtle (150–300ms, `lift` on primary buttons, `rise`/`pop`/`fade`
  entrances) and off under reduced motion.

## Tokens
`brand` canvas · `surface` cards · `surface-2` inset (inputs, tiles,
segmented tracks) · `line`/`line-soft`/`line-strong` · `ink`/`ink-2`/`ink-3`
text · `title` page titles · `primary` (+`-hover`, `-deep`, `on-primary`) ·
`accent` (+`-tint`) · `good`/`watch`/`bad`/`info` (+`-tint`) and `fill-*` ·
category hues `orange amber green teal blue violet pink slate` · subjects
`math`/`english` (+`-tint`) · the test page's `paper`, `paper-2`, `bar`.
Light and dark both defined; never `dark:` variants.

## Type
Nunito everywhere (`@fontsource-variable/nunito`). Page titles 28–32px/600
with tight tracking (`PageHeader`); `t-title`…`t-caption` for the rest;
`t-micro` for labels; `t-number` for big figures.

## Building blocks (`components/ui.tsx`)
`PageHeader` (icon tile, title, actions) · `Card` · `Widget` + `WidgetLabel`
(top-tinted card, uppercase label with icon chip) · `Pill` · `Segmented`
(tabs with counts) · `Stat` · `Progress` · `Modal` (blurred backdrop,
Escape/× close, focus moves in) · `Action` (pill CTA). The shell is
`layouts/AppShell.tsx`; the logo is `components/brand` (SVG paths).

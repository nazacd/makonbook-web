# Mascot brief (for SATMAKON's illustrator)

The web app's onboarding (the first screen a new student sees) has four spots
for a mascot. They show a quiet placeholder until the art is delivered; the
art then drops in without code changes (`app/src/components/onboarding/Mascot.tsx`).

## The character

- **Original, and SATMAKON's own.** It must not resemble any existing
  character (from films, games, other brands), and must not carry anyone
  else's name or logo (no College Board, no university crests). SATMAKON
  needs full rights to it (a work-for-hire or an assignment of copyright).
- A friendly companion for 15–18-year-olds in Uzbekistan on their way to the
  SAT and a university abroad: curious, encouraging, a little funny; never
  childish. An animal or creature with a link to the region works well
  (e.g. a snow leopard), but it's the illustrator's proposal.
- Style: soft 3D or clean illustrated, readable at 80 px and at 240 px, on a
  very dark purple night sky (`#07031a` to `#2a1466`).
- Colours: SATMAKON's deep purple (`#3b0a8f` family) with warm gold accents
  (`#f6c343`); light on dark. A varsity jacket in purple and gold suits it.

## The four poses

| File | Where it shows | Pose |
|---|---|---|
| `wave.webp` | Welcome ("Where will your SAT take you?") | Waving hello, looking at the viewer |
| `think.webp` | (reserved) choosing a university | Hand on chin, looking up and to the side |
| `point.webp` | (reserved) pointing at the globe | Pointing down and to the side, excited |
| `cheer.webp` | Finale ("Your road is drawn") | Arms up, celebrating |

## Delivery

- Each pose as a **square transparent WebP, 480 × 480 px**, the character
  filling about 85 % of the height, centred, with nothing cut off. Also the
  source files (layered PSD/AI/Figma or the 3D scene).
- Optional: a short looping animation per pose as Lottie JSON (under 150 KB).
- Files go in `app/public/mascot/`; then list the poses in `DRAWN` in
  `Mascot.tsx`. The art is SATMAKON's own, so it may be committed.

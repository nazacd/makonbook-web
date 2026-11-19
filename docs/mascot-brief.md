# Mascot brief (for SATMAKON's illustrator)

The mascot is **Mako the panda**, carried over from the old MakonBook: a
vector rig drawn in code (`app/src/components/mascot/Panda.tsx`, the
`.pd-*` styles in `app/src/styles.css`) with thirteen emotions, eyes that
follow the pointer, blinking, a talking mouth and a seasonal accessory. He
greets from the top of the dashboard, stands in onboarding, and (later) in
his room. This brief is for **redrawing him**, not for a new character.

## The character

- **Mako stays Mako.** A panda, friendly and a little funny, never childish;
  a companion for 15–18-year-olds in Uzbekistan on their way to the SAT and a
  university abroad. The current rig (in the app, at `/` after signing in) is
  the reference for proportions and expressions: big round head, small body,
  the tuft, pink cheeks. He must not resemble any other brand's panda and
  must carry no one else's name or logo. SATMAKON needs full rights to the
  drawings (a work-for-hire or an assignment of copyright).
- Colours: panda black `#1f1d22` and white, SATMAKON's deep purple
  (`#3b0a8f` family) and warm gold (`#f6c343`) for accessories. He must read
  on the app's near-white canvas, on its dark theme, and on onboarding's very
  dark purple sky (`#07031a` to `#2a1466`).
- Readable at 72 px (the phone's header) and at 240 px.

## What to deliver

The rig is animated by parts, so the redraw must keep that structure. Deliver
**SVG**, one file, with each part as its own group, named as the current rig
names them (`pd-body`, `pd-ear-l/r`, `pd-arm-l/r`, `pd-eye-l/r` with
`pd-pupil`, `pd-lid` and `pd-lid-low`, `pd-brow-l/r`, the six mouths
`pd-m-open/o/smile/frown/flat/smirk/wobble`, `pd-cheeks`, `pd-tuft`,
`pd-shadow`, the effects under `pd-fx`), in the same 240 × 250 viewBox, so
the drawing drops into the rig without new code.

Also:
- The four **seasonal accessories** as separate groups: a peach blossom at
  the ear (spring), a cap (summer), a chinar leaf (autumn), a scarf
  (winter); and, optional, one per holiday (a paper hat for New Year, a
  tulip for Navruz).
- Optional: still poses as square transparent WebP, 480 × 480, for places
  that can't run the rig (e-mails, the landing page): waving, thinking,
  pointing, cheering.
- The source files (layered AI/Figma or the SVG master).

Files go in `app/public/mascot/`; the art is SATMAKON's own, so it may be
committed.

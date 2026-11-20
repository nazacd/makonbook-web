# Achievements

The look is the old games' advancement toast, drawn and worded as our own:
a dark slab with a notched 2px edge, a 16-pixel icon in its own box (SVG
rectangles in `components/achievements/PixelIcon.tsx`, SATMAKON's own, never
anyone else's textures), a coloured header line in a pixel face (Mojang,
self-hosted from `app/public/fonts`) and the title in white. It slides in at the top right,
holds five seconds, slides out; the next one waits. A chime (synthesised,
Profile → Sounds) and a burst of the season's particles go with it. Pressing
a toast opens the Progress page, where the same slabs make the grid.

Headers, by kind:

| Kind | Header | Colour | When |
|---|---|---|---|
| achievement | Achievement unlocked! | gold | an achievement the API unlocked |
| challenge | Challenge complete! | purple | the hard ones (`CHALLENGE` in `Toasts.tsx`) |
| quest | Quest done! | cyan | a daily or weekly quest finished |
| none | Not an achievement | grey | back after seven dead days: "A week of cobwebs" |
| nudge | Achievement get! | gold | evening, nothing done today: "please lock in" |

The icon sits in a **frame** (`Badge` in `PixelIcon.tsx`), the six images in
`app/public/achievements/` cut from the owner's reference: a square for an
achievement, a rounded one for a goal (quests, the nudge), a jagged one for a
challenge; light grey once completed, the gold ones shifted to SATMAKON
purple for the ones still to do.

The API decides what is unlocked (spec 27); the browser only decides what it
hasn't shown yet (`mb.toasts.seen.<person>`): the first look on a device
marks everything seen without a toast, so an account with history doesn't
get thirteen at once.

## The window (`components/achievements/Tree.tsx`)

The Progress page shows the achievements as the old games did: a window
with a bevelled grey frame, and inside it a pit of blocks that scrolls and
drags: `app/public/achievements/pit.webp` when it is there (generated to the
owner's brief: an underground cross-section, no sky, grass and dirt at the
top edge, stone darkening to bedrock, ore by depth, tiling sideways), else
blocks drawn in code, with the achievements laid out as a tree over
it. Each hangs from the one before it (`LAYOUT`: grid cells and a parent),
joined by elbowed arrows that brighten once the child is earned. Earned ones
sit in grey frames; the rest in purple, their icons dimmed; a secret shows a
padlock and "???". Hover or press a frame for a slab tooltip. A List toggle
shows the same achievements as slabs, for reading and for keyboards.

## The list (spec 27, 36 of them)

Tiers: A advancement (square), G goal (rounded), C challenge (jagged); S secret.

- **Getting started:** First Step (A), Pencil Age (first mock, A), Getting
  Words (first review, A), Open Book (first page, A), Front Row (first lesson
  scanned in, A), Dream Set (dream university, A).
- **XP and levels:** Momentum 500 (A), Four Digits 1,000 (A), Scholar level 5
  (G), Double Digits level 10 (C).
- **Streak:** Three-Day Spark (A), Week Warrior (G), Month of Momentum (C),
  Unbreakable 100 days (C), Weekend Scholar (A), Comeback (A, S).
- **Answers:** Century (A), Five Hundred (A), Two Thousand (C), Ten Thousand (C).
- **Tests and scores:** Marathon 10 mocks (G), Perfect Set (G), On Target (G),
  1500 Club (C), Full Marks (C, S).
- **Words:** Wordsmith 500 reviews (A), Lexicon 2,000 (G).
- **The clock:** Night Owl (A, S), Early Bird (A, S).
- **Quests:** Quest Habit (A), Quest Regular (C), Full House (G), Clean Sweep (C).
- **The world:** Bookworm (G), Regular 20 lessons (G), Contender (A).

## Still to come

Need hooks the API doesn't have yet: Podium (top three in a competition),
Graduation (a roadmap course finished; the cap icon is drawn), Sniper (20
right in a row), Pair of Aces (a Pairs round with no mistakes), and Watching
the Video once video lessons exist (the heart icon).

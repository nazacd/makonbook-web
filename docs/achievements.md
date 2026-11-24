# Achievements

The look is the old games' advancement toast, drawn and worded as our own:
a slab with a notched 2px edge (dark in the dark theme, light in the light
one), a 16-pixel item icon standing bare at the left, with no box or frame
behind it, a coloured header line in a pixel face (Mojang, self-hosted from
`app/public/fonts`) and the title. It slides in at the top right,
holds five seconds, slides out; the next one waits. A chime (synthesised,
Profile → Sounds) and a burst of the season's particles go with it. Pressing
a toast opens the Progress page, where the same slabs make the list.

## Icons: the owner's item set, and nothing else

Every icon is one of the 16-pixel item pictures the owner supplied, in
`app/public/achievements/items/<name>.png` (836 of them), drawn by `ItemIcon`
in `components/achievements/Icons.tsx` with `image-rendering: pixelated`.
**No icon is drawn in code and none comes from anywhere else**, now or later.
`components/achievements/catalogue.ts` is the one place that says which item
an achievement wears (and its group and place in the tree); the toasts' other
icons (a quest, the nudge, the cobwebs, a secret's sack, the fallback) are
`ICON` there. A new achievement gets a line in `CATALOGUE` with an item from
the folder; until it has one it shows the fallback and sits in no group.

Headers, by kind:

| Kind | Header | Colour | When |
|---|---|---|---|
| achievement | Achievement unlocked! | gold | an achievement the API unlocked |
| challenge | Challenge complete! | purple | the hard ones (`CHALLENGE` in `Toasts.tsx`) |
| quest | Quest done! | cyan | a daily or weekly quest finished |
| none | Not an achievement | grey | back after seven dead days: "A week of cobwebs" |
| nudge | Achievement get! | gold | evening, nothing done today: "please lock in" |

In the tree only, the icon sits in a **frame** (`Badge` in `Icons.tsx`), the
six images in `app/public/achievements/` cut from the owner's reference: a
square for an achievement, a rounded one for a goal, a jagged one for a
challenge; light grey once completed, the gold ones shifted to SATMAKON
purple for the ones still to do. Toasts and the list have no frames.

The API decides what is unlocked (spec 27); the browser only decides what it
hasn't shown yet (`mb.toasts.seen.<person>`): the first look on a device
marks everything seen without a toast, so an account with history doesn't
get thirteen at once.

## The tree (`components/achievements/Tree.tsx`)

The Progress page shows the achievements as the old games did, without the
old games' window around them: a pit of blocks with rounded corners and a
hairline edge, like any other panel here, that scrolls and
drags: `app/public/achievements/pit.webp` when it is there (generated to the
owner's brief: an underground cross-section, no sky, grass and dirt at the
top edge, stone darkening to bedrock, ore by depth, tiling sideways), else
blocks drawn in code, with the achievements laid out as a tree over
it. The picture is the same in both themes, at half brightness in the dark
one (`--mc-pit`). Each achievement hangs from the one before it (`CATALOGUE`:
grid cells and a parent), joined by elbowed arrows: white once the child is
earned, purple to the ones that are next, faint beyond. Earned ones sit in
grey frames; the ones whose parent is earned are **next**: purple and
glowing, with a thin bar under them when part of the way there; the rest are
purple and dimmed. A secret shows a sack and "???". Hover or press a frame
for a slab tooltip. Under the pit, a count per tier and a line that says how
to read it; the button in the corner goes back to the start.

## The list (`components/achievements/List.tsx`)

The same achievements as slabs, for reading and for keyboards: All, Earned
and To do; a section per group with its count; the bare item at the left,
grey when not earned yet; the day it was earned, or how far along with a
bar.

## The forty (spec 27)

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
- **The world:** Bookworm (G), Regular 20 lessons (G), Contender (A), Podium
  (top three in a competition, settled by the worker once it ends, C),
  Graduation (a roadmap course finished, C).
- **Sharpshooters:** Sniper (20 right in a row inside one test or assessment,
  C), Pair of Aces (a Pairs round with no mistakes, A).

## Still to come

Watching the Video, once video lessons exist (its item is `ICON.video`).

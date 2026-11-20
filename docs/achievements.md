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

## The list today (spec 27)

First Step, Momentum, Four Digits · Scholar, Double Digits (C) · Three-Day
Spark, Week Warrior, Month of Momentum (C) · Century, Five Hundred, Two
Thousand (C) · Quest Habit, Quest Regular (C).

## Next batch (agreed, not built)

Needs a column or two on the ledger (the percentage or score of the thing
done, the time of day) and a few hooks. C = challenge, S = secret until earned.

- **Getting started:** Getting Words (first review), Pencil Age (first mock
  test), Open Book (first page read), Front Row (first lesson attended).
- **Streak:** Unbreakable (100 days, C), Comeback (back after two weeks away, S).
- **Answers:** Ten Thousand (C), Sniper (20 right in a row in one assessment, C).
- **Tests and scores:** Marathon (10 mocks), Perfect Set (100 % on 10+
  questions), On Target (a mock at or above the target), 1500 Club (C), Full
  Marks (1600, C, S).
- **Words:** Wordsmith (500 reviews), Lexicon (2,000), Pair of Aces (a Pairs
  round with no mistakes).
- **Time of day:** Night Owl (S), Early Bird (S), Weekend Scholar.
- **Quests:** Full House (all three dailies in a day), Clean Sweep (all six in
  a week, C).
- **Out in the world:** Contender (first competition), Podium (top three, C),
  Dream Set (dream university chosen), Bookworm (reading on 10 days), Regular
  (20 lessons attended), **Graduation** (a roadmap course finished; the cap
  icon is drawn).
- **When video lessons exist:** Watching the Video (the first one watched to
  the end; the heart icon).

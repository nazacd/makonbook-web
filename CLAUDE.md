# makonbook-web

The MakonBook web: the landing page at **makonbook.uz** (`landing/`) and the
student and teacher web app at **sat.makonbook.uz** (`app/`), one image, one
container on the VPS next to the API.

**Read `docs/handoff.md` first.** It has the decisions already made, the
scope and milestones, the logic that must be copied from the mobile app
unchanged, the API facts, how deployment works and the ground rules. It
predates the relaunch, the accounts rework and the roadmaps (both below):
the stack, the deployment and the copied logic still hold, but the app's
design is `docs/design.md` (the SATMAKON design system; the phone app keeps
its own), not the phone's. The API contract is `app/api/openapi.yaml` (a copy
of `nazacd/makonbook-api`'s; see `app/api/README.md`; `app/api/SOURCE` names
the commit it came from); the product is that repo's `docs/platform-spec.md`
(§9 practice, §21 accounts, §22 roadmaps, §23 assignments, §24 universities,
§25 the Library).

Ground rules, short:
- Never commit secrets (the Desmos key, passwords, tokens). `.env` files only.
- Never put student data or test content in the repo; nor the curriculum,
  the university logos, or the design reference and its screenshots.
  `app/shots/` is git-ignored for Playwright screenshots.
- Before calling a step done: `npm run typecheck`, `npm run lint`,
  `npm run check:csp`, `npm run build` must pass (CI runs them, then builds the image and starts
  nginx in it), and try the flow in a real browser at laptop and phone widths.
- Branch on the API's `error.code`, never on its message. A 401 on a
  signed-in request means the session is gone: sign out locally.
- Don't open pull requests unless asked; push to the branch named.

Layout: `landing/` (Vite, plain HTML/CSS/JS; the designed page, don't
redesign it), `app/` (Vite, React, TypeScript strict, React Router, TanStack
Query, openapi-fetch + generated types, Tailwind 4 with the tokens in
`app/src/styles.css`, building blocks in `components/ui.tsx`), `docker/` (the container's nginx),
`deploy/` (the VPS: compose file, edge nginx blocks, `DEPLOY.md`).

In `app/src`: `api/` (client, generated `schema.d.ts`, queries, the error
wording), `auth/session.tsx` (who is signed in; the token in localStorage,
read once per tab: a sign-in or sign-out in another tab restarts this one,
and multi-request jobs check `sameSession()` before each request),
`layouts/` (`RequireAuth`/`RequireGuest`/`RequirePhone` decide who sees what, like the mobile
app's route guards; `AppShell` is the frame: sidebar on laptops, top bar and
bottom tabs on phones), `screens/` (students' home is `Dashboard`; their
classes are at /classes), `api/learning.ts` (question stats, Ask later,
issue reports, goals), `lib/practice/mistakes.ts` (what attempts say per
question; the dashboard and the Training Hall use it),
`components/`, `lib/` (`schedule.ts`, `groups.ts`, `clock.ts` and
`practice/{types,grade,run}.ts` are copies from the mobile app: change them
there first; `practice/local.ts` and `hooks.ts` are this browser's storage
and queries: runs and attempts in localStorage, packages in IndexedDB; a run
written by another tab stops this tab's runner, and a hidden tab's clock is
paused). Question text is rendered by `components/practice/RichContent`
with MathJax from `/vendor` (`app/scripts/vendor.mjs`), formulas only, never
`$…$`. The Desmos calculator runs in its own page (`app/calculator.html`,
`src/calculator-frame.ts`), framed by the test screen, with its own policy
(`calculatorCsp` in `app/csp.ts`, `docker/calculator-headers.conf`); the app's
pages keep the strict one. The frame is same-origin, so it is no security
boundary (its scripts could read the token). It needs `VITE_DESMOS_API_KEY` in `app/.env` (and
as a GitHub secret for the image).
The test screen (`screens/PracticeRun`) follows Bluebook's layout; its
highlights and notes (`components/practice/Annotations`) are character
offsets into a block's text, painted with the CSS Custom Highlight API and
kept in the run, never uploaded.
Vocabulary: `lib/vocab/{types,scheduler,progress}.ts` are copies from the
phone; `ts-fsrs` stays pinned to exactly 5.4.2 (no fuzz, 90 % retention) so
replaying the same review log gives the same cards on every device. The deck
and each person's log live in IndexedDB (`lib/idb.ts`); card states are only
ever derived from the log. The student's `/words` (`screens/Words`): today's
words, Ways to practise, their lists, today's count, streak and progress;
`Study` is the flashcard that turns over (the only thing that writes
reviews). The games (`screens/vocab/{Pairs,Unscramble,FillGap}`, full screen
at `/words/play/…`, framed by `components/vocab/Game`, logic in
`lib/vocab/games.ts`) draw from the lists turned on, shakiest words first,
and never touch the log; each finished round goes to the server
(`api/vocabSocial.ts`: `useRecordGame`, queued in localStorage until sent),
which keeps the bests (`useGameStats`) and the month's leaderboard
(`screens/vocab/Leaderboard`, spec 11.5: enrolled students see their groups
and everyone, free accounts everyone). Students' own decks (spec 11.6,
`screens/vocab/{Decks,DeckDetail,DeckEditor}`) are private until shared;
shared ones are in the community to add; teachers check reported ones
(Decks → To check). Own and added decks are studied like lists through
`useStudyDeck` (slug `deck:<id>`; read it, not `useDeck`, wherever words are
scheduled or played). Words are said aloud with the browser's own voices
(`lib/speak.ts`). Teachers: `lib/attendance/code.ts` is the phone's
copy of the QR signing and must match the API's
`internal/attendance/token.go`; the session screen polls every 3 s while
open and draws the code itself from the session secret. Type comes from the `t-*`
classes in `styles.css`, colours from the tokens, never `dark:` variants.

Accounts (spec §21; `api/accounts.ts`, `components/accounts/`): anyone can
make a student account. **Telegram** (`TelegramButton`; Telegram's own page
asks for the number) and **Google** (`startGoogle`) sign straight in, with no
form: the linked account, else the one with that phone or email, else a new
account with `status: 'registered'`. **Email** (`EmailCode`): a 6-digit code;
an account with the address signs in, a new address goes on to name, surname
and password (`SignUp`). `SignIn` takes a phone, email or username with a
password. Google comes back to `/auth/google#ticket=…` (`GoogleCallback`,
guests only); Telegram to `/auth/telegram?ticket=…&purpose=signin|verify`
(`TelegramCallback`, signed in or not: `verify` proves the signed-in person's
number). `/reset-password` is a code by SMS, then a new password. Show only
the ways `useAppConfig` says are on (`signup`, `email`, `google`, `telegram`,
`reset`). **No phone means locked:** `needsPhone(me)` (a registered student
without a phone) sees only the dashboard (`LockedHome`) and Profile;
`AppShell` greys the rest (`isLocked`), `PhoneLocked` stands in for a locked
page, `RequirePhone` keeps them off the full-screen routes, and the prove-phone
panel (`components/shell/ProvePhone`: `useProvePanel` offers it once per visit,
shortly after the first click or after 10 s, and again whenever something
locked is opened) proves the number by SMS code (`PhoneCode`,
`purpose="verify"`) or Telegram. Proving a number that already has an account
**merges** this one into it (the API answers a login for that account):
`adopt` the login and reload the page. Registered students with a phone see
Classes locked (`enrolledOnly` items, `LockedModal`) and only the mock tests
marked open to all (`enrolled_only` on the others: `LockedTestCard`). Profile:
own names (`EditProfile`, `useSaveProfile`), a photo (`PhotoEditor` crops and
zooms to a 512×512 JPEG; `useSetPhoto`/`useRemovePhoto`; `photo_url` is a
path on the API's origin, as the Telegram photo copied at sign-up is), and a
first password for passwordless accounts (`has_password` false: the current
password is sent empty).

Roadmaps (spec §22; `api/roadmaps.ts`, with types derived from `paths[…]`;
`LessonDetail` is the client's return type because openapi-fetch drops
null-only fields): a student's courses as journeys, countries → units (a
university each) → lessons. `screens/roadmap/`: `Roadmaps` (a card per
course; a free account that hasn't done onboarding is offered it first),
`Onboarding` (full screen under `RequirePhone`, a night scene in every theme
(`.onb` in `styles.css`): a three.js globe (`components/globe/`, lazily
loaded; land dots from `public/globe/land.png`, Natural Earth) rises from the
bottom; the student chooses a **dream university** on it
(`components/onboarding/`: `UniversityPicker`, the tilting `UniversityCard`,
`Crest` for universities without a logo, `Mascot` slots, see
`docs/mascot-brief.md`), then the SAT questions float over it: scores are
dragged along an arc (`ScoreArc`: today in teal, the goal in gold, the climb
between, the dream's admitted range as a band), SAT dates are calendar leaves
with a countdown, the schedule is a week of seven columns; the target
starts from the university's admitted range; the finale draws an arc from
Tashkent. `POST /v1/me/onboarding` sets the goals (with `university_id`) and
builds the roadmaps; the SAT dates it offers are `lib/satDates.ts`, to update
each year. Universities: `api/universities.ts`, spec §24; the globe is
`components/globe/lazy.ts`. `/dream` (`screens/DreamUniversity`) is the same
choice on its own, for changing it later and for enrolled students; it saves
the goals as they are with the new `university_id`. The dashboard's Your SAT
card and the top of every roadmap map show the dream university), `RoadmapMap`
(`/roadmaps/:id`: a night map scrolled bottom to top, laid out by
`journey.ts`; `Medallion` draws a stop from `stop.logo_url`, else the
university's initials; `flags.tsx` wraps flag-icons), `RoadmapUnit` (a stop's
lessons on a timeline), `RoadmapLesson` (objectives, notes, worked examples,
common mistakes, then the level check and the homework sets: a level check
passes at 70 %, and a lesson is done once it is passed and every set is
finished, which opens the next lesson), `AssessmentRun` (`/assessments/:id`,
full screen: answers go to the server as you go, grading happens there on
submit, then the result with explanations; submitting invalidates the
`['roadmaps']` queries). Free accounts see the units past the first country
locked `enrolled_only`; a locked lesson answers 403 `lesson_locked` or
`enrolled_only`. Teachers have no roadmaps. The curriculum and the logos are
SATMAKON's own and never committed: the mock makes a course up, or loads
real files from `MOCK_CURRICULUM=<folder>` (with `logos/`) on your machine.

Assignments (spec §23; `api/assignments.ts`): teachers give their groups
homework, level checks and exams with deadlines; the whole group gets the same
questions; the first finished work is the result (later tries are practice),
work after the deadline is marked late; one that opens later shows to its
students locked ("Opens …", not counted as due), and its teacher can Open
now. Students: `/homework`,
`/level-checks`, `/exams` (`screens/StudentAssignments`, cards in
`components/assignments/AssignmentCard`), the sidebar's due counters, the
dashboard's Due work and Today's plan; homework and level checks run in
`AssessmentRun` (which also sends seconds per question as `times`), an exam
opens its mock test with `?sections=` chosen and is matched to the assignment
by the API. Accounts without a group see a pointer to their roadmap. On phones
the bottom bar's Assess tab opens the three lists; Mock tests is in More.
Teachers (sidebar Today, Assignments, Groups, Mock tests, Vocabulary):
`screens/teacher/Assignments` (the list), `NewAssignment` (group and kind,
then a curriculum lesson, skills and a mix, or a mock test; the drawn
questions with Swap through `QuestionPicker`; then title and dates in school
time), `AssignmentDetail` (students, per-question answers and time, skills; a
student's work; edit, close, delete while untouched) and `Groups` (each group's
hub: students, assignments, a students × lessons roadmap matrix, mock tests,
vocabulary, problem questions). New assignments notify the group's students
(`NotificationsDrawer`, unread badge on the bell).

Question bank (spec §22.8; `api/practiceSets.ts`): the hub at `/questions`
(`screens/practice/QuestionBank`: the two subjects with solved/total, then the
analytics from `GET /v1/me/practice/stats`: four figures, the weekly trend and,
per subject, accuracy by topic, time and accuracy by difficulty, in
`components/practice/BankCharts`; art in `BankArt`, SATMAKON's own), a
subject's topics at `/questions/:subject` (`BankPages`: difficulty, unsolved
only, order; choose topics, then at one's own pace or a Question Rush),
`/questions/saved` and `/questions/history`. Open to every student with a
phone, no paid tier. A set is an assessment of kind `practice` in
`AssessmentRun`: a rush is timed and handed in at zero; at one's own pace each
question is checked (`checkQuestion`) with its answer and explanation, once,
and can be saved (the bookmark). One open set at a time: starting another
answers `practice_open` with it (`PracticeOpenError`). The trend's colours:
right green, wrong red, harder darker (`TREND`), with a legend, tooltips and a
table.

Universities (spec §24.5; `api/universitySection.ts`): every listed
university to browse (`screens/universities/Universities`: search, filters
and sorts kept in the address, cards, the student's own list, saved with
`useSaveUniversity`) and a page each (`UniversityPage`: the record's
admissions, costs, aid, and the country's visa and work facts; "Not
collected yet" where the data has nothing, never a guess; the collectors'
visa difficulty suggestion isn't shown until SATMAKON reviews it). The list's
`facts` are what filters read; most universities are only partly collected,
so a filter on a fact leaves out those without it. "Fit" compares the
student's target (goals) with the admitted middle 50 %. The mock reads a
checkout of the private data with `MOCK_UNIVERSITIES=<folder>`.

Library (spec §25; `api/library.ts`): SAT MAKON's own books, for everyone
signed in (students and teachers; sidebar Library). `screens/Library` is the
shelf (`components/library/BookCover`: `.book` in `styles.css`; subject
filter, search, Continue reading, each book's readers, Read and Download);
`screens/LibraryReader` (`/library/:id`, full screen under `RequirePhone`)
draws the PDF with pdf.js, loaded only there: two pages like an open book on
wide screens, one on phones; arrows, keys, swipe, a click at either side,
zoom, full screen. The page in view is saved to the server a moment after the
turning stops (`useSaveProgress`; the first save makes the person one of the
book's `views`). The whole PDF is fetched once with the bearer token
(`useBookFile`) and handed to pdf.js as a copy, so Download reuses it. pdf.js's
worker must be built as `.js` (`vite.config.ts`: the container's nginx has no
MIME type for `.mjs`, and the build fails on any `.mjs` output). The books
are never committed: the mock draws made-up ones, or reads a checkout of the
private `makonbook-library` with `MOCK_LIBRARY=<folder>`.

`app/mock/api.cjs` is a fictional API for working without the real one (its
header comment says how): the password is `demo-pass` unless
`MB_DEMO_PASSWORD` says otherwise, SMS and email codes are `123456`, Google
is `/v1/auth/google/start?as=name&email=…`, and Telegram's page is a small
form at `/v1/auth/telegram/mock`.

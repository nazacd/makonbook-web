# makonbook-web

The MakonBook web: the landing page at **makonbook.uz** (`landing/`) and the
student and teacher web app at **sat.makonbook.uz** (`app/`), one image, one
container on the VPS next to the API.

**Read `docs/handoff.md` first.** It has the decisions already made, the
scope and milestones, the logic that must be copied from the mobile app
unchanged, the API facts, how deployment works and the ground rules. The API
contract is `app/api/openapi.yaml` (a copy of `nazacd/makonbook-api`'s; see
`app/api/README.md`); the product is that repo's `docs/platform-spec.md`; the
app's design is `docs/design.md` (the SATMAKON design system; the phone app
keeps its own).

Ground rules, short:
- Never commit secrets (the Desmos key, passwords, tokens). `.env` files only.
- Never put student data or test content in the repo.
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
`layouts/` (`RequireAuth`/`RequireGuest` decide who sees what, like the mobile
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
ever derived from the log. Teachers: `lib/attendance/code.ts` is the phone's
copy of the QR signing and must match the API's
`internal/attendance/token.go`; the session screen polls every 3 s while
open and draws the code itself from the session secret. Type comes from the `t-*`
classes in `styles.css`, colours from the tokens, never `dark:` variants. `app/mock/api.cjs` is a fictional API for working
without the real one (README).

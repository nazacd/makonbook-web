# makonbook-web

The MakonBook web: the landing page at **makonbook.uz** (`landing/`) and the
student and teacher web app at **sat.makonbook.uz** (`app/`), one image, one
container on the VPS next to the API.

**Read `docs/handoff.md` first.** It has the decisions already made, the
scope and milestones, the logic that must be copied from the mobile app
unchanged, the API facts, how deployment works and the ground rules. The API
contract is `app/api/openapi.yaml` (a copy of `nazacd/makonbook-api`'s; see
`app/api/README.md`); the product is that repo's `docs/platform-spec.md`; the
app's design follows `nazacd/makonbook-mobile`'s `MOBILE-DESIGN.md`.

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
Query, openapi-fetch + generated types, Tailwind 4 with the mobile app's
tokens in `app/src/styles.css`), `docker/` (the container's nginx),
`deploy/` (the VPS: compose file, edge nginx blocks, `DEPLOY.md`).

In `app/src`: `api/` (client, generated `schema.d.ts`, queries, the error
wording), `auth/session.tsx` (who is signed in; the token in localStorage),
`layouts/` (`RequireAuth`/`RequireGuest` decide who sees what, like the mobile
app's route guards; `AppShell` is the frame with the four tabs), `screens/`,
`components/`, `lib/` (`schedule.ts`, `groups.ts`, `clock.ts` and
`practice/{types,grade,run}.ts` are copies from the mobile app: change them
there first; `practice/local.ts` and `hooks.ts` are this browser's storage
and queries). Question text is rendered by `components/practice/RichContent`
with MathJax from `/vendor` (`app/scripts/vendor.mjs`), formulas only, never
`$…$`. The Desmos calculator needs `VITE_DESMOS_API_KEY` in `app/.env`.
Vocabulary: `lib/vocab/{types,scheduler,progress}.ts` are copies from the
phone; `ts-fsrs` stays pinned to exactly 5.4.2 (no fuzz, 90 % retention) so
replaying the same review log gives the same cards on every device. The deck
and each person's log live in IndexedDB (`lib/idb.ts`); card states are only
ever derived from the log. Type comes from the `t-*`
classes in `styles.css` (the phone's type scale), colours from the tokens,
never `dark:` variants. `app/mock/api.cjs` is a fictional API for working
without the real one (README).

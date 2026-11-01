# makonbook-web

The MakonBook web: the landing page at [makonbook.uz](https://makonbook.uz)
(`landing/`) and the student and teacher web app at
[sat.makonbook.uz](https://sat.makonbook.uz) (`app/`), a client of the
MakonBook API (`nazacd/makonbook-api`) next to the mobile app
(`nazacd/makonbook-mobile`).

The plan and the rules: `docs/handoff.md`. Deployment: `deploy/DEPLOY.md`.

## Development

Node 22.12 or newer. One install for both workspaces:

```bash
npm install
```

```bash
npm run dev:landing     # http://localhost:5174
```

```bash
npm run dev:app         # http://localhost:5173; /v1 is proxied to the API
```

The app's dev server proxies `/v1` to `https://api.makonbook.uz` (or
`VITE_API_URL` from `app/.env`, see `app/.env.example`), so page and API share
one origin, as in production.

Without the real API (no network, or nothing to sign in with), a fictional one
with three accounts is in `app/mock/api.cjs`:

```bash
npm run dev:mock -w app
```

```bash
VITE_API_URL=http://127.0.0.1:8081 npm run dev:app
```

Checks, all of which CI runs:

```bash
npm run typecheck && npm run lint && npm run check:csp && npm run build
```

API types: `app/src/api/schema.d.ts` is generated from `app/api/openapi.yaml`
(`npm run gen`) and committed; `app/api/README.md` says how to update the
contract from the API repo.

## The image

`Dockerfile` builds both sites and serves them from one nginx
(`docker/nginx.conf`), choosing the site by `Host`. To try it:

```bash
docker build -t makonbook-web .
```

```bash
docker run --rm --read-only --tmpfs /tmp -p 8080:8080 makonbook-web
```

```bash
curl -H 'Host: makonbook.uz' http://localhost:8080/
```

```bash
curl -H 'Host: sat.makonbook.uz' http://localhost:8080/
```

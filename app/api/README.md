# The API contract

`openapi.yaml` is a copy of `nazacd/makonbook-api/api/openapi.yaml`; the
API repo is the source of truth. `src/api/schema.d.ts` is generated from it
(`npm run gen`) and committed; CI fails when it is stale.

To update both to the API's `main`:

```bash
npm run api:pull -w app && npm run gen -w app
```

`SOURCE` holds the commit it was copied from.

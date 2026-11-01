# Deploying makonbook-web to the VPS

Target: the landing page at `https://makonbook.uz` (on
`https://dev.makonbook.uz` until it moves) and the app at
`https://sat.makonbook.uz`, on the same VPS as the API (see
`makonbook-api/deploy/DEPLOY.md` for the server itself).

```
internet ─► makonbook-nginx (:80/:443, TLS) ─► makonbook-web:8080   landing page + app (this repo)
                                            ─► makonbook-api:8080   /v1/ of sat.makonbook.uz (the API)
                         sat_makon_network
```

Run every command as root on the VPS unless it says otherwise. Steps 1–5 are
the first deploy; later releases only need "Updating".

---

## 1. DNS

At Eskiz add **A** records to the VPS's IP (the same as `api.makonbook.uz`):

- `sat.makonbook.uz`
- `dev.makonbook.uz` (temporary, until the landing page moves to `makonbook.uz`)

First make sure neither name is in use already (a record pointing elsewhere,
or a block in the edge config; nginx only warns about a duplicate
`server_name`, keeps the first block and ignores the new one):

```bash
getent hosts sat.makonbook.uz dev.makonbook.uz       # nothing yet, or the VPS's IP
grep -n 'sat.makonbook.uz\|dev.makonbook.uz' /opt/sat-makon/makonbook/nginx/default.conf   # nothing
```

Then wait until the VPS sees the new records:

```bash
getent hosts sat.makonbook.uz dev.makonbook.uz      # must print the VPS's IP
```

## 2. Image

The GitHub workflow `.github/workflows/docker.yml` builds `nazacd/makonbook-web`
on every push to `main`. One-time setup in the GitHub repo → Settings →
Secrets and variables → Actions:

- `DOCKERHUB_USERNAME` — `nazacd`
- `DOCKERHUB_TOKEN` — Docker Hub → Account settings → Personal access tokens,
  read/write (the same token the API repo uses is fine)
- `VITE_DESMOS_API_KEY` — the Desmos calculator key (the app's Math modules,
  from M2; the build works without it until then)

After the merge to `main`, the Actions tab shows the build; it pushes
`:latest` and `:sha-<commit>`.

## 3. Files

```bash
mkdir -p /opt/makonbook-web && cd /opt/makonbook-web
```

Copy `deploy/docker-compose.yml` from this repo into that directory — from
your computer, in a checkout of the repo:

```bash
scp deploy/docker-compose.yml root@makonbook.uz:/opt/makonbook-web/
```

No `.env` is needed: the container has no settings (the Desmos key is baked in
at build time, step 2).

## 4. nginx and the certificates

The edge config is the single file `/opt/sat-makon/makonbook/nginx/default.conf`,
bind-mounted into `makonbook-nginx`.

> **Append, don't rewrite.** A single-file bind mount keeps pointing at the old
> file if an editor saves by replacing it (vim does; `cat >>` and nano don't),
> and nginx then silently keeps the old config. After every change, check what
> the container sees: `docker exec makonbook-nginx tail -5 /etc/nginx/conf.d/default.conf`.
>
> If `default.conf` is versioned in the Django repo, commit the same blocks
> there too, or the next Django deploy will drop them.

**4a. HTTP block.** Append PART 1 of `deploy/nginx-web.conf` (the `listen 80`
server block for `sat.makonbook.uz` and `dev.makonbook.uz`) to `default.conf`, then:

```bash
docker exec makonbook-nginx nginx -t && docker exec makonbook-nginx nginx -s reload
curl -sI http://sat.makonbook.uz/ | head -1        # expect 301
curl -sI http://dev.makonbook.uz/ | head -1        # expect 301
```

`nginx -t` must print no `conflicting server name` warning (it still says
"successful" with one, and the new block is then ignored).

**4b. Certificates** — one lineage per host, so the existing makonbook.uz
certificate is not touched:

```bash
cd /opt/sat-makon/makonbook
# The server has more than one Let's Encrypt account; use the one that renews makonbook.uz.
ACCOUNT=$(docker exec makonbook-nginx grep -h '^account' /etc/letsencrypt/renewal/makonbook.uz.conf | awk -F'= *' '{print $2}')
for HOST in sat.makonbook.uz dev.makonbook.uz; do
  docker compose run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot -d "$HOST" \
    --account "$ACCOUNT" --non-interactive --agree-tos
done
```

The certbot container's 12-hourly `certbot renew` renews them with the others,
and nginx reloads every 6 hours.

**4c. HTTPS blocks.** Append PART 2a and PART 2b (the `listen 443` server
blocks), then:

```bash
docker exec makonbook-nginx nginx -t && docker exec makonbook-nginx nginx -s reload
```

Until step 5, both hosts answer 502 — expected.

## 5. Start

```bash
cd /opt/makonbook-web
docker compose pull
docker compose up -d
docker compose ps                                  # web: healthy
curl -s https://dev.makonbook.uz/ | grep -o '<title>[^<]*'     # <title>Makonbook
curl -s https://sat.makonbook.uz/ | grep -o '<title>[^<]*'     # <title>MakonBook
curl -s https://sat.makonbook.uz/v1/app/config     # the API, through the sat host
```

Also check the headers once: `curl -sI https://sat.makonbook.uz/` shows
`content-security-policy`, `strict-transport-security` and
`cache-control: no-cache`; `curl -sI https://sat.makonbook.uz/assets/<a file from the page>`
shows `cache-control: public, max-age=31536000, immutable`.

---

## Updating

```bash
cd /opt/makonbook-web
docker compose pull
docker compose up -d
```

**Pin a version** instead of `latest`: create `/opt/makonbook-web/.env` with
`WEB_IMAGE=nazacd/makonbook-web:sha-<commit>` (the compose file reads it).
**Roll back:** set the previous sha and `docker compose up -d`. The container
is stateless; nothing else to migrate.

## Moving the landing page to makonbook.uz

When the landing page is ready to replace the site served at `makonbook.uz`
today (decision: it replaces it completely):

1. In `default.conf`, find the existing blocks whose `server_name` includes
   `makonbook.uz` (the `listen 80` one and the `listen 443 ssl` one). Note
   **every** name in those `server_name` lines, whether either block is the
   `default_server`, the `ssl_certificate` paths (the makonbook.uz SAN
   lineage) and what `proxy_pass` points to. Check that the certificate
   covers `www.makonbook.uz` too:

   ```bash
   docker exec makonbook-nginx openssl x509 -in /etc/letsencrypt/live/makonbook.uz/fullchain.pem -noout -ext subjectAltName
   ```

2. Replace those two blocks with PART 3 of `deploy/nginx-web.conf`
   (uncommented), keeping the same certificate paths. Names other than
   `makonbook.uz` and `www.makonbook.uz` that were in those blocks keep a
   block of their own (with the ACME location, or the SAN certificate stops
   renewing for them), and `default_server` stays where it was. This edit
   can't be an append: use nano (it writes in place; vim and `sed -i`
   replace the file and the bind mount keeps the old one), then check with
   the `tail` above that the container sees the change.
3. `docker exec makonbook-nginx nginx -t && docker exec makonbook-nginx nginx -s reload`
4. `curl -sI https://makonbook.uz/ | head -1` (200) and
   `curl -sI https://www.makonbook.uz/ | head -1` (301 to makonbook.uz).
5. The old site's container: stop it only if no remaining block in
   `default.conf` proxies to it (`grep -n proxy_pass default.conf`); the
   same container may serve sat-makon.uz or school28.
6. In this repo, add `og:url` / `og:image` tags for `https://makonbook.uz/`
   to `landing/index.html` (left out while the page lives on the dev host,
   where they would point link previews at the old site).
7. Later, drop `dev.makonbook.uz`: remove the name from PART 1's
   `server_name` and delete the PART 2b block (nano, in place), reload
   (`nginx -t && nginx -s reload` as above), **then** delete the
   certificate from the certbot project and remove the DNS record:

   ```bash
   cd /opt/sat-makon/makonbook
   docker compose run --rm --entrypoint certbot certbot delete --cert-name dev.makonbook.uz
   ```

No change to the container is needed: it already answers `makonbook.uz`,
`www.makonbook.uz` (a redirect to the apex) and `dev.makonbook.uz`
(`docker/nginx.conf`).

## Everyday operations

| Task | Command (in `/opt/makonbook-web`) |
|---|---|
| Logs | `docker compose logs -f web` |
| Health | `docker compose ps`; `docker exec makonbook-web wget -qO- http://127.0.0.1:8080/healthz` |
| Try the image locally (your computer) | `docker run --rm --read-only --tmpfs /tmp -p 8080:8080 nazacd/makonbook-web` then `curl -H 'Host: sat.makonbook.uz' http://localhost:8080/` |
| Stop / start | `docker compose stop` / `docker compose up -d` |

The container holds no data and has no settings; everything lives in the
image. The API (sessions, attempts, reviews) is the only state.

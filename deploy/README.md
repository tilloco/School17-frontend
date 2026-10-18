# Deploying School17 with Docker

One server runs everything: PostgreSQL, the backend, the LiveKit video server and Caddy (automatic HTTPS).

## What you need
- A Linux server (2 vCPU / 4 GB is a sensible start) with Docker and the Compose plugin.
- A domain with two DNS A records pointing at the server: `YOUR-DOMAIN` and `lk.YOUR-DOMAIN`.
- Open ports: 80, 443 (web), 7881/tcp and 50000–50100/udp (video).

## First start
```bash
git clone <your repo> school17 && cd school17
cp deploy/.env.production.example .env      # fill in EVERY value (secrets: openssl rand -base64 48)
docker compose up -d --build
docker compose logs -f backend              # wait for "Backend ishga tushdi"
```
The backend applies database migrations by itself on every start.

Create the first administrator (for the admin site):
```bash
docker compose exec -it backend node prisma/create-admin.js
```

## Check it
- `https://YOUR-DOMAIN/privacy`, `/terms`, `/delete-account` open in a browser.
- The app is built with `EXPO_PUBLIC_API_URL=https://YOUR-DOMAIN` (see `docs/PLAY_STORE.md`).

## Everyday
| Task | Command |
|---|---|
| Update to new code | `git pull && docker compose up -d --build` |
| Logs | `docker compose logs -f backend` |
| Database backup | `docker compose exec -T db pg_dump -U school17 school17 \| gzip > backup-$(date +%F).sql.gz` |
| Restore | `gunzip -c backup.sql.gz \| docker compose exec -T db psql -U school17 school17` |
| Stop | `docker compose down` (data stays in volumes) |

Back up the database **and** the `files` volume (uploaded files) together, and keep a copy off the server.

## Safety notes
- `.env` holds the secrets: never commit it, never share it. Rotating `JWT_SECRET` signs every user out.
- The compose file never publishes the database port; only Caddy, and the video ports, face the internet.
- `TRUST_PROXY=1` is correct because Caddy is the single proxy in front. If you change the proxy setup, change it too (wrong values weaken the rate limits).
- Set `LEGAL_REVIEWED=1` and `LEGAL_RETENTION` only after a lawyer approved the policy.

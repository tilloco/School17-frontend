# What it costs to run School17 for about 100 people

Rate used: **1 USD = 12,010 UZS** (Central Bank, 16 Oct 2026). Prices below were looked up on 18 Oct 2026; hosting prices moved a lot in 2026, so check the provider's price page on the day you buy.

## One-time
| Item | USD | UZS |
|---|---|---|
| Google Play developer account (one time, any number of apps) | 25 | 300,000 |
| Domain `mamunapp.xyz` | already yours | 0 (renewal is a few USD a year) |
| Apple developer account (only if you do iOS later) | 99 per year | 1,189,000 |

## Monthly (100 people, a handful online at the same time)
| Item | Budget | Recommended | Heavy video use |
|---|---|---|---|
| Server (2 vCPU / 4 GB, runs database, backend, video server, HTTPS) | 7 | 15 | 35 (4 vCPU / 8 GB) |
| Backups (server snapshots or a small storage box) | 0 | 4 | 6 |
| Domain share (about 12 USD per year) | 1 | 1 | 1 |
| HTTPS certificate (Caddy / Let's Encrypt) | 0 | 0 | 0 |
| Push notifications (Expo) | 0 | 0 | 0 |
| Google sign-in | 0 | 0 | 0 |
| Phone codes by Telegram (estimate, about 1 cent each, one per sign-in) | 1 | 1 | 2 |
| **Total per month** | **9 USD = 108,000 UZS** | **21 USD = 252,000 UZS** | **44 USD = 528,000 UZS** |
| **Per person per month** | 0.09 USD = 1,080 UZS | 0.21 USD = 2,520 UZS | 0.44 USD = 5,280 UZS |

**First month, recommended plan:** 21 + 25 = **46 USD = about 552,000 UZS**. After that **about 252,000 UZS a month**.

## Notes behind the numbers
- **Video traffic is the only thing that can grow.** A teacher's camera plus screen share is about 3 Mbit/s per student. 30 students in a class for one hour is about 40 GB. Three class-hours a day is about 4 TB a month, inside the 20 TB that VPS plans like Hetzner's include. If you run many more class-hours, pick the heavy plan or a provider with more included traffic.
- **Server prices:** Hetzner's 2026 prices are reported inconsistently (a 2 vCPU plan is listed anywhere from about 6 to 20 EUR a month). I budgeted 15 USD for the recommended plan; if you find a 2 vCPU / 4 GB plan for 7 USD, the budget column applies. Other options: DigitalOcean (about 12 to 24 USD), Contabo (cheap, slower support), or a server in Uzbekistan (price on request; it also keeps your users' data in the country).
- **Free tiers used:** Expo push, Google sign-in, Let's Encrypt certificates, LiveKit video server (open source, runs on your own server), PostgreSQL.
- **Not included:** your time, and Google's cut if you ever sell something inside the app (School17 is free, so none).

# Scheduled jobs without Vercel Pro

`vercel.json` declares four crons. **Vercel Hobby only runs crons once a day**, so the 5- and 10-minute jobs need **Pro**
(about $20/month) or an outside scheduler. Reminders (24 h and 2 h), the on-the-way and review texts, hold expiry and the
missed-call text-back all depend on these jobs. Without them bookings still work, but nothing is sent on time.

| Endpoint | Every | What it does |
|---|---|---|
| `/api/cron/dispatch` | 5 min | expires unpaid holds, sends due confirmations, reminders, on-the-way, review requests, rebook nudges |
| `/api/concierge/cron` | 10 min | sends missed-call openers held for quiet hours (9pm-8am Pacific) |
| `/api/concierge/retention` | daily (10:30 UTC) | deletes chat/text transcripts older than `CONCIERGE_RETENTION_DAYS` (default 180) |
| `/api/cron/statements` | monthly (1st, 14:00 UTC) | builds last month's dealer statements (`?month=YYYY-MM` re-runs one) |

Every endpoint takes **GET or POST** with the header `Authorization: Bearer <CRON_SECRET>`. Without `CRON_SECRET` set the endpoints answer
503 in production; with a wrong secret, 401. They are idempotent, so a late or doubled call is harmless.

Test one by hand (replace the domain and secret):

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/dispatch
# 200 + a small JSON summary = working.  401 = wrong secret.  503 = CRON_SECRET not set on the server.
```

## Option A: Vercel Pro
Nothing to do. `vercel.json` is already wired, and Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is
set in the project's environment variables.

## Option B: GitHub Actions (free)
Save as `.github/workflows/916-cron.yml` at the **root of the GitHub repository** (workflows are only read from there), then add the repository
secret `CRON_SECRET` and the repository variable `SITE_URL` (for example `https://916dentdetail.com`, no trailing slash).

```yaml
name: 916 scheduled jobs
on:
  schedule:
    - cron: '*/5 * * * *'      # dispatch (GitHub may delay runs by several minutes under load)
    - cron: '*/10 * * * *'     # concierge openers
    - cron: '30 10 * * *'      # transcript retention
    - cron: '0 14 1 * *'       # monthly dealer statements
  workflow_dispatch: {}
jobs:
  call:
    runs-on: ubuntu-latest
    steps:
      - name: Pick the endpoint for this schedule
        id: pick
        run: |
          case "${{ github.event.schedule }}" in
            '*/5 * * * *')  echo "path=/api/cron/dispatch" >> "$GITHUB_OUTPUT" ;;
            '*/10 * * * *') echo "path=/api/concierge/cron" >> "$GITHUB_OUTPUT" ;;
            '30 10 * * *')  echo "path=/api/concierge/retention" >> "$GITHUB_OUTPUT" ;;
            '0 14 1 * *')   echo "path=/api/cron/statements" >> "$GITHUB_OUTPUT" ;;
            *)              echo "path=/api/cron/dispatch" >> "$GITHUB_OUTPUT" ;;
          esac
      - name: Call it
        run: |
          curl --fail-with-body --silent --show-error --max-time 60 \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ vars.SITE_URL }}${{ steps.pick.outputs.path }}"
```

Caveats: scheduled workflows can run a few minutes late and GitHub pauses them after 60 days without repository activity. That is
acceptable for reminders (the 24 h and 2 h windows tolerate it) but check the Actions tab after the first week. For tighter timing use option C.

## Option C: cron-job.org (free, accurate to the minute)
1. Create a free account at cron-job.org (the owner does this; nothing here creates accounts).
2. Create one job per row of the table above. URL = `https://YOUR-DOMAIN` + the path, **Request method GET**.
3. Under *Advanced > Headers* add `Authorization` = `Bearer <your CRON_SECRET>`.
4. Schedule: every 5 minutes / every 10 minutes / daily at 10:30 UTC / monthly on day 1 at 14:00 UTC.
5. Enable *Notify me when the job fails* so a wrong secret or a down site reaches you.

## Day-1 check
After the first hour, `/admin` > More > Reports (or the `events` table) should show `booking.confirmed` and sent notifications; the server logs show
one `notify.dispatch` log line per call. No lines = the scheduler is not reaching the site (wrong URL, wrong secret, or the job is paused).

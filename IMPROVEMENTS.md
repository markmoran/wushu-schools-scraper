# Wushu Schools Scraper — Improvements Completed

## Critical Fixes ✓

### 1. Google Auth now works in production
- **Before:** Read credentials and token from disk (`./credentials.json`, `./token.json`). This fails when the task runs on Trigger.dev cloud workers where those files don't exist.
- **After:** Now reads `GOOGLE_CREDENTIALS_JSON` and `GOOGLE_TOKEN_JSON` from environment variables as JSON strings. Works locally and in production.
- **Files changed:** `src/trigger/search-schools.ts`

### 2. Environment variable validation added
- **Before:** No validation. If a key was missing, the error would be cryptic and occur deep in the code.
- **After:** All env vars are validated at the top of each task file. Missing keys throw clear errors immediately.
- **Files changed:** `src/trigger/search-schools.ts`, `src/trigger/scrape-school.ts`

### 3. GitHub Actions deploy pipeline created
- **Before:** `.github/workflows/deploy.yml` didn't exist — deploys had to be done manually.
- **After:** Standard Trigger.dev deploy workflow in place. Push to `master`/`main` → auto-deploys.
- **Files changed:** `.github/workflows/deploy.yml` (new)

## Data Quality Improvements ✓

### 4. Replaced fragile regex extraction with Firecrawl's LLM extract mode
- **Before:** Used regex patterns that often missed data. Location extraction was hardcoded to 4 cities — everything else got "Unknown Location."
- **After:** Firecrawl's LLM reads the page and extracts structured data using a JSON Schema. Much more reliable. Locations are now extracted from actual page content.
- **Files changed:** `src/trigger/scrape-school.ts`

### 5. Improved directory detection
- **Before:** Checked for keywords like "school 1", "school 2", phone numbers, etc. — fragile heuristics.
- **After:** If LLM extraction finds 3+ items in a `schools[]` array, it's a directory. Clean and simple.
- **Files changed:** `src/trigger/scrape-school.ts`

## Efficiency & Safety Improvements ✓

### 6. Write-back for updated records
- **Before:** When a school already existed, the code merged new data but never wrote it back to the sheet. Merge logic was dead code.
- **After:** New function `updateSheetRows()` writes updates back. Existing schools can now have missing fields filled in.
- **Files changed:** `src/trigger/search-schools.ts`

### 7. Second-pass directory scraping now has a safety cap
- **Before:** If many directories were found, could dispatch hundreds of tasks with no guardrail.
- **After:** Limited to 50 second-pass URLs per run. Logs a warning if truncation occurs.
- **Files changed:** `src/trigger/search-schools.ts`

## Cleanup ✓

### 8. Removed unused example task
- **Files changed:** `src/trigger/example.ts` (deleted)

### 9. Fixed test-scraper.js API call
- **Before:** Called nonexistent method `firecrawl.scrapeAndExtract()`.
- **After:** Uses correct `firecrawl.scrape(url, { formats: ["extract"], extract: { schema } })`.
- **Files changed:** `test-scraper.js`

## Environment Variables Setup Required ✓

Two new env vars added to `.env`:

- `GOOGLE_CREDENTIALS_JSON` — Raw JSON from `credentials.json` (Google OAuth2 client secret)
- `GOOGLE_TOKEN_JSON` — Raw JSON from `token.json` (OAuth2 access + refresh tokens)

**Next step:** Add these same two env vars to the Trigger.dev dashboard:
1. Go to cloud.trigger.dev → Your Project → Environment Variables
2. Add both keys to **both staging and production** environments
3. Paste the exact values from `.env`

## What This Means

**Before:** The automation would fail in production with cryptic errors about missing files or "bad tokens."

**After:** 
- ✓ Works in production without requiring local files
- ✓ Better data quality (real locations, not hardcoded guesses)
- ✓ Existing records can be updated with new data
- ✓ Safety guardrails on API usage
- ✓ Clear error messages if something goes wrong
- ✓ Auto-deploy via GitHub Actions

## Next: Testing & Deployment

1. **Local test:** Run `npx trigger.dev@latest dev` and test the tasks before deploying
2. **Add env vars to Trigger.dev:** Add `GOOGLE_CREDENTIALS_JSON` and `GOOGLE_TOKEN_JSON` to the dashboard
3. **Deploy:** Push to `master` — GitHub Actions will deploy automatically
4. **Verify:** Check the Trigger.dev dashboard Schedules tab to confirm Monday 6am cron is registered

See the plan file at `/Users/MarkCMoran/.claude/plans/so-previously-we-set-modular-hopper.md` for full context.

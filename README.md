# Seen in Sport – Championing Fairness in Women's Sport
Free installable PWA. Plain HTML/CSS/JS, no build step, no backend. All files sit in one flat folder.

## 1. Add the two libraries (one-time; required)
Download these into this folder (same names), then commit them:
- Fuse.js: https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js  -> `fuse.min.js`
- Leaflet 1.9.4: https://unpkg.com/leaflet@1.9.4/dist/leaflet.js -> `leaflet.js` and https://unpkg.com/leaflet@1.9.4/dist/leaflet.css -> `leaflet.css`
Until then search falls back to a basic typo-tolerant matcher and the map shows a message.

## 2. Refresh the data files
- **timetable.json** (sessions): put new rows in `sessions.csv` (same columns), run `python3 parse_timetable.py`, then `python3 geocode_postcodes.py` (needs internet; uses postcodes.io, no key). Rows it could not parse or geocode are listed in `flagged_rows.csv`. Most venues have "Not stated" postcodes: add them in `sessions.csv` and re-run, or edit `postcode`, `lat`, `lng` straight in `timetable.json`.
- **Edit venue details**: edit the fields in `timetable.json` (venue, postcode, lat, lng, times). Keep `id` unique. Use "Not stated" for unknowns.
- **parliament_bills.json** (manual): fields `id, type (bill|consultation|lords_debate), title, date (YYYY-MM-DD), status (previous|upcoming), summary, matched_keywords, source_url, source_site`. Find items at bills.parliament.uk, gov.uk and parliament.uk (search the keywords). Only keep items whose title or text contains one of the keywords as a whole word (e.g. "trans", not "transport"). Optionally wrap as `{"last_updated":"YYYY-MM-DD","items":[...]}` to show a "last updated" date.
- **reports.json**: `{"last_updated":"YYYY-MM-DD","items":[{id,title,date,summary,report_url}]}`. The current rows are fake SAMPLE placeholders: replace them.
- **articles.json**: `id, keyword_sport_label, published_title, publication, date_published (YYYY-MM-DD, or text), date_published_sort (YYYY-MM-DD, used for ordering), summary, source_url, date_checked, confidence`. Find items by searching news sites for the sport and "transgender policy".
After editing any data file, bump `V` in `sw.js` (e.g. `sis-v2`) so installed apps refresh.

## 3. Donate links
Stripe Dashboard > Payment links > New. Make three: £5 one-time; £5 recurring monthly; "Customers choose what to pay" (suggest £10). Paste URLs into `STRIPE_LINKS` at the top of `app.js`.

## 4. Deploy free on GitHub Pages
1. Create a GitHub account, then New repository (public), e.g. `seen-in-sport`.
2. Upload every file in this folder to the repository root (Add file > Upload files). No subfolders.
3. Settings > Pages > Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`, Save.
4. After about a minute your app is at `https://<username>.github.io/seen-in-sport/`.
5. On a phone, open it and choose "Add to Home Screen". Load it once online so offline mode works.

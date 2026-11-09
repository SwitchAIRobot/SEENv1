"""One-time: add lat/lng to timetable.json using postcodes.io (free, no key). Needs internet.
Run after parse_timetable.py: python3 geocode_postcodes.py. Failures are appended to flagged_rows.csv."""
import csv, json, re, urllib.request, urllib.parse
rows = json.load(open("timetable.json")); cache = {}; failed = []
for r in rows:
    pc = r["postcode"]
    if not re.search(r"\d", pc or ""): failed.append((r["id"], "no postcode stated - add one in timetable.json or sessions.csv")); continue
    if pc not in cache:
        try:
            d = json.load(urllib.request.urlopen("https://api.postcodes.io/postcodes/" + urllib.parse.quote(pc), timeout=15))["result"]
            cache[pc] = (d["latitude"], d["longitude"], d.get("admin_district"))
        except Exception as e: cache[pc] = None
    if cache[pc]:
        r["lat"], r["lng"] = cache[pc][0], cache[pc][1]
        if r["area"] == "Not stated": r["area"] = cache[pc][2] or "Not stated"
    else: failed.append((r["id"], "postcodes.io lookup failed for " + pc))
json.dump(rows, open("timetable.json", "w"), indent=1, ensure_ascii=False)
with open("flagged_rows.csv", "a", newline="") as f:
    w = csv.writer(f)
    for i, why in failed: w.writerow([i, "", "", "geocode: " + why])
print(len(rows) - len(failed), "geocoded;", len(failed), "flagged")

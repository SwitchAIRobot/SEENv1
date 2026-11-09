"""One-time: convert sessions.csv -> timetable.json (+ flagged_rows.csv). Run: python3 parse_timetable.py"""
import csv, json, re
NS = "Not stated"
DAYS = {"monday","tuesday","wednesday","thursday","friday","saturday","sunday"}
def clean(v): v = (v or "").strip(); return v or NS
def iso(d):
    m = re.fullmatch(r"(\d\d)/(\d\d)/(\d{4})", d); return f"{m[3]}-{m[2]}-{m[1]}" if m else d
rows, flagged = [], []
for i, r in enumerate(csv.DictReader(open("sessions.csv", encoding="utf-8-sig")), 1):
    why = []
    day = clean(r["day"]).capitalize() if clean(r["day"]).lower() in DAYS else NS
    st, en = clean(r["start_time"]), clean(r["end_time"])
    if day == NS: why.append("day not stated")
    if not re.fullmatch(r"\d\d:\d\d", st): why.append("start time not stated"); st = NS
    if not re.fullmatch(r"\d\d:\d\d", en): en = NS
    venue = clean(r["venue"])
    if venue in (NS, "Not clear from captured text"): why.append("venue unclear")
    if "unclear" in venue or "per page" in venue: why.append("venue attribution uncertain")
    if not re.fullmatch(r"\d\d/\d\d/\d{4}", clean(r["date_or_recurrence"])) and clean(r["date_or_recurrence"]) not in ("Weekly",):
        why.append("recurrence is irregular: " + clean(r["date_or_recurrence"]))
    rows.append(dict(id=f"S{i:03d}", week_commencing=iso(clean(r["week_commencing"])), sport=clean(r["sport"]),
        session_name=clean(r["session_name"]), provider=clean(r["provider"]), venue=venue, area=NS,
        borough=clean(r["borough"]), region=clean(r["region"]), postcode=clean(r["postcode"]), lat=None, lng=None,
        date_or_recurrence=clean(r["date_or_recurrence"]), day=day, start_time=st, end_time=en,
        source_url=clean(r["source_url"]), confidence=clean(r["confidence"]), notes=clean(r["notes"])))
    if why: flagged.append(dict(id=f"S{i:03d}", venue=venue, session_name=r["session_name"], reason="; ".join(why)))
json.dump(rows, open("timetable.json", "w"), indent=1, ensure_ascii=False)
with open("flagged_rows.csv", "w", newline="") as f:
    w = csv.DictWriter(f, ["id", "venue", "session_name", "reason"]); w.writeheader(); w.writerows(flagged)
print(len(rows), "rows;", len(flagged), "flagged")

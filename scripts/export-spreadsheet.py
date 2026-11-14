"""Export the curated company database to data/spreadsheet.json.

Run from the repository root:
    uv run --with odfpy==1.4.1 --with pandas python scripts/export-spreadsheet.py

The spreadsheet is the source list. Its own location check ("On map") decides which
companies may be placed; the research script still matches every address to a building.
"""
import json
import math
from datetime import date, datetime

import pandas as pd

SOURCE = "data/helsinki-startups.ods"


def clean(value):
    if value is None or value is pd.NaT:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        value = " ".join(value.split())
        return value or None
    return value


def rows(frame):
    return [{key: clean(value) for key, value in row.items()} for row in frame.to_dict("records")]


companies = pd.read_excel(SOURCE, engine="odf", sheet_name="Companies", header=1)
rounds = pd.read_excel(SOURCE, engine="odf", sheet_name="Funding rounds")
investors = pd.read_excel(SOURCE, engine="odf", sheet_name="Investors")

out = {
    "source": SOURCE,
    "exportedAt": datetime.now().isoformat(timespec="seconds"),
    "companies": [c for c in rows(companies) if c.get("Company")],
    "fundingRounds": [r for r in rows(rounds) if r.get("Company")],
    "investors": [i for i in rows(investors) if i.get("Investor")],
}
with open("data/spreadsheet.json", "w") as handle:
    json.dump(out, handle, ensure_ascii=False, indent=1)
on_map = [c for c in out["companies"] if str(c.get("On map", "")).lower().startswith("yes")]
print(f"{len(out['companies'])} companies, {len(on_map)} marked for the map, {len(out['fundingRounds'])} funding rounds")

# Central Helsinki geographic data

© OpenStreetMap contributors. Source and derived databases are licensed under the
Open Database License 1.0 (ODbL): https://opendatacommons.org/licenses/odbl/1-0/
Attribution: https://www.openstreetmap.org/copyright

Files:
- source.osm.json: merged data from eight bounded https://api.openstreetmap.org/api/0.6/map requests (24.913–24.966° E, 60.1605–60.179° N). Retrieval time and geographic bounds are recorded inside the file.
- map.json: clipped, projected and triangulated derived database, including source IDs, height provenance and estimate policy.
- map-data.js: the same derived database as a browser module.

Rebuild from the repository root:

    python3 scripts/fetch-helsinki-osm.py
    uv run --with shapely==2.1.2 python scripts/build-helsinki-map.py
    node scripts/triangulate-helsinki.mjs
    node scripts/test-helsinki-map.mjs
    node scripts/build-address-index.mjs   # data/helsinki-addresses.json, used to place startups

Fetching is a manual development step, not a runtime dependency. To reproduce the
bundled snapshot, skip the fetch and use source.osm.json already present.

The geographic dataset is ODbL; this notice does not relicense unrelated application
code or artwork. Heights, road widths, roofs and terrain have documented limitations;
see docs/research/helsinki-map.md in the repository.

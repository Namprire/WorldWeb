# Central Helsinki geographic data

© OpenStreetMap contributors. Source and derived databases are licensed under the
Open Database License 1.0 (ODbL): https://opendatacommons.org/licenses/odbl/1-0/
Attribution: https://www.openstreetmap.org/copyright

Files:
- data/map/source.osm.json: merged data from 18 bounded https://api.openstreetmap.org/api/0.6/map requests (24.898 to 24.966° E, 60.151 to 60.179° N). Retrieval time and geographic bounds are recorded inside the file.
- map.json: clipped, projected and triangulated derived database, including source IDs, height provenance and estimate policy.

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

## City of Helsinki building register

data/map/register.json: building footprints with floor count, completion year, facade material and use, from the
City of Helsinki open data WFS (layer avoindata:Rakennukset_alue_rekisteritiedot), licensed CC BY 4.0.
Fetch with `node scripts/fetch-helsinki-register.mjs`. The map build matches each OpenStreetMap
footprint to the register footprint it overlaps most and uses its floors for height, its year and
material for facade colour, and its year for roof shape (pitched before 1932 unless OSM tags a shape).
OSM colour tags are used as a hint, blended with that palette.

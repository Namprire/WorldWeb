# Helsinki map research and implementation decision

## Brainstorm before implementation

The previous city was hand-authored. Adding buildings could improve density but could not make its streets or landmark positions accurate. Three approaches were considered:

1. **Keep the invented layout and decorate it:** quickest, but fails the geographic requirement.
2. **Import OpenStreetMap geometry:** practical for the existing engine; real footprints, roads, coastline, tram alignments and parks can share one coordinate system and collision map.
3. **Import Helsinki's official 3D city model:** preferable for surveyed building forms and terrain, but requires a separate CityGML/mesh conversion pipeline and level-of-detail work. It should be the next fidelity pass rather than a claim made about this implementation.

Selected option 2, with local, reproducible data and no live map dependency at game startup. The region spans 24.913–24.966° E and 60.1605–60.179° N, approximately 2.93 × 2.06 km. It contains Central Station, Oodi, Senate Square, Esplanadi, the Old Market Hall and South Harbour, and was widened west for STARTUP CITY to take in Kamppi, Ruoholahti and the Maria 01 campus.

## Sources consulted

- City of Helsinki, [Helsinki 3D](https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/helsinki-3d): official semantic CityGML and reality mesh options.
- City of Helsinki, [open geographic data](https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/make-better-use-of-geospatial-data/open-geographic-data): official geographic data services.
- [OpenStreetMap data and attribution](https://www.openstreetmap.org/copyright).
- [Overpass query reference](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL). The attempted Overpass endpoints were unavailable; data was successfully obtained through eight bounded OSM map API requests instead.
- [Shapely polygon operations](https://shapely.readthedocs.io/en/stable/manual.html) and [Three.js triangulation](https://threejs.org/docs/pages/ShapeUtils.html).

## What was implemented

- 1,851 clipped building footprints with source IDs and courtyard holes.
- 95 source-tagged landmark building parts, including the station clock tower and cathedral roof structures. Oodi and cathedral parent envelopes are replaced where mapped parts cover the footprint sufficiently.
- 14,238 mapped road/path/tram way segments, 990 park/grass polygons and 4,169 mapped tree positions. These are feature counts, not counts of distinct named streets or parks.
- Coastline-derived sea polygons plus mapped water areas. Polygon collision prevents riding into the sea.
- Local equirectangular coordinates in metres, east-positive X and south-positive Z. The original village's horizontal warp and vertical curvature are disabled for this geographic map.
- Polygon collision shared with visual footprints, including inner courtyards. Spatial indexing limits per-frame collision queries.
- 172 ambient pedestrians on 86 mapped public-path segments validated against buildings and water.
- Original intro mission retained on a clear corridor in Rautatientori. Other fictional mission terminals are snapped to mapped public paths near real destinations. No imported POI is presented as a verified food offer or commercial integration.
- OSM attribution on screen; source and derived databases ship with the project under ODbL.

## Accuracy limits

This is **geographically grounded, stylized 3D**, not a surveyed digital twin. The import retains horizontal geometry to approximately centimetre rounding within the local projection. It inherits OSM completeness and mapping errors. One metre of game X/Z corresponds to approximately one real metre; the projection itself is an approximation over this small area.

Only 29 building outlines have explicit height tags. 1,306 use mapped floor counts multiplied by an estimated 3.2 m; 516 use a clearly identified 16 m fallback. Landmark parts retain their own explicit height/level provenance. Ordinary roofs are flat, and supported landmark roof profiles are simplified interpretations of mapped shape tags. Facade materials, windows and colours are artistic. Terrain is level; stairs, bridges and elevation differences are not physically reconstructed. Road widths use mapped widths when present and type-based defaults otherwise. NPC behaviour and mission props are fictional.

The next accuracy step is official terrain plus CityGML LoD2 roofs, especially around slopes, stairs and landmark facades. It must preserve the current georeferencing instead of moving landmarks to suit gameplay.

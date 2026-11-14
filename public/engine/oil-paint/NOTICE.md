# Oil-paint graphics

Adapted from [blendi/oil-paint](https://patch.gg/blendi/oil-paint) by Patch,
MIT licensed, source commit `804c65fa3a6c6fcdc732ed1bde450fd140cfb4e9`.
Remix: https://patch.gg/nam-pham/oil-paint

`brush.js` retains the original eight-mark procedural brush generator. Its texture
constructor uses WEBWORLD's existing Three.js instance instead of importing another.
`surface.js` adapts the reference's brush-height relief, pigment streaks and
three-tone palette approach to WEBWORLD's existing surface shader. The canvas weave
is adapted from `src/oilpaint/finish.js`. This is a surface-material integration,
not the reference's full instanced-dab renderer. No demo character, physics or camera
code is imported. See LICENSE for the required MIT notice.

`reference/sky.js`, `paint.js`, `common.js`, `dabs.js` and `noise.js` are adapted
from the same reference commit. They supply its three aurora curtains, stars, moon,
noise and dab shaders. Changes: existing-engine type imports via `three.js`, expanded
vertex buffers instead of instanced geometry, use of the existing sky projection,
a 1,200m sky shell, and sky-wash/impasto/gain compensation for WEBWORLD's filmic finish.
The reference's globe geometry, separate renderer, character and physics are not used.

`autumn-sky.js` adapts the sky wash and camera-relative brush strokes from
`src/world/sky.js`. `foliage.js` adapts the five autumn pigment families,
layered crowns, backlighting and drifting leaves from `src/world/forest.js` and
`src/world/leaves.js`. These run on Helsinki's existing mapped tree centres,
with indexed brush cards batched into map tiles. The reference's woodland layout
and physics are not imported. `canopy-shade.js` adds a local ground-shadow atlas;
`environment.js` manages the two presentations without changing the map or player.

/* A static, world-space canopy shadow atlas. No extra render pass; only ground
   materials sample it. The shade uses the same mapped centres as the foliage. */
export function createCanopyShade(engine, trees, bounds) {
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=2048;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,2048,2048);
  const width=bounds.east-bounds.west,depth=bounds.south-bounds.north;
  const sx=2048/width,sz=2048/depth;
  for (const [x,z] of trees) {
    // The low sun is (-.44,.5,-.75). Its shadow falls southeast.
    const px=(x-bounds.west+6)*sx,py=(z-bounds.north+10)*sz;
    ctx.save();
    ctx.translate(px,py);ctx.scale(sx,sz);ctx.rotate(-.54);
    const shade=ctx.createRadialGradient(0,0,0,0,0,6);
    shade.addColorStop(0,"#35353bb3");
    shade.addColorStop(.5,"#37373b90");
    shade.addColorStop(1,"#37373b00");
    ctx.fillStyle=shade;ctx.scale(1,1.65);ctx.fillRect(-6,-6,12,12);
    ctx.restore();
  }
  const texture=new engine.Texture(canvas);
  texture.needsUpdate=true;
  engine.shared.tCanopyShade.value=texture;
  engine.shared.uCanopyBounds.value=[bounds.west,bounds.north,width,depth];
}

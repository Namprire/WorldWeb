export function instrument(){
  window.__study={shaders:[],textures:[],frames:[],contexts:[]};
  const c=window.__study;
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...a){const gl=get.apply(this,a); if(gl && a[0]==='webgl2') { const ext=gl.getExtension('WEBGL_debug_renderer_info'); c.contexts.push({version:gl.getParameter(gl.VERSION),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,maxTexture:gl.getParameter(gl.MAX_TEXTURE_SIZE)});}return gl;};
  const shader=WebGL2RenderingContext.prototype.shaderSource;
  WebGL2RenderingContext.prototype.shaderSource=function(s,src){c.shaders.push({type:this.getShaderParameter(s,this.SHADER_TYPE),source:src});return shader.call(this,s,src);};
  const tex=WebGL2RenderingContext.prototype.texImage2D;
  WebGL2RenderingContext.prototype.texImage2D=function(...a){const src=a[a.length-1];c.textures.push({width:typeof a[3]==='number'&&a.length>=9?a[3]:src?.width,height:typeof a[4]==='number'&&a.length>=9?a[4]:src?.height,arguments:a.length});return tex.apply(this,a);};
  let last=0;function tick(t){if(last)c.frames.push({t,dt:t-last});last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);
}

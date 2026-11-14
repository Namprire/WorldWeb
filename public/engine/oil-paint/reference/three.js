// Reuse the engine's existing Three.js types. No second renderer or Three bundle.
export {
  Ar as Vector2, jr as Vector3, Mr as Vector4, on as Matrix4,
  At as Color, Lt as DataTexture, Dt as BufferGeometry,
  Et as BufferAttribute, hr as ShaderMaterial, sn as Mesh, Xt as Group,
} from "../../../assets/kit-DsD4Rc8o.js";

// Three.js public enum values used by the imported effect.
export const GLSL3 = "300 es";
export const DoubleSide = 2;
export const AdditiveBlending = 2;
export const RepeatWrapping = 1000;
export const LinearFilter = 1006;
export const LinearMipmapLinearFilter = 1008;

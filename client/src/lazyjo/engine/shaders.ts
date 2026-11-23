// GLSL for the LAZY JO UNIVERSE. Kept in one place so the visual language
// (deep-space black, electric blue, neon cyan, cosmic purple) stays coherent.

export const SIMPLEX3D = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float f=0.0; float a=0.5;
  for(int i=0;i<5;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; }
  return f;
}
`;

/* ───────────── Sky (baked to a cubemap) ───────────── */
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* Baked ONCE into a cubemap (see Universe.buildSky): it can afford to be heavy.
   Deep black space, a tilted galactic band of domain-warped nebula with dark
   dust lanes, emission knots, unresolved star glow and a spiral galaxy. */
export const skyFrag = /* glsl */ `
uniform vec3 uBlue;
uniform vec3 uCyan;
uniform vec3 uPurple;
uniform vec3 uMagenta;
varying vec3 vDir;
${SIMPLEX3D}
float fbm4(vec3 p){ float f=0.0,a=0.5; for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.07; a*=0.5; } return f; }
float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }

vec3 galaxy(vec3 d){
  vec3 c = normalize(vec3(0.0, 0.5, -1.0));
  vec3 t1 = normalize(cross(c, vec3(0.0,1.0,0.0)));
  vec3 t2 = cross(t1, c);
  float k = dot(d, c);
  if (k < 0.95) return vec3(0.0);
  vec2 q = vec2(dot(d,t1), dot(d,t2)) / k;
  q = mat2(0.9,-0.44,0.44,0.9) * q;
  q.y *= 2.6;
  float r = length(q) * 11.0;
  float a = atan(q.y, q.x);
  float arms = pow(0.5 + 0.5 * cos(2.0 * a - 3.6 * log(r + 0.001)), 3.0);
  float clump = 0.6 + 0.4 * snoise(vec3(q * 60.0, 1.0));
  float disc = exp(-r * 1.25);
  float lane = 1.0 - 0.6 * smoothstep(0.0, 0.25, pow(0.5 + 0.5 * cos(2.0 * a - 3.6 * log(r + 0.001) + 0.9), 6.0)) * disc;
  float core = exp(-r * 7.0);
  vec3 armCol = mix(uPurple * 1.3, vec3(0.75, 0.82, 1.0), 0.45);
  return (armCol * disc * arms * clump * 1.2 + vec3(1.0, 0.92, 0.85) * core * 3.0) * lane;
}

void main(){
  vec3 d = normalize(vDir);
  // Galactic band: a great circle tilted across the sky, passing behind the UFO.
  vec3 bandN = normalize(vec3(0.22, 1.0, 0.18));
  float h = dot(d, bandN);
  float band = exp(-h * h / 0.05) + 0.22 * exp(-h * h / 0.35);
  float bandCore = exp(-h * h / 0.008);

  // Large soft clouds (gentle warp), with fine filaments only inside them.
  vec3 p = d * 1.15;
  vec3 q = vec3(fbm4(p), fbm4(p + vec3(5.2, 1.3, 2.8)), fbm4(p + vec3(1.7, 9.2, 3.1)));
  float n = fbm(p * 1.4 + 1.2 * q);
  float clouds = smoothstep(-0.05, 0.75, n);
  float detail = 0.6 + 0.55 * fbm4(d * 5.5 + q * 2.2);
  float dens = clouds * detail * band;

  vec3 col = mix(uPurple * 0.85, uBlue, smoothstep(-0.3, 0.4, q.x));
  col = mix(col, uMagenta, smoothstep(0.1, 0.5, q.y) * 0.45);
  vec3 neb = col * pow(dens, 1.5) * 1.15;
  // bright emission knots where the cloud is densest
  neb += mix(uCyan, vec3(1.0), 0.4) * pow(smoothstep(0.5, 1.0, n), 3.0) * band * 0.6;
  // unresolved stars along the band (milky-way glow)
  neb += vec3(0.72, 0.78, 1.0) * (bandCore * 0.06 + band * 0.018) * (0.55 + 0.45 * fbm4(d * 14.0));
  // soft, broad dark dust lanes drifting through the band
  float lane = smoothstep(0.05, 0.55, fbm4(d * 2.6 + q * 1.3)) * smoothstep(0.05, 0.5, band);
  neb *= 1.0 - 0.7 * lane;

  vec3 outc = vec3(0.004, 0.006, 0.014) + neb + galaxy(d);

  // faint background star dust (crisp stars are separate geometry)
  vec3 sp = d * 700.0;
  float hs = hash(floor(sp));
  float star = step(0.993, hs) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5));
  outc += vec3(0.8, 0.85, 1.0) * star * (0.15 + 0.35 * band);

  gl_FragColor = vec4(outc, 1.0);
}
`;

/* Crisp, far-away stars: fixed pixel size, no parallax, real colour temperatures. */
export const farStarsVert = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vTw;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vTw = 0.82 + 0.18 * sin(uTime * (0.5 + aSeed * 3.0) + aSeed * 50.0);
  vColor = aColor;
  gl_PointSize = aSize * uPixelRatio;
}
`;

export const farStarsFrag = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vTw;
void main(){
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb * vTw, t.a);
}
`;

/* ───────────── Wrapping star field ───────────── */
export const starsVert = /* glsl */ `
uniform float uCamZ;
uniform float uDepth;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
attribute float aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec3 p = position;
  float rel = mod(p.z - uCamZ - 6.0, uDepth) - uDepth;   // [-depth, 0)
  p.z = uCamZ + 6.0 + rel;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.7 + 0.3 * sin(uTime * (0.6 + aSeed * 2.5) + aSeed * 40.0);
  float fadeFar = smoothstep(uDepth, uDepth * 0.7, -rel);
  float fadeNear = smoothstep(0.0, 8.0, -rel);
  vAlpha = tw * fadeFar * fadeNear;
  vColor = aColor;
  gl_PointSize = uSize * (0.6 + aSeed) * uPixelRatio * (60.0 / -mv.z);
}
`;

export const starsFrag = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
}
`;

/* ───────────── Warp streaks (stretch with speed) ───────────── */
export const streakVert = /* glsl */ `
uniform float uCamZ;
uniform float uDepth;
uniform float uStretch;
attribute float aTail;
attribute float aSeed;
varying float vAlpha;
varying float vTail;
void main(){
  vec3 p = position;
  float rel = mod(p.z - uCamZ - 4.0, uDepth) - uDepth;
  p.z = uCamZ + 4.0 + rel + aTail * uStretch * (0.6 + aSeed);
  vTail = aTail;
  vAlpha = smoothstep(uDepth, uDepth*0.5, -rel) * smoothstep(0.0, 6.0, -rel);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const streakFrag = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vAlpha;
varying float vTail;
void main(){
  gl_FragColor = vec4(uColor * 1.6, (1.0 - vTail) * vAlpha * uOpacity);
}
`;

/* ───────────── Light trails: the "cosmic highway" with no road ───────────── */
export const lanesVert = /* glsl */ `
uniform float uCamZ;
varying vec2 vPos;     // x, world z
varying float vDist;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPos = vec2(w.x, w.z);
  vDist = uCamZ - w.z;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const lanesFrag = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform vec3 uCyan;
uniform vec3 uBlue;
uniform vec3 uPurple;
varying vec2 vPos;
varying float vDist;

float line(float x, float c, float w){ return exp(-pow((x - c) / w, 2.0)); }

void main(){
  // Faint light trails, not a road: thin, sparse, and they fade out
  // before they reach the camera so the foreground stays dark.
  float ax = abs(vPos.x);
  float z = vPos.y;
  float flow = z + uTime * 22.0;
  float pulseA = smoothstep(0.82, 1.0, fract(flow * 0.025));
  float pulseB = smoothstep(0.9, 1.0, fract((flow + 13.0) * 0.04));
  float lanes = line(ax, 3.4, 0.035) * (0.12 + 0.55 * pulseA)
              + line(ax, 8.0, 0.05) * (0.06 + 0.5 * pulseB)
              + line(ax, 13.5, 0.08) * (0.04 + 0.3 * pulseA);
  float fade = smoothstep(240.0, 60.0, vDist) * smoothstep(6.0, 40.0, vDist);
  vec3 col = mix(uBlue, vec3(0.75, 0.95, 1.0), 0.35) * lanes * (1.0 + uSpeed * 0.8);
  gl_FragColor = vec4(col, clamp(lanes, 0.0, 1.0) * fade);
}
`;

/* ───────────── Backlight behind each sleeve ───────────── */
export const holoVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

export const holoFrag = /* glsl */ `
uniform float uTime;
uniform float uGlow;
uniform float uOpacity;
uniform float uInner;      // fraction of the plane covered by the artwork
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;
void main(){
  // Soft backlight spilling from behind the sleeve (not a neon box).
  vec2 q = abs(vUv - 0.5) * 2.0;
  float box = max(q.x, q.y);
  float halo = smoothstep(1.0, uInner, box) * step(uInner - 0.01, box);
  float rim = exp(-pow((box - uInner) / 0.012, 2.0));
  float t = 0.5 + 0.5 * sin(uTime * 0.6 + vUv.x * 2.0 + vUv.y * 2.0);
  vec3 col = mix(uColorA, uColorB, t);
  float a = (halo * halo * 0.55 + rim * 0.5) * uGlow;
  gl_FragColor = vec4(col * 1.2, clamp(a, 0.0, 1.0) * uOpacity);
}
`;

/* ───────────── UFO tractor beam ───────────── */
export const beamVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const beamFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uBoost;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main(){
  float y = vUv.y;                               // 1 at the UFO, 0 at the bottom
  float fres = abs(dot(normalize(-vViewPos), vNormalV));
  float body = pow(fres, 1.6);
  float rings = 0.8 + 0.2 * sin(y * 48.0 + uTime * 6.0);
  float flicker = 0.9 + 0.1 * sin(uTime * 23.0);
  float fall = pow(y, 1.4);
  vec3 col = mix(uColor, uCore, body * fall);
  float a = body * fall * rings * flicker * (0.3 + uBoost);
  gl_FragColor = vec4(col * 1.2, a);
}
`;

/* ───────────── Planet surface + atmosphere ───────────── */
export const planetVert = /* glsl */ `
varying vec3 vWN;     // world normal
varying vec3 vP;      // object-space position (noise rotates with the planet)
varying vec3 vWPos;
varying vec3 vVN;     // view normal
void main(){
  vWN = normalize(mat3(modelMatrix) * normal);
  vVN = normalize(normalMatrix * normal);
  vP = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWPos = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const planetFrag = /* glsl */ `
uniform vec3 uSun;       // world-space direction TO the sun
uniform vec3 uAtmo;
uniform float uSeed;
uniform float uType;     // 0 ocean world, 1 moon, 2 gas giant
uniform float uTime;
varying vec3 vWN;
varying vec3 vP;
varying vec3 vWPos;
varying vec3 vVN;
${SIMPLEX3D}
void main(){
  vec3 p = normalize(vP);
  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWPos);
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.08, 0.3, ndl);
  vec3 col;

  if (uType < 0.5) {
    float c = fbm(p * 2.1 + uSeed);
    float land = smoothstep(0.2, 0.26, c);
    float ice = smoothstep(0.78, 0.9, abs(p.y));
    vec3 ocean = mix(vec3(0.005, 0.02, 0.07), vec3(0.02, 0.09, 0.22), 0.5 + 0.5 * fbm(p * 7.0));
    vec3 ground = mix(vec3(0.06, 0.05, 0.035), vec3(0.2, 0.16, 0.11), smoothstep(0.25, 0.6, c));
    vec3 surf = mix(mix(ocean, ground, land), vec3(0.8, 0.86, 0.95), ice);
    vec3 cp = p * vec3(2.6, 6.5, 2.6) + vec3(uTime * 0.004, 0.0, uSeed);
    float cl = smoothstep(0.15, 0.75, fbm(cp + 0.6 * fbm(p * 4.0)));
    cl *= 0.55 + 0.45 * fbm(p * 14.0);
    surf = mix(surf, vec3(0.88, 0.92, 1.0), cl * 0.7);
    vec3 R = reflect(-uSun, N);
    float spec = pow(max(dot(R, V), 0.0), 60.0) * (1.0 - land) * (1.0 - cl) * 0.9;
    col = surf * (0.015 + 1.1 * max(ndl, 0.0)) + vec3(0.7, 0.85, 1.0) * spec * day;
    float city = smoothstep(0.55, 0.75, snoise(p * 55.0 + uSeed)) * land * (1.0 - ice) * (1.0 - cl);
    col += vec3(1.0, 0.72, 0.42) * city * (1.0 - day) * 0.7;
  } else if (uType < 1.5) {
    float maria = smoothstep(-0.1, 0.4, fbm(p * 1.8 + uSeed));
    float crat = smoothstep(0.62, 0.7, 1.0 - abs(snoise(p * 9.0 + uSeed))) * 0.25;
    vec3 surf = mix(vec3(0.42, 0.42, 0.44), vec3(0.18, 0.18, 0.2), maria) * (1.0 - crat);
    surf *= 0.85 + 0.15 * fbm(p * 22.0);
    col = surf * (0.01 + 1.2 * max(ndl, 0.0));
  } else {
    float turb = fbm(p * 3.0 + uSeed) * 0.35;
    float b = sin((p.y + turb) * 18.0) * 0.5 + 0.5;
    vec3 surf = mix(vec3(0.16, 0.1, 0.32), vec3(0.55, 0.42, 0.8), b);
    surf = mix(surf, vec3(0.85, 0.8, 0.95), smoothstep(0.75, 1.0, b) * 0.4);
    col = surf * (0.01 + 1.1 * max(ndl, 0.0));
  }

  // atmosphere scattering on the lit limb (none on the moon)
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uAtmo * fres * smoothstep(-0.25, 0.5, ndl) * (uType > 0.5 && uType < 1.5 ? 0.0 : 1.3);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const atmoFrag = /* glsl */ `
uniform vec3 uAtmo;
uniform vec3 uSun;
varying vec3 vWN;
varying vec3 vP;
varying vec3 vWPos;
varying vec3 vVN;
void main(){
  // thin halo just outside the silhouette, brightest on the sunward side
  float k = pow(clamp(0.72 - dot(vVN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0);
  float lit = smoothstep(-0.35, 0.6, dot(normalize(vWN), uSun));
  gl_FragColor = vec4(uAtmo * 1.5, k * lit * 2.2);
}
`;

/* Final pass (after tone mapping, in display space): radial motion blur,
   chromatic aberration, a gentle filmic grade, vignette and grain. */
export const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uBlur: { value: 0 },
    uAberration: { value: 0.0015 },
    uVignette: { value: 1.0 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uBlur;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uTime;
    uniform float uFlash;
    varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      vec3 col = vec3(0.0);
      float strength = uBlur * smoothstep(0.1, 0.6, dist);
      const int N = 9;
      for (int i = 0; i < N; i++) {
        float t = float(i) / float(N - 1);
        vec2 uv = vUv - dir * strength * t * 0.12;
        float ab = uAberration * (1.0 + uBlur * 2.0) * dist;
        col.r += texture2D(tDiffuse, uv + dir * ab).r;
        col.g += texture2D(tDiffuse, uv).g;
        col.b += texture2D(tDiffuse, uv - dir * ab).b;
      }
      col /= float(N);
      // filmic grade: deeper blacks, gentle S-curve, a touch more saturation
      col = max(col - 0.012, 0.0) / 0.988;
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.28);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.08);
      float vig = smoothstep(0.95, 0.3, dist * uVignette);
      col *= mix(0.45, 1.0, vig);
      col += (rand(vUv * 1000.0 + fract(uTime)) - 0.5) * 0.022;
      col += vec3(0.4, 0.85, 1.0) * uFlash;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

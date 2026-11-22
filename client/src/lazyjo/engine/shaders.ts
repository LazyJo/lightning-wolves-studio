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

/* ───────────── Nebula sky dome (follows the camera → infinitely far) ───────────── */
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  gl_Position = p.xyww; // pin to far plane
}
`;

export const skyFrag = /* glsl */ `
uniform float uTime;
uniform float uTravel;
uniform vec3 uBlue;
uniform vec3 uCyan;
uniform vec3 uPurple;
uniform vec3 uDeep;
varying vec3 vDir;
${SIMPLEX3D}
float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }

float galaxy(vec3 d){
  // Spiral galaxy hanging above the vanishing point (like the key art).
  vec3 c = normalize(vec3(0.0, 0.48, -1.0));
  vec3 t1 = normalize(cross(c, vec3(0.0,1.0,0.0)));
  vec3 t2 = cross(t1, c);
  float k = dot(d, c);
  if (k < 0.9) return 0.0;
  vec2 q = vec2(dot(d,t1), dot(d,t2)) / k;
  q = mat2(0.94,-0.34,0.34,0.94) * q;
  q.y *= 2.2; // tilt the disc
  float r = length(q) * 9.0;
  float a = atan(q.y, q.x);
  float arms = 0.5 + 0.5 * cos(2.0 * a - 3.2 * log(r + 0.0001) + uTime * 0.03);
  float disc = exp(-r * 1.15);
  float core = exp(-r * 6.0);
  return disc * pow(arms, 2.2) * 1.4 + core * 2.6;
}

void main(){
  vec3 d = normalize(vDir);
  // Slowly scroll the noise field as we travel, for a subtle sense of motion.
  vec3 p = d * 2.2 + vec3(0.0, 0.0, uTravel * 0.0006);
  float n1 = fbm(p + vec3(0.0, uTime*0.004, 0.0));
  float n2 = fbm(p * 1.9 + vec3(4.2, 1.3, -uTime*0.003));
  float n3 = fbm(p * 4.0 + n1);

  // Bands of nebula swirling around the flight axis, strongest near horizon.
  float horizon = 1.0 - abs(d.y);
  float forward = smoothstep(-0.2, 1.0, -d.z);
  float mask = smoothstep(0.1, 1.0, n1 + 0.3) * (0.3 + 0.7 * horizon);
  float wisps = smoothstep(0.1, 0.8, n2) * (0.5 + 0.5 * n3);

  vec3 col = uDeep;
  col += uPurple * mask * 0.32;
  col += uBlue * wisps * mask * 0.42;
  col += uCyan * pow(max(n3,0.0), 3.0) * mask * 0.5;
  // glow at the vanishing point
  float vp = pow(max(-d.z, 0.0), 22.0);
  col += mix(uCyan, uPurple, 0.35) * vp * 0.22;
  col += uBlue * pow(max(-d.z,0.0), 4.0) * 0.04;

  // galaxy
  float g = galaxy(d);
  col += mix(uPurple, vec3(1.0,0.9,1.0), clamp(g*0.5,0.0,1.0)) * g * 0.55;

  // far stars
  vec3 sp = d * 420.0;
  vec3 cell = floor(sp);
  float h = hash(cell);
  float star = step(0.9965, h) * smoothstep(0.55, 0.0, length(fract(sp)-0.5));
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h*4.0) + h*60.0);
  col += vec3(0.85,0.92,1.0) * star * tw * 1.6;

  col *= 0.75 + 0.25 * forward;
  gl_FragColor = vec4(col, 1.0);
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

/* ───────────── Energy trails: the "cosmic highway" with no road ───────────── */
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
  float x = vPos.x;
  float ax = abs(x);
  float z = vPos.y;
  float flow = z + uTime * 18.0;   // pulses rush toward the UFO

  float lanes = 0.0;
  // thin dim pair hugging the centre line
  lanes += line(ax, 1.4, 0.035) * 0.35;
  // main glowing lanes
  float dashA = smoothstep(0.35, 0.5, fract(flow * 0.045)) * smoothstep(1.0, 0.85, fract(flow * 0.045));
  lanes += line(ax, 3.4, 0.06) * (0.35 + 0.9 * dashA);
  float dashB = smoothstep(0.6, 0.62, fract((flow + 7.0) * 0.08)) * smoothstep(1.0, 0.7, fract((flow + 7.0) * 0.08));
  lanes += line(ax, 7.6, 0.09) * (0.25 + 1.1 * dashB);
  lanes += line(ax, 12.5, 0.14) * (0.15 + 0.6 * dashA);
  // faint ribbon of light under the flight path
  float ribbon = exp(-ax * ax * 0.12) * (0.06 + 0.04 * sin(z * 0.15 + uTime));

  // little data-ticks between lanes (HUD-like)
  float ticks = step(0.92, fract(z * 0.25)) * line(ax, 5.4, 0.25) * 0.25;

  float fade = smoothstep(220.0, 40.0, vDist) * smoothstep(0.0, 6.0, vDist);
  vec3 col = mix(uBlue, uCyan, line(ax, 3.4, 0.6)) * lanes;
  col += uPurple * ribbon * 0.7;
  col += uCyan * ticks;
  col *= 1.0 + uSpeed * 0.5;
  float a = clamp(lanes + ribbon + ticks, 0.0, 1.0) * fade;
  gl_FragColor = vec4(col * 0.95, a);
}
`;

/* ───────────── Holographic frame behind each cover ───────────── */
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
  vec2 q = abs(vUv - 0.5) * 2.0;           // 0 centre → 1 edge
  float box = max(q.x, q.y);
  float edge = smoothstep(uInner - 0.02, uInner + 0.01, box) * (1.0 - smoothstep(0.985, 1.0, box));
  float rim = exp(-pow((box - uInner) / 0.03, 2.0));
  float outer = smoothstep(1.0, uInner, box);
  float sweep = smoothstep(0.08, 0.0, abs(fract(vUv.y * 0.5 - uTime * 0.18) - 0.5));
  float t = 0.5 + 0.5 * sin(uTime * 0.8 + vUv.x * 3.0 + vUv.y * 2.0);
  vec3 col = mix(uColorA, uColorB, t);
  float a = (rim * 1.0 + edge * outer * 0.25 + sweep * edge * 0.4) * uGlow;
  gl_FragColor = vec4(col * (0.6 + uGlow * 0.7), clamp(a, 0.0, 1.0) * uOpacity);
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
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main(){
  float y = vUv.y;                               // 1 at the UFO, 0 at the bottom
  float fres = abs(dot(normalize(-vViewPos), vNormalV));
  float body = pow(fres, 1.6);
  float rings = 0.55 + 0.45 * sin(y * 48.0 + uTime * 6.0);
  float flicker = 0.9 + 0.1 * sin(uTime * 23.0);
  float fall = pow(y, 1.4);
  vec3 col = mix(uColor, uCore, body * fall);
  float a = body * fall * rings * flicker * 0.3;
  gl_FragColor = vec4(col * 1.2, a);
}
`;

/* ───────────── Planet surface + atmosphere ───────────── */
export const planetVert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec3 vViewDir;
void main(){
  vN = normalize(normalMatrix * normal);
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const planetFrag = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uRim;
uniform vec3 uLight;     // view-space light dir
uniform float uSeed;
uniform float uCity;
varying vec3 vN;
varying vec3 vP;
varying vec3 vViewDir;
${SIMPLEX3D}
void main(){
  vec3 p = normalize(vP);
  float n = fbm(p * 3.0 + uSeed);
  float bands = sin(p.y * 14.0 + n * 3.0) * 0.5 + 0.5;
  vec3 base = mix(uA, uB, bands * 0.6 + n * 0.4);
  float lit = clamp(dot(vN, normalize(uLight)), 0.0, 1.0);
  float term = smoothstep(0.0, 0.35, lit);
  vec3 col = base * (0.04 + 0.9 * term);
  // city lights on the dark side
  float city = step(0.62, snoise(p * 40.0 + uSeed)) * (1.0 - term) * uCity;
  col += vec3(0.4, 0.75, 1.0) * city * 0.8;
  float fres = pow(1.0 - max(dot(vN, vViewDir), 0.0), 3.0);
  col += uRim * fres * (0.4 + 0.8 * lit) * 1.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const atmoFrag = /* glsl */ `
uniform vec3 uRim;
varying vec3 vN;
varying vec3 vP;
varying vec3 vViewDir;
void main(){
  float fres = pow(1.0 - abs(dot(vN, vViewDir)), 2.5);
  gl_FragColor = vec4(uRim * 1.6, fres * 0.8);
}
`;

/* ───────────── Final cinematic pass: radial motion blur, CA, vignette, grain ───────────── */
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
      // Radial (zoom) blur — centre stays sharp, edges streak with speed.
      float strength = uBlur * smoothstep(0.08, 0.6, dist);
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
      float vig = smoothstep(0.95, 0.25, dist * uVignette);
      col *= mix(0.55, 1.0, vig);
      col += (rand(vUv * 1000.0 + uTime) - 0.5) * 0.018;
      col += vec3(0.4, 0.85, 1.0) * uFlash;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

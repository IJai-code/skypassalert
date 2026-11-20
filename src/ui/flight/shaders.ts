// GLSL for the Flight (WebGL2, GLSL ES 3.00). Every program draws something
// computed: the sky from the Sun's real altitude, Earth lit by the real Sun,
// the real stars, the station's real path. No textures, no noise, no glow
// for its own sake.
// Learn: docs/learn/16-the-flight.md#gpu

/** Shared camera maths: world (km) → clip space, with no depth buffer. */
const CAMERA = /* glsl */ `
uniform vec3 u_eye;
uniform float u_eyeAlt;
uniform float u_R;
uniform vec3 u_right;
uniform vec3 u_up;
uniform vec3 u_fwd;
uniform vec2 u_tan;   // tan(half fov) across, up
uniform float u_red;  // 1 = night-vision red

// z is fixed at 0: with w > 0 that is always inside the clip volume, so the
// GPU still clips everything behind the camera and nothing else. We don't
// need a depth buffer; Earth hides things analytically (see hidden()).
vec4 clipOf(vec3 v) {
  return vec4(dot(v, u_right) / u_tan.x, dot(v, u_up) / u_tan.y, 0.0, dot(v, u_fwd));
}
vec4 clipPoint(vec3 p) { return clipOf(p - u_eye); }
vec4 clipDir(vec3 d) { return clipOf(d); }

// Ray from the eye hits Earth before distance maxT? Same careful form as the
// background: c = h(2R + h), never |o|² − R² (float32 would cancel it to noise).
bool hidden(vec3 dir, float maxT) {
  vec3 oc = u_eye - vec3(0.0, 0.0, -u_R);
  float b = dot(oc, dir);
  float c = u_eyeAlt * (2.0 * u_R + u_eyeAlt);
  float disc = b * b - c;
  if (disc < 0.0) return false;
  float t = -b - sqrt(disc);
  return t > 0.0 && t < maxT;
}
`

const RED = /* glsl */ `
vec3 night(vec3 c) {
  float l = max(c.r, max(c.g, c.b));
  return mix(c, vec3(l * 0.82, l * 0.09, l * 0.06), u_red);
}
`

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 v_ndc;
void main() {
  // One triangle that covers the screen.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  v_ndc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}
`

export const BACKGROUND_FS = /* glsl */ `#version 300 es
precision highp float;
${CAMERA}
${RED}
uniform vec3 u_sun;      // unit vector to the Sun
uniform vec3 u_zenith;   // sky colours for the Sun's altitude at the eye
uniform vec3 u_horizon;
uniform float u_glow;    // afterglow strength towards the Sun
uniform float u_space;   // 0 on the ground, 1 above the air
uniform vec3 u_paper;    // the page's paper colour (the ground you stand on)
uniform mat3 u_toEcef;   // your frame → Earth-fixed, to look up the textures
uniform sampler2D u_surface; // land and sea colours
uniform sampler2D u_night;   // r: city lights, g: sea mask
uniform float u_textured;    // 0 until the textures are painted
uniform float u_fade;        // 0 → 1 as the film first appears
in vec2 v_ndc;
out vec4 o;

const float PI = 3.14159265;
const vec3 NIGHT_SIDE = vec3(0.025, 0.035, 0.06);
const vec3 TWILIGHT = vec3(0.9, 0.45, 0.2);
const vec3 AIR = vec3(0.35, 0.6, 1.0);
const vec3 GLOW = vec3(1.0, 0.67, 0.43);
const vec3 CITY = vec3(1.0, 0.72, 0.4);
const vec3 SUN = vec3(1.0, 0.96, 0.88);

vec3 globe(vec3 n, vec3 rd) {
  float l = dot(n, u_sun);
  vec3 e = u_toEcef * n;
  vec2 uv = vec2(atan(e.y, e.x) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(e.z, -1.0, 1.0)) / PI);
  vec3 albedo = mix(vec3(0.1, 0.16, 0.24), texture(u_surface, uv).rgb, u_textured);
  vec2 night = texture(u_night, uv).rg * u_textured;
  // Daylight with a soft edge; the band of dusk across the terminator.
  float day = smoothstep(-0.06, 0.35, l);
  vec3 col = mix(NIGHT_SIDE, albedo * (0.25 + 1.05 * max(l, 0.0)), day);
  col += TWILIGHT * smoothstep(-0.14, 0.0, l) * (1.0 - smoothstep(0.0, 0.1, l)) * 0.16;
  // Sunlight glinting off the sea.
  vec3 h = normalize(u_sun - rd);
  col += SUN * pow(max(dot(n, h), 0.0), 80.0) * night.g * step(0.0, l) * 0.9;
  // City lights, only where it's night. Close up, the texture runs out of
  // detail; raising it to a power narrows each soft blob back to a point.
  float close = 1.0 - smoothstep(400.0, 3500.0, u_eyeAlt);
  float lights = pow(night.r, 1.0 + 2.5 * close);
  col += CITY * lights * (1.0 - smoothstep(-0.12, 0.04, l)) * 1.25;
  // The air seen edge-on: a rim of blue on the day side, warm at the terminator.
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  float litRim = smoothstep(-0.25, 0.35, l);
  col += mix(TWILIGHT, AIR, smoothstep(0.0, 0.4, l)) * rim * litRim * 0.75;
  return col;
}

void main() {
  vec3 rd = normalize(u_fwd + v_ndc.x * u_tan.x * u_right + v_ndc.y * u_tan.y * u_up);
  vec3 oc = u_eye - vec3(0.0, 0.0, -u_R);
  vec3 upEye = normalize(oc);
  float b = dot(oc, rd);
  float c = u_eyeAlt * (2.0 * u_R + u_eyeAlt);
  float disc = b * b - c;
  float t = disc >= 0.0 ? -b - sqrt(disc) : -1.0;
  float e = dot(rd, upEye); // sine of the ray's elevation at the eye
  vec3 col;

  if (t > 0.0) {
    vec3 n = normalize(oc + rd * t);
    // Standing in the yard, the ground is the page itself.
    col = mix(u_paper, globe(n, rd), u_space);
  } else {
    // Sky: horizon colour low down, zenith colour overhead, a warm glow
    // above where the Sun is (even when it has set).
    vec3 sky = mix(u_horizon, u_zenith, smoothstep(0.0, 0.55, max(e, 0.0)));
    vec3 sh = u_sun - upEye * dot(u_sun, upEye);
    vec3 rh = rd - upEye * e;
    float toward = max(dot(normalize(sh + 1e-6), normalize(rh + 1e-6)), 0.0);
    sky += GLOW * u_glow * 0.35 * pow(toward, 5.0) * exp(-max(e, 0.0) * 7.0);

    // From space: black, with the shell of air glowing where the Sun lights it.
    float closest = sqrt(max(dot(oc, oc) - b * b, 0.0)) - u_R;
    vec3 limbN = normalize(oc - rd * b);
    float air = exp(-max(closest, 0.0) / 60.0) * step(b, 0.0);
    float lit = smoothstep(-0.2, 0.3, dot(limbN, u_sun));
    vec3 tint = mix(TWILIGHT, AIR, smoothstep(-0.05, 0.3, dot(limbN, u_sun)));
    vec3 space = tint * air * lit * 1.1;
    // The Sun itself (0.53° across), bright enough to bloom.
    float sd = dot(rd, u_sun);
    space += SUN * (smoothstep(0.99996, 0.99999, sd) * 3.0 + pow(max(sd, 0.0), 900.0) * 0.6);
    col = mix(sky, space, u_space);
  }

  // The horizon as one hairline, at every height: where a ray just grazes
  // the ball. Its elevation is −√c/|o| (c = h(2R + h)); in the yard that is
  // the familiar dip √(2h/R), from orbit it is Earth's curved edge.
  float d = e + sqrt(c) / length(oc);
  float line = 1.0 - smoothstep(0.0, 1.5 * fwidth(d), abs(d));
  col = mix(col, vec3(0.66, 0.70, 0.80), line * 0.35 * (1.0 - u_space));

  o = vec4(night(col) * u_fade, 1.0);
}
`

export const STARS_VS = /* glsl */ `#version 300 es
${CAMERA}
in vec3 a_dir;       // unit vector at a reference time
in float a_mag;
in vec3 a_tint;
uniform mat3 u_spin; // the sky's turn since the reference time
uniform float u_limit;
uniform float u_dpr;
out vec4 v_col;
void main() {
  vec3 d = u_spin * a_dir;
  float a = clamp((u_limit - a_mag) / 1.4, 0.0, 1.0);
  if (hidden(d, 1e9)) a = 0.0;
  v_col = vec4(a_tint, a);
  gl_Position = clipDir(d);
  gl_PointSize = clamp(4.4 - 0.75 * a_mag, 1.5, 6.5) * u_dpr;
}
`

export const STARS_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_red;
${RED}
in vec4 v_col;
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = v_col.a * (1.0 - smoothstep(0.5, 1.0, r));
  o = vec4(night(v_col.rgb) * a, a);
}
`

export const LINES_VS = /* glsl */ `#version 300 es
${CAMERA}
in vec3 a_pos;
in vec4 a_col;
uniform float u_alpha;
uniform bool u_surface; // points lying on Earth's surface (coastlines)
out vec4 v_col;
void main() {
  vec3 rel = a_pos - u_eye;
  float a = a_col.a * u_alpha;
  if (u_surface) {
    // On the surface: visible when the ground there faces the eye.
    vec3 n = normalize(a_pos - vec3(0.0, 0.0, -u_R));
    if (dot(n, -rel) < 0.0) a = 0.0;
  } else if (hidden(normalize(rel), length(rel) * 0.999)) {
    a = 0.0;
  }
  v_col = vec4(a_col.rgb, a);
  gl_Position = clipPoint(a_pos);
}
`

export const LINES_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_red;
${RED}
in vec4 v_col;
out vec4 o;
void main() { o = vec4(night(v_col.rgb), v_col.a); }
`

/**
 * The pass as a ribbon: each point on the path is pushed sideways on the
 * screen by half the width, so it stays the same thickness however far away
 * the path is (3 px in your sky, 3 px from orbit).
 */
export const TRAIL_VS = /* glsl */ `#version 300 es
${CAMERA}
in vec3 a_pos;
in vec3 a_other;  // the neighbouring point, to find the direction of travel
in float a_side;  // −1 or +1
in float a_t;     // seconds since the pass began
in float a_bright;
uniform vec2 u_px;    // screen size in device pixels
uniform float u_width;
uniform float u_clock;
uniform float u_alpha;
out float v_side;
out float v_a;
void main() {
  vec4 c0 = clipPoint(a_pos);
  vec4 c1 = clipPoint(a_other);
  vec2 s0 = c0.xy / max(c0.w, 1e-6) * u_px;
  vec2 s1 = c1.xy / max(c1.w, 1e-6) * u_px;
  vec2 dir = normalize(s1 - s0 + vec2(1e-6, 0.0));
  vec2 n = vec2(-dir.y, dir.x) * (a_side < 0.0 ? -1.0 : 1.0);
  c0.xy += n * u_width / u_px * c0.w;
  gl_Position = c0;
  v_side = a_side;
  // Bright where the station has already been; a faint thread ahead.
  float done = step(a_t, u_clock);
  float a = mix(0.22, a_bright, done) * u_alpha;
  vec3 rel = a_pos - u_eye;
  if (hidden(normalize(rel), length(rel) * 0.999)) a = 0.0;
  v_a = a;
}
`

export const TRAIL_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_red;
uniform vec3 u_color;
${RED}
in float v_side;
in float v_a;
out vec4 o;
void main() {
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(v_side));
  float a = v_a * edge;
  o = vec4(night(u_color) * a, a);
}
`

/** Round markers: the station, the Moon, planets, you. */
export const SPRITES_VS = /* glsl */ `#version 300 es
${CAMERA}
in vec4 a_pos;   // xyz, w = 1 for a point in the world, 0 for a direction
in vec4 a_col;
in float a_size;
in float a_ring; // 1 = draw as an outline ring
uniform float u_dpr;
out vec4 v_col;
out float v_ring;
void main() {
  float a = a_col.a;
  if (a_pos.w > 0.5) {
    vec3 rel = a_pos.xyz - u_eye;
    if (hidden(normalize(rel), length(rel) * 0.999)) a = 0.0;
    gl_Position = clipPoint(a_pos.xyz);
  } else {
    if (hidden(a_pos.xyz, 1e9)) a = 0.0;
    gl_Position = clipDir(a_pos.xyz);
  }
  v_col = vec4(a_col.rgb, a);
  v_ring = a_ring;
  gl_PointSize = a_size * u_dpr;
}
`

export const SPRITES_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_red;
${RED}
in vec4 v_col;
in float v_ring;
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float disc = 1.0 - smoothstep(0.55, 1.0, r);
  // The core is solid; a short soft edge suggests brightness without a halo.
  float ring = smoothstep(0.62, 0.74, r) * (1.0 - smoothstep(0.86, 1.0, r));
  float a = v_col.a * mix(disc, ring, v_ring);
  o = vec4(night(v_col.rgb) * a, a);
}
`

/** Bloom, step 1: keep only what's brighter than the threshold, at half size. */
export const BRIGHT_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D u_src;
uniform float u_threshold;
in vec2 v_ndc;
out vec4 o;
void main() {
  vec3 c = texture(u_src, v_ndc * 0.5 + 0.5).rgb;
  float l = max(c.r, max(c.g, c.b));
  o = vec4(c * smoothstep(u_threshold, 1.0, l), 1.0);
}
`

/** Bloom, step 2: a 9-tap Gaussian blur along one axis (run across, then down). */
export const BLUR_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D u_src;
uniform vec2 u_step; // one texel along the blur direction
in vec2 v_ndc;
out vec4 o;
void main() {
  vec2 uv = v_ndc * 0.5 + 0.5;
  vec3 c = texture(u_src, uv).rgb * 0.227;
  c += (texture(u_src, uv + u_step * 1.385).rgb + texture(u_src, uv - u_step * 1.385).rgb) * 0.316;
  c += (texture(u_src, uv + u_step * 3.231).rgb + texture(u_src, uv - u_step * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}
`

/** Bloom, step 3: the picture plus its glow. */
export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_strength;
in vec2 v_ndc;
out vec4 o;
void main() {
  vec2 uv = v_ndc * 0.5 + 0.5;
  vec3 c = texture(u_scene, uv).rgb + texture(u_bloom, uv).rgb * u_strength;
  o = vec4(c, 1.0);
}
`

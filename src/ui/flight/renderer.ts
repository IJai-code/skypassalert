// WebGL2 for the Flight: compiles the programs, holds the buffers and the
// globe's textures, and draws one frame when asked: the scene into an
// anti-aliased offscreen buffer, then a bloom (bright parts, blurred, added
// back) so city lights, the Sun, the air and the station glow like they do
// to a camera.
// Learn: docs/learn/16-the-flight.md#gpu
import type { Film, Frame } from './film.ts'
import {
  BACKGROUND_FS,
  BLUR_FS,
  BRIGHT_FS,
  COMPOSITE_FS,
  FULLSCREEN_VS,
  LINES_FS,
  LINES_VS,
  SPRITES_FS,
  SPRITES_VS,
  STARS_FS,
  STARS_VS,
  TRAIL_FS,
  TRAIL_VS,
} from './shaders.ts'

const D = Math.PI / 180

type Program = { p: WebGLProgram; u: (name: string) => WebGLUniformLocation | null }

export type Renderer = {
  setFilm(film: Film): void
  setCoast(coast: Float32Array): void
  /** The globe's surface and night textures (textures.ts). */
  setTextures(surface: TexImageSource, night: TexImageSource): void
  /** Returns false if the GPU went away (context lost). */
  draw(
    frame: Frame,
    o: {
      width: number
      height: number
      dpr: number
      red: boolean
      paper: [number, number, number]
    },
  ): boolean
  /** Programs still compiling in the background (KHR_parallel_shader_compile). */
  ready(): boolean
  dispose(): void
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const p = gl.createProgram()
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    gl.attachShader(p, s)
  }
  gl.linkProgram(p)
  const cache = new Map<string, WebGLUniformLocation | null>()
  return {
    p,
    u: (name) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name))
      return cache.get(name)!
    },
  }
}

function linked(gl: WebGL2RenderingContext, prog: Program): boolean {
  if (gl.getProgramParameter(prog.p, gl.LINK_STATUS)) return true
  console.error('Flight shader failed:', gl.getProgramInfoLog(prog.p))
  return false
}

type Layout = Array<[name: string, size: number]>

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

function colourTarget(gl: WebGL2RenderingContext, w: number, h: number): Target {
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const fb = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  return { fb, tex, w, h }
}

function imageTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  // A 1×1 stand-in until the real one is painted.
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  )
  // Longitude wraps; latitude stops at the poles.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return tex
}

/** A vertex array with interleaved float attributes. */
function vertexArray(gl: WebGL2RenderingContext, prog: Program, layout: Layout) {
  const vao = gl.createVertexArray()
  const buf = gl.createBuffer()
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  const stride = layout.reduce((n, [, s]) => n + s, 0) * 4
  let offset = 0
  for (const [name, size] of layout) {
    const loc = gl.getAttribLocation(prog.p, name)
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset)
    }
    offset += size * 4
  }
  gl.bindVertexArray(null)
  let count = 0
  return {
    vao,
    upload(data: Float32Array, n: number, usage: GLenum = gl.STATIC_DRAW) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data, usage)
      count = n
    },
    get count() {
      return count
    },
  }
}

/**
 * WebGL drawn by the CPU (no graphics chip, a blocklisted driver, or a
 * headless browser) can't trace a globe and bloom it at a usable frame rate.
 * Those devices get the 2D picture instead. (Lab tools like Lighthouse run
 * this way too, so they measure the 2D version: see D-034.)
 */
export function softwareRendered(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    depth: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  })
  if (!gl) return null
  if (softwareRendered(gl)) return null
  const parallel = gl.getExtension('KHR_parallel_shader_compile') as {
    COMPLETION_STATUS_KHR: number
  } | null
  const empty = gl.createVertexArray()

  const bg = compile(gl, FULLSCREEN_VS, BACKGROUND_FS)
  const stars = compile(gl, STARS_VS, STARS_FS)
  const lines = compile(gl, LINES_VS, LINES_FS)
  const trail = compile(gl, TRAIL_VS, TRAIL_FS)
  const sprites = compile(gl, SPRITES_VS, SPRITES_FS)
  const bright = compile(gl, FULLSCREEN_VS, BRIGHT_FS)
  const blur = compile(gl, FULLSCREEN_VS, BLUR_FS)
  const composite = compile(gl, FULLSCREEN_VS, COMPOSITE_FS)
  const all = [bg, stars, lines, trail, sprites, bright, blur, composite]
  const surfaceTex = imageTexture(gl)
  const nightTex = imageTexture(gl)
  let textured = 0
  const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number)

  // Offscreen buffers, made (again) whenever the size changes.
  let size = { w: 0, h: 0 }
  let msaa: { fb: WebGLFramebuffer; rb: WebGLRenderbuffer } | null = null
  let scene: Target | null = null
  let bloomA: Target | null = null
  let bloomB: Target | null = null
  const ensureTargets = (w: number, h: number) => {
    if (size.w === w && size.h === h && msaa && scene && bloomA && bloomB) return
    for (const t of [scene, bloomA, bloomB]) {
      if (!t) continue
      gl.deleteFramebuffer(t.fb)
      gl.deleteTexture(t.tex)
    }
    if (msaa) {
      gl.deleteFramebuffer(msaa.fb)
      gl.deleteRenderbuffer(msaa.rb)
    }
    const rb = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb)
    msaa = { fb, rb }
    scene = colourTarget(gl, w, h)
    const hw = Math.max(1, w >> 1)
    const hh = Math.max(1, h >> 1)
    bloomA = colourTarget(gl, hw, hh)
    bloomB = colourTarget(gl, hw, hh)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    size = { w, h }
  }
  const fullscreen = (pr: Program, target: Target | null, w: number, h: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null)
    gl.viewport(0, 0, w, h)
    gl.useProgram(pr.p)
    gl.bindVertexArray(empty)
  }
  let checked = false

  const starVA = vertexArray(gl, stars, [
    ['a_dir', 3],
    ['a_mag', 1],
    ['a_tint', 3],
  ])
  const coastVA = vertexArray(gl, lines, [['a_pos', 3]])
  const losVA = vertexArray(gl, lines, [
    ['a_pos', 3],
    ['a_col', 4],
  ])
  const trailVA = vertexArray(gl, trail, [
    ['a_pos', 3],
    ['a_other', 3],
    ['a_side', 1],
    ['a_t', 1],
    ['a_bright', 1],
  ])
  // Orbits are ribbons too (same program as the pass), drawn as strips.
  const orbitVA = vertexArray(gl, trail, [
    ['a_pos', 3],
    ['a_other', 3],
    ['a_side', 1],
    ['a_t', 1],
    ['a_bright', 1],
  ])
  let orbitStarts: readonly number[] = []
  const spriteVA = vertexArray(gl, sprites, [
    ['a_pos', 4],
    ['a_col', 4],
    ['a_size', 1],
    ['a_ring', 1],
  ])

  let R = 6371
  let lost = false
  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
  }
  canvas.addEventListener('webglcontextlost', onLost)

  const ready = () => {
    if (lost) return false
    if (checked) return true
    if (
      parallel &&
      !all.every((pr) => gl.getProgramParameter(pr.p, parallel.COMPLETION_STATUS_KHR))
    )
      return false
    if (!all.every((pr) => linked(gl, pr))) {
      lost = true
      return false
    }
    checked = true
    return true
  }

  const camera = (pr: Program, f: Frame, aspect: number, red: boolean) => {
    const c = f.cam
    const ty = Math.tan((c.vfovDeg / 2) * D)
    gl.uniform3fv(pr.u('u_eye'), c.eye)
    gl.uniform1f(pr.u('u_eyeAlt'), c.eyeAlt)
    gl.uniform1f(pr.u('u_R'), R)
    gl.uniform3fv(pr.u('u_right'), c.right)
    gl.uniform3fv(pr.u('u_up'), c.up)
    gl.uniform3fv(pr.u('u_fwd'), c.forward)
    gl.uniform2f(pr.u('u_tan'), ty * aspect, ty)
    gl.uniform1f(pr.u('u_red'), red ? 1 : 0)
  }

  return {
    setFilm(film) {
      R = film.world.R
      starVA.upload(film.stars.data, film.stars.count)
      if (film.trail) trailVA.upload(film.trail.data, film.trail.count)
      else trailVA.upload(new Float32Array(0), 0)
      orbitVA.upload(film.orbits.data, film.orbits.count)
      orbitStarts = film.orbits.starts
    },
    setTextures(surface, night) {
      for (const [tex, img] of [
        [surfaceTex, surface],
        [nightTex, night],
      ] as const) {
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      }
      textured = 1
    },
    setCoast(coast) {
      coastVA.upload(coast, coast.length / 3)
    },
    ready,
    draw(f, o) {
      if (lost || gl.isContextLost()) return false
      if (!ready()) return true
      const W = Math.round(o.width * o.dpr)
      const H = Math.round(o.height * o.dpr)
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W
        canvas.height = H
      }
      ensureTargets(W, H)
      if (!msaa || !scene || !bloomA || !bloomB) return true
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaa.fb)
      gl.viewport(0, 0, W, H)
      const aspect = W / H

      // 1. Sky, ground, globe and space, one ray per pixel.
      gl.disable(gl.BLEND)
      gl.useProgram(bg.p)
      camera(bg, f, aspect, o.red)
      gl.uniform3fv(bg.u('u_sun'), f.sun)
      gl.uniform3fv(bg.u('u_zenith'), f.zenith)
      gl.uniform3fv(bg.u('u_horizon'), f.horizon)
      gl.uniform1f(bg.u('u_glow'), f.glow)
      gl.uniform1f(bg.u('u_space'), f.space)
      gl.uniform3fv(bg.u('u_paper'), o.paper)
      gl.uniformMatrix3fv(bg.u('u_toEcef'), false, f.toEcef)
      gl.uniform1f(bg.u('u_textured'), textured)
      gl.uniform1f(bg.u('u_fade'), f.fade)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, surfaceTex)
      gl.uniform1i(bg.u('u_surface'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, nightTex)
      gl.uniform1i(bg.u('u_night'), 1)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindVertexArray(empty)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.enable(gl.BLEND)

      // 2. Hairlines: coastlines and the line of sight (only once we're up there).
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(lines.p)
      camera(lines, f, aspect, o.red)
      if (f.space > 0.01 && coastVA.count) {
        gl.uniform1f(lines.u('u_alpha'), f.space * f.fade)
        gl.uniform1i(lines.u('u_surface'), 1)
        gl.bindVertexArray(coastVA.vao)
        gl.vertexAttrib4f(gl.getAttribLocation(lines.p, 'a_col'), 0.914, 0.894, 0.839, 0.22)
        gl.drawArrays(gl.LINES, 0, coastVA.count)
      }
      gl.uniform1i(lines.u('u_surface'), 0)
      if (f.lineOfSight) {
        losVA.upload(f.lineOfSight, 2, gl.DYNAMIC_DRAW)
        gl.uniform1f(lines.u('u_alpha'), f.fade)
        gl.bindVertexArray(losVA.vao)
        gl.drawArrays(gl.LINES, 0, 2)
      }

      // 3. Stars (premultiplied, so faint ones add up softly).
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      if (starVA.count) {
        gl.useProgram(stars.p)
        camera(stars, f, aspect, o.red)
        gl.uniformMatrix3fv(stars.u('u_spin'), false, f.spin)
        gl.uniform1f(stars.u('u_limit'), f.limit)
        gl.uniform1f(stars.u('u_dpr'), o.dpr)
        gl.bindVertexArray(starVA.vao)
        gl.drawArrays(gl.POINTS, 0, starVA.count)
      }

      // 4. Orbits, then the pass, as ribbons.
      gl.useProgram(trail.p)
      camera(trail, f, aspect, o.red)
      gl.uniform2f(trail.u('u_px'), W / 2, H / 2)
      gl.uniform3f(trail.u('u_color'), 1, 0.776, 0.361)
      if (f.space > 0.01 && orbitVA.count) {
        gl.uniform1f(trail.u('u_width'), 1.1 * o.dpr)
        gl.uniform1f(trail.u('u_clock'), 1e9)
        gl.uniform1f(trail.u('u_alpha'), f.space * f.fade)
        gl.bindVertexArray(orbitVA.vao)
        for (let i = 0; i < orbitStarts.length; i++) {
          const from = orbitStarts[i]!
          const to = orbitStarts[i + 1] ?? orbitVA.count
          gl.drawArrays(gl.TRIANGLE_STRIP, from, to - from)
        }
      }
      if (trailVA.count) {
        gl.uniform1f(trail.u('u_width'), 1.6 * o.dpr)
        gl.uniform1f(trail.u('u_clock'), f.trailClock)
        gl.uniform1f(trail.u('u_alpha'), f.fade)
        gl.bindVertexArray(trailVA.vao)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, trailVA.count)
      }

      // 5. The station, the Moon, planets, you.
      if (f.spriteCount) {
        gl.useProgram(sprites.p)
        camera(sprites, f, aspect, o.red)
        gl.uniform1f(sprites.u('u_dpr'), o.dpr)
        spriteVA.upload(f.sprites, f.spriteCount, gl.DYNAMIC_DRAW)
        gl.bindVertexArray(spriteVA.vao)
        gl.drawArrays(gl.POINTS, 0, f.spriteCount)
      }

      // 6. Resolve the anti-aliased frame, then bloom: bright parts at half
      //    size, blurred across and down twice (wider the second time).
      gl.disable(gl.BLEND)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaa.fb)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, scene.fb)
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST)
      const hw = bloomA.w
      const hh = bloomA.h
      fullscreen(bright, bloomA, hw, hh)
      gl.bindTexture(gl.TEXTURE_2D, scene.tex)
      gl.uniform1i(bright.u('u_src'), 0)
      gl.uniform1f(bright.u('u_threshold'), 0.55)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      for (const spread of [1, 2.5]) {
        fullscreen(blur, bloomB, hw, hh)
        gl.bindTexture(gl.TEXTURE_2D, bloomA.tex)
        gl.uniform1i(blur.u('u_src'), 0)
        gl.uniform2f(blur.u('u_step'), spread / hw, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        fullscreen(blur, bloomA, hw, hh)
        gl.bindTexture(gl.TEXTURE_2D, bloomB.tex)
        gl.uniform2f(blur.u('u_step'), 0, spread / hh)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      fullscreen(composite, null, W, H)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, scene.tex)
      gl.uniform1i(composite.u('u_scene'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, bloomA.tex)
      gl.uniform1i(composite.u('u_bloom'), 1)
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1f(composite.u('u_strength'), 1.1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindVertexArray(null)
      return true
    },
    dispose() {
      // Don't force-lose the context: a remount (React dev mode, a new pass)
      // gets this same context back from the same canvas, and a lost one
      // can't be revived. The browser frees it when the canvas goes away.
      canvas.removeEventListener('webglcontextlost', onLost)
    },
  }
}

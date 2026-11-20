// WebGL2 for the Flight: compiles the programs, holds the buffers, and draws
// one frame when asked. Nothing animates on its own; the page calls draw()
// only when the scroll, the size or the data changes.
// Learn: docs/learn/16-the-flight.md#gpu
import type { Film, Frame } from './film.ts'
import {
  BACKGROUND_FS,
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

export function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    depth: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  })
  if (!gl) return null
  const parallel = gl.getExtension('KHR_parallel_shader_compile') as {
    COMPLETION_STATUS_KHR: number
  } | null

  const bg = compile(gl, FULLSCREEN_VS, BACKGROUND_FS)
  const stars = compile(gl, STARS_VS, STARS_FS)
  const lines = compile(gl, LINES_VS, LINES_FS)
  const trail = compile(gl, TRAIL_VS, TRAIL_FS)
  const sprites = compile(gl, SPRITES_VS, SPRITES_FS)
  const all = [bg, stars, lines, trail, sprites]
  let checked = false

  const empty = gl.createVertexArray()
  const starVA = vertexArray(gl, stars, [
    ['a_dir', 3],
    ['a_mag', 1],
    ['a_tint', 3],
  ])
  const coastVA = vertexArray(gl, lines, [['a_pos', 3]])
  const orbitVA = vertexArray(gl, lines, [
    ['a_pos', 3],
    ['a_col', 4],
  ])
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
      if (film.orbitLine) orbitVA.upload(film.orbitLine.data, film.orbitLine.count)
      else orbitVA.upload(new Float32Array(0), 0)
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
      gl.bindVertexArray(empty)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.enable(gl.BLEND)

      // 2. Hairlines: coastlines and the orbit (only once we're up there).
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(lines.p)
      camera(lines, f, aspect, o.red)
      if (f.space > 0.01 && coastVA.count) {
        gl.uniform1f(lines.u('u_alpha'), f.space)
        gl.uniform1i(lines.u('u_surface'), 1)
        gl.bindVertexArray(coastVA.vao)
        gl.vertexAttrib4f(gl.getAttribLocation(lines.p, 'a_col'), 0.914, 0.894, 0.839, 0.5)
        gl.drawArrays(gl.LINES, 0, coastVA.count)
      }
      gl.uniform1i(lines.u('u_surface'), 0)
      if (f.space > 0.01 && orbitVA.count) {
        gl.uniform1f(lines.u('u_alpha'), f.space)
        gl.bindVertexArray(orbitVA.vao)
        gl.drawArrays(gl.LINE_STRIP, 0, orbitVA.count)
      }
      if (f.lineOfSight) {
        losVA.upload(f.lineOfSight, 2, gl.DYNAMIC_DRAW)
        gl.uniform1f(lines.u('u_alpha'), 1)
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

      // 4. The pass.
      if (trailVA.count) {
        gl.useProgram(trail.p)
        camera(trail, f, aspect, o.red)
        gl.uniform2f(trail.u('u_px'), W / 2, H / 2)
        gl.uniform1f(trail.u('u_width'), 1.6 * o.dpr)
        gl.uniform1f(trail.u('u_clock'), f.trailClock)
        gl.uniform1f(trail.u('u_alpha'), 1)
        gl.uniform3f(trail.u('u_color'), 1, 0.776, 0.361)
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

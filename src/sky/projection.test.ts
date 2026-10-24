import { azEl, basisLookingAt, enu, project, turnTo } from './projection.ts'
import { cameraFromDevice, forwardAzimuth, smoothBasis } from './orientation.ts'

const vp = { width: 400, height: 800, vfovDeg: 70, projection: 'rectilinear' as const }

describe('sky camera', () => {
  it('puts the point it looks at in the centre of the screen', () => {
    const cam = basisLookingAt(245, 30)
    const p = project(enu(245, 30), cam, vp)!
    expect(p.x).toBeCloseTo(200, 6)
    expect(p.y).toBeCloseTo(400, 6)
  })
  it('draws higher things higher and things to the right on the right', () => {
    const cam = basisLookingAt(245, 30)
    expect(project(enu(245, 40), cam, vp)!.y).toBeLessThan(400)
    expect(project(enu(255, 30), cam, vp)!.x).toBeGreaterThan(200)
  })
  it('hides things behind the camera', () => {
    expect(project(enu(65, 0), basisLookingAt(245, 0), vp)).toBeNull()
  })
  it('says how far to turn', () => {
    const t = turnTo(basisLookingAt(200, 10), enu(245, 30))
    expect(t.turnDeg).toBeCloseTo(45, 6)
    expect(t.tiltDeg).toBeCloseTo(20, 6)
  })
  it('round-trips azimuth/elevation', () => {
    const a = azEl(enu(312.5, 41.2))
    expect(a.azDeg).toBeCloseTo(312.5, 9)
    expect(a.elDeg).toBeCloseTo(41.2, 9)
  })
})

describe('phone orientation → camera', () => {
  it('phone held upright facing north looks at the northern horizon', () => {
    // beta = 90: phone vertical, screen towards you, back camera facing away.
    const cam = cameraFromDevice(0, 90, 0, 0, 0)
    const f = azEl(cam.forward)
    expect(f.elDeg).toBeCloseTo(0, 6)
    expect(Math.min(f.azDeg, 360 - f.azDeg)).toBeLessThan(1e-6)
    expect(azEl(cam.up).elDeg).toBeCloseTo(90, 6)
  })
  it('tilting the top back raises the view', () => {
    const cam = cameraFromDevice(0, 120, 0, 0, 0)
    expect(azEl(cam.forward).elDeg).toBeCloseTo(30, 6)
  })
  it('alpha turns counter-clockwise, so alpha = 90 faces west', () => {
    expect(forwardAzimuth(90, 90, 0)).toBeCloseTo(270, 6)
  })
  it('applies the heading correction (declination + calibration) clockwise', () => {
    const cam = cameraFromDevice(0, 90, 0, 0, 13)
    expect(azEl(cam.forward).azDeg).toBeCloseTo(13, 6)
  })
  it('smoothing keeps an orthonormal, right-handed basis', () => {
    const a = basisLookingAt(10, 20)
    const b = basisLookingAt(30, 25)
    const m = smoothBasis(a, b, 0.5)
    const d = (u: number[], v: number[]) => u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!
    expect(d(m.right, m.up)).toBeCloseTo(0, 9)
    expect(d(m.right, m.forward)).toBeCloseTo(0, 9)
    // right × up = −forward for this convention (screen x right, y up, camera looking into the screen).
    const r = m.right
    const u = m.up
    const c = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]]
    const ref = basisLookingAt(20, 22)
    const cr = [
      ref.right[1] * ref.up[2] - ref.right[2] * ref.up[1],
      ref.right[2] * ref.up[0] - ref.right[0] * ref.up[2],
      ref.right[0] * ref.up[1] - ref.right[1] * ref.up[0],
    ]
    expect(Math.sign(d(c, m.forward))).toBe(Math.sign(d(cr, ref.forward)))
    expect(azEl(m.forward).azDeg).toBeGreaterThan(10)
    expect(azEl(m.forward).azDeg).toBeLessThan(30)
  })
})

// Bracketed root-finding and 1-D maximisation (Brent's methods).
// Learn: docs/learn/05-passes.md
//
// Why Brent: rise/set, shadow and twilight crossings are smooth functions of
// time that we can bracket from a coarse scan. Brent's method keeps the
// guaranteed convergence of bisection but usually converges superlinearly,
// so each crossing costs ~10 function evaluations instead of ~30.

/**
 * Find t in [a, b] with f(t) = 0, given f(a) and f(b) of opposite sign.
 * `tol` is the absolute tolerance on t.
 */
export function brentRoot(f: (t: number) => number, a: number, b: number, tol: number): number {
  let fa = f(a)
  let fb = f(b)
  if (fa === 0) return a
  if (fb === 0) return b
  if (fa * fb > 0) throw new RangeError('brentRoot: root is not bracketed')

  let c = a
  let fc = fa
  let d = b - a
  let e = d

  for (let i = 0; i < 100; i++) {
    if (fb * fc > 0) {
      c = a
      fc = fa
      d = b - a
      e = d
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b
      b = c
      c = a
      fa = fb
      fb = fc
      fc = fa
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol
    const xm = 0.5 * (c - b)
    if (Math.abs(xm) <= tol1 || fb === 0) return b

    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      // Attempt inverse quadratic interpolation (or secant when a === c).
      const s = fb / fa
      let p: number
      let q: number
      if (a === c) {
        p = 2 * xm * s
        q = 1 - s
      } else {
        const qa = fa / fc
        const r = fb / fc
        p = s * (2 * xm * qa * (qa - r) - (b - a) * (r - 1))
        q = (qa - 1) * (r - 1) * (s - 1)
      }
      if (p > 0) q = -q
      p = Math.abs(p)
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d
        d = p / q
      } else {
        d = xm
        e = d
      }
    } else {
      d = xm
      e = d
    }
    a = b
    fa = fb
    b += Math.abs(d) > tol1 ? d : xm > 0 ? tol1 : -tol1
    fb = f(b)
  }
  return b
}

const GOLDEN = (3 - Math.sqrt(5)) / 2

/**
 * Brent's method for the maximum of a unimodal f on [a, b].
 * Returns { t, value }.
 */
export function brentMax(
  f: (t: number) => number,
  a: number,
  b: number,
  tol: number,
): { t: number; value: number } {
  const g = (t: number) => -f(t)
  let x = a + GOLDEN * (b - a)
  let w = x
  let v = x
  let fx = g(x)
  let fw = fx
  let fv = fx
  let d = 0
  let e = 0

  for (let i = 0; i < 100; i++) {
    const xm = 0.5 * (a + b)
    const tol1 = tol * 0.5 + Number.EPSILON * Math.abs(x)
    const tol2 = 2 * tol1
    if (Math.abs(x - xm) <= tol2 - 0.5 * (b - a)) break

    let useGolden = true
    if (Math.abs(e) > tol1) {
      // Parabolic fit through x, w, v.
      let r = (x - w) * (fx - fv)
      let q = (x - v) * (fx - fw)
      let p = (x - v) * q - (x - w) * r
      q = 2 * (q - r)
      if (q > 0) p = -p
      q = Math.abs(q)
      r = e
      e = d
      if (Math.abs(p) < Math.abs(0.5 * q * r) && p > q * (a - x) && p < q * (b - x)) {
        d = p / q
        const u = x + d
        if (u - a < tol2 || b - u < tol2) d = xm - x >= 0 ? tol1 : -tol1
        useGolden = false
      }
    }
    if (useGolden) {
      e = (x >= xm ? a : b) - x
      d = GOLDEN * e
    }
    const u = Math.abs(d) >= tol1 ? x + d : x + (d >= 0 ? tol1 : -tol1)
    const fu = g(u)
    if (fu <= fx) {
      if (u >= x) a = x
      else b = x
      v = w
      fv = fw
      w = x
      fw = fx
      x = u
      fx = fu
    } else {
      if (u < x) a = u
      else b = u
      if (fu <= fw || w === x) {
        v = w
        fv = fw
        w = u
        fw = fu
      } else if (fu <= fv || v === x || v === w) {
        v = u
        fv = fu
      }
    }
  }
  return { t: x, value: -fx }
}

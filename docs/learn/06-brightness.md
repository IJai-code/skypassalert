# 06 · Brightness: how bright will it look?

Code: `src/engine/brightness/brightness.ts`, words in `src/engine/describe/describe.ts`.

## The idea
Brightness depends on how far away the station is, how much of its lit side faces you (phase), and whether it's partly in Earth's shadow. Astronomers use **magnitudes**: lower is brighter, and 5 magnitudes is a factor of 100.

## Equation
```
m = m₀ + 5·log₁₀(d / 1000 km) − 2.5·log₁₀(F(φ)) − 2.5·log₁₀(f)
F(φ) = sin φ + (π − φ)·cos φ        (diffuse sphere, F(90°) = 1)
```
- m₀ is the **standard magnitude**: brightness at 1000 km, half lit.
- d is the range.
- φ is the **phase angle** at the station between the Sun and you.
- f is the sunlit fraction (chapter 04).

Like most published predictors, we leave out atmospheric extinction (~1 mag at 10° elevation), so our numbers are comparable to theirs. The words take low passes into account.

## Calibration
m₀ isn't measurable from first principles (panels, angles, albedo), so we **fit** it to Heavens-Above's published magnitudes for this week's Fremont passes (`src/engine/__fixtures__/heavens-above-fremont-2026-10-24.json`):

| Station | m₀ | Residuals |
|---|---|---|
| ISS | −1.5 | σ ≈ 0.15 mag (6 passes) |
| Tiangong | +0.4 | σ ≈ 0.2 mag on 7 of 9 passes; two passes that enter shadow low in the sky are 1.0–1.2 mag fainter in our model than published. Our penumbra dimming, or a different end-point convention, is the likely cause; Phase 8 field data will decide. |

Tiangong's sunlit area is roughly a quarter of the ISS's, which is about 1.5 mag fainter, consistent with the 1.9 mag difference in m₀.

## Worked example (tonight's Tiangong peak)
d = 392.8 km, φ = 71.55°, f = 1:
```
F = sin 71.55° + (π − 1.2488)·cos 71.55° = 0.9486 + 1.8928·0.3166 = 1.548
m = 0.4 + 5·log₁₀(0.3928) − 2.5·log₁₀(1.548)
  = 0.4 − 2.029 − 0.475 = −2.10
```
Heavens-Above: −2.2. In words: "Very bright, brighter than any star" (Sirius is −1.46).

## Words
| Magnitude | Word | Anchor |
|---|---|---|
| ≤ −3 | dazzling | only the Moon and Venus are brighter |
| ≤ −1.5 | very bright | brighter than any star |
| ≤ 0 | bright | like the brightest stars |
| ≤ 1.5 | easy | fine away from streetlights |
| > 1.5 | faint | needs a dark spot |

## Failure modes
- ±0.5 mag typical, from panel glints and attitude, which a sphere model can't know.
- Low passes look fainter than the number says (extinction).

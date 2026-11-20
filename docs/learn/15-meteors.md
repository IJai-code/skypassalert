# 15 · Meteor showers: radiants, ZHR and the Moon

Code:
- `src/engine/meteors/showers.ts`: the table of 12 major showers.
- `src/engine/meteors/meteors.ts`: which are active tonight and how many you might see, with tests.
- `src/ui/night/buildNight.ts`: the shower line in tonight's table.

## The question it answers
"Is tonight a good night for shooting stars, and where do I look?"

## 1. Why showers come back on the same dates
A comet leaves a trail of grit along its orbit. Every year Earth crosses that trail at the same point in **its own** orbit. So the natural clock for a shower is not the calendar date but the **Sun's ecliptic longitude** λ☉: how far round its yearly path the Sun appears to be.
- The Perseids peak at λ☉ ≈ 140.0°.
- In 2026 that happens on 12–13 August (`meteors.test.ts` checks it).
- Leap years shift the calendar date, but λ☉ doesn't care.

`solarLongitudeDeg()` gets λ☉ from the same Sun vector the pass finder uses (chapter 03). It turns the equatorial vector into ecliptic longitude by tilting the frame by the obliquity, ε ≈ 23.44°:

```
λ = atan2(y·cos ε + z·sin ε, x)
```

The Sun moves about 0.9856° a day, so "days to peak" is just Δλ / 0.9856.

> **Predict:** the Leonids peak at λ☉ = 235.27°. On 6 November λ☉ is about 224°. How many days to the peak? (Answer: about 11. Check it in the app's opened shower line.)

## 2. The radiant
The grit all arrives in parallel. Seen from the ground, perspective makes the streaks seem to fan out from one point, the **radiant**, just as parallel railway tracks seem to meet at the horizon.
- The radiant is a fixed point among the stars (an RA and Dec), so it rises and sets like a star.
- We turn it into altitude and azimuth with `directionToAzEl`, the same function the star map uses (chapter 10).
- A radiant that never climbs above 10° from your place means almost nothing to see. That's why Sydney gets no Quadrantids (radiant at Dec +49°) but does get the Eta Aquariids (Dec −1°).

You don't look **at** the radiant. Meteors can appear anywhere in the sky; the radiant just tells you which way they point back to.

## 3. ZHR, and why you'll see fewer
**ZHR** (zenithal hourly rate) is a standardised count: the number one observer would see in an hour under a perfect sky (stars down to magnitude 6.5) with the radiant straight overhead. Real conditions knock it down:

| Factor | Effect | How we model it |
|---|---|---|
| Radiant lower in the sky | Some meteors burn up below your horizon | × sin(radiant altitude) |
| Away from the peak | The stream is thinner | × 10^(−slope·\|Δλ\|), with a rough slope per shower |
| Moonlight | Washes out the faint majority | × (1 − 0.65 × lit fraction) while the Moon is up |
| Town lights | Same, often much worse | Not modelled: we say "far fewer under town lights" |

`showersTonight()` tries every 15 minutes of full darkness and keeps the moment with the best mix of a high radiant and no Moon. The ideal figure is the top of our range and 30% of it the bottom, because even a good dark spot falls short of a perfect sky.

> **Predict:** around 23 October 2026 the Orionids are 2–3 days past their peak and the Moon is nearly full. Why does the app pick a time just before dawn? (Hint: when does a nearly full Moon set?)

## 4. How rough this is
- Rates swing from year to year. Some showers (the Draconids, the Leonids) can surprise in either direction.
- Real activity profiles are lopsided, not the single slope we use.
- The radiant drifts about a degree a day; we use the peak position.
- The shower figures come from the IMO's working list and still need checking against the 2026 IMO calendar (human task, D-032).

That's why the app says "maybe 4 to 14 an hour" and adds "rates are rough". It never gives one exact number.

## Try it
- In the app on a shower night, open the shower line in "Tonight, hour by hour".
- In `meteors.test.ts`, change Fremont to your own latitude and see which showers drop out.

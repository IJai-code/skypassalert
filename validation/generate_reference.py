"""Generate reference values with Skyfield + sgp4 for the engine's accuracy harness.

Learn: docs/learn/09-accuracy.md

We compare against Skyfield because it is independently written, widely
used in astronomy, and implements the full IAU/IERS machinery (nutation,
polar motion, aberration) that our engine deliberately approximates. The
differences it reports are therefore the true size of our approximations.

Usage: python validation/generate_reference.py [out.json]
Deterministic: fixed RNG seed and frozen OMM fixtures.
"""

import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from skyfield import almanac
from skyfield.api import EarthSatellite, load, wgs84
from skyfield.magnitudelib import planetary_magnitude
from skyfield.timelib import Timescale

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "src/engine/__fixtures__/stations-2026-10-24.json"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "validation/reference/reference.json"

EOP_CSV = ROOT / "data/fixtures/EOP-Last5Years.csv"


def timescale_from_celestrak(csv_path):
    """A Skyfield Timescale using the same IERS Earth-orientation data as the engine.

    Skyfield's bundled UT1 table is a *prediction* made when that Skyfield
    release was built; by Oct 2026 it is 0.136 s off the current IERS value,
    which alone would move a ground observer ~60 m. Feeding both sides the
    same EOP file makes the comparison measure our math, not stale data.
    Polar motion is installed too, so the report includes the error from our
    neglecting it.
    """
    rows = np.genfromtxt(csv_path, delimiter=",", names=True, dtype=None, encoding="utf-8")
    mjd = rows["MJD"].astype(float)
    dut1 = rows["UT1UTC"].astype(float)
    tt_minus_utc = rows["DAT"].astype(float) + 32.184
    daily_tt = mjd + tt_minus_utc / 86400.0 + 2400000.5
    daily_delta_t = (tt_minus_utc - dut1).round(7)
    builtin = load.timescale()
    t = Timescale((daily_tt, daily_delta_t), builtin.leap_dates, builtin.leap_offsets)
    t.polar_motion_table = (daily_tt, rows["X"].astype(float), rows["Y"].astype(float))
    return t


rng = np.random.default_rng(20261024)
ts = timescale_from_celestrak(EOP_CSV)
loader = load  # caches de421.bsp in the working directory
eph = loader("de421.bsp")
earth, sun, moon = eph["earth"], eph["sun"], eph["moon"]
PLANETS = {
    "mercury": eph["mercury"],
    "venus": eph["venus"],
    "mars": eph["mars"],
    "jupiter": eph["jupiter barycenter"],
    "saturn": eph["saturn barycenter"],
}


def to_ms(t):
    return round(t.utc_datetime().timestamp() * 1000, 3)


def t_from_ms(ms):
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(milliseconds=ms)
    return ts.from_datetime(dt)


def random_observer():
    # Uniform over the sphere's area between ±60° latitude (where people live
    # and both stations pass), heights 0–3 km.
    lat = math.degrees(math.asin(rng.uniform(-math.sin(math.radians(60)), math.sin(math.radians(60)))))
    lon = rng.uniform(-180, 180)
    elev = rng.uniform(0, 3000)
    return {"latDeg": round(lat, 6), "lonDeg": round(lon, 6), "elevationM": round(elev, 1)}


def topos(o):
    return wgs84.latlon(o["latDeg"], o["lonDeg"], elevation_m=o["elevationM"])


def epoch_ms(omm):
    return datetime.fromisoformat(omm["EPOCH"]).replace(tzinfo=timezone.utc).timestamp() * 1000


elements = json.loads(FIXTURE.read_text())
sats = {o["NORAD_CAT_ID"]: (o, EarthSatellite.from_omm(ts, {k: str(v) for k, v in o.items()})) for o in elements}

out = {
    "generator": "validation/generate_reference.py",
    "skyfield": __import__("skyfield").__version__,
    "sgp4": __import__("sgp4").__version__,
    "ephemeris": "de421.bsp",
    "eop": "CelesTrak EOP-Last5Years.csv (IERS), incl. polar motion",
    "satellites": [],
    "sun": [],
    "moon": [],
    "planets": [],
    "riseSet": [],
    "sunsets": [],
}

# 1. Satellite look angles: random times within ±3 days of epoch, random observers.
for norad, (omm, sat) in sats.items():
    e = epoch_ms(omm)
    for _ in range(2000):
        ms = float(round(e + rng.uniform(-3, 3) * 86_400_000))
        o = random_observer()
        t = t_from_ms(ms)
        alt, az, dist = (sat - topos(o)).at(t).altaz()
        out["satellites"].append(
            {"noradId": norad, "unixMs": ms, "observer": o, "azDeg": az.degrees, "elDeg": alt.degrees, "rangeKm": dist.km}
        )

# 2. Sun, Moon and planets: random times in 2026–2027, random observers.
start = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp() * 1000
span = 2 * 365 * 86_400_000
for _ in range(1000):
    ms = float(round(start + rng.uniform(0, span)))
    o = random_observer()
    t = t_from_ms(ms)
    here = earth + topos(o)
    alt, az, _ = here.at(t).observe(sun).apparent().altaz()
    out["sun"].append({"unixMs": ms, "observer": o, "azDeg": az.degrees, "elDeg": alt.degrees})
    alt, az, dist = here.at(t).observe(moon).apparent().altaz()
    out["moon"].append(
        {
            "unixMs": ms,
            "observer": o,
            "azDeg": az.degrees,
            "elDeg": alt.degrees,
            "rangeKm": dist.km,
            "illumination": float(almanac.fraction_illuminated(eph, "moon", t)),
        }
    )
    for name, body in PLANETS.items():
        alt, az, _ = here.at(t).observe(body).apparent().altaz()
        mag = float(planetary_magnitude(earth.at(t).observe(body)))
        out["planets"].append(
            {"id": name, "unixMs": ms, "observer": o, "azDeg": az.degrees, "elDeg": alt.degrees, "magnitude": mag}
        )

# 3. Rise/set above 10° within a day of epoch (pass-finder timing).
for norad, (omm, sat) in sats.items():
    e = epoch_ms(omm)
    for _ in range(60):
        o = random_observer()
        t0ms = float(round(e + rng.uniform(-2, 1) * 86_400_000))
        t0, t1 = t_from_ms(t0ms), t_from_ms(t0ms + 86_400_000)
        times, events = sat.find_events(topos(o), t0, t1, altitude_degrees=10.0)
        pairs, rise = [], None
        for ti, ev in zip(times, events):
            if ev == 0:
                rise = to_ms(ti)
            elif ev == 2 and rise is not None:
                pairs.append({"riseMs": rise, "setMs": to_ms(ti)})
                rise = None
        out["riseSet"].append({"noradId": norad, "observer": o, "fromMs": t0ms, "toMs": t0ms + 86_400_000, "passes": pairs})

# 4. Sunsets (Sun centre at −0.8333°: refraction + semi-diameter).
for _ in range(300):
    o = random_observer()
    day = float(round(start + rng.uniform(0, span)))
    t0, t1 = t_from_ms(day), t_from_ms(day + 86_400_000)
    times, _ = almanac.find_settings(earth + topos(o), sun, t0, t1, horizon_degrees=-0.8333)
    out["sunsets"].append({"observer": o, "fromMs": day, "toMs": day + 86_400_000, "settingsMs": [to_ms(x) for x in times]})

def rounded(x, key=""):
    """10 significant digits for angles and ranges (far below every error we
    measure); timestamps (keys ending in "Ms") stay exact to the millisecond."""
    if isinstance(x, float):
        return round(x, 3) if key.endswith("Ms") else float(f"{x:.10g}")
    if isinstance(x, list):
        return [rounded(v, key) for v in x]
    if isinstance(x, dict):
        return {k: rounded(v, k) for k, v in x.items()}
    return x


OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(rounded(out), separators=(",", ":")))
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")

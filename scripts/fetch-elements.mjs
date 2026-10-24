// Fetches current orbital elements for the stations we track and writes
// public/data/elements.json (served to browsers) plus a timestamped archive copy.
// Runs in the scheduled "Data" workflow; can be run by hand with `npm run data:fetch`.
//
// CelesTrak usage policy (https://celestrak.org/usage-policy.php), which we follow:
// - Data updates every 2 h; we fetch at most every 6 h, one request per group.
// - Any non-200 response: stop immediately, never retry in a loop, tell a human
//   (the workflow opens an issue). Repeated errors get an IP firewalled.
// - FORMAT=JSON (OMM); TLE is being phased out.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const URL_STATIONS = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=JSON'
const USER_AGENT = 'SkyPassAlert/0.2 (+https://skypassalert.com; hello@skypassalert.com)'

/** What we publish. Matched by catalog number, with a name sanity check. */
const TRACKED = [
  { noradId: 25544, key: 'iss', namePattern: /^ISS \(ZARYA\)$/ },
  { noradId: 48274, key: 'tiangong', namePattern: /^CSS \(TIANHE\)$/ },
]

const root = new URL('../', import.meta.url)
const outPath = new URL('public/data/elements.json', root)

const res = await fetch(URL_STATIONS, { headers: { 'User-Agent': USER_AGENT } })
if (res.status !== 200) {
  // Stop. Do not retry. The workflow turns this into an issue for a human.
  console.error(`CelesTrak returned HTTP ${res.status} ${res.statusText}. Not retrying.`)
  console.error((await res.text()).slice(0, 500))
  process.exit(2)
}
const group = await res.json()
if (!Array.isArray(group) || group.length === 0) {
  console.error('CelesTrak returned an empty or non-array response. Not retrying.')
  process.exit(3)
}

const objects = TRACKED.map(({ noradId, key, namePattern }) => {
  const omm = group.find((o) => o.NORAD_CAT_ID === noradId)
  if (!omm) throw new Error(`${key} (${noradId}) missing from GROUP=stations`)
  if (!namePattern.test(omm.OBJECT_NAME)) {
    throw new Error(`${key}: unexpected name "${omm.OBJECT_NAME}" for ${noradId}`)
  }
  return { key, ...omm }
})

const fetchedAt = new Date().toISOString()
const next = { source: URL_STATIONS, fetchedAt, objects }

// Commit only when the elements themselves changed (not just fetchedAt).
const fingerprint = (doc) => doc.objects.map((o) => `${o.NORAD_CAT_ID}:${o.EPOCH}`).join('|')
const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : null
if (previous && fingerprint(previous) === fingerprint(next)) {
  console.log(`No new elements (${fingerprint(next)}).`)
  process.exit(0)
}

writeFileSync(outPath, JSON.stringify(next, null, 2) + '\n')

// Archive the whole group as fetched: our own dataset for the accuracy report.
const stamp = fetchedAt.replace(/[:.]/g, '').slice(0, 15) // 20261024T130500
const archive = new URL(
  `data/archive/${fetchedAt.slice(0, 4)}/${fetchedAt.slice(5, 7)}/stations-${stamp}Z.json`,
  root,
)
mkdirSync(dirname(archive.pathname), { recursive: true })
writeFileSync(archive, JSON.stringify(group) + '\n')

console.log(`Updated: ${fingerprint(next)}`)

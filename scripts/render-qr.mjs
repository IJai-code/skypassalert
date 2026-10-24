// Pre-renders the QR code used by the desktop "take it outside" panel and the
// unsupported-browser page. Static SVG: works without JavaScript and in very
// old browsers. Run `npm run icons` after changing the URL.
import { writeFileSync } from 'node:fs'
import QRCode from 'qrcode'

const url = 'https://skypassalert.com/?s=qr'
const svg = await QRCode.toString(url, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 2,
  color: { dark: '#080c1aff', light: '#eceff7ff' },
})
writeFileSync(new URL('../public/qr.svg', import.meta.url), svg)
console.log(`qr.svg → ${url}`)

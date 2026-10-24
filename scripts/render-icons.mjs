// Renders raster icons from the source SVG (public/favicon.svg). Run after
// changing the logo: `npm run icons`. Output is committed, so builds need no
// native dependency.
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url))

// iOS draws touch icons on its own square tile; give it a solid night background.
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 180 }, background: '#0B1026' })
  .render()
  .asPng()
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), png)
console.log(`apple-touch-icon.png: ${png.length} bytes`)

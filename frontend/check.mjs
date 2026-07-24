// Script de vérification : capture chaque page et remonte les erreurs console.
import { chromium } from 'playwright'

const pages = [
  ['presentation', 'http://127.0.0.1:5173/'],
  ['dashboard', 'http://127.0.0.1:5173/dashboard/'],
  ['sites', 'http://127.0.0.1:5173/site/'],
  ['cuves', 'http://127.0.0.1:5173/cuves/'],
  ['groupes', 'http://127.0.0.1:5173/groupes/'],
]

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })

for (const [name, url] of pages) {
  const page = await context.newPage()
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(`PAGEERROR: ${error.message}`))

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  const rootHtmlLength = await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? 0)
  await page.screenshot({ path: `/tmp/carburflow-${name}.png`, fullPage: false })
  console.log(`${name}: root=${rootHtmlLength} chars, erreurs=${errors.length}`)
  errors.slice(0, 5).forEach((error) => console.log(`   ! ${error}`))
  await page.close()
}

await browser.close()

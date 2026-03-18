import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import { createServer } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(rootDir, 'public/mbank-pages/manifest.json')
const expectedRoutes = ['/en', '/en/contacts', '/en/cards', '/en/about', '/en/credits']
const missingPageMessage = 'This route is not mirrored locally yet'

const manifest = await readJson(manifestPath)
assert.equal(typeof manifest.generatedAt, 'string', 'manifest is missing generatedAt')
assert.equal(typeof manifest.routes, 'object', 'manifest is missing routes')

for (const route of expectedRoutes) {
  const fileName = manifest.routes[route]

  assert.ok(fileName, `manifest is missing ${route}`)
  await access(path.join(rootDir, 'public/mbank-pages', fileName))
}

const port = await reservePort()
const server = await createServer({
  appType: 'spa',
  logLevel: 'error',
  root: rootDir,
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
})

await server.listen()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 1200 },
})

await page.route(/https:\/\/(?:www\.)?mbank\.kg\/_next\/static\/css\/.*/, async (route) => {
  await route.fulfill({
    body: '/* smoke-test stub */\n',
    contentType: 'text/css; charset=utf-8',
    status: 200,
  })
})

const baseUrl = `http://127.0.0.1:${port}`
const failures = []

page.on('pageerror', (error) => {
  failures.push(error)
})

try {
  for (const route of expectedRoutes) {
    await assertRouteRendered(page, `${baseUrl}${route}`, route)
  }

  await assertHomeMenuNavigation(page, baseUrl)

  if (failures.length > 0) {
    throw new Error(`browser reported ${failures.length} page error(s): ${failures[0].message}`)
  }
} finally {
  await browser.close()
  await server.close()
}

async function assertRouteRendered(page, url, expectedPath) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })

  await page.waitForFunction(
    (state) => {
      return (
        window.location.pathname === state.expectedPath &&
        document.title !== 'MBANK clone' &&
        document.body.classList.contains('mbank-clone-body') &&
        document.querySelector('.mbank-sync-placeholder') === null &&
        !document.body.textContent?.includes(state.missingPageMessage)
      )
    },
    {
      expectedPath,
      missingPageMessage,
    },
  )

  assert.equal(new URL(page.url()).pathname, expectedPath, `${expectedPath} did not stay on route`)
  assert.notEqual(await page.title(), 'MBANK clone', `${expectedPath} rendered the missing page`)
  assert.equal(
    await page.locator('.mbank-sync-placeholder').count(),
    0,
    `${expectedPath} showed the missing page placeholder`,
  )
}

async function assertHomeMenuNavigation(page, baseUrl) {
  await page.goto(`${baseUrl}/en`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelector('.mbank-sync-placeholder') === null)

  const menuTrigger = page.getByRole('button', { name: 'For individuals' }).first()
  await menuTrigger.hover()

  await page.locator('.mbank-mega-menu').getByText('Cards and payments').waitFor({ state: 'visible' })
  await page.locator('.mbank-mega-menu').getByRole('link', { name: 'Cards' }).first().click()

  await page.waitForFunction(
    (expectedPath) => {
      return (
        window.location.pathname === expectedPath &&
        document.title !== 'MBANK clone' &&
        document.body.classList.contains('mbank-clone-body') &&
        document.querySelector('.mbank-sync-placeholder') === null
      )
    },
    '/en/cards',
  )

  assert.equal(new URL(page.url()).pathname, '/en/cards', 'menu navigation did not reach /en/cards')
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const listener = net.createServer()

    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address()

      if (!address || typeof address === 'string') {
        listener.close(() => reject(new Error('Could not reserve a port')))
        return
      }

      const { port } = address

      listener.close(() => resolve(port))
    })
  })
}

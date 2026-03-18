import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMbankAssetMirror } from './mbank-asset-mirror.mjs'

const SITE_ORIGIN = 'https://mbank.kg'
const SITE_HOSTS = new Set(['mbank.kg', 'www.mbank.kg'])
const PAGE_OUTPUT_DIR = 'public/mbank-pages'
const MAX_PAGES = parsePositiveInt(process.env.MBANK_SYNC_MAX_PAGES, 600)
const LINK_CRAWL_DEPTH = 1
const SITEMAP_INDEX_PATH = '/sitemap.xml'
const REQUEST_TIMEOUT_MS = 15000
const SEED_ROUTES = ['/en', '/en/cards', '/en/credits', '/en/deposits', '/en/about', '/ru', '/ky']
const INTERNAL_EXTENSIONS =
  /\.(?:pdf|doc|docx|xls|xlsx|zip|rar|png|jpe?g|webp|svg|ico|xml|json|txt|mp4|mov)$/i
const EXCLUDED_ROUTE_PREFIXES = ['/internal/', '/webview']

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outputDir = path.join(rootDir, PAGE_OUTPUT_DIR)
const assetMirror = createMbankAssetMirror({
  rootDir,
  siteOrigin: SITE_ORIGIN,
  siteHosts: SITE_HOSTS,
  routeResolver: normalizeHrefToLocal,
})

const sitemapRoutes = await collectSitemapRoutes()
const initialRoutes = [...new Set([...SEED_ROUTES, ...sitemapRoutes])].sort(compareRoutePriority)
const seen = new Set()
const queued = new Set(initialRoutes)
const pages = []
const skippedRoutes = []
const manifestRoutes = {}
const manifestAliases = {}
const queue = initialRoutes.map((route) => ({ depth: 0, route }))

await rm(outputDir, { force: true, recursive: true })
await mkdir(outputDir, { recursive: true })
await assetMirror.cleanupAssets()

while (queue.length > 0 && pages.length < MAX_PAGES) {
  const current = queue.shift()

  if (!current || seen.has(current.route)) {
    continue
  }

  seen.add(current.route)

  const result = await fetchPage(current.route)

  if (!result.page) {
    skippedRoutes.push(result.skipped)
    continue
  }

  const page = result.page
  pages.push(page)

  if (pages.length % 25 === 0) {
    console.log(`Synced ${pages.length} pages...`)
  }

  const fileName = fileNameForRoute(page.path)
  manifestRoutes[page.path] = fileName

  if (page.path === '/en') {
    manifestRoutes['/'] = fileName
    manifestAliases['/home'] = fileName
    manifestAliases['/en/'] = fileName
    manifestAliases['/en/home'] = fileName
  }

  if (page.path === '/ru' || page.path === '/ky') {
    manifestAliases[`${page.path}/`] = fileName
    manifestAliases[`${page.path}/home`] = fileName
  }

  await writeFile(path.join(outputDir, fileName), `${JSON.stringify(page)}\n`)

  if (current.depth >= LINK_CRAWL_DEPTH) {
    continue
  }

  for (const route of page.links) {
    if (seen.has(route) || queued.has(route)) {
      continue
    }

    queued.add(route)
    queue.push({ depth: current.depth + 1, route })
  }
}

await writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      routes: manifestRoutes,
      aliases: manifestAliases,
      skippedRoutes,
    },
    null,
    2,
  )}\n`,
)

console.log(
  `Synced ${pages.length} MBANK content pages and ${skippedRoutes.length} skipped routes into ${PAGE_OUTPUT_DIR}`,
)

async function collectSitemapRoutes() {
  const sitemapIndex = await fetchText(new URL(SITEMAP_INDEX_PATH, SITE_ORIGIN))
  const sitemapUrls = extractXmlLocs(sitemapIndex)
    .map((value) => toAbsoluteUrl(value))
    .filter(Boolean)
    .filter((value) => SITE_HOSTS.has(value.hostname))

  const routes = new Set()

  for (const sitemapUrl of sitemapUrls) {
    try {
      const xml = await fetchText(sitemapUrl)

      for (const location of extractXmlLocs(xml)) {
        const route = normalizeHrefToLocal(location)

        if (route) {
          routes.add(route)
        }
      }
    } catch (error) {
      skippedRoutes.push({
        route: sitemapUrl.pathname,
        category: 'endpoint',
        reason: 'sitemap_fetch_failed',
        detail: error instanceof Error ? error.message : String(error),
      })
      console.warn(
        `Skipping sitemap ${sitemapUrl}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return [...routes]
}

async function fetchPage(route) {
  const sourceUrl = new URL(route, SITE_ORIGIN)

  try {
    const response = await fetchTextResponse(sourceUrl)

    if (!response.ok) {
      return {
        skipped: makeSkippedRoute(route, classifyRoute(route), 'http_error', `${response.status} ${response.statusText}`),
      }
    }

    const contentType = response.headers.get('content-type') ?? ''

    if (!contentType.includes('text/html')) {
      return {
        skipped: makeSkippedRoute(
          route,
          'endpoint',
          'non_html_response',
          contentType || 'Missing content-type header',
        ),
      }
    }

    const html = await response.text()
    const titleMatches = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)]
    const appMatch = html.match(/<div id="__next">([\s\S]*?)<\/div><script/i)
    const stylesheetMatches = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gi)]

    if (titleMatches.length === 0 || !appMatch || stylesheetMatches.length === 0) {
      return {
        skipped: makeSkippedRoute(
          route,
          classifyRoute(route),
          'missing_page_shell',
          [
            titleMatches.length === 0 ? 'missing title' : null,
            !appMatch ? 'missing app shell' : null,
            stylesheetMatches.length === 0 ? 'missing stylesheet links' : null,
          ]
            .filter(Boolean)
            .join(', '),
        ),
      }
    }

    const rawMarkup = appMatch[1].trim()

    return {
      page: {
        html: await assetMirror.rewriteMarkup(rawMarkup),
        links: extractInternalRoutes(rawMarkup),
        path: normalizeInternalRoute(route),
        stylesheets: await assetMirror.mirrorStylesheets(
          stylesheetMatches.map((match) => makeAbsolute(match[1])),
        ),
        title: titleMatches.at(-1)[1].trim(),
      },
    }
  } catch (error) {
    return {
      skipped: makeSkippedRoute(
        route,
        classifyRoute(route),
        'fetch_error',
        error instanceof Error ? error.message : String(error),
      ),
    }
  }
}

function extractInternalRoutes(markup) {
  const routes = new Set()

  for (const match of markup.matchAll(/\shref="([^"]+)"/gi)) {
    const route = normalizeHrefToLocal(match[1])

    if (route) {
      routes.add(route)
    }
  }

  return [...routes]
}

function normalizeInternalRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/'

  if (clean === '/') {
    return '/en'
  }

  const localeHomeMatch = clean.match(/^\/(en|ru|ky)\/home$/)

  if (localeHomeMatch) {
    return `/${localeHomeMatch[1]}`
  }

  return clean
}

function normalizeHrefToLocal(value) {
  if (
    !value ||
    value.startsWith('#') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('javascript:')
  ) {
    return null
  }

  try {
    const url = new URL(value, SITE_ORIGIN)

    if (!SITE_HOSTS.has(url.hostname)) {
      return null
    }

    if (url.pathname.startsWith('/_next/') || INTERNAL_EXTENSIONS.test(url.pathname)) {
      return null
    }

    if (EXCLUDED_ROUTE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return null
    }

    return normalizeInternalRoute(url.pathname)
  } catch {
    return null
  }
}

function fileNameForRoute(route) {
  const normalized = route === '/en' ? 'home' : route.replace(/^\//, '').replaceAll('/', '__')
  return `${normalized}.json`
}

function makeAbsolute(value) {
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('#') ||
    value.startsWith('data:')
  ) {
    return value
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  if (value.startsWith('/')) {
    return `${SITE_ORIGIN}${value}`
  }

  return value
}

async function fetchTextResponse(url) {
  return fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

async function fetchText(url) {
  const response = await fetchTextResponse(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

function extractXmlLocs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => match[1].trim())
}

function toAbsoluteUrl(value) {
  try {
    return new URL(value, SITE_ORIGIN)
  } catch {
    return null
  }
}

function compareRoutePriority(left, right) {
  return routePriority(left) - routePriority(right) || left.localeCompare(right)
}

function routePriority(route) {
  if (route === '/en' || route.startsWith('/en/')) {
    return 0
  }

  if (route === '/ru' || route.startsWith('/ru/')) {
    return 1
  }

  if (route === '/ky' || route.startsWith('/ky/')) {
    return 2
  }

  return 3
}

function classifyRoute(route) {
  const pathname = new URL(route, SITE_ORIGIN).pathname

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/internal/') ||
    pathname.startsWith('/webview')
  ) {
    return 'endpoint'
  }

  return 'content'
}

function makeSkippedRoute(route, category, reason, detail) {
  return {
    route,
    category,
    reason,
    detail,
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

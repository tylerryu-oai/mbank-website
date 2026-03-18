import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_ORIGIN = 'https://mbank.kg'
const SITE_HOSTS = new Set(['mbank.kg', 'www.mbank.kg'])
const PAGE_OUTPUT_DIR = 'public/mbank-pages'
const MAX_PAGES = 600
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

const sitemapRoutes = await collectSitemapRoutes()
const initialRoutes = [...new Set([...SEED_ROUTES, ...sitemapRoutes])].sort(compareRoutePriority)
const seen = new Set()
const queued = new Set(initialRoutes)
const pages = []
const manifest = {}
const queue = initialRoutes.map((route) => ({ depth: 0, route }))

await rm(outputDir, { force: true, recursive: true })
await mkdir(outputDir, { recursive: true })

while (queue.length > 0 && pages.length < MAX_PAGES) {
  const current = queue.shift()

  if (!current || seen.has(current.route)) {
    continue
  }

  seen.add(current.route)

  let page

  try {
    page = await fetchPage(current.route)
  } catch (error) {
    console.warn(`Skipping ${current.route}: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }

  pages.push(page)

  if (pages.length % 25 === 0) {
    console.log(`Synced ${pages.length} pages...`)
  }

  const fileName = fileNameForRoute(page.path)
  manifest[page.path] = fileName

  if (page.path === '/en') {
    manifest['/'] = fileName
  }

  if (/^\/(en|ru|ky)$/.test(page.path)) {
    manifest[`${page.path}/home`] = fileName
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
      routes: manifest,
    },
    null,
    2,
  )}\n`,
)

console.log(`Synced ${pages.length} MBANK page snapshots into ${PAGE_OUTPUT_DIR}`)

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
      console.warn(
        `Skipping sitemap ${sitemapUrl}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return [...routes]
}

async function fetchPage(route) {
  const sourceUrl = new URL(route, SITE_ORIGIN)
  const html = await fetchText(sourceUrl)
  const titleMatches = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)]
  const appMatch = html.match(/<div id="__next">([\s\S]*?)<\/div><script/i)
  const stylesheetMatches = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gi)]

  if (titleMatches.length === 0 || !appMatch || stylesheetMatches.length === 0) {
    throw new Error(`Could not extract page title, app markup, or stylesheet URLs from ${sourceUrl}.`)
  }

  const rawMarkup = appMatch[1].trim()

  return {
    html: rewriteHtml(rawMarkup),
    links: extractInternalRoutes(rawMarkup),
    path: normalizeInternalRoute(route),
    stylesheets: stylesheetsDedup(stylesheetMatches.map((match) => makeAbsolute(match[1]))),
    title: titleMatches.at(-1)[1].trim(),
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

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

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

function rewriteHtml(markup) {
  return markup
    .replace(/\s(?:src|poster|action)=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? ''
      const absolute = makeAbsolute(value)
      const quote = quoted[0]
      return full.replace(quoted, `${quote}${absolute}${quote}`)
    })
    .replace(/\shref=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? ''
      const localRoute = normalizeHrefToLocal(value)
      const rewritten = localRoute ?? makeAbsolute(value)
      const quote = quoted[0]
      return full.replace(quoted, `${quote}${rewritten}${quote}`)
    })
    .replace(/\sstyle=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? ''
      const rewritten = value.replace(/url\((['"]?)(\/[^'")]+)\1\)/gi, (_match, quote, url) => {
        return `url(${quote}${makeAbsolute(url)}${quote})`
      })
      const quote = quoted[0]
      return full.replace(quoted, `${quote}${rewritten}${quote}`)
    })
    .replace(/\ssrcset=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? ''
      const rewritten = value
        .split(',')
        .map((part) => {
          const [url, descriptor] = part.trim().split(/\s+/, 2)
          return [makeAbsolute(url), descriptor].filter(Boolean).join(' ')
        })
        .join(', ')
      const quote = quoted[0]
      return full.replace(quoted, `${quote}${rewritten}${quote}`)
    })
}

function stylesheetsDedup(stylesheets) {
  return [...new Set(stylesheets)]
}

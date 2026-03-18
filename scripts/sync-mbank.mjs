import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://mbank.kg/en'
const SITE_ORIGIN = 'https://mbank.kg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.join(rootDir, 'src')

const response = await fetch(SOURCE_URL, {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'accept-language': 'en-US,en;q=0.9',
  },
})

if (!response.ok) {
  throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`)
}

const html = await response.text()

const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
const appMatch = html.match(/<div id="__next">([\s\S]*?)<\/div><script/i)
const stylesheetMatches = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gi)]

if (!titleMatch || !appMatch || stylesheetMatches.length === 0) {
  throw new Error('Could not extract page title, app markup, or stylesheet URLs from source HTML.')
}

const makeAbsolute = (value) => {
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

const rewriteHtml = (markup) =>
  markup
    .replace(/\s(?:src|href|poster|action)=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? ''
      const absolute = makeAbsolute(value)
      const quote = quoted[0]
      return full.replace(quoted, `${quote}${absolute}${quote}`)
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

const appHtml = rewriteHtml(appMatch[1]).trim()
const pageTitle = titleMatch[1].trim()
const stylesheets = stylesheetsDedup(stylesheetMatches.map((match) => makeAbsolute(match[1])))

await mkdir(srcDir, { recursive: true })
await writeFile(path.join(srcDir, 'mbank-page.html'), `${appHtml}\n`)
await writeFile(
  path.join(srcDir, 'mbank-meta.ts'),
  `export const pageTitle = ${JSON.stringify(pageTitle)};\n` +
    `export const stylesheetUrls = ${JSON.stringify(stylesheets, null, 2)} as const;\n`,
)

console.log(`Synced MBANK homepage snapshot from ${SOURCE_URL}`)

function stylesheetsDedup(stylesheets) {
  return [...new Set(stylesheets)]
}

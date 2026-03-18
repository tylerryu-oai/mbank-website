import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

const TEXT_CSS_MIME = 'text/css'
const DEFAULT_OUTPUT_DIR = 'public/mbank-assets'
const DEFAULT_PUBLIC_PATH = '/mbank-assets'

export function createMbankAssetMirror({
  rootDir,
  siteOrigin,
  siteHosts,
  routeResolver,
  assetOutputDir = DEFAULT_OUTPUT_DIR,
  assetPublicPath = DEFAULT_PUBLIC_PATH,
}) {
  const outputDir = path.join(rootDir, assetOutputDir)
  const assetPromises = new Map()

  const cleanupAssets = async () => {
    await rm(outputDir, { force: true, recursive: true })
  }

  const mirrorStylesheets = async (hrefs) => {
    const localUrls = await Promise.all(hrefs.map((href) => mirrorAssetUrl(href, { preferredKind: 'css' })))
    return localUrls.filter(Boolean)
  }

  const rewriteMarkup = async (markup) => {
    const assetUrls = new Set()

    for (const match of markup.matchAll(/\s(src|poster|action|href)=("([^"]*)"|'([^']*)')/gi)) {
      const attribute = match[1].toLowerCase()
      const value = match[3] ?? match[4] ?? ''

      if (attribute === 'href' || attribute === 'action') {
        if (routeResolver(value)) {
          continue
        }
      }

      const absoluteUrl = toAbsoluteSiteUrl(value)

      if (absoluteUrl && isMirrorableAssetUrl(absoluteUrl)) {
        assetUrls.add(absoluteUrl.toString())
      }
    }

    for (const match of markup.matchAll(/\sstyle=("([^"]*)"|'([^']*)')/gi)) {
      const value = match[2] ?? match[3] ?? ''

      for (const rawUrl of collectCssLikeUrls(value)) {
        const absoluteUrl = toAbsoluteSiteUrl(rawUrl)

        if (absoluteUrl && isMirrorableAssetUrl(absoluteUrl)) {
          assetUrls.add(absoluteUrl.toString())
        }
      }
    }

    for (const match of markup.matchAll(/\ssrcset=("([^"]*)"|'([^']*)')/gi)) {
      const value = match[2] ?? match[3] ?? ''

      for (const rawUrl of collectSrcsetUrls(value)) {
        const absoluteUrl = toAbsoluteSiteUrl(rawUrl)

        if (absoluteUrl && isMirrorableAssetUrl(absoluteUrl)) {
          assetUrls.add(absoluteUrl.toString())
        }
      }
    }

    const mirroredAssets = new Map(
      await Promise.all([...assetUrls].map(async (assetUrl) => [assetUrl, await mirrorAssetUrl(assetUrl)])),
    )

    return markup
      .replace(/\s(src|poster|action)=("([^"]*)"|'([^']*)')/gi, (full, attribute, quoted, doubleValue, singleValue) => {
        const value = doubleValue ?? singleValue ?? ''
        const replacement = rewriteMarkupReference(attribute.toLowerCase(), value, mirroredAssets)
        const quote = quoted[0]
        return full.replace(quoted, `${quote}${replacement}${quote}`)
      })
      .replace(/\shref=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
        const value = doubleValue ?? singleValue ?? ''
        const replacement = rewriteMarkupReference('href', value, mirroredAssets)
        const quote = quoted[0]
        return full.replace(quoted, `${quote}${replacement}${quote}`)
      })
      .replace(/\sstyle=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
        const value = doubleValue ?? singleValue ?? ''
        const replacement = value.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_match, quote, rawUrl) => {
          const absoluteUrl = toAbsoluteSiteUrl(rawUrl)
          if (!absoluteUrl || !isMirrorableAssetUrl(absoluteUrl)) {
            return `url(${quote}${rawUrl}${quote})`
          }

          const mirroredUrl = mirroredAssets.get(absoluteUrl.toString())
          return `url(${quote}${mirroredUrl ?? assetPublicUrlForAsset(absoluteUrl)}${quote})`
        })
        const quote = quoted[0]
        return full.replace(quoted, `${quote}${replacement}${quote}`)
      })
      .replace(/\ssrcset=("([^"]*)"|'([^']*)')/gi, (full, quoted, doubleValue, singleValue) => {
        const value = doubleValue ?? singleValue ?? ''
        const replacement = value
          .split(',')
          .map((part) => {
            const [rawUrl, descriptor] = part.trim().split(/\s+/, 2)
            if (!rawUrl) {
              return part
            }

            const absoluteUrl = toAbsoluteSiteUrl(rawUrl)
            if (!absoluteUrl || !isMirrorableAssetUrl(absoluteUrl)) {
              return [rawUrl, descriptor].filter(Boolean).join(' ')
            }

            const mirroredUrl = mirroredAssets.get(absoluteUrl.toString())
            return [mirroredUrl ?? assetPublicUrlForAsset(absoluteUrl), descriptor].filter(Boolean).join(' ')
          })
          .join(', ')
        const quote = quoted[0]
        return full.replace(quoted, `${quote}${replacement}${quote}`)
      })
  }

  const mirrorAssetUrl = async (value, options = {}) => {
    const absoluteUrl = toAbsoluteSiteUrl(value)

    if (!absoluteUrl || !isMirrorableAssetUrl(absoluteUrl)) {
      return value
    }

    const cacheKey = absoluteUrl.toString()

    if (assetPromises.has(cacheKey)) {
      return assetPromises.get(cacheKey)
    }

    const promise = (async () => {
      const response = await fetchSiteResource(absoluteUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch asset ${absoluteUrl}: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') ?? ''
      const localRelativePath = assetPathForUrl(absoluteUrl, contentType, options.preferredKind)
      const localAbsolutePath = path.join(outputDir, localRelativePath)
      await mkdir(path.dirname(localAbsolutePath), { recursive: true })

      if (isCssAsset(contentType, localRelativePath)) {
        const cssText = await response.text()
        const rewrittenCss = await rewriteCss(cssText, absoluteUrl)
        await writeFile(localAbsolutePath, rewrittenCss)
      } else if (isTextAsset(contentType, localRelativePath)) {
        await writeFile(localAbsolutePath, await response.text())
      } else {
        await writeFile(localAbsolutePath, Buffer.from(await response.arrayBuffer()))
      }

      return `${assetPublicPath}/${localRelativePath.replaceAll(path.sep, '/')}`
    })()

    assetPromises.set(cacheKey, promise)
    return promise
  }

  const rewriteCss = async (cssText, cssUrl) => {
    const assetUrls = new Set()

    for (const rawUrl of collectCssLikeUrls(cssText)) {
      const absoluteUrl = toAbsoluteSiteUrl(rawUrl, cssUrl)

      if (absoluteUrl && isMirrorableAssetUrl(absoluteUrl)) {
        assetUrls.add(absoluteUrl.toString())
      }
    }

    for (const rawUrl of collectCssImportUrls(cssText)) {
      const absoluteUrl = toAbsoluteSiteUrl(rawUrl, cssUrl)

      if (absoluteUrl && isMirrorableAssetUrl(absoluteUrl)) {
        assetUrls.add(absoluteUrl.toString())
      }
    }

    const mirroredAssets = new Map(
      await Promise.all([...assetUrls].map(async (assetUrl) => [assetUrl, await mirrorAssetUrl(assetUrl)])),
    )

    return cssText
      .replace(/url\((['"]?)([^'")]+)\1\)/gi, (_match, quote, rawUrl) => {
        const absoluteUrl = toAbsoluteSiteUrl(rawUrl, cssUrl)
        if (!absoluteUrl || !isMirrorableAssetUrl(absoluteUrl)) {
          return `url(${quote}${rawUrl}${quote})`
        }

        const mirroredUrl = mirroredAssets.get(absoluteUrl.toString())
        return `url(${quote}${mirroredUrl ?? assetPublicUrlForAsset(absoluteUrl)}${quote})`
      })
      .replace(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1\s*\)?/gi, (full, quote, rawUrl) => {
        const absoluteUrl = toAbsoluteSiteUrl(rawUrl, cssUrl)
        if (!absoluteUrl || !isMirrorableAssetUrl(absoluteUrl)) {
          return full
        }

        const mirroredUrl = mirroredAssets.get(absoluteUrl.toString())
        return `@import url(${quote}${mirroredUrl ?? assetPublicUrlForAsset(absoluteUrl)}${quote})`
      })
  }

  return {
    cleanupAssets,
    mirrorAssetUrl,
    mirrorStylesheets,
    rewriteMarkup,
    assetOutputDir: outputDir,
  }

  function rewriteMarkupReference(attribute, value, mirroredAssets) {
    const route = routeResolver(value)

    if ((attribute === 'href' || attribute === 'action') && route) {
      return route
    }

    const absoluteUrl = toAbsoluteSiteUrl(value)

    if (absoluteUrl && isMirrorableAssetUrl(absoluteUrl)) {
      return mirroredAssets.get(absoluteUrl.toString()) ?? assetPublicUrlForAsset(absoluteUrl)
    }

    if (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('//') ||
      value.startsWith('data:')
    ) {
      return value
    }

    if (route) {
      return route
    }

    return toAbsoluteSiteHref(value)
  }

  function isCssAsset(contentType, localRelativePath) {
    return localRelativePath.endsWith('.css') || contentType.includes(TEXT_CSS_MIME)
  }

  function isTextAsset(contentType, localRelativePath) {
    return isCssAsset(contentType, localRelativePath) || contentType.includes('svg') || contentType.includes('xml') || contentType.startsWith('text/')
  }

  function assetPublicUrlForAsset(absoluteUrl) {
    return `${assetPublicPath}/${assetPathForUrl(absoluteUrl, '', undefined).replaceAll(path.sep, '/')}`
  }

  function toAbsoluteSiteUrl(value, baseUrl = siteOrigin) {
    if (
      !value ||
      value.startsWith('mailto:') ||
      value.startsWith('tel:') ||
      value.startsWith('javascript:') ||
      value.startsWith('data:') ||
      value.startsWith('#')
    ) {
      return null
    }

    try {
      return new URL(value, baseUrl)
    } catch {
      return null
    }
  }

  function toAbsoluteSiteHref(value) {
    const absoluteUrl = toAbsoluteSiteUrl(value)
    return absoluteUrl ? absoluteUrl.toString() : value
  }

  function isMirrorableAssetUrl(url) {
    if (!siteHosts.has(url.hostname)) {
      return false
    }

    if (url.pathname.startsWith('/_next/')) {
      return true
    }

    const lastSegment = url.pathname.split('/').pop() ?? ''
    return /\.[A-Za-z0-9]{2,6}$/.test(lastSegment)
  }

  function assetPathForUrl(url, contentType, preferredKind) {
    const cleanSegments = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => sanitizeSegment(decodeURIComponent(segment)))

    let fileName = cleanSegments.pop() ?? 'index'
    const parsed = path.posix.parse(fileName)
    const queryHash = url.search ? `__${hashString(url.search).slice(0, 10)}` : ''
    const extension = parsed.ext || extensionForContentType(contentType, preferredKind)
    const baseName = sanitizeSegment(parsed.name || 'asset')

    if (url.pathname.endsWith('/')) {
      fileName = `index${queryHash}${extension}`
    } else {
      fileName = `${baseName}${queryHash}${extension || parsed.ext || ''}`
    }

    return path.posix.join(url.hostname, ...cleanSegments, fileName)
  }

  function extensionForContentType(contentType, preferredKind) {
    if (preferredKind === 'css') {
      return '.css'
    }

    if (contentType.includes('font/woff2')) return '.woff2'
    if (contentType.includes('font/woff')) return '.woff'
    if (contentType.includes('font/ttf')) return '.ttf'
    if (contentType.includes('image/svg+xml')) return '.svg'
    if (contentType.includes('image/png')) return '.png'
    if (contentType.includes('image/jpeg')) return '.jpg'
    if (contentType.includes('image/webp')) return '.webp'
    if (contentType.includes('image/avif')) return '.avif'
    if (contentType.includes('text/css')) return '.css'
    if (contentType.includes('application/javascript')) return '.js'

    return ''
  }

  function sanitizeSegment(value) {
    return value.replace(/[^A-Za-z0-9._-]/g, '_')
  }

  function hashString(value) {
    return createHash('sha1').update(value).digest('hex')
  }

  async function fetchSiteResource(url) {
    return fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
  }

  function collectCssLikeUrls(text) {
    return [...text.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)].map((match) => match[2].trim())
  }

  function collectCssImportUrls(text) {
    return [...text.matchAll(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1\s*\)?/gi)].map((match) =>
      match[2].trim(),
    )
  }

  function collectSrcsetUrls(value) {
    return value
      .split(',')
      .map((part) => part.trim().split(/\s+/, 2)[0])
      .filter(Boolean)
  }
}

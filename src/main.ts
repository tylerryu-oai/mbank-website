import './style.css'
import { enhanceMbankPage } from './enhanceMbank'

type PageData = {
  html: string
  path: string
  stylesheets: string[]
  title: string
}

type SkippedRoute = {
  category: 'content' | 'endpoint'
  detail?: string
  reason: string
  route: string
}

type ManifestData = {
  generatedAt: string
  aliases?: Record<string, string>
  routes: Record<string, string>
  skippedRoutes?: SkippedRoute[]
}

const MBANK_HOSTS = new Set(['mbank.kg', 'www.mbank.kg'])
const DEFAULT_ROUTE = '/en'
const LOCALE_ROOTS = new Set(['/en', '/ru', '/ky'])

let cleanupPageEnhancements: (() => void) | undefined
let manifestPromise: Promise<ManifestData> | undefined
const stylesheetLoads = new Map<string, Promise<void>>()

const ensureRemoteStylesheets = async (hrefs: readonly string[]) => {
  const loads = hrefs.map((href) => {
    const existing = document.querySelector<HTMLLinkElement>(`link[data-mbank-stylesheet="${href}"]`)

    if (existing) {
      if (stylesheetLoads.has(href)) {
        return stylesheetLoads.get(href)
      }

      return Promise.resolve()
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.mbankStylesheet = href

    const loadPromise = new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => resolve(), { once: true })
      link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet ${href}`)), {
        once: true,
      })
    })

    stylesheetLoads.set(href, loadPromise)
    document.head.append(link)
    return loadPromise
  })

  await Promise.all(loads)
}

const getManifest = async () => {
  manifestPromise ??= fetch('/mbank-pages/manifest.json').then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load route manifest: ${response.status}`)
    }

    return (await response.json()) as ManifestData
  })

  return manifestPromise
}

const getPageData = async (route: string) => {
  const manifest = await getManifest()
  const fileName = manifest.routes[route] ?? manifest.aliases?.[route]

  if (!fileName) {
    return null
  }

  const response = await fetch(`/mbank-pages/${fileName}`)

  if (!response.ok) {
    throw new Error(`Failed to load page data for ${route}: ${response.status}`)
  }

  return (await response.json()) as PageData
}

const mountPage = async (page: PageData) => {
  document.title = page.title
  await ensureRemoteStylesheets(page.stylesheets)

  const app = document.querySelector<HTMLDivElement>('#app')

  if (!app) {
    throw new Error('Missing #app root node')
  }

  cleanupPageEnhancements?.()
  app.innerHTML = page.html
  document.body.classList.add('mbank-clone-body')
  cleanupPageEnhancements = enhanceMbankPage()
  window.scrollTo(0, 0)
}

const setLoading = (loading: boolean) => {
  document.body.classList.toggle('mbank-loading', loading)
}

const renderMissingPage = (route: string) => {
  cleanupPageEnhancements?.()

  const app = document.querySelector<HTMLDivElement>('#app')

  if (!app) {
    throw new Error('Missing #app root node')
  }

  document.title = 'MBANK clone'
  app.innerHTML = `
    <div class="mbank-sync-placeholder">
      This route is not mirrored locally yet: <code>${route}</code><br />
      Run <code>npm run sync:site</code> to refresh the local MBANK page set.
    </div>
  `
}

const cleanRoute = (pathname: string) => {
  const cleaned = pathname.replace(/\/+$/, '') || '/'

  if (cleaned === '/') {
    return DEFAULT_ROUTE
  }

  const localeHomeMatch = cleaned.match(/^\/(en|ru|ky)\/home$/)

  if (localeHomeMatch) {
    return `/${localeHomeMatch[1]}`
  }

  if (LOCALE_ROOTS.has(cleaned)) {
    return cleaned
  }

  return cleaned
}

const normalizeRoute = (value: string) => {
  try {
    const url = new URL(value, window.location.origin)

    if (url.origin === window.location.origin) {
      return cleanRoute(url.pathname)
    }

    if (!MBANK_HOSTS.has(url.hostname)) {
      return null
    }

    return cleanRoute(url.pathname)
  } catch {
    return null
  }
}

const navigateTo = async (route: string, options: { replace?: boolean } = {}) => {
  setLoading(true)

  try {
    const page = await getPageData(route)

    if (!page) {
      renderMissingPage(route)
      return
    }

    await mountPage(page)

    if (cleanRoute(window.location.pathname) !== route) {
      const method = options.replace ? 'replaceState' : 'pushState'
      window.history[method]({ route }, '', route)
    }
  } finally {
    setLoading(false)
  }
}

const onDocumentClick = (event: MouseEvent) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }

  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  const link = target.closest<HTMLAnchorElement>('a[href]')

  if (!link || link.target === '_blank' || link.hasAttribute('download')) {
    return
  }

  const href = link.getAttribute('href')

  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return
  }

  const route = normalizeRoute(href)

  if (!route) {
    return
  }

  event.preventDefault()
  void navigateTo(route)
}

const bootstrap = async () => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('popstate', () => {
    void navigateTo(cleanRoute(window.location.pathname), { replace: true })
  })

  await navigateTo(cleanRoute(window.location.pathname), { replace: true })
}

void bootstrap()

import './style.css'
import { enhanceMbankPage } from './enhanceMbank'
import pageHtml from './mbank-page.html?raw'
import { pageTitle, stylesheetUrls } from './mbank-meta'

const ensureRemoteStylesheets = () => {
  for (const href of stylesheetUrls) {
    const existing = document.querySelector(`link[data-mbank-stylesheet="${href}"]`)
    if (existing) {
      continue
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.mbankStylesheet = href
    document.head.append(link)
  }
}

const mountPage = () => {
  document.title = pageTitle
  ensureRemoteStylesheets()

  const app = document.querySelector<HTMLDivElement>('#app')

  if (!app) {
    throw new Error('Missing #app root node')
  }

  app.innerHTML = pageHtml
  document.body.classList.add('mbank-clone-body')
  enhanceMbankPage()
}

mountPage()

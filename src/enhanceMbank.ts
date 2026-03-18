const HERO_SLIDER_SELECTOR = '.CbkHomeBannerCotained_bannerWrapper__0LaIl'
const HERO_ARROW_SELECTOR = '.CbkHomeBannerCotained_btnBannerArrow__P_1_j'
const HERO_PAGINATION_SELECTOR = '.swiper-pagination'
const LOADED_IMAGE_SELECTOR = '.style_image__UDfa7, .style_adaptive_image__mPC4F'
const DESKTOP_HEADER_SELECTOR = '.styles_parent__SUIpW .styles_wrapper__NFRyc'
const DESKTOP_PRIMARY_TABS_SELECTOR =
  '.styles_header__7dm3x > .styles_flex__ztJSU > .styles_tabs__mV4dE > .style_link__LsNhc'
const DESKTOP_ISLAMIC_TAB_SELECTOR = '.styles_header__7dm3x .styles_mainLink__v_8zY .style_link__LsNhc'
const FOOTER_DEVELOPED_BY_SELECTOR = '.CbkFooter_developedText___cFuE'
const FOOTER_DEVELOPED_BY_IMAGE_SELECTOR = '.CbkFooter_developed_img__K_DAH'
const MOBILE_FOOTER_SECTION_SELECTOR = '.CbkListNavigation_wrapperMobile__KPIlK'
const MOBILE_FOOTER_LIST_SELECTOR = '.CbkListNavigation_wrapperList__3DY_4'

type MenuLink = {
  href: string
  label: string
}

type MenuSection = {
  links: MenuLink[]
  title: string
}

type DesktopMenuConfig = {
  href: string
  label: string
  sections: MenuSection[]
  summary: string
}

const DESKTOP_MENU_CONFIGS: DesktopMenuConfig[] = [
  {
    href: '/en',
    label: 'For individuals',
    summary: 'Cards, loans, deposits, transfers, and everyday MBANK products.',
    sections: [
      {
        title: 'Everyday products',
        links: [
          { href: '/en/junior', label: 'MJunior' },
          { href: '/en/mplus', label: 'MPlus' },
          { href: '/en/mbonus', label: 'MBonus' },
          { href: '/en/mtravel', label: 'MTravel' },
          { href: '/en/market', label: 'MMarket' },
        ],
      },
      {
        title: 'Cards and payments',
        links: [
          { href: '/en/cards', label: 'Cards' },
          { href: '/en/cards/visa_infinite', label: 'Visa Infinite' },
          { href: '/en/cards/mastercard', label: 'Mastercard' },
          { href: '/en/card_services', label: 'Card services' },
          { href: '/en/gold_bars', label: 'Gold bars' },
        ],
      },
      {
        title: 'Loans and savings',
        links: [
          { href: '/en/credits', label: 'Credits' },
          { href: '/en/credits/online-kredit', label: 'Online credit' },
          { href: '/en/deposits', label: 'Deposits' },
          { href: '/en/deposits/nakopitelniy', label: 'Top-up saving deposit' },
          { href: '/en/early_payment', label: 'Early repayment' },
        ],
      },
      {
        title: 'Support and transfers',
        links: [
          { href: '/en/denezhnye-perevody-v-mbank', label: 'Money transfers' },
          { href: '/en/contacts', label: 'Contacts' },
          { href: '/en/maps', label: 'Offices and ATMs' },
          { href: '/en/safe', label: 'Safety deposit boxes' },
          { href: '/en/campaign', label: 'Promotions' },
        ],
      },
    ],
  },
  {
    href: '/en/mbusiness',
    label: 'For business',
    summary: 'Business banking, payments, cash registers, and digital tools for merchants.',
    sections: [
      {
        title: 'Business products',
        links: [
          { href: '/en/mbusiness', label: 'MBusiness' },
          { href: '/en/mkassa', label: 'MKassa' },
          { href: '/en/mprofi', label: 'MProfi' },
          { href: '/en/market', label: 'MMarket' },
          { href: '/en/mbusiness_deposit', label: 'Business deposit' },
        ],
      },
      {
        title: 'Funding and operations',
        links: [
          { href: '/en/mbusiness/online_loan', label: 'Online loan' },
          { href: '/en/credits/biznes-kredit', label: 'Business credit' },
          { href: '/en/rko', label: 'Settlement services' },
          { href: '/en/tariffs', label: 'Tariffs' },
          { href: '/en/documents', label: 'Documents' },
        ],
      },
      {
        title: 'Company support',
        links: [
          { href: '/en/reports', label: 'Reports' },
          { href: '/en/ownerships', label: 'Sale of assets' },
          { href: '/en/contacts', label: 'Contacts' },
          { href: '/en/about', label: 'About the bank' },
          { href: '/en/maps', label: 'Branches and ATMs' },
        ],
      },
    ],
  },
  {
    href: '/en/academy',
    label: 'MAcademy',
    summary: 'Learn more about MBANK products, services, and customer education materials.',
    sections: [],
  },
  {
    href: '/en/islam_finance',
    label: 'MIslamic',
    summary: 'Islamic finance products, cards, Murabaha, Mudaraba, and Sharia board materials.',
    sections: [
      {
        title: 'Core sections',
        links: [
          { href: '/en/islam_finance', label: 'Overview' },
          { href: '/en/islam_finance/sharia_council', label: 'Sharia council' },
          { href: '/en/islam_finance/mudaraba', label: 'Mudaraba' },
          { href: '/en/islam_finance/istisnaa', label: 'Istisnaa' },
        ],
      },
      {
        title: 'Murabaha',
        links: [
          { href: '/en/islam_finance/murabaha', label: 'Murabaha' },
          { href: '/en/islam_finance/murabaha/auto', label: 'Auto' },
          { href: '/en/islam_finance/murabaha/business', label: 'Business' },
          { href: '/en/islam_finance/murabaha/consumer', label: 'Consumer' },
          { href: '/en/islam_finance/murabaha/mortgage', label: 'Mortgage' },
        ],
      },
      {
        title: 'Islamic cards',
        links: [
          { href: '/en/islam_finance/cards', label: 'Cards' },
          { href: '/en/islam_finance/cards/visa', label: 'Visa' },
          { href: '/en/islam_finance/cards/visa_gold', label: 'Visa Gold' },
          { href: '/en/islam_finance/cards/visa_virtual', label: 'Visa Virtual' },
        ],
      },
    ],
  },
]

export const enhanceMbankPage = () => {
  revealImages()
  replaceFooterBranding()

  const cleanups = [setupDesktopMegaMenu(), setupHeroSlider(), setupMobileFooterAccordions()].filter(
    (cleanup): cleanup is () => void => Boolean(cleanup),
  )

  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

const replaceFooterBranding = () => {
  for (const footerText of document.querySelectorAll<HTMLElement>(FOOTER_DEVELOPED_BY_SELECTOR)) {
    footerText.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = (node.textContent ?? '').replace(/Developed by|Разработано/g, 'Developed by')
      }
    })

    const imageWrapper = footerText.querySelector<HTMLElement>(FOOTER_DEVELOPED_BY_IMAGE_SELECTOR)

    if (imageWrapper) {
      imageWrapper.classList.remove('style_image__UDfa7')
      imageWrapper.removeAttribute('style')
      imageWrapper.innerHTML = 'Codex'
      imageWrapper.setAttribute('aria-label', 'Codex')
    } else if (!/Codex/.test(footerText.textContent ?? '')) {
      footerText.append(' Codex')
    }
  }
}

const setupDesktopMegaMenu = () => {
  const wrapper = document.querySelector<HTMLElement>(DESKTOP_HEADER_SELECTOR)
  const primaryTabs = Array.from(
    document.querySelectorAll<HTMLElement>(DESKTOP_PRIMARY_TABS_SELECTOR),
  )
  const islamicTab = document.querySelector<HTMLElement>(DESKTOP_ISLAMIC_TAB_SELECTOR)
  const tabElements = [...primaryTabs, islamicTab].filter(
    (element): element is HTMLElement => Boolean(element),
  )

  if (!wrapper || tabElements.length !== DESKTOP_MENU_CONFIGS.length) {
    return
  }

  const menu = document.createElement('div')
  menu.className = 'styles_dropdown__Ufjy1 mbank-mega-menu'
  menu.hidden = true
  wrapper.append(menu)

  let activeIndex = -1
  let closeTimer = 0

  const cancelClose = () => {
    window.clearTimeout(closeTimer)
  }

  const syncActiveTabs = () => {
    tabElements.forEach((tab, index) => {
      tab.classList.toggle('style_active__G6lcx', index === activeIndex)
    })
  }

  const closeMenu = () => {
    cancelClose()
    activeIndex = -1
    menu.hidden = true
    menu.innerHTML = ''
    syncActiveTabs()
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer = window.setTimeout(closeMenu, 120)
  }

  const renderMenu = (config: DesktopMenuConfig) => {
    const sectionsHtml = config.sections
      .map(
        (section) => `
          <section class="mbank-mega-menu__section">
            <p class="mbank-mega-menu__section-title">${section.title}</p>
            <div class="mbank-mega-menu__links">
              ${section.links
                .map(
                  (link) => `
                    <a class="mbank-mega-menu__link" href="${link.href}">
                      <span>${link.label}</span>
                    </a>
                  `,
                )
                .join('')}
            </div>
          </section>
        `,
      )
      .join('')

    menu.innerHTML = `
      <div class="mbank-mega-menu__intro">
        <p class="mbank-mega-menu__eyebrow">${config.label}</p>
        <p class="mbank-mega-menu__summary">${config.summary}</p>
        <a class="mbank-mega-menu__cta" href="${config.href}">Open section</a>
      </div>
      <div class="mbank-mega-menu__grid">
        ${sectionsHtml}
      </div>
    `
  }

  const openMenu = (index: number) => {
    const config = DESKTOP_MENU_CONFIGS[index]

    cancelClose()

    if (!config || config.sections.length === 0) {
      closeMenu()
      return
    }

    activeIndex = index
    renderMenu(config)
    menu.hidden = false
    syncActiveTabs()
  }

  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target

    if (!(target instanceof Node)) {
      return
    }

    if (!wrapper.contains(target)) {
      closeMenu()
    }
  }

  tabElements.forEach((tab, index) => {
    const config = DESKTOP_MENU_CONFIGS[index]
    const open = () => openMenu(index)
    const onClick = () => {
      window.location.assign(config.href)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        window.location.assign(config.href)
      }

      if (event.key === ' ') {
        event.preventDefault()

        if (config.sections.length > 0) {
          openMenu(index)
        }
      }

      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    tab.setAttribute('tabindex', '0')
    tab.setAttribute('role', config.sections.length > 0 ? 'button' : 'link')
    tab.addEventListener('mouseenter', open)
    tab.addEventListener('focus', open)
    tab.addEventListener('click', onClick)
    tab.addEventListener('keydown', onKeyDown)

    ;(tab as HTMLElement & { __mbankCleanup?: () => void }).__mbankCleanup = () => {
      tab.removeEventListener('mouseenter', open)
      tab.removeEventListener('focus', open)
      tab.removeEventListener('click', onClick)
      tab.removeEventListener('keydown', onKeyDown)
    }
  })

  wrapper.addEventListener('mouseenter', cancelClose)
  wrapper.addEventListener('mouseleave', scheduleClose)
  menu.addEventListener('mouseenter', cancelClose)
  menu.addEventListener('mouseleave', scheduleClose)
  document.addEventListener('click', onDocumentClick)

  return () => {
    closeMenu()
    wrapper.removeEventListener('mouseenter', cancelClose)
    wrapper.removeEventListener('mouseleave', scheduleClose)
    menu.removeEventListener('mouseenter', cancelClose)
    menu.removeEventListener('mouseleave', scheduleClose)
    document.removeEventListener('click', onDocumentClick)
    menu.remove()

    tabElements.forEach((tab) => {
      tab.classList.remove('style_active__G6lcx')
      tab.removeAttribute('role')
      tab.removeAttribute('tabindex')
      ;(tab as HTMLElement & { __mbankCleanup?: () => void }).__mbankCleanup?.()
      delete (tab as HTMLElement & { __mbankCleanup?: () => void }).__mbankCleanup
    })
  }
}

const revealImages = () => {
  for (const element of document.querySelectorAll<HTMLElement>(LOADED_IMAGE_SELECTOR)) {
    element.classList.add('loaded')
  }
}

const setupHeroSlider = () => {
  const slider = document.querySelector<HTMLElement>(HERO_SLIDER_SELECTOR)
  const wrapper = slider?.querySelector<HTMLElement>('.swiper-wrapper')

  if (!slider || !wrapper) {
    return
  }

  const slides = Array.from(wrapper.children).filter((element): element is HTMLElement =>
    element.classList.contains('swiper-slide'),
  )

  if (slides.length <= 1) {
    return
  }

  const controlsRoot = slider.parentElement
  const pagination = controlsRoot?.querySelector<HTMLElement>(HERO_PAGINATION_SELECTOR)
  const arrows = controlsRoot?.querySelectorAll<HTMLElement>(HERO_ARROW_SELECTOR) ?? []
  const [prevButton, nextButton] = arrows

  wrapper.style.transition = 'transform 500ms ease'
  wrapper.style.willChange = 'transform'

  const bullets = pagination
    ? slides.map((_, index) => {
        const bullet = document.createElement('button')
        bullet.type = 'button'
        bullet.className = 'swiper-pagination-bullet'
        bullet.setAttribute('aria-label', `Go to slide ${index + 1}`)
        bullet.addEventListener('click', () => {
          goTo(index)
          restartAutoPlay()
        })
        pagination.append(bullet)
        return bullet
      })
    : []

  let activeIndex = 0
  let autoPlayTimer = window.setInterval(() => {
    goTo(activeIndex + 1)
  }, 6000)

  const sync = () => {
    const slideWidth = slider.clientWidth

    slides.forEach((slide) => {
      slide.style.width = `${slideWidth}px`
    })

    wrapper.style.width = `${slideWidth * slides.length}px`
    wrapper.style.transform = `translate3d(-${slideWidth * activeIndex}px, 0, 0)`

    slides.forEach((slide, index) => {
      slide.classList.toggle('swiper-slide-active', index === activeIndex)
      slide.classList.toggle('swiper-slide-next', index === (activeIndex + 1) % slides.length)
      slide.classList.toggle(
        'swiper-slide-prev',
        index === (activeIndex - 1 + slides.length) % slides.length,
      )
    })

    bullets.forEach((bullet, index) => {
      bullet.classList.toggle('swiper-pagination-bullet-active', index === activeIndex)
    })
  }

  const goTo = (index: number) => {
    activeIndex = (index + slides.length) % slides.length
    sync()
  }

  const restartAutoPlay = () => {
    window.clearInterval(autoPlayTimer)
    autoPlayTimer = window.setInterval(() => {
      goTo(activeIndex + 1)
    }, 6000)
  }

  prevButton?.addEventListener('click', () => {
    goTo(activeIndex - 1)
    restartAutoPlay()
  })

  nextButton?.addEventListener('click', () => {
    goTo(activeIndex + 1)
    restartAutoPlay()
  })

  const stopAutoPlay = () => {
    window.clearInterval(autoPlayTimer)
  }

  controlsRoot?.addEventListener('mouseenter', stopAutoPlay)
  controlsRoot?.addEventListener('mouseleave', restartAutoPlay)
  window.addEventListener('resize', sync)

  sync()

  return () => {
    window.clearInterval(autoPlayTimer)
    window.removeEventListener('resize', sync)
    controlsRoot?.removeEventListener('mouseenter', stopAutoPlay)
    controlsRoot?.removeEventListener('mouseleave', restartAutoPlay)
  }
}

const setupMobileFooterAccordions = () => {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(MOBILE_FOOTER_SECTION_SELECTOR))

  if (sections.length === 0) {
    return
  }

  const cleanups: Array<() => void> = []

  sections.forEach((section) => {
    const container = section.parentElement
    const list = container?.querySelector<HTMLElement>(MOBILE_FOOTER_LIST_SELECTOR)
    const header = section.querySelector<HTMLElement>('.CbkListNavigation_header__gUk_u')
    const arrow = section.querySelector<HTMLElement>('.CbkListNavigation_arrow__DKJKo')

    if (!list || !header) {
      return
    }

    let expanded = false

    const sync = () => {
      list.style.display = expanded ? 'block' : ''
      section.classList.toggle('mbank-accordion-open', expanded)
      arrow?.style.setProperty('transform', expanded ? 'rotate(180deg)' : '')
    }

    const toggle = () => {
      expanded = !expanded
      sync()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggle()
      }
    }

    header.style.cursor = 'pointer'
    header.setAttribute('role', 'button')
    header.setAttribute('tabindex', '0')
    header.addEventListener('click', toggle)
    header.addEventListener('keydown', onKeyDown)

    sync()

    cleanups.push(() => {
      header.removeEventListener('click', toggle)
      header.removeEventListener('keydown', onKeyDown)
    })
  })

  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

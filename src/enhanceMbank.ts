const HERO_SLIDER_SELECTOR = '.CbkHomeBannerCotained_bannerWrapper__0LaIl'
const HERO_ARROW_SELECTOR = '.CbkHomeBannerCotained_btnBannerArrow__P_1_j'
const HERO_PAGINATION_SELECTOR = '.swiper-pagination'
const LOADED_IMAGE_SELECTOR = '.style_image__UDfa7, .style_adaptive_image__mPC4F'

export const enhanceMbankPage = () => {
  revealImages()
  setupHeroSlider()
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
    wrapper.style.transform = `translate3d(-${slider.clientWidth * activeIndex}px, 0, 0)`

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

  controlsRoot?.addEventListener('mouseenter', () => {
    window.clearInterval(autoPlayTimer)
  })

  controlsRoot?.addEventListener('mouseleave', () => {
    restartAutoPlay()
  })

  window.addEventListener('resize', sync)

  sync()
}

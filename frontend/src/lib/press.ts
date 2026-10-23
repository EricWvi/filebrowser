// Tap feedback for touch screens. A quick tap is too short for :active to paint (and iOS
// skips :active by default), so `.tap` elements get a pressed state that stays visible
// for at least PRESS_MIN ms. Touch presses start after a short delay so that scrolling
// a list does not flash the row under the finger.

const TOUCH_DELAY = 50
const PRESS_MIN = 140
/** Navigation waits this long so the pressed state is seen before the page changes. */
export const NAV_DELAY = 90

document.addEventListener('pointerdown', (ev) => {
  const el = (ev.target as Element).closest('.tap')
  if (!el || (el as HTMLButtonElement).disabled) return
  let shownAt = 0
  const show = () => {
    if (shownAt) return
    shownAt = performance.now()
    el.setAttribute('data-pressed', '')
  }
  const timer = setTimeout(show, ev.pointerType === 'touch' ? TOUCH_DELAY : 0)
  const done = (cancel: boolean) => {
    clearTimeout(timer)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    if (cancel) return el.removeAttribute('data-pressed')
    show()
    setTimeout(() => el.removeAttribute('data-pressed'), Math.max(0, PRESS_MIN - (performance.now() - shownAt)))
  }
  const onUp = () => done(false)
  const onCancel = () => done(true) // browser took over the gesture, e.g. scrolling
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
})

export const afterTap = (fn: () => void) => setTimeout(fn, NAV_DELAY)

import { describe, expect, it, vi } from 'vitest'
import { revealElementInScrollContainer } from './worktree-sidebar-reveal'

function makeContainer(scrollTop: number, clientHeight: number) {
  const scrollTo = vi.fn()
  const container = {
    clientHeight,
    scrollTop,
    contains: () => true,
    getBoundingClientRect: () => ({ top: 0, bottom: clientHeight }) as DOMRect,
    scrollTo
  }
  return { container: container as unknown as HTMLElement, scrollTo }
}

function makeElement(top: number, bottom: number, lineageChildren: Element | null = null): Element {
  return {
    getBoundingClientRect: () => ({ top, bottom }) as DOMRect,
    querySelector: () => lineageChildren
  } as unknown as Element
}

describe('revealElementInScrollContainer', () => {
  it('reports the scroll target it issues so callers can guard the animation', () => {
    const { container, scrollTo } = makeContainer(0, 673)
    const onScrollIssued = vi.fn()

    // A card mounted below the fold: reveal scrolls until its bottom is in view.
    const revealed = revealElementInScrollContainer(
      container,
      makeElement(1005, 1060),
      'smooth',
      onScrollIssued
    )

    expect(revealed).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({ top: 387, behavior: 'smooth' })
    expect(onScrollIssued).toHaveBeenCalledWith(387)
  })

  it('ignores expanded child workspaces when revealing a visible parent card', () => {
    const { container, scrollTo } = makeContainer(0, 673)

    // Parent card at 200-320 with 215 expanded children rendered inside it.
    const parent = makeElement(200, 12_000, makeElement(320, 12_000))

    expect(revealElementInScrollContainer(container, parent, 'auto')).toBe(true)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls only to the parent card, not its children, when the card is below the fold', () => {
    const { container, scrollTo } = makeContainer(0, 673)
    const parent = makeElement(1005, 13_000, makeElement(1060, 13_000))

    revealElementInScrollContainer(container, parent, 'auto')

    expect(scrollTo).toHaveBeenCalledWith({ top: 387, behavior: 'auto' })
  })
})

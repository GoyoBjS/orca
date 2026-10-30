// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getWorktreeLineageChildrenId,
  revealElementInScrollContainer
} from './worktree-sidebar-reveal'

function makeContainer(scrollTop: number, clientHeight: number) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientHeight', { value: clientHeight })
  container.scrollTop = scrollTop
  container.getBoundingClientRect = () => new DOMRect(0, 0, 300, clientHeight)
  const scrollTo = vi.fn()
  container.scrollTo = scrollTo
  document.body.append(container)
  return { container, scrollTo }
}

function makeElement(top: number, bottom: number, lineageChildren: Element | null = null): Element {
  const element = document.createElement('div')
  element.id = 'target-option'
  element.getBoundingClientRect = () => new DOMRect(0, top, 300, bottom - top)
  if (lineageChildren) {
    lineageChildren.id = getWorktreeLineageChildrenId(element.id)
    element.append(lineageChildren)
  }
  document.body.firstElementChild?.append(element)
  return element
}

afterEach(() => document.body.replaceChildren())

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

import { GROUP_HEADER_ROW_HEIGHT } from './worktree-list/viewport/virtual-rows'
import { motionSafeScrollBehavior } from '@/hooks/usePrefersReducedMotion'

const WORKTREE_REVEAL_TOP_CLEARANCE = 6
export const WORKTREE_SIDEBAR_REVEAL_TOP_INSET =
  GROUP_HEADER_ROW_HEIGHT + WORKTREE_REVEAL_TOP_CLEARANCE

type SidebarRevealBounds = {
  start: number
  end: number
}

function getElementScrollBounds(container: HTMLElement, element: Element): SidebarRevealBounds {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  return {
    start: elementRect.top - containerRect.top + container.scrollTop,
    end: elementRect.bottom - containerRect.top + container.scrollTop
  }
}

// Expanded child workspaces render inside the parent's option element, so its
// full rect can be thousands of pixels tall; only the parent's own card counts.
function getRevealTargetBounds(container: HTMLElement, element: Element): SidebarRevealBounds {
  const bounds = getElementScrollBounds(container, element)
  const lineageChildren = element.querySelector('[data-worktree-lineage-children]')
  if (!lineageChildren) {
    return bounds
  }
  const childrenStart = getElementScrollBounds(container, lineageChildren).start
  return { start: bounds.start, end: Math.min(bounds.end, childrenStart) }
}

export function getScrollTopToRevealBounds(
  container: HTMLElement,
  bounds: SidebarRevealBounds,
  topInset = 0
): number | null {
  const viewportTopInset = Math.max(0, Math.min(container.clientHeight, topInset))
  const viewportTop = container.scrollTop + viewportTopInset
  const viewportBottom = container.scrollTop + container.clientHeight
  if (bounds.start < viewportTop) {
    return bounds.start - viewportTopInset
  }
  if (bounds.end > viewportBottom) {
    return bounds.end - container.clientHeight
  }
  return null
}

export function revealElementInScrollContainer(
  container: HTMLElement,
  element: Element,
  behavior: ScrollBehavior,
  // Notify guards to defer competing scrollTop writes until this smooth reveal finishes.
  onScrollIssued?: (targetTop: number) => void
): boolean {
  if (!container.contains(element)) {
    return false
  }
  const nextScrollTop = getScrollTopToRevealBounds(
    container,
    getRevealTargetBounds(container, element),
    WORKTREE_SIDEBAR_REVEAL_TOP_INSET
  )
  if (nextScrollTop === null) {
    return true
  }
  const targetTop = Math.max(0, nextScrollTop)
  onScrollIssued?.(targetTop)
  container.scrollTo({ top: targetTop, behavior: motionSafeScrollBehavior(behavior) })
  return true
}

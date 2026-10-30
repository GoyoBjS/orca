// @vitest-environment happy-dom
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PendingSidebarWorktreeReveal } from '@/store/slices/ui'
import { repo, worktree } from '../../worktree-list-groups-test-fixtures'
import type { WorktreeItemRow } from '../listing/renderable-rows'
import { buildRenderableRows } from '../listing/renderable-rows'
import { getWorktreeOptionId } from '../rows/option-dom'
import { getWorktreeLineageChildrenId } from '../../worktree-sidebar-reveal'
import { usePendingSidebarReveal } from './use-pending-reveal'
import { useWorktreeListKeyboardNavigation } from './use-keyboard'

const state = vi.hoisted(() => ({
  keybindings: undefined,
  activeWorktreeId: 'parent',
  worktreeNavHistory: [],
  worktreeNavHistoryIndex: -1,
  revealWorktreeInSidebar: vi.fn(),
  setRenamingWorktreeId: vi.fn()
}))
const activate = vi.hoisted(() => vi.fn())
vi.mock('@/store', () => ({
  useAppStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
}))
vi.mock('@/lib/sidebar-worktree-activation', () => ({ activateWorktreeFromSidebar: activate }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function row(id: string, rowKey: string, remote = true): WorktreeItemRow {
  return {
    type: 'item',
    rowKey,
    sectionKey: 'repo:repo-1',
    repo,
    worktree: { ...worktree, id, ...(remote ? { hostId: 'ssh:other' as const } : {}) },
    depth: id === 'child' ? 1 : 0,
    groupDepth: 0,
    isLastLineageChild: false,
    lineageChildCount: id === 'parent' && remote ? 1 : 0
  }
}
const local = row('parent', 'local-parent', false)
const pinned = { ...row('parent', 'pinned-parent'), sectionKey: 'pinned' }
const parent = row('parent', 'remote-parent')
const child = row('child', 'remote-child')
const rows = [row('a', 'a'), local, pinned, parent, child]
const renderRows = buildRenderableRows(rows)
const worktrees = rows.map((item) => item.worktree)
const repoMap = new Map([[repo.id, repo]])
const worktreeMap = new Map(worktrees.map((item) => [item.id, item]))
const frames: FrameRequestCallback[] = []
const scheduleFrame = (callback: FrameRequestCallback) => {
  frames.push(callback)
}
const noop = () => {}
let root: Root
let container: HTMLDivElement
let list: HTMLDivElement
let initiallyMounted: boolean
let activeId: string
let activeHost: 'local' | 'ssh:other'

function Probe() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(initiallyMounted)
  const [pending, setPending] = useState<PendingSidebarWorktreeReveal | null>(null)
  state.revealWorktreeInSidebar.mockImplementation((worktreeId, options) =>
    setPending({ worktreeId, ...options })
  )
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: renderRows.length,
    getScrollElement: () => scrollRef.current,
    initialRect: { width: 300, height: 673 },
    estimateSize: (index) => (index === 3 ? 11800 : index === 2 ? 100 : 50),
    scrollToFn: (offset, { adjustments = 0 }) => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = offset + adjustments
      }
      if (offset > 0) {
        setMounted(true)
      }
    }
  })
  const navigationArgs = {
    rows,
    renderRows,
    virtualizer,
    activeWorktreeId: activeId,
    activeWorkspaceExecutionHostId: activeHost,
    pinnedDisplayPolicy: 'duplicate-in-groups' as const,
    scrollRef,
    activeModal: 'none',
    markDirectScrollInput: noop
  }
  const navigation = useWorktreeListKeyboardNavigation(navigationArgs)
  usePendingSidebarReveal({
    pendingRevealWorktree: pending,
    pendingRevealSidebarRow: null,
    clearPendingRevealWorktreeId: () => setPending(null),
    clearPendingRevealSidebarRow: noop,
    agentSendTargetWorktreeId: null,
    renderRows,
    virtualizer,
    scrollRef,
    worktrees,
    folderWorkspaces: [],
    repoMap,
    worktreeMap,
    worktreeLineageById: {},
    collapsedGroups: new Set(),
    toggleGroup: noop,
    groupBy: 'none',
    pinnedDisplayPolicy: 'duplicate-in-groups',
    defaultHostId: 'local',
    prCache: null,
    workspaceStatuses: [],
    settings: null,
    projectGroups: [],
    flashRevealedRow: noop,
    markRevealScroll: noop,
    schedulePendingRevealFrame: scheduleFrame,
    cancelPendingRevealFrames: noop
  })
  const option = (
    item: WorktreeItemRow,
    start: number,
    end: number,
    children?: React.ReactNode
  ) => (
    <div
      id={getWorktreeOptionId(item.rowKey)}
      role="option"
      ref={(node) => {
        if (node) {
          node.getBoundingClientRect = () =>
            new DOMRect(0, start - list.scrollTop, 300, end - start)
        }
      }}
    >
      {children}
    </div>
  )
  return (
    <div
      ref={scrollRef}
      data-worktree-sidebar
      role="listbox"
      tabIndex={0}
      onKeyDown={navigation.handleContainerKeyDown}
    >
      {option(local, 2000, 2120)}
      {option(pinned, 4000, 4120)}
      {mounted &&
        option(
          parent,
          200,
          12000,
          <div
            id={getWorktreeLineageChildrenId(getWorktreeOptionId(parent.rowKey))}
            ref={(node) => {
              if (node) {
                node.getBoundingClientRect = () => new DOMRect(0, 320 - list.scrollTop, 300, 11680)
              }
            }}
          >
            {option(child, 900, 1020)}
          </div>
        )}
    </div>
  )
}

function press(repeat: boolean) {
  act(() =>
    list.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        repeat,
        bubbles: true,
        cancelable: true
      })
    )
  )
}
function frame() {
  act(() => {
    for (const callback of frames.splice(0)) {
      callback(0)
    }
  })
}
function expectVisible(item: WorktreeItemRow, end: number) {
  const option = document.getElementById(getWorktreeOptionId(item.rowKey))!
  expect(option.getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
  expect(end - list.scrollTop).toBeLessThanOrEqual(673)
}

beforeEach(() => {
  vi.clearAllMocks()
  frames.length = 0
  initiallyMounted = true
  activeId = 'parent'
  activeHost = 'local'
  state.activeWorktreeId = activeId
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})
function render() {
  act(() => root.render(<Probe />))
  const element = container.firstElementChild
  if (!(element instanceof HTMLDivElement)) {
    throw new Error('Missing list')
  }
  list = element
  Object.defineProperties(list, {
    clientHeight: { value: 673 },
    scrollHeight: { value: 12000 }
  })
  list.getBoundingClientRect = () => new DOMRect(0, 0, 300, 673)
  list.scrollTo = (options?: ScrollToOptions | number) => {
    if (typeof options === 'object') {
      list.scrollTop = options.top ?? 0
    }
  }
}

it.each([false, true])('reveals the exact host and natural parent with repeat=%s', (repeat) => {
  render()
  press(repeat)
  frame()
  expectVisible(parent, 320)
  expect(list.scrollTop).toBe(0)
  expect(state.revealWorktreeInSidebar).toHaveBeenCalledWith('parent', {
    behavior: 'auto',
    executionHostId: 'ssh:other'
  })
  expect(activate).toHaveBeenCalledTimes(repeat ? 0 : 1)
})

it.each([false, true])('reveals the selected child inside its lineage with repeat=%s', (repeat) => {
  activeHost = 'ssh:other'
  render()
  press(repeat)
  frame()
  expectVisible(child, 1020)
  expect(list.scrollTop).toBe(347)
})

it.each([
  ['parent', false],
  ['parent', true],
  ['child', false],
  ['child', true]
] as const)(
  'completes an initially unmounted %s reveal after virtual staging (repeat=%s)',
  (target, repeat) => {
    initiallyMounted = false
    if (target === 'child') {
      activeHost = 'ssh:other'
    }
    render()
    press(repeat)
    frame()
    expect(list.scrollTop).toBeGreaterThan(10000)
    frame()
    frame()
    expectVisible(target === 'parent' ? parent : child, target === 'parent' ? 320 : 1020)
  }
)

it('keeps the last held preview visible and commits that exact child on keyup', () => {
  render()
  press(true)
  press(true)
  frame()
  expectVisible(child, 1020)
  expect(activate).not.toHaveBeenCalled()
  act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' })))
  expect(activate).toHaveBeenCalledWith('child', 'ssh:other')
})

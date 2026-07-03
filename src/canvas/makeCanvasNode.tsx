import React from 'react'
import { useCanvasStore } from './useCanvasStore'
import type { CanvasObject } from '@/types/canvas'

/**
 * Factory for the per-object subscription pattern shared by all canvas node
 * types: the Outer subscribes only to its own object slice and returns null
 * when the object is missing or hidden; the Inner receives the resolved,
 * correctly-typed object as a prop. The result is memoized so CarouselStage
 * re-renders don't cascade into individual nodes during drag.
 *
 * Any change to this contract (e.g. adding anchorId awareness) now lives in
 * one place instead of five.
 */
export function makeCanvasNode<T extends CanvasObject, P extends { id: string }>(
  Inner: React.ComponentType<P & { obj: T }>,
): React.MemoExoticComponent<(props: P) => React.ReactElement | null> {
  function Outer(props: P): React.ReactElement | null {
    const obj = useCanvasStore((s) => s.objects[props.id] as T | undefined)
    if (!obj || !obj.visible) return null
    return <Inner {...props} obj={obj} />
  }
  Outer.displayName = `CanvasNode(${Inner.displayName ?? Inner.name ?? 'Inner'})`
  return React.memo(Outer)
}

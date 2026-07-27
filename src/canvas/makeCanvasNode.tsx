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
 *
 * `expectedType` guards the case where an object changes type in place —
 * convertShapeToFrame swaps a path/shape for an image frame under the same id.
 * CarouselStage's dispatch is reactive so it normally unmounts us first, but
 * bailing here means a stale dispatch degrades to a blank node instead of
 * handing an ImageObject to CanvasPathNodeInner, which would dereference
 * obj.anchors and throw into the root ErrorBoundary. The check lives in Outer,
 * before Inner mounts, so Inner's hooks are never called inconsistently.
 */
export function makeCanvasNode<T extends CanvasObject, P extends { id: string }>(
  Inner: React.ComponentType<P & { obj: T }>,
  expectedType: T['type'],
): React.MemoExoticComponent<(props: P) => React.ReactElement | null> {
  function Outer(props: P): React.ReactElement | null {
    const obj = useCanvasStore((s) => s.objects[props.id] as T | undefined)
    if (!obj || !obj.visible || obj.type !== expectedType) return null
    return <Inner {...props} obj={obj} />
  }
  Outer.displayName = `CanvasNode(${Inner.displayName ?? Inner.name ?? 'Inner'})`
  return React.memo(Outer)
}

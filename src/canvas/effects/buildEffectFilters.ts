import type { LayerEffect } from '@/types/canvas'
import { getEffectDefinition } from './registry'

const effectsPipelineCache = new Map<string, Array<(imageData: ImageData) => void>>()

function effectsFingerprint(effects: LayerEffect[]): string {
  return effects.map(e => `${e.type}:${e.enabled}:${JSON.stringify(e.params)}`).join('|')
}

export function buildEffectFilters(
  effects: LayerEffect[] | undefined,
): Array<(imageData: ImageData) => void> {
  if (!effects?.length) return []
  const key = effectsFingerprint(effects)
  if (effectsPipelineCache.has(key)) return effectsPipelineCache.get(key)!
  const filters: Array<(imageData: ImageData) => void> = []
  for (const effect of effects) {
    if (!effect.enabled) continue
    const def = getEffectDefinition(effect.type)
    if (!def) continue
    filters.push(def.buildFilter(effect.params))
  }
  effectsPipelineCache.set(key, filters)
  return filters
}

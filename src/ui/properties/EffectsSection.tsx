import React, { useEffect, useState, useRef } from 'react'
import type { LayerEffect } from '@/types/canvas'
import { getAllEffectDefinitions, getEffectDefinition } from '@/canvas/effects'
import Tooltip from '../Tooltip'
import { iconBtnStyle } from '../iconBtnStyle'
import { Eye, EyeOff, Plus, X, ChevronDown, ChevronRight } from 'lucide-react'
import { ColorInput } from '../ColorInput'
import { NumericInput } from '../NumericInput'

import { sectionLabelStyle } from './shared'


// ---------------------------------------------------------------------------
// EffectsSection — extensible layer effects framework
// ---------------------------------------------------------------------------

interface EffectsSectionProps {
  effects: LayerEffect[] | undefined
  onUpdate: (effects: LayerEffect[]) => void
  onCommit: (effects: LayerEffect[]) => void
}

export function EffectsSection({ effects, onUpdate, onCommit }: EffectsSectionProps): React.ReactElement {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const pickerRef = useRef<HTMLDivElement>(null)
  const allDefs = getAllEffectDefinitions()
  const activeEffects = effects ?? []

  useEffect(() => {
    if (!pickerOpen) return
    function handleOutside(e: MouseEvent): void {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [pickerOpen])

  function addEffect(type: string): void {
    const def = getEffectDefinition(type)
    if (!def) return
    const next: LayerEffect[] = [
      ...activeEffects,
      { id: crypto.randomUUID(), type, enabled: true, params: def.defaultParams() },
    ]
    onCommit(next)
    setPickerOpen(false)
  }

  function removeEffect(id: string): void {
    onCommit(activeEffects.filter(e => e.id !== id))
  }

  function toggleEnabled(id: string): void {
    const next = activeEffects.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e)
    onCommit(next)
  }

  function updateParam(id: string, key: string, value: number | string | boolean, commit: boolean): void {
    const next = activeEffects.map(e =>
      e.id === id ? { ...e, params: { ...e.params, [key]: value } } : e,
    )
    if (commit) onCommit(next)
    else onUpdate(next)
  }

  function resetParam(id: string, key: string): void {
    const effect = activeEffects.find(e => e.id === id)
    if (!effect) return
    const def = getEffectDefinition(effect.type)
    if (!def) return
    const defaultVal = def.defaultParams()[key]
    updateParam(id, key, defaultVal, true)
  }

  return (
    <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>Effects</div>
        <div style={{ position: 'relative' }} ref={pickerRef}>
          <Tooltip label="Add effect">
            <button
              style={{ ...iconBtnStyle(true), width: 22, height: 22 }}
              onClick={() => setPickerOpen(v => !v)}
            >
              <Plus size={12} />
            </button>
          </Tooltip>
          {pickerOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 26, zIndex: 100,
              background: '#ffffff', border: '1px solid #d4ccc2', borderRadius: 8,
              minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              {allDefs.map(def => (
                <button
                  key={def.type}
                  onClick={() => addEffect(def.type)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', background: 'none', border: 'none',
                    color: '#111111', fontSize: 12, cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5ede2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {def.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeEffects.length === 0 && (
        <div style={{ color: '#aaaaaa', fontSize: 11, paddingBottom: 6 }}>No effects — click + to add</div>
      )}

      {activeEffects.map(effect => {
        const def = getEffectDefinition(effect.type)
        if (!def) return null
        const isCollapsed = collapsed[effect.id] ?? false
        return (
          <div key={effect.id} style={{ marginBottom: 6, background: '#ffffff', border: '1px solid #e8e0d5', borderRadius: 8, overflow: 'hidden' }}>
            {/* Effect header row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 4 }}>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555555', padding: 0, display: 'flex', alignItems: 'center' }}
                onClick={() => setCollapsed(c => ({ ...c, [effect.id]: !isCollapsed }))}
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
              <span
                style={{ flex: 1, color: '#111111', fontSize: 12, cursor: 'pointer' }}
                onClick={() => setCollapsed(c => ({ ...c, [effect.id]: !isCollapsed }))}
              >
                {def.label}
              </span>
              <Tooltip label={effect.enabled ? 'Disable effect' : 'Enable effect'}>
                <button
                  style={{ ...iconBtnStyle(effect.enabled), width: 20, height: 20 }}
                  onClick={() => toggleEnabled(effect.id)}
                >
                  {effect.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
              </Tooltip>
              <Tooltip label="Remove effect">
                <button
                  style={{ ...iconBtnStyle(false), width: 20, height: 20, color: '#555555' }}
                  onClick={() => removeEffect(effect.id)}
                >
                  <X size={11} />
                </button>
              </Tooltip>
            </div>

            {/* Effect controls */}
            {!isCollapsed && (
              <div style={{ padding: '2px 8px 8px', opacity: effect.enabled ? 1 : 0.4, pointerEvents: effect.enabled ? 'auto' : 'none' }}>
                {def.controls.map(ctrl => {
                  const val = effect.params[ctrl.key]
                  if (ctrl.type === 'slider') {
                    const numVal = val as number
                    const decimals = (ctrl.step ?? 1) < 1 ? 2 : 0
                    return (
                      <div key={ctrl.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                        <label
                          style={{ color: '#555555', fontSize: 11, width: 68, flexShrink: 0, cursor: 'pointer' }}
                          onDoubleClick={() => resetParam(effect.id, ctrl.key)}
                        >
                          {ctrl.label}
                        </label>
                        <input
                          type="range"
                          min={ctrl.min ?? 0}
                          max={ctrl.max ?? 1}
                          step={ctrl.step ?? 0.01}
                          value={numVal}
                          onChange={e => updateParam(effect.id, ctrl.key, Number(e.target.value), false)}
                          onMouseUp={e => updateParam(effect.id, ctrl.key, Number((e.target as HTMLInputElement).value), true)}
                          style={{ flex: 1 }}
                        />
                        <NumericInput
                          value={numVal}
                          decimals={decimals}
                          min={ctrl.min ?? 0}
                          max={ctrl.max ?? 1}
                          width={44}
                          onCommit={v => updateParam(effect.id, ctrl.key, v, true)}
                        />
                      </div>
                    )
                  }
                  if (ctrl.type === 'toggle') {
                    return (
                      <div key={ctrl.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                        <label style={{ color: '#555555', fontSize: 11, width: 68, flexShrink: 0 }}>{ctrl.label}</label>
                        <input
                          type="checkbox"
                          checked={val as boolean}
                          onChange={e => updateParam(effect.id, ctrl.key, e.target.checked, true)}
                        />
                      </div>
                    )
                  }
                  if (ctrl.type === 'color') {
                    return (
                      <div key={ctrl.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                        <label style={{ color: '#555555', fontSize: 11, width: 68, flexShrink: 0 }}>{ctrl.label}</label>
                        <ColorInput
                          value={val as string}
                          onChange={v => updateParam(effect.id, ctrl.key, v, false)}
                          onCommit={() => updateParam(effect.id, ctrl.key, val as string, true)}
                          fixed
                        />
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


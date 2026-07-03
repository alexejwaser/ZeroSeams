import type { TextObject, TextSpan, TextSpanStyle, FontStyle } from '@/types/canvas'

/** Convert a FontStyle value to CSS fontWeight + fontStyle pair */
export function fontStyleToCSS(fontStyle: FontStyle): { fontWeight: string; fontStyle: string } {
  switch (fontStyle) {
    case 'bold':        return { fontWeight: 'bold',   fontStyle: 'normal' }
    case 'italic':      return { fontWeight: 'normal', fontStyle: 'italic' }
    case 'bold italic': return { fontWeight: 'bold',   fontStyle: 'italic' }
    default:            return { fontWeight: 'normal', fontStyle: 'normal' }
  }
}

/** Full text string derived from spans */
export function spanText(obj: TextObject): string {
  return obj.spans.map((s) => s.text).join('')
}

/** Merged style for a single span: layer defaults overridden by span-level style */
export interface ResolvedSpanStyle {
  fontFamily: string
  fontSize: number
  fontStyle: FontStyle
  fill: string
  letterSpacing: number
}

export function resolveSpanStyle(obj: TextObject, spanIdx: number): ResolvedSpanStyle {
  const span = obj.spans[spanIdx]
  const override = span?.style ?? {}
  return {
    fontFamily: override.fontFamily ?? obj.fontFamily,
    fontSize: override.fontSize ?? obj.fontSize,
    fontStyle: override.fontStyle ?? obj.fontStyle,
    fill: override.fill ?? obj.fill,
    letterSpacing: override.letterSpacing ?? obj.letterSpacing,
  }
}

/**
 * Returns the style for a character selection range [start, end).
 * Fields that differ across spans covered by the range are returned as undefined (mixed).
 */
export interface SelectionStyle {
  fontFamily: string | undefined
  fontSize: number | undefined
  fontStyle: FontStyle | undefined
  fill: string | undefined
  letterSpacing: number | undefined
}

export function getSelectionStyle(obj: TextObject, start: number, end: number): SelectionStyle {
  if (start >= end) {
    // Cursor with no selection — return layer defaults
    return {
      fontFamily: obj.fontFamily,
      fontSize: obj.fontSize,
      fontStyle: obj.fontStyle,
      fill: obj.fill,
      letterSpacing: obj.letterSpacing,
    }
  }

  let charPos = 0
  let result: SelectionStyle | null = null

  for (let i = 0; i < obj.spans.length; i++) {
    const span = obj.spans[i]
    const spanStart = charPos
    const spanEnd = charPos + span.text.length
    charPos = spanEnd

    // Does this span overlap with [start, end)?
    if (spanEnd <= start || spanStart >= end) continue

    const resolved = resolveSpanStyle(obj, i)

    if (result === null) {
      result = {
        fontFamily: resolved.fontFamily,
        fontSize: resolved.fontSize,
        fontStyle: resolved.fontStyle,
        fill: resolved.fill,
        letterSpacing: resolved.letterSpacing,
      }
    } else {
      // Use a local const so TypeScript narrowing stays non-null across the reassignment.
      const prev: SelectionStyle = result
      result = {
        fontFamily: prev.fontFamily !== resolved.fontFamily ? undefined : prev.fontFamily,
        fontSize: prev.fontSize !== resolved.fontSize ? undefined : prev.fontSize,
        fontStyle: prev.fontStyle !== resolved.fontStyle ? undefined : prev.fontStyle,
        fill: prev.fill !== resolved.fill ? undefined : prev.fill,
        letterSpacing: prev.letterSpacing !== resolved.letterSpacing ? undefined : prev.letterSpacing,
      }
    }
  }

  return result ?? {
    fontFamily: obj.fontFamily,
    fontSize: obj.fontSize,
    fontStyle: obj.fontStyle,
    fill: obj.fill,
    letterSpacing: obj.letterSpacing,
  }
}

/**
 * Splits spans so boundaries exist at character positions `at`.
 * Returns a new spans array (immutable).
 */
function splitSpansAt(spans: TextSpan[], positions: number[]): TextSpan[] {
  // Deduplicate and sort split positions
  const sortedPositions = [...new Set(positions)].sort((a, b) => a - b)
  let result = [...spans]

  for (const pos of sortedPositions) {
    let charPos = 0
    for (let i = 0; i < result.length; i++) {
      const span = result[i]
      const spanStart = charPos
      const spanEnd = charPos + span.text.length

      if (pos > spanStart && pos < spanEnd) {
        const splitAt = pos - spanStart
        const left: TextSpan = { text: span.text.slice(0, splitAt), style: span.style }
        const right: TextSpan = { text: span.text.slice(splitAt), style: span.style }
        result = [...result.slice(0, i), left, right, ...result.slice(i + 1)]
        break
      }

      charPos = spanEnd
    }
  }

  return result
}

/**
 * Merges adjacent spans that have identical style overrides (shallow-equal style objects).
 * This prevents span explosion over many edits.
 */
function mergeAdjacentSpans(spans: TextSpan[]): TextSpan[] {
  if (spans.length === 0) return spans
  const result: TextSpan[] = [{ ...spans[0] }]

  for (let i = 1; i < spans.length; i++) {
    const prev = result[result.length - 1]
    const curr = spans[i]
    if (stylesEqual(prev.style, curr.style)) {
      result[result.length - 1] = { text: prev.text + curr.text, style: prev.style }
    } else {
      result.push({ ...curr })
    }
  }

  return result
}

function stylesEqual(a: TextSpanStyle | undefined, b: TextSpanStyle | undefined): boolean {
  if (a === b) return true
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontStyle === b.fontStyle &&
    a.fill === b.fill &&
    a.letterSpacing === b.letterSpacing
  )
}

/**
 * Apply a style override to a character range [start, end).
 * Splits spans at boundaries, applies style, then merges adjacent identical spans.
 * No-op when start === end.
 */
export function applyStyleToRange(
  obj: TextObject,
  start: number,
  end: number,
  style: TextSpanStyle,
): TextSpan[] {
  if (start >= end) return obj.spans

  // Split spans at start and end so we have clean boundaries
  const split = splitSpansAt(obj.spans, [start, end])

  // Apply style override to all spans that fall within [start, end)
  let charPos = 0
  const updated: TextSpan[] = split.map((span) => {
    const spanStart = charPos
    const spanEnd = charPos + span.text.length
    charPos = spanEnd

    if (spanStart >= start && spanEnd <= end) {
      // Merge override: start from existing style, apply new style props on top
      const newStyle: TextSpanStyle = { ...span.style, ...style }
      // Remove undefined keys so style stays clean
      const cleanStyle: TextSpanStyle = {}
      if (newStyle.fontFamily !== undefined) cleanStyle.fontFamily = newStyle.fontFamily
      if (newStyle.fontSize !== undefined) cleanStyle.fontSize = newStyle.fontSize
      if (newStyle.fontStyle !== undefined) cleanStyle.fontStyle = newStyle.fontStyle
      if (newStyle.fill !== undefined) cleanStyle.fill = newStyle.fill
      if (newStyle.letterSpacing !== undefined) cleanStyle.letterSpacing = newStyle.letterSpacing
      return { text: span.text, style: Object.keys(cleanStyle).length > 0 ? cleanStyle : undefined }
    }
    return span
  })

  return mergeAdjacentSpans(updated)
}

/**
 * Clear per-span overrides for the properties being updated, so the new layer-level
 * default becomes the single source of truth. Avoids every span accumulating a pinned
 * override identical to the layer default, which would make mixed-state detection wrong.
 */
export function applyStyleToAll(obj: TextObject, style: TextSpanStyle): TextSpan[] {
  const keysToReset = Object.keys(style) as (keyof TextSpanStyle)[]
  return mergeAdjacentSpans(obj.spans.map((span) => {
    if (!span.style) return span
    const newStyle: TextSpanStyle = { ...span.style }
    for (const key of keysToReset) delete newStyle[key]
    const hasOverrides = Object.keys(newStyle).length > 0
    return { text: span.text, style: hasOverrides ? newStyle : undefined }
  }))
}

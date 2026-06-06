import type { CanvasObject, VideoObject } from '@/types/canvas'

function posixDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/')
  return idx > 0 ? filePath.slice(0, idx) : '/'
}

function posixRelative(fromDir: string, toPath: string): string {
  const from = fromDir.split('/').filter(Boolean)
  const to = toPath.split('/').filter(Boolean)
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i++
  return [...from.slice(i).map(() => '..'), ...to.slice(i)].join('/')
}

function posixResolve(dir: string, rel: string): string {
  const parts = dir.split('/').filter(Boolean)
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return '/' + parts.join('/')
}

/** Before serializing: fill in relativeFilePath on all VideoObjects if projectFilePath is known. */
export function relativizeVideoObjects(
  objects: Record<string, CanvasObject>,
  projectFilePath: string | null,
): Record<string, CanvasObject> {
  if (!projectFilePath) return objects
  const dir = posixDirname(projectFilePath)
  const result: Record<string, CanvasObject> = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'video') {
      result[id] = { ...obj, relativeFilePath: posixRelative(dir, (obj as VideoObject).filePath) }
    } else {
      result[id] = obj
    }
  }
  return result
}

/** After loading: resolve relativeFilePath back to absolute filePath for VideoObjects. */
export function resolveVideoObjects(
  objects: Record<string, CanvasObject>,
  projectFilePath: string,
): Record<string, CanvasObject> {
  const dir = posixDirname(projectFilePath)
  const result: Record<string, CanvasObject> = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'video') {
      const vid = obj as VideoObject
      const resolved = vid.relativeFilePath ? posixResolve(dir, vid.relativeFilePath) : vid.filePath
      // Fall back to the stored absolute path when the relative resolution escapes the
      // project directory — this handles projects that were moved after saving (e.g.
      // copied to a repo while videos remain on an external volume).
      const filePath = resolved.startsWith(dir + '/') ? resolved : vid.filePath
      result[id] = { ...vid, filePath }
    } else {
      result[id] = obj
    }
  }
  return result
}

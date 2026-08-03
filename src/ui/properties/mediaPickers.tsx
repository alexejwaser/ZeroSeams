import type { InsertMedia } from '@/canvas/useCanvasStore'
import { loadVideoMetadataFromPath } from '@/canvas/videoMetadata'

// ---------------------------------------------------------------------------
// Shared file-picker helpers for the shape-based media frame feature.
// Mirrors the metadata-loading pattern in src/canvas/GridCellOverlay.tsx —
// resolves to an InsertMedia payload ready for insertMediaIntoFrame(), or
// null if the user cancelled the picker / the file failed to decode.
// ---------------------------------------------------------------------------

export async function pickImageMedia(): Promise<InsertMedia | null> {
  const result = await window.electronAPI.openImageFile()
  if (result.canceled || !result.data) return null
  const img = new Image()
  img.src = result.data
  await img.decode()
  return {
    kind: 'image',
    src: result.data,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  }
}

export async function pickVideoMedia(): Promise<InsertMedia | null> {
  const result = await window.electronAPI.openVideoFile()
  if (result.canceled || !result.filePath) return null
  const filePath = result.filePath
  const rawName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'video'

  // Must carry real dimensions — a 0 here makes fitCover fall back to the frame
  // size, which stretches the video instead of cover-cropping it.
  const meta = await loadVideoMetadataFromPath(filePath)
  if (!meta) return null

  return { kind: 'video', filePath, name: rawName, ...meta }
}

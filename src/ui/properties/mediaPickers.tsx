import type { InsertMedia } from '@/canvas/useCanvasStore'

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

  return new Promise<InsertMedia | null>((resolve) => {
    const vid = document.createElement('video')
    vid.preload = 'metadata'
    const onMeta = (): void => {
      if (!isFinite(vid.duration) || vid.duration <= 0) return
      vid.removeEventListener('durationchange', onMeta)
      vid.src = ''
      resolve({
        kind: 'video',
        filePath,
        naturalWidth: vid.videoWidth,
        naturalHeight: vid.videoHeight,
        naturalDuration: vid.duration,
        name: rawName,
      })
    }
    vid.addEventListener('durationchange', onMeta)
    vid.onerror = () => resolve(null)
    vid.src = `zeroseams-media://localhost${filePath}`
  })
}

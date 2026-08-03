// Single source of truth for reading a video's intrinsic dimensions + duration.
//
// The subtlety this exists to encapsulate: `durationchange` is the event that
// guarantees a FINITE duration, but it does NOT guarantee `videoWidth`/
// `videoHeight` are populated yet — while `loadedmetadata` is the reverse.
// Reading dimensions on `durationchange` alone yields 0×0 often enough to matter,
// and a 0 flows into fitCover's degenerate branch, which returns the frame size
// verbatim — i.e. the video renders stretched to fill instead of cover-cropped.
//
// So: listen to both and resolve only once BOTH are valid.

export interface VideoMetadata {
  naturalWidth: number
  naturalHeight: number
  naturalDuration: number
}

/**
 * Resolves once the element reports both a finite duration and non-zero
 * dimensions, or null if the video errors / never reports dimensions (e.g. an
 * audio-only file, which has no meaningful frame fit).
 */
export function loadVideoMetadata(src: string): Promise<VideoMetadata | null> {
  return new Promise<VideoMetadata | null>((resolve) => {
    const vid = document.createElement('video')
    vid.preload = 'metadata'
    let settled = false

    function finish(value: VideoMetadata | null): void {
      if (settled) return
      settled = true
      vid.removeEventListener('durationchange', onProgress)
      vid.removeEventListener('loadedmetadata', onProgress)
      vid.removeEventListener('loadeddata', onLoadedData)
      vid.onerror = null
      vid.src = ''
      resolve(value)
    }

    function readIfReady(): VideoMetadata | null {
      if (!isFinite(vid.duration) || vid.duration <= 0) return null
      if (vid.videoWidth <= 0 || vid.videoHeight <= 0) return null
      return {
        naturalWidth: vid.videoWidth,
        naturalHeight: vid.videoHeight,
        naturalDuration: vid.duration,
      }
    }

    function onProgress(): void {
      const meta = readIfReady()
      if (meta) finish(meta)
    }

    // Last chance: by loadeddata a real video has decoded a frame, so if the
    // dimensions are still 0 they're never coming.
    function onLoadedData(): void {
      finish(readIfReady())
    }

    vid.addEventListener('durationchange', onProgress)
    vid.addEventListener('loadedmetadata', onProgress)
    vid.addEventListener('loadeddata', onLoadedData)
    vid.onerror = () => { finish(null) }
    vid.src = src
    vid.load()
  })
}

/** Convenience wrapper for a project-relative/absolute path on disk. */
export function loadVideoMetadataFromPath(filePath: string): Promise<VideoMetadata | null> {
  return loadVideoMetadata(`zeroseams-media://localhost${filePath}`)
}

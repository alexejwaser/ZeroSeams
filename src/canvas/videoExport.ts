import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { VideoExportSettings } from '@/types/canvas'

const log = (msg: string, ...args: unknown[]) => {
  const line = `[videoExport ${new Date().toISOString().slice(11, 23)}] ${msg} ${args.map(String).join(' ')}`.trimEnd()
  console.log(line)
  window.electronAPI.appendExportLog(line).catch((e: unknown) => console.error('[log IPC failed]', e))
}

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(onProgress?: (p: { progress: number; time: number }) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    log('reusing existing FFmpeg instance')
    return ffmpegInstance
  }

  log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined')
  log('crossOriginIsolated:', (globalThis as Record<string, unknown>).crossOriginIsolated)

  log('creating FFmpeg instance…')
  const ffmpeg = new FFmpeg()

  ffmpeg.on('log', ({ message }) => log('[ffmpeg]', message))
  if (onProgress) ffmpeg.on('progress', onProgress)

  // Files are copied to public/ffmpeg/ so they're served at a stable root-relative URL.
  const base = `${window.location.origin}/ffmpeg`
  log('base URL:', base)
  const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript')
  const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')
  log('coreURL blob created:', coreURL.slice(0, 60))
  log('wasmURL blob created:', wasmURL.slice(0, 60))

  log('calling ffmpeg.load() with classWorkerURL…')
  await ffmpeg.load({ classWorkerURL: `${base}/worker.js`, coreURL, wasmURL })
  log('ffmpeg.load() complete ✓')

  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function encodeVideoFrames(
  pngBlobs: Blob[],
  fps: number,
  width: number,
  height: number,
  onStatus?: (msg: string) => void,
  settings?: VideoExportSettings,
): Promise<Blob> {
  log(`encodeVideoFrames: ${pngBlobs.length} frames, ${fps} fps, ${width}×${height}`)

  onStatus?.('Loading encoder…')
  const ffmpeg = await getFFmpeg(({ progress }) => {
    onStatus?.(`Encoding… ${Math.round(progress * 100)}%`)
  })

  onStatus?.(`Writing ${pngBlobs.length} frames to encoder…`)
  for (let i = 0; i < pngBlobs.length; i++) {
    const name = `frame${String(i + 1).padStart(4, '0')}.png`
    if (i % 10 === 0) log(`writing frame ${i + 1}/${pngBlobs.length}`)
    await ffmpeg.writeFile(name, await fetchFile(pngBlobs[i]))
  }
  log('all frames written, starting encode…')

  const outputFps =
    settings?.frameRate === 'source' || settings?.frameRate === undefined
      ? String(fps)
      : String(settings.frameRate)

  onStatus?.('Encoding video…')
  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'frame%04d.png',
    '-c:v', settings?.videoCodec ?? 'libx264',
    '-crf', String(settings?.crf ?? 23),
    '-pix_fmt', 'yuv420p',
    '-r', outputFps,
    '-vf', `scale=${width}:${height}`,
    'output.mp4',
  ])
  log('encode complete, reading output…')

  onStatus?.('Finalizing…')
  const data = await ffmpeg.readFile('output.mp4')

  for (let i = 0; i < pngBlobs.length; i++) {
    await ffmpeg.deleteFile(`frame${String(i + 1).padStart(4, '0')}.png`)
  }
  await ffmpeg.deleteFile('output.mp4')
  log('encodeVideoFrames done, blob size:', (data as Uint8Array).byteLength)
  return new Blob([data as Uint8Array], { type: 'video/mp4' })
}

export async function encodeVideoWithAudio(
  pngBlobs: Blob[],
  fps: number,
  width: number,
  height: number,
  audioFilePath: string,
  onStatus?: (msg: string) => void,
  settings?: VideoExportSettings,
): Promise<Blob> {
  log(`encodeVideoWithAudio: ${pngBlobs.length} frames, audio: ${audioFilePath}`)

  onStatus?.('Loading encoder…')
  const ffmpeg = await getFFmpeg(({ progress }) => {
    onStatus?.(`Encoding… ${Math.round(progress * 100)}%`)
  })

  onStatus?.(`Writing ${pngBlobs.length} frames to encoder…`)
  for (let i = 0; i < pngBlobs.length; i++) {
    const name = `frame${String(i + 1).padStart(4, '0')}.png`
    if (i % 10 === 0) log(`writing frame ${i + 1}/${pngBlobs.length}`)
    await ffmpeg.writeFile(name, await fetchFile(pngBlobs[i]))
  }

  log('fetching audio file…')
  onStatus?.('Loading audio…')
  await ffmpeg.writeFile('audio_source.mp4', await fetchFile(`zeroseams-media://localhost${audioFilePath}`))
  log('audio written')

  const duration = pngBlobs.length / fps
  const outputFps =
    settings?.frameRate === 'source' || settings?.frameRate === undefined
      ? String(fps)
      : String(settings.frameRate)

  log(`encoding with audio, duration=${duration}s…`)
  onStatus?.('Encoding video + audio…')
  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'frame%04d.png',
    '-i', 'audio_source.mp4',
    '-map', '0:v:0',   // video from PNG frames (input 0)
    '-map', '1:a:0',   // audio from source file (input 1)
    '-c:v', settings?.videoCodec ?? 'libx264',
    '-crf', String(settings?.crf ?? 23),
    '-c:a', settings?.audioCodec ?? 'aac',
    '-b:a', `${settings?.audioBitrate ?? 128}k`,
    '-pix_fmt', 'yuv420p',
    '-r', outputFps,
    '-vf', `scale=${width}:${height}`,
    '-t', String(duration),
    '-shortest',
    'output.mp4',
  ])
  log('encode complete')

  onStatus?.('Finalizing…')
  const data = await ffmpeg.readFile('output.mp4')
  for (let i = 0; i < pngBlobs.length; i++) {
    await ffmpeg.deleteFile(`frame${String(i + 1).padStart(4, '0')}.png`)
  }
  await ffmpeg.deleteFile('audio_source.mp4')
  await ffmpeg.deleteFile('output.mp4')
  log('encodeVideoWithAudio done, blob size:', (data as Uint8Array).byteLength)
  return new Blob([data as Uint8Array], { type: 'video/mp4' })
}

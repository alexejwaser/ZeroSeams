import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  const ffmpeg = new FFmpeg()
  await ffmpeg.load()
  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function encodeVideoFrames(
  pngBlobs: Blob[],
  fps: number,
  width: number,
  height: number,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  for (let i = 0; i < pngBlobs.length; i++) {
    const name = `frame${String(i + 1).padStart(4, '0')}.png`
    await ffmpeg.writeFile(name, await fetchFile(pngBlobs[i]))
  }
  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'frame%04d.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${width}:${height}`,
    'output.mp4',
  ])
  const data = await ffmpeg.readFile('output.mp4')
  for (let i = 0; i < pngBlobs.length; i++) {
    await ffmpeg.deleteFile(`frame${String(i + 1).padStart(4, '0')}.png`)
  }
  await ffmpeg.deleteFile('output.mp4')
  return new Blob([data as Uint8Array], { type: 'video/mp4' })
}

export async function encodeVideoWithAudio(
  pngBlobs: Blob[],
  fps: number,
  width: number,
  height: number,
  audioFilePath: string,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  for (let i = 0; i < pngBlobs.length; i++) {
    const name = `frame${String(i + 1).padStart(4, '0')}.png`
    await ffmpeg.writeFile(name, await fetchFile(pngBlobs[i]))
  }
  await ffmpeg.writeFile('audio_source.mp4', await fetchFile(`file://${audioFilePath}`))
  const duration = pngBlobs.length / fps
  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'frame%04d.png',
    '-i', 'audio_source.mp4',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${width}:${height}`,
    '-t', String(duration),
    '-shortest',
    'output.mp4',
  ])
  const data = await ffmpeg.readFile('output.mp4')
  for (let i = 0; i < pngBlobs.length; i++) {
    await ffmpeg.deleteFile(`frame${String(i + 1).padStart(4, '0')}.png`)
  }
  await ffmpeg.deleteFile('audio_source.mp4')
  await ffmpeg.deleteFile('output.mp4')
  return new Blob([data as Uint8Array], { type: 'video/mp4' })
}

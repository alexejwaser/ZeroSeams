# Test fixtures

Binary assets for the E2E suite. Small enough to commit; regenerate with the exact
commands below if they ever need to change.

## `solid-green-1s.mp4` (2.3 KB)

A 1-second, 320×240, 30fps clip of flat `#00c000`.

```sh
ffmpeg -f lavfi -i color=c=0x00c000:s=320x240:d=1:r=30 -pix_fmt yuv420p \
  -c:v libx264 -preset veryslow -crf 30 scripts/fixtures/solid-green-1s.mp4
```

Used by `test-frame-render-export.mjs` for video pixel assertions. Why these choices:

- **A real file is required.** There's no way to synthesise a decodable MP4 in page
  context, so unlike the image fixtures (built at runtime via `canvas.toDataURL()`)
  this one has to be committed.
- **320×240 / 1s** keeps decode instant and the seek space trivial.
- **Flat `#00c000`** gives an unambiguous "is the green channel dominant?" assertion.
  Don't assert an exact colour — the yuv420p round trip shifts flat colours by up to
  ~10 per channel and Chromium's video colour pipeline is not bit-exact.
- `yuv420p` is required for broad decoder compatibility.

The `zeroseams-media://` protocol handler serves any absolute path with Range
support, so tests pass `path.join(ROOT, 'scripts/fixtures/solid-green-1s.mp4')`
straight into `insertMediaIntoFrame`.

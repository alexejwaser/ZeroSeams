# Zero Seams

**Free, open-source desktop app for seamless Instagram carousels.**

Most carousel tools are either clunky web editors or professional software (Photoshop, InDesign) that costs a small fortune and treats a social post like a brochure project. Zero Seams is built for exactly one thing: carousels. The whole canvas is one long horizontal surface — you design freely across it, and the app slices it into frames automatically.

The design deliberately avoids the sterile, over-engineered look of most design software. It's opinionated, warm, and gets out of your way.

---

## Features

**Canvas & workflow**
- Single continuous canvas divided into Instagram-sized frames (1:1 or 4:5)
- Frame count is dynamic — add or remove slides at any time
- Project save/load as `.carousel` files

**Design tools**
- Images, video, text, shapes, bezier paths, freeform lines
- InDesign-style image cropping — frame and content are independent layers; double-click to reposition the image inside its frame
- Grid and collage layouts with drag-to-fill cells
- Layer panel — reorder, lock, hide, rename
- Smart snap guides with align/distribute across multiple objects
- Guidelines (horizontal/vertical rulers)
- Photo adjustments (exposure, contrast, saturation, highlights, shadows, etc.)
- Layer effects
- Non-destructive mask shapes (pen, rect, ellipse)

**Export**
- PNG, JPEG, or TIFF — all frames or a selected range
- 1×, 2×, or 3× resolution
- Optional file size cap for JPEG

**On-device AI** *(in progress)*
- Background removal, object segmentation, inpainting — all running locally; no data leaves your machine

---

## Getting Started

Requires Node.js 18+ and npm 9+.

```bash
git clone https://github.com/alexejwaser/zeroseams.git
cd zeroseams
npm install
npm run dev
```

`npm install` handles everything including the Electron binary. No extra steps needed.

---

## Tech Stack

Electron · React · TypeScript · Konva.js · Zustand · FFmpeg WASM · ONNX Runtime

---

## License

MIT

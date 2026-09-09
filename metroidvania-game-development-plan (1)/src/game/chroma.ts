import Phaser from "phaser";

function isBackdrop(r: number, g: number, b: number) {
  const bright = r > 168 && b > 140 && g > 40;
  const magentaBias = r + b > g * 2.05 + 40;
  const notGreenCape = !(g > r + 15 && g > b);
  const notCyanSword = !(b > 200 && g > 160 && r < 140);
  const notDarkStone = !(r < 90 && g < 90 && b < 110);
  return bright && magentaBias && notGreenCape && notCyanSword && notDarkStone;
}

export function chromaKeyFromEdges(
  scene: Phaser.Scene,
  srcKey: string,
  destKey: string,
) {
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement;
  const w = src.width;
  const h = src.height;
  const canvasTex = scene.textures.createCanvas(destKey, w, h);
  if (!canvasTex) return destKey;
  const ctx = canvasTex.getContext();
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const seen = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (!isBackdrop(d[i], d[i + 1], d[i + 2])) return;
    seen[idx] = 1;
    qx[qh] = x;
    qy[qh] = y;
    qh++;
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  let qt = 0;
  while (qt < qh) {
    const x = qx[qt];
    const y = qy[qt];
    qt++;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let i = 0; i < w * h; i++) {
    if (seen[i]) d[i * 4 + 3] = 0;
  }

  // Soft fringe: knock out leftover magenta halos next to transparency.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const i = idx * 4;
      if (d[i + 3] === 0) continue;
      if (!isBackdrop(d[i], d[i + 1], d[i + 2])) continue;
      let edge = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = ((y + dy) * w + (x + dx)) * 4;
        if (d[n + 3] === 0) edge = true;
      }
      if (edge) d[i + 3] = 0;
    }
  }

  ctx.putImageData(img, 0, 0);
  canvasTex.refresh();
  return destKey;
}

export function sliceStrip(
  scene: Phaser.Scene,
  key: string,
  names: string[],
) {
  const tex = scene.textures.get(key);
  const img = tex.getSourceImage() as HTMLImageElement;
  const fw = Math.floor(img.width / names.length);
  const fh = img.height;
  names.forEach((name, i) => {
    if (!tex.has(name)) tex.add(name, 0, i * fw, 0, fw, fh);
  });
  return { fw, fh };
}

export function sliceGrid(
  scene: Phaser.Scene,
  key: string,
  cols: number,
  rows: number,
  names: string[][],
) {
  const tex = scene.textures.get(key);
  const img = tex.getSourceImage() as HTMLImageElement;
  const fw = Math.floor(img.width / cols);
  const fh = Math.floor(img.height / rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = names[r]?.[c];
      if (name && !tex.has(name)) tex.add(name, 0, c * fw, r * fh, fw, fh);
    }
  }
  return { fw, fh };
}

export function cropFrame(
  scene: Phaser.Scene,
  key: string,
  name: string,
  nx: number,
  ny: number,
  nw: number,
  nh: number,
) {
  const tex = scene.textures.get(key);
  const img = tex.getSourceImage() as HTMLImageElement;
  const x = Math.floor(img.width * nx);
  const y = Math.floor(img.height * ny);
  const w = Math.floor(img.width * nw);
  const h = Math.floor(img.height * nh);
  if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
}

import Phaser from "phaser";

type RGB = [number, number, number];

/**
 * Background removal for AI-generated sprite sheets painted over a flat
 * magenta family backdrop. Strategy:
 *  1. Detect the sheet's exact backdrop color from the border ring (median).
 *  2. Flood-fill from the sheet edges, keying pixels that are either near the
 *     detected backdrop or belong to the magenta hue family.
 *  3. Kill enclosed "pockets" of trapped backdrop (e.g. between thorns or
 *     behind a raised sword) — but only when the pocket's median color is
 *     very close to the backdrop, so magenta ART (wisp eyes, flowers,
 *     crystals) survives.
 *  4. De-fringe: knock out magenta blend halos adjacent to transparency.
 */

function near(c: RGB, bg: RGB, tol: number): boolean {
  return (
    Math.abs(c[0] - bg[0]) <= tol &&
    Math.abs(c[1] - bg[1]) <= tol &&
    Math.abs(c[2] - bg[2]) <= tol
  );
}

function isBackdrop(c: RGB, bg: RGB): boolean {
  const [r, g, b] = c;
  if (near(c, bg, 26)) return true;
  return r > 150 && b > 110 && r >= b && g < r * 0.4;
}

function isMagentaBlend(c: RGB): boolean {
  const [r, g, b] = c;
  return r > 140 && b > 90 && r >= b - 12 && g < r * 0.55;
}

function detectBackdrop(d: Uint8ClampedArray, w: number, h: number): RGB {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(d[i]);
    gs.push(d[i + 1]);
    bs.push(d[i + 2]);
  };
  for (let x = 0; x < w; x += 7) {
    add(x, 1);
    add(x, h - 2);
  }
  for (let y = 0; y < h; y += 7) {
    add(1, y);
    add(w - 2, y);
  }
  const med = (a: number[]) => {
    a.sort((p, q) => p - q);
    return a[a.length >> 1] as number;
  };
  return [med(rs), med(gs), med(bs)];
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

  const px = (i: number): RGB => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  const bg = detectBackdrop(d, w, h);

  // --- 1. edge flood fill ---
  const keyed = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (keyed[idx]) return;
    if (!isBackdrop(px(idx), bg)) return;
    keyed[idx] = 1;
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

  // --- 2. pocket pass: enclosed backdrop islands near the bg color ---
  const visited = new Uint8Array(w * h);
  const compIdx: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (keyed[start] || visited[start]) continue;
    if (!isBackdrop(px(start), bg)) continue;
    // BFS this component
    compIdx.length = 0;
    let head = 0;
    compIdx.push(start);
    visited[start] = 1;
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    while (head < compIdx.length) {
      const idx = compIdx[head++];
      const i4 = idx * 4;
      rs.push(d[i4]);
      gs.push(d[i4 + 1]);
      bs.push(d[i4 + 2]);
      const x = idx % w;
      const y = (idx / w) | 0;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (keyed[n] || visited[n]) continue;
        if (!isBackdrop(px(n), bg)) continue;
        visited[n] = 1;
        compIdx.push(n);
      }
    }
    // median per channel (cheap: sort copies — pockets are small)
    const med = (a: number[]) => {
      a.sort((p, q) => p - q);
      return a[a.length >> 1] as number;
    };
    const isPocket =
      compIdx.length <= 300000 &&
      near([med(rs), med(gs), med(bs)], bg, 18);
    if (isPocket) for (const idx of compIdx) keyed[idx] = 1;
  }

  // --- 3. apply alpha ---
  for (let i = 0; i < w * h; i++) {
    if (keyed[i]) d[i * 4 + 3] = 0;
  }

  // --- 4. de-fringe magenta halos adjacent to transparency (2 passes) ---
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const i = idx * 4;
        if (d[i + 3] === 0) continue;
        if (!isMagentaBlend([d[i], d[i + 1], d[i + 2]])) continue;
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
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const tex = scene.textures.get(key);
  if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
}

/**
 * Softly fade a frame's alpha to zero over `depth` pixels on one side, so
 * art that was painted across a cell border (dash speed streaks) fades out
 * instead of ending in a hard vertical cut.
 */
export function featherFrameEdge(
  scene: Phaser.Scene,
  key: string,
  name: string,
  side: "left" | "right" | "top" | "bottom",
  depth: number,
) {
  const tex = scene.textures.get(key);
  const canvasTex = tex as Phaser.Textures.CanvasTexture;
  if (!canvasTex.getContext || !tex.has(name)) return;
  const f = tex.get(name);
  const src = tex.getSourceImage() as HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const ctx = canvasTex.getContext();
  const img = ctx.getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  const d = img.data;
  const fw = f.cutWidth;
  const fh = f.cutHeight;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      let t = 1;
      if (side === "left") t = Math.min(1, x / depth);
      else if (side === "right") t = Math.min(1, (fw - 1 - x) / depth);
      else if (side === "top") t = Math.min(1, y / depth);
      else t = Math.min(1, (fh - 1 - y) / depth);
      if (t >= 1) continue;
      d[(y * fw + x) * 4 + 3] *= t;
    }
  }
  ctx.putImageData(img, f.cutX, f.cutY);
  void w;
  void h;
  canvasTex.refresh();
}

/**
 * Remove leftover fragments of neighbouring poses that bleed across the
 * frame borders of a sliced sheet. A fragment is an opaque strip at the
 * frame edge separated from the rest of the frame by a fully transparent
 * column/row — anything before that gap is disconnected junk.
 */
export function cleanupFrameEdges(
  scene: Phaser.Scene,
  key: string,
  spanX = 36,
  spanY = 20,
) {
  const tex = scene.textures.get(key);
  const canvasTex = tex as Phaser.Textures.CanvasTexture;
  if (!canvasTex.getContext) return;
  const src = tex.getSourceImage() as HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const ctx = canvasTex.getContext();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const colOpaque = (x: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) if (d[(y * w + x) * 4 + 3] > 8) return true;
    return false;
  };
  const rowOpaque = (y: number, x0: number, x1: number) => {
    for (let x = x0; x < x1; x++) if (d[(y * w + x) * 4 + 3] > 8) return true;
    return false;
  };

  for (const name of tex.getFrameNames()) {
    if (name === "__BASE") continue;
    const f = tex.get(name);
    const x0 = f.cutX;
    const y0 = f.cutY;
    const x1 = f.cutX + f.cutWidth;
    const y1 = f.cutY + f.cutHeight;
    // left: find first transparent column; clear everything before it
    for (let x = x0; x < Math.min(x0 + spanX, x1); x++) {
      if (!colOpaque(x, y0, y1)) {
        for (let cx = x0; cx < x; cx++)
          for (let y = y0; y < y1; y++) d[(y * w + cx) * 4 + 3] = 0;
        break;
      }
    }
    // right
    for (let x = x1 - 1; x >= Math.max(x1 - spanX, x0); x--) {
      if (!colOpaque(x, y0, y1)) {
        for (let cx = x1 - 1; cx > x; cx--)
          for (let y = y0; y < y1; y++) d[(y * w + cx) * 4 + 3] = 0;
        break;
      }
    }
    // top
    for (let y = y0; y < Math.min(y0 + spanY, y1); y++) {
      if (!rowOpaque(y, x0, x1)) {
        for (let cy = y0; cy < y; cy++)
          for (let x = x0; x < x1; x++) d[(cy * w + x) * 4 + 3] = 0;
        break;
      }
    }
    // bottom
    for (let y = y1 - 1; y >= Math.max(y1 - spanY, y0); y--) {
      if (!rowOpaque(y, x0, x1)) {
        for (let cy = y1 - 1; cy > y; cy--)
          for (let x = x0; x < x1; x++) d[(cy * w + x) * 4 + 3] = 0;
        break;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  canvasTex.refresh();
}

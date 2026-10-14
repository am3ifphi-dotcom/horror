/**
 * 背景透過処理（コード側で実施）
 * 1. 四辺のピクセルから背景色を推定（中央値）
 * 2. 画像の外周から flood fill で「背景色に近い連結領域」だけを透明化
 *    → キャラ内部の白（目のハイライト等）は消えない
 * 3. 境界ピクセルをアンチエイリアス（色距離に応じた半透明化）
 * 4. 背景色のにじみ（フリンジ）を除去（アンミックス）
 * 5. 不透明部分でトリミング
 */
const cache = new Map<string, Promise<string>>();

type Opts = { tolerance?: number; feather?: number; crop?: boolean };

export function removeBackground(src: string, opts: Opts = {}): Promise<string> {
  const key = src + JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        resolve(process(img, opts));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
  cache.set(key, p);
  return p;
}

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function process(img: HTMLImageElement, { tolerance = 42, feather = 38, crop = true }: Opts): string {
  // 処理を軽くするため最大 900px に縮小
  const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;

  // --- 背景色推定（外周ピクセルの中央値）
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
  };
  for (let x = 0; x < w; x += 3) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y += 3) { sample(0, y); sample(w - 1, y); }
  const br = median(rs), bgc = median(gs), bb = median(bs);

  const dist = (i: number) => {
    const dr = d[i] - br, dg = d[i + 1] - bgc, db = d[i + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  // --- flood fill（外周から）
  const bgMask = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (p: number) => {
    if (bgMask[p]) return;
    if (dist(p * 4) <= tolerance) {
      bgMask[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }

  // --- 透明化 + 境界アンチエイリアス + フリンジ除去
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (bgMask[p]) { d[i + 3] = 0; continue; }
    const x = p % w, y = (p / w) | 0;
    // 背景に隣接（半径2）しているか
    let edge = false;
    for (let oy = -2; oy <= 2 && !edge; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (bgMask[ny * w + nx]) { edge = true; break; }
      }
    }
    if (!edge) continue;
    const dd = dist(i);
    const a = Math.max(0, Math.min(1, (dd - tolerance * 0.6) / feather));
    if (a <= 0.02) { d[i + 3] = 0; continue; }
    // アンミックス: C = a*F + (1-a)*B → F = (C - (1-a)B)/a
    d[i] = clamp((d[i] - (1 - a) * br) / a);
    d[i + 1] = clamp((d[i + 1] - (1 - a) * bgc) / a);
    d[i + 2] = clamp((d[i + 2] - (1 - a) * bb) / a);
    d[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(id, 0, 0);

  if (!crop) return cv.toDataURL("image/png");

  // --- トリミング
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return cv.toDataURL("image/png");
  const pad = 4;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(cv, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

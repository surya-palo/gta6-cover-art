// Vice Cover Studio — cover renderer. Draws a multi-panel GTA-style poster onto
// any 2D canvas: panel photos with per-panel zoom/pan, a colour grade, and bold
// caption lettering. Pure canvas, no libraries, no network.

export const LAYOUTS = {
  solo: { label: 'Solo', panels: 1 },
  hero: { label: 'Hero + strip', panels: 4 },
  grid: { label: 'Grid 2×2', panels: 4 },
  diagonal: { label: 'Diagonal bands', panels: 3 },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.45) contrast(1.06) sepia(0.22)',
    overlay: ['#ff9a3d', '#ff2e88'],
    overlayAlpha: 0.20,
    blend: 'overlay',
  },
  neon: {
    label: 'Neon night',
    filter: 'saturate(2.0) contrast(1.14) brightness(1.06) hue-rotate(-8deg)',
    overlay: ['#ff2e88', '#2ee6ff'],
    overlayAlpha: 0.30,
    blend: 'soft-light',
  },
  dusk: {
    label: 'Palm dusk',
    filter: 'saturate(1.25) brightness(0.9) hue-rotate(15deg)',
    overlay: ['#5b2eff', '#0e7a6b'],
    overlayAlpha: 0.22,
    blend: 'overlay',
  },
  none: { label: 'Original', filter: 'none', overlay: null, overlayAlpha: 0, blend: 'source-over' },
};

export const CAPTION_COLORS = {
  white: { fill: '#ffffff', stroke: '#160a12' },
  neon: { fill: '#ff2e88', stroke: '#2b0a1e' },
  gold: { fill: '#ffc93c', stroke: '#241503' },
  black: { fill: '#141414', stroke: '#ffffff' },
};

// Panel shapes as fractions of the canvas. A panel is { poly: [[fx, fy], ...], slot }.
// Rectangles are four-point polygons, so every layout goes through one code path.
export function panelsFor(layout, w, h) {
  const g = 0.008; // gutter, as a fraction of the short side
  const gx = g * Math.min(w, h) / w;
  const gy = g * Math.min(w, h) / h;
  const rect = (x, y, rw, rh, slot) => ({
    poly: [[x + gx, y + gy], [x + rw - gx, y + gy], [x + rw - gx, y + rh - gy], [x + gx, y + rh - gy]],
    slot,
  });
  if (layout === 'solo') return [rect(0, 0, 1, 1, 0)];
  if (layout === 'hero') {
    return [
      rect(0, 0, 1, 0.66, 0),
      rect(0, 0.66, 1 / 3, 0.34, 1),
      rect(1 / 3, 0.66, 1 / 3, 0.34, 2),
      rect(2 / 3, 0.66, 1 / 3, 0.34, 3),
    ];
  }
  if (layout === 'grid') {
    return [
      rect(0, 0, 0.5, 0.5, 0),
      rect(0.5, 0, 0.5, 0.5, 1),
      rect(0, 0.5, 0.5, 0.5, 2),
      rect(0.5, 0.5, 0.5, 0.5, 3),
    ];
  }
  // Diagonal: three slanted vertical bands.
  const band = (x0, x1, slot) => ({
    poly: [[x0, 0], [x1, 0], [x1 - 0.14, 1], [x0 - 0.14, 1]].map(([fx, fy]) => [
      Math.min(1 - gx, Math.max(gx, fx)),
      Math.min(1 - gy, Math.max(gy, fy)),
    ]),
    slot,
  });
  return [band(0, 0.40, 0), band(0.40, 0.74, 1), band(0.74, 1.14, 2)];
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function panelIndexAt(layout, w, h, x, y) {
  const panels = panelsFor(layout, w, h);
  for (let i = 0; i < panels.length; i++) {
    const px = panels[i].poly.map(([fx, fy]) => [fx * w, fy * h]);
    if (pointInPoly(x, y, px)) return i;
  }
  return -1;
}

// Draw one photo into a panel: cover-fit, scaled by zoom, shifted by pan.
// Pan is clamped so the photo always covers the whole panel.
function drawPhotoInPanel(ctx, img, poly, w, h, zoom, panX, panY) {
  const xs = poly.map((p) => p[0] * w);
  const ys = poly.map((p) => p[1] * h);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const pw = Math.max(...xs) - x0;
  const ph = Math.max(...ys) - y0;
  const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const maxPanX = Math.max(0, (dw - pw) / 2 / pw);
  const maxPanY = Math.max(0, (dh - ph) / 2 / ph);
  const cx = Math.max(-maxPanX, Math.min(maxPanX, panX));
  const cy = Math.max(-maxPanY, Math.min(maxPanY, panY));
  const dx = x0 + (pw - dw) / 2 + cx * pw;
  const dy = y0 + (ph - dh) / 2 + cy * ph;
  ctx.save();
  ctx.beginPath();
  poly.forEach(([fx, fy], i) => (i === 0 ? ctx.moveTo(fx * w, fy * h) : ctx.lineTo(fx * w, fy * h)));
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function paintGrade(ctx, w, h, grade) {
  if (!grade.overlay) return;
  const grad = ctx.createLinearGradient(0, 0, w * 0.35, h);
  grad.addColorStop(0, grade.overlay[0]);
  grad.addColorStop(1, grade.overlay[1]);
  ctx.save();
  ctx.globalAlpha = grade.overlayAlpha;
  ctx.globalCompositeOperation = grade.blend;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function paintCaption(ctx, w, h, state) {
  const headline = (state.caption || '').trim();
  const tagline = (state.tagline || '').trim();
  if (!headline && !tagline) return;
  const colors = CAPTION_COLORS[state.captionColor] || CAPTION_COLORS.white;
  let size = h * 0.115 * (state.captionSize || 1);
  const fontFor = (s) => `900 ${s}px "Arial Black", "Arial Narrow", Arial, sans-serif`;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.02)}px`;
  if (headline) {
    ctx.font = fontFor(size);
    while (size > 12 && ctx.measureText(headline).width > w * 0.92) {
      size *= 0.94;
      ctx.font = fontFor(size);
    }
  }
  // Scrim band behind the lettering so it reads on any photo.
  const bandH = size * (tagline ? 2.1 : 1.5);
  let bandY;
  if (state.captionPos === 'top') bandY = 0;
  else if (state.captionPos === 'center') bandY = h / 2 - bandH / 2;
  else bandY = h - bandH;
  const scrim = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  scrim.addColorStop(0, 'rgba(8, 2, 14, 0)');
  scrim.addColorStop(0.5, 'rgba(8, 2, 14, 0.55)');
  scrim.addColorStop(1, 'rgba(8, 2, 14, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY, w, bandH);

  const drawLine = (text, y, font, fill, stroke, strokeWidth) => {
    ctx.save();
    ctx.translate(w / 2, y);
    ctx.transform(1, 0, -0.07, 1, 0, 0); // slight forward slant, poster style
    ctx.font = font;
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.03;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  const headY = bandY + bandH * (tagline ? 0.52 : 0.62);
  if (headline) drawLine(headline, headY, fontFor(size), colors.fill, colors.stroke, size * 0.09);
  if (tagline) {
    const tagSize = Math.max(12, size * 0.26);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(tagSize * 0.28)}px`;
    drawLine(tagline.toUpperCase(), headY + size * 0.48, `700 ${tagSize}px Arial, sans-serif`, '#ffffff', 'rgba(10, 2, 12, 0.9)', tagSize * 0.18);
  }
  ctx.restore();
}

// The whole poster. state: { layout, grade, photos, caption, tagline,
// captionSize, captionPos, captionColor }. photos: array of
// { img: HTMLImageElement|null, zoom, panX, panY } per slot.
export function drawCover(ctx, w, h, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.save();
  ctx.fillStyle = '#0d0716';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = grade.filter;
  const panels = panelsFor(state.layout, w, h);
  for (const panel of panels) {
    const photo = state.photos[panel.slot];
    if (photo && photo.img) {
      drawPhotoInPanel(ctx, photo.img, panel.poly, w, h, photo.zoom || 1, photo.panX || 0, photo.panY || 0);
    } else {
      ctx.save();
      ctx.beginPath();
      panel.poly.forEach(([fx, fy], i) => (i === 0 ? ctx.moveTo(fx * w, fy * h) : ctx.lineTo(fx * w, fy * h)));
      ctx.closePath();
      ctx.fillStyle = '#241a38';
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.filter = 'none';
  paintGrade(ctx, w, h, grade);
  // Thin white frame lines between panels.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0015);
  for (const panel of panels) {
    ctx.beginPath();
    panel.poly.forEach(([fx, fy], i) => (i === 0 ? ctx.moveTo(fx * w, fy * h) : ctx.lineTo(fx * w, fy * h)));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  paintCaption(ctx, w, h, state);
  ctx.restore();
}

// Render the poster at an exact pixel size and return the canvas.
export function renderCoverAt(width, height, state) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, width, height, state);
  return canvas;
}

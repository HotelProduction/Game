import * as THREE from 'three';

export interface HotelTextures {
  wallpaper: THREE.CanvasTexture;
  wallpaperBump: THREE.CanvasTexture;
  carpet: THREE.CanvasTexture;
  carpetBump: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  wallSign: (text: string, color?: string, bg?: string, fontSize?: number) => THREE.CanvasTexture;
  paintingTexture: (symbolIndex: number, tint?: string) => THREE.CanvasTexture;
  dispose: () => void;
}

export function createHotelTextures(maxAnisotropy = 4): HotelTextures {
  const createdTextures: THREE.CanvasTexture[] = [];

  const makeCanvas = (
    w: number,
    h: number,
    drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    repeatX = 1,
    repeatY = 1,
    isColor = true
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    drawFn(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAnisotropy;
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    createdTextures.push(tex);
    return tex;
  };

  const wallpaper = makeCanvas(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#3c332b';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = 'rgba(22,17,15,0.38)';
        ctx.fillRect(x, 0, 12, h);
      }
      ctx.fillStyle = 'rgba(18,14,12,0.5)';
      ctx.fillRect(0, h - 22, w, 22);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(12,10,8,${Math.random() * 0.25})`;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    3,
    1,
    true
  );

  const wallpaperBump = makeCanvas(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = '#626262';
        ctx.fillRect(x, 0, 12, h);
      }
      for (let i = 0; i < 180; i++) {
        const v = 95 + Math.floor(Math.random() * 65);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 5, 5);
      }
    },
    3,
    1,
    false
  );

  const carpet = makeCanvas(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#47181a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#6d352d';
      ctx.lineWidth = 4;
      for (let y = 0; y < h; y += 64) {
        for (let x = 0; x < w; x += 64) {
          ctx.strokeRect(x + 8, y + 8, 48, 48);
          ctx.strokeRect(x + 20, y + 20, 24, 24);
        }
      }
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 5, 5);
      }
    },
    4,
    10,
    true
  );

  const carpetBump = makeCanvas(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        const v = 100 + Math.floor(Math.random() * 55);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    },
    4,
    10,
    false
  );

  const wood = makeCanvas(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#3b2518';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 18) {
        ctx.fillStyle = `rgba(18, 10, 6, ${0.22 + Math.random() * 0.28})`;
        ctx.fillRect(0, y, w, 3);
      }
    },
    2,
    2,
    true
  );

  const woodBump = makeCanvas(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 9) {
        ctx.fillStyle = '#555555';
        ctx.fillRect(0, y, w, 2);
      }
    },
    2,
    2,
    false
  );

  const concrete = makeCanvas(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#2d3035';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 360; i++) {
        const shade = 30 + Math.floor(Math.random() * 40);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 6, 6);
      }
    },
    4,
    4,
    true
  );

  const concreteBump = makeCanvas(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#7c7c7c';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        const v = 90 + Math.floor(Math.random() * 75);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 4, 4);
      }
    },
    4,
    4,
    false
  );

  const contactShadow = makeCanvas(
    128,
    128,
    (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0.85)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    1,
    1,
    true
  );

  const wallSign = (
    text: string,
    color = '#c72626',
    bg = '#241d19',
    fontSize = 32
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px Courier New, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(line, c.width / 2, (c.height / (lines.length + 1)) * (idx + 1));
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    createdTextures.push(tex);
    return tex;
  };

  const paintingTexture = (symbolIndex: number, tint = '#8a2b2b'): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#19171a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#6e5a3b';
    ctx.lineWidth = 14;
    ctx.strokeRect(8, 8, 240, 240);

    ctx.fillStyle = tint;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 8;
    const labels = ['EYE', 'KEY', '03:33', 'FLAME'];
    ctx.font = 'bold 30px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[symbolIndex % 4], 128, 128);
    ctx.beginPath();
    ctx.arc(128, 128, 82, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    createdTextures.push(tex);
    return tex;
  };

  return {
    wallpaper,
    wallpaperBump,
    carpet,
    carpetBump,
    wood,
    woodBump,
    concrete,
    concreteBump,
    contactShadow,
    wallSign,
    paintingTexture,
    dispose: () => {
      createdTextures.forEach((t) => t.dispose());
    },
  };
}

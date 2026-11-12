class ImageAlgorithms {
  static thresholdOtsu(src) {
    const gray = src.toGrayscaleArray();
    const total = gray.length;
    const hist = new Uint32Array(256);
    for (let i = 0; i < total; i++) hist[gray[i]]++;

    let sumAll = 0, sumB = 0, wB = 0, maxVar = 0, threshold = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const betweenVar = wB * wF * (mB - mF) * (mB - mF);
      
      if (betweenVar > maxVar) { maxVar = betweenVar; threshold = t; }
    }

    const dst = new PixelBuffer(src.width, src.height);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const v = gray[y * src.width + x] > threshold ? 255 : 0;
        dst.setRGBA(x, y, v, v, v, 255);
      }
    }
    return dst;
  }

  static thresholdIsodata(src) {
    const gray = src.toGrayscaleArray();
    let T = 128;
    for (let iter = 0; iter < 30; iter++) {
      let sum1 = 0, cnt1 = 0, sum2 = 0, cnt2 = 0;
      for (let i = 0; i < gray.length; i++) {
        if (gray[i] <= T) { sum1 += gray[i]; cnt1++; }
        else { sum2 += gray[i]; cnt2++; }
      }
      const nextT = Math.round(((cnt1 ? sum1/cnt1 : 0) + (cnt2 ? sum2/cnt2 : 255)) / 2);
      if (Math.abs(nextT - T) < 1) break;
      T = nextT;
    }
    const dst = new PixelBuffer(src.width, src.height);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const v = gray[y * src.width + x] > T ? 255 : 0;
        dst.setRGBA(x, y, v, v, v, 255);
      }
    }
    return dst;
  }

  static detectPoints(src, padding) {
    const dst = new PixelBuffer(src.width, src.height);
    const k = [-1, -1, -1, -1, 8, -1, -1, -1, -1];
    
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let sum = 0, idx = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += src.getLuma(x + dx, y + dy, padding) * k[idx++];
          }
        }
        const v = Math.min(255, Math.abs(sum));
        dst.setRGBA(x, y, v, v, v, 255);
      }
    }
    return dst;
  }

  static detectHorizontalLines(src, padding) {
    const dst = new PixelBuffer(src.width, src.height);
    const k = [-1, -1, -1, 2, 2, 2, -1, -1, -1];
    
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let sum = 0, idx = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += src.getLuma(x + dx, y + dy, padding) * k[idx++];
          }
        }
        const v = Math.min(255, Math.max(0, Math.abs(sum)));
        dst.setRGBA(x, y, v, v, v, 255);
      }
    }
    return dst;
  }

  static detectSobel(src, padding) {
    const dst = new PixelBuffer(src.width, src.height);
    const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let gx = 0, gy = 0, idx = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const luma = src.getLuma(x + dx, y + dy, padding);
            gx += luma * gxK[idx];
            gy += luma * gyK[idx];
            idx++;
          }
        }
        const v = Math.min(255, Math.hypot(gx, gy));
        dst.setRGBA(x, y, v, v, v, 255);
      }
    }
    return dst;
  }

  static detectCanny(src, padding) {
    const w = src.width, h = src.height;
    const mag = new Float32Array(w * h);
    const gxArr = new Float32Array(w * h);
    const gyArr = new Float32Array(w * h);
    const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let gx = 0, gy = 0, idx = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            let l = 0;
            let nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              l = (0.299*src.data[(ny*w+nx)*4] + 0.587*src.data[(ny*w+nx)*4+1] + 0.114*src.data[(ny*w+nx)*4+2]);
            } else {
              l = src.getLuma(nx, ny, padding);
            }
            gx += l * gxK[idx];
            gy += l * gyK[idx];
            idx++;
          }
        }
        const i = y * w + x;
        gxArr[i] = gx; gyArr[i] = gy;
        mag[i] = Math.hypot(gx, gy);
      }
    }

    const nms = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const m = mag[i];
        if (m === 0) continue;
        const ax = Math.abs(gxArr[i]), ay = Math.abs(gyArr[i]);
        let m1 = 0, m2 = 0;
        if (ax >= ay) {
          const w_ = ay / ax;
          const s = (gxArr[i] * gyArr[i] >= 0) ? 1 : -1;
          m1 = (1 - w_) * mag[i + 1] + w_ * mag[(y + s) * w + (x + 1)];
          m2 = (1 - w_) * mag[i - 1] + w_ * mag[(y - s) * w + (x - 1)];
        } else {
          const w_ = ax / ay;
          const s = (gxArr[i] * gyArr[i] >= 0) ? 1 : -1;
          m1 = (1 - w_) * mag[(y + 1) * w + x] + w_ * mag[(y + 1) * w + (x + s)];
          m2 = (1 - w_) * mag[(y - 1) * w + x] + w_ * mag[(y - 1) * w + (x - s)];
        }
        if (m >= m1 && m >= m2) nms[i] = m;
      }
    }

    const state = new Uint8Array(w * h);
    const stack = [];
    const highT = 80, lowT = 30;
    for (let i = 0; i < nms.length; i++) {
      if (nms[i] >= highT) { state[i] = 2; stack.push(i); }
      else if (nms[i] >= lowT) state[i] = 1;
    }

    while (stack.length > 0) {
      const i = stack.pop();
      const cx = i % w, cy = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const ni = ny * w + nx;
            if (state[ni] === 1) { state[ni] = 2; stack.push(ni); }
          }
        }
      }
    }

    const dst = new PixelBuffer(w, h);
    for (let i = 0; i < state.length; i++) {
      const v = state[i] === 2 ? 255 : 0;
      dst.data[i*4] = v; dst.data[i*4+1] = v; dst.data[i*4+2] = v; dst.data[i*4+3] = 255;
    }
    return dst;
  }
}
class ImageAlgorithms {
  static computeHistograms(buffer) {
    const histR = new Uint32Array(256), histG = new Uint32Array(256), histB = new Uint32Array(256), histL = new Uint32Array(256);
    const d = buffer.data;
    const total = buffer.width * buffer.height;
    let sumL = 0, sumL2 = 0, minL = 255, maxL = 0;

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b + 0.5) | 0;
      histR[r]++; histG[g]++; histB[b]++; histL[l]++;
      sumL += l; sumL2 += l * l;
      if (l < minL) minL = l; if (l > maxL) maxL = l;
    }

    const mean = sumL / total;
    const std = Math.sqrt(Math.max(0, sumL2 / total - mean * mean));
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (histL[i] > 0) {
        const prob = histL[i] / total;
        entropy -= prob * Math.log2(prob);
      }
    }

    return { histR, histG, histB, histL, mean, std, minL, maxL, entropy };
  }

  static thresholdOtsu(src) {
    const gray = src.toGrayscaleArray();
    const total = gray.length;
    const hist = new Uint32Array(256);
    for (let i = 0; i < total; i++) hist[gray[i]]++;

    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];

    let sumB = 0, wB = 0, maxVar = -1, bestThreshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const betweenVar = wB * wF * (mB - mF) * (mB - mF);
      
      if (betweenVar > maxVar) {
        maxVar = betweenVar;
        bestThreshold = t;
      }
    }

    const dst = new PixelBuffer(src.width, src.height);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const v = gray[y * src.width + x] > bestThreshold ? 255 : 0;
        dst.setRGBA(x, y, v, v, v, 255);
      }
    }
    dst.computedThreshold = bestThreshold;
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
      const m1 = cnt1 ? sum1 / cnt1 : 0;
      const m2 = cnt2 ? sum2 / cnt2 : 255;
      const nextT = Math.round((m1 + m2) / 2);
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
    dst.computedThreshold = T;
    return dst;
  }
}
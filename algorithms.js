class ImageAlgorithms {
  static computeHistograms(buffer) {
    const histR = new Uint32Array(256), histG = new Uint32Array(256), histB = new Uint32Array(256), histL = new Uint32Array(256);
    const d = buffer.data;
    const total = buffer.width * buffer.height;
    let sumL = 0, sumL2 = 0;

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const r = d[p], g = d[p+1], b = d[p+2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b + 0.5) | 0;
      histR[r]++; histG[g]++; histB[b]++; histL[l]++;
      sumL += l; sumL2 += l * l;
    }
    const mean = sumL / total;
    const std = Math.sqrt(Math.max(0, sumL2 / total - mean * mean));
    return { histR, histG, histB, histL, mean, std };
  }

  static linearContrast(src) {
    const dst = src.clone();
    const d = dst.data;
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < minR) minR = d[i]; if (d[i] > maxR) maxR = d[i];
      if (d[i+1] < minG) minG = d[i+1]; if (d[i+1] > maxG) maxG = d[i+1];
      if (d[i+2] < minB) minB = d[i+2]; if (d[i+2] > maxB) maxB = d[i+2];
    }

    const sR = maxR > minR ? 255 / (maxR - minR) : 1;
    const sG = maxG > minG ? 255 / (maxG - minG) : 1;
    const sB = maxB > minB ? 255 / (maxB - minB) : 1;

    for (let i = 0; i < d.length; i += 4) {
      d[i] = ((d[i] - minR) * sR + 0.5) | 0;
      d[i+1] = ((d[i+1] - minG) * sG + 0.5) | 0;
      d[i+2] = ((d[i+2] - minB) * sB + 0.5) | 0;
    }
    return dst;
  }

  static equalizeRGB(src) {
    const dst = src.clone();
    const d = dst.data;
    const total = src.width * src.height;
    const hists = this.computeHistograms(src);
    const lutR = new Uint8Array(256), lutG = new Uint8Array(256), lutB = new Uint8Array(256);
    let cdfR = 0, cdfG = 0, cdfB = 0;

    for (let i = 0; i < 256; i++) {
      cdfR += hists.histR[i]; cdfG += hists.histG[i]; cdfB += hists.histB[i];
      lutR[i] = ((cdfR * 255) / total + 0.5) | 0;
      lutG[i] = ((cdfG * 255) / total + 0.5) | 0;
      lutB[i] = ((cdfB * 255) / total + 0.5) | 0;
    }
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lutR[d[i]]; d[i+1] = lutG[d[i+1]]; d[i+2] = lutB[d[i+2]];
    }
    return dst;
  }

  static rgbToHsv(r, g, b) {
    const rf = r/255, gf = g/255, bf = b/255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    const d = max - min;
    let h = 0;
    if (max !== min) {
      if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
      else if (max === gf) h = (bf - rf) / d + 2;
      else h = (rf - gf) / d + 4;
      h /= 6;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  static hsvToRgb(h, s, v) {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return [(r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0];
  }

  static equalizeHSV(src) {
    const dst = src.clone();
    const d = dst.data;
    const total = src.width * src.height;
    const H = new Float32Array(total), S = new Float32Array(total), V = new Uint8Array(total);
    const histV = new Uint32Array(256);

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const [h, s, v] = this.rgbToHsv(d[p], d[p+1], d[p+2]);
      H[i] = h; S[i] = s; V[i] = (v * 255 + 0.5) | 0;
      histV[V[i]]++;
    }

    const lutV = new Uint8Array(256);
    let cdf = 0;
    for (let i = 0; i < 256; i++) {
      cdf += histV[i];
      lutV[i] = ((cdf * 255) / total + 0.5) | 0;
    }
    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const [r, g, b] = this.hsvToRgb(H[i], S[i], lutV[V[i]] / 255);
      d[p] = r; d[p+1] = g; d[p+2] = b;
    }
    return dst;
  }

  static claheHSV(src, tileSize = 32, clipLimit = 2.5) {
    const dst = src.clone();
    const d = dst.data;
    const w = src.width, h = src.height, total = w * h;
    const H = new Float32Array(total), S = new Float32Array(total), V = new Uint8Array(total);

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const [hv, sv, vv] = this.rgbToHsv(d[p], d[p+1], d[p+2]);
      H[i] = hv; S[i] = sv; V[i] = (vv * 255 + 0.5) | 0;
    }

    const tX = Math.max(2, Math.ceil(w / tileSize));
    const tY = Math.max(2, Math.ceil(h / tileSize));
    const luts = new Uint8Array(tX * tY * 256);

    for (let ty = 0; ty < tY; ty++) {
      for (let tx = 0; tx < tX; tx++) {
        const hist = new Float32Array(256);
        let count = 0;
        for (let y = ty * tileSize; y < Math.min(h, (ty + 1) * tileSize); y++) {
          for (let x = tx * tileSize; x < Math.min(w, (tx + 1) * tileSize); x++) {
            hist[V[y * w + x]]++; count++;
          }
        }
        const limit = Math.max(1, (clipLimit * count) / 256);
        let excess = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > limit) { excess += hist[i] - limit; hist[i] = limit; }
        }
        const redist = excess / 256;
        let cdf = 0;
        const base = (ty * tX + tx) * 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += redist;
          cdf += hist[i];
          luts[base + i] = Math.min(255, Math.max(0, Math.round((cdf * 255) / count)));
        }
      }
    }

    for (let y = 0; y < h; y++) {
      const gy = (y + 0.5) / tileSize - 0.5;
      const ty0 = Math.max(0, Math.min(tY - 1, Math.floor(gy)));
      const ty1 = Math.max(0, Math.min(tY - 1, ty0 + 1));
      const fy = Math.max(0, Math.min(1, gy - ty0));
      for (let x = 0; x < w; x++) {
        const gx = (x + 0.5) / tileSize - 0.5;
        const tx0 = Math.max(0, Math.min(tX - 1, Math.floor(gx)));
        const tx1 = Math.max(0, Math.min(tX - 1, tx0 + 1));
        const fx = Math.max(0, Math.min(1, gx - tx0));
        
        const idx = y * w + x;
        const val = V[idx];
        const v00 = luts[(ty0 * tX + tx0) * 256 + val];
        const v10 = luts[(ty0 * tX + tx1) * 256 + val];
        const v01 = luts[(ty1 * tX + tx0) * 256 + val];
        const v11 = luts[(ty1 * tX + tx1) * 256 + val];

        const newV = ((v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy) / 255;
        const [r, g, b] = this.hsvToRgb(H[idx], S[idx], newV);
        d[idx*4] = r; d[idx*4+1] = g; d[idx*4+2] = b;
      }
    }
    return dst;
  }

  static orderStatFilter(src, type, radius, padding) {
    const dst = new PixelBuffer(src.width, src.height);
    const w = src.width, h = src.height;
    const size = (2 * radius + 1) * (2 * radius + 1);
    const rArr = new Uint8Array(size), gArr = new Uint8Array(size), bArr = new Uint8Array(size);
    let pick = 0;
    if (type === 'median') pick = Math.floor(size / 2);
    else if (type === 'max') pick = size - 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let i = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = src.getOffset(x + dx, y + dy, padding);
            rArr[i] = src.data[idx]; gArr[i] = src.data[idx+1]; bArr[i] = src.data[idx+2];
            i++;
          }
        }
        rArr.sort(); gArr.sort(); bArr.sort();
        dst.setRGBA(x, y, rArr[pick], gArr[pick], bArr[pick], 255);
      }
    }
    return dst;
  }
}
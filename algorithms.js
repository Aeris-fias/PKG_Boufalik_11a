class WorkerPool {
  constructor() {
    this.numWorkers = Math.max(2, Math.min(8, navigator.hardwareConcurrency || 4));
    this.workerUrl = this.createWorkerBlobUrl();
  }

  createWorkerBlobUrl() {
    const workerCode = `
      function resolveCoord(coord, max, mode) {
        if (coord >= 0 && coord < max) return coord;
        if (mode === "clamp") return coord < 0 ? 0 : max - 1;
        let c = coord;
        while (c < 0 || c >= max) {
          if (c < 0) c = -c;
          if (c >= max) c = 2 * max - c - 2;
        }
        return c < 0 ? 0 : (c >= max ? max - 1 : c);
      }

      self.onmessage = function(e) {
        const { task, width, height, yStart, yEnd, srcData, params, padding } = e.data;
        const stripHeight = yEnd - yStart;
        const outStrip = new Uint8ClampedArray(width * stripHeight * 4);

        if (task === "orderStat") {
          const r = params.radius;
          const mode = params.statType;
          const alpha = params.alpha || 0.25;
          const winSize = (2 * r + 1) * (2 * r + 1);
          const bufR = new Uint8Array(winSize);
          const bufG = new Uint8Array(winSize);
          const bufB = new Uint8Array(winSize);

          for (let y = yStart; y < yEnd; y++) {
            const localY = y - yStart;
            for (let x = 0; x < width; x++) {
              let k = 0;
              for (let dy = -r; dy <= r; dy++) {
                const ry = resolveCoord(y + dy, height, padding);
                const rowBase = ry * width * 4;
                for (let dx = -r; dx <= r; dx++) {
                  const rx = resolveCoord(x + dx, width, padding);
                  const idx = rowBase + rx * 4;
                  bufR[k] = srcData[idx];
                  bufG[k] = srcData[idx + 1];
                  bufB[k] = srcData[idx + 2];
                  k++;
                }
              }
              bufR.sort();
              bufG.sort();
              bufB.sort();

              let vr = 0, vg = 0, vb = 0;
              if (mode === "median") {
                const mid = winSize >> 1;
                vr = bufR[mid]; vg = bufG[mid]; vb = bufB[mid];
              } else if (mode === "min") {
                vr = bufR[0]; vg = bufG[0]; vb = bufB[0];
              } else if (mode === "max") {
                vr = bufR[winSize - 1]; vg = bufG[winSize - 1]; vb = bufB[winSize - 1];
              } else if (mode === "midpoint") {
                vr = (bufR[0] + bufR[winSize - 1]) >> 1;
                vg = (bufG[0] + bufG[winSize - 1]) >> 1;
                vb = (bufB[0] + bufB[winSize - 1]) >> 1;
              } else if (mode === "alphaTrim") {
                const trim = Math.min((winSize - 1) >> 1, Math.floor(winSize * alpha * 0.5));
                let sr = 0, sg = 0, sb = 0, cnt = 0;
                for (let i = trim; i < winSize - trim; i++) {
                  sr += bufR[i]; sg += bufG[i]; sb += bufB[i];
                  cnt++;
                }
                vr = (sr / cnt) | 0; vg = (sg / cnt) | 0; vb = (sb / cnt) | 0;
              }

              const outIdx = (localY * width + x) * 4;
              outStrip[outIdx] = vr;
              outStrip[outIdx + 1] = vg;
              outStrip[outIdx + 2] = vb;
              outStrip[outIdx + 3] = 255;
            }
          }
        } else if (task === "morphBasic") {
          const r = params.radius;
          const shape = params.shape;
          const op = params.op;

          for (let y = yStart; y < yEnd; y++) {
            const localY = y - yStart;
            for (let x = 0; x < width; x++) {
              let bestR = op === "erode" ? 255 : 0;
              let bestG = op === "erode" ? 255 : 0;
              let bestB = op === "erode" ? 255 : 0;

              for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                  if (shape === "cross" && dx !== 0 && dy !== 0) continue;
                  if (shape === "disk" && (dx * dx + dy * dy > r * r)) continue;
                  const ry = resolveCoord(y + dy, height, padding);
                  const rx = resolveCoord(x + dx, width, padding);
                  const idx = (ry * width + rx) * 4;
                  const cr = srcData[idx], cg = srcData[idx + 1], cb = srcData[idx + 2];
                  if (op === "erode") {
                    if (cr < bestR) bestR = cr;
                    if (cg < bestG) bestG = cg;
                    if (cb < bestB) bestB = cb;
                  } else {
                    if (cr > bestR) bestR = cr;
                    if (cg > bestG) bestG = cg;
                    if (cb > bestB) bestB = cb;
                  }
                }
              }
              const outIdx = (localY * width + x) * 4;
              outStrip[outIdx] = bestR;
              outStrip[outIdx + 1] = bestG;
              outStrip[outIdx + 2] = bestB;
              outStrip[outIdx + 3] = 255;
            }
          }
        }

        self.postMessage({ yStart, yEnd, outStrip }, [outStrip.buffer]);
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    return URL.createObjectURL(blob);
  }

  async runParallel(task, srcBuffer, params, padding, onProgress) {
    const { width, height, data } = srcBuffer;
    const dst = new PixelBuffer(width, height);
    const numStrips = this.numWorkers;
    const stripH = Math.ceil(height / numStrips);
    let completed = 0;

    const promises = [];
    for (let i = 0; i < numStrips; i++) {
      const yStart = i * stripH;
      const yEnd = Math.min(height, (i + 1) * stripH);
      if (yStart >= yEnd) continue;

      promises.push(new Promise((resolve) => {
        const w = new Worker(this.workerUrl);
        w.onmessage = (e) => {
          const { yStart: ys, outStrip } = e.data;
          dst.data.set(outStrip, ys * width * 4);
          completed++;
          if (onProgress) onProgress(Math.round((completed / numStrips) * 100));
          w.terminate();
          resolve();
        };
        w.postMessage({
          task,
          width,
          height,
          yStart,
          yEnd,
          srcData: data,
          params,
          padding
        });
      }));
    }

    await Promise.all(promises);
    return dst;
  }
}

class ImageAlgorithms {
  static rgbToHsv(r, g, b) {
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (max !== min) {
      if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
      else if (max === gf) h = (bf - rf) / d + 2;
      else h = (rf - gf) / d + 4;
      h /= 6;
    }
    return [h, s, v];
  }

  static hsvToRgb(h, s, v) {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
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

  static computeHistograms(buffer) {
    const histR = new Uint32Array(256);
    const histG = new Uint32Array(256);
    const histB = new Uint32Array(256);
    const histL = new Uint32Array(256);
    const d = buffer.data;
    const total = buffer.width * buffer.height;
    let sumL = 0, sumL2 = 0, minL = 255, maxL = 0;

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b + 0.5) | 0;
      histR[r]++;
      histG[g]++;
      histB[b]++;
      histL[l]++;
      sumL += l;
      sumL2 += l * l;
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
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

  static linearContrast(src) {
    const dst = src.clone();
    const d = dst.data;
    const n = src.width * src.height * 4;
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;

    for (let i = 0; i < n; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (g < minG) minG = g; if (g > maxG) maxG = g;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
    }

    const scaleR = maxR > minR ? 255 / (maxR - minR) : 1;
    const scaleG = maxG > minG ? 255 / (maxG - minG) : 1;
    const scaleB = maxB > minB ? 255 / (maxB - minB) : 1;

    for (let i = 0; i < n; i += 4) {
      d[i] = ((d[i] - minR) * scaleR + 0.5) | 0;
      d[i + 1] = ((d[i + 1] - minG) * scaleG + 0.5) | 0;
      d[i + 2] = ((d[i + 2] - minB) * scaleB + 0.5) | 0;
    }
    return dst;
  }

  static equalizeRGB(src) {
    const dst = src.clone();
    const d = dst.data;
    const total = src.width * src.height;
    const { histR, histG, histB } = this.computeHistograms(src);
    const lutR = new Uint8Array(256);
    const lutG = new Uint8Array(256);
    const lutB = new Uint8Array(256);

    let cdfR = 0, cdfG = 0, cdfB = 0;
    for (let i = 0; i < 256; i++) {
      cdfR += histR[i];
      cdfG += histG[i];
      cdfB += histB[i];
      lutR[i] = ((cdfR * 255) / total + 0.5) | 0;
      lutG[i] = ((cdfG * 255) / total + 0.5) | 0;
      lutB[i] = ((cdfB * 255) / total + 0.5) | 0;
    }

    for (let i = 0; i < total * 4; i += 4) {
      d[i] = lutR[d[i]];
      d[i + 1] = lutG[d[i + 1]];
      d[i + 2] = lutB[d[i + 2]];
    }
    return dst;
  }

  static equalizeHSV(src) {
    const dst = src.clone();
    const d = dst.data;
    const total = src.width * src.height;
    const H = new Float32Array(total);
    const S = new Float32Array(total);
    const V = new Uint8Array(total);
    const histV = new Uint32Array(256);

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const [h, s, v] = this.rgbToHsv(d[p], d[p + 1], d[p + 2]);
      H[i] = h;
      S[i] = s;
      const vi = (v * 255 + 0.5) | 0;
      V[i] = vi;
      histV[vi]++;
    }

    const lutV = new Uint8Array(256);
    let cdf = 0;
    for (let i = 0; i < 256; i++) {
      cdf += histV[i];
      lutV[i] = ((cdf * 255) / total + 0.5) | 0;
    }

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const newV = lutV[V[i]] / 255;
      const [r, g, b] = this.hsvToRgb(H[i], S[i], newV);
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
    }
    return dst;
  }

  static claheHSV(src, tileSize = 32, clipLimit = 2.5) {
    const dst = src.clone();
    const d = dst.data;
    const { width, height } = src;
    const total = width * height;
    const H = new Float32Array(total);
    const S = new Float32Array(total);
    const V = new Uint8Array(total);

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const [h, s, v] = this.rgbToHsv(d[p], d[p + 1], d[p + 2]);
      H[i] = h;
      S[i] = s;
      V[i] = (v * 255 + 0.5) | 0;
    }

    const tilesX = Math.max(2, Math.ceil(width / tileSize));
    const tilesY = Math.max(2, Math.ceil(height / tileSize));
    const luts = new Uint8Array(tilesX * tilesY * 256);

    for (let ty = 0; ty < tilesY; ty++) {
      const y0 = ty * tileSize;
      const y1 = Math.min(height, y0 + tileSize);
      for (let tx = 0; tx < tilesX; tx++) {
        const x0 = tx * tileSize;
        const x1 = Math.min(width, x0 + tileSize);
        const hist = new Float32Array(256);
        let count = 0;

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            hist[V[y * width + x]]++;
            count++;
          }
        }

        const limit = Math.max(1, (clipLimit * count) / 256);
        let excess = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > limit) {
            excess += hist[i] - limit;
            hist[i] = limit;
          }
        }
        const redist = excess / 256;
        for (let i = 0; i < 256; i++) hist[i] += redist;

        let cdf = 0;
        const base = (ty * tilesX + tx) * 256;
        for (let i = 0; i < 256; i++) {
          cdf += hist[i];
          luts[base + i] = Math.min(255, Math.max(0, Math.round((cdf * 255) / count)));
        }
      }
    }

    for (let y = 0; y < height; y++) {
      const gy = (y + 0.5) / tileSize - 0.5;
      const ty0 = Math.max(0, Math.min(tilesY - 1, Math.floor(gy)));
      const ty1 = Math.max(0, Math.min(tilesY - 1, ty0 + 1));
      const fy = Math.max(0, Math.min(1, gy - ty0));

      for (let x = 0; x < width; x++) {
        const gx = (x + 0.5) / tileSize - 0.5;
        const tx0 = Math.max(0, Math.min(tilesX - 1, Math.floor(gx)));
        const tx1 = Math.max(0, Math.min(tilesX - 1, tx0 + 1));
        const fx = Math.max(0, Math.min(1, gx - tx0));

        const idx = y * width + x;
        const val = V[idx];
        const v00 = luts[(ty0 * tilesX + tx0) * 256 + val];
        const v10 = luts[(ty0 * tilesX + tx1) * 256 + val];
        const v01 = luts[(ty1 * tilesX + tx0) * 256 + val];
        const v11 = luts[(ty1 * tilesX + tx1) * 256 + val];

        const top = v00 * (1 - fx) + v10 * fx;
        const bot = v01 * (1 - fx) + v11 * fx;
        const newV = (top * (1 - fy) + bot * fy) / 255;

        const [r, g, b] = this.hsvToRgb(H[idx], S[idx], newV);
        const p = idx * 4;
        d[p] = r;
        d[p + 1] = g;
        d[p + 2] = b;
      }
    }
    return dst;
  }

  static elementwiseOp(src, mode, gamma = 1.0, gain = 1.2) {
    const dst = src.clone();
    const d = dst.data;
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      if (mode === "invert") lut[i] = 255 - i;
      else if (mode === "gamma") lut[i] = Math.min(255, Math.round(255 * Math.pow(i / 255, gamma)));
      else if (mode === "log") {
        const c = 255 / Math.log(1 + 255 * gain);
        lut[i] = Math.min(255, Math.round(c * Math.log(1 + i * gain)));
      }
    }
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    return dst;
  }

  static separableConvolution(src, kernel1D, padding = "reflect") {
    const { width, height } = src;
    const r = (kernel1D.length - 1) >> 1;
    const temp = new Float32Array(width * height * 3);
    const dst = new PixelBuffer(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sr = 0, sg = 0, sb = 0;
        for (let k = -r; k <= r; k++) {
          const w = kernel1D[k + r];
          sr += src.getChannel(x + k, y, 0, padding) * w;
          sg += src.getChannel(x + k, y, 1, padding) * w;
          sb += src.getChannel(x + k, y, 2, padding) * w;
        }
        const tIdx = (y * width + x) * 3;
        temp[tIdx] = sr;
        temp[tIdx + 1] = sg;
        temp[tIdx + 2] = sb;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sr = 0, sg = 0, sb = 0;
        for (let k = -r; k <= r; k++) {
          const ry = src.resolveCoord(y + k, height, padding);
          const w = kernel1D[k + r];
          const tIdx = (ry * width + x) * 3;
          sr += temp[tIdx] * w;
          sg += temp[tIdx + 1] * w;
          sb += temp[tIdx + 2] * w;
        }
        dst.setRGBA(x, y, sr, sg, sb, 255);
      }
    }
    return dst;
  }

  static buildGaussianKernel1D(radius, sigma) {
    const size = 2 * radius + 1;
    const kernel = new Float32Array(size);
    let sum = 0;
    const s2 = 2 * sigma * sigma;
    for (let i = -radius; i <= radius; i++) {
      const val = Math.exp(-(i * i) / s2);
      kernel[i + radius] = val;
      sum += val;
    }
    for (let i = 0; i < size; i++) kernel[i] /= sum;
    return kernel;
  }

  static buildBoxKernel1D(radius) {
    const size = 2 * radius + 1;
    const kernel = new Float32Array(size);
    kernel.fill(1 / size);
    return kernel;
  }

  static sharpenLaplacian(src, amount = 1.0, padding = "reflect") {
    const { width, height } = src;
    const dst = new PixelBuffer(width, height);
    const k = [0, -1, 0, -1, 4, -1, 0, -1, 0];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let lr = 0, lg = 0, lb = 0, idx = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const w = k[idx++];
            if (w === 0) continue;
            lr += src.getChannel(x + dx, y + dy, 0, padding) * w;
            lg += src.getChannel(x + dx, y + dy, 1, padding) * w;
            lb += src.getChannel(x + dx, y + dy, 2, padding) * w;
          }
        }
        const r = src.getChannel(x, y, 0, padding) + amount * lr;
        const g = src.getChannel(x, y, 1, padding) + amount * lg;
        const b = src.getChannel(x, y, 2, padding) + amount * lb;
        dst.setRGBA(x, y, r, g, b, 255);
      }
    }
    return dst;
  }

  static unsharpMask(src, radius = 2, sigma = 1.4, amount = 1.5, padding = "reflect") {
    const blurred = this.separableConvolution(src, this.buildGaussianKernel1D(radius, sigma), padding);
    const dst = src.clone();
    const s = src.data, b = blurred.data, d = dst.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = s[i] + amount * (s[i] - b[i]);
      d[i + 1] = s[i + 1] + amount * (s[i + 1] - b[i + 1]);
      d[i + 2] = s[i + 2] + amount * (s[i + 2] - b[i + 2]);
    }
    return dst;
  }

  static sobelOperator(src, visualizeAngle = false, padding = "reflect") {
    const { width, height } = src;
    const dst = new PixelBuffer(width, height);
    const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let gx = 0, gy = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const luma = src.getLuma(x + dx, y + dy, padding);
            gx += luma * gxK[k];
            gy += luma * gyK[k];
            k++;
          }
        }
        const mag = Math.min(255, Math.hypot(gx, gy));
        if (visualizeAngle) {
          let angle = Math.atan2(gy, gx);
          if (angle < 0) angle += 2 * Math.PI;
          const hue = angle / (2 * Math.PI);
          const val = mag / 255;
          const [r, g, b] = this.hsvToRgb(hue, 0.95, val);
          dst.setRGBA(x, y, r, g, b, 255);
        } else {
          dst.setRGBA(x, y, mag, mag, mag, 255);
        }
      }
    }
    return dst;
  }

  static cannySubpixel(src, lowT = 35, highT = 90, sigma = 1.4, padding = "reflect") {
    const { width, height } = src;
    const smoothed = this.separableConvolution(src, this.buildGaussianKernel1D(2, sigma), padding);
    const mag = new Float32Array(width * height);
    const gxArr = new Float32Array(width * height);
    const gyArr = new Float32Array(width * height);

    const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let gx = 0, gy = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const l = smoothed.getLuma(x + dx, y + dy, padding);
            gx += l * gxK[k];
            gy += l * gyK[k];
            k++;
          }
        }
        const idx = y * width + x;
        gxArr[idx] = gx;
        gyArr[idx] = gy;
        mag[idx] = Math.hypot(gx, gy);
      }
    }

    const nms = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const m = mag[idx];
        if (m === 0) continue;
        const gx = gxArr[idx], gy = gyArr[idx];
        const ax = Math.abs(gx), ay = Math.abs(gy);
        let m1 = 0, m2 = 0;

        if (ax >= ay) {
          const w = ay / (ax || 1);
          const s = (gx * gy >= 0) ? 1 : -1;
          m1 = (1 - w) * mag[idx + 1] + w * mag[(y + s) * width + (x + 1)];
          m2 = (1 - w) * mag[idx - 1] + w * mag[(y - s) * width + (x - 1)];
        } else {
          const w = ax / (ay || 1);
          const s = (gx * gy >= 0) ? 1 : -1;
          m1 = (1 - w) * mag[(y + 1) * width + x] + w * mag[(y + 1) * width + (x + s)];
          m2 = (1 - w) * mag[(y - 1) * width + x] + w * mag[(y - 1) * width + (x - s)];
        }

        if (m >= m1 && m >= m2) nms[idx] = m;
      }
    }

    const state = new Uint8Array(width * height);
    const stack = [];
    for (let i = 0; i < nms.length; i++) {
      if (nms[i] >= highT) {
        state[i] = 2;
        stack.push(i);
      } else if (nms[i] >= lowT) {
        state[i] = 1;
      }
    }

    while (stack.length > 0) {
      const idx = stack.pop();
      const cx = idx % width;
      const cy = (idx / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (state[nIdx] === 1) {
              state[nIdx] = 2;
              stack.push(nIdx);
            }
          }
        }
      }
    }

    const dst = new PixelBuffer(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = state[y * width + x] === 2 ? 255 : 0;
        dst.setRGBA(x, y, v, v, v, 255);
      }
    }
    return dst;
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

  static thresholdLocalSAT(src, method = "sauvola", radius = 15, k = 0.2, C = 10) {
    const { width, height } = src;
    const gray = src.toGrayscaleArray();
    const integral = new IntegralImage(gray, width, height);
    const dst = new PixelBuffer(width, height);
    const R = 128;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const { mean, std } = integral.getWindowStats(x, y, radius);
        let thresh = mean;
        if (method === "sauvola") {
          thresh = mean * (1 + k * (std / R - 1));
        } else if (method === "niblack") {
          thresh = mean + k * std;
        } else if (method === "adaptiveLecture") {
          thresh = mean - C;
        }
        const val = gray[y * width + x] > thresh ? 255 : 0;
        dst.setRGBA(x, y, val, val, val, 255);
      }
    }
    return dst;
  }

  static async morphologyOperation(src, op, shape, radius, padding, workerPool, useWorkers, onProgress) {
    const runSingle = async (buf, basicOp) => {
      if (useWorkers) {
        return await workerPool.runParallel("morphBasic", buf, { radius, shape, op: basicOp }, padding, onProgress);
      }
      const dst = new PixelBuffer(buf.width, buf.height);
      for (let y = 0; y < buf.height; y++) {
        for (let x = 0; x < buf.width; x++) {
          let bestR = basicOp === "erode" ? 255 : 0;
          let bestG = basicOp === "erode" ? 255 : 0;
          let bestB = basicOp === "erode" ? 255 : 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (shape === "cross" && dx !== 0 && dy !== 0) continue;
              if (shape === "disk" && dx * dx + dy * dy > radius * radius) continue;
              const cr = buf.getChannel(x + dx, y + dy, 0, padding);
              const cg = buf.getChannel(x + dx, y + dy, 1, padding);
              const cb = buf.getChannel(x + dx, y + dy, 2, padding);
              if (basicOp === "erode") {
                if (cr < bestR) bestR = cr;
                if (cg < bestG) bestG = cg;
                if (cb < bestB) bestB = cb;
              } else {
                if (cr > bestR) bestR = cr;
                if (cg > bestG) bestG = cg;
                if (cb > bestB) bestB = cb;
              }
            }
          }
          dst.setRGBA(x, y, bestR, bestG, bestB, 255);
        }
      }
      return dst;
    };

    if (op === "erode" || op === "dilate") {
      return await runSingle(src, op);
    }
    if (op === "open") {
      const eroded = await runSingle(src, "erode");
      return await runSingle(eroded, "dilate");
    }
    if (op === "close") {
      const dilated = await runSingle(src, "dilate");
      return await runSingle(dilated, "erode");
    }
    if (op === "gradient") {
      const dilated = await runSingle(src, "dilate");
      const eroded = await runSingle(src, "erode");
      const dst = new PixelBuffer(src.width, src.height);
      for (let i = 0; i < dst.data.length; i += 4) {
        dst.data[i] = dilated.data[i] - eroded.data[i];
        dst.data[i + 1] = dilated.data[i + 1] - eroded.data[i + 1];
        dst.data[i + 2] = dilated.data[i + 2] - eroded.data[i + 2];
        dst.data[i + 3] = 255;
      }
      return dst;
    }
    if (op === "tophat") {
      const opened = await this.morphologyOperation(src, "open", shape, radius, padding, workerPool, useWorkers, onProgress);
      const dst = new PixelBuffer(src.width, src.height);
      for (let i = 0; i < dst.data.length; i += 4) {
        dst.data[i] = src.data[i] - opened.data[i];
        dst.data[i + 1] = src.data[i + 1] - opened.data[i + 1];
        dst.data[i + 2] = src.data[i + 2] - opened.data[i + 2];
        dst.data[i + 3] = 255;
      }
      return dst;
    }
    if (op === "blackhat") {
      const closed = await this.morphologyOperation(src, "close", shape, radius, padding, workerPool, useWorkers, onProgress);
      const dst = new PixelBuffer(src.width, src.height);
      for (let i = 0; i < dst.data.length; i += 4) {
        dst.data[i] = closed.data[i] - src.data[i];
        dst.data[i + 1] = closed.data[i + 1] - src.data[i + 1];
        dst.data[i + 2] = closed.data[i + 2] - src.data[i + 2];
        dst.data[i + 3] = 255;
      }
      return dst;
    }
    return src.clone();
  }
}
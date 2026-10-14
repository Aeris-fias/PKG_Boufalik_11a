class PixelBuffer {
  constructor(width, height, data = null) {
    this.width = width | 0;
    this.height = height | 0;
    this.data = data ? new Uint8ClampedArray(data) : new Uint8ClampedArray(this.width * this.height * 4);
  }

  clone() {
    return new PixelBuffer(this.width, this.height, this.data);
  }

  resolveCoord(coord, max, mode) {
    if (coord >= 0 && coord < max) return coord;
    if (mode === "clamp") {
      return coord < 0 ? 0 : max - 1;
    }
    let c = coord;
    while (c < 0 || c >= max) {
      if (c < 0) c = -c;
      if (c >= max) c = 2 * max - c - 2;
    }
    return c < 0 ? 0 : (c >= max ? max - 1 : c);
  }

  getOffset(x, y, mode = "reflect") {
    const rx = this.resolveCoord(x, this.width, mode);
    const ry = this.resolveCoord(y, this.height, mode);
    return (ry * this.width + rx) << 2;
  }

  getChannel(x, y, c, mode = "reflect") {
    return this.data[this.getOffset(x, y, mode) + c];
  }

  getRGB(x, y, mode = "reflect") {
    const idx = this.getOffset(x, y, mode);
    return [this.data[idx], this.data[idx + 1], this.data[idx + 2]];
  }

  getLuma(x, y, mode = "reflect") {
    const idx = this.getOffset(x, y, mode);
    return (0.299 * this.data[idx] + 0.587 * this.data[idx + 1] + 0.114 * this.data[idx + 2]) | 0;
  }

  setRGBA(x, y, r, g, b, a = 255) {
    const idx = (y * this.width + x) << 2;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }

  toGrayscaleArray() {
    const total = this.width * this.height;
    const gray = new Uint8Array(total);
    const d = this.data;
    for (let i = 0, p = 0; i < total; i++, p += 4) {
      gray[i] = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2] + 0.5) | 0;
    }
    return gray;
  }
}

class IntegralImage {
  constructor(grayArray, width, height) {
    this.width = width;
    this.height = height;
    const w1 = width + 1;
    const h1 = height + 1;
    this.sat = new Float64Array(w1 * h1);
    this.sat2 = new Float64Array(w1 * h1);

    for (let y = 1; y <= height; y++) {
      let rowSum = 0;
      let rowSum2 = 0;
      const srcOffset = (y - 1) * width;
      const dstOffset = y * w1;
      const prevOffset = (y - 1) * w1;
      for (let x = 1; x <= width; x++) {
        const val = grayArray[srcOffset + x - 1];
        rowSum += val;
        rowSum2 += val * val;
        this.sat[dstOffset + x] = this.sat[prevOffset + x] + rowSum;
        this.sat2[dstOffset + x] = this.sat2[prevOffset + x] + rowSum2;
      }
    }
  }

  getWindowStats(cx, cy, radius) {
    const x1 = Math.max(0, cx - radius);
    const y1 = Math.max(0, cy - radius);
    const x2 = Math.min(this.width - 1, cx + radius);
    const y2 = Math.min(this.height - 1, cy + radius);
    const count = (x2 - x1 + 1) * (y2 - y1 + 1);
    const w1 = this.width + 1;

    const A = y1 * w1 + x1;
    const B = y1 * w1 + (x2 + 1);
    const C = (y2 + 1) * w1 + x1;
    const D = (y2 + 1) * w1 + (x2 + 1);

    const sum = this.sat[D] - this.sat[B] - this.sat[C] + this.sat[A];
    const sum2 = this.sat2[D] - this.sat2[B] - this.sat2[C] + this.sat2[A];
    const mean = sum / count;
    const variance = Math.max(0, sum2 / count - mean * mean);
    return { mean, std: Math.sqrt(variance) };
  }
}
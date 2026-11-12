class PixelBuffer {
  constructor(width, height, data = null) {
    this.width = width | 0;
    this.height = height | 0;
    this.data = data ? new Uint8ClampedArray(data) : new Uint8ClampedArray(this.width * this.height * 4);
  }

  clone() {
    return new PixelBuffer(this.width, this.height, this.data);
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
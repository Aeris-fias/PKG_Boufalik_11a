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

  getLuma(x, y, mode = "clamp") {
    const rx = this.resolveCoord(x, this.width, mode);
    const ry = this.resolveCoord(y, this.height, mode);
    const idx = (ry * this.width + rx) * 4;
    return (0.299 * this.data[idx] + 0.587 * this.data[idx + 1] + 0.114 * this.data[idx + 2]) | 0;
  }

  setRGBA(x, y, r, g, b, a = 255) {
    const idx = (y * this.width + x) * 4;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }

  toGrayscaleArray() {
    const total = this.width * this.height;
    const gray = new Uint8Array(total);
    for (let i = 0, p = 0; i < total; i++, p += 4) {
      gray[i] = (0.299 * this.data[p] + 0.587 * this.data[p+1] + 0.114 * this.data[p+2] + 0.5) | 0;
    }
    return gray;
  }
}
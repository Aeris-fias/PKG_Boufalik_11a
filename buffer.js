class PixelBuffer {
  constructor(width, height, data = null) {
    this.width = width | 0;
    this.height = height | 0;
    this.data = data ? new Uint8ClampedArray(data) : new Uint8ClampedArray(this.width * this.height * 4);
  }

  clone() {
    return new PixelBuffer(this.width, this.height, this.data);
  }

  getOffset(x, y, mode) {
    let rx = x, ry = y;
    if (mode === "clamp") {
      rx = Math.max(0, Math.min(x, this.width - 1));
      ry = Math.max(0, Math.min(y, this.height - 1));
    } else {
      while (rx < 0 || rx >= this.width) {
        if (rx < 0) rx = -rx;
        if (rx >= this.width) rx = 2 * this.width - rx - 2;
      }
      while (ry < 0 || ry >= this.height) {
        if (ry < 0) ry = -ry;
        if (ry >= this.height) ry = 2 * this.height - ry - 2;
      }
    }
    return (ry * this.width + rx) * 4;
  }

  setRGBA(x, y, r, g, b, a = 255) {
    const idx = (y * this.width + x) * 4;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }
}
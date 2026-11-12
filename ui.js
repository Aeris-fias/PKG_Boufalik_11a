class PresetGenerator {
  static create(type, width = 520, height = 360) {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (type === "document") {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#000000"; ctx.font = "bold 26px sans-serif";
      const lines = ["ГЛОБАЛЬНАЯ БИНАРИЗАЦИЯ", "Методы Оцу и Изодата", "вычисляют порог по гистограмме."];
      lines.forEach((line, i) => ctx.fillText(line, 40, 120 + i * 50));

      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const light = 0.4 + 0.6 * (x / width); 
          d[idx] *= light; d[idx+1] *= light; d[idx+2] *= light;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      ctx.fillStyle = "#2c3e50"; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#ecf0f1"; ctx.beginPath(); ctx.arc(150, 180, 90, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#bdc3c7"; ctx.fillRect(280, 80, 160, 160);
    }
    return new PixelBuffer(width, height, ctx.getImageData(0, 0, width, height).data);
  }
}

class AppUI {
  constructor() {
    this.srcBuffer = null;
    this.dstBuffer = null;
    
    this.srcCanvas = document.getElementById("srcCanvas");
    this.dstCanvas = document.getElementById("dstCanvas");
    this.srcHistCanvas = document.getElementById("srcHistCanvas");
    this.dstHistCanvas = document.getElementById("dstHistCanvas");

    this.bindEvents();
    this.loadPreset("document");
  }

  bindEvents() {
    document.getElementById("presetGrid").addEventListener("click", (e) => {
      const btn = e.target.closest(".preset-btn");
      if (!btn) return;
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      this.loadPreset(btn.dataset.preset);
    });

    document.getElementById("methodSelect").addEventListener("change", () => this.executeCurrentMethod());
    document.getElementById("applyBtn").addEventListener("click", () => this.executeCurrentMethod());

    document.getElementById("fileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale); h = Math.round(h * scale);
          }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          this.srcBuffer = new PixelBuffer(w, h, c.getContext("2d").getImageData(0, 0, w, h).data);
          this.renderBufferToCanvas(this.srcBuffer, this.srcCanvas);
          this.executeCurrentMethod();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("downloadBtn").addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = "binarized_image.png";
      link.href = this.dstCanvas.toDataURL("image/png");
      link.click();
    });
  }

  loadPreset(presetName) {
    this.srcBuffer = PresetGenerator.create(presetName);
    this.renderBufferToCanvas(this.srcBuffer, this.srcCanvas);
    this.executeCurrentMethod();
  }

  setProgress(pct) {
    document.getElementById("progressBar").style.width = `${pct}%`;
  }

  renderBufferToCanvas(buffer, canvas) {
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height), 0, 0);
  }

  drawHistogram(histData, canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width = 512;
    const h = canvas.height = 130;
    ctx.clearRect(0, 0, w, h);

    let maxVal = 1;
    for (let i = 1; i < 255; i++) maxVal = Math.max(maxVal, histData.histL[i]);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < 256; i++) {
      ctx.lineTo((i / 255) * w, h - Math.min(1, histData.histL[i] / maxVal) * (h - 5));
    }
    ctx.lineTo(w, h);
    ctx.fillStyle = "rgba(255, 71, 87, 0.6)";
    ctx.fill();
  }

  executeCurrentMethod() {
    if (!this.srcBuffer) return;
    this.setProgress(50);
    const method = document.getElementById("methodSelect").value;
    const t0 = performance.now();
    
    let dst = null;
    if (method === "otsu") dst = ImageAlgorithms.thresholdOtsu(this.srcBuffer);
    else if (method === "isodata") dst = ImageAlgorithms.thresholdIsodata(this.srcBuffer);

    const elapsed = (performance.now() - t0).toFixed(1);
    this.setProgress(100);
    setTimeout(() => this.setProgress(0), 200);

    this.dstBuffer = dst;
    this.renderBufferToCanvas(dst, this.dstCanvas);

    document.getElementById("perfInfo").textContent = `${elapsed} мс | Порог T = ${dst.computedThreshold}`;
    document.getElementById("srcMeta").textContent = `${this.srcBuffer.width} × ${this.srcBuffer.height} px`;

    const srcH = ImageAlgorithms.computeHistograms(this.srcBuffer);
    const dstH = ImageAlgorithms.computeHistograms(this.dstBuffer);
    this.drawHistogram(srcH, this.srcHistCanvas);
    this.drawHistogram(dstH, this.dstHistCanvas);

    document.getElementById("srcStats").innerHTML = `<span>Яркость: ${srcH.mean.toFixed(1)}</span>`;
    document.getElementById("dstStats").innerHTML = `<span>Бинарное изображение (0 и 255)</span>`;
  }
}

window.addEventListener("DOMContentLoaded", () => new AppUI());
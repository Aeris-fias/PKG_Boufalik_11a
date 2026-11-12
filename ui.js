class AppUI {
  constructor() {
    this.srcBuffer = null;
    this.dstBuffer = null;
    this.currentMethod = 'otsu';
    
    this.srcCanvas = document.getElementById("srcCanvas");
    this.dstCanvas = document.getElementById("dstCanvas");
    
    this.bindEvents();
    this.loadPreset("shapes");
  }

  bindEvents() {
    const buttons = document.querySelectorAll('.method-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        buttons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentMethod = e.currentTarget.dataset.method;
        this.processImage();
      });
    });

    document.getElementById("presetSelect").addEventListener("change", (e) => {
      this.loadPreset(e.target.value);
    });

    document.getElementById("paddingSelect").addEventListener("change", () => {
      this.processImage();
    });
  }

  loadPreset(presetName) {
    const w = 500, h = 350;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");

    if (presetName === "shapes") {
      ctx.fillStyle = "#2c3e50"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ecf0f1"; ctx.beginPath(); ctx.arc(150, 150, 80, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#bdc3c7"; ctx.fillRect(280, 80, 140, 140);
      ctx.fillStyle = "#95a5a6"; ctx.beginPath(); ctx.moveTo(80, 300); ctx.lineTo(160, 240); ctx.lineTo(240, 300); ctx.fill();
    } else if (presetName === "document") {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#000000"; ctx.font = "bold 24px sans-serif";
      ctx.fillText("ГЛОБАЛЬНАЯ БИНАРИЗАЦИЯ", 40, 100);
      ctx.fillText("Методы Оцу и Изодата", 40, 150);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const light = 0.3 + 0.7 * (x / w); 
          d[idx] *= light; d[idx+1] *= light; d[idx+2] *= light;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      ctx.fillStyle = "#8e44ad"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(250, 175, 100, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#3498db"; ctx.fillRect(100, 100, 100, 100);
      ctx.fillStyle = "#e74c3c"; ctx.fillRect(300, 200, 120, 80);
      ctx.lineWidth = 10; ctx.strokeStyle = "#fff"; ctx.strokeRect(50, 50, 400, 250);
    }

    this.srcBuffer = new PixelBuffer(w, h, ctx.getImageData(0, 0, w, h).data);
    this.renderBuffer(this.srcBuffer, this.srcCanvas);
    this.processImage();
  }

  processImage() {
    if (!this.srcBuffer) return;
    const padding = document.getElementById("paddingSelect").value;
    const t0 = performance.now();
    
    let dst = null;
    if (this.currentMethod === "otsu") dst = ImageAlgorithms.thresholdOtsu(this.srcBuffer);
    else if (this.currentMethod === "isodata") dst = ImageAlgorithms.thresholdIsodata(this.srcBuffer);
    else if (this.currentMethod === "points") dst = ImageAlgorithms.detectPoints(this.srcBuffer, padding);
    else if (this.currentMethod === "lines") dst = ImageAlgorithms.detectHorizontalLines(this.srcBuffer, padding);
    else if (this.currentMethod === "sobel") dst = ImageAlgorithms.detectSobel(this.srcBuffer, padding);
    else if (this.currentMethod === "canny") dst = ImageAlgorithms.detectCanny(this.srcBuffer, padding);

    const elapsed = (performance.now() - t0).toFixed(1);
    this.dstBuffer = dst;
    this.renderBuffer(dst, this.dstCanvas);
    document.getElementById("perfInfo").textContent = `${elapsed} мс`;
  }

  renderBuffer(buffer, canvas) {
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height), 0, 0);
  }
}

window.addEventListener("DOMContentLoaded", () => new AppUI());
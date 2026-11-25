class PresetGenerator {
  static create(type, width = 450, height = 300) {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (type === "lowContrast") {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "rgb(115, 125, 135)");
      grad.addColorStop(1, "rgb(145, 150, 155)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgb(138, 132, 118)";
      ctx.beginPath(); ctx.arc(350, 80, 35, 0, Math.PI * 2); ctx.fill();
      const layers = [
        { y: 150, amp: 25, freq: 0.015, col: "rgb(120, 128, 135)" },
        { y: 200, amp: 20, freq: 0.02, col: "rgb(105, 112, 118)" },
        { y: 250, amp: 15, freq: 0.03, col: "rgb(95, 102, 108)" }
      ];
      layers.forEach((l, idx) => {
        ctx.fillStyle = l.col;
        ctx.beginPath(); ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 4) ctx.lineTo(x, l.y + Math.sin(x * l.freq + idx * 2) * l.amp);
        ctx.lineTo(width, height); ctx.fill();
      });
    } else if (type === "saltPepper") {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, "#2c3e50"); g.addColorStop(1, "#34495e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#f1c40f"; ctx.fillRect(50, 50, 120, 80);
      ctx.fillStyle = "#e74c3c"; ctx.beginPath(); ctx.arc(320, 120, 60, 0, Math.PI * 2); ctx.fill();
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      let seed = 42;
      const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      for (let i = 0; i < d.length; i += 4) {
        const r = rand();
        if (r < 0.05) { d[i] = 0; d[i+1] = 0; d[i+2] = 0; }
        else if (r > 0.95) { d[i] = 255; d[i+1] = 255; d[i+2] = 255; }
      }
      ctx.putImageData(imgData, 0, 0);
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
    this.loadPreset("lowContrast");
  }

  bindEvents() {
    document.getElementById("presetGrid").addEventListener("click", (e) => {
      const btn = e.target.closest(".preset-btn");
      if (!btn) return;
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      this.loadPreset(btn.dataset.preset);
    });

    document.getElementById("methodSelect").addEventListener("change", () => {
      this.renderControls();
      this.processImage();
    });
    
    document.getElementById("paddingSelect").addEventListener("change", () => this.processImage());
    document.getElementById("applyBtn").addEventListener("click", () => this.processImage());

    document.getElementById("fileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale); h = Math.round(h * scale);
          }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          this.srcBuffer = new PixelBuffer(w, h, c.getContext("2d").getImageData(0, 0, w, h).data);
          this.renderBuffer(this.srcBuffer, this.srcCanvas);
          this.processImage();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("downloadBtn").addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = "processed.png";
      link.href = this.dstCanvas.toDataURL("image/png");
      link.click();
    });
  }

  loadPreset(presetName) {
    this.srcBuffer = PresetGenerator.create(presetName);
    this.renderBuffer(this.srcBuffer, this.srcCanvas);
    
    const sel = document.getElementById("methodSelect");
    if (presetName === "lowContrast") sel.value = "clahe";
    else if (presetName === "saltPepper") sel.value = "median";
    
    this.renderControls();
    this.processImage();
  }

  renderControls() {
    const val = document.getElementById("methodSelect").value;
    const container = document.getElementById("dynamicControls");
    container.innerHTML = "";
    
    if (["median", "min", "max"].includes(val)) {
      container.innerHTML = `
        <div class="control-group">
          <label>Радиус окна R <span id="val_r">1</span></label>
          <input type="range" id="param_r" min="1" max="4" step="1" value="1">
        </div>`;
      document.getElementById("param_r").addEventListener("input", (e) => {
        document.getElementById("val_r").textContent = e.target.value;
      });
    } else if (val === "clahe") {
      container.innerHTML = `
        <div class="control-group">
          <label>Размер тайла <span id="val_t">32</span></label>
          <input type="range" id="param_t" min="16" max="64" step="16" value="32">
        </div>
        <div class="control-group">
          <label>Clip Limit <span id="val_c">2.5</span></label>
          <input type="range" id="param_c" min="1.0" max="5.0" step="0.5" value="2.5">
        </div>`;
      document.getElementById("param_t").addEventListener("input", (e) => document.getElementById("val_t").textContent = e.target.value);
      document.getElementById("param_c").addEventListener("input", (e) => document.getElementById("val_c").textContent = e.target.value);
    } else {
      container.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted);">Автоматический расчет без параметров</div>`;
    }
  }

  setProgress(pct) {
    document.getElementById("progressBar").style.width = `${pct}%`;
  }

  renderBuffer(buffer, canvas) {
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height), 0, 0);
  }

  drawHistogram(histData, canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(360, Math.round(rect.width || 520));
    const height = 175;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padLeft = 14;
    const padRight = 14;
    const padTop = 24;
    const padBottom = 22;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(padLeft, padTop, plotW, plotH);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      const x = padLeft + (plotW / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();
    }

    let maxVal = 1;
    for (let i = 1; i < 255; i++) {
      maxVal = Math.max(maxVal, histData.histR[i], histData.histG[i], histData.histB[i], histData.histL[i]);
    }
    maxVal = Math.max(maxVal, histData.histL[0] * 0.5, histData.histL[255] * 0.5);

    const drawSeries = (arr, strokeColor, fillColor = null) => {
      ctx.beginPath();
      if (fillColor) ctx.moveTo(padLeft, padTop + plotH);
      for (let i = 0; i < 256; i++) {
        const x = padLeft + (i / 255) * plotW;
        const norm = Math.min(1, arr[i] / maxVal);
        const y = padTop + plotH - norm * (plotH - 4);
        if (i === 0 && !fillColor) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (fillColor) {
        ctx.lineTo(padLeft + plotW, padTop + plotH);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = fillColor ? 1.8 : 1.4;
      ctx.stroke();
    };

    drawSeries(histData.histL, "rgba(71, 85, 105, 0.75)", "rgba(148, 163, 184, 0.25)");
    drawSeries(histData.histR, "#ef4444");
    drawSeries(histData.histG, "#10b981");
    drawSeries(histData.histB, "#3b82f6");

    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "top";
    const ticks = [0, 64, 128, 192, 255];
    ticks.forEach((t, idx) => {
      const x = padLeft + (t / 255) * plotW;
      ctx.textAlign = idx === 0 ? "left" : (idx === ticks.length - 1 ? "right" : "center");
      ctx.fillText(String(t), x, padTop + plotH + 5);
    });

    const legend = [
      { label: "Luma", color: "#475569" },
      { label: "R", color: "#ef4444" },
      { label: "G", color: "#10b981" },
      { label: "B", color: "#3b82f6" }
    ];
    let lx = padLeft;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    legend.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, 9, 10, 4);
      ctx.fillStyle = "#475569";
      ctx.fillText(item.label, lx + 14, 11);
      lx += 14 + ctx.measureText(item.label).width + 12;
    });
  }

  processImage() {
    if (!this.srcBuffer) return;
    this.setProgress(50);
    setTimeout(() => {
      const method = document.getElementById("methodSelect").value;
      const padding = document.getElementById("paddingSelect").value;
      const t0 = performance.now();
      
      let dst = null;
      if (method === "linear") dst = ImageAlgorithms.linearContrast(this.srcBuffer);
      else if (method === "eqRGB") dst = ImageAlgorithms.equalizeRGB(this.srcBuffer);
      else if (method === "eqHSV") dst = ImageAlgorithms.equalizeHSV(this.srcBuffer);
      else if (method === "clahe") {
        const t = parseInt(document.getElementById("param_t").value);
        const c = parseFloat(document.getElementById("param_c").value);
        dst = ImageAlgorithms.claheHSV(this.srcBuffer, t, c);
      }
      else if (["median", "min", "max"].includes(method)) {
        const r = parseInt(document.getElementById("param_r").value);
        dst = ImageAlgorithms.orderStatFilter(this.srcBuffer, method, r, padding);
      }

      const elapsed = (performance.now() - t0).toFixed(1);
      this.setProgress(100);
      setTimeout(() => this.setProgress(0), 200);

      this.dstBuffer = dst;
      this.renderBuffer(dst, this.dstCanvas);

      document.getElementById("perfInfo").textContent = `${elapsed} мс`;
      document.getElementById("srcMeta").textContent = `${this.srcBuffer.width} × ${this.srcBuffer.height} px`;

      const srcH = ImageAlgorithms.computeHistograms(this.srcBuffer);
      const dstH = ImageAlgorithms.computeHistograms(this.dstBuffer);
      this.drawHistogram(srcH, this.srcHistCanvas);
      this.drawHistogram(dstH, this.dstHistCanvas);

      document.getElementById("srcStats").innerHTML = `<span>Яркость: ${srcH.mean.toFixed(1)}</span><span>Контраст: ${srcH.std.toFixed(1)}</span>`;
      document.getElementById("dstStats").innerHTML = `<span>Яркость: ${dstH.mean.toFixed(1)}</span><span>Контраст: ${dstH.std.toFixed(1)}</span>`;
    }, 10);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new AppUI();
  window.addEventListener("resize", () => {
    if (app.srcBuffer && app.dstBuffer) {
      app.drawHistogram(ImageAlgorithms.computeHistograms(app.srcBuffer), app.srcHistCanvas);
      app.drawHistogram(ImageAlgorithms.computeHistograms(app.dstBuffer), app.dstHistCanvas);
    }
  });
});
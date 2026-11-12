class PresetGenerator {
  static create(type, width = 520, height = 360) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (type === "lowContrast") {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "rgb(115, 125, 135)");
      grad.addColorStop(1, "rgb(145, 150, 155)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgb(138, 132, 118)";
      ctx.beginPath(); ctx.arc(410, 85, 42, 0, Math.PI * 2); ctx.fill();

      const layers = [
        { y: 170, amp: 35, freq: 0.012, col: "rgb(120, 128, 135)" },
        { y: 225, amp: 28, freq: 0.018, col: "rgb(105, 112, 118)" },
        { y: 275, amp: 18, freq: 0.025, col: "rgb(95, 102, 108)" }
      ];
      layers.forEach((l, idx) => {
        ctx.fillStyle = l.col;
        ctx.beginPath(); ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 4) ctx.lineTo(x, l.y + Math.sin(x * l.freq + idx * 2) * l.amp);
        ctx.lineTo(width, height); ctx.fill();
      });
    } else if (type === "saltPepper") {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, "#2c3e50");
      g.addColorStop(1, "#34495e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#f1c40f"; ctx.fillRect(60, 60, 140, 100);
      ctx.fillStyle = "#e74c3c"; ctx.beginPath(); ctx.arc(360, 140, 70, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#ecf0f1"; ctx.font = "bold 32px sans-serif";
      ctx.fillText("ЗАШУМЛЕННОЕ ФОТО", 80, 290);

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
    } else if (type === "unevenText") {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#000000"; ctx.font = "bold 22px serif";
      const lines = ["ТЕКСТ С ГЛУБОКОЙ ТЕНЬЮ", "Локальный метод Сауволы", "через интегральное изображение", "позволяет отделить текст", "от сложного градиентного фона."];
      lines.forEach((line, i) => ctx.fillText(line, 40, 70 + i * 45));

      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const light = 0.2 + 0.8 * ((x / width) * 0.7 + (1 - y / height) * 0.3);
          d[idx] *= light; d[idx+1] *= light; d[idx+2] *= light;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (type === "edgesShapes") {
      ctx.fillStyle = "#1e272e"; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#d2dae2"; ctx.beginPath(); ctx.arc(150, 150, 70, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#0fbcf9"; ctx.lineWidth = 8; ctx.strokeRect(270, 60, 180, 130);
      ctx.fillStyle = "#ff5e57"; ctx.beginPath(); ctx.moveTo(270, 320); ctx.lineTo(360, 230); ctx.lineTo(450, 320); ctx.fill();
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = "#fff"; ctx.lineWidth = i + 1;
        ctx.beginPath(); ctx.moveTo(40, 260 + i * 18); ctx.lineTo(200, 260 + i * 18); ctx.stroke();
      }
    } else if (type === "morphology") {
      const grad = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, 300);
      grad.addColorStop(0, "#808e9b"); grad.addColorStop(1, "#1e272e");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#d2dae2"; ctx.fillRect(80, 90, 130, 130);
      ctx.fillStyle = "#1e272e"; ctx.fillRect(130, 140, 15, 15); ctx.fillRect(160, 110, 10, 10);

      ctx.fillStyle = "#d2dae2";
      for (let y = 60; y < 320; y += 40) {
        for (let x = 270; x < 480; x += 40) {
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
        }
      }
    } else if (type === "colorCast") {
      ctx.fillStyle = "#2c3e50"; ctx.fillRect(0, 0, width, height);
      const spheres = [
        {x: 140, y: 140, r: 80, c1: "#e74c3c", c2: "#922b21"},
        {x: 290, y: 160, r: 85, c1: "#2ecc71", c2: "#1d8348"},
        {x: 410, y: 130, r: 70, c1: "#3498db", c2: "#21618c"},
        {x: 220, y: 280, r: 70, c1: "#f1c40f", c2: "#9a7d0a"}
      ];
      spheres.forEach(s => {
        const rg = ctx.createRadialGradient(s.x-20, s.y-20, 10, s.x, s.y, s.r);
        rg.addColorStop(0, s.c1); rg.addColorStop(1, s.c2);
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
      });
    }
    return new PixelBuffer(width, height, ctx.getImageData(0, 0, width, height).data);
  }
}

const CAT_NAMES = {
  hist: "1. Контраст и Гистограммы",
  order: "2. Порядковые статистики",
  conv: "3. НЧ / ВЧ Фильтры",
  seg: "4. Сегментация (Кэнни)",
  thresh: "5. Пороговая обработка",
  morph: "6. Морфология"
};

const METHODS_CONFIG = {
  hist: [
    { id: "linearContrast", name: "Линейное контрастирование", controls: [] },
    { id: "equalizeHSV", name: "Эквализация (HSV - только V)", controls: [] },
    { id: "equalizeRGB", name: "Эквализация (RGB)", controls: [] },
    { id: "clahe", name: "CLAHE (Адаптивная)", controls: [{ id: "tileSize", label: "Размер тайла (px)", min: 16, max: 96, step: 8, val: 32 }, { id: "clipLimit", label: "Предел (Clip Limit)", min: 1.2, max: 6.0, step: 0.2, val: 2.5 }] },
    { id: "gamma", name: "Гамма-коррекция", controls: [{ id: "gamma", label: "Коэффициент Гамма (γ)", min: 0.2, max: 3.0, step: 0.1, val: 0.6 }] },
    { id: "invert", name: "Инверсия (Негатив)", controls: [] }
  ],
  order: [
    { id: "median", name: "Медианный фильтр", controls: [{ id: "radius", label: "Радиус окна R", min: 1, max: 5, step: 1, val: 1 }] },
    { id: "alphaTrim", name: "Альфа-усеченное среднее", controls: [{ id: "radius", label: "Радиус окна R", min: 1, max: 5, step: 1, val: 1 }, { id: "alpha", label: "Доля отбрасывания α", min: 0.1, max: 0.8, step: 0.1, val: 0.4 }] },
    { id: "min", name: "Фильтр минимума", controls: [{ id: "radius", label: "Радиус окна R", min: 1, max: 5, step: 1, val: 1 }] },
    { id: "max", name: "Фильтр максимума", controls: [{ id: "radius", label: "Радиус окна R", min: 1, max: 5, step: 1, val: 1 }] }
  ],
  conv: [
    { id: "gaussSeparable", name: "Гаусс (Разделяемая 1D+1D)", controls: [{ id: "radius", label: "Радиус R", min: 1, max: 10, step: 1, val: 3 }, { id: "sigma", label: "Сигма σ", min: 0.5, max: 5.0, step: 0.2, val: 1.6 }] },
    { id: "unsharp", name: "Нерезкое маскирование", controls: [{ id: "radius", label: "Радиус R", min: 1, max: 6, step: 1, val: 2 }, { id: "amount", label: "Сила", min: 0.5, max: 3.5, step: 0.2, val: 1.6 }] },
    { id: "laplacian", name: "Лапласиан (Резкость)", controls: [{ id: "amount", label: "Усиление", min: 0.2, max: 2.5, step: 0.1, val: 1.0 }] }
  ],
  seg: [
    { id: "sobelMag", name: "Собель (Градиент)", controls: [] },
    { id: "sobelAngle", name: "Собель (Угол в HSV)", controls: [] },
    { id: "canny", name: "Детектор Кэнни", controls: [{ id: "sigma", label: "Сигма Гаусса", min: 0.8, max: 3.0, step: 0.2, val: 1.4 }, { id: "lowT", label: "Нижний порог", min: 10, max: 100, step: 5, val: 30 }, { id: "highT", label: "Верхний порог", min: 40, max: 220, step: 5, val: 85 }] }
  ],
  thresh: [
    { id: "otsu", name: "Метод Оцу", controls: [] },
    { id: "sauvola", name: "Метод Сауволы (через SAT)", controls: [{ id: "radius", label: "Радиус R", min: 5, max: 60, step: 2, val: 19 }, { id: "k", label: "Чувствительность k", min: 0.05, max: 0.6, step: 0.05, val: 0.2 }] }
  ],
  morph: [
    { id: "erode", name: "Эрозия", controls: [{ id: "shape", label: "Элемент", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск" }], val: "disk" }, { id: "radius", label: "Радиус R", min: 1, max: 6, step: 1, val: 2 }] },
    { id: "dilate", name: "Дилатация", controls: [{ id: "shape", label: "Элемент", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск" }], val: "disk" }, { id: "radius", label: "Радиус R", min: 1, max: 6, step: 1, val: 2 }] },
    { id: "gradient", name: "Морфологический Градиент", controls: [{ id: "shape", label: "Элемент", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск" }], val: "disk" }, { id: "radius", label: "Радиус R", min: 1, max: 5, step: 1, val: 1 }] },
    { id: "tophat", name: "Top-Hat", controls: [{ id: "shape", label: "Элемент", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск" }], val: "disk" }, { id: "radius", label: "Радиус R", min: 2, max: 8, step: 1, val: 5 }] }
  ]
};

class AppUI {
  constructor() {
    this.workerPool = new WorkerPool();
    this.srcBuffer = null;
    this.dstBuffer = null;
    this.originalPresetBuffer = null;

    this.srcCanvas = document.getElementById("srcCanvas");
    this.dstCanvas = document.getElementById("dstCanvas");
    this.srcHistCanvas = document.getElementById("srcHistCanvas");
    this.dstHistCanvas = document.getElementById("dstHistCanvas");

    this.initMethodsSelect();
    this.bindEvents();
    this.loadPreset("lowContrast");
  }

  initMethodsSelect() {
    const select = document.getElementById("methodSelect");
    select.innerHTML = "";
    for (const cat in METHODS_CONFIG) {
      const group = document.createElement("optgroup");
      group.label = CAT_NAMES[cat];
      METHODS_CONFIG[cat].forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
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
      this.renderMethodControls();
      this.executeCurrentMethod();
    });

    document.getElementById("paddingSelect").addEventListener("change", () => this.executeCurrentMethod());
    document.getElementById("useWorkersCheck").addEventListener("change", () => this.executeCurrentMethod());
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
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          this.originalPresetBuffer = new PixelBuffer(w, h, c.getContext("2d").getImageData(0, 0, w, h).data);
          this.srcBuffer = this.originalPresetBuffer.clone();
          this.renderBufferToCanvas(this.srcBuffer, this.srcCanvas);
          this.executeCurrentMethod();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("downloadBtn").addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = "processed_image_lab3.png";
      link.href = this.dstCanvas.toDataURL("image/png");
      link.click();
    });
  }

  loadPreset(presetName) {
    this.originalPresetBuffer = PresetGenerator.create(presetName);
    this.srcBuffer = this.originalPresetBuffer.clone();
    this.renderBufferToCanvas(this.srcBuffer, this.srcCanvas);

    const select = document.getElementById("methodSelect");
    if (presetName === "lowContrast") select.value = "clahe";
    else if (presetName === "saltPepper") select.value = "median";
    else if (presetName === "unevenText") select.value = "sauvola";
    else if (presetName === "edgesShapes") select.value = "sobelAngle";
    else if (presetName === "morphology") select.value = "tophat";
    else if (presetName === "colorCast") select.value = "equalizeHSV";
    
    this.renderMethodControls();
    this.executeCurrentMethod();
  }

  getCurrentMethodConfig() {
    const id = document.getElementById("methodSelect").value;
    for (const cat in METHODS_CONFIG) {
      const found = METHODS_CONFIG[cat].find(m => m.id === id);
      if (found) return found;
    }
    return null;
  }

  renderMethodControls() {
    const cfg = this.getCurrentMethodConfig();
    const container = document.getElementById("dynamicControls");
    container.innerHTML = "";

    if (!cfg.controls || cfg.controls.length === 0) {
      container.innerHTML = `<div style="font-size:13px; color:var(--text-muted);">Параметры не требуются.</div>`;
      return;
    }

    cfg.controls.forEach(ctrl => {
      const wrap = document.createElement("div");
      wrap.className = "control-group";
      if (ctrl.type === "select") {
        const lbl = document.createElement("label");
        lbl.textContent = ctrl.label;
        const sel = document.createElement("select");
        sel.className = "input-element";
        sel.id = `param_${ctrl.id}`;
        ctrl.options.forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.v;
          opt.textContent = o.l;
          sel.appendChild(opt);
        });
        sel.value = ctrl.val;
        sel.addEventListener("change", () => this.executeCurrentMethod());
        wrap.appendChild(lbl);
        wrap.appendChild(sel);
      } else {
        const lbl = document.createElement("label");
        const valSpan = document.createElement("span");
        valSpan.id = `val_${ctrl.id}`;
        valSpan.textContent = ctrl.val;
        lbl.innerHTML = `${ctrl.label}`;
        lbl.appendChild(valSpan);

        const inp = document.createElement("input");
        inp.type = "range";
        inp.id = `param_${ctrl.id}`;
        inp.min = ctrl.min;
        inp.max = ctrl.max;
        inp.step = ctrl.step;
        inp.value = ctrl.val;
        inp.addEventListener("input", () => { valSpan.textContent = inp.value; });
        inp.addEventListener("change", () => this.executeCurrentMethod());
        wrap.appendChild(lbl);
        wrap.appendChild(inp);
      }
      container.appendChild(wrap);
    });
  }

  readParams() {
    const cfg = this.getCurrentMethodConfig();
    const params = {};
    (cfg.controls || []).forEach(c => {
      const el = document.getElementById(`param_${c.id}`);
      if (el) params[c.id] = c.type === "select" ? el.value : parseFloat(el.value);
    });
    return params;
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
    for (let i = 1; i < 255; i++) maxVal = Math.max(maxVal, histData.histR[i], histData.histG[i], histData.histB[i], histData.histL[i]);

    const drawCurve = (arr, color, fill = false) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * w, h - Math.min(1, arr[i] / maxVal) * (h - 5));
      ctx.lineTo(w, h);
      if (fill) { ctx.fillStyle = color; ctx.fill(); } 
      else { ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke(); }
    };

    drawCurve(histData.histL, "rgba(223, 230, 233, 0.4)", true); 
    drawCurve(histData.histR, "#ff4757"); 
    drawCurve(histData.histG, "#2ed573"); 
    drawCurve(histData.histB, "#1e90ff"); 
    drawCurve(histData.histL, "#2d3436"); 
  }

  async executeCurrentMethod() {
    if (!this.srcBuffer) return;
    const cfg = this.getCurrentMethodConfig();
    const params = this.readParams();
    const padding = document.getElementById("paddingSelect").value;
    const useWorkers = document.getElementById("useWorkersCheck").checked;

    this.setProgress(15);
    const t0 = performance.now();
    let dst = null;

    if (cfg.id === "linearContrast") dst = ImageAlgorithms.linearContrast(this.srcBuffer);
    else if (cfg.id === "equalizeRGB") dst = ImageAlgorithms.equalizeRGB(this.srcBuffer);
    else if (cfg.id === "equalizeHSV") dst = ImageAlgorithms.equalizeHSV(this.srcBuffer);
    else if (cfg.id === "clahe") dst = ImageAlgorithms.claheHSV(this.srcBuffer, params.tileSize, params.clipLimit);
    else if (["gamma", "log", "invert"].includes(cfg.id)) dst = ImageAlgorithms.elementwiseOp(this.srcBuffer, cfg.id, params.gamma, params.gain);
    else if (["median", "min", "max", "midpoint", "alphaTrim"].includes(cfg.id)) {
      dst = await this.workerPool.runParallel("orderStat", this.srcBuffer, { radius: params.radius, statType: cfg.id, alpha: params.alpha }, padding, useWorkers ? p => this.setProgress(p) : null);
    } else if (cfg.id === "gaussSeparable") dst = ImageAlgorithms.separableConvolution(this.srcBuffer, ImageAlgorithms.buildGaussianKernel1D(params.radius, params.sigma), padding);
    else if (cfg.id === "boxSeparable") dst = ImageAlgorithms.separableConvolution(this.srcBuffer, ImageAlgorithms.buildBoxKernel1D(params.radius), padding);
    else if (cfg.id === "unsharp") dst = ImageAlgorithms.unsharpMask(this.srcBuffer, params.radius, 1.4, params.amount, padding);
    else if (cfg.id === "laplacian") dst = ImageAlgorithms.sharpenLaplacian(this.srcBuffer, params.amount, padding);
    else if (cfg.id === "sobelMag") dst = ImageAlgorithms.sobelOperator(this.srcBuffer, false, padding);
    else if (cfg.id === "sobelAngle") dst = ImageAlgorithms.sobelOperator(this.srcBuffer, true, padding);
    else if (cfg.id === "canny") dst = ImageAlgorithms.cannySubpixel(this.srcBuffer, params.lowT, params.highT, params.sigma, padding);
    else if (cfg.id === "otsu") dst = ImageAlgorithms.thresholdOtsu(this.srcBuffer);
    else if (cfg.id === "isodata") dst = ImageAlgorithms.thresholdIsodata(this.srcBuffer);
    else if (["sauvola", "niblack", "adaptiveLecture"].includes(cfg.id)) dst = ImageAlgorithms.thresholdLocalSAT(this.srcBuffer, cfg.id, params.radius, params.k, params.C);
    else if (["erode", "dilate", "open", "close", "gradient", "tophat", "blackhat"].includes(cfg.id)) {
      dst = await ImageAlgorithms.morphologyOperation(this.srcBuffer, cfg.id, params.shape, params.radius, padding, this.workerPool, useWorkers, p => this.setProgress(p));
    }

    const elapsed = (performance.now() - t0).toFixed(1);
    this.setProgress(100);
    setTimeout(() => this.setProgress(0), 250);

    this.dstBuffer = dst;
    this.renderBufferToCanvas(dst, this.dstCanvas);

    document.getElementById("perfInfo").textContent = `${elapsed} мс`;
    document.getElementById("srcMeta").textContent = `${this.srcBuffer.width} × ${this.srcBuffer.height} px`;

    const srcH = ImageAlgorithms.computeHistograms(this.srcBuffer);
    const dstH = ImageAlgorithms.computeHistograms(this.dstBuffer);
    this.drawHistogram(srcH, this.srcHistCanvas);
    this.drawHistogram(dstH, this.dstHistCanvas);

    document.getElementById("srcStats").innerHTML = `<span>Яркость: ${srcH.mean.toFixed(1)}</span><span>СКО (Контраст): ${srcH.std.toFixed(1)}</span>`;
    document.getElementById("dstStats").innerHTML = `<span>Яркость: ${dstH.mean.toFixed(1)}</span><span>СКО (Контраст): ${dstH.std.toFixed(1)}</span>`;
  }
}

window.addEventListener("DOMContentLoaded", () => new AppUI());
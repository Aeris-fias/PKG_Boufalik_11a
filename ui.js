const CAT_NAMES = {
  hist: "Гистограммы и Контраст",
  order: "Порядковые статистики",
  conv: "НЧ / ВЧ Свертки",
  seg: "Сегментация / Кэнни",
  thresh: "Пороговая обработка",
  morph: "Морфология"
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
      container.innerHTML = `<div style="font-size:13px; color:#636e72;">Автоматический расчет (параметры не требуются)</div>`;
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
    const h = canvas.height = 120;
    ctx.clearRect(0, 0, w, h);

    let maxVal = 1;
    for (let i = 1; i < 255; i++) maxVal = Math.max(maxVal, histData.histR[i], histData.histG[i], histData.histB[i], histData.histL[i]);

    const drawCurve = (arr, color, fill = false) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * w, h - Math.min(1, arr[i] / maxVal) * (h - 5));
      ctx.lineTo(w, h);
      if (fill) { ctx.fillStyle = color; ctx.fill(); } 
      else { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
    };

    drawCurve(histData.histL, "rgba(223, 230, 233, 0.5)", true); // Фон Luma
    drawCurve(histData.histR, "#ff4757"); // Яркий красный
    drawCurve(histData.histG, "#2ed573"); // Яркий зеленый
    drawCurve(histData.histB, "#1e90ff"); // Яркий синий
    drawCurve(histData.histL, "#2d3436"); // Темно-серый контур яркости
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

    document.getElementById("srcStats").innerHTML = `<span>Яркость: ${srcH.mean.toFixed(1)}</span><span>Контраст: ${srcH.std.toFixed(1)}</span>`;
    document.getElementById("dstStats").innerHTML = `<span>Яркость: ${dstH.mean.toFixed(1)}</span><span>Контраст: ${dstH.std.toFixed(1)}</span>`;

    document.getElementById("reportBody").innerHTML = `
      <p><b>Описание:</b> ${cfg.desc}</p>
      <p style="margin-top:8px;"><b>Сложность алгоритма:</b> ${cfg.complexity} (Потоков: ${useWorkers ? this.workerPool.numWorkers : 1})</p>
      <p><b>Изменение энтропии (детализация):</b> ${srcH.entropy.toFixed(2)} → ${dstH.entropy.toFixed(2)} бит</p>
    `;
  }
}

window.addEventListener("DOMContentLoaded", () => new AppUI());
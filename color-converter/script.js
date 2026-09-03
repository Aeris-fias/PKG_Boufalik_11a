const Model = {
  illuminants: {
    D65: { x: 0.3127, y: 0.3290 },
    D50: { x: 0.3457, y: 0.3585 },
    E:   { x: 1/3,    y: 1/3 }
  },

  sRGB_xy: {
    r: { x: 0.6400, y: 0.3300 },
    g: { x: 0.3000, y: 0.6000 },
    b: { x: 0.1500, y: 0.0600 }
  },

  invertMatrix3x3(m) {
    const det =
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    if (Math.abs(det) < 1e-10) return null;
    const invdet = 1 / det;

    return [
      [
        (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invdet,
        (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invdet,
        (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invdet
      ],
      [
        (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invdet,
        (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invdet,
        (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invdet
      ],
      [
        (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invdet,
        (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invdet,
        (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invdet
      ]
    ];
  },

  multiplyMatrixVector(m, v) {
    return [
      m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
      m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
      m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
    ];
  },

  getWhitePoint(illuminantKey) {
    const white = this.illuminants[illuminantKey] || this.illuminants.D65;
    return {
      X: (white.x / white.y) * 100,
      Y: 100.0,
      Z: ((1 - white.x - white.y) / white.y) * 100
    };
  },

  getMatrices(illuminantKey) {
    const W = this.getWhitePoint(illuminantKey);
    const P = this.sRGB_xy;

    const Xr = P.r.x / P.r.y, Yr = 1, Zr = (1 - P.r.x - P.r.y) / P.r.y;
    const Xg = P.g.x / P.g.y, Yg = 1, Zg = (1 - P.g.x - P.g.y) / P.g.y;
    const Xb = P.b.x / P.b.y, Yb = 1, Zb = (1 - P.b.x - P.b.y) / P.b.y;

    const M_prim = [
      [Xr, Xg, Xb],
      [Yr, Yg, Yb],
      [Zr, Zg, Zb]
    ];

    const M_prim_inv = this.invertMatrix3x3(M_prim);
    const S = this.multiplyMatrixVector(M_prim_inv, [W.X / 100, W.Y / 100, W.Z / 100]);

    const rgbToXyzMat = [
      [S[0] * Xr, S[1] * Xg, S[2] * Xb],
      [S[0] * Yr, S[1] * Yg, S[2] * Yb],
      [S[0] * Zr, S[1] * Zg, S[2] * Zb]
    ];

    const xyzToRgbMat = this.invertMatrix3x3(rgbToXyzMat);

    return { rgbToXyzMat, xyzToRgbMat, W };
  },

  handleGamut(r, g, b, strategy) {
    let outOfGamut = r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255;
    let r_ = r, g_ = g, b_ = b;

    if (strategy === 'scaling' && outOfGamut) {
      const minVal = Math.min(r, g, b, 0);
      if (minVal < 0) {
        r_ -= minVal;
        g_ -= minVal;
        b_ -= minVal;
      }
      const maxVal = Math.max(r_, g_, b_);
      if (maxVal > 255) {
        const factor = 255 / maxVal;
        r_ *= factor;
        g_ *= factor;
        b_ *= factor;
      }
    }

    return {
      r: Math.min(255, Math.max(0, Math.round(r_))),
      g: Math.min(255, Math.max(0, Math.round(g_))),
      b: Math.min(255, Math.max(0, Math.round(b_))),
      outOfGamut
    };
  },

  rgbToCmyk(r, g, b, mode = 'UCR') {
    let r_ = r / 255, g_ = g / 255, b_ = b / 255;
    let c = 1 - r_, m = 1 - g_, y = 1 - b_;
    let k = Math.min(c, m, y);

    if (mode === 'UCR') {
      const kFactor = 0.5;
      k = k * kFactor;
      c = Math.max(0, c - k);
      m = Math.max(0, m - k);
      y = Math.max(0, y - k);
    } else if (mode === 'GCR') {
      c = Math.max(0, c - k);
      m = Math.max(0, m - k);
      y = Math.max(0, y - k);
    }

    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100)
    };
  },

  cmykToRgb(c, m, y, k, strategy = 'clipping') {
    let c_ = c / 100, m_ = m / 100, y_ = y / 100, k_ = k / 100;
    let r = 255 * (1 - c_) * (1 - k_);
    let g = 255 * (1 - m_) * (1 - k_);
    let b = 255 * (1 - y_) * (1 - k_);
    return this.handleGamut(r, g, b, strategy);
  },

  rgbToHsv(r, g, b) {
    let r_ = r / 255, g_ = g / 255, b_ = b / 255;
    let max = Math.max(r_, g_, b_), min = Math.min(r_, g_, b_);
    let d = max - min;
    let h = 0;
    let s = max === 0 ? 0 : d / max;
    let v = max;

    if (max !== min) {
      switch (max) {
        case r_: h = (g_ - b_) / d + (g_ < b_ ? 6 : 0); break;
        case g_: h = (b_ - r_) / d + 2; break;
        case b_: h = (r_ - g_) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
  },

  hsvToRgb(h, s, v, strategy = 'clipping') {
    let h_ = h / 360, s_ = s / 100, v_ = v / 100;
    let r, g, b;
    let i = Math.floor(h_ * 6);
    let f = h_ * 6 - i;
    let p = v_ * (1 - s_);
    let q = v_ * (1 - f * s_);
    let t = v_ * (1 - (1 - f) * s_);

    switch (i % 6) {
      case 0: r = v_; g = t; b = p; break;
      case 1: r = q; g = v_; b = p; break;
      case 2: r = p; g = v_; b = t; break;
      case 3: r = p; g = q; b = v_; break;
      case 4: r = t; g = p; b = v_; break;
      case 5: r = v_; g = p; b = q; break;
    }
    return this.handleGamut(r * 255, g * 255, b * 255, strategy);
  },

  rgbToLab(r, g, b, illuminantKey = 'D65') {
    const { rgbToXyzMat, W } = this.getMatrices(illuminantKey);
    let r_ = r / 255, g_ = g / 255, b_ = b / 255;

    r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
    g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
    b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;

    const [x, y, z] = this.multiplyMatrixVector(rgbToXyzMat, [r_ * 100, g_ * 100, b_ * 100]);

    let x_ = x / W.X, y_ = y / W.Y, z_ = z / W.Z;
    let f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);

    let L = (116 * f(y_)) - 16;
    let a = 500 * (f(x_) - f(y_));
    let b_val = 200 * (f(y_) - f(z_));

    return { L: Math.round(L), a: Math.round(a), b: Math.round(b_val) };
  },

  labToRgb(L, a, b, illuminantKey = 'D65', strategy = 'clipping') {
    const { xyzToRgbMat, W } = this.getMatrices(illuminantKey);

    let fy = (L + 16) / 116;
    let fx = a / 500 + fy;
    let fz = fy - b / 200;

    let delta = 6 / 29;
    let x = fx > delta ? W.X * Math.pow(fx, 3) : (fx - 16 / 116) * 3 * Math.pow(delta, 2) * W.X;
    let y = fy > delta ? W.Y * Math.pow(fy, 3) : (fy - 16 / 116) * 3 * Math.pow(delta, 2) * W.Y;
    let z = fz > delta ? W.Z * Math.pow(fz, 3) : (fz - 16 / 116) * 3 * Math.pow(delta, 2) * W.Z;

    const [r_lin, g_lin, b_lin] = this.multiplyMatrixVector(xyzToRgbMat, [x / 100, y / 100, z / 100]);

    let f = t => t > 0.0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - 0.055 : 12.92 * t;

    return this.handleGamut(f(r_lin) * 255, f(g_lin) * 255, f(b_lin) * 255, strategy);
  }
};

const View = {
  elements: {
    illuminant: document.getElementById('illuminant'),
    cmykMode: document.getElementById('cmykMode'),
    gamutStrategy: document.getElementById('gamutStrategy'),
    nativePicker: document.getElementById('nativePicker'),
    colorPreview: document.getElementById('colorPreview'),
    warning: document.getElementById('warning'),
    testResults: document.getElementById('testResults'),
    runTestsBtn: document.getElementById('runTestsBtn')
  },

  getControlValues(key) {
    return parseFloat(document.getElementById(`input${key}`).value) || 0;
  },

  setControlValues(key, val) {
    document.getElementById(`input${key}`).value = val;
    document.getElementById(`range${key}`).value = val;
  },

  updateModelCard(keys, values, sourceModel, cardName) {
    if (sourceModel === cardName) return;
    keys.forEach((k, idx) => this.setControlValues(k, values[idx]));
  },

  updatePreview(rgb) {
    const hex = `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
    this.elements.colorPreview.style.backgroundColor = hex;
    this.elements.nativePicker.value = hex;
  },

  setWarning(show) {
    if (show) this.elements.warning.classList.remove('hidden');
    else this.elements.warning.classList.add('hidden');
  },

  updateSliderGradients(rgb, illuminant, cmykMode, gamutStrategy) {
    ['C', 'M', 'Y', 'K'].forEach(k => {
      const c = this.getControlValues('C');
      const m = this.getControlValues('M');
      const y = this.getControlValues('Y');
      const kVal = this.getControlValues('K');
      
      const getRgbForVal = v => {
        let vals = { C: c, M: m, Y: y, K: kVal };
        vals[k] = v;
        return Model.cmykToRgb(vals.C, vals.M, vals.Y, vals.K, gamutStrategy);
      };

      const rgb0 = getRgbForVal(0);
      const rgb100 = getRgbForVal(100);
      document.getElementById(`range${k}`).style.background = 
        `linear-gradient(to right, rgb(${rgb0.r},${rgb0.g},${rgb0.b}), rgb(${rgb100.r},${rgb100.g},${rgb100.b}))`;
    });

    const l = this.getControlValues('L');
    const a = this.getControlValues('A');
    const b = this.getControlValues('B');

    const labRgb0 = Model.labToRgb(0, a, b, illuminant, gamutStrategy);
    const labRgb100 = Model.labToRgb(100, a, b, illuminant, gamutStrategy);
    document.getElementById('rangeL').style.background = 
      `linear-gradient(to right, rgb(${labRgb0.r},${labRgb0.g},${labRgb0.b}), rgb(${labRgb100.r},${labRgb100.g},${labRgb100.b}))`;

    const labRgbA0 = Model.labToRgb(l, -128, b, illuminant, gamutStrategy);
    const labRgbA100 = Model.labToRgb(l, 127, b, illuminant, gamutStrategy);
    document.getElementById('rangeA').style.background = 
      `linear-gradient(to right, rgb(${labRgbA0.r},${labRgbA0.g},${labRgbA0.b}), rgb(${labRgbA100.r},${labRgbA100.g},${labRgbA100.b}))`;

    const labRgbB0 = Model.labToRgb(l, a, -128, illuminant, gamutStrategy);
    const labRgbB100 = Model.labToRgb(l, a, 127, illuminant, gamutStrategy);
    document.getElementById('rangeB').style.background = 
      `linear-gradient(to right, rgb(${labRgbB0.r},${labRgbB0.g},${labRgbB0.b}), rgb(${labRgbB100.r},${labRgbB100.g},${labRgbB100.b}))`;

    const h = this.getControlValues('H');
    const s = this.getControlValues('S');
    const v = this.getControlValues('V');

    document.getElementById('rangeH').style.background = 
      `linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`;

    const hsvS0 = Model.hsvToRgb(h, 0, v, gamutStrategy);
    const hsvS100 = Model.hsvToRgb(h, 100, v, gamutStrategy);
    document.getElementById('rangeS').style.background = 
      `linear-gradient(to right, rgb(${hsvS0.r},${hsvS0.g},${hsvS0.b}), rgb(${hsvS100.r},${hsvS100.g},${hsvS100.b}))`;

    const hsvV0 = Model.hsvToRgb(h, s, 0, gamutStrategy);
    const hsvV100 = Model.hsvToRgb(h, s, 100, gamutStrategy);
    document.getElementById('rangeV').style.background = 
      `linear-gradient(to right, rgb(${hsvV0.r},${hsvV0.g},${hsvV0.b}), rgb(${hsvV100.r},${hsvV100.g},${hsvV100.b}))`;
  }
};

const ViewModel = {
  currentRgb: { r: 255, g: 0, b: 0 },
  lastSource: 'INIT',

  init() {
    this.bindEvents();
    this.updateAll('INIT');
  },

  getIlluminant() {
    return View.elements.illuminant.value;
  },

  getCmykMode() {
    return View.elements.cmykMode.value;
  },

  getGamutStrategy() {
    return View.elements.gamutStrategy.value;
  },

  updateAll(sourceModel) {
    this.lastSource = sourceModel;
    const illuminant = this.getIlluminant();
    const cmykMode = this.getCmykMode();
    const gamutStrategy = this.getGamutStrategy();

    const cmyk = Model.rgbToCmyk(this.currentRgb.r, this.currentRgb.g, this.currentRgb.b, cmykMode);
    const lab = Model.rgbToLab(this.currentRgb.r, this.currentRgb.g, this.currentRgb.b, illuminant);
    const hsv = Model.rgbToHsv(this.currentRgb.r, this.currentRgb.g, this.currentRgb.b);

    View.updateModelCard(['C', 'M', 'Y', 'K'], [cmyk.c, cmyk.m, cmyk.y, cmyk.k], sourceModel, 'CMYK');
    View.updateModelCard(['L', 'A', 'B'], [lab.L, lab.a, lab.b], sourceModel, 'LAB');
    View.updateModelCard(['H', 'S', 'V'], [hsv.h, hsv.s, hsv.v], sourceModel, 'HSV');

    View.updatePreview(this.currentRgb);
    View.setWarning(this.currentRgb.outOfGamut);
    View.updateSliderGradients(this.currentRgb, illuminant, cmykMode, gamutStrategy);
  },

  bindEvents() {
    const bindGroup = (keys, modelName, convertFn) => {
      keys.forEach(k => {
        const inp = document.getElementById(`input${k}`);
        const rng = document.getElementById(`range${k}`);
        
        const handler = (val) => {
          View.setControlValues(k, val);
          const vals = keys.map(key => View.getControlValues(key));
          this.currentRgb = convertFn(...vals);
          this.updateAll(modelName);
        };

        inp.addEventListener('input', e => handler(e.target.value));
        rng.addEventListener('input', e => handler(e.target.value));
      });
    };

    bindGroup(['C', 'M', 'Y', 'K'], 'CMYK', (c, m, y, k) => 
      Model.cmykToRgb(c, m, y, k, this.getGamutStrategy())
    );

    bindGroup(['L', 'A', 'B'], 'LAB', (l, a, b) => 
      Model.labToRgb(l, a, b, this.getIlluminant(), this.getGamutStrategy())
    );

    bindGroup(['H', 'S', 'V'], 'HSV', (h, s, v) => 
      Model.hsvToRgb(h, s, v, this.getGamutStrategy())
    );

    View.elements.nativePicker.addEventListener('input', e => {
      const hex = e.target.value;
      this.currentRgb = {
        r: parseInt(hex.substr(1, 2), 16),
        g: parseInt(hex.substr(3, 2), 16),
        b: parseInt(hex.substr(5, 2), 16),
        outOfGamut: false
      };
      this.updateAll('PICKER');
    });

    ['illuminant', 'cmykMode', 'gamutStrategy'].forEach(id => {
      View.elements[id].addEventListener('change', () => this.updateAll(this.lastSource));
    });

    View.elements.runTestsBtn.addEventListener('click', () => Tests.run());
  }
};

const Tests = {
  run() {
    let log = [];
    const assert = (condition, msg) => {
      log.push((condition ? "✅ PASS: " : "❌ FAIL: ") + msg);
    };

    // Test 1: RGB(255, 0, 0) -> LAB (D65)
    const labRed = Model.rgbToLab(255, 0, 0, 'D65');
    assert(Math.abs(labRed.L - 53) <= 2 && Math.abs(labRed.a - 80) <= 2 && Math.abs(labRed.b - 67) <= 2, 
      `RGB(255,0,0) -> LAB D65 expected L~53 a~80 b~67, got L:${labRed.L} a:${labRed.a} b:${labRed.b}`);

    // Test 2: RGB(255, 0, 0) -> CMYK (GCR)
    const cmykRedGCR = Model.rgbToCmyk(255, 0, 0, 'GCR');
    assert(cmykRedGCR.c === 0 && cmykRedGCR.m === 100 && cmykRedGCR.y === 100 && cmykRedGCR.k === 0, 
      `RGB(255,0,0) -> CMYK GCR expected C:0 M:100 Y:100 K:0, got C:${cmykRedGCR.c} M:${cmykRedGCR.m} Y:${cmykRedGCR.y} K:${cmykRedGCR.k}`);

    // Test 3: RGB(0, 0, 0) -> CMYK (UCR vs GCR)
    const cmykBlackUCR = Model.rgbToCmyk(0, 0, 0, 'UCR');
    assert(cmykBlackUCR.k === 50, `RGB(0,0,0) -> CMYK UCR expected K:50, got K:${cmykBlackUCR.k}`);

    // Test 4: Dynamic Matrix generation for D50
    const matsD50 = Model.getMatrices('D50');
    assert(Math.abs(matsD50.W.X - 96.43) < 0.1 && Math.abs(matsD50.W.Z - 82.51) < 0.1, 
      `D50 White Point expected X~96.43 Z~82.51, got X:${matsD50.W.X.toFixed(2)} Z:${matsD50.W.Z.toFixed(2)}`);

    // Test 5: Gamut Clipping
    const clipped = Model.handleGamut(300, -20, 150, 'clipping');
    assert(clipped.r === 255 && clipped.g === 0 && clipped.b === 150 && clipped.outOfGamut, 
      `Clipping (300, -20, 150) expected (255, 0, 150) flag:true, got (${clipped.r}, ${clipped.g}, ${clipped.b}) flag:${clipped.outOfGamut}`);

    // Test 6: Gamut Scaling
    const scaled = Model.handleGamut(300, 0, 0, 'scaling');
    assert(scaled.r === 255 && scaled.g === 0 && scaled.b === 0 && scaled.outOfGamut, 
      `Scaling (300, 0, 0) expected (255, 0, 0) flag:true, got (${scaled.r}, ${scaled.g}, ${scaled.b}) flag:${scaled.outOfGamut}`);

    View.elements.testResults.textContent = log.join('\n');
  }
};

document.addEventListener('DOMContentLoaded', () => ViewModel.init());
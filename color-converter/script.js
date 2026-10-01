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
    const det = m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    if (Math.abs(det) < 1e-10) return null;
    const invdet = 1 / det;
    return [
      [(m[1][1]*m[2][2]-m[1][2]*m[2][1])*invdet, (m[0][2]*m[2][1]-m[0][1]*m[2][2])*invdet, (m[0][1]*m[1][2]-m[0][2]*m[1][1])*invdet],
      [(m[1][2]*m[2][0]-m[1][0]*m[2][2])*invdet, (m[0][0]*m[2][2]-m[0][2]*m[2][0])*invdet, (m[0][2]*m[1][0]-m[0][0]*m[1][2])*invdet],
      [(m[1][0]*m[2][1]-m[1][1]*m[2][0])*invdet, (m[0][1]*m[2][0]-m[0][0]*m[2][1])*invdet, (m[0][0]*m[1][1]-m[0][1]*m[1][0])*invdet]
    ];
  },
  multiplyMatrixVector(m, v) {
    return [
      m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2],
      m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2],
      m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2]
    ];
  },
  getMatrices(illuminantKey) {
    const white = this.illuminants[illuminantKey] || this.illuminants.D65;
    const W = { X: (white.x/white.y)*100, Y: 100.0, Z: ((1-white.x-white.y)/white.y)*100 };
    const P = this.sRGB_xy;
    const M_prim = [
      [P.r.x/P.r.y, P.g.x/P.g.y, P.b.x/P.b.y],
      [1, 1, 1],
      [(1-P.r.x-P.r.y)/P.r.y, (1-P.g.x-P.g.y)/P.g.y, (1-P.b.x-P.b.y)/P.b.y]
    ];
    const S = this.multiplyMatrixVector(this.invertMatrix3x3(M_prim), [W.X/100, W.Y/100, W.Z/100]);
    const fXyzMat = [
      [S[0]*M_prim[0][0], S[1]*M_prim[0][1], S[2]*M_prim[0][2]],
      [S[0]*M_prim[1][0], S[1]*M_prim[1][1], S[2]*M_prim[1][2]],
      [S[0]*M_prim[2][0], S[1]*M_prim[2][1], S[2]*M_prim[2][2]]
    ];
    return { fXyzMat, invXyzMat: this.invertMatrix3x3(fXyzMat), W };
  },
  _applyGamut(c1, c2, c3, strategy) {
    let outOfGamut = c1 < 0 || c1 > 255 || c2 < 0 || c2 > 255 || c3 < 0 || c3 > 255;
    if (strategy === 'scaling' && outOfGamut) {
      let minVal = Math.min(c1, c2, c3, 0);
      c1 -= minVal; c2 -= minVal; c3 -= minVal;
      let maxVal = Math.max(c1, c2, c3);
      if (maxVal > 255) { let f = 255 / maxVal; c1 *= f; c2 *= f; c3 *= f; }
    }
    return [Math.min(255, Math.max(0, c1)), Math.min(255, Math.max(0, c2)), Math.min(255, Math.max(0, c3)), outOfGamut];
  },
  _hex(c1, c2, c3) {
    let r = Math.round(c1) || 0;
    let g = Math.round(c2) || 0;
    let b = Math.round(c3) || 0;
    return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1).toUpperCase()}`;
  },

  cmykToHsv(c, m, y, k) {
    let r = (1 - c/100)*(1 - k/100), g = (1 - m/100)*(1 - k/100), b = (1 - y/100)*(1 - k/100);
    let max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h*360), s: Math.round(s*100), v: Math.round(v*100), outOfGamut: false };
  },
  cmykToLab(c, m, y, k, illuminantKey) {
    let r = (1 - c/100)*(1 - k/100), g = (1 - m/100)*(1 - k/100), b = (1 - y/100)*(1 - k/100);
    r = r > 0.04045 ? Math.pow((r + 0.055)/1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055)/1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055)/1.055, 2.4) : b / 12.92;
    const { fXyzMat, W } = this.getMatrices(illuminantKey);
    const [X, Y, Z] = this.multiplyMatrixVector(fXyzMat, [r*100, g*100, b*100]);
    let f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t) + (16/116);
    return { 
      L: Math.round((116 * f(Y/W.Y)) - 16), 
      a: Math.round(500 * (f(X/W.X) - f(Y/W.Y))), 
      b: Math.round(200 * (f(Y/W.Y) - f(Z/W.Z))),
      outOfGamut: false 
    };
  },
  cmykToHex(c, m, y, k) {
    return this._hex(255*(1 - c/100)*(1 - k/100), 255*(1 - m/100)*(1 - k/100), 255*(1 - y/100)*(1 - k/100));
  },

  hsvToCmyk(h, s, v, mode) {
    let h_ = h/360, s_ = s/100, v_ = v/100, i = Math.floor(h_ * 6), f = h_ * 6 - i;
    let p = v_*(1 - s_), q = v_*(1 - f*s_), t = v_*(1 - (1 - f)*s_);
    let r, g, b;
    switch(i % 6) { case 0: r=v_; g=t; b=p; break; case 1: r=q; g=v_; b=p; break; case 2: r=p; g=v_; b=t; break;
                    case 3: r=p; g=q; b=v_; break; case 4: r=t; g=p; b=v_; break; case 5: r=v_; g=p; b=q; break; }
    let c = 1 - r, m = 1 - g, y = 1 - b, k = Math.min(c, m, y);
    if (mode === 'UCR') { k *= 0.5; c = Math.max(0, c-k); m = Math.max(0, m-k); y = Math.max(0, y-k); }
    else if (mode === 'GCR') { c = Math.max(0, c-k); m = Math.max(0, m-k); y = Math.max(0, y-k); }
    return { c: Math.round(c*100), m: Math.round(m*100), y: Math.round(y*100), k: Math.round(k*100), outOfGamut: false };
  },
  hsvToLab(h, s, v, illuminantKey) {
    let cmyk = this.hsvToCmyk(h, s, v, 'UCR'); 
    return this.cmykToLab(cmyk.c, cmyk.m, cmyk.y, cmyk.k, illuminantKey);
  },
  hsvToHex(h, s, v) {
    let h_ = h/360, s_ = s/100, v_ = v/100, i = Math.floor(h_ * 6), f = h_ * 6 - i;
    let p = v_*(1 - s_), q = v_*(1 - f*s_), t = v_*(1 - (1 - f)*s_), r, g, b;
    switch(i % 6) { case 0: r=v_; g=t; b=p; break; case 1: r=q; g=v_; b=p; break; case 2: r=p; g=v_; b=t; break;
                    case 3: r=p; g=q; b=v_; break; case 4: r=t; g=p; b=v_; break; case 5: r=v_; g=p; b=q; break; }
    return this._hex(r*255, g*255, b*255);
  },

  _labToBaseSignals(L, a, b_val, illuminantKey, strategy) {
    const { invXyzMat, W } = this.getMatrices(illuminantKey);
    let fy = (L + 16)/116, fx = a/500 + fy, fz = fy - b_val/200, delta = 6/29;
    let x = fx > delta ? W.X*Math.pow(fx, 3) : (fx - 16/116)*3*Math.pow(delta, 2)*W.X;
    let y = fy > delta ? W.Y*Math.pow(fy, 3) : (fy - 16/116)*3*Math.pow(delta, 2)*W.Y;
    let z = fz > delta ? W.Z*Math.pow(fz, 3) : (fz - 16/116)*3*Math.pow(delta, 2)*W.Z;
    const [lin1, lin2, lin3] = this.multiplyMatrixVector(invXyzMat, [x/100, y/100, z/100]);
    let f = t => t > 0.0031308 ? 1.055*Math.pow(t, 1/2.4) - 0.055 : 12.92*t;
    return this._applyGamut(f(lin1)*255, f(lin2)*255, f(lin3)*255, strategy);
  },
  labToCmyk(L, a, b, illuminantKey, mode, strategy) {
    let [c1, c2, c3, outOfGamut] = this._labToBaseSignals(L, a, b, illuminantKey, strategy);
    let c_ = 1 - c1/255, m_ = 1 - c2/255, y_ = 1 - c3/255, k_ = Math.min(c_, m_, y_);
    if (mode === 'UCR') { k_ *= 0.5; c_ = Math.max(0, c_-k_); m_ = Math.max(0, m_-k_); y_ = Math.max(0, y_-k_); }
    else if (mode === 'GCR') { c_ = Math.max(0, c_-k_); m_ = Math.max(0, m_-k_); y_ = Math.max(0, y_-k_); }
    return { c: Math.round(c_*100), m: Math.round(m_*100), y: Math.round(y_*100), k: Math.round(k_*100), outOfGamut };
  },
  labToHsv(L, a, b, illuminantKey, strategy) {
    let [c1, c2, c3, outOfGamut] = this._labToBaseSignals(L, a, b, illuminantKey, strategy);
    let r = c1/255, g = c2/255, b_val = c3/255;
    let max = Math.max(r, g, b_val), min = Math.min(r, g, b_val), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
      if (max === r) h = (g - b_val) / d + (g < b_val ? 6 : 0);
      else if (max === g) h = (b_val - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h*360), s: Math.round(s*100), v: Math.round(v*100), outOfGamut };
  },
  labToHex(L, a, b, illuminantKey, strategy) {
    let [c1, c2, c3] = this._labToBaseSignals(L, a, b, illuminantKey, strategy);
    return this._hex(c1, c2, c3);
  },

  hexToCmyk(hex, mode) {
    let r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
    let c = 1 - r/255, m = 1 - g/255, y = 1 - b/255, k = Math.min(c, m, y);
    if (mode === 'UCR') { k *= 0.5; c = Math.max(0, c-k); m = Math.max(0, m-k); y = Math.max(0, y-k); }
    else if (mode === 'GCR') { c = Math.max(0, c-k); m = Math.max(0, m-k); y = Math.max(0, y-k); }
    return { c: Math.round(c*100), m: Math.round(m*100), y: Math.round(y*100), k: Math.round(k*100) };
  },
  hexToLab(hex, illuminantKey) {
    let r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
    return this.cmykToLab(...Object.values(this.hexToCmyk(hex, 'UCR')), illuminantKey);
  },
  hexToHsv(hex) {
    let r = parseInt(hex.substr(1,2),16)/255, g = parseInt(hex.substr(3,2),16)/255, b = parseInt(hex.substr(5,2),16)/255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h*360), s: Math.round(s*100), v: Math.round(v*100) };
  }
};

const View = {
  elements: {
    illuminant: document.getElementById('illuminant'),
    cmykMode: document.getElementById('cmykMode'),
    gamutStrategy: document.getElementById('gamutStrategy'),
    nativePicker: document.getElementById('nativePicker'),
    colorPreview: document.getElementById('colorPreview'),
    hexValue: document.getElementById('hexValue'),
    warning: document.getElementById('warning'),
    testResults: document.getElementById('testResults'),
    runTestsBtn: document.getElementById('runTestsBtn')
  },
  getControlValues(key) { return parseFloat(document.getElementById(`input${key}`).value) || 0; },
  setControlValues(key, val) {
    document.getElementById(`input${key}`).value = val;
    document.getElementById(`range${key}`).value = val;
  },
  updateModelCard(keys, values, sourceModel, cardName) {
    if (sourceModel === cardName) return;
    keys.forEach((k, idx) => this.setControlValues(k, values[idx]));
  },
  updatePreview(hex) {
    this.elements.colorPreview.style.backgroundColor = hex;
    this.elements.nativePicker.value = hex.toLowerCase();
    this.elements.hexValue.textContent = hex;
  },
  setWarning(show) {
    if (show) this.elements.warning.classList.remove('hidden');
    else this.elements.warning.classList.add('hidden');
  },
  updateSliderGradients(state, illuminant, cmykMode, gamutStrategy) {
    // Отрисовка градиентов для CMYK
    ['C', 'M', 'Y', 'K'].forEach(k => {
      let vals = { C: state.CMYK.c, M: state.CMYK.m, Y: state.CMYK.y, K: state.CMYK.k };
      const getHex = v => { vals[k] = v; return Model.cmykToHex(vals.C, vals.M, vals.Y, vals.K); };
      document.getElementById(`range${k}`).style.background = `linear-gradient(to right, ${getHex(0)}, ${getHex(100)})`;
    });
    
    // Отрисовка градиентов для LAB (Теперь используется большая буква L)
    const {L, a, b} = state.LAB;
    document.getElementById('rangeL').style.background = `linear-gradient(to right, ${Model.labToHex(0, a, b, illuminant, gamutStrategy)}, ${Model.labToHex(100, a, b, illuminant, gamutStrategy)})`;
    document.getElementById('rangeA').style.background = `linear-gradient(to right, ${Model.labToHex(L, -128, b, illuminant, gamutStrategy)}, ${Model.labToHex(L, 127, b, illuminant, gamutStrategy)})`;
    document.getElementById('rangeB').style.background = `linear-gradient(to right, ${Model.labToHex(L, a, -128, illuminant, gamutStrategy)}, ${Model.labToHex(L, a, 127, illuminant, gamutStrategy)})`;

    // Отрисовка градиентов для HSV
    const {h, s, v} = state.HSV;
    document.getElementById('rangeH').style.background = `linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`;
    document.getElementById('rangeS').style.background = `linear-gradient(to right, ${Model.hsvToHex(h, 0, v)}, ${Model.hsvToHex(h, 100, v)})`;
    document.getElementById('rangeV').style.background = `linear-gradient(to right, ${Model.hsvToHex(h, s, 0)}, ${Model.hsvToHex(h, s, 100)})`;
  }
};

const ViewModel = {
  state: {
    CMYK: { c: 0, m: 100, y: 100, k: 0 },
    LAB: { L: 53, a: 80, b: 67 },
    HSV: { h: 0, s: 100, v: 100 },
    HEX: '#FF0000',
    outOfGamut: false
  },
  lastSource: 'INIT',

  init() { this.bindEvents(); this.syncFromHEX('#FF0000', 'INIT'); },
  getIlluminant() { return View.elements.illuminant.value; },
  getCmykMode() { return View.elements.cmykMode.value; },
  getGamutStrategy() { return View.elements.gamutStrategy.value; },

  syncFromCMYK(sourceName) {
    this.lastSource = sourceName;
    const {c, m, y, k} = this.state.CMYK;
    this.state.HSV = Model.cmykToHsv(c, m, y, k);
    let labRes = Model.cmykToLab(c, m, y, k, this.getIlluminant());
    this.state.LAB = { L: labRes.L, a: labRes.a, b: labRes.b };
    this.state.HEX = Model.cmykToHex(c, m, y, k);
    this.state.outOfGamut = false;
    this.flushToView(sourceName);
  },
  syncFromHSV(sourceName) {
    this.lastSource = sourceName;
    const {h, s, v} = this.state.HSV;
    let cmykRes = Model.hsvToCmyk(h, s, v, this.getCmykMode());
    this.state.CMYK = { c: cmykRes.c, m: cmykRes.m, y: cmykRes.y, k: cmykRes.k };
    let labRes = Model.hsvToLab(h, s, v, this.getIlluminant());
    this.state.LAB = { L: labRes.L, a: labRes.a, b: labRes.b };
    this.state.HEX = Model.hsvToHex(h, s, v);
    this.state.outOfGamut = false;
    this.flushToView(sourceName);
  },
  syncFromLAB(sourceName) {
    this.lastSource = sourceName;
    const {L, a, b} = this.state.LAB;
    let cmykRes = Model.labToCmyk(L, a, b, this.getIlluminant(), this.getCmykMode(), this.getGamutStrategy());
    let hsvRes = Model.labToHsv(L, a, b, this.getIlluminant(), this.getGamutStrategy());
    this.state.CMYK = { c: cmykRes.c, m: cmykRes.m, y: cmykRes.y, k: cmykRes.k };
    this.state.HSV = { h: hsvRes.h, s: hsvRes.s, v: hsvRes.v };
    this.state.HEX = Model.labToHex(L, a, b, this.getIlluminant(), this.getGamutStrategy());
    this.state.outOfGamut = cmykRes.outOfGamut;
    this.flushToView(sourceName);
  },
  syncFromHEX(hex, sourceName) {
    this.lastSource = sourceName;
    this.state.HEX = hex.toUpperCase();
    this.state.CMYK = Model.hexToCmyk(hex, this.getCmykMode());
    this.state.LAB = Model.hexToLab(hex, this.getIlluminant());
    this.state.HSV = Model.hexToHsv(hex);
    this.state.outOfGamut = false;
    this.flushToView(sourceName);
  },

  flushToView(sourceModel) {
    View.updateModelCard(['C', 'M', 'Y', 'K'], [this.state.CMYK.c, this.state.CMYK.m, this.state.CMYK.y, this.state.CMYK.k], sourceModel, 'CMYK');
    View.updateModelCard(['L', 'A', 'B'], [this.state.LAB.L, this.state.LAB.a, this.state.LAB.b], sourceModel, 'LAB');
    View.updateModelCard(['H', 'S', 'V'], [this.state.HSV.h, this.state.HSV.s, this.state.HSV.v], sourceModel, 'HSV');
    View.updatePreview(this.state.HEX);
    View.setWarning(this.state.outOfGamut);
    View.updateSliderGradients(this.state, this.getIlluminant(), this.getCmykMode(), this.getGamutStrategy());
  },

  bindEvents() {
    const bindGroup = (keys, modelName, syncFn) => {
      keys.forEach(k => {
        const handler = (val) => {
          View.setControlValues(k, val);
          const vals = keys.map(key => View.getControlValues(key));
          if (modelName === 'CMYK') this.state.CMYK = {c: vals[0], m: vals[1], y: vals[2], k: vals[3]};
          if (modelName === 'LAB') this.state.LAB = {L: vals[0], a: vals[1], b: vals[2]};
          if (modelName === 'HSV') this.state.HSV = {h: vals[0], s: vals[1], v: vals[2]};
          syncFn.call(this, modelName);
        };
        document.getElementById(`input${k}`).addEventListener('input', e => handler(e.target.value));
        document.getElementById(`range${k}`).addEventListener('input', e => handler(e.target.value));
      });
    };

    bindGroup(['C', 'M', 'Y', 'K'], 'CMYK', this.syncFromCMYK);
    bindGroup(['L', 'A', 'B'], 'LAB', this.syncFromLAB);
    bindGroup(['H', 'S', 'V'], 'HSV', this.syncFromHSV);

    View.elements.nativePicker.addEventListener('input', e => this.syncFromHEX(e.target.value, 'PICKER'));

    ['illuminant', 'cmykMode', 'gamutStrategy'].forEach(id => {
      View.elements[id].addEventListener('change', () => {
        if (this.lastSource === 'CMYK') this.syncFromCMYK('CMYK');
        else if (this.lastSource === 'HSV') this.syncFromHSV('HSV');
        else if (this.lastSource === 'LAB') this.syncFromLAB('LAB');
        else this.syncFromHEX(this.state.HEX, 'PICKER');
      });
    });
    View.elements.runTestsBtn.addEventListener('click', () => Tests.run());
  }
};

const Tests = {
  run() {
    let log = []; const assert = (c, m) => log.push((c ? "✅ PASS: " : "❌ FAIL: ") + m);

    let labRed = Model.cmykToLab(0, 100, 100, 0, 'D65');
    assert(Math.abs(labRed.L-53)<=2 && Math.abs(labRed.a-80)<=2 && Math.abs(labRed.b-67)<=2, `CMYK(0,100,100,0) -> LAB D65 expected L~53 a~80 b~67, got L:${labRed.L} a:${labRed.a} b:${labRed.b}`);

    let cmykRes = Model.hsvToCmyk(0, 100, 100, 'GCR');
    assert(cmykRes.c===0 && cmykRes.m===100 && cmykRes.y===100 && cmykRes.k===0, `HSV(0,100,100) -> CMYK GCR expected C:0 M:100 Y:100 K:0, got C:${cmykRes.c} M:${cmykRes.m} Y:${cmykRes.y} K:${cmykRes.k}`);

    let matsD50 = Model.getMatrices('D50');
    assert(Math.abs(matsD50.W.X-96.43)<0.1 && Math.abs(matsD50.W.Z-82.51)<0.1, `D50 White Point X~96.43 Z~82.51, got X:${matsD50.W.X.toFixed(2)}`);

    let clip = Model.labToCmyk(300, -500, 500, 'D65', 'UCR', 'clipping');
    assert(clip.outOfGamut, `Direct LAB->CMYK clipping gamut trigger expected true, got ${clip.outOfGamut}`);

    View.elements.testResults.textContent = log.join('\n');
  }
};
document.addEventListener('DOMContentLoaded', () => ViewModel.init());
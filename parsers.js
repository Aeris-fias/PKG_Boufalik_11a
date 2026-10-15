async function readSlice(file, offset, length) {
  const safeOffset = Math.max(0, offset);
  const safeEnd = Math.min(file.size, safeOffset + length);
  if (safeEnd <= safeOffset) return new DataView(new ArrayBuffer(0));
  const buffer = await file.slice(safeOffset, safeEnd).arrayBuffer();
  return new DataView(buffer);
}

function getExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx !== -1 ? name.slice(idx + 1).toLowerCase() : '';
}

async function parseImageFile(file) {
  const ext = getExtension(file.name);
  const baseResult = {
    fileName: file.name,
    fileSize: file.size,
    detectedFormat: 'UNKNOWN',
    dimensions: '—',
    pixels: 0,
    dpi: '—',
    bitDepth: '—',
    bitDepthNum: 0,
    compression: '—',
    status: 'ok',
    statusText: 'OK (Валиден)'
  };

  if (file.size < 14) {
    baseResult.status = 'corrupted';
    baseResult.statusText = 'Файл поврежден (< 14 байт)';
    return baseResult;
  }

  const headerView = await readSlice(file, 0, 4096);
  const b0 = headerView.getUint8(0);
  const b1 = headerView.getUint8(1);
  const b2 = headerView.getUint8(2);
  const b3 = headerView.getUint8(3);

  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) {
    baseResult.detectedFormat = 'PNG';
    await parsePNG(file, headerView, baseResult);
  } else if (b0 === 0x42 && b1 === 0x4D) {
    baseResult.detectedFormat = 'BMP';
    await parseBMP(file, headerView, baseResult);
  } else if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38) {
    baseResult.detectedFormat = 'GIF';
    await parseGIF(file, headerView, baseResult);
  } else if (b0 === 0xFF && b1 === 0xD8) {
    baseResult.detectedFormat = 'JPEG';
    await parseJPEG(file, headerView, baseResult);
  } else if ((b0 === 0x49 && b1 === 0x49 && b2 === 0x2A && b3 === 0x00) ||
             (b0 === 0x4D && b1 === 0x4D && b2 === 0x00 && b3 === 0x2A)) {
    baseResult.detectedFormat = 'TIFF';
    await parseTIFF(file, headerView, baseResult);
  } else if (b0 === 0x0A && [0, 2, 3, 4, 5].includes(b1) && b2 <= 1) {
    baseResult.detectedFormat = 'PCX';
    await parsePCX(file, headerView, baseResult);
  } else {
    baseResult.status = 'corrupted';
    baseResult.statusText = 'Файл поврежден (неизвестная сигнатура)';
    return baseResult;
  }

  const extMap = {
    'jpg': 'JPEG', 'jpeg': 'JPEG',
    'png': 'PNG',
    'bmp': 'BMP',
    'gif': 'GIF',
    'tif': 'TIFF', 'tiff': 'TIFF',
    'pcx': 'PCX'
  };
  if (baseResult.status === 'ok' && extMap[ext] && extMap[ext] !== baseResult.detectedFormat) {
    baseResult.status = 'mismatch';
    baseResult.statusText = 'Подмена: .' + ext + ' -> внутри ' + baseResult.detectedFormat;
  }

  return baseResult;
}

async function parseBMP(file, view, res) {
  if (view.byteLength < 54) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (обрушен заголовок BMP)';
    return;
  }
  const declaredFileSize = view.getUint32(2, true);
  const dataOffset = view.getUint32(10, true);
  const biSize = view.getUint32(14, true);

  let width = 0, height = 0, bitCount = 0, compressionCode = 0;
  let xPelsPerMeter = 0, yPelsPerMeter = 0;

  if (biSize === 12) {
    width = view.getUint16(18, true);
    height = view.getUint16(20, true);
    bitCount = view.getUint16(24, true);
  } else {
    width = view.getInt32(18, true);
    height = Math.abs(view.getInt32(22, true));
    bitCount = view.getUint16(28, true);
    compressionCode = view.getUint32(30, true);
    xPelsPerMeter = view.getInt32(38, true);
    yPelsPerMeter = view.getInt32(42, true);
  }

  const compMap = {
    0: 'BI_RGB (Без сжатия)',
    1: 'BI_RLE8 (RLE 8-бит)',
    2: 'BI_RLE4 (RLE 4-бит)',
    3: 'BI_BITFIELDS',
    4: 'BI_JPEG',
    5: 'BI_PNG'
  };

  const dpiX = xPelsPerMeter > 0 ? Math.round(xPelsPerMeter * 0.0254) : 96;
  const dpiY = yPelsPerMeter > 0 ? Math.round(yPelsPerMeter * 0.0254) : 96;

  res.dimensions = width + ' × ' + height;
  res.pixels = width * height;
  res.dpi = dpiX + ' × ' + dpiY;
  res.bitDepth = bitCount + ' бит';
  res.bitDepthNum = bitCount;
  res.compression = compMap[compressionCode] || ('Код ' + compressionCode);

  if (width <= 0 || height <= 0 || file.size < dataOffset || (declaredFileSize > file.size && compressionCode === 0)) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (размер меньше заголовка BMP)';
  }
}

async function parsePNG(file, view, res) {
  if (view.byteLength < 33 || view.getUint32(4, false) !== 0x0D0A1A0A) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (нарушена сигнатура PNG)';
    return;
  }

  const ihdrType = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
  if (ihdrType !== 'IHDR') {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (нет чанка IHDR)';
    return;
  }

  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  const bitDepthPerChannel = view.getUint8(24);
  const colorType = view.getUint8(25);
  const compressionMethod = view.getUint8(26);
  const filterMethod = view.getUint8(27);

  const channelsMap = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsMap[colorType] || 1;
  const totalBitDepth = bitDepthPerChannel * channels;

  let dpiNote = '72 × 72';
  let offset = 8;
  while (offset + 8 <= view.byteLength) {
    const chunkLen = view.getUint32(offset, false);
    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
    if (type === 'pHYs' && offset + 17 <= view.byteLength) {
      const ppuX = view.getUint32(offset + 8, false);
      const ppuY = view.getUint32(offset + 12, false);
      const unit = view.getUint8(offset + 16);
      if (unit === 1) {
        dpiNote = Math.round(ppuX * 0.0254) + ' × ' + Math.round(ppuY * 0.0254);
      }
      break;
    } else if (type === 'IDAT' || type === 'IEND') {
      break;
    }
    offset += 12 + chunkLen;
  }

  res.dimensions = width + ' × ' + height;
  res.pixels = width * height;
  res.dpi = dpiNote;
  res.bitDepth = totalBitDepth + ' бит';
  res.bitDepthNum = totalBitDepth;
  res.compression = compressionMethod === 0 ? ('Deflate (Фильтр ' + filterMethod + ')') : ('Код ' + compressionMethod);

  const tailView = await readSlice(file, file.size - 12, 12);
  let hasIEND = false;
  if (tailView.byteLength === 12) {
    const tailType = String.fromCharCode(tailView.getUint8(4), tailView.getUint8(5), tailView.getUint8(6), tailView.getUint8(7));
    if (tailType === 'IEND') hasIEND = true;
  }

  if (!hasIEND || width === 0 || height === 0) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (нет закрывающего чанка IEND)';
  }
}

async function parseGIF(file, view, res) {
  if (view.byteLength < 13) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (обрушен заголовок GIF)';
    return;
  }

  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const packed = view.getUint8(10);
  const gctFlag = (packed & 0x80) !== 0;
  const gctSizePower = (packed & 0x07) + 1;
  const paletteColorsCount = gctFlag ? (1 << gctSizePower) : 0;

  res.dimensions = width + ' × ' + height;
  res.pixels = width * height;
  res.dpi = '72 × 72';
  res.bitDepth = gctSizePower + ' бит (' + paletteColorsCount + ' цв.)';
  res.bitDepthNum = gctSizePower;
  res.compression = 'LZW';

  const tailView = await readSlice(file, file.size - 1, 1);
  if (tailView.byteLength < 1 || tailView.getUint8(0) !== 0x3B || width === 0 || height === 0) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (нет трейлера 0x3B)';
  }
}

async function parsePCX(file, view, res) {
  if (file.size < 128 || view.byteLength < 128) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (< 128 байт PCX)';
    return;
  }

  const encoding = view.getUint8(2);
  const bitsPerPlane = view.getUint8(3);
  const xMin = view.getUint16(4, true);
  const yMin = view.getUint16(6, true);
  const xMax = view.getUint16(8, true);
  const yMax = view.getUint16(10, true);
  const hDpi = view.getUint16(12, true);
  const vDpi = view.getUint16(14, true);
  const numPlanes = view.getUint8(65);

  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  const totalBitDepth = bitsPerPlane * numPlanes;

  if (width <= 0 || height <= 0 || bitsPerPlane === 0 || numPlanes === 0) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (некорректная геометрия PCX)';
    return;
  }

  res.dimensions = width + ' × ' + height;
  res.pixels = width * height;
  res.dpi = (hDpi || 72) + ' × ' + (vDpi || 72);
  res.bitDepth = totalBitDepth + ' бит';
  res.bitDepthNum = totalBitDepth;
  res.compression = encoding === 1 ? 'RLE' : 'Без сжатия';
}

async function parseJPEG(file, firstView, res) {
  let bufView = file.size > 4096 ? await readSlice(file, 0, 16384) : firstView;
  let bufStart = 0;
  let offset = 2;
  let width = 0, height = 0, bitDepth = 0, compressionName = 'Baseline DCT';
  let dpiSource = '72 × 72';

  const sofMap = {
    0xC0: 'Baseline DCT',
    0xC1: 'Extended DCT',
    0xC2: 'Progressive DCT',
    0xC3: 'Lossless',
    0xC9: 'Extended Arith',
    0xCA: 'Progressive Arith'
  };

  while (offset < file.size) {
    if (offset - bufStart + 16 > bufView.byteLength) {
      bufStart = offset;
      bufView = await readSlice(file, bufStart, 16384);
      if (bufView.byteLength < 4) break;
    }

    const rel = offset - bufStart;
    if (bufView.getUint8(rel) !== 0xFF) {
      offset++;
      continue;
    }

    let markerPos = rel + 1;
    while (markerPos < bufView.byteLength && bufView.getUint8(markerPos) === 0xFF) {
      markerPos++;
    }
    if (markerPos >= bufView.byteLength) break;

    const marker = bufView.getUint8(markerPos);
    offset = bufStart + markerPos + 1;

    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      if (marker === 0xD9) break;
      continue;
    }
    if (marker === 0xDA && width > 0) break;

    if (offset - bufStart + 2 > bufView.byteLength) {
      bufStart = offset;
      bufView = await readSlice(file, bufStart, 16384);
      if (bufView.byteLength < 2) break;
    }

    const segLength = bufView.getUint16(offset - bufStart, false);
    if (segLength < 2) break;

    const segStart = offset + 2 - bufStart;
    if (marker === 0xE0 && segStart + 12 <= bufView.byteLength) {
      const id = String.fromCharCode(
        bufView.getUint8(segStart), bufView.getUint8(segStart + 1),
        bufView.getUint8(segStart + 2), bufView.getUint8(segStart + 3)
      );
      if (id === 'JFIF') {
        const units = bufView.getUint8(segStart + 7);
        const xDens = bufView.getUint16(segStart + 8, false);
        const yDens = bufView.getUint16(segStart + 10, false);
        if (units === 1) dpiSource = xDens + ' × ' + yDens;
        else if (units === 2) dpiSource = Math.round(xDens * 2.54) + ' × ' + Math.round(yDens * 2.54);
      }
    } else if (sofMap[marker] && segStart + 6 <= bufView.byteLength) {
      compressionName = sofMap[marker];
      const precision = bufView.getUint8(segStart);
      height = bufView.getUint16(segStart + 1, false);
      width = bufView.getUint16(segStart + 3, false);
      const components = bufView.getUint8(segStart + 5);
      bitDepth = precision * components;
      break;
    }

    offset += segLength;
  }

  res.dimensions = width > 0 ? (width + ' × ' + height) : 'Не найдено';
  res.pixels = width * height;
  res.dpi = dpiSource;
  res.bitDepth = (bitDepth || 24) + ' бит';
  res.bitDepthNum = bitDepth || 24;
  res.compression = 'JPEG (' + compressionName + ')';

  const tailView = await readSlice(file, Math.max(0, file.size - 32), 32);
  let hasEOI = false;
  for (let i = tailView.byteLength - 2; i >= 0; i--) {
    if (tailView.getUint8(i) === 0xFF && tailView.getUint8(i + 1) === 0xD9) {
      hasEOI = true;
      break;
    }
  }

  if (!hasEOI || width === 0 || height === 0) {
    res.status = 'corrupted';
    res.statusText = width === 0 ? 'Файл поврежден (нет SOFn)' : 'Файл поврежден (нет EOI FF D9)';
  }
}

async function parseTIFF(file, view, res) {
  const littleEndian = view.getUint8(0) === 0x49;
  const ifdOffset = view.getUint32(4, littleEndian);

  if (ifdOffset === 0 || ifdOffset + 2 > file.size) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (смещение IFD вне файла)';
    return;
  }

  const ifdView = (ifdOffset + 1024 <= view.byteLength) ? new DataView(view.buffer, ifdOffset) : await readSlice(file, ifdOffset, 2048);
  if (ifdView.byteLength < 2) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (ошибка чтения IFD)';
    return;
  }

  const numEntries = ifdView.getUint16(0, littleEndian);
  if (ifdOffset + 2 + numEntries * 12 > file.size) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (таблица IFD обрезана)';
    return;
  }

  let width = 0, height = 0, compression = 1, samplesPerPixel = 1, bitsPerSample = 8;
  let xRes = 72, yRes = 72, resUnit = 2;

  for (let i = 0; i < numEntries; i++) {
    const entryPos = 2 + i * 12;
    if (entryPos + 12 > ifdView.byteLength) break;

    const tag = ifdView.getUint16(entryPos, littleEndian);
    const type = ifdView.getUint16(entryPos + 2, littleEndian);
    const count = ifdView.getUint32(entryPos + 4, littleEndian);
    const valOffsetPos = entryPos + 8;

    const readScalar = function() {
      if (type === 3) return ifdView.getUint16(valOffsetPos, littleEndian);
      if (type === 4) return ifdView.getUint32(valOffsetPos, littleEndian);
      return ifdView.getUint16(valOffsetPos, littleEndian);
    };

    if (tag === 256) width = readScalar();
    else if (tag === 257) height = readScalar();
    else if (tag === 258) {
      if (count === 1) {
        bitsPerSample = readScalar();
      } else {
        const ptr = ifdView.getUint32(valOffsetPos, littleEndian);
        const bpsView = await readSlice(file, ptr, 2);
        if (bpsView.byteLength >= 2) bitsPerSample = bpsView.getUint16(0, littleEndian);
      }
    } else if (tag === 259) compression = readScalar();
    else if (tag === 277) samplesPerPixel = readScalar();
    else if (tag === 282 || tag === 283) {
      const ratOffset = ifdView.getUint32(valOffsetPos, littleEndian);
      const ratView = await readSlice(file, ratOffset, 8);
      if (ratView.byteLength === 8) {
        const num = ratView.getUint32(0, littleEndian);
        const den = ratView.getUint32(4, littleEndian);
        const val = den > 0 ? Math.round(num / den) : 72;
        if (tag === 282) xRes = val;
        if (tag === 283) yRes = val;
      }
    } else if (tag === 296) resUnit = readScalar();
  }

  if (resUnit === 3) {
    xRes = Math.round(xRes * 2.54);
    yRes = Math.round(yRes * 2.54);
  }

  const tiffCompMap = {
    1: 'Без сжатия',
    2: 'CCITT 1D',
    3: 'CCITT Group 3',
    4: 'CCITT Group 4',
    5: 'LZW',
    6: 'JPEG (Old)',
    7: 'JPEG',
    8: 'Deflate',
    32773: 'PackBits (RLE)'
  };

  const totalBits = bitsPerSample * samplesPerPixel;
  res.dimensions = width + ' × ' + height;
  res.pixels = width * height;
  res.dpi = xRes + ' × ' + yRes;
  res.bitDepth = totalBits + ' бит';
  res.bitDepthNum = totalBits;
  res.compression = tiffCompMap[compression] || ('Код ' + compression);

  if (width === 0 || height === 0) {
    res.status = 'corrupted';
    res.statusText = 'Файл поврежден (нет тегов 256/257 в IFD)';
  }
}

window.DataParsingLayer = {
  readSlice: readSlice,
  getExtension: getExtension,
  parseImageFile: parseImageFile,
  parseBMP: parseBMP,
  parsePNG: parsePNG,
  parseGIF: parseGIF,
  parsePCX: parsePCX,
  parseJPEG: parseJPEG,
  parseTIFF: parseTIFF
};
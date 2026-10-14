const workerCode = [
  "self.onmessage = async function(e) {",
  "  const files = e.data.files;",
  "  const batchStartIndex = e.data.batchStartIndex;",
  "  const results = [];",
  "  for (let i = 0; i < files.length; i++) {",
  "    const file = files[i];",
  "    try {",
  "      const parsed = await parseImageFile(file);",
  "      parsed.index = batchStartIndex + i + 1;",
  "      results.push(parsed);",
  "    } catch (err) {",
  "      results.push({",
  "        index: batchStartIndex + i + 1,",
  "        fileName: file.name,",
  "        fileSize: file.size,",
  "        detectedFormat: 'UNKNOWN',",
  "        dimensions: '—',",
  "        pixels: 0,",
  "        dpi: '—',",
  "        bitDepth: '—',",
  "        bitDepthNum: 0,",
  "        compression: '—',",
  "        magicHex: '—',",
  "        status: 'corrupted',",
  "        statusText: 'Ошибка чтения: ' + (err.message || 'Файл поврежден'),",
  "        extra: {}",
  "      });",
  "    }",
  "  }",
  "  self.postMessage({ results: results });",
  "};",
  "async function readSlice(file, offset, length) {",
  "  const safeOffset = Math.max(0, offset);",
  "  const safeEnd = Math.min(file.size, safeOffset + length);",
  "  if (safeEnd <= safeOffset) return new DataView(new ArrayBuffer(0));",
  "  const blob = file.slice(safeOffset, safeEnd);",
  "  const buffer = await blob.arrayBuffer();",
  "  return new DataView(buffer);",
  "}",
  "function getExtension(name) {",
  "  const idx = name.lastIndexOf('.');",
  "  return idx !== -1 ? name.slice(idx + 1).toLowerCase() : '';",
  "}",
  "function toHexString(view, count) {",
  "  const bytes = [];",
  "  const limit = Math.min(view.byteLength, count);",
  "  for (let i = 0; i < limit; i++) {",
  "    bytes.push(view.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));",
  "  }",
  "  return bytes.join(' ');",
  "}",
  "async function parseImageFile(file) {",
  "  const ext = getExtension(file.name);",
  "  const baseResult = {",
  "    fileName: file.name,",
  "    fileSize: file.size,",
  "    ext: ext,",
  "    detectedFormat: 'UNKNOWN',",
  "    dimensions: '—',",
  "    pixels: 0,",
  "    dpi: '—',",
  "    bitDepth: '—',",
  "    bitDepthNum: 0,",
  "    compression: '—',",
  "    magicHex: '—',",
  "    status: 'ok',",
  "    statusText: 'OK (Валиден)',",
  "    extra: {}",
  "  };",
  "  if (file.size < 14) {",
  "    baseResult.status = 'corrupted';",
  "    baseResult.statusText = 'Файл поврежден (размер < 14 байт)';",
  "    return baseResult;",
  "  }",
  "  const headerView = await readSlice(file, 0, 65536);",
  "  baseResult.magicHex = toHexString(headerView, 16);",
  "  const b0 = headerView.getUint8(0);",
  "  const b1 = headerView.getUint8(1);",
  "  const b2 = headerView.getUint8(2);",
  "  const b3 = headerView.getUint8(3);",
  "  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) {",
  "    baseResult.detectedFormat = 'PNG';",
  "    await parsePNG(file, headerView, baseResult);",
  "  } else if (b0 === 0x42 && b1 === 0x4D) {",
  "    baseResult.detectedFormat = 'BMP';",
  "    await parseBMP(file, headerView, baseResult);",
  "  } else if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38) {",
  "    baseResult.detectedFormat = 'GIF';",
  "    await parseGIF(file, headerView, baseResult);",
  "  } else if (b0 === 0xFF && b1 === 0xD8) {",
  "    baseResult.detectedFormat = 'JPEG';",
  "    await parseJPEG(file, headerView, baseResult);",
  "  } else if ((b0 === 0x49 && b1 === 0x49 && b2 === 0x2A && b3 === 0x00) || (b0 === 0x4D && b1 === 0x4D && b2 === 0x00 && b3 === 0x2A)) {",
  "    baseResult.detectedFormat = 'TIFF';",
  "    await parseTIFF(file, headerView, baseResult);",
  "  } else if (b0 === 0x0A && [0, 2, 3, 4, 5].includes(b1) && b2 <= 1) {",
  "    baseResult.detectedFormat = 'PCX';",
  "    await parsePCX(file, headerView, baseResult);",
  "  } else {",
  "    baseResult.status = 'corrupted';",
  "    baseResult.statusText = 'Неизвестная сигнатура (файл поврежден или не изображение)';",
  "    return baseResult;",
  "  }",
  "  const extMap = { 'jpg': 'JPEG', 'jpeg': 'JPEG', 'png': 'PNG', 'bmp': 'BMP', 'gif': 'GIF', 'tif': 'TIFF', 'tiff': 'TIFF', 'pcx': 'PCX' };",
  "  if (baseResult.status === 'ok' && extMap[ext] && extMap[ext] !== baseResult.detectedFormat) {",
  "    baseResult.status = 'mismatch';",
  "    baseResult.statusText = 'Подмена: .' + ext + ' -> внутри ' + baseResult.detectedFormat;",
  "  }",
  "  return baseResult;",
  "}",
  "async function parseBMP(file, view, res) {",
  "  if (view.byteLength < 54) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (обрушен заголовок BMP)';",
  "    return;",
  "  }",
  "  const declaredFileSize = view.getUint32(2, true);",
  "  const dataOffset = view.getUint32(10, true);",
  "  const biSize = view.getUint32(14, true);",
  "  let width = 0, height = 0, planes = 1, bitCount = 0, compressionCode = 0;",
  "  let xPelsPerMeter = 0, yPelsPerMeter = 0, clrUsed = 0;",
  "  if (biSize === 12) {",
  "    width = view.getUint16(18, true);",
  "    height = view.getUint16(20, true);",
  "    planes = view.getUint16(22, true);",
  "    bitCount = view.getUint16(24, true);",
  "  } else {",
  "    width = view.getInt32(18, true);",
  "    height = Math.abs(view.getInt32(22, true));",
  "    planes = view.getUint16(26, true);",
  "    bitCount = view.getUint16(28, true);",
  "    compressionCode = view.getUint32(30, true);",
  "    xPelsPerMeter = view.getInt32(38, true);",
  "    yPelsPerMeter = view.getInt32(42, true);",
  "    clrUsed = view.getUint32(46, true);",
  "  }",
  "  const compMap = { 0: 'BI_RGB (Без сжатия)', 1: 'BI_RLE8 (RLE 8-бит)', 2: 'BI_RLE4 (RLE 4-бит)', 3: 'BI_BITFIELDS (Битовые маски)', 4: 'BI_JPEG', 5: 'BI_PNG' };",
  "  const dpiX = xPelsPerMeter > 0 ? Math.round(xPelsPerMeter * 0.0254) : 96;",
  "  const dpiY = yPelsPerMeter > 0 ? Math.round(yPelsPerMeter * 0.0254) : 96;",
  "  res.dimensions = width + ' × ' + height;",
  "  res.pixels = width * height;",
  "  res.dpi = dpiX + ' × ' + dpiY;",
  "  res.bitDepth = bitCount + ' бит';",
  "  res.bitDepthNum = bitCount;",
  "  res.compression = compMap[compressionCode] || ('Код ' + compressionCode);",
  "  let paletteEntries = 0;",
  "  if (bitCount <= 8 && bitCount > 0) {",
  "    paletteEntries = clrUsed > 0 ? clrUsed : (1 << bitCount);",
  "  }",
  "  res.extra = {",
  "    'Сигнатура (Magic Number)': '42 4D (\"BM\")',",
  "    'Размер заголовка DIB (biSize)': biSize + ' байт',",
  "    'Смещение растра (bfOffBits)': dataOffset + ' байт',",
  "    'Заявленный размер файла': declaredFileSize + ' Б (факт: ' + file.size + ' Б)',",
  "    'Цветовых плоскостей (biPlanes)': planes,",
  "    'Устройство палитры BMP': paletteEntries > 0 ? ('Таблица цветов RGBQUAD (' + paletteEntries + ' цв. по 4 байта: B, G, R, 0)') : 'Прямое кодирование цвета без палитры (TrueColor)'",
  "  };",
  "  if (width <= 0 || height <= 0 || file.size < dataOffset || (declaredFileSize > file.size && compressionCode === 0)) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден: размер (' + file.size + ' Б) меньше заголовка (' + declaredFileSize + ' Б)';",
  "  }",
  "}",
  "async function parsePNG(file, view, res) {",
  "  if (view.byteLength < 33 || view.getUint32(4, false) !== 0x0D0A1A0A) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (нарушена 8-байтовая сигнатура PNG)';",
  "    return;",
  "  }",
  "  const ihdrType = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));",
  "  if (ihdrType !== 'IHDR') {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (нет обязательного чанка IHDR)';",
  "    return;",
  "  }",
  "  const width = view.getUint32(16, false);",
  "  const height = view.getUint32(20, false);",
  "  const bitDepthPerChannel = view.getUint8(24);",
  "  const colorType = view.getUint8(25);",
  "  const compressionMethod = view.getUint8(26);",
  "  const filterMethod = view.getUint8(27);",
  "  const interlaceMethod = view.getUint8(28);",
  "  const channelsMap = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };",
  "  const colorTypeDesc = { 0: '0 (Оттенки серого)', 2: '2 (Truecolor RGB)', 3: '3 (Индексированная палитра PLTE)', 4: '4 (Оттенки серого + Alpha)', 6: '6 (Truecolor RGBA)' };",
  "  const channels = channelsMap[colorType] || 1;",
  "  const totalBitDepth = bitDepthPerChannel * channels;",
  "  let dpiX = 72, dpiY = 72, dpiNote = '72 × 72 (по умолч.)';",
  "  let paletteColors = 0;",
  "  let offset = 8;",
  "  while (offset + 8 <= view.byteLength) {",
  "    const chunkLen = view.getUint32(offset, false);",
  "    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));",
  "    if (type === 'pHYs' && offset + 8 + 9 <= view.byteLength) {",
  "      const ppuX = view.getUint32(offset + 8, false);",
  "      const ppuY = view.getUint32(offset + 12, false);",
  "      const unit = view.getUint8(offset + 16);",
  "      if (unit === 1) {",
  "        dpiX = Math.round(ppuX * 0.0254);",
  "        dpiY = Math.round(ppuY * 0.0254);",
  "        dpiNote = dpiX + ' × ' + dpiY;",
  "      }",
  "    } else if (type === 'PLTE') {",
  "      paletteColors = Math.floor(chunkLen / 3);",
  "    } else if (type === 'IDAT' || type === 'IEND') {",
  "      break;",
  "    }",
  "    offset += 12 + chunkLen;",
  "  }",
  "  res.dimensions = width + ' × ' + height;",
  "  res.pixels = width * height;",
  "  res.dpi = dpiNote;",
  "  res.bitDepth = totalBitDepth + ' бит (' + bitDepthPerChannel + ' бит/кан.)';",
  "  res.bitDepthNum = totalBitDepth;",
  "  res.compression = compressionMethod === 0 ? 'Deflate (LZ77 + Хаффман)' : ('Код ' + compressionMethod);",
  "  res.extra = {",
  "    'Сигнатура PNG': '89 50 4E 47 0D 0A 1A 0A',",
  "    'Тип цвета (Color Type)': colorTypeDesc[colorType] || colorType,",
  "    'Метод фильтрации (Filter)': filterMethod === 0 ? '0 (Адаптивная: None, Sub, Up, Average, Paeth)' : filterMethod,",
  "    'Чересстрочная развертка': interlaceMethod === 1 ? 'Adam7 (7 проходов)' : '0 (Без развертки)',",
  "    'Цветов в палитре (PLTE)': paletteColors > 0 ? paletteColors : 'Не используется'",
  "  };",
  "  const tailView = await readSlice(file, file.size - 12, 12);",
  "  let hasIEND = false;",
  "  if (tailView.byteLength === 12) {",
  "    const tailType = String.fromCharCode(tailView.getUint8(4), tailView.getUint8(5), tailView.getUint8(6), tailView.getUint8(7));",
  "    if (tailType === 'IEND') hasIEND = true;",
  "  }",
  "  if (!hasIEND || width === 0 || height === 0) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден: отсутствует закрывающий чанк IEND';",
  "  }",
  "}",
  "async function parseGIF(file, view, res) {",
  "  if (view.byteLength < 13) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (обрушен заголовок GIF)';",
  "    return;",
  "  }",
  "  const version = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3), view.getUint8(4), view.getUint8(5));",
  "  const width = view.getUint16(6, true);",
  "  const height = view.getUint16(8, true);",
  "  const packed = view.getUint8(10);",
  "  const bgColorIndex = view.getUint8(11);",
  "  const aspectRatioByte = view.getUint8(12);",
  "  const gctFlag = (packed & 0x80) !== 0;",
  "  const colorResolution = ((packed & 0x70) >> 4) + 1;",
  "  const gctSizePower = (packed & 0x07) + 1;",
  "  const paletteColorsCount = gctFlag ? (1 << gctSizePower) : 0;",
  "  res.dimensions = width + ' × ' + height;",
  "  res.pixels = width * height;",
  "  res.dpi = '72 × 72 (не хранится)';",
  "  res.bitDepth = gctSizePower + ' бит (' + paletteColorsCount + ' цв.)';",
  "  res.bitDepthNum = gctSizePower;",
  "  res.compression = 'LZW (Lempel-Ziv-Welch)';",
  "  res.extra = {",
  "    'Версия спецификации': version,",
  "    'Глобальная палитра (GCT)': gctFlag ? ('Да (' + paletteColorsCount + ' цветов, ' + (paletteColorsCount * 3) + ' байт RGB)') : 'Нет (локальная)',",
  "    'Разрешение цвета источника': colorResolution + ' бит на канал',",
  "    'Индекс цвета фона': bgColorIndex,",
  "    'Соотношение сторон пикселя': aspectRatioByte === 0 ? '1:1 (квадратный)' : ((aspectRatioByte + 15) / 64).toFixed(2)",
  "  };",
  "  const tailView = await readSlice(file, file.size - 1, 1);",
  "  if (tailView.byteLength < 1 || tailView.getUint8(0) !== 0x3B || width === 0 || height === 0) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден: отсутствует трейлер GIF (0x3B)';",
  "  }",
  "}",
  "async function parsePCX(file, view, res) {",
  "  if (file.size < 128 || view.byteLength < 128) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (размер < 128 байт PCX)';",
  "    return;",
  "  }",
  "  const version = view.getUint8(1);",
  "  const encoding = view.getUint8(2);",
  "  const bitsPerPlane = view.getUint8(3);",
  "  const xMin = view.getUint16(4, true);",
  "  const yMin = view.getUint16(6, true);",
  "  const xMax = view.getUint16(8, true);",
  "  const yMax = view.getUint16(10, true);",
  "  const hDpi = view.getUint16(12, true);",
  "  const vDpi = view.getUint16(14, true);",
  "  const numPlanes = view.getUint8(65);",
  "  const bytesPerLine = view.getUint16(66, true);",
  "  const width = xMax - xMin + 1;",
  "  const height = yMax - yMin + 1;",
  "  const totalBitDepth = bitsPerPlane * numPlanes;",
  "  if (width <= 0 || height <= 0 || bitsPerPlane === 0 || numPlanes === 0) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (некорректная геометрия PCX)';",
  "    return;",
  "  }",
  "  let paletteInfo = '16 цветов EGA в заголовке (48 байт)';",
  "  if (totalBitDepth === 8 && file.size > 128 + 769) {",
  "    const palView = await readSlice(file, file.size - 769, 1);",
  "    if (palView.byteLength === 1 && palView.getUint8(0) === 0x0C) {",
  "      paletteInfo = '256 цветов VGA (768 байт в конце после 0x0C)';",
  "    }",
  "  } else if (totalBitDepth === 24) {",
  "    paletteInfo = 'Без палитры (3 плоскости R, G, B по 8 бит)';",
  "  }",
  "  res.dimensions = width + ' × ' + height;",
  "  res.pixels = width * height;",
  "  res.dpi = (hDpi || 72) + ' × ' + (vDpi || 72);",
  "  res.bitDepth = totalBitDepth + ' бит (' + bitsPerPlane + '×' + numPlanes + ')';",
  "  res.bitDepthNum = totalBitDepth;",
  "  res.compression = encoding === 1 ? 'RLE (Run-Length Encoding)' : 'Без сжатия';",
  "  res.extra = {",
  "    'Производитель (Байт 0)': '0x0A (ZSoft .PCX)',",
  "    'Версия PCX': version,",
  "    'Байт на строку (BytesPerLine)': bytesPerLine,",
  "    'Организация палитры': paletteInfo",
  "  };",
  "}",
  "async function parseJPEG(file, view, res) {",
  "  let offset = 2;",
  "  let width = 0, height = 0, bitDepth = 0, compressionName = 'Baseline DCT (Хаффман)';",
  "  let dpiX = 72, dpiY = 72, dpiSource = '72 × 72 (по умолч.)';",
  "  const quantTables = [];",
  "  const sofMap = {",
  "    0xC0: 'Baseline DCT (Хаффман)',",
  "    0xC1: 'Extended Sequential DCT',",
  "    0xC2: 'Progressive DCT (Хаффман)',",
  "    0xC3: 'Lossless (Хаффман)',",
  "    0xC9: 'Extended DCT (Арифм.)',",
  "    0xCA: 'Progressive DCT (Арифм.)'",
  "  };",
  "  while (offset < file.size) {",
  "    let chunkView = await readSlice(file, offset, 65536);",
  "    if (chunkView.byteLength < 4) break;",
  "    if (chunkView.getUint8(0) !== 0xFF) {",
  "      offset++;",
  "      continue;",
  "    }",
  "    let markerPos = 1;",
  "    while (markerPos < chunkView.byteLength && chunkView.getUint8(markerPos) === 0xFF) {",
  "      markerPos++;",
  "    }",
  "    if (markerPos >= chunkView.byteLength) break;",
  "    const marker = chunkView.getUint8(markerPos);",
  "    offset += markerPos + 1;",
  "    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {",
  "      if (marker === 0xD9) break;",
  "      continue;",
  "    }",
  "    if (marker === 0xDA && width > 0) break;",
  "    const segHeader = await readSlice(file, offset, 2);",
  "    if (segHeader.byteLength < 2) break;",
  "    const segLength = segHeader.getUint16(0, false);",
  "    if (segLength < 2) break;",
  "    const segData = await readSlice(file, offset + 2, Math.min(segLength - 2, 16384));",
  "    if (marker === 0xE0 && segData.byteLength >= 12) {",
  "      const id = String.fromCharCode(segData.getUint8(0), segData.getUint8(1), segData.getUint8(2), segData.getUint8(3));",
  "      if (id === 'JFIF') {",
  "        const units = segData.getUint8(7);",
  "        const xDens = segData.getUint16(8, false);",
  "        const yDens = segData.getUint16(10, false);",
  "        if (units === 1) {",
  "          dpiX = xDens; dpiY = yDens;",
  "          dpiSource = dpiX + ' × ' + dpiY + ' (JFIF)';",
  "        } else if (units === 2) {",
  "          dpiX = Math.round(xDens * 2.54);",
  "          dpiY = Math.round(yDens * 2.54);",
  "          dpiSource = dpiX + ' × ' + dpiY + ' (из точек/см)';",
  "        }",
  "      }",
  "    }",
  "    if (marker === 0xDB && segData.byteLength >= 65) {",
  "      let qOffset = 0;",
  "      while (qOffset + 65 <= segData.byteLength) {",
  "        const pqTq = segData.getUint8(qOffset);",
  "        const precision = (pqTq >> 4) === 0 ? 8 : 16;",
  "        const tableId = pqTq & 0x0F;",
  "        qOffset += 1;",
  "        const matrix = [];",
  "        for (let k = 0; k < 64; k++) {",
  "          if (precision === 8) {",
  "            matrix.push(segData.getUint8(qOffset + k));",
  "          } else if (qOffset + k * 2 + 1 < segData.byteLength) {",
  "            matrix.push(segData.getUint16(qOffset + k * 2, false));",
  "          }",
  "        }",
  "        quantTables.push({ id: tableId, precision: precision, values: matrix });",
  "        qOffset += precision === 8 ? 64 : 128;",
  "      }",
  "    }",
  "    if (sofMap[marker] && segData.byteLength >= 6) {",
  "      compressionName = sofMap[marker];",
  "      const precision = segData.getUint8(0);",
  "      height = segData.getUint16(1, false);",
  "      width = segData.getUint16(3, false);",
  "      const components = segData.getUint8(5);",
  "      bitDepth = precision * components;",
  "    }",
  "    offset += segLength;",
  "  }",
  "  res.dimensions = width > 0 ? (width + ' × ' + height) : 'Не найдено';",
  "  res.pixels = width * height;",
  "  res.dpi = dpiSource;",
  "  res.bitDepth = bitDepth > 0 ? (bitDepth + ' бит') : '24 бит';",
  "  res.bitDepthNum = bitDepth || 24;",
  "  res.compression = 'JPEG (' + compressionName + ')';",
  "  res.extra = {",
  "    'Сигнатура старта (SOI)': 'FF D8',",
  "    'Алгоритм кодирования (SOFn)': compressionName,",
  "    'Матриц квантования (DQT FF DB)': quantTables.length,",
  "    'quantTables': quantTables",
  "  };",
  "  const tailView = await readSlice(file, Math.max(0, file.size - 64), 64);",
  "  let hasEOI = false;",
  "  for (let i = tailView.byteLength - 2; i >= 0; i--) {",
  "    if (tailView.getUint8(i) === 0xFF && tailView.getUint8(i + 1) === 0xD9) {",
  "      hasEOI = true;",
  "      break;",
  "    }",
  "  }",
  "  if (!hasEOI || width === 0 || height === 0) {",
  "    res.status = 'corrupted';",
  "    res.statusText = width === 0 ? 'Файл поврежден (нет маркера геометрии SOFn)' : 'Файл поврежден: в конце нет маркера EOI (FF D9)';",
  "  }",
  "}",
  "async function parseTIFF(file, view, res) {",
  "  const littleEndian = view.getUint8(0) === 0x49;",
  "  const ifdOffset = view.getUint32(4, littleEndian);",
  "  if (ifdOffset === 0 || ifdOffset + 2 > file.size) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден: смещение IFD (' + ifdOffset + ') вне файла';",
  "    return;",
  "  }",
  "  const ifdView = await readSlice(file, ifdOffset, 4096);",
  "  if (ifdView.byteLength < 2) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (не удалось прочитать каталог IFD)';",
  "    return;",
  "  }",
  "  const numEntries = ifdView.getUint16(0, littleEndian);",
  "  if (ifdOffset + 2 + numEntries * 12 > file.size) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (таблица IFD обрезана)';",
  "    return;",
  "  }",
  "  let width = 0, height = 0, compression = 1, samplesPerPixel = 1, bitsPerSample = 8;",
  "  let xRes = 72, yRes = 72, resUnit = 2;",
  "  for (let i = 0; i < numEntries; i++) {",
  "    const entryPos = 2 + i * 12;",
  "    if (entryPos + 12 > ifdView.byteLength) break;",
  "    const tag = ifdView.getUint16(entryPos, littleEndian);",
  "    const type = ifdView.getUint16(entryPos + 2, littleEndian);",
  "    const count = ifdView.getUint32(entryPos + 4, littleEndian);",
  "    const valOffsetPos = entryPos + 8;",
  "    const readScalar = function() {",
  "      if (type === 3) return ifdView.getUint16(valOffsetPos, littleEndian);",
  "      if (type === 4) return ifdView.getUint32(valOffsetPos, littleEndian);",
  "      return ifdView.getUint16(valOffsetPos, littleEndian);",
  "    };",
  "    if (tag === 256) width = readScalar();",
  "    else if (tag === 257) height = readScalar();",
  "    else if (tag === 258) {",
  "      if (count === 1) {",
  "        bitsPerSample = readScalar();",
  "      } else {",
  "        const ptr = ifdView.getUint32(valOffsetPos, littleEndian);",
  "        const bpsView = await readSlice(file, ptr, count * 2);",
  "        if (bpsView.byteLength >= 2) bitsPerSample = bpsView.getUint16(0, littleEndian);",
  "      }",
  "    } else if (tag === 259) compression = readScalar();",
  "    else if (tag === 277) samplesPerPixel = readScalar();",
  "    else if (tag === 282 || tag === 283) {",
  "      const ratOffset = ifdView.getUint32(valOffsetPos, littleEndian);",
  "      const ratView = await readSlice(file, ratOffset, 8);",
  "      if (ratView.byteLength === 8) {",
  "        const num = ratView.getUint32(0, littleEndian);",
  "        const den = ratView.getUint32(4, littleEndian);",
  "        const val = den > 0 ? Math.round(num / den) : 72;",
  "        if (tag === 282) xRes = val;",
  "        if (tag === 283) yRes = val;",
  "      }",
  "    } else if (tag === 296) resUnit = readScalar();",
  "  }",
  "  if (resUnit === 3) {",
  "    xRes = Math.round(xRes * 2.54);",
  "    yRes = Math.round(yRes * 2.54);",
  "  }",
  "  const tiffCompMap = { 1: 'Без сжатия (Uncompressed)', 2: 'CCITT Group 3 1D', 3: 'CCITT Group 3 Fax', 4: 'CCITT Group 4 Fax', 5: 'LZW', 6: 'JPEG (Old-style)', 7: 'JPEG', 8: 'Deflate (Adobe)', 32773: 'PackBits (RLE)' };",
  "  const totalBits = bitsPerSample * samplesPerPixel;",
  "  res.dimensions = width + ' × ' + height;",
  "  res.pixels = width * height;",
  "  res.dpi = xRes + ' × ' + yRes;",
  "  res.bitDepth = totalBits + ' бит (' + bitsPerSample + '×' + samplesPerPixel + ')';",
  "  res.bitDepthNum = totalBits;",
  "  res.compression = tiffCompMap[compression] || ('Код ' + compression);",
  "  res.extra = {",
  "    'Порядок байтов (Byte Order)': littleEndian ? 'II (Little-Endian, Intel)' : 'MM (Big-Endian, Motorola)',",
  "    'Смещение первого IFD': ifdOffset + ' байт',",
  "    'Количество тегов в IFD0': numEntries,",
  "    'Каналов на пиксель': samplesPerPixel",
  "  };",
  "  if (width === 0 || height === 0) {",
  "    res.status = 'corrupted';",
  "    res.statusText = 'Файл поврежден (в IFD нет тегов ширины/высоты 256/257)';",
  "  }",
  "}"
].join("\n");

const state = {
  allResults: [],
  filteredResults: [],
  fileMap: new Map(),
  currentPage: 1,
  pageSize: 100,
  sortField: 'index',
  sortAsc: true,
  workers: [],
  currentPreviewUrl: null
};

const els = {
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  dropZone: document.getElementById('dropZone'),
  selectFolderBtn: document.getElementById('selectFolderBtn'),
  selectFilesBtn: document.getElementById('selectFilesBtn'),
  folderInput: document.getElementById('folderInput'),
  fileInput: document.getElementById('fileInput'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  clearBtn: document.getElementById('clearBtn'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  formatFilter: document.getElementById('formatFilter'),
  pageSizeSelect: document.getElementById('pageSizeSelect'),
  progressWrapper: document.getElementById('progressWrapper'),
  progressText: document.getElementById('progressText'),
  speedText: document.getElementById('speedText'),
  progressBar: document.getElementById('progressBar'),
  statTotal: document.getElementById('statTotal'),
  statOk: document.getElementById('statOk'),
  statMismatch: document.getElementById('statMismatch'),
  statCorrupted: document.getElementById('statCorrupted'),
  statThreads: document.getElementById('statThreads'),
  tableBody: document.getElementById('tableBody'),
  paginationControls: document.getElementById('paginationControls'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageInfo: document.getElementById('pageInfo'),
  detailModal: document.getElementById('detailModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalBody: document.getElementById('modalBody'),
  closeModalBtn: document.getElementById('closeModalBtn')
};

const threadCount = Math.min(navigator.hardwareConcurrency || 4, 8);
els.statThreads.textContent = threadCount;

els.themeToggleBtn.addEventListener('click', function() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  els.themeToggleBtn.textContent = isDark ? '🌙 Темная тема' : '☀️ Светлая тема';
});

els.selectFolderBtn.addEventListener('click', function() {
  els.folderInput.value = '';
  els.folderInput.click();
});

els.selectFilesBtn.addEventListener('click', function() {
  els.fileInput.value = '';
  els.fileInput.click();
});

els.folderInput.addEventListener('change', function(e) {
  handleFilesSelected(e.target.files);
});

els.fileInput.addEventListener('change', function(e) {
  handleFilesSelected(e.target.files);
});

els.dropZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  els.dropZone.classList.add('dragover');
});

els.dropZone.addEventListener('dragleave', function() {
  els.dropZone.classList.remove('dragover');
});

els.dropZone.addEventListener('drop', function(e) {
  e.preventDefault();
  els.dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFilesSelected(e.dataTransfer.files);
  }
});

els.clearBtn.addEventListener('click', function() {
  state.allResults = [];
  state.filteredResults = [];
  state.fileMap.clear();
  state.currentPage = 1;
  els.folderInput.value = '';
  els.fileInput.value = '';
  els.clearBtn.disabled = true;
  els.exportCsvBtn.disabled = true;
  els.progressWrapper.style.display = 'none';
  updateStats();
  renderTable();
});

els.exportCsvBtn.addEventListener('click', function() {
  if (state.filteredResults.length === 0) return;
  const headers = ['Index', 'FileName', 'Format', 'Dimensions', 'DPI', 'BitDepth', 'Compression', 'Status'];
  const rows = state.filteredResults.map(function(r) {
    return [
      r.index,
      '"' + r.fileName.replace(/"/g, '""') + '"',
      r.detectedFormat,
      '"' + r.dimensions + '"',
      '"' + r.dpi + '"',
      '"' + r.bitDepth + '"',
      '"' + r.compression + '"',
      '"' + r.statusText + '"'
    ].join(';');
  });
  const csvContent = '\uFEFF' + [headers.join(';')].concat(rows).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'image_metadata_report_' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
});

els.searchInput.addEventListener('input', applyFilters);
els.statusFilter.addEventListener('change', applyFilters);
els.formatFilter.addEventListener('change', applyFilters);
els.pageSizeSelect.addEventListener('change', function() {
  state.pageSize = Number(els.pageSizeSelect.value);
  state.currentPage = 1;
  renderTable();
});

document.querySelectorAll('th.sortable').forEach(function(th) {
  th.addEventListener('click', function() {
    const field = th.getAttribute('data-sort');
    if (state.sortField === field) {
      state.sortAsc = !state.sortAsc;
    } else {
      state.sortField = field;
      state.sortAsc = true;
    }
    sortResults();
    renderTable();
  });
});

els.prevPageBtn.addEventListener('click', function() {
  if (state.currentPage > 1) {
    state.currentPage--;
    renderTable();
  }
});

els.nextPageBtn.addEventListener('click', function() {
  const maxPage = Math.ceil(state.filteredResults.length / state.pageSize);
  if (state.currentPage < maxPage) {
    state.currentPage++;
    renderTable();
  }
});

function closeModal() {
  els.detailModal.style.display = 'none';
  if (state.currentPreviewUrl) {
    URL.revokeObjectURL(state.currentPreviewUrl);
    state.currentPreviewUrl = null;
  }
}

els.closeModalBtn.addEventListener('click', closeModal);
els.detailModal.addEventListener('click', function(e) {
  if (e.target === els.detailModal) closeModal();
});

function initWorkerPool() {
  if (state.workers.length > 0) return;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  for (let i = 0; i < threadCount; i++) {
    state.workers.push(new Worker(url));
  }
}

async function handleFilesSelected(fileList) {
  if (!fileList || fileList.length === 0) return;

  const validExts = new Set(['jpg', 'jpeg', 'gif', 'tif', 'tiff', 'bmp', 'png', 'pcx']);
  const files = Array.from(fileList).filter(function(f) {
    const idx = f.name.lastIndexOf('.');
    const ext = idx !== -1 ? f.name.slice(idx + 1).toLowerCase() : '';
    return validExts.has(ext) || fileList.length <= 500;
  });

  if (files.length === 0) {
    alert('В выбранной папке не найдено графических файлов поддерживаемых форматов.');
    return;
  }

  initWorkerPool();
  state.allResults = [];
  state.fileMap.clear();
  files.forEach(function(f, idx) {
    state.fileMap.set(idx + 1, f);
  });

  state.currentPage = 1;
  els.clearBtn.disabled = true;
  els.exportCsvBtn.disabled = true;
  els.progressWrapper.style.display = 'block';
  els.progressBar.style.width = '0%';

  const total = files.length;
  let processed = 0;
  const startTime = performance.now();

  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < total; i += batchSize) {
    batches.push({
      files: files.slice(i, i + batchSize),
      batchStartIndex: i
    });
  }

  let batchCursor = 0;

  await new Promise(function(resolve) {
    let activeWorkers = 0;

    const assignNextBatch = function(worker) {
      if (batchCursor >= batches.length) {
        activeWorkers--;
        if (activeWorkers === 0) resolve();
        return;
      }

      const batch = batches[batchCursor++];
      worker.onmessage = function(e) {
        const results = e.data.results;
        for (let i = 0; i < results.length; i++) {
          state.allResults.push(results[i]);
        }
        processed += results.length;

        const elapsedSec = (performance.now() - startTime) / 1000;
        const speed = elapsedSec > 0 ? Math.round(processed / elapsedSec) : processed;
        const pct = Math.min(100, Math.round((processed / total) * 100));

        els.progressBar.style.width = pct + '%';
        els.progressText.textContent = 'Обработано: ' + processed + ' из ' + total + ' (' + pct + '%)';
        els.speedText.textContent = speed + ' файл/сек • Время: ' + elapsedSec.toFixed(2) + ' с';

        assignNextBatch(worker);
      };

      worker.postMessage(batch);
    };

    for (let i = 0; i < state.workers.length; i++) {
      if (batchCursor < batches.length) {
        activeWorkers++;
        assignNextBatch(state.workers[i]);
      }
    }
  });

  els.clearBtn.disabled = false;
  els.exportCsvBtn.disabled = false;
  updateStats();
  applyFilters();
}

function updateStats() {
  let ok = 0, mismatch = 0, corrupted = 0;
  for (let i = 0; i < state.allResults.length; i++) {
    const r = state.allResults[i];
    if (r.status === 'ok') ok++;
    else if (r.status === 'mismatch') mismatch++;
    else corrupted++;
  }
  els.statTotal.textContent = state.allResults.length;
  els.statOk.textContent = ok;
  els.statMismatch.textContent = mismatch;
  els.statCorrupted.textContent = corrupted;
}

function applyFilters() {
  const q = els.searchInput.value.trim().toLowerCase();
  const statusVal = els.statusFilter.value;
  const formatVal = els.formatFilter.value;

  state.filteredResults = state.allResults.filter(function(item) {
    if (statusVal !== 'all' && item.status !== statusVal) return false;
    if (formatVal !== 'all' && item.detectedFormat !== formatVal) return false;
    if (q) {
      const hay = (item.fileName + ' ' + item.detectedFormat + ' ' + item.compression + ' ' + item.statusText).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  sortResults();
  state.currentPage = 1;
  renderTable();
}

function sortResults() {
  const f = state.sortField;
  const mul = state.sortAsc ? 1 : -1;
  state.filteredResults.sort(function(a, b) {
    const va = a[f], vb = b[f];
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    return String(va).localeCompare(String(vb), 'ru') * mul;
  });
}

function renderTable() {
  const list = state.filteredResults;
  if (list.length === 0) {
    els.tableBody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-illustration">🔍</div><div>Нет данных для отображения</div></td></tr>';
    els.paginationControls.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(list.length / state.pageSize);
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const pageItems = list.slice(startIdx, startIdx + state.pageSize);

  const rowsHtml = pageItems.map(function(item, idx) {
    let badgeClass = 'badge-ok';
    if (item.status === 'mismatch') badgeClass = 'badge-warn';
    if (item.status === 'corrupted') badgeClass = 'badge-err';

    const fmtClass = 'fmt-' + item.detectedFormat;

    return '<tr>' +
      '<td>' + item.index + '</td>' +
      '<td title="' + escapeHtml(item.fileName) + '"><strong>' + escapeHtml(truncate(item.fileName, 36)) + '</strong></td>' +
      '<td><span class="fmt-badge ' + fmtClass + '">' + item.detectedFormat + '</span></td>' +
      '<td>' + item.dimensions + '</td>' +
      '<td>' + item.dpi + '</td>' +
      '<td>' + item.bitDepth + '</td>' +
      '<td>' + item.compression + '</td>' +
      '<td><span class="badge ' + badgeClass + '">' + escapeHtml(item.statusText) + '</span></td>' +
      '<td><button type="button" class="btn btn-sm" onclick="showDetails(' + (startIdx + idx) + ')">👁️ Разбор</button></td>' +
    '</tr>';
  }).join('');

  els.tableBody.innerHTML = rowsHtml;
  els.paginationControls.style.display = 'flex';
  els.pageInfo.textContent = 'Страница ' + state.currentPage + ' из ' + totalPages + ' • Показано ' + (startIdx + 1) + '–' + Math.min(startIdx + state.pageSize, list.length) + ' из ' + list.length;
  els.prevPageBtn.disabled = state.currentPage <= 1;
  els.nextPageBtn.disabled = state.currentPage >= totalPages;
}

window.showDetails = function(filteredIndex) {
  const item = state.filteredResults[filteredIndex];
  if (!item) return;

  if (state.currentPreviewUrl) {
    URL.revokeObjectURL(state.currentPreviewUrl);
    state.currentPreviewUrl = null;
  }

  els.modalTitle.textContent = item.fileName;
  els.modalSubtitle.textContent = 'Размер: ' + formatBytes(item.fileSize) + ' • Реальный формат: ' + item.detectedFormat + ' • Статус: ' + item.statusText;

  const rawFile = state.fileMap.get(item.index);
  let previewImgHtml = '<span style="font-size:0.75rem; color:#64748b; text-align:center; padding:6px;">Превью недоступно</span>';
  if (rawFile && item.status !== 'corrupted' && ['JPEG', 'PNG', 'BMP', 'GIF'].includes(item.detectedFormat)) {
    state.currentPreviewUrl = URL.createObjectURL(rawFile);
    previewImgHtml = '<img src="' + state.currentPreviewUrl + '" alt="preview">';
  }

  let html = '<div class="preview-section">' +
    '<div class="preview-img-box">' + previewImgHtml + '</div>' +
    '<div style="flex:1;">' +
      '<div style="font-size:0.8rem; color:var(--muted); font-weight:600;">ПЕРВЫЕ 16 БАЙТ ФАЙЛА (HEX MAGIC SIGNATURE):</div>' +
      '<div class="hex-dump">' + escapeHtml(item.magicHex) + '</div>' +
      '<div style="margin-top:8px; font-size:0.84rem;">Геометрия: <strong>' + item.dimensions + '</strong> • Разрешение: <strong>' + item.dpi + ' DPI</strong> • Глубина: <strong>' + item.bitDepth + '</strong></div>' +
    '</div>' +
  '</div>' +
  '<div class="detail-grid">';

  const entries = Object.entries(item.extra || {});
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i][0];
    const val = entries[i][1];
    if (key === 'quantTables') continue;
    html += '<div class="detail-box">' +
      '<div style="color: var(--muted); font-size: 0.76rem;">' + escapeHtml(key) + '</div>' +
      '<div style="font-weight: 700; margin-top: 3px;">' + escapeHtml(String(val)) + '</div>' +
    '</div>';
  }
  html += '</div>';

  if (item.extra && item.extra.quantTables && item.extra.quantTables.length > 0) {
    html += '<h3 style="margin: 14px 0 6px; font-size: 0.96rem;">Матрицы квантования JPEG (Маркер DQT 0xFFDB):</h3>';
    for (let i = 0; i < item.extra.quantTables.length; i++) {
      const qt = item.extra.quantTables[i];
      const targetName = qt.id === 0 ? 'Яркость (Luminance Y)' : 'Цветность (Chrominance Cb/Cr)';
      html += '<div style="margin-bottom: 12px;">' +
        '<strong>Таблица #' + qt.id + ' — ' + targetName + ' (' + qt.precision + '-бит):</strong>' +
        '<div class="matrix-grid">' +
          qt.values.map(function(v) { return '<span>' + v + '</span>'; }).join('') +
        '</div>' +
      '</div>';
    }
  }

  const theoryMap = {
    'JPEG': '<strong>Откуда берутся данные в JPEG:</strong> Файл начинается с сигнатуры SOI (<code>FF D8</code>) и заканчивается маркером EOI (<code>FF D9</code>). Геометрия и глубина цвета извлекаются из маркера кадра <code>SOF0 (FF C0)</code> или <code>SOF2 (FF C2)</code>. Разрешение DPI хранится в сегменте <code>APP0 (FF E0, JFIF)</code>. <strong>Матрица квантования (DQT, маркер FF DB)</strong> — таблица 8×8 коэффициентов делителей для частот DCT.',
    'PNG': '<strong>Откуда берутся данные в PNG:</strong> Первые 8 байт — сигнатура <code>89 50 4E 47 0D 0A 1A 0A</code>. За ней идет 13-байтный чанк <code>IHDR</code> (ширина, высота, битность, тип цвета, метод фильтрации). Разрешение берется из чанка <code>pHYs</code> (пикселей на метр × 0.0254). Файл обязан заканчиваться чанком <code>IEND</code>.',
    'BMP': '<strong>Откуда берутся данные в BMP:</strong> Первые 14 байт — <code>BITMAPFILEHEADER</code> (сигнатура <code>42 4D "BM"</code>, размер файла, смещение <code>bfOffBits</code>). С 14-го байта — <code>BITMAPINFOHEADER</code> (ширина, высота, битность, тип сжатия <code>BI_RGB / BI_RLE8 / BI_RLE4</code>). При битности ≤ 8 бит используется палитра <code>RGBQUAD</code> (по 4 байта на цвет).',
    'GIF': '<strong>Откуда берутся данные в GIF:</strong> Первые 6 байт — сигнатура <code>GIF87a / GIF89a</code>. Далее 7 байт — <code>Logical Screen Descriptor</code> (ширина, высота и байт флагов глобальной палитры GCT). В конце файла обязателен байт <code>0x3B</code>.',
    'PCX': '<strong>Откуда берутся данные в PCX:</strong> 128-байтный заголовок начинается с <code>0x0A</code>. Размеры вычисляются как <code>Xmax - Xmin + 1</code> и <code>Ymax - Ymin + 1</code>. 256-цветная палитра VGA (768 байт) находится в конце файла после маркера <code>0x0C</code>.',
    'TIFF': '<strong>Откуда берутся данные в TIFF:</strong> Первые 2 байта задают порядок байтов (<code>II</code> — Little-Endian, <code>MM</code> — Big-Endian), далее <code>42</code> и смещение таблицы <code>IFD</code>. Из 12-байтных тегов IFD читаются <code>256</code> (ширина), <code>257</code> (высота), <code>258</code> (битность), <code>259</code> (сжатие), <code>282/283</code> (разрешение DPI).'
  };

  if (theoryMap[item.detectedFormat]) {
    html += '<div class="theory-block">' + theoryMap[item.detectedFormat] + '</div>';
  }

  els.modalBody.innerHTML = html;
  els.detailModal.style.display = 'flex';
};

function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1048576).toFixed(2) + ' МБ';
}
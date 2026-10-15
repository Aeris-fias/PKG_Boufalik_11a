const state = {
  rawFiles: [],
  allResults: [],
  filteredResults: [],
  currentPage: 1,
  pageSize: 100,
  sortField: 'index',
  sortAsc: true,
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
  previewThumb: document.getElementById('previewThumb'),
  previewMeta: document.getElementById('previewMeta')
};

els.statThreads.textContent = window.CoreEngineLayer.threadCount;

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
  startBatchProcessing(e.target.files);
});

els.fileInput.addEventListener('change', function(e) {
  startBatchProcessing(e.target.files);
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
    startBatchProcessing(e.dataTransfer.files);
  }
});

els.clearBtn.addEventListener('click', function() {
  state.rawFiles = [];
  state.allResults = [];
  state.filteredResults = [];
  state.currentPage = 1;
  if (state.currentPreviewUrl) {
    URL.revokeObjectURL(state.currentPreviewUrl);
    state.currentPreviewUrl = null;
  }
  els.previewThumb.innerHTML = '<span>Кликните на строку таблицы для показа картинки</span>';
  els.previewMeta.textContent = 'Превью не выбрано';
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
  a.download = 'image_metadata_' + Date.now() + '.csv';
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

async function startBatchProcessing(fileList) {
  if (!fileList || fileList.length === 0) return;

  const validExts = new Set(['jpg', 'jpeg', 'gif', 'tif', 'tiff', 'bmp', 'png', 'pcx']);
  const files = [];
  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    const idx = f.name.lastIndexOf('.');
    const ext = idx !== -1 ? f.name.slice(idx + 1).toLowerCase() : '';
    if (validExts.has(ext) || fileList.length <= 500) {
      files.push(f);
    }
  }

  if (files.length === 0) {
    alert('В выбранной папке не найдено графических файлов поддерживаемых форматов.');
    return;
  }

  state.rawFiles = files;
  state.currentPage = 1;
  els.clearBtn.disabled = true;
  els.exportCsvBtn.disabled = true;
  els.progressWrapper.style.display = 'block';
  els.progressBar.style.width = '0%';

  state.allResults = await window.CoreEngineLayer.processFiles(files, function(prog) {
    els.progressBar.style.width = prog.pct + '%';
    els.progressText.textContent = 'Обработано: ' + prog.processed + ' из ' + prog.total + ' (' + prog.pct + '%)';
    els.speedText.textContent = prog.speed + ' файл/сек • Время: ' + prog.elapsedSec.toFixed(2) + ' с';
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
    els.tableBody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-illustration">🔍</div><div>Нет данных для отображения</div></td></tr>';
    els.paginationControls.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(list.length / state.pageSize);
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const pageItems = list.slice(startIdx, startIdx + state.pageSize);

  const rowsHtml = pageItems.map(function(item) {
    let badgeClass = 'badge-ok';
    if (item.status === 'mismatch') badgeClass = 'badge-warn';
    if (item.status === 'corrupted') badgeClass = 'badge-err';

    const fmtClass = 'fmt-' + item.detectedFormat;

    return '<tr onclick="previewRowFile(' + item.index + ')">' +
      '<td>' + item.index + '</td>' +
      '<td title="' + escapeHtml(item.fileName) + '"><strong>' + escapeHtml(truncate(item.fileName, 42)) + '</strong></td>' +
      '<td><span class="fmt-badge ' + fmtClass + '">' + item.detectedFormat + '</span></td>' +
      '<td>' + item.dimensions + '</td>' +
      '<td>' + item.dpi + '</td>' +
      '<td>' + item.bitDepth + '</td>' +
      '<td>' + item.compression + '</td>' +
      '<td><span class="badge ' + badgeClass + '">' + escapeHtml(item.statusText) + '</span></td>' +
    '</tr>';
  }).join('');

  els.tableBody.innerHTML = rowsHtml;
  els.paginationControls.style.display = 'flex';
  els.pageInfo.textContent = 'Страница ' + state.currentPage + ' из ' + totalPages + ' • Показано ' + (startIdx + 1) + '–' + Math.min(startIdx + state.pageSize, list.length) + ' из ' + list.length;
  els.prevPageBtn.disabled = state.currentPage <= 1;
  els.nextPageBtn.disabled = state.currentPage >= totalPages;
}

window.previewRowFile = function(fileIndex) {
  const file = state.rawFiles[fileIndex - 1];
  const meta = state.allResults[fileIndex - 1];
  if (!file || !meta) return;

  if (state.currentPreviewUrl) {
    URL.revokeObjectURL(state.currentPreviewUrl);
    state.currentPreviewUrl = null;
  }

  els.previewMeta.textContent = meta.fileName + ' (' + meta.dimensions + ')';

  if (meta.status !== 'corrupted' && ['JPEG', 'PNG', 'BMP', 'GIF'].includes(meta.detectedFormat)) {
    state.currentPreviewUrl = URL.createObjectURL(file);
    els.previewThumb.innerHTML = '<img src="' + state.currentPreviewUrl + '" alt="preview">';
  } else {
    els.previewThumb.innerHTML = '<span>Превью недоступно (' + meta.detectedFormat + ')</span>';
  }
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
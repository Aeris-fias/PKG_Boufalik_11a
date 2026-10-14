class PresetGenerator {
  static create(type, width = 520, height = 360) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (type === "lowContrast") {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "rgb(95, 110, 128)");
      grad.addColorStop(1, "rgb(138, 148, 158)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgb(148, 142, 118)";
      ctx.beginPath();
      ctx.arc(410, 85, 42, 0, Math.PI * 2);
      ctx.fill();

      const layers = [
        { y: 170, amp: 35, freq: 0.012, col: "rgb(105, 118, 130)" },
        { y: 225, amp: 28, freq: 0.018, col: "rgb(92, 106, 114)" },
        { y: 275, amp: 18, freq: 0.025, col: "rgb(82, 95, 98)" }
      ];
      layers.forEach((l, idx) => {
        ctx.fillStyle = l.col;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 4) {
          const y = l.y + Math.sin(x * l.freq + idx * 2) * l.amp + Math.cos(x * 0.03) * 10;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });
    } else if (type === "saltPepper") {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, "#1e3a8a");
      g.addColorStop(0.5, "#0f766e");
      g.addColorStop(1, "#7c2d12");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#facc15";
      ctx.fillRect(50, 50, 150, 110);
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(350, 130, 68, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("ВАРИАНТ 5 • МЕДИАНА", 95, 285);

      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      let seed = 42;
      const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      for (let i = 0; i < d.length; i += 4) {
        const r = rand();
        if (r < 0.055) {
          d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
        } else if (r > 0.945) {
          d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (type === "unevenText") {
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 20px Georgia, serif";
      const lines = [
        "ДОКУМЕНТ С НЕРАВНОМЕРНЫМ ОСВЕЩЕНИЕМ",
        "Глобальный порог Оцу теряет часть текста",
        "в глубокой диагональной тени.",
        "Локальный метод Сауволы (через SAT за O(1))",
        "и Адаптивная пороговая обработка из лекции",
        "идеально выделяют каждую букву документа!",
        "Формула Сауволы: T = m * [1 + k*(s/R - 1)]",
        "Интегральное изображение ускоряет окно в 50 раз."
      ];
      lines.forEach((line, i) => {
        ctx.fillText(line, 26, 48 + i * 38);
      });

      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const light = 0.22 + 0.78 * ((x / width) * 0.65 + (1 - y / height) * 0.35);
          d[idx] = d[idx] * light;
          d[idx + 1] = d[idx + 1] * light;
          d[idx + 2] = d[idx + 2] * light;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (type === "edgesShapes") {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(140, 140, 75, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 6;
      ctx.strokeRect(270, 65, 190, 140);

      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.moveTo(260, 320);
      ctx.lineTo(365, 225);
      ctx.lineTo(475, 320);
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = i + 1;
        ctx.beginPath();
        ctx.moveTo(40, 250 + i * 16);
        ctx.lineTo(210, 250 + i * 16);
        ctx.stroke();
      }
    } else if (type === "morphology") {
      const grad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, 300);
      grad.addColorStop(0, "#475569");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(70, 80, 140, 140);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(128, 138, 14, 14);
      ctx.fillRect(160, 110, 8, 8);

      ctx.fillStyle = "#f8fafc";
      for (let y = 60; y < 310; y += 36) {
        for (let x = 260; x < 480; x += 36) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === "colorCast") {
      ctx.fillStyle = "#2b384e";
      ctx.fillRect(0, 0, width, height);
      const spheres = [
        { x: 130, y: 130, r: 75, c1: "#b96b6b", c2: "#5e2a2a" },
        { x: 280, y: 150, r: 82, c1: "#6bb983", c2: "#245836" },
        { x: 405, y: 125, r: 65, c1: "#6b8fb9", c2: "#243b58" },
        { x: 210, y: 270, r: 65, c1: "#c2ab6b", c2: "#5e4f24" }
      ];
      spheres.forEach(s => {
        const rg = ctx.createRadialGradient(s.x - 20, s.y - 20, 8, s.x, s.y, s.r);
        rg.addColorStop(0, s.c1);
        rg.addColorStop(1, s.c2);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    return new PixelBuffer(width, height, imgData.data);
  }
}

const METHODS_CONFIG = {
  hist: [
    {
      id: "linearContrast",
      name: "Линейное контрастирование (Растяжение диапазона)",
      complexity: "O(N)",
      controls: [],
      desc: "Линейно растягивает фактический диапазон яркостей [Imin, Imax] на полный интервал [0, 255]. Повышает общий контраст на блеклых снимках без нелинейных искажений."
    },
    {
      id: "equalizeHSV",
      name: "Эквализация гистограммы в пространстве HSV (только V)",
      complexity: "O(N)",
      controls: [],
      desc: "Переводит пиксели из RGB в HSV, выравнивает функцию распределения (CDF) только для компоненты яркости V и возвращает в RGB. Сохраняет истинный цветовой тон (Hue) без цветовых искажений."
    },
    {
      id: "equalizeRGB",
      name: "Эквализация гистограммы в пространстве RGB (3 канала)",
      complexity: "O(N)",
      controls: [],
      desc: "Независимо выравнивает гистограммы каналов R, G и B через кумулятивную функцию распределения (CDF). Дает сильный прирост контраста, но может смещать баланс оттенков."
    },
    {
      id: "clahe",
      name: "CLAHE (Адаптивная эквализация с ограничением контраста)",
      complexity: "O(N)",
      controls: [
        { id: "tileSize", label: "Размер локального тайла (px)", min: 16, max: 96, step: 8, val: 32 },
        { id: "clipLimit", label: "Предел ограничения контраста (Clip Limit)", min: 1.2, max: 6.0, step: 0.2, val: 2.5 }
      ],
      desc: "Продвинутый метод группы 10А: разбивает изображение на тайлы, ограничивает пики локальных гистограмм (предотвращая усиление шума) и сшивает тайлы билинейной интерполяцией."
    },
    {
      id: "gamma",
      name: "Поэлементная операция: Степенная Гамма-коррекция",
      complexity: "O(N)",
      controls: [
        { id: "gamma", label: "Коэффициент Гамма (γ)", min: 0.2, max: 3.0, step: 0.1, val: 0.6 }
      ],
      desc: "Нелинейное поэлементное преобразование I_out = 255 * (I_in / 255)^γ. При γ < 1 осветляет темные детали, при γ > 1 притемняет изображение."
    },
    {
      id: "log",
      name: "Поэлементная операция: Логарифмическое преобразование",
      complexity: "O(N)",
      controls: [
        { id: "gain", label: "Коэффициент усиления", min: 0.2, max: 5.0, step: 0.2, val: 1.5 }
      ],
      desc: "Растягивает узкий диапазон темных пикселей в более широкий диапазон и сжимает яркие области по закону c * log(1 + gain * I)."
    },
    {
      id: "invert",
      name: "Поэлементная операция: Цифровой негатив (Инверсия)",
      complexity: "O(N)",
      controls: [],
      desc: "Поэлементно обращает интенсивность каждого канала по формуле I_out = 255 - I_in."
    }
  ],
  order: [
    {
      id: "median",
      name: "Медианный фильтр (Вариант 5 — Порядковая статистика 50%)",
      complexity: "O(W² log W · N) • Web Workers",
      controls: [
        { id: "radius", label: "Радиус окна R (окно (2R+1)×(2R+1))", min: 1, max: 5, step: 1, val: 1 }
      ],
      desc: "Нелинейный фильтр Варианта 5: сортирует пиксели окрестности и выбирает центральный элемент (медиану). Полностью устраняет импульсный шум «соль и перец», сохраняя четкие контуры объектов."
    },
    {
      id: "alphaTrim",
      name: "Альфа-усеченный средний фильтр (Alpha-Trimmed Mean)",
      complexity: "O(W² log W · N) • Web Workers",
      controls: [
        { id: "radius", label: "Радиус окна R", min: 1, max: 5, step: 1, val: 1 },
        { id: "alpha", label: "Доля отбрасываемых краев α", min: 0.1, max: 0.8, step: 0.1, val: 0.4 }
      ],
      desc: "Сортирует выборку в окне, отбрасывает α% минимальных и максимальных выбросов и усредняет оставшиеся значения. Эффективен против комбинированного гауссова и импульсного шума."
    },
    {
      id: "min",
      name: "Фильтр минимума (0-й перцентиль)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "radius", label: "Радиус окна R", min: 1, max: 5, step: 1, val: 1 }
      ],
      desc: "Заменяет центральный пиксель минимальным значением из окрестности. Удаляет белые импульсные помехи («соль»)."
    },
    {
      id: "max",
      name: "Фильтр максимума (100-й перцентиль)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "radius", label: "Радиус окна R", min: 1, max: 5, step: 1, val: 1 }
      ],
      desc: "Заменяет центральный пиксель максимальным значением из окрестности. Удаляет черные импульсные помехи («перец»)."
    },
    {
      id: "midpoint",
      name: "Фильтр срединной точки (Midpoint = (Min + Max) / 2)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "radius", label: "Радиус окна R", min: 1, max: 4, step: 1, val: 1 }
      ],
      desc: "Вычисляет полусумму минимума и максимума в скользящем окне. Оптимален для подавления равномерного и гауссова шума."
    }
  ],
  conv: [
    {
      id: "gaussSeparable",
      name: "НЧ Фильтр Гаусса (Разделяемая свертка 1D + 1D)",
      complexity: "O(K · N) вместо O(K² · N)",
      controls: [
        { id: "radius", label: "Радиус ядра R", min: 1, max: 10, step: 1, val: 3 },
        { id: "sigma", label: "Сигма (σ)", min: 0.5, max: 5.0, step: 0.2, val: 1.6 }
      ],
      desc: "Реализован через два последовательных одномерных прохода (сначала по строкам, затем по столбцам), что снижает вычислительную сложность с квадратичной до линейной по размеру ядра."
    },
    {
      id: "boxSeparable",
      name: "НЧ Бокс-фильтр (Разделяемое усреднение 1D + 1D)",
      complexity: "O(K · N)",
      controls: [
        { id: "radius", label: "Радиус ядра R", min: 1, max: 10, step: 1, val: 2 }
      ],
      desc: "Однородное сглаживание изображения через два одномерных прохода с выбранной стратегией обработки краев (Reflect / Clamp)."
    },
    {
      id: "unsharp",
      name: "ВЧ Увеличение резкости: Нерезкое маскирование (Unsharp Mask)",
      complexity: "O(K · N)",
      controls: [
        { id: "radius", label: "Радиус размытия R", min: 1, max: 6, step: 1, val: 2 },
        { id: "amount", label: "Сила усиления резкости", min: 0.5, max: 3.5, step: 0.2, val: 1.6 }
      ],
      desc: "Вычитает сглаженную копию из оригинала для выделения высоких частот и прибавляет их обратно с весовым коэффициентом."
    },
    {
      id: "laplacian",
      name: "ВЧ Увеличение резкости: Оператор Лапласа",
      complexity: "O(N)",
      controls: [
        { id: "amount", label: "Коэффициент усиления контуров", min: 0.2, max: 2.5, step: 0.1, val: 1.0 }
      ],
      desc: "Использует производную второго порядка для подчеркивания резких перепадов яркости во всех направлениях."
    }
  ],
  seg: [
    {
      id: "sobelMag",
      name: "Оператор Собеля (Модуль градиента яркости)",
      complexity: "O(N)",
      controls: [],
      desc: "Вычисляет ортогональные проекции градиента Gx и Gy и строит карту полных модулей перепадов яркости √(Gx² + Gy²)."
    },
    {
      id: "sobelAngle",
      name: "Карта углов направления градиента Собеля (HSV-визуализация)",
      complexity: "O(N)",
      controls: [],
      desc: "Требование группы 10А: вычисляет честный угол направления градиента θ = atan2(Gy, Gx) в каждом пикселе и кодирует направление цветом (Hue), а силу перепада — яркостью (Value)."
    },
    {
      id: "canny",
      name: "Детектор границ Кэнни с субпиксельной точностью",
      complexity: "O(N)",
      controls: [
        { id: "sigma", label: "Сигма предфильтра Гаусса", min: 0.8, max: 3.0, step: 0.2, val: 1.4 },
        { id: "lowT", label: "Нижний порог гистерезиса (T_low)", min: 10, max: 100, step: 5, val: 30 },
        { id: "highT", label: "Верхний порог гистерезиса (T_high)", min: 40, max: 220, step: 5, val: 85 }
      ],
      desc: "Включает разделяемое сглаживание Гаусса, расчет градиентов, подавление немаксимумов с субпиксельной линейной интерполяцией вдоль вектора градиента и трассировку границ двойным порогом."
    }
  ],
  thresh: [
    {
      id: "otsu",
      name: "Глобальная пороговая обработка: Метод Оцу (Otsu)",
      complexity: "O(N)",
      controls: [],
      desc: "Автоматически находит оптимальный глобальный порог путем максимизации межклассовой дисперсии σ²_B(t) по гистограмме яркости."
    },
    {
      id: "isodata",
      name: "Глобальная пороговая обработка: Итеративный метод (Isodata)",
      complexity: "O(N)",
      controls: [],
      desc: "Итеративно уточняет глобальный порог как среднее арифметическое центроидов фонового и объектного кластеров до сходимости."
    },
    {
      id: "sauvola",
      name: "Локальная пороговая обработка: Метод Сауволы (через SAT за O(1))",
      complexity: "O(1) на пиксель (Интегральное изображение)",
      controls: [
        { id: "radius", label: "Радиус скользящего окна R", min: 5, max: 60, step: 2, val: 19 },
        { id: "k", label: "Коэффициент чувствительности k", min: 0.05, max: 0.6, step: 0.05, val: 0.2 }
      ],
      desc: "Использует таблицы интегрального изображения (SAT и SAT²) для мгновенного расчета локального среднего и СКО за O(1) вне зависимости от радиуса окна. Идеально бинаризует текст с тенями."
    },
    {
      id: "niblack",
      name: "Локальная пороговая обработка: Метод Ниблэка (через SAT за O(1))",
      complexity: "O(1) на пиксель (Интегральное изображение)",
      controls: [
        { id: "radius", label: "Радиус скользящего окна R", min: 5, max: 60, step: 2, val: 19 },
        { id: "k", label: "Коэффициент k (отрицательный)", min: -0.8, max: 0.2, step: 0.05, val: -0.2 }
      ],
      desc: "Вычисляет локальный порог T(x,y) = m(x,y) + k * s(x,y) в каждом окне за константное время через интегральное изображение."
    },
    {
      id: "adaptiveLecture",
      name: "Адаптивная пороговая обработка (Алгоритм из лекции + SAT)",
      complexity: "O(1) на пиксель (Интегральное изображение)",
      controls: [
        { id: "radius", label: "Радиус окрестности R", min: 3, max: 50, step: 2, val: 15 },
        { id: "C", label: "Пороговая поправка C", min: -20, max: 40, step: 2, val: 10 }
      ],
      desc: "Сравнивает яркость пикселя с локальным средним по окну за вычетом константы C. Ускорен через Summed-Area Table."
    }
  ],
  morph: [
    {
      id: "erode",
      name: "Морфологическая Эрозия (Сужение)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "shape", label: "Форма структурирующего элемента", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск (Круг)" }], val: "disk" },
        { id: "radius", label: "Радиус элемента R", min: 1, max: 6, step: 1, val: 2 }
      ],
      desc: "Удаляет мелкие светлые детали и сужает контуры светлых объектов выбранным структурирующим элементом."
    },
    {
      id: "dilate",
      name: "Морфологическая Дилатация (Расширение)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "shape", label: "Форма структурирующего элемента", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск (Круг)" }], val: "disk" },
        { id: "radius", label: "Радиус элемента R", min: 1, max: 6, step: 1, val: 2 }
      ],
      desc: "Расширяет светлые области и заполняет мелкие темные разрывы и отверстия внутри объектов."
    },
    {
      id: "open",
      name: "Морфологическое Открытие (Размыкание = Эрозия → Дилатация)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "shape", label: "Форма структурирующего элемента", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск (Круг)" }], val: "disk" },
        { id: "radius", label: "Радиус элемента R", min: 1, max: 6, step: 1, val: 2 }
      ],
      desc: "Убирает мелкие светлые объекты и выступы, сохраняя площадь крупных фигур."
    },
    {
      id: "close",
      name: "Морфологическое Закрытие (Замыкание = Дилатация → Эрозия)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "shape", label: "Форма структурирующего элемента", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск (Круг)" }], val: "disk" },
        { id: "radius", label: "Радиус элемента R", min: 1, max: 6, step: 1, val: 2 }
      ],
      desc: "Заполняет мелкие темные дыры и узкие разрывы внутри светлых объектов."
    },
    {
      id: "gradient",
      name: "Морфологический Градиент (Дилатация минус Эрозия)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "shape", label: "Форма структурирующего элемента", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск (Круг)" }], val: "disk" },
        { id: "radius", label: "Радиус элемента R", min: 1, max: 5, step: 1, val: 1 }
      ],
      desc: "Требование группы 10А: разность дилатации и эрозии четким контуром выделяет границы объектов."
    },
    {
      id: "tophat",
      name: "Преобразование Top-Hat (Оригинал минус Открытие)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "shape", label: "Форма структурирующего элемента", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск (Круг)" }], val: "disk" },
        { id: "radius", label: "Радиус элемента R", min: 2, max: 8, step: 1, val: 5 }
      ],
      desc: "Требование группы 10А: выделяет мелкие светлые элементы и детали на крупномасштабном неравномерном фоне."
    },
    {
      id: "blackhat",
      name: "Преобразование Black-Hat (Закрытие минус Оригинал)",
      complexity: "O(W² · N) • Web Workers",
      controls: [
        { id: "shape", label: "Форма структурирующего элемента", type: "select", options: [{ v: "square", l: "Квадрат" }, { v: "cross", l: "Крест" }, { v: "disk", l: "Диск (Круг)" }], val: "disk" },
        { id: "radius", label: "Радиус элемента R", min: 2, max: 8, step: 1, val: 5 }
      ],
      desc: "Требование группы 10А: выделяет мелкие темные отверстия и детали на светлом фоне."
    }
  ]
};

class AppUI {
  constructor() {
    this.workerPool = new WorkerPool();
    this.currentCategory = "hist";
    this.srcBuffer = null;
    this.dstBuffer = null;
    this.originalPresetBuffer = null;

    this.srcCanvas = document.getElementById("srcCanvas");
    this.dstCanvas = document.getElementById("dstCanvas");
    this.srcHistCanvas = document.getElementById("srcHistCanvas");
    this.dstHistCanvas = document.getElementById("dstHistCanvas");

    document.getElementById("threadInfo").textContent = `Потоки Web Workers: ${this.workerPool.numWorkers}`;

    this.bindEvents();
    this.populateCategory("hist");
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

    document.getElementById("categoryTabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      this.populateCategory(btn.dataset.cat);
      this.executeCurrentMethod();
    });

    document.getElementById("methodSelect").addEventListener("change", () => {
      this.renderMethodControls();
      this.executeCurrentMethod();
    });

    document.getElementById("paddingSelect").addEventListener("change", () => this.executeCurrentMethod());
    document.getElementById("useWorkersCheck").addEventListener("change", () => this.executeCurrentMethod());
    document.getElementById("applyBtn").addEventListener("click", () => this.executeCurrentMethod());

    document.getElementById("useResultAsSourceBtn").addEventListener("click", () => {
      if (!this.dstBuffer) return;
      this.srcBuffer = this.dstBuffer.clone();
      this.renderBufferToCanvas(this.srcBuffer, this.srcCanvas);
      this.executeCurrentMethod();
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      if (!this.originalPresetBuffer) return;
      this.srcBuffer = this.originalPresetBuffer.clone();
      this.renderBufferToCanvas(this.srcBuffer, this.srcCanvas);
      this.executeCurrentMethod();
    });

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
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          this.originalPresetBuffer = new PixelBuffer(w, h, data);
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

    if (presetName === "lowContrast") this.switchCategoryAndMethod("hist", "clahe");
    else if (presetName === "saltPepper") this.switchCategoryAndMethod("order", "median");
    else if (presetName === "unevenText") this.switchCategoryAndMethod("thresh", "sauvola");
    else if (presetName === "edgesShapes") this.switchCategoryAndMethod("seg", "sobelAngle");
    else if (presetName === "morphology") this.switchCategoryAndMethod("morph", "tophat");
    else if (presetName === "colorCast") this.switchCategoryAndMethod("hist", "equalizeHSV");
  }

  switchCategoryAndMethod(cat, methodId) {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.cat === cat);
    });
    this.populateCategory(cat, methodId);
    this.executeCurrentMethod();
  }

  populateCategory(cat, defaultMethodId = null) {
    this.currentCategory = cat;
    const select = document.getElementById("methodSelect");
    select.innerHTML = "";
    const list = METHODS_CONFIG[cat];
    list.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
    if (defaultMethodId) select.value = defaultMethodId;
    this.renderMethodControls();
  }

  getCurrentMethodConfig() {
    const id = document.getElementById("methodSelect").value;
    return METHODS_CONFIG[this.currentCategory].find(m => m.id === id);
  }

  renderMethodControls() {
    const cfg = this.getCurrentMethodConfig();
    const container = document.getElementById("dynamicControls");
    container.innerHTML = "";
    document.getElementById("complexityTag").textContent = `Сложность: ${cfg.complexity}`;

    if (!cfg.controls || cfg.controls.length === 0) {
      container.innerHTML = `<div style="font-size:12px;color:#94a3b8;">Метод работает автоматически без ручных параметров.</div>`;
      return;
    }

    cfg.controls.forEach(ctrl => {
      const wrap = document.createElement("div");
      wrap.className = "control-group";
      if (ctrl.type === "select") {
        const lbl = document.createElement("label");
        lbl.textContent = ctrl.label;
        const sel = document.createElement("select");
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
        valSpan.style.color = "#38bdf8";
        valSpan.textContent = ctrl.val;
        lbl.innerHTML = `<span>${ctrl.label}</span>`;
        lbl.appendChild(valSpan);

        const inp = document.createElement("input");
        inp.type = "range";
        inp.id = `param_${ctrl.id}`;
        inp.min = ctrl.min;
        inp.max = ctrl.max;
        inp.step = ctrl.step;
        inp.value = ctrl.val;
        inp.addEventListener("input", () => {
          valSpan.textContent = inp.value;
        });
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
      if (!el) return;
      params[c.id] = c.type === "select" ? el.value : parseFloat(el.value);
    });
    return params;
  }

  setProgress(pct) {
    document.getElementById("progressBar").style.width = `${pct}%`;
  }

  renderBufferToCanvas(buffer, canvas) {
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const ctx = canvas.getContext("2d");
    const imgData = new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height);
    ctx.putImageData(imgData, 0, 0);
  }

  drawHistogram(histData, canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 35) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    let maxVal = 1;
    for (let i = 1; i < 255; i++) {
      maxVal = Math.max(maxVal, histData.histR[i], histData.histG[i], histData.histB[i], histData.histL[i]);
    }

    const drawCurve = (arr, color, fill = false) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const y = h - Math.min(1, arr[i] / maxVal) * (h - 12);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      if (fill) {
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    };

    drawCurve(histData.histL, "rgba(226, 232, 240, 0.18)", true);
    drawCurve(histData.histR, "#f43f5e");
    drawCurve(histData.histG, "#22c55e");
    drawCurve(histData.histB, "#38bdf8");
    drawCurve(histData.histL, "#f8fafc");
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

    if (cfg.id === "linearContrast") {
      dst = ImageAlgorithms.linearContrast(this.srcBuffer);
    } else if (cfg.id === "equalizeRGB") {
      dst = ImageAlgorithms.equalizeRGB(this.srcBuffer);
    } else if (cfg.id === "equalizeHSV") {
      dst = ImageAlgorithms.equalizeHSV(this.srcBuffer);
    } else if (cfg.id === "clahe") {
      dst = ImageAlgorithms.claheHSV(this.srcBuffer, params.tileSize, params.clipLimit);
    } else if (cfg.id === "gamma" || cfg.id === "log" || cfg.id === "invert") {
      dst = ImageAlgorithms.elementwiseOp(this.srcBuffer, cfg.id, params.gamma, params.gain);
    } else if (["median", "min", "max", "midpoint", "alphaTrim"].includes(cfg.id)) {
      dst = await this.workerPool.runParallel(
        "orderStat",
        this.srcBuffer,
        { radius: params.radius, statType: cfg.id, alpha: params.alpha },
        padding,
        useWorkers ? (p) => this.setProgress(p) : null
      );
    } else if (cfg.id === "gaussSeparable") {
      const k = ImageAlgorithms.buildGaussianKernel1D(params.radius, params.sigma);
      dst = ImageAlgorithms.separableConvolution(this.srcBuffer, k, padding);
    } else if (cfg.id === "boxSeparable") {
      const k = ImageAlgorithms.buildBoxKernel1D(params.radius);
      dst = ImageAlgorithms.separableConvolution(this.srcBuffer, k, padding);
    } else if (cfg.id === "unsharp") {
      dst = ImageAlgorithms.unsharpMask(this.srcBuffer, params.radius, 1.4, params.amount, padding);
    } else if (cfg.id === "laplacian") {
      dst = ImageAlgorithms.sharpenLaplacian(this.srcBuffer, params.amount, padding);
    } else if (cfg.id === "sobelMag") {
      dst = ImageAlgorithms.sobelOperator(this.srcBuffer, false, padding);
    } else if (cfg.id === "sobelAngle") {
      dst = ImageAlgorithms.sobelOperator(this.srcBuffer, true, padding);
    } else if (cfg.id === "canny") {
      dst = ImageAlgorithms.cannySubpixel(this.srcBuffer, params.lowT, params.highT, params.sigma, padding);
    } else if (cfg.id === "otsu") {
      dst = ImageAlgorithms.thresholdOtsu(this.srcBuffer);
    } else if (cfg.id === "isodata") {
      dst = ImageAlgorithms.thresholdIsodata(this.srcBuffer);
    } else if (["sauvola", "niblack", "adaptiveLecture"].includes(cfg.id)) {
      dst = ImageAlgorithms.thresholdLocalSAT(this.srcBuffer, cfg.id, params.radius, params.k, params.C);
    } else if (["erode", "dilate", "open", "close", "gradient", "tophat", "blackhat"].includes(cfg.id)) {
      dst = await ImageAlgorithms.morphologyOperation(
        this.srcBuffer,
        cfg.id,
        params.shape,
        params.radius,
        padding,
        this.workerPool,
        useWorkers,
        (p) => this.setProgress(p)
      );
    }

    const elapsed = (performance.now() - t0).toFixed(1);
    this.setProgress(100);
    setTimeout(() => this.setProgress(0), 250);

    this.dstBuffer = dst;
    this.renderBufferToCanvas(dst, this.dstCanvas);

    document.getElementById("perfInfo").textContent = `Время: ${elapsed} мс`;
    document.getElementById("srcMeta").textContent = `${this.srcBuffer.width} × ${this.srcBuffer.height} px`;
    document.getElementById("dstMeta").textContent = dst.computedThreshold !== undefined
      ? `${cfg.name} (Порог T = ${dst.computedThreshold})`
      : cfg.name;

    const srcH = ImageAlgorithms.computeHistograms(this.srcBuffer);
    const dstH = ImageAlgorithms.computeHistograms(this.dstBuffer);

    this.drawHistogram(srcH, this.srcHistCanvas);
    this.drawHistogram(dstH, this.dstHistCanvas);

    document.getElementById("srcEntropy").textContent = `Энтропия H = ${srcH.entropy.toFixed(2)} бит`;
    document.getElementById("dstEntropy").textContent = `Энтропия H = ${dstH.entropy.toFixed(2)} бит`;

    document.getElementById("srcStats").innerHTML = `
      <span>Средняя яркость: <b>${srcH.mean.toFixed(1)}</b></span>
      <span>СКО (Контраст): <b>${srcH.std.toFixed(1)}</b></span>
      <span>Диапазон: <b>[${srcH.minL}..${srcH.maxL}]</b></span>
    `;
    document.getElementById("dstStats").innerHTML = `
      <span>Средняя яркость: <b>${dstH.mean.toFixed(1)}</b></span>
      <span>СКО (Контраст): <b>${dstH.std.toFixed(1)}</b></span>
      <span>Диапазон: <b>[${dstH.minL}..${dstH.maxL}]</b></span>
    `;

    this.updateReport(cfg, srcH, dstH, elapsed, padding, useWorkers);
  }

  updateReport(cfg, srcH, dstH, elapsed, padding, useWorkers) {
    const deltaStd = (dstH.std - srcH.std).toFixed(2);
    const deltaEnt = (dstH.entropy - srcH.entropy).toFixed(2);
    const reportEl = document.getElementById("reportBody");

    reportEl.innerHTML = `
      <h3>${cfg.name}</h3>
      <p>${cfg.desc}</p>
      <div class="report-grid">
        <div class="metric-box">
          <div class="label">Изменение СКО яркости (Контраст)</div>
          <div class="val">${srcH.std.toFixed(1)} → ${dstH.std.toFixed(1)} (${deltaStd >= 0 ? "+" + deltaStd : deltaStd})</div>
        </div>
        <div class="metric-box">
          <div class="label">Динамический диапазон Luma</div>
          <div class="val">[${srcH.minL}, ${srcH.maxL}] → [${dstH.minL}, ${dstH.maxL}]</div>
        </div>
        <div class="metric-box">
          <div class="label">Информационная энтропия Шеннона</div>
          <div class="val">${srcH.entropy.toFixed(2)} → ${dstH.entropy.toFixed(2)} бит (${deltaEnt >= 0 ? "+" + deltaEnt : deltaEnt})</div>
        </div>
        <div class="metric-box">
          <div class="label">Режим памяти и потоков</div>
          <div class="val">Edge: ${padding.toUpperCase()} • ${useWorkers ? this.workerPool.numWorkers + " Web Workers" : "1 Поток"} (${elapsed} мс)</div>
        </div>
      </div>
    `;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new AppUI();
});
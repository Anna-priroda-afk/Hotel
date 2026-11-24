/* =========================================================
   Отель в лесу — интерактив
   Без внешних библиотек: градиент от скролла, 3D-сцена,
   парящие объекты, наклоны карточек, карта, форма, темы.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- НАСТРОЙКИ: замените на реальные данные ---------- */
  const CONFIG = {
    hotel: {
      phone: '+7 (999) 123-45-67',
      phoneDigits: '79991234567',
      email: 'hello@lesisvet.ru',
      telegram: 'https://t.me/lesisvet_hotel',
      telegramLabel: '@lesisvet_hotel',
      whatsapp: 'https://wa.me/79991234567',
      address: 'Калужская область, Дзержинский район, д. Берёзовка',
      coords: { lat: 55.1452, lon: 36.7821 },
      cityCoords: { lat: 55.7558, lon: 37.6173 }
    },
    booking: {
      // Google Sheets: URL веб-приложения Apps Script (Deployment -> Web app URL).
      // Скрипт для вставки — в файле scripts/google-apps-script.gs.
      googleSheetsUrl: 'https://script.google.com/macros/s/AKfycbwFlHKqXfrsrdIew4XK9zqyNSPu2puNt6UQMydzuAsqMpjrqZHhQOWuYCK4NvX4xlJhrw/exec',
      // Variants:
      // 1) FormSubmit: 'https://formsubmit.co/ajax/hello@lesisvet.ru'
      // 2) GetForm:   'https://getform.io/f/your-endpoint'
      // Leave empty to use a mailto: fallback.
      endpoint: '',
      telegramBotToken: '',
      telegramChatId: '',
      mailto: 'hello@lesisvet.ru'
    },
    metrika: {
      id: 0,
      goals: {
        hero: 'HERO_BOOK',
        room: 'ROOM_SELECT',
        corporate: 'CORPORATE',
        newyear: 'NEWYEAR',
        activity: 'ACTIVITY',
        general: 'BOOKING_CLICK',
        theme: 'THEME_TOGGLE',
        submit: 'FORM_SUBMIT'
      }
    }
  };

  /* ---------- Утилиты ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const root = document.documentElement;

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mixRgb(a, b, t) {
    return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
  }
  const rgbString = c => `rgb(${c[0]} ${c[1]} ${c[2]})`;

  function track(goal) {
    const id = CONFIG.metrika.id;
    const name = CONFIG.metrika.goals[goal] || goal;
    if (id && typeof window.ym === 'function') window.ym(id, 'reachGoal', name);
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3600);
  }

  /* ---------- Радикальный градиент, привязанный к скроллу ---------- */
  // Пять стопов на всю длину страницы: a, b, c, glow, accent-hint.
  const PALETTES = {
    summer: [
      ['#071a11', '#123d29', '#5c985c', '#e9be76'],
      ['#0b2417', '#1b5a38', '#79ae62', '#f2d089'],
      ['#102c1c', '#2d7042', '#a3c471', '#ffdd9a'],
      ['#1c3420', '#4d8547', '#d3c77a', '#ffd07a'],
      ['#071810', '#143b27', '#65975f', '#e8b56b']
    ],
    winter: [
      ['#07170f', '#123a26', '#2c6b45', '#e8b96f'],
      ['#0b2016', '#1b4b2d', '#3e7d4c', '#f2cf82'],
      ['#2a1113', '#5e2724', '#9d4634', '#ffd089'],
      ['#331416', '#702b25', '#b35432', '#ffd68f'],
      ['#081a12', '#18432c', '#3c7750', '#e8bb70']
    ]
  };
  const parsedPalettes = {
    summer: PALETTES.summer.map(stop => stop.map(hexToRgb)),
    winter: PALETTES.winter.map(stop => stop.map(hexToRgb))
  };

  function samplePalette(stops, t) {
    const p = clamp(t) * (stops.length - 1);
    const i = Math.min(Math.floor(p), stops.length - 2);
    const f = p - i;
    return stops[i].map((c, j) => mixRgb(c, stops[i + 1][j], f));
  }

  const state = {
    theme: localStorage.getItem('les-theme') === 'summer' ? 'summer' : 'winter',
    themeMix: 0,
    themeTarget: 0,
    scrollProgress: 0,
    scrollY: window.scrollY,
    fly: 0,
    introStart: performance.now(),
    pointerX: 0,
    pointerY: 0,
    pointerTargetX: 0,
    pointerTargetY: 0,
    cursorX: window.innerWidth / 2,
    cursorY: window.innerHeight / 2,
    cursorTargetX: window.innerWidth / 2,
    cursorTargetY: window.innerHeight / 2,
    lastGradient: ''
  };
  state.themeTarget = state.theme === 'winter' ? 1 : 0;
  state.themeMix = state.themeTarget;

  function applyTheme(theme, notify = false) {
    state.theme = theme;
    state.themeTarget = theme === 'winter' ? 1 : 0;
    root.dataset.theme = theme;
    localStorage.setItem('les-theme', theme);
    const toggle = $('#theme-toggle');
    toggle.setAttribute('aria-checked', String(theme === 'winter'));
    toggle.setAttribute('aria-label', theme === 'winter' ? 'Зима — переключить на летнюю тему' : 'Лето — переключить на новогоднюю тему');
    $('#theme-label').textContent = theme === 'winter' ? 'Зима' : 'Лето';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'winter' ? '#1a1112' : '#0d2018');
    const winter = theme === 'winter';
    $('#hero-eyebrow-text').textContent = winter ? 'Новогодний сезон · 40 минут от города' : 'Эко-отель · 40 минут от города';
    $('#hero-offer-text').textContent = winter ? 'Новогодний пакет: 3 ночи, баня, программа 31.12' : 'Уютный номер с завтраком и баней';
    $('#hero-offer-price').textContent = winter ? '24 900 ₽ / 3 ночи' : 'от 6 500 ₽ / ночь';
    $('#hero-cta-text').textContent = winter ? 'Забронировать со скидкой 16%' : 'Забронировать даты';
    $('.hero__buttons [data-intent]').dataset.intent = winter ? 'newyear' : 'general';
    if (notify) {
      toast(theme === 'winter' ? 'Новогодняя тема включена ✦' : 'Летняя тема включена');
      track('theme');
    }
  }
  applyTheme(state.theme);

  $('#theme-toggle').addEventListener('click', () => {
    applyTheme(state.theme === 'winter' ? 'summer' : 'winter', true);
  });

  function updateGradient() {
    const s = samplePalette(parsedPalettes.summer, state.scrollProgress);
    const w = samplePalette(parsedPalettes.winter, state.scrollProgress);
    const t = state.themeMix;
    const keys = ['--grad-a', '--grad-b', '--grad-c', '--grad-glow'];
    const result = keys.map((key, i) => {
      const color = rgbString(mixRgb(s[i], w[i], t));
      root.style.setProperty(key, color);
      return color;
    });
    root.style.setProperty('--scroll-progress', state.scrollProgress.toFixed(4));
    state.lastGradient = result.join('|');
  }

  let parallaxReady = false;
  function onScroll() {
    state.scrollY = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    state.scrollProgress = clamp(state.scrollY / max);
    $('#header').classList.toggle('is-scrolled', state.scrollY > 32);
    // Обновляем и здесь, чтобы параллакс работал даже если rAF приостановлен.
    if (parallaxReady && !reducedMotion) updateParallax();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------- 3D-сцена: вылет камеры из окна ---------- */
  const hero = $('.hero');
  function updateFly(now) {
    const introT = clamp((now - state.introStart) / 1900);
    const introFly = reducedMotion ? 0 : 0.46 * (1 - easeOut(introT));
    const scrollFly = clamp(state.scrollY / Math.max(1, hero.offsetHeight * 0.95)) * 1.18;
    state.fly = clamp(introFly + scrollFly);
    root.style.setProperty('--fly', state.fly.toFixed(4));
  }

  // Генерация слоёв соснового леса (детерминированная, чтобы не «прыгала»).
  function seeded(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function buildPines(layer, seed, count, minH, maxH) {
    const rand = seeded(seed);
    let paths = '';
    for (let i = 0; i < count; i++) {
      const x = (i / count) * 1240 + rand() * 70 - 30;
      const h = lerp(minH, maxH, rand());
      const w = h * (0.24 + rand() * 0.1);
      const base = 300;
      const top = base - h;
      paths += `<path d="M${x.toFixed(1)} ${top.toFixed(1)} L${(x - w).toFixed(1)} ${(base - h * .25).toFixed(1)} L${(x - w * .55).toFixed(1)} ${(base - h * .25).toFixed(1)} L${(x - w * 1.2).toFixed(1)} ${base} L${(x + w * 1.2).toFixed(1)} ${base} L${(x + w * .55).toFixed(1)} ${(base - h * .25).toFixed(1)} L${(x + w).toFixed(1)} ${(base - h * .25).toFixed(1)} Z"/>`;
    }
    layer.innerHTML = `<svg viewBox="0 0 1200 300" preserveAspectRatio="none">${paths}</svg>`;
  }
  buildPines($('.pine-layer--far'), 11, 34, 105, 185);
  buildPines($('.pine-layer--mid'), 29, 26, 130, 225);
  buildPines($('.pine-layer--near'), 47, 18, 165, 285);

  /* ---------- Парящие интерактивные объекты ---------- */
  const fxLayer = $('#fx-layer');
  const fxObjects = [];
  const SHAPES = {
    leaf: '<svg viewBox="0 0 40 40"><path d="M20 2C35 8 37 25 20 38 3 25 5 8 20 2Z" fill="#82ab5f"/><path d="M20 5v31M20 16l-9-6M20 24l9-6" stroke="#cbe09b" stroke-width="1.4" fill="none" opacity=".8"/></svg>',
    firefly: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="rgba(246,214,125,.18)"/><circle cx="20" cy="20" r="5" fill="#ffe3a0"/><circle cx="20" cy="20" r="2" fill="#fff"/></svg>',
    cone: '<svg viewBox="0 0 40 40"><path d="M20 3c6 4 9 10 9 18s-4 15-9 17c-5-2-9-9-9-17s3-14 9-18Z" fill="#8c623f"/><path d="M11 16h18M10 23h20M13 30h14" stroke="#c29a6c" stroke-width="2" opacity=".8"/><path d="M13 7c2 3 4 4 7 5 3-1 5-2 7-5" fill="none" stroke="#6f4a2f" stroke-width="2"/></svg>',
    snow: '<svg viewBox="0 0 40 40"><g stroke="#eaf6ff" stroke-width="2" stroke-linecap="round"><path d="M20 3v34M5 11l30 18M35 11 5 29"/><path d="m15 7 5 4 5-4M15 33l5-4 5 4"/></g><circle cx="20" cy="20" r="2" fill="#fff"/></svg>',
    ornament: '<svg viewBox="0 0 40 40"><path d="M17 3h6v5h-6z" fill="#e2c189"/><circle cx="20" cy="23" r="13" fill="#cf4838"/><path d="M12 19c4-5 10-6 15-3" stroke="#f5b7a0" stroke-width="2" fill="none" opacity=".7"/></svg>'
  };
  function buildFx() {
    if (reducedMotion) return;
    const count = window.innerWidth < 700 ? 9 : 18;
    const rand = seeded(2026);
    const summerKinds = ['leaf', 'firefly', 'cone', 'leaf', 'firefly'];
    const winterKinds = ['snow', 'snow', 'ornament', 'snow', 'cone', 'snow', 'snow'];
    for (let i = 0; i < count; i++) {
      const make = (kind, kindTag) => {
        const depth = 0.4 + rand() * 1.4;
        const size = kind === 'firefly' ? 16 + rand() * 14 : 20 + rand() * 30;
        const el = document.createElement('span');
        el.className = 'float-object';
        el.dataset.kind = kindTag;
        el.style.setProperty('--x', `${(rand() * 96 + 2).toFixed(1)}%`);
        el.style.setProperty('--y', `${(rand() * 92 + 4).toFixed(1)}%`);
        el.style.setProperty('--size', `${size.toFixed(0)}px`);
        el.style.setProperty('--alpha', (0.28 + rand() * 0.42).toFixed(2));
        el.style.setProperty('--rot', `${(rand() * 360).toFixed(0)}deg`);
        el.style.setProperty('--bob', `${(5 + rand() * 7).toFixed(1)}s`);
        el.style.setProperty('--delay', `${(rand() * -8).toFixed(1)}s`);
        el.style.setProperty('--oz', `${(-40 + depth * 30).toFixed(0)}px`);
        el.innerHTML = `<span class="float-object__inner">${SHAPES[kind]}</span>`;
        fxLayer.appendChild(el);
        fxObjects.push({ el, depth, ox: 0, oy: 0, tx: 0, ty: 0 });
      };
      make(summerKinds[i % summerKinds.length], 'summer');
      make(winterKinds[i % winterKinds.length], 'winter');
    }
  }
  buildFx();

  /* ---------- Фоновый снегопад ---------- */
  function buildSnowfall() {
    if (reducedMotion) return;
    const layer = $('#snowfall');
    const count = window.innerWidth < 700 ? 26 : 52;
    const rand = seeded(777);
    for (let i = 0; i < count; i++) {
      const flake = document.createElement('span');
      flake.style.setProperty('--x', `${(rand() * 100).toFixed(1)}%`);
      flake.style.setProperty('--size', `${(2 + rand() * 5).toFixed(1)}px`);
      flake.style.setProperty('--alpha', (0.35 + rand() * 0.5).toFixed(2));
      flake.style.setProperty('--dur', `${(9 + rand() * 13).toFixed(1)}s`);
      flake.style.setProperty('--delay', `${(rand() * -22).toFixed(1)}s`);
      flake.style.setProperty('--drift', `${(-80 + rand() * 160).toFixed(0)}px`);
      layer.appendChild(flake);
    }
  }
  buildSnowfall();

  /* Кликабельные объекты тоже реагируют на мышь */
  const fxInteractive = $$('.fx-item').map((el, i) => ({ el, depth: 0.6 + i * 0.3, ox: 0, oy: 0 }));

  /* ---------- Указатель и параллакс ---------- */
  if (finePointer) {
    window.addEventListener('pointermove', e => {
      state.pointerTargetX = (e.clientX / window.innerWidth - 0.5) * 2;
      state.pointerTargetY = (e.clientY / window.innerHeight - 0.5) * 2;
      state.cursorTargetX = e.clientX;
      state.cursorTargetY = e.clientY;
    }, { passive: true });
  }

  /* ---------- Параллакс элементов и фоновых фото ---------- */
  const parallaxTargets = $$('[data-parallax]').map(el => ({
    el, speed: parseFloat(el.dataset.parallax) || 0.1
  }));
  const bgParallaxTargets = $$('[data-parallax-bg]').map(el => ({
    el, speed: parseFloat(el.dataset.parallaxBg) || 0.05
  }));
  const zoomTargets = $$('[data-parallax-zoom]').map(el => ({
    el, strength: parseFloat(el.dataset.parallaxZoom) || 0.12
  }));
  parallaxReady = true;
  let lastParallaxScroll = -1;
  updateParallax();
  function updateParallax() {
    if (lastParallaxScroll === state.scrollY) return;
    lastParallaxScroll = state.scrollY;
    const vh = window.innerHeight || 1;
    for (const item of parallaxTargets) {
      const r = item.el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const center = r.top + r.height / 2;
      const progress = (vh / 2 - center) / vh;
      item.el.style.setProperty('--px-y', `${(progress * item.speed * 100).toFixed(1)}px`);
    }
    for (const item of bgParallaxTargets) {
      const r = item.el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const center = r.top + r.height / 2;
      const progress = (vh / 2 - center) / vh;
      item.el.style.setProperty('--px-bg', `${(progress * item.speed * 100).toFixed(1)}px`);
    }
    for (const item of zoomTargets) {
      const r = item.el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const progress = clamp((vh - r.top) / (vh + r.height));
      item.el.style.setProperty('--bg-zoom', (1 + progress * item.strength).toFixed(4));
    }
  }

  /* ---------- Главный кадр ---------- */
  function tick(now) {
    state.themeMix = lerp(state.themeMix, state.themeTarget, 0.08);
    if (Math.abs(state.themeMix - state.themeTarget) < 0.001) state.themeMix = state.themeTarget;

    state.pointerX = lerp(state.pointerX, state.pointerTargetX, 0.06);
    state.pointerY = lerp(state.pointerY, state.pointerTargetY, 0.06);
    root.style.setProperty('--mx', state.pointerX.toFixed(3));
    root.style.setProperty('--my', state.pointerY.toFixed(3));

    state.cursorX = lerp(state.cursorX, state.cursorTargetX, 0.18);
    state.cursorY = lerp(state.cursorY, state.cursorTargetY, 0.18);
    root.style.setProperty('--cursor-x', `${state.cursorX.toFixed(1)}px`);
    root.style.setProperty('--cursor-y', `${state.cursorY.toFixed(1)}px`);

    updateFly(now);
    if (!reducedMotion) updateParallax();
    updateGradient();

    if (!reducedMotion) {
      for (const obj of fxObjects) {
        obj.tx = state.pointerX * obj.depth * 42;
        obj.ty = state.pointerY * obj.depth * 28 + state.scrollY * obj.depth * 0.006;
        obj.ox = lerp(obj.ox, obj.tx, 0.045);
        obj.oy = lerp(obj.oy, obj.ty, 0.045);
        obj.el.style.setProperty('--ox', `${obj.ox.toFixed(1)}px`);
        obj.el.style.setProperty('--oy', `${obj.oy.toFixed(1)}px`);
      }
      for (const obj of fxInteractive) {
        obj.ox = lerp(obj.ox, state.pointerX * obj.depth * 16, 0.07);
        obj.oy = lerp(obj.oy, state.pointerY * obj.depth * 12, 0.07);
        obj.el.style.setProperty('--ix', `${obj.ox.toFixed(1)}px`);
        obj.el.style.setProperty('--iy', `${obj.oy.toFixed(1)}px`);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- Появление блоков ---------- */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  $$('.reveal').forEach((el, i) => {
    if (!el.style.getPropertyValue('--delay')) el.style.setProperty('--delay', `${(i % 4) * 65}ms`);
    revealObserver.observe(el);
  });

  /* ---------- 3D-наклон карточек ---------- */
  if (finePointer && !reducedMotion) {
    $$('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- Мобильное меню ---------- */
  const menuToggle = $('#menu-toggle');
  const nav = $('#nav');
  function closeMenu() {
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
  }
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  });
  $$('.nav__link').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Подсветка активного раздела ---------- */
  const navLinks = $$('.nav__link');
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { threshold: 0.35 });
  ['why', 'rooms', 'activities', 'route', 'booking'].forEach(id => {
    const section = document.getElementById(id);
    if (section) sectionObserver.observe(section);
  });

  /* ---------- Активности и модальные окна ---------- */
  const ACTIVITIES = {
    banya: {
      title: 'Баня по-лесному',
      kicker: 'Пар и тишина',
      text: 'Небольшая дровяная баня на краю леса: мягкий пар, берёзовые веники и предбанник с видом на сосны. После бани — чай с травами и плед.',
      list: ['Дровяная печь-каменка', 'Веники и халаты включены', 'Тихие часы с 20:00', 'Можно заказать массаж'],
      art: '<svg viewBox="0 0 400 320"><rect width="400" height="320" fill="var(--r-wall-deep)"/><circle cx="310" cy="70" r="60" fill="var(--r-glow)" opacity=".45"/><path d="M0 250 70 110l70 140ZM60 250 130 80l72 170ZM280 250 340 100l60 150Z" fill="var(--r-pine)"/><rect x="60" y="170" width="280" height="120" rx="10" fill="var(--r-wood)"/><path d="M40 175 200 90l160 85Z" fill="#4c3321"/><rect x="130" y="210" width="60" height="80" rx="3" fill="#2a1d14"/><rect x="210" y="200" width="80" height="60" rx="4" fill="var(--r-glow)" opacity=".8"/><path d="M150 190c-20-20 14-28-4-52 30 18 44 36 38 52Z" fill="var(--r-flame)" opacity=".85"/></svg>'
    },
    tub: {
      title: 'Чан под звёздами',
      kicker: 'Вода и небо',
      text: 'Деревянный чан с горячей водой стоит вглубине сада. Вечером вокруг зажигаются свечи и гирлянда, а над вами — небо без города.',
      list: ['Температура 38–40 °C', 'Свечи и пледы рядом', 'Чай или глинтвейн', 'Включено в пакеты выходного дня'],
      art: '<svg viewBox="0 0 400 320"><rect width="400" height="320" fill="var(--r-wall-deep)"/><circle cx="80" cy="60" r="3" fill="#fff"/><circle cx="150" cy="40" r="2" fill="#fff"/><circle cx="300" cy="80" r="3" fill="#fff"/><circle cx="350" cy="35" r="2" fill="#fff"/><path d="M0 250 70 110l70 140ZM60 250 130 80l72 170ZM280 250 340 100l60 150Z" fill="var(--r-pine)"/><rect x="0" y="250" width="400" height="70" fill="var(--r-floor)"/><ellipse cx="200" cy="252" rx="120" ry="42" fill="var(--r-wood)"/><ellipse cx="200" cy="244" rx="104" ry="32" fill="var(--r-water)"/><path d="M150 190c-18-20 12-26-4-46M200 185c-16-18 10-26-4-48M250 195c-16-16 10-24-4-44" stroke="rgba(255,255,255,.4)" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'
    },
    trail: {
      title: 'Экотропы и бельчата',
      kicker: 'Прогулки',
      text: 'Три маршрута разной длины: от короткой тропы к ручью до двухчасового круга по хвойному лесу. По пути — кормушки, таблички с названиями мхов и бельчата.',
      list: ['Маршруты 1,5 / 3 / 6 км', 'Карты у ресепшена', 'Детская «беличья тропа»', 'Провожатый по запросу'],
      art: '<svg viewBox="0 0 400 320"><rect width="400" height="320" fill="var(--r-sky)"/><circle cx="310" cy="70" r="55" fill="var(--r-glow)" opacity=".6"/><path d="M0 240 70 90l70 150ZM60 240 130 60l72 180ZM280 240 340 80l60 160Z" fill="var(--r-pine)"/><rect x="0" y="240" width="400" height="80" fill="var(--r-pine)"/><path d="M-20 320C80 280 130 310 200 260s120-20 220-60" fill="none" stroke="var(--r-floor)" stroke-width="26" stroke-linecap="round"/><circle cx="120" cy="205" r="12" fill="#a56c43"/><path d="M116 195c-8-12 8-16 0-28M124 195c8-12-8-16 0-28" stroke="#a56c43" stroke-width="4" fill="none"/></svg>'
    },
    bbq: {
      title: 'Ужин при гирляндах',
      kicker: 'Общие вечера',
      text: 'Терраса с мангалом, большим столом и мягким светом. Приготовим ужин сами или поможем с продуктами — договориться можно заранее.',
      list: ['Мангал и дрова включены', 'Стол на 8–12 человек', 'Гирлянды и костровище', 'Сборка пакета для компании'],
      art: '<svg viewBox="0 0 400 320"><rect width="400" height="320" fill="var(--r-wall-deep)"/><path d="M0 250 70 100l70 150ZM60 250 130 70l72 180ZM280 250 340 90l60 160Z" fill="var(--r-pine)"/><rect x="0" y="250" width="400" height="70" fill="var(--r-floor)"/><path d="M20 80Q200 20 380 80" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/><g fill="var(--r-glow)"><circle cx="70" cy="66" r="6"/><circle cx="135" cy="49" r="6"/><circle cx="200" cy="42" r="6"/><circle cx="265" cy="49" r="6"/><circle cx="330" cy="66" r="6"/></g><rect x="120" y="220" width="160" height="10" rx="4" fill="var(--r-wood)"/><rect x="150" y="230" width="12" height="60" fill="var(--r-wood)"/><rect x="238" y="230" width="12" height="60" fill="var(--r-wood)"/><path d="M168 218c-10-24 14-26 4-48 24 18 34 32 28 48Z" fill="var(--r-flame)"/></svg>'
    }
  };

  let lastFocused = null;
  function openModal(modal) {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('is-locked');
    const closeBtn = $('.modal__close', modal);
    if (closeBtn) closeBtn.focus();
  }
  function closeModal(modal) {
    modal.hidden = true;
    if ($$('.modal:not([hidden])').length === 0) document.body.classList.remove('is-locked');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }
  $$('.activity-card').forEach(card => {
    card.addEventListener('click', () => {
      const data = ACTIVITIES[card.dataset.activity];
      if (!data) return;
      const modal = $('#activity-modal');
      $('#activity-modal-kicker').textContent = data.kicker;
      $('#activity-modal-title').textContent = data.title;
      $('#activity-modal-text').textContent = data.text;
      $('#activity-modal-art').innerHTML = data.art;
      $('#activity-modal-list').innerHTML = data.list.map(item => `<li>${item}</li>`).join('');
      openModal(modal);
      track('activity');
    });
  });
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', () => {
    const modal = el.closest('.modal');
    if (modal) closeModal(modal);
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = $('.modal:not([hidden])');
    if (open) closeModal(open);
  });

  const INFO = {
    policy: {
      title: 'Политика конфиденциальности',
      body: '<p>Мы обрабатываем только данные, которые вы оставляете в форме бронирования: имя, телефон, даты поездки и пожелания. Они нужны, чтобы подтвердить бронь и связаться с вами.</p><p>Мы не продаём и не передаём данные третьим лицам, кроме случаев, прямо предусмотренных законом. Вы можете попросить удалить свои данные, написав нам на <strong>hello@lesisvet.ru</strong>.</p><p>Здесь современная заглушка: перед публикацией замените текст на юридически корректную политику вашего отеля.</p>'
    },
    requisites: {
      title: 'Реквизиты',
      body: '<p><strong>Отель в лесу</strong> (демо-данные)</p><p>Адрес: Калужская область, Дзержинский район, д. Берёзовка</p><p>Телефон: +7 (999) 123-45-67 · E-mail: hello@lesisvet.ru</p><p>Реквизиты и юридическое название нужно заменить на реальные до запуска сайта.</p>'
    }
  };
  $$('[data-modal]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    const data = INFO[link.dataset.modal];
    if (!data) return;
    $('#info-modal-title').textContent = data.title;
    $('#info-modal-body').innerHTML = data.body;
    openModal($('#info-modal'));
  }));

  /* ---------- Детали парящих объектов ---------- */
  const OBJECT_INFO = {
    snow: {
      kicker: 'Снежинка · зимние активности',
      title: 'Зима, которую хочется трогать',
      text: 'Снежная тропа к ручью, чан с паром под звёздами, баня и тихие вечера у камина. Зимой в лесу особенно хорошо — проверено нашими гостями.',
      list: ['Баня и чан на открытом воздухе', 'Снежные прогулки и бельчата', 'Костерёк и глинтвейн', 'Праздничная программа 31.12'],
      cta: '#activities', ctaText: 'Смотреть активности', intent: 'activity',
      art: '<svg viewBox="0 0 400 320"><rect width="400" height="320" fill="#163a27"/><circle cx="310" cy="60" r="42" fill="#efc26d" opacity=".55"/><path d="M0 240 70 100l70 140ZM60 240 130 70l72 170ZM280 240 340 90l60 150Z" fill="#0f3020"/><rect x="0" y="240" width="400" height="80" fill="#dce7da"/><g stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"><path d="M60 40v34M43 57h34M48 45l24 24M72 45 48 69"/><path d="M170 30v26M157 43h26"/><path d="M340 150v30M325 165h30"/></g><rect x="200" y="170" width="90" height="70" fill="#6b4630"/><path d="M188 172 245 132l57 40Z" fill="#7a2c24"/><rect x="228" y="196" width="20" height="20" fill="#ffd184"/></svg>'
    },
    cone: {
      kicker: 'Шишка · зимний лес',
      title: 'Лес зимой — другой',
      text: 'Под снегом хвоя пахнет смолой, а следы белки ведут к кормушке. Утром мы расчищаем дорожки, а вечером зажигаем фонари у входа.',
      list: ['Дорога расчищается с 6:00', 'Подсвеченные дорожки', 'Кормушки и бельчата во дворе', 'Тёплые халаты после прогулки'],
      cta: '#route', ctaText: 'Как добраться зимой', intent: 'general',
      art: '<svg viewBox="0 0 400 320"><rect width="400" height="320" fill="#224f36"/><path d="M0 230 60 90l60 140ZM50 230 115 60l65 170ZM280 230 340 80l60 150Z" fill="#123a26"/><rect x="0" y="230" width="400" height="90" fill="#e4ebe0"/><path d="M40 320C120 270 150 300 230 250s110-20 170-50" fill="none" stroke="#c9d8c5" stroke-width="28"/><g fill="#8c623f"><path d="M190 130c14 9 21 24 21 42s-9 34-21 39c-12-5-21-21-21-39s7-33 21-42Z"/></g><path d="M177 158h26M174 176h32M180 194h20" stroke="#d5ad7d" stroke-width="3"/></svg>'
    },
    ornament: {
      kicker: 'Игрушка · новогодний пакет',
      title: 'Всё для праздника уже в номере',
      text: 'Украшенная ёлка, гирлянды, мандарины и сюрприз для детей. Три ночи, программа 31.12, баня и завтраки — осталось только приехать.',
      list: ['3 ночи в украшенном номере', 'Праздничная программа 31.12', 'Баня и завтраки включены', 'Скидка 16% по прямой брони'],
      cta: '#booking', ctaText: 'Забронировать пакет', intent: 'newyear',
      art: '<svg viewBox="0 0 400 320"><rect width="400" height="320" fill="#5c2522"/><path d="M20 80Q200 20 380 80" fill="none" stroke="rgba(255,224,168,.6)" stroke-width="2"/><g fill="#ffd47a"><circle cx="70" cy="64" r="6"/><circle cx="140" cy="47" r="6"/><circle cx="210" cy="40" r="6"/><circle cx="280" cy="47" r="6"/><circle cx="350" cy="64" r="6"/></g><path d="M0 260 80 110l80 150ZM60 260 130 80l70 180ZM260 260 330 100l70 160Z" fill="#16432c"/><circle cx="200" cy="215" r="62" fill="#c4382c"/><path d="M160 190c24-26 56-24 78-6" stroke="#f7b6a0" stroke-width="6" fill="none" opacity=".7"/><path d="M190 145h20v20h-20z" fill="#e6c98f"/><text x="200" y="228" font-size="26" text-anchor="middle" fill="#ffe0a8">✦</text></svg>'
    }
  };
  $$('.fx-item').forEach(btn => btn.addEventListener('click', () => {
    const data = OBJECT_INFO[btn.dataset.object];
    if (!data) return;
    $('#object-modal-kicker').textContent = data.kicker;
    $('#object-modal-title').textContent = data.title;
    $('#object-modal-text').textContent = data.text;
    $('#object-modal-art').innerHTML = data.art;
    $('#object-modal-list').innerHTML = data.list.map(item => `<li>${item}</li>`).join('');
    const cta = $('#object-modal-cta');
    cta.href = data.cta;
    cta.dataset.intent = data.intent;
    cta.innerHTML = `${data.ctaText} <svg class="btn__icon"><use href="#i-arrow"/></svg>`;
    openModal($('#object-modal'));
    track(btn.dataset.object === 'ornament' ? 'newyear' : 'activity');
  }));

  /* ---------- Интерактивная схема маршрута ---------- */
  const mapCanvas = $('#map-canvas');
  const mapLink = $('#map-link');
  const { lat, lon } = CONFIG.hotel.coords;
  const { lat: cityLat, lon: cityLon } = CONFIG.hotel.cityCoords;
  mapLink.href = `https://yandex.ru/maps/?rtext=${cityLat},${cityLon}~${lat},${lon}&rtt=auto&ll=${lon},${lat}&z=10`;
  let zoom = 1;
  function setZoom(value) {
    zoom = clamp(value, 1, 2.4);
    mapCanvas.style.setProperty('--zoom', zoom.toFixed(2));
  }
  $('#map-zoom-in').addEventListener('click', e => { e.stopPropagation(); setZoom(zoom + 0.25); });
  $('#map-zoom-out').addEventListener('click', e => { e.stopPropagation(); setZoom(zoom - 0.25); });
  mapCanvas.addEventListener('click', e => {
    if (e.target.closest('.route-map__controls')) return;
    window.open(mapLink.href, '_blank', 'noopener');
  });

  /* ---------- Контакты из конфигурации ---------- */
  $('#contact-phone').href = `tel:${CONFIG.hotel.phoneDigits}`;
  $('#contact-phone').querySelector('strong').textContent = CONFIG.hotel.phone;
  $('#contact-mail').href = `mailto:${CONFIG.hotel.email}`;
  $('#contact-mail').querySelector('strong').textContent = CONFIG.hotel.email;
  $('#contact-tg').href = CONFIG.hotel.telegram;
  $('#contact-tg').querySelector('strong').textContent = CONFIG.hotel.telegramLabel;
  $('#contact-wa').href = CONFIG.hotel.whatsapp;
  $('#contact-wa').querySelector('strong').textContent = CONFIG.hotel.phone;

  /* ---------- CTA и purpose формы ---------- */
  const purposeInput = $('#booking-purpose');
  const roomSelect = $('#room-choice');
  const messageInput = $('#guest-message');
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-intent]');
    if (!trigger) return;
    const intent = trigger.dataset.intent;
    if (intent === 'room') {
      const value = trigger.dataset.value || '';
      purposeInput.value = `Бронирование: ${value}`;
      roomSelect.value = value;
    } else if (intent === 'corporate') {
      purposeInput.value = 'Корпоративное предложение';
      if (!messageInput.value.trim()) messageInput.value = 'Хотим обсудить корпоратив: даты, количество гостей, программу.';
    } else if (intent === 'newyear') {
      purposeInput.value = 'Новогодний пакет со скидкой 16%';
      if (!messageInput.value.trim()) messageInput.value = 'Интересует пакет «Встреть Новый год в лесной сказке», 3 ночи.';
    } else if (intent === 'activity') {
      purposeInput.value = 'Бронирование с активностью';
    } else {
      purposeInput.value = 'Бронирование дат';
    }
    track(intent);
  });

  /* ---------- Форма бронирования ---------- */
  const form = $('#booking-form');
  const status = $('#form-status');
  const phoneInput = $('#guest-phone');

  phoneInput.addEventListener('input', () => {
    const digits = phoneInput.value.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
    if (!digits) { phoneInput.value = ''; return; }
    let out = '+7';
    if (digits.length > 1) out += ` (${digits.slice(1, 4)}`;
    if (digits.length >= 4) out += ')';
    if (digits.length > 4) out += ` ${digits.slice(4, 7)}`;
    if (digits.length > 7) out += `-${digits.slice(7, 9)}`;
    if (digits.length > 9) out += `-${digits.slice(9, 11)}`;
    phoneInput.value = out;
  });

  function setError(input, message) {
    const field = input.closest('.field');
    field.classList.toggle('has-error', Boolean(message));
    const error = $('[data-error-for]', field);
    if (error) error.textContent = message || '';
  }
  function validateForm() {
    let ok = true;
    const name = $('#guest-name');
    const dateIn = $('#date-in');
    const dateOut = $('#date-out');
    setError(name, name.value.trim().length < 2 ? 'Укажите имя' : '');
    const phoneDigits = phoneInput.value.replace(/\D/g, '');
    setError(phoneInput, phoneDigits.length < 11 ? 'Введите телефон полностью' : '');
    setError(dateIn, !dateIn.value ? 'Выберите дату заезда' : '');
    setError(dateOut, !dateOut.value ? 'Выберите дату выезда' : (dateIn.value && dateOut.value <= dateIn.value ? 'Выезд должен быть позже заезда' : ''));
    [name, phoneInput, dateIn, dateOut].forEach(input => { if (input.closest('.field').classList.contains('has-error')) ok = false; });
    return ok;
  }
  [$('#guest-name'), phoneInput, $('#date-in'), $('#date-out')].forEach(input => {
    input.addEventListener('input', () => setError(input, ''));
    input.addEventListener('change', () => setError(input, ''));
  });

  const today = new Date().toISOString().slice(0, 10);
  $('#date-in').min = today;
  $('#date-out').min = today;
  $('#date-in').addEventListener('change', e => {
    const next = new Date(e.target.value);
    next.setDate(next.getDate() + 1);
    $('#date-out').min = next.toISOString().slice(0, 10);
    if ($('#date-out').value && $('#date-out').value <= e.target.value) $('#date-out').value = '';
  });

  function buildPayload() {
    return {
      purpose: purposeInput.value,
      name: $('#guest-name').value.trim(),
      phone: phoneInput.value.trim(),
      dateIn: $('#date-in').value,
      dateOut: $('#date-out').value,
      guests: $('#guest-count').value,
      room: roomSelect.value,
      message: messageInput.value.trim(),
      page: window.location.href,
      theme: state.theme
    };
  }
  function mailtoFallback(payload) {
    const subject = encodeURIComponent(`Заявка: ${payload.purpose}`);
    const body = encodeURIComponent(
      `Имя: ${payload.name}\nТелефон: ${payload.phone}\nЗаезд: ${payload.dateIn}\nВыезд: ${payload.dateOut}\nГостей: ${payload.guests}\nНомер: ${payload.room}\nПожелания: ${payload.message || '—'}`
    );
    window.location.href = `mailto:${CONFIG.booking.mailto}?subject=${subject}&body=${body}`;
  }
  // Отправка в Google Таблицу через Apps Script (Web App).
  // JSONP: Google Apps Script не отдаёт CORS-заголовки, поэтому загружаем
  // ответ как <script> — так можно достоверно узнать, что строка добавлена.
  function sendToGoogleSheets(payload) {
    const url = new URL(CONFIG.booking.googleSheetsUrl);
    Object.entries(payload).forEach(([key, value]) => url.searchParams.append(key, String(value ?? '')));
    url.searchParams.append('submittedAt', new Date().toISOString());

    return new Promise((resolve, reject) => {
      const callback = `__sheetSubmit_${Date.now()}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 10000);
      function cleanup() {
        clearTimeout(timer);
        script.remove();
        delete window[callback];
      }
      window[callback] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('network')); };
      script.src = `${url.toString()}&callback=${callback}`;
      document.head.appendChild(script);
    });
  }

  async function sendBooking(payload) {
    const btn = form.querySelector('button[type="submit"]');
    const fields = $('#booking-form-fields');
    const success = $('#form-success');
    btn.disabled = true;
    status.textContent = 'Отправляем заявку…';
    let delivered = false;
    let failed = false;
    try {
      if (CONFIG.booking.googleSheetsUrl) {
        await sendToGoogleSheets(payload);
        delivered = true;
      }
      if (CONFIG.booking.endpoint) {
        const res = await fetch(CONFIG.booking.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) delivered = true;
      }
      const { telegramBotToken: token, telegramChatId: chat } = CONFIG.booking;
      if (token && chat) {
        const text = `Новая заявка · ${payload.purpose}\n${payload.name} · ${payload.phone}\n${payload.dateIn} → ${payload.dateOut} · ${payload.guests} гостей\n${payload.room}\n${payload.message || ''}`;
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text })
        });
        if (res.ok) delivered = true;
      }
    } catch (err) {
      failed = true;
      status.textContent = 'Не удалось отправить автоматически — откроем почту.';
    }
    btn.disabled = false;

    if (delivered) {
      form.reset();
      purposeInput.value = 'Бронирование дат';
      fields.hidden = true;
      success.hidden = false;
      track('submit');
      toast('Заявка принята ✦');
      return;
    }

    // Ни один канал не настроен — старый запасной вариант через почту.
    if (!failed && !CONFIG.booking.googleSheetsUrl && !CONFIG.booking.endpoint && !CONFIG.booking.telegramBotToken) {
      status.textContent = 'Заявка подготовлена — отправьте письмо в открывшемся почтовом клиенте.';
      mailtoFallback(payload);
      track('submit');
      return;
    }
    status.textContent = 'Отправка не удалась. Позвоните нам или напишите в Telegram.';
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm()) {
      status.textContent = '';
      const firstError = $('.field.has-error input', form);
      if (firstError) firstError.focus();
      return;
    }
    sendBooking(buildPayload());
  });
})();

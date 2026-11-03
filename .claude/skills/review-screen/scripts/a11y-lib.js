// In-page measuring kit, injected by ctx.kit(). Defines window.__a11y. Everything walks the
// composed tree, so Ionic's shadow DOM is included. Each function returns failures only, or a
// small report; numbers are measured, never guessed.
(() => {
  const parentOf = (el) =>
    el.assignedSlot || el.parentElement || (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);

  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratioOf = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const rgb = (c) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;

  // An Ionic button or item paints its fill and ink on the shadow `[part=native]`, not on the host
  // that holds the text. Reading the host gave false 1.2:1 failures on every honey button.
  const nativeOf = (el) => el.shadowRoot?.querySelector('[part="native"]') || null;

  const bgOf = (el) => {
    const layers = [];
    let opacity = 1;
    const native = nativeOf(el);
    if (native) {
      const bg = parse(getComputedStyle(native).backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
    }
    for (let n = el; n && !(layers.length && layers[layers.length - 1].a >= 1); n = parentOf(n)) {
      if (!(n instanceof Element)) continue;
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
    }
    const dark = document.documentElement.classList.contains('ion-palette-dark');
    let base = dark ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { bg: base, opacity };
  };

  const all = (root = document) => {
    const out = [];
    const walk = (node) => {
      for (const el of node.querySelectorAll('*')) {
        out.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    return out;
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    for (let n = el; n; n = parentOf(n)) {
      if (!(n instanceof Element)) continue;
      // Screen-reader-only text, and hex tiles (an SVG fill the CSS walk cannot see: use hexTiles()).
      if (n.classList.contains('mh-visually-hidden') || n.classList.contains('hex-content')) return false;
      if (getComputedStyle(n).opacity === '0') return false;
    }
    return true;
  };

  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
  const describe = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : '');

  window.__a11y = {
    /** WCAG ratio of two CSS colours, for one-off checks. */
    ratio: (a, b) => +ratioOf(parse(a), parse(b)).toFixed(2),

    /** Text under 4.5:1 (3:1 at 24px, or 18.66px bold) inside SCOPE (a selector) or the page. */
    contrast(scope) {
      const root = scope ? document.querySelector(scope) : document;
      if (!root) return [`no ${scope}`];
      const fails = [];
      for (const el of all(root)) {
        if (!ownText(el) || !visible(el)) continue;
        const native = nativeOf(el);
        const cs = getComputedStyle(el);
        const fg = parse(native ? getComputedStyle(native).color : cs.color);
        if (!fg) continue;
        const { bg, opacity } = bgOf(el);
        const ink = over({ ...fg, a: fg.a * opacity }, bg);
        const r = ratioOf(ink, bg);
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        if (r < need) fails.push({ text: ownText(el).slice(0, 40), el: describe(el), ratio: +r.toFixed(2), need, size, ink: rgb(ink), bg: rgb(bg) });
      }
      return fails;
    },

    /** Glyph or initials contrast on every hex tile in SCOPE: needs 3:1 for a glyph that carries meaning. */
    hexTiles(scope = 'body') {
      return [...document.querySelectorAll(`${scope} mh-hex-avatar`)].filter((h) => h.getBoundingClientRect().width > 0).map((h) => {
        const fill = getComputedStyle(h.querySelector('svg.hex > path')).fill;
        const icon = h.querySelector('.hex-content ion-icon');
        const text = h.querySelector('.hex-content');
        const ink = icon ? getComputedStyle(icon).color : text ? getComputedStyle(text).color : null;
        return { what: icon ? icon.getAttribute('name') : text ? text.textContent.trim() : 'image', fill, ratio: ink ? +ratioOf(parse(fill), parse(ink)).toFixed(2) : null };
      });
    },

    /** Label contrast of every open swipe option (open one first: `sliding.open('end')`). */
    swipeOptions() {
      return [...document.querySelectorAll('ion-item-option')].filter((o) => o.getBoundingClientRect().width > 0).map((o) => {
        const cs = getComputedStyle(o);
        return { label: o.textContent.trim(), color: o.getAttribute('color'), size: cs.fontSize, ratio: +ratioOf(parse(cs.backgroundColor), parse(cs.color)).toFixed(2) };
      });
    },

    /** Interactive things under 44 × 44 (the house `--mh-tap-target`; WCAG AA itself is 24). */
    targets(selector = 'ion-button, ion-item[button], ion-item-option, ion-back-button, ion-tab-button, button, a[href], [role="button"], ion-segment-button, ion-checkbox, ion-toggle') {
      const out = [];
      for (const el of all()) {
        if (!el.matches(selector) || !visible(el)) continue;
        if (el.tagName === 'BUTTON' && el.getRootNode() instanceof ShadowRoot) continue; // its host is measured
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) out.push({ el: describe(el), text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      }
      return out;
    },

    /** Tab order with names, through shadow roots. A (click) target missing here is keyboard-dead. */
    focusables() {
      const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
      return all().filter((el) => el.matches(sel) && visible(el)).map((el) => {
        const host = el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null;
        const name = el.getAttribute('aria-label') || (host || el).innerText?.trim().slice(0, 30) || el.getAttribute('placeholder') || '';
        return (host ? host.tagName.toLowerCase() + '>' : '') + el.tagName.toLowerCase() + ' "' + name.replace(/\n+/g, ' ') + '"';
      });
    },

    /** The names Ionic gets wrong by itself: searchbar inputs, back buttons, open sheets. */
    ionicNames() {
      return {
        searchbars: [...document.querySelectorAll('ion-searchbar')].filter((s) => s.offsetParent).map((s) => s.querySelector('input')?.getAttribute('aria-label')),
        backButtons: [...document.querySelectorAll('ion-back-button')].filter((b) => b.offsetParent).map((b) => b.shadowRoot?.querySelector('button')?.getAttribute('aria-label')),
        sheets: [...document.querySelectorAll('ion-modal.show-modal')].map((m) => ({
          dialog: m.shadowRoot?.querySelector('.modal-wrapper')?.getAttribute('aria-label'),
          title: m.querySelector('.heading-title')?.textContent.trim(),
        })),
      };
    },

    headings: () => all().filter((el) => /^H[1-6]$/.test(el.tagName) && el.getBoundingClientRect().width > 0).map((el) => el.tagName + ' ' + el.innerText.trim().slice(0, 40)),

    live: () => all().filter((el) => el.matches('[aria-live],[role=status],[role=alert]')).map((el) => (el.getAttribute('role') || 'live:' + el.getAttribute('aria-live')) + ' "' + el.textContent.trim().slice(0, 60) + '"'),

    /** Text under the 11px floor. */
    small() {
      return all().filter((el) => ownText(el) && visible(el) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => ({ text: ownText(el).slice(0, 30), size: getComputedStyle(el).fontSize }));
    },

    /** Row heights per list kind. A flat-list row is exactly 72px at 100% (4.5rem); a fraction off is a bug. */
    rows() {
      const heights = (sel) => [...new Set([...document.querySelectorAll(sel)].filter((i) => i.getBoundingClientRect().width > 0).map((i) => +i.getBoundingClientRect().height.toFixed(3)))];
      return { flat: heights('ion-list.mh-flat-list ion-item'), card: heights('ion-list.mh-card-list ion-item') };
    },

    /** Clipped content: scrollWidth past clientWidth where overflow is not visible and no ellipsis is meant. */
    overflow() {
      const out = [];
      for (const el of all()) {
        if (!visible(el)) continue;
        const cs = getComputedStyle(el);
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis') {
          out.push({ el: describe(el), sw: el.scrollWidth, cw: el.clientWidth, scrolls: cs.overflowX === 'auto' || cs.overflowX === 'scroll' });
        }
      }
      return out.slice(0, 20);
    },
  };
  return Object.keys(window.__a11y);
})();

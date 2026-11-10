/* ==========================================================================
   Case study slideshow – shared behaviour
   Works with any page that has the deck markup and <section class="slide">
   elements inside #stage. Nothing in here is specific to one case study.

   Optional settings, read from <body data-*>:
     data-return-url   where Close goes when the page was opened directly
                       and there is no ?return= or same-site referrer (default "/")
   ========================================================================== */
(function () {
  "use strict";

  var body = document.body;
  var RETURN_URL = body.getAttribute("data-return-url") || "/";
  var PREVIEW = body.hasAttribute("data-preview");

  var stage = document.getElementById("stage");
  var deck = document.getElementById("deck");
  var slides = Array.prototype.slice.call(stage.querySelectorAll(".slide"));
  var index = 0;

  /* ---------- donut charts ----------
     <div class="donut" style="--x:..;--y:..;--d:180"
          data-values="9,11" data-colors="#27be69,#295bff"></div>        */
  function polar(cx, cy, r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  function arc(cx, cy, r0, r1, a0, a1) {
    var big = a1 - a0 > Math.PI ? 1 : 0;
    var p0 = polar(cx, cy, r1, a0), p1 = polar(cx, cy, r1, a1);
    var p2 = polar(cx, cy, r0, a1), p3 = polar(cx, cy, r0, a0);
    return "M" + p0 + "A" + r1 + "," + r1 + " 0 " + big + " 1 " + p1 +
           "L" + p2 + "A" + r0 + "," + r0 + " 0 " + big + " 0 " + p3 + "Z";
  }
  function drawDonuts(root) {
    root.querySelectorAll(".donut").forEach(function (el) {
      if (el.querySelector("svg")) return;
      var vals = el.dataset.values.split(",").map(Number);
      var cols = el.dataset.colors.split(",");
      var start = parseFloat(el.dataset.start || "-90") * Math.PI / 180;
      var noLabels = el.dataset.labels === "none";
      var labels = el.dataset.labels && !noLabels ? el.dataset.labels.split(",") : null;
      var ringColor = el.dataset.ring || "#e8e8e6";          /* "none" hides the outer ring */
      var holeColor = el.dataset.hole || "#fff";
      var total = vals.reduce(function (a, b) { return a + b; }, 0);
      var d = 200, c = d / 2, rOut = 97, rIn = parseFloat(el.dataset.inner || "38"), ring = 100;
      var gap = parseFloat(el.dataset.gap || "0") * Math.PI / 180;  /* gap between slices, degrees */
      var svg = '<svg viewBox="0 0 ' + d + " " + d + '" aria-hidden="true">' +
        (ringColor === "none" ? "" : '<circle cx="' + c + '" cy="' + c + '" r="' + ring + '" fill="' + ringColor + '"/>') +
        '<circle cx="' + c + '" cy="' + c + '" r="' + rOut + '" fill="' + holeColor + '"/>';
      var a = start, mids = [];
      var shown = vals.filter(function (v) { return v > 0; }).length;
      vals.forEach(function (v, i) {
        var a1 = a + (v / total) * Math.PI * 2;
        if (v > 0) {
          var g = shown > 1 ? gap / 2 : 0;
          svg += '<path d="' + arc(c, c, rIn, rOut, a + g, a1 - g) + '" fill="' + cols[i] + '"/>';
        }
        mids.push((a + a1) / 2);
        a = a1;
      });
      svg += "</svg>";
      el.innerHTML = svg;
      if (noLabels) { el.setAttribute("role", "img"); return; }
      vals.forEach(function (v, i) {
        var txt = labels ? labels[i] : (Math.round(v / total * 1000) / 10) + "%";
        var p = polar(50, 50, 33.5, mids[i]);
        var s = document.createElement("span");
        s.className = "pct";
        s.textContent = txt;
        s.style.left = p[0] + "%";
        s.style.top = p[1] + "%";
        el.appendChild(s);
      });
      el.setAttribute("role", "img");
    });
  }
  drawDonuts(document);

  /* ---------- page numbers ----------
     Any element with class "js-page" inside a slide is filled with "07 / 20". */
  (function () {
    function p2(n) { return n < 10 ? "0" + n : String(n); }
    slides.forEach(function (s, i) {
      s.querySelectorAll(".js-page").forEach(function (el) { el.textContent = p2(i + 1) + " / " + p2(slides.length); });
    });
  })();

  /* ---------- capture mode (used to compare slides with the Figma export) ---------- */
  var cap = /[?&]capture=(\d+)/.exec(location.search);
  if (cap) {
    var n = parseInt(cap[1], 10) - 1;
    document.documentElement.style.background = "#fff";
    var c = slides[n].querySelector(".canvas");
    c.style.setProperty("--k", 1);
    var cs = /[?&]step=(\d+)/.exec(location.search);
    if (cs) { c.setAttribute("data-step", cs[1]); for (var j = 1; j <= +cs[1]; j++) c.classList.add("at-" + j); }
    document.body.innerHTML = "";
    document.body.appendChild(c);
    document.body.style.overflow = "hidden";
    return;
  }

  /* ---------- fill the screen ----------
     Slides are designed on a 1920 × 1080 artboard. On screens that are wider (or taller) than 16:9
     the artboard grows to the screen's shape instead of showing empty bands:
       · type keeps its size (the artboard is scaled so 1920 × 1080 always fits),
       · the side margins stay fixed and everything between them spreads out evenly,
       · images, icons and charts keep their size and stay centred where they were placed,
       · full-bleed panels and backgrounds reach the screen edges.
     Per-element override:  data-fit="fixed"   keep size, keep centre
                            data-fit="none"    leave exactly as authored
     Per-theme margins:     --fit-mx / --fit-my on .canvas (default 96 / 96)
     Per-theme density:     --fit-density on .canvas (default 1; 1.2 = smaller elements, more space)
     Limits: the artboard stretches to at most 1.5× wide and 1.25× tall; beyond that
     (ultra-wide monitors, phones held upright) the slide is centred on its own background colour. */
  var BASE_W = 1920, BASE_H = 1080, MAX_X = 1.5, MAX_Y = 1.25;
  /* Density (--fit-density on .canvas, default 1): above 1 the slide is shown smaller and the extra room
     goes into the gaps — 1.2 means every element is drawn 1/1.2 the size and the space between grows.
     Margins keep their on-screen size. */
  var FIXED = "img, svg, picture, video, canvas, .vec, .pic, .donut, .chip, .badge, .keys, .toggle, " +
              ".fr-img, .fr-square, .fr-chapter-num, .kn-img, .kn-dot, [data-fit=fixed]";
  var canvases = slides.map(function (s) { return s.querySelector(".canvas"); }).filter(Boolean);
  var items = [];
  canvases.forEach(function (c) {
    var cs = getComputedStyle(c);
    c._mx = parseFloat(cs.getPropertyValue("--fit-mx")) || 96;
    c._my = parseFloat(cs.getPropertyValue("--fit-my")) || 96;
    c._d = parseFloat(cs.getPropertyValue("--fit-density")) || 1;
    Array.prototype.forEach.call(c.children, function (el) {
      if (el.getAttribute("data-fit") === "none") return;
      if (getComputedStyle(el).position !== "absolute") return;
      var st = el.getAttribute("style") || "";
      items.push({
        el: el, c: c, style: st,
        fixed: el.matches(FIXED),
        // elements whose width is authored stretch with the slide; text that sizes itself only moves
        sizedW: !!el.style.width || !!(el.style.left && el.style.right) || /--w\s*:/.test(st) || el.matches(".fr-head, .kn-head, .box, .wrap, .center"),
        rightAnchored: !el.style.width && !!el.style.right && !el.style.left,
        // edge-to-edge pieces: panels, glows, pools and chapter numerals stretch with the slide itself
        bleed: el.matches(".fr-panel, .fr-glow, .fr-chapter-num, .kn-pool, .kn-rail, [data-fit=bleed]"),
        fixedH: !!el.style.height || /--h\s*:/.test(st) || el.classList.contains("fr-panel") || el.classList.contains("kn-pool") || el.classList.contains("box")
      });
    });
  });
  // piecewise map: the margin m (authored) becomes M (on the grown artboard), the middle stretches,
  // the far margin follows the edge
  function map(v, m, M, base, size) {
    if (v <= m) return v * M / m;
    if (v >= base - m) return size - (base - v) * M / m;
    return M + (v - m) * (size - 2 * M) / (base - 2 * m);
  }
  var lastKey = "";
  function fit(force) {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    var k0 = Math.min(w / BASE_W, h / BASE_H);
    stage.style.setProperty("--k", k0);
    var key = w + "x" + h;
    if (key === lastKey && force !== true) return;
    lastKey = key;
    // per canvas: its own density gives its own scale and artboard size
    canvases.forEach(function (c) {
      var d = c._d, k = k0 / d;
      var W = Math.round(Math.min(w / k, BASE_W * Math.max(MAX_X, d * 1.35)));
      var H = Math.round(Math.min(h / k, BASE_H * Math.max(MAX_Y, d * 1.12)));
      c._W = W; c._H = H;
      c.style.setProperty("--k", k);
      c.style.setProperty("--ox", ((w - W * k) / 2) + "px");
      c.style.setProperty("--oy", ((h - H * k) / 2) + "px");
    });
    // 1. back to the authored 1920 × 1080 layout and measure
    canvases.forEach(function (c) { c.style.width = BASE_W + "px"; c.style.height = BASE_H + "px"; });
    items.forEach(function (it) { if (it.style) it.el.setAttribute("style", it.style); else it.el.removeAttribute("style"); });
    items.forEach(function (it) {
      var e = it.el;
      it.x = e.offsetLeft; it.y = e.offsetTop; it.w = e.offsetWidth; it.h = e.offsetHeight;
    });
    // 2. grow each artboard and place everything on it
    canvases.forEach(function (c) {
      if (c._W === BASE_W && c._H === BASE_H) { c.style.width = ""; c.style.height = ""; }
      else { c.style.width = c._W + "px"; c.style.height = c._H + "px"; }
    });
    // 2a. horizontal: spread x and widths on the grown artboard
    items.forEach(function (it) {
      var c = it.c, W = c._W, H = c._H;
      if (W === BASE_W && H === BASE_H) return;
      var s = it.el.style, mx = c._mx, Mx = mx * c._d, x;
      s.right = "auto"; s.bottom = "auto";
      if (it.fixed) {
        x = map(it.x + it.w / 2, mx, Mx, BASE_W, W) - it.w / 2;
        s.left = x.toFixed(1) + "px";
        return;
      }
      x = map(it.x, mx, Mx, BASE_W, W);
      if (it.rightAnchored) {
        s.left = "auto"; s.right = (W - map(it.x + it.w, mx, Mx, BASE_W, W)).toFixed(1) + "px";
      } else {
        s.left = x.toFixed(1) + "px";
        if (it.sizedW) s.width = (map(it.x + it.w, mx, Mx, BASE_W, W) - x).toFixed(1) + "px";
      }
    });
    // wider columns wrap text into fewer lines: measure the real heights now
    items.forEach(function (it) {
      if (it.c._W === BASE_W && it.c._H === BASE_H) return;
      if (!it.fixed && !it.fixedH) it.h = it.el.offsetHeight;
    });
    /* vertical balance: blocks keep their height while the slide gets taller, so the extra height has
       to go into the gaps. Content is grouped into horizontal bands (blocks whose spans overlap move
       together, so shared tops stay aligned); the extra height is shared out between the gaps above,
       between and below the bands in proportion to their authored size, so tight pairs (a title and its
       subtitle) stay tight and big gaps grow. Tall side pieces (a phone, a chart column spanning most of
       the slide) sit in their own column and keep their centre. Full-bleed panels, glows and the big
       chapter numbers keep the edge-to-edge mapping. */
    /* Header anchoring: anything that starts above ANCHOR_Y on the artboard (the title, subtitle,
       eyebrow label, chapter square…) keeps a fixed distance from the top edge, so headings sit in the
       same place on every slide whatever the rest of the slide holds. Only the space below the header
       is shared out. Opt out per element with data-fit-v="flow"; data-fit-v="top" pins a tall block
       (a chart grid that starts beside the subtitle) to the header instead of centring it, and
       data-fit-v="center" keeps any block's centre (the phone group on a centred hero slide);
       data-fit-v="bottom" keeps a block's distance from the bottom edge (a hand-held phone that runs
       off the bottom, together with its annotations). */
    var ANCHOR_Y = 300;
    canvases.forEach(function (c) {
      var my = c._my, My = my * c._d, H = c._H, bot = BASE_H - my, tallH = 0.6 * (bot - my);
      var spans = [], anchorBot = my;
      items.forEach(function (it) {
        if (it.c !== c || it.bleed || it.y < my || it.h <= 0) return;
        var fv = it.el.getAttribute("data-fit-v");
        it.pinBottom = fv === "bottom";
        if (it.pinBottom) { it.tall = false; it.anchor = false; return; }
        // a "tall" piece is a side column (a phone, a chart stack) that keeps its centre; full-width
        // content rows are never tall, so they start on the shared content line instead
        it.tall = fv === "center" || (it.h > tallH && it.w < 0.6 * (BASE_W - 2 * c._mx) && fv !== "top");
        it.anchor = !it.tall && it.y < ANCHOR_Y && fv !== "flow";
        if (it.anchor) anchorBot = Math.max(anchorBot, Math.min(it.y + it.h, bot));
      });
      // anything that starts inside the header zone is part of the header too
      for (var grew = true; grew;) {
        grew = false;
        items.forEach(function (it) {
          if (it.c !== c || it.bleed || it.y < my || it.h <= 0 || it.tall || it.anchor || it.pinBottom) return;
          if (it.y < anchorBot - 0.5 && it.el.getAttribute("data-fit-v") !== "flow") { it.anchor = true; anchorBot = Math.max(anchorBot, Math.min(it.y + it.h, bot)); grew = true; }
        });
      }
      var top = anchorBot;
      items.forEach(function (it) {
        if (it.c !== c || it.bleed || it.y < my || it.h <= 0 || it.tall || it.anchor || it.pinBottom) return;
        var y0 = Math.max(it.y, top);
        if (it.y + it.h > top) spans.push([y0, Math.min(it.y + it.h, bot)]);
      });
      spans.sort(function (p, q) { return p[0] - q[0]; });
      var bands = [];
      spans.forEach(function (sp) {
        var l = bands[bands.length - 1];
        if (l && sp[0] <= l[1]) l[1] = Math.max(l[1], sp[1]); else bands.push([sp[0], sp[1]]);
      });
      var gaps = [], Bsum = 0, prev = top;
      bands.forEach(function (bd) { gaps.push(Math.max(0, bd[0] - prev)); Bsum += bd[1] - bd[0]; prev = Math.max(prev, bd[1]); });
      gaps.push(Math.max(0, bot - prev));
      /* The gap between the header and the first content row takes a fixed share (FIRST_SHARE) of the
         extra height, so content that is authored on the same line starts on the same line on every
         slide; the rest of the extra height is shared between the remaining gaps in proportion. */
      var Top = top * c._d, FIRST_SHARE = 0.25;
      var G = gaps.reduce(function (x, y) { return x + y; }, 0), G2 = (H - My - Top) - Bsum;
      var E = (H - 2 * My) - (bot - my) * c._d, g0 = bands.length ? Math.min(G2, Math.max(0, gaps[0] * c._d + Math.max(0, E) * FIRST_SHARE)) : 0;
      var Grest = G - (bands.length ? gaps[0] : 0), r = Grest > 0 ? (G2 - g0) / Grest : 1;
      var acc = Top;
      bands.forEach(function (bd, i) { acc += i === 0 ? g0 : gaps[i] * r; bd.push(acc); acc += bd[1] - bd[0]; });
      c._bands = bands;
      c._lin = (H - 2 * My) / (bot - my);
    });
    function bandY(c, v) {
      var bs = c._bands;
      for (var i = 0; i < bs.length; i++) if (v >= bs[i][0] - 0.5 && v <= bs[i][1] + 0.5) return bs[i][2] + (v - bs[i][0]);
      return c._my * c._d + (v - c._my) * c._lin;
    }
    function mapY(c, v) { var my = c._my; return v <= my ? v * c._d : bandY(c, v); }
    function placeY(it) {
      var c = it.c;
      if (it.pinBottom) return c._H - (BASE_H - it.y - it.h) * c._d - it.h;
      if (it.y < c._my || it.anchor) return it.y * c._d;
      if (it.tall) return c._my * c._d + (it.y + it.h / 2 - c._my) * c._lin - it.h / 2;
      return bandY(c, it.y);
    }
    // 2b. vertical
    items.forEach(function (it) {
      var c = it.c, W = c._W, H = c._H, my = c._my, My = my * c._d, s = it.el.style, y;
      if (W === BASE_W && H === BASE_H) return;
      if (it.bleed) {
        if (it.fixed) { y = map(it.y + it.h / 2, my, My, BASE_H, H) - it.h / 2; s.top = y.toFixed(1) + "px"; return; }
        y = map(it.y, my, My, BASE_H, H);
        s.top = y.toFixed(1) + "px";
        if (it.fixedH) s.height = (map(it.y + it.h, my, My, BASE_H, H) - y).toFixed(1) + "px";
        return;
      }
      y = placeY(it);
      if (it.tall) y = Math.max(My, Math.min(y, H - My - it.h));
      s.top = y.toFixed(1) + "px";
    });
    // 3. data-align-top="selector": move a block so its top lines up with another element on the same
    //    slide (e.g. a rule that sits inside a different block), whatever the screen shape.
    canvases.forEach(function (c) {
      c.querySelectorAll("[data-align-top]").forEach(function (el) {
        var t = c.querySelector(el.getAttribute("data-align-top")); if (!t) return;
        var y = 0, n = t;
        while (n && n !== c) { y += n.offsetTop; n = n.offsetParent; }
        el.style.top = y.toFixed(1) + "px";
      });
    });
  }
  function paintStage() {
    var c = slides[index] && slides[index].querySelector(".canvas");
    if (c) stage.style.backgroundColor = getComputedStyle(c).backgroundColor;
  }
  fit(true);
  if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(stage);
  else window.addEventListener("resize", function () { fit(); });
  // text and images can change size once fonts and pictures arrive: measure again
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(true); });
  window.addEventListener("load", function () { fit(true); });

  /* ---------- controls appear on mouse move, hide after a pause ---------- */
  var IDLE_MS = 2500, idleTimer, overControl = false;
  function hideControls() {
    if (overControl) return;
    deck.classList.remove("show-controls");
    deck.classList.add("idle");
  }
  function showControls(ms) {
    deck.classList.add("show-controls");
    deck.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(hideControls, ms || IDLE_MS);
  }
  document.addEventListener("mousemove", function () { showControls(); });
  document.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") showControls(3500); });
  document.querySelectorAll(".ov-btn").forEach(function (b) {
    b.addEventListener("mouseenter", function () { overControl = true; });
    b.addEventListener("mouseleave", function () { overControl = false; showControls(); });
  });
  document.documentElement.addEventListener("mouseleave", function () { overControl = false; hideControls(); });

  /* ---------- navigation ---------- */
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  var $ = function (id) { return document.getElementById(id); };

  slides.forEach(function (s, i) {
    s.setAttribute("role", "group");
    s.setAttribute("aria-roledescription", "slide");
    s.setAttribute("aria-label", (i + 1) + " of " + slides.length + ": " + (s.dataset.title || ""));
  });

  /* ---------- build steps ----------
     A slide with data-steps="N" plays N states before the deck moves on: → advances the step,
     ← steps back. Its canvas gets data-step="k" and classes at-1 … at-k for every step reached,
     which the CSS uses to reveal, hide or restyle things (see "Motion" in case-study.css).
     data-step-titles="First|Second" changes the name in the bottom bar per step. */
  function stepsOf(s) { return parseInt(s.getAttribute("data-steps"), 10) || 1; }
  /* data-step-nav="click" — the states are views of ONE slide, switched only by clicking its
     segment control; the arrow keys and the side buttons skip straight to the next / previous slide. */
  function keyStepped(s) { return s.getAttribute("data-step-nav") !== "click"; }
  function setStep(s, k, opts) {
    var n = stepsOf(s), c = s.querySelector(".canvas");
    k = Math.max(0, Math.min(k, n - 1));
    s._step = k;
    if (c) {
      c.setAttribute("data-step", k);
      for (var j = 1; j < n; j++) c.classList.toggle("at-" + j, j <= k);
    }
    // segment controls bound to steps: <button data-seg-step="1">  (aria-pressed follows the step)
    s.querySelectorAll("[data-seg-step]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(+b.getAttribute("data-seg-step") === k));
    });
    s.querySelectorAll("[data-step-toggle]").forEach(function (b) { b.setAttribute("aria-checked", String(k === 1)); });
    // videos marked data-step-video="k" play only on step k of an open slide, from the start each time it is picked
    var open = slides[index] === s;
    s.querySelectorAll("video[data-step-video]").forEach(function (v) {
      if (open && +v.getAttribute("data-step-video") === k) { try { v.currentTime = 0; } catch (e) {} var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
      else v.pause();
    });
    var titles = (s.getAttribute("data-step-titles") || "").split("|");
    var t = titles[k] || s.dataset.title || "";
    if (slides[index] === s) {
      $("slideTitle").textContent = t;
      if (opts && opts.announce) $("announcer").textContent = t;
    }
  }
  /* Slide intro order: number a slide's top-level blocks top-to-bottom, then left-to-right, as
     --intro-i (capped at 7) so the CSS can stagger their entrance. Done once per slide. */
  function introOrder(s) {
    if (!s || s._intro || s.getAttribute("data-intro") === "off") return;
    var c = s.querySelector(".canvas"); if (!c) return;
    Array.prototype.slice.call(c.children)
      .map(function (e) { return { e: e, b: Math.round(e.offsetTop / 60), x: e.offsetLeft }; })
      .sort(function (p, q) { return p.b - q.b || p.x - q.x; })
      .forEach(function (o, n) { o.e.style.setProperty("--intro-i", Math.min(n, 7)); });
    s._intro = true;
  }
  function hintKey(s) { return "cs-hint:" + (s.dataset.title || ""); }
  function hintSeen(s) { if (s._hinted) return true; try { return sessionStorage.getItem(hintKey(s)) === "1"; } catch (e) { return false; } }
  function markHint(s) { s._hinted = true; try { sessionStorage.setItem(hintKey(s), "1"); } catch (e) {} }
  function go(i, opts) {
    introOrder(slides[i]);
    opts = opts || {};
    if (i < 0 || i >= slides.length) return;
    var dir = i >= index ? 1 : -1;
    slides.forEach(function (el, k) {
      var on = k === i;
      el.style.setProperty("--from", (on ? dir * 2 : (k < i ? -2 : 2)) + "%");
      el.classList.toggle("is-active", on);
      if (on) el.removeAttribute("aria-hidden"); else el.setAttribute("aria-hidden", "true");
    });
    index = i;
    paintStage();
    // videos marked data-slide-video play only while their slide is open, and restart from 0 together when it opens
    // (so two recordings shown in turn with data-loop stay in step with the loop's timing)
    slides.forEach(function (el, k) {
      el.querySelectorAll("video[data-slide-video]").forEach(function (v) {
        if (k === i) { try { v.currentTime = 0; } catch (e) {} var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      });
    });
    slides.forEach(function (el, k) { if (k !== i) el.querySelectorAll("video[data-step-video]").forEach(function (v) { v.pause(); }); });
    $("current").textContent = pad(i + 1);
    $("progressFill").style.width = ((i + 1) / slides.length * 100) + "%";
    var to = slides[i];
    setStep(to, !keyStepped(to) ? (to._step || 0) : (opts.atEnd ? stepsOf(to) - 1 : 0));
    // first-visit hint: a slide holding a .fr-tg-tip shows it once (per browser session), shortly after it opens,
    // until its switch is used; leaving the slide hides it
    slides.forEach(function (el, k) { if (k !== i) { var cv = el.querySelector(".canvas"); if (cv) cv.classList.remove("hint"); } });
    if (to.querySelector(".fr-tg-tip") && !hintSeen(to)) {
      setTimeout(function () { if (slides[index] === to && !hintSeen(to)) { to.querySelector(".canvas").classList.add("hint"); markHint(to); } }, 1100);
    }
    ["prevBtn", "prevBtnM"].forEach(function (id) { $(id).disabled = i === 0; });
    ["nextBtn", "nextBtnM"].forEach(function (id) { $(id).disabled = i === slides.length - 1 && (stepsOf(slides[i]) < 2 || !keyStepped(slides[i])); });
    if (!opts.silent) $("announcer").textContent = "Slide " + (i + 1) + " of " + slides.length + ": " + (slides[i].dataset.title || "");
    try { history.replaceState(null, "", "#slide-" + (i + 1)); } catch (e) {}
  }
  function next() {
    var s = slides[index];
    if (keyStepped(s) && (s._step || 0) < stepsOf(s) - 1) setStep(s, s._step + 1, { announce: true });
    else go(index + 1);
  }
  function prev() {
    var s = slides[index];
    if (keyStepped(s) && (s._step || 0) > 0) setStep(s, s._step - 1, { announce: true });
    else go(index - 1, { atEnd: true });
  }
  // anything inside a slide marked .js-next acts like the → key (e.g. a "reveal" prompt)
  stage.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    if (e.target.closest(".js-next")) { e.preventDefault(); next(); return; }
    var seg = e.target.closest("[data-seg-step]");
    if (seg) { e.preventDefault(); setStep(slides[index], +seg.getAttribute("data-seg-step"), { announce: true }); return; }
    // <button data-step-toggle> flips a 2-state slide between state 0 and 1 (a switch); aria-checked follows the state
    var tg = e.target.closest("[data-step-toggle]");
    if (tg) { e.preventDefault(); var s = slides[index]; markHint(s); var cv = s.querySelector(".canvas"); if (cv) cv.classList.remove("hint"); setStep(s, (s._step || 0) ? 0 : 1, { announce: true }); return; }
    if (e.target.closest(".fr-tg-tip")) { var c2 = slides[index].querySelector(".canvas"); if (c2) c2.classList.remove("hint"); }
  });

  /* Close hands control back to whatever opened the deck:
     iframe overlay → message the parent; ?return=/page → go there;
     came from this site → back; otherwise → data-return-url. */
  function closeDeck() {
    if (PREVIEW) { toast("On your portfolio, Close returns visitors to the page they opened the case study from."); return; }
    if (window.parent && window.parent !== window) { window.parent.postMessage({ type: "case-study:close" }, "*"); return; }
    var ret = null;
    try { ret = new URLSearchParams(location.search).get("return"); } catch (e) {}
    if (ret && /^\/(?!\/)/.test(ret)) { location.href = ret; return; }
    var same = false;
    try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
    if (same && history.length > 1) { history.back(); return; }
    location.href = RETURN_URL;
  }

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.setAttribute("role", "status");
      toastEl.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);max-width:min(460px,calc(100vw - 32px));padding:12px 18px;border-radius:12px;background:#f2f4f9;color:#0c1324;font:500 14px/1.4 var(--ui-font);text-align:center;box-shadow:0 16px 40px rgba(0,0,0,.45);z-index:20;transition:opacity .25s;opacity:0";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg; toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = "0"; }, 3200);
  }

  /* "Press R to replay": any [data-restart] control jumps back to slide 1 (keyboard R does the same, see keydown) */
  document.querySelectorAll("[data-restart]").forEach(function (b) { b.addEventListener("click", function () { go(0); }); });
  $("closeBtn").addEventListener("click", closeDeck);
  $("prevBtn").addEventListener("click", prev);
  $("nextBtn").addEventListener("click", next);
  $("prevBtnM").addEventListener("click", prev);
  $("nextBtnM").addEventListener("click", next);

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": case "PageDown": case " ": case "Spacebar":
        if (e.key === " " && e.target.tagName === "BUTTON") return;
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp": e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); go(0); break;
      case "r": case "R": e.preventDefault(); go(0); break;
      case "End": e.preventDefault(); go(slides.length - 1); break;
      case "Escape": e.preventDefault(); closeDeck(); break;
    }
  });

  var sx = null, sy = null;
  stage.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); }
    sx = sy = null;
  }, { passive: true });

  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.type === "case-study:go" && typeof d.slide === "number") go(d.slide - 1);
  });

  $("total").textContent = pad(slides.length);
  var m = /^#slide-(\d+)$/.exec(location.hash);
  index = m ? Math.min(Math.max(parseInt(m[1], 10) - 1, 0), slides.length - 1) : 0;
  go(index, { silent: true });
  try { deck.focus({ preventScroll: true }); } catch (e) { deck.focus(); }
})();

/* Silly Spaces site script. No dependencies, no build step. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Theme toggle ----
     The inline script in <head> already applied the saved theme before paint,
     so this only wires the button. */
  var toggle = document.querySelector(".theme-toggle");
  function paintStatusBar() {
    var t = root.getAttribute("data-theme");
    if (!t) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute("content", t === "dark" ? "#1b1a18" : "#f6f3ed");
    });
  }
  paintStatusBar();
  if (toggle) {
    toggle.addEventListener("click", function () {
      var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var current = root.getAttribute("data-theme") || (systemDark ? "dark" : "light");
      var next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("ss-theme", next); } catch (e) {}
      paintStatusBar();
      toggle.setAttribute("aria-label", next === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }

  /* ---- Nav: hairline once you scroll, mobile menu ---- */
  var nav = document.querySelector(".nav");
  var links = document.querySelector(".nav-links");
  var menuBtn = document.querySelector(".menu-btn");

  function onScroll() {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var lockedY = 0;
  function closeMenu() {
    if (!links || !links.classList.contains("open")) return;
    links.classList.remove("open");
    document.body.classList.remove("menu-open");
    document.body.style.top = "";
    window.scrollTo(0, lockedY);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }
  if (menuBtn && links) {
    menuBtn.addEventListener("click", function () {
      var open = !links.classList.contains("open");
      if (!open) { closeMenu(); return; }
      lockedY = window.scrollY;
      links.classList.add("open");
      document.body.style.top = -lockedY + "px";
      document.body.classList.add("menu-open");
      menuBtn.setAttribute("aria-expanded", "true");
    });
    links.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
    window.addEventListener("resize", function () { if (window.innerWidth > 734) closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  /* ---- Hero people: wait for the logo to settle, then fade in one by
     one in a shuffled order (phone and desktop). ---- */
  var placing = /(?:\?|&)place=1(?:&|$)/.test(location.search);
  function revealPeople() {
    if (revealPeople.done) return;
    revealPeople.done = true;
    var figs = Array.prototype.slice.call(document.querySelectorAll(".scene-fig"));
    if (!figs.length) return;
    if (reduce || placing) {
      figs.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var i, j, tmp;
    for (i = figs.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = figs[i]; figs[i] = figs[j]; figs[j] = tmp;
    }
    figs.forEach(function (el, n) {
      setTimeout(function () { el.classList.add("is-in"); }, 160 + n * 240 + Math.random() * 80);
    });
  }
  if (reduce || placing || !document.querySelector(".hero .logo-anim")) {
    revealPeople();
  } else {
    setTimeout(revealPeople, 5600);
  }

  /* ---- Filmed logo: play once, drop the black, and hold the settled
     mark once the last heartbeat has finished. ---- */
  if (!reduce) {
    document.querySelectorAll(".logo-anim").forEach(function (video) {
      var mark = video.closest(".mark");
      var canvas = mark && mark.querySelector(".logo-canvas");
      if (!mark || !canvas) return;
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      var held = false;
      var easing = false;
      var running = false;
      var easeFrom = 2.62;
      var holdAt = 3;
      var span = holdAt - easeFrom;
      // ease-out cubic starts at normal speed and arrives at rest, so the
      // last heartbeat slows into the settled logo instead of cutting off
      var wall = span * 3;
      var easeAt = 0;
      var hiddenAt = 0;
      video.loop = false;
      video.muted = true;
      video.playsInline = true;
      // letters spring widest near the start; this crop keeps that and the rest
      var crop = { x: 280, y: 140, w: 1360, h: 800 };
      function size() {
        var rect = mark.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.max(1, Math.round(rect.width * dpr));
        var h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      }
      function draw() {
        if (video.readyState < 2) return;
        size();
        ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
        var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var d = img.data;
        var lit = 0;
        for (var i = 0; i < d.length; i += 4) {
          var m = Math.max(d[i], d[i + 1], d[i + 2]);
          if (m < 22) d[i + 3] = 0;
          else {
            if (m < 56) d[i + 3] = Math.round((m - 22) / 34 * 255);
            lit++;
          }
        }
        ctx.putImageData(img, 0, 0);
        if (lit > 40) mark.classList.add("is-video");
      }
      function frame() {
        if (held) { running = false; return; }
        if (video.readyState >= 2) {
          if (!easing && video.currentTime >= easeFrom) {
            easing = true;
            easeAt = performance.now();
          }
          if (easing) {
            var t = Math.min(1, (performance.now() - easeAt) / (wall * 1000));
            var rate = (span * 3 * (1 - t) * (1 - t)) / wall;
            if (t >= 1 || video.currentTime >= holdAt) {
              held = true;
              running = false;
              video.playbackRate = 1;
              video.pause();
              draw();
              if (mark.closest(".hero")) revealPeople();
              return;
            }
            video.playbackRate = Math.max(0.07, rate);
          }
          draw();
        }
        requestAnimationFrame(frame);
      }
      function start() {
        if (held || running) return;
        running = true;
        requestAnimationFrame(frame);
      }
      video.addEventListener("loadeddata", function () { draw(); start(); });
      video.addEventListener("canplay", draw);
      video.addEventListener("playing", start);
      var play = video.play();
      if (play && play.then) play.then(start, draw);
      window.addEventListener("resize", function () {
        if (mark.classList.contains("is-video")) draw();
      });
      document.addEventListener("visibilitychange", function () {
        if (held) return;
        if (document.hidden) {
          hiddenAt = performance.now();
          video.pause();
        } else {
          if (easing && hiddenAt) easeAt += performance.now() - hiddenAt;
          hiddenAt = 0;
          video.play();
          start();
        }
      });
    });
  }

  /* ---- Place mode (?place=1): drag people around, Shift-drag to rotate. ---- */
  if (placing && document.querySelector(".scene-fig")) {
    root.classList.add("is-placing");
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
    }
    var figs = Array.prototype.slice.call(document.querySelectorAll(".scene-fig"));
    var names = ["surgeon", "quebec", "paddle", "helmet", "grand", "matthew", "aidan", "kolbe", "amari", "julie", "paintbrush", "cake"];
    function figName(el) {
      for (var i = 0; i < names.length; i++) {
        if (el.classList.contains("scene-fig-" + names[i])) return names[i];
      }
      return "";
    }
    function figSel(el) {
      var n = figName(el);
      if (!n) return "";
      var section = el.closest("section[id]");
      return (section ? "#" + section.id + " " : "") + ".scene-fig-" + n;
    }
    function readVar(el, name, fallback) {
      var v = getComputedStyle(el).getPropertyValue(name).trim();
      var n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    }
    function apply(el, x, y, rot, s) {
      var maxS = el.classList.contains("scene-fig-cake") ? 2.4 : 1.6;
      el.style.setProperty("--fig-x", x.toFixed(0) + "px");
      el.style.setProperty("--fig-y", y.toFixed(0) + "px");
      el.style.setProperty("--fig-rot", rot.toFixed(1) + "deg");
      el.style.setProperty("--fig-s", Math.max(0.35, Math.min(maxS, s)).toFixed(2));
    }
    function dumpThought(fig) {
      var n = figName(fig);
      var thought = fig.querySelector(".fig-thought");
      if (!n || !thought) return "";
      var sel = figSel(fig);
      var cloud = thought.querySelector(".thought-cloud");
      var words = thought.querySelector(".thought-cloud-text");
      var lines = [
        sel + " .fig-thought { --thought-x: " + readVar(thought, "--thought-x", 0).toFixed(0) + "px; --thought-y: " + readVar(thought, "--thought-y", 0).toFixed(0) + "px; }",
        cloud ? sel + " .thought-cloud { --cloud-x: " + readVar(cloud, "--cloud-x", 0).toFixed(0) + "px; --cloud-y: " + readVar(cloud, "--cloud-y", 0).toFixed(0) + "px; --cloud-w: " + readVar(cloud, "--cloud-w", 196).toFixed(0) + "px; }" : "",
        words ? sel + " .thought-cloud-text { --text-x: " + readVar(words, "--text-x", 0).toFixed(0) + "px; --text-y: " + readVar(words, "--text-y", 0).toFixed(0) + "px; }" : ""
      ];
      return lines.filter(Boolean).join("\n");
    }
    function dumpCss() {
      var rules = figs.map(function (el) {
        var sel = figSel(el);
        if (!sel) return "";
        var line = sel + " { --fig-x: " + readVar(el, "--fig-x", 0).toFixed(0) + "px; --fig-y: " + readVar(el, "--fig-y", 0).toFixed(0) + "px; --fig-rot: " + readVar(el, "--fig-rot", 0).toFixed(1) + "deg; --fig-s: " + readVar(el, "--fig-s", 1).toFixed(2) + "; }";
        var thought = dumpThought(el);
        return thought ? line + "\n" + thought : line;
      }).filter(Boolean).join("\n");
      if (window.matchMedia("(max-width: 734px)").matches) {
        return "@media (max-width: 734px) {\n  " + rules.replace(/\n/g, "\n  ") + "\n}";
      }
      return rules;
    }
    var rotateMode = false;
    var sizeMode = false;
    var hud = document.createElement("div");
    hud.className = "place-hud";
    hud.innerHTML = "<p>Drag a person, a bubble, or the words.</p><button type=\"button\" class=\"btn btn-ghost place-rotate\" aria-pressed=\"false\">Rotate</button><button type=\"button\" class=\"btn btn-ghost place-size\" aria-pressed=\"false\">Size</button><button type=\"button\" class=\"btn btn-ghost place-copy\">Copy CSS</button><pre></pre>";
    document.body.appendChild(hud);
    var pre = hud.querySelector("pre");
    var copyBtn = hud.querySelector(".place-copy");
    var rotateBtn = hud.querySelector(".place-rotate");
    var sizeBtn = hud.querySelector(".place-size");
    function paintHud() { pre.textContent = dumpCss(); }
    paintHud();
    function setMode(mode) {
      rotateMode = mode === "rotate" ? !rotateMode : false;
      sizeMode = mode === "size" ? !sizeMode : false;
      rotateBtn.setAttribute("aria-pressed", rotateMode ? "true" : "false");
      sizeBtn.setAttribute("aria-pressed", sizeMode ? "true" : "false");
      rotateBtn.textContent = rotateMode ? "Rotating" : "Rotate";
      sizeBtn.textContent = sizeMode ? "Sizing" : "Size";
    }
    rotateBtn.addEventListener("click", function () { setMode("rotate"); });
    sizeBtn.addEventListener("click", function () { setMode("size"); });
    copyBtn.addEventListener("click", function () {
      var text = dumpCss();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { copyBtn.textContent = "Copied"; setTimeout(function () { copyBtn.textContent = "Copy CSS"; }, 1400); });
      }
    });
    function applyPiece(piece, x, y, w) {
      piece.style.setProperty("--cloud-x", x.toFixed(0) + "px");
      piece.style.setProperty("--cloud-y", y.toFixed(0) + "px");
      piece.style.setProperty("--cloud-w", Math.max(80, Math.min(360, w)).toFixed(0) + "px");
    }
    figs.forEach(function (el) {
      var thought = el.querySelector(".fig-thought");
      if (thought) {
        el.classList.add("is-in");
        thought.classList.add("is-on");
      }
      el.addEventListener("click", function (e) { e.preventDefault(); });
      el.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        if (e.target.closest(".fig-thought")) return;
        e.preventDefault();
        e.stopPropagation();
        var startX = e.clientX, startY = e.clientY;
        var ox = readVar(el, "--fig-x", 0), oy = readVar(el, "--fig-y", 0), orot = readVar(el, "--fig-rot", 0), os = readVar(el, "--fig-s", 1);
        var rotate = e.shiftKey || rotateMode;
        var sizing = sizeMode;
        el.classList.add("is-dragging");
        el.setPointerCapture(e.pointerId);
        function move(ev) {
          if (sizing) {
            apply(el, ox, oy, orot, os + (startY - ev.clientY) * 0.008);
          } else if (rotate) {
            apply(el, ox, oy, orot + (ev.clientX - startX) * 0.3, os);
          } else {
            apply(el, ox + (ev.clientX - startX), oy + (ev.clientY - startY), orot, os);
          }
          paintHud();
        }
        function up() {
          el.classList.remove("is-dragging");
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          paintHud();
        }
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      });
      if (!thought) return;
      Array.prototype.forEach.call(thought.querySelectorAll(".thought-cloud"), function (piece) {
        piece.addEventListener("pointerdown", function (e) {
          if (e.button !== 0) return;
          if (e.target.closest(".thought-cloud-text")) return;
          e.preventDefault();
          e.stopPropagation();
          var startX = e.clientX, startY = e.clientY;
          var ox = readVar(piece, "--cloud-x", 0);
          var oy = readVar(piece, "--cloud-y", 0);
          var ow = readVar(piece, "--cloud-w", 196);
          var s = readVar(el, "--fig-s", 1);
          var sizing = sizeMode;
          piece.classList.add("is-dragging");
          piece.setPointerCapture(e.pointerId);
          function move(ev) {
            if (sizing) {
              applyPiece(piece, ox, oy, ow + (startY - ev.clientY) * 0.45);
            } else {
              applyPiece(piece, ox + (ev.clientX - startX) * s, oy + (ev.clientY - startY) * s, ow);
            }
            paintHud();
          }
          function up() {
            piece.classList.remove("is-dragging");
            piece.removeEventListener("pointermove", move);
            piece.removeEventListener("pointerup", up);
            paintHud();
          }
          piece.addEventListener("pointermove", move);
          piece.addEventListener("pointerup", up);
        });
      });
      var words = thought.querySelector(".thought-cloud-text");
      if (words) {
        words.addEventListener("pointerdown", function (e) {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          var startX = e.clientX, startY = e.clientY;
          var ox = readVar(words, "--text-x", 0);
          var oy = readVar(words, "--text-y", 0);
          var s = readVar(el, "--fig-s", 1);
          words.classList.add("is-dragging");
          words.setPointerCapture(e.pointerId);
          function move(ev) {
            words.style.setProperty("--text-x", (ox + (ev.clientX - startX) * s).toFixed(0) + "px");
            words.style.setProperty("--text-y", (oy + (ev.clientY - startY) * s).toFixed(0) + "px");
            paintHud();
          }
          function up() {
            words.classList.remove("is-dragging");
            words.removeEventListener("pointermove", move);
            words.removeEventListener("pointerup", up);
            paintHud();
          }
          words.addEventListener("pointermove", move);
          words.addEventListener("pointerup", up);
        });
      }
    });
  }

  /* ---- Hangouts people speak once they scroll into view. ---- */
  (function () {
    if (placing) return;
    var figs = document.querySelectorAll("#events .scene-fig.has-thought");
    Array.prototype.forEach.call(figs, function (fig) {
      var thought = fig.querySelector(".fig-thought");
      if (!thought) return;
      var shown = false;
      var speakTimer = 0;
      var hideTimer = 0;
      function viewport() {
        var vv = window.visualViewport;
        return {
          w: (vv && vv.width) || window.innerWidth || 0,
          h: (vv && vv.height) || window.innerHeight || 0
        };
      }
      function overlap() {
        var r = fig.getBoundingClientRect();
        var v = viewport();
        return {
          w: Math.min(r.right, v.w) - Math.max(r.left, 0),
          h: Math.min(r.bottom, v.h) - Math.max(r.top, 0)
        };
      }
      function inView() {
        var o = overlap();
        return shown ? (o.w >= 16 && o.h >= 24) : (o.w >= 48 && o.h >= 80);
      }
      function speak() {
        speakTimer = 0;
        if (shown || !inView()) return;
        shown = true;
        fig.classList.add("is-in");
        thought.classList.remove("is-on");
        void thought.offsetWidth;
        thought.classList.add("is-on");
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          thought.classList.remove("is-on");
        }, 4100);
      }
      function maybeSpeak() {
        if (!inView()) {
          shown = false;
          if (speakTimer) { clearTimeout(speakTimer); speakTimer = 0; }
          if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
          thought.classList.remove("is-on");
          return;
        }
        if (shown || speakTimer) return;
        speakTimer = setTimeout(speak, reduce ? 0 : 80);
      }
      window.addEventListener("scroll", maybeSpeak, { passive: true });
      document.addEventListener("scroll", maybeSpeak, { passive: true, capture: true });
      window.addEventListener("resize", maybeSpeak);
      window.addEventListener("hashchange", maybeSpeak);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", maybeSpeak);
        window.visualViewport.addEventListener("scroll", maybeSpeak);
      }
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          var i;
          for (i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) { maybeSpeak(); return; }
          }
          maybeSpeak();
        }, { threshold: [0, 0.15, 0.35, 0.6, 1] }).observe(fig);
      }
      maybeSpeak();
      setInterval(maybeSpeak, 200);
    });
  })();

  /* ---- Hero logo: the two letters ease apart a touch as the hero
     scrolls out of view. --p is 0 at the top and 1 once the hero is gone. ---- */
  var heroMark = document.querySelector(".hero .mark");
  var hero = document.querySelector(".hero");
  if (heroMark && hero && !reduce) {
    var ticking = false;
    function setP() {
      var p = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.7 || 1)));
      heroMark.style.setProperty("--p", p.toFixed(3));
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(setP); }
    }, { passive: true });
    setP();
  }

  /* ---- Header brand appears once the big logo has scrolled under the bar.
     An observer, not a scroll handler, so it costs nothing per frame. ---- */
  var bigLogo = document.querySelector("main .mark.hero-logo");
  if (nav) {
    if (bigLogo && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        nav.classList.toggle("show-brand", !entries[0].isIntersecting);
      }, { rootMargin: "-" + nav.offsetHeight + "px 0px 0px 0px", threshold: 0 }).observe(bigLogo);
    } else {
      nav.classList.add("show-brand");
    }
  }

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -4% 0px", threshold: 0 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Join: swipe the form and sphere pages, with the next one peeking. ---- */
  (function () {
    var section = document.getElementById("join");
    var viewport = document.getElementById("join-viewport");
    if (!section || !viewport) return;
    var panels = [
      document.getElementById("join-panel-form"),
      document.getElementById("join-panel-sphere")
    ];
    var label = section.querySelector(".join-now");
    var dots = section.querySelectorAll(".join-pager span");
    var page = 0;
    var dragging = false;
    var pid = 0;
    var startX = 0;
    var startScroll = 0;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function snapLeft(el) {
      return Math.round(el.offsetLeft - (viewport.clientWidth - el.offsetWidth) / 2);
    }
    function go(p, instant) {
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      var el = panels[p];
      if (!el) return;
      viewport.scrollTo({ left: snapLeft(el), behavior: instant || reduceMotion ? "auto" : "smooth" });
    }
    function sync() {
      var view = viewport.getBoundingClientRect();
      var mid = view.left + view.width / 2;
      var next = 0;
      var best = Infinity;
      panels.forEach(function (el, i) {
        var box = el.getBoundingClientRect();
        var elMid = box.left + box.width / 2;
        var dist = Math.abs(elMid - mid);
        if (dist < best) { best = dist; next = i; }
        var t = 1 - Math.min(1, dist / Math.max(1, view.width * 0.62));
        t = t * t;
        el.style.opacity = String(0.18 + t * 0.82);
        el.style.setProperty("--in", String(t));
        el.classList.toggle("is-on", t > 0.55);
      });
      page = next;
      section.classList.toggle("is-sphere", page === 1);
      if (label) label.textContent = page === 1 ? "Sphere" : "Form";
      dots.forEach(function (dot, i) { dot.classList.toggle("is-on", i === page); });
    }
    viewport.addEventListener("scroll", sync, { passive: true });
    viewport.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (e.target.closest && e.target.closest("input, textarea, select, button, .join-card")) return;
      dragging = true;
      pid = e.pointerId;
      startX = e.clientX;
      startScroll = viewport.scrollLeft;
      viewport.classList.add("is-drag");
      try { viewport.setPointerCapture(pid); } catch (err) {}
    });
    viewport.addEventListener("pointermove", function (e) {
      if (!dragging || e.pointerId !== pid) return;
      viewport.scrollLeft = startScroll - (e.clientX - startX);
    });
    function stop(e) {
      if (!dragging || (e && e.pointerId !== pid)) return;
      dragging = false;
      viewport.classList.remove("is-drag");
      try { viewport.releasePointerCapture(pid); } catch (err) {}
      var w = viewport.clientWidth || 1;
      var dx = e.clientX - startX;
      if (dx < -w * 0.12) go(1, false);
      else if (dx > w * 0.12) go(0, false);
      else { sync(); go(page, false); }
    }
    viewport.addEventListener("pointerup", stop);
    viewport.addEventListener("pointercancel", stop);
    section.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1, false); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(0, false); }
    });
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () { go(i, false); });
    });
    var nextBtn = section.querySelector(".join-arrow-next");
    var prevBtn = section.querySelector(".join-arrow-prev");
    if (nextBtn) nextBtn.addEventListener("click", function () { go(1, false); });
    if (prevBtn) prevBtn.addEventListener("click", function () { go(0, false); });
    var cardBtns = section.querySelectorAll(".join-card");
    var cardList = section.querySelector(".join-cards");
    function closeCards() {
      cardBtns.forEach(function (c) {
        c.classList.remove("is-open");
        c.setAttribute("aria-selected", "false");
      });
    }
    cardBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = btn.classList.contains("is-open");
        closeCards();
        if (!open) {
          btn.classList.add("is-open");
          btn.setAttribute("aria-selected", "true");
        }
      });
    });
    document.addEventListener("click", function (e) {
      if (!cardList || cardList.contains(e.target)) return;
      closeCards();
    });
    section.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeCards();
    });
    window.addEventListener("resize", function () { go(page, true); });
    requestAnimationFrame(function () {
      if (location.hash === "#sphere" || location.hash === "#join-sphere") go(1, true);
      else go(0, true);
      sync();
    });
  })();

  /* ---- Paintbrush man fades in with the other people once Join is in view. ---- */
  (function () {
    var el = document.querySelector("#join .scene-fig-paintbrush");
    if (!el) return;
    if (reduce || placing) {
      el.classList.add("is-in");
      return;
    }
    function show() { el.classList.add("is-in"); }
    function inView() {
      var r = el.getBoundingClientRect();
      return r.bottom > 40 && r.top < window.innerHeight - 20;
    }
    function check() {
      if (!inView()) return;
      show();
      window.removeEventListener("scroll", check);
    }
    window.addEventListener("scroll", check, { passive: true });
    requestAnimationFrame(check);
  })();

  /* ---- Join form: posts into the Silly Space Friend Forum Google Form
     without leaving the site. ---- */
  var form = document.getElementById("join-form");
  if (form) {
    function formNote(html) {
      var note = form.querySelector(".form-note") || form.appendChild(document.createElement("p"));
      note.className = "form-note";
      note.innerHTML = html;
    }
    var sending = false;
    form.addEventListener("submit", function (e) {
      var honey = form.querySelector(".honey");
      if (honey && honey.value) {
        e.preventDefault();
        return;
      }
      if (!window.fetch || !window.URLSearchParams) return;
      e.preventDefault();
      if (sending) return;
      sending = true;
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending\u2026"; }
      var data = new FormData(form);
      data.delete("company");
      fetch(form.getAttribute("action"), { method: "POST", mode: "no-cors", body: new URLSearchParams(data) })
        .then(function () { window.location.href = "/thanks.html"; })
        .catch(function () {
          sending = false;
          if (btn) { btn.disabled = false; btn.textContent = label; }
          formNote('That didn\u2019t send. Try again, or message <a href="https://instagram.com/silly.spaces" target="_blank" rel="noopener">@silly.spaces</a>.');
        });
    });
  }

  /* ---- Partners: search box plus Places / Businesses / People labels ---- */
  (function () {
    var box = document.getElementById("partners");
    if (!box) return;
    var q = document.getElementById("partner-q");
    var list = box.querySelector(".partner-list");
    var none = box.querySelector(".partner-none");
    var ghosts = box.querySelector(".partner-ghosts");
    var chips = box.querySelectorAll(".partner-kinds [data-kind]");
    if (!q || !list) return;
    var items = list.querySelectorAll(":scope > li");
    var TOP = 3;

    function fold(s) {
      return (s || "").toLowerCase()
        .replace(/['’`]/g, "'")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function apply() {
      var query = fold(q.value).split(" ").filter(Boolean);
      var kinds = [];
      chips.forEach(function (c) {
        if (c.getAttribute("aria-pressed") === "true") kinds.push(c.getAttribute("data-kind"));
      });
      var filtering = query.length > 0 || kinds.length > 0;
      var shown = 0;
      items.forEach(function (li) {
        var kind = li.getAttribute("data-kind") || "";
        var hay = fold(li.getAttribute("data-q") || li.textContent);
        var okKind = !kinds.length || kinds.indexOf(kind) !== -1;
        var okQ = !query.length || query.every(function (w) { return hay.indexOf(w) !== -1; });
        var on = okKind && okQ;
        li.hidden = !on;
        li.classList.remove("is-faded");
        if (on) {
          shown += 1;
          if (!filtering && shown > TOP) li.classList.add("is-faded");
        }
      });
      var cap = !filtering && shown > TOP;
      list.classList.toggle("is-empty", shown === 0);
      list.classList.toggle("is-capped", cap);
      list.style.maxHeight = "";
      if (ghosts) ghosts.hidden = cap;
      if (none) none.hidden = shown !== 0;
    }

    q.addEventListener("input", apply);
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var on = c.getAttribute("aria-pressed") !== "true";
        c.setAttribute("aria-pressed", on ? "true" : "false");
        apply();
      });
    });
    apply();
  })();

  /* ---- FAQ: animate open and close instead of snapping ---- */
  document.querySelectorAll(".faq details, .partner-list details").forEach(function (d) {
    var summary = d.querySelector("summary");
    var answer = d.querySelector(".answer");
    if (!summary || !answer || reduce) return;
    var anim = null;
    summary.addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        var href = link.getAttribute("href");
        if (!href) return;
        if (link.target === "_blank") window.open(href, "_blank", "noopener,noreferrer");
        else location.href = href;
        return;
      }
      e.preventDefault();
      if (anim) anim.cancel();
      var opening = !d.open;
      if (opening) d.open = true;
      var start = opening ? 0 : answer.offsetHeight;
      var end = opening ? answer.scrollHeight : 0;
      answer.style.height = start + "px";
      answer.style.overflow = "hidden";
      anim = answer.animate([{ height: start + "px", opacity: opening ? 0 : 1 }, { height: end + "px", opacity: opening ? 1 : 0 }],
        { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      anim.onfinish = function () {
        answer.style.height = "";
        answer.style.overflow = "";
        if (!opening) d.open = false;
        anim = null;
      };
    });
  });

  /* ---- Lightbox on event pages: the photo grid opens it at the clicked photo ---- */
  var lb = document.getElementById("lightbox");
  var grid = document.querySelector(".photo-grid");
  if (lb && grid && typeof lb.showModal === "function") {
    var photosWrap = lb.querySelector(".lb-photos");
    var dots = lb.querySelector(".lb-dots");
    var imgs = Array.prototype.map.call(grid.querySelectorAll(".photo"), function (b) { return b.getAttribute("data-src"); });
    var idx = 0;
    imgs.forEach(function (src) {
      var im = document.createElement("img"); im.src = src; im.alt = ""; photosWrap.appendChild(im);
      dots.appendChild(document.createElement("i"));
    });
    lb.querySelectorAll(".lb-arrow").forEach(function (a) { a.hidden = imgs.length < 2; });
    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      photosWrap.querySelectorAll("img").forEach(function (im, k) { im.classList.toggle("on", k === idx); });
      dots.querySelectorAll("i").forEach(function (dot, k) { dot.classList.toggle("on", k === idx); });
    }
    grid.querySelectorAll(".photo").forEach(function (b) {
      b.addEventListener("click", function () { show(parseInt(b.getAttribute("data-index"), 10) || 0); lb.showModal(); });
    });
    var photoParam = /(?:\?|&)photo=(\d+)/.exec(location.search);
    if (photoParam) {
      show(parseInt(photoParam[1], 10) || 0);
      lb.showModal();
    }
    lb.querySelector(".prev").addEventListener("click", function () { show(idx - 1); });
    lb.querySelector(".next").addEventListener("click", function () { show(idx + 1); });
    lb.querySelector(".lb-close").addEventListener("click", function () { lb.close(); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
    var touchX = null;
    photosWrap.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    photosWrap.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 40) show(dx < 0 ? idx + 1 : idx - 1);
    }, { passive: true });
  }

  /* ---- FAQ hides itself, and its links, until it has questions ---- */
  var faq = document.getElementById("faq");
  if (faq && !faq.querySelector("details")) {
    faq.hidden = true;
    document.querySelectorAll('a[href$="#faq"]').forEach(function (a) { var li = a.closest("li"); (li || a).hidden = true; });
  }

  /* ---- Bounty board hides its links when there is nothing up ---- */
  var bounty = document.getElementById("bounty");
  if (bounty && !bounty.querySelector(".bounty-flier")) {
    bounty.hidden = true;
    document.querySelectorAll('a[href$="#bounty"]').forEach(function (a) { var li = a.closest("li"); (li || a).hidden = true; });
  }

  /* ---- Bounty fliers: zoom off the cork board, then mail from the open flier ---- */
  var zoom = document.getElementById("bounty-zoom");
  if (bounty && zoom && typeof zoom.showModal === "function") {
    var zoomImg = zoom.querySelector("img");
    var help = zoom.querySelector(".bounty-zoom-help");
    var closeBtn = zoom.querySelector(".bounty-zoom-close");
    var source = null;
    var closing = false;
    var zoomEnd = null;
    var easeZoom = "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)";
    function invert(from, to) {
      var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      var sx = from.width / Math.max(to.width, 1);
      var sy = from.height / Math.max(to.height, 1);
      return "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
    }
    function clearZoomEnd() {
      if (zoomEnd) {
        zoomImg.removeEventListener("transitionend", zoomEnd);
        zoomEnd = null;
      }
    }
    function readyHelp() {
      zoom.classList.add("is-in");
      if (help) help.removeAttribute("tabindex");
    }
    function openFlier(btn) {
      var thumb = btn.querySelector("img");
      if (!thumb) return;
      source = btn;
      closing = false;
      clearZoomEnd();
      zoom.classList.remove("is-in");
      zoomImg.src = btn.getAttribute("data-src") || thumb.currentSrc || thumb.src;
      zoomImg.alt = thumb.alt || "";
      if (help) {
        help.href = btn.getAttribute("data-mail") || "mailto:sillyspacesww@gmail.com";
        help.setAttribute("tabindex", "-1");
      }
      btn.classList.add("is-open");
      zoom.showModal();
      if (closeBtn) closeBtn.focus();
      var from = thumb.getBoundingClientRect();
      var to = zoomImg.getBoundingClientRect();
      if (reduce || to.width < 2) {
        readyHelp();
        return;
      }
      zoomImg.style.transition = "none";
      zoomImg.style.transform = invert(from, to);
      zoomImg.getBoundingClientRect();
      zoomImg.style.transition = easeZoom;
      zoomImg.style.transform = "none";
      zoomEnd = function (e) {
        if (e.propertyName && e.propertyName !== "transform") return;
        clearZoomEnd();
        readyHelp();
      };
      zoomImg.addEventListener("transitionend", zoomEnd);
    }
    function closeFlier() {
      if (closing || !zoom.open) return;
      closing = true;
      clearZoomEnd();
      zoom.classList.remove("is-in");
      if (help) help.setAttribute("tabindex", "-1");
      var thumb = source && source.querySelector("img");
      function finish() {
        zoom.close();
        zoomImg.style.transition = "";
        zoomImg.style.transform = "";
        if (source) source.classList.remove("is-open");
        source = null;
        closing = false;
      }
      if (!thumb || reduce) { finish(); return; }
      var from = zoomImg.getBoundingClientRect();
      var to = thumb.getBoundingClientRect();
      zoomImg.style.transition = "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
      zoomImg.style.transform = invert(to, from);
      zoomEnd = function (e) {
        if (e.propertyName && e.propertyName !== "transform") return;
        clearZoomEnd();
        finish();
      };
      zoomImg.addEventListener("transitionend", zoomEnd);
    }
    bounty.querySelectorAll(".bounty-flier").forEach(function (btn) {
      btn.addEventListener("click", function () { openFlier(btn); });
    });
    if (closeBtn) closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeFlier(); });
    if (help) help.addEventListener("click", function (e) { e.stopPropagation(); });
    zoomImg.addEventListener("click", closeFlier);
    zoom.addEventListener("click", function (e) { if (e.target === zoom) closeFlier(); });
    zoom.addEventListener("cancel", function (e) {
      e.preventDefault();
      closeFlier();
    });
  }

  /* ---- Auto-hide upcoming events once their date has passed ---- */
  var today = new Date(); today.setHours(0, 0, 0, 0);
  document.querySelectorAll("#event-carousel .slide[data-kind='up'][data-date]").forEach(function (card) {
    var d = new Date(card.getAttribute("data-date") + "T23:59:59");
    if (d < today) card.remove();
  });
  // a slide with no date yet (still ??/??/??) has no data-date, so count what is left
  var emptyMsg = document.getElementById("no-events");
  if (emptyMsg) emptyMsg.hidden = document.querySelectorAll("#event-carousel .slide").length > 0;

  /* ---- Events carousel: looping row, upcoming starts in the middle ---- */
  var carousel = document.getElementById("event-carousel");
  if (carousel) {
    var viewport = carousel.querySelector(".car-viewport");
    var track = carousel.querySelector(".car-track");
    var real = Array.prototype.filter.call(track.children, function (el) { return el.classList.contains("slide"); });
    var n = real.length;
    var detail = document.getElementById("car-detail");
    var dragged = false;
    var upAt = 0;
    for (var u = 0; u < n; u++) {
      if (real[u].getAttribute("data-kind") === "up") { upAt = u; break; }
    }
    // Three copies of the row: clones | real | clones. Stepping off either
    // end jumps back into the middle copy so the loop never runs out.
    var current = n > 1 ? n + upAt : 0;
    if (n > 1) {
      function markClone(clone) {
        clone.setAttribute("data-clone", "");
        clone.setAttribute("aria-hidden", "true");
        if (clone.tabIndex >= 0) clone.tabIndex = -1;
        return clone;
      }
      var i;
      for (i = 0; i < n; i++) track.appendChild(markClone(real[i].cloneNode(true)));
      for (i = n - 1; i >= 0; i--) track.insertBefore(markClone(real[i].cloneNode(true)), track.firstChild);
    }
    var glowCache = {};
    function glowFrom(img) {
      var src = img.currentSrc || img.src;
      if (glowCache[src]) return glowCache[src];
      var size = 32;
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      var ctx = canvas.getContext("2d");
      if (!ctx) return "rgba(180,160,120,0.4)";
      try {
        ctx.drawImage(img, 0, 0, size, size);
        var data = ctx.getImageData(0, 0, size, size).data;
      } catch (e) {
        return "rgba(180,160,120,0.4)";
      }
      var counts = {}, sums = {}, i, r, g, b, max, min, sat, key, best = null, nBest = 0;
      for (i = 0; i < data.length; i += 4) {
        r = data[i]; g = data[i + 1]; b = data[i + 2];
        max = Math.max(r, g, b); min = Math.min(r, g, b);
        if (max < 32 || min > 228) continue;
        sat = max === min ? 0 : (max - min) / Math.max(max, 1);
        if (sat < 0.16) continue;
        key = (r >> 4) + "," + (g >> 4) + "," + (b >> 4);
        counts[key] = (counts[key] || 0) + sat * sat;
        if (!sums[key]) sums[key] = [0, 0, 0, 0];
        sums[key][0] += r; sums[key][1] += g; sums[key][2] += b; sums[key][3] += 1;
      }
      for (key in counts) if (counts[key] > nBest) { nBest = counts[key]; best = key; }
      if (!best) return glowCache[src] = "rgba(180,160,120,0.4)";
      r = sums[best][0] / sums[best][3];
      g = sums[best][1] / sums[best][3];
      b = sums[best][2] / sums[best][3];
      var avg = (r + g + b) / 3;
      r = Math.round(Math.max(0, Math.min(255, avg + (r - avg) * 1.3)));
      g = Math.round(Math.max(0, Math.min(255, avg + (g - avg) * 1.3)));
      b = Math.round(Math.max(0, Math.min(255, avg + (b - avg) * 1.3)));
      return glowCache[src] = "rgba(" + r + "," + g + "," + b + ",0.5)";
    }
    function paintGlow(slide) {
      var img = slide.querySelector("img");
      if (!img || slide.classList.contains("no-photos")) return;
      function apply() {
        if (!img.naturalWidth) return;
        slide.style.setProperty("--glow", glowFrom(img));
      }
      if (img.complete) apply();
      else img.addEventListener("load", apply);
    }
    Array.prototype.forEach.call(track.children, paintGlow);
    function slides() { return track.children; }
    function paintDetail(slide) {
      if (!detail || !slide) return;
      var cap = slide.querySelector(".cap");
      var kind = slide.getAttribute("data-kind") || "";
      if (!cap) { detail.innerHTML = ""; return; }
      detail.innerHTML = cap.innerHTML;
      var kicker = detail.querySelector(".kicker");
      if (kicker) kicker.classList.add(kind);
      if (kind === "past") {
        detail.querySelectorAll(".tag").forEach(function (el) { el.classList.add("pink"); });
      }
    }
    function trackX() {
      var m = /translate3d\(([-\d.]+)px/.exec(track.style.transform || "");
      return m ? parseFloat(m[1]) : 0;
    }
    var wrapTimer = 0;
    function wrapIfClone() {
      if (n < 2) return false;
      if (current < n) { current += n; move(true); return true; }
      if (current >= n * 2) { current -= n; move(true); return true; }
      return false;
    }
    function move(jump) {
      if (current < 0) current = 0;
      if (current > slides().length - 1) current = slides().length - 1;
      var slide = slides()[current];
      if (!slide) return;
      viewport.scrollLeft = 0;
      if (jump) track.classList.add("is-jump");
      Array.prototype.forEach.call(slides(), function (el, i) {
        el.classList.toggle("is-active", i === current);
      });
      var ph = slide.querySelector(".ph") || slide;
      var view = viewport.getBoundingClientRect();
      var box = ph.getBoundingClientRect();
      var next = trackX() + (view.left + view.width / 2) - (box.left + box.width / 2);
      track.style.transform = "translate3d(" + Math.round(next) + "px,0,0)";
      if (jump) {
        track.getBoundingClientRect();
        track.classList.remove("is-jump");
      }
      paintDetail(slide);
      clearTimeout(wrapTimer);
      if (!jump && n > 1 && (current < n || current >= n * 2)) {
        wrapTimer = setTimeout(wrapIfClone, reduce ? 0 : 720);
      }
    }
    function step(dir) {
      if (n < 2) return;
      wrapIfClone();
      current += dir;
      move(false);
    }
    track.addEventListener("transitionend", function (e) {
      if (e.target !== track || e.propertyName !== "transform") return;
      wrapIfClone();
    });
    var prevBtn = carousel.querySelector(".prev");
    var nextBtn = carousel.querySelector(".next");
    if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });
    if (n < 2) carousel.querySelectorAll(".car-nav").forEach(function (b) { b.hidden = true; });
    var startX = null;
    viewport.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX;
      dragged = false;
    });
    viewport.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) { dragged = true; step(dx < 0 ? 1 : -1); }
    });
    viewport.addEventListener("pointercancel", function () { startX = null; });
    track.addEventListener("click", function (e) {
      if (dragged) { e.preventDefault(); dragged = false; return; }
      var slide = e.target.closest(".slide");
      if (!slide) return;
      var idx = Array.prototype.indexOf.call(track.children, slide);
      if (slide.hasAttribute("data-clone") || !slide.classList.contains("is-active")) {
        e.preventDefault();
        if (idx >= 0 && idx !== current) { current = idx; move(false); }
      }
    });
    carousel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    });
    carousel.goToQuiet = function (el) {
      var idx = real.indexOf(el);
      if (idx < 0) return;
      current = n > 1 ? idx + n : 0;
      move(false);
    };
    carousel.goTo = function (el) {
      carousel.goToQuiet(el);
      carousel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    };
    window.addEventListener("resize", function () { move(true); });
    move(true);
  }

  /* ---- Calendar toggle: closed by default so Upcoming stays one card ---- */
  var calToggle = document.querySelector(".cal-toggle");
  var calBox = document.getElementById("calendar");
  if (calToggle && calBox) {
    var calAnim = null;
    calToggle.addEventListener("click", function () {
      var opening = calBox.hidden;
      if (calAnim) calAnim.cancel();
      calToggle.setAttribute("aria-expanded", String(opening));
      calToggle.textContent = opening ? "Hide the calendar" : "Show the calendar";
      if (reduce) { calBox.hidden = !opening; return; }
      if (opening) calBox.hidden = false;
      var end = opening ? calBox.scrollHeight : 0, start = opening ? 0 : calBox.offsetHeight;
      calAnim = calBox.animate([{ height: start + "px", opacity: opening ? 0 : 1 }, { height: end + "px", opacity: opening ? 1 : 0 }],
        { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      calAnim.onfinish = function () { if (!opening) calBox.hidden = true; calAnim = null; };
    });
  }

  /* ---- Calendar: one month at a time, built from the event cards and the
     gallery, so it needs no data of its own. Dots mark days with events;
     the list under the grid names them and jumps to the card or opens
     the photos. ---- */
  var cal = document.getElementById("calendar");
  if (cal) {
    var events = [];
    document.querySelectorAll("#event-carousel .slide[data-kind='up'][data-date]:not([data-clone])").forEach(function (c) {
      events.push({ date: c.getAttribute("data-date"), title: c.querySelector("h3").textContent.trim(), kind: "up", el: c });
    });
    document.querySelectorAll("#event-carousel .slide[data-kind='past'][data-date]:not([data-clone])").forEach(function (g) {
      events.push({ date: g.getAttribute("data-date"), title: g.querySelector("h3").textContent.trim(), kind: "past", el: g });
    });
    var byDay = {};
    events.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
    var now = new Date();
    var view = new Date(now.getFullYear(), now.getMonth(), 1);
    var grid = cal.querySelector(".cal-grid"), list = cal.querySelector(".cal-list"), title = cal.querySelector(".cal-title");
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
    function render() {
      var y = view.getFullYear(), m = view.getMonth();
      title.textContent = months[m] + " " + y;
      grid.innerHTML = "";
      ["S", "M", "T", "W", "T", "F", "S"].forEach(function (d) {
        var h = document.createElement("span"); h.className = "cal-dow"; h.textContent = d; grid.appendChild(h);
      });
      var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      for (var i = 0; i < first; i++) { var pad_ = document.createElement("span"); pad_.className = "cal-pad"; grid.appendChild(pad_); }
      var todayKey = iso(now.getFullYear(), now.getMonth(), now.getDate());
      for (var d = 1; d <= days; d++) {
        var key = iso(y, m, d), evs = byDay[key] || [];
        var cell = document.createElement(evs.length ? "button" : "span");
        cell.className = "cal-day" + (key === todayKey ? " today" : "") + (evs.length ? " has " + evs[0].kind : "");
        if (evs.length) { cell.type = "button"; cell.setAttribute("aria-label", evs.map(function (e) { return e.title; }).join(", ")); }
        cell.innerHTML = "<b>" + d + "</b>";
        if (evs.length) {
          cell.addEventListener("click", (function (ev) { return function () { open(ev); }; })(evs[0]));
        }
        grid.appendChild(cell);
      }
      list.innerHTML = "";
      var monthEvents = events.filter(function (e) { return e.date.slice(0, 7) === y + "-" + pad(m + 1); })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (!monthEvents.length) {
        var li = document.createElement("li"); li.className = "cal-none"; li.textContent = "Nothing this month."; list.appendChild(li);
      }
      monthEvents.forEach(function (e) {
        var li = document.createElement("li"), btn = document.createElement("button");
        btn.type = "button"; btn.className = "cal-item " + e.kind;
        btn.innerHTML = "<span class=\"dot " + e.kind + "\"></span><span class=\"d\">" + months[m].slice(0, 3) + " " + parseInt(e.date.slice(8), 10) + "</span> " + e.title;
        btn.addEventListener("click", function () { open(e); });
        li.appendChild(btn); list.appendChild(li);
      });
    }
    function open(e) {
      if (e.kind === "past" && e.el.getAttribute("href")) { window.location.href = e.el.getAttribute("href"); return; }
      var box = document.getElementById("event-carousel");
      if (box && box.goTo) box.goTo(e.el);
      else e.el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
    cal.querySelectorAll(".cal-nav").forEach(function (b) {
      b.addEventListener("click", function () { view.setMonth(view.getMonth() + parseInt(b.getAttribute("data-dir"), 10)); render(); });
    });
    render();
  }

  /* ---- Share button on event pages: the system share sheet where the
     browser has one (every phone), otherwise copy the link and say so. ---- */
  var share = document.querySelector(".share-btn");
  if (share) {
    var shareLabel = share.querySelector("span");
    var shareText = shareLabel.textContent;
    var shareTimer;
    function shareDone(msg) {
      clearTimeout(shareTimer);
      shareLabel.textContent = msg;
      share.classList.add("is-done");
      shareTimer = setTimeout(function () {
        shareLabel.textContent = shareText;
        share.classList.remove("is-done");
      }, 1800);
    }
    share.addEventListener("click", function () {
      var data = { title: share.getAttribute("data-share-title"), url: share.getAttribute("data-share-url") };
      if (navigator.share) {
        /* A cancelled sheet rejects; that is not an error worth showing. */
        navigator.share(data).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data.url).then(function () { shareDone("Link copied"); }, function () { prompt("Copy this link", data.url); });
      } else {
        prompt("Copy this link", data.url);
      }
    });
  }
})();

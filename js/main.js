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

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Join form: the email opt-in only appears once an email is typed ---- */
  var form = document.getElementById("join-form");
  if (form) {
    var email = form.querySelector('input[name="email"]');
    var optin = form.querySelector(".check");
    var optinBox = form.querySelector('input[name="newsletter"]');
    function syncOptin() {
      var has = email.value.trim().length > 0;
      optin.classList.toggle("show", has);
      if (!has && optinBox) optinBox.checked = false;
    }
    if (email && optin) {
      email.addEventListener("input", syncOptin);
      syncOptin();
    }
    form.addEventListener("submit", function (e) {
      if (/YOUR_FORM_ID/.test(form.getAttribute("action") || "")) {
        e.preventDefault();
        var note = form.querySelector(".form-note") || form.appendChild(document.createElement("p"));
        note.className = "form-note";
        note.innerHTML = 'Sign-up isn\u2019t connected yet. Message <a href="https://instagram.com/silly.spaces" target="_blank" rel="noopener">@silly.spaces</a> to join.';
        return;
      }
      var name = form.querySelector('input[name="name"]');
      if (name && !name.value.trim()) {
        e.preventDefault();
        name.focus();
        name.setCustomValidity("Just a name is enough.");
        name.reportValidity();
        name.addEventListener("input", function () { name.setCustomValidity(""); }, { once: true });
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    });
  }

  /* ---- FAQ: animate open and close instead of snapping ---- */
  document.querySelectorAll(".faq details").forEach(function (d) {
    var summary = d.querySelector("summary");
    var answer = d.querySelector(".answer");
    if (!summary || !answer || reduce) return;
    var anim = null;
    summary.addEventListener("click", function (e) {
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
    lb.querySelector("h3").textContent = lb.getAttribute("data-title") || "";
    lb.querySelector(".when").textContent = lb.getAttribute("data-when") || "";
    lb.querySelector("p").textContent = lb.getAttribute("data-desc") || "";
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

  /* ---- Auto-hide upcoming events once their date has passed ---- */
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var upcoming = document.querySelectorAll("#upcoming [data-date]");
  var shown = 0;
  upcoming.forEach(function (card) {
    var d = new Date(card.getAttribute("data-date") + "T23:59:59");
    if (d < today) card.remove(); else shown++;
  });
  var emptyMsg = document.getElementById("no-events");
  if (emptyMsg) emptyMsg.hidden = shown > 0;

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
    document.querySelectorAll("#upcoming .card[data-date]").forEach(function (c) {
      events.push({ date: c.getAttribute("data-date"), title: c.querySelector("h3").textContent.trim(), kind: "up", el: c });
    });
    document.querySelectorAll("#past .gallery-item[data-date]").forEach(function (g) {
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
      if (e.kind === "past") { e.el.click(); }
      else { e.el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); }
    }
    cal.querySelectorAll(".cal-nav").forEach(function (b) {
      b.addEventListener("click", function () { view.setMonth(view.getMonth() + parseInt(b.getAttribute("data-dir"), 10)); render(); });
    });
    render();
  }

  /* ---- Join form: fill the "which event" dropdown from the page itself,
     upcoming cards first, then the past events gallery, so it never
     needs editing by hand. Runs after the date filter above. ---- */
  var attended = document.getElementById("attended");
  if (attended) {
    function addGroup(label, nodes) {
      var names = Array.prototype.map.call(nodes, function (n) { return n.textContent.trim(); }).filter(Boolean);
      if (!names.length) return;
      var g = document.createElement("optgroup");
      g.label = label;
      names.forEach(function (name) {
        var o = document.createElement("option");
        o.value = name; o.textContent = name;
        g.appendChild(o);
      });
      attended.appendChild(g);
    }
    addGroup("Upcoming", document.querySelectorAll("#upcoming .card h3"));
    addGroup("Past events", document.querySelectorAll("#past .gallery-item h3"));
  }
})();

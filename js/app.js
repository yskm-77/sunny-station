/* 阳光收集站 —— 留言板逻辑
   纯原生 JS，无依赖。数据只写入 localStorage。 */
(function () {
  "use strict";

  var KEY = "sunny-sun-station-v1";
  var LIKED_KEY = "sunny-sun-station-liked-v1";
  var MAX = 300;

  var MOODS = [
    { id: "joy", emoji: "☀️", label: "开心", color: "#ffd166" },
    { id: "calm", emoji: "🌤", label: "平静", color: "#ffe1b0" },
    { id: "hope", emoji: "🌱", label: "期待", color: "#cfe8b8" },
    { id: "tired", emoji: "😮‍💨", label: "疲惫", color: "#d9cff0" },
    { id: "anxious", emoji: "🌧", label: "有点焦虑", color: "#bcd6ee" },
    { id: "talk", emoji: "💬", label: "想倾诉", color: "#ffccc0" }
  ];

  var CATS = ["活动建议", "空间与环境", "内容与选题", "其他"];

  var QUOTES = [
    "允许自己慢一点，太阳也是一寸一寸升起来的。",
    "你今天愿意说出来，已经比昨天勇敢了一点。",
    "情绪不是敌人，它只是来提醒你：该照顾自己了。",
    "不是所有问题都要今天解决，先晒晒太阳。",
    "你可以不发光，但你可以被光照到。",
    "把话写下来，心里就会空出一点地方。",
    "别人看到的只是结果，你走过的是全程。",
    "休息不是偷懒，是为了走更远的路。",
    "你不需要一直积极，偶尔阴天也很正常。",
    "光会照进来，只要你愿意把窗打开一条缝。"
  ];

  var state = {
    messages: [],
    liked: {},
    mood: "calm",
    cat: CATS[0],
    filterCat: "all",
    sort: "new",
    query: ""
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- 存储 ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      state.messages = arr.filter(function (m) { return m && typeof m.text === "string"; });
      state.liked = JSON.parse(localStorage.getItem(LIKED_KEY) || "{}") || {};
    } catch (e) {
      state.messages = [];
      state.liked = {};
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.messages));
      localStorage.setItem(LIKED_KEY, JSON.stringify(state.liked));
    } catch (e) { /* 本地存储被禁用时静默降级 */ }
  }

  /* ---------- 工具 ---------- */

  function moodOf(id) {
    for (var i = 0; i < MOODS.length; i++) if (MOODS[i].id === id) return MOODS[i];
    return MOODS[1];
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "刚刚";
    if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
    if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
    var d = new Date(ts);
    return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  }

  var toastTimer;
  function toast(text) {
    var el = $("#toast");
    el.textContent = text;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 2600);
  }

  function setStatus(text, kind) {
    var el = $("#status");
    el.textContent = text || "";
    el.className = "form__status" + (kind ? " is-" + kind : "");
  }

  /* ---------- 心情 / 类别选择 ---------- */

  function buildMoods() {
    var box = $("#moods");
    MOODS.forEach(function (m) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mood" + (m.id === state.mood ? " is-active" : "");
      b.dataset.mood = m.id;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", m.id === state.mood ? "true" : "false");
      b.style.setProperty("--mood-color", m.color);

      var e = document.createElement("span");
      e.className = "mood__emoji";
      e.textContent = m.emoji;
      var t = document.createElement("span");
      t.textContent = m.label;
      b.appendChild(e);
      b.appendChild(t);

      b.addEventListener("click", function () {
        state.mood = m.id;
        $$(".mood", box).forEach(function (x) {
          var on = x.dataset.mood === m.id;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-checked", on ? "true" : "false");
        });
        updatePreview();
      });

      box.appendChild(b);
    });
  }

  function buildCats() {
    var box = $("#catInput");
    CATS.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (i === 0 ? " is-active" : "");
      b.textContent = c;
      b.dataset.cat = c;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", i === 0 ? "true" : "false");
      b.addEventListener("click", function () {
        state.cat = c;
        $$(".chip", box).forEach(function (x) {
          var on = x.dataset.cat === c;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-checked", on ? "true" : "false");
        });
        updatePreview();
      });
      box.appendChild(b);
    });
  }

  function updatePreview() {
    var m = moodOf(state.mood);
    $("#pvMood").textContent = m.emoji;
    $("#pvCat").textContent = state.cat;
    var name = $("#name").value.trim();
    $("#pvName").textContent = name || "匿名同学";
    var text = $("#text").value.trim();
    $("#pvText").textContent = text || "你写下的内容会出现在这里。";
  }

  /* ---------- 渲染留言 ---------- */

  function filtered() {
    var q = state.query.toLowerCase();
    return state.messages.filter(function (m) {
      if (state.filterCat !== "all" && m.cat !== state.filterCat) return false;
      if (q && (m.text + " " + (m.name || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) {
      if (state.sort === "hot") return (b.suns || 0) - (a.suns || 0) || b.ts - a.ts;
      return b.ts - a.ts;
    });
  }

  function render() {
    var list = $("#cards");
    var items = filtered();
    list.textContent = "";

    items.forEach(function (m, idx) {
      list.appendChild(buildCard(m, idx));
    });

    var empty = $("#empty");
    empty.classList.toggle("is-visible", state.messages.length === 0);
    list.hidden = state.messages.length === 0;

    $("#boardCount").textContent = state.messages.length;
    updateStats();
  }

  function buildCard(m, idx) {
    var mood = moodOf(m.mood);
    var card = document.createElement("article");
    card.className = "card card--message";
    card.style.setProperty("--mood-color", mood.color);
    card.style.animation = "none";
    card.style.opacity = "0";
    card.style.transform = "translateY(18px)";
    setTimeout(function () {
      card.style.transition = "opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1)";
      card.style.opacity = "1";
      card.style.transform = "none";
    }, 30 + idx * 40);

    var top = document.createElement("div");
    top.className = "card__top";

    var moodEl = document.createElement("span");
    moodEl.className = "card__mood";
    moodEl.textContent = mood.emoji;
    moodEl.title = mood.label;

    var tools = document.createElement("div");
    tools.className = "card__tools";

    var catEl = document.createElement("span");
    catEl.className = "card__cat";
    catEl.textContent = m.cat;

    var del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "删除";
    del.addEventListener("click", function () {
      if (!window.confirm("确定删除这条留言吗？")) return;
      state.messages = state.messages.filter(function (x) { return x.id !== m.id; });
      delete state.liked[m.id];
      save();
      render();
      toast("已删除");
    });

    tools.appendChild(catEl);
    tools.appendChild(del);
    top.appendChild(moodEl);
    top.appendChild(tools);

    var text = document.createElement("p");
    text.className = "card__text";
    text.textContent = m.text;

    var foot = document.createElement("div");
    foot.className = "card__foot";

    var name = document.createElement("span");
    name.className = "card__name";
    name.textContent = m.name || "匿名同学";

    var time = document.createElement("span");
    time.className = "card__time";
    time.textContent = timeAgo(m.ts);

    foot.appendChild(name);
    foot.appendChild(time);

    var sun = document.createElement("button");
    sun.type = "button";
    sun.className = "sunbtn" + (state.liked[m.id] ? " is-on" : "");
    sun.setAttribute("aria-label", "给这条留言一点阳光");
    var icon = document.createElement("span");
    icon.className = "sunbtn__icon";
    icon.textContent = "☀";
    var num = document.createElement("span");
    num.textContent = String(m.suns || 0);
    sun.appendChild(icon);
    sun.appendChild(num);
    sun.addEventListener("click", function () {
      if (state.liked[m.id]) {
        m.suns = Math.max(0, (m.suns || 0) - 1);
        delete state.liked[m.id];
        sun.classList.remove("is-on");
        toast("阳光收回来了");
      } else {
        m.suns = (m.suns || 0) + 1;
        state.liked[m.id] = true;
        sun.classList.add("is-on");
        toast("你给 TA 送了一点阳光");
      }
      num.textContent = String(m.suns);
      save();
      updateStats();
    });

    var foot2 = document.createElement("div");
    foot2.className = "card__foot";
    foot2.style.marginTop = "12px";
    foot2.appendChild(foot.firstChild);
    foot2.appendChild(foot.lastChild);
    foot2.appendChild(sun);

    card.appendChild(top);
    card.appendChild(text);
    card.appendChild(foot2);

    if (m.contact) {
      var c = document.createElement("p");
      c.className = "card__contact";
      c.textContent = "联系方式：" + m.contact;
      card.appendChild(c);
    }

    return card;
  }

  /* ---------- 统计 ---------- */

  function updateStats() {
    var totalSuns = state.messages.reduce(function (s, m) { return s + (m.suns || 0); }, 0);
    var names = {};
    state.messages.forEach(function (m) { if (m.name) names[m.name] = 1; });
    setStat("messages", state.messages.length);
    setStat("suns", totalSuns);
    setStat("people", Object.keys(names).length);
  }

  function setStat(key, value) {
    var el = document.querySelector('[data-count="' + key + '"]');
    if (!el) return;
    var from = parseInt(el.textContent, 10) || 0;
    if (from === value) return;
    var start = performance.now();
    var dur = 500;
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (value - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- 提交 ---------- */

  function burstAt(x, y) {
    var box = $("#burst");
    for (var i = 0; i < 22; i++) {
      var s = document.createElement("span");
      var angle = Math.random() * Math.PI * 2;
      var dist = 60 + Math.random() * 130;
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.setProperty("--x", Math.cos(angle) * dist + "px");
      s.style.setProperty("--y", Math.sin(angle) * dist + "px");
      s.style.background = ["#ffb020", "#ffd166", "#f2932c", "#ffe9c2"][i % 4];
      s.style.animationDelay = (Math.random() * 0.1) + "s";
      box.appendChild(s);
      (function (node) { setTimeout(function () { node.remove(); }, 1200); })(s);
    }
  }

  function submit(e) {
    e.preventDefault();
    var raw = $("#text").value.trim();

    if (raw.length < 5) {
      setStatus("再多写几个字吧，至少 5 个字。", "error");
      $("#text").focus();
      return;
    }
    if (raw.length > MAX) {
      setStatus("超过 300 字了，删减一点再提交。", "error");
      return;
    }

    var msg = {
      id: uid(),
      name: $("#name").value.trim().slice(0, 12),
      contact: $("#contact").value.trim().slice(0, 40),
      mood: state.mood,
      cat: state.cat,
      text: raw,
      ts: Date.now(),
      suns: 0
    };

    state.messages.unshift(msg);
    save();

    var rect = $("#submitBtn").getBoundingClientRect();
    burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2);

    $("#form").reset();
    state.mood = "calm";
    state.cat = CATS[0];
    $$(".mood").forEach(function (x) {
      var on = x.dataset.mood === "calm";
      x.classList.toggle("is-active", on);
      x.setAttribute("aria-checked", on ? "true" : "false");
    });
    $$("#catInput .chip").forEach(function (x, i) {
      x.classList.toggle("is-active", i === 0);
      x.setAttribute("aria-checked", i === 0 ? "true" : "false");
    });
    $("#counter").textContent = "0 / " + MAX;
    $("#meterFill").style.width = "0%";
    setStatus("已收下，谢谢你让这里多了一点光。", "ok");
    updatePreview();
    render();
    toast("留言已放进阳光里");

    setTimeout(function () {
      $("#board").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 500);
  }

  /* ---------- 初始化 ---------- */

  function boot() {
    load();
    buildMoods();
    buildCats();
    updatePreview();
    render();

    $("#form").addEventListener("submit", submit);

    $("#text").addEventListener("input", function () {
      var n = this.value.length;
      $("#counter").textContent = n + " / " + MAX;
      $("#meterFill").style.width = Math.min(100, (n / MAX) * 100) + "%";
      if ($("#status").classList.contains("is-error")) setStatus("");
      updatePreview();
    });

    $("#name").addEventListener("input", updatePreview);

    document.querySelectorAll("#catFilter .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.filterCat = chip.dataset.cat;
        $$("#catFilter .chip").forEach(function (x) { x.classList.toggle("is-active", x === chip); });
        render();
      });
    });

    $$(".sort__btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.sort = b.dataset.sort;
        $$(".sort__btn").forEach(function (x) { x.classList.toggle("is-active", x === b); });
        render();
      });
    });

    $("#search").addEventListener("input", function () {
      state.query = this.value.trim();
      render();
    });

    $("#exportBtn").addEventListener("click", function () {
      if (!state.messages.length) { toast("还没有留言可以导出"); return; }
      var data = {
        source: "阳光收集站 · 阳光驿站留言板",
        exportedAt: new Date().toISOString(),
        count: state.messages.length,
        messages: state.messages
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var d = new Date();
      a.href = url;
      a.download = "阳光收集站留言-" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("已导出 JSON");
    });

    $("#quoteBtn").addEventListener("click", function () {
      var el = $("#quoteText");
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(function () {
        var q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        el.textContent = q;
        el.style.transition = "opacity .4s ease, transform .4s ease";
        el.style.opacity = "1";
        el.style.transform = "none";
      }, 180);
    });

    // 首屏粒子
    var box = $("#particles");
    for (var i = 0; i < 18; i++) {
      var p = document.createElement("span");
      p.style.left = Math.random() * 100 + "%";
      p.style.top = 40 + Math.random() * 50 + "%";
      p.style.animationDuration = 9 + Math.random() * 10 + "s";
      p.style.animationDelay = -Math.random() * 12 + "s";
      p.style.transform = "scale(" + (0.6 + Math.random()) + ")";
      box.appendChild(p);
    }

    // 滚动出现
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.12 });
      $$(".reveal").forEach(function (el) { io.observe(el); });
    } else {
      $$(".reveal").forEach(function (el) { el.classList.add("in"); });
    }

    // 导航吸顶
    var nav = $("#nav");
    window.addEventListener("scroll", function () {
      nav.classList.toggle("is-stuck", window.scrollY > 30);
    }, { passive: true });
    nav.classList.toggle("is-stuck", window.scrollY > 30);

    updateStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


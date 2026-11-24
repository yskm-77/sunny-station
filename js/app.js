/* 阳光驿站 · 留言板
   纯原生 JS，无依赖。数据只写入 localStorage。 */

(function () {
  "use strict";

  var STORAGE_KEY = "sunny-station-messages-v1";
  var MAX_LEN = 300;

  var CATEGORIES = {
    activity: "活动建议",
    space: "空间与环境",
    content: "内容与选题",
    other: "其他想法"
  };

  var els = {
    form: document.getElementById("messageForm"),
    nickname: document.getElementById("nickname"),
    contact: document.getElementById("contact"),
    category: document.getElementById("category"),
    message: document.getElementById("message"),
    counter: document.getElementById("counter"),
    status: document.getElementById("formStatus"),
    list: document.getElementById("messageList"),
    empty: document.getElementById("emptyState"),
    count: document.getElementById("messageCount"),
    filters: document.getElementById("filters"),
    exportBtn: document.getElementById("exportBtn"),
    resetBtn: document.getElementById("resetBtn"),
    toast: document.getElementById("toast")
  };

  var messages = [];
  var activeFilter = "all";
  var storageOk = true;

  /* ---------- 存储 ---------- */

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (m) {
        return m && typeof m.text === "string" && typeof m.ts === "number";
      });
    } catch (err) {
      storageOk = false;
      return [];
    }
  }

  function save() {
    if (!storageOk) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      storageOk = false;
      toast("浏览器不允许本地存储，留言只保留到刷新前");
    }
  }

  /* ---------- 工具 ---------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var now = Date.now();
    var diff = Math.floor((now - ts) / 1000);
    if (diff < 60) return "刚刚";
    if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
    var sameDay = new Date(now).toDateString() === d.toDateString();
    var hm = pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (sameDay) return "今天 " + hm;
    return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 " + hm;
  }

  var toastTimer = null;
  function toast(text) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
    }, 2600);
  }

  function setStatus(text, kind) {
    els.status.textContent = text || "";
    els.status.className = "form__status" + (kind ? " is-" + kind : "");
  }

  /* ---------- 渲染 ---------- */

  function render() {
    var visible = messages.filter(function (m) {
      return activeFilter === "all" || m.cat === activeFilter;
    });

    els.list.textContent = "";
    visible
      .slice()
      .sort(function (a, b) { return b.ts - a.ts; })
      .forEach(function (m) {
        els.list.appendChild(buildCard(m));
      });

    els.count.textContent = String(messages.length);

    var isEmpty = messages.length === 0;
    els.empty.classList.toggle("is-visible", isEmpty);
    els.list.hidden = isEmpty;
    els.exportBtn.disabled = isEmpty;
  }

  function buildCard(m) {
    var li = document.createElement("li");
    li.className = "message";

    var top = document.createElement("div");
    top.className = "message__top";

    var author = document.createElement("span");
    author.className = "message__author";
    author.textContent = m.name || "匿名同学";

    var time = document.createElement("time");
    time.className = "message__time";
    time.dateTime = new Date(m.ts).toISOString();
    time.textContent = formatTime(m.ts);

    top.appendChild(author);
    top.appendChild(time);

    var text = document.createElement("p");
    text.className = "message__text";
    text.textContent = m.text;

    var foot = document.createElement("div");
    foot.className = "message__foot";

    var tag = document.createElement("span");
    tag.className = "tag";
    tag.dataset.cat = m.cat;
    tag.textContent = CATEGORIES[m.cat] || "其他想法";

    var del = document.createElement("button");
    del.type = "button";
    del.className = "message__delete";
    del.textContent = "删除";
    del.setAttribute("aria-label", "删除这条留言");
    del.addEventListener("click", function () {
      if (!window.confirm("确定删除这条留言吗？删除后无法恢复。")) return;
      messages = messages.filter(function (x) { return x.id !== m.id; });
      save();
      render();
      toast("已删除");
    });

    foot.appendChild(tag);
    foot.appendChild(del);

    li.appendChild(top);
    li.appendChild(text);
    li.appendChild(foot);

    if (m.contact) {
      var contact = document.createElement("p");
      contact.className = "message__contact";
      contact.textContent = "联系方式：" + m.contact;
      li.appendChild(contact);
    }

    return li;
  }

  /* ---------- 表单 ---------- */

  function validate() {
    var text = els.message.value.trim();
    if (text.length < 5) {
      setStatus("多写几个字吧，至少 5 个字。", "error");
      els.message.focus();
      return false;
    }
    if (text.length > MAX_LEN) {
      setStatus("内容超过 " + MAX_LEN + " 字，请删减一些。", "error");
      els.message.focus();
      return false;
    }
    return true;
  }

  els.form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) return;

    var entry = {
      id: uid(),
      name: els.nickname.value.trim().slice(0, 12),
      contact: els.contact.value.trim().slice(0, 40),
      cat: CATEGORIES[els.category.value] ? els.category.value : "other",
      text: els.message.value.trim(),
      ts: Date.now()
    };

    messages.push(entry);
    save();
    activeFilter = "all";
    syncChips();
    render();

    els.form.reset();
    els.counter.textContent = "0 / " + MAX_LEN;
    setStatus("已保存到本机。谢谢你为驿站提的建议。", "ok");
    toast("留言已保存");

    document.getElementById("messages").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.resetBtn.addEventListener("click", function () {
    setStatus("");
    els.counter.textContent = "0 / " + MAX_LEN;
  });

  els.message.addEventListener("input", function () {
    els.counter.textContent = els.message.value.length + " / " + MAX_LEN;
    if (els.status.classList.contains("is-error")) setStatus("");
  });

  /* ---------- 筛选 ---------- */

  function syncChips() {
    Array.prototype.forEach.call(els.filters.querySelectorAll(".chip"), function (chip) {
      var active = chip.dataset.filter === activeFilter;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  els.filters.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    activeFilter = chip.dataset.filter;
    syncChips();
    render();
  });

  /* ---------- 导出 ---------- */

  els.exportBtn.addEventListener("click", function () {
    if (!messages.length) return;
    var payload = {
      source: "阳光驿站 · 心理专属空间留言板",
      exportedAt: new Date().toISOString(),
      count: messages.length,
      messages: messages.slice().sort(function (a, b) { return a.ts - b.ts; })
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    a.href = url;
    a.download = "阳光驿站留言-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("已导出 JSON");
  });

  /* ---------- 启动 ---------- */

  messages = load();
  render();
  if (!storageOk) {
    toast("当前浏览器禁用了本地存储，留言仅保留到刷新前");
  }
})();

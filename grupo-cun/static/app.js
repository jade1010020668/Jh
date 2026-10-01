// Alarmas del navegador: mientras la app esté abierta (aunque sea en otra pestaña)
// avisa 1 día antes, 2 horas antes y cuando algo se venció.
(function () {
  const STEPS = [
    { key: "24h", max: 24 * 60, label: "Mañana" },
    { key: "2h", max: 120, label: "En menos de 2 horas" },
    { key: "vencido", max: 0, label: "Se venció" },
  ];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const API = document.currentScript.dataset.api;
  const canNotify = "Notification" in window;
  const bar = document.getElementById("notif-bar");

  if (canNotify && Notification.permission === "default" && !store.get("notif-dismissed") && bar) {
    bar.hidden = false;
    document.getElementById("notif-yes").onclick = () => {
      Notification.requestPermission().then(() => { bar.hidden = true; check(); });
    };
    document.getElementById("notif-no").onclick = () => {
      store.set("notif-dismissed", "1");
      bar.hidden = true;
    };
  }

  function notify(a, step) {
    const id = `alarma-${a.id}-${step.key}-${a.due}`;
    if (store.get(id)) return;
    store.set(id, "1");
    const n = new Notification(`${step.label}: ${a.title}`, {
      body: `${a.kind} · ${a.when}`,
      tag: id,
      requireInteraction: step.key !== "24h",
    });
    n.onclick = () => { window.focus(); location.href = a.url; };
  }

  function check() {
    fetch(API, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : []))
      .then(list => {
        const urgent = list.filter(a => ["vencido", "hoy", "pronto"].includes(a.status)).length;
        document.title = document.title.replace(/^\(\d+\) /, "");
        if (urgent) document.title = `(${urgent}) ${document.title}`;
        if (!canNotify || Notification.permission !== "granted") return;
        list.forEach(a => {
          // Solo el aviso más reciente que aplique; los vencidos, solo si fue en las últimas 12 h.
          if (a.minutes < 0) { if (a.minutes > -720) notify(a, STEPS[2]); return; }
          if (a.minutes <= STEPS[1].max) return notify(a, STEPS[1]);
          if (a.minutes <= STEPS[0].max) notify(a, STEPS[0]);
        });
      })
      .catch(() => {});
  }

  check();
  setInterval(check, 5 * 60 * 1000);

  // Botones "Copiar"
  document.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.querySelector(btn.dataset.copy);
      input.select();
      (navigator.clipboard ? navigator.clipboard.writeText(input.value) : Promise.reject())
        .catch(() => document.execCommand("copy"))
        .finally(() => { btn.textContent = "¡Copiado!"; setTimeout(() => (btn.textContent = "Copiar"), 1500); });
    });
  });
})();

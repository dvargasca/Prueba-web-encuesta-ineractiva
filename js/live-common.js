/* =========================================================
   live-common.js — Utilidades compartidas del modo EN VIVO
   Permite que la web (incluso alojada de forma estática en
   GitHub Pages) se conecte a un servidor Node remoto.
   ========================================================= */
(function (window) {
  "use strict";

  var SERVER_KEY = "quizaula_server_url";

  function normalizeUrl(url) {
    return String(url || "").trim().replace(/\/+$/, "");
  }

  function getServerUrl() {
    try { return localStorage.getItem(SERVER_KEY) || ""; } catch (e) { return ""; }
  }
  function setServerUrl(url) {
    try { localStorage.setItem(SERVER_KEY, normalizeUrl(url)); } catch (e) {}
  }
  function clearServerUrl() {
    try { localStorage.removeItem(SERVER_KEY); } catch (e) {}
  }
  function isConfigured() { return !!getServerUrl(); }

  // Permite preconfigurar el servidor con ?server=https://... en la URL.
  (function initFromQuery() {
    try {
      var m = window.location.search.match(/[?&]server=([^&]+)/);
      if (m) setServerUrl(normalizeUrl(decodeURIComponent(m[1])));
    } catch (e) {}
  })();

  /** ¿Está disponible el cliente de Socket.IO? (empaquetado localmente). */
  function isLiveAvailable() {
    return typeof window.io === "function";
  }

  /** Crea una conexión de socket: al servidor configurado o, si no hay, al mismo origen. */
  function connect(opts) {
    var base = { reconnection: false };
    if (opts) for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) base[k] = opts[k];
    var url = getServerUrl();
    return url ? window.io(url, base) : window.io(base);
  }

  /** Comprueba que la URL del servidor sea válida (y compatible con HTTPS). */
  function validateServerUrl(url) {
    if (!url) return "Escribe la dirección de tu servidor.";
    if (!/^https?:\/\/.+/i.test(url)) return "La dirección debe empezar por http:// o https://";
    if (window.location.protocol === "https:" && /^http:\/\//i.test(url)) {
      return "Como esta página usa HTTPS, el servidor también debe ser https:// (Railway y Render lo dan).";
    }
    return null;
  }

  /** Dirección que deben abrir los estudiantes para unirse. */
  function joinAddress() {
    var u = getServerUrl();
    if (u) return u.replace(/^https?:\/\//, "");
    return window.location.host || window.location.origin;
  }

  /**
   * Pantalla para configurar/introducir la URL del servidor de juego.
   * opts: { onConnect(url), onExit, error }
   */
  function renderNeedsServer(root, el, opts) {
    opts = opts || {};
    var input = el("input", {
      class: "input", type: "url", value: getServerUrl(),
      placeholder: "https://tu-app.up.railway.app",
      style: "text-align:center; margin:0.6rem 0; font-size:1.05rem;"
    });
    var errorBox = el("p", { style: "color:var(--danger); font-weight:600; min-height:1.2em; margin:0.2rem 0; text-align:center;", text: opts.error || "" });

    function submit() {
      var url = normalizeUrl(input.value);
      var err = validateServerUrl(url);
      if (err) { errorBox.textContent = err; return; }
      setServerUrl(url);
      if (opts.onConnect) opts.onConnect(url);
    }
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

    var actions = [
      el("button", { class: "btn btn--lg", html: "Conectar 🚀", onClick: submit }),
      el("button", { class: "btn btn--ghost btn--lg", html: "← Volver", onClick: function () { if (opts.onExit) opts.onExit(); } })
    ];
    if (isConfigured()) {
      actions.push(el("button", {
        class: "btn btn--ghost btn--lg", html: "Olvidar servidor",
        onClick: function () { clearServerUrl(); input.value = ""; errorBox.textContent = "Servidor olvidado."; }
      }));
    }

    var card = el("div", { class: "game-start__card", style: "text-align:left; max-width:540px;" }, [
      el("div", { class: "game-start__emoji", style: "text-align:center;", text: "🔌" }),
      el("h2", { style: "text-align:center; margin-bottom:0.3rem;", text: "Conecta con tu servidor de juego" }),
      el("p", { text: "El juego en vivo necesita un servidor Node (GitHub Pages no puede ejecutarlo). Si ya lo desplegaste en Railway o Render, pega aquí su dirección y quedará guardada:" }),
      input,
      errorBox,
      el("div", { style: "display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;" }, actions),
      el("p", { class: "hint", style: "margin-top:1.1rem;", html: "¿Aún no tienes servidor? Despliega el proyecto gratis en <b>Railway</b> o <b>Render</b> (mira el README) y pega la URL que te den. Debe empezar por <b>https://</b>." })
    ]);

    root.innerHTML = "";
    root.appendChild(el("div", { class: "game" }, [el("div", { class: "game-start" }, [card])]));
    setTimeout(function () { input.focus(); }, 60);
  }

  window.Live = {
    isLiveAvailable: isLiveAvailable,
    isConfigured: isConfigured,
    getServerUrl: getServerUrl,
    setServerUrl: setServerUrl,
    clearServerUrl: clearServerUrl,
    connect: connect,
    joinAddress: joinAddress,
    renderNeedsServer: renderNeedsServer
  };
})(window);

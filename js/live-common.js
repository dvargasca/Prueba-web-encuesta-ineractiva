/* =========================================================
   live-common.js — Utilidades compartidas del modo EN VIVO
   ========================================================= */
(function (window) {
  "use strict";

  /** ¿Está disponible el cliente de Socket.IO? (solo cuando sirve el servidor Node). */
  function isLiveAvailable() {
    return typeof window.io === "function";
  }

  /** Crea una nueva conexión de socket al mismo origen. */
  function connect(opts) {
    var base = { reconnection: false };
    if (opts) for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) base[k] = opts[k];
    return window.io(base);
  }

  /** Pantalla amable cuando el modo en vivo no está disponible (web estática). */
  function renderUnavailable(root, el, onExit) {
    var card = el("div", { class: "game-start__card", style: "text-align:left;" }, [
      el("div", { class: "game-start__emoji", style: "text-align:center;", text: "🔌" }),
      el("h2", { text: "El modo en vivo necesita el servidor", style: "text-align:center;" }),
      el("p", {
        text: "Estás usando la versión estática (abierta como archivo o en GitHub Pages). " +
              "El juego multijugador con PIN requiere ejecutar el servidor Node."
      }),
      el("p", { html: "Para activarlo:<br>1) Instala Node.js.<br>2) En la carpeta del proyecto ejecuta <b>npm install</b> y luego <b>npm start</b>.<br>3) Abre <b>http://localhost:3000</b>.<br><br>O publícalo gratis en Render/Railway (ver el README)." }),
      el("div", { style: "text-align:center;" }, [
        el("button", { class: "btn btn--lg", html: "← Volver", onClick: onExit })
      ])
    ]);
    root.innerHTML = "";
    root.appendChild(el("div", { class: "game" }, [
      el("div", { class: "game-start" }, [card])
    ]));
  }

  /** Devuelve la URL base para que los jugadores se unan (sin protocolo, más corta). */
  function joinAddress() {
    return window.location.host || window.location.origin;
  }

  window.Live = {
    isLiveAvailable: isLiveAvailable,
    connect: connect,
    renderUnavailable: renderUnavailable,
    joinAddress: joinAddress
  };
})(window);

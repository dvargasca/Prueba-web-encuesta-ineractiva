/* =========================================================
   ui.js — Utilidades de interfaz compartidas
   ========================================================= */
(function (window, document) {
  "use strict";

  // Nombres de los 4 colores de opción (para lectores de pantalla / aria).
  // Las opciones se distinguen por COLOR (cuadrados), no por figuras.
  var COLOR_NAMES = ["Frambuesa", "Cobalto", "Ámbar", "Esmeralda"];

  /** Inicial del título para las portadas con monograma (sin emoji). */
  function monogram(title) {
    var m = String(title == null ? "" : title).trim().match(/[\p{L}\p{N}]/u);
    return m ? m[0].toUpperCase() : "?";
  }

  // Colores de acento de las portadas (degradados definidos en el CSS).
  var ACCENT_COUNT = 6;
  /** Clase CSS del degradado de acento de una portada. Tolera valores antiguos. */
  function coverAccentClass(cover) {
    var n = Math.floor(Number(cover));
    if (!isFinite(n) || n < 0 || n >= ACCENT_COUNT) n = 0;
    return "cover-accent--" + n;
  }

  /** ¿Es una pregunta de verdadero/falso? */
  function isTF(q) { return !!(q && q.type === "tf"); }
  /** Clase de color extra para verdadero-falso (verde = verdadero / rojo = falso). */
  function answerColorClass(q, i) { return isTF(q) ? (i === 0 ? "answer-btn--true" : "answer-btn--false") : ""; }

  /** Escapa texto para insertarlo de forma segura como HTML. */
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Atajo para crear elementos con atributos e hijos. */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  /** Muestra una notificación breve. type: "", "success", "error". */
  function toast(message, type) {
    var container = document.getElementById("toast-container");
    if (!container) return;
    var t = el("div", { class: "toast " + (type || ""), text: message });
    container.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity 0.3s ease";
      t.style.opacity = "0";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 2600);
  }

  /**
   * Modal de confirmación. Devuelve una promesa que resuelve true/false.
   * opts: { title, message, confirmText, cancelText, danger }
   */
  function confirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var overlay = el("div", { class: "modal-overlay" });

      function close(result) {
        overlay.style.transition = "opacity 0.15s ease";
        overlay.style.opacity = "0";
        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 150);
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }
      function onKey(e) {
        if (e.key === "Escape") close(false);
        if (e.key === "Enter") close(true);
      }

      var confirmBtn = el("button", {
        class: "btn " + (opts.danger ? "btn--danger" : ""),
        text: opts.confirmText || "Aceptar",
        onClick: function () { close(true); }
      });
      var cancelBtn = el("button", {
        class: "btn btn--ghost",
        text: opts.cancelText || "Cancelar",
        onClick: function () { close(false); }
      });

      var modal = el("div", { class: "modal" }, [
        el("h3", { text: opts.title || "¿Confirmar?" }),
        opts.message ? el("p", { text: opts.message }) : null,
        el("div", { class: "modal__actions" }, [cancelBtn, confirmBtn])
      ]);

      overlay.appendChild(modal);
      overlay.addEventListener("click", function (e) { if (e.target === overlay) close(false); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(overlay);
      confirmBtn.focus();
    });
  }

  /** Descarga un texto como archivo. mime opcional (por defecto JSON). */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "application/json" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.UI = {
    COLOR_NAMES: COLOR_NAMES,
    ACCENT_COUNT: ACCENT_COUNT,
    monogram: monogram,
    coverAccentClass: coverAccentClass,
    isTF: isTF,
    answerColorClass: answerColorClass,
    escapeHtml: escapeHtml,
    el: el,
    toast: toast,
    confirm: confirm,
    download: download
  };
})(window, document);

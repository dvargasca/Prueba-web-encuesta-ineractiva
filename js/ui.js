/* =========================================================
   ui.js — Utilidades de interfaz compartidas
   ========================================================= */
(function (window, document) {
  "use strict";

  // Formas y nombres de los 4 colores icónicos (rojo, azul, amarillo, verde).
  var SHAPES = ["▲", "◆", "●", "■"];
  var COLOR_NAMES = ["Rojo", "Azul", "Amarillo", "Verde"];

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

  /** Descarga un texto como archivo. */
  function download(filename, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.UI = {
    SHAPES: SHAPES,
    COLOR_NAMES: COLOR_NAMES,
    escapeHtml: escapeHtml,
    el: el,
    toast: toast,
    confirm: confirm,
    download: download
  };
})(window, document);

/* =========================================================
   app.js — Orquestador principal y vista de inicio
   ========================================================= */
(function (window, document) {
  "use strict";

  var UI = window.UI;
  var el = UI.el;
  var toast = UI.toast;
  var confirm = UI.confirm;
  var Storage = window.QuizStorage;
  var Samples = window.QuizSamples;

  var root = document.getElementById("app");

  var ROLE_KEY = "quizaula_role";

  /* ---------- Rol: profesor/a vs. estudiante ----------
     La app es puramente de navegador: los cuestionarios viven en el
     localStorage de CADA navegador. Para que los estudiantes solo vean la
     pantalla de "entrar con PIN" (y no la biblioteca del profesor), separamos
     dos vistas:
       · Estudiante → vista por defecto (la que abre la dirección del juego).
       · Profesor/a → #profesor. El navegador del profe recuerda su rol para
         entrar directo a su biblioteca; el móvil del estudiante nunca lo tiene. */
  function getRole() { try { return localStorage.getItem(ROLE_KEY) || ""; } catch (e) { return ""; } }
  function setRole(r) { try { r ? localStorage.setItem(ROLE_KEY, r) : localStorage.removeItem(ROLE_KEY); } catch (e) {} }

  /** Cambia el # de la URL sin recargar ni ensuciar el historial. */
  function setHash(hash) {
    try {
      var url = hash ? ("#" + hash) : (window.location.pathname + window.location.search);
      if (window.history && window.history.replaceState) window.history.replaceState(null, "", url);
      else window.location.hash = hash || "";
    } catch (e) {}
  }

  /** Siembra el cuestionario de ejemplo la primera vez (solo en la vista del profe). */
  function seedSampleOnce() {
    try {
      if (Storage.isEmpty() && !localStorage.getItem("quizaula_seeded")) {
        Storage.save(Samples.sampleQuiz());
        localStorage.setItem("quizaula_seeded", "1");
      }
    } catch (e) {}
  }

  /* ---------- Navegación ---------- */

  function goHome() { window.scrollTo(0, 0); renderHome(); }

  /** Vista del estudiante: solo entrar con PIN y jugar. */
  function goStudent() { setHash("jugar"); window.scrollTo(0, 0); renderStudent(); }

  /** Vista del profesor/a: biblioteca completa (queda recordada en este navegador). */
  function goTeacher() { setRole("teacher"); setHash("profesor"); window.scrollTo(0, 0); renderHome(); }

  function goEditor(quiz) {
    window.scrollTo(0, 0);
    window.QuizEditor.render(root, quiz || Samples.blankQuiz(), {
      onExit: goHome,
      onSaved: function () { goHome(); }
    });
  }

  function goPlay(quiz) {
    window.scrollTo(0, 0);
    window.QuizGame.render(root, quiz, { onExit: goHome });
  }

  function goHostLive(quiz) {
    window.scrollTo(0, 0);
    window.QuizHost.render(root, quiz, { onExit: goHome });
  }

  function goJoin(pin, onExit) {
    window.scrollTo(0, 0);
    window.QuizPlayer.render(root, { pin: pin, onExit: onExit || goStudent });
  }

  function goServerConfig() {
    window.scrollTo(0, 0);
    window.Live.renderNeedsServer(root, el, {
      onConnect: function () { toast("Servidor guardado.", "success"); goHome(); },
      onExit: goHome
    });
  }

  /** Línea informativa del servidor del modo en vivo (en el pie del inicio). */
  function renderServerLine(node) {
    if (!window.Live || !window.Live.isLiveAvailable()) return;
    node.innerHTML = "";
    if (window.Live.isConfigured()) {
      node.appendChild(document.createTextNode("🔌 Servidor del modo en vivo: "));
      node.appendChild(el("b", { text: window.Live.getServerUrl() }));
      node.appendChild(document.createTextNode("  ·  "));
      node.appendChild(el("a", { href: "#", class: "server-link", text: "cambiar", onClick: function (e) { e.preventDefault(); goServerConfig(); } }));
    } else {
      node.appendChild(document.createTextNode("🔌 Modo en vivo · "));
      node.appendChild(el("a", { href: "#", class: "server-link", text: "conectar con un servidor remoto", onClick: function (e) { e.preventDefault(); goServerConfig(); } }));
    }
  }

  /* ---------- Acciones sobre cuestionarios ---------- */

  function duplicateQuiz(id) {
    var q = Storage.get(id);
    if (!q) return;
    var copy = JSON.parse(JSON.stringify(q));
    copy.id = "";
    copy.title = q.title + " (copia)";
    copy.createdAt = 0;
    Storage.save(copy);
    toast("Cuestionario duplicado.", "success");
    renderHome();
  }

  function deleteQuiz(id) {
    var q = Storage.get(id);
    if (!q) return;
    confirm({
      title: "¿Eliminar cuestionario?",
      message: "Se eliminará \"" + q.title + "\" de forma permanente.",
      confirmText: "Eliminar",
      danger: true
    }).then(function (ok) {
      if (ok) { Storage.remove(id); toast("Cuestionario eliminado."); renderHome(); }
    });
  }

  function exportQuiz(id) {
    var q = Storage.get(id);
    if (!q) return;
    var payload = { type: "quizaula", version: 1, quizzes: [q] };
    var safeName = (q.title || "cuestionario").replace(/[^\w\sáéíóúñ-]/gi, "").trim().replace(/\s+/g, "-").toLowerCase();
    UI.download("quizaula-" + (safeName || "cuestionario") + ".json", JSON.stringify(payload, null, 2));
    toast("Cuestionario exportado.", "success");
  }

  function exportAll() {
    var all = Storage.getAll();
    if (!all.length) { toast("No hay cuestionarios para exportar.", "error"); return; }
    var payload = { type: "quizaula", version: 1, quizzes: all };
    UI.download("quizaula-todos.json", JSON.stringify(payload, null, 2));
    toast("Se exportaron " + all.length + " cuestionarios.", "success");
  }

  /* ---------- Importación ---------- */

  function importFromFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        var quizzes = normalizeImport(data);
        if (!quizzes.length) throw new Error("vacío");

        var imported = 0;
        quizzes.forEach(function (q) {
          if (!q || !q.title || !Array.isArray(q.questions)) return;
          q.id = "";            // fuerza id nuevo para evitar colisiones
          q.createdAt = 0;
          Storage.save(q);
          imported++;
        });

        if (imported) {
          toast("Se importaron " + imported + " cuestionario(s).", "success");
          renderHome();
        } else {
          toast("El archivo no contiene cuestionarios válidos.", "error");
        }
      } catch (err) {
        toast("No se pudo leer el archivo. ¿Es un JSON de QuizAula válido?", "error");
      }
    };
    reader.readAsText(file);
  }

  function normalizeImport(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.quizzes)) return data.quizzes;
    if (data && data.title && Array.isArray(data.questions)) return [data];
    return [];
  }

  /* ---------- Tarjeta de cuestionario ---------- */

  function quizCard(q) {
    var count = (q.questions || []).length;

    var cover = el("div", { class: "quiz-card__cover" }, [
      el("span", { text: q.cover || "🎯" }),
      el("span", { class: "quiz-card__badge", text: count + (count === 1 ? " pregunta" : " preguntas") })
    ]);

    var body = el("div", { class: "quiz-card__body" }, [
      el("h3", { class: "quiz-card__title", text: q.title }),
      el("p", { class: "quiz-card__desc", text: q.description || "Sin descripción" })
    ]);

    var foot = el("div", { class: "quiz-card__foot" }, [
      el("button", { class: "btn btn--success", html: "🎮 En vivo", title: "Anfitrión: los estudiantes se unen con un PIN", onClick: function () { goHostLive(q); } }),
      el("button", { class: "btn btn--ghost", html: "▶ Solo", title: "Jugar en este dispositivo", onClick: function () { goPlay(q); } }),
      el("button", { class: "btn btn--ghost btn--sm", title: "Editar", "aria-label": "Editar", text: "✏️", onClick: function () { goEditor(q); } }),
      el("button", { class: "btn btn--ghost btn--sm", title: "Duplicar", "aria-label": "Duplicar", text: "⧉", onClick: function () { duplicateQuiz(q.id); } }),
      el("button", { class: "btn btn--ghost btn--sm", title: "Exportar", "aria-label": "Exportar", text: "⬇", onClick: function () { exportQuiz(q.id); } }),
      el("button", { class: "btn btn--ghost btn--sm", title: "Eliminar", "aria-label": "Eliminar", text: "🗑", onClick: function () { deleteQuiz(q.id); } })
    ]);

    return el("div", { class: "quiz-card" }, [cover, body, foot]);
  }

  /* ---------- Vista del ESTUDIANTE (solo entrar con PIN) ---------- */

  function renderStudent() {
    var pinInput = el("input", {
      class: "input student__pin", type: "tel", inputmode: "numeric", maxlength: 8,
      placeholder: "PIN del juego", "aria-label": "PIN del juego"
    });

    function submit(e) {
      if (e) e.preventDefault();
      var pin = (pinInput.value || "").trim();
      if (!/^\d{4,8}$/.test(pin)) { toast("Escribe el PIN que ves en la pantalla.", "error"); pinInput.focus(); return; }
      goJoin(pin, goStudent);
    }

    var form = el("form", { class: "student__form", onSubmit: submit }, [
      pinInput,
      el("button", { class: "btn btn--lg btn--block", type: "submit", style: "margin-top:1rem;", html: "Entrar 🚀" })
    ]);

    var card = el("div", { class: "game-start__card" }, [
      el("div", { class: "game-start__emoji", text: "🎮" }),
      el("h2", { text: "Unirse al juego" }),
      el("p", { text: "Escribe el PIN que aparece en la pantalla de tu profesor/a para entrar." }),
      form
    ]);

    var teacherLink = el("p", { class: "student__foot" }, [
      el("a", {
        href: "#profesor", class: "student__teacher-link",
        text: "¿Eres el profesor/a? Entra aquí →",
        onClick: function (e) { e.preventDefault(); goTeacher(); }
      })
    ]);

    var view = el("div", { class: "game" }, [
      el("div", { class: "game-start" }, [
        el("div", { class: "student__brand" }, [
          el("span", { class: "brand__logo", text: "🎯" }),
          el("span", { text: "QuizAula" })
        ]),
        card,
        teacherLink
      ])
    ]);

    root.innerHTML = "";
    root.appendChild(view);
    setTimeout(function () { pinInput.focus(); }, 60);
  }

  /* ---------- Vista de inicio (PROFESOR/A) ---------- */

  function renderHome() {
    seedSampleOnce();
    var quizzes = Storage.getAll();

    // Input oculto para importar
    var importInput = el("input", {
      type: "file",
      accept: "application/json,.json",
      class: "hidden",
      onchange: function (e) { importFromFile(e.target.files[0]); e.target.value = ""; }
    });

    var topbar = el("div", { class: "topbar" }, [
      el("div", { class: "container topbar__inner" }, [
        el("button", { class: "brand", onClick: goHome }, [
          el("span", { class: "brand__logo", text: "🎯" }),
          el("span", { text: "QuizAula" })
        ]),
        el("span", { class: "topbar__spacer" }),
        el("div", { class: "topbar__actions" }, [
          el("button", { class: "btn btn--sm topbar__exit", title: "Salir de la vista de profesor/a (volver a la de estudiante)", onClick: function () { setRole(""); goStudent(); } },
            [el("span", { text: "👋 " }), el("span", { class: "txt", text: "Salir" })]),
          el("button", { class: "btn btn--light btn--sm", onClick: function () { importInput.click(); } },
            [el("span", { text: "⬆ " }), el("span", { class: "txt", text: "Importar" })]),
          el("button", { class: "btn btn--sm", onClick: function () { goEditor(null); } },
            [el("span", { text: "➕ " }), el("span", { class: "txt", text: "Crear" })])
        ]),
        importInput
      ])
    ]);

    // Caja para que los estudiantes se unan con un PIN
    var joinPin = el("input", {
      class: "joinbar__pin", type: "tel", inputmode: "numeric", maxlength: 6,
      placeholder: "PIN del juego", "aria-label": "PIN del juego"
    });
    function submitJoin(e) {
      if (e) e.preventDefault();
      var pin = (joinPin.value || "").trim();
      if (!/^\d{4,8}$/.test(pin)) { toast("Escribe el PIN que ves en la pantalla.", "error"); joinPin.focus(); return; }
      goJoin(pin, goHome);
    }
    var joinBar = el("form", { class: "joinbar", onSubmit: submitJoin }, [
      el("span", { class: "joinbar__label", text: "¿Eres estudiante?" }),
      joinPin,
      el("button", { class: "btn btn--light", type: "submit", html: "Entrar →" })
    ]);

    // Héroe
    var hero = el("div", { class: "hero" }, [
      el("div", { class: "hero__shapes" }, [
        el("span", { class: "hero__shape", style: "top:12%; left:8%; font-size:3rem;", text: "▲" }),
        el("span", { class: "hero__shape", style: "top:60%; left:14%; font-size:2.4rem;", text: "◆" }),
        el("span", { class: "hero__shape", style: "top:22%; right:12%; font-size:2.8rem;", text: "●" }),
        el("span", { class: "hero__shape", style: "top:64%; right:9%; font-size:3.2rem;", text: "■" })
      ]),
      el("div", { class: "container" }, [
        joinBar,
        el("h1", { text: "Cuestionarios interactivos para tu clase" }),
        el("p", { text: "Crea las preguntas, proyéctalas y deja que tus estudiantes se unan desde el móvil con un PIN y compitan en tiempo real." }),
        el("div", { class: "hero__cta" }, [
          el("button", { class: "btn btn--lg btn--light", html: "➕ Crear cuestionario", onClick: function () { goEditor(null); } }),
          quizzes.length
            ? el("button", { class: "btn btn--lg", html: "🎮 Jugar en vivo", onClick: function () { goHostLive(quizzes[0]); } })
            : null
        ])
      ])
    ]);

    // Biblioteca
    var libraryHead = el("div", { class: "library__head" }, [
      el("h2", { text: "Mis cuestionarios" }),
      el("div", { class: "library__tools" }, [
        quizzes.length ? el("button", { class: "btn btn--light btn--sm", html: "⬇ Exportar todos", onClick: exportAll }) : null
      ])
    ]);

    var grid;
    if (quizzes.length) {
      grid = el("div", { class: "quiz-grid" }, quizzes.map(quizCard));
    } else {
      grid = el("div", { class: "empty" }, [
        el("div", { class: "empty__emoji", text: "📝" }),
        el("h3", { text: "Aún no tienes cuestionarios" }),
        el("p", { text: "Crea tu primer cuestionario o importa uno que ya tengas." }),
        el("button", { class: "btn btn--lg", html: "➕ Crear mi primer cuestionario", style: "margin-top:0.8rem;", onClick: function () { goEditor(null); } })
      ]);
    }

    var library = el("div", { class: "container library" }, [libraryHead, grid]);

    var serverLine = el("p", { style: "margin-top:0.6rem; font-size:0.8rem; opacity:0.9;" });
    renderServerLine(serverLine);

    var footer = el("div", { class: "container", style: "text-align:center; color:var(--ink-soft); padding:3rem 0 2rem; font-size:0.85rem;" }, [
      el("p", { text: "QuizAula · Tus cuestionarios se guardan localmente en este navegador. Usa \"Exportar\" para hacer copias de seguridad o compartirlos." }),
      serverLine
    ]);

    var view = el("div", { class: "home" }, [topbar, hero, library, footer]);

    root.innerHTML = "";
    root.appendChild(view);
  }

  /* ---------- Arranque ---------- */

  /** ¿Hay una sesión de jugador en vivo guardada? (para reconectar tras recargar). */
  function hasLiveSession() {
    try { return !!sessionStorage.getItem("quizaula_live_session"); } catch (e) { return false; }
  }

  /** Decide qué vista mostrar según el # de la URL y el rol recordado. */
  function route() {
    var hash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    if (hash === "profesor" || hash === "profe" || hash === "teacher") { goTeacher(); return; }
    if (hash === "jugar" || hash === "estudiante" || hash === "student") { renderStudent(); return; }
    // Sin # explícito: solo el navegador del profe (recordado) ve la biblioteca.
    if (getRole() === "teacher") { renderHome(); return; }
    renderStudent();
  }

  function boot() {
    // Si el estudiante recargó a mitad de partida, retomamos su sesión en vivo.
    if (window.Live && window.Live.isLiveAvailable() && hasLiveSession()) {
      goJoin();
      return;
    }
    route();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Cambiar el # a mano en la barra de direcciones también cambia de vista.
  window.addEventListener("hashchange", route);

  // Exponer utilidades por si se quieren usar desde la consola
  window.QuizApp = { goHome: goHome, goEditor: goEditor, goPlay: goPlay, goHostLive: goHostLive, goJoin: goJoin, goStudent: goStudent, goTeacher: goTeacher };
})(window, document);

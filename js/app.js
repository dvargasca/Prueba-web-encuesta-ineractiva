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

  /* ---------- Navegación ---------- */

  function goHome() { window.scrollTo(0, 0); renderHome(); }

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
      el("button", { class: "btn btn--success", html: "▶ Jugar", onClick: function () { goPlay(q); } }),
      el("button", { class: "btn btn--ghost", html: "✏️ Editar", onClick: function () { goEditor(q); } }),
      el("button", { class: "btn btn--ghost btn--sm", title: "Duplicar", "aria-label": "Duplicar", text: "⧉", onClick: function () { duplicateQuiz(q.id); } }),
      el("button", { class: "btn btn--ghost btn--sm", title: "Exportar", "aria-label": "Exportar", text: "⬇", onClick: function () { exportQuiz(q.id); } }),
      el("button", { class: "btn btn--ghost btn--sm", title: "Eliminar", "aria-label": "Eliminar", text: "🗑", onClick: function () { deleteQuiz(q.id); } })
    ]);

    return el("div", { class: "quiz-card" }, [cover, body, foot]);
  }

  /* ---------- Vista de inicio ---------- */

  function renderHome() {
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
          el("button", { class: "btn btn--light btn--sm", onClick: function () { importInput.click(); } },
            [el("span", { text: "⬆ " }), el("span", { class: "txt", text: "Importar" })]),
          el("button", { class: "btn btn--sm", onClick: function () { goEditor(null); } },
            [el("span", { text: "➕ " }), el("span", { class: "txt", text: "Crear" })])
        ]),
        importInput
      ])
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
        el("h1", { text: "Cuestionarios interactivos para tu clase" }),
        el("p", { text: "Crea preguntas, proyéctalas y deja que tus estudiantes compitan contra el reloj. Todo se guarda en tu navegador." }),
        el("div", { class: "hero__cta" }, [
          el("button", { class: "btn btn--lg btn--light", html: "➕ Crear cuestionario", onClick: function () { goEditor(null); } }),
          quizzes.length
            ? el("button", { class: "btn btn--lg", html: "▶ Jugar el primero", onClick: function () { goPlay(quizzes[0]); } })
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

    var footer = el("div", { class: "container", style: "text-align:center; color:var(--ink-soft); padding:3rem 0 2rem; font-size:0.85rem;" }, [
      el("p", { text: "QuizAula · Tus cuestionarios se guardan localmente en este navegador. Usa \"Exportar\" para hacer copias de seguridad o compartirlos." })
    ]);

    var view = el("div", { class: "home" }, [topbar, hero, library, footer]);

    root.innerHTML = "";
    root.appendChild(view);
  }

  /* ---------- Arranque ---------- */

  function boot() {
    // Sembrar el ejemplo la primera vez
    if (Storage.isEmpty() && !localStorage.getItem("quizaula_seeded")) {
      Storage.save(Samples.sampleQuiz());
      localStorage.setItem("quizaula_seeded", "1");
    }
    renderHome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Exponer utilidades por si se quieren usar desde la consola
  window.QuizApp = { goHome: goHome, goEditor: goEditor, goPlay: goPlay };
})(window, document);

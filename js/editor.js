/* =========================================================
   editor.js — Vista para crear y editar cuestionarios
   ========================================================= */
(function (window, document) {
  "use strict";

  var el = window.UI.el;
  var SHAPES = window.UI.SHAPES;
  var toast = window.UI.toast;
  var confirm = window.UI.confirm;
  var Samples = window.QuizSamples;

  var TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
  var POINT_OPTIONS = [
    { value: 500, label: "Estándar (500)" },
    { value: 1000, label: "Doble (1000)" },
    { value: 2000, label: "Triple (2000)" }
  ];

  var state = { quiz: null, onExit: null, onSaved: null };

  /* ---------- Manipulación del modelo ---------- */

  function addQuestion() {
    state.quiz.questions.push(Samples.blankQuestion());
    renderQuestions();
    // Desplaza a la nueva pregunta
    var cards = document.querySelectorAll(".q-card");
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function duplicateQuestion(index) {
    var copy = JSON.parse(JSON.stringify(state.quiz.questions[index]));
    copy.id = "it_" + Math.random().toString(36).slice(2, 9);
    state.quiz.questions.splice(index + 1, 0, copy);
    renderQuestions();
  }

  function removeQuestion(index) {
    if (state.quiz.questions.length <= 1) {
      toast("El cuestionario necesita al menos una pregunta.", "error");
      return;
    }
    state.quiz.questions.splice(index, 1);
    renderQuestions();
  }

  function moveQuestion(index, dir) {
    var target = index + dir;
    if (target < 0 || target >= state.quiz.questions.length) return;
    var arr = state.quiz.questions;
    var tmp = arr[index]; arr[index] = arr[target]; arr[target] = tmp;
    renderQuestions();
  }

  function addAnswer(qIndex) {
    var q = state.quiz.questions[qIndex];
    if (q.answers.length >= 4) return;
    q.answers.push(Samples.blankAnswer("", false));
    renderQuestions();
  }

  function removeAnswer(qIndex, aIndex) {
    var q = state.quiz.questions[qIndex];
    if (q.answers.length <= 2) {
      toast("Cada pregunta necesita al menos dos respuestas.", "error");
      return;
    }
    q.answers.splice(aIndex, 1);
    renderQuestions();
  }

  /* ---------- Imagen ---------- */

  function handleImage(qIndex, file) {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast("La imagen es muy grande (máx. 1,5 MB).", "error");
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      state.quiz.questions[qIndex].image = e.target.result;
      renderQuestions();
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Validación ---------- */

  function validate() {
    var errors = [];
    if (!state.quiz.title.trim()) errors.push("Ponle un título al cuestionario.");
    if (!state.quiz.questions.length) errors.push("Añade al menos una pregunta.");

    state.quiz.questions.forEach(function (q, i) {
      var n = i + 1;
      if (!q.text.trim()) errors.push("La pregunta " + n + " no tiene enunciado.");
      var filled = q.answers.filter(function (a) { return a.text.trim(); });
      if (filled.length < 2) errors.push("La pregunta " + n + " necesita al menos dos respuestas con texto.");
      var correct = q.answers.filter(function (a) { return a.correct && a.text.trim(); });
      if (correct.length < 1) errors.push("La pregunta " + n + " no tiene una respuesta correcta marcada.");
    });
    return errors;
  }

  function save() {
    var errors = validate();
    if (errors.length) {
      toast(errors[0], "error");
      return;
    }
    // Limpia respuestas vacías antes de guardar
    state.quiz.questions.forEach(function (q) {
      q.answers = q.answers.filter(function (a) { return a.text.trim() !== ""; });
      q.timeLimit = Number(q.timeLimit) || 20;
      q.points = Number(q.points) || 1000;
    });
    var saved = window.QuizStorage.save(state.quiz);
    toast("Cuestionario guardado.", "success");
    if (state.onSaved) state.onSaved(saved);
  }

  /* ---------- Render de una respuesta ---------- */

  function renderAnswerEditor(q, qIndex, a, aIndex) {
    var textInput = el("input", {
      type: "text",
      value: a.text,
      maxlength: 120,
      placeholder: "Respuesta " + (aIndex + 1),
      "aria-label": "Texto de la respuesta " + (aIndex + 1),
      oninput: function (e) { a.text = e.target.value; }
    });

    var correctToggle = el("label", { class: "correct-toggle", title: "Marcar como correcta" }, [
      el("input", {
        type: "checkbox",
        checked: a.correct ? "checked" : null,
        "aria-label": "Marcar respuesta " + (aIndex + 1) + " como correcta",
        onchange: function (e) { a.correct = e.target.checked; }
      }),
      "Correcta"
    ]);

    var children = [
      el("span", { class: "shape", text: SHAPES[aIndex] }),
      textInput,
      correctToggle
    ];

    if (q.answers.length > 2) {
      children.push(el("button", {
        class: "remove-answer",
        title: "Eliminar respuesta",
        "aria-label": "Eliminar respuesta " + (aIndex + 1),
        text: "✕",
        onClick: function () { removeAnswer(qIndex, aIndex); }
      }));
    }

    return el("div", { class: "answer-edit", "data-color": aIndex }, children);
  }

  /* ---------- Render de una pregunta ---------- */

  function renderQuestionCard(q, index) {
    var total = state.quiz.questions.length;

    var timeSelect = el("select", {
      class: "select",
      "aria-label": "Tiempo límite",
      onchange: function (e) { q.timeLimit = Number(e.target.value); }
    }, TIME_OPTIONS.map(function (t) {
      return el("option", { value: t, selected: Number(q.timeLimit) === t ? "selected" : null, text: t + " s" });
    }));

    var pointsSelect = el("select", {
      class: "select",
      "aria-label": "Puntos",
      onchange: function (e) { q.points = Number(e.target.value); }
    }, POINT_OPTIONS.map(function (p) {
      return el("option", { value: p.value, selected: Number(q.points) === p.value ? "selected" : null, text: p.label });
    }));

    var head = el("div", { class: "q-card__head" }, [
      el("span", { class: "q-card__num", text: index + 1 }),
      el("strong", { text: "Pregunta " + (index + 1) + " de " + total }),
      el("span", { class: "spacer" }),
      el("button", { class: "icon-btn", title: "Subir", "aria-label": "Mover pregunta arriba", text: "↑", onClick: function () { moveQuestion(index, -1); } }),
      el("button", { class: "icon-btn", title: "Bajar", "aria-label": "Mover pregunta abajo", text: "↓", onClick: function () { moveQuestion(index, 1); } }),
      el("button", { class: "icon-btn", title: "Duplicar", "aria-label": "Duplicar pregunta", text: "⧉", onClick: function () { duplicateQuestion(index); } }),
      el("button", { class: "icon-btn", title: "Eliminar", "aria-label": "Eliminar pregunta", text: "🗑", onClick: function () { removeQuestion(index); } })
    ]);

    var questionField = el("div", { class: "field" }, [
      el("label", { text: "Enunciado" }),
      el("textarea", {
        class: "textarea",
        maxlength: 300,
        placeholder: "Escribe aquí la pregunta…",
        oninput: function (e) { q.text = e.target.value; }
      }, q.text)
    ]);

    // Imagen
    var imageControls = [];
    if (q.image) {
      imageControls.push(el("div", { class: "q-image-preview" }, [
        el("img", { src: q.image, alt: "Imagen de la pregunta" })
      ]));
      imageControls.push(el("button", {
        class: "btn btn--ghost btn--sm",
        text: "Quitar imagen",
        onClick: function () { q.image = null; renderQuestions(); }
      }));
    } else {
      var fileInput = el("input", {
        type: "file",
        accept: "image/*",
        class: "hidden",
        onchange: function (e) { handleImage(index, e.target.files[0]); }
      });
      var pickBtn = el("button", {
        class: "btn btn--ghost btn--sm",
        text: "🖼 Añadir imagen (opcional)",
        onClick: function () { fileInput.click(); }
      });
      imageControls.push(fileInput, pickBtn);
    }
    var imageField = el("div", { class: "field" }, imageControls);

    var answersGrid = el("div", { class: "answers-edit" },
      q.answers.map(function (a, ai) { return renderAnswerEditor(q, index, a, ai); })
    );

    var answerActions = [];
    if (q.answers.length < 4) {
      answerActions.push(el("button", {
        class: "btn btn--ghost btn--sm",
        text: "+ Añadir respuesta",
        onClick: function () { addAnswer(index); }
      }));
    }
    answerActions.push(el("span", {
      class: "field hint",
      style: "margin:0.5rem 0 0; align-self:center;",
      text: "Marca la casilla \"Correcta\" en la respuesta o respuestas válidas."
    }));

    var settingsRow = el("div", { class: "row" }, [
      el("div", { class: "field" }, [el("label", { text: "⏱ Tiempo límite" }), timeSelect]),
      el("div", { class: "field" }, [el("label", { text: "⭐ Puntos" }), pointsSelect])
    ]);

    return el("div", { class: "q-card" }, [
      head,
      questionField,
      imageField,
      el("label", { text: "Respuestas", style: "font-weight:600; font-size:0.92rem;" }),
      answersGrid,
      el("div", { style: "display:flex; gap:0.6rem; flex-wrap:wrap; margin:0.6rem 0 1rem;" }, answerActions),
      settingsRow
    ]);
  }

  function renderQuestions() {
    var container = document.getElementById("questions-list");
    if (!container) return;
    container.innerHTML = "";
    state.quiz.questions.forEach(function (q, i) {
      container.appendChild(renderQuestionCard(q, i));
    });
  }

  /* ---------- Selector de portada (emoji) ---------- */

  function renderCoverPicker() {
    var current = el("span", { style: "font-size:2rem;", text: state.quiz.cover || "🎯" });
    var palette = el("div", { style: "display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.4rem;" },
      Samples.COVERS.map(function (emoji) {
        return el("button", {
          class: "btn btn--ghost btn--sm",
          style: "padding:0.3rem 0.5rem; font-size:1.2rem;" + (state.quiz.cover === emoji ? " border-color:var(--purple-500);" : ""),
          text: emoji,
          onClick: function () { state.quiz.cover = emoji; current.textContent = emoji; renderCoverPickerRefresh(); }
        });
      })
    );
    return el("div", { class: "field" }, [
      el("label", { html: "Icono del cuestionario " + '<span class="hint">(portada)</span>' }),
      el("div", { style: "display:flex; align-items:center; gap:0.8rem;" }, [current, palette])
    ]);
  }

  function renderCoverPickerRefresh() {
    var holder = document.getElementById("cover-holder");
    if (holder) { holder.innerHTML = ""; holder.appendChild(renderCoverPicker()); }
  }

  /* ---------- Render principal ---------- */

  function render(root, quiz, callbacks) {
    // Trabajamos sobre una copia para no mutar hasta guardar
    state.quiz = JSON.parse(JSON.stringify(quiz));
    if (!state.quiz.questions || !state.quiz.questions.length) {
      state.quiz.questions = [Samples.blankQuestion()];
    }
    if (!state.quiz.cover) state.quiz.cover = "🎯";
    state.onExit = callbacks.onExit;
    state.onSaved = callbacks.onSaved;

    var isNew = !quiz.id;

    var backBtn = el("button", {
      class: "btn btn--ghost",
      html: "← Volver",
      onClick: function () {
        confirm({
          title: "¿Salir del editor?",
          message: "Se perderán los cambios que no hayas guardado.",
          confirmText: "Salir sin guardar",
          danger: true
        }).then(function (ok) { if (ok && state.onExit) state.onExit(); });
      }
    });

    var saveBtn = el("button", { class: "btn btn--success", html: "💾 Guardar", onClick: save });

    var bar = el("div", { class: "editor__bar" }, [
      el("div", { class: "container editor__bar-inner" }, [
        backBtn,
        el("strong", { text: isNew ? "Nuevo cuestionario" : "Editando cuestionario", style: "font-size:1.1rem;" }),
        el("span", { style: "flex:1;" }),
        saveBtn
      ])
    ]);

    var metaPanel = el("div", { class: "panel" }, [
      el("div", { class: "field" }, [
        el("label", { text: "Título del cuestionario" }),
        el("input", {
          class: "input",
          type: "text",
          maxlength: 100,
          value: state.quiz.title,
          placeholder: "Ej. Repaso de historia — Tema 3",
          oninput: function (e) { state.quiz.title = e.target.value; }
        })
      ]),
      el("div", { class: "field" }, [
        el("label", { html: 'Descripción <span class="hint">(opcional)</span>' }),
        el("textarea", {
          class: "textarea",
          maxlength: 200,
          placeholder: "Una frase que describa el cuestionario…",
          oninput: function (e) { state.quiz.description = e.target.value; }
        }, state.quiz.description || "")
      ]),
      el("div", { id: "cover-holder" }, [renderCoverPicker()])
    ]);

    var questionsPanel = el("div", { class: "panel" }, [
      el("h3", { text: "Preguntas" }),
      el("div", { id: "questions-list" }),
      el("div", { class: "add-q" }, [
        el("button", { class: "btn", html: "➕ Añadir pregunta", onClick: addQuestion })
      ])
    ]);

    var footer = el("div", { class: "container", style: "margin-top:1.6rem; display:flex; justify-content:flex-end; gap:0.6rem;" }, [
      el("button", { class: "btn btn--success btn--lg", html: "💾 Guardar cuestionario", onClick: save })
    ]);

    var view = el("div", { class: "editor" }, [
      bar,
      el("div", { class: "container" }, [metaPanel, questionsPanel]),
      footer
    ]);

    root.innerHTML = "";
    root.appendChild(view);
    renderQuestions();
  }

  window.QuizEditor = { render: render };
})(window, document);

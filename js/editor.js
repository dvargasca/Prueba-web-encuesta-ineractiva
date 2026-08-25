/* =========================================================
   editor.js — Vista para crear y editar cuestionarios
   ========================================================= */
(function (window, document) {
  "use strict";

  var el = window.UI.el;
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

  /* ---------- Tipo de pregunta ---------- */

  function setType(qIndex, type) {
    var q = state.quiz.questions[qIndex];
    if ((q.type || "multiple") === type) return;
    if (type === "tf") {
      // Si la 2ª opción era la correcta, mantenemos "Falso" como correcta.
      var falseCorrect = q.answers[1] && q.answers[1].correct && !(q.answers[0] && q.answers[0].correct);
      q.type = "tf";
      q.answers = [
        Samples.blankAnswer("Verdadero", !falseCorrect),
        Samples.blankAnswer("Falso", falseCorrect)
      ];
    } else {
      q.type = "multiple";
      if (q.answers.length < 2) {
        q.answers = [Samples.blankAnswer("", true), Samples.blankAnswer("", false)];
      }
    }
    renderQuestions();
  }

  // En verdadero/falso solo puede haber una respuesta correcta (comportamiento de radio).
  function setTFCorrect(q, aIndex) {
    q.answers.forEach(function (a, i) { a.correct = (i === aIndex); });
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
    var tf = window.UI.isTF(q);

    var textNode;
    if (tf) {
      textNode = el("span", { class: "answer-edit__fixed", text: a.text });
    } else {
      textNode = el("input", {
        type: "text",
        value: a.text,
        maxlength: 500,
        placeholder: "Respuesta " + (aIndex + 1),
        "aria-label": "Texto de la respuesta " + (aIndex + 1),
        oninput: function (e) { a.text = e.target.value; }
      });
    }

    var correctToggle = el("label", { class: "correct-toggle", title: "Marcar como correcta" }, [
      el("input", {
        type: tf ? "radio" : "checkbox",
        name: tf ? ("correct-" + qIndex) : null,
        checked: a.correct ? "checked" : null,
        "aria-label": "Marcar como correcta",
        onchange: function (e) {
          if (tf) setTFCorrect(q, aIndex);
          else a.correct = e.target.checked;
        }
      }),
      "Correcta"
    ]);

    var children = [
      el("span", { class: "shape" }),
      textNode,
      correctToggle
    ];

    if (!tf && q.answers.length > 2) {
      children.push(el("button", {
        class: "remove-answer",
        title: "Eliminar respuesta",
        "aria-label": "Eliminar respuesta " + (aIndex + 1),
        text: "✕",
        onClick: function () { removeAnswer(qIndex, aIndex); }
      }));
    }

    // En verdadero/falso: Verdadero = verde, Falso = rojo (clases propias).
    var rowClass = "answer-edit" + (tf ? (aIndex === 0 ? " answer-edit--true" : " answer-edit--false") : "");
    return el("div", { class: rowClass, "data-color": tf ? null : aIndex }, children);
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
      el("button", { class: "icon-btn", title: "Duplicar", "aria-label": "Duplicar pregunta", text: "❏", onClick: function () { duplicateQuestion(index); } }),
      el("button", { class: "icon-btn", title: "Eliminar", "aria-label": "Eliminar pregunta", text: "✕", onClick: function () { removeQuestion(index); } })
    ]);

    var questionField = el("div", { class: "field" }, [
      el("label", { text: "Enunciado" }),
      el("textarea", {
        class: "textarea",
        maxlength: 400,
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
        text: "Añadir imagen (opcional)",
        onClick: function () { fileInput.click(); }
      });
      imageControls.push(fileInput, pickBtn);
    }
    var imageField = el("div", { class: "field" }, imageControls);

    var tf = window.UI.isTF(q);

    // Selector de tipo de pregunta
    var typeToggle = el("div", { class: "field" }, [
      el("label", { text: "Tipo de pregunta" }),
      el("div", { class: "type-toggle" }, [
        el("button", {
          class: "type-toggle__btn" + (!tf ? " is-active" : ""),
          text: "Opción múltiple",
          onClick: function () { setType(index, "multiple"); }
        }),
        el("button", {
          class: "type-toggle__btn" + (tf ? " is-active" : ""),
          text: "Verdadero / Falso",
          onClick: function () { setType(index, "tf"); }
        })
      ])
    ]);

    var answersGrid = el("div", { class: "answers-edit" + (tf ? " answers-edit--tf" : "") },
      q.answers.map(function (a, ai) { return renderAnswerEditor(q, index, a, ai); })
    );

    var answerActions = [];
    if (!tf && q.answers.length < 4) {
      answerActions.push(el("button", {
        class: "btn btn--ghost btn--sm",
        text: "+ Añadir respuesta",
        onClick: function () { addAnswer(index); }
      }));
    }
    answerActions.push(el("span", {
      class: "field hint",
      style: "margin:0.5rem 0 0; align-self:center;",
      text: tf ? "Elige cuál es la respuesta correcta." : "Marca la casilla \"Correcta\" en la respuesta o respuestas válidas."
    }));

    var settingsRow = el("div", { class: "row" }, [
      el("div", { class: "field" }, [el("label", { text: "Tiempo límite" }), timeSelect]),
      el("div", { class: "field" }, [el("label", { text: "Puntos" }), pointsSelect])
    ]);

    return el("div", { class: "q-card" }, [
      head,
      questionField,
      imageField,
      typeToggle,
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

  /* ---------- Selector de color de acento de la portada ---------- */

  function renderCoverPicker() {
    var preview = el("div", {
      id: "cover-mono",
      class: "accent-preview " + window.UI.coverAccentClass(state.quiz.cover),
      text: window.UI.monogram(state.quiz.title)
    });

    var swatches = el("div", { class: "accent-swatches" });
    for (var i = 0; i < window.UI.ACCENT_COUNT; i++) {
      (function (idx) {
        swatches.appendChild(el("button", {
          type: "button",
          class: "accent-swatch cover-accent--" + idx + (Number(state.quiz.cover) === idx ? " is-active" : ""),
          "aria-label": "Color de portada " + (idx + 1),
          onClick: function () { state.quiz.cover = idx; renderCoverPickerRefresh(); }
        }));
      })(i);
    }

    return el("div", { class: "field" }, [
      el("label", { html: "Color de la portada " + '<span class="hint">(se muestra con la inicial del título)</span>' }),
      el("div", { class: "accent-picker" }, [preview, swatches])
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
    if (state.quiz.cover == null || isNaN(Number(state.quiz.cover))) state.quiz.cover = 0;
    state.onExit = callbacks.onExit;
    state.onSaved = callbacks.onSaved;

    var isNew = !quiz.id;

    var backBtn = el("button", {
      class: "btn btn--ghost",
      text: "← Volver",
      onClick: function () {
        confirm({
          title: "¿Salir del editor?",
          message: "Se perderán los cambios que no hayas guardado.",
          confirmText: "Salir sin guardar",
          danger: true
        }).then(function (ok) { if (ok && state.onExit) state.onExit(); });
      }
    });

    var saveBtn = el("button", { class: "btn btn--success", text: "Guardar", onClick: save });

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
          oninput: function (e) {
            state.quiz.title = e.target.value;
            var mono = document.getElementById("cover-mono");
            if (mono) mono.textContent = window.UI.monogram(state.quiz.title);
          }
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
        el("button", { class: "btn", text: "Añadir pregunta", onClick: addQuestion })
      ])
    ]);

    var footer = el("div", { class: "container", style: "margin-top:1.6rem; display:flex; justify-content:flex-end; gap:0.6rem;" }, [
      el("button", { class: "btn btn--success btn--lg", text: "Guardar cuestionario", onClick: save })
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

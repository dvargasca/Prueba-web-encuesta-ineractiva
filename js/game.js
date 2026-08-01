/* =========================================================
   game.js — Motor de juego (modo individual, sin conexión)
   ========================================================= */
(function (window, document) {
  "use strict";

  var el = window.UI.el;

  var RING_R = 32;
  var RING_C = 2 * Math.PI * RING_R;

  var game = null;      // estado de la partida en curso
  var rootEl = null;    // contenedor
  var onExit = null;    // callback para volver

  /* ---------- Utilidades ---------- */

  function clearTimer() {
    if (game && game.timerId) { clearInterval(game.timerId); game.timerId = null; }
  }

  function computeScore(points, timeLimit, remainingMs) {
    // Puntuación completa si respondes al instante, bajando al 50 % al final.
    var frac = Math.max(0, Math.min(1, remainingMs / (timeLimit * 1000)));
    return Math.round(points * (0.5 + 0.5 * frac));
  }

  // Bonus por racha: +100 por cada acierto encadenado (desde el 2.º), con tope en +500.
  function streakBonus(streak) {
    return Math.min(Math.max(streak - 1, 0), 5) * 100;
  }

  function detachKeys() {
    if (game && game.keyHandler) {
      document.removeEventListener("keydown", game.keyHandler);
      game.keyHandler = null;
    }
  }

  /* ---------- Pantalla de inicio ---------- */

  function renderStart() {
    var nameInput = el("input", {
      class: "input",
      type: "text",
      maxlength: 24,
      placeholder: "Tu nombre (opcional)",
      value: game.playerName || "",
      style: "text-align:center; margin-bottom:1rem;",
      oninput: function (e) { game.playerName = e.target.value; }
    });

    var startBtn = el("button", {
      class: "btn btn--lg btn--block",
      text: "¡Empezar!",
      onClick: startQuestions
    });

    nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") startQuestions(); });

    var card = el("div", { class: "game-start__card" }, [
      el("div", { class: "game-start__cover " + window.UI.coverAccentClass(game.quiz.cover), text: window.UI.monogram(game.quiz.title) }),
      el("h2", { text: game.quiz.title }),
      el("p", { text: game.quiz.questions.length + " pregunta" + (game.quiz.questions.length === 1 ? "" : "s") +
        (game.quiz.description ? " · " + game.quiz.description : "") }),
      nameInput,
      startBtn
    ]);

    var view = el("div", { class: "game" }, [
      el("div", { class: "game__top" }, [
        el("button", { class: "btn btn--light btn--sm", text: "← Salir", onClick: exit }),
        el("span", { class: "spacer" }),
        el("span", { class: "brand", style: "font-size:1.1rem;" }, [
          el("span", { class: "brand__logo", text: "Q" }), "QuizAula"
        ])
      ]),
      el("div", { class: "game-start" }, [card])
    ]);

    rootEl.innerHTML = "";
    rootEl.appendChild(view);
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  /* ---------- Comienzo de las preguntas ---------- */

  function startQuestions() {
    game.index = 0;
    game.score = 0;
    game.correctCount = 0;
    game.streak = 0;
    game.maxStreak = 0;
    renderQuestion();
  }

  /* ---------- Render de una pregunta ---------- */

  function renderQuestion() {
    detachKeys();
    clearTimer();

    var q = game.quiz.questions[game.index];
    var total = game.quiz.questions.length;
    var timeLimit = Number(q.timeLimit) || 20;
    game.answered = false;
    game.timeLimit = timeLimit;
    game.deadline = Date.now() + timeLimit * 1000;

    // Barra superior
    var top = el("div", { class: "game__top" }, [
      el("span", { class: "pill", html: "Pregunta <strong>" + (game.index + 1) + "</strong> / " + total }),
      el("span", { class: "spacer" }),
      el("span", { class: "pill", id: "score-pill", html: "<strong>" + game.score + "</strong> pts" })
    ]);

    // Progreso
    var progress = el("div", { class: "progress" }, [
      el("div", { class: "progress__bar", style: "width:" + ((game.index) / total * 100) + "%" })
    ]);

    // Anillo del temporizador
    var ring = el("div", { class: "timer-ring", id: "timer-ring" });
    ring.innerHTML =
      '<svg width="74" height="74" viewBox="0 0 74 74">' +
      '<circle cx="37" cy="37" r="' + RING_R + '" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="7"/>' +
      '<circle id="ring-progress" cx="37" cy="37" r="' + RING_R + '" fill="none" stroke="#fff" stroke-width="7" ' +
      'stroke-linecap="round" stroke-dasharray="' + RING_C + '" stroke-dashoffset="0"/>' +
      '</svg><span class="timer-ring__num" id="timer-num">' + timeLimit + "</span>";

    var meta = el("div", { class: "q-meta" }, [ring]);

    // Enunciado + imagen
    var question = el("div", { class: "q-question", text: q.text });
    var stageChildren = [question];
    if (q.image) {
      stageChildren.push(el("div", { class: "q-media" }, [el("img", { src: q.image, alt: "Imagen de la pregunta" })]));
    }
    stageChildren.push(meta);

    // Botones de respuesta (con estilo propio si es verdadero/falso)
    var tf = window.UI.isTF(q);
    var answersGrid = el("div", { class: "answers-play" + (tf ? " answers-play--tf" : ""), id: "answers-grid" });
    q.answers.forEach(function (a, i) {
      var btn = el("button", {
        class: "answer-btn " + window.UI.answerColorClass(q, i),
        "data-color": tf ? null : i,
        "data-index": i,
        onClick: function () { pickAnswer(i); }
      }, [
        el("span", { class: "shape" }),
        el("span", { class: "label", text: a.text }),
        el("span", { class: "mark" })
      ]);
      answersGrid.appendChild(btn);
    });
    stageChildren.push(answersGrid);

    var stage = el("div", { class: "q-stage" }, stageChildren);

    var view = el("div", { class: "game" }, [top, progress, stage]);
    rootEl.innerHTML = "";
    rootEl.appendChild(view);

    // Atajos de teclado 1-4
    game.keyHandler = function (e) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= q.answers.length && !game.answered) { pickAnswer(n - 1); }
    };
    document.addEventListener("keydown", game.keyHandler);

    // Temporizador
    tick(); // pinta el estado inicial
    game.timerId = setInterval(tick, 100);
  }

  function tick() {
    var remaining = game.deadline - Date.now();
    if (remaining < 0) remaining = 0;

    var num = document.getElementById("timer-num");
    var ring = document.getElementById("ring-progress");
    var seconds = Math.ceil(remaining / 1000);
    if (num) num.textContent = seconds;

    var frac = remaining / (game.timeLimit * 1000);
    if (ring) {
      ring.setAttribute("stroke-dashoffset", (RING_C * (1 - frac)).toFixed(1));
      ring.setAttribute("stroke", frac < 0.25 ? "#ffcf3f" : "#fff");
    }

    if (remaining <= 0 && !game.answered) {
      timeout();
    }
  }

  /* ---------- Respuesta del jugador ---------- */

  function pickAnswer(i) {
    if (game.answered) return;
    game.answered = true;
    clearTimer();
    detachKeys();

    var remaining = Math.max(0, game.deadline - Date.now());
    var q = game.quiz.questions[game.index];
    var chosen = q.answers[i];
    var isCorrect = !!chosen.correct;

    var gained = 0, bonus = 0;
    if (isCorrect) {
      game.streak = (game.streak || 0) + 1;
      if (game.streak > (game.maxStreak || 0)) game.maxStreak = game.streak;
      bonus = streakBonus(game.streak);
      gained = computeScore(Number(q.points) || 1000, game.timeLimit, remaining) + bonus;
      game.score += gained;
      game.correctCount += 1;
    } else {
      game.streak = 0;
    }

    reveal(i, isCorrect, gained, remaining, false, bonus);
  }

  function timeout() {
    if (game.answered) return;
    game.answered = true;
    clearTimer();
    detachKeys();
    game.streak = 0;
    reveal(-1, false, 0, 0, true, 0);
  }

  function reveal(pickedIndex, isCorrect, gained, remaining, isTimeout, bonus) {
    var q = game.quiz.questions[game.index];
    var grid = document.getElementById("answers-grid");
    if (grid) {
      grid.classList.add("revealed");
      var btns = grid.querySelectorAll(".answer-btn");
      for (var b = 0; b < btns.length; b++) {
        var idx = Number(btns[b].getAttribute("data-index"));
        var correct = !!q.answers[idx].correct;
        btns[b].disabled = true;
        var mark = btns[b].querySelector(".mark");
        if (correct) {
          btns[b].classList.add("is-correct");
          if (mark) mark.textContent = "✓";
        } else {
          btns[b].classList.add("is-wrong");
        }
        if (idx === pickedIndex) {
          btns[b].classList.add("is-picked");
          if (!correct && mark) mark.textContent = "✗";
        }
      }
    }

    var scorePill = document.getElementById("score-pill");
    if (scorePill) scorePill.innerHTML = "<strong>" + game.score + "</strong> pts";

    // Franja de feedback
    var stage = document.querySelector(".q-stage");
    var feedback;
    if (isTimeout) {
      feedback = el("div", { class: "feedback timeout" }, [
        el("span", { text: "¡Se acabó el tiempo!" }),
        el("small", { text: "Sin puntos esta vez" })
      ]);
    } else if (isCorrect) {
      feedback = el("div", { class: "feedback good" }, [
        el("span", { text: "¡Correcto!" }),
        el("small", { text: "+" + gained + " puntos" }),
        bonus > 0 ? el("small", { class: "feedback__streak", text: "Racha ×" + game.streak + " · +" + bonus + " de bonus" }) : null
      ]);
    } else {
      feedback = el("div", { class: "feedback bad" }, [
        el("span", { text: "Incorrecto" }),
        el("small", { text: "La respuesta correcta está resaltada" })
      ]);
    }
    if (stage) stage.appendChild(feedback);

    // Botón siguiente
    var isLast = game.index >= game.quiz.questions.length - 1;
    var nextBtn = el("button", {
      class: "btn btn--light btn--lg",
      style: "margin:1rem auto 0; display:block;",
      text: isLast ? "Ver resultados" : "Siguiente pregunta →",
      onClick: nextQuestion
    });
    if (stage) stage.appendChild(nextBtn);
    setTimeout(function () { nextBtn.focus(); }, 50);

    // Permite avanzar con Enter/Espacio
    game.nextHandler = function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nextQuestion(); }
    };
    document.addEventListener("keydown", game.nextHandler);
  }

  function nextQuestion() {
    if (game.nextHandler) { document.removeEventListener("keydown", game.nextHandler); game.nextHandler = null; }
    if (game.index >= game.quiz.questions.length - 1) {
      renderResults();
    } else {
      game.index += 1;
      renderQuestion();
    }
  }

  /* ---------- Resultados ---------- */

  function renderResults() {
    clearTimer();
    detachKeys();

    var total = game.quiz.questions.length;
    var maxScore = game.quiz.questions.reduce(function (sum, q) { return sum + (Number(q.points) || 1000); }, 0);
    var pct = maxScore ? Math.round(game.score / maxScore * 100) : 0;
    var accuracy = total ? Math.round(game.correctCount / total * 100) : 0;

    var badgeClass, message;
    if (accuracy >= 90) { badgeClass = "result-badge--great"; message = "¡Excelente! Dominas el tema."; }
    else if (accuracy >= 70) { badgeClass = "result-badge--good"; message = "¡Muy bien! Buen trabajo."; }
    else if (accuracy >= 50) { badgeClass = "result-badge--ok"; message = "Bien, pero se puede mejorar."; }
    else { badgeClass = "result-badge--low"; message = "¡A repasar y volver a intentarlo!"; }

    var name = (game.playerName || "").trim();

    var card = el("div", { class: "results__card" }, [
      el("div", { class: "result-badge " + badgeClass }, [el("span", { text: accuracy + "%" })]),
      el("h2", { text: name ? "¡Bien hecho, " + name + "!" : "¡Terminado!", style: "margin:0.3rem 0;" }),
      el("div", { class: "results__score", text: game.score + " pts" }),
      el("p", { class: "results__msg", text: message }),
      el("div", { class: "results__stats" }, [
        el("div", { class: "stat" }, [
          el("div", { class: "stat__num ok", text: game.correctCount }),
          el("div", { class: "stat__label", text: "Aciertos" })
        ]),
        el("div", { class: "stat" }, [
          el("div", { class: "stat__num no", text: (total - game.correctCount) }),
          el("div", { class: "stat__label", text: "Fallos" })
        ]),
        el("div", { class: "stat" }, [
          el("div", { class: "stat__num", text: accuracy + "%" }),
          el("div", { class: "stat__label", text: "Precisión" })
        ]),
        (game.maxStreak || 0) >= 2 ? el("div", { class: "stat" }, [
          el("div", { class: "stat__num", text: "×" + game.maxStreak }),
          el("div", { class: "stat__label", text: "Mejor racha" })
        ]) : null
      ]),
      el("div", { class: "results__actions" }, [
        el("button", { class: "btn btn--success btn--lg", text: "Jugar de nuevo", onClick: function () { startQuestions(); } }),
        el("button", { class: "btn btn--ghost btn--lg", text: "Inicio", onClick: exit })
      ])
    ]);

    var view = el("div", { class: "game" }, [
      el("div", { class: "results" }, [card])
    ]);
    rootEl.innerHTML = "";
    rootEl.appendChild(view);
  }

  /* ---------- Salida ---------- */

  function exit() {
    clearTimer();
    detachKeys();
    if (game && game.nextHandler) { document.removeEventListener("keydown", game.nextHandler); }
    if (onExit) onExit();
  }

  /* ---------- API pública ---------- */

  function render(root, quiz, callbacks) {
    rootEl = root;
    onExit = callbacks.onExit;
    game = {
      quiz: quiz,
      index: 0,
      score: 0,
      correctCount: 0,
      playerName: "",
      timerId: null,
      keyHandler: null,
      nextHandler: null
    };
    renderStart();
  }

  window.QuizGame = { render: render };
})(window, document);

/* =========================================================
   host.js — Vista del ANFITRIÓN (pantalla del profe, proyectada)
   ========================================================= */
(function (window, document) {
  "use strict";

  var el = window.UI.el;
  var SHAPES = window.UI.SHAPES;
  var toast = window.UI.toast;
  var Live = window.Live;

  var RING_C = 2 * Math.PI * 32;

  var S = null; // estado del anfitrión

  function cleanup() {
    if (S && S.ringTimer) { clearInterval(S.ringTimer); S.ringTimer = null; }
    if (S && S.socket) { try { S.socket.removeAllListeners(); S.socket.disconnect(); } catch (e) {} }
  }

  function exit() {
    cleanup();
    if (S && S.onExit) S.onExit();
  }

  /* ---------- Cabecera común ---------- */
  function topBar(right) {
    return el("div", { class: "game__top" }, [
      el("button", { class: "btn btn--light btn--sm", html: "← Salir", onClick: function () {
        window.UI.confirm({ title: "¿Cerrar la partida?", message: "Se desconectará a todos los jugadores.", confirmText: "Cerrar", danger: true })
          .then(function (ok) { if (ok) exit(); });
      } }),
      el("span", { class: "spacer" }),
      right || null
    ]);
  }

  /* ---------- Sala de espera (lobby) ---------- */
  function renderLobby() {
    var addr = Live.joinAddress();

    var playersWrap = el("div", { class: "lobby__players", id: "lobby-players" });
    renderPlayersInto(playersWrap);

    var startBtn = el("button", {
      class: "btn btn--success btn--lg",
      id: "start-btn",
      html: "▶ Empezar",
      onClick: function () { S.socket.emit("host:start"); }
    });
    if (S.players.length === 0) startBtn.disabled = true;

    var view = el("div", { class: "game" }, [
      topBar(el("span", { class: "pill", html: "👥 <strong id='pcount'>" + S.players.length + "</strong> jugadores" })),
      el("div", { class: "lobby" }, [
        el("div", { class: "lobby__join" }, [
          el("div", { class: "lobby__step" }, [
            el("span", { class: "lobby__label", text: "1 · Entra en" }),
            el("div", { class: "lobby__addr", text: addr })
          ]),
          el("div", { class: "lobby__step" }, [
            el("span", { class: "lobby__label", text: "2 · PIN del juego" }),
            el("div", { class: "lobby__pin", text: S.pin })
          ])
        ]),
        el("h2", { class: "lobby__title", text: S.title }),
        el("div", { class: "lobby__count", id: "lobby-count", text: waitingText() }),
        playersWrap,
        el("div", { style: "margin-top:1.5rem;" }, [startBtn])
      ])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(view);
  }

  function waitingText() {
    if (!S.players.length) return "Esperando jugadores…";
    return S.players.length === 1 ? "1 jugador se ha unido" : S.players.length + " jugadores se han unido";
  }

  function renderPlayersInto(wrap) {
    wrap.innerHTML = "";
    if (!S.players.length) {
      wrap.appendChild(el("div", { class: "lobby__empty", text: "Los apodos aparecerán aquí cuando se unan 👇" }));
      return;
    }
    S.players.forEach(function (p) {
      wrap.appendChild(el("div", { class: "player-chip", text: p.name }));
    });
  }

  function updateLobby() {
    var wrap = document.getElementById("lobby-players");
    if (wrap) renderPlayersInto(wrap);
    var count = document.getElementById("lobby-count");
    if (count) count.textContent = waitingText();
    var pc = document.getElementById("pcount");
    if (pc) pc.textContent = S.players.length;
    var startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.disabled = S.players.length === 0;
  }

  /* ---------- Pregunta ---------- */
  function renderQuestion(data) {
    S.current = data;
    S.answeredCount = 0;

    var ring = el("div", { class: "timer-ring", id: "timer-ring" });
    ring.innerHTML =
      '<svg width="74" height="74" viewBox="0 0 74 74">' +
      '<circle cx="37" cy="37" r="32" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="7"/>' +
      '<circle id="ring-progress" cx="37" cy="37" r="32" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + RING_C + '" stroke-dashoffset="0"/>' +
      '</svg><span class="timer-ring__num" id="timer-num">' + data.timeLimit + "</span>";

    var stageChildren = [
      el("div", { class: "q-question", text: data.text })
    ];
    if (data.image) {
      stageChildren.push(el("div", { class: "q-media" }, [el("img", { src: data.image, alt: "Imagen de la pregunta" })]));
    }
    stageChildren.push(el("div", { class: "q-meta" }, [
      ring,
      el("span", { class: "count-pill", id: "answered-pill", text: "0 respuestas" })
    ]));

    var grid = el("div", { class: "answers-play answers-play--display", id: "answers-grid" });
    data.answers.forEach(function (a, i) {
      grid.appendChild(el("button", { class: "answer-btn", "data-color": i, "data-index": i, disabled: "disabled" }, [
        el("span", { class: "shape", text: SHAPES[i] }),
        el("span", { class: "label", text: a.text }),
        el("span", { class: "mark" })
      ]));
    });
    stageChildren.push(grid);

    var view = el("div", { class: "game" }, [
      el("div", { class: "game__top" }, [
        el("span", { class: "pill", html: "Pregunta <strong>" + (data.index + 1) + "</strong> / " + data.total }),
        el("span", { class: "spacer" }),
        el("span", { class: "pill", html: "PIN <strong>" + S.pin + "</strong>" }),
        el("button", { class: "btn btn--light btn--sm", html: "⏭ Saltar", onClick: function () { S.socket.emit("host:skip"); } })
      ]),
      el("div", { class: "progress" }, [el("div", { class: "progress__bar", style: "width:" + (data.index / data.total * 100) + "%" })]),
      el("div", { class: "q-stage" }, stageChildren)
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(view);

    startRing(data.timeLimit);
  }

  function startRing(timeLimit) {
    if (S.ringTimer) clearInterval(S.ringTimer);
    var deadline = Date.now() + timeLimit * 1000;
    S.ringTimer = setInterval(function () {
      var remaining = Math.max(0, deadline - Date.now());
      var num = document.getElementById("timer-num");
      var ring = document.getElementById("ring-progress");
      if (num) num.textContent = Math.ceil(remaining / 1000);
      var frac = remaining / (timeLimit * 1000);
      if (ring) {
        ring.setAttribute("stroke-dashoffset", (RING_C * (1 - frac)).toFixed(1));
        ring.setAttribute("stroke", frac < 0.25 ? "#ffcf3f" : "#fff");
      }
      if (remaining <= 0) { clearInterval(S.ringTimer); S.ringTimer = null; }
    }, 100);
  }

  function updateAnswered(data) {
    S.answeredCount = data.count;
    var pill = document.getElementById("answered-pill");
    if (pill) pill.textContent = data.count + " de " + data.total + " respuestas";
  }

  /* ---------- Revelado ---------- */
  function renderReveal(data) {
    if (S.ringTimer) { clearInterval(S.ringTimer); S.ringTimer = null; }
    S.lastReveal = data;

    var q = S.current;
    var maxCount = Math.max(1, Math.max.apply(null, data.distribution));

    var bars = el("div", { class: "dist" }, q.answers.map(function (a, i) {
      var isCorrect = data.correctIndexes.indexOf(i) >= 0;
      var h = Math.round(data.distribution[i] / maxCount * 100);
      return el("div", { class: "dist__col" + (isCorrect ? " is-correct" : "") }, [
        el("div", { class: "dist__count", text: data.distribution[i] }),
        el("div", { class: "dist__bar", "data-color": i, style: "height:" + Math.max(6, h) + "%" }),
        el("div", { class: "dist__shape", "data-color": i }, [
          el("span", { text: SHAPES[i] }),
          isCorrect ? el("span", { class: "dist__check", text: " ✓" }) : null
        ])
      ]);
    }));

    var lb = el("div", { class: "leaderboard" }, [
      el("h3", { text: "🏆 Clasificación" }),
      el("div", { class: "leaderboard__list" }, (data.leaderboard || []).map(function (row) {
        return el("div", { class: "lb-row" }, [
          el("span", { class: "lb-rank", text: row.rank }),
          el("span", { class: "lb-name", text: row.name }),
          el("span", { class: "lb-score", text: row.score + (row.lastPoints ? "  (+" + row.lastPoints + ")" : "") })
        ]);
      }))
    ]);

    var nextBtn = el("button", {
      class: "btn btn--light btn--lg",
      html: data.isLast ? "🏁 Ver podio" : "Siguiente →",
      onClick: function () { S.socket.emit("host:next"); }
    });

    var view = el("div", { class: "game" }, [
      el("div", { class: "game__top" }, [
        el("span", { class: "pill", html: "Pregunta <strong>" + (q.index + 1) + "</strong> / " + q.total }),
        el("span", { class: "spacer" }),
        nextBtn
      ]),
      el("div", { class: "reveal" }, [
        el("div", { class: "q-question", style: "margin-bottom:1.2rem;", text: q.text }),
        bars,
        lb
      ])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(view);
    setTimeout(function () { nextBtn.focus(); }, 50);
  }

  /* ---------- Podio final ---------- */
  function renderEnded(data) {
    var podium = data.podium || [];
    var medals = ["🥇", "🥈", "🥉"];

    var top = el("div", { class: "podium" }, podium.slice(0, 3).map(function (row, i) {
      return el("div", { class: "podium__place podium__place--" + (i + 1) }, [
        el("div", { class: "podium__medal", text: medals[i] || "" }),
        el("div", { class: "podium__name", text: row.name }),
        el("div", { class: "podium__score", text: row.score + " pts" }),
        el("div", { class: "podium__bar" })
      ]);
    }));

    var rest = podium.slice(3);
    var restList = rest.length ? el("div", { class: "leaderboard", style: "margin-top:1rem;" }, [
      el("div", { class: "leaderboard__list" }, rest.map(function (row) {
        return el("div", { class: "lb-row" }, [
          el("span", { class: "lb-rank", text: row.rank }),
          el("span", { class: "lb-name", text: row.name }),
          el("span", { class: "lb-score", text: row.score + " pts" })
        ]);
      }))
    ]) : null;

    var view = el("div", { class: "game" }, [
      el("div", { class: "results" }, [
        el("div", { class: "results__card", style: "max-width:640px;" }, [
          el("div", { class: "results__emoji", text: "🎉" }),
          el("h2", { text: "¡Fin del juego!", style: "margin:0.2rem 0 1rem;" }),
          podium.length ? top : el("p", { text: "No hubo jugadores." }),
          restList,
          el("div", { class: "results__actions", style: "margin-top:1.5rem;" }, [
            el("button", { class: "btn btn--success btn--lg", html: "🏠 Volver al inicio", onClick: exit })
          ])
        ])
      ])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(view);
  }

  /* ---------- Pantalla de conexión ---------- */
  function renderConnecting() {
    S.root.innerHTML = "";
    S.root.appendChild(el("div", { class: "game" }, [
      el("div", { class: "game-start" }, [
        el("div", { class: "game-start__card" }, [
          el("div", { class: "game-start__emoji", text: "📡" }),
          el("h2", { text: "Creando la partida…" }),
          el("p", { text: "Conectando con el servidor." })
        ])
      ])
    ]));
  }

  /* ---------- API pública ---------- */
  function render(root, quiz, callbacks) {
    if (!Live.isLiveAvailable()) {
      Live.renderUnavailable(root, el, function () { if (callbacks.onExit) callbacks.onExit(); });
      return;
    }

    S = {
      root: root,
      onExit: callbacks.onExit,
      socket: Live.connect(),
      pin: null,
      title: quiz.title,
      players: [],
      current: null,
      ringTimer: null,
      answeredCount: 0
    };

    renderConnecting();

    var socket = S.socket;

    socket.on("connect", function () {
      // Enviamos el cuestionario (con imágenes) para que el servidor gestione la partida.
      socket.emit("host:create", { quiz: quiz }, function (res) {
        if (!res || !res.ok) { toast((res && res.error) || "No se pudo crear la partida.", "error"); exit(); return; }
        S.pin = res.pin;
        renderLobby();
      });
    });

    socket.on("connect_error", function () {
      toast("No se pudo conectar con el servidor.", "error");
      exit();
    });

    socket.on("host:players", function (data) { S.players = data.players || []; updateLobby(); });
    socket.on("host:question", function (data) { renderQuestion(data); });
    socket.on("host:answers", function (data) { updateAnswered(data); });
    socket.on("host:reveal", function (data) { renderReveal(data); });
    socket.on("host:ended", function (data) { renderEnded(data); });
    socket.on("host:info", function (data) { toast(data.message, ""); });

    socket.on("disconnect", function () { /* el servidor cerró o se perdió la conexión */ });
  }

  window.QuizHost = { render: render };
})(window, document);

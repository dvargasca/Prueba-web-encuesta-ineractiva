/* =========================================================
   player.js — Vista del JUGADOR (el móvil del estudiante)
   ========================================================= */
(function (window, document) {
  "use strict";

  var el = window.UI.el;
  var SHAPES = window.UI.SHAPES;
  var COLOR_NAMES = window.UI.COLOR_NAMES;
  var toast = window.UI.toast;
  var Live = window.Live;

  var S = null;

  function cleanup() {
    if (S && S.barTimer) { clearInterval(S.barTimer); S.barTimer = null; }
    if (S && S.socket) { try { S.socket.removeAllListeners(); S.socket.disconnect(); } catch (e) {} }
  }

  function exit() {
    cleanup();
    if (S && S.onExit) S.onExit();
  }

  function shell(children, topRight) {
    return el("div", { class: "game player" }, [
      el("div", { class: "game__top" }, [
        el("button", { class: "btn btn--light btn--sm", html: "← Salir", onClick: exit }),
        el("span", { class: "spacer" }),
        topRight || (S && S.name ? el("span", { class: "pill", text: "👤 " + S.name }) : null)
      ])
    ].concat(children));
  }

  /* ---------- Entrada: PIN + apodo ---------- */
  function renderJoin(prefillPin) {
    var pinInput = el("input", {
      class: "input", type: "tel", inputmode: "numeric", maxlength: 6,
      value: prefillPin || "", placeholder: "PIN del juego",
      style: "text-align:center; font-size:1.6rem; letter-spacing:0.3em; font-weight:800;"
    });
    var nameInput = el("input", {
      class: "input", type: "text", maxlength: 20, placeholder: "Tu apodo",
      style: "text-align:center; margin-top:0.8rem; font-size:1.2rem;"
    });

    function submit() {
      var pin = (pinInput.value || "").trim();
      var name = (nameInput.value || "").trim();
      if (!/^\d{4,8}$/.test(pin)) { toast("Escribe el PIN del juego.", "error"); pinInput.focus(); return; }
      if (!name) { toast("Escribe tu apodo.", "error"); nameInput.focus(); return; }
      doJoin(pin, name);
    }
    nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

    var card = el("div", { class: "game-start__card" }, [
      el("div", { class: "game-start__emoji", text: "🎮" }),
      el("h2", { text: "Unirse al juego" }),
      el("p", { text: "Introduce el PIN que ves en la pantalla y elige un apodo." }),
      pinInput,
      nameInput,
      el("button", { class: "btn btn--lg btn--block", style: "margin-top:1rem;", html: "Entrar 🚀", onClick: submit })
    ]);

    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "game-start" }, [card])], el("span")));
    setTimeout(function () { (prefillPin ? nameInput : pinInput).focus(); }, 60);
  }

  function doJoin(pin, name) {
    if (!S.socket) S.socket = Live.connect();
    var socket = S.socket;
    S.pin = pin;

    renderStatus("📡", "Conectando…", "Uniéndote a la partida " + pin);

    var joined = false;

    socket.on("connect", function () {
      socket.emit("player:join", { pin: pin, name: name }, function (res) {
        if (!res || !res.ok) {
          toast((res && res.error) || "No se pudo unir.", "error");
          renderJoin(pin);
          return;
        }
        joined = true;
        S.name = res.name;
        S.title = res.title;
        renderLobby();
      });
    });

    socket.on("connect_error", function () { if (!joined) { toast("No se pudo conectar con el servidor.", "error"); renderJoin(pin); } });

    socket.on("player:question", function (data) { renderQuestion(data); });
    socket.on("player:result", function (data) { renderResult(data); });
    socket.on("player:wait", function (data) { renderStatus("⏳", "¡Ya casi!", data.message || "Espera a la siguiente pregunta."); });
    socket.on("player:ended", function (data) { renderEnded(data); });
    socket.on("game:closed", function (data) {
      toast((data && data.reason) || "La partida se cerró.", "");
      renderStatus("👋", "Partida finalizada", (data && data.reason) || "");
      if (S.barTimer) { clearInterval(S.barTimer); S.barTimer = null; }
    });
    socket.on("disconnect", function () { if (joined) renderStatus("🔌", "Desconectado", "Se perdió la conexión con el servidor."); });
  }

  /* ---------- Pantalla de estado genérica ---------- */
  function renderStatus(emoji, title, sub) {
    var card = el("div", { class: "game-start__card" }, [
      el("div", { class: "game-start__emoji", text: emoji }),
      el("h2", { text: title }),
      sub ? el("p", { text: sub }) : null,
      el("div", { style: "text-align:center;" }, [
        el("button", { class: "btn btn--ghost", html: "Salir", onClick: exit })
      ])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "game-start" }, [card])]));
  }

  /* ---------- Sala de espera ---------- */
  function renderLobby() {
    var card = el("div", { class: "game-start__card" }, [
      el("div", { class: "game-start__emoji", text: "✅" }),
      el("h2", { text: "¡Estás dentro, " + S.name + "!" }),
      el("p", { text: "Mira la pantalla grande. El juego empezará en un momento…" }),
      el("div", { class: "dots" }, [el("span"), el("span"), el("span")])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "game-start" }, [card])]));
  }

  /* ---------- Pregunta (solo colores/formas) ---------- */
  function renderQuestion(data) {
    S.answered = false;
    S.current = data;

    var pad = el("div", { class: "answers-play player-pad", id: "player-pad" });
    data.answers.forEach(function (a, i) {
      pad.appendChild(el("button", {
        class: "answer-btn", "data-color": i, "data-index": i,
        "aria-label": (COLOR_NAMES[i] || "") + ": " + (a.text || ""),
        onClick: function () { pick(i); }
      }, [
        el("span", { class: "shape", text: SHAPES[i] }),
        el("span", { class: "label", text: a.text })
      ]));
    });

    var view = shell([
      el("div", { class: "progress" }, [el("div", { class: "progress__bar", id: "pbar", style: "width:100%" })]),
      el("div", { class: "player-q" }, [
        el("div", { class: "player-q__num", text: "Pregunta " + (data.index + 1) + " / " + data.total }),
        el("div", { class: "player-q__hint", id: "player-hint", text: "Toca tu respuesta" })
      ]),
      pad
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(view);

    startBar(data.timeLimit);
  }

  function startBar(timeLimit) {
    if (S.barTimer) clearInterval(S.barTimer);
    var deadline = Date.now() + timeLimit * 1000;
    S.barTimer = setInterval(function () {
      var remaining = Math.max(0, deadline - Date.now());
      var bar = document.getElementById("pbar");
      if (bar) bar.style.width = (remaining / (timeLimit * 1000) * 100) + "%";
      if (remaining <= 0) {
        clearInterval(S.barTimer); S.barTimer = null;
        if (!S.answered) lockAfterAnswer("⏰ Se acabó el tiempo", "Espera el resultado…");
      }
    }, 100);
  }

  function pick(i) {
    if (S.answered) return;
    S.answered = true;
    if (S.barTimer) { clearInterval(S.barTimer); S.barTimer = null; }
    S.socket.emit("player:answer", { index: i }, function () {});

    // Marca la elegida y bloquea el resto.
    var pad = document.getElementById("player-pad");
    if (pad) {
      var btns = pad.querySelectorAll(".answer-btn");
      for (var b = 0; b < btns.length; b++) {
        btns[b].disabled = true;
        if (Number(btns[b].getAttribute("data-index")) === i) btns[b].classList.add("is-picked");
        else btns[b].classList.add("dimmed");
      }
    }
    var hint = document.getElementById("player-hint");
    if (hint) hint.textContent = "✅ Respuesta enviada · espera…";
  }

  function lockAfterAnswer(title, sub) {
    var pad = document.getElementById("player-pad");
    if (pad) { var btns = pad.querySelectorAll(".answer-btn"); for (var b = 0; b < btns.length; b++) btns[b].disabled = true; }
    var hint = document.getElementById("player-hint");
    if (hint) hint.textContent = title + " · " + (sub || "");
  }

  /* ---------- Resultado personal ---------- */
  function renderResult(data) {
    if (S.barTimer) { clearInterval(S.barTimer); S.barTimer = null; }

    var good = data.answered && data.correct;
    var emoji, title, cls;
    if (!data.answered) { emoji = "⏰"; title = "Sin respuesta"; cls = "timeout"; }
    else if (good) { emoji = "✅"; title = "¡Correcto!"; cls = "good"; }
    else { emoji = "❌"; title = "Incorrecto"; cls = "bad"; }

    var card = el("div", { class: "result-card " + cls }, [
      el("div", { class: "result-card__emoji", text: emoji }),
      el("h2", { text: title }),
      good ? el("div", { class: "result-card__points", text: "+" + data.points + " puntos" }) : null,
      data.streak > 1 && good ? el("div", { class: "result-card__streak", text: "🔥 Racha de " + data.streak }) : null,
      el("div", { class: "result-card__rank" }, [
        el("span", { class: "result-card__pos", text: "#" + data.rank }),
        el("span", { text: " de " + data.totalPlayers + " · " + data.totalScore + " pts" })
      ]),
      el("p", { class: "result-card__wait", text: "Mira la pantalla para la clasificación." })
    ]);

    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "player-result" }, [card])]));
  }

  /* ---------- Fin ---------- */
  function renderEnded(data) {
    var podiumTxt = (data.top3 || []).map(function (p, i) {
      return (["🥇", "🥈", "🥉"][i] || "") + " " + p.name;
    }).join("   ");

    var isWinner = data.rank === 1;
    var card = el("div", { class: "result-card good" }, [
      el("div", { class: "result-card__emoji", text: isWinner ? "🏆" : "🎉" }),
      el("h2", { text: isWinner ? "¡Ganaste!" : "¡Terminado!" }),
      el("div", { class: "result-card__points", text: "Puesto #" + data.rank + " de " + data.totalPlayers }),
      el("div", { class: "result-card__rank", style: "border:none;", text: data.totalScore + " puntos" }),
      podiumTxt ? el("p", { class: "result-card__wait", text: podiumTxt }) : null,
      el("div", { style: "text-align:center; margin-top:1rem;" }, [
        el("button", { class: "btn btn--light", html: "Salir", onClick: exit })
      ])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "player-result" }, [card])]));
  }

  /* ---------- API pública ---------- */
  function render(root, opts) {
    opts = opts || {};
    if (!Live.isLiveAvailable()) {
      Live.renderUnavailable(root, el, function () { if (opts.onExit) opts.onExit(); });
      return;
    }
    S = { root: root, onExit: opts.onExit, socket: null, pin: opts.pin || "", name: "", answered: false, barTimer: null };
    renderJoin(opts.pin || "");
  }

  window.QuizPlayer = { render: render };
})(window, document);

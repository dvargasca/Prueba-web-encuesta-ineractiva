/* =========================================================
   player.js — Vista del JUGADOR (el móvil del estudiante)
   Con reconexión automática y restauración de sesión: si se cae
   el internet o el estudiante recarga la página, vuelve a su sitio.
   ========================================================= */
(function (window, document) {
  "use strict";

  var el = window.UI.el;
  var COLOR_NAMES = window.UI.COLOR_NAMES;
  var toast = window.UI.toast;
  var Live = window.Live;

  var SESSION_KEY = "quizaula_live_session";
  var S = null;

  /* ---------- Sesión (sobrevive a una recarga de la pestaña) ---------- */
  function saveSession() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ pin: S.pin, token: S.token, name: S.name })); } catch (e) {}
  }
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function stopBar() { if (S && S.barTimer) { clearInterval(S.barTimer); S.barTimer = null; } }

  function cleanup() {
    stopBar();
    if (S && S.socket) { try { S.socket.removeAllListeners(); S.socket.disconnect(); } catch (e) {} S.socket = null; }
  }

  function exit() {
    if (S) S.exiting = true;
    clearSession();
    cleanup();
    if (S && S.onExit) S.onExit();
  }

  /* ---------- Configurar servidor (cuando no se puede conectar) ---------- */
  function showNeedsServer(error) {
    cleanup();
    Live.renderNeedsServer(S.root, el, {
      error: error,
      onConnect: function () { restart(); },
      onExit: exit
    });
  }

  function restart() {
    cleanup();
    S.exiting = false;
    S.connectedOnce = false;
    if (S.token) { renderStatus("", "Reconectando…", "Recuperando tu partida " + S.pin); connectAndBind(); }
    else if (S.pendingName) { renderStatus("", "Conectando…", "Uniéndote a la partida " + S.pin); connectAndBind(); }
    else { renderJoin(S.pin); }
  }

  function shell(children, topRight) {
    return el("div", { class: "game player" }, [
      el("div", { class: "game__top" }, [
        el("button", { class: "btn btn--light btn--sm", text: "← Salir", onClick: exit }),
        el("span", { class: "spacer" }),
        topRight || (S && S.name ? el("span", { class: "pill", text: S.name }) : null)
      ])
    ].concat(children));
  }

  /* ---------- Conexión ---------- */
  function connectAndBind() {
    if (S.socket) return;
    S.socket = Live.connect({ reconnection: true, reconnectionAttempts: 20, reconnectionDelay: 700, reconnectionDelayMax: 3000 });
    var socket = S.socket;

    socket.on("connect", function () {
      S.connectedOnce = true;
      if (S.token) socket.emit("player:rejoin", { pin: S.pin, token: S.token }, onRejoinAck);
      else socket.emit("player:join", { pin: S.pin, name: S.pendingName }, onJoinAck);
    });

    socket.on("connect_error", function () {
      // Si nunca hemos conectado y aún no hay sesión, seguramente falta configurar el servidor.
      if (!S.connectedOnce && !S.token) {
        showNeedsServer("No pudimos conectar con ese servidor. Revisa la dirección.");
      }
      // Si hay token (reintento de sesión), socket.io sigue reintentando solo.
    });

    socket.on("player:question", function (data) { renderQuestion(data); });
    socket.on("player:result", function (data) { renderResult(data); });
    socket.on("player:wait", function (data) { renderStatus("warn", "¡Ya casi!", (data && data.message) || "Espera a la siguiente pregunta."); });
    socket.on("player:lobby", function () { renderLobby(); });
    socket.on("player:ended", function (data) { renderEnded(data); });

    socket.on("game:closed", function (data) {
      clearSession();
      stopBar();
      renderStatus("muted", "Partida finalizada", (data && data.reason) || "");
    });

    socket.on("disconnect", function () {
      if (S.exiting) return;
      stopBar();
      renderStatus("warn", "Se perdió la conexión", "Reconectando automáticamente…");
    });

    // Cuando socket.io agota los reintentos.
    if (socket.io && socket.io.on) {
      socket.io.on("reconnect_failed", function () {
        if (S.exiting) return;
        renderStatus("muted", "Sin conexión", "No pudimos reconectar.", [
          { label: "Reintentar", primary: true, onClick: function () { renderStatus("", "Reconectando…", "Recuperando tu partida " + S.pin); S.socket.connect(); } },
          { label: "Salir", onClick: exit }
        ]);
      });
    }
  }

  function onJoinAck(res) {
    if (res && res.ok) {
      S.token = res.token; S.name = res.name; saveSession();
      renderLobby();
    } else {
      clearSession();
      toast((res && res.error) || "No se pudo unir.", "error");
      renderJoin(S.pin);
    }
  }

  function onRejoinAck(res) {
    if (res && res.ok) {
      S.name = res.name; saveSession();
      // El servidor envía el estado actual (pregunta/resultado/sala/fin) y eso pinta la pantalla.
    } else {
      // La sesión guardada ya no sirve (partida terminada o cerrada): volvemos al inicio.
      clearSession(); S.token = null;
      toast((res && res.error) || "Tu partida anterior ya no está disponible.", "");
      exit();
    }
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
      el("div", { class: "status-badge" }),
      el("h2", { text: "Unirse al juego" }),
      el("p", { text: "Introduce el PIN que ves en la pantalla y elige un apodo." }),
      pinInput,
      nameInput,
      el("button", { class: "btn btn--lg btn--block", style: "margin-top:1rem;", text: "Entrar", onClick: submit })
    ]);

    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "game-start" }, [card])], el("span")));
    setTimeout(function () { (prefillPin ? nameInput : pinInput).focus(); }, 60);
  }

  function doJoin(pin, name) {
    S.pin = pin; S.pendingName = name; S.token = null;
    renderStatus("", "Conectando…", "Uniéndote a la partida " + pin);
    connectAndBind();
    // Si el socket ya estaba conectado (raro), fuerza el join.
    if (S.socket && S.socket.connected) S.socket.emit("player:join", { pin: pin, name: name }, onJoinAck);
  }

  /* ---------- Pantalla de estado genérica ----------
     variant: "" (marca), "good", "warn" o "muted" — color de la insignia. */
  function renderStatus(variant, title, sub, actions) {
    var btns = (actions || [{ label: "Salir", onClick: exit }]).map(function (a) {
      return el("button", { class: "btn " + (a.primary ? "btn--light" : "btn--ghost"), text: a.label, onClick: a.onClick });
    });
    var card = el("div", { class: "game-start__card" }, [
      el("div", { class: "status-badge" + (variant ? " status-badge--" + variant : "") }),
      el("h2", { text: title }),
      sub ? el("p", { text: sub }) : null,
      el("div", { style: "text-align:center; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;" }, btns)
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "game-start" }, [card])]));
  }

  /* ---------- Sala de espera ---------- */
  function renderLobby() {
    var card = el("div", { class: "game-start__card" }, [
      el("div", { class: "status-badge status-badge--good" }),
      el("h2", { text: "¡Estás dentro, " + S.name + "!" }),
      el("p", { text: "Mira la pantalla grande. El juego empezará en un momento…" }),
      el("div", { class: "dots" }, [el("span"), el("span"), el("span")])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "game-start" }, [card])]));
  }

  /* ---------- Pregunta (solo colores/formas) ---------- */
  function renderQuestion(data) {
    S.answered = !!data.alreadyAnswered;
    S.current = data;
    var tf = data.type === "tf";

    var pad = el("div", { class: "answers-play player-pad" + (tf ? " answers-play--tf" : ""), id: "player-pad" });
    data.answers.forEach(function (a, i) {
      pad.appendChild(el("button", {
        class: "answer-btn " + window.UI.answerColorClass(data, i),
        "data-color": tf ? null : i,
        "data-index": i,
        "aria-label": (tf ? (i === 0 ? "Verdadero" : "Falso") : (COLOR_NAMES[i] || "")) + ": " + (a.text || ""),
        onClick: function () { pick(i); }
      }, [
        el("span", { class: "shape" }),
        el("span", { class: "label", text: a.text })
      ]));
    });

    var view = shell([
      el("div", { class: "progress" }, [el("div", { class: "progress__bar", id: "pbar", style: "width:100%" })]),
      el("div", { class: "player-q" }, [
        el("div", { class: "player-q__num", text: "Pregunta " + (data.index + 1) + " / " + data.total }),
        el("div", { class: "player-q__hint", id: "player-hint", text: S.answered ? "Respuesta enviada · espera…" : "Toca tu respuesta" })
      ]),
      pad
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(view);

    if (S.answered) lockButtons(data.answeredIndex);
    startBar(typeof data.remainingMs === "number" ? data.remainingMs : data.timeLimit * 1000, data.timeLimit * 1000);
  }

  function startBar(remainingMs, totalMs) {
    stopBar();
    totalMs = totalMs || remainingMs || 1;
    var deadline = Date.now() + Math.max(0, remainingMs);
    function paint() {
      var remaining = Math.max(0, deadline - Date.now());
      var bar = document.getElementById("pbar");
      if (bar) bar.style.width = (remaining / totalMs * 100) + "%";
      if (remaining <= 0) {
        stopBar();
        if (!S.answered) lockAfterAnswer("Se acabó el tiempo", "Espera el resultado…");
      }
    }
    paint();
    S.barTimer = setInterval(paint, 100);
  }

  function lockButtons(pickedIndex) {
    var pad = document.getElementById("player-pad");
    if (!pad) return;
    var btns = pad.querySelectorAll(".answer-btn");
    for (var b = 0; b < btns.length; b++) {
      btns[b].disabled = true;
      if (Number(btns[b].getAttribute("data-index")) === pickedIndex) btns[b].classList.add("is-picked");
      else btns[b].classList.add("dimmed");
    }
  }

  function pick(i) {
    if (S.answered) return;
    S.answered = true;
    stopBar();
    S.socket.emit("player:answer", { index: i }, function () {});
    lockButtons(i);
    var hint = document.getElementById("player-hint");
    if (hint) hint.textContent = "Respuesta enviada · espera…";
  }

  function lockAfterAnswer(title, sub) {
    var pad = document.getElementById("player-pad");
    if (pad) { var btns = pad.querySelectorAll(".answer-btn"); for (var b = 0; b < btns.length; b++) btns[b].disabled = true; }
    var hint = document.getElementById("player-hint");
    if (hint) hint.textContent = title + " · " + (sub || "");
  }

  /* ---------- Resultado personal ---------- */
  function renderResult(data) {
    stopBar();
    var good = data.answered && data.correct;
    var mark, title, cls;
    if (!data.answered) { mark = "—"; title = "Sin respuesta"; cls = "timeout"; }
    else if (good) { mark = "✓"; title = "¡Correcto!"; cls = "good"; }
    else { mark = "✗"; title = "Incorrecto"; cls = "bad"; }

    var card = el("div", { class: "result-card " + cls }, [
      el("div", { class: "result-card__mark", text: mark }),
      el("h2", { text: title }),
      good ? el("div", { class: "result-card__points", text: "+" + data.points + " puntos" }) : null,
      (good && data.bonus > 0) ? el("div", { class: "result-card__streak", text: "Racha ×" + data.streak + " · +" + data.bonus + " de bonus" }) : null,
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
      return (["1º", "2º", "3º"][i] || (i + 1 + "º")) + " " + p.name;
    }).join("   ");

    var isWinner = data.rank === 1;
    var card = el("div", { class: "result-card good" }, [
      el("div", { class: "result-card__mark", text: "#" + data.rank }),
      el("h2", { text: isWinner ? "¡Ganaste!" : "¡Terminado!" }),
      el("div", { class: "result-card__points", text: "Puesto #" + data.rank + " de " + data.totalPlayers }),
      el("div", { class: "result-card__rank", style: "border:none;", text: data.totalScore + " puntos" }),
      podiumTxt ? el("p", { class: "result-card__wait", text: podiumTxt }) : null,
      el("div", { style: "text-align:center; margin-top:1rem;" }, [
        el("button", { class: "btn btn--light", text: "Salir", onClick: exit })
      ])
    ]);
    S.root.innerHTML = "";
    S.root.appendChild(shell([el("div", { class: "player-result" }, [card])]));
  }

  /* ---------- API pública ---------- */
  function render(root, opts) {
    opts = opts || {};
    S = { root: root, onExit: opts.onExit, socket: null, pin: opts.pin || "", token: null, name: "", pendingName: "", answered: false, barTimer: null, exiting: false, connectedOnce: false };

    if (!Live.isLiveAvailable()) {
      showNeedsServer("No se pudo cargar el cliente de conexión.");
      return;
    }

    var saved = loadSession();
    if (saved && saved.pin && saved.token) {
      // El estudiante recargó o volvió: intentamos recuperar su partida.
      S.pin = saved.pin; S.token = saved.token; S.name = saved.name || "";
      renderStatus("", "Reconectando…", "Recuperando tu partida " + S.pin);
      connectAndBind();
    } else {
      renderJoin(opts.pin || "");
    }
  }

  window.QuizPlayer = { render: render };
})(window, document);

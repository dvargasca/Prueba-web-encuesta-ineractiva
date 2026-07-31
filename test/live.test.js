/* =========================================================
   test/live.test.js — Prueba de extremo a extremo del modo en vivo
   Simula un anfitrión y dos jugadores jugando una partida completa.
   Ejecuta:  npm test
   ========================================================= */
"use strict";

process.env.PORT = process.env.PORT || "3011";
const { io: Client } = require("socket.io-client");
const { server } = require("../server.js");

const URL = "http://localhost:" + process.env.PORT;

const QUIZ = {
  title: "Prueba automática",
  questions: [
    { text: "Q1", timeLimit: 20, points: 1000, answers: [{ text: "A", correct: true }, { text: "B", correct: false }] },
    { text: "Q2", timeLimit: 20, points: 1000, answers: [{ text: "C", correct: false }, { text: "D", correct: true }] }
  ]
};

// Ana acierta las dos; Beto falla las dos.
const PLAN = { Ana: [0, 1], Beto: [1, 0] };

let failed = false;
function assert(cond, msg) {
  if (cond) { console.log("  ✓ " + msg); }
  else { console.error("  ✗ " + msg); failed = true; }
}

function makePlayer(name, pin) {
  const sock = Client(URL, { reconnection: false });
  sock.on("connect", () => {
    sock.emit("player:join", { pin: pin, name: name }, (res) => {
      if (!res || !res.ok) { console.error("Fallo al unir " + name + ": " + (res && res.error)); failed = true; }
    });
  });
  sock.on("player:question", (data) => {
    const idx = PLAN[name][data.index];
    // Pequeño retraso distinto para simular velocidades
    setTimeout(() => sock.emit("player:answer", { index: idx }, () => {}), name === "Ana" ? 60 : 200);
  });
  sock.on("player:ended", (data) => { sock.data_ended = data; });
  return sock;
}

const timeout = setTimeout(() => { console.error("\n⏱ La prueba tardó demasiado."); process.exit(1); }, 15000);

server.on("listening", () => {
  console.log("Servidor de prueba en " + URL);
  const host = Client(URL, { reconnection: false });
  let players = {};
  let revealCount = 0;
  let lastReveal = null;

  host.on("connect", () => {
    host.emit("host:create", { quiz: QUIZ }, (res) => {
      assert(res && res.ok && /^\d{6}$/.test(res.pin), "El anfitrión crea la partida y recibe un PIN de 6 dígitos");
      const pin = res.pin;
      players.Ana = makePlayer("Ana", pin);
      players.Beto = makePlayer("Beto", pin);
    });
  });

  host.on("host:players", (data) => {
    if (data.count === 2 && !host._started) {
      host._started = true;
      assert(true, "Los dos jugadores aparecen en la sala");
      setTimeout(() => host.emit("host:start"), 100);
    }
  });

  host.on("host:question", (data) => {
    assert(data.answers && data.answers.length === 2 && data.answers[0].text, "El anfitrión recibe la pregunta " + (data.index + 1) + " con sus respuestas");
    assert(data.answers.every((a) => !("correct" in a)), "La pregunta enviada NO revela cuál es la correcta");
  });

  host.on("host:reveal", (data) => {
    revealCount++;
    lastReveal = data;
    const totalAnswers = data.distribution.reduce((a, b) => a + b, 0);
    assert(totalAnswers === 2, "Pregunta " + (data.index + 1) + ": se registraron 2 respuestas en la distribución");
    if (data.index === 0) {
      assert(data.correctIndexes.length === 1 && data.correctIndexes[0] === 0, "Q1: la respuesta correcta es la A (índice 0)");
      setTimeout(() => host.emit("host:next"), 100);
    } else {
      assert(data.isLast === true, "La segunda pregunta se marca como la última");
      setTimeout(() => host.emit("host:next"), 100);
    }
  });

  host.on("host:ended", (data) => {
    clearTimeout(timeout);
    assert(revealCount === 2, "Se revelaron las 2 preguntas");
    assert(data.podium.length === 2, "El podio tiene 2 jugadores");
    assert(data.podium[0].name === "Ana", "Ana queda en primer lugar (acertó las dos)");
    assert(data.podium[0].score > data.podium[1].score, "Ana tiene más puntos que Beto");
    assert(data.podium[1].name === "Beto" && data.podium[1].score === 0, "Beto queda segundo con 0 puntos");

    setTimeout(() => {
      assert(players.Ana.data_ended && players.Ana.data_ended.rank === 1, "Ana recibe su resultado final con puesto #1");
      assert(players.Beto.data_ended && players.Beto.data_ended.rank === 2, "Beto recibe su resultado final con puesto #2");

      host.close(); players.Ana.close(); players.Beto.close();
      server.close(() => {
        console.log(failed ? "\n❌ HUBO FALLOS" : "\n✅ TODAS LAS PRUEBAS DEL MODO EN VIVO PASARON");
        process.exit(failed ? 1 : 0);
      });
    }, 200);
  });
});

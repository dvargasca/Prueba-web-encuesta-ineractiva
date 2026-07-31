/* =========================================================
   test/reconnect.test.js — Prueba de reconexión de un jugador
   Un estudiante pierde la conexión a mitad de partida y vuelve
   con su token, conservando la puntuación y su sitio.
   ========================================================= */
"use strict";

process.env.PORT = process.env.PORT || "3013";
const { io: Client } = require("socket.io-client");
const { server } = require("../server.js");
const URL = "http://localhost:" + process.env.PORT;

const QUIZ = {
  title: "Reconexión",
  questions: [
    { text: "Q1", timeLimit: 20, points: 1000, answers: [{ text: "A", correct: true }, { text: "B", correct: false }] },
    { text: "Q2", timeLimit: 20, points: 1000, answers: [{ text: "C", correct: true }, { text: "D", correct: false }] }
  ]
};

let failed = false;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.error("  ✗ " + msg); failed = true; }
}
function once(sock, ev) { return new Promise((res) => sock.once(ev, res)); }
function emitAck(sock, ev, data) { return new Promise((res) => sock.emit(ev, data, res)); }
function connect() { return Client(URL, { reconnection: false }); }

const timeout = setTimeout(() => { console.error("\n⏱ Tardó demasiado."); process.exit(1); }, 15000);

server.on("listening", async () => {
  console.log("Servidor de prueba en " + URL);
  try {
    const host = connect(); await once(host, "connect");
    const created = await emitAck(host, "host:create", { quiz: QUIZ });
    assert(created.ok && /^\d{6}$/.test(created.pin), "El anfitrión crea la partida");
    const pin = created.pin;

    const ana = connect(); await once(ana, "connect");
    const anaJoin = await emitAck(ana, "player:join", { pin, name: "Ana" });
    assert(anaJoin.ok && anaJoin.token, "Ana se une y recibe un token de sesión");
    const token = anaJoin.token;

    const beto = connect(); await once(beto, "connect");
    await emitAck(beto, "player:join", { pin, name: "Beto" });

    // Pregunta 1
    host.emit("host:start");
    await once(ana, "player:question");
    await once(beto, "player:question");
    const anaRes1P = once(ana, "player:result");
    ana.emit("player:answer", { index: 0 }); // correcta
    beto.emit("player:answer", { index: 1 }); // incorrecta
    const anaRes1 = await anaRes1P;
    assert(anaRes1.correct === true && anaRes1.totalScore > 0, "Ana acierta la Q1 y suma puntos (" + anaRes1.totalScore + ")");
    const scoreAfterQ1 = anaRes1.totalScore;

    // 💥 Ana pierde la conexión
    ana.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    // 🔄 Ana reconecta desde un socket NUEVO usando su token
    const ana2 = connect(); await once(ana2, "connect");
    const ana2ResP = once(ana2, "player:result"); // al reconectar durante el revelado, recibe su resultado
    const rej = await emitAck(ana2, "player:rejoin", { pin, token });
    assert(rej.ok && rej.name === "Ana", "Ana reconecta con su token y recupera su identidad");
    const ana2Res = await ana2ResP;
    assert(ana2Res.totalScore === scoreAfterQ1, "Tras reconectar conserva su puntuación (" + scoreAfterQ1 + ")");

    // Pregunta 2 (Ana ya reconectada puede seguir jugando)
    host.emit("host:next");
    const q2 = await once(ana2, "player:question");
    assert(q2.index === 1, "Ana reconectada recibe la Q2 y puede responder");
    const endP = once(ana2, "player:ended");
    ana2.emit("player:answer", { index: 0 }); // correcta
    beto.emit("player:answer", { index: 1 }); // incorrecta
    await once(host, "host:reveal");
    host.emit("host:next");
    const ended = await endP;
    assert(ended.rank === 1 && ended.totalScore > scoreAfterQ1, "Ana termina 1.ª con su puntuación acumulada (" + ended.totalScore + ")");

    clearTimeout(timeout);
    host.close(); ana2.close(); beto.close();
    server.close(() => {
      console.log(failed ? "\n❌ HUBO FALLOS" : "\n✅ TODAS LAS PRUEBAS DE RECONEXIÓN PASARON");
      process.exit(failed ? 1 : 0);
    });
  } catch (e) {
    console.error("FALLO:", e.message);
    process.exit(1);
  }
});

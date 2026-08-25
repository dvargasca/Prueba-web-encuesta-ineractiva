/* =========================================================
   test/report.test.js — Prueba del REPORTE de una partida
   Juega una partida completa (con un jugador que deja una pregunta sin
   responder) y verifica que se guarda el reporte con las respuestas de
   cada participante por pregunta, y que caduca tras una semana.
   Ejecuta:  npm test
   ========================================================= */
"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");

// Datos en un directorio temporal para no tocar los del proyecto.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quizaula-report-"));
process.env.PORT = process.env.REPORT_PORT || "3014";

const { io: Client } = require("socket.io-client");
const { server } = require("../server.js");
const store = require("../store.js");

const URL = "http://localhost:" + process.env.PORT;

const QUIZ = {
  id: "qX",
  title: "Repaso",
  questions: [
    { text: "¿2+2?", timeLimit: 20, points: 1000, answers: [{ text: "4", correct: true }, { text: "3", correct: false }] },
    { text: "El cielo es azul.", type: "tf", timeLimit: 20, points: 1000, answers: [{ text: "Verdadero", correct: true }, { text: "Falso", correct: false }] }
  ]
};
// Ana acierta las dos; Beto falla la 1.ª y NO responde la 2.ª.
const PLAN = { Ana: [0, 0], Beto: [1, null] };

let failed = false;
function assert(cond, msg) {
  if (cond) { console.log("  ✓ " + msg); }
  else { console.error("  ✗ " + msg); failed = true; }
}

function makePlayer(name, pin) {
  const sock = Client(URL, { reconnection: false });
  sock.on("connect", () => sock.emit("player:join", { pin: pin, name: name }, () => {}));
  sock.on("player:question", (data) => {
    const idx = PLAN[name][data.index];
    if (idx === null) return; // no responde a propósito
    setTimeout(() => sock.emit("player:answer", { index: idx }, () => {}), name === "Ana" ? 50 : 120);
  });
  return sock;
}

const timeout = setTimeout(() => { console.error("\n⏱ La prueba del reporte tardó demasiado."); process.exit(1); }, 15000);

server.on("listening", () => {
  console.log("Servidor de prueba (reporte) en " + URL);
  const host = Client(URL, { reconnection: false });
  const players = {};

  host.on("connect", () => host.emit("host:create", { quiz: QUIZ }, (res) => {
    players.Ana = makePlayer("Ana", res.pin);
    players.Beto = makePlayer("Beto", res.pin);
  }));

  host.on("host:players", (d) => {
    if (d.count === 2 && !host._started) { host._started = true; setTimeout(() => host.emit("host:start"), 100); }
  });

  // En la 2.ª pregunta, Beto no responde: forzamos el revelado con "skip".
  host.on("host:question", (d) => { if (d.index === 1) setTimeout(() => host.emit("host:skip"), 400); });
  host.on("host:reveal", () => setTimeout(() => host.emit("host:next"), 150));

  host.on("host:ended", (data) => {
    clearTimeout(timeout);

    assert(!!data.reportId, "host:ended incluye el id del reporte");
    const rep = store.getReport(data.reportId);
    assert(!!rep, "el reporte se guardó y se puede leer");
    assert(rep.questions.length === 2, "el reporte guarda las 2 preguntas");
    assert(rep.participants.length === 2, "el reporte guarda los 2 participantes");
    assert(rep.quizTitle === "Repaso" && rep.quizId === "qX", "guarda el título y el id del cuestionario");

    const ana = rep.participants.find((p) => p.name === "Ana");
    const beto = rep.participants.find((p) => p.name === "Beto");
    assert(rep.participants[0].name === "Ana", "los participantes salen ordenados por puntuación (Ana primero)");
    assert(ana.answers[0].correct === true && ana.answers[0].answerText === "4", "Ana Q1: correcta y guarda el texto '4'");
    assert(ana.answers[1].correct === true && ana.answers[1].answerText === "Verdadero", "Ana Q2: correcta y guarda 'Verdadero'");
    assert(ana.correctCount === 2, "Ana tiene 2 aciertos");
    assert(typeof ana.answers[0].timeMs === "number", "guarda el tiempo de respuesta");
    assert(beto.answers[0].answered === true && beto.answers[0].correct === false && beto.answers[0].answerText === "3", "Beto Q1: respondió '3' (incorrecta)");
    assert(beto.answers[1].answered === false && beto.answers[1].answerText === "", "Beto Q2: queda registrada como SIN respuesta");
    assert(beto.correctCount === 0 && beto.score === 0, "Beto: 0 aciertos y 0 puntos");

    // La lista incluye el reporte…
    assert(store.listReports().some((r) => r.id === data.reportId), "el reporte aparece en la lista");
    // …y caduca al superar la semana.
    const df = path.join(process.env.DATA_DIR, "quizaula-data.json");
    const raw = JSON.parse(fs.readFileSync(df, "utf8"));
    raw.reports.forEach((r) => { r.savedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; });
    fs.writeFileSync(df, JSON.stringify(raw));
    delete require.cache[require.resolve("../store.js")];
    const store2 = require("../store.js");
    store2.pruneReports();
    assert(store2.listReports().length === 0, "los reportes de más de una semana se borran solos");

    host.close(); players.Ana.close(); players.Beto.close();
    server.close(() => {
      console.log(failed ? "\n❌ HUBO FALLOS" : "\n✅ TODAS LAS PRUEBAS DEL REPORTE PASARON");
      process.exit(failed ? 1 : 0);
    });
  });
});

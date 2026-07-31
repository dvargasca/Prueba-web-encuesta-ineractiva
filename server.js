/* =========================================================
   server.js — Servidor del modo EN VIVO (multijugador)
   Node.js + Express + Socket.IO
   - La pantalla anfitriona (profe) crea una partida y recibe un PIN.
   - Los estudiantes se unen con ese PIN desde el móvil (sin cuenta).
   - El servidor sincroniza preguntas, temporizador y puntuaciones.
   ========================================================= */
"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// maxHttpBufferSize alto para permitir preguntas con imágenes (data URLs).
const io = new Server(server, { maxHttpBufferSize: 1e7 });

// Sirve el frontend estático (index.html, css/, js/).
app.use(express.static(__dirname));
app.get("/salud", (_req, res) => res.json({ ok: true, partidas: games.size }));

/* =========================================================
   Estado en memoria
   ========================================================= */
const games = new Map(); // pin -> game

const MAX_PLAYERS = 80;
const MAX_NAME = 20;

function makePin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (games.has(pin));
  return pin;
}

function scoreFor(points, timeLimitMs, elapsedMs) {
  // Puntos completos si respondes al instante, bajando al 50 % al final.
  const frac = Math.max(0, Math.min(1, 1 - elapsedMs / timeLimitMs));
  return Math.round((points || 1000) * (0.5 + 0.5 * frac));
}

function playersPublic(game) {
  // Lista para el anfitrión (nombre + puntuación), ordenada por puntuación.
  return [...game.players.values()]
    .map((p) => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function leaderboard(game, limit) {
  const list = [...game.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, lastPoints: p.lastPoints || 0 }));
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

function rankOf(game, playerId) {
  const sorted = [...game.players.values()].sort((a, b) => b.score - a.score);
  return sorted.findIndex((p) => p.id === playerId) + 1;
}

/* =========================================================
   Flujo de una pregunta
   ========================================================= */
function sendQuestion(game) {
  const q = game.quiz.questions[game.currentIndex];
  const total = game.quiz.questions.length;
  const timeLimit = Number(q.timeLimit) || 20;

  game.state = "question";
  game.questionStartTs = Date.now();
  game.answeredCount = 0;

  // Reinicia el estado de respuesta de cada jugador.
  game.players.forEach((p) => {
    p.answered = false;
    p.answerIndex = -1;
    p.lastPoints = 0;
  });

  // Al anfitrión: pregunta completa (con imagen) pero SIN marcar la correcta.
  io.to(game.hostSocketId).emit("host:question", {
    index: game.currentIndex,
    total: total,
    timeLimit: timeLimit,
    text: q.text,
    image: q.image || null,
    answers: q.answers.map((a) => ({ text: a.text })),
    playerCount: game.players.size,
  });

  // A los jugadores: solo lo necesario (sin imagen ni cuál es la correcta).
  game.players.forEach((p) => {
    io.to(p.id).emit("player:question", {
      index: game.currentIndex,
      total: total,
      timeLimit: timeLimit,
      answers: q.answers.map((a) => ({ text: a.text })),
    });
  });

  // Temporizador autoritativo del servidor.
  clearTimeout(game.timer);
  game.timer = setTimeout(() => revealQuestion(game), timeLimit * 1000 + 400);
}

function maybeRevealEarly(game) {
  if (game.state === "question" && game.players.size > 0 && game.answeredCount >= game.players.size) {
    clearTimeout(game.timer);
    // Pequeño respiro para que se vea el último "respondido".
    setTimeout(() => revealQuestion(game), 500);
  }
}

function revealQuestion(game) {
  if (game.state !== "question") return;
  game.state = "reveal";
  clearTimeout(game.timer);

  const q = game.quiz.questions[game.currentIndex];
  const correctIndexes = q.answers.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0);
  const distribution = q.answers.map(() => 0);

  game.players.forEach((p) => {
    if (p.answered && p.answerIndex >= 0 && p.answerIndex < distribution.length) {
      distribution[p.answerIndex]++;
    }
  });

  // Al anfitrión: correcta + distribución + tabla de líderes.
  io.to(game.hostSocketId).emit("host:reveal", {
    index: game.currentIndex,
    correctIndexes: correctIndexes,
    distribution: distribution,
    leaderboard: leaderboard(game, 5),
    isLast: game.currentIndex >= game.quiz.questions.length - 1,
  });

  // A cada jugador: su resultado personal.
  game.players.forEach((p) => {
    io.to(p.id).emit("player:result", {
      correct: p.answeredCorrectly === true,
      answered: p.answered === true,
      points: p.lastPoints || 0,
      totalScore: p.score,
      rank: rankOf(game, p.id),
      totalPlayers: game.players.size,
      streak: p.streak || 0,
      correctIndexes: correctIndexes,
    });
  });
}

function nextQuestion(game) {
  if (game.currentIndex >= game.quiz.questions.length - 1) {
    endGame(game);
    return;
  }
  game.currentIndex++;
  sendQuestion(game);
}

function endGame(game) {
  game.state = "ended";
  clearTimeout(game.timer);
  const full = leaderboard(game);
  io.to(game.hostSocketId).emit("host:ended", { podium: full.slice(0, 5), total: full.length });
  game.players.forEach((p) => {
    io.to(p.id).emit("player:ended", {
      rank: rankOf(game, p.id),
      totalScore: p.score,
      totalPlayers: game.players.size,
      top3: full.slice(0, 3).map((x) => ({ name: x.name, score: x.score })),
    });
  });
}

function closeGame(game, reason) {
  clearTimeout(game.timer);
  game.players.forEach((p) => io.to(p.id).emit("game:closed", { reason: reason || "La partida se cerró." }));
  games.delete(game.pin);
}

/* =========================================================
   Conexiones Socket.IO
   ========================================================= */
io.on("connection", (socket) => {
  // ---- ANFITRIÓN crea una partida ----
  socket.on("host:create", (payload, ack) => {
    const quiz = payload && payload.quiz;
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      if (ack) ack({ ok: false, error: "El cuestionario no es válido." });
      return;
    }
    const pin = makePin();
    const game = {
      pin: pin,
      hostSocketId: socket.id,
      quiz: quiz,
      players: new Map(), // socketId -> player
      state: "lobby",
      currentIndex: -1,
      timer: null,
      answeredCount: 0,
      questionStartTs: 0,
    };
    games.set(pin, game);
    socket.data.role = "host";
    socket.data.pin = pin;
    socket.join(pin);
    if (ack) ack({ ok: true, pin: pin, title: quiz.title, total: quiz.questions.length });
  });

  // ---- ANFITRIÓN inicia el juego ----
  socket.on("host:start", () => {
    const game = games.get(socket.data.pin);
    if (!game || game.hostSocketId !== socket.id) return;
    if (game.players.size === 0) {
      io.to(socket.id).emit("host:info", { message: "Espera a que se una al menos un jugador." });
      return;
    }
    game.currentIndex = -1;
    nextQuestion(game);
  });

  // ---- ANFITRIÓN pasa a la siguiente pregunta ----
  socket.on("host:next", () => {
    const game = games.get(socket.data.pin);
    if (!game || game.hostSocketId !== socket.id) return;
    if (game.state === "reveal") nextQuestion(game);
  });

  // ---- ANFITRIÓN revela ya (salta el temporizador) ----
  socket.on("host:skip", () => {
    const game = games.get(socket.data.pin);
    if (!game || game.hostSocketId !== socket.id) return;
    if (game.state === "question") revealQuestion(game);
  });

  // ---- ANFITRIÓN termina la partida ----
  socket.on("host:end", () => {
    const game = games.get(socket.data.pin);
    if (!game || game.hostSocketId !== socket.id) return;
    endGame(game);
  });

  // ---- JUGADOR se une ----
  socket.on("player:join", (payload, ack) => {
    const pin = String((payload && payload.pin) || "").trim();
    let name = String((payload && payload.name) || "").trim().slice(0, MAX_NAME);
    const game = games.get(pin);

    if (!game) { if (ack) ack({ ok: false, error: "No existe ninguna partida con ese PIN." }); return; }
    if (game.state === "ended") { if (ack) ack({ ok: false, error: "Esa partida ya terminó." }); return; }
    if (game.players.size >= MAX_PLAYERS) { if (ack) ack({ ok: false, error: "La partida está llena." }); return; }
    if (!name) { if (ack) ack({ ok: false, error: "Escribe un apodo." }); return; }

    // Nombre único (sin distinguir mayúsculas).
    const taken = [...game.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) { if (ack) ack({ ok: false, error: "Ese apodo ya está en uso, prueba otro." }); return; }

    const player = {
      id: socket.id,
      name: name,
      score: 0,
      streak: 0,
      answered: false,
      answerIndex: -1,
      answeredCorrectly: false,
      lastPoints: 0,
    };
    game.players.set(socket.id, player);
    socket.data.role = "player";
    socket.data.pin = pin;
    socket.join(pin);

    if (ack) ack({ ok: true, name: name, title: game.quiz.title, state: game.state });

    // Avisa al anfitrión de la nueva lista de jugadores.
    io.to(game.hostSocketId).emit("host:players", { players: playersPublic(game), count: game.players.size });

    // Si el juego ya empezó, el jugador espera a la próxima pregunta.
    if (game.state !== "lobby") {
      io.to(socket.id).emit("player:wait", { message: "El juego ya empezó. Espera a la siguiente pregunta." });
    }
  });

  // ---- JUGADOR responde ----
  socket.on("player:answer", (payload, ack) => {
    const game = games.get(socket.data.pin);
    if (!game || game.state !== "question") { if (ack) ack({ ok: false }); return; }
    const player = game.players.get(socket.id);
    if (!player || player.answered) { if (ack) ack({ ok: false }); return; }

    const q = game.quiz.questions[game.currentIndex];
    const index = Number(payload && payload.index);
    if (!(index >= 0 && index < q.answers.length)) { if (ack) ack({ ok: false }); return; }

    const elapsed = Date.now() - game.questionStartTs;
    const timeLimitMs = (Number(q.timeLimit) || 20) * 1000;
    const correct = !!q.answers[index].correct;

    player.answered = true;
    player.answerIndex = index;
    player.answeredCorrectly = correct;
    if (correct) {
      player.lastPoints = scoreFor(q.points, timeLimitMs, elapsed);
      player.score += player.lastPoints;
      player.streak = (player.streak || 0) + 1;
    } else {
      player.lastPoints = 0;
      player.streak = 0;
    }
    game.answeredCount++;

    if (ack) ack({ ok: true });

    // Informa al anfitrión de cuántos han respondido.
    io.to(game.hostSocketId).emit("host:answers", { count: game.answeredCount, total: game.players.size });

    maybeRevealEarly(game);
  });

  // ---- Desconexión ----
  socket.on("disconnect", () => {
    const pin = socket.data.pin;
    if (!pin) return;
    const game = games.get(pin);
    if (!game) return;

    if (socket.data.role === "host") {
      // Si se cae el anfitrión, se cierra la partida.
      closeGame(game, "El anfitrión cerró la partida.");
    } else if (socket.data.role === "player") {
      game.players.delete(socket.id);
      io.to(game.hostSocketId).emit("host:players", { players: playersPublic(game), count: game.players.size });
      // Si todos los que quedan ya respondieron, revela.
      maybeRevealEarly(game);
    }
  });
});

/* =========================================================
   Arranque
   ========================================================= */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("QuizAula (modo en vivo) escuchando en http://localhost:" + PORT);
});

// Exporta para pruebas.
module.exports = { app, server, io, games };

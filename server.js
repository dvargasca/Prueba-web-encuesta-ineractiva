/* =========================================================
   server.js — Servidor del modo EN VIVO (multijugador)
   Node.js + Express + Socket.IO
   - La pantalla anfitriona (profe) crea una partida y recibe un PIN.
   - Los estudiantes se unen con ese PIN desde el móvil (sin cuenta).
   - El servidor sincroniza preguntas, temporizador y puntuaciones.
   - Reconexión: cada jugador recibe un token; si se le cae el internet
     o recarga la página, vuelve a su sitio sin perder la puntuación.
   ========================================================= */
"use strict";

const http = require("http");
const crypto = require("crypto");
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
const LOBBY_GRACE_MS = 30000; // margen para reconectar si te caes en la sala de espera
const STREAK_STEP = 100;      // puntos de bonus por cada acierto encadenado
const STREAK_CAP = 5;         // tope del bonus (5 × 100 = +500)

function makePin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (games.has(pin));
  return pin;
}

function newToken() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function scoreFor(points, timeLimitMs, elapsedMs) {
  // Puntos completos si respondes al instante, bajando al 50 % al final.
  const frac = Math.max(0, Math.min(1, 1 - elapsedMs / timeLimitMs));
  return Math.round((points || 1000) * (0.5 + 0.5 * frac));
}

function streakBonus(streak) {
  // +100 por cada acierto consecutivo a partir del segundo, con tope en +500.
  return Math.min(Math.max(streak - 1, 0), STREAK_CAP) * STREAK_STEP;
}

function connectedCount(game) {
  let n = 0;
  game.players.forEach((p) => { if (p.connected) n++; });
  return n;
}

function playersPublic(game) {
  // Lista para el anfitrión, ordenada por puntuación.
  return [...game.players.values()]
    .map((p) => ({ name: p.name, score: p.score, connected: p.connected }))
    .sort((a, b) => b.score - a.score);
}

function leaderboard(game, limit) {
  const list = [...game.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, lastPoints: p.lastPoints || 0 }));
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

function rankOf(game, token) {
  const sorted = [...game.players.values()].sort((a, b) => b.score - a.score);
  return sorted.findIndex((p) => p.token === token) + 1;
}

function emitToPlayer(player, event, data) {
  if (player && player.socketId) io.to(player.socketId).emit(event, data);
}

function emitPlayersToHost(game) {
  io.to(game.hostSocketId).emit("host:players", { players: playersPublic(game), count: connectedCount(game) });
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
    p.lastBonus = 0;
    p.lastResult = null;
  });

  // Al anfitrión: pregunta completa (con imagen) pero SIN marcar la correcta.
  io.to(game.hostSocketId).emit("host:question", {
    index: game.currentIndex,
    total: total,
    timeLimit: timeLimit,
    type: q.type || "multiple",
    text: q.text,
    image: q.image || null,
    answers: q.answers.map((a) => ({ text: a.text })),
    playerCount: connectedCount(game),
  });

  // A los jugadores conectados: solo lo necesario (sin imagen ni cuál es la correcta).
  game.players.forEach((p) => {
    if (!p.connected) return;
    emitToPlayer(p, "player:question", {
      index: game.currentIndex,
      total: total,
      timeLimit: timeLimit,
      remainingMs: timeLimit * 1000,
      type: q.type || "multiple",
      answers: q.answers.map((a) => ({ text: a.text })),
      alreadyAnswered: false,
      answeredIndex: -1,
    });
  });

  // Temporizador autoritativo del servidor.
  clearTimeout(game.timer);
  game.timer = setTimeout(() => revealQuestion(game), timeLimit * 1000 + 400);
}

function maybeRevealEarly(game) {
  if (game.state === "question") {
    const conn = connectedCount(game);
    if (conn > 0 && game.answeredCount >= conn) {
      clearTimeout(game.timer);
      setTimeout(() => revealQuestion(game), 500);
    }
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

  // A cada jugador: su resultado personal (se guarda por si necesita reconectar).
  game.players.forEach((p) => {
    const result = {
      correct: p.answeredCorrectly === true,
      answered: p.answered === true,
      points: p.lastPoints || 0,
      bonus: p.lastBonus || 0,
      totalScore: p.score,
      rank: rankOf(game, p.token),
      totalPlayers: game.players.size,
      streak: p.streak || 0,
      correctIndexes: correctIndexes,
    };
    p.lastResult = result;
    emitToPlayer(p, "player:result", result);
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

function endedPayloadFor(game, token) {
  const full = leaderboard(game);
  const player = game.players.get(token);
  return {
    rank: rankOf(game, token),
    totalScore: player ? player.score : 0,
    totalPlayers: game.players.size,
    top3: full.slice(0, 3).map((x) => ({ name: x.name, score: x.score })),
  };
}

function endGame(game) {
  game.state = "ended";
  clearTimeout(game.timer);
  const full = leaderboard(game);
  io.to(game.hostSocketId).emit("host:ended", { podium: full.slice(0, 5), total: full.length });
  game.players.forEach((p) => emitToPlayer(p, "player:ended", endedPayloadFor(game, p.token)));
  // El juego permanece en memoria para permitir reconexiones hasta que el anfitrión salga.
}

function closeGame(game, reason) {
  clearTimeout(game.timer);
  game.players.forEach((p) => {
    if (p.removalTimer) clearTimeout(p.removalTimer);
    emitToPlayer(p, "game:closed", { reason: reason || "La partida se cerró." });
  });
  games.delete(game.pin);
}

/** Pone al día a un jugador que acaba de (re)conectar según el estado del juego. */
function sendStateToPlayer(game, player) {
  if (game.state === "question") {
    const q = game.quiz.questions[game.currentIndex];
    const timeLimit = Number(q.timeLimit) || 20;
    const remaining = Math.max(0, game.questionStartTs + timeLimit * 1000 - Date.now());
    emitToPlayer(player, "player:question", {
      index: game.currentIndex,
      total: game.quiz.questions.length,
      timeLimit: timeLimit,
      remainingMs: remaining,
      type: q.type || "multiple",
      answers: q.answers.map((a) => ({ text: a.text })),
      alreadyAnswered: !!player.answered,
      answeredIndex: player.answered ? player.answerIndex : -1,
    });
  } else if (game.state === "reveal") {
    if (player.lastResult) emitToPlayer(player, "player:result", player.lastResult);
    else emitToPlayer(player, "player:wait", { message: "Espera la siguiente pregunta." });
  } else if (game.state === "ended") {
    emitToPlayer(player, "player:ended", endedPayloadFor(game, player.token));
  } else {
    emitToPlayer(player, "player:lobby", { title: game.quiz.title });
  }
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
      players: new Map(), // token -> player
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
    if (connectedCount(game) === 0) {
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
    if (connectedCount(game) >= MAX_PLAYERS) { if (ack) ack({ ok: false, error: "La partida está llena." }); return; }
    if (!name) { if (ack) ack({ ok: false, error: "Escribe un apodo." }); return; }

    // Nombre único (sin distinguir mayúsculas).
    const taken = [...game.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) { if (ack) ack({ ok: false, error: "Ese apodo ya está en uso, prueba otro." }); return; }

    const token = newToken();
    const player = {
      token: token,
      socketId: socket.id,
      connected: true,
      name: name,
      score: 0,
      streak: 0,
      answered: false,
      answerIndex: -1,
      answeredCorrectly: false,
      lastPoints: 0,
      lastBonus: 0,
      lastResult: null,
      removalTimer: null,
    };
    game.players.set(token, player);
    socket.data.role = "player";
    socket.data.pin = pin;
    socket.data.token = token;
    socket.join(pin);

    if (ack) ack({ ok: true, token: token, name: name, title: game.quiz.title, state: game.state });

    emitPlayersToHost(game);

    // Si el juego ya empezó, ponle al día.
    if (game.state !== "lobby") sendStateToPlayer(game, player);
  });

  // ---- JUGADOR se reconecta (recarga o se le cayó el internet) ----
  socket.on("player:rejoin", (payload, ack) => {
    const pin = String((payload && payload.pin) || "").trim();
    const token = String((payload && payload.token) || "");
    const game = games.get(pin);

    if (!game) { if (ack) ack({ ok: false, error: "La partida ya no existe.", gone: true }); return; }
    const player = game.players.get(token);
    if (!player) { if (ack) ack({ ok: false, error: "No encontramos tu sesión.", gone: true }); return; }

    // Cancela cualquier eliminación pendiente y vuelve a enlazar el socket.
    if (player.removalTimer) { clearTimeout(player.removalTimer); player.removalTimer = null; }
    player.socketId = socket.id;
    player.connected = true;
    socket.data.role = "player";
    socket.data.pin = pin;
    socket.data.token = token;
    socket.join(pin);

    if (ack) ack({ ok: true, token: token, name: player.name, title: game.quiz.title, state: game.state });

    emitPlayersToHost(game);
    sendStateToPlayer(game, player);
  });

  // ---- JUGADOR responde ----
  socket.on("player:answer", (payload, ack) => {
    const game = games.get(socket.data.pin);
    if (!game || game.state !== "question") { if (ack) ack({ ok: false }); return; }
    const player = game.players.get(socket.data.token);
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
      player.streak = (player.streak || 0) + 1;
      const base = scoreFor(q.points, timeLimitMs, elapsed);
      const bonus = streakBonus(player.streak);
      player.lastBonus = bonus;
      player.lastPoints = base + bonus;
      player.score += player.lastPoints;
    } else {
      player.streak = 0;
      player.lastBonus = 0;
      player.lastPoints = 0;
    }
    game.answeredCount++;

    if (ack) ack({ ok: true });

    io.to(game.hostSocketId).emit("host:answers", { count: game.answeredCount, total: connectedCount(game) });

    maybeRevealEarly(game);
  });

  // ---- Desconexión ----
  socket.on("disconnect", () => {
    const pin = socket.data.pin;
    if (!pin) return;
    const game = games.get(pin);
    if (!game) return;

    if (socket.data.role === "host") {
      closeGame(game, "El anfitrión cerró la partida.");
      return;
    }

    const player = game.players.get(socket.data.token);
    if (!player || player.socketId !== socket.id) return; // ya reconectó con otro socket

    player.connected = false;
    player.socketId = null;
    emitPlayersToHost(game);

    if (game.state === "lobby") {
      // En la sala de espera: si no vuelve en un rato, se elimina.
      player.removalTimer = setTimeout(() => {
        if (!player.connected) {
          game.players.delete(player.token);
          emitPlayersToHost(game);
        }
      }, LOBBY_GRACE_MS);
    } else {
      // En plena partida: se conserva (mantiene su puntuación) para que pueda reconectar.
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

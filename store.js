/* =========================================================
   store.js — Persistencia en el SERVIDOR (JSON en disco)
   Guarda los cuestionarios del profe y la configuración de acceso
   (contraseña y secreto de sesión). Así los estudiantes no pueden
   ver ni editar los cuestionarios: solo el profe autenticado.

   Los datos se guardan en DATA_DIR (por defecto ./data). En Railway o
   Render conviene montar un "Volume"/"Disk" en esa ruta para que
   sobrevivan a los redespliegues.
   ========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "quizaula-data.json");
// Reportes de las partidas (respuestas de cada estudiante). Cada reporte se
// guarda en su propio archivo dentro de REPORTS_DIR y se conserva un máximo de
// una semana para no cargar el servidor (se borra automáticamente al caducar).
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // una semana

let data = { meta: {}, quizzes: [], reports: [] };

/* ---------- Cuestionario de ejemplo (solo la primera vez) ---------- */
function a(text, correct) { return { text: text, correct: !!correct }; }
function sampleQuiz() {
  return {
    id: "q_ejemplo",
    title: "Cultura general para clase",
    description: "Un ejemplo listo para jugar. Edítalo o crea el tuyo desde cero.",
    cover: "🧠",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questions: [
      { id: "s1", text: "¿Cuál es el planeta más grande del sistema solar?", image: null, timeLimit: 20, points: 1000,
        answers: [a("Júpiter", true), a("Saturno", false), a("La Tierra", false), a("Marte", false)] },
      { id: "s2", text: "¿Quién escribió \"Don Quijote de la Mancha\"?", image: null, timeLimit: 20, points: 1000,
        answers: [a("Miguel de Cervantes", true), a("Federico García Lorca", false), a("Gabriel García Márquez", false), a("Pablo Neruda", false)] },
      { id: "s3", text: "¿Cuánto es 7 × 8?", image: null, timeLimit: 15, points: 1000,
        answers: [a("56", true), a("54", false), a("64", false), a("49", false)] },
      { id: "s4", text: "El agua está compuesta por hidrógeno y oxígeno.", type: "tf", image: null, timeLimit: 15, points: 1000,
        answers: [a("Verdadero", true), a("Falso", false)] },
      { id: "s5", text: "¿En qué continente se encuentra Egipto?", image: null, timeLimit: 20, points: 1000,
        answers: [a("África", true), a("Asia", false), a("Europa", false), a("Oceanía", false)] }
    ]
  };
}

/* ---------- Carga y guardado ---------- */
function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

function persist() {
  ensureDir();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE); // escritura atómica
}

function load() {
  let existed = false;
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    data = {
      meta: parsed && parsed.meta ? parsed.meta : {},
      quizzes: parsed && Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      reports: parsed && Array.isArray(parsed.reports) ? parsed.reports : []
    };
    existed = true;
  } catch (e) {
    data = { meta: {}, quizzes: [], reports: [] };
  }

  let changed = false;
  // Secreto estable para firmar las sesiones (si no llega por variable de entorno).
  if (!data.meta.sessionSecret) { data.meta.sessionSecret = crypto.randomBytes(32).toString("hex"); changed = true; }
  // Primera vez: sembramos el cuestionario de ejemplo para no arrancar vacío.
  if (!existed && !data.meta.seeded) { data.quizzes.push(sampleQuiz()); data.meta.seeded = true; changed = true; }
  if (changed) persist();
  // Al arrancar, borra los reportes que ya superaron la semana.
  pruneReports();
}

/* ---------- Configuración (meta) ---------- */
function getMeta(key) { return data.meta[key]; }
function setMeta(key, value) { data.meta[key] = value; persist(); }

/* ---------- Cuestionarios ---------- */
function allQuizzes() {
  return data.quizzes.slice().sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
}
function getQuiz(id) {
  return data.quizzes.find((q) => q.id === id) || null;
}
function upsertQuiz(quiz) {
  const now = Date.now();
  if (!quiz.id) quiz.id = "q_" + now.toString(36) + "_" + crypto.randomBytes(3).toString("hex");
  if (!quiz.createdAt) quiz.createdAt = now;
  quiz.updatedAt = now;
  const i = data.quizzes.findIndex((q) => q.id === quiz.id);
  if (i >= 0) data.quizzes[i] = quiz; else data.quizzes.push(quiz);
  persist();
  return quiz;
}
function removeQuiz(id) {
  const before = data.quizzes.length;
  data.quizzes = data.quizzes.filter((q) => q.id !== id);
  const changed = data.quizzes.length !== before;
  if (changed) persist();
  return changed;
}
function isEmpty() { return data.quizzes.length === 0; }

/* ---------- Reportes de partidas (respuestas de los estudiantes) ---------- */
function ensureReportsDir() {
  try { fs.mkdirSync(REPORTS_DIR, { recursive: true }); } catch (e) {}
}
// Solo permitimos ids con estos caracteres (evita rutas maliciosas ../).
function safeReportId(id) { return /^[A-Za-z0-9_-]+$/.test(String(id || "")); }
function reportFile(id) { return path.join(REPORTS_DIR, id + ".json"); }

/** Resumen ligero (para la lista) a partir de un reporte completo. */
function reportSummary(report) {
  return {
    id: report.id,
    pin: report.pin || "",
    quizId: report.quizId || "",
    quizTitle: report.quizTitle || "Cuestionario",
    playedAt: report.playedAt || report.savedAt || 0,
    finishedAt: report.finishedAt || 0,
    savedAt: report.savedAt || 0,
    participants: Array.isArray(report.participants) ? report.participants.length : 0,
    questions: Array.isArray(report.questions) ? report.questions.length : 0
  };
}

/** Guarda un reporte completo (un archivo por reporte) y su resumen en el índice. */
function saveReport(report) {
  if (!report || !Array.isArray(report.questions) || !report.questions.length) return null;
  if (!Array.isArray(report.participants) || !report.participants.length) return null;
  const now = Date.now();
  report.id = "r_" + now.toString(36) + "_" + crypto.randomBytes(4).toString("hex");
  report.savedAt = now;
  ensureReportsDir();
  try {
    const tmp = reportFile(report.id) + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(report));
    fs.renameSync(tmp, reportFile(report.id));
  } catch (e) { return null; }
  data.reports.push(reportSummary(report));
  persist();
  return reportSummary(report);
}

/** Lista de resúmenes, del más reciente al más antiguo (tras podar caducados). */
function listReports() {
  pruneReports();
  return data.reports.slice().sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0));
}

/** Reporte completo por id (o null si no existe / caducó / id inválido). */
function getReport(id) {
  if (!safeReportId(id)) return null;
  pruneReports();
  try { return JSON.parse(fs.readFileSync(reportFile(id), "utf8")); }
  catch (e) { return null; }
}

/** Borra un reporte (archivo + entrada del índice). */
function deleteReport(id) {
  if (!safeReportId(id)) return false;
  const before = data.reports.length;
  data.reports = data.reports.filter((r) => r.id !== id);
  try { fs.unlinkSync(reportFile(id)); } catch (e) {}
  const changed = data.reports.length !== before;
  if (changed) persist();
  return changed;
}

/** Elimina los reportes que superaron la semana (índice + archivo). */
function pruneReports() {
  if (!Array.isArray(data.reports)) { data.reports = []; return 0; }
  const cutoff = Date.now() - REPORT_TTL_MS;
  const keep = [];
  let removed = 0;
  data.reports.forEach((r) => {
    if ((r.savedAt || 0) < cutoff) {
      removed++;
      if (safeReportId(r.id)) { try { fs.unlinkSync(reportFile(r.id)); } catch (e) {} }
    } else {
      keep.push(r);
    }
  });
  if (removed) { data.reports = keep; persist(); }
  return removed;
}

load();

module.exports = {
  DATA_FILE,
  getMeta, setMeta,
  allQuizzes, getQuiz, upsertQuiz, removeQuiz, isEmpty,
  saveReport, listReports, getReport, deleteReport, pruneReports
};

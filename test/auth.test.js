/* =========================================================
   test/auth.test.js — Inicio de sesión y API de cuestionarios
   Comprueba que SOLO el profe autenticado puede ver/editar los
   cuestionarios y que sin sesión (los estudiantes) no se puede.
   Ejecuta:  npm test
   ========================================================= */
"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");

// Config de prueba ANTES de cargar el servidor (store.js lee estas variables).
process.env.PORT = process.env.PORT || "3020";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quizaula-test-"));
process.env.TEACHER_PASSWORD = "secreto123";
process.env.SESSION_SECRET = "test-secret";

const { server } = require("../server.js");
const BASE = "http://localhost:" + process.env.PORT;

let failed = false;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.error("  ✗ " + msg); failed = true; }
}

// Cliente HTTP mínimo con "tarro de cookies" manual.
let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method: method,
    headers: Object.assign(body ? { "Content-Type": "application/json" } : {}, cookie ? { Cookie: cookie } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const setC = res.headers.get("set-cookie");
  if (setC) cookie = setC.split(";")[0]; // guardamos qa_session=...
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json: json };
}

async function main() {
  try {
    // Estado inicial: contraseña por variable de entorno → no hace falta configurar.
    let r = await api("GET", "/api/auth/status");
    assert(r.status === 200 && r.json.authenticated === false && r.json.needsSetup === false,
      "Estado inicial: sin sesión y sin necesidad de configurar (contraseña por variable)");

    // Sin sesión, un estudiante NO puede listar cuestionarios.
    r = await api("GET", "/api/quizzes");
    assert(r.status === 401, "Sin sesión, GET /api/quizzes devuelve 401 (los estudiantes no ven cuestionarios)");

    // Sin sesión, un estudiante NO puede editar.
    r = await api("PUT", "/api/quizzes/x1", { title: "Hackeo", questions: [] });
    assert(r.status === 401, "Sin sesión, PUT /api/quizzes/:id devuelve 401 (los estudiantes no pueden editar)");

    // Contraseña incorrecta.
    r = await api("POST", "/api/auth/login", { password: "malaclave" });
    assert(r.status === 401, "Contraseña incorrecta → 401");

    // Contraseña correcta → sesión.
    r = await api("POST", "/api/auth/login", { password: "secreto123" });
    assert(r.status === 200 && r.json.ok === true && !!cookie, "Contraseña correcta → inicia sesión y recibe cookie");

    r = await api("GET", "/api/auth/status");
    assert(r.status === 200 && r.json.authenticated === true, "Con la cookie, el estado dice autenticado");

    // Con sesión: ve el cuestionario de ejemplo sembrado.
    r = await api("GET", "/api/quizzes");
    assert(r.status === 200 && Array.isArray(r.json.quizzes) && r.json.quizzes.length >= 1,
      "Con sesión, GET /api/quizzes devuelve la biblioteca (incluye el ejemplo)");

    // Crear/actualizar un cuestionario.
    const quiz = { id: "q_test", title: "Mi prueba", questions: [{ text: "1+1?", answers: [{ text: "2", correct: true }, { text: "3", correct: false }] }] };
    r = await api("PUT", "/api/quizzes/q_test", quiz);
    assert(r.status === 200 && r.json.quiz && r.json.quiz.id === "q_test" && r.json.quiz.updatedAt > 0,
      "Con sesión, PUT guarda el cuestionario (y el servidor pone updatedAt)");

    r = await api("GET", "/api/quizzes");
    const found = (r.json.quizzes || []).some((q) => q.id === "q_test" && q.title === "Mi prueba");
    assert(found, "El cuestionario guardado aparece en la biblioteca");

    // Rechaza cuerpos no válidos.
    r = await api("PUT", "/api/quizzes/q_bad", { title: 123, questions: "no" });
    assert(r.status === 400, "PUT con datos no válidos → 400");

    // Borrar.
    r = await api("DELETE", "/api/quizzes/q_test");
    assert(r.status === 200, "Con sesión, DELETE borra el cuestionario");
    r = await api("GET", "/api/quizzes");
    assert(!(r.json.quizzes || []).some((q) => q.id === "q_test"), "Tras borrar, ya no está en la biblioteca");

    // Cerrar sesión: el navegador deja de enviar la cookie → sin acceso.
    r = await api("POST", "/api/auth/logout");
    assert(r.status === 200, "Cierre de sesión responde OK");
    cookie = ""; // el navegador ya no tiene la cookie
    r = await api("GET", "/api/quizzes");
    assert(r.status === 401, "Tras cerrar sesión, GET /api/quizzes vuelve a 401");

    console.log(failed ? "\n❌ HAY FALLOS EN AUTH/API\n" : "\n✅ TODAS LAS PRUEBAS DE ACCESO/API PASARON\n");
  } catch (e) {
    console.error(e);
    failed = true;
  } finally {
    server.close(() => {
      try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch (e) {}
      process.exit(failed ? 1 : 0);
    });
  }
}

if (server.listening) main();
else server.on("listening", main);

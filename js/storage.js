/* =========================================================
   storage.js — Cuestionarios guardados en el SERVIDOR
   Antes se usaba localStorage (cada navegador tenía los suyos y
   cualquiera podía editarlos). Ahora los cuestionarios viven en el
   servidor y solo se sirven/editan al profe autenticado.

   Para no reescribir toda la app, se mantiene una caché en memoria:
   · hydrate()  descarga del servidor (tras iniciar sesión).
   · getAll/get/isEmpty  leen de la caché (síncrono, como antes).
   · save/remove  actualizan la caché al instante y guardan en el
     servidor en segundo plano (avisando si algo falla).
   ========================================================= */
(function (window) {
  "use strict";

  var API = "/api/quizzes";
  var cache = [];
  var onError = null;

  function sortDesc(list) {
    return list.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  }

  function request(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 401) { var e = new Error("no-auth"); e.code = 401; throw e; }
      if (!res.ok) throw new Error("http-" + res.status);
      return res.status === 204 ? null : res.json();
    });
  }

  function handleWriteError(err) {
    var msg = (err && err.code === 401)
      ? "Tu sesión caducó. Vuelve a iniciar sesión."
      : "No se pudo guardar en el servidor. Revisa tu conexión.";
    if (window.UI && window.UI.toast) window.UI.toast(msg, "error");
    if (onError) onError(err);
  }

  function mergeIntoCache(quiz) {
    for (var i = 0; i < cache.length; i++) { if (cache[i].id === quiz.id) { cache[i] = quiz; return; } }
    cache.push(quiz);
  }

  var Storage = {
    /** Descarga (asíncrona) todos los cuestionarios del servidor a la caché. */
    hydrate: function () {
      return request("GET", API).then(function (data) {
        cache = (data && data.quizzes) || [];
        return cache;
      });
    },

    /** Vacía la caché en memoria (al cerrar sesión). */
    reset: function () { cache = []; },

    /** Se llama si una escritura al servidor falla (p. ej. sesión caducada). */
    setOnError: function (fn) { onError = fn; },

    getAll: function () { return sortDesc(cache); },

    get: function (id) {
      for (var i = 0; i < cache.length; i++) if (cache[i].id === id) return cache[i];
      return null;
    },

    save: function (quiz) {
      var now = Date.now();
      if (!quiz.id) quiz.id = Storage.generateId();
      if (!quiz.createdAt) quiz.createdAt = now;
      quiz.updatedAt = now;
      mergeIntoCache(quiz); // optimista: la interfaz ya lo refleja
      request("PUT", API + "/" + encodeURIComponent(quiz.id), quiz)
        .then(function (data) { if (data && data.quiz) mergeIntoCache(data.quiz); })
        .catch(handleWriteError);
      return quiz;
    },

    remove: function (id) {
      cache = cache.filter(function (q) { return q.id !== id; });
      request("DELETE", API + "/" + encodeURIComponent(id)).catch(handleWriteError);
    },

    isEmpty: function () { return cache.length === 0; },

    generateId: function () {
      return "q_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }
  };

  window.QuizStorage = Storage;
})(window);

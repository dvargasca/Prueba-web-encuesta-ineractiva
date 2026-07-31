/* =========================================================
   storage.js — Persistencia de cuestionarios
   Usa localStorage para que todo funcione sin servidor.
   ========================================================= */
(function (window) {
  "use strict";

  var KEY = "quizaula_quizzes_v1";

  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch (e) { return fallback; }
  }

  var Storage = {
    /** Devuelve todos los cuestionarios ordenados por fecha de actualización (más recientes primero). */
    getAll: function () {
      var list = safeParse(localStorage.getItem(KEY), []);
      if (!Array.isArray(list)) list = [];
      return list.sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
    },

    /** Devuelve un cuestionario por id, o null. */
    get: function (id) {
      var all = Storage.getAll();
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) return all[i];
      }
      return null;
    },

    /** Crea o actualiza un cuestionario y devuelve el objeto guardado. */
    save: function (quiz) {
      var all = Storage.getAll();
      var now = Date.now();
      if (!quiz.id) quiz.id = Storage.generateId();
      if (!quiz.createdAt) quiz.createdAt = now;
      quiz.updatedAt = now;

      var found = false;
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === quiz.id) { all[i] = quiz; found = true; break; }
      }
      if (!found) all.push(quiz);

      localStorage.setItem(KEY, JSON.stringify(all));
      return quiz;
    },

    /** Elimina un cuestionario por id. */
    remove: function (id) {
      var all = Storage.getAll().filter(function (q) { return q.id !== id; });
      localStorage.setItem(KEY, JSON.stringify(all));
    },

    /** Sustituye por completo la lista (usado al importar). */
    replaceAll: function (list) {
      localStorage.setItem(KEY, JSON.stringify(list || []));
    },

    /** Genera un identificador único razonablemente seguro. */
    generateId: function () {
      return "q_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    },

    /** Indica si el almacenamiento está vacío. */
    isEmpty: function () {
      return Storage.getAll().length === 0;
    }
  };

  window.QuizStorage = Storage;
})(window);

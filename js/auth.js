/* =========================================================
   auth.js — Cliente del inicio de sesión del profesor/a
   Habla con la API del servidor (/api/auth/*). Los estudiantes
   NO usan esto: ellos solo entran con el PIN.
   ========================================================= */
(function (window) {
  "use strict";

  function request(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  window.QuizAuth = {
    /** { authenticated, needsSetup }. Nunca falla: si no hay servidor, devuelve valores seguros. */
    status: function () {
      return request("GET", "/api/auth/status")
        .then(function (r) { return r.data || {}; })
        .catch(function () { return { authenticated: false, needsSetup: false, offline: true }; });
    },
    login: function (password) { return request("POST", "/api/auth/login", { password: password }); },
    setup: function (password) { return request("POST", "/api/auth/setup", { password: password }); },
    logout: function () { return request("POST", "/api/auth/logout").catch(function () { return {}; }); }
  };
})(window);

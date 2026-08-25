/* =========================================================
   reports.js — Reportes de partidas (respuestas de los estudiantes)
   El profe puede ver, por cada sesión de juego, qué respondió cada
   participante en cada pregunta, y descargarlo en CSV (se abre en Excel).
   Los reportes viven en el servidor y se borran solos tras una semana.
   ========================================================= */
(function (window, document) {
  "use strict";

  var UI = window.UI;
  var el = UI.el;
  var toast = UI.toast;

  var API = "/api/reports";

  /* ---------- Llamadas al servidor ---------- */
  function apiGet(url) {
    return fetch(url, { method: "GET", credentials: "same-origin" }).then(function (res) {
      if (res.status === 401) { var e = new Error("no-auth"); e.code = 401; throw e; }
      if (res.status === 404) { var e2 = new Error("not-found"); e2.code = 404; throw e2; }
      if (!res.ok) throw new Error("http-" + res.status);
      return res.json();
    });
  }
  function apiDelete(url) {
    return fetch(url, { method: "DELETE", credentials: "same-origin" }).then(function (res) {
      if (res.status === 401) { var e = new Error("no-auth"); e.code = 401; throw e; }
      if (!res.ok) throw new Error("http-" + res.status);
      return res.json();
    });
  }

  /* ---------- Utilidades ---------- */
  function fmtDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString("es", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return new Date(ts).toLocaleString(); }
  }
  function fmtDateShort(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) { return ""; }
  }
  function typeLabel(t) { return t === "tf" ? "Verdadero/Falso" : "Opción múltiple"; }
  function truncate(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function slug(s) {
    return String(s || "reporte").toLowerCase().replace(/[^\w\sáéíóúñ-]/gi, "").trim().replace(/\s+/g, "-") || "reporte";
  }

  /* ---------- CSV (una fila por participante y pregunta) ---------- */
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    // Comillas dobles alrededor y escapamos las comillas internas.
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function buildCsv(report) {
    var SEP = ";"; // Excel en español usa ; como separador de columnas
    var rows = [];
    var header = [
      "Cuestionario", "Sesión (PIN)", "Fecha", "Participante", "Puntuación total", "Aciertos",
      "N.º pregunta", "Pregunta", "Tipo", "Respuesta elegida", "¿Correcta?", "Puntos", "Tiempo (s)"
    ];
    rows.push(header.map(csvCell).join(SEP));

    var fecha = fmtDate(report.playedAt);
    var totalQ = report.questions.length;
    report.participants.forEach(function (p) {
      p.answers.forEach(function (ans) {
        var q = report.questions[ans.questionIndex] || report.questions.find(function (x) { return x.index === ans.questionIndex; }) || {};
        var correcta = !ans.answered ? "Sin respuesta" : (ans.correct ? "Sí" : "No");
        var tiempo = (typeof ans.timeMs === "number") ? (ans.timeMs / 1000).toFixed(1) : "";
        rows.push([
          report.quizTitle,
          report.pin,
          fecha,
          p.name,
          p.score,
          p.correctCount + "/" + totalQ,
          (ans.questionIndex + 1),
          q.text || "",
          typeLabel(q.type),
          ans.answered ? ans.answerText : "Sin respuesta",
          correcta,
          ans.points || 0,
          tiempo
        ].map(csvCell).join(SEP));
      });
    });
    // BOM UTF-8 para que Excel muestre bien las tildes.
    return "﻿" + rows.join("\r\n") + "\r\n";
  }
  function downloadReportCsv(report) {
    var name = "quizaula-respuestas-" + slug(report.quizTitle) + "-" + fmtDateShort(report.playedAt).replace(/\//g, "-") + ".csv";
    UI.download(name, buildCsv(report), "text/csv;charset=utf-8");
  }

  /** Descarga el CSV pidiendo el reporte por id (usado desde el podio del anfitrión). */
  function downloadCsvById(id) {
    return apiGet(API + "/" + encodeURIComponent(id)).then(function (data) {
      if (data && data.report) { downloadReportCsv(data.report); toast("Reporte descargado.", "success"); }
      else toast("No se encontró el reporte.", "error");
    }).catch(function (err) {
      toast(err && err.code === 404 ? "El reporte ya no está disponible." : "No se pudo descargar el reporte.", "error");
    });
  }

  /* ---------- Cabecera común ---------- */
  function topbar(onHome, rightExtra) {
    return el("div", { class: "topbar" }, [
      el("div", { class: "container topbar__inner" }, [
        el("button", { class: "brand", onClick: onHome }, [
          el("span", { class: "brand__logo", text: "Q" }),
          el("span", { text: "QuizAula" })
        ]),
        el("span", { class: "topbar__spacer" }),
        el("div", { class: "topbar__actions" }, [
          rightExtra || null,
          el("button", { class: "btn btn--sm", html: "← Inicio", onClick: onHome })
        ])
      ])
    ]);
  }

  /* ---------- Lista de reportes ---------- */
  function renderList(root, opts) {
    opts = opts || {};
    var onHome = opts.onExit || function () {};

    root.innerHTML = "";
    root.appendChild(el("div", { class: "home" }, [
      topbar(onHome),
      el("div", { class: "container report-page" }, [el("div", { class: "loading", text: "Cargando reportes…" })])
    ]));

    apiGet(API).then(function (data) {
      var reports = (data && data.reports) || [];
      var body;
      if (!reports.length) {
        body = el("div", { class: "empty" }, [
          el("div", { class: "empty__mark" }),
          el("h3", { text: "Aún no hay reportes" }),
          el("p", { text: "Cuando juegues una partida en vivo, aquí aparecerá el reporte con las respuestas de cada estudiante." })
        ]);
      } else {
        body = el("div", { class: "report-list" }, reports.map(function (r) { return reportRow(r, root, opts); }));
      }

      var head = el("div", { class: "report-page__head" }, [
        el("h2", { text: "Reportes de partidas" }),
        el("span", { class: "hint", text: "Se guardan 1 semana y luego se borran solos." })
      ]);

      root.innerHTML = "";
      root.appendChild(el("div", { class: "home" }, [
        topbar(onHome),
        el("div", { class: "container report-page" }, [head, body])
      ]));
    }).catch(function (err) {
      if (err && err.code === 401 && opts.onAuthError) { opts.onAuthError(); return; }
      root.innerHTML = "";
      root.appendChild(el("div", { class: "home" }, [
        topbar(onHome),
        el("div", { class: "container report-page" }, [
          el("div", { class: "empty" }, [
            el("h3", { text: "No se pudieron cargar los reportes" }),
            el("p", { text: "Revisa tu conexión e inténtalo de nuevo." })
          ])
        ])
      ]));
    });
  }

  function reportRow(r, root, opts) {
    var meta = el("div", { class: "report-row__meta" }, [
      el("h3", { class: "report-row__title", text: r.quizTitle }),
      el("p", { class: "report-row__sub", text:
        fmtDate(r.playedAt) + "  ·  PIN " + r.pin + "  ·  " +
        r.participants + (r.participants === 1 ? " participante" : " participantes") + "  ·  " +
        r.questions + (r.questions === 1 ? " pregunta" : " preguntas") })
    ]);

    var actions = el("div", { class: "report-row__actions" }, [
      el("button", { class: "btn btn--sm", text: "Ver", onClick: function () { renderDetail(root, r.id, opts); } }),
      el("button", { class: "btn btn--light btn--sm", text: "CSV / Excel", onClick: function () { downloadCsvById(r.id); } }),
      el("button", { class: "btn btn--ghost btn--sm", text: "Eliminar", onClick: function () {
        UI.confirm({ title: "¿Eliminar reporte?", message: "Se borrará el reporte de \"" + r.quizTitle + "\".", confirmText: "Eliminar", danger: true })
          .then(function (ok) {
            if (!ok) return;
            apiDelete(API + "/" + encodeURIComponent(r.id)).then(function () {
              toast("Reporte eliminado.");
              renderList(root, opts);
            }).catch(function () { toast("No se pudo eliminar.", "error"); });
          });
      } })
    ]);

    return el("div", { class: "report-row" }, [meta, actions]);
  }

  /* ---------- Detalle de un reporte (matriz participante × pregunta) ---------- */
  function renderDetail(root, id, opts) {
    opts = opts || {};
    var onHome = opts.onExit || function () {};
    var back = function () { renderList(root, opts); };

    root.innerHTML = "";
    root.appendChild(el("div", { class: "home" }, [
      topbar(onHome),
      el("div", { class: "container report-page" }, [el("div", { class: "loading", text: "Cargando reporte…" })])
    ]));

    apiGet(API + "/" + encodeURIComponent(id)).then(function (data) {
      var report = data && data.report;
      if (!report) { toast("Reporte no disponible.", "error"); back(); return; }
      root.innerHTML = "";
      root.appendChild(el("div", { class: "home" }, [
        topbar(onHome),
        el("div", { class: "container report-page" }, [detailContent(report, back)])
      ]));
    }).catch(function (err) {
      toast(err && err.code === 404 ? "El reporte ya no está disponible." : "No se pudo cargar el reporte.", "error");
      back();
    });
  }

  function detailContent(report, back) {
    var totalQ = report.questions.length;

    var head = el("div", { class: "report-detail__head" }, [
      el("div", {}, [
        el("h2", { text: report.quizTitle, style: "margin:0;" }),
        el("p", { class: "report-row__sub", style: "margin:0.2rem 0 0;", text:
          fmtDate(report.playedAt) + "  ·  PIN " + report.pin + "  ·  " +
          report.participants.length + " participantes  ·  " + totalQ + " preguntas" })
      ]),
      el("div", { class: "report-row__actions" }, [
        el("button", { class: "btn btn--ghost btn--sm", html: "← Reportes", onClick: back }),
        el("button", { class: "btn btn--light btn--sm", text: "Descargar CSV / Excel", onClick: function () { downloadReportCsv(report); } })
      ])
    ]);

    // Cabecera de la tabla: #, Participante, Puntos, Aciertos, P1..Pn
    var headCells = [
      el("th", { text: "#" }),
      el("th", { class: "report-th--name", text: "Participante" }),
      el("th", { text: "Puntos" }),
      el("th", { text: "Aciertos" })
    ];
    report.questions.forEach(function (q, i) {
      headCells.push(el("th", { class: "report-th--q", title: q.text || ("Pregunta " + (i + 1)), text: "P" + (i + 1) }));
    });
    var thead = el("thead", {}, [el("tr", {}, headCells)]);

    var rows = report.participants.map(function (p, i) {
      var cells = [
        el("td", { class: "report-td--rank", text: (i + 1) }),
        el("td", { class: "report-td--name", text: p.name }),
        el("td", { text: p.score }),
        el("td", { text: p.correctCount + "/" + totalQ })
      ];
      p.answers.forEach(function (ans) {
        var cls = "report-cell";
        var content;
        if (!ans.answered) {
          cls += " report-cell--none";
          content = "—";
        } else {
          cls += ans.correct ? " report-cell--ok" : " report-cell--no";
          content = (ans.correct ? "✓ " : "✗ ") + truncate(ans.answerText, 24);
        }
        cells.push(el("td", { class: cls, title: ans.answered ? ans.answerText : "Sin respuesta" }, [
          el("span", { class: "report-cell__txt", text: content })
        ]));
      });
      return el("tr", {}, cells);
    });
    var tbody = el("tbody", {}, rows);

    var table = el("div", { class: "report-table-wrap" }, [
      el("table", { class: "report-table" }, [thead, tbody])
    ]);

    // Leyenda de preguntas (para saber qué es P1, P2… y cuál era la correcta)
    var legend = el("ol", { class: "report-legend" }, report.questions.map(function (q, i) {
      var correct = (q.correctIndexes || []).map(function (ci) {
        return (q.answers[ci] && q.answers[ci].text) || "";
      }).filter(Boolean).join(", ");
      return el("li", {}, [
        el("span", { class: "report-legend__q", text: "P" + (i + 1) + ". " }),
        el("span", { text: q.text || "" }),
        correct ? el("span", { class: "report-legend__ok", text: "  · Correcta: " + correct }) : null
      ]);
    }));

    return el("div", { class: "report-detail" }, [
      head,
      table,
      el("h3", { style: "margin:1.4rem 0 0.4rem;", text: "Preguntas" }),
      legend
    ]);
  }

  window.QuizReports = {
    renderList: renderList,
    renderDetail: renderDetail,
    downloadCsvById: downloadCsvById
  };
})(window, document);

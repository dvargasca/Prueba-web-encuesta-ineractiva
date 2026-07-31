/* =========================================================
   samples.js — Cuestionario de ejemplo y fábricas de objetos
   ========================================================= */
(function (window) {
  "use strict";

  var COVERS = ["🎯", "🧠", "📚", "🔬", "🌍", "🎨", "🎵", "⚽", "🧪", "🚀", "💡", "🏛️"];

  /** Crea una respuesta en blanco. */
  function blankAnswer(text, correct) {
    return { text: text || "", correct: !!correct };
  }

  /** Crea una pregunta en blanco con 4 respuestas. */
  function blankQuestion() {
    return {
      id: "it_" + Math.random().toString(36).slice(2, 9),
      text: "",
      image: null,
      timeLimit: 20,
      points: 1000,
      answers: [blankAnswer("", true), blankAnswer("", false), blankAnswer("", false), blankAnswer("", false)]
    };
  }

  /** Crea un cuestionario en blanco con una pregunta. */
  function blankQuiz() {
    return {
      id: "",
      title: "",
      description: "",
      cover: COVERS[Math.floor(Math.random() * COVERS.length)],
      createdAt: 0,
      updatedAt: 0,
      questions: [blankQuestion()]
    };
  }

  /** Cuestionario de ejemplo para que la app no arranque vacía. */
  function sampleQuiz() {
    return {
      id: "",
      title: "Cultura general para clase",
      description: "Un ejemplo listo para jugar. Edítalo o crea el tuyo desde cero.",
      cover: "🧠",
      createdAt: 0,
      updatedAt: 0,
      questions: [
        {
          id: "s1",
          text: "¿Cuál es el planeta más grande del sistema solar?",
          image: null,
          timeLimit: 20,
          points: 1000,
          answers: [
            blankAnswer("Júpiter", true),
            blankAnswer("Saturno", false),
            blankAnswer("La Tierra", false),
            blankAnswer("Marte", false)
          ]
        },
        {
          id: "s2",
          text: "¿Quién escribió \"Don Quijote de la Mancha\"?",
          image: null,
          timeLimit: 20,
          points: 1000,
          answers: [
            blankAnswer("Miguel de Cervantes", true),
            blankAnswer("Federico García Lorca", false),
            blankAnswer("Gabriel García Márquez", false),
            blankAnswer("Pablo Neruda", false)
          ]
        },
        {
          id: "s3",
          text: "¿Cuánto es 7 × 8?",
          image: null,
          timeLimit: 15,
          points: 1000,
          answers: [
            blankAnswer("56", true),
            blankAnswer("54", false),
            blankAnswer("64", false),
            blankAnswer("49", false)
          ]
        },
        {
          id: "s4",
          text: "El agua está compuesta por hidrógeno y oxígeno.",
          image: null,
          timeLimit: 15,
          points: 1000,
          answers: [
            blankAnswer("Verdadero", true),
            blankAnswer("Falso", false)
          ]
        },
        {
          id: "s5",
          text: "¿En qué continente se encuentra Egipto?",
          image: null,
          timeLimit: 20,
          points: 1000,
          answers: [
            blankAnswer("África", true),
            blankAnswer("Asia", false),
            blankAnswer("Europa", false),
            blankAnswer("Oceanía", false)
          ]
        }
      ]
    };
  }

  window.QuizSamples = {
    COVERS: COVERS,
    blankAnswer: blankAnswer,
    blankQuestion: blankQuestion,
    blankQuiz: blankQuiz,
    sampleQuiz: sampleQuiz
  };
})(window);

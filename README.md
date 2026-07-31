# 🎯 QuizAula

Una aplicación web tipo **Kahoot** para crear y jugar **cuestionarios interactivos** con tus estudiantes. Funciona **100 % en el navegador**, sin servidor ni instalación: solo abre la página y empieza.

![Hecho con HTML, CSS y JavaScript](https://img.shields.io/badge/Hecho%20con-HTML%20·%20CSS%20·%20JS-6a1fc0)

## ✨ Características

- **Crear cuestionarios** con preguntas de opción múltiple (2 a 4 respuestas).
- **Imagen opcional** en cada pregunta.
- **Tiempo límite** y **puntos** configurables por pregunta.
- **Modo de juego** estilo Kahoot: botones de colores con las formas icónicas (▲ ◆ ● ■), temporizador con cuenta atrás y **puntuación por velocidad y acierto**.
- **Atajos de teclado** (teclas `1`–`4`) para responder rápido.
- **Pantalla de resultados** con puntuación, aciertos, fallos y precisión.
- **Biblioteca** de cuestionarios guardada en tu navegador (`localStorage`).
- **Importar / exportar** cuestionarios en formato JSON para compartirlos o hacer copias de seguridad.
- **Diseño responsivo**: se ve bien en un proyector, en el ordenador y en el móvil.
- Incluye un **cuestionario de ejemplo** para empezar a probar de inmediato.

## 🚀 Cómo usarlo

### Opción 1 — Abrir directamente
Descarga o clona el repositorio y abre el archivo **`index.html`** con tu navegador (doble clic). ¡Listo!

### Opción 2 — Publicarlo gratis en GitHub Pages
Para tener un enlace que puedas compartir con tus estudiantes:

1. Sube este proyecto a un repositorio de GitHub.
2. Entra en **Settings → Pages**.
3. En **Source**, elige la rama (por ejemplo `main`) y la carpeta `/root`.
4. Guarda. En un minuto tendrás una URL pública tipo
   `https://tu-usuario.github.io/tu-repositorio/`.

## 🧑‍🏫 Guía rápida para el aula

1. Pulsa **➕ Crear cuestionario**.
2. Escribe el título, y para cada pregunta:
   - el enunciado,
   - las respuestas (marca la casilla **Correcta** en la válida),
   - el tiempo y los puntos.
3. Guarda y vuelve al inicio.
4. Pulsa **▶ Jugar**, proyecta la pantalla y… ¡que empiece el concurso!

> 💡 **Idea:** exporta tus cuestionarios (botón ⬇) para reutilizarlos en otro ordenador
> o compartirlos con otros docentes. Ellos solo tienen que **Importar** el archivo JSON.

## 🗂️ Estructura del proyecto

```
.
├── index.html          # Punto de entrada
├── css/
│   └── styles.css      # Todos los estilos
└── js/
    ├── storage.js      # Guardado en localStorage
    ├── samples.js      # Cuestionario de ejemplo y plantillas
    ├── ui.js           # Utilidades de interfaz (toasts, modales, etc.)
    ├── editor.js       # Editor de cuestionarios
    ├── game.js         # Motor de juego
    └── app.js          # Vista de inicio y orquestación
```

## 🔒 Privacidad

Todos los cuestionarios se guardan **únicamente en tu navegador**. No se envía nada a
ningún servidor. Si borras los datos del navegador, se perderán los cuestionarios;
por eso conviene **exportarlos** de vez en cuando.

## 🛠️ Tecnología

HTML, CSS y JavaScript puro (sin dependencias ni frameworks). Compatible con los
navegadores modernos (Chrome, Firefox, Edge, Safari).

---

Hecho con 💜 para docentes.

# 🎯 QuizAula

Una aplicación web tipo **Kahoot** para crear y jugar **cuestionarios interactivos** con tus estudiantes. Tiene **dos modos**:

- **🎮 En vivo (multijugador):** proyectas la partida, muestras un **PIN** y tus estudiantes se unen **desde su celular** (sin crear cuenta) y compiten en tiempo real. *Tal cual Kahoot.*
- **▶ Solo:** juegas el cuestionario en un solo dispositivo, ideal para repaso individual.

El editor y la biblioteca funcionan sin servidor; el **modo en vivo** necesita ejecutar un pequeño servidor Node (incluido) o publicarlo gratis en internet.

![Hecho con Node.js, HTML, CSS y JavaScript](https://img.shields.io/badge/Hecho%20con-Node%20·%20HTML%20·%20CSS%20·%20JS-6a1fc0)

## ✨ Características

- **Crear cuestionarios** con preguntas de opción múltiple (2 a 4 respuestas), **imagen opcional**, y **tiempo** y **puntos** por pregunta.
- **Modo en vivo estilo Kahoot:** PIN de acceso, sala de espera con los apodos, botones de colores con las formas icónicas (▲ ◆ ● ■), temporizador sincronizado, **puntuación por velocidad y acierto**, gráfico de respuestas, **clasificación** entre preguntas y **podio final**.
- **Los estudiantes solo necesitan el navegador del móvil.** Sin apps, sin cuentas.
- **Atajos de teclado** (teclas `1`–`4`) en el modo solo.
- **Biblioteca** de cuestionarios guardada en tu navegador (`localStorage`) con **importar / exportar** en JSON.
- **Diseño responsivo**: proyector, escritorio y móvil.
- Incluye un **cuestionario de ejemplo** para empezar de inmediato.

## 🚀 Puesta en marcha

### A) Solo el editor y el modo Solo (sin instalar nada)
Abre **`index.html`** en tu navegador. Podrás crear cuestionarios y jugarlos en modo Solo.
*(El modo En vivo estará desactivado porque necesita el servidor.)*

### B) Modo En vivo en tu computadora
Necesitas [Node.js](https://nodejs.org) (versión 18 o superior).

```bash
npm install     # instala las dependencias (solo la primera vez)
npm start       # inicia el servidor
```

Abre **http://localhost:3000**. Para que tus estudiantes se unan desde sus móviles
en la **misma red WiFi**, comparte la dirección con la IP de tu computadora
(por ejemplo `http://192.168.1.20:3000`) y el PIN que aparece en pantalla.

> ⚠️ Algunas redes de colegio aíslan los dispositivos entre sí (*AP isolation*) y no
> permiten esta conexión local. Si te ocurre, usa la opción C (publicar en internet).

### C) Modo En vivo por internet (gratis, recomendado)
Así funcionará desde cualquier red y con datos móviles.

**Con Render (un clic):**
1. Sube este proyecto a un repositorio de GitHub.
2. En [Render](https://render.com): **New + → Blueprint** y elige tu repositorio.
   El archivo [`render.yaml`](render.yaml) lo configura automáticamente.
3. Cuando termine, tendrás una URL pública (p. ej. `https://quizaula.onrender.com`).
   Ábrela para alojar, y compártela con tus estudiantes para que se unan.

**Alternativas:** Railway, Fly.io, Glitch o cualquier hosting que ejecute Node.
Comando de build `npm install` y de arranque `npm start` (usan el puerto de `process.env.PORT`).

## 🧑‍🏫 Cómo dar una clase en vivo

1. En el inicio, pulsa **🎮 En vivo** en el cuestionario que quieras.
2. Se mostrará una pantalla con la **dirección** y el **PIN**. Proyéctala.
3. Cada estudiante entra en la dirección desde su móvil, escribe el **PIN** y un **apodo**.
4. Cuando estén todos, pulsa **Empezar**.
5. En cada pregunta, los móviles muestran los **botones de colores**; el marcador y la
   **clasificación** aparecen en tu pantalla. Pulsa **Siguiente** para avanzar.
6. Al final se muestra el **podio**. 🏆

## 🗂️ Estructura del proyecto

```
.
├── index.html          # Aplicación (editor, biblioteca, modo solo y en vivo)
├── server.js           # Servidor del modo EN VIVO (Node + Socket.IO)
├── package.json
├── render.yaml         # Configuración de despliegue en Render
├── css/
│   └── styles.css
├── js/
│   ├── storage.js      # Guardado en localStorage
│   ├── samples.js      # Cuestionario de ejemplo y plantillas
│   ├── ui.js           # Utilidades de interfaz
│   ├── live-common.js  # Utilidades del modo en vivo (cliente)
│   ├── editor.js       # Editor de cuestionarios
│   ├── game.js         # Motor del modo Solo
│   ├── host.js         # Vista del anfitrión (en vivo)
│   ├── player.js       # Vista del jugador/móvil (en vivo)
│   └── app.js          # Inicio y orquestación
└── test/
    └── live.test.js    # Prueba automática del modo en vivo
```

## 🔒 Privacidad y datos

- Tus **cuestionarios** se guardan **solo en tu navegador** (`localStorage`). No se suben a
  ningún sitio. Usa **Exportar** para hacer copias de seguridad o compartirlos.
- En el **modo en vivo**, el servidor guarda la partida **en memoria** únicamente mientras
  se juega (apodos y puntuaciones). Al terminar o cerrar, no queda nada almacenado.
- Los estudiantes **no crean cuentas** ni dan datos personales; solo eligen un apodo.

## 🧪 Pruebas

```bash
npm test        # simula una partida completa (anfitrión + 2 jugadores) y valida la lógica
```

## ⚠️ Notas del modo en vivo

- El **anfitrión** debe permanecer conectado durante la partida; si cierra la pestaña, la
  partida se cierra para todos.
- Si un estudiante **recarga** la página, sale de la partida (puede volver a unirse con el PIN
  si el juego sigue en la sala de espera).
- Pensado para el aula (hasta ~80 jugadores por partida).

## 🛠️ Tecnología

- **Frontend:** HTML, CSS y JavaScript puro (sin frameworks).
- **Backend (modo en vivo):** Node.js + Express + Socket.IO (WebSockets).

---

Hecho con 💜 para docentes.

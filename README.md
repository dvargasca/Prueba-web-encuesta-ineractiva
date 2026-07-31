# 🎯 QuizAula

Una aplicación web tipo **Kahoot** para crear y jugar **cuestionarios interactivos** con tus estudiantes. Tiene **dos modos**:

- **🎮 En vivo (multijugador):** proyectas la partida, muestras un **PIN** y tus estudiantes se unen **desde su celular** (sin crear cuenta) y compiten en tiempo real. *Tal cual Kahoot.*
- **▶ Solo:** juegas el cuestionario en un solo dispositivo, ideal para repaso individual.

El editor y la biblioteca funcionan sin servidor; el **modo en vivo** necesita ejecutar un pequeño servidor Node (incluido) o publicarlo gratis en internet.

![Hecho con Node.js, HTML, CSS y JavaScript](https://img.shields.io/badge/Hecho%20con-Node%20·%20HTML%20·%20CSS%20·%20JS-6a1fc0)

## ✨ Características

- **Crear cuestionarios** con preguntas de **opción múltiple** (2 a 4 respuestas) o **verdadero/falso** (con estilo propio ✓/✗), **imagen opcional**, y **tiempo** y **puntos** por pregunta.
- **Modo en vivo estilo Kahoot:** PIN de acceso, sala de espera con los apodos, botones de colores con las formas icónicas (▲ ◆ ● ■), temporizador sincronizado, **puntuación por velocidad y acierto**, **bonus por racha** (aciertos encadenados), gráfico de respuestas, **clasificación** entre preguntas y **podio final**.
- **Reconexión automática:** si a un estudiante se le cae el internet o **recarga la página**, vuelve a su sitio **sin perder la puntuación**.
- **Los estudiantes solo necesitan el navegador del móvil.** Sin apps, sin cuentas.
- **Atajos de teclado** (teclas `1`–`4`) en el modo solo.
- **Biblioteca** de cuestionarios guardada en tu navegador (`localStorage`) con **importar / exportar** en JSON.
- **Diseño responsivo**: proyector, escritorio y móvil.
- Incluye un **cuestionario de ejemplo** para empezar de inmediato.

### 🔥 ¿Cómo funciona el bonus por racha?
Cada acierto **consecutivo** suma un extra: **+100** al 2.º acierto seguido, **+200** al 3.º… hasta **+500**. Fallar reinicia la racha. Así se premia mantener el ritmo, igual que en Kahoot.

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

### C) Modo En vivo por internet (recomendado)
Así funcionará desde cualquier red y con datos móviles. El repo ya trae la
configuración lista para **Railway** y para **Render**.

#### 🚂 Railway (paso a paso)
[Railway](https://railway.app) ejecuta Node y **soporta WebSockets** (necesarios para
el juego en tiempo real). Con la configuración incluida ([`railway.json`](railway.json))
no hay que tocar nada.

1. **Sube el proyecto a GitHub** (si aún no lo está).
2. Entra en Railway → **New Project → Deploy from GitHub repo** y elige este repositorio.
   (La primera vez, autoriza a Railway a acceder a tu GitHub.)
3. Railway detecta Node automáticamente, ejecuta `npm install` y arranca con `npm start`.
   **No necesitas configurar variables de entorno** — el puerto lo inyecta Railway y el
   servidor ya lo usa (`process.env.PORT`).
4. Cuando el deploy esté en verde, ve a **Settings → Networking → Generate Domain**
   para obtener una URL pública, por ejemplo `https://quizaula-production.up.railway.app`.
5. Abre esa URL para **alojar** la partida y compártela con tus estudiantes (o solo el
   PIN, ya que la dirección aparece en la pantalla del anfitrión). 🎉

> 💡 **Actualizaciones:** cada vez que hagas `git push`, Railway vuelve a desplegar solo.
> **Coste:** el plan de prueba/Hobby suele bastar para un aula; revisa los límites vigentes
> en su web.

#### 🟪 Render (alternativa de un clic)
1. Sube el proyecto a GitHub.
2. En [Render](https://render.com): **New + → Blueprint** y elige tu repositorio.
   El archivo [`render.yaml`](render.yaml) lo configura automáticamente.
3. Tendrás una URL pública (p. ej. `https://quizaula.onrender.com`).

> ℹ️ En el plan gratuito de Render el servicio “se duerme” tras un rato de inactividad;
> la primera visita tras la siesta tarda unos segundos en despertar.

**Otras alternativas:** Fly.io, Glitch, Cyclic o cualquier hosting que ejecute Node
(build `npm install`, arranque `npm start`).

### D) En tu propio servidor (VPS)
Si tienes un servidor (por ejemplo un VPS con Ubuntu):

```bash
# 1) Instala Node.js 18+ y clona el proyecto
git clone <tu-repo>.git && cd quizaula
npm install

# 2) Ejecútalo de forma permanente con pm2
npm install -g pm2
PORT=3000 pm2 start server.js --name quizaula
pm2 save
```

Para servirlo con un dominio y HTTPS, pon **nginx** como proxy inverso. Socket.IO usa
WebSockets, así que **hay que reenviar las cabeceras de *upgrade***:

```nginx
server {
    server_name quiz.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # imprescindible para WebSockets
        proxy_set_header Connection "upgrade";        # imprescindible para WebSockets
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Luego añade el certificado con [Certbot](https://certbot.eff.org/) (`certbot --nginx`).

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
├── server.js           # Servidor del modo EN VIVO (Node + Socket.IO + reconexión)
├── package.json
├── railway.json        # Configuración de despliegue en Railway
├── render.yaml         # Configuración de despliegue en Render
├── Procfile            # Comando de arranque (Railway/Heroku y similares)
├── css/
│   └── styles.css
├── js/
│   ├── storage.js      # Guardado en localStorage
│   ├── samples.js      # Cuestionario de ejemplo y plantillas
│   ├── ui.js           # Utilidades de interfaz (incluye verdadero/falso)
│   ├── live-common.js  # Utilidades del modo en vivo (cliente)
│   ├── editor.js       # Editor de cuestionarios (opción múltiple y V/F)
│   ├── game.js         # Motor del modo Solo (con bonus por racha)
│   ├── host.js         # Vista del anfitrión (en vivo)
│   ├── player.js       # Vista del jugador/móvil (en vivo + reconexión)
│   └── app.js          # Inicio, orquestación y reanudación de sesión
└── test/
    ├── live.test.js       # Partida completa (anfitrión + 2 jugadores)
    └── reconnect.test.js  # Reconexión de un jugador a mitad de partida
```

## 🔒 Privacidad y datos

- Tus **cuestionarios** se guardan **solo en tu navegador** (`localStorage`). No se suben a
  ningún sitio. Usa **Exportar** para hacer copias de seguridad o compartirlos.
- En el **modo en vivo**, el servidor guarda la partida **en memoria** únicamente mientras
  se juega (apodos y puntuaciones). Al terminar o cerrar, no queda nada almacenado.
- Los estudiantes **no crean cuentas** ni dan datos personales; solo eligen un apodo.

## 🧪 Pruebas

```bash
npm test        # partida completa (anfitrión + 2 jugadores) + prueba de reconexión
```

## ⚠️ Notas del modo en vivo

- Si a un estudiante se le **cae el internet** o **recarga** la página, se reconecta
  automáticamente y **conserva su puntuación** (mientras la partida siga abierta).
- El **anfitrión** debe permanecer conectado durante la partida; si cierra la pestaña, la
  partida se cierra para todos. *(La reconexión automática es para los estudiantes.)*
- La partida vive **en memoria** en el servidor: pensada para jugarse de principio a fin
  en una sesión. No se guarda un histórico.
- Pensado para el aula (hasta ~80 jugadores por partida).

## 🛠️ Tecnología

- **Frontend:** HTML, CSS y JavaScript puro (sin frameworks).
- **Backend (modo en vivo):** Node.js + Express + Socket.IO (WebSockets).

---

Hecho con 💜 para docentes.

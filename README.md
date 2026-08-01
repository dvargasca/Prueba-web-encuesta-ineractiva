# 🎯 QuizAula

Una aplicación web tipo **Kahoot** para crear y jugar **cuestionarios interactivos** con tus estudiantes. Tiene **dos modos**:

- **🎮 En vivo (multijugador):** proyectas la partida, muestras un **PIN** y tus estudiantes se unen **desde su celular** (sin crear cuenta) y compiten en tiempo real. *Tal cual Kahoot.*
- **▶ Solo:** juegas el cuestionario en un solo dispositivo, ideal para repaso individual.

Todo se ejecuta con un pequeño **servidor Node** (incluido): guarda tus cuestionarios y protege
tu biblioteca con una **contraseña de profesor/a**, de modo que los estudiantes solo pueden
**entrar con el PIN y jugar** (no ven ni editan tus cuestionarios). Puedes ejecutarlo en tu
computadora o publicarlo gratis en internet.

![Hecho con Node.js, HTML, CSS y JavaScript](https://img.shields.io/badge/Hecho%20con-Node%20·%20HTML%20·%20CSS%20·%20JS-6a1fc0)

## ✨ Características

- **Crear cuestionarios** con preguntas de **opción múltiple** (2 a 4 respuestas) o **verdadero/falso** (con estilo propio ✓/✗), **imagen opcional**, y **tiempo** y **puntos** por pregunta.
- **Modo en vivo estilo Kahoot:** PIN de acceso, sala de espera con los apodos, botones de colores con las formas icónicas (▲ ◆ ● ■), temporizador sincronizado, **puntuación por velocidad y acierto**, **bonus por racha** (aciertos encadenados), gráfico de respuestas, **clasificación** entre preguntas y **podio final**.
- **Reconexión automática:** si a un estudiante se le cae el internet o **recarga la página**, vuelve a su sitio **sin perder la puntuación**.
- **Acceso separado y protegido:** al abrir la dirección del juego, tus estudiantes **solo ven
  la pantalla para poner el PIN y jugar**. Tu biblioteca y el editor quedan detrás de una
  **contraseña de profesor/a** (aplicada en el servidor): los estudiantes **no pueden verlos ni
  editarlos**.
- **Los estudiantes solo necesitan el navegador del móvil.** Sin apps, sin cuentas.
- **Atajos de teclado** (teclas `1`–`4`) en el modo solo.
- **Biblioteca guardada en el servidor** (ligada a tu contraseña), así la editas **desde cualquier
  dispositivo**, con **importar / exportar** en JSON.
- **Diseño responsivo**: proyector, escritorio y móvil.
- Incluye un **cuestionario de ejemplo** para empezar de inmediato.

### 🔥 ¿Cómo funciona el bonus por racha?
Cada acierto **consecutivo** suma un extra: **+100** al 2.º acierto seguido, **+200** al 3.º… hasta **+500**. Fallar reinicia la racha. Así se premia mantener el ritmo, igual que en Kahoot.

## 🚀 Puesta en marcha

> ### 📢 Importante: la app necesita el servidor Node
> Como los cuestionarios se guardan en el servidor y la biblioteca está protegida con
> contraseña, **GitHub Pages (solo estático) ya no es suficiente**: no puede ejecutar el
> servidor ni guardar tus cuestionarios. Ejecuta la app en tu computadora (opción A) o
> publícala gratis en **Railway/Render** (opción B) y usa **esa URL para todo** (sirve la
> web, guarda los cuestionarios y ejecuta el modo en vivo).

### A) En tu computadora (todo incluido)
Necesitas [Node.js](https://nodejs.org) (versión 18 o superior).

```bash
npm install     # instala las dependencias (solo la primera vez)
npm start       # inicia el servidor
```

Abre **http://localhost:3000**. La primera vez, entra como profesor/a (enlace
**«¿Eres el profesor/a?»** o añade `#profesor` a la URL) y **crea tu contraseña**. A partir
de ahí verás tu biblioteca. Para que tus estudiantes se unan desde sus móviles en la **misma
red WiFi**, comparte la dirección con la IP de tu computadora (por ejemplo
`http://192.168.1.20:3000`) y el PIN que aparece en pantalla.

> ⚠️ Algunas redes de colegio aíslan los dispositivos entre sí (*AP isolation*) y no
> permiten esta conexión local. Si te ocurre, usa la opción B (publicar en internet).

### B) Por internet (recomendado)
Así funcionará desde cualquier red y con datos móviles, y tus cuestionarios quedan guardados
en línea. El repo ya trae la configuración lista para **Railway** y para **Render**.

#### 🚂 Railway (paso a paso)
[Railway](https://railway.app) ejecuta Node y **soporta WebSockets** (necesarios para
el juego en tiempo real). Con la configuración incluida ([`railway.json`](railway.json))
no hay que tocar nada.

1. **Sube el proyecto a GitHub** (si aún no lo está).
2. Entra en Railway → **New Project → Deploy from GitHub repo** y elige este repositorio.
   (La primera vez, autoriza a Railway a acceder a tu GitHub.)
3. Railway detecta Node automáticamente, ejecuta `npm install` y arranca con `npm start`.
   El puerto lo inyecta Railway y el servidor ya lo usa (`process.env.PORT`).
4. **Pon tu contraseña de profesor/a:** en **Variables**, añade `TEACHER_PASSWORD` con la
   contraseña que quieras. (Si lo omites, podrás crearla la primera vez desde la propia app;
   pero configúrala cuanto antes para que nadie más se adelante.)
5. **Para que tus cuestionarios no se borren en cada despliegue**, añade un **Volume**:
   **Settings → Volumes → Add Volume** y móntalo en la ruta **`/app/data`** (ahí guarda el
   servidor por defecto; si usas otra ruta, ponla también en la variable `DATA_DIR`).
6. Cuando el deploy esté en verde, ve a **Settings → Networking → Generate Domain**
   para obtener una URL pública, por ejemplo `https://quizaula-production.up.railway.app`.
7. Abre esa URL, **entra como profesor/a** y crea tus cuestionarios. Comparte con tus
   estudiantes **solo esa URL y el PIN**: ellos verán únicamente la pantalla para entrar. 🎉

> 💡 **Actualizaciones:** cada vez que hagas `git push`, Railway vuelve a desplegar solo.
> **Coste:** el plan de prueba/Hobby suele bastar para un aula; revisa los límites vigentes
> en su web.

#### 🟪 Render (alternativa de un clic)
1. Sube el proyecto a GitHub.
2. En [Render](https://render.com): **New + → Blueprint** y elige tu repositorio.
   El archivo [`render.yaml`](render.yaml) lo configura automáticamente.
3. En el servicio, añade la variable **`TEACHER_PASSWORD`** (tu contraseña) y, para que los
   cuestionarios persistan, un **Disk** montado en **`/app/data`**.
4. Tendrás una URL pública (p. ej. `https://quizaula.onrender.com`).

> ℹ️ En el plan gratuito de Render el servicio “se duerme” tras un rato de inactividad;
> la primera visita tras la siesta tarda unos segundos en despertar.

**Otras alternativas:** Fly.io, Glitch, Cyclic o cualquier hosting que ejecute Node
(build `npm install`, arranque `npm start`).

### C) En tu propio servidor (VPS)
Si tienes un servidor (por ejemplo un VPS con Ubuntu):

```bash
# 1) Instala Node.js 18+ y clona el proyecto
git clone <tu-repo>.git && cd quizaula
npm install

# 2) Ejecútalo de forma permanente con pm2
npm install -g pm2
PORT=3000 TEACHER_PASSWORD="tu-clave" DATA_DIR="/var/lib/quizaula" pm2 start server.js --name quizaula
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

## 🔑 Variables de entorno

| Variable | Para qué sirve |
| --- | --- |
| `TEACHER_PASSWORD` | Contraseña de profesor/a. Recomendado fijarla aquí; si no, la creas la primera vez desde la app. |
| `DATA_DIR` | Carpeta donde se guardan los cuestionarios y la configuración (por defecto `./data`). Monta ahí un volumen para que **persistan**. |
| `SESSION_SECRET` | *(Opcional)* Clave para firmar las sesiones. Si no la pones, se genera y se guarda en `DATA_DIR`. |
| `PORT` | Puerto del servidor (Railway/Render lo inyectan solos). |
| `CORS_ORIGIN` | *(Opcional)* Restringe qué orígenes pueden conectarse al modo en vivo. Por defecto `*`. |

## 🧑‍🏫 Cómo dar una clase en vivo

1. Entra como **profesor/a** con tu contraseña (enlace **«¿Eres el profesor/a?»** o `#profesor`).
2. En tu biblioteca, pulsa **🎮 En vivo** en el cuestionario que quieras.
3. Se mostrará una pantalla con la **dirección** y el **PIN**. Proyéctala.
4. Cada estudiante entra en la dirección desde su móvil, escribe el **PIN** y un **apodo**.
5. Cuando estén todos, pulsa **Empezar**.
6. En cada pregunta, los móviles muestran los **botones de colores**; el marcador y la
   **clasificación** aparecen en tu pantalla. Pulsa **Siguiente** para avanzar.
7. Al final se muestra el **podio**. 🏆

## 👀 Qué ve cada quién (estudiante vs. profesor/a)

La app tiene **dos accesos** para que tus estudiantes nunca vean ni editen tus cuestionarios:

- **Vista de estudiante (por defecto):** es lo que aparece al abrir la dirección del juego.
  Solo tiene el campo para **escribir el PIN** y unirse. Sin biblioteca, sin editor. Es la
  pantalla que usan tus estudiantes desde el móvil.
- **Zona de profesor/a (`#profesor`):** pide tu **contraseña** y, tras entrar, muestra tu
  biblioteca completa (crear, editar, importar/exportar, jugar en vivo o en solo). Entras
  pulsando **«¿Eres el profesor/a?»** en la pantalla de estudiante, o abriendo la dirección
  con `#profesor` al final (p. ej. `https://tu-app.up.railway.app/#profesor`). La primera vez
  te pedirá **crear** tu contraseña (si no la fijaste con `TEACHER_PASSWORD`).

Tu sesión queda guardada en el navegador (una cookie), así que no escribes la contraseña cada
vez. En un ordenador **compartido**, pulsa **«👋 Salir»** (arriba a la derecha) para cerrar la sesión.

> 🔒 **La protección la aplica el servidor, no el navegador.** Los cuestionarios se guardan en
> el servidor y solo se entregan/editan a quien haya iniciado sesión. Aunque un estudiante
> escriba `#profesor` o intente llamar a la API, sin la contraseña **no ve ni cambia nada**.

## 🗂️ Estructura del proyecto

```
.
├── index.html          # Aplicación (acceso, editor, biblioteca, modo solo y en vivo)
├── server.js           # Servidor: login del profe, API de cuestionarios y modo EN VIVO (Socket.IO)
├── store.js            # Guardado de los cuestionarios y la config de acceso (JSON en disco)
├── package.json
├── railway.json        # Configuración de despliegue en Railway
├── render.yaml         # Configuración de despliegue en Render
├── Procfile            # Comando de arranque (Railway/Heroku y similares)
├── data/               # (Se crea solo) Cuestionarios y config — móntalo como volumen
├── css/
│   └── styles.css
├── js/
│   ├── storage.js      # Cliente de los cuestionarios guardados en el servidor
│   ├── auth.js         # Cliente del inicio de sesión del profe
│   ├── samples.js      # Cuestionario de ejemplo y plantillas
│   ├── ui.js           # Utilidades de interfaz (incluye verdadero/falso)
│   ├── live-common.js  # Modo en vivo: conexión y URL del servidor (cliente)
│   ├── vendor/
│   │   └── socket.io.min.js  # Cliente de Socket.IO (empaquetado)
│   ├── editor.js       # Editor de cuestionarios (opción múltiple y V/F)
│   ├── game.js         # Motor del modo Solo (con bonus por racha)
│   ├── host.js         # Vista del anfitrión (en vivo)
│   ├── player.js       # Vista del jugador/móvil (en vivo + reconexión)
│   └── app.js          # Inicio, acceso, orquestación y reanudación de sesión
└── test/
    ├── live.test.js       # Partida completa (anfitrión + 2 jugadores)
    ├── reconnect.test.js  # Reconexión de un jugador a mitad de partida
    └── auth.test.js       # Login y API: solo el profe puede ver/editar cuestionarios
```

## 🔒 Privacidad y datos

- Tus **cuestionarios** se guardan **en el servidor** (en `DATA_DIR`), ligados a tu contraseña.
  Solo se sirven/editan a quien haya iniciado sesión. Usa **Exportar** para copias de seguridad.
- La **contraseña** se guarda **hasheada** (scrypt), nunca en texto plano.
- En el **modo en vivo**, la partida vive **en memoria** únicamente mientras se juega (apodos y
  puntuaciones). Al terminar o cerrar, no queda nada almacenado.
- Los estudiantes **no crean cuentas** ni dan datos personales; solo eligen un apodo.

## 🧪 Pruebas

```bash
npm test        # partida en vivo + reconexión + acceso/API (login y permisos)
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

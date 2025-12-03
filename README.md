# Chat Global

Pequeña aplicación de chat en tiempo real usando Node.js, Express y Socket.IO.

Instalación y uso rápido (PowerShell):

```powershell
Set-Location -Path 'C:\Users\IK\Desktop\ChatArchivos'
npm install
npm start
```

Abrir en el navegador: `http://localhost:3000`

Archivos clave:
- `server.js` — servidor Node.js
- `public/` — frontend (index.html, chat.js, admin.html)
- `run-server.ps1`, `run-server.bat` — scripts para iniciar localmente

Despliegue:
- Construir una imagen Docker o usar servicios como Render/Heroku.
- Para GitHub Pages puedes publicar la carpeta `public/` en `gh-pages`.

Contribuir:
- Abrir un issue o enviar un pull request.

Licencia: MIT
# Chat Global

Pequeña app de chat en tiempo real usando Node.js, Express y Socket.IO.

Requisitos:
- Node.js (v14+)

Instalar dependencias y ejecutar (PowerShell):

```powershell
cd c:\Users\IK\Downloads\aaaaaa
npm install
npm start
```

Abrir en el navegador: `http://localhost:3000`

Notas:
- Para desarrollo con recarga automática usar `npm run dev` (requiere `nodemon`).

Funciones añadidas en esta versión:
- Salas (crear/entrar): selecciona o crea una sala y únete.
- Envío de imágenes: adjunta imágenes (se envían en base64 para prototipo).
- Emojis: botón para añadir emoji rápido.
- Moderación: filtro básico de palabras prohibidas en servidor (configurable en `server.js`).
- Reportes: puedes reportar mensajes (se envía al servidor para revisión).
- Notificaciones: la app puede usar la API de notificaciones del navegador para avisos (se solicitará permiso).

Despliegue (sugerencias rápidas):

- Render (Docker / Node): sube el repo y usa `npm start`. Asegúrate de configurar la variable `PORT` si el servicio la requiere.
- Heroku (heroku CLI):
	1) `heroku create`
	2) `git push heroku main`
	3) Heroku detectará Node.js y ejecutará `npm start`.
- Fly.io / otros: crear una imagen Docker o usar la integración de Node. Asegúrate de exponer el puerto desde `process.env.PORT`.

Advertencias y mejoras para producción:
- Envío de imágenes en base64 no es eficiente; para producción use almacenamiento (S3) y envíe URLs.
- El filtrado de palabras es muy básico; para producción use una solución de moderación más robusta o servicios externos.

Ejecutar con Docker (alternativa si no quieres instalar Node localmente):

1) Construir y levantar con Docker Compose:

```powershell
cd C:\Users\IK\Downloads\aaaaaa
docker compose up --build
```

2) La app quedará disponible en `http://localhost:3000`.

Nota: necesitas Docker Desktop (Windows) o Docker Engine instalado.

Script rápido en PowerShell (si tienes Node/npm instalado):

```powershell
# Ejecutar desde la carpeta del proyecto
.\run-server.ps1
```


# chatgeneral2.0
# chatgeneral2.0

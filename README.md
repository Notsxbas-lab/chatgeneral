# chatgeneral

Chat en tiempo real con panel administrativo completo.

## Arranque rápido (Node portátil)

1. Ejecuta `chatgeneral/run-server-portable.bat`.
2. Abre `http://localhost:3000`.

Admin: contraseña `linda1102`.

## Arranque rápido (Node instalado)

```bat
cd chatgeneral
npm install
npm start
```

## Docker

```bat
cd chatgeneral
docker compose up --build
```

---

## ✨ Características Principales

### 🎭 Sistema de Usuarios
- Creación de perfil con nombre de usuario y emoji personalizado
- Selección de color de avatar
- Selección de color de fondo de chat
- Imagen de perfil personalizada
- **Persistencia de perfil**: Los datos se guardan y restauran al recargar

### 💬 Salas de Chat
- **Sala Global** por defecto
- **Sala "Ayudas"** (solo lectura para administradores)
- **Sala "Reglas"** (editable desde panel admin)
- Creación de salas personalizadas
- **Salas protegidas con contraseña**
- Los nombres de las salas se guardan al cerrar sesión

### 🔐 Panel Administrativo Completo

#### Autenticación Admin
- Login seguro con usuario y contraseña
- Múltiples niveles de administradores (Dueño, Admin, Mod, Mod Junior)
- Gestión de contraseñas de administradores
- **Persistencia de sesión**: El panel admin se mantiene abierto al hacer F5

#### Gestión de Usuarios
- Ver usuarios conectados en tiempo real
- Buscar usuarios por nombre
- Cambiar nombre de usuario
- Promover usuarios a administradores
- Expulsar usuarios (kick)
- Banear IPs
- Desbanear IPs

#### Gestión de Salas
- Ver todas las salas activas
- Crear nuevas salas
- Proteger salas con contraseña
- Salas especiales (adminOnly, isRules)

#### Reglas del Chat
- Editor de reglas en sección dedicada
- Las reglas se guardan automáticamente
- Las reglas se muestran a todos los usuarios en un anuncio
- **Persistencia**: Las reglas se guardan en servidor incluso después de reiniciar

#### Filtro de Palabras
- Agregar palabras prohibidas
- Eliminar palabras filtradas
- Los mensajes con palabras filtradas se bloquean
- Persistencia del filtro

#### Control del Chat
- Iniciar/Pausar chat
- Ver estado del chat en tiempo real

#### Estadísticas
- Usuarios conectados
- IPs baneadas
- Salas activas
- Gráficos de actividad
- Monitoreo en vivo de mensajes

#### Historial
- Ver historial de últimos mensajes
- Ver mensajes reportados
- Silenciar usuarios temporalmente

#### Base de Datos Personal
- **Crear registros** con clave y valor
- **Categorías**: General, Notas, Configuración, Usuarios, Otros
- **Ver tabla completa** con todos los registros
- **Editar registros** existentes
- **Eliminar registros**
- **Auto-logs automáticos** de todas las acciones de administración
- Los registros se guardan permanentemente en el servidor

### 📊 Auto-Logging en Base de Datos
Se registran automáticamente:
- ✅ Cambios de reglas
- ✅ Registración de nuevos administradores
- ✅ Cambios de contraseña admin
- ✅ Palabras filtradas agregadas/eliminadas
- ✅ Usuarios expulsados
- ✅ IPs baneadas
- ✅ Inicio/pausa del chat
- ✅ Cambios de nombre de usuario
- ✅ Promoción de usuarios
- ✅ Anuncios enviados

### 🎨 Interfaz de Usuario
- Diseño moderno y responsivo
- Tema claro/oscuro
- Chat fullscreen (sin bordes redondeados ni padding innecesario)
- Sidebar desplegable en panel admin
- Notificaciones toast para acciones
- Animaciones suaves

### 💾 Persistencia de Datos

#### 🗄️ Base de Datos MongoDB Atlas
El proyecto utiliza **MongoDB Atlas** como base de datos en la nube para garantizar que toda la información se guarde permanentemente, incluso después de reiniciar el servidor.

**Datos que se guardan en MongoDB:**
- ✅ Reglas del chat
- ✅ Administradores y sus contraseñas
- ✅ IPs baneadas
- ✅ Salas y contraseñas de salas
- ✅ Palabras filtradas
- ✅ Registros de la base de datos personal

**Configuración:**
1. Crear cuenta en [MongoDB Atlas](https://cloud.mongodb.com)
2. Crear un cluster gratuito (M0)
3. Configurar acceso de red (permitir `0.0.0.0/0`)
4. Crear usuario de base de datos
5. Agregar variable de entorno en el servidor:
   ```
   MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/chatgeneral
   ```

#### 📁 Almacenamiento Local (Fallback)
Si MongoDB no está disponible, el sistema usa archivos locales como respaldo:
- **Cliente (chat.js)**: Perfil, sala actual, contraseñas de salas, colores
- **Servidor (chat-data.json)**: Reglas, salas, contraseñas, IPs baneadas, palabras filtradas
- **Servidor (user-database.json)**: Base de datos personal de administración

---

## 🔧 Estructura del Proyecto

```
chatgeneral/
├── public/
│   ├── index.html          # Chat principal (fullscreen)
│   ├── chat.js             # Lógica del chat con persistencia
│   ├── admin.html          # Panel administrativo
│   ├── admin.js            # Lógica del panel admin
│   └── style.css           # Estilos (incluidos en HTML)
├── server.js               # Servidor Socket.io y Express
├── chat-data.json          # Datos persistentes del chat
├── user-database.json      # Base de datos de administración
├── package.json
├── Dockerfile
└── docker-compose.yml
```

---

## 🚀 Guía de Uso

### Para Usuarios Normales
1. Abre `http://localhost:3000`
2. Ingresa tu nombre de usuario
3. Selecciona tu color de avatar y fondo
4. Únete a una sala o crea una nueva
5. Envía mensajes

### Para Administradores
1. Abre `http://localhost:3000/admin`
2. Usa usuario: `Dueno` y contraseña: `linda1102`
3. Accede al panel con el sidebar desplegable:
   - 📊 **Estadísticas**: Ver usuarios, IPs baneadas, salas
   - 👑 **Administradores**: Registrar y gestionar admins
   - 👥 **Usuarios**: Gestionar usuarios conectados
   - 🚫 **Bloqueos**: Banear IPs
   - 📜 **Reglas**: Editar reglas del chat
   - 🚫 **Filtro**: Agregar palabras prohibidas
   - 📣 **Anuncios**: Enviar anuncios globales
   - 📈 **Análisis**: Ver gráficos y estadísticas
   - 💾 **Base de Datos**: Gestionar registros personales

---

## 📝 Actualización v2.0

### Cambios Principales
- ✅ Removidas características de gamificación (niveles, XP, ranking, polls, juegos)
- ✅ Chat fullscreen sin bordes ni padding innecesario
- ✅ Persistencia completa de datos en cliente y servidor
- ✅ Salas especiales: "ayudas" (admin-only) y "reglas" (editable)
- ✅ Salas con contraseña
- ✅ Base de datos personal de administración
- ✅ Auto-logging de todas las acciones admin

---

## 🔒 Seguridad
- Autenticación de administradores
- Control de permisos por rol
- Filtrado de palabras prohibidas
- Baneo de IPs
- Silenciado de usuarios
- Validación de entrada en servidor

---

## 📦 Dependencias
- **Node.js**: Servidor
- **Express**: Framework web
- **Socket.io**: Comunicación en tiempo real
- **Vanilla JavaScript**: Frontend (sin dependencias)

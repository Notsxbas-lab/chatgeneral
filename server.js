const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ===== CONEXIÓN A MONGODB =====
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://scamren559_db_user:oaIPyyDdysVijYlZ@chatgeneral.zjsbodx.mongodb.net/chatgeneral?retryWrites=true&w=majority';

let mongoConnected = false;

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas');
    mongoConnected = true;
  })
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err.message);
    console.log('⚠️ Usando almacenamiento local como fallback');
    mongoConnected = false;
  });

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB desconectado');
  mongoConnected = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconectado');
  mongoConnected = true;
});

// ===== ESQUEMAS DE MONGODB =====
const chatDataSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  rulesText: { type: String, default: '1. No spam.\n2. Sé respetuoso.\n3. No compartir información personal.' },
  rooms: [String],
  roomPasswords: { type: Map, of: String },
  bannedIps: [String],
  badWords: [String],
  registeredAdmins: { type: Map, of: Object }
}, { timestamps: true });

const userDatabaseSchema = new mongoose.Schema({
  key: String,
  value: String,
  category: { type: String, default: 'general' },
  createdAt: { type: Date, default: Date.now }
});

// Esquema para mensajes del chat
const chatMessageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true },
  socketId: String,
  username: String,
  message: String,
  room: { type: String, default: 'global' },
  type: { type: String, default: 'text' },
  imageData: String,
  avatarColor: String,
  avatarEmoji: String,
  profileImage: String,
  createdAt: { type: Date, default: Date.now }
});

const ChatData = mongoose.model('ChatData', chatDataSchema);
const UserDatabase = mongoose.model('UserDatabase', userDatabaseSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// State
const connectedUsers = new Map(); // socketId -> { id, username, ip, room, socketId, ... }
const bannedIps = new Set();
const roomsList = new Set(['global', 'ayudas', 'reglas']);
let chatRunning = true;
let adminPassword = 'Dueno'; // Contraseña por defecto

// Salas especiales
const adminWriteRooms = new Set(['ayudas']);
const rulesRoomName = 'reglas';
const roomPasswords = new Map(); // room -> password
let rulesText = '1. No spam.\n2. Sé respetuoso.\n3. No compartir información personal.';

// Persistencia de datos (archivos locales como fallback)
const DATA_FILE = path.join(__dirname, 'chat-data.json');
const DATABASE_FILE = path.join(__dirname, 'user-database.json');
let userDatabase = [];

// ===== FUNCIONES DE MONGODB =====
async function saveData() {
  // Primero guardar en archivo local siempre (rápido y confiable)
  try {
    const localData = {
      rulesText,
      rooms: Array.from(roomsList),
      roomPasswords: Array.from(roomPasswords.entries()),
      bannedIps: Array.from(bannedIps),
      badWords: Array.from(badWords),
      registeredAdmins: Array.from(registeredAdmins.entries())
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(localData, null, 2), 'utf8');
    console.log('📁 Datos guardados localmente');
  } catch (fileErr) {
    console.error('Error al guardar archivo local:', fileErr);
  }

  // Luego intentar guardar en MongoDB si está conectado
  if (mongoConnected) {
    try {
      const data = {
        key: 'main',
        rulesText,
        rooms: Array.from(roomsList),
        roomPasswords: Object.fromEntries(roomPasswords),
        bannedIps: Array.from(bannedIps),
        badWords: Array.from(badWords),
        registeredAdmins: Object.fromEntries(registeredAdmins)
      };
      
      await ChatData.findOneAndUpdate(
        { key: 'main' },
        data,
        { upsert: true, new: true }
      );
      console.log('✅ Datos sincronizados con MongoDB');
    } catch (err) {
      console.error('❌ Error guardando en MongoDB:', err.message);
    }
  }
}

async function loadData() {
  // Primero cargar desde archivo local (siempre disponible)
  try {
    if (fs.existsSync(DATA_FILE)) {
      const localData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (localData.rulesText) rulesText = localData.rulesText;
      if (localData.rooms) {
        roomsList.clear();
        localData.rooms.forEach(r => roomsList.add(r));
      }
      if (localData.roomPasswords) {
        roomPasswords.clear();
        localData.roomPasswords.forEach(([room, pass]) => roomPasswords.set(room, pass));
      }
      if (localData.bannedIps) {
        bannedIps.clear();
        localData.bannedIps.forEach(ip => bannedIps.add(ip));
      }
      if (localData.badWords) {
        badWords.clear();
        localData.badWords.forEach(word => badWords.add(word));
      }
      if (localData.registeredAdmins) {
        localData.registeredAdmins.forEach(([username, adminData]) => {
          registeredAdmins.set(username, adminData);
        });
      }
      console.log('📁 Datos cargados desde archivo local');
    }
  } catch (fileErr) {
    console.error('Error al cargar archivo local:', fileErr);
  }

  // Luego intentar sincronizar con MongoDB si está conectado
  if (mongoConnected) {
    try {
      const data = await ChatData.findOne({ key: 'main' });
      
      if (data) {
        if (data.rulesText) rulesText = data.rulesText;
        if (data.rooms && data.rooms.length > 0) {
          roomsList.clear();
          data.rooms.forEach(r => roomsList.add(r));
        }
        if (data.roomPasswords) {
          roomPasswords.clear();
          if (data.roomPasswords instanceof Map) {
            data.roomPasswords.forEach((pass, room) => roomPasswords.set(room, pass));
          } else {
            Object.entries(data.roomPasswords).forEach(([room, pass]) => roomPasswords.set(room, pass));
          }
        }
        if (data.bannedIps) {
          bannedIps.clear();
          data.bannedIps.forEach(ip => bannedIps.add(ip));
        }
        if (data.badWords) {
          badWords.clear();
          data.badWords.forEach(word => badWords.add(word));
        }
        if (data.registeredAdmins) {
          if (data.registeredAdmins instanceof Map) {
            data.registeredAdmins.forEach((adminData, username) => {
              registeredAdmins.set(username, adminData);
            });
          } else {
            Object.entries(data.registeredAdmins).forEach(([username, adminData]) => {
              registeredAdmins.set(username, adminData);
            });
          }
        }
        console.log('✅ Datos sincronizados desde MongoDB');
      }
    } catch (err) {
      console.error('❌ Error cargando desde MongoDB:', err.message);
    }
  }
}

// Cargar datos al iniciar (desde archivo local primero)
loadData();

// Sincronizar con MongoDB cuando esté conectado
mongoose.connection.once('open', async () => {
  await loadData();
  await loadUserDatabase();
});

async function saveUserDatabase() {
  // Guardar en archivo local
  try {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(userDatabase, null, 2), 'utf8');
  } catch (err) {
    console.error('Error guardando base de datos local:', err);
  }
}

async function loadUserDatabase() {
  // Primero cargar desde archivo local
  try {
    if (fs.existsSync(DATABASE_FILE)) {
      userDatabase = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
      console.log('📁 Base de datos cargada:', userDatabase.length, 'registros');
    }
  } catch (fileErr) {
    console.error('Error al cargar base de datos local:', fileErr);
    userDatabase = [];
  }

  // Luego sincronizar con MongoDB si está conectado
  if (mongoConnected) {
    try {
      const records = await UserDatabase.find({});
      if (records.length > 0) {
        userDatabase = records.map(r => ({
          _id: r._id.toString(),
          key: r.key,
          value: r.value,
          category: r.category,
          createdAt: r.createdAt
        }));
        console.log('✅ Base de datos sincronizada desde MongoDB:', userDatabase.length, 'registros');
      }
    } catch (err) {
      console.error('❌ Error sincronizando base de datos:', err.message);
    }
  }
}

// Nuevas estructuras de datos
const messageHistory = []; // Historial de mensajes (últimos 100)
const MAX_HISTORY = 100;
const reportedMessages = []; // Mensajes reportados
const mutedUsers = new Map(); // userId -> { until: timestamp, reason }
const badWords = new Set(['spam', 'tonto', 'idiota']); // Filtro de palabras (ejemplo)
const pinnedMessages = new Map(); // room -> mensaje fijado
const moderationLogs = []; // Logs de acciones de moderación
const MAX_LOGS = 200;

// Estadísticas globales
const globalStats = {
  totalMessages: 0,
  wordFrequency: new Map(),
  activeHours: new Array(24).fill(0),
  records: {
    longestMessage: { text: '', username: '', length: 0 },
    fastestTyper: { username: '', wpm: 0 },
    mostActiveDay: { date: '', count: 0 }
  }
};

// Helper: Agregar log de moderación
function addModerationLog(action, admin, details) {
  moderationLogs.push({
    id: Date.now(),
    action,
    admin,
    details,
    time: new Date().toLocaleString()
  });
  if (moderationLogs.length > MAX_LOGS) {
    moderationLogs.shift();
  }
  io.to('admin').emit('newModerationLog', moderationLogs[moderationLogs.length - 1]);
}

function getRoomsPayload() {
  return Array.from(roomsList).map((name) => ({
    name,
    locked: roomPasswords.has(name),
    adminOnly: adminWriteRooms.has(name),
    isRules: name === rulesRoomName,
  }));
}

function broadcastRooms() {
  io.emit('roomsUpdated', getRoomsPayload());
}

// Roles y Permisos
const roles = {
  DUENO: 'Dueño',
  ADMIN: 'Admin',
  MOD: 'Mod',
  MOD_JUNIOR: 'Mod Junior',
  USER: 'Usuario'
};

const permissions = {
  'Dueño': ['kick', 'ban', 'changeName', 'startChat', 'stopChat', 'setPassword', 'manageRoles', 'manageUsers'],
  'Admin': ['kick', 'ban', 'changeName', 'startChat', 'stopChat', 'setPassword', 'manageRoles', 'manageUsers'],
  'Mod': ['kick', 'ban', 'changeName'],
  'Mod Junior': ['kick'],
  'Usuario': []
};

const adminUsers = new Map(); // socketId -> { username, role }
const registeredAdmins = new Map(); // username -> { role } - Lista de admins registrados

// Admin por defecto
registeredAdmins.set('Dueno', { role: roles.DUENO });

// Get client IP
function getClientIp(socket) {
  return socket.handshake.headers['x-forwarded-for']?.split(',')[0] ||
         socket.handshake.address;
}

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket);
  console.log('Usuario conectado:', socket.id, 'desde IP:', clientIp);

  // Check if IP is banned
  if (bannedIps.has(clientIp)) {
    console.log('Conexión rechazada: IP baneada');
    socket.disconnect(true);
    return;
  }

  // Chat disabled check
  if (!chatRunning) {
    socket.emit('chatDisabled', { message: 'El chat está pausado por el administrador' });
  }

  socket.emit('roomsUpdated', getRoomsPayload());
  socket.emit('rulesText', rulesText);

  // Admin login
  socket.on('adminLogin', (data, callback) => {
    const { username, password } = data;
    
    // Validar que exista usuario y contraseña
    if (!username || !password) {
      console.log('Intento de login admin sin credenciales completas desde:', socket.id);
      callback({ success: false });
      return;
    }
    
    // Buscar admin (case-insensitive)
    let adminData = null;
    let foundUsername = null;
    for (const [regUsername, data] of registeredAdmins.entries()) {
      if (regUsername.toLowerCase() === username.toLowerCase()) {
        adminData = data;
        foundUsername = regUsername;
        break;
      }
    }
    
    // Verificar contraseña: comparar con la contraseña global O con la contraseña específica del admin
    const passwordMatch = password === adminPassword || (adminData && adminData.password && password === adminData.password);
    
    if (passwordMatch && adminData) {
      socket.isAdmin = true;
      socket.adminRole = adminData.role;
      socket.adminUsername = foundUsername;
      socket.join('admin');
      adminUsers.set(socket.id, { username: foundUsername, role: adminData.role });
      console.log('Admin autenticado:', foundUsername, 'con rol:', socket.adminRole);
      socket.emit('databaseRecords', userDatabase);
      callback({ success: true });
      io.to('admin').emit('adminJoined', { username: foundUsername, role: socket.adminRole });
    } else {
      console.log('Intento de login admin fallido desde:', socket.id, 'usuario:', username, 'password match:', passwordMatch, 'user exists:', !!adminData);
      callback({ success: false });
    }
  });

  // Crear sala (opcional con contraseña)
  socket.on('createRoom', ({ room, password } = {}, cb) => {
    const cleanRoom = String(room || '').trim();
    if (!cleanRoom) {
      cb && cb({ success: false, message: 'Nombre requerido' });
      return;
    }

    if (cleanRoom.length > 30) {
      cb && cb({ success: false, message: 'Nombre muy largo' });
      return;
    }

    if (roomsList.has(cleanRoom)) {
      cb && cb({ success: false, message: 'La sala ya existe' });
      return;
    }

    roomsList.add(cleanRoom);
    if (password && String(password).trim().length > 0) {
      roomPasswords.set(cleanRoom, String(password));
    }

    saveData();
    broadcastRooms();
    cb && cb({ success: true, room: cleanRoom, locked: roomPasswords.has(cleanRoom) });
  });

  // Eliminar sala (solo admin)
  socket.on('deleteRoom', ({ room } = {}, cb) => {
    if (!socket.isAdmin) {
      cb && cb({ success: false, message: 'No autorizado' });
      return;
    }

    const cleanRoom = String(room || '').trim();
    
    // No permitir eliminar salas protegidas
    const protectedRooms = ['global', 'ayudas', 'reglas'];
    if (protectedRooms.includes(cleanRoom)) {
      cb && cb({ success: false, message: 'No se puede eliminar esta sala' });
      return;
    }

    if (!roomsList.has(cleanRoom)) {
      cb && cb({ success: false, message: 'La sala no existe' });
      return;
    }

    // Mover usuarios de la sala a global
    io.in(cleanRoom).socketsJoin('global');
    io.in(cleanRoom).emit('system', `La sala "${cleanRoom}" ha sido eliminada. Has sido movido a global.`);
    io.in(cleanRoom).socketsLeave(cleanRoom);

    // Eliminar la sala
    roomsList.delete(cleanRoom);
    roomPasswords.delete(cleanRoom);

    saveData();
    broadcastRooms();
    io.to('admin').emit('roomDeleted', { room: cleanRoom });
    cb && cb({ success: true, room: cleanRoom });
  });

  // Obtener lista de salas (para admin)
  socket.on('getRoomsList', (cb) => {
    if (!socket.isAdmin) {
      cb && cb({ success: false, rooms: [] });
      return;
    }
    
    const rooms = Array.from(roomsList).map(name => ({
      name,
      locked: roomPasswords.has(name),
      protected: ['global', 'ayudas', 'reglas'].includes(name),
      usersCount: io.sockets.adapter.rooms.get(name)?.size || 0
    }));
    
    cb && cb({ success: true, rooms });
  });

  // Obtener mensajes guardados de una sala
  socket.on('getSavedMessages', async ({ room, limit } = {}, cb) => {
    const targetRoom = room || 'global';
    const msgLimit = Math.min(limit || 50, 100);
    
    if (mongoConnected) {
      try {
        const messages = await ChatMessage.find({ room: targetRoom })
          .sort({ createdAt: -1 })
          .limit(msgLimit)
          .lean();
        
        const formatted = messages.reverse().map(m => ({
          id: m.messageId,
          socketId: m.socketId,
          username: m.username,
          message: m.message,
          time: new Date(m.createdAt).getTime(),
          room: m.room,
          type: m.type,
          image: m.imageData,
          avatarColor: m.avatarColor,
          avatarEmoji: m.avatarEmoji,
          profileImage: m.profileImage
        }));
        
        cb && cb({ success: true, messages: formatted });
      } catch (err) {
        console.error('Error obteniendo mensajes:', err.message);
        cb && cb({ success: false, messages: [] });
      }
    } else {
      // Fallback: mensajes del historial local
      const localMessages = messageHistory.filter(m => m.room === targetRoom).slice(-msgLimit);
      cb && cb({ success: true, messages: localMessages });
    }
  });

  // join: { username, room, avatarColor, avatarEmoji, profileImage, bgColor }
  socket.on('join', ({ username, room, avatarColor, avatarEmoji, profileImage, bgColor, password } = {}) => {
    socket.username = username || 'Anon';
    const targetRoom = room || 'global';

    const requiredPassword = roomPasswords.get(targetRoom);
    if (requiredPassword && requiredPassword !== password) {
      socket.emit('joinDenied', { room: targetRoom, reason: 'Contraseña incorrecta' });
      return;
    }

    socket.room = targetRoom;
    socket.avatarColor = avatarColor || '#00b4d8';
    socket.avatarEmoji = avatarEmoji || '';
    socket.profileImage = profileImage || '';
    socket.bgColor = bgColor || '#fafbff';
    socket.ip = clientIp;
    socket.join(socket.room);

    // Store in connected users map
    connectedUsers.set(socket.id, {
      id: socket.id,
      username: socket.username,
      ip: clientIp,
      room: socket.room,
      socketId: socket.id
    });

    // Add room to list (if not present)
    const beforeSize = roomsList.size;
    roomsList.add(socket.room);
    if (roomsList.size !== beforeSize) {
      broadcastRooms();
    }

    socket.to(socket.room).emit('system', `${socket.username} se ha unido a ${socket.room}.`);
    socket.emit('roomJoined', { room: socket.room });
    if (socket.room === rulesRoomName) {
      socket.emit('rulesText', rulesText);
    }

    // Notify admin
    io.to('admin').emit('userConnected', {
      id: socket.id,
      username: socket.username,
      ip: clientIp,
      room: socket.room
    });
  });

  // update profile
  socket.on('updateProfile', ({ username, avatarColor, avatarEmoji, profileImage, bgColor }) => {
    if (username) {
      socket.username = username;
      if (connectedUsers.has(socket.id)) {
        connectedUsers.get(socket.id).username = username;
      }
    }
    if (avatarColor) socket.avatarColor = avatarColor;
    if (avatarEmoji !== undefined) socket.avatarEmoji = avatarEmoji;
    if (profileImage !== undefined) socket.profileImage = profileImage;
    if (bgColor !== undefined) socket.bgColor = bgColor;
    socket.to(socket.room || 'global').emit('system', `${socket.username} actualizó su perfil.`);
  });

  // message can be string or { type: 'text'|'image', text, imageData }
  socket.on('message', (msg) => {
    if (!chatRunning) {
      socket.emit('system', '⚠️ El chat está pausado por el administrador');
      return;
    }

    if (adminWriteRooms.has(socket.room) && !socket.isAdmin) {
      socket.emit('system', 'Solo administradores pueden escribir en esta sala.');
      return;
    }

    if (socket.room === rulesRoomName && !socket.isAdmin) {
      socket.emit('system', 'Solo administradores pueden actualizar las reglas.');
      return;
    }

    // Verificar si el usuario está muteado
    const muteInfo = mutedUsers.get(socket.id);
    if (muteInfo && Date.now() < muteInfo.until) {
      const remainingMin = Math.ceil((muteInfo.until - Date.now()) / 60000);
      socket.emit('system', `🔇 Estás silenciado. Tiempo restante: ${remainingMin} min`);
      return;
    } else if (muteInfo) {
      mutedUsers.delete(socket.id); // Limpiar mute expirado
    }

    const text = (typeof msg === 'string') ? msg : (msg.text || msg.message || '');
    const lower = String(text).toLowerCase();
    
    // Actualizar estadísticas globales
    globalStats.totalMessages++;
    globalStats.activeHours[new Date().getHours()]++;
    
    // Actualizar palabras más usadas
    text.split(' ').forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
      if (cleanWord.length > 3) {
        globalStats.wordFrequency.set(cleanWord, (globalStats.wordFrequency.get(cleanWord) || 0) + 1);
      }
    });
    
    // Récord de mensaje más largo
    if (text.length > globalStats.records.longestMessage.length) {
      globalStats.records.longestMessage = {
        text: text.substring(0, 100),
        username: socket.username,
        length: text.length
      };
    }
    
    // Filtro de palabras prohibidas mejorado
    const blocked = Array.from(badWords).some((w) => lower.includes(w.toLowerCase()));
    if (blocked) {
      socket.emit('moderated', { reason: 'Contenido bloqueado: palabra prohibida detectada' });
      addModerationLog('filter', socket.username, 'Mensaje bloqueado por filtro');
      return;
    }

    const payload = {
      id: `msg_${Date.now()}_${socket.id}`,
      socketId: socket.id,
      username: socket.username || 'Anon',
      message: text,
      time: Date.now(),
      room: socket.room || 'global',
      type: (typeof msg === 'object' && msg.type) ? msg.type : 'text',
      image: (typeof msg === 'object' && msg.image) ? msg.image : undefined,
      avatarColor: socket.avatarColor || '#00b4d8',
      avatarEmoji: socket.avatarEmoji || '',
      profileImage: socket.profileImage || '',
      bgColor: socket.bgColor || '#fafbff',
      reactions: {},
      replyTo: (typeof msg === 'object' && msg.replyTo) ? msg.replyTo : undefined
    };
    
    // Guardar en historial local
    messageHistory.push(payload);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }
    
    // Guardar en MongoDB (solo sala global)
    if (mongoConnected && payload.room === 'global') {
      const chatMsg = new ChatMessage({
        messageId: payload.id,
        socketId: payload.socketId,
        username: payload.username,
        message: payload.message,
        room: payload.room,
        type: payload.type,
        imageData: payload.image,
        avatarColor: payload.avatarColor,
        avatarEmoji: payload.avatarEmoji,
        profileImage: payload.profileImage
      });
      chatMsg.save().catch(err => console.error('Error guardando mensaje:', err.message));
    }
    
    io.to(payload.room).emit('message', payload);
    io.to('live-monitor').emit('liveMessage', payload);
  });

  // receive images separately (legacy fallback)
  socket.on('image', (data) => {
    if (!chatRunning) {
      socket.emit('system', '⚠️ El chat está pausado por el administrador');
      return;
    }

    const payload = {
      id: socket.id,
      username: socket.username || 'Anon',
      message: '📷 imagen',
      time: Date.now(),
      room: socket.room || 'global',
      type: 'image',
      image: data,
      avatarColor: socket.avatarColor || '#00b4d8',
      avatarEmoji: socket.avatarEmoji || '',
      profileImage: socket.profileImage || '',
      bgColor: socket.bgColor || '#fafbff',
    };
    io.to(payload.room).emit('message', payload);
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    io.to(socket.room || 'global').emit('system', `${socket.username || 'Alguien'} se ha desconectado.`);
    io.to('admin').emit('userDisconnected', socket.id);
  });

  // report messages: { messageId, reason }
  socket.on('report', (report) => {
    console.log('Report received:', report, 'from', socket.id);
    socket.emit('reportAck', { ok: true });
  });

  // ============ ADMIN EVENTS ============
  socket.on('getAdminData', () => {
    if (!socket.isAdmin) {
      console.log('Acceso denegado: no autenticado');
      return;
    }
    
    const users = Array.from(connectedUsers.values()).map(u => ({
      id: u.id,
      username: u.username,
      ip: u.ip,
      room: u.room
    }));
    
    socket.emit('adminData', {
      users,
      bannedIps: Array.from(bannedIps),
      rooms: Array.from(roomsList),
      chatRunning
    });
  });

  socket.on('adminKick', ({ userId }) => {
    if (!socket.isAdmin) return;
    
    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      const username = targetSocket.username || 'Unknown';
      targetSocket.emit('system', '⛔ Has sido expulsado por un administrador');
      targetSocket.disconnect(true);
      io.to('admin').emit('userKicked', { userId, username });
    }
  });

  socket.on('adminBan', ({ ip, username }) => {
    if (!socket.isAdmin) return;
    
    bannedIps.add(ip);
    saveData();
    
    // Desconectar a todos los usuarios con esa IP
    Array.from(connectedUsers.values()).forEach(user => {
      if (user.ip === ip) {
        const sock = io.sockets.sockets.get(user.id);
        if (sock) {
          sock.emit('system', `🚫 Tu IP ha sido baneada. Razón: ${username || 'Por administrador'}`);
          sock.disconnect(true);
        }
      }
    });
    
    io.to('admin').emit('userBanned', { ip, username });
  });

  socket.on('adminUnban', ({ ip }) => {
    if (!socket.isAdmin) return;
    
    bannedIps.delete(ip);
  });

  socket.on('adminChangeName', ({ userId, newName }) => {
    if (!socket.isAdmin) return;

    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      const oldName = targetSocket.username;
      targetSocket.username = newName;

      if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).username = newName;
      }

      io.to(targetSocket.room || 'global').emit('system', `${oldName} ahora se llama ${newName}`);
      io.to('admin').emit('userNameChanged', { userId, newName });
    }
  });

  socket.on('adminStartChat', () => {
    if (!socket.isAdmin) return;
    
    chatRunning = true;
    io.emit('chatStatusChanged', true);
    io.emit('system', '✓ El administrador inició el chat');
  });

  socket.on('adminStopChat', () => {
    if (!socket.isAdmin) return;
    
    chatRunning = false;
    io.emit('chatStatusChanged', false);
    io.emit('system', '⏸️ El administrador pausó el chat');
  });

  // Map para almacenar contraseñas individuales de admins
let adminPasswords = new Map();

socket.on('adminSetPassword', ({ password }) => {
    if (!socket.isAdmin) return;
    
    adminPassword = password;
    socket.emit('passwordSet');
    console.log('Contraseña admin global establecida');
  });

  // Establecer contraseña para admin específico
  socket.on('setAdminPassword', ({ adminId, password }) => {
    if (!socket.isAdmin) return;
    
    if (!adminId || !password || password.length < 6) return;
    
    // Buscar el admin en registeredAdmins (adminId es el username)
    if (registeredAdmins.has(adminId)) {
      const adminData = registeredAdmins.get(adminId);
      adminData.password = password;
      registeredAdmins.set(adminId, adminData);
      saveData(); // Persistir el cambio
      console.log(`Contraseña actualizada para admin: ${adminId}`);
      io.emit('adminPasswordUpdated', { adminId });
    } else {
      console.log(`Admin no encontrado: ${adminId}`);
    }
  });

  // Cambiar rol de usuario
  socket.on('changeUserRole', ({ userId, newRole }) => {
    if (!socket.isAdmin || !socket.adminRole || !permissions[socket.adminRole] || !permissions[socket.adminRole].includes('manageRoles')) return;

    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      targetSocket.adminRole = newRole;
      adminUsers.set(userId, { username: targetSocket.username || 'Unknown', role: newRole });
      io.to('admin').emit('userRoleChanged', { userId, username: targetSocket.username, newRole });
      console.log(`Rol de ${targetSocket.username} cambió a ${newRole}`);
    }
  });

  // Obtener historial de mensajes
  socket.on('getMessageHistory', () => {
    if (!socket.isAdmin) return;
    socket.emit('messageHistory', messageHistory.slice(-50)); // Últimos 50 mensajes
  });

  socket.on('getRulesText', () => {
    console.log('getRulesText requested, sending:', rulesText);
    socket.emit('rulesText', rulesText);
  });

  socket.on('setRulesText', ({ text }) => {
    if (!socket.isAdmin) return;
    const cleanText = String(text || '').trim().slice(0, 2000);
    rulesText = cleanText || 'Reglas pendientes de publicar.';
    console.log('Rules text updated to:', rulesText);
    saveData();
    io.emit('rulesText', rulesText);
  });

  // Enviar anuncio
  socket.on('sendAnnouncement', (announcement) => {
    if (!socket.isAdmin) return;
    const payload = {
      id: `ann_${Date.now()}`,
      type: 'announcement',
      message: announcement.message,
      username: 'Administración',
      time: Date.now(),
      room: 'global'
    };
    io.emit('announcement', payload);
    addModerationLog('announcement', socket.username, announcement.message);
  });

  // Reportar mensaje
  socket.on('reportMessage', (data) => {
    reportedMessages.push({
      id: Date.now(),
      messageId: data.messageId,
      messageText: data.messageText,
      reportedBy: socket.username || 'Anon',
      reporter: socket.id,
      reason: data.reason || 'No especificado',
      time: Date.now()
    });
    socket.emit('system', '✅ Mensaje reportado correctamente');
    io.to('admin').emit('newReport', reportedMessages[reportedMessages.length - 1]);
  });

  // Obtener mensajes reportados
  socket.on('getReportedMessages', () => {
    if (!socket.isAdmin) return;
    socket.emit('reportedMessages', reportedMessages);
  });

  // Silenciar usuario
  socket.on('muteUser', (data) => {
    if (!socket.isAdmin) return;
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === data.username);
    
    if (targetSocket) {
      const until = Date.now() + (data.duration * 60000);
      mutedUsers.set(targetSocket.id, {
        until,
        reason: data.reason || 'No especificado',
        by: socket.username
      });
      targetSocket.emit('system', `🔇 Has sido silenciado por ${data.duration} minutos. Razón: ${data.reason || 'No especificado'}`);
      addModerationLog('mute', socket.username, `${data.username} - ${data.duration}min`);
      socket.emit('system', `✅ Usuario ${data.username} silenciado`);
    } else {
      socket.emit('system', '❌ Usuario no encontrado');
    }
  });

  // Fijar mensaje
  socket.on('pinMessage', (data) => {
    if (!socket.isAdmin) return;
    pinnedMessages.set(data.room || 'global', data.message);
    io.to(data.room || 'global').emit('messagePinned', data.message);
    addModerationLog('pin', socket.username, data.message.message);
  });

  // Indicador de escritura
  socket.on('typing', () => {
    socket.to(socket.room || 'global').emit('userTyping', {
      username: socket.username,
      room: socket.room
    });
  });

  // Reaccionar a mensaje
  socket.on('addReaction', (data) => {
    const message = messageHistory.find(m => m.id === data.messageId);
    if (message) {
      if (!message.reactions) message.reactions = {};
      if (!message.reactions[data.emoji]) message.reactions[data.emoji] = [];
      if (!message.reactions[data.emoji].includes(socket.username)) {
        message.reactions[data.emoji].push(socket.username);
        io.to(message.room).emit('reactionAdded', {
          messageId: data.messageId,
          emoji: data.emoji,
          username: socket.username,
          reactions: message.reactions
        });
      }
    }
  });

  // Obtener lista de administradores
  socket.on('getAdminUsers', () => {
    console.log('getAdminUsers request from socket:', socket.id, 'isAdmin:', socket.isAdmin);
    // Permitimos la consulta incluso si el flag isAdmin se perdió tras reconexión
    // (la validación real se hace en adminLogin y la UI está protegida por sesión).
    
    // Obtener admins registrados
    const adminList = Array.from(registeredAdmins.entries()).map(([username, data]) => ({
      id: username, // Usar username como ID
      username: username,
      role: data.role
    }));
    
    const rolesArray = ['Mod Junior', 'Mod', 'Admin', 'Dueño'];
    
    console.log('Enviando admin list:', adminList);
    socket.emit('adminUsersList', {
      admins: adminList,
      roles: rolesArray
    });
  });

  // Registrar nuevo admin por nombre
  socket.on('registerAdmin', ({ username, role, password }, cb) => {
    if (!socket.isAdmin || !permissions[socket.adminRole]?.includes('manageRoles')) {
      cb && cb({ success: false, message: 'No autorizado' });
      return;
    }

    if (!username || !role) {
      cb && cb({ success: false, message: 'Faltan datos' });
      return;
    }

    registeredAdmins.set(username, { role, password: password || null });
    saveData(); // Persistir el nuevo admin
    console.log(`Admin registrado: ${username} con rol ${role}`);

    const rolesArray = ['Mod Junior', 'Mod', 'Admin', 'Dueño'];
    const adminList = Array.from(registeredAdmins.entries()).map(([u, data]) => ({
      id: u,
      username: u,
      role: data.role
    }));

    // Enviar lista actualizada al solicitante y notificar a todos los admins
    socket.emit('adminUsersList', { admins: adminList, roles: rolesArray });
    io.to('admin').emit('adminRegistered', { userId: username, username, role });
    io.to('admin').emit('userPromoted', { userId: username, username, role });

    cb && cb({ success: true });
  });

  // Promover/Degradar usuario a administrador
  socket.on('promoteToAdmin', ({ userId, role }) => {
    if (!socket.isAdmin || !socket.adminRole || !permissions[socket.adminRole] || !permissions[socket.adminRole].includes('manageRoles')) return;

    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      targetSocket.isAdmin = true;
      targetSocket.adminRole = role || roles.MOD_JUNIOR;
      adminUsers.set(userId, { username: targetSocket.username, role: targetSocket.adminRole });
      registeredAdmins.set(targetSocket.username, { role: targetSocket.adminRole });
      saveData(); // Persistir el cambio
      io.to('admin').emit('userPromoted', { userId, username: targetSocket.username, role: targetSocket.adminRole });
      console.log(`${targetSocket.username} promovido a ${targetSocket.adminRole}`);
    }
  });

  // Remover permisos de administrador
  socket.on('demoteAdmin', ({ userId }) => {
    if (!socket.isAdmin || !permissions[socket.adminRole].includes('manageRoles')) return;
    
    // Si userId es un nombre de usuario (string sin guiones), buscar en registeredAdmins
    if (typeof userId === 'string' && !userId.includes('-')) {
      registeredAdmins.delete(userId);
      saveData(); // Persistir el cambio
      io.to('admin').emit('userDemoted', { userId, username: userId });
      console.log(`${userId} removido de administradores registrados`);
      return;
    }
    
    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      targetSocket.isAdmin = false;
      targetSocket.adminRole = null;
      adminUsers.delete(userId);
      registeredAdmins.delete(targetSocket.username);
      saveData(); // Persistir el cambio
      io.to('admin').emit('userDemoted', { userId, username: targetSocket.username });
      console.log(`${targetSocket.username} removido de administradores`);
    }
  });

  // Cambio de estado
  socket.on('statusChange', (data) => {
    socket.userStatus = data.status;
    if (connectedUsers.has(socket.id)) {
      connectedUsers.get(socket.id).status = data.status;
    }
    io.to(socket.room || 'global').emit('userStatusChanged', {
      username: socket.username,
      status: data.status
    });
  });

  // Mensaje privado
  socket.on('privateMessage', (data) => {
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === data.targetUsername);
    
    if (targetSocket) {
      const payload = {
        from: socket.username,
        to: data.targetUsername,
        message: data.message,
        time: Date.now(),
        type: 'private'
      };
      targetSocket.emit('privateMessage', payload);
      socket.emit('privateMessage', payload);
    }
  });

  // Obtener palabras filtradas
  socket.on('getFilteredWords', () => {
    if (!socket.isAdmin) return;
    socket.emit('filteredWords', Array.from(badWords));
  });

  // Agregar palabra filtrada
  socket.on('addFilteredWord', (word) => {
    if (!socket.isAdmin) return;
    if (word && word.trim()) {
      badWords.add(word.trim().toLowerCase());
      saveData();
      io.to('admin').emit('filteredWords', Array.from(badWords));
      addModerationLog('filter-add', socket.username, word);
    }
  });

  // Remover palabra filtrada
  socket.on('removeFilteredWord', (word) => {
    if (!socket.isAdmin) return;
    badWords.delete(word.toLowerCase());
    io.to('admin').emit('filteredWords', Array.from(badWords));
    addModerationLog('filter-remove', socket.username, word);
  });

  // Obtener estadísticas en tiempo real
  socket.on('getLiveStats', () => {
    if (!socket.isAdmin) return;
    
    const stats = {
      totalUsers: connectedUsers.size,
      messageCount: messageHistory.length,
      activeRooms: Array.from(roomsList).map(room => ({
        name: room,
        users: Array.from(connectedUsers.values()).filter(u => u.room === room).length
      })),
      recentActivity: messageHistory.slice(-10).map(m => ({
        username: m.username,
        room: m.room,
        time: m.time
      }))
    };
    
    socket.emit('liveStats', stats);
  });
  
  // Obtener estadísticas globales
  socket.on('getGlobalStats', () => {
    const topWords = Array.from(globalStats.wordFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));
    
    socket.emit('globalStatsData', {
      totalMessages: globalStats.totalMessages,
      topWords,
      activeHours: globalStats.activeHours,
      records: globalStats.records
    });
  });

  // Monitoreo en tiempo real de mensajes
  socket.on('startLiveMonitoring', () => {
    if (!socket.isAdmin) return;
    socket.join('live-monitor');
  });

  socket.on('stopLiveMonitoring', () => {
    if (!socket.isAdmin) return;
    socket.leave('live-monitor');
  });

  // ===== BASE DE DATOS PERSONAL (MongoDB) =====
  socket.on('addDatabaseRecord', async ({ key, value, category }, cb) => {
    if (!socket.isAdmin) {
      cb && cb({ success: false, message: 'Acceso denegado' });
      return;
    }
    
    // Crear registro local primero
    const localRecord = {
      _id: Date.now().toString(),
      key: String(key).trim().substring(0, 100),
      value: String(value).trim().substring(0, 500),
      category: String(category || 'general').substring(0, 50),
      createdAt: new Date()
    };
    
    userDatabase.push(localRecord);
    saveUserDatabase();
    
    // Intentar guardar en MongoDB si está conectado
    if (mongoConnected) {
      try {
        const record = new UserDatabase({
          key: localRecord.key,
          value: localRecord.value,
          category: localRecord.category
        });
        await record.save();
        // Actualizar ID local con el de MongoDB
        localRecord._id = record._id.toString();
      } catch (err) {
        console.error('Error guardando en MongoDB:', err.message);
      }
    }
    
    cb && cb({ success: true, record: localRecord });
    io.to('admin').emit('databaseRecords', userDatabase);
  });

  socket.on('getDatabaseRecords', async (cb) => {
    if (!socket.isAdmin) {
      cb && cb({ success: false, records: [] });
      return;
    }
    
    // Sincronizar con MongoDB si está conectado
    if (mongoConnected) {
      try {
        const records = await UserDatabase.find({}).sort({ createdAt: -1 });
        if (records.length > 0) {
          userDatabase = records.map(r => ({
            _id: r._id.toString(),
            key: r.key,
            value: r.value,
            category: r.category,
            createdAt: r.createdAt
          }));
        }
      } catch (err) {
        console.error('Error sincronizando registros:', err.message);
      }
    }
    
    cb && cb({ success: true, records: userDatabase });
  });

  socket.on('updateDatabaseRecord', async ({ id, value }, cb) => {
    if (!socket.isAdmin) {
      cb && cb({ success: false });
      return;
    }
    
    // Actualizar localmente primero
    const localRecord = userDatabase.find(r => r._id === id);
    if (localRecord) {
      localRecord.value = String(value).trim().substring(0, 500);
      saveUserDatabase();
    }
    
    // Intentar actualizar en MongoDB
    if (mongoConnected) {
      try {
        await UserDatabase.findByIdAndUpdate(id, { value: localRecord.value });
      } catch (err) {
        console.error('Error actualizando en MongoDB:', err.message);
      }
    }
    
    cb && cb({ success: true });
    io.to('admin').emit('databaseRecords', userDatabase);
  });

  socket.on('deleteDatabaseRecord', async ({ id }, cb) => {
    if (!socket.isAdmin) {
      cb && cb({ success: false });
      return;
    }
    
    // Eliminar localmente primero
    const index = userDatabase.findIndex(r => r._id === id);
    if (index !== -1) {
      userDatabase.splice(index, 1);
      saveUserDatabase();
    }
    
    // Intentar eliminar en MongoDB
    if (mongoConnected) {
      try {
        await UserDatabase.findByIdAndDelete(id);
      } catch (err) {
        console.error('Error eliminando en MongoDB:', err.message);
      }
    }
    
    cb && cb({ success: true });
    io.to('admin').emit('databaseRecords', userDatabase);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log('=== CONFIGURACIÓN ADMIN ===');
  console.log('Contraseña admin:', adminPassword);
  console.log('Admins registrados:', Array.from(registeredAdmins.keys()));
  registeredAdmins.forEach((data, username) => {
    console.log(`  - ${username}: ${data.role}`);
  });
  console.log('=========================');
});

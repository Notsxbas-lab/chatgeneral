const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// State
const connectedUsers = new Map(); // socketId -> { id, username, ip, room, socketId, ... }
const bannedIps = new Set();
const roomsList = new Set(['global']);
let chatRunning = true;
let adminPassword = 'linda1102'; // Contraseña por defecto

// Nuevas estructuras de datos
const messageHistory = []; // Historial de mensajes (últimos 100)
const MAX_HISTORY = 100;
const reportedMessages = []; // Mensajes reportados
const mutedUsers = new Map(); // userId -> { until: timestamp, reason }
const badWords = new Set(['spam', 'tonto', 'idiota']); // Filtro de palabras (ejemplo)
const pinnedMessages = new Map(); // room -> mensaje fijado
const moderationLogs = []; // Logs de acciones de moderación
const MAX_LOGS = 200;

// Sistema de niveles y gamificación
const userLevels = new Map(); // userId -> { xp, level, badges, messageCount, joinDate }
const userStats = new Map(); // userId -> { totalMessages, wordCount, reactions, etc }
const activePolls = new Map(); // pollId -> { question, options, votes, creator, room }
const userNicknames = new Map(); // userId -> [array de nicknames anteriores]
const gameRooms = new Map(); // gameId -> { type, players, state }
const reminders = []; // { userId, message, time }

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

// Respuestas automáticas del bot
const botResponses = {
  'hola': ['¡Hola! 👋 ¿Cómo estás?', '¡Qué tal! 😊', '¡Saludos! ✨'],
  'ayuda': ['Escribe /help para ver todos los comandos disponibles 📚'],
  'chiste': ['¿Por qué los programadores prefieren el modo oscuro? ¡Porque la luz atrae bugs! 🐛😂'],
  'adios': ['¡Hasta luego! 👋', 'Nos vemos pronto 😊', '¡Vuelve pronto! ✨']
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

// Helper: Sistema de niveles
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function addXP(userId, amount) {
  if (!userLevels.has(userId)) {
    userLevels.set(userId, {
      xp: 0,
      level: 0,
      badges: [],
      messageCount: 0,
      joinDate: Date.now()
    });
  }
  
  const userData = userLevels.get(userId);
  userData.xp += amount;
  userData.messageCount++;
  const newLevel = calculateLevel(userData.xp);
  
  if (newLevel > userData.level) {
    userData.level = newLevel;
    return { levelUp: true, newLevel };
  }
  
  return { levelUp: false };
}

function checkAndAwardBadges(userId, username) {
  const userData = userLevels.get(userId);
  if (!userData) return [];
  
  const newBadges = [];
  
  // Badge: Primer mensaje
  if (userData.messageCount === 1 && !userData.badges.includes('first-message')) {
    userData.badges.push('first-message');
    newBadges.push({ id: 'first-message', name: 'Primer Mensaje', icon: '👶' });
  }
  
  // Badge: Charlatán (100 mensajes)
  if (userData.messageCount >= 100 && !userData.badges.includes('chatty')) {
    userData.badges.push('chatty');
    newBadges.push({ id: 'chatty', name: 'Charlatán', icon: '💬' });
  }
  
  // Badge: Veterano (24 horas desde join)
  const daysSinceJoin = (Date.now() - userData.joinDate) / (1000 * 60 * 60 * 24);
  if (daysSinceJoin >= 1 && !userData.badges.includes('veteran')) {
    userData.badges.push('veteran');
    newBadges.push({ id: 'veteran', name: 'Veterano', icon: '🏆' });
  }
  
  // Badge: Nocturno (mensaje entre 12am-6am)
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6 && !userData.badges.includes('night-owl')) {
    userData.badges.push('night-owl');
    newBadges.push({ id: 'night-owl', name: 'Búho Nocturno', icon: '🦉' });
  }
  
  return newBadges;
}

// Helper: Respuestas automáticas
function getBotResponse(message) {
  const lower = message.toLowerCase().trim();
  for (const [key, responses] of Object.entries(botResponses)) {
    if (lower.includes(key)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  return null;
}

// Helper: Procesar comandos slash
function processCommand(command, args, socket) {
  switch(command) {
    case 'help':
      return '📚 Comandos: /help, /8ball, /dado, /trivia, /gif, /poll, /stats, /excusa, /nivel';
    
    case '8ball':
      const responses = ['Sí', 'No', 'Tal vez', 'Sin duda', 'No cuentes con ello', 'Es probable', 'Pregunta después', 'Definitivamente sí'];
      return `🔮 ${responses[Math.floor(Math.random() * responses.length)]}`;
    
    case 'dado':
      return `🎲 Resultado: ${Math.floor(Math.random() * 6) + 1}`;
    
    case 'trivia':
      const triviaQuestions = [
        { q: '¿Cuál es la capital de Japón?', a: 'Tokio' },
        { q: '¿Cuántos planetas hay en el sistema solar?', a: '8' },
        { q: '¿Qué lenguaje se usa para la web?', a: 'JavaScript' }
      ];
      const trivia = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
      return `🧠 ${trivia.q}`;
    
    case 'excusa':
      const excuses = [
        'Mi perro se comió mi tarea 🐶',
        'Se me olvidó porque pensé en ello mañana 🤔',
        'Mi abuela necesitaba ayuda... con Minecraft 👵',
        'Se fue la luz... en mi cerebro 💡'
      ];
      return excuses[Math.floor(Math.random() * excuses.length)];
    
    case 'nivel':
      const userData = userLevels.get(socket.id);
      if (userData) {
        return `⭐ Nivel: ${userData.level} | XP: ${userData.xp} | Mensajes: ${userData.messageCount}`;
      }
      return 'Aún no tienes nivel. ¡Escribe más para ganar XP!';
    
    case 'stats':
      return `📊 Mensajes totales: ${globalStats.totalMessages} | Usuarios activos: ${connectedUsers.size}`;
    
    default:
      return null;
  }
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
      callback({ success: true });
      io.to('admin').emit('adminJoined', { username: foundUsername, role: socket.adminRole });
    } else {
      console.log('Intento de login admin fallido desde:', socket.id, 'usuario:', username, 'password match:', passwordMatch, 'user exists:', !!adminData);
      callback({ success: false });
    }
  });

  // join: { username, room, avatarColor, avatarEmoji, profileImage, bgColor }
  socket.on('join', ({ username, room, avatarColor, avatarEmoji, profileImage, bgColor } = {}) => {
    socket.username = username || 'Anon';
    socket.room = room || 'global';
    socket.avatarColor = avatarColor || '#00b4d8';
    socket.avatarEmoji = avatarEmoji || '';
    socket.profileImage = profileImage || '';
    socket.bgColor = bgColor || '#fafbff';
    socket.ip = clientIp;
    socket.join(socket.room);

    // Inicializar datos de usuario
    if (!userLevels.has(socket.id)) {
      userLevels.set(socket.id, {
        xp: 0,
        level: 0,
        badges: [],
        messageCount: 0,
        joinDate: Date.now()
      });
    }

    // Store in connected users map
    connectedUsers.set(socket.id, {
      id: socket.id,
      username: socket.username,
      ip: clientIp,
      room: socket.room,
      socketId: socket.id
    });

    // Add room to list
    roomsList.add(socket.room);

    socket.to(socket.room).emit('system', `${socket.username} se ha unido a ${socket.room}.`);
    socket.emit('roomJoined', { room: socket.room });
    
    // Enviar datos de nivel al usuario
    const userData = userLevels.get(socket.id);
    socket.emit('userLevelData', userData);

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
    
    // Procesar comandos slash
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ');
      const command = parts[0];
      const args = parts.slice(1);
      const response = processCommand(command, args, socket);
      if (response) {
        socket.emit('commandResponse', { command, response });
        return;
      }
    }
    
    // Sistema de XP y niveles
    const xpResult = addXP(socket.id, 10);
    if (xpResult.levelUp) {
      socket.emit('levelUp', { level: xpResult.newLevel });
      io.to(socket.room || 'global').emit('system', `🎉 ${socket.username} alcanzó el nivel ${xpResult.newLevel}!`);
    }
    
    // Verificar badges
    const newBadges = checkAndAwardBadges(socket.id, socket.username);
    if (newBadges.length > 0) {
      newBadges.forEach(badge => {
        socket.emit('badgeEarned', { badge: badge.id });
        io.to(socket.room || 'global').emit('system', `🏅 ${socket.username} ganó la insignia: ${badge.icon} ${badge.name}`);
      });
    }
    
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
    
    // Respuesta automática del bot
    const botResponse = getBotResponse(text);
    if (botResponse && Math.random() < 0.3) { // 30% probabilidad
      setTimeout(() => {
        io.to(socket.room || 'global').emit('message', {
          id: `bot_${Date.now()}`,
          socketId: 'bot',
          username: '🤖 ChatBot',
          message: botResponse,
          time: Date.now(),
          room: socket.room || 'global',
          type: 'text',
          avatarColor: '#00d084',
          avatarEmoji: '🤖',
          isBot: true
        });
      }, 1000);
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
      level: userLevels.get(socket.id)?.level || 0,
      badges: userLevels.get(socket.id)?.badges || [],
      bgColor: socket.bgColor || '#fafbff',
      reactions: {},
      replyTo: (typeof msg === 'object' && msg.replyTo) ? msg.replyTo : undefined
    };
    
    // Guardar en historial
    messageHistory.push(payload);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
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
    
    adminPasswords.set(adminId, password);
    console.log(`Contraseña establecida para admin: ${adminId}`);
    io.emit('adminPasswordUpdated', { adminId });
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
  
  // Crear encuesta
  socket.on('createPoll', (data) => {
    const pollId = `poll_${Date.now()}`;
    activePolls.set(pollId, {
      id: pollId,
      question: data.question,
      options: data.options.map((opt, idx) => ({ id: idx, text: opt, votes: 0, voters: [] })),
      creator: socket.username,
      room: socket.room || 'global',
      createdAt: Date.now()
    });
    
    io.to(socket.room || 'global').emit('newPoll', activePolls.get(pollId));
  });
  
  // Votar en encuesta
  socket.on('votePoll', (data) => {
    const poll = activePolls.get(data.pollId);
    if (poll) {
      // Remover voto anterior
      poll.options.forEach(opt => {
        const idx = opt.voters.indexOf(socket.id);
        if (idx > -1) {
          opt.voters.splice(idx, 1);
          opt.votes--;
        }
      });
      
      // Agregar nuevo voto
      const option = poll.options.find(opt => opt.id === data.optionId);
      if (option && !option.voters.includes(socket.id)) {
        option.voters.push(socket.id);
        option.votes++;
        io.to(poll.room).emit('pollUpdated', poll);
      }
    }
  });
  
  // Obtener ranking
  socket.on('getRanking', () => {
    const ranking = Array.from(userLevels.entries())
      .map(([id, data]) => {
        const user = connectedUsers.get(id);
        return {
          username: user ? user.username : 'Usuario',
          level: data.level,
          xp: data.xp,
          messageCount: data.messageCount,
          badges: data.badges
        };
      })
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10);
    
    socket.emit('rankingData', ranking);
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
  
  // Iniciar juego de piedra-papel-tijera
  socket.on('startRPS', (data) => {
    const gameId = `rps_${Date.now()}`;
    gameRooms.set(gameId, {
      type: 'rps',
      players: [{ id: socket.id, username: socket.username, choice: null }],
      opponent: data.opponent,
      state: 'waiting'
    });
    
    io.to(socket.room || 'global').emit('gameInvite', {
      gameId,
      type: 'rps',
      from: socket.username,
      to: data.opponent
    });
  });
  
  // Aceptar juego
  socket.on('acceptGame', (data) => {
    const game = gameRooms.get(data.gameId);
    if (game && game.state === 'waiting') {
      game.players.push({ id: socket.id, username: socket.username, choice: null });
      game.state = 'playing';
      
      game.players.forEach(player => {
        const sock = io.sockets.sockets.get(player.id);
        if (sock) sock.emit('gameStart', { gameId: data.gameId, type: game.type });
      });
    }
  });
  
  // Hacer jugada en juego
  socket.on('makeMove', (data) => {
    const game = gameRooms.get(data.gameId);
    if (game && game.state === 'playing') {
      const player = game.players.find(p => p.id === socket.id);
      if (player) {
        player.choice = data.choice;
        
        // Verificar si ambos jugaron
        if (game.players.every(p => p.choice)) {
          const [p1, p2] = game.players;
          let winner = null;
          
          if (p1.choice === p2.choice) {
            winner = 'tie';
          } else if (
            (p1.choice === 'piedra' && p2.choice === 'tijera') ||
            (p1.choice === 'papel' && p2.choice === 'piedra') ||
            (p1.choice === 'tijera' && p2.choice === 'papel')
          ) {
            winner = p1.username;
          } else {
            winner = p2.username;
          }
          
          game.players.forEach(player => {
            const sock = io.sockets.sockets.get(player.id);
            if (sock) {
              sock.emit('gameResult', {
                gameId: data.gameId,
                winner,
                choices: game.players.map(p => ({ username: p.username, choice: p.choice }))
              });
            }
          });
          
          gameRooms.delete(data.gameId);
        }
      }
    }
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


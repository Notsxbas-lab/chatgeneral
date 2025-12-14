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
let adminPassword = 'Paneladmin'; // Contraseña por defecto

// Roles y Permisos
const roles = {
  DUENO: 'Dueño',
  ADMIN: 'Admin',
  MOD: 'Mod',
  MOD_JUNIOR: 'Mod Junior',
  USER: 'Usuario'
};

const permissions = {
  DUENO: ['kick', 'ban', 'changeName', 'startChat', 'stopChat', 'setPassword', 'manageRoles', 'manageUsers'],
  ADMIN: ['kick', 'ban', 'changeName', 'startChat', 'stopChat', 'setPassword', 'manageRoles', 'manageUsers'],
  MOD: ['kick', 'ban', 'changeName'],
  MOD_JUNIOR: ['kick'],
  USER: []
};

const adminUsers = new Map(); // socketId -> { username, role }
const registeredAdmins = new Map(); // username -> { role } - Lista de admins registrados

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
    
    // Verificar contraseña y usuario
    if (password === adminPassword && registeredAdmins.has(username)) {
      const adminData = registeredAdmins.get(username);
      socket.isAdmin = true;
      socket.adminRole = adminData.role;
      socket.adminUsername = username;
      socket.join('admin');
      adminUsers.set(socket.id, { username, role: adminData.role });
      console.log('Admin autenticado:', username, 'con rol:', socket.adminRole);
      callback({ success: true });
      io.to('admin').emit('adminJoined', { username, role: socket.adminRole });
    } else {
      console.log('Intento de login admin fallido desde:', socket.id, 'usuario:', username);
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

    // moderation: simple banned words filter
    const banned = ['spamword1', 'malapalabra'];
    const text = (typeof msg === 'string') ? msg : (msg.text || msg.message || '');
    const lower = String(text).toLowerCase();
    const blocked = banned.some((w) => lower.includes(w));
    if (blocked) {
      socket.emit('moderated', { reason: 'Contenido bloqueado por moderación' });
      return;
    }

    const payload = {
      id: socket.id,
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
    };
    io.to(payload.room).emit('message', payload);
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

  socket.on('adminSetPassword', ({ password }) => {
    if (!socket.isAdmin) return;
    
    adminPassword = password;
    socket.emit('passwordSet');
    console.log('Contraseña admin establecida');
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

  // Obtener lista de administradores
  socket.on('getAdminUsers', () => {
    if (!socket.isAdmin) return;
    
    // Obtener admins registrados
    const adminList = Array.from(registeredAdmins.entries()).map(([username, data]) => ({
      id: username, // Usar username como ID
      username: username,
      role: data.role
    }));
    
    socket.emit('adminUsersList', {
      admins: adminList,
      roles: Object.values(roles)
    });
  });

  // Registrar nuevo admin por nombre
  socket.on('registerAdmin', ({ username, role }) => {
    if (!socket.isAdmin || !permissions[socket.adminRole]?.includes('manageRoles')) return;
    
    registeredAdmins.set(username, { role });
    console.log(`Admin registrado: ${username} con rol ${role}`);
    io.to('admin').emit('userPromoted', { userId: username, username, role });
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));


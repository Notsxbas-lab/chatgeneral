const socket = io();

// Login
const adminLoginOverlay = document.getElementById('adminLoginOverlay');
const adminLoginUsername = document.getElementById('adminLoginUsername');
const adminLoginPassword = document.getElementById('adminLoginPassword');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const loginError = document.getElementById('loginError');
let isLoggedIn = false;

// Check if already logged in
window.addEventListener('load', () => {
  const sessionKey = sessionStorage.getItem('adminLoggedIn');
  if (sessionKey === 'true') {
    isLoggedIn = true;
    adminLoginOverlay.classList.add('hidden');
    restoreAdminStateFromCache();
  }
});

function submitAdminLogin() {
  const username = adminLoginUsername.value.trim();
  const password = adminLoginPassword.value.trim();
  
  loginError.classList.remove('show');
  
  if (!username || !password) {
    loginError.textContent = 'Completa todos los campos';
    loginError.classList.add('show');
    return;
  }

  if (!socket.connected) {
    loginError.textContent = 'Conectando al servidor...';
    loginError.classList.add('show');
    setTimeout(() => submitAdminLogin(), 1000);
    return;
  }

  socket.emit('adminLogin', { username, password }, (response) => {
    console.log('Respuesta del servidor:', response);
    if (response && response.success) {
      isLoggedIn = true;
      sessionStorage.setItem('adminLoggedIn', 'true');
      sessionStorage.setItem('adminUsername', username);
      sessionStorage.setItem('adminPassword', password);
      adminLoginOverlay.classList.add('hidden');
      requestAdminData();
      loadAdminUsers();
    } else {
      console.error('Login fallido para:', username);
      loginError.textContent = 'Usuario o contraseña incorrectos';
      loginError.classList.add('show');
      adminLoginPassword.value = '';
      adminLoginUsername.focus();
    }
  });
}

adminLoginBtn.addEventListener('click', submitAdminLogin);

adminLoginUsername.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') adminLoginPassword.focus();
});
adminLoginPassword.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submitAdminLogin();
});

// DOM Elements
const totalUsersEl = document.getElementById('totalUsers');
const totalBannedEl = document.getElementById('totalBanned');
const totalRoomsEl = document.getElementById('totalRooms');
const usersContainer = document.getElementById('usersContainer');
const chatStatusDisplay = document.getElementById('chatStatusDisplay');
const startChatBtn = document.getElementById('startChatBtn');
const stopChatBtn = document.getElementById('stopChatBtn');
const banIpInput = document.getElementById('banIpInput');
const banIpBtn = document.getElementById('banIpBtn');
const bannedIpsList = document.getElementById('bannedIpsList');
const adminPasswordInput = document.getElementById('adminPassword');
const setPasswordBtn = document.getElementById('setPasswordBtn');
const passwordStatus = document.getElementById('passwordStatus');
const searchUserInput = document.getElementById('searchUser');
const changeNameModal = document.getElementById('changeNameModal');
const newNameInput = document.getElementById('newNameInput');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const adminUsersList = document.getElementById('adminUsersList');
const promoteModal = document.getElementById('promoteModal');
const promoteUsername = document.getElementById('promoteUsername');
const promoteRoleSelect = document.getElementById('promoteRoleSelect');
const changeAdminPasswordModal = document.getElementById('changeAdminPasswordModal');
const adminPasswordModalUsername = document.getElementById('adminPasswordModalUsername');
const adminNewPassword = document.getElementById('adminNewPassword');
const rulesTextInput = document.getElementById('rulesTextInput');
const saveRulesBtn = document.getElementById('saveRulesBtn');
const refreshRulesBtn = document.getElementById('refreshRulesBtn');

// State
let users = [];
let bannedIps = [];
let rooms = new Set();
let chatRunning = true;
let selectedUserId = null;
let selectedPromoteUserId = null;
let selectedAdminForPassword = null;
let hasPassword = false;
let adminUsers = [];

// Persistencia en sesión
const STORAGE_KEYS = {
  users: 'adminPanel_users',
  bannedIps: 'adminPanel_bannedIps',
  rooms: 'adminPanel_rooms',
  chatRunning: 'adminPanel_chatRunning',
  adminUsers: 'adminPanel_adminUsers',
  adminRoles: 'adminPanel_adminRoles',
  badWords: 'adminPanel_badWords',
  messageHistory: 'adminPanel_messageHistory',
  reports: 'adminPanel_reports'
};
const DEFAULT_ROLES = ['Mod Junior', 'Mod', 'Admin', 'Dueño'];

function saveState(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('No se pudo guardar estado', key, err);
  }
}

function loadState(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('No se pudo leer estado', key, err);
    return fallback;
  }
}

function restoreAdminStateFromCache() {
  const cachedUsers = loadState(STORAGE_KEYS.users);
  if (Array.isArray(cachedUsers)) {
    users = cachedUsers;
    renderUsers();
  }

  const cachedBanned = loadState(STORAGE_KEYS.bannedIps);
  if (Array.isArray(cachedBanned)) {
    bannedIps = cachedBanned;
    renderBannedIps();
  }

  const cachedRooms = loadState(STORAGE_KEYS.rooms);
  if (Array.isArray(cachedRooms)) {
    rooms = new Set(cachedRooms);
  }

  const cachedChatRunning = loadState(STORAGE_KEYS.chatRunning);
  if (typeof cachedChatRunning === 'boolean') {
    chatRunning = cachedChatRunning;
    updateChatStatus();
  }

  const cachedAdmins = loadState(STORAGE_KEYS.adminUsers);
  const cachedRoles = loadState(STORAGE_KEYS.adminRoles, DEFAULT_ROLES);
  if (Array.isArray(cachedAdmins) && cachedAdmins.length > 0) {
    adminUsers = cachedAdmins;
    renderAdminUsers(cachedRoles || DEFAULT_ROLES);
  }

  const cachedBadWords = loadState(STORAGE_KEYS.badWords);
  if (Array.isArray(cachedBadWords)) {
    badWordsList = cachedBadWords;
    renderBadWords();
  }

  const cachedHistory = loadState(STORAGE_KEYS.messageHistory);
  if (cachedHistory) {
    const historyList = document.getElementById('messageHistoryList');
    if (historyList) {
      historyList.innerHTML = Array.isArray(cachedHistory) ? cachedHistory.join('') : cachedHistory;
    }
  }

  const cachedReports = loadState(STORAGE_KEYS.reports);
  if (cachedReports) {
    const reportsList = document.getElementById('reportedMessagesList');
    if (reportsList) {
      reportsList.innerHTML = Array.isArray(cachedReports) ? cachedReports.join('') : cachedReports;
    }
  }

  updateStats();
}

// Socket events
socket.on('connect', () => {
  console.log('Admin conectado');
  if (isLoggedIn) {
    const storedUsername = sessionStorage.getItem('adminUsername');
    const storedPassword = sessionStorage.getItem('adminPassword');
    if (storedUsername && storedPassword) {
      socket.emit('adminLogin', { username: storedUsername, password: storedPassword }, (response) => {
        if (response.success) {
          console.log('Auto-relogin successful');
          requestAdminData();
          loadAdminUsers();
          socket.emit('getRulesText');
        } else {
          console.log('Auto-relogin failed');
          sessionStorage.removeItem('adminLoggedIn');
          sessionStorage.removeItem('adminUsername');
          sessionStorage.removeItem('adminPassword');
          isLoggedIn = false;
          adminLoginOverlay.classList.remove('hidden');
        }
      });
    } else {
      requestAdminData();
      loadAdminUsers();
      socket.emit('getRulesText');
    }
  }
});

socket.on('adminData', (data) => {
  users = data.users || [];
  bannedIps = data.bannedIps || [];
  rooms = new Set(data.rooms || ['global']);
  chatRunning = data.chatRunning !== false;
  saveState(STORAGE_KEYS.users, users);
  saveState(STORAGE_KEYS.bannedIps, bannedIps);
  saveState(STORAGE_KEYS.rooms, Array.from(rooms));
  saveState(STORAGE_KEYS.chatRunning, chatRunning);
  
  updateStats();
  renderUsers();
  renderBannedIps();
  updateChatStatus();
});

socket.on('userConnected', (user) => {
  users.push(user);
  saveState(STORAGE_KEYS.users, users);
  updateStats();
  renderUsers();
  showToast(`${user.username} se conectó`, 'success');
});

socket.on('userDisconnected', (userId) => {
  users = users.filter(u => u.id !== userId);
  saveState(STORAGE_KEYS.users, users);
  updateStats();
  renderUsers();
});

socket.on('userKicked', (data) => {
  showToast(`${data.username} ha sido expulsado`, 'warning');
  users = users.filter(u => u.id !== data.userId);
  saveState(STORAGE_KEYS.users, users);
  updateStats();
  renderUsers();
});

socket.on('userBanned', (data) => {
  showToast(`IP ${data.ip} ha sido baneada`, 'warning');
  bannedIps.push(data.ip);
  users = users.filter(u => u.ip !== data.ip);
  saveState(STORAGE_KEYS.bannedIps, bannedIps);
  saveState(STORAGE_KEYS.users, users);
  updateStats();
  renderUsers();
  renderBannedIps();
});

socket.on('userNameChanged', (data) => {
  const user = users.find(u => u.id === data.userId);
  if (user) {
    user.username = data.newName;
    saveState(STORAGE_KEYS.users, users);
    renderUsers();
    showToast(`Nombre cambiado a ${data.newName}`, 'success');
  }
});

socket.on('chatStatusChanged', (running) => {
  chatRunning = running;
  saveState(STORAGE_KEYS.chatRunning, chatRunning);
  updateChatStatus();
  showToast(`Chat ${running ? 'iniciado' : 'pausado'}`, running ? 'success' : 'warning');
});

socket.on('passwordSet', () => {
  hasPassword = true;
  passwordStatus.textContent = 'Estado: Contraseña establecida ✓';
  passwordStatus.style.color = 'var(--success)';
  adminPasswordInput.value = '';
  showToast('Contraseña establecida', 'success');
});

socket.on('adminUsersList', (data) => {
  console.log('Received admin users data:', data);
  adminUsers = data.admins || [];
  console.log('Updated adminUsers:', adminUsers);
  const roles = data.roles || DEFAULT_ROLES;
  saveState(STORAGE_KEYS.adminUsers, adminUsers);
  saveState(STORAGE_KEYS.adminRoles, roles);
  renderAdminUsers(roles);
});

socket.on('rulesText', (text) => {
  console.log('Rules text received:', text);
  if (rulesTextInput) {
    rulesTextInput.value = text || '';
    console.log('Rules text set to input');
  } else {
    console.warn('rulesTextInput element not found');
  }
});

socket.on('userPromoted', (data) => {
  showToast(`${data.username} promovido a ${data.role}`, 'success');
  loadAdminUsers();
});

socket.on('adminRegistered', (data) => {
  showToast(`${data.username} registrado como ${data.role}`, 'success');
  loadAdminUsers();
});

socket.on('userDemoted', (data) => {
  showToast(`${data.username} removido de administradores`, 'warning');
  loadAdminUsers();
});

socket.on('userRoleChanged', (data) => {
  showToast(`Rol de ${data.username} cambiado a ${data.newRole}`, 'success');
  loadAdminUsers();
});

// Functions
function requestAdminData() {
  socket.emit('getAdminData');
}

function updateStats() {
  totalUsersEl.textContent = users.length;
  totalBannedEl.textContent = bannedIps.length;
  totalRoomsEl.textContent = rooms.size;
}

function updateChatStatus() {
  if (chatRunning) {
    chatStatusDisplay.innerHTML = '<span style="color:var(--success)">✓ Estado: Chat Activo</span>';
    startChatBtn.disabled = true;
    stopChatBtn.disabled = false;
  } else {
    chatStatusDisplay.innerHTML = '<span style="color:var(--danger)">✗ Estado: Chat Pausado</span>';
    startChatBtn.disabled = false;
    stopChatBtn.disabled = true;
  }
}

function loadAdminUsers() {
  console.log('loadAdminUsers called');
  socket.emit('getAdminUsers');
}

function refreshUsers() {
  socket.emit('getAdminData');
  showToast('Datos actualizados', 'success');
}

function renderAdminUsers(availableRoles) {
  console.log('renderAdminUsers called with:', adminUsers);
  if (!adminUsers || adminUsers.length === 0) {
    adminUsersList.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem;padding:12px">No hay administradores asignados. Haz clic en "Ver Administradores" para cargar.</p>';
    return;
  }

  adminUsersList.innerHTML = `
    <div class="admin-users-list">
      ${adminUsers.map(admin => {
        const roleClass = (admin.role || '').toLowerCase().replace(/\s+/g, '-');
        return `
          <div class="admin-user-item" style="padding:12px;background:var(--bg-light);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
            <div class="admin-user-info">
              <div class="name" style="font-weight:600">${admin.username}</div>
              <span class="role-badge ${roleClass}" style="display:inline-block;padding:4px 8px;background:var(--primary);color:white;border-radius:4px;font-size:0.8rem">${admin.role}</span>
            </div>
            <div class="admin-user-actions" style="display:flex;gap:8px">
              <button onclick="openAdminPasswordModal('${admin.id}', '${admin.username}')" style="padding:6px 10px;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem">🔐 Contraseña</button>
              <button class="demote-btn" onclick="demoteAdmin('${admin.id}', '${admin.username}')" style="padding:6px 10px;background:var(--danger);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem">⬇️ Quitar</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderUsers() {
  const search = searchUserInput.value.toLowerCase();
  const filtered = users.filter(u => u.username.toLowerCase().includes(search));

  if (filtered.length === 0) {
    usersContainer.innerHTML = '<div class="empty-state"><p>No hay usuarios conectados</p></div>';
    return;
  }

  usersContainer.innerHTML = `
    <table class="users-table">
      <thead>
        <tr>
          <th>Usuario</th>
          <th>IP</th>
          <th>Sala</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(user => `
          <tr>
            <td>
              <div class="user-row">
                <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                  <div class="name">${user.username}</div>
                  <div class="details">ID: ${user.id.substring(0, 8)}...</div>
                </div>
              </div>
            </td>
            <td style="font-family:monospace;font-size:0.85rem">${user.ip}</td>
            <td>#${user.room}</td>
            <td>
              <div class="action-buttons">
                <button class="edit-name" onclick="openChangeNameModal('${user.id}', '${user.username}')">✏️ Nombre</button>
                <button class="promote-btn" onclick="openPromoteModal('${user.id}', '${user.username}')">👑 Promover</button>
                <button class="kick" onclick="kickUser('${user.id}', '${user.username}')">⛔ Kick</button>
                <button class="ban" onclick="banUser('${user.ip}', '${user.username}')">🚫 Ban</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderBannedIps() {
  if (bannedIps.length === 0) {
    bannedIpsList.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem">No hay IPs baneadas</p>';
    return;
  }

  bannedIpsList.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${bannedIps.map(ip => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg-light);border-radius:6px">
          <code style="font-size:0.85rem">${ip}</code>
          <button onclick="unbanIp('${ip}')" style="padding:4px 8px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem">Desbanear</button>
        </div>
      `).join('')}
    </div>
  `;
}

function kickUser(userId, username) {
  if (confirm(`¿Expulsar a ${username}?`)) {
    socket.emit('adminKick', { userId });
    autoLogDatabaseRecord(`Usuario Expulsado: ${username}`, `Acción realizada el ${new Date().toLocaleString('es-ES')}`, 'notas');
  }
}

function banUser(ip, username) {
  if (confirm(`¿Banear la IP ${ip} de ${username}?`)) {
    socket.emit('adminBan', { ip, username });
    autoLogDatabaseRecord(`IP Baneada: ${ip}`, `Usuario: ${username}`, 'notas');
  }
}

function unbanIp(ip) {
  if (confirm(`¿Desbanear la IP ${ip}?`)) {
    socket.emit('adminUnban', { ip });
    bannedIps = bannedIps.filter(i => i !== ip);
    saveState(STORAGE_KEYS.bannedIps, bannedIps);
    renderBannedIps();
    updateStats();
    showToast(`IP ${ip} desbaneada`, 'success');
  }
}

function openChangeNameModal(userId, currentName) {
  selectedUserId = userId;
  newNameInput.value = currentName;
  changeNameModal.classList.add('active');
  newNameInput.focus();
}

function closeModal() {
  changeNameModal.classList.remove('active');
  selectedUserId = null;
}

function confirmChangeName() {
  const newName = newNameInput.value.trim();
  if (!newName) {
    showToast('El nombre no puede estar vacío', 'error');
    return;
  }
  if (newName.length > 30) {
    showToast('El nombre es muy largo', 'error');
    return;
  }
  socket.emit('adminChangeName', { userId: selectedUserId, newName });
  autoLogDatabaseRecord(`Nombre de Usuario Cambiado`, `Nuevo nombre: ${newName}`, 'notas');
  closeModal();
}

function addAdminByName() {
  const username = document.getElementById('addAdminUsername').value.trim();
  const password = document.getElementById('addAdminPassword').value.trim();
  const role = document.getElementById('addAdminRole').value;
  
  if (!username) {
    showToast('Ingresa un nombre de usuario', 'error');
    return;
  }
  
  if (!password) {
    showToast('Ingresa una contraseña', 'error');
    return;
  }
  
  if (password.length < 6) {
    showToast('La contraseña debe tener mínimo 6 caracteres', 'error');
    return;
  }
  
  console.log('Registrando admin:', username, role, password);
  socket.emit('registerAdmin', { username, role, password }, (res) => {
    console.log('Respuesta registerAdmin:', res);
    if (res && res.success) {
      document.getElementById('addAdminUsername').value = '';
      document.getElementById('addAdminPassword').value = '';
      autoLogDatabaseRecord(`Admin Registrado: ${username}`, `Rol: ${role}`, 'usuarios');
      showToast(`✓ ${username} registrado como ${role}`, 'success');
      // El servidor ya envió adminUsersList, pero recargamos por si acaso
      setTimeout(() => loadAdminUsers(), 300);
    } else {
      showToast('Error: ' + (res?.message || 'No se pudo registrar'), 'error');
    }
  });
}

function openPromoteModal(userId, username) {
  selectedPromoteUserId = userId;
  promoteUsername.textContent = username;
  promoteModal.classList.add('active');
}

function closePromoteModal() {
  promoteModal.classList.remove('active');
  selectedPromoteUserId = null;
}

function openAdminPasswordModal(adminId, adminUsername) {
  selectedAdminForPassword = adminId;
  adminPasswordModalUsername.textContent = adminUsername;
  changeAdminPasswordModal.classList.add('active');
  adminNewPassword.value = '';
  adminNewPassword.focus();
}

function closeAdminPasswordModal() {
  changeAdminPasswordModal.classList.remove('active');
  selectedAdminForPassword = null;
  adminNewPassword.value = '';
}

function confirmPromote() {
  const role = promoteRoleSelect.value;
  if (!role) {
    showToast('Selecciona un rol', 'error');
    return;
  }
  socket.emit('promoteToAdmin', { userId: selectedPromoteUserId, role });
  autoLogDatabaseRecord(`Usuario Promovido a ${role}`, `ID: ${selectedPromoteUserId}`, 'usuarios');
  closePromoteModal();
}

function confirmChangeAdminPassword() {
  const newPassword = adminNewPassword.value.trim();
  if (!newPassword) {
    showToast('Ingresa una contraseña', 'error');
    return;
  }
  if (newPassword.length < 6) {
    showToast('Mínimo 6 caracteres', 'error');
    return;
  }
  socket.emit('setAdminPassword', { adminId: selectedAdminForPassword, password: newPassword });
  closeAdminPasswordModal();
  showToast('Contraseña actualizada', 'success');
}

function changeUserRole(userId, newRole) {
  if (!newRole) return;
  if (confirm(`¿Cambiar rol a ${newRole}?`)) {
    socket.emit('changeUserRole', { userId, newRole });
  }
}

function demoteAdmin(userId, username) {
  if (typeof userId === 'string' && !userId.includes('-')) {
    if (confirm(`¿Remover permisos de administrador de ${username}?`)) {
      socket.emit('demoteAdmin', { userId });
    }
    return;
  }
  if (confirm(`¿Remover permisos de administrador de ${username}?`)) {
    socket.emit('demoteAdmin', { userId });
  }
}

// (segunda definición eliminada)

function showToast(message, type = 'info') {
  toastMessage.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Event listeners
startChatBtn.addEventListener('click', () => {
  socket.emit('adminStartChat');
  autoLogDatabaseRecord('Chat Iniciado', `Iniciado el ${new Date().toLocaleString('es-ES')}`, 'config');
});

stopChatBtn.addEventListener('click', () => {
  if (confirm('¿Parar el chat? Los usuarios podrán ver un mensaje.')) {
    socket.emit('adminStopChat');
    autoLogDatabaseRecord('Chat Pausado', `Pausado el ${new Date().toLocaleString('es-ES')}`, 'config');
  }
});

banIpBtn.addEventListener('click', () => {
  const ip = banIpInput.value.trim();
  if (!ip) {
    showToast('Ingresa una IP', 'error');
    return;
  }
  if (bannedIps.includes(ip)) {
    showToast('Esta IP ya está baneada', 'warning');
    return;
  }
  socket.emit('adminBan', { ip, username: 'Manual' });
  autoLogDatabaseRecord(`IP Baneada Manualmente: ${ip}`, `Baneo manual realizado`, 'notas');
  banIpInput.value = '';
});

setPasswordBtn.addEventListener('click', () => {
  const password = adminPasswordInput.value.trim();
  if (!password || password.length < 6) {
    showToast('Contraseña mínimo 6 caracteres', 'error');
    return;
  }
  socket.emit('adminSetPassword', { password });
  autoLogDatabaseRecord('Contraseña Admin Actualizada', 'Nueva contraseña establecida el ' + new Date().toLocaleString('es-ES'), 'config');
});

searchUserInput.addEventListener('input', () => {
  renderUsers();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && changeNameModal.classList.contains('active')) {
    closeModal();
  }
  if (e.key === 'Escape' && promoteModal.classList.contains('active')) {
    closePromoteModal();
  }
  if (e.key === 'Escape' && changeAdminPasswordModal.classList.contains('active')) {
    closeAdminPasswordModal();
  }
  if (e.key === 'Enter' && changeNameModal.classList.contains('active')) {
    confirmChangeName();
  }
  if (e.key === 'Enter' && promoteModal.classList.contains('active')) {
    confirmPromote();
  }
  if (e.key === 'Enter' && changeAdminPasswordModal.classList.contains('active')) {
    confirmChangeAdminPassword();
  }
});

// Toggle collapsible sections
// Abrir menú por defecto
window.addEventListener('DOMContentLoaded', () => {
  // Sidebar ya está visible por defecto
});

function showSection(sectionName) {
  // Ocultar todas las secciones
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Remover active de todos los items del menú
  document.querySelectorAll('.sidebar-link').forEach(item => {
    item.classList.remove('active');
  });
  
  // Mostrar la sección seleccionada
  const section = document.getElementById(`section-${sectionName}`);
  if (section) {
    section.classList.add('active');
  }
  
  // Activar el item del menú correspondiente
  if (event && event.target) {
    let link = event.target.closest('.sidebar-link');
    if (link) link.classList.add('active');
  }
  
  // Cargar datos específicos de la sección
  if (sectionName === 'admins') {
    loadAdminUsers();
  } else if (sectionName === 'users') {
    refreshUsers();
  } else if (sectionName === 'ban') {
    socket.emit('getAdminData');
  } else if (sectionName === 'history') {
    loadMessageHistory();
  } else if (sectionName === 'reports') {
    loadReportedMessages();
  } else if (sectionName === 'filter') {
    loadBadWords();
  } else if (sectionName === 'analytics') {
    loadAnalytics();
  } else if (sectionName === 'chat') {
    socket.emit('getRulesText');
  } else if (sectionName === 'rules') {
    socket.emit('getRulesText');
  }
}

// ===== NUEVAS FUNCIONES PARA HISTORIAL, ANUNCIOS Y REPORTES =====

// Cargar historial de mensajes
function loadMessageHistory() {
  socket.emit('getMessageHistory');
}

socket.on('messageHistory', (messages) => {
  const historyList = document.getElementById('messageHistoryList');
  if (!historyList) return;
  
  if (messages.length === 0) {
    const markup = '<div style="padding:20px;text-align:center;color:var(--text-secondary)">No hay mensajes en el historial</div>';
    historyList.innerHTML = markup;
    saveState(STORAGE_KEYS.messageHistory, markup);
    return;
  }
  
  const markup = messages.map(msg => {
    const date = new Date(msg.time);
    const timeStr = date.toLocaleTimeString('es-ES');
    return `
      <div style="padding:12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:start">
        <div style="flex:1">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
            <strong style="color:var(--text-primary)">${msg.username || 'Anon'}</strong>
            <span style="font-size:0.75rem;color:var(--text-secondary)">${timeStr}</span>
            <span style="font-size:0.7rem;padding:2px 6px;background:var(--bg-light);border-radius:4px">${msg.room || 'global'}</span>
          </div>
          <div style="color:var(--text-primary);word-break:break-word">${msg.message || ''}</div>
        </div>
      </div>
    `;
  }).join('');
  historyList.innerHTML = markup;
  saveState(STORAGE_KEYS.messageHistory, markup);
});

// Enviar anuncio
function sendAnnouncement() {
  const text = document.getElementById('announcementText');
  if (!text || !text.value.trim()) {
    showToast('Escribe un mensaje de anuncio', 'warning');
    return;
  }
  
  socket.emit('sendAnnouncement', { message: text.value.trim() });
  autoLogDatabaseRecord(`Anuncio Enviado`, text.value.trim().substring(0, 100), 'notas');
  text.value = '';
  showToast('Anuncio enviado correctamente', 'success');
}

// Cargar mensajes reportados
function loadReportedMessages() {
  socket.emit('getReportedMessages');
}

socket.on('reportedMessages', (reports) => {
  const reportsList = document.getElementById('reportedMessagesList');
  if (!reportsList) return;
  
  if (reports.length === 0) {
    const markup = '<div style="padding:20px;text-align:center;color:var(--text-secondary)">No hay mensajes reportados</div>';
    reportsList.innerHTML = markup;
    saveState(STORAGE_KEYS.reports, markup);
    return;
  }
  
  const markup = reports.map(report => {
    const date = new Date(report.time);
    const timeStr = date.toLocaleTimeString('es-ES');
    return `
      <div style="padding:12px;border-bottom:1px solid var(--border);background:rgba(211,47,47,0.05)">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <strong style="color:var(--danger)">Reportado por: ${report.reportedBy}</strong>
            <span style="font-size:0.75rem;color:var(--text-secondary);margin-left:8px">${timeStr}</span>
          </div>
        </div>
        <div style="padding:8px;background:white;border-radius:4px;margin-bottom:8px">
          <strong>Mensaje:</strong> ${report.messageText || 'N/A'}
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary)">
          <strong>Razón:</strong> ${report.reason}
        </div>
      </div>
    `;
  }).join('');
  reportsList.innerHTML = markup;
  saveState(STORAGE_KEYS.reports, markup);
});

// Silenciar usuario
function muteUser() {
  const username = document.getElementById('muteUsername')?.value.trim();
  const duration = parseInt(document.getElementById('muteDuration')?.value || 10);
  const reason = document.getElementById('muteReason')?.value.trim() || 'No especificado';
  
  if (!username) {
    showToast('Ingresa un nombre de usuario', 'warning');
    return;
  }
  
  if (duration < 1 || duration > 1440) {
    showToast('La duración debe estar entre 1 y 1440 minutos', 'warning');
    return;
  }
  
  socket.emit('muteUser', { username, duration, reason });
  
  // Limpiar formulario
  document.getElementById('muteUsername').value = '';
  document.getElementById('muteDuration').value = '10';
  document.getElementById('muteReason').value = '';
}

// Escuchar mensajes del sistema
socket.on('system', (message) => {
  showToast(message, 'success');
});

// ===== FILTRO DE PALABRAS =====
let badWordsList = [];

function loadBadWords() {
  socket.emit('getFilteredWords');
}

socket.on('filteredWords', (words) => {
  badWordsList = words;
  saveState(STORAGE_KEYS.badWords, badWordsList);
  renderBadWords();
});

function renderBadWords() {
  const container = document.getElementById('badWordsList');
  if (!container) return;
  
  if (badWordsList.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);padding:12px">No hay palabras filtradas</p>';
    return;
  }
  
  container.innerHTML = badWordsList.map(word => 
    `<div class="word-badge">
      <span>${word}</span>
      <button onclick="removeBadWord('${word}')" title="Eliminar">✕</button>
    </div>`
  ).join('');
}

function addBadWord() {
  const input = document.getElementById('newBadWord');
  const word = input.value.trim();
  
  if (!word) {
    showToast('Ingresa una palabra', 'warning');
    return;
  }
  
  if (badWordsList.includes(word.toLowerCase())) {
    showToast('Esta palabra ya está filtrada', 'warning');
    return;
  }
  
  socket.emit('addFilteredWord', word);
  autoLogDatabaseRecord(`Palabra Filtrada: ${word}`, 'Agregada al filtro de palabras prohibidas', 'config');
  input.value = '';
  showToast(`Palabra "${word}" agregada al filtro`, 'success');
}

function removeBadWord(word) {
  if (confirm(`¿Eliminar "${word}" del filtro?`)) {
    socket.emit('removeFilteredWord', word);
    showToast(`Palabra "${word}" eliminada`, 'success');
  }
}
window.addBadWord = addBadWord;
window.removeBadWord = removeBadWord;
window.loadBadWords = loadBadWords;

// ===== MONITOREO EN VIVO =====
let isMonitoring = false;

function startLiveMonitor() {
  isMonitoring = true;
  socket.emit('startLiveMonitoring');
  document.getElementById('startMonitorBtn').style.display = 'none';
  document.getElementById('stopMonitorBtn').style.display = 'block';
  document.getElementById('liveMessageFeed').style.display = 'block';
  document.getElementById('liveMessageFeed').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary)">Esperando mensajes...</div>';
  showToast('Monitoreo en vivo iniciado', 'success');
}

function stopLiveMonitor() {
  isMonitoring = false;
  socket.emit('stopLiveMonitoring');
  document.getElementById('startMonitorBtn').style.display = 'block';
  document.getElementById('stopMonitorBtn').style.display = 'none';
  showToast('Monitoreo detenido', 'warning');
}

socket.on('liveMessage', (msg) => {
  if (!isMonitoring) return;
  
  const feed = document.getElementById('liveMessageFeed');
  if (!feed) return;
  
  if (feed.querySelector('div[style*="Esperando mensajes"]')) {
    feed.innerHTML = '';
  }
  
  const time = new Date(msg.time).toLocaleTimeString('es-ES');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'live-message';
  msgDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <strong style="color:var(--primary)">${msg.username}</strong>
      <span style="font-size:0.75rem;color:var(--text-secondary)">${time} - #${msg.room}</span>
    </div>
    <div style="color:var(--text-primary)">${msg.message || '[imagen]'}</div>
  `;
  
  feed.insertBefore(msgDiv, feed.firstChild);
  
  // Limitar a 50 mensajes
  while (feed.children.length > 50) {
    feed.removeChild(feed.lastChild);
  }
});

window.startLiveMonitor = startLiveMonitor;
window.stopLiveMonitor = stopLiveMonitor;

// ===== ANALÍTICAS =====
let analyticsData = null;

function loadAnalytics() {
  socket.emit('getLiveStats');
  showToast('Cargando estadísticas...', 'success');
}

socket.on('liveStats', (stats) => {
  analyticsData = stats;
  renderAnalytics();
});

function renderAnalytics() {
  if (!analyticsData) return;
  
  // Actualizar contadores
  const totalMsgsEl = document.getElementById('totalMessagesCount');
  if (totalMsgsEl) totalMsgsEl.textContent = analyticsData.messageCount || 0;
  
  const avgMsgs = analyticsData.totalUsers > 0 
    ? Math.round(analyticsData.messageCount / analyticsData.totalUsers) 
    : 0;
  const avgEl = document.getElementById('avgMessagesPerUser');
  if (avgEl) avgEl.textContent = avgMsgs;
  
  const mostActive = analyticsData.activeRooms
    .sort((a, b) => b.users - a.users)[0];
  const mostActiveEl = document.getElementById('mostActiveRoom');
  if (mostActiveEl) mostActiveEl.textContent = mostActive ? `#${mostActive.name}` : '-';
  
  // Gráfico de salas
  const roomChart = document.getElementById('roomChart');
  if (roomChart) {
    roomChart.innerHTML = '';
    const maxUsers = Math.max(...analyticsData.activeRooms.map(r => r.users), 1);
    
    analyticsData.activeRooms.forEach(room => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      const height = (room.users / maxUsers) * 100;
      bar.style.height = `${height}%`;
      
      const label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = `#${room.name}`;
      
      const value = document.createElement('div');
      value.className = 'bar-value';
      value.textContent = room.users;
      
      bar.appendChild(value);
      bar.appendChild(label);
      roomChart.appendChild(bar);
    });
  }
  
  // Gráfico de actividad reciente
  const activityChart = document.getElementById('activityChart');
  if (activityChart && analyticsData.recentActivity) {
    activityChart.innerHTML = '';
    const activity = analyticsData.recentActivity.slice(-10);
    
    activity.forEach((msg, idx) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${(idx + 1) * 10}%`;
      
      const label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = msg.username.substring(0, 8);
      
      bar.appendChild(label);
      activityChart.appendChild(bar);
    });
  }
  
  showToast('Estadísticas actualizadas', 'success');
}

window.loadAnalytics = loadAnalytics;

// ===== AUTO-LOG PARA BASE DE DATOS =====
function autoLogDatabaseRecord(key, value, category = 'general') {
  socket.emit('addDatabaseRecord', { key, value, category }, (response) => {
    if (response.success) {
      console.log('Registro automático guardado:', key);
    }
  });
}

// ===== BASE DE DATOS PERSONAL =====
let dbRecords = [];

function addDatabaseRecord() {
  const key = document.getElementById('dbKey')?.value.trim();
  const value = document.getElementById('dbValue')?.value.trim();
  const category = document.getElementById('dbCategory')?.value || 'general';
  
  if (!key || !value) {
    showToast('Completa todos los campos', 'warning');
    return;
  }
  
  socket.emit('addDatabaseRecord', { key, value, category }, (response) => {
    if (response.success) {
      document.getElementById('dbKey').value = '';
      document.getElementById('dbValue').value = '';
      showToast(`Registro "${key}" agregado`, 'success');
      loadDatabaseRecords();
    } else {
      showToast('Error al agregar registro', 'error');
    }
  });
}

function loadDatabaseRecords() {
  socket.emit('getDatabaseRecords', (response) => {
    if (response && response.records) {
      dbRecords = response.records;
      renderDatabaseRecords();
    }
  });
}

function renderDatabaseRecords() {
  const tbody = document.getElementById('databaseTableBody');
  if (!tbody) return;
  
  if (dbRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary)">No hay registros. Agrega uno nuevo.</td></tr>';
    return;
  }
  
  tbody.innerHTML = dbRecords.map(record => {
    const date = new Date(record.createdAt).toLocaleDateString('es-ES');
    return `
      <tr>
        <td><strong>${record.key}</strong></td>
        <td>${record.value}</td>
        <td><span style="padding:2px 8px;background:var(--bg-light);border-radius:4px;font-size:0.8rem">${record.category}</span></td>
        <td style="font-size:0.85rem;color:var(--text-secondary)">${date}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button onclick="editDatabaseRecord('${record._id}', '${record.key}')" style="padding:4px 8px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem">✏️</button>
            <button onclick="deleteDatabaseRecord('${record._id}', '${record.key}')" style="padding:4px 8px;background:var(--danger);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function editDatabaseRecord(id, key) {
  const record = dbRecords.find(r => r._id === id);
  if (!record) return;
  
  const newValue = prompt(`Editar registro: ${key}`, record.value);
  if (newValue === null) return;
  
  socket.emit('updateDatabaseRecord', { id, value: newValue }, (response) => {
    if (response.success) {
      showToast(`Registro "${key}" actualizado`, 'success');
      loadDatabaseRecords();
    } else {
      showToast('Error al actualizar', 'error');
    }
  });
}

function deleteDatabaseRecord(id, key) {
  if (!confirm(`¿Eliminar el registro "${key}"?`)) return;
  
  socket.emit('deleteDatabaseRecord', { id }, (response) => {
    if (response.success) {
      showToast(`Registro "${key}" eliminado`, 'success');
      loadDatabaseRecords();
    } else {
      showToast('Error al eliminar', 'error');
    }
  });
}

// Cargar registros cuando se abre la sección
socket.on('databaseRecords', (records) => {
  dbRecords = records;
  renderDatabaseRecords();
});

// Exponer funciones globales
window.addDatabaseRecord = addDatabaseRecord;
window.loadDatabaseRecords = loadDatabaseRecords;
window.editDatabaseRecord = editDatabaseRecord;
window.deleteDatabaseRecord = deleteDatabaseRecord;

// Auto-cargar cuando se abre la sección
const originalShowSection = window.showSection;
window.showSection = function(sectionName) {
  originalShowSection(sectionName);
  if (sectionName === 'database') {
    loadDatabaseRecords();
  }
};

// ===== INICIALIZACIÓN DE REGLAS =====
// Configurar event listeners para los botones de reglas
if (saveRulesBtn) {
  saveRulesBtn.addEventListener('click', () => {
    const text = rulesTextInput?.value || '';
    socket.emit('setRulesText', { text });
    showToast('Reglas guardadas correctamente', 'success');
  });
}

if (refreshRulesBtn) {
  refreshRulesBtn.addEventListener('click', () => {
    socket.emit('getRulesText');
    showToast('Reglas actualizadas', 'success');
  });
}
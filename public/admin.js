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
    }
  }
});

socket.on('adminData', (data) => {
  users = data.users || [];
  bannedIps = data.bannedIps || [];
  rooms = new Set(data.rooms || ['global']);
  chatRunning = data.chatRunning !== false;
  
  updateStats();
  renderUsers();
  renderBannedIps();
  updateChatStatus();
  loadAdminUsers();
});

socket.on('userConnected', (user) => {
  users.push(user);
  updateStats();
  renderUsers();
  showToast(`${user.username} se conectó`, 'success');
});

socket.on('userDisconnected', (userId) => {
  users = users.filter(u => u.id !== userId);
  updateStats();
  renderUsers();
});

socket.on('userKicked', (data) => {
  showToast(`${data.username} ha sido expulsado`, 'warning');
  users = users.filter(u => u.id !== data.userId);
  updateStats();
  renderUsers();
});

socket.on('userBanned', (data) => {
  showToast(`IP ${data.ip} ha sido baneada`, 'warning');
  bannedIps.push(data.ip);
  users = users.filter(u => u.ip !== data.ip);
  updateStats();
  renderUsers();
  renderBannedIps();
});

socket.on('userNameChanged', (data) => {
  const user = users.find(u => u.id === data.userId);
  if (user) {
    user.username = data.newName;
    renderUsers();
    showToast(`Nombre cambiado a ${data.newName}`, 'success');
  }
});

socket.on('chatStatusChanged', (running) => {
  chatRunning = running;
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
  renderAdminUsers(data.roles || ['Mod Junior', 'Mod', 'Admin', 'Dueño']);
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
  socket.emit('getAdminUsers');
  socket.emit('getAdminData');
}

function renderAdminUsers(availableRoles) {
  if (!adminUsers || adminUsers.length === 0) {
    adminUsersList.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem;padding:12px">No hay administradores asignados</p>';
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
              <select class="role-select" onchange="changeUserRole('${admin.id}', this.value)" style="padding:6px;border:1px solid var(--border);border-radius:4px;font-size:0.85rem">
                <option value="">Cambiar rol</option>
                ${availableRoles.map(role => `<option value="${role}">${role}</option>`).join('')}
              </select>
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
  }
}

function banUser(ip, username) {
  if (confirm(`¿Banear la IP ${ip} de ${username}?`)) {
    socket.emit('adminBan', { ip, username });
  }
}

function unbanIp(ip) {
  if (confirm(`¿Desbanear la IP ${ip}?`)) {
    socket.emit('adminUnban', { ip });
    bannedIps = bannedIps.filter(i => i !== ip);
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
  
  console.log('Registering admin:', username, role);
  socket.emit('registerAdmin', { username, role, password }, (res) => {
    if (res && res.success) {
      showToast(`${username} registrado como ${role}`, 'success');
      loadAdminUsers();
    } else {
      showToast(res?.message || 'No se pudo registrar', 'error');
    }
  });
  document.getElementById('addAdminUsername').value = '';
  document.getElementById('addAdminPassword').value = '';
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
});

stopChatBtn.addEventListener('click', () => {
  if (confirm('¿Parar el chat? Los usuarios podrán ver un mensaje.')) {
    socket.emit('adminStopChat');
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
  banIpInput.value = '';
});

setPasswordBtn.addEventListener('click', () => {
  const password = adminPasswordInput.value.trim();
  if (!password || password.length < 6) {
    showToast('Contraseña mínimo 6 caracteres', 'error');
    return;
  }
  socket.emit('adminSetPassword', { password });
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
function toggleNavMenu() {
  const navMenuItems = document.getElementById('navMenuItems');
  const icon = document.querySelector('.nav-menu-icon');
  navMenuItems.classList.toggle('active');
  icon.textContent = navMenuItems.classList.contains('active') ? '▼' : '▶';
}

// Abrir menú por defecto
window.addEventListener('DOMContentLoaded', () => {
  const navMenuItems = document.getElementById('navMenuItems');
  if (navMenuItems) {
    navMenuItems.classList.add('active');
  }
});

function showSection(sectionName) {
  // Ocultar todas las secciones
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Remover active de todos los items del menú
  document.querySelectorAll('.nav-menu-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Mostrar la sección seleccionada
  const section = document.getElementById(`section-${sectionName}`);
  if (section) {
    section.classList.add('active');
  }
  
  // Activar el item del menú correspondiente
  event.target.classList.add('active');
  
  // Cargar datos específicos de la sección
  if (sectionName === 'admins') {
    loadAdminUsers();
  } else if (sectionName === 'users') {
    refreshUsers();
  } else if (sectionName === 'ban') {
    socket.emit('getAdminData');
  }
}

// Initial load
if (isLoggedIn) {
  requestAdminData();
  loadAdminUsers();
}

// Cargar admins cuando el usuario haga login exitoso
socket.on('connect', () => {
  if (isLoggedIn) {
    setTimeout(() => {
      requestAdminData();
      loadAdminUsers();
    }, 1000);
  }
});

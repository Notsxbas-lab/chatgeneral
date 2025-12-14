const socket = io();

// Login
const adminLoginOverlay = document.getElementById('adminLoginOverlay');
const adminLoginPassword = document.getElementById('adminLoginPassword');
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

window.submitAdminLogin = function() {
  const password = adminLoginPassword.value.trim();
  if (!password) {
    loginError.classList.add('show');
    return;
  }

  // Enviar contraseña al servidor para validar
  socket.emit('adminLogin', { password }, (response) => {
    if (response.success) {
      isLoggedIn = true;
      sessionStorage.setItem('adminLoggedIn', 'true');
      sessionStorage.setItem('adminPassword', password); // Store password for reconnect
      adminLoginOverlay.classList.add('hidden');
      requestAdminData();
    } else {
      loginError.classList.add('show');
      adminLoginPassword.value = '';
      adminLoginPassword.focus();
    }
  });
};

// Permitir login con Enter
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

// State
let users = [];
let bannedIps = [];
let rooms = new Set();
let chatRunning = true;
let selectedUserId = null;
let selectedPromoteUserId = null;
let hasPassword = false;
let adminUsers = [];

// Socket events
socket.on('connect', () => {
  console.log('Admin conectado');
  if (isLoggedIn) {
    // Auto-relogin on reconnect
    const storedPassword = sessionStorage.getItem('adminPassword');
    if (storedPassword) {
      socket.emit('adminLogin', { password: storedPassword }, (response) => {
        if (response.success) {
          console.log('Auto-relogin successful');
          requestAdminData();
        } else {
          console.log('Auto-relogin failed');
          // Clear stored credentials if password changed
          sessionStorage.removeItem('adminLoggedIn');
          sessionStorage.removeItem('adminPassword');
          isLoggedIn = false;
          adminLoginOverlay.classList.remove('hidden');
        }
      });
    } else {
      requestAdminData();
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
  adminUsers = data.admins || [];
  renderAdminUsers(data.roles || []);
});

socket.on('userPromoted', (data) => {
  showToast(`${data.username} promovido a ${data.role}`, 'success');
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

function refreshUsers() {
  socket.emit('getAdminData');
  showToast('Datos actualizados', 'success');
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

function loadAdminUsers() {
  socket.emit('getAdminUsers');
}

function renderAdminUsers(availableRoles) {
  if (adminUsers.length === 0) {
    adminUsersList.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem;padding:12px">No hay administradores asignados</p>';
    return;
  }

  adminUsersList.innerHTML = `
    <div class="admin-users-list">
      ${adminUsers.map(admin => {
        const roleClass = admin.role.toLowerCase().replace(' ', '-');
        return `
          <div class="admin-user-item">
            <div class="admin-user-info">
              <div class="name">${admin.username}</div>
              <span class="role-badge ${roleClass}">${admin.role}</span>
            </div>
            <div class="admin-user-actions">
              <select class="role-select" onchange="changeUserRole('${admin.id}', this.value)">
                <option value="">Cambiar rol...</option>
                ${availableRoles.map(role => `<option value="${role}">${role}</option>`).join('')}
              </select>
              <button class="demote-btn" onclick="demoteAdmin('${admin.id}', '${admin.username}')">⬇️ Degradar</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
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

function confirmPromote() {
  const role = promoteRoleSelect.value;
  if (!role) {
    showToast('Selecciona un rol', 'error');
    return;
  }
  socket.emit('promoteToAdmin', { userId: selectedPromoteUserId, role });
  closePromoteModal();
}

function changeUserRole(userId, newRole) {
  if (!newRole) return;
  if (confirm(`¿Cambiar rol a ${newRole}?`)) {
    socket.emit('changeUserRole', { userId, newRole });
  }
}

function demoteAdmin(userId, username) {
  if (confirm(`¿Remover permisos de administrador de ${username}?`)) {
    socket.emit('demoteAdmin', { userId });
  }
}

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
  if (e.key === 'Enter' && changeNameModal.classList.contains('active')) {
    confirmChangeName();
  }
  if (e.key === 'Enter' && promoteModal.classList.contains('active')) {
    confirmPromote();
  }
});

// Initial load - solo si está logged in
if (isLoggedIn) {
  requestAdminData();
}

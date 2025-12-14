const socket = io();

const messages = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const usernameInput = document.getElementById('username');
const setNameBtn = document.getElementById('setName');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const emojiBtn = document.getElementById('emojiBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const newRoomInput = document.getElementById('newRoomInput');
const roomsContainer = document.getElementById('roomsContainer');
const currentRoomEl = document.getElementById('currentRoom');
const userDisplay = document.getElementById('userDisplay');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');

// Profile
const profileBtn = document.getElementById('profileBtn');
const profileOverlay = document.getElementById('profileOverlay');
const profileModal = document.getElementById('profileModal');
const profileName = document.getElementById('profileName');
const profileEmoji = document.getElementById('profileEmoji');
const profileAvatarPreview = document.getElementById('profileAvatarPreview');
const colorPicker = document.getElementById('colorPicker');
const bgColorPicker = document.getElementById('bgColorPicker');
const profileImageInput = document.getElementById('profileImageInput');
const saveProfileBtn = document.getElementById('saveProfile');
const closeProfileBtn = document.getElementById('closeProfile');

// Kicked Modal
const kickedModal = document.getElementById('kickedModal');

let username = '';
let profileEmojis = '😊';
let profileColor = '#00b4d8';
let profileImage = '';
let bgColor = '#fafbff';
let currentRoom = 'global';
const rooms = new Set(['global']);

const avatarColors = ['#00b4d8', '#ff006e', '#00d084', '#ffd60a', '#fd7792', '#a100f2', '#ff4757', '#26de81'];
const bgColors = ['#fafbff', '#f0f9ff', '#fff8f0', '#f8fff0', '#f0ffff', '#fef0ff', '#fffaf0', '#f5f5f5'];

const emojis = ['😀', '😂', '😍', '🤔', '😍', '🎉', '🔥', '💯', '👍', '❤️', '🌟', '✨', '😢', '😡', '🤗', '😎', '🤪', '😜', '🎊', '🎈', '😻', '🐱', '🐶', '🦁', '🐯', '🦅', '🐢', '🐸', '🦋', '🐝', '🍕', '🍔', '🍟', '🌮', '🍜', '🍱', '🍣', '🍰', '🎂', '☕', '🍕', '🎮', '🎯', '🎲', '🎪', '⚽', '🏀', '🏈', '🎾', '🏐', '✈️', '🚀', '🚗', '🚁', '🏖️', '🏔️', '🌊', '⛱️', '🏝️', '🌴', '🌲', '🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '💎', '👑', '🔔', '📚', '📖', '📝', '📱', '💻', '⌚', '🎸', '🎹', '🎺', '🎻', '🥁', '🎤', '🎧', '🎬', '📺', '🎥', '📷', '📸', '🌍', '🌎', '🌏', '⚡', '☀️', '🌙', '⭐', '💫', '✨'];

function initEmojiPicker() {
  emojiGrid.innerHTML = '';
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.onclick = (e) => {
      e.preventDefault();
      input.value = (input.value + ' ' + emoji).trim();
      emojiPicker.classList.remove('show');
    };
    emojiGrid.appendChild(btn);
  });
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function getAvatarColor(name) {
  const colors = ['#00b4d8', '#ff006e', '#00d084', '#ffd60a', '#fd7792'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function initColorPicker() {
  colorPicker.innerHTML = '';
  avatarColors.forEach(color => {
    const btn = document.createElement('div');
    btn.className = 'color-option';
    if (color === profileColor) btn.classList.add('selected');
    btn.style.background = color;
    btn.onclick = () => {
      document.querySelectorAll('#colorPicker .color-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      profileColor = color;
      updateProfilePreview();
    };
    colorPicker.appendChild(btn);
  });
}

function initBgColorPicker() {
  bgColorPicker.innerHTML = '';
  bgColors.forEach(color => {
    const btn = document.createElement('div');
    btn.className = 'color-option';
    if (color === bgColor) btn.classList.add('selected');
    btn.style.background = color;
    btn.onclick = () => {
      document.querySelectorAll('#bgColorPicker .color-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      bgColor = color;
      messages.style.background = color;
    };
    bgColorPicker.appendChild(btn);
  });
}

function updateProfilePreview() {
  const initials = getInitials(profileName.value || 'User');
  profileAvatarPreview.innerHTML = '';
  
  if (profileImage) {
    const img = document.createElement('img');
    img.src = profileImage;
    profileAvatarPreview.appendChild(img);
  } else {
    profileAvatarPreview.textContent = profileEmojis || initials;
    if (!profileEmojis) {
      profileAvatarPreview.style.fontSize = '1.5rem';
    } else {
      profileAvatarPreview.style.fontSize = '1.8rem';
    }
  }
  profileAvatarPreview.style.background = `linear-gradient(135deg, ${profileColor}, #ff006e)`;
}

function appendSystem(text) {
  const el = document.createElement('div');
  el.className = 'system';
  el.textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

function appendMessage(data) {
  const row = document.createElement('div');
  row.className = 'message-row';
  const isMe = data.socketId === socket.id;
  if (isMe) row.classList.add('me');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  
  if (data.profileImage) {
    const img = document.createElement('img');
    img.src = data.profileImage;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    avatar.appendChild(img);
  } else {
    avatar.textContent = data.avatarEmoji || getInitials(data.username);
    avatar.style.color = 'white';
  }
  avatar.style.background = `linear-gradient(135deg, ${data.avatarColor || getAvatarColor(data.username)}, #ff006e)`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.classList.add(isMe ? 'me' : 'other');
  bubble.dataset.messageId = data.id;

  const meta = document.createElement('div');
  meta.className = 'bubble-meta';
  meta.textContent = `${data.username} • ${new Date(data.time).toLocaleTimeString()}`;

  const content = document.createElement('div');
  content.innerHTML = processMentions(escapeHtml(data.message));

  bubble.appendChild(meta);
  bubble.appendChild(content);

  if (data.image) {
    const img = document.createElement('img');
    img.className = 'bubble-img';
    img.src = data.image;
    bubble.appendChild(img);
  }

  // Agregar botones de acción
  const actions = document.createElement('div');
  actions.className = 'bubble-actions';
  
  const replyBtn = document.createElement('button');
  replyBtn.className = 'bubble-action-btn';
  replyBtn.textContent = '↩️';
  replyBtn.title = 'Responder';
  replyBtn.onclick = () => replyToMessage(data);
  actions.appendChild(replyBtn);
  
  const reactBtn = document.createElement('button');
  reactBtn.className = 'bubble-action-btn';
  reactBtn.textContent = '😊';
  reactBtn.title = 'Reaccionar';
  reactBtn.onclick = (e) => showReactionPicker(data.id, e);
  actions.appendChild(reactBtn);
  
  if (!isMe) {
    const dmBtn = document.createElement('button');
    dmBtn.className = 'bubble-action-btn';
    dmBtn.textContent = '✉️';
    dmBtn.title = 'Mensaje directo';
    dmBtn.onclick = () => openDM(data.username);
    actions.appendChild(dmBtn);
    
    const reportBtn = document.createElement('button');
    reportBtn.className = 'bubble-action-btn';
    reportBtn.textContent = '🚨';
    reportBtn.title = 'Reportar';
    reportBtn.onclick = () => reportMessage(data.id, data.message);
    actions.appendChild(reportBtn);
  }
  
  bubble.appendChild(actions);
  
  // Mostrar respuesta previa si existe
  if (data.replyTo) {
    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.textContent = `↩️ ${data.replyTo.username}: ${data.replyTo.message.substring(0, 50)}...`;
    bubble.insertBefore(replyPreview, content);
  }
  
  // Mostrar reacciones
  if (data.reactions && Object.keys(data.reactions).length > 0) {
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'bubble-reactions';
    
    for (const [emoji, users] of Object.entries(data.reactions)) {
      const reactionEl = document.createElement('span');
      reactionEl.className = 'reaction';
      if (users.includes(username)) reactionEl.classList.add('user-reacted');
      reactionEl.innerHTML = `${emoji} <strong>${users.length}</strong>`;
      reactionEl.title = users.join(', ');
      reactionEl.onclick = () => toggleReaction(data.id, emoji);
      reactionsDiv.appendChild(reactionEl);
    }
    
    bubble.appendChild(reactionsDiv);
  }

  if (isMe) {
    row.appendChild(bubble);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
    
    // Reproducir sonido si no es mi mensaje
    if (window.playNotificationSound) {
      playNotificationSound();
    }
  }

  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function renderRooms() {
  roomsContainer.innerHTML = '<div class="room-label">Salas</div>';
  rooms.forEach(room => {
    const el = document.createElement('div');
    el.className = `room-item ${room === currentRoom ? 'active' : ''}`;
    el.textContent = `# ${room}`;
    el.onclick = () => selectRoom(room);
    roomsContainer.appendChild(el);
  });
}

function selectRoom(room) {
  currentRoom = room;
  currentRoomEl.textContent = `#${room}`;
  messages.innerHTML = '';
  appendSystem(`Entraste a la sala ${room}`);
  if (username) socket.emit('join', { username, room });
  renderRooms();
}

setNameBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (!name) return alert('Introduce un nombre');
  username = name;
  // store chosen name so next visits can auto-join
  try { localStorage.setItem('chat_username', username); } catch (e) {}
  profileName.value = name;
  userDisplay.textContent = username;
  profileBtn.style.display = 'block';
  initColorPicker();
  initBgColorPicker();
  updateProfilePreview();
  socket.emit('join', { username, room: currentRoom, avatarColor: profileColor, avatarEmoji: profileEmojis, profileImage, bgColor });
  overlay.style.display = 'none';
});

profileBtn.addEventListener('click', () => {
  profileName.value = username;
  profileEmoji.value = profileEmojis;
  initColorPicker();
  initBgColorPicker();
  updateProfilePreview();
  profileOverlay.style.display = 'flex';
});

profileName.addEventListener('input', updateProfilePreview);
profileEmoji.addEventListener('input', () => {
  profileEmojis = profileEmoji.value || '😊';
  updateProfilePreview();
});

profileImageInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    profileImage = reader.result;
    updateProfilePreview();
  };
  reader.readAsDataURL(f);
});

saveProfileBtn.addEventListener('click', () => {
  const newName = profileName.value.trim();
  if (!newName) return alert('El nombre no puede estar vacío');
  username = newName;
  profileEmojis = profileEmoji.value || '😊';
  userDisplay.textContent = username;
  socket.emit('updateProfile', { username, avatarColor: profileColor, avatarEmoji: profileEmojis, profileImage, bgColor });
  profileOverlay.style.display = 'none';
  messages.style.background = bgColor;
  appendSystem(`Tu perfil fue actualizado.`);
});

closeProfileBtn.addEventListener('click', () => {
  profileOverlay.style.display = 'none';
});

createRoomBtn.addEventListener('click', () => {
  const r = newRoomInput.value.trim();
  if (!r) return alert('Introduce el nombre de la sala');
  rooms.add(r);
  newRoomInput.value = '';
  selectRoom(r);
});

attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result;
    socket.emit('message', { type: 'image', image: data, room: currentRoom, profileImage, bgColor });
  };
  reader.readAsDataURL(f);
  fileInput.value = '';
});

// Drag and Drop
messages.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  messages.classList.add('drag-over');
});

messages.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  messages.classList.remove('drag-over');
});

messages.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  messages.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (files.length === 0) return;
  
  // Procesar solo el primer archivo (imagen)
  const file = files[0];
  if (!file.type.startsWith('image/')) {
    alert('Por favor arrastra una imagen');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result;
    socket.emit('message', { type: 'image', image: data, room: currentRoom, profileImage, bgColor });
  };
  reader.readAsDataURL(file);
});

emojiBtn.addEventListener('click', () => {
  emojiPicker.classList.toggle('show');
});

// Cerrar emoji picker cuando se hace clic fuera
document.addEventListener('click', (e) => {
  if (e.target !== emojiBtn && !emojiPicker.contains(e.target)) {
    emojiPicker.classList.remove('show');
  }
});

socket.on('connect', () => {
  statusEl.textContent = '● Conectado';
  statusEl.classList.add('online');
  appendSystem('Conectado al servidor.');
});

socket.on('disconnect', (reason) => {
  statusEl.textContent = '● Desconectado';
  statusEl.classList.remove('online');
  appendSystem('Desconectado del servidor.');
  
  // Mostrar modal si fue expulsado por el admin
  if (reason === 'io server disconnect') {
    setTimeout(() => {
      kickedModal.classList.add('show');
    }, 500);
  }
});

socket.on('roomJoined', ({ room }) => {
  rooms.add(room);
  renderRooms();
});

socket.on('system', (text) => appendSystem(text));

socket.on('message', (data) => {
  appendMessage(data);
  if (data.socketId !== socket.id && data.message) {
    showDesktopNotification(`${data.username} en #${data.room}`, data.message);
  }
});

socket.on('moderated', ({ reason }) => {
  appendSystem(`⚠️ ${reason}`);
});

socket.on('reportAck', () => {
  appendSystem('✓ Reporte enviado. Gracias.');
});

socket.on('chatDisabled', ({ message }) => {
  appendSystem(`⏸️ ${message}`);
  messages.style.opacity = '0.6';
  form.style.opacity = '0.5';
  form.style.pointerEvents = 'none';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!username) return alert('Primero únase con un nombre.');
  const msg = input.value.trim();
  if (!msg) return;
  
  const payload = {
    type: 'text',
    text: msg,
    room: currentRoom,
    avatarColor: profileColor,
    avatarEmoji: profileEmojis,
    profileImage,
    bgColor
  };
  
  if (currentReplyTo) {
    payload.replyTo = {
      id: currentReplyTo.id,
      username: currentReplyTo.username,
      message: currentReplyTo.message
    };
    cancelReply();
  }
  
  socket.emit('message', payload);
  input.value = '';
  
  // Detener indicador de escritura
  clearTimeout(window.typingTimeout);
});

// Indicador de escritura
input.addEventListener('input', () => {
  clearTimeout(window.typingTimeout);
  socket.emit('typing');
  window.typingTimeout = setTimeout(() => {}, 1000);
});

renderRooms();
initEmojiPicker();

// ===== NUEVAS FUNCIONALIDADES =====

// Modo oscuro
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('chat_theme') || 'light';
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
  if (themeToggle) themeToggle.textContent = '☀️';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('chat_theme', isDark ? 'dark' : 'light');
  });
}

// Notificaciones de sonido
let soundEnabled = localStorage.getItem('chat_sound') !== 'false';
const soundToggle = document.getElementById('soundToggle');
if (soundToggle) {
  soundToggle.textContent = soundEnabled ? '🔔' : '🔕';
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔔' : '🔕';
    localStorage.setItem('chat_sound', soundEnabled);
  });
}

// Audio de notificación
const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGmS96eeZTQ==');

function playNotificationSound() {
  if (soundEnabled && document.hidden) {
    notificationSound.play().catch(() => {});
  }
}

// Escuchar anuncios
socket.on('announcement', (data) => {
  const el = document.createElement('div');
  el.className = 'message-row';
  el.innerHTML = `
    <div class="bubble announcement">
      <div class="bubble-meta">📣 ${data.username || 'Administración'}</div>
      ${data.message}
    </div>
  `;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
  playNotificationSound();
});

// Indicador de escritura
const typingIndicator = document.getElementById('typingIndicator');
let typingUsers = new Set();

socket.on('userTyping', (data) => {
  if (data.username !== username && data.room === currentRoom) {
    typingUsers.add(data.username);
    updateTypingIndicator();
    
    setTimeout(() => {
      typingUsers.delete(data.username);
      updateTypingIndicator();
    }, 2000);
  }
});

function updateTypingIndicator() {
  if (typingUsers.size > 0) {
    const users = Array.from(typingUsers);
    if (users.length === 1) {
      typingIndicator.textContent = `${users[0]} está escribiendo...`;
    } else if (users.length === 2) {
      typingIndicator.textContent = `${users[0]} y ${users[1]} están escribiendo...`;
    } else {
      typingIndicator.textContent = `${users.length} personas están escribiendo...`;
    }
    typingIndicator.style.display = 'block';
  } else {
    typingIndicator.style.display = 'none';
  }
}

// Reacciones
let currentReplyTo = null;
const reactionEmojis = ['👍', '❤️', '😂', '🔥', '👏', '😮', '😢', '😡'];

function showReactionPicker(messageId, event) {
  event.stopPropagation();
  const existing = document.getElementById('reactionPicker');
  if (existing) existing.remove();
  
  const picker = document.createElement('div');
  picker.id = 'reactionPicker';
  picker.style.cssText = 'position:fixed;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);padding:8px;display:flex;gap:4px;z-index:2000';
  picker.style.left = event.pageX + 'px';
  picker.style.top = event.pageY + 'px';
  
  reactionEmojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.style.cssText = 'border:none;background:var(--bg-light);padding:8px;border-radius:6px;cursor:pointer;font-size:1.2rem';
    btn.onmouseover = () => btn.style.background = 'var(--primary)';
    btn.onmouseout = () => btn.style.background = 'var(--bg-light)';
    btn.onclick = () => {
      toggleReaction(messageId, emoji);
      picker.remove();
    };
    picker.appendChild(btn);
  });
  
  document.body.appendChild(picker);
  setTimeout(() => {
    const closeOnClick = (e) => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeOnClick);
      }
    };
    document.addEventListener('click', closeOnClick);
  }, 100);
}

function toggleReaction(messageId, emoji) {
  socket.emit('addReaction', { messageId, emoji });
}

socket.on('reactionAdded', (data) => {
  const msgElements = document.querySelectorAll('.bubble');
  msgElements.forEach(bubble => {
    if (bubble.dataset.messageId === data.messageId) {
      let reactionsDiv = bubble.querySelector('.bubble-reactions');
      if (!reactionsDiv) {
        reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'bubble-reactions';
        bubble.appendChild(reactionsDiv);
      }
      
      reactionsDiv.innerHTML = '';
      for (const [emoji, users] of Object.entries(data.reactions)) {
        const reactionEl = document.createElement('span');
        reactionEl.className = 'reaction';
        if (users.includes(username)) reactionEl.classList.add('user-reacted');
        reactionEl.innerHTML = `${emoji} <strong>${users.length}</strong>`;
        reactionEl.title = users.join(', ');
        reactionEl.onclick = () => toggleReaction(data.messageId, emoji);
        reactionsDiv.appendChild(reactionEl);
      }
    }
  });
});

// Responder a mensajes
function replyToMessage(data) {
  currentReplyTo = data;
  const replyIndicator = document.getElementById('replyIndicator') || document.createElement('div');
  replyIndicator.id = 'replyIndicator';
  replyIndicator.style.cssText = 'padding:8px 12px;background:var(--bg-light);border-left:3px solid var(--primary);margin:0 16px 8px;border-radius:4px;display:flex;justify-content:space-between;align-items:center';
  replyIndicator.innerHTML = `<span>Respondiendo a <strong>${data.username}</strong>: ${data.message.substring(0, 50)}...</span><button onclick="cancelReply()" style="background:none;border:none;cursor:pointer;font-size:1.2rem">✕</button>`;
  form.parentElement.insertBefore(replyIndicator, form);
  input.focus();
}

function cancelReply() {
  currentReplyTo = null;
  const indicator = document.getElementById('replyIndicator');
  if (indicator) indicator.remove();
}
window.cancelReply = cancelReply;

// Menciones
function processMentions(text) {
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

input.addEventListener('keydown', (e) => {
  if (e.key === '@') {
    // Aquí se podría agregar autocompletado de usuarios
  }
});

// Mensajes Directos
const dmConversations = new Map();
const dmBtn = document.getElementById('dmBtn');
const dmList = document.getElementById('dmList');

if (dmBtn) {
  dmBtn.addEventListener('click', () => {
    dmList.classList.toggle('show');
    loadDMList();
  });
}

function openDM(targetUsername) {
  if (targetUsername === username) return;
  const dmWindow = window.open(`#dm-${targetUsername}`, '_blank', 'width=400,height=600');
  // En una implementación real, abriría una ventana de chat
  alert(`Función de DM con ${targetUsername} - Por implementar completamente`);
}

function loadDMList() {
  const dmItems = document.getElementById('dmItems');
  if (!dmItems) return;
  
  if (dmConversations.size === 0) {
    dmItems.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary)">No tienes conversaciones</div>';
  } else {
    dmItems.innerHTML = Array.from(dmConversations.keys()).map(user => 
      `<div class="dm-item" onclick="openDM('${user}')">${user}</div>`
    ).join('');
  }
}

function closeDMList() {
  dmList.classList.remove('show');
}
window.closeDMList = closeDMList;
window.openDM = openDM;

// Búsqueda de mensajes
const searchBtn = document.getElementById('searchBtn');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
let allMessages = [];

if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    searchBar.style.display = searchBar.style.display === 'none' ? 'block' : 'none';
    if (searchBar.style.display === 'block') searchInput.focus();
  });
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      messages.querySelectorAll('.message-row').forEach(el => el.style.display = 'flex');
      return;
    }
    
    messages.querySelectorAll('.message-row').forEach(el => {
      const text = el.textContent.toLowerCase();
      el.style.display = text.includes(query) ? 'flex' : 'none';
    });
  });
}

function closeSearch() {
  searchBar.style.display = 'none';
  searchInput.value = '';
  messages.querySelectorAll('.message-row').forEach(el => el.style.display = 'flex');
}
window.closeSearch = closeSearch;

// Estados de usuario
const statusBtn = document.getElementById('statusBtn');
const statusSelector = document.getElementById('statusSelector');
let userStatus = '🟢 Disponible';

if (statusBtn) {
  statusBtn.addEventListener('click', () => {
    statusSelector.classList.toggle('show');
  });
}

function setStatus(status) {
  userStatus = status;
  statusBtn.textContent = status;
  statusSelector.classList.remove('show');
  socket.emit('statusChange', { status });
  appendSystem(`Tu estado cambió a: ${status}`);
}
window.setStatus = setStatus;

// Notificaciones de escritorio
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showDesktopNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'chat-notification'
    });
  }
}

requestNotificationPermission();

// Reportar mensaje
function reportMessage(messageId, messageText) {
  const reason = prompt('¿Por qué deseas reportar este mensaje?');
  if (reason) {
    socket.emit('reportMessage', {
      messageId,
      messageText,
      reason
    });
  }
}
window.reportMessage = reportMessage;

// If a name is stored, auto-join; otherwise show modal and focus input so user types their name
(function ensureNameOrPrompt() {
  try {
    const stored = localStorage.getItem('chat_username');
    if (stored) {
      username = stored;
      usernameInput.value = username;
      profileName.value = username;
      userDisplay.textContent = username;
      profileBtn.style.display = 'block';
      initColorPicker();
      initBgColorPicker();
      updateProfilePreview();
      socket.emit('join', { username, room: currentRoom, avatarColor: profileColor, avatarEmoji: profileEmojis, profileImage, bgColor });
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'flex';
      // focus the input for quick entry and allow Enter key
      setTimeout(() => usernameInput.focus(), 50);
      usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') setNameBtn.click();
      });
    }
  } catch (e) {
    console.error('Name check failed', e);
  }
})();
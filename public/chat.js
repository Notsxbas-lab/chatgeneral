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
  if (data.id && data.id === socket.id) row.classList.add('me');

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
  bubble.classList.add((data.id && data.id === socket.id) ? 'me' : 'other');

  const meta = document.createElement('div');
  meta.className = 'bubble-meta';
  meta.textContent = `${data.username} • ${new Date(data.time).toLocaleTimeString()}`;

  const content = document.createElement('div');
  content.innerHTML = escapeHtml(data.message);

  bubble.appendChild(meta);
  bubble.appendChild(content);

  if (data.image) {
    const img = document.createElement('img');
    img.className = 'bubble-img';
    img.src = data.image;
    bubble.appendChild(img);
  }

  if (data.id && data.id === socket.id) {
    row.appendChild(bubble);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
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

socket.on('message', (data) => appendMessage(data));

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
  socket.emit('message', { type: 'text', text: msg, room: currentRoom, avatarColor: profileColor, avatarEmoji: profileEmojis, profileImage, bgColor });
  input.value = '';
});

renderRooms();
initEmojiPicker();

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
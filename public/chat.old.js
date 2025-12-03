const socket = io();

const messages = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const usernameInput = document.getElementById('username');
const setNameBtn = document.getElementById('setName');
const roomSelect = document.getElementById('roomSelect');
const createRoomBtn = document.getElementById('createRoom');
const newRoomInput = document.getElementById('newRoom');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const emojiBtn = document.getElementById('emojiBtn');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');

let username = '';

function appendSystem(text){
  const el = document.createElement('div');
  el.className = 'system';
  el.textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

function appendMessage(data){
  const row = document.createElement('div');
  row.className = 'row';
  if(data.id && data.id === socket.id) row.classList.add('me');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.classList.add((data.id && data.id === socket.id) ? 'me' : 'other');

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = data.username || 'Anon';

  const content = document.createElement('div');
  content.innerHTML = escapeHtml(data.message);

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = new Date(data.time).toLocaleTimeString();

  bubble.appendChild(meta);
  bubble.appendChild(content);
  bubble.appendChild(time);

  row.appendChild(bubble);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]);
}

setNameBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if(!name) return alert('Introduce un nombre');
  username = name;
  const room = roomSelect.value || 'global';
  socket.emit('join', { username, room });
  overlay.style.display = 'none';
});

socket.on('connect', () => {
  statusEl.textContent = 'conectado';
  statusEl.style.color = '#064e47';
  appendSystem('Conectado al servidor.');
});

// room joined info
socket.on('roomJoined', ({ room }) => {
  // add to select if missing
  if (![...roomSelect.options].some(o => o.value === room)) {
    const opt = document.createElement('option'); opt.value = room; opt.textContent = `#${room}`; roomSelect.appendChild(opt);
  }
});

socket.on('disconnect', () => {
  statusEl.textContent = 'desconectado';
  statusEl.style.color = '#9ca3af';
  appendSystem('Desconectado del servidor.');
});

socket.on('system', (text) => appendSystem(text));

socket.on('message', (data) => appendMessage(data));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if(!username) return alert('Primero únase con un nombre.');
  const msg = input.value.trim();
  if(!msg) return;
  const room = roomSelect.value || 'global';
  socket.emit('message', { type: 'text', text: msg, room });
  input.value = '';
});

// Create room
createRoomBtn.addEventListener('click', () => {
  const r = newRoomInput.value.trim();
  if (!r) return alert('Introduce el nombre de la sala');
  if (![...roomSelect.options].some(o => o.value === r)) {
    const opt = document.createElement('option'); opt.value = r; opt.textContent = `#${r}`; roomSelect.appendChild(opt);
  }
  roomSelect.value = r;
  if (username) socket.emit('join', { username, room: r });
  newRoomInput.value = '';
});

// Attach image
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result; // base64
    socket.emit('message', { type: 'image', image: data, room: roomSelect.value || 'global' });
  };
  reader.readAsDataURL(f);
  fileInput.value = '';
});

// simple emoji insert
emojiBtn.addEventListener('click', () => {
  const emoji = prompt('Introduce un emoji o texto emoji (ej: 😊)');
  if (emoji) input.value = (input.value + ' ' + emoji).trim();
});

// report a message (attach UI to each message)
function reportMessage(messageId) {
  if (!confirm('Reportar este mensaje?')) return;
  socket.emit('report', { messageId, reason: 'Reporte de usuario' });
}

socket.on('reportAck', () => appendSystem('Reporte enviado. Gracias.'));


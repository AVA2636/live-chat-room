// ===== DOM 元素 =====
const messageList = document.getElementById('message-list');
const nicknameInput = document.getElementById('nickname-input');
const colorPicker = document.getElementById('color-picker');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const onlineCountEl = document.getElementById('online-count');
const typingIndicator = document.getElementById('typing-indicator');

// ===== Socket.IO 连接 =====
const socket = io();

// ===== 本地存储昵称 =====
const savedNickname = localStorage.getItem('msgboard-nickname');
const savedColor = localStorage.getItem('msgboard-color');
if (savedNickname) nicknameInput.value = savedNickname;
if (savedColor) colorPicker.value = savedColor;

// 保存昵称
nicknameInput.addEventListener('change', () => {
  localStorage.setItem('msgboard-nickname', nicknameInput.value.trim());
});
colorPicker.addEventListener('change', () => {
  localStorage.setItem('msgboard-color', colorPicker.value);
});

// ===== 工具函数 =====
function formatTime(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  // 同一天只显示时间
  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // 否则显示月日+时间
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getAvatarLetter(nickname) {
  return (nickname || '匿').charAt(0).toUpperCase();
}

function getContrastColor(hex) {
  // 计算亮度，返回深色或浅色文字
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1a1a2e' : '#ffffff';
}

// ===== 渲染 =====
function addSystemMessage(text) {
  const el = document.createElement('div');
  el.className = 'system-msg';
  el.textContent = text;

  // 移除空状态提示
  const emptyHint = messageList.querySelector('.empty-hint');
  if (emptyHint) emptyHint.remove();

  messageList.appendChild(el);
  scrollToBottom();
}

function addMessage(msg) {
  // 移除空状态提示
  const emptyHint = messageList.querySelector('.empty-hint');
  if (emptyHint) emptyHint.remove();

  const el = document.createElement('div');
  el.className = 'message-item';

  const avatarColor = msg.color || '#4a90d9';
  const avatarLetter = getAvatarLetter(msg.nickname);

  el.innerHTML = `
    <div class="message-avatar" style="background:${avatarColor};color:${getContrastColor(avatarColor)}">
      ${avatarLetter}
    </div>
    <div class="message-body">
      <div class="message-header">
        <span class="message-nickname" style="color:${avatarColor}">${escapeHtml(msg.nickname)}</span>
        <span class="message-time">${formatTime(msg.time)}</span>
      </div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    </div>
  `;

  messageList.appendChild(el);
  scrollToBottom();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messageList.scrollTop = messageList.scrollHeight;
  });
}

// ===== 发送消息 =====
function sendMessage() {
  const nickname = nicknameInput.value.trim();
  const content = messageInput.value.trim();
  if (!content) return;

  // 保存偏好
  if (nickname) {
    localStorage.setItem('msgboard-nickname', nickname);
  }
  localStorage.setItem('msgboard-color', colorPicker.value);

  socket.emit('send-message', {
    nickname: nickname || '匿名',
    content: content,
    color: colorPicker.value
  });

  messageInput.value = '';
  messageInput.focus();

  // 停止输入状态
  socket.emit('stop-typing');
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ===== 输入状态提示 =====
let typingTimer = null;
messageInput.addEventListener('input', () => {
  if (!typingTimer) {
    socket.emit('typing', nicknameInput.value.trim());
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('stop-typing');
    typingTimer = null;
  }, 1000);
});

// ===== 接收事件 =====
socket.on('history', (msgs) => {
  if (msgs && msgs.length > 0) {
    const emptyHint = messageList.querySelector('.empty-hint');
    if (emptyHint) emptyHint.remove();
    msgs.forEach(msg => addMessage(msg));
  }
});

socket.on('new-message', (msg) => {
  addMessage(msg);
});

socket.on('system-message', (data) => {
  addSystemMessage(data.text);
});

socket.on('online-count', (count) => {
  onlineCountEl.textContent = count;
});

socket.on('user-typing', (nickname) => {
  typingIndicator.textContent = `${nickname} 正在输入...`;
});

socket.on('user-stop-typing', () => {
  typingIndicator.textContent = '';
});

// ===== 自动聚焦 =====
messageInput.focus();

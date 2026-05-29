// ===== DOM 元素 =====
const messageList = document.getElementById('message-list');
const nicknameInput = document.getElementById('nickname-input');
const colorPicker = document.getElementById('color-picker');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const onlineCountEl = document.getElementById('online-count');
const typingIndicator = document.getElementById('typing-indicator');

// ===== 配置 =====
const API_URL = '/api/messages';
const POLL_INTERVAL = 2000; // 2秒轮询一次
const userId = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
let latestMessageId = null;

// ===== 本地存储 =====
const savedNickname = localStorage.getItem('msgboard-nickname');
const savedColor = localStorage.getItem('msgboard-color');
if (savedNickname) nicknameInput.value = savedNickname;
if (savedColor) colorPicker.value = savedColor;

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

  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getAvatarLetter(nickname) {
  return (nickname || '匿').charAt(0).toUpperCase();
}

function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1a1a2e' : '#ffffff';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== 渲染 =====
const renderedMessageIds = new Set();
const MAX_RENDERED = 300;

function addMessage(msg, prepend = false) {
  if (renderedMessageIds.has(msg.id)) return;
  renderedMessageIds.add(msg.id);

  // 清理旧消息 DOM（防止内存过大）
  if (renderedMessageIds.size > MAX_RENDERED) {
    const oldItems = messageList.querySelectorAll('.message-item');
    if (oldItems.length > MAX_RENDERED) {
      const toRemove = oldItems.length - MAX_RENDERED;
      for (let i = 0; i < toRemove; i++) {
        oldItems[i].remove();
      }
    }
  }

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
}

function updateOnlineCount(count) {
  onlineCountEl.textContent = count;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messageList.scrollTop = messageList.scrollHeight;
  });
}

// ===== 消息加载 =====
async function loadHistory() {
  try {
    const res = await fetch(`${API_URL}?userId=${userId}`);
    const data = await res.json();
    if (data.messages && data.messages.length > 0) {
      const emptyHint = messageList.querySelector('.empty-hint');
      if (emptyHint) emptyHint.remove();
    }
    data.messages.forEach(msg => addMessage(msg));
    if (data.latest) latestMessageId = data.latest;
    updateOnlineCount(data.online || 0);
    scrollToBottom();
  } catch (err) {
    console.log('加载历史消息失败，稍后重试');
  }
}

async function pollMessages() {
  try {
    const params = new URLSearchParams({ userId });
    if (latestMessageId) params.set('since', latestMessageId);

    const res = await fetch(`${API_URL}?${params}`);
    const data = await res.json();

    if (data.messages && data.messages.length > 0) {
      const wasAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 80;
      data.messages.forEach(msg => addMessage(msg));
      if (data.latest) latestMessageId = data.latest;
      if (wasAtBottom) scrollToBottom();
    }
    updateOnlineCount(data.online || 0);
  } catch (err) {
    // 静默重试
  }
}

// ===== 发送消息 =====
async function sendMessage() {
  const nickname = nicknameInput.value.trim();
  const content = messageInput.value.trim();
  if (!content) return;

  // 保存偏好
  if (nickname) localStorage.setItem('msgboard-nickname', nickname);
  localStorage.setItem('msgboard-color', colorPicker.value);

  // 禁用按钮防止重复发送
  sendBtn.disabled = true;
  messageInput.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: nickname || '匿名',
        content: content,
        color: colorPicker.value,
        userId: userId
      })
    });

    const data = await res.json();
    if (data.success) {
      addMessage(data.message);
      if (data.message) latestMessageId = data.message.id;
      updateOnlineCount(data.online || 0);
      scrollToBottom();
      messageInput.value = '';
    }
  } catch (err) {
    alert('发送失败，请检查网络后重试');
  } finally {
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ===== 定期轮询 =====
loadHistory();
setInterval(pollMessages, POLL_INTERVAL);

// 页面关闭时的心跳清理依赖服务端定期清理

messageInput.focus();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 消息存储文件
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// 读取历史消息
function loadMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = fs.readFileSync(MESSAGES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('读取消息文件失败:', err.message);
  }
  return [];
}

// 保存消息
function saveMessages(messages) {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存消息失败:', err.message);
  }
}

// 最多保留 500 条消息
const MAX_MESSAGES = 500;
let messages = loadMessages();

// 在线用户统计
let onlineCount = 0;

io.on('connection', (socket) => {
  onlineCount++;

  // 广播在线人数
  io.emit('online-count', onlineCount);

  // 发送历史消息给新用户
  socket.emit('history', messages);

  // 广播用户加入通知
  io.emit('system-message', {
    type: 'join',
    text: '一位用户加入了聊天室',
    time: new Date().toISOString()
  });

  // 接收新消息
  socket.on('send-message', (data) => {
    const message = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      nickname: (data.nickname || '匿名').trim().substring(0, 20),
      content: (data.content || '').trim().substring(0, 500),
      color: data.color || '#4a90d9',
      time: new Date().toISOString()
    };

    // 空消息不处理
    if (!message.content) return;

    // 空昵称给默认值
    if (!message.nickname) message.nickname = '匿名';

    // 保存消息
    messages.push(message);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(-MAX_MESSAGES);
    }
    saveMessages(messages);

    // 广播给所有用户（包括发送者）
    io.emit('new-message', message);
  });

  // 用户正在输入
  socket.on('typing', (nickname) => {
    socket.broadcast.emit('user-typing', nickname || '匿名');
  });

  // 用户停止输入
  socket.on('stop-typing', () => {
    socket.broadcast.emit('user-stop-typing');
  });

  // 断开连接
  socket.on('disconnect', () => {
    onlineCount--;
    io.emit('online-count', onlineCount);
    io.emit('system-message', {
      type: 'leave',
      text: '一位用户离开了聊天室',
      time: new Date().toISOString()
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ 留言板服务器已启动: http://localhost:${PORT}`);
});

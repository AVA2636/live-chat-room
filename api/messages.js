// 内存中存储消息（Vercel serverless 实例保活期间持久）
const MAX_MESSAGES = 500;
let messages = [];

// 在线用户追踪（通过最近活动时间判断）
const onlineUsers = new Map(); // userId -> lastActiveTime
const CLEANUP_INTERVAL = 30 * 1000; // 30秒清理不活跃用户
const ACTIVE_THRESHOLD = 60 * 1000; // 60秒内有活动算在线

// 定期清理过期在线用户
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, lastActive] of onlineUsers) {
      if (now - lastActive > ACTIVE_THRESHOLD) {
        onlineUsers.delete(userId);
      }
    }
  }, CLEANUP_INTERVAL);
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET /api/messages - 获取消息列表
  if (req.method === 'GET') {
    const { since, userId } = req.query;

    // 更新用户在线状态
    if (userId) {
      onlineUsers.set(userId, Date.now());
    }

    // 如果提供了 since 参数，只返回新消息
    if (since) {
      const sinceIndex = messages.findIndex(m => m.id === since);
      const newMessages = sinceIndex >= 0 ? messages.slice(sinceIndex + 1) : messages;
      return res.json({
        messages: newMessages,
        online: onlineUsers.size,
        latest: messages.length > 0 ? messages[messages.length - 1].id : null
      });
    }

    // 返回全部消息（最多最近200条）
    return res.json({
      messages: messages.slice(-200),
      online: onlineUsers.size,
      latest: messages.length > 0 ? messages[messages.length - 1].id : null
    });
  }

  // POST /api/messages - 发送新消息
  if (req.method === 'POST') {
    const { nickname, content, color, userId } = req.body || {};

    const cleanNickname = (nickname || '匿名').trim().substring(0, 20) || '匿名';
    const cleanContent = (content || '').trim().substring(0, 500);

    if (!cleanContent) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const message = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      nickname: cleanNickname,
      content: cleanContent,
      color: color || '#4a90d9',
      time: new Date().toISOString()
    };

    // 更新用户在线状态
    if (userId) {
      onlineUsers.set(userId, Date.now());
    }

    // 保存消息
    messages.push(message);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(-MAX_MESSAGES);
    }

    return res.status(201).json({
      success: true,
      message,
      online: onlineUsers.size
    });
  }

  // 其他请求
  return res.status(405).json({ error: '不允许的方法' });
};

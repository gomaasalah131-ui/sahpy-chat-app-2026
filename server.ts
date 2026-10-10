import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'server-data.json');
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface RegisteredUser {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  username: string;
  normalizedUsername: string;
  email?: string;
  bio: string;
  avatar: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface ChatMessagePayload {
  id: string;
  senderPhone: string;
  senderName: string;
  senderAvatar?: string;
  recipientPhone: string;
  groupId?: string;
  text: string;
  timestamp: string;
  type: 'text' | 'voice' | 'image' | 'sticker';
  voiceDuration?: string;
  imageUrl?: string;
  imageCaption?: string;
  stickerId?: string;
  stickerEmoji?: string;
  stickerLabel?: string;
  stickerGradient?: string;
  stickerPackId?: string;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
}

export interface GroupChatMemberPayload {
  id: string;
  name: string;
  phone: string;
  username?: string;
  avatar: string;
  role: 'admin' | 'member';
  isOnline?: boolean;
}

export interface GroupChatPayload {
  id: string;
  name: string;
  description: string;
  avatar: string;
  createdByPhone: string;
  createdAt: string;
  customWallpaper?: string;
  members: GroupChatMemberPayload[];
}

export interface StoryPayload {
  id: string;
  contactId: string;
  userName: string;
  userPhone?: string;
  userUsername?: string;
  avatar: string;
  hasUnseen: boolean;
  timestamp: string;
  createdAt: number;
  expiresAt: number;
  caption?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  videoDuration?: number;
  viewsCount?: number;
  likesCount?: number;
}

interface ServerStore {
  users: RegisteredUser[];
  messages: ChatMessagePayload[];
  groups: GroupChatPayload[];
  stories: StoryPayload[];
}

export function normalizeDigits(str?: string): string {
  if (!str) return '';
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  let result = '';
  for (const ch of String(str)) {
    const idx1 = arabicIndic.indexOf(ch);
    const idx2 = easternArabic.indexOf(ch);
    if (idx1 !== -1) result += String(idx1);
    else if (idx2 !== -1) result += String(idx2);
    else result += ch;
  }
  return result.replace(/[^\d]/g, '');
}

export function normalizeUsername(str?: string): string {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, '_');
}

const DEMO_USER_IDS = new Set([
  'user-ahmed',
  'user-sara',
  'user-layla',
  'user-omar',
  'user-nour',
]);

const DEFAULT_USERS: RegisteredUser[] = [
  {
    id: 'user-salah-gomaa',
    name: '𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸',
    phone: '+20 109 876 5432',
    normalizedPhone: '201098765432',
    username: 'salah_gomaa',
    normalizedUsername: 'salah_gomaa',
    email: 'gomaasalah131@gmail.com',
    bio: 'Lead Architect & Founder — SAHPY-CHAT ✨',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
    isOnline: true,
    lastSeen: 'متصل الآن',
    createdAt: new Date().toISOString(),
  },
];

function pruneExpiredStories(stories: StoryPayload[]): StoryPayload[] {
  const now = Date.now();
  return (stories || []).filter((s) => s.expiresAt && s.expiresAt > now);
}

function loadStore(): ServerStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ServerStore;
      if (parsed && Array.isArray(parsed.users)) {
        if (!Array.isArray(parsed.groups)) parsed.groups = [];
        if (!Array.isArray(parsed.stories)) parsed.stories = [];
        parsed.stories = pruneExpiredStories(parsed.stories);
        parsed.users = parsed.users
          .filter((u) => !DEMO_USER_IDS.has(u.id))
          .map((u) => {
          const fallbackUsername =
            u.username ||
            normalizeUsername(u.name) ||
            `user_${(u.normalizedPhone || '0000').slice(-4)}`;
          const cleanedName = String(u.name || '').replace(/الديزينر انجينير\s*/g, '').trim() || u.name;
          const cleanedBio = String(u.bio || '').replace(/الديزينر انجينير\s*/g, '').replace(/نبض شات/g, 'SAHPY-CHAT');
          return {
            ...u,
            name: cleanedName,
            bio: cleanedBio,
            username: fallbackUsername,
            normalizedUsername: normalizeUsername(fallbackUsername),
          };
        });
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read server-data.json, initializing fresh store:', err);
  }
  const initial: ServerStore = {
    users: DEFAULT_USERS,
    messages: [],
    groups: [],
    stories: [],
  };
  saveStore(initial);
  return initial;
}

function saveStore(store: ServerStore) {
  try {
    store.stories = pruneExpiredStories(store.stories);
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save server-data.json:', err);
  }
}

const store = loadStore();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json({ limit: '30mb' }));

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, { phone?: string; name?: string }>();

  httpServer.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    if (url.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  function broadcast(payload: unknown) {
    const data = JSON.stringify(payload);
    for (const [client] of clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  wss.on('connection', (ws) => {
    clients.set(ws, {});

    store.stories = pruneExpiredStories(store.stories);
    ws.send(
      JSON.stringify({
        type: 'init',
        users: store.users,
        messages: store.messages.slice(-150),
        groups: store.groups,
        stories: store.stories,
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));
        if (data.type === 'identify' && data.phone) {
          const norm = normalizeDigits(data.phone);
          clients.set(ws, { phone: norm, name: data.name });

          const user = store.users.find(
            (u) =>
              u.normalizedPhone === norm ||
              u.normalizedPhone.endsWith(norm) ||
              norm.endsWith(u.normalizedPhone)
          );
          if (user) {
            user.isOnline = true;
            user.lastSeen = 'متصل الآن';
            saveStore(store);
            broadcast({ type: 'users:update', users: store.users });
          }
        } else if (data.type === 'chat:message' && data.message) {
          const msg: ChatMessagePayload = data.message;
          store.messages.push(msg);
          saveStore(store);
          broadcast({ type: 'message:new', message: msg });
        }
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // REST API: Get all registered users
  app.get('/api/users', (_req, res) => {
    res.json({ users: store.users });
  });

  // REST API: Search users by phone number OR username OR name (requires non-empty query like WhatsApp)
  app.get('/api/users/search', (req, res) => {
    const q = String(req.query.q || req.query.phone || '').trim();
    if (!q) {
      res.json({ users: [] });
      return;
    }
    const qDigits = normalizeDigits(q);
    const qLower = q.toLowerCase();
    const qUser = normalizeUsername(q);

    const matched = store.users.filter((u) => {
      const nameMatch = u.name.toLowerCase().includes(qLower);
      const rawPhoneMatch = u.phone.toLowerCase().includes(qLower);
      const emailMatch = (u.email || '').toLowerCase().includes(qLower);
      const usernameMatch =
        u.username?.toLowerCase().includes(qLower) ||
        (qUser.length > 0 && u.normalizedUsername?.includes(qUser));
      const digitMatch =
        qDigits.length >= 2 &&
        (u.normalizedPhone.includes(qDigits) || qDigits.includes(u.normalizedPhone));
      return nameMatch || rawPhoneMatch || emailMatch || usernameMatch || digitMatch;
    });

    res.json({ users: matched });
  });

  // REST API: Register or login with Gmail, phone number, or username
  app.post('/api/auth/register', (req, res) => {
    const { name, phone, username, email, bio, avatar } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '+20 109 876 5432').trim();
    const norm = normalizeDigits(cleanPhone) || '201098765432';

    const cleanUser =
      normalizeUsername(username) ||
      (cleanEmail ? normalizeUsername(cleanEmail.split('@')[0]) : '') ||
      normalizeUsername(name) ||
      `user_${norm.slice(-4)}`;

    let existing = store.users.find(
      (u) =>
        (cleanEmail && (u.email || '').toLowerCase() === cleanEmail) ||
        u.normalizedPhone === norm ||
        (norm.length >= 9 &&
          (u.normalizedPhone.endsWith(norm.slice(-9)) ||
            norm.endsWith(u.normalizedPhone.slice(-9)))) ||
        (cleanUser && u.normalizedUsername === cleanUser)
    );

    if (existing) {
      if (name && String(name).trim()) existing.name = String(name).trim();
      if (cleanPhone) {
        existing.phone = cleanPhone;
        existing.normalizedPhone = norm;
      }
      if (username && String(username).trim()) {
        existing.username = cleanUser;
        existing.normalizedUsername = cleanUser;
      }
      if (email && String(email).trim()) existing.email = String(email).trim();
      if (bio && String(bio).trim()) existing.bio = String(bio).trim();
      if (avatar) existing.avatar = avatar;
      existing.isOnline = true;
      existing.lastSeen = 'متصل الآن';
      saveStore(store);
      broadcast({ type: 'users:update', users: store.users });
      res.json({ user: existing, users: store.users, isNew: false });
      return;
    }

    const avatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
    ];

    const newUser: RegisteredUser = {
      id: `user-${Date.now()}`,
      name: String(name || 'مستخدم جديد').trim(),
      phone: cleanPhone,
      normalizedPhone: norm,
      username: cleanUser,
      normalizedUsername: cleanUser,
      email: email ? String(email).trim() : undefined,
      bio: String(bio || 'متاح للدردشة عبر SAHPY-CHAT ✨').trim(),
      avatar: avatar || avatars[store.users.length % avatars.length],
      isOnline: true,
      lastSeen: 'متصل الآن',
      createdAt: new Date().toISOString(),
    };

    store.users.unshift(newUser);
    saveStore(store);
    broadcast({ type: 'users:update', users: store.users });

    res.json({ user: newUser, users: store.users, isNew: true });
  });

  // REST API: Get active 24h stories
  app.get('/api/stories', (_req, res) => {
    store.stories = pruneExpiredStories(store.stories);
    saveStore(store);
    res.json({ stories: store.stories });
  });

  // REST API: Create a new 24h story (photo or video)
  app.post('/api/stories', (req, res) => {
    const {
      contactId,
      userName,
      userPhone,
      userUsername,
      avatar,
      caption,
      mediaUrl,
      mediaType,
      videoDuration,
    } = req.body || {};

    if (!mediaUrl) {
      res.status(400).json({ error: 'يرجى اختيار صورة أو فيديو للحالة اليومية.' });
      return;
    }

    const now = Date.now();
    const newStory: StoryPayload = {
      id: `story-${now}-${Math.random().toString(36).slice(2, 6)}`,
      contactId: String(contactId || 'me'),
      userName: String(userName || 'حالتي (أنت)'),
      userPhone: userPhone ? String(userPhone) : undefined,
      userUsername: userUsername ? normalizeUsername(userUsername) : undefined,
      avatar:
        avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
      hasUnseen: true,
      timestamp: 'الآن',
      createdAt: now,
      expiresAt: now + TWENTY_FOUR_HOURS_MS,
      caption: caption ? String(caption).trim() : 'حالة يومية جديدة عبر SAHPY-CHAT ✨',
      mediaUrl: String(mediaUrl),
      mediaType: mediaType === 'video' ? 'video' : 'image',
      videoDuration: videoDuration ? Number(videoDuration) : undefined,
      viewsCount: 1,
      likesCount: 0,
    };

    store.stories = pruneExpiredStories(store.stories);
    store.stories.unshift(newStory);
    saveStore(store);

    broadcast({ type: 'story:new', story: newStory });
    res.json({ story: newStory, stories: store.stories });
  });

  // REST API: Delete a story
  app.delete('/api/stories/:storyId', (req, res) => {
    const { storyId } = req.params;
    store.stories = store.stories.filter((s) => s.id !== storyId);
    saveStore(store);
    broadcast({ type: 'story:delete', storyId });
    res.json({ ok: true, storyId });
  });

  // REST API: Get all groups
  app.get('/api/groups', (_req, res) => {
    res.json({ groups: store.groups });
  });

  // REST API: Create a new group chat
  app.post('/api/groups', (req, res) => {
    const { id, name, description, avatar, createdByPhone, customWallpaper, members } = req.body || {};
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'يرجى إدخال اسم المجموعة.' });
      return;
    }

    const newGroup: GroupChatPayload = {
      id: id || `group-${Date.now()}`,
      name: String(name).trim(),
      description: String(description || 'مجموعة دردشة على SAHPY-CHAT ✨').trim(),
      avatar:
        avatar ||
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=240&auto=format&fit=crop&q=80',
      createdByPhone: String(createdByPhone || ''),
      createdAt: new Date().toISOString(),
      customWallpaper: customWallpaper || 'cosmic-nebula',
      members: Array.isArray(members) ? members : [],
    };

    const existingIdx = store.groups.findIndex((g) => g.id === newGroup.id);
    if (existingIdx !== -1) {
      store.groups[existingIdx] = newGroup;
    } else {
      store.groups.unshift(newGroup);
    }

    saveStore(store);
    broadcast({ type: 'group:new', group: newGroup });
    res.json({ group: newGroup, groups: store.groups });
  });

  // REST API: Update group members
  app.put('/api/groups/:groupId/members', (req, res) => {
    const { groupId } = req.params;
    const { members } = req.body || {};
    const group = store.groups.find((g) => g.id === groupId);
    if (!group) {
      res.status(404).json({ error: 'المجموعة غير موجودة' });
      return;
    }
    if (Array.isArray(members)) {
      group.members = members;
      saveStore(store);
      broadcast({ type: 'group:update', group });
    }
    res.json({ group });
  });

  // REST API: Send message (supports 1-on-1 and Group Chat)
  app.post('/api/messages', (req, res) => {
    const msg: ChatMessagePayload = req.body;
    if (!msg || !msg.senderPhone || (!msg.recipientPhone && !msg.groupId)) {
      res.status(400).json({ error: 'بيانات الرسالة غير مكتملة' });
      return;
    }
    store.messages.push(msg);
    saveStore(store);
    broadcast({ type: 'message:new', message: msg });
    res.json({ message: msg });
  });

  // REST API: Get messages for a user phone or group
  app.get('/api/messages', (req, res) => {
    const phone = normalizeDigits(String(req.query.phone || ''));
    const groupId = String(req.query.groupId || '').trim();
    if (groupId) {
      const filtered = store.messages.filter((m) => m.groupId === groupId);
      res.json({ messages: filtered });
      return;
    }
    if (!phone) {
      res.json({ messages: store.messages.slice(-150) });
      return;
    }
    const filtered = store.messages.filter((m) => {
      if (m.groupId) return true;
      const s = normalizeDigits(m.senderPhone);
      const r = normalizeDigits(m.recipientPhone);
      return (
        s === phone ||
        r === phone ||
        s.endsWith(phone.slice(-9)) ||
        r.endsWith(phone.slice(-9))
      );
    });
    res.json({ messages: filtered });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

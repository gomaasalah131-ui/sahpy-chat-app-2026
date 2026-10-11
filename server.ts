import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'sahpy-chat-data.json')
  : path.join(__dirname, 'server-data.json');
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface RegisteredUser {
  id: string; // Real Firebase Auth UID
  uid: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  username: string;
  normalizedUsername: string;
  email?: string;
  bio: string;
  avatar: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface ChatMessagePayload {
  id: string;
  senderUid?: string;
  recipientUid?: string;
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
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

const DEMO_USER_IDS = new Set([
  'user-ahmed',
  'user-sara',
  'user-layla',
  'user-omar',
  'user-nour',
  'user-salah-gomaa',
]);

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
          .filter((u) => !DEMO_USER_IDS.has(u.id) && Boolean(u.uid || u.id))
          .map((u) => ({
            ...u,
            uid: u.uid || u.id,
            id: u.uid || u.id,
            username: normalizeUsername(u.username),
            normalizedUsername: normalizeUsername(u.username),
            emailVerified: Boolean(u.emailVerified),
            phoneVerified: Boolean(u.phoneVerified),
          }));
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read server-data.json, initializing fresh store:', err);
  }
  const initial: ServerStore = {
    users: [],
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

function toPublicUser(u: RegisteredUser) {
  return {
    id: u.uid || u.id,
    uid: u.uid || u.id,
    name: u.name,
    // Never expose raw phone number or email in public directory / search payloads
    phone: u.username ? `@${u.username}` : '',
    normalizedPhone: '',
    username: u.username,
    normalizedUsername: u.normalizedUsername,
    bio: u.bio,
    avatar: u.avatar,
    emailVerified: u.emailVerified,
    phoneVerified: false,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
    createdAt: u.createdAt,
  };
}

function normalizePhoneDigitsCandidates(rawInput: string, defaultCountryCode = '+20'): string[] {
  const digits = normalizeDigits(rawInput);
  if (digits.length < 7) return [];
  const ccDigits = normalizeDigits(defaultCountryCode) || '20';
  const candidates = new Set<string>();

  candidates.add(digits);
  if (rawInput.trim().startsWith('00') && digits.startsWith('00')) {
    candidates.add(digits.slice(2));
  }
  if (digits.startsWith('0')) {
    const withoutZero = digits.replace(/^0+/, '');
    if (withoutZero.length >= 6) {
      candidates.add(`${ccDigits}${withoutZero}`);
    }
  } else if (!digits.startsWith(ccDigits) && digits.length <= 11) {
    candidates.add(`${ccDigits}${digits}`);
  }
  return Array.from(candidates).filter((c) => c.length >= 7 && c.length <= 18);
}

const searchRateLimitMap = new Map<string, number[]>();
function isSearchAllowedForClient(clientKey: string): boolean {
  const now = Date.now();
  const history = (searchRateLimitMap.get(clientKey) || []).filter(
    (t) => now - t < 60000
  );
  if (history.length >= 25) {
    searchRateLimitMap.set(clientKey, history);
    return false;
  }
  history.push(now);
  searchRateLimitMap.set(clientKey, history);
  return true;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json({ limit: '30mb' }));

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, { phone?: string; name?: string; uid?: string }>();

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
        users: [],
        messages: store.messages.slice(-150),
        groups: store.groups,
        stories: store.stories,
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));
        if (data.type === 'identify' && (data.phone || data.uid)) {
          const norm = normalizeDigits(data.phone);
          clients.set(ws, { phone: norm, name: data.name, uid: data.uid });

          const user = store.users.find(
            (u) =>
              (data.uid && u.uid === data.uid) ||
              (norm && u.normalizedPhone === norm)
          );
          if (user) {
            user.isOnline = true;
            user.lastSeen = 'متصل الآن';
            saveStore(store);
          }
        } else if (data.type === 'chat:message' && data.message) {
          const msg: ChatMessagePayload = data.message;
          if (msg.type === 'voice') {
            msg.voiceDuration =
              !msg.voiceDuration || msg.voiceDuration === 'undefined'
                ? '0:05'
                : msg.voiceDuration;
            msg.text =
              String(msg.text || '')
                .replace(/\(undefined\)/gi, '')
                .trim() || 'رسالة صوتية';
          }
          if (!store.messages.some((existingMsg) => existingMsg.id === msg.id)) {
            store.messages.push(msg);
            saveStore(store);
          }
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

  // REST API: Check if username is already taken
  app.get('/api/users/check-username', (req, res) => {
    const cleanUser = normalizeUsername(String(req.query.username || ''));
    if (!cleanUser || cleanUser.length < 3) {
      res.json({ taken: false });
      return;
    }
    const found = store.users.find((u) => u.normalizedUsername === cleanUser);
    res.json({
      taken: Boolean(found),
      uid: found ? found.uid || found.id : undefined,
    });
  });

  // REST API: Safely resolve username to email for Firebase Auth login by username
  app.get('/api/auth/resolve-username', (req, res) => {
    const cleanUser = normalizeUsername(String(req.query.username || ''));
    if (!cleanUser) {
      res.status(400).json({ error: 'يرجى إدخال اسم المستخدم.' });
      return;
    }
    const found = store.users.find((u) => u.normalizedUsername === cleanUser);
    if (!found || !found.email) {
      res.status(404).json({ error: 'USERNAME_NOT_FOUND' });
      return;
    }
    res.json({ email: found.email, uid: found.uid || found.id });
  });

  // REST API: Prevent enumerating all accounts easily — returns empty list unless searched via /api/users/search
  app.get('/api/users', (_req, res) => {
    res.json({ users: [] });
  });

  // REST API: Search real registered users by UID, exact @username, or normalized phone (with rate limiting & zero PII leak)
  app.get('/api/users/search', (req, res) => {
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    if (!isSearchAllowedForClient(clientIp)) {
      res.status(429).json({
        error: 'SEARCH_RATE_LIMITED',
        message: 'لقد تجاوزت الحد المسموح لمحاولات البحث. يرجى الانتظار قليلاً.',
        users: [],
      });
      return;
    }

    const q = String(req.query.q || req.query.phone || '').trim();
    const cc = String(req.query.cc || '+20').trim();
    if (!q || q.length < 3) {
      res.json({ users: [] });
      return;
    }

    const qLower = q.toLowerCase();
    const qUser = normalizeUsername(q);
    const phoneCandidates = normalizePhoneDigitsCandidates(q, cc);

    const matched = store.users.filter((u) => {
      const uidMatch = (u.uid || u.id).toLowerCase() === qLower;
      const usernameMatch =
        qUser.length >= 3 &&
        (u.username?.toLowerCase() === qLower.replace(/^@+/, '') ||
          u.normalizedUsername === qUser);

      const uPhoneDigits = normalizeDigits(u.normalizedPhone || u.phone);
      const phoneMatch =
        uPhoneDigits.length >= 7 &&
        u.phone !== '+0000000' &&
        u.phone !== '+201000000000' &&
        phoneCandidates.some(
          (cand) =>
            cand === uPhoneDigits ||
            (cand.length >= 9 &&
              uPhoneDigits.length >= 9 &&
              cand.slice(-9) === uPhoneDigits.slice(-9))
        );

      return uidMatch || usernameMatch || phoneMatch;
    });

    res.json({ users: matched.slice(0, 5).map(toPublicUser) });
  });

  // REST API: Register or sync verified Firebase Auth user profile (Never stores passwords or OTPs)
  app.post('/api/auth/register', (req, res) => {
    const {
      uid,
      name,
      phone,
      username,
      email,
      bio,
      avatar,
      emailVerified,
    } = req.body || {};

    if (!uid || typeof uid !== 'string') {
      res.status(400).json({
        error: 'يجب التسجيل عبر Firebase Authentication أولاً للحصول على UID حقيقي.',
      });
      return;
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawPhone = String(phone || '').trim();
    const cleanPhone =
      rawPhone === '+0000000' || rawPhone === '+201000000000' ? '' : rawPhone;
    const norm = cleanPhone ? normalizeDigits(cleanPhone) : '';
    const cleanUser = normalizeUsername(username);

    if (!cleanUser || cleanUser.length < 3) {
      res.status(400).json({
        error: 'اسم المستخدم (Username) مطلوب ويجب أن يتكون من 3 أحرف على الأقل.',
      });
      return;
    }

    // Enforce unique username across different UIDs
    const duplicateUsername = store.users.find(
      (u) => u.normalizedUsername === cleanUser && u.uid !== uid && u.id !== uid
    );
    if (duplicateUsername) {
      res.status(409).json({
        error: 'USERNAME_TAKEN',
        message: 'اسم المستخدم مستخدم بالفعل من قبل حساب آخر.',
      });
      return;
    }

    // Enforce unique email across different UIDs
    if (cleanEmail) {
      const duplicateEmail = store.users.find(
        (u) =>
          (u.email || '').toLowerCase() === cleanEmail &&
          u.uid !== uid &&
          u.id !== uid
      );
      if (duplicateEmail) {
        res.status(409).json({
          error: 'EMAIL_ALREADY_REGISTERED',
          message: 'البريد الإلكتروني مسجل بالفعل لحساب آخر.',
        });
        return;
      }
    }

    const existing = store.users.find((u) => u.uid === uid || u.id === uid);

    if (existing) {
      existing.uid = uid;
      existing.id = uid;
      if (name && String(name).trim()) existing.name = String(name).trim();
      if (phone !== undefined) {
        existing.phone = cleanPhone;
        existing.normalizedPhone = norm;
      }
      existing.username = cleanUser;
      existing.normalizedUsername = cleanUser;
      if (cleanEmail) existing.email = cleanEmail;
      if (bio && String(bio).trim()) existing.bio = String(bio).trim();
      if (avatar) existing.avatar = avatar;
      existing.emailVerified = Boolean(emailVerified ?? existing.emailVerified);
      existing.phoneVerified = false;
      existing.isOnline = true;
      existing.lastSeen = 'متصل الآن';
      saveStore(store);
      const pubUser = toPublicUser(existing);
      broadcast({ type: 'user:update', user: pubUser });
      res.json({
        user: pubUser,
        users: [],
        isNew: false,
      });
      return;
    }

    const newUser: RegisteredUser = {
      id: uid,
      uid,
      name: String(name || cleanUser).trim(),
      phone: cleanPhone,
      normalizedPhone: norm,
      username: cleanUser,
      normalizedUsername: cleanUser,
      email: cleanEmail || undefined,
      bio: String(bio || 'متاح للدردشة عبر SAHPY-CHAT ✨').trim(),
      avatar:
        avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
      emailVerified: Boolean(emailVerified),
      phoneVerified: false,
      isOnline: true,
      lastSeen: 'متصل الآن',
      createdAt: new Date().toISOString(),
    };

    store.users.unshift(newUser);
    saveStore(store);

    res.json({
      user: toPublicUser(newUser),
      users: [],
      isNew: true,
    });
  });

  // REST API: Get active 24h stories
  app.get('/api/stories', (_req, res) => {
    store.stories = pruneExpiredStories(store.stories);
    saveStore(store);
    res.json({ stories: store.stories });
  });

  // REST API: Create a new 24h story
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
    const { id, name, description, avatar, createdByPhone, customWallpaper, members } =
      req.body || {};
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

  // REST API: Send message
  app.post('/api/messages', (req, res) => {
    const msg: ChatMessagePayload = req.body;
    if (!msg || !msg.senderPhone || (!msg.recipientPhone && !msg.groupId)) {
      res.status(400).json({ error: 'بيانات الرسالة غير مكتملة' });
      return;
    }
    if (msg.type === 'voice') {
      msg.voiceDuration =
        !msg.voiceDuration || msg.voiceDuration === 'undefined'
          ? '0:05'
          : msg.voiceDuration;
      msg.text =
        String(msg.text || '')
          .replace(/\(undefined\)/gi, '')
          .trim() || 'رسالة صوتية';
    }
    const existing = store.messages.find((m) => m.id === msg.id);
    if (existing) {
      res.json({ message: existing });
      return;
    }
    store.messages.push(msg);
    saveStore(store);
    broadcast({ type: 'message:new', message: msg });
    res.json({ message: msg });
  });

  // REST API: Clear or delete conversation messages
  app.post('/api/chats/clear', (req, res) => {
    const { myUid, myPhone, otherUid, otherPhone, groupId, scope } =
      req.body || {};
    if (!myUid && !myPhone) {
      res.status(400).json({ error: 'غير مصرح بتنفيذ هذه العملية.' });
      return;
    }
    if (scope === 'both') {
      const normMy = normalizeDigits(String(myPhone || ''));
      const normOther = normalizeDigits(String(otherPhone || ''));
      store.messages = store.messages.filter((m) => {
        if (groupId && m.groupId === groupId) {
          return false;
        }
        const mSenderUid = String(m.senderUid || m.senderPhone || '');
        const mRecipUid = String(m.recipientUid || m.recipientPhone || '');
        if (
          myUid &&
          otherUid &&
          ((mSenderUid === myUid && mRecipUid === otherUid) ||
            (mSenderUid === otherUid && mRecipUid === myUid))
        ) {
          return false;
        }
        const sDigits = normalizeDigits(m.senderPhone);
        const rDigits = normalizeDigits(m.recipientPhone);
        if (
          normMy &&
          normOther &&
          ((sDigits === normMy && rDigits === normOther) ||
            (sDigits === normOther && rDigits === normMy))
        ) {
          return false;
        }
        return true;
      });
      saveStore(store);
      broadcast({
        type: 'chat:clear',
        myUid,
        otherUid,
        groupId,
        scope: 'both',
      });
    }
    res.json({ ok: true });
  });

  // REST API: Get messages
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
        (phone.length >= 9 &&
          (s.endsWith(phone.slice(-9)) || r.endsWith(phone.slice(-9))))
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

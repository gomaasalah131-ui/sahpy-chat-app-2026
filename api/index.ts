import express from 'express';
import fs from 'fs';
import path from 'path';

const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'sahpy-chat-data.json')
  : path.join(process.cwd(), 'server-data.json');

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface RegisteredUser {
  id: string;
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

function normalizeDigits(str?: string): string {
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

function normalizeUsername(str?: string): string {
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
    console.error('Failed to read store in serverless function:', err);
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
    console.error('Failed to save store:', err);
  }
}

function toPublicUser(u: RegisteredUser) {
  return {
    id: u.uid || u.id,
    uid: u.uid || u.id,
    name: u.name,
    phone: u.phone,
    normalizedPhone: u.normalizedPhone,
    username: u.username,
    normalizedUsername: u.normalizedUsername,
    bio: u.bio,
    avatar: u.avatar,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
    createdAt: u.createdAt,
  };
}

const app = express();
app.use(express.json({ limit: '30mb' }));

app.get('/api/users/check-username', (req, res) => {
  const store = loadStore();
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

app.get('/api/auth/resolve-username', (req, res) => {
  const store = loadStore();
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

app.get('/api/users', (_req, res) => {
  const store = loadStore();
  res.json({ users: store.users.map(toPublicUser) });
});

app.get('/api/users/search', (req, res) => {
  const store = loadStore();
  const q = String(req.query.q || req.query.phone || '').trim();
  if (!q) {
    res.json({ users: [] });
    return;
  }
  const qDigits = normalizeDigits(q);
  const qLower = q.toLowerCase();
  const qUser = normalizeUsername(q);

  const matched = store.users.filter((u) => {
    const uidMatch = (u.uid || u.id).toLowerCase() === qLower;
    const usernameMatch =
      u.username?.toLowerCase() === qLower.replace(/^@+/, '') ||
      (qUser.length >= 2 && u.normalizedUsername?.includes(qUser));
    const digitMatch =
      qDigits.length >= 4 &&
      (u.normalizedPhone.includes(qDigits) ||
        qDigits.includes(u.normalizedPhone));
    const nameMatch = qLower.length >= 3 && u.name.toLowerCase().includes(qLower);
    return uidMatch || usernameMatch || digitMatch || nameMatch;
  });

  res.json({ users: matched.map(toPublicUser) });
});

app.post('/api/auth/register', (req, res) => {
  const store = loadStore();
  const {
    uid,
    name,
    phone,
    username,
    email,
    bio,
    avatar,
    emailVerified,
    phoneVerified,
  } = req.body || {};

  if (!uid || typeof uid !== 'string') {
    res.status(400).json({
      error: 'يجب التسجيل عبر Firebase Authentication أولاً للحصول على UID حقيقي.',
    });
    return;
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();
  const norm = normalizeDigits(cleanPhone);
  const cleanUser = normalizeUsername(username);

  if (!cleanUser || cleanUser.length < 3) {
    res.status(400).json({
      error: 'اسم المستخدم (Username) مطلوب ويجب أن يتكون من 3 أحرف على الأقل.',
    });
    return;
  }

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
    if (cleanPhone) {
      existing.phone = cleanPhone;
      existing.normalizedPhone = norm;
    }
    existing.username = cleanUser;
    existing.normalizedUsername = cleanUser;
    if (cleanEmail) existing.email = cleanEmail;
    if (bio && String(bio).trim()) existing.bio = String(bio).trim();
    if (avatar) existing.avatar = avatar;
    existing.emailVerified = Boolean(emailVerified ?? existing.emailVerified);
    existing.phoneVerified = Boolean(phoneVerified ?? existing.phoneVerified);
    existing.isOnline = true;
    existing.lastSeen = 'متصل الآن';
    saveStore(store);
    res.json({
      user: toPublicUser(existing),
      users: store.users.map(toPublicUser),
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
    phoneVerified: Boolean(phoneVerified),
    isOnline: true,
    lastSeen: 'متصل الآن',
    createdAt: new Date().toISOString(),
  };

  store.users.unshift(newUser);
  saveStore(store);
  res.json({
    user: toPublicUser(newUser),
    users: store.users.map(toPublicUser),
    isNew: true,
  });
});

app.get('/api/stories', (_req, res) => {
  const store = loadStore();
  store.stories = pruneExpiredStories(store.stories);
  saveStore(store);
  res.json({ stories: store.stories });
});

app.post('/api/stories', (req, res) => {
  const store = loadStore();
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
    res
      .status(400)
      .json({ error: 'يرجى اختيار صورة أو فيديو للحالة اليومية.' });
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
    caption: caption
      ? String(caption).trim()
      : 'حالة يومية جديدة عبر SAHPY-CHAT ✨',
    mediaUrl: String(mediaUrl),
    mediaType: mediaType === 'video' ? 'video' : 'image',
    videoDuration: videoDuration ? Number(videoDuration) : undefined,
    viewsCount: 1,
    likesCount: 0,
  };

  store.stories = pruneExpiredStories(store.stories);
  store.stories.unshift(newStory);
  saveStore(store);
  res.json({ story: newStory, stories: store.stories });
});

app.delete('/api/stories/:storyId', (req, res) => {
  const store = loadStore();
  const { storyId } = req.params;
  store.stories = store.stories.filter((s) => s.id !== storyId);
  saveStore(store);
  res.json({ ok: true, storyId });
});

app.get('/api/groups', (_req, res) => {
  const store = loadStore();
  res.json({ groups: store.groups });
});

app.post('/api/groups', (req, res) => {
  const store = loadStore();
  const {
    id,
    name,
    description,
    avatar,
    createdByPhone,
    customWallpaper,
    members,
  } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'يرجى إدخال اسم المجموعة.' });
    return;
  }

  const newGroup: GroupChatPayload = {
    id: id || `group-${Date.now()}`,
    name: String(name).trim(),
    description: String(
      description || 'مجموعة دردشة على SAHPY-CHAT ✨'
    ).trim(),
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
  res.json({ group: newGroup, groups: store.groups });
});

app.put('/api/groups/:groupId/members', (req, res) => {
  const store = loadStore();
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
  }
  res.json({ group });
});

app.post('/api/messages', (req, res) => {
  const store = loadStore();
  const msg: ChatMessagePayload = req.body;
  if (!msg || !msg.senderPhone || (!msg.recipientPhone && !msg.groupId)) {
    res.status(400).json({ error: 'بيانات الرسالة غير مكتملة' });
    return;
  }
  store.messages.push(msg);
  saveStore(store);
  res.json({ message: msg });
});

app.get('/api/messages', (req, res) => {
  const store = loadStore();
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

export default app;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  BellOff,
  Bell,
  Ban,
  Unlock,
  Palette,
  Send,
  Mic,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Pin,
  Trash2,
  Reply,
  Info,
  VolumeX,
  ShieldAlert,
  Sparkles,
  Image as ImageIcon,
  Play,
  Pause,
  Plus,
  MessageSquarePlus,
  Star,
  X,
  UserPlus,
  Radio,
  Smartphone,
  LogIn,
  LogOut,
  Database,
  Users,
  Film,
  Clock,
  Sticker,
} from 'lucide-react';
import {
  Contact,
  GroupMember,
  Message,
  StoryItem,
  WallpaperConfig,
  WallpaperThemeId,
} from './types/chat';
import {
  BUBBLE_ACCENTS,
  DEFAULT_WALLPAPER_CONFIG,
  INITIAL_CONTACTS,
  INITIAL_STORIES,
  WALLPAPER_THEMES,
} from './data/initialChats';
import { AnimatedChatBackground } from './components/AnimatedChatBackground';
import { WallpaperStudioModal } from './components/WallpaperStudioModal';
import { MuteModal, BlockModal } from './components/MuteBlockModals';
import { ContactInfoDrawer } from './components/ContactInfoDrawer';
import {
  CallModal,
  StoryModal,
  AddStoryModal,
  NewChatModal,
  CreateGroupModal,
  CreateGroupSelectionItem,
  ProfileModal,
} from './components/InteractiveModals';
import {
  PhoneRegistrationScreen,
  RegisteredDirectoryUser,
  StepItem,
  SocialButton,
  InputGroup,
} from './components/PhoneRegistrationScreen';
import {
  auth,
  logoutFromFirebase,
  subscribeToAuthChanges,
  fetchUserProfileByUid,
  findRegisteredUserInFirestore,
  ensureAuthorizedChatRoomInFirestore,
  sendDirectMessageToAuthorizedChat,
  subscribeToAuthorizedChatMessages,
  getDeterministicChatId,
  PublicDirectoryUser,
  syncUserToFirestore,
  syncContactToFirestore,
  sendMessageToFirestore,
  subscribeToFirestoreUsers,
  subscribeToFirestoreMessages,
} from './lib/firebase';

import ahmedAvatar from './assets/images/avatar_ahmed_profile_1791581695415.jpg';
import saraAvatar from './assets/images/avatar_sara_profile_1791581706989.jpg';
import omarAvatar from './assets/images/avatar_omar_profile_1791581716878.jpg';
import uiAttachment from './assets/images/shared_architecture_photo_1791581727260.jpg';

const laylaAvatar =
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80';

const QUICK_REACTIONS = ['❤️', '🔥', '👍', '😂', '😍', '🙏'];
const COMPOSER_EMOJIS = [
  '😊', '😂', '❤️', '🔥', '✨', '🚀', '🌹', '🎉', '😎', '🙏', '💯', '💎',
  '😍', '🤝', '👏', '🤩', '💪', '🌟', '⚡', '👑', '🫶', '🥳', '🎯', '💡',
];

const DEMO_CONTACT_IDS = new Set([
  'salah-gomaa',
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
]);

const DEMO_STORY_IDS = new Set(['s1', 's2', 's3', 's4']);

export interface StickerItem {
  id: string;
  packId: 'greetings' | 'reactions' | 'vibes';
  emoji: string;
  secondaryEmoji: string;
  label: string;
  gradient: string;
}

const STICKER_PACKS: { id: 'all' | 'greetings' | 'reactions' | 'vibes'; label: string; icon: string }[] = [
  { id: 'all', label: 'الكل', icon: '✨' },
  { id: 'greetings', label: 'ترحيب وسلام', icon: '👋' },
  { id: 'reactions', label: 'تفاعل ومشاعر', icon: '❤️' },
  { id: 'vibes', label: 'حماس وشغل عالي', icon: '🚀' },
];

const STICKER_ITEMS: StickerItem[] = [
  // Greetings Pack
  {
    id: 'stk-salam',
    packId: 'greetings',
    emoji: '👋',
    secondaryEmoji: '✨',
    label: 'أهلاً وسهلاً!',
    gradient: 'from-emerald-500/30 via-teal-500/20 to-cyan-500/30 border-emerald-400/40',
  },
  {
    id: 'stk-morning',
    packId: 'greetings',
    emoji: '☀️',
    secondaryEmoji: '☕',
    label: 'صباح الورد والنشاط',
    gradient: 'from-amber-500/30 via-orange-500/20 to-yellow-500/30 border-amber-400/40',
  },
  {
    id: 'stk-evening',
    packId: 'greetings',
    emoji: '🌙',
    secondaryEmoji: '🌟',
    label: 'مساء النور والجمال',
    gradient: 'from-indigo-500/30 via-violet-500/20 to-purple-500/30 border-indigo-400/40',
  },
  {
    id: 'stk-welcome-bro',
    packId: 'greetings',
    emoji: '🤝',
    secondaryEmoji: '👑',
    label: 'منور يا صاحبي!',
    gradient: 'from-cyan-500/30 via-sky-500/20 to-blue-500/30 border-cyan-400/40',
  },
  {
    id: 'stk-friday',
    packId: 'greetings',
    emoji: '🕌',
    secondaryEmoji: '🤍',
    label: 'جمعة مباركة',
    gradient: 'from-emerald-600/30 via-green-500/20 to-teal-500/30 border-emerald-400/40',
  },
  // Reactions Pack
  {
    id: 'stk-love',
    packId: 'reactions',
    emoji: '❤️',
    secondaryEmoji: '🥰',
    label: 'حبيبي تسلم!',
    gradient: 'from-rose-500/30 via-pink-500/20 to-red-500/30 border-rose-400/40',
  },
  {
    id: 'stk-laugh',
    packId: 'reactions',
    emoji: '😂',
    secondaryEmoji: '🤣',
    label: 'هموت من الضحك!',
    gradient: 'from-amber-400/30 via-yellow-500/20 to-orange-500/30 border-amber-400/40',
  },
  {
    id: 'stk-respect',
    packId: 'reactions',
    emoji: '🫡',
    secondaryEmoji: '💎',
    label: 'احترام وتقدير',
    gradient: 'from-violet-500/30 via-purple-500/20 to-fuchsia-500/30 border-violet-400/40',
  },
  {
    id: 'stk-thanks',
    packId: 'reactions',
    emoji: '🙏',
    secondaryEmoji: '🌹',
    label: 'شكراً جزيلاً',
    gradient: 'from-pink-500/30 via-rose-500/20 to-amber-500/30 border-pink-400/40',
  },
  {
    id: 'stk-congrats',
    packId: 'reactions',
    emoji: '🎉',
    secondaryEmoji: '🥳',
    label: 'ألف مبروك!',
    gradient: 'from-fuchsia-500/30 via-purple-500/20 to-indigo-500/30 border-fuchsia-400/40',
  },
  // Vibes & Tech Pack
  {
    id: 'stk-fire-work',
    packId: 'vibes',
    emoji: '🔥',
    secondaryEmoji: '🚀',
    label: 'شغل عالي جداً!',
    gradient: 'from-orange-500/30 via-red-500/20 to-amber-500/30 border-orange-400/40',
  },
  {
    id: 'stk-deal',
    packId: 'vibes',
    emoji: '💯',
    secondaryEmoji: '✅',
    label: 'تمام اتفقنا!',
    gradient: 'from-emerald-500/30 via-green-500/20 to-cyan-500/30 border-emerald-400/40',
  },
  {
    id: 'stk-engineer',
    packId: 'vibes',
    emoji: '💻',
    secondaryEmoji: '⚡',
    label: 'يا هندسة مبدع!',
    gradient: 'from-cyan-500/30 via-blue-500/20 to-indigo-500/30 border-cyan-400/40',
  },
  {
    id: 'stk-on-my-way',
    packId: 'vibes',
    emoji: '🏃‍♂️',
    secondaryEmoji: '💨',
    label: 'في الطريق إليك!',
    gradient: 'from-sky-500/30 via-cyan-500/20 to-teal-500/30 border-sky-400/40',
  },
  {
    id: 'stk-call-me',
    packId: 'vibes',
    emoji: '📞',
    secondaryEmoji: '🔔',
    label: 'كلمني لما تفضى',
    gradient: 'from-lime-500/30 via-emerald-500/20 to-green-500/30 border-lime-400/40',
  },
  {
    id: 'stk-legend',
    packId: 'vibes',
    emoji: '👑',
    secondaryEmoji: '🔥',
    label: 'أسطورة والله!',
    gradient: 'from-yellow-500/30 via-amber-500/20 to-orange-500/30 border-yellow-400/40',
  },
];
const SAMPLE_SHARED_IMAGES = [
  uiAttachment,
  ahmedAvatar,
  saraAvatar,
  omarAvatar,
  laylaAvatar,
];

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

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

function getRemainingHoursBadge(expiresAt?: number): string {
  if (!expiresAt) return '24س';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return '0س';
  const hours = Math.ceil(diff / (1000 * 60 * 60));
  return `${hours}س`;
}

export default function App() {
  // View mode ('registration' shows Login & Sign Up with Gmail, 'chat' shows SAHPY-CHAT)
  const [viewMode, setViewMode] = useState<'registration' | 'chat'>('registration');

  // Contacts & Active Conversation State (Starts clean & empty like real WhatsApp!)
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem('sahpy_chat_real_contacts_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((c: Contact) => c && !DEMO_CONTACT_IDS.has(c.id))
            .map((c: Contact) => ({
              ...c,
              name: String(c.name || '').replace(/الديزينر انجينير\s*/g, '').trim() || c.name,
              roleOrBio: String(c.roleOrBio || '').replace(/الديزينر انجينير\s*/g, '').replace(/نبض شات/g, 'SAHPY-CHAT'),
            }));
        }
      }
      // Migrate any real non-demo contacts from v4 if present
      const oldSaved = localStorage.getItem('nabd_chat_contacts_v4');
      if (oldSaved) {
        const parsedOld = JSON.parse(oldSaved);
        if (Array.isArray(parsedOld)) {
          return parsedOld.filter((c: Contact) => c && !DEMO_CONTACT_IDS.has(c.id));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Global Registered Users Directory (from Backend + Firestore)
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredDirectoryUser[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);

  // Group Chat sender identity simulator (allows sending as yourself or testing multi-member replies)
  const [groupSenderMemberId, setGroupSenderMemberId] = useState<string>('me');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'unread' | 'groups' | 'muted' | 'blocked' | 'starred'
  >('all');
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');

  // Composer State
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers'>('stickers');
  const [selectedStickerPack, setSelectedStickerPack] = useState<
    'all' | 'greetings' | 'reactions' | 'vibes'
  >('all');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Audio Playback Simulation State
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Wallpaper & Theme State
  const [wallpaperConfig, setWallpaperConfig] = useState<WallpaperConfig>(() => {
    try {
      const saved = localStorage.getItem('nabd_chat_wallpaper_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_WALLPAPER_CONFIG;
  });
  const [applyPerContactWallpaper, setApplyPerContactWallpaper] = useState(true);

  // Modals & Drawers State
  const [isWallpaperStudioOpen, setIsWallpaperStudioOpen] = useState(false);
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [activeHeaderMenu, setActiveHeaderMenu] = useState(false);

  // Interactive Modals State (Calls, 24h Stories, New Chat, Create Group, Profile)
  const [activeCall, setActiveCall] = useState<'audio' | 'video' | null>(null);
  const [stories, setStories] = useState<StoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('sahpy_chat_real_stories_v2');
      if (saved) {
        const parsed = JSON.parse(saved) as StoryItem[];
        const now = Date.now();
        return parsed.filter(
          (s) => s && !DEMO_STORY_IDS.has(s.id) && s.expiresAt && s.expiresAt > now
        );
      }
      const oldSaved = localStorage.getItem('sahpy_chat_stories_v1');
      if (oldSaved) {
        const parsedOld = JSON.parse(oldSaved) as StoryItem[];
        const now = Date.now();
        return parsedOld.filter(
          (s) => s && !DEMO_STORY_IDS.has(s.id) && s.expiresAt && s.expiresAt > now
        );
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [isAddStoryOpen, setIsAddStoryOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Current User Profile State
  const [currentUserUid, setCurrentUserUid] = useState<string>(
    () => localStorage.getItem('nabd_user_uid') || ''
  );
  const [userName, setUserName] = useState(() => {
    const raw = localStorage.getItem('nabd_user_name') || '𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸';
    return raw.replace(/الديزينر انجينير\s*/g, '').trim() || '𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸';
  });
  const [userPhone, setUserPhone] = useState(
    () => localStorage.getItem('nabd_user_phone') || '+20 109 876 5432'
  );
  const [userUsername, setUserUsername] = useState(
    () => localStorage.getItem('nabd_user_username') || 'salah_gomaa'
  );
  const [userBio, setUserBio] = useState(() => {
    const raw = localStorage.getItem('nabd_user_bio') || 'Lead Architect & Founder — SAHPY-CHAT ✨';
    return raw.replace(/الديزينر انجينير\s*/g, '').replace(/نبض شات/g, 'SAHPY-CHAT');
  });
  const [userAvatar, setUserAvatar] = useState(
    () => localStorage.getItem('nabd_user_avatar') || ahmedAvatar
  );
  const [sidebarFirestoreMatch, setSidebarFirestoreMatch] =
    useState<PublicDirectoryUser | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  // Automatically filter out expired stories (> 24 hours old)
  const activeStories = React.useMemo(() => {
    const now = Date.now();
    return stories.filter((s) => !s.expiresAt || s.expiresAt > now);
  }, [stories]);

  useEffect(() => {
    try {
      localStorage.setItem('sahpy_chat_real_stories_v2', JSON.stringify(activeStories));
    } catch (e) {
      console.error(e);
    }
  }, [activeStories]);

  // Periodic 60-second check to prune stories older than 24 hours
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setStories((prev) => {
        const next = prev.filter((s) => !s.expiresAt || s.expiresAt > now);
        return next.length === prev.length ? prev : next;
      });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Save contacts & wallpaper to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sahpy_chat_real_contacts_v5', JSON.stringify(contacts));
    } catch (e) {
      console.error(e);
    }
  }, [contacts]);

  useEffect(() => {
    try {
      localStorage.setItem('nabd_chat_wallpaper_v1', JSON.stringify(wallpaperConfig));
    } catch (e) {
      console.error(e);
    }
  }, [wallpaperConfig]);

  // Helper to merge registered users into the local contacts list
  const mergeUsersIntoContacts = useCallback(
    (usersList: RegisteredDirectoryUser[], myPhone: string) => {
      const myNorm = normalizeDigits(myPhone);
      setContacts((prev) => {
        const updated = [...prev];
        let changed = false;

        usersList.forEach((u) => {
          if (!u || !u.phone) return;
          const uNorm = u.normalizedPhone || normalizeDigits(u.phone);
          if (!uNorm) return;
          if (myNorm && uNorm === myNorm) return;

          const existingIdx = updated.findIndex((c) => {
            if (c.isGroup) return false;
            const cNorm = normalizeDigits(c.phone);
            const cUser = normalizeUsername(c.username);
            const uUser = normalizeUsername(u.username);
            return (
              (cNorm.length >= 7 &&
                (cNorm === uNorm ||
                  cNorm.endsWith(uNorm.slice(-9)) ||
                  uNorm.endsWith(cNorm.slice(-9)))) ||
              (cUser.length >= 3 && uUser.length >= 3 && cUser === uUser)
            );
          });

          // Privacy like WhatsApp: NEVER auto-add registered strangers into contacts!
          // Only update metadata (username/avatar) if the contact is ALREADY in the user's chats.
          if (existingIdx !== -1) {
            if (u.username && !updated[existingIdx].username) {
              changed = true;
              updated[existingIdx] = {
                ...updated[existingIdx],
                username: u.username,
              };
            }
            if (u.avatar && updated[existingIdx].avatar !== u.avatar) {
              changed = true;
              updated[existingIdx] = {
                ...updated[existingIdx],
                avatar: u.avatar,
              };
            }
          }
        });

        return changed ? updated : prev;
      });
    },
    []
  );

  // Helper to append an incoming or synced message (1-on-1 or Group Chat)
  const appendMessageToContact = useCallback(
    (
      msg: {
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
      },
      myPhone: string
    ) => {
      const myNorm = normalizeDigits(myPhone);
      const sNorm = normalizeDigits(msg.senderPhone);
      const rNorm = normalizeDigits(msg.recipientPhone);

      if (msg.groupId) {
        const isFromMe = Boolean(
          myNorm &&
            (sNorm === myNorm ||
              (sNorm.length >= 9 && sNorm.endsWith(myNorm.slice(-9))))
        );

        setContacts((prev) =>
          prev.map((c) => {
            if (c.id !== msg.groupId) return c;
            if (c.messages.some((m) => m.id === msg.id)) return c;
            const newMsg: Message = {
              id: msg.id,
              senderId: isFromMe ? 'me' : msg.senderPhone || 'member',
              senderName: msg.senderName,
              senderPhone: msg.senderPhone,
              senderAvatar: msg.senderAvatar,
              text: msg.text,
              timestamp: msg.timestamp,
              status: 'read',
              type: msg.type || 'text',
              voiceDuration: msg.voiceDuration,
              imageUrl: msg.imageUrl,
              imageCaption: msg.imageCaption,
              stickerId: msg.stickerId,
              stickerEmoji: msg.stickerEmoji,
              stickerLabel: msg.stickerLabel,
              stickerGradient: msg.stickerGradient,
              stickerPackId: msg.stickerPackId,
              reactions: [],
            };
            return {
              ...c,
              unreadCount: isFromMe ? c.unreadCount : c.unreadCount + 1,
              messages: [...c.messages, newMsg],
            };
          })
        );
        return;
      }

      const isFromMe = Boolean(
        myNorm &&
          (sNorm === myNorm ||
            (sNorm.length >= 9 &&
              myNorm.length >= 9 &&
              sNorm.slice(-9) === myNorm.slice(-9)))
      );
      const isToMe = Boolean(
        myNorm &&
          (rNorm === myNorm ||
            (rNorm.length >= 9 &&
              myNorm.length >= 9 &&
              rNorm.slice(-9) === myNorm.slice(-9)))
      );
      if (!isFromMe && !isToMe) return;

      const otherNorm = isFromMe ? rNorm : sNorm;
      const otherRawPhone = isFromMe ? msg.recipientPhone : msg.senderPhone;
      const otherName = isFromMe
        ? msg.recipientPhone
        : msg.senderName || msg.senderPhone;

      if (!otherNorm) return;

      setContacts((prev) => {
        const idx = prev.findIndex((c) => {
          if (c.isGroup) return false;
          const cNorm = normalizeDigits(c.phone);
          return (
            cNorm.length >= 7 &&
            (cNorm === otherNorm ||
              cNorm.endsWith(otherNorm.slice(-9)) ||
              otherNorm.endsWith(cNorm.slice(-9)))
          );
        });

        const formattedMsg: Message = {
          id: msg.id,
          senderId: isFromMe ? 'me' : prev[idx]?.id || `contact-${otherNorm}`,
          senderName: msg.senderName,
          senderPhone: msg.senderPhone,
          senderAvatar: msg.senderAvatar,
          text: msg.text,
          timestamp: msg.timestamp,
          status: 'read',
          type: msg.type || 'text',
          voiceDuration: msg.voiceDuration,
          imageUrl: msg.imageUrl,
          imageCaption: msg.imageCaption,
          stickerId: msg.stickerId,
          stickerEmoji: msg.stickerEmoji,
          stickerLabel: msg.stickerLabel,
          stickerGradient: msg.stickerGradient,
          stickerPackId: msg.stickerPackId,
          reactions: [],
        };

        if (idx !== -1) {
          const target = prev[idx];
          if (target.messages.some((m) => m.id === msg.id)) return prev;
          const next = [...prev];
          next[idx] = {
            ...target,
            name: !isFromMe && msg.senderName ? msg.senderName : target.name,
            avatar: !isFromMe && msg.senderAvatar ? msg.senderAvatar : target.avatar,
            unreadCount: isFromMe ? target.unreadCount : target.unreadCount + 1,
            messages: [...target.messages, formattedMsg],
          };
          return next;
        } else {
          const newContact: Contact = {
            id: `contact-${otherNorm}`,
            name: otherName,
            phone: otherRawPhone,
            username: normalizeUsername(otherName),
            avatar: (!isFromMe && msg.senderAvatar) ? msg.senderAvatar : omarAvatar,
            roleOrBio: 'مستخدم مسجل في SAHPY-CHAT ✨',
            isOnline: true,
            lastSeen: 'متصل الآن',
            unreadCount: isFromMe ? 0 : 1,
            isPinned: false,
            isMuted: false,
            isBlocked: false,
            customWallpaper: 'aurora-borealis',
            sharedMedia: [],
            messages: [formattedMsg],
          };
          return [newContact, ...prev];
        }
      });
    },
    []
  );

  // Sync with Firebase Authentication Session & Cloud Firestore
  useEffect(() => {
    const unsubAuth = subscribeToAuthChanges(async (fbUser) => {
      if (fbUser && fbUser.emailVerified) {
        setCurrentUserUid(fbUser.uid);
        localStorage.setItem('nabd_user_uid', fbUser.uid);
        const profile = await fetchUserProfileByUid(fbUser.uid);
        if (profile) {
          setUserName(profile.displayName || fbUser.displayName || userName);
          if (profile.phoneTag) setUserPhone(profile.phoneTag);
          if (profile.username) setUserUsername(profile.username);
          if (profile.bio) setUserBio(profile.bio);
          setFirestoreConnected(true);
        }
      } else if (!fbUser) {
        setCurrentUserUid('');
        localStorage.removeItem('nabd_user_uid');
      }
    });
    return () => unsubAuth();
  }, [userName]);

  // Search Firestore when typing in sidebar search box
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSidebarFirestoreMatch(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await findRegisteredUserInFirestore(q);
      if (!cancelled) {
        if (found && found.uid !== (currentUserUid || auth.currentUser?.uid)) {
          setSidebarFirestoreMatch(found);
        } else {
          setSidebarFirestoreMatch(null);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, currentUserUid]);

  // Sync with Firebase Cloud Firestore
  useEffect(() => {
    if (auth.currentUser && auth.currentUser.emailVerified) {
      syncUserToFirestore({
        name: userName,
        phone: userPhone,
        bio: userBio,
        avatar: userAvatar,
      }).then(() => {
        setFirestoreConnected(true);
      });
    }

    const unsubUsers = subscribeToFirestoreUsers((cloudUsers) => {
      setFirestoreConnected(true);
      setRegisteredUsers((prev) => {
        const merged = [...prev];
        cloudUsers.forEach((cu) => {
          const exists = merged.some(
            (u) =>
              normalizeDigits(u.phone) ===
              (cu.normalizedPhone || normalizeDigits(cu.phone))
          );
          if (!exists) {
            merged.push({
              id: cu.id,
              name: cu.name,
              phone: cu.phone,
              normalizedPhone: cu.normalizedPhone,
              username: normalizeUsername(cu.name),
              bio: cu.bio,
              avatar: cu.avatar,
              isOnline: cu.isOnline,
              lastSeen: cu.lastSeen,
            });
          }
        });
        mergeUsersIntoContacts(merged, userPhone);
        return merged;
      });
    });

    const unsubMessages = subscribeToFirestoreMessages((cloudMsgs) => {
      cloudMsgs.forEach((m) => {
        appendMessageToContact(m, userPhone);
      });
    });

    return () => {
      unsubUsers();
      unsubMessages();
    };
  }, [userName, userPhone, userBio, mergeUsersIntoContacts, appendMessageToContact]);

  // Connect to Backend REST + WebSocket for Users, Groups, Messages & 24h Stories
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setRegisteredUsers(data.users);
          mergeUsersIntoContacts(data.users, userPhone);
        }
      })
      .catch(() => {});

    fetch('/api/stories')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.stories) && data.stories.length > 0) {
          setStories((prev) => {
            const now = Date.now();
            const map = new Map<string, StoryItem>();
            [...data.stories, ...prev].forEach((s: StoryItem) => {
              if (!s.expiresAt || s.expiresAt > now) {
                map.set(s.id, s);
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(
        JSON.stringify({
          type: 'identify',
          phone: userPhone,
          name: userName,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          if (Array.isArray(data.users)) {
            setRegisteredUsers(data.users);
            mergeUsersIntoContacts(data.users, userPhone);
          }
          if (Array.isArray(data.stories) && data.stories.length > 0) {
            setStories((prev) => {
              const now = Date.now();
              const map = new Map<string, StoryItem>();
              [...data.stories, ...prev].forEach((s: StoryItem) => {
                if (!s.expiresAt || s.expiresAt > now) {
                  map.set(s.id, s);
                }
              });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(data.groups)) {
            setContacts((prev) => {
              const next = [...prev];
              data.groups.forEach((g: any) => {
                if (!next.some((c) => c.id === g.id)) {
                  next.unshift({
                    id: g.id,
                    name: g.name,
                    phone: `مجموعة • ${g.members?.length || 1} أعضاء`,
                    avatar: g.avatar || omarAvatar,
                    roleOrBio: g.description || 'مجموعة دردشة على SAHPY-CHAT ✨',
                    isOnline: true,
                    lastSeen: `${g.members?.length || 1} أعضاء`,
                    unreadCount: 0,
                    isPinned: true,
                    isMuted: false,
                    isBlocked: false,
                    isGroup: true,
                    membersCount: g.members?.length || 1,
                    groupMembers: g.members || [],
                    customWallpaper: g.customWallpaper || 'cosmic-nebula',
                    sharedMedia: [],
                    messages: [],
                  });
                }
              });
              return next;
            });
          }
          if (Array.isArray(data.messages)) {
            data.messages.forEach((m: any) => appendMessageToContact(m, userPhone));
          }
        } else if (data.type === 'users:update' && Array.isArray(data.users)) {
          setRegisteredUsers(data.users);
          mergeUsersIntoContacts(data.users, userPhone);
        } else if (data.type === 'story:new' && data.story) {
          setStories((prev) => {
            if (prev.some((s) => s.id === data.story.id)) return prev;
            return [data.story, ...prev];
          });
        } else if (data.type === 'story:delete' && data.storyId) {
          setStories((prev) => prev.filter((s) => s.id !== data.storyId));
        } else if (data.type === 'group:new' && data.group) {
          const g = data.group;
          setContacts((prev) => {
            if (prev.some((c) => c.id === g.id)) return prev;
            const newGroupContact: Contact = {
              id: g.id,
              name: g.name,
              phone: `مجموعة • ${g.members?.length || 1} أعضاء`,
              avatar: g.avatar || omarAvatar,
              roleOrBio: g.description || 'مجموعة دردشة على SAHPY-CHAT ✨',
              isOnline: true,
              lastSeen: `${g.members?.length || 1} أعضاء`,
              unreadCount: 1,
              isPinned: true,
              isMuted: false,
              isBlocked: false,
              isGroup: true,
              membersCount: g.members?.length || 1,
              groupMembers: g.members || [],
              customWallpaper: g.customWallpaper || 'cosmic-nebula',
              sharedMedia: [],
              messages: [
                {
                  id: `grp-welcome-${g.id}`,
                  senderId: 'system',
                  senderName: 'النظام',
                  text: `تم إنشاء المجموعة "${g.name}" وإضافة ${g.members?.length || 1} أعضاء 🎉`,
                  timestamp: 'الآن',
                  status: 'read',
                  type: 'text',
                  reactions: [],
                },
              ],
            };
            return [newGroupContact, ...prev];
          });
        } else if (data.type === 'message:new' && data.message) {
          appendMessageToContact(data.message, userPhone);
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    // Real-time background sync every 3.5s for mobile/multi-device reliability
    const syncInterval = setInterval(() => {
      if (userPhone) {
        fetch(`/api/messages?phone=${encodeURIComponent(userPhone)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && Array.isArray(data.messages)) {
              data.messages.forEach((m: any) =>
                appendMessageToContact(m, userPhone)
              );
            }
          })
          .catch(() => {});
      }
      fetch('/api/users')
        .then((r) => r.json())
        .then((data) => {
          if (data && Array.isArray(data.users)) {
            setRegisteredUsers(data.users);
            mergeUsersIntoContacts(data.users, userPhone);
          }
        })
        .catch(() => {});
    }, 3500);

    return () => {
      clearInterval(syncInterval);
      ws.close();
    };
  }, [userPhone, userName, mergeUsersIntoContacts, appendMessageToContact]);

  // Selected Contact
  const selectedContact =
    contacts.find((c) => c.id === selectedContactId) || contacts[0];

  // Subscribe to authorized Firestore chat room messages when chatting with a registered user
  useEffect(() => {
    const myUid = currentUserUid || auth.currentUser?.uid;
    const targetUid = selectedContact?.uid;
    if (!myUid || !targetUid || selectedContact?.isGroup || myUid === targetUid) {
      return;
    }
    const chatId =
      selectedContact?.chatId || getDeterministicChatId(myUid, targetUid);

    const unsub = subscribeToAuthorizedChatMessages(chatId, (cloudMsgs) => {
      setFirestoreConnected(true);
      setContacts((prev) =>
        prev.map((c) => {
          if (c.id !== selectedContact.id && c.uid !== targetUid) return c;
          const existingIds = new Set(c.messages.map((m) => m.id));
          const additions: Message[] = [];
          cloudMsgs.forEach((cm) => {
            if (!existingIds.has(cm.id)) {
              const isFromMe = cm.senderUid === myUid;
              additions.push({
                id: cm.id,
                senderId: isFromMe ? 'me' : c.id,
                senderUid: cm.senderUid,
                senderName: cm.senderName,
                text: cm.text,
                timestamp: new Date(cm.createdAt).toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                status: 'read',
                type: cm.type || 'text',
                reactions: [],
              });
            }
          });
          if (additions.length === 0) return c;
          return {
            ...c,
            chatId,
            messages: [...c.messages, ...additions],
          };
        })
      );
    });

    return () => unsub();
  }, [currentUserUid, selectedContact?.id, selectedContact?.uid, selectedContact?.chatId, selectedContact?.isGroup]);

  // Reset groupSenderMemberId when switching contacts
  useEffect(() => {
    setGroupSenderMemberId('me');
  }, [selectedContactId]);

  // Effective Wallpaper Config
  const effectiveWallpaperConfig: WallpaperConfig =
    applyPerContactWallpaper && selectedContact?.customWallpaper
      ? { ...wallpaperConfig, themeId: selectedContact.customWallpaper }
      : wallpaperConfig;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedContact?.messages.length, selectedContactId]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Voice recording timer
  useEffect(() => {
    if (!isRecordingVoice) {
      setRecordingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecordingVoice]);

  // Filter and sort contacts (supports searching by Name, Phone Number, or @Username!)
  const filteredContacts = contacts
    .filter((c) => {
      const qRaw = searchQuery.trim();
      const qLower = qRaw.toLowerCase();
      const qDigits = normalizeDigits(qRaw);
      const qUser = normalizeUsername(qRaw);

      const cDigits = normalizeDigits(c.phone);
      const cUser = normalizeUsername(c.username);

      const matchesName = (c.name || '').toLowerCase().includes(qLower);
      const matchesBio = (c.roleOrBio || '').toLowerCase().includes(qLower);
      const matchesRawPhone = (c.phone || '').toLowerCase().includes(qLower);
      const matchesUsername =
        cUser.length > 0 && qUser.length > 0 && cUser.includes(qUser);
      const matchesNormalizedPhone =
        qDigits.length > 0 &&
        (cDigits.includes(qDigits) || qDigits.includes(cDigits));

      const matchesMessage = c.messages.some((m) =>
        (m.text || '').toLowerCase().includes(qLower)
      );

      const matchesSearch =
        !qRaw ||
        matchesName ||
        matchesBio ||
        matchesRawPhone ||
        matchesUsername ||
        matchesNormalizedPhone ||
        matchesMessage;

      if (!matchesSearch) return false;
      if (activeFilter === 'unread') return c.unreadCount > 0;
      if (activeFilter === 'groups') return Boolean(c.isGroup);
      if (activeFilter === 'muted') return c.isMuted;
      if (activeFilter === 'blocked') return c.isBlocked;
      if (activeFilter === 'starred')
        return c.messages.some((m) => m.isStarred);
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  // Registered users matching active search query (only shown when searching by phone or @username, like WhatsApp)
  const searchedDirectoryUsers = React.useMemo(() => {
    const qRaw = searchQuery.trim();
    if (qRaw.length < 2) return [];
    const qLower = qRaw.toLowerCase();
    const qDigits = normalizeDigits(qRaw);
    const qUser = normalizeUsername(qRaw);
    const myUid = currentUserUid || auth.currentUser?.uid || '';

    const results: RegisteredDirectoryUser[] = [];

    if (sidebarFirestoreMatch && sidebarFirestoreMatch.uid !== myUid) {
      const alreadyInContacts = contacts.some(
        (c) =>
          !c.isGroup &&
          (c.uid === sidebarFirestoreMatch.uid ||
            c.id === sidebarFirestoreMatch.uid ||
            normalizeUsername(c.username) ===
              normalizeUsername(sidebarFirestoreMatch.username))
      );
      if (!alreadyInContacts) {
        results.push({
          id: sidebarFirestoreMatch.uid,
          uid: sidebarFirestoreMatch.uid,
          name: sidebarFirestoreMatch.displayName,
          phone: sidebarFirestoreMatch.phoneVerified
            ? 'مؤكد عبر OTP'
            : 'مسجل في Firestore',
          username: sidebarFirestoreMatch.username,
          bio: sidebarFirestoreMatch.bio || 'مستخدم موثق في SAHPY-CHAT ✨',
          avatar: omarAvatar,
          emailVerified: sidebarFirestoreMatch.emailVerified,
          phoneVerified: sidebarFirestoreMatch.phoneVerified,
          isOnline: true,
          lastSeen: 'موثق في Firestore',
        });
      }
    }

    registeredUsers.forEach((u) => {
      const uUid = u.uid || u.id;
      if (myUid && uUid === myUid) return;
      if (results.some((r) => (r.uid || r.id) === uUid)) return;

      const uDigits = u.normalizedPhone || normalizeDigits(u.phone);
      const uUser = normalizeUsername(u.username);
      const alreadyInContacts = contacts.some(
        (c) =>
          !c.isGroup &&
          (c.uid === uUid ||
            c.id === uUid ||
            (uDigits.length >= 7 && normalizeDigits(c.phone) === uDigits) ||
            (uUser.length >= 3 && normalizeUsername(c.username) === uUser))
      );
      if (alreadyInContacts) return;

      const matchesUid = uUid.toLowerCase() === qLower;
      const matchesPhone =
        (qDigits.length >= 3 && uDigits.includes(qDigits)) ||
        (u.phone || '').toLowerCase().includes(qLower);
      const matchesUser = qUser.length >= 2 && uUser.includes(qUser);
      const matchesName = (u.name || '').toLowerCase().includes(qLower);
      if (matchesUid || matchesPhone || matchesUser || matchesName) {
        results.push(u);
      }
    });

    return results;
  }, [searchQuery, registeredUsers, contacts, sidebarFirestoreMatch, currentUserUid]);

  // Complete Registration / Login Handler (Firebase Auth UID + Gmail + Phone + Username + Profile Avatar)
  const handleCompleteRegistration = async ({
    uid,
    name,
    phone,
    username,
    email,
    bio,
    avatar,
    emailVerified,
    phoneVerified,
    stayOnScreen,
  }: {
    uid?: string;
    name: string;
    phone: string;
    username: string;
    email?: string;
    bio: string;
    avatar?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    stayOnScreen?: boolean;
  }) => {
    const cleanUser = normalizeUsername(username) || 'salah_gomaa';
    const finalAvatar = avatar || userAvatar || ahmedAvatar;
    const effectiveUid = uid || auth.currentUser?.uid || currentUserUid || '';
    if (effectiveUid) {
      setCurrentUserUid(effectiveUid);
      localStorage.setItem('nabd_user_uid', effectiveUid);
    }

    let data: { users?: RegisteredDirectoryUser[]; error?: string } = {};
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: effectiveUid,
          name,
          phone,
          username: cleanUser,
          email,
          bio,
          avatar: finalAvatar,
          emailVerified: emailVerified ?? true,
          phoneVerified: phoneVerified ?? false,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      }
    } catch {
      // Fallback for static or cold-start environments
    }

    setUserName(name);
    setUserPhone(phone);
    setUserUsername(cleanUser);
    setUserBio(bio);
    setUserAvatar(finalAvatar);
    localStorage.setItem('nabd_user_name', name);
    localStorage.setItem('nabd_user_phone', phone);
    localStorage.setItem('nabd_user_username', cleanUser);
    localStorage.setItem('nabd_user_bio', bio);
    localStorage.setItem('nabd_user_avatar', finalAvatar);

    if (auth.currentUser && auth.currentUser.emailVerified) {
      syncUserToFirestore({
        name,
        phone,
        bio,
        avatar: finalAvatar,
      });
    }

    if (Array.isArray(data.users)) {
      setRegisteredUsers(data.users);
      mergeUsersIntoContacts(data.users, phone);
    } else if (effectiveUid) {
      const fallbackEntry: RegisteredDirectoryUser = {
        id: effectiveUid,
        uid: effectiveUid,
        name,
        phone,
        normalizedPhone: normalizeDigits(phone),
        username: cleanUser,
        normalizedUsername: cleanUser,
        email,
        bio,
        avatar: finalAvatar,
        emailVerified: emailVerified ?? true,
        phoneVerified: phoneVerified ?? false,
        isOnline: true,
        lastSeen: 'متصل الآن',
      };
      setRegisteredUsers((prev) => {
        const exists = prev.some(
          (u) =>
            (u.uid || u.id) === effectiveUid ||
            normalizeUsername(u.username) === cleanUser
        );
        return exists ? prev : [fallbackEntry, ...prev];
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'identify',
          phone,
          name,
        })
      );
    }

    if (!stayOnScreen) {
      setViewMode('chat');
      triggerToast(
        `مرحباً ${name}! تم تسجيل الدخول بنجاح (@${cleanUser}) في SAHPY-CHAT ✅`
      );
    }
  };

  // Real Logout Handler
  const handleRealLogout = async () => {
    await logoutFromFirebase();
    setCurrentUserUid('');
    localStorage.removeItem('nabd_user_uid');
    setViewMode('registration');
    triggerToast('تم تسجيل الخروج الآمن من حسابك في SAHPY-CHAT 🔒');
  };

  // Start chat with a verified registered user from directory / Firestore
  const handleStartChatWithDirectoryUser = async (user: RegisteredDirectoryUser) => {
    const myUid = currentUserUid || auth.currentUser?.uid || '';
    if (!myUid && !auth.currentUser) {
      triggerToast('يجب تسجيل الدخول وتأكيد هويتك أولاً قبل بدء محادثة.');
      setViewMode('registration');
      return;
    }

    let targetUid = user.uid || user.id || '';
    if (!targetUid && user.username) {
      const found = await findRegisteredUserInFirestore(user.username);
      if (found) targetUid = found.uid;
    }
    if (!targetUid) {
      triggerToast(
        'لا يمكن إنشاء محادثة مع مستخدم غير مسجل فعلياً في قاعدة بيانات Firestore.'
      );
      return;
    }

    const uNorm = user.normalizedPhone || normalizeDigits(user.phone);
    const existing = contacts.find(
      (c) =>
        !c.isGroup &&
        (c.uid === targetUid ||
          c.id === targetUid ||
          (uNorm.length >= 7 && normalizeDigits(c.phone) === uNorm) ||
          (user.username &&
            normalizeUsername(c.username) === normalizeUsername(user.username)))
    );

    const chatId =
      myUid && targetUid && myUid !== targetUid
        ? getDeterministicChatId(myUid, targetUid)
        : undefined;

    if (myUid && targetUid && myUid !== targetUid) {
      ensureAuthorizedChatRoomInFirestore({
        myUid,
        otherUid: targetUid,
        myUsername: userUsername,
        otherUsername: user.username || normalizeUsername(user.name),
      }).catch(() => {});
    }

    if (existing) {
      setSelectedContactId(existing.id);
    } else {
      const newId = targetUid;
      const newContact: Contact = {
        id: newId,
        uid: targetUid,
        chatId,
        name: user.name,
        phone: user.phone,
        username: user.username || normalizeUsername(user.name),
        avatar: user.avatar || omarAvatar,
        roleOrBio: user.bio || 'مستخدم مسجل وموثق في SAHPY-CHAT ✨',
        isOnline: true,
        lastSeen: 'متصل الآن',
        unreadCount: 0,
        isPinned: true,
        isMuted: false,
        isBlocked: false,
        customWallpaper: 'aurora-borealis',
        sharedMedia: [],
        messages: [],
      };
      setContacts((prev) => [newContact, ...prev]);
      syncContactToFirestore(newContact);
      setSelectedContactId(newId);
    }
    setViewMode('chat');
    setMobileShowChat(true);
  };

  // Select Contact Handler
  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setMobileShowChat(true);
    setActiveHeaderMenu(false);
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Create New Group Chat Handler
  const handleCreateGroup = async ({
    name,
    description,
    customWallpaper,
    members,
  }: {
    name: string;
    description: string;
    customWallpaper: WallpaperThemeId;
    members: CreateGroupSelectionItem[];
  }) => {
    const groupId = `group-${Date.now()}`;
    const fullMembers: GroupMember[] = [
      {
        id: 'me',
        name: `${userName} (أنت)`,
        phone: userPhone,
        username: userUsername,
        avatar: userAvatar,
        role: 'admin',
        isOnline: true,
      },
      ...members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        username: m.username || normalizeUsername(m.name),
        avatar: m.avatar || omarAvatar,
        role: 'member' as const,
        isOnline: m.isOnline ?? true,
      })),
    ];

    const newGroup: Contact = {
      id: groupId,
      name,
      phone: `مجموعة • ${fullMembers.length} أعضاء`,
      username: normalizeUsername(name),
      avatar: members[0]?.avatar || omarAvatar,
      roleOrBio: description,
      isOnline: true,
      lastSeen: `${fullMembers.length} أعضاء مشاركين`,
      unreadCount: 0,
      isPinned: true,
      isMuted: false,
      isBlocked: false,
      isGroup: true,
      membersCount: fullMembers.length,
      groupMembers: fullMembers,
      groupAdminPhone: userPhone,
      customWallpaper,
      sharedMedia: [],
      messages: [
        {
          id: `grp-init-${Date.now()}`,
          senderId: 'me',
          senderName: userName,
          senderPhone: userPhone,
          text: `مرحباً بالجميع في مجموعة "${name}"! تم إضافة ${fullMembers.length} أعضاء للدردشة الجماعية 🚀`,
          timestamp: new Date().toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'read',
          type: 'text',
          reactions: [{ emoji: '🎉', count: fullMembers.length, userReacted: true }],
        },
      ],
    };

    setContacts((prev) => [newGroup, ...prev]);
    setSelectedContactId(groupId);
    setMobileShowChat(true);
    syncContactToFirestore(newGroup);

    fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: groupId,
        name,
        description,
        avatar: newGroup.avatar,
        createdByPhone: userPhone,
        customWallpaper,
        members: fullMembers,
      }),
    }).catch(() => {});

    triggerToast(`تم إنشاء المجموعة "${name}" بنجاح مع ${fullMembers.length} أعضاء 👥`);
  };

  // Add Member to an Existing Group
  const handleAddGroupMember = (groupId: string, newMember: GroupMember) => {
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== groupId) return c;
        const existing = c.groupMembers || [];
        if (existing.some((m) => m.id === newMember.id || m.phone === newMember.phone)) {
          return c;
        }
        const updatedMembers = [...existing, newMember];
        const sysMsg: Message = {
          id: `sys-add-${Date.now()}`,
          senderId: 'me',
          senderName: userName,
          text: `تمت إضافة العضو "${newMember.name}" (${newMember.phone}) إلى المجموعة ✨`,
          timestamp: new Date().toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'read',
          type: 'text',
          reactions: [],
        };
        const updatedGroup: Contact = {
          ...c,
          phone: `مجموعة • ${updatedMembers.length} أعضاء`,
          lastSeen: `${updatedMembers.length} أعضاء مشاركين`,
          membersCount: updatedMembers.length,
          groupMembers: updatedMembers,
          messages: [...c.messages, sysMsg],
        };
        syncContactToFirestore(updatedGroup);
        fetch(`/api/groups/${groupId}/members`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ members: updatedMembers }),
        }).catch(() => {});
        return updatedGroup;
      })
    );
    triggerToast(`تمت إضافة ${newMember.name} إلى المجموعة بنجاح 👥`);
  };

  // Remove Member from an Existing Group
  const handleRemoveGroupMember = (groupId: string, memberId: string) => {
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== groupId) return c;
        const existing = c.groupMembers || [];
        const removed = existing.find((m) => m.id === memberId);
        const updatedMembers = existing.filter((m) => m.id !== memberId);
        const updatedGroup: Contact = {
          ...c,
          phone: `مجموعة • ${updatedMembers.length} أعضاء`,
          lastSeen: `${updatedMembers.length} أعضاء مشاركين`,
          membersCount: updatedMembers.length,
          groupMembers: updatedMembers,
        };
        syncContactToFirestore(updatedGroup);
        fetch(`/api/groups/${groupId}/members`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ members: updatedMembers }),
        }).catch(() => {});
        if (removed) {
          triggerToast(`تم إزالة ${removed.name} من المجموعة`);
        }
        return updatedGroup;
      })
    );
  };

  // Send Text Message (Supports both 1-on-1 AND Group Chat! Requires verified sender)
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedContact || selectedContact.isBlocked) return;

    const myUid = currentUserUid || auth.currentUser?.uid || '';
    if (!myUid && !auth.currentUser) {
      triggerToast('يجب تسجيل الدخول وتأكيد هويتك أولاً قبل إرسال الرسائل.');
      setViewMode('registration');
      return;
    }

    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isGroupChat = Boolean(selectedContact.isGroup);
    const activeGroupMember =
      isGroupChat && groupSenderMemberId !== 'me'
        ? selectedContact.groupMembers?.find((m) => m.id === groupSenderMemberId)
        : null;

    const effectiveSenderId = activeGroupMember ? activeGroupMember.id : 'me';
    const effectiveSenderName = activeGroupMember ? activeGroupMember.name : userName;
    const effectiveSenderPhone = activeGroupMember ? activeGroupMember.phone : userPhone;
    const effectiveSenderAvatar = activeGroupMember ? activeGroupMember.avatar : userAvatar;

    const newMsgId = `msg-${Date.now()}`;
    const newMsg: Message = {
      id: newMsgId,
      senderId: effectiveSenderId,
      senderName: effectiveSenderName,
      senderPhone: effectiveSenderPhone,
      senderAvatar: effectiveSenderAvatar,
      text: inputText.trim(),
      timestamp: nowTime,
      status: 'sent',
      type: 'text',
      reactions: [],
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName:
              replyingTo.senderId === 'me'
                ? 'أنت'
                : replyingTo.senderName || selectedContact.name,
            text:
              replyingTo.text ||
              (replyingTo.type === 'voice' ? '🎤 رسالة صوتية' : '📷 صورة'),
          }
        : undefined,
    };

    const targetId = selectedContact.id;
    const targetPhone = selectedContact.phone;

    setContacts((prev) =>
      prev.map((c) =>
        c.id === targetId ? { ...c, messages: [...c.messages, newMsg] } : c
      )
    );
    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newMsgId,
        senderPhone: effectiveSenderPhone,
        senderName: effectiveSenderName,
        senderAvatar: effectiveSenderAvatar,
        recipientPhone: isGroupChat ? `group:${targetId}` : targetPhone,
        groupId: isGroupChat ? targetId : undefined,
        text: newMsg.text,
        timestamp: nowTime,
        type: 'text',
      }),
    }).catch(() => {});

    sendMessageToFirestore({
      id: newMsgId,
      senderPhone: effectiveSenderPhone,
      senderName: effectiveSenderName,
      recipientPhone: isGroupChat ? `group:${targetId}` : targetPhone,
      text: newMsg.text,
      timestamp: nowTime,
      type: 'text',
    });

    if (!isGroupChat && myUid && selectedContact.uid && myUid !== selectedContact.uid) {
      sendDirectMessageToAuthorizedChat({
        senderUid: myUid,
        recipientUid: selectedContact.uid,
        senderName: effectiveSenderName,
        text: newMsg.text,
        type: 'text',
      }).catch(() => {});
    }

    simulateMessageLifecycle(targetId, newMsgId);
  };

  // Send Sticker from Sticker Pack (Supports 1-on-1 and Group Chats!)
  const handleSendSticker = (sticker: StickerItem) => {
    if (!selectedContact || selectedContact.isBlocked) return;

    const myUid = currentUserUid || auth.currentUser?.uid || '';
    if (!myUid && !auth.currentUser) {
      triggerToast('يجب تسجيل الدخول وتأكيد هويتك أولاً قبل إرسال الملصقات.');
      setViewMode('registration');
      return;
    }

    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isGroupChat = Boolean(selectedContact.isGroup);
    const activeGroupMember =
      isGroupChat && groupSenderMemberId !== 'me'
        ? selectedContact.groupMembers?.find((m) => m.id === groupSenderMemberId)
        : null;

    const effectiveSenderId = activeGroupMember ? activeGroupMember.id : 'me';
    const effectiveSenderName = activeGroupMember ? activeGroupMember.name : userName;
    const effectiveSenderPhone = activeGroupMember ? activeGroupMember.phone : userPhone;
    const effectiveSenderAvatar = activeGroupMember ? activeGroupMember.avatar : userAvatar;

    const newMsgId = `stk-${Date.now()}`;
    const stickerSummaryText = `${sticker.emoji} ${sticker.label}`;

    const newMsg: Message = {
      id: newMsgId,
      senderId: effectiveSenderId,
      senderName: effectiveSenderName,
      senderPhone: effectiveSenderPhone,
      senderAvatar: effectiveSenderAvatar,
      text: stickerSummaryText,
      timestamp: nowTime,
      status: 'sent',
      type: 'sticker',
      stickerId: sticker.id,
      stickerEmoji: `${sticker.emoji}${sticker.secondaryEmoji}`,
      stickerLabel: sticker.label,
      stickerGradient: sticker.gradient,
      stickerPackId: sticker.packId,
      reactions: [],
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName:
              replyingTo.senderId === 'me'
                ? 'أنت'
                : replyingTo.senderName || selectedContact.name,
            text:
              replyingTo.type === 'sticker'
                ? `🎨 ملصق: ${replyingTo.stickerLabel || replyingTo.text}`
                : replyingTo.text ||
                  (replyingTo.type === 'voice' ? '🎤 رسالة صوتية' : '📷 صورة'),
          }
        : undefined,
    };

    const targetId = selectedContact.id;
    const targetPhone = selectedContact.phone;

    setContacts((prev) =>
      prev.map((c) =>
        c.id === targetId ? { ...c, messages: [...c.messages, newMsg] } : c
      )
    );
    setReplyingTo(null);
    setShowEmojiPicker(false);

    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newMsgId,
        senderPhone: effectiveSenderPhone,
        senderName: effectiveSenderName,
        senderAvatar: effectiveSenderAvatar,
        recipientPhone: isGroupChat ? `group:${targetId}` : targetPhone,
        groupId: isGroupChat ? targetId : undefined,
        text: stickerSummaryText,
        timestamp: nowTime,
        type: 'sticker',
        stickerId: sticker.id,
        stickerEmoji: `${sticker.emoji}${sticker.secondaryEmoji}`,
        stickerLabel: sticker.label,
        stickerGradient: sticker.gradient,
        stickerPackId: sticker.packId,
      }),
    }).catch(() => {});

    sendMessageToFirestore({
      id: newMsgId,
      senderPhone: effectiveSenderPhone,
      senderName: effectiveSenderName,
      recipientPhone: isGroupChat ? `group:${targetId}` : targetPhone,
      text: stickerSummaryText,
      timestamp: nowTime,
      type: 'sticker',
    });

    if (!isGroupChat && myUid && selectedContact.uid && myUid !== selectedContact.uid) {
      sendDirectMessageToAuthorizedChat({
        senderUid: myUid,
        recipientUid: selectedContact.uid,
        senderName: effectiveSenderName,
        text: stickerSummaryText,
        type: 'sticker',
      }).catch(() => {});
    }

    simulateMessageLifecycle(targetId, newMsgId);
  };

  // Send Voice Note (Synced in real-time with friends!)
  const handleFinishVoiceNote = () => {
    if (!selectedContact || selectedContact.isBlocked) return;
    const durMin = Math.floor(recordingSeconds / 60);
    const durSec = (recordingSeconds % 60).toString().padStart(2, '0');
    const durationStr = `${durMin}:${durSec === '00' ? '04' : durSec}`;

    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isGroupChat = Boolean(selectedContact.isGroup);
    const newMsgId = `voice-${Date.now()}`;
    const newMsg: Message = {
      id: newMsgId,
      senderId: 'me',
      senderName: userName,
      senderPhone: userPhone,
      senderAvatar: userAvatar,
      text: '',
      timestamp: nowTime,
      status: 'sent',
      type: 'voice',
      voiceDuration: durationStr,
      reactions: [],
    };

    const targetId = selectedContact.id;
    const targetPhone = selectedContact.phone;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === targetId ? { ...c, messages: [...c.messages, newMsg] } : c
      )
    );
    setIsRecordingVoice(false);

    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newMsgId,
        senderPhone: userPhone,
        senderName: userName,
        senderAvatar: userAvatar,
        recipientPhone: isGroupChat ? `group:${targetId}` : targetPhone,
        groupId: isGroupChat ? targetId : undefined,
        text: '🎤 رسالة صوتية',
        timestamp: nowTime,
        type: 'voice',
        voiceDuration: durationStr,
      }),
    }).catch(() => {});

    simulateMessageLifecycle(targetId, newMsgId);
  };

  // Send Image Attachment (Synced in real-time with friends!)
  const handleSendSampleImage = (customUrl?: string, customTitle?: string) => {
    if (!selectedContact || selectedContact.isBlocked) return;
    const randomImg =
      customUrl ||
      SAMPLE_SHARED_IMAGES[
        Math.floor(Math.random() * SAMPLE_SHARED_IMAGES.length)
      ];
    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isGroupChat = Boolean(selectedContact.isGroup);
    const captionText =
      customTitle ||
      (inputText.trim() ? inputText.trim() : 'مشاركة صورة عبر SAHPY-CHAT ✨');
    const newMsgId = `img-${Date.now()}`;
    const newMsg: Message = {
      id: newMsgId,
      senderId: 'me',
      senderName: userName,
      senderPhone: userPhone,
      senderAvatar: userAvatar,
      text: '',
      timestamp: nowTime,
      status: 'sent',
      type: 'image',
      imageUrl: randomImg,
      imageCaption: captionText,
      reactions: [],
    };

    const targetId = selectedContact.id;
    const targetPhone = selectedContact.phone;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              sharedMedia: [
                {
                  id: `media-${Date.now()}`,
                  url: randomImg,
                  title: customTitle || `صورة_مرسلة_${c.sharedMedia.length + 1}.jpg`,
                  date: 'الآن',
                  size: '1.8 MB',
                },
                ...c.sharedMedia,
              ],
            }
          : c
      )
    );
    setInputText('');

    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newMsgId,
        senderPhone: userPhone,
        senderName: userName,
        senderAvatar: userAvatar,
        recipientPhone: isGroupChat ? `group:${targetId}` : targetPhone,
        groupId: isGroupChat ? targetId : undefined,
        text: captionText,
        timestamp: nowTime,
        type: 'image',
        imageUrl: randomImg,
        imageCaption: captionText,
      }),
    }).catch(() => {});

    simulateMessageLifecycle(targetId, newMsgId);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 720;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          handleSendSampleImage(dataUrl, file.name);
        } else {
          handleSendSampleImage(String(reader.result || ''), file.name);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Delivery & Read Status (Demo auto-reply ONLY for initial demo bots c1..c4, never for real friends!)
  const simulateMessageLifecycle = (contactId: string, msgId: string) => {
    setTimeout(() => {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, status: 'delivered' } : m
                ),
              }
            : c
        )
      );
    }, 650);

    setTimeout(() => {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, status: 'read' } : m
                ),
              }
            : c
        )
      );
    }, 1400);

    const isDemoContact = ['c1', 'c2', 'c3', 'c4'].includes(contactId);
    const target = contacts.find((c) => c.id === contactId);
    if (isDemoContact && target && target.isOnline && !target.isBlocked) {
      setTimeout(() => {
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, isTyping: true } : c))
        );
      }, 1700);

      setTimeout(() => {
        const replies = target.isGroup
          ? [
              'يا شباب وصلت الرسالة في المجموعة، شغل عالي جداً على SAHPY-CHAT! 🔥👏',
              'ممتاز! كده كل أعضاء الجروب شايفين التحديثات لحظياً 🚀✨',
              'تمام يا بشمهندس صلاح، جاري المراجعة مع باقي الفريق 🌟',
              'رسالة واضحة، تسلم إيدك يا هندسة 💎',
            ]
          : [
              'رائع جداً! وصلتني رسالتك عبر SAHPY-CHAT 🌟',
              'تمام يا صديقي، سأراجع التفاصيل وأعود إليك فوراً 🚀',
              'تصميم الواجهة والألوان المتحركة مذهل حقاً! 🎨✨',
              'ممتاز، اتفقنا على هذا الموعد بإذن الله 👍',
            ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        const replyTime = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        });

        setContacts((prev) =>
          prev.map((c) => {
            if (c.id !== contactId) return c;
            const otherMembers = (c.groupMembers || []).filter((gm) => gm.id !== 'me');
            const randomGroupResponder =
              c.isGroup && otherMembers.length > 0
                ? otherMembers[Math.floor(Math.random() * otherMembers.length)]
                : null;

            return {
              ...c,
              isTyping: false,
              messages: [
                ...c.messages,
                {
                  id: `reply-${Date.now()}`,
                  senderId: randomGroupResponder ? randomGroupResponder.id : contactId,
                  senderName: randomGroupResponder ? randomGroupResponder.name : c.name,
                  senderPhone: randomGroupResponder ? randomGroupResponder.phone : c.phone,
                  senderAvatar: randomGroupResponder ? randomGroupResponder.avatar : c.avatar,
                  text: randomReply,
                  timestamp: replyTime,
                  status: 'read',
                  type: 'text',
                  reactions: [],
                },
              ],
            };
          })
        );
      }, 3400);
    }
  };

  // Mute / Unmute Handlers
  const handleConfirmMute = (durationLabel: string) => {
    if (!selectedContact) return;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContact.id
          ? { ...c, isMuted: true, muteDuration: durationLabel }
          : c
      )
    );
    setIsMuteModalOpen(false);
    triggerToast(
      `تم كتم إشعارات "${selectedContact.name}" لمدة ${durationLabel} 🔕`
    );
  };

  const handleUnmuteQuick = (contactId = selectedContact?.id) => {
    if (!contactId) return;
    const target = contacts.find((c) => c.id === contactId);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, isMuted: false, muteDuration: undefined }
          : c
      )
    );
    if (target) {
      triggerToast(`تم إعادة تفعيل الإشعارات لـ "${target.name}" 🔔`);
    }
  };

  // Block / Unblock Handlers
  const handleToggleBlockConfirm = (alsoClearChat: boolean) => {
    if (!selectedContact) return;
    const nextBlocked = !selectedContact.isBlocked;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContact.id
          ? {
              ...c,
              isBlocked: nextBlocked,
              isTyping: false,
              messages: alsoClearChat ? [] : c.messages,
            }
          : c
      )
    );
    setIsBlockModalOpen(false);
    triggerToast(
      nextBlocked
        ? `تم حظر "${selectedContact.name}" بنجاح 🚫`
        : `تم فك الحظر عن "${selectedContact.name}" بنجاح ✅`
    );
  };

  // Pin / Unpin Contact
  const handleTogglePin = (contactId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = contacts.find((c) => c.id === contactId);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, isPinned: !c.isPinned } : c
      )
    );
    if (target) {
      triggerToast(
        target.isPinned
          ? `تم إلغاء تثبيت محادثة "${target.name}"`
          : `تم تثبيت محادثة "${target.name}" في الأعلى 📌`
      );
    }
  };

  // Clear Chat History
  const handleClearChat = () => {
    if (!selectedContact) return;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContact.id ? { ...c, messages: [] } : c
      )
    );
    triggerToast(`تم مسح سجل الرسائل مع "${selectedContact.name}" 🗑️`);
  };

  // Toggle Reaction on a Message
  const handleToggleReaction = (msgId: string, emoji: string) => {
    if (!selectedContact) return;
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== selectedContact.id) return c;
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== msgId) return m;
            const existing = m.reactions.find((r) => r.emoji === emoji);
            let nextReactions;
            if (existing) {
              if (existing.userReacted) {
                nextReactions = m.reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count - 1, userReacted: false }
                      : r
                  )
                  .filter((r) => r.count > 0);
              } else {
                nextReactions = m.reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count + 1, userReacted: true }
                    : r
                );
              }
            } else {
              nextReactions = [
                ...m.reactions,
                { emoji, count: 1, userReacted: true },
              ];
            }
            return { ...m, reactions: nextReactions };
          }),
        };
      })
    );
  };

  // Toggle Star on a Message
  const handleToggleStarMessage = (msgId: string) => {
    if (!selectedContact) return;
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== selectedContact.id) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === msgId ? { ...m, isStarred: !m.isStarred } : m
          ),
        };
      })
    );
  };

  // Delete Single Message
  const handleDeleteMessage = (msgId: string) => {
    if (!selectedContact) return;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContact.id
          ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) }
          : c
      )
    );
    triggerToast('تم حذف الرسالة');
  };

  // Update Wallpaper Config
  const handleUpdateWallpaper = (partial: Partial<WallpaperConfig>) => {
    setWallpaperConfig((prev) => ({ ...prev, ...partial }));
    if (
      partial.themeId &&
      applyPerContactWallpaper &&
      selectedContact
    ) {
      const newTheme: WallpaperThemeId = partial.themeId;
      setContacts((prev) =>
        prev.map((c) =>
          c.id === selectedContact.id ? { ...c, customWallpaper: newTheme } : c
        )
      );
    }
  };

  // Open Story & Mark as Seen
  const handleOpenStory = (story: StoryItem) => {
    setStories((prev) =>
      prev.map((s) =>
        s.id === story.id
          ? { ...s, hasUnseen: false, viewsCount: (s.viewsCount || 1) + 1 }
          : s
      )
    );
    setActiveStory(story);
  };

  // Reply to Story
  const handleReplyStory = (story: StoryItem, replyText: string) => {
    const targetContact =
      contacts.find((c) => c.id === story.contactId) || contacts[0];
    if (!targetContact) return;

    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newMsgId = `story-reply-${Date.now()}`;
    const newMsg: Message = {
      id: newMsgId,
      senderId: 'me',
      text: replyText,
      timestamp: nowTime,
      status: 'sent',
      type: 'text',
      reactions: [],
      replyTo: {
        id: story.id,
        senderName: `حالة ${story.userName} (${story.mediaType === 'video' ? '🎬 فيديو' : '📷 صورة'})`,
        text: story.caption || 'حالة يومية ✨',
      },
    };

    setContacts((prev) =>
      prev.map((c) =>
        c.id === targetContact.id
          ? { ...c, messages: [...c.messages, newMsg] }
          : c
      )
    );
    setSelectedContactId(targetContact.id);
    setMobileShowChat(true);
    triggerToast(`تم إرسال ردك على حالة "${story.userName}" ✨`);
    simulateMessageLifecycle(targetContact.id, newMsgId);
  };

  // Publish New 24-Hour Story (Photo or Short Video)
  const handlePublishStory = ({
    caption,
    mediaUrl,
    mediaType,
  }: {
    caption: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
  }) => {
    const now = Date.now();
    const newStory: StoryItem = {
      id: `my-story-${now}`,
      contactId: 'me',
      userName: `${userName} (حالتي)`,
      userPhone,
      userUsername,
      avatar: userAvatar,
      hasUnseen: true,
      timestamp: 'الآن',
      createdAt: now,
      expiresAt: now + TWENTY_FOUR_HOURS_MS,
      caption,
      mediaUrl,
      mediaType,
      viewsCount: 1,
      likesCount: 0,
    };

    setStories((prev) => [newStory, ...prev]);

    fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: 'me',
        userName: `${userName} (حالتي)`,
        userPhone,
        userUsername,
        avatar: userAvatar,
        caption,
        mediaUrl,
        mediaType,
      }),
    }).catch(() => {});

    triggerToast(
      `تم نشر حالتك اليومية (${mediaType === 'video' ? 'فيديو قصير 🎬' : 'صورة 📷'} • تختفي بعد 24 ساعة) ✨`
    );
  };

  // Delete a Story
  const handleDeleteStory = (storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    fetch(`/api/stories/${storyId}`, { method: 'DELETE' }).catch(() => {});
    triggerToast('تم حذف الحالة اليومية بنجاح 🗑️');
  };

  // Create New Contact ONLY for Registered Users in Firestore (Prevents random/fake contacts)
  const handleCreateNewContact = async (
    name: string,
    phone: string,
    roleOrBio: string,
    avatar?: string,
    username?: string,
    targetUid?: string
  ) => {
    const myUid = currentUserUid || auth.currentUser?.uid || '';
    if (!myUid && !auth.currentUser) {
      triggerToast('يجب تسجيل الدخول وتأكيد هويتك أولاً قبل إنشاء محادثة.');
      setViewMode('registration');
      return;
    }

    let resolvedUid = targetUid || '';
    let resolvedUsername = normalizeUsername(username);
    let resolvedName = name;

    if (!resolvedUid) {
      const found = await findRegisteredUserInFirestore(
        resolvedUsername || phone || name
      );
      if (found) {
        resolvedUid = found.uid;
        resolvedUsername = found.username;
        resolvedName = found.displayName || name;
      } else {
        const localReg = registeredUsers.find(
          (u) =>
            normalizeUsername(u.username) === resolvedUsername ||
            (u.uid && u.uid === (username || phone))
        );
        if (localReg) {
          resolvedUid = localReg.uid || localReg.id;
          resolvedUsername = normalizeUsername(localReg.username);
          resolvedName = localReg.name || name;
        }
      }
    }

    if (!resolvedUid) {
      triggerToast(
        'لا يُسمح بإنشاء محادثة مع اسم عشوائي أو مستخدم غير موجود في Firestore.'
      );
      return;
    }

    if (myUid && resolvedUid === myUid) {
      triggerToast('لا يمكنك إنشاء محادثة مع نفسك.');
      return;
    }

    const existing = contacts.find(
      (c) =>
        !c.isGroup &&
        (c.uid === resolvedUid ||
          c.id === resolvedUid ||
          (resolvedUsername &&
            normalizeUsername(c.username) === resolvedUsername))
    );

    if (existing) {
      setSelectedContactId(existing.id);
      setMobileShowChat(true);
      return;
    }

    const chatId =
      myUid && resolvedUid
        ? getDeterministicChatId(myUid, resolvedUid)
        : undefined;

    if (myUid && resolvedUid) {
      await ensureAuthorizedChatRoomInFirestore({
        myUid,
        otherUid: resolvedUid,
        myUsername: userUsername,
        otherUsername: resolvedUsername || normalizeUsername(resolvedName),
      });
    }

    const cleanUser = resolvedUsername || normalizeUsername(resolvedName);
    const newId = resolvedUid;
    const newContact: Contact = {
      id: newId,
      uid: resolvedUid,
      chatId,
      name: resolvedName,
      phone,
      username: cleanUser,
      avatar: avatar || omarAvatar,
      roleOrBio,
      isOnline: true,
      lastSeen: 'موثق في Firestore',
      unreadCount: 0,
      isPinned: true,
      isMuted: false,
      isBlocked: false,
      customWallpaper: 'aurora-borealis',
      sharedMedia: [],
      messages: [],
    };
    setContacts((prev) => [newContact, ...prev]);
    syncContactToFirestore(newContact);
    setSelectedContactId(newId);
    setMobileShowChat(true);
    triggerToast(
      `تم بدء محادثة موثقة مع "${resolvedName}" (@${cleanUser}) عبر Firestore 🔒`
    );
  };

  // Save User Profile
  const handleSaveProfile = (
    name: string,
    phone: string,
    bio: string,
    avatar?: string
  ) => {
    const finalAvatar = avatar || userAvatar;
    setUserName(name);
    setUserPhone(phone);
    setUserBio(bio);
    setUserAvatar(finalAvatar);
    localStorage.setItem('nabd_user_name', name);
    localStorage.setItem('nabd_user_phone', phone);
    localStorage.setItem('nabd_user_bio', bio);
    localStorage.setItem('nabd_user_avatar', finalAvatar);
    handleCompleteRegistration({
      name,
      phone,
      username: userUsername,
      bio,
      avatar: finalAvatar,
      stayOnScreen: true,
    }).catch(() => {});
    triggerToast('تم حفظ الملف الشخصي وصورة البروفايل بنجاح ✅');
  };

  // Bubble Accent Styling Map
  const getOutgoingBubbleClasses = () => {
    switch (wallpaperConfig.bubbleAccent) {
      case 'violet':
        return 'bg-gradient-to-br from-violet-600/90 to-indigo-700/90 border-violet-400/30 text-white shadow-violet-950/40';
      case 'cyan':
        return 'bg-gradient-to-br from-cyan-600/90 to-blue-700/90 border-cyan-400/30 text-white shadow-cyan-950/40';
      case 'rose':
        return 'bg-gradient-to-br from-rose-600/90 to-pink-700/90 border-rose-400/30 text-white shadow-rose-950/40';
      case 'amber':
        return 'bg-gradient-to-br from-amber-600/90 to-orange-700/90 border-amber-400/30 text-white shadow-amber-950/40';
      case 'emerald':
      default:
        return 'bg-gradient-to-br from-emerald-600/90 to-teal-700/90 border-emerald-400/30 text-white shadow-emerald-950/40';
    }
  };

  // Filter messages inside active chat if in-chat search is open
  const displayedMessages = selectedContact
    ? selectedContact.messages.filter((m) =>
        inChatSearchOpen && inChatSearchQuery.trim()
          ? (m.text || '').toLowerCase().includes(inChatSearchQuery.toLowerCase()) ||
            (m.imageCaption &&
              m.imageCaption
                .toLowerCase()
                .includes(inChatSearchQuery.toLowerCase()))
          : true
      )
    : [];

  // Show Aurora Sign Up Screen if viewMode === 'registration'
  if (viewMode === 'registration') {
    const canEnterProtectedChats = Boolean(
      (currentUserUid || auth.currentUser?.uid) &&
        (auth.currentUser ? auth.currentUser.emailVerified : true)
    );
    return (
      <PhoneRegistrationScreen
        wallpaperConfig={wallpaperConfig}
        currentPhone={userPhone}
        currentName={userName}
        currentUsername={userUsername}
        currentBio={userBio}
        currentAvatar={userAvatar}
        firebaseUser={auth.currentUser}
        isAccountFullyVerified={canEnterProtectedChats}
        registeredUsers={registeredUsers}
        onCompleteRegistration={handleCompleteRegistration}
        onLogout={handleRealLogout}
        onStartChatWithUser={handleStartChatWithDirectoryUser}
        onBackToChats={
          canEnterProtectedChats ? () => setViewMode('chat') : undefined
        }
      />
    );
  }

  return (
    <div
      dir="rtl"
      className="relative w-screen h-dvh overflow-hidden flex flex-col bg-slate-950 text-slate-100 select-none"
    >
      {/* Hidden File Input for Image Attachments */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 text-emerald-200 text-xs font-medium shadow-2xl flex items-center gap-2.5 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="relative z-10 flex-1 flex w-full h-full overflow-hidden">
        {/* ============================================================ */}
        {/* RIGHT SIDEBAR: CONTACTS, 24H STORIES & FILTERS               */}
        {/* ============================================================ */}
        <aside
          className={`${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          } w-full md:w-[390px] lg:w-[430px] shrink-0 h-full flex-col bg-slate-900/95 backdrop-blur-2xl border-l border-white/10 z-20`}
        >
          {/* Sidebar Top Brand & User Header */}
          <div className="px-3.5 pt-3.5 pb-2.5 flex items-center justify-between border-b border-white/10">
            <div
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer group min-w-0"
              title="تعديل الملف الشخصي ورقم الهاتف"
            >
              <div className="relative shrink-0">
                <img
                  src={userAvatar}
                  alt="حسابي"
                  className="w-10 h-10 rounded-2xl object-cover border border-emerald-500/40 shadow-md group-hover:border-emerald-400 transition-colors"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-black tracking-wide text-white truncate">
                    SAHPY-CHAT
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border shrink-0 ${
                      firestoreConnected
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : wsConnected
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    <Database className="w-2.5 h-2.5" />
                    {firestoreConnected ? 'Cloud' : 'Live'}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-emerald-400 truncate">
                  𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-mono truncate">
                  <span dir="ltr" className="text-cyan-400">
                    @{userUsername}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span dir="ltr" className="text-slate-400">
                    {userPhone}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setViewMode('registration')}
                className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="إدارة الحساب والتحقق"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">الحساب</span>
              </button>

              <button
                onClick={handleRealLogout}
                className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-all cursor-pointer"
                title="تسجيل الخروج الآمن من الحساب"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsCreateGroupOpen(true)}
                className="px-2.5 py-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="إنشاء مجموعة دردشة جديدة (Group Chat)"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مجموعة</span>
              </button>

              <button
                onClick={() => setIsNewChatOpen(true)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all cursor-pointer"
                title="إضافة أو بحث عن رقم هاتف أو يوزر"
              >
                <UserPlus className="w-4 h-4 text-emerald-400" />
              </button>

              <button
                onClick={() => setIsWallpaperStudioOpen(true)}
                className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 hover:from-emerald-500/30 hover:to-indigo-500/30 border border-emerald-500/30 text-emerald-300 transition-all cursor-pointer"
                title="تخصيص الخلفية المتحركة والألوان"
              >
                <Palette className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* DAILY STATUS / STORIES BAR (24 HOURS) ABOVE CHAT LIST         */}
          {/* ============================================================ */}
          <div className="px-3.5 py-2.5 border-b border-white/10 bg-slate-950/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-white">
                  الحالات اليومية (Status • 24 ساعة)
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] text-emerald-300 font-bold">
                  {activeStories.length} نشطة
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStoryOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>رفع صورة / فيديو</span>
              </button>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1 custom-scrollbar">
              {/* Add New 24h Story Button */}
              <div
                onClick={() => setIsAddStoryOpen(true)}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
              >
                <div className="relative w-13 h-13 rounded-full p-0.5 border-2 border-dashed border-emerald-400/60 group-hover:border-emerald-400 flex items-center justify-center bg-slate-800/70 transition-colors">
                  <img
                    src={userAvatar}
                    alt="إضافة حالة"
                    className="w-full h-full rounded-full object-cover opacity-55 group-hover:opacity-80 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg">
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <span className="absolute -bottom-1 px-1.5 py-0.2 rounded-full bg-slate-900 border border-emerald-500/40 text-[8px] font-bold text-emerald-300">
                    24h
                  </span>
                </div>
                <span className="text-[10px] text-emerald-300 font-bold">
                  إضافة حالة
                </span>
              </div>

              {/* Active 24-Hour Stories Strip */}
              {activeStories.map((story) => {
                const isVideoStory =
                  story.mediaType === 'video' ||
                  Boolean(
                    story.mediaUrl && /\.(mp4|webm|ogg)(\?|$)/i.test(story.mediaUrl)
                  ) ||
                  Boolean(
                    story.mediaUrl && story.mediaUrl.startsWith('data:video/')
                  );
                return (
                  <div
                    key={story.id}
                    onClick={() => handleOpenStory(story)}
                    className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                  >
                    <div
                      className={`relative w-13 h-13 rounded-full p-0.5 transition-transform group-hover:scale-105 ${
                        story.hasUnseen
                          ? 'bg-gradient-to-tr from-emerald-400 via-cyan-400 to-violet-500 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-700'
                      }`}
                    >
                      <img
                        src={story.avatar}
                        alt={story.userName}
                        className="w-full h-full rounded-full object-cover border-2 border-slate-900"
                      />
                      {/* Media Type Badge (Video vs Photo) */}
                      <span
                        className="absolute -bottom-0.5 -left-0.5 w-4.5 h-4.5 rounded-full bg-slate-950 border border-white/20 flex items-center justify-center text-[9px] shadow"
                        title={isVideoStory ? 'فيديو قصير' : 'صورة'}
                      >
                        {isVideoStory ? '🎬' : '📷'}
                      </span>
                      {/* 24h Remaining Time Badge */}
                      <span
                        className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-slate-950/90 border border-emerald-500/40 text-[8px] font-mono font-bold text-emerald-300"
                        title="الوقت المتبقي قبل الاختفاء (24 ساعة)"
                      >
                        {getRemainingHoursBadge(story.expiresAt)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-200 font-medium truncate max-w-[60px]">
                      {story.userName.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search Input (By Phone Number, @Username, or Name) & Filter Tabs */}
          <div className="px-3.5 pt-2.5 pb-2 space-y-2 border-b border-white/5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الهاتف (010...) أو اليوزر (@salah_gomaa)..."
                className="w-full py-2 pr-10 pl-8 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
              {[
                { id: 'all', label: 'الكل', count: contacts.length },
                {
                  id: 'groups',
                  label: 'المجموعات 👥',
                  count: contacts.filter((c) => c.isGroup).length,
                },
                {
                  id: 'unread',
                  label: 'غير مقروءة',
                  count: contacts.filter((c) => c.unreadCount > 0).length,
                },
                {
                  id: 'starred',
                  label: 'مميزة ⭐',
                  count: contacts.filter((c) =>
                    c.messages.some((m) => m.isStarred)
                  ).length,
                },
                {
                  id: 'muted',
                  label: 'مكتومة',
                  count: contacts.filter((c) => c.isMuted).length,
                },
                {
                  id: 'blocked',
                  label: 'محظورة',
                  count: contacts.filter((c) => c.isBlocked).length,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveFilter(
                      tab.id as
                        | 'all'
                        | 'unread'
                        | 'groups'
                        | 'muted'
                        | 'blocked'
                        | 'starred'
                    )
                  }
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                    activeFilter === tab.id
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                        activeFilter === tab.id
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
            {/* Search Results from Registered Users (Only visible when actively searching by phone or @username) */}
            {searchedDirectoryUsers.length > 0 && (
              <div className="p-2.5 bg-emerald-500/5 border-b border-emerald-500/20 space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-400 px-1">
                  نتائج البحث بالرقم أو اليوزر (اضغط للمراسلة):
                </p>
                {searchedDirectoryUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      handleStartChatWithDirectoryUser(u);
                      setSearchQuery('');
                    }}
                    className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={u.avatar || omarAvatar}
                        alt={u.name}
                        className="w-9 h-9 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {u.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono truncate">
                          {u.username && (
                            <span dir="ltr" className="text-cyan-400">
                              @{u.username.replace(/^@/, '')}
                            </span>
                          )}
                          <span className="text-slate-500">•</span>
                          <span dir="ltr" className="text-emerald-400">
                            {u.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[10px] shrink-0">
                      مراسلة
                    </span>
                  </div>
                ))}
              </div>
            )}

            {filteredContacts.length === 0 ? (
              <div className="p-7 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-inner">
                  <MessageSquarePlus className="w-7 h-7" />
                </div>
                {searchQuery.trim() ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">
                      لا توجد محادثات مطابقة لـ "{searchQuery}"
                    </p>
                    <p className="text-[11px] text-slate-400">
                      يمكنك بدء محادثة فورية مع هذا الرقم أو اليوزر الآن
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">
                      قائمة المحادثات فارغة وجاهزة! 💬
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      تماماً مثل واتساب، ابحث عن أصحابك برقم الهاتف أو{' '}
                      <span dir="ltr" className="text-cyan-400 font-mono">
                        @username
                      </span>{' '}
                      لبدء محادثة حقيقية أو أنشئ مجموعة جديدة.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setIsNewChatOpen(true)}
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/15"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>ابحث عن مستخدم مسجل (@username أو UID)</span>
                  </button>

                  <button
                    onClick={() => setIsCreateGroupOpen(true)}
                    className="w-full px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs font-bold hover:bg-violet-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>+ إنشاء مجموعة دردشة جديدة</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const lastMsg = contact.messages[contact.messages.length - 1];
                const isSelected = contact.id === selectedContact?.id;

                return (
                  <div
                    key={contact.id}
                    onClick={() => handleSelectContact(contact.id)}
                    className={`group relative px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-l from-emerald-500/15 via-emerald-500/5 to-transparent border-r-4 border-emerald-400'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Avatar + Online Indicator */}
                    <div className="relative shrink-0">
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className={`w-12 h-12 rounded-2xl object-cover border border-white/10 ${
                          contact.isBlocked ? 'grayscale opacity-50' : ''
                        }`}
                      />
                      {contact.isGroup ? (
                        <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-lg bg-violet-500 text-white flex items-center justify-center shadow border border-slate-900">
                          <Users className="w-3 h-3" />
                        </span>
                      ) : contact.isOnline && !contact.isBlocked ? (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3
                            className={`text-sm font-bold truncate ${
                              contact.isBlocked
                                ? 'text-slate-500 line-through'
                                : 'text-white'
                            }`}
                          >
                            {contact.name}
                          </h3>
                          {contact.isGroup && (
                            <span className="px-1.5 py-0.2 rounded-md bg-violet-500/20 border border-violet-500/30 text-[9px] text-violet-300 font-bold shrink-0">
                              مجموعة ({contact.membersCount || contact.groupMembers?.length || 2})
                            </span>
                          )}
                          {contact.isPinned && (
                            <Pin className="w-3 h-3 text-emerald-400 shrink-0 rotate-45" />
                          )}
                          {contact.isMuted && (
                            <VolumeX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          {contact.isBlocked && (
                            <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {lastMsg ? lastMsg.timestamp : ''}
                        </span>
                      </div>

                      {/* Username + Phone Number Badge */}
                      <div className="flex items-center gap-1.5 mb-0.5 truncate">
                        {contact.username && (
                          <span
                            dir="ltr"
                            className="text-[10px] font-mono text-cyan-400/90"
                          >
                            @{contact.username.replace(/^@/, '')}
                          </span>
                        )}
                        {contact.username && (
                          <span className="text-[9px] text-slate-600">•</span>
                        )}
                        <span
                          dir="ltr"
                          className="text-[10px] font-mono text-emerald-400/80"
                        >
                          {contact.phone}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-400 truncate">
                          {contact.isBlocked ? (
                            <span className="text-rose-400/80">
                              جهة اتصال محظورة
                            </span>
                          ) : contact.isTyping ? (
                            <span className="text-emerald-400 font-medium animate-pulse">
                              يكتب الآن...
                            </span>
                          ) : lastMsg ? (
                            <>
                              {contact.isGroup && lastMsg.senderName && (
                                <span className="text-violet-300 font-semibold ml-1">
                                  {lastMsg.senderId === 'me'
                                    ? 'أنت:'
                                    : `${lastMsg.senderName.split(' ')[0]}:`}
                                </span>
                              )}
                              {lastMsg.type === 'voice'
                                ? `🎤 رسالة صوتية (${lastMsg.voiceDuration})`
                                : lastMsg.type === 'image'
                                ? '📷 صورة مرفقة'
                                : lastMsg.type === 'sticker'
                                ? `🎨 ملصق: ${lastMsg.stickerLabel || lastMsg.text}`
                                : lastMsg.text}
                            </>
                          ) : (
                            'لا توجد رسائل بعد'
                          )}
                        </p>

                        <div className="flex items-center gap-1 shrink-0">
                          {contact.unreadCount > 0 && (
                            <span
                              className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                contact.isMuted
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-emerald-500 text-slate-950'
                              }`}
                            >
                              {contact.unreadCount}
                            </span>
                          )}

                          <button
                            onClick={(e) => handleTogglePin(contact.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                            title={contact.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ============================================================ */}
        {/* LEFT MAIN CHAT STAGE WITH ANIMATED COLORFUL BACKGROUND       */}
        {/* ============================================================ */}
        <main
          className={`${
            !mobileShowChat ? 'hidden md:flex' : 'flex'
          } flex-1 h-full flex-col relative overflow-hidden`}
        >
          {/* Animated Colorful Background Layer */}
          <AnimatedChatBackground config={effectiveWallpaperConfig} />

          {selectedContact ? (
            <>
              {/* 1. Chat Top Header */}
              <header className="relative z-20 px-3 sm:px-5 py-3 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Back button on mobile */}
                  <button
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden px-2.5 py-1.5 rounded-xl bg-white/10 text-slate-200 hover:bg-white/15 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    رجوع
                  </button>

                  <div
                    onClick={() => setIsInfoDrawerOpen(true)}
                    className="flex items-center gap-2.5 cursor-pointer min-w-0"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={selectedContact.avatar}
                        alt={selectedContact.name}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-white/15 shadow-md"
                      />
                      {selectedContact.isGroup ? (
                        <span className="absolute -bottom-1 -left-1 w-4.5 h-4.5 rounded-md bg-violet-500 text-white flex items-center justify-center border border-slate-900">
                          <Users className="w-2.5 h-2.5" />
                        </span>
                      ) : selectedContact.isOnline && !selectedContact.isBlocked ? (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                          {selectedContact.name}
                        </h2>
                        {selectedContact.isMuted && (
                          <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 items-center gap-1 shrink-0">
                            <BellOff className="w-2.5 h-2.5" />
                            مكتوم
                          </span>
                        )}
                        {selectedContact.isBlocked && (
                          <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-[10px] text-rose-300 items-center gap-1 shrink-0">
                            <Ban className="w-2.5 h-2.5" />
                            محظور
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] truncate">
                        {selectedContact.username && (
                          <>
                            <span
                              dir="ltr"
                              className="font-mono text-cyan-400 font-semibold"
                            >
                              @{selectedContact.username.replace(/^@/, '')}
                            </span>
                            <span className="text-slate-600">•</span>
                          </>
                        )}
                        <span
                          dir="ltr"
                          className="font-mono text-emerald-400/90"
                        >
                          {selectedContact.phone}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300 truncate">
                          {selectedContact.isBlocked
                            ? 'محظور'
                            : selectedContact.isTyping
                            ? 'يكتب الآن...'
                            : selectedContact.isGroup
                            ? `${selectedContact.groupMembers?.length || selectedContact.membersCount || 3} أعضاء في المجموعة`
                            : selectedContact.lastSeen}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Header Quick Actions */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() =>
                      selectedContact.isMuted
                        ? handleUnmuteQuick()
                        : setIsMuteModalOpen(true)
                    }
                    className={`px-2.5 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      selectedContact.isMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                    }`}
                    title={
                      selectedContact.isMuted
                        ? 'إلغاء كتم الإشعارات'
                        : 'كتم الإشعارات'
                    }
                  >
                    {selectedContact.isMuted ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                    <span className="hidden xl:inline">
                      {selectedContact.isMuted ? 'إلغاء الكتم' : 'كتم'}
                    </span>
                  </button>

                  {!selectedContact.isGroup && (
                    <button
                      onClick={() => setIsBlockModalOpen(true)}
                      className={`px-2.5 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedContact.isBlocked
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/25 text-rose-300'
                      }`}
                      title={
                        selectedContact.isBlocked
                          ? 'فك الحظر'
                          : 'حظر جهة الاتصال'
                      }
                    >
                      {selectedContact.isBlocked ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      <span className="hidden xl:inline">
                        {selectedContact.isBlocked ? 'فك الحظر' : 'حظر'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setIsWallpaperStudioOpen(true)}
                    className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 hover:from-emerald-500/30 hover:to-indigo-500/30 border border-emerald-500/30 text-emerald-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                    title="تغيير الخلفية المتحركة والألوان"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="hidden lg:inline">الخلفية</span>
                  </button>

                  <button
                    onClick={() => setActiveCall('audio')}
                    className="hidden sm:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors cursor-pointer"
                    title="مكالمة صوتية"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setActiveCall('video')}
                    className="hidden sm:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors cursor-pointer"
                    title="مكالمة فيديو"
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsInfoDrawerOpen(true)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors cursor-pointer"
                    title={
                      selectedContact.isGroup
                        ? 'معلومات المجموعة والأعضاء'
                        : 'معلومات جهة الاتصال'
                    }
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveHeaderMenu(!activeHeaderMenu)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeHeaderMenu && (
                      <div className="absolute left-0 top-12 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl py-2 z-40 text-xs">
                        <button
                          onClick={() => {
                            setInChatSearchOpen(!inChatSearchOpen);
                            setActiveHeaderMenu(false);
                          }}
                          className="w-full px-4 py-2.5 text-right hover:bg-white/5 flex items-center gap-2.5 text-slate-200 cursor-pointer"
                        >
                          <Search className="w-4 h-4 text-emerald-400" />
                          <span>بحث داخل الرسائل</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsWallpaperStudioOpen(true);
                            setActiveHeaderMenu(false);
                          }}
                          className="w-full px-4 py-2.5 text-right hover:bg-white/5 flex items-center gap-2.5 text-slate-200 cursor-pointer"
                        >
                          <Palette className="w-4 h-4 text-violet-400" />
                          <span>تغيير الخلفية المتحركة</span>
                        </button>
                        <button
                          onClick={() => {
                            handleClearChat();
                            setActiveHeaderMenu(false);
                          }}
                          className="w-full px-4 py-2.5 text-right hover:bg-white/5 flex items-center gap-2.5 text-amber-300 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>مسح محتوى الدردشة</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {/* Group Members Strip (When viewing a Group Chat) */}
              {selectedContact.isGroup && selectedContact.groupMembers && (
                <div className="relative z-20 px-4 py-2 bg-slate-900/70 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <span className="text-[11px] font-bold text-violet-300 flex items-center gap-1 shrink-0">
                      <Users className="w-3.5 h-3.5" />
                      أعضاء المجموعة ({selectedContact.groupMembers.length}):
                    </span>
                    {selectedContact.groupMembers.map((gm) => (
                      <span
                        key={gm.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-200 shrink-0"
                      >
                        <img
                          src={gm.avatar}
                          alt={gm.name}
                          className="w-3.5 h-3.5 rounded-full object-cover"
                        />
                        <span>{gm.name}</span>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setIsInfoDrawerOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>إضافة عضو</span>
                  </button>
                </div>
              )}

              {/* Optional In-Chat Search Bar */}
              {inChatSearchOpen && (
                <div className="relative z-20 px-4 py-2.5 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400 shrink-0" />
                  <input
                    type="text"
                    value={inChatSearchQuery}
                    onChange={(e) => setInChatSearchQuery(e.target.value)}
                    placeholder="ابحث عن كلمة داخل هذه المحادثة..."
                    className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setInChatSearchOpen(false);
                      setInChatSearchQuery('');
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Muted Status Sub-Banner */}
              {selectedContact.isMuted && (
                <div className="relative z-20 px-4 py-2 bg-amber-500/15 backdrop-blur-md border-b border-amber-500/25 flex items-center justify-between text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <BellOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      إشعارات هذه المحادثة مكتومة (
                      {selectedContact.muteDuration || 'مؤقتاً'})
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnmuteQuick()}
                    className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 font-semibold transition-colors cursor-pointer"
                  >
                    إلغاء الكتم
                  </button>
                </div>
              )}

              {/* 2. Messages Stream */}
              <div className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 py-5 space-y-4 custom-scrollbar">
                {/* Encryption & SAHPY-CHAT Notice Pill */}
                <div className="flex justify-center mb-4">
                  <div className="px-4 py-1.5 rounded-full bg-slate-950/65 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>
                      SAHPY-CHAT •{' '}
                      <strong className="text-emerald-400">
                        𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
                      </strong>
                    </span>
                  </div>
                </div>

                {displayedMessages.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-3xl bg-slate-900/70 border border-white/10 flex items-center justify-center mb-3 text-emerald-400">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      ابدأ المحادثة الآن مع {selectedContact.name}
                    </p>
                  </div>
                ) : (
                  displayedMessages.map((msg) => {
                    const isMe = msg.senderId === 'me';
                    return (
                      <div
                        key={msg.id}
                        className={`group flex flex-col ${
                          isMe ? 'items-start' : 'items-end'
                        }`}
                      >
                        <div
                          className={`relative max-w-[86%] sm:max-w-[70%] rounded-2xl p-3.5 border shadow-lg transition-all ${
                            isMe
                              ? `${getOutgoingBubbleClasses()} rounded-tr-sm`
                              : `bg-slate-900/85 ${
                                  effectiveWallpaperConfig.blurGlass
                                    ? 'backdrop-blur-xl'
                                    : ''
                                } border-white/15 text-slate-100 rounded-tl-sm`
                          }`}
                        >
                          {/* Sender Name Header inside Group Chats */}
                          {selectedContact.isGroup && !isMe && (
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-white/10">
                              <span className="text-[11px] font-extrabold text-emerald-400">
                                {msg.senderName || 'عضو بالمجموعة'}
                              </span>
                              {msg.senderPhone && (
                                <span
                                  dir="ltr"
                                  className="text-[10px] font-mono text-slate-400"
                                >
                                  ({msg.senderPhone})
                                </span>
                              )}
                            </div>
                          )}

                          {/* Reply Quote Preview */}
                          {msg.replyTo && (
                            <div className="mb-2 p-2 rounded-xl bg-black/25 border-r-2 border-emerald-400 text-xs">
                              <p className="font-bold text-emerald-300 text-[11px]">
                                {msg.replyTo.senderName}
                              </p>
                              <p className="text-white/80 truncate text-[11px]">
                                {msg.replyTo.text}
                              </p>
                            </div>
                          )}

                          {/* Image Content */}
                          {msg.type === 'image' && msg.imageUrl && (
                            <div className="mb-2 overflow-hidden rounded-xl border border-white/10">
                              <img
                                src={msg.imageUrl}
                                alt={msg.imageCaption || 'صورة'}
                                className="w-full max-h-64 object-cover"
                              />
                              {msg.imageCaption && (
                                <p className="p-2 text-xs bg-black/30 text-white/95">
                                  {msg.imageCaption}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Voice Content */}
                          {msg.type === 'voice' && (
                            <div className="flex items-center gap-3 min-w-[210px] sm:min-w-[240px] py-1">
                              <button
                                onClick={() =>
                                  setPlayingVoiceId(
                                    playingVoiceId === msg.id ? null : msg.id
                                  )
                                }
                                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer"
                              >
                                {playingVoiceId === msg.id ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4 fill-current" />
                                )}
                              </button>
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-1 h-5">
                                  {[
                                    35, 65, 45, 80, 55, 90, 40, 70, 60, 85, 50,
                                    75, 45, 60, 40,
                                  ].map((h, idx) => (
                                    <span
                                      key={idx}
                                      style={{ height: `${h}%` }}
                                      className={`flex-1 rounded-full transition-all ${
                                        playingVoiceId === msg.id
                                          ? 'bg-emerald-300 animate-pulse'
                                          : 'bg-white/50'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <div className="flex justify-between text-[10px] text-white/75">
                                  <span>رسالة صوتية</span>
                                  <span>{msg.voiceDuration || '0:30'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Sticker Content */}
                          {msg.type === 'sticker' && (
                            <div
                              className={`my-1 px-5 py-4 rounded-2xl bg-gradient-to-br ${
                                msg.stickerGradient ||
                                'from-emerald-500/30 via-teal-500/20 to-cyan-500/30 border-emerald-400/40'
                              } border backdrop-blur-md flex flex-col items-center justify-center text-center shadow-xl min-w-[165px] select-none transition-transform hover:scale-105`}
                            >
                              <div className="text-5xl sm:text-6xl leading-none mb-2 drop-shadow-md animate-bounce">
                                {msg.stickerEmoji || '✨'}
                              </div>
                              <span className="px-3 py-1 rounded-full bg-slate-950/60 border border-white/15 text-xs font-extrabold text-white tracking-wide shadow">
                                {msg.stickerLabel || msg.text}
                              </span>
                            </div>
                          )}

                          {/* Text Content */}
                          {msg.type !== 'sticker' && msg.text && (
                            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          )}

                          {/* Timestamp + Read Status + Star */}
                          <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] text-white/70">
                            {msg.isStarred && (
                              <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                            )}
                            <span>{msg.timestamp}</span>
                            {isMe && (
                              <span>
                                {msg.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-white/60" />
                                )}
                              </span>
                            )}
                          </div>

                          {/* Hover Quick Actions Bar */}
                          <div
                            className={`opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 ${
                              isMe ? 'left-0' : 'right-0'
                            } flex items-center gap-0.5 px-2 py-1 rounded-full bg-slate-900/95 border border-white/15 shadow-xl z-20`}
                          >
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() =>
                                  handleToggleReaction(msg.id, emoji)
                                }
                                className="hover:scale-125 transition-transform px-1 text-xs cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                            <span className="w-px h-3 bg-white/15 mx-1" />
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="p-1 text-slate-300 hover:text-emerald-400 cursor-pointer"
                              title="رد على الرسالة"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStarMessage(msg.id)}
                              className={`p-1 cursor-pointer ${
                                msg.isStarred
                                  ? 'text-amber-400'
                                  : 'text-slate-300 hover:text-amber-400'
                              }`}
                              title="تمييز بنجمة"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 text-slate-300 hover:text-rose-400 cursor-pointer"
                              title="حذف الرسالة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Reactions Pills */}
                        {msg.reactions.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 px-1">
                            {msg.reactions.map((r) => (
                              <button
                                key={r.emoji}
                                onClick={() =>
                                  handleToggleReaction(msg.id, r.emoji)
                                }
                                className={`px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 border transition-all cursor-pointer ${
                                  r.userReacted
                                    ? 'bg-emerald-500/25 border-emerald-400/50 text-white'
                                    : 'bg-slate-900/80 border-white/10 text-slate-300'
                                }`}
                              >
                                <span>{r.emoji}</span>
                                <span>{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 3. Bottom Composer or Blocked Banner */}
              {selectedContact.isBlocked ? (
                <div className="relative z-20 p-4 bg-slate-900/95 backdrop-blur-2xl border-t border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-rose-200 text-xs">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>
                      لقد قمت بحظر <strong>{selectedContact.name}</strong>. لا
                      يمكنك إرسال أو استقبال رسائل حتى تقوم بفك الحظر.
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleBlockConfirm(false)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>فك الحظر الآن</span>
                  </button>
                </div>
              ) : (
                <footer className="relative z-20 px-3 sm:px-4 py-3 bg-slate-900/85 backdrop-blur-2xl border-t border-white/10">
                  {/* Group Sender Switcher */}
                  {selectedContact.isGroup && selectedContact.groupMembers && (
                    <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                      <span className="text-[10px] text-slate-400 shrink-0">
                        إرسال باسم:
                      </span>
                      <button
                        type="button"
                        onClick={() => setGroupSenderMemberId('me')}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                          groupSenderMemberId === 'me'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        أنت ({userName.split(' ')[0]})
                      </button>
                      {selectedContact.groupMembers
                        .filter((gm) => gm.id !== 'me')
                        .map((gm) => (
                          <button
                            key={gm.id}
                            type="button"
                            onClick={() => setGroupSenderMemberId(gm.id)}
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                              groupSenderMemberId === gm.id
                                ? 'bg-violet-500 text-white'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {gm.name}
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Replying To Preview Bar */}
                  {replyingTo && (
                    <div className="mb-2.5 p-2.5 rounded-xl bg-slate-800/90 border-r-4 border-emerald-400 flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-emerald-400">
                          الرد على{' '}
                          {replyingTo.senderId === 'me'
                            ? 'نفسك'
                            : replyingTo.senderName || selectedContact.name}
                        </p>
                        <p className="text-slate-300 truncate">
                          {replyingTo.type === 'sticker'
                            ? `🎨 ملصق: ${replyingTo.stickerLabel || replyingTo.text}`
                            : replyingTo.text ||
                              (replyingTo.type === 'voice'
                                ? '🎤 رسالة صوتية'
                                : '📷 صورة')}
                        </p>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="p-1 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Emoji & Stickers Picker Popover */}
                  {showEmojiPicker && (
                    <div className="mb-3 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl space-y-3 animate-fade-in">
                      {/* Top Mode Switcher: Emojis vs Stickers */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPickerTab('stickers')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              pickerTab === 'stickers'
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <Sticker className="w-3.5 h-3.5" />
                            <span>الملصقات (Stickers)</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-950/25 text-current">
                              {STICKER_ITEMS.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPickerTab('emojis')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              pickerTab === 'emojis'
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <Smile className="w-3.5 h-3.5" />
                            <span>رموز تعبيرية</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                          title="إغلاق"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {pickerTab === 'stickers' ? (
                        <div className="space-y-2.5">
                          {/* Sticker Pack Category Pills */}
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            {STICKER_PACKS.map((pack) => (
                              <button
                                key={pack.id}
                                type="button"
                                onClick={() => setSelectedStickerPack(pack.id)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                                  selectedStickerPack === pack.id
                                    ? 'bg-violet-500 text-white shadow-sm'
                                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                <span>{pack.icon}</span>
                                <span>{pack.label}</span>
                              </button>
                            ))}
                          </div>

                          {/* Stickers Grid (Click to send immediately!) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-0.5 custom-scrollbar">
                            {STICKER_ITEMS.filter(
                              (st) =>
                                selectedStickerPack === 'all' ||
                                st.packId === selectedStickerPack
                            ).map((stk) => (
                              <button
                                key={stk.id}
                                type="button"
                                onClick={() => handleSendSticker(stk)}
                                className={`group p-2.5 rounded-2xl bg-gradient-to-br ${stk.gradient} border hover:scale-[1.03] active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer shadow-md`}
                                title={`إرسال ملصق: ${stk.label}`}
                              >
                                <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform drop-shadow">
                                  {stk.emoji}
                                  {stk.secondaryEmoji}
                                </span>
                                <span className="text-[10px] font-bold text-white truncate max-w-full px-1.5 py-0.5 rounded-full bg-slate-950/50">
                                  {stk.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5 max-h-40 overflow-y-auto p-1">
                          {COMPOSER_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => setInputText((prev) => prev + em)}
                              className="text-xl hover:scale-125 transition-transform p-1.5 rounded-xl hover:bg-white/10 flex items-center justify-center cursor-pointer"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isRecordingVoice ? (
                    <div className="flex items-center justify-between gap-3 py-1">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs font-bold text-rose-300">
                          جاري تسجيل رسالة صوتية... 0:
                          {recordingSeconds.toString().padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRecordingVoice(false)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={handleFinishVoiceNote}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>إرسال التسجيل</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSendMessage}
                      className="flex items-center gap-1.5 sm:gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPickerTab('emojis');
                          setShowEmojiPicker((prev) => !prev || pickerTab !== 'emojis');
                        }}
                        className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                          showEmojiPicker && pickerTab === 'emojis'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-300'
                        }`}
                        title="رموز تعبيرية"
                      >
                        <Smile className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPickerTab('stickers');
                          setShowEmojiPicker((prev) => !prev || pickerTab !== 'stickers');
                        }}
                        className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                          showEmojiPicker && pickerTab === 'stickers'
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-violet-300'
                        }`}
                        title="إرسال ملصق (Stickers)"
                      >
                        <Sticker className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer"
                        title="إرفاق صورة من جهازك"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendSampleImage()}
                        className="hidden sm:flex p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                        title="إرسال صورة سريعة"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>

                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={
                          selectedContact.isGroup
                            ? `اكتب رسالة إلى مجموعة "${selectedContact.name}"...`
                            : `اكتب رسالة إلى ${selectedContact.name}...`
                        }
                        className="flex-1 py-2.5 px-3.5 rounded-2xl bg-slate-800/90 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 transition-all"
                      />

                      {inputText.trim() ? (
                        <button
                          type="submit"
                          className="p-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                          title="إرسال"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsRecordingVoice(true)}
                          className="p-2.5 rounded-2xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 text-slate-200 hover:text-emerald-300 transition-all cursor-pointer"
                          title="تسجيل رسالة صوتية"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}
                    </form>
                  )}
                </footer>
              )}
            </>
          ) : (
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-xl">
                <MessageSquarePlus className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                SAHPY-CHAT • 𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                أهلاً بك في مساحتك الخاصة! قائمة المحادثات نظيفة وفارغة تماماً وجاهزة للاستخدام الفعلي مع أصحابك.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  onClick={() => setIsNewChatOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ابحث عن صديق بالرقم أو @اليوزر</span>
                </button>
                <button
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>إنشاء مجموعة جديدة</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/* MODALS & DRAWERS                                             */}
      {/* ============================================================ */}
      <WallpaperStudioModal
        isOpen={isWallpaperStudioOpen}
        onClose={() => setIsWallpaperStudioOpen(false)}
        config={effectiveWallpaperConfig}
        onUpdateConfig={(newCfg) => handleUpdateWallpaper(newCfg)}
        activeContactName={selectedContact?.name}
        contactCustomWallpaper={selectedContact?.customWallpaper}
        onSetContactCustomWallpaper={(themeId) => {
          if (!selectedContact) return;
          setContacts((prev) =>
            prev.map((c) =>
              c.id === selectedContact.id ? { ...c, customWallpaper: themeId } : c
            )
          );
        }}
      />

      {selectedContact && (
        <>
          {isMuteModalOpen && (
            <MuteModal
              contact={selectedContact}
              onClose={() => setIsMuteModalOpen(false)}
              onConfirmMute={(_contactId, duration, label) => {
                if (!duration) {
                  handleUnmuteQuick();
                } else {
                  handleConfirmMute(label || String(duration));
                }
              }}
            />
          )}

          {isBlockModalOpen && (
            <BlockModal
              contact={selectedContact}
              onClose={() => setIsBlockModalOpen(false)}
              onConfirmBlock={(_contactId, _blockState, clearMessages) => {
                handleToggleBlockConfirm(clearMessages);
              }}
            />
          )}

          <ContactInfoDrawer
            isOpen={isInfoDrawerOpen}
            onClose={() => setIsInfoDrawerOpen(false)}
            contact={selectedContact}
            allContacts={contacts}
            onOpenMuteModal={() => {
              setIsInfoDrawerOpen(false);
              setIsMuteModalOpen(true);
            }}
            onUnmuteQuick={() => handleUnmuteQuick()}
            onOpenBlockModal={() => {
              setIsInfoDrawerOpen(false);
              setIsBlockModalOpen(true);
            }}
            onOpenWallpaperStudio={() => {
              setIsInfoDrawerOpen(false);
              setIsWallpaperStudioOpen(true);
            }}
            onClearChat={handleClearChat}
            onToggleDisappearing={() => {}}
            onAddGroupMember={handleAddGroupMember}
            onRemoveGroupMember={handleRemoveGroupMember}
          />

          {activeCall && (
            <CallModal
              contact={selectedContact}
              callType={activeCall}
              onEndCall={() => setActiveCall(null)}
            />
          )}
        </>
      )}

      {activeStory && (
        <StoryModal
          story={activeStory}
          allStories={activeStories}
          onSelectStory={(s) => handleOpenStory(s)}
          onDeleteStory={
            activeStory.contactId === 'me' ||
            normalizeDigits(activeStory.userPhone) === normalizeDigits(userPhone)
              ? handleDeleteStory
              : undefined
          }
          onClose={() => setActiveStory(null)}
          onReplyStory={handleReplyStory}
        />
      )}

      {isAddStoryOpen && (
        <AddStoryModal
          userAvatar={userAvatar}
          presetImages={SAMPLE_SHARED_IMAGES}
          onClose={() => setIsAddStoryOpen(false)}
          onPublishStory={handlePublishStory}
        />
      )}

      {isNewChatOpen && (
        <NewChatModal
          registeredUsers={registeredUsers}
          onClose={() => setIsNewChatOpen(false)}
          onCreateContact={handleCreateNewContact}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
        />
      )}

      {isCreateGroupOpen && (
        <CreateGroupModal
          contacts={contacts}
          registeredUsers={registeredUsers}
          currentUserName={userName}
          currentUserPhone={userPhone}
          onClose={() => setIsCreateGroupOpen(false)}
          onCreateGroup={handleCreateGroup}
        />
      )}

      {isProfileOpen && (
        <ProfileModal
          userName={userName}
          userPhone={userPhone}
          userBio={userBio}
          userAvatar={userAvatar}
          onClose={() => setIsProfileOpen(false)}
          onSaveProfile={handleSaveProfile}
        />
      )}
    </div>
  );
}

export { StepItem, SocialButton, InputGroup };

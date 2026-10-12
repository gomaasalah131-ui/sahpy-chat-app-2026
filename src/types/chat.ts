export type WallpaperThemeId =
  | 'aurora-borealis'
  | 'neon-waves'
  | 'cosmic-nebula'
  | 'sunset-liquid'
  | 'emerald-matrix'
  | 'royal-amethyst';

export type BubbleAccentId = 'emerald' | 'violet' | 'cyan' | 'rose' | 'amber';

export type AnimationSpeed = 'dynamic' | 'calm' | 'paused' | 'slow' | 'normal' | 'fast';

export type MuteDuration = '8h' | '1w' | 'always' | null | string;

export type PatternOverlayId = 'none' | 'doodle-chat' | 'constellation' | 'hex-grid';

export interface WallpaperConfig {
  themeId: WallpaperThemeId;
  bubbleAccent: BubbleAccentId;
  patternId?: PatternOverlayId;
  animationSpeed: AnimationSpeed;
  motionPaused?: boolean;
  dimLevel?: number;
  blurGlass?: boolean;
  showDoodlePattern?: boolean;
  patternOpacity?: number;
  showFloatingParticles?: boolean;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface Message {
  id: string;
  senderId: 'me' | string;
  senderUid?: string;
  senderName?: string;
  senderPhone?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'voice' | 'image' | 'sticker';
  voiceDuration?: string;
  imageUrl?: string;
  imageCaption?: string;
  stickerId?: string;
  stickerEmoji?: string;
  stickerLabel?: string;
  stickerGradient?: string;
  stickerPackId?: string;
  reactions: MessageReaction[];
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  isStarred?: boolean;
  isPinned?: boolean;
  createdAtMs?: number;
  isEdited?: boolean;
  editedAt?: number | string;
}

export interface SharedMediaItem {
  id: string;
  url: string;
  title: string;
  subtitle?: string;
  date: string;
  size?: string;
  type?: 'image' | 'file' | 'link';
}

export interface GroupMember {
  id: string;
  name: string;
  phone: string;
  username?: string;
  avatar?: string;
  avatarFallbackColor?: string;
  role: 'admin' | 'member';
  isOnline?: boolean;
}

export interface Contact {
  id: string;
  uid?: string;
  chatId?: string;
  name: string;
  phone: string;
  username?: string;
  avatar: string;
  avatarFallbackColor?: string;
  roleOrBio: string;
  bio?: string;
  statusText?: string;
  isOnline: boolean;
  lastSeen: string;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  muteDuration?: MuteDuration;
  mutedUntilText?: string;
  isBlocked: boolean;
  disappearingMessages?: 'off' | '24h' | '7d' | '90d';
  isTyping?: boolean;
  isGroup?: boolean;
  membersCount?: number;
  groupMembers?: GroupMember[];
  groupAdminPhone?: string;
  customWallpaper?: WallpaperThemeId;
  clearedAtMs?: number;
  messages: Message[];
  sharedMedia: SharedMediaItem[];
}

export interface StoryItem {
  id: string;
  contactId: string;
  userName: string;
  userPhone?: string;
  userUsername?: string;
  avatar: string;
  hasUnseen: boolean;
  timestamp: string;
  createdAt: number; // Unix ms
  expiresAt: number; // Unix ms (createdAt + 24 hours)
  caption?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  videoDuration?: number;
  viewsCount?: number;
  likesCount?: number;
}

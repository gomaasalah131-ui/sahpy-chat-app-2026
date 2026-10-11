import React, { useEffect, useRef, useState } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
  UserPlus,
  Send,
  ShieldCheck,
  QrCode,
  Smartphone,
  ArrowLeft,
  Search,
  MessageSquare,
  Users,
  Check,
  Sparkles,
  AtSign,
  Clock,
  Upload,
  Film,
  Image as ImageIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Eye,
  Heart,
  Camera,
  Lock,
} from 'lucide-react';
import { Contact, StoryItem, WallpaperThemeId } from '../types/chat';
import {
  RegisteredDirectoryUser,
  compressAvatarFile,
  COUNTRY_CODES,
} from './PhoneRegistrationScreen';
import { WALLPAPER_THEMES } from '../data/initialChats';
import {
  auth,
  findRegisteredUserInFirestore,
  PublicDirectoryUser,
  splitPhoneIntoCountryAndLocal,
  isValidPhoneE164Format,
  buildNormalizedPhoneSearchCandidates,
  formatDisplayPhone,
  normalizeUserAvatarUrl,
} from '../lib/firebase';

export function formatRemaining24h(expiresAt?: number): string {
  if (!expiresAt) return 'تختفي خلال 24 ساعة';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'انتهت الصلاحية';
  const totalMinutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `تختفي بعد ${hours} س و ${minutes} د`;
  }
  return `تختفي بعد ${minutes} دقيقة`;
}

// ==========================================
// 1. Active Audio / Video Call Modal
// ==========================================
interface CallModalProps {
  contact: Contact;
  callType: 'audio' | 'video';
  onEndCall: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  contact,
  callType,
  onEndCall,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(callType === 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  useEffect(() => {
    const connectTimer = setTimeout(() => setConnected(true), 1500);
    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900/95 border border-white/15 shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center">
        <div
          className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, #10b981 0%, #6366f1 60%, transparent 100%)',
          }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, #ec4899 0%, #8b5cf6 60%, transparent 100%)',
          }}
        />

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>مكالمة مشفرة عبر SAHPY-CHAT</span>
        </div>

        <div className="relative mb-5">
          {!connected && (
            <>
              <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
              <span className="absolute -inset-3 rounded-full border border-emerald-400/30 animate-pulse" />
            </>
          )}
          <img
            src={contact.avatar}
            alt={contact.name}
            className="relative w-28 h-28 rounded-full object-cover border-4 border-emerald-500/40 shadow-2xl"
          />
          {callType === 'video' && !isCamOff && (
            <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
              HD فيديو
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-white mb-1">{contact.name}</h3>
        {contact.username && (
          <p dir="ltr" className="text-xs font-mono text-emerald-400 mb-0.5">
            @{contact.username.replace(/^@/, '')}
          </p>
        )}
        <p dir="ltr" className="text-xs font-mono text-slate-400 mb-1">
          {contact.phone}
        </p>
        <p className="text-sm text-emerald-400 font-medium mb-8 font-mono">
          {connected ? formatDuration(seconds) : 'جاري الاتصال...'}
        </p>

        <div className="flex items-center justify-center gap-4 w-full">
          <button
            onClick={() => setIsMicMuted(!isMicMuted)}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all cursor-pointer border ${
              isMicMuted
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/15'
            }`}
            title={isMicMuted ? 'إلغاء كتم الميكروفون' : 'كتم الميكروفون'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsCamOff(!isCamOff)}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all cursor-pointer border ${
              isCamOff
                ? 'bg-white/5 border-white/10 text-slate-400'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
            title={isCamOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
          >
            {isCamOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all cursor-pointer border ${
              isSpeakerOn
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-white/10 border-white/10 text-slate-300'
            }`}
            title="مكبر الصوت"
          >
            <Volume2 className="w-5 h-5" />
          </button>

          <button
            onClick={onEndCall}
            className="w-14 h-14 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all cursor-pointer"
            title="إنهاء المكالمة"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. Story Viewer Modal (24-Hour Status: Photo & Short Video)
// ==========================================
interface StoryModalProps {
  story: StoryItem;
  allStories?: StoryItem[];
  onSelectStory?: (story: StoryItem) => void;
  onDeleteStory?: (storyId: string) => void;
  onClose: () => void;
  onReplyStory: (story: StoryItem, replyText: string) => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({
  story,
  allStories = [],
  onSelectStory,
  onDeleteStory,
  onClose,
  onReplyStory,
}) => {
  const [replyText, setReplyText] = useState('');
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const storiesList = allStories.length > 0 ? allStories : [story];
  const currentIndex = Math.max(
    0,
    storiesList.findIndex((s) => s.id === story.id)
  );

  const isVideo =
    story.mediaType === 'video' ||
    Boolean(story.mediaUrl && /\.(mp4|webm|ogg)(\?|$)/i.test(story.mediaUrl)) ||
    Boolean(story.mediaUrl && story.mediaUrl.startsWith('data:video/'));

  const goToNextStory = () => {
    if (currentIndex < storiesList.length - 1 && onSelectStory) {
      setProgress(0);
      onSelectStory(storiesList[currentIndex + 1]);
    } else {
      onClose();
    }
  };

  const goToPrevStory = () => {
    if (currentIndex > 0 && onSelectStory) {
      setProgress(0);
      onSelectStory(storiesList[currentIndex - 1]);
    }
  };

  useEffect(() => {
    setProgress(0);
    setIsPaused(false);
  }, [story.id]);

  // Timer for image stories (or fallback)
  useEffect(() => {
    if (isVideo || isPaused) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          return 100;
        }
        return p + 1.5;
      });
    }, 90);
    return () => clearInterval(interval);
  }, [isVideo, isPaused, story.id]);

  useEffect(() => {
    if (!isVideo && progress >= 100) {
      goToNextStory();
    }
  }, [progress, isVideo]);

  const handleVideoTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const pct = Math.min(100, (vid.currentTime / vid.duration) * 100);
    setProgress(pct);
  };

  const togglePlayPause = () => {
    const vid = videoRef.current;
    if (isVideo && vid) {
      if (vid.paused) {
        vid.play().catch(() => {});
        setIsPaused(false);
      } else {
        vid.pause();
        setIsPaused(true);
      }
    } else {
      setIsPaused((prev) => !prev);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onReplyStory(story, replyText.trim());
    setReplyText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-md h-[88vh] max-h-[720px] rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col justify-between">
        {/* Segmented Progress Bars for all active stories */}
        <div className="relative z-20 p-3 sm:p-4 bg-gradient-to-b from-black/85 via-black/50 to-transparent">
          <div className="flex items-center gap-1.5 mb-3">
            {storiesList.map((item, idx) => {
              let barWidth = 0;
              if (idx < currentIndex) barWidth = 100;
              else if (idx === currentIndex) barWidth = progress;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectStory && onSelectStory(item)}
                  className="flex-1 h-1.5 rounded-full bg-white/25 overflow-hidden cursor-pointer"
                >
                  <div
                    className="h-full bg-emerald-400 transition-all duration-100"
                    style={{ width: `${barWidth}%` }}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={story.avatar}
                  alt={story.userName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400"
                />
                <span className="absolute -bottom-1 -left-1 px-1.5 py-0.2 rounded-full bg-slate-950 border border-emerald-500/40 text-[9px] text-emerald-300 font-bold">
                  {isVideo ? '🎬' : '📷'}
                </span>
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">
                  {story.userName}
                </h4>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-300">
                  <span>{story.timestamp}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    <Clock className="w-2.5 h-2.5" />
                    {formatRemaining24h(story.expiresAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isVideo && (
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  className="p-2 rounded-xl bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
                  title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={togglePlayPause}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
                title={isPaused ? 'تشغيل' : 'إيقاف مؤقت'}
              >
                {isPaused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </button>

              {onDeleteStory && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteStory(story.id);
                    onClose();
                  }}
                  className="p-2 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 transition-colors cursor-pointer"
                  title="حذف هذه الحالة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Story Media (Video or Photo) */}
        <div
          onClick={togglePlayPause}
          className="absolute inset-0 flex items-center justify-center bg-slate-950 select-none"
        >
          {isVideo ? (
            <video
              ref={videoRef}
              key={story.mediaUrl}
              src={story.mediaUrl}
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={goToNextStory}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={story.mediaUrl || story.avatar}
              alt={story.userName}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40 pointer-events-none" />
        </div>

        {/* Left / Right Story Navigation Buttons */}
        {storiesList.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevStory();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer"
                title="الحالة السابقة"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {currentIndex < storiesList.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextStory();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer"
                title="الحالة التالية"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {/* Caption & Reply Input */}
        <div className="relative z-20 p-4 space-y-3">
          {story.caption && (
            <div className="px-4 py-2.5 rounded-2xl bg-black/65 backdrop-blur-md text-white text-sm text-center border border-white/15 shadow-lg">
              {story.caption}
            </div>
          )}

          {/* Views & Likes Row */}
          <div className="flex items-center justify-between px-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/10">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>{(story.viewsCount || 1) + 1} مشاهدة</span>
            </div>

            <button
              type="button"
              onClick={() => setLiked((l) => !l)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all cursor-pointer ${
                liked
                  ? 'bg-rose-500/25 border-rose-500/50 text-rose-300'
                  : 'bg-black/50 border-white/10 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  liked ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
              <span>{(story.likesCount || 0) + (liked ? 1 : 0)} إعجاب</span>
            </button>
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              placeholder={`الرد على حالة ${story.userName}...`}
              className="flex-1 py-2.5 px-4 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-sm text-white placeholder-slate-300 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="p-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. Add Story Modal (Upload Photo or Short Video - 24h)
// ==========================================
interface AddStoryModalProps {
  userAvatar: string;
  presetImages: string[];
  onClose: () => void;
  onPublishStory: (payload: {
    caption: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
  }) => void;
}

const PRESET_SHORT_VIDEOS = [
  {
    id: 'vid-aurora',
    title: 'شفق SAHPY-CHAT المتحرك ✨',
    url: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4',
  },
  {
    id: 'vid-waves',
    title: 'أمواج ضوئية سينمائية 🌊',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-purple-and-blue-neon-lines-41465-large.mp4',
  },
];

export const AddStoryModal: React.FC<AddStoryModalProps> = ({
  userAvatar,
  presetImages,
  onClose,
  onPublishStory,
}) => {
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [selectedMediaUrl, setSelectedMediaUrl] = useState(
    presetImages[0] || userAvatar
  );
  const [caption, setCaption] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideoFile = file.type.startsWith('video/');
    const isImageFile = file.type.startsWith('image/');

    if (!isVideoFile && !isImageFile) {
      setUploadError('يرجى اختيار ملف صورة (JPG, PNG, WEBP) أو فيديو قصير (MP4, WEBM).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('حجم الملف كبير جداً. يرجى اختيار صورة أو فيديو قصير أقل من 20 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaType(isVideoFile ? 'video' : 'image');
        setSelectedMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMediaUrl) return;
    onPublishStory({
      caption: caption.trim() || 'حالة يومية جديدة عبر SAHPY-CHAT ✨',
      mediaUrl: selectedMediaUrl,
      mediaType,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                إضافة حالة يومية (Status / Story)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                24 ساعة
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ارفع صورة أو فيديو قصير يظهر فوق قائمة المحادثات ويختفي تلقائياً بعد 24 ساعة
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto custom-scrollbar"
        >
          {/* Media Type Switcher + Upload from Device */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setMediaType('image');
                setSelectedMediaUrl(presetImages[0] || userAvatar);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                mediaType === 'image'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-300 border-white/10 hover:bg-slate-800'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>صورة يومية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMediaType('video');
                setSelectedMediaUrl(PRESET_SHORT_VIDEOS[0].url);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                mediaType === 'video'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-300 border-white/10 hover:bg-slate-800'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>فيديو قصير</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-500/40 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>رفع من جهازك</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {uploadError && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
              {uploadError}
            </div>
          )}

          {/* Live Preview Box */}
          <div className="relative h-56 rounded-2xl overflow-hidden border border-white/15 bg-slate-950">
            {mediaType === 'video' ? (
              <video
                key={selectedMediaUrl}
                src={selectedMediaUrl}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={selectedMediaUrl}
                alt="Story preview"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-bold text-emerald-300 flex items-center gap-1.5 pointer-events-none">
              <Clock className="w-3 h-3" />
              <span>{mediaType === 'video' ? '🎬 فيديو قصير • 24 ساعة' : '📷 صورة • 24 ساعة'}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
              <p className="text-xs text-white text-center font-medium truncate">
                {caption || 'معاينة النص على الحالة اليومية...'}
              </p>
            </div>
          </div>

          {/* Preset Selection (Photos or Videos) */}
          {mediaType === 'image' ? (
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                اختر من الصور الجاهزة أو ارفع صورة من جهازك:
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {[userAvatar, ...presetImages].map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setMediaType('image');
                      setSelectedMediaUrl(img);
                    }}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      selectedMediaUrl === img
                        ? 'border-emerald-400 scale-105'
                        : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                اختر فيديو قصير جاهز أو ارفع فيديو من جهازك:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_SHORT_VIDEOS.map((vid) => (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => {
                      setMediaType('video');
                      setSelectedMediaUrl(vid.url);
                    }}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 cursor-pointer ${
                      selectedMediaUrl === vid.url
                        ? 'bg-emerald-500/15 border-emerald-400 text-white'
                        : 'bg-slate-800/60 border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Film className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-medium truncate">{vid.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Caption Input */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              تعليق على الحالة اليومية:
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="اكتب ما يدور في ذهنك اليوم على SAHPY-CHAT... ✨"
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/90 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              نشر الحالة الآن ({mediaType === 'video' ? 'فيديو قصير' : 'صورة'} • تختفي بعد 24 ساعة)
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 4. New Chat Modal (Search Registered Users in Firestore by @username or UID)
// ==========================================
interface NewChatModalProps {
  registeredUsers: RegisteredDirectoryUser[];
  onClose: () => void;
  onCreateContact: (
    name: string,
    phone: string,
    roleOrBio: string,
    avatar?: string,
    username?: string,
    targetUid?: string
  ) => void;
  onOpenCreateGroup?: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  registeredUsers,
  onClose,
  onCreateContact,
  onOpenCreateGroup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCountryCode, setSearchCountryCode] = useState('+20');
  const [firestoreResult, setFirestoreResult] =
    useState<PublicDirectoryUser | null>(null);
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);
  const [searchError, setSearchError] = useState('');

  const myUid = auth.currentUser?.uid || '';
  const hasActiveSearch = searchQuery.trim().length >= 3;

  useEffect(() => {
    const q = searchQuery.trim();
    setSearchError('');
    if (q.length < 3) {
      setFirestoreResult(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingFirestore(true);
      try {
        const found = await findRegisteredUserInFirestore(q, searchCountryCode);
        if (!cancelled) {
          if (found && found.uid !== myUid) {
            setFirestoreResult(found);
          } else {
            setFirestoreResult(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFirestoreResult(null);
          if (err instanceof Error && err.message === 'SEARCH_RATE_LIMITED') {
            setSearchError(
              'لقد تجاوزت الحد المسموح لمحاولات البحث المتتالية. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.'
            );
          }
        }
      } finally {
        if (!cancelled) setIsSearchingFirestore(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, searchCountryCode, myUid]);

  const combinedDirectory = React.useMemo(() => {
    if (!hasActiveSearch) return [];
    const q = searchQuery.trim().toLowerCase();
    const cleanQUser = q.replace(/^@+/, '');
    const phoneCandidates = buildNormalizedPhoneSearchCandidates(
      searchQuery.trim(),
      searchCountryCode
    );
    const candidateDigitsSet = new Set(
      phoneCandidates.map((p) => p.replace(/\D/g, ''))
    );

    const map = new Map<string, RegisteredDirectoryUser>();

    if (firestoreResult && firestoreResult.uid !== myUid) {
      map.set(firestoreResult.uid, {
        id: firestoreResult.uid,
        uid: firestoreResult.uid,
        name: firestoreResult.displayName,
        phone: `@${firestoreResult.username || firestoreResult.uid.slice(0, 8)}`,
        username: firestoreResult.username,
        bio: firestoreResult.bio || 'مستخدم مسجل في SAHPY-CHAT ✨',
        avatar: normalizeUserAvatarUrl(
          firestoreResult.avatarUrl,
          firestoreResult.uid,
          firestoreResult.displayName
        ),
        emailVerified: firestoreResult.emailVerified,
        phoneVerified: false,
        isOnline: true,
        lastSeen: 'مسجل في SAHPY-CHAT',
      });
    }

    registeredUsers.forEach((u) => {
      const uid = u.uid || u.id;
      if (!uid || uid === myUid) return;
      const uDigits = (u.normalizedPhone || u.phone || '').replace(/[^\d]/g, '');
      const uUsername = (u.username || '').toLowerCase();
      const matchesPhone =
        uDigits.length >= 7 &&
        Array.from(candidateDigitsSet).some(
          (cand) =>
            cand === uDigits ||
            (cand.length >= 9 &&
              uDigits.length >= 9 &&
              cand.slice(-9) === uDigits.slice(-9))
        );
      const matches =
        uid.toLowerCase() === q ||
        (cleanQUser.length >= 3 && uUsername === cleanQUser) ||
        matchesPhone;

      if (matches && !map.has(uid)) {
        map.set(uid, {
          ...u,
          id: uid,
          uid,
          avatar: normalizeUserAvatarUrl(u.avatar, uid, u.name),
          phone: `@${u.username || uid.slice(0, 8)}`,
        });
      }
    });

    return Array.from(map.values());
  }, [
    hasActiveSearch,
    searchQuery,
    searchCountryCode,
    firestoreResult,
    registeredUsers,
    myUid,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                بدء محادثة جديدة (البحث عن أشخاص)
              </h3>
              <p className="text-[11px] text-slate-400">
                ابحث عن المستخدمين باستخدام اسم المستخدم (@username) أو رقم الهاتف
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenCreateGroup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateGroup();
                }}
                className="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>إنشاء مجموعة</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-xs font-bold text-emerald-400">
                ابحث بواسطة اسم المستخدم (@username) أو رقم الهاتف:
              </label>
              <div className="flex items-center gap-1.5" dir="ltr">
                <span className="text-[10px] text-slate-400" dir="rtl">
                  كود الدولة للبحث بالهاتف:
                </span>
                <select
                  value={searchCountryCode}
                  onChange={(e) => setSearchCountryCode(e.target.value)}
                  className="bg-slate-800 border border-white/15 rounded-lg h-7 px-2 text-white text-[11px] font-mono focus:outline-none focus:border-emerald-400"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-slate-900">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اكتب @username أو رقم الهاتف (مثال: 01098765432)..."
                className="w-full py-2.5 pr-10 pl-4 rounded-xl bg-slate-800/90 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {searchError && (
              <p className="text-xs text-rose-400 font-medium">{searchError}</p>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {!hasActiveSearch ? (
                <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-white/10 flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    حماية الخصوصية: لا يتم كشف البريد الإلكتروني أو رقم الهاتف في نتائج البحث، ولا يُسمح بسرد جميع الحسابات. أدخل اسم المستخدم (<span dir="ltr" className="text-emerald-400 font-mono">@username</span>) أو رقم الهاتف للبحث وبدء محادثة مرتبطة بـ <span dir="ltr" className="text-cyan-400 font-mono">UID</span>.
                  </span>
                </div>
              ) : isSearchingFirestore ? (
                <p className="text-xs text-emerald-300 text-center py-4 animate-pulse">
                  جاري البحث وتوحيد تنسيق الرقم في قاعدة بيانات Firestore...
                </p>
              ) : combinedDirectory.length === 0 ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 text-center space-y-1">
                  <p className="font-bold">
                    لم يتم العثور على مستخدم مطابق لبحثك
                  </p>
                  <p className="text-[11px] text-rose-300/80">
                    تأكد من كتابة اسم المستخدم (@username) أو رقم الهاتف مع كود الدولة الصحيح.
                  </p>
                </div>
              ) : (
                combinedDirectory.map((user) => (
                  <div
                    key={user.uid || user.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/60 border border-white/10 hover:border-emerald-500/40 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white truncate">
                            {user.name}
                          </h4>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          {user.username && (
                            <span dir="ltr" className="text-cyan-400">
                              @{user.username.replace(/^@/, '')}
                            </span>
                          )}
                          <span className="text-slate-600">•</span>
                          <span
                            dir="ltr"
                            className="text-slate-400 text-[10px] truncate"
                          >
                            UID: {(user.uid || user.id).slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onCreateContact(
                          user.name,
                          user.phone,
                          user.bio,
                          user.avatar,
                          user.username,
                          user.uid || user.id
                        );
                        onClose();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>بدء محادثة</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 5. Create Group Chat Modal
// ==========================================
export interface CreateGroupSelectionItem {
  id: string;
  name: string;
  phone: string;
  username?: string;
  avatar: string;
  isOnline?: boolean;
}

interface CreateGroupModalProps {
  contacts: Contact[];
  registeredUsers: RegisteredDirectoryUser[];
  currentUserName: string;
  currentUserPhone: string;
  onClose: () => void;
  onCreateGroup: (data: {
    name: string;
    description: string;
    customWallpaper: WallpaperThemeId;
    members: CreateGroupSelectionItem[];
  }) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  contacts,
  registeredUsers,
  currentUserName,
  currentUserPhone,
  onClose,
  onCreateGroup,
}) => {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWallpaper, setSelectedWallpaper] =
    useState<WallpaperThemeId>('cosmic-nebula');
  const [selectedMembers, setSelectedMembers] = useState<
    CreateGroupSelectionItem[]
  >([]);
  const [errorMsg, setErrorMsg] = useState('');

  const availablePool = React.useMemo(() => {
    const map = new Map<string, CreateGroupSelectionItem>();

    contacts
      .filter((c) => !c.isGroup && !c.isBlocked)
      .forEach((c) => {
        const key = (c.phone || c.id).replace(/\D/g, '') || c.id;
        map.set(key, {
          id: c.id,
          name: c.name,
          phone: c.phone,
          username: c.username,
          avatar: c.avatar,
          isOnline: c.isOnline,
        });
      });

    // Privacy like WhatsApp: only include registered users when actively searching
    if (searchQuery.trim().length >= 2) {
      registeredUsers.forEach((u) => {
        const key = (u.phone || u.id).replace(/\D/g, '') || u.id;
        if (!map.has(key)) {
          map.set(key, {
            id: u.id,
            name: u.name,
            phone: u.phone,
            username: u.username,
            avatar: u.avatar,
            isOnline: u.isOnline,
          });
        }
      });
    }

    return Array.from(map.values());
  }, [contacts, registeredUsers, searchQuery]);

  const filteredPool = availablePool.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cleanQUser = q.replace(/^@+/, '');
    return (
      item.name.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      (item.username || '').toLowerCase().includes(cleanQUser)
    );
  });

  const toggleMember = (item: CreateGroupSelectionItem) => {
    setErrorMsg('');
    setSelectedMembers((prev) => {
      const exists = prev.some((m) => m.id === item.id || m.phone === item.phone);
      if (exists) {
        return prev.filter((m) => m.id !== item.id && m.phone !== item.phone);
      }
      return [...prev, item];
    });
  };

  const selectAllMembers = () => {
    setSelectedMembers(availablePool);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMsg('يرجى كتابة اسم للمجموعة أولاً.');
      return;
    }
    if (selectedMembers.length === 0) {
      setErrorMsg('يرجى اختيار جهة اتصال واحدة على الأقل لإضافتها إلى المجموعة.');
      return;
    }

    onCreateGroup({
      name: groupName.trim(),
      description:
        groupDescription.trim() ||
        `مجموعة دردشة بإشراف ${currentUserName} (${currentUserPhone}) ✨`,
      customWallpaper: selectedWallpaper,
      members: selectedMembers,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-l from-emerald-500/10 via-violet-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                إنشاء مجموعة دردشة جديدة (Group Chat)
              </h3>
              <p className="text-xs text-slate-400">
                اختر عدة جهات اتصال بالرقم أو اليوزر (@username)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1"
        >
          {/* Group Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم المجموعة *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="مثال: فريق SAHPY-CHAT الهندسي 🚀"
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/90 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                وصف المجموعة (اختياري)
              </label>
              <input
                type="text"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="مساحة نقاش ومشاركة الملفات..."
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/90 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Group Animated Wallpaper Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              خلفية المجموعة المتحركة:
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {WALLPAPER_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setSelectedWallpaper(theme.id)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium shrink-0 flex items-center gap-2 transition-all cursor-pointer ${
                    selectedWallpaper === theme.id
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                      : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center -space-x-1 space-x-reverse">
                    {theme.previewColors.map((c, idx) => (
                      <span
                        key={idx}
                        className="w-3 h-3 rounded-full border border-slate-900"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span>{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Members Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-emerald-400">
                الأعضاء المشاركون ({selectedMembers.length + 1} معك):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllMembers}
                  className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  تحديد الكل ({availablePool.length})
                </button>
                {selectedMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMembers([])}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-2xl bg-slate-950/60 border border-white/10 min-h-[52px]">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-300 font-bold">
                <span>أنت (مشرف المجموعة)</span>
              </div>
              {selectedMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-800 border border-white/15 text-xs text-white"
                >
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>{m.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleMember(m)}
                    className="p-0.5 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Multi-select List */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن عضو بالاسم أو رقم الهاتف أو @username..."
                className="w-full py-2 pr-10 pl-4 rounded-xl bg-slate-800/90 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {filteredPool.map((item) => {
                const isSelected = selectedMembers.some(
                  (m) => m.id === item.id || m.phone === item.phone
                );
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleMember(item)}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50'
                        : 'bg-slate-800/50 border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                        {item.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          {item.username && (
                            <span dir="ltr" className="text-cyan-400">
                              @{item.username.replace(/^@/, '')}
                            </span>
                          )}
                          <span className="text-slate-600">•</span>
                          <span dir="ltr" className="text-emerald-400">
                            {item.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-white/20 bg-slate-900/50 text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-sm transition-all cursor-pointer shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              إنشاء المجموعة الآن ({selectedMembers.length + 1} أعضاء)
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 6. User Profile & Phone Registration Modal
// ==========================================
interface ProfileModalProps {
  userName: string;
  userPhone: string;
  userBio: string;
  userAvatar: string;
  onClose: () => void;
  onSaveProfile: (
    name: string,
    phone: string,
    bio: string,
    avatar?: string
  ) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  userName,
  userPhone,
  userBio,
  userAvatar,
  onClose,
  onSaveProfile,
}) => {
  const initialSplit = splitPhoneIntoCountryAndLocal(
    formatDisplayPhone(userPhone)
  );
  const [name, setName] = useState(userName);
  const [countryCode, setCountryCode] = useState(initialSplit.countryCode);
  const [phoneDigits, setPhoneDigits] = useState(initialSplit.localDigits);
  const [bio, setBio] = useState(userBio);
  const [avatar, setAvatar] = useState(userAvatar);
  const [phoneError, setPhoneError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const compressed = await compressAvatarFile(file);
      setAvatar(compressed);
    } catch {
      // ignore error
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    const phoneCheck = isValidPhoneE164Format(countryCode, phoneDigits, {
      optional: true,
    });
    if (!phoneCheck.valid) {
      setPhoneError(
        phoneCheck.reason ||
          'صيغة رقم الهاتف غير صحيحة. يمكنك تركه فارغاً أو إدخال رقم هاتف صالح مع كود الدولة.'
      );
      return;
    }
    onSaveProfile(
      name.trim() || userName,
      phoneCheck.e164,
      bio.trim() || userBio,
      avatar
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                الملف الشخصي الموثق في SAHPY-CHAT
              </h3>
              <p className="text-[11px] text-slate-400">
                𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-800/50 border border-white/5">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-500/40 cursor-pointer group shrink-0"
              title="اضغط لتغيير صورة البروفايل"
            >
              <img
                src={avatar}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium mb-0.5">
                <ShieldCheck className="w-4 h-4" />
                <span>حساب موثق على Firebase</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{name}</p>
              {auth.currentUser?.uid && (
                <p
                  className="text-[10px] text-cyan-400 font-mono truncate"
                  dir="ltr"
                >
                  UID: {auth.currentUser.uid}
                </p>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>تغيير صورة البروفايل</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300">
              <QrCode className="w-6 h-6" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              الاسم المعروض
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/90 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between flex-wrap gap-1 mb-1.5">
              <label className="text-xs text-slate-300 font-bold">
                رقم الهاتف (اختياري — يُستخدم للبحث عنك فقط)
              </label>
              {phoneDigits && (
                <button
                  type="button"
                  onClick={() => {
                    setPhoneDigits('');
                    setPhoneError('');
                  }}
                  className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                >
                  حذف الرقم
                </button>
              )}
            </div>
            <div className="flex items-center gap-2" dir="ltr">
              <select
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setPhoneError('');
                }}
                className="py-2.5 px-2.5 rounded-xl bg-slate-800/90 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50 shrink-0"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-slate-900">
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                dir="ltr"
                value={phoneDigits}
                onChange={(e) => {
                  setPhoneDigits(e.target.value);
                  setPhoneError('');
                }}
                placeholder="1098765432 (اختياري)"
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-slate-800/90 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50 text-left font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              رقم الهاتف اختياري وغير مؤكد بـ SMS، ويُستخدم فقط لتمكين المستخدمين من العثور على حسابك عند البحث بالرقم.
            </p>
            {phoneError && (
              <p className="text-xs text-rose-400 mt-1">{phoneError}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              الحالة (Bio)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800/90 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            حفظ وتحديث الحساب في Firestore
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 7. Clear / Delete Conversation Confirmation Modal
// ==========================================
interface ClearOrDeleteChatModalProps {
  contact: Contact;
  mode: 'clear' | 'delete';
  isProcessing?: boolean;
  onClose: () => void;
  onConfirm: (scope: 'me' | 'both') => void;
}

export const ClearOrDeleteChatModal: React.FC<ClearOrDeleteChatModalProps> = ({
  contact,
  mode,
  isProcessing = false,
  onClose,
  onConfirm,
}) => {
  const [scope, setScope] = useState<'me' | 'both'>('me');

  const isDeleteConversation = mode === 'delete';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/30 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-rose-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isDeleteConversation
                  ? 'تأكيد حذف المحادثة من القائمة'
                  : 'تأكيد مسح محتوى المحادثة'}
              </h3>
              <p className="text-xs text-slate-300 truncate max-w-[230px]">
                {contact.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            {isDeleteConversation
              ? `هل أنت متأكد من رغبتك في حذف محادثتك مع "${contact.name}"؟ لن يتم المساس بأي محادثات أخرى في حسابك.`
              : `هل أنت متأكد من رغبتك في مسح جميع الرسائل داخل محادثتك مع "${contact.name}"؟ ستبقى المحادثة مفتوحة ولكن سيتم تفريغ الرسائل.`}
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              نطاق الحذف:
            </label>

            <button
              type="button"
              onClick={() => setScope('me')}
              className={`w-full p-3 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                scope === 'me'
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                  : 'bg-slate-800/60 border-white/10 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  scope === 'me'
                    ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                    : 'border-slate-500'
                }`}
              >
                {scope === 'me' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div className="text-xs">
                <p className="font-bold text-white">
                  {isDeleteConversation
                    ? 'حذف من جهتي فقط (حسابي الحالي فقط)'
                    : 'مسح الرسائل من جهتي فقط (حسابي الحالي فقط)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  تُحذف الرسائل من شاشتك وسجلك الخاص فقط، وتظل ظاهرة لدى الطرف الآخر.
                </p>
              </div>
            </button>

            {!contact.isGroup && (
              <button
                type="button"
                onClick={() => setScope('both')}
                className={`w-full p-3 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                  scope === 'both'
                    ? 'bg-rose-500/15 border-rose-500/50 text-white'
                    : 'bg-slate-800/60 border-white/10 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    scope === 'both'
                      ? 'border-rose-400 bg-rose-500 text-white'
                      : 'border-slate-500'
                  }`}
                >
                  {scope === 'both' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="text-xs">
                  <p className="font-bold text-rose-200">
                    {isDeleteConversation
                      ? 'حذف المحادثة ومسح الرسائل لدى الطرفين'
                      : 'مسح الرسائل لدى الطرفين (أنت والطرف الآخر)'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    يتم حذف الرسائل من غرفة المحادثة المشتركة في قاعدة بيانات Firestore للطرفين معاً.
                  </p>
                </div>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onConfirm(scope)}
              className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/25"
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'جاري التنفيذ...'
                  : isDeleteConversation
                  ? 'تأكيد حذف المحادثة'
                  : 'تأكيد مسح المحادثة'}
              </span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer border border-white/10"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

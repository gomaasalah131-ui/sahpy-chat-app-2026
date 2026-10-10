import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Circle,
  Chrome,
  Eye,
  EyeOff,
  MessageSquare,
  UserPlus,
  Mail,
  LogIn,
  CheckCircle2,
  ShieldCheck,
  Camera,
  Upload,
  Lock,
} from 'lucide-react';
import { WallpaperConfig } from '../types/chat';
import { signInWithGoogleCloud } from '../lib/firebase';
import defaultAvatarImg from '../assets/images/avatar_ahmed_profile_1791581695415.jpg';
import presetAvatar2 from '../assets/images/avatar_omar_profile_1791581716878.jpg';
import presetAvatar3 from '../assets/images/avatar_sara_profile_1791581706989.jpg';

export interface RegisteredDirectoryUser {
  id: string;
  name: string;
  phone: string;
  normalizedPhone?: string;
  username?: string;
  normalizedUsername?: string;
  email?: string;
  bio: string;
  avatar: string;
  isOnline: boolean;
  lastSeen: string;
}

export function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ملف صورة غير صالح'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const PRESET_AVATARS = [
  defaultAvatarImg,
  presetAvatar2,
  presetAvatar3,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
];

interface PhoneRegistrationScreenProps {
  wallpaperConfig: WallpaperConfig;
  currentPhone: string;
  currentName: string;
  currentUsername?: string;
  currentBio: string;
  currentAvatar?: string;
  registeredUsers: RegisteredDirectoryUser[];
  onCompleteRegistration: (data: {
    name: string;
    phone: string;
    username: string;
    email?: string;
    bio: string;
    avatar?: string;
    stayOnScreen?: boolean;
  }) => Promise<void>;
  onStartChatWithUser: (user: RegisteredDirectoryUser) => void;
  onBackToChats: () => void;
}

export const PhoneRegistrationScreen: React.FC<PhoneRegistrationScreenProps> = ({
  currentPhone,
  currentName,
  currentUsername,
  currentBio,
  currentAvatar,
  onCompleteRegistration,
  onBackToChats,
}) => {
  const nameParts = (currentName || '').trim().split(' ');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [firstName, setFirstName] = useState(nameParts[0] || 'Salah');
  const [lastName, setLastName] = useState(
    nameParts.slice(1).join(' ') || 'Gomaa'
  );
  const [phone, setPhone] = useState(currentPhone || '+20 109 876 5432');
  const [username, setUsername] = useState(currentUsername || 'salah_gomaa');
  const [gmail, setGmail] = useState('gomaasalah131@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [avatarUrl, setAvatarUrl] = useState<string>(
    currentAvatar || defaultAvatarImg
  );
  const [showPassword, setShowPassword] = useState(false);
  const [activePhase, setActivePhase] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGmailConfirmed, setIsGmailConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP).');
      return;
    }
    try {
      setErrorMsg('');
      const compressed = await compressAvatarFile(file);
      setAvatarUrl(compressed);
      setSuccessMsg('تم اختيار صورة البروفايل بنجاح ✨ اضغط تأكيد أو دخول لحفظها.');
    } catch {
      setErrorMsg('تعذر رفع الصورة، يرجى تجربة صورة أخرى.');
    }
  };

  const validateAndNormalizeData = () => {
    const cleanEmail = gmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('يرجى إدخال عنوان جيميل صحيح (مثال: example@gmail.com).');
      return null;
    }

    const digits = phone.replace(/[^\d٠-٩۰-۹]/g, '');
    if (digits.length < 7) {
      setErrorMsg(
        'يرجى إدخال رقم هاتف صحيح (7 أرقام على الأقل) ليتمكن الآخرون من البحث عنك.'
      );
      return null;
    }

    const derivedUserFromGmail = cleanEmail
      .split('@')[0]
      .replace(/[^a-z0-9_]/gi, '_');
    const cleanUsername = (
      username.trim() ||
      derivedUserFromGmail ||
      'salah_gomaa'
    )
      .toLowerCase()
      .replace(/^@+/, '')
      .replace(/\s+/g, '_');

    if (cleanUsername.length < 3) {
      setErrorMsg(
        'يرجى كتابة يوزر نيم (Username) لا يقل عن 3 أحرف للبحث عنك باليوزر.'
      );
      return null;
    }

    const fullName =
      `${firstName.trim()} ${lastName.trim()}`.trim() || cleanUsername;

    return {
      fullName,
      cleanPhone: phone.trim(),
      cleanUsername,
      cleanEmail,
    };
  };

  // زر "تأكيد" (Confirm Gmail, Avatar & Account Data)
  const handleConfirmAction = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    const validated = validateAndNormalizeData();
    if (!validated) return;

    setIsSubmitting(true);
    try {
      setActivePhase(2);
      await onCompleteRegistration({
        name: validated.fullName,
        phone: validated.cleanPhone,
        username: validated.cleanUsername,
        email: validated.cleanEmail,
        avatar: avatarUrl,
        bio:
          currentBio ||
          `حساب موثق على SAHPY-CHAT • @${validated.cleanUsername} • ${validated.cleanEmail} ✨`,
        stayOnScreen: true,
      });
      setIsGmailConfirmed(true);
      setActivePhase(2);
      setSuccessMsg(
        `تم تأكيد الجيميل (${validated.cleanEmail}) وصورة البروفايل والحساب (@${validated.cleanUsername}) بنجاح ✅ يمكنك الآن الضغط على زر "دخول".`
      );
    } catch {
      setErrorMsg('تعذر تأكيد البيانات حالياً، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // زر "دخول" (Log In & Enter SAHPY-CHAT immediately)
  const handleLoginEnterAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const validated = validateAndNormalizeData();
    if (!validated) return;

    setIsSubmitting(true);
    try {
      setActivePhase(3);
      setIsGmailConfirmed(true);
      await onCompleteRegistration({
        name: validated.fullName,
        phone: validated.cleanPhone,
        username: validated.cleanUsername,
        email: validated.cleanEmail,
        avatar: avatarUrl,
        bio:
          currentBio ||
          `حساب موثق على SAHPY-CHAT • @${validated.cleanUsername} • ${validated.cleanEmail} ✨`,
        stayOnScreen: false,
      });
    } catch {
      setErrorMsg('تعذر تسجيل الدخول حالياً، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ربط الجيميل عبر Google Auth Popup (اختياري ومباشر)
  const handleGooglePopupAuth = async () => {
    setErrorMsg('');
    try {
      const user = await signInWithGoogleCloud();
      if (user.email) setGmail(user.email);
      if (user.photoURL) setAvatarUrl(user.photoURL);
      if (user.displayName) {
        const parts = user.displayName.trim().split(' ');
        setFirstName(parts[0] || firstName);
        setLastName(parts.slice(1).join(' ') || lastName);
      }
      setIsGmailConfirmed(true);
      setSuccessMsg(
        `تم ربط وتأكيد حساب الجيميل (${user.email || gmail}) عبر Google بنجاح ✅`
      );
    } catch {
      if (gmail.trim().includes('@')) {
        setIsGmailConfirmed(true);
        setSuccessMsg(
          `تم تحديد حساب الجيميل (${gmail.trim()}) للتأكيد والدخول ✅`
        );
      }
    }
  };

  const heroContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const heroChildVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <main
      dir="ltr"
      className="flex flex-col lg:flex-row min-h-dvh w-full bg-black text-white selection:bg-white/30 p-2 lg:p-4 gap-4 font-sans"
    >
      {/* Left Column (Hero & Background Video - Sticky on Desktop so page scrolls freely) */}
      <div className="hidden lg:flex w-[46%] xl:w-[50%] shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] relative flex-col items-center justify-between py-6 px-8 xl:px-12 rounded-3xl overflow-hidden shadow-2xl">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"
            type="video/mp4"
          />
        </video>

        {/* Top Signature Badge on Video */}
        <div className="relative z-10 w-full flex items-center justify-between gap-3">
          <div className="px-4 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 shadow-xl">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
              SAHPY-CHAT • Official Platform
            </p>
            <p className="text-sm sm:text-base font-bold text-white tracking-wide mt-0.5">
              𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToChats}
            className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xl cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>دخول الشات والمجموعات</span>
          </button>
        </div>

        {/* Hero Content Container */}
        <motion.div
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-full max-w-xs space-y-4 text-center my-auto py-2"
        >
          {/* Brand/Logo */}
          <motion.div
            variants={heroChildVariants}
            className="flex items-center justify-center gap-2.5"
          >
            <Circle className="w-6 h-6 fill-white text-white" />
            <span className="text-xl font-semibold tracking-tight">
              SAHPY-CHAT
            </span>
          </motion.div>

          {/* Heading Block */}
          <motion.div variants={heroChildVariants} className="space-y-1.5">
            <h1 className="text-3xl xl:text-4xl font-medium tracking-tight whitespace-nowrap">
              Join SAHPY-CHAT
            </h1>
            <p className="text-white/60 text-xs sm:text-sm leading-relaxed px-2">
              Follow these 3 quick phases to activate your space.
            </p>
            <p className="text-xs font-bold text-white bg-black/60 backdrop-blur-md py-1.5 px-3 rounded-lg inline-block border border-white/15">
              𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
            </p>
          </motion.div>

          {/* Steps */}
          <motion.div
            variants={heroChildVariants}
            className="space-y-2 text-left"
          >
            <div onClick={() => setActivePhase(1)} className="cursor-pointer">
              <StepItem
                number="1"
                text="Register your identity"
                active={activePhase === 1}
              />
            </div>
            <div onClick={() => setActivePhase(2)} className="cursor-pointer">
              <StepItem
                number="2"
                text="Confirm your Gmail"
                active={activePhase === 2}
              />
            </div>
            <div onClick={() => setActivePhase(3)} className="cursor-pointer">
              <StepItem
                number="3"
                text="Enter SAHPY-CHAT"
                active={activePhase === 3}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Right Column (Login & Sign Up Interface - Full Natural Page Scroll) */}
      <div className="flex-1 flex flex-col items-center justify-start px-3 sm:px-6 lg:px-8 xl:px-12 py-3 lg:py-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-xl mx-auto space-y-3.5 pb-20"
        >
          {/* Prominent Engineer Signature Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <Circle className="w-5 h-5 fill-white text-white" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">
                    SAHPY-CHAT Platform
                  </span>
                </div>
                <p className="text-base sm:text-lg font-bold text-white tracking-wide">
                  𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onBackToChats}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>فتح الشات</span>
            </button>
          </div>

          {/* Mode Switcher: مكان تسجيل الدخول (Log In) & إنشاء حساب (Sign Up) */}
          <div
            dir="rtl"
            className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-brand-gray border border-white/10"
          >
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setErrorMsg('');
              }}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authTab === 'login'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول (Log In)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('signup');
                setErrorMsg('');
              }}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authTab === 'signup'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>إنشاء حساب جديد (Sign Up)</span>
            </button>
          </div>

          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-2xl sm:text-3xl font-medium tracking-tight">
                {authTab === 'login'
                  ? 'تسجيل الدخول • Log In'
                  : 'Create New Profile • حساب جديد'}
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-md bg-brand-gray text-emerald-400 border border-emerald-500/20 font-medium">
                البحث بالرقم أو اليوزر @username
              </span>
            </div>
            <p className="text-white/50 text-xs sm:text-sm" dir="rtl">
              {authTab === 'login'
                ? 'سجّل دخولك عبر مكان الجيميل أو رقم الهاتف واليوزر نيم واختر صورة البروفايل، ثم اضغط تأكيد أو دخول.'
                : 'أدخل بياناتك وارفع صورة البروفايل ورقم الهاتف واليوزر نيم لتفعيل حسابك في SAHPY-CHAT.'}
            </p>
          </div>

          {/* ============================================================== */}
          {/* إضافة صورة بروفايل (Profile Picture Upload & Picker)           */}
          {/* ============================================================== */}
          <div
            dir="rtl"
            className="p-3.5 rounded-2xl bg-brand-gray border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-lg"
          >
            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <div
                onClick={() => avatarFileInputRef.current?.click()}
                className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-lg shrink-0 cursor-pointer group"
                title="اضغط لرفع صورة بروفايل من جهازك"
              >
                <img
                  src={avatarUrl}
                  alt="صورة البروفايل"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <span className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shadow">
                  <Camera className="w-3 h-3" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-white">
                  صورة البروفايل الشخصية
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  ارفع صورتك من الهاتف أو الكمبيوتر لتظهر في محادثاتك وحالاتك
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  {PRESET_AVATARS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-7 h-7 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                        avatarUrl === preset
                          ? 'border-emerald-400 scale-110 ring-2 ring-emerald-400/30'
                          : 'border-white/15 opacity-60 hover:opacity-100'
                      }`}
                      title="اختيار صورة سريعة"
                    >
                      <img
                        src={preset}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0">
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>رفع صورة بروفايل</span>
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* مكان تسجيل الدخول بالجيميل (Dedicated Gmail Box + تأكيد + دخول) */}
          {/* ============================================================== */}
          <div
            dir="rtl"
            className="p-4 rounded-2xl bg-brand-gray/90 border border-white/15 space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>مكان الجيميل (تسجيل الدخول بحساب Gmail)</span>
              </label>

              <button
                type="button"
                onClick={handleGooglePopupAuth}
                className="px-3 py-1.5 rounded-xl bg-black border border-white/15 hover:bg-white/10 text-xs font-medium text-white flex items-center gap-2 transition-all cursor-pointer"
              >
                <Chrome className="w-3.5 h-3.5 text-emerald-400" />
                <span>ربط Google / Gmail</span>
              </button>
            </div>

            {/* حقل إدخال الجيميل */}
            <div className="relative">
              <input
                dir="ltr"
                type="email"
                value={gmail}
                onChange={(e) => {
                  setGmail(e.target.value);
                  setIsGmailConfirmed(false);
                }}
                placeholder="example@gmail.com"
                className="w-full bg-black border border-white/15 rounded-xl h-12 px-4 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm font-mono"
              />
              <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {isGmailConfirmed && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  مؤكد
                </span>
              )}
            </div>

            {/* زرار تأكيد وزرار دخول تحت مكان الجيميل مباشرة */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAction}
                className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>تأكيد</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleLoginEnterAction()}
                className="h-12 rounded-xl bg-white hover:bg-white/90 text-black font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>دخول</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-white/10" />
            <span className="absolute bg-black px-4 text-xs font-medium text-white/40 uppercase tracking-widest">
              {authTab === 'login'
                ? 'بيانات تسجيل الدخول'
                : 'بيانات الحساب الكاملة'}
            </span>
          </div>

          {/* Form Layout */}
          <form onSubmit={handleLoginEnterAction} className="space-y-4">
            {/* First Name and Last Name in a 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup
                label="First Name (الاسم الأول)"
                placeholder="Salah"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <InputGroup
                label="Last Name (الاسم الأخير)"
                placeholder="Gomaa"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            {/* Phone Number and Username in a 2-column grid (Required for Search by Phone & Search by Username) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup
                label="Phone Number (رقم الهاتف للبحث والدخول)"
                placeholder="+20 109 876 5432"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <InputGroup
                label="Username (اليوزر نيم للبحث @)"
                placeholder="salah_gomaa"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Password (full width) with Eye toggle */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white">
                Password (كلمة المرور)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 pr-11 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                  title="Toggle Password"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-white/40">
                Requires at least 8 symbols.
              </p>
            </div>

            {errorMsg && (
              <div
                dir="rtl"
                className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium"
              >
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                dir="rtl"
                className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium flex items-center justify-between gap-2"
              >
                <span>{successMsg}</span>
                <button
                  type="button"
                  onClick={onBackToChats}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors shrink-0 cursor-pointer"
                >
                  دخول الآن
                </button>
              </div>
            )}

            {/* Bottom Action Buttons: زرار تأكيد + زرار دخول */}
            <div dir="rtl" className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAction}
                className="w-full h-13 bg-brand-gray border border-emerald-500/40 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد البيانات</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-13 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'جاري الدخول...' : 'دخول (تسجيل الدخول)'}
                </span>
              </button>
            </div>

            {/* Footer Link */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm text-white/50">
              <p>
                {authTab === 'login' ? (
                  <>
                    ليس لديك حساب؟{' '}
                    <button
                      type="button"
                      onClick={() => setAuthTab('signup')}
                      className="text-white font-medium underline underline-offset-4 hover:text-white/80 cursor-pointer"
                    >
                      إنشاء حساب جديد
                    </button>
                  </>
                ) : (
                  <>
                    لديك حساب بالفعل؟{' '}
                    <button
                      type="button"
                      onClick={() => setAuthTab('login')}
                      className="text-white font-medium underline underline-offset-4 hover:text-white/80 cursor-pointer"
                    >
                      تسجيل الدخول (Log in)
                    </button>
                  </>
                )}
              </p>
              <span className="text-xs text-white/80 font-bold">
                𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
              </span>
            </div>
          </form>

          {/* WhatsApp-Style Privacy Notice (No Registered Accounts Listed Publicly) */}
          <div
            dir="rtl"
            className="p-3 rounded-2xl bg-brand-gray/60 border border-white/10 flex items-center gap-2.5 text-xs text-white/60"
          >
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              خصوصية تامة مثل واتساب: لا تظهر الحسابات المسجلة لأي شخص، وللتواصل مع أي مستخدم يجب البحث عنه برقم الهاتف أو اليوزر نيم (<span dir="ltr" className="text-emerald-400 font-mono">@username</span>).
            </span>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

// Reusable Components
export function StepItem({
  number,
  text,
  active = false,
}: {
  number: string | number;
  text: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 ${
        active
          ? 'bg-white text-black border border-white shadow-lg'
          : 'bg-brand-gray text-white border-none'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          active ? 'bg-black text-white' : 'bg-white/10 text-white/40'
        }`}
      >
        {number}
      </div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

export function SocialButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 w-full bg-black border border-white/10 rounded-xl hover:bg-white/5 transition-all flex items-center justify-center gap-2.5 text-sm font-medium text-white cursor-pointer"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function InputGroup({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
      />
    </div>
  );
}

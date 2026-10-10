import React, { useEffect, useRef, useState } from 'react';
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
  KeyRound,
  Smartphone,
  RefreshCw,
  AlertCircle,
  AtSign,
  Check,
  X,
  LogOut,
  ArrowRight,
  Info,
} from 'lucide-react';
import { WallpaperConfig } from '../types/chat';
import {
  auth,
  User,
  ConfirmationResult,
  signInWithGoogleCloud,
  registerWithEmailAndPasswordCloud,
  loginWithEmailAndPasswordCloud,
  sendVerificationEmailToCurrentUser,
  sendPasswordResetEmailCloud,
  reloadAndCheckCurrentUser,
  sendPhoneOtpViaFirebase,
  confirmPhoneOtpViaFirebase,
  signOutFromCloud,
  checkUsernameAvailability,
  reserveUsernameAndSaveProfileToFirestore,
  getOwnUserProfileFromFirestore,
  sanitizeUsername,
  isValidEmailFormat,
  isValidUsernameFormat,
  isValidPhoneE164Format,
  translateFirebaseAuthError,
} from '../lib/firebase';
import defaultAvatarImg from '../assets/images/avatar_ahmed_profile_1791581695415.jpg';
import presetAvatar2 from '../assets/images/avatar_omar_profile_1791581716878.jpg';
import presetAvatar3 from '../assets/images/avatar_sara_profile_1791581706989.jpg';

export interface RegisteredDirectoryUser {
  id: string;
  uid?: string;
  name: string;
  phone: string;
  normalizedPhone?: string;
  username?: string;
  normalizedUsername?: string;
  email?: string;
  bio: string;
  avatar: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
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

export const COUNTRY_CODES = [
  { code: '+20', label: '🇪🇬 مصر (+20)' },
  { code: '+966', label: '🇸🇦 السعودية (+966)' },
  { code: '+971', label: '🇦🇪 الإمارات (+971)' },
  { code: '+965', label: '🇰🇼 الكويت (+965)' },
  { code: '+974', label: '🇶🇦 قطر (+974)' },
  { code: '+973', label: '🇧🇭 البحرين (+973)' },
  { code: '+968', label: '🇴🇲 عُمان (+968)' },
  { code: '+962', label: '🇯🇴 الأردن (+962)' },
  { code: '+961', label: '🇱🇧 لبنان (+961)' },
  { code: '+964', label: '🇮🇶 العراق (+964)' },
  { code: '+212', label: '🇲🇦 المغرب (+212)' },
  { code: '+213', label: '🇩🇿 الجزائر (+213)' },
  { code: '+216', label: '🇹🇳 تونس (+216)' },
  { code: '+218', label: '🇱🇾 ليبيا (+218)' },
  { code: '+249', label: '🇸🇩 السودان (+249)' },
  { code: '+967', label: '🇾🇪 اليمن (+967)' },
  { code: '+970', label: '🇵🇸 فلسطين (+970)' },
  { code: '+963', label: '🇸🇾 سوريا (+963)' },
  { code: '+1', label: '🇺🇸 أمريكا / كندا (+1)' },
  { code: '+44', label: '🇬🇧 بريطانيا (+44)' },
  { code: '+49', label: '🇩🇪 ألمانيا (+49)' },
  { code: '+90', label: '🇹🇷 تركيا (+90)' },
];

interface PhoneRegistrationScreenProps {
  wallpaperConfig: WallpaperConfig;
  currentPhone: string;
  currentName: string;
  currentUsername?: string;
  currentBio: string;
  currentAvatar?: string;
  firebaseUser: User | null;
  isAccountFullyVerified: boolean;
  registeredUsers: RegisteredDirectoryUser[];
  onCompleteRegistration: (data: {
    uid: string;
    name: string;
    phone: string;
    username: string;
    email: string;
    bio: string;
    avatar?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    stayOnScreen?: boolean;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
  onStartChatWithUser: (user: RegisteredDirectoryUser) => void;
  onBackToChats: () => void;
}

export const PhoneRegistrationScreen: React.FC<PhoneRegistrationScreenProps> = ({
  currentPhone,
  currentName,
  currentUsername,
  currentBio,
  currentAvatar,
  firebaseUser,
  isAccountFullyVerified,
  onCompleteRegistration,
  onLogout,
  onBackToChats,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'signup' | 'verify' | 'reset'>(
    firebaseUser && !isAccountFullyVerified ? 'verify' : 'login'
  );

  // Registration & Profile State
  const [fullName, setFullName] = useState(currentName || '');
  const [username, setUsername] = useState(currentUsername || '');
  const [email, setEmail] = useState(firebaseUser?.email || '');
  const [countryCode, setCountryCode] = useState('+20');
  const [phoneDigits, setPhoneDigits] = useState(
    (currentPhone || '').replace(/^\+\d+\s*/, '').replace(/\D/g, '')
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>(
    currentAvatar || defaultAvatarImg
  );

  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Password Reset State
  const [resetEmail, setResetEmail] = useState('');

  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Username Uniqueness Check State
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');

  // Verification State (Email + SMS OTP)
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(
    Boolean(firebaseUser?.emailVerified)
  );
  const [isPhoneVerified, setIsPhoneVerified] = useState<boolean>(
    Boolean(firebaseUser?.phoneNumber)
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isConfirmingOtp, setIsConfirmingOtp] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showFirebaseSetupHelp, setShowFirebaseSetupHelp] = useState(false);

  // General UI Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync Firebase Auth user state into form when user changes
  useEffect(() => {
    if (firebaseUser) {
      setIsEmailVerified(Boolean(firebaseUser.emailVerified));
      if (firebaseUser.email && !email) setEmail(firebaseUser.email);
      if (firebaseUser.displayName && !fullName) {
        setFullName(firebaseUser.displayName);
      }
      if (firebaseUser.photoURL && avatarUrl === defaultAvatarImg) {
        setAvatarUrl(firebaseUser.photoURL);
      }
      if (firebaseUser.phoneNumber) {
        setIsPhoneVerified(true);
      }
      // Load existing Firestore profile if available
      getOwnUserProfileFromFirestore(firebaseUser.uid)
        .then((prof) => {
          if (prof) {
            if (prof.displayName) setFullName(prof.displayName);
            if (prof.username) setUsername(prof.username);
            if (prof.phoneVerified) setIsPhoneVerified(true);
          }
        })
        .catch(() => {});
    } else {
      setIsEmailVerified(false);
      setIsPhoneVerified(false);
    }
  }, [firebaseUser]);

  // Password Requirements Evaluation
  const passwordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
    matchesConfirm:
      password.length > 0 &&
      confirmPassword.length > 0 &&
      password === confirmPassword,
  };

  const passedPasswordRulesCount = [
    passwordChecks.minLength,
    passwordChecks.hasUpper,
    passwordChecks.hasLower,
    passwordChecks.hasNumber,
    passwordChecks.hasSymbol,
  ].filter(Boolean).length;

  const isPasswordStrongEnough =
    passwordChecks.minLength &&
    passwordChecks.hasLower &&
    passwordChecks.hasNumber &&
    (passwordChecks.hasUpper || passwordChecks.hasSymbol);

  // Check Username Uniqueness
  const handleCheckUsername = async (rawVal: string) => {
    const clean = sanitizeUsername(rawVal);
    setUsername(clean);
    if (!clean) {
      setUsernameStatus('idle');
      return;
    }
    if (!isValidUsernameFormat(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    try {
      const res = await checkUsernameAvailability(clean, firebaseUser?.uid);
      setUsernameStatus(res.available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  };

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
      setSuccessMsg('تم اختيار صورة البروفايل بنجاح ✨');
    } catch {
      setErrorMsg('تعذر رفع الصورة، يرجى تجربة صورة أخرى.');
    }
  };

  // ========================================================================
  // 1. SIGN UP HANDLER (Real Firebase Auth + Validation + Email Verification)
  // ========================================================================
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = fullName.trim();
    if (cleanName.length < 3) {
      setErrorMsg('يرجى إدخال الاسم الكامل (3 أحرف على الأقل).');
      return;
    }

    const cleanUsername = sanitizeUsername(username);
    if (!isValidUsernameFormat(cleanUsername)) {
      setErrorMsg(
        'اسم المستخدم (Username) مطلوب ويجب أن يتكون من 3 إلى 30 حرفاً (أحرف إنجليزية صغيرة، أرقام، أو _ بدون مسافات).'
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmailFormat(cleanEmail)) {
      setErrorMsg(
        'صيغة البريد الإلكتروني غير صحيحة. يرجى إدخال بريد إلكتروني صالح (مثل name@gmail.com).'
      );
      return;
    }

    const phoneCheck = isValidPhoneE164Format(countryCode, phoneDigits);
    if (!phoneCheck.valid) {
      setErrorMsg(
        phoneCheck.reason ||
          'صيغة رقم الهاتف غير صحيحة. يرجى إدخال رقم هاتف صالح مع رمز الدولة.'
      );
      return;
    }

    if (!isPasswordStrongEnough) {
      setErrorMsg(
        'كلمة المرور لا تستوفي متطلبات الأمان (8 أحرف على الأقل، أحرف، أرقام، ويفضل حرف كبير أو رمز خاص).'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Verify username is not already taken before creating account
      const unameCheck = await checkUsernameAvailability(
        cleanUsername,
        auth.currentUser?.uid
      );
      if (!unameCheck.available) {
        setUsernameStatus('taken');
        setErrorMsg(
          `اسم المستخدم (@${cleanUsername}) مستخدم بالفعل من قبل عضو آخر. لا يُسمح بتكرار اسم المستخدم.`
        );
        setIsSubmitting(false);
        return;
      }

      // 2. Create real Firebase Authentication account & send real verification email
      const createdUser = await registerWithEmailAndPasswordCloud({
        email: cleanEmail,
        password,
        displayName: cleanName,
      });

      // 3. Double-check username in Firestore now that user is signed in
      const firestoreUnameCheck = await checkUsernameAvailability(
        cleanUsername,
        createdUser.uid
      );
      if (!firestoreUnameCheck.available) {
        await createdUser.delete().catch(() => {});
        setUsernameStatus('taken');
        setErrorMsg(
          `اسم المستخدم (@${cleanUsername}) محجوز بالفعل في قاعدة البيانات. يرجى اختيار اسم مستخدم آخر.`
        );
        setIsSubmitting(false);
        return;
      }

      // Store pending profile info in sessionStorage until email & phone verification finish
      sessionStorage.setItem(
        `sahpy_pending_profile_${createdUser.uid}`,
        JSON.stringify({
          fullName: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          phoneE164: phoneCheck.e164,
          avatarUrl,
        })
      );

      setIsEmailVerified(Boolean(createdUser.emailVerified));
      setAuthTab('verify');
      setSuccessMsg(
        `تم إنشاء الحساب في Firebase Authentication وإرسال رابط التحقق الفعلي إلى (${cleanEmail}) 📩 يرجى فتح بريدك الإلكتروني لتأكيده، وتأكيد رقم الهاتف عبر OTP لإتمام التفعيل.`
      );
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setErrorMsg(translated);
      if (translated.includes('Firebase Console')) {
        setShowFirebaseSetupHelp(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // 2. LOGIN HANDLER (Real Firebase Auth via Email OR @username + Password)
  // ========================================================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const rawId = loginIdentifier.trim();
    if (!rawId) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني أو اسم المستخدم (@username).');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetEmail = rawId.toLowerCase();

      // If user entered a @username instead of an email, safely resolve it
      if (!targetEmail.includes('@') || targetEmail.startsWith('@')) {
        const cleanUname = sanitizeUsername(rawId);
        if (!isValidUsernameFormat(cleanUname)) {
          setErrorMsg(
            'يرجى إدخال بريد إلكتروني صحيح أو اسم مستخدم صالح (@username).'
          );
          setIsSubmitting(false);
          return;
        }
        const res = await fetch(
          `/api/auth/resolve-username?username=${encodeURIComponent(cleanUname)}`
        );
        if (!res.ok) {
          throw new Error('USERNAME_NOT_FOUND');
        }
        const resolved = await res.json();
        targetEmail = String(resolved.email || '').trim().toLowerCase();
      }

      const loggedInUser = await loginWithEmailAndPasswordCloud(
        targetEmail,
        loginPassword
      );
      await loggedInUser.reload();

      const existingProfile = await getOwnUserProfileFromFirestore(
        loggedInUser.uid
      );

      if (existingProfile) {
        setFullName(existingProfile.displayName);
        setUsername(existingProfile.username);
        setEmail(existingProfile.email);
        setIsPhoneVerified(existingProfile.phoneVerified);
      }

      if (!loggedInUser.emailVerified) {
        setIsEmailVerified(false);
        setAuthTab('verify');
        setErrorMsg(
          'حسابك مسجل ولكن لم يتم تأكيد البريد الإلكتروني بعد. يرجى تأكيد بريدك الإلكتروني أولاً للدخول إلى المحادثات.'
        );
        return;
      }

      // If user has a verified email and existing profile in Firestore, complete login
      if (existingProfile && existingProfile.username) {
        await onCompleteRegistration({
          uid: loggedInUser.uid,
          name: existingProfile.displayName,
          phone: existingProfile.phoneTag,
          username: existingProfile.username,
          email: loggedInUser.email || existingProfile.email,
          bio: existingProfile.bio,
          avatar: avatarUrl,
          emailVerified: true,
          phoneVerified: Boolean(
            existingProfile.phoneVerified || loggedInUser.phoneNumber
          ),
          stayOnScreen: false,
        });
      } else {
        // Direct to verification / profile completion step
        setAuthTab('verify');
        setSuccessMsg(
          'تم تسجيل الدخول بنجاح ✅ يرجى استكمال تأكيد بيانات حسابك واسم المستخدم الفريد.'
        );
      }
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setErrorMsg(translated);
      if (translated.includes('Firebase Console')) {
        setShowFirebaseSetupHelp(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // 3. GOOGLE OAUTH POPUP HANDLER (Real Firebase Google Auth)
  // ========================================================================
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      const googleUser = await signInWithGoogleCloud();
      if (googleUser.email) setEmail(googleUser.email);
      if (googleUser.displayName) setFullName(googleUser.displayName);
      if (googleUser.photoURL) setAvatarUrl(googleUser.photoURL);
      setIsEmailVerified(Boolean(googleUser.emailVerified));

      // Check if this Google user already has a saved profile in Firestore
      const existingProfile = await getOwnUserProfileFromFirestore(
        googleUser.uid
      );
      if (existingProfile && existingProfile.username) {
        setFullName(existingProfile.displayName);
        setUsername(existingProfile.username);
        setIsPhoneVerified(existingProfile.phoneVerified);
        await onCompleteRegistration({
          uid: googleUser.uid,
          name: existingProfile.displayName,
          phone: existingProfile.phoneTag,
          username: existingProfile.username,
          email: googleUser.email || existingProfile.email,
          bio: existingProfile.bio,
          avatar: googleUser.photoURL || avatarUrl,
          emailVerified: true,
          phoneVerified: existingProfile.phoneVerified,
          stayOnScreen: false,
        });
        return;
      }

      // New Google user -> suggest unique username and open Verification & Phone step
      if (!username && googleUser.email) {
        const suggested = sanitizeUsername(googleUser.email.split('@')[0]);
        if (suggested.length >= 3) {
          setUsername(suggested);
        }
      }
      setAuthTab('verify');
      setSuccessMsg(
        `تمت المصادقة عبر Google بنجاح (${googleUser.email}) وبريدك الإلكتروني مؤكد تلقائياً ✅ يرجى اختيار اسم المستخدم الفريد وتأكيد رقم الهاتف لإكمال ملفك الشخصي في Firestore.`
      );
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // 4. EMAIL VERIFICATION & PHONE SMS OTP HANDLERS
  // ========================================================================
  const handleResendVerificationEmail = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsCheckingEmail(true);
    try {
      await sendVerificationEmailToCurrentUser();
      setSuccessMsg(
        `تم إرسال رسالة تحقق جديدة من Firebase إلى (${auth.currentUser?.email || email}) 📩 يرجى فحص صندوق الوارد أو الرسائل غير المرغوب فيها (Spam).`
      );
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleRefreshEmailVerificationStatus = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsCheckingEmail(true);
    try {
      const refreshedUser = await reloadAndCheckCurrentUser();
      if (refreshedUser?.emailVerified) {
        setIsEmailVerified(true);
        setSuccessMsg(
          'تم التحقق من تأكيد بريدك الإلكتروني بنجاح عبر Firebase Authentication ✅'
        );
      } else {
        setIsEmailVerified(false);
        setErrorMsg(
          'لم يتم تأكيد البريد الإلكتروني بعد. يرجى الضغط على الرابط المرسل إلى بريدك الإلكتروني ثم الضغط على "تحديث حالة البريد" مرة أخرى.'
        );
      }
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleSendSmsOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    const phoneCheck = isValidPhoneE164Format(countryCode, phoneDigits);
    if (!phoneCheck.valid) {
      setErrorMsg(
        phoneCheck.reason ||
          'يرجى إدخال رقم هاتف صحيح مع رمز الدولة لإرسال رسالة SMS.'
      );
      return;
    }

    setIsSendingOtp(true);
    try {
      const result = await sendPhoneOtpViaFirebase(
        phoneCheck.e164,
        'firebase-recaptcha-container'
      );
      setConfirmationResult(result);
      setOtpSent(true);
      setSuccessMsg(
        `تم إرسال رمز التحقق (OTP) عبر SMS إلى الرقم ${phoneCheck.e164} بنجاح 📲 يرجى إدخال الرمز المكون من 6 أرقام.`
      );
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setErrorMsg(translated);
      if (
        translated.includes('Firebase Console') ||
        translated.includes('Blaze') ||
        translated.includes('reCAPTCHA')
      ) {
        setShowFirebaseSetupHelp(true);
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifySmsOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!confirmationResult) {
      setErrorMsg('يرجى الضغط على "إرسال رمز OTP عبر SMS" أولاً.');
      return;
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setErrorMsg('يرجى إدخال رمز التحقق المكون من 6 أرقام بشكل صحيح.');
      return;
    }

    setIsConfirmingOtp(true);
    try {
      await confirmPhoneOtpViaFirebase(confirmationResult, otpCode.trim());
      setIsPhoneVerified(true);
      setOtpSent(false);
      setOtpCode('');
      setSuccessMsg(
        'تم تأكيد رقم الهاتف فعلياً عبر Firebase Phone Authentication ✅'
      );
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setIsConfirmingOtp(false);
    }
  };

  // ========================================================================
  // 5. FINALIZE VERIFIED PROFILE & SAVE TO FIRESTORE
  // ========================================================================
  const handleFinalizeVerifiedAccount = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    const refreshed = await reloadAndCheckCurrentUser();
    const activeUser = refreshed || auth.currentUser;

    if (!activeUser) {
      setErrorMsg('يرجى تسجيل الدخول أو إنشاء حساب أولاً.');
      setAuthTab('login');
      return;
    }

    if (!activeUser.emailVerified) {
      setIsEmailVerified(false);
      setErrorMsg(
        'لا يمكن إكمال تفعيل الحساب أو الدخول للمحادثات قبل تأكيد البريد الإلكتروني عبر الرابط المرسل إلى بريدك.'
      );
      return;
    }

    const cleanName = fullName.trim() || activeUser.displayName || '';
    if (cleanName.length < 3) {
      setErrorMsg('يرجى إدخال الاسم الكامل (3 أحرف على الأقل).');
      return;
    }

    const cleanUsername = sanitizeUsername(username);
    if (!isValidUsernameFormat(cleanUsername)) {
      setErrorMsg(
        'يرجى إدخال اسم مستخدم فريد صالح (من 3 إلى 30 حرفاً، أحرف إنجليزية صغيرة وأرقام و _ فقط).'
      );
      return;
    }

    const phoneCheck = isValidPhoneE164Format(countryCode, phoneDigits);
    const finalPhoneE164 = activeUser.phoneNumber || phoneCheck.e164;
    if (!activeUser.phoneNumber && !phoneCheck.valid) {
      setErrorMsg(
        phoneCheck.reason || 'يرجى إدخال رقم هاتف صحيح مع رمز الدولة.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Atomically reserve unique username and save UserProfile & PublicDirectoryProfile in Firestore
      const savedProfile = await reserveUsernameAndSaveProfileToFirestore({
        user: activeUser,
        displayName: cleanName,
        username: cleanUsername,
        email: activeUser.email || email.trim().toLowerCase(),
        phoneTag: finalPhoneE164,
        bio:
          currentBio ||
          `حساب موثق على SAHPY-CHAT • @${cleanUsername} ✨`,
        wallpaperTheme: 'aurora-borealis',
        phoneVerified: Boolean(isPhoneVerified || activeUser.phoneNumber),
      });

      await onCompleteRegistration({
        uid: activeUser.uid,
        name: savedProfile.displayName,
        phone: savedProfile.phoneTag,
        username: savedProfile.username,
        email: savedProfile.email,
        bio: savedProfile.bio,
        avatar: avatarUrl,
        emailVerified: savedProfile.emailVerified,
        phoneVerified: savedProfile.phoneVerified,
        stayOnScreen: false,
      });
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // 6. PASSWORD RESET HANDLER
  // ========================================================================
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanResetEmail = resetEmail.trim().toLowerCase();
    if (!isValidEmailFormat(cleanResetEmail)) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح لإرسال رابط استعادة كلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetEmailCloud(cleanResetEmail);
      setSuccessMsg(
        `تم إرسال رابط استعادة كلمة المرور عبر Firebase Authentication إلى (${cleanResetEmail}) بنجاح 📩 يرجى مراجعة بريدك الإلكتروني.`
      );
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
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
      {/* Left Column (Hero & Background Video - Sticky on Desktop) */}
      <div className="hidden lg:flex w-[44%] xl:w-[48%] shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] relative flex-col items-center justify-between py-6 px-8 xl:px-12 rounded-3xl overflow-hidden shadow-2xl">
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
              SAHPY-CHAT • Firebase Security
            </p>
            <p className="text-sm sm:text-base font-bold text-white tracking-wide mt-0.5">
              𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
            </p>
          </div>

          {isAccountFullyVerified && (
            <button
              type="button"
              onClick={onBackToChats}
              className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xl cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>العودة للمحادثات</span>
            </button>
          )}
        </div>

        {/* Hero Content Container */}
        <motion.div
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-full max-w-xs space-y-4 text-center my-auto py-2"
        >
          <motion.div
            variants={heroChildVariants}
            className="flex items-center justify-center gap-2.5"
          >
            <Circle className="w-6 h-6 fill-white text-white" />
            <span className="text-xl font-semibold tracking-tight">
              SAHPY-CHAT
            </span>
          </motion.div>

          <motion.div variants={heroChildVariants} className="space-y-1.5">
            <h1 className="text-3xl xl:text-4xl font-medium tracking-tight whitespace-nowrap">
              Join SAHPY-CHAT
            </h1>
            <p className="text-white/70 text-xs sm:text-sm leading-relaxed px-2">
              Real Firebase Authentication & Zero-Trust Firestore Security.
            </p>
            <p className="text-xs font-bold text-white bg-black/60 backdrop-blur-md py-1.5 px-3 rounded-lg inline-block border border-white/15">
              𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
            </p>
          </motion.div>

          <motion.div
            variants={heroChildVariants}
            className="space-y-2 text-left"
          >
            <StepItem
              number="1"
              text="Register your identity & @username"
              active={authTab === 'signup' || authTab === 'login'}
            />
            <StepItem
              number="2"
              text="Verify Email & Phone OTP (SMS)"
              active={authTab === 'verify'}
            />
            <StepItem
              number="3"
              text="Start Verified Firestore Chats"
              active={isAccountFullyVerified}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Right Column (Auth & Verification Forms) */}
      <div className="flex-1 flex flex-col items-center justify-start px-3 sm:px-6 lg:px-8 xl:px-10 py-3 lg:py-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-xl mx-auto space-y-4 pb-20"
        >
          {/* Top Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <Circle className="w-5 h-5 fill-white text-white" />
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-emerald-400 block">
                  SAHPY-CHAT • Real Firebase Auth
                </span>
                <p className="text-base sm:text-lg font-bold text-white tracking-wide">
                  𝔼𝕟𝕘𝕚𝕟𝕖𝕖𝕣 𝕊𝔸𝕃𝔸ℍ 𝔾𝕆𝕄𝔸𝔸
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {firebaseUser && (
                <button
                  type="button"
                  onClick={async () => {
                    await signOutFromCloud();
                    await onLogout();
                    setAuthTab('login');
                    setSuccessMsg('تم تسجيل الخروج بنجاح من Firebase Authentication.');
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل الخروج</span>
                </button>
              )}

              {isAccountFullyVerified && (
                <button
                  type="button"
                  onClick={onBackToChats}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>فتح المحادثات</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div
            dir="rtl"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-brand-gray border border-white/10"
          >
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authTab === 'login'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthTab('signup');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authTab === 'signup'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>إنشاء حساب</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthTab('verify');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authTab === 'verify'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>التحقق (البريد/OTP)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthTab('reset');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authTab === 'reset'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>استعادة المرور</span>
            </button>
          </div>

          {/* Alerts (Arabic Error & Success Messages) */}
          {errorMsg && (
            <div
              dir="rtl"
              className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 font-medium flex items-start gap-2.5 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div
              dir="rtl"
              className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 font-medium flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 1: LOGIN (تسجيل الدخول الحقيقي عبر Firebase Auth)           */}
          {/* ============================================================== */}
          {authTab === 'login' && (
            <div dir="rtl" className="space-y-4">
              <div className="p-5 rounded-3xl bg-brand-gray/90 border border-white/15 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      تسجيل الدخول إلى حسابك
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      سجّل الدخول باستخدام البريد الإلكتروني أو اسم المستخدم الفريد (@username) وكلمة المرور
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
                    Firebase Auth محمي
                  </span>
                </div>

                {/* Google Quick Sign-In */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleGoogleSignIn}
                  className="w-full h-12 rounded-xl bg-black hover:bg-white/10 border border-white/15 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Chrome className="w-4 h-4 text-emerald-400" />
                  <span>المتابعة بحساب Google (مصادقة فورية وموثقة)</span>
                </button>

                <div className="relative flex items-center justify-center py-1">
                  <div className="w-full border-t border-white/10" />
                  <span className="absolute bg-brand-gray px-3 text-[11px] text-white/40">
                    أو بالبريد الإلكتروني / اسم المستخدم
                  </span>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-white/80 mb-1.5">
                      البريد الإلكتروني أو اسم المستخدم (@username) *
                    </label>
                    <div className="relative">
                      <input
                        dir="ltr"
                        type="text"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="example@gmail.com أو @username"
                        className="w-full bg-black border border-white/15 rounded-xl h-11 px-4 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-sm font-mono"
                      />
                      <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-white/80">
                        كلمة المرور *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(
                            loginIdentifier.includes('@') &&
                              !loginIdentifier.startsWith('@')
                              ? loginIdentifier
                              : email
                          );
                          setAuthTab('reset');
                          setErrorMsg('');
                        }}
                        className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        dir="ltr"
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-black border border-white/15 rounded-xl h-11 px-4 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                        title={showLoginPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-white hover:bg-white/90 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      {isSubmitting ? 'جاري التحقق والدخول...' : 'تسجيل الدخول الآن'}
                    </span>
                  </button>
                </form>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                  <span>ليس لديك حساب في SAHPY-CHAT؟</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('signup');
                      setErrorMsg('');
                    }}
                    className="text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    إنشاء حساب جديد ←
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 2: SIGN UP (إنشاء حساب جديد بجميع الحقول والتحقق الصارم)    */}
          {/* ============================================================== */}
          {authTab === 'signup' && (
            <div dir="rtl" className="space-y-4">
              {/* Profile Avatar Upload Card */}
              <div className="p-3.5 rounded-2xl bg-brand-gray border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <div
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="relative w-15 h-15 rounded-2xl overflow-hidden border-2 border-emerald-400 shrink-0 cursor-pointer group"
                  >
                    <img
                      src={avatarUrl}
                      alt="صورة البروفايل"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white">
                      صورة الملف الشخصي (اختياري)
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {PRESET_AVATARS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatarUrl(preset)}
                          className={`w-6 h-6 rounded-lg overflow-hidden border cursor-pointer ${
                            avatarUrl === preset
                              ? 'border-emerald-400 scale-110'
                              : 'border-white/15 opacity-60'
                          }`}
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

                <div>
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
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة</span>
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleSignUpSubmit}
                className="p-5 rounded-3xl bg-brand-gray/90 border border-white/15 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      إنشاء حساب جديد • Create Account
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      جميع الحقول مطلوبة ويتم التحقق من عدم تكرار اسم المستخدم والبريد الإلكتروني
                    </p>
                  </div>
                </div>

                {/* 1. Full Name & 2. Unique Username */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-white/85 mb-1.5">
                      1. الاسم الكامل *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="مثال: صلاح جمعة"
                      className="w-full bg-black border border-white/15 rounded-xl h-11 px-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-white/85">
                        2. اسم المستخدم الفريد (Username) *
                      </label>
                      {usernameStatus === 'checking' && (
                        <span className="text-[10px] text-amber-300">
                          جاري الفحص...
                        </span>
                      )}
                      {usernameStatus === 'available' && (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> متاح وفريد
                        </span>
                      )}
                      {usernameStatus === 'taken' && (
                        <span className="text-[10px] text-rose-400 font-bold flex items-center gap-0.5">
                          <X className="w-3 h-3" /> مستخدم بالفعل
                        </span>
                      )}
                      {usernameStatus === 'invalid' && (
                        <span className="text-[10px] text-amber-400">
                          3-30 حرفاً إنجليزياً/رقماً
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        dir="ltr"
                        type="text"
                        required
                        value={username}
                        onChange={(e) => handleCheckUsername(e.target.value)}
                        placeholder="salah_gomaa"
                        className={`w-full bg-black border rounded-xl h-11 pl-8 pr-3.5 text-white placeholder:text-white/30 focus:outline-none text-xs sm:text-sm font-mono ${
                          usernameStatus === 'taken'
                            ? 'border-rose-500'
                            : usernameStatus === 'available'
                            ? 'border-emerald-500'
                            : 'border-white/15 focus:border-emerald-400'
                        }`}
                      />
                      <AtSign className="w-4 h-4 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                {/* 3. Email Address */}
                <div>
                  <label className="block text-xs font-bold text-white/85 mb-1.5">
                    3. البريد الإلكتروني (Gmail أو أي بريد صالح) *
                  </label>
                  <div className="relative">
                    <input
                      dir="ltr"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full bg-black border border-white/15 rounded-xl h-11 px-4 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-xs sm:text-sm font-mono"
                    />
                    <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* 4. Phone Number with Country Code */}
                <div>
                  <label className="block text-xs font-bold text-white/85 mb-1.5">
                    4. رقم الهاتف مع رمز الدولة (لإرسال رمز التحقق SMS OTP) *
                  </label>
                  <div className="flex items-center gap-2" dir="ltr">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-black border border-white/15 rounded-xl h-11 px-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 shrink-0"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-slate-900">
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      dir="ltr"
                      type="tel"
                      required
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value)}
                      placeholder="1098765432"
                      className="flex-1 bg-black border border-white/15 rounded-xl h-11 px-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-xs sm:text-sm font-mono"
                    />
                  </div>
                </div>

                {/* 5. Password & 6. Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-white/85 mb-1.5">
                      5. كلمة المرور *
                    </label>
                    <div className="relative">
                      <input
                        dir="ltr"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-black border border-white/15 rounded-xl h-11 px-3.5 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-xs sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/85 mb-1.5">
                      6. تأكيد كلمة المرور *
                    </label>
                    <div className="relative">
                      <input
                        dir="ltr"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-black border border-white/15 rounded-xl h-11 px-3.5 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-xs sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clear Password Requirements & Strength Indicator */}
                <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white/80">
                      مؤشر متطلبات كلمة المرور:
                    </span>
                    <span
                      className={`font-bold ${
                        passedPasswordRulesCount >= 4
                          ? 'text-emerald-400'
                          : passedPasswordRulesCount >= 2
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {passedPasswordRulesCount}/5 شروط محققة
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 h-1.5">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={`rounded-full transition-all ${
                          idx <= passedPasswordRulesCount
                            ? passedPasswordRulesCount >= 4
                              ? 'bg-emerald-400'
                              : 'bg-amber-400'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    <RequirementRow
                      met={passwordChecks.minLength}
                      label="8 أحرف على الأقل"
                    />
                    <RequirementRow
                      met={passwordChecks.hasUpper}
                      label="حرف إنجليزي كبير (A-Z)"
                    />
                    <RequirementRow
                      met={passwordChecks.hasLower}
                      label="حرف إنجليزي صغير (a-z)"
                    />
                    <RequirementRow
                      met={passwordChecks.hasNumber}
                      label="رقم واحد على الأقل (0-9)"
                    />
                    <RequirementRow
                      met={passwordChecks.hasSymbol}
                      label="رمز خاص (!@#$%^&*)"
                    />
                    <RequirementRow
                      met={passwordChecks.matchesConfirm}
                      label="تطابق كلمة المرور وتأكيدها"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || usernameStatus === 'taken'}
                  className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'جاري إنشاء الحساب وإرسال رابط التحقق...'
                      : 'إنشاء الحساب وإرسال رمز التحقق'}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 3: VERIFICATION CENTER (تأكيد البريد الإلكتروني + SMS OTP)   */}
          {/* ============================================================== */}
          {authTab === 'verify' && (
            <div dir="rtl" className="space-y-4">
              <div className="p-5 rounded-3xl bg-brand-gray/90 border border-white/15 space-y-5 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-white/10">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span>مركز التحقق الإلزامي وتفعيل الحساب</span>
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      لا يُعتبر الحساب مكتمل التحقق قبل تأكيد البريد الإلكتروني وحفظ المعرّف الفريد في Firestore
                    </p>
                  </div>
                  {firebaseUser && (
                    <span
                      dir="ltr"
                      className="px-2.5 py-1 rounded-lg bg-black border border-white/15 text-[10px] font-mono text-cyan-300"
                      title="Firebase Authentication UID الحقيقي"
                    >
                      UID: {firebaseUser.uid.slice(0, 12)}...
                    </span>
                  )}
                </div>

                {!firebaseUser ? (
                  <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-center space-y-3">
                    <p className="text-xs text-white/70">
                      يرجى إنشاء حساب جديد أو تسجيل الدخول أولاً للوصول إلى خطوات التحقق.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAuthTab('signup')}
                        className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        إنشاء حساب جديد
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthTab('login')}
                        className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold text-xs cursor-pointer"
                      >
                        تسجيل الدخول
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Step A: Email Verification */}
                    <div className="p-4 rounded-2xl bg-black/70 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs sm:text-sm font-bold text-white">
                            أولاً: تأكيد البريد الإلكتروني ({firebaseUser.email})
                          </span>
                        </div>
                        {isEmailVerified ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            البريد مؤكد ✅
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                            بانتظار التأكيد ⏳
                          </span>
                        )}
                      </div>

                      {!isEmailVerified && (
                        <>
                          <p className="text-xs text-white/60 leading-relaxed">
                            قمنا بإرسال رسالة تحقق حقيقية من Firebase إلى بريدك الإلكتروني. افتح الرسالة واضغط على رابط التفعيل، ثم اضغط الزر أدناه لتحديث حالة التحقق:
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isCheckingEmail}
                              onClick={handleRefreshEmailVerificationStatus}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  isCheckingEmail ? 'animate-spin' : ''
                                }`}
                              />
                              <span>لقد أكدت البريد — تحديث الحالة الآن</span>
                            </button>

                            <button
                              type="button"
                              disabled={isCheckingEmail}
                              onClick={handleResendVerificationEmail}
                              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                            >
                              إعادة إرسال رابط التحقق
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Step B: Phone OTP Verification via Firebase Phone Auth SMS */}
                    <div className="p-4 rounded-2xl bg-black/70 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs sm:text-sm font-bold text-white">
                            ثانياً: تأكيد رقم الهاتف عبر SMS OTP (Firebase Phone Auth)
                          </span>
                        </div>
                        {isPhoneVerified ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            الهاتف مؤكد بـ OTP ✅
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
                            تحقق عبر رسالة SMS
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2" dir="ltr">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="bg-brand-gray border border-white/15 rounded-xl h-10 px-2 text-white text-xs font-mono"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option
                              key={c.code}
                              value={c.code}
                              className="bg-slate-900"
                            >
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <input
                          dir="ltr"
                          type="tel"
                          value={phoneDigits}
                          onChange={(e) => setPhoneDigits(e.target.value)}
                          placeholder="1098765432"
                          className="flex-1 bg-brand-gray border border-white/15 rounded-xl h-10 px-3 text-white text-xs font-mono"
                        />
                        <button
                          type="button"
                          disabled={isSendingOtp}
                          onClick={handleSendSmsOtp}
                          className="px-3.5 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isSendingOtp
                            ? 'جاري الإرسال...'
                            : otpSent
                            ? 'إعادة إرسال SMS'
                            : 'إرسال رمز OTP'}
                        </button>
                      </div>

                      {/* Real Firebase Recaptcha Container */}
                      <div
                        id="firebase-recaptcha-container"
                        className="flex justify-center overflow-x-auto py-1"
                      />

                      {otpSent && (
                        <div className="pt-2 space-y-2.5 border-t border-white/10">
                          <label className="block text-xs text-emerald-300 font-bold">
                            أدخل رمز التحقق المكون من 6 أرقام المرسل عبر SMS:
                          </label>
                          <div className="flex items-center gap-2" dir="ltr">
                            <input
                              type="text"
                              maxLength={6}
                              value={otpCode}
                              onChange={(e) =>
                                setOtpCode(e.target.value.replace(/\D/g, ''))
                              }
                              placeholder="123456"
                              className="flex-1 bg-black border border-emerald-500/50 rounded-xl h-11 px-4 text-center text-base font-bold tracking-[0.4em] text-white font-mono focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={isConfirmingOtp}
                              onClick={handleVerifySmsOtp}
                              className="px-5 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                            >
                              {isConfirmingOtp ? 'جاري التأكيد...' : 'تأكيد الرمز'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step C: Confirm Full Name & Unique @username in Firestore */}
                    <div className="p-4 rounded-2xl bg-black/70 border border-white/10 space-y-3">
                      <span className="text-xs sm:text-sm font-bold text-white block">
                        ثالثاً: تثبيت الاسم واسم المستخدم الفريد (@username) في Firestore
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-white/60 mb-1">
                            الاسم الكامل
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="الاسم الكامل"
                            className="w-full bg-brand-gray border border-white/15 rounded-xl h-10 px-3 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-white/60 mb-1">
                            اسم المستخدم الفريد (@username)
                          </label>
                          <input
                            dir="ltr"
                            type="text"
                            value={username}
                            onChange={(e) => handleCheckUsername(e.target.value)}
                            placeholder="salah_gomaa"
                            className="w-full bg-brand-gray border border-white/15 rounded-xl h-10 px-3 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting || !isEmailVerified}
                      onClick={handleFinalizeVerifiedAccount}
                      className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-emerald-500/20"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? 'جاري الحفظ في Firestore...'
                          : 'إكمال التحقق والدخول إلى SAHPY-CHAT'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 4: PASSWORD RESET (استعادة كلمة المرور عبر البريد الإلكتروني) */}
          {/* ============================================================== */}
          {authTab === 'reset' && (
            <div dir="rtl" className="space-y-4">
              <form
                onSubmit={handlePasswordResetSubmit}
                className="p-5 rounded-3xl bg-brand-gray/90 border border-white/15 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      استعادة كلمة المرور عبر البريد الإلكتروني
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      أدخل بريدك الإلكتروني المسجل وسيرسل لك Firebase رابطاً آمناً لإعادة تعيين كلمة المرور
                    </p>
                  </div>
                  <KeyRound className="w-6 h-6 text-emerald-400" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1.5">
                    البريد الإلكتروني المسجل *
                  </label>
                  <input
                    dir="ltr"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full bg-black border border-white/15 rounded-xl h-11 px-4 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 text-sm font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'جاري إرسال الرابط...'
                      : 'إرسال رابط إعادة تعيين كلمة المرور'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className="w-full py-2 text-xs text-white/60 hover:text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>العودة لتسجيل الدخول</span>
                </button>
              </form>
            </div>
          )}

          {/* Manual Firebase Console Setup Guide Toggle */}
          <div
            dir="rtl"
            className="p-3.5 rounded-2xl bg-brand-gray/60 border border-white/10 space-y-2 text-xs"
          >
            <button
              type="button"
              onClick={() => setShowFirebaseSetupHelp((prev) => !prev)}
              className="w-full flex items-center justify-between text-emerald-300 font-bold cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>
                  إعدادات Firebase Console المطلوب تفعيلها يدوياً (للبريد ورسائل SMS OTP)
                </span>
              </span>
              <span>{showFirebaseSetupHelp ? 'إخفاء ▲' : 'عرض التفاصيل ▼'}</span>
            </button>

            {showFirebaseSetupHelp && (
              <div className="pt-2 border-t border-white/10 text-white/75 space-y-1.5 leading-relaxed text-[11px]">
                <p>
                  1. <strong>تفعيل البريد وكلمة المرور (Email/Password):</strong> من{' '}
                  <span dir="ltr" className="text-cyan-300 font-mono">
                    Firebase Console &gt; Authentication &gt; Sign-in method
                  </span>{' '}
                  فعّل مزود <strong>Email/Password</strong>.
                </p>
                <p>
                  2. <strong>تفعيل رسائل الهاتف (Phone Auth SMS OTP):</strong> من نفس القائمة فعّل مزود{' '}
                  <strong>Phone</strong>. لإرسال SMS حقيقي للهواتف يتطلب Firebase تفعيل خطة الفوترة (Blaze) أو إضافة أرقام تجربة مجانية داخل{' '}
                  <span dir="ltr" className="text-cyan-300 font-mono">
                    Phone numbers for testing
                  </span>
                  .
                </p>
                <p>
                  3. <strong>النطاقات المصرح بها (Authorized Domains):</strong> تأكد من إضافة نطاق موقعك (مثل رابط Vercel أو Cloud Run) داخل{' '}
                  <span dir="ltr" className="text-cyan-300 font-mono">
                    Authentication &gt; Settings &gt; Authorized domains
                  </span>
                  .
                </p>
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          <div
            dir="rtl"
            className="p-3 rounded-2xl bg-brand-gray/60 border border-white/10 flex items-center gap-2.5 text-xs text-white/60"
          >
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              أمان كامل عبر Firebase Auth & Firestore: لا يتم تخزين كلمات المرور أو رموز التحقق في قاعدة البيانات، ولا يمكن بدء محادثة إلا مع مستخدم مسجل وموثق فعلياً عبر UID أو <span dir="ltr" className="text-emerald-400 font-mono">@username</span>.
            </span>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

function RequirementRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        met ? 'text-emerald-400 font-medium' : 'text-white/40'
      }`}
    >
      {met ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="w-3.5 h-3.5 shrink-0 text-white/25" />
      )}
      <span>{label}</span>
    </div>
  );
}

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

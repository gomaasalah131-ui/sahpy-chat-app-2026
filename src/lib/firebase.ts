import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  applyActionCode,
  updateProfile,
  updateEmail,
  verifyBeforeUpdateEmail,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Contact, Message, WallpaperThemeId } from '../types/chat';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure official Firebase Authentication local session persistence across refreshes & browser restarts
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Fallback silently if storage is restricted in iframe environment
  });
}

const LEGACY_SHARED_DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240&auto=format&fit=crop&q=80';

/**
 * Generates a unique, account-specific SVG avatar data URI bound to a user's UID or name
 * so different users never share a hardcoded stock photo of another person.
 */
export function buildAccountBoundSvgAvatar(seed: string, label?: string): string {
  const cleanSeed = String(seed || 'user').trim() || 'user';
  let hash = 0;
  for (let i = 0; i < cleanSeed.length; i++) {
    hash = (hash * 31 + cleanSeed.charCodeAt(i)) >>> 0;
  }
  const palettes = [
    ['#059669', '#0d9488'],
    ['#4f46e5', '#7c3aed'],
    ['#0284c7', '#2563eb'],
    ['#db2777', '#e11d48'],
    ['#d97706', '#ea580c'],
    ['#7c3aed', '#c026d3'],
  ];
  const [c1, c2] = palettes[hash % palettes.length];
  const rawInitial = String(label || cleanSeed)
    .replace(/^@+/, '')
    .trim()
    .charAt(0)
    .toUpperCase() || 'S';
  const safeInitial = rawInitial.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="700" font-size="52">${safeInitial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function normalizeUserAvatarUrl(
  rawAvatar?: string | null,
  seedUidOrId?: string,
  displayName?: string
): string {
  const trimmed = String(rawAvatar || '').trim();
  if (!trimmed || trimmed === LEGACY_SHARED_DEFAULT_AVATAR) {
    return buildAccountBoundSvgAvatar(seedUidOrId || displayName || 'sahpy', displayName);
  }
  return trimmed;
}

export { onAuthStateChanged };
export type { User };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot as required by firebase-integration-rpc
export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testFirestoreConnection();

export function sanitizeDocId(rawId: string): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  return cleaned || 'item_1';
}

export function sanitizeUsername(rawUsername: string): string {
  const cleaned = String(rawUsername || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return cleaned;
}

export const UNSET_PHONE_TAG = '+0000000';

export function isUnsetPhoneTag(rawPhone?: string | null): boolean {
  const cleaned = String(rawPhone || '').trim();
  return (
    !cleaned ||
    cleaned === UNSET_PHONE_TAG ||
    cleaned === '+201000000000' ||
    cleaned === '0000000' ||
    cleaned === 'none'
  );
}

export function formatDisplayPhone(rawPhone?: string | null): string {
  if (isUnsetPhoneTag(rawPhone)) return '';
  return String(rawPhone || '').trim();
}

export function toAsciiDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function sanitizePhoneTag(rawPhone?: string | null): string {
  if (isUnsetPhoneTag(rawPhone)) return UNSET_PHONE_TAG;
  const ascii = toAsciiDigits(String(rawPhone || '').trim());
  const normalized = normalizePhoneToE164(ascii, '+20');
  if (normalized.valid && normalized.e164) {
    return normalized.e164.slice(0, 20);
  }
  const digits = ascii.replace(/[^0-9+]/g, '').slice(0, 20);
  return digits.length >= 7 ? digits : UNSET_PHONE_TAG;
}

export function isValidEmailFormat(email: string): boolean {
  const trimmed = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) || trimmed.length > 120) {
    return false;
  }
  const domain = trimmed.split('@')[1] || '';
  const typoDomains = new Set([
    'gmai.com',
    'gmial.com',
    'gamil.com',
    'gmail.co',
    'yaho.com',
    'hotmial.com',
    'outlok.com',
  ]);
  if (typoDomains.has(domain)) {
    return false;
  }
  return true;
}

export function validateEmailWithArabicReason(email: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, reason: 'يرجى إدخال البريد الإلكتروني.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) || trimmed.length > 120) {
    return {
      valid: false,
      reason:
        'صيغة البريد الإلكتروني غير صحيحة. يرجى كتابة بريد إلكتروني صالح (مثل example@gmail.com).',
    };
  }
  const domain = trimmed.split('@')[1] || '';
  const typoSuggestions: Record<string, string> = {
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
  };
  if (typoSuggestions[domain]) {
    return {
      valid: false,
      reason: `يبدو أن هناك خطأ إملائياً في نطاق البريد (${domain}). هل تقصد @${typoSuggestions[domain]}؟`,
    };
  }
  return { valid: true };
}

export function cacheUsernameEmailMapping(username: string, email: string): void {
  try {
    const cleanUser = sanitizeUsername(username);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanUser && isValidEmailFormat(cleanEmail)) {
      localStorage.setItem(`sahpy_uname_email_${cleanUser}`, cleanEmail);
    }
  } catch {
    // ignore storage errors
  }
}

export function getCachedEmailForUsername(username: string): string | null {
  try {
    const cleanUser = sanitizeUsername(username);
    if (!cleanUser) return null;
    return localStorage.getItem(`sahpy_uname_email_${cleanUser}`);
  } catch {
    return null;
  }
}

export function isValidUsernameFormat(username: string): boolean {
  const clean = String(username || '').trim().replace(/^@+/, '');
  return /^[a-z0-9_]{3,30}$/.test(clean);
}

const KNOWN_COUNTRY_CODES = [
  '20',
  '966',
  '971',
  '965',
  '974',
  '973',
  '968',
  '962',
  '961',
  '964',
  '212',
  '213',
  '216',
  '218',
  '249',
  '967',
  '970',
  '963',
  '90',
  '49',
  '44',
  '1',
];

/**
 * Unifies and normalizes a phone number with country code into canonical E.164 format (+[country][subscriber]).
 * Handles:
 * - Optional empty input (valid when optional=true)
 * - Arabic/Persian digits
 * - International '00' prefix (e.g. 002010... -> +2010...)
 * - Leading '+' with trunk zero (e.g. +20010... -> +2010...)
 * - Local number with selected country code (e.g. countryCode='+20', localDigits='01098765432' -> '+201098765432')
 */
export function normalizePhoneToE164(
  rawInput: string,
  defaultCountryCode = '+20',
  options?: { allowEmpty?: boolean; optional?: boolean }
): {
  valid: boolean;
  isEmpty: boolean;
  e164: string;
  reason?: string;
} {
  const asciiInput = toAsciiDigits(String(rawInput || '').trim());
  const stripped = asciiInput.replace(/[\s\-().]/g, '');

  if (!stripped) {
    if (options?.allowEmpty || options?.optional) {
      return { valid: true, isEmpty: true, e164: '' };
    }
    return {
      valid: false,
      isEmpty: true,
      e164: '',
      reason: 'يرجى إدخال رقم الهاتف.',
    };
  }

  const cleanDefaultCode =
    toAsciiDigits(String(defaultCountryCode || '+20')).replace(/\D/g, '') || '20';

  let candidateDigits = '';

  if (stripped.startsWith('+')) {
    candidateDigits = stripped.slice(1).replace(/\D/g, '');
  } else if (stripped.startsWith('00')) {
    candidateDigits = stripped.slice(2).replace(/\D/g, '');
  } else {
    const onlyDigits = stripped.replace(/\D/g, '');
    // Check if the user already typed the country code at the start of a long number
    const matchedCode = KNOWN_COUNTRY_CODES.find(
      (cc) =>
        onlyDigits.startsWith(cc) &&
        onlyDigits.length - cc.length >= 8 &&
        !onlyDigits.startsWith('0')
    );
    if (matchedCode) {
      candidateDigits = onlyDigits;
    } else {
      const localNoZero = onlyDigits.replace(/^0+/, '');
      candidateDigits = `${cleanDefaultCode}${localNoZero}`;
    }
  }

  // Strip accidental trunk '0' right after known country code (e.g. +2001012345678 -> +201012345678)
  for (const cc of KNOWN_COUNTRY_CODES) {
    if (
      candidateDigits.startsWith(`${cc}0`) &&
      candidateDigits.length - cc.length - 1 >= 7
    ) {
      candidateDigits = `${cc}${candidateDigits.slice(cc.length + 1).replace(/^0+/, '')}`;
      break;
    }
  }

  const e164 = `+${candidateDigits}`;
  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    return {
      valid: false,
      isEmpty: false,
      e164,
      reason:
        'يرجى إدخال رقم هاتف صحيح مع رمز الدولة (من 7 إلى 15 رقماً، أو اتركه فارغاً لأنه اختياري).',
    };
  }

  return { valid: true, isEmpty: false, e164 };
}

export function isValidPhoneE164Format(
  countryCode: string,
  localDigits: string,
  options?: { allowEmpty?: boolean; optional?: boolean }
): {
  valid: boolean;
  isEmpty?: boolean;
  e164: string;
  reason?: string;
} {
  return normalizePhoneToE164(localDigits, countryCode, options);
}

/**
 * Splits a full E.164 or raw phone string into { countryCode, localDigits } for editing in profile forms.
 */
export function splitPhoneIntoCountryAndLocal(
  rawPhone?: string | null,
  fallbackCountryCode = '+20'
): {
  countryCode: string;
  localDigits: string;
} {
  if (isUnsetPhoneTag(rawPhone)) {
    return { countryCode: fallbackCountryCode, localDigits: '' };
  }
  const ascii = toAsciiDigits(String(rawPhone || '').trim()).replace(/[\s\-().]/g, '');
  if (!ascii) {
    return { countryCode: fallbackCountryCode, localDigits: '' };
  }
  const withoutPlus = ascii.startsWith('+')
    ? ascii.slice(1)
    : ascii.startsWith('00')
    ? ascii.slice(2)
    : ascii;

  // Sort known country codes by length descending so 3-digit codes match before 1-digit codes
  const sortedCodes = [...KNOWN_COUNTRY_CODES].sort((a, b) => b.length - a.length);
  for (const cc of sortedCodes) {
    if (withoutPlus.startsWith(cc) && withoutPlus.length > cc.length) {
      return {
        countryCode: `+${cc}`,
        localDigits: withoutPlus.slice(cc.length),
      };
    }
  }

  return {
    countryCode: fallbackCountryCode,
    localDigits: withoutPlus.replace(/^0+/, ''),
  };
}

/**
 * Generates normalized E.164 lookup candidates from a raw phone search query
 * so users can find contacts whether they search with '+2010...', '002010...', '2010...', or '010...'.
 */
export function buildNormalizedPhoneSearchCandidates(
  rawQuery: string,
  preferredCountryCode = '+20'
): string[] {
  const ascii = toAsciiDigits(String(rawQuery || '').trim());
  if (/[a-zA-Z\u0600-\u06FF]/.test(ascii)) {
    return [];
  }
  const digitsOnly = ascii.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 18) {
    return [];
  }

  const candidates = new Set<string>();
  const cleanPrefCode = preferredCountryCode.replace(/\D/g, '') || '20';

  // 1. Primary candidate normalized with preferred country code (handles '010...', '+2010...', '002010...')
  const primary = normalizePhoneToE164(ascii, `+${cleanPrefCode}`);
  if (primary.valid && primary.e164) {
    candidates.add(primary.e164);
  }

  // 2. If user explicitly entered international prefix ('+' or '00')
  if (ascii.startsWith('+') || ascii.startsWith('00')) {
    const directIntl = normalizePhoneToE164(ascii, `+${cleanPrefCode}`);
    if (directIntl.valid && directIntl.e164) {
      candidates.add(directIntl.e164);
    }
  }

  // 3. If entered without '+' but starting with country code (e.g. '201012345678')
  if (digitsOnly.startsWith(cleanPrefCode) && digitsOnly.length >= cleanPrefCode.length + 7) {
    candidates.add(`+${digitsOnly}`);
  }

  // 4. If entered local number starting with 0 (e.g. '01012345678'), format with preferred country code
  if (digitsOnly.startsWith('0')) {
    const withoutZero = digitsOnly.replace(/^0+/, '');
    if (withoutZero.length >= 7) {
      candidates.add(`+${cleanPrefCode}${withoutZero}`);
    }
  }

  return Array.from(candidates).filter((c) => /^\+[1-9]\d{6,18}$/.test(c)).slice(0, 4);
}

export function translateFirebaseAuthError(error: unknown): string {
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  const rawCode = (error as { code?: string })?.code || '';
  const code = rawCode || rawMsg;
  const currentHost =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'current-domain';

  if (rawMsg.includes('SEARCH_RATE_LIMITED')) {
    return 'تم تجاوز الحد المسموح لمحاولات البحث المتتالية لحماية خصوصية المستخدمين. يرجى الانتظار بضع ثوانٍ ثم المحاولة مجدداً.';
  }
  if (rawMsg.includes('USERNAME_TAKEN')) {
    return 'اسم المستخدم (Username) محجوز ومستخدم بالفعل من قبل حساب آخر. يرجى اختيار اسم مستخدم فريد.';
  }
  if (rawMsg.includes('EMAIL_ALREADY_REGISTERED')) {
    return 'البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استعادة كلمة المرور.';
  }
  if (rawMsg.includes('USERNAME_NOT_FOUND')) {
    return 'اسم المستخدم هذا غير مسجل. تأكد من كتابته بشكل صحيح أو سجّل الدخول بالبريد الإلكتروني.';
  }
  if (rawMsg.includes('TOKEN_NEEDS_RELOGIN_FOR_VERIFIED_CLAIM')) {
    return 'تم تأكيد بريدك الإلكتروني بنجاح ✅ يرجى تسجيل الدخول بكلمة المرور الآن لتحديث رمز المصادقة (ID Token) وتفعيل حسابك في Firestore.';
  }
  if (rawMsg.includes('SESSION_EXPIRED_RELOGIN')) {
    return 'انتهت صلاحية الجلسة السابقة. يرجى تسجيل الدخول مجدداً لتجديد رمز الأمان.';
  }
  if (code.includes('auth/email-already-in-use')) {
    return 'البريد الإلكتروني مسجل بالفعل في Firebase Authentication [auth/email-already-in-use]. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.';
  }
  if (code.includes('auth/invalid-email')) {
    return 'صيغة البريد الإلكتروني غير صحيحة [auth/invalid-email]. يرجى كتابة بريد إلكتروني صالح.';
  }
  if (code.includes('auth/weak-password')) {
    return 'كلمة المرور ضعيفة [auth/weak-password]. يجب أن تتكون من 8 أحرف على الأقل وتحتوي على أحرف وأرقام.';
  }
  if (
    code.includes('auth/user-not-found') ||
    code.includes('auth/wrong-password') ||
    code.includes('auth/invalid-credential')
  ) {
    return `بيانات تسجيل الدخول غير صحيحة (البريد الإلكتروني أو كلمة المرور غير مطابقة) [${rawCode || 'auth/invalid-credential'}].`;
  }
  if (code.includes('auth/too-many-requests')) {
    return 'تم إيقاف المحاولات مؤقتاً من Firebase لحماية الحساب بسبب كثرة الطلبات المتتالية [auth/too-many-requests]. يرجى المحاولة بعد دقائق.';
  }
  if (code.includes('auth/invalid-verification-code')) {
    return 'رمز التحقق (OTP) غير صحيح [auth/invalid-verification-code]. يرجى التأكد من الأرقام الستة المرسلة إلى هاتفك.';
  }
  if (code.includes('auth/code-expired')) {
    return 'انتهت صلاحية رمز التحقق (OTP) [auth/code-expired]. يرجى الضغط على "إعادة إرسال SMS".';
  }
  if (
    code.includes('auth/invalid-phone-number') ||
    code.includes('auth/missing-phone-number')
  ) {
    return `رقم الهاتف غير صالح وفق صيغة E.164 الدولية [${rawCode || 'auth/invalid-phone-number'}]. تأكد من اختيار رمز الدولة الصحيح وإدخال الرقم بدون الصفر الابتدائي.`;
  }
  if (
    code.includes('auth/credential-already-in-use') ||
    code.includes('auth/phone-number-already-exists') ||
    code.includes('auth/account-exists-with-different-credential')
  ) {
    return `رقم الهاتف أو البريد الإلكتروني مرتبط بالفعل بحساب مستخدم آخر في Firebase [${rawCode || 'auth/credential-already-in-use'}].`;
  }
  if (code.includes('auth/provider-already-linked')) {
    return 'تم ربط رقم هاتف بهذا الحساب مسبقاً [auth/provider-already-linked].';
  }
  if (
    code.includes('auth/operation-not-allowed') ||
    rawMsg.includes('OPERATION_NOT_ALLOWED')
  ) {
    return `خطأ Firebase حقيقي [auth/operation-not-allowed]: مزود المصادقة برقم الهاتف (Phone Authentication) أو (Email/Password) غير مفعّل حالياً في مشروع Firebase (${firebaseConfig.projectId}). لتفعيل إرسال SMS: افتح Firebase Console > Authentication > Sign-in method ثم فعّل مزود "Phone" واحفظ التغييرات.`;
  }
  if (
    code.includes('auth/unauthorized-domain') ||
    code.includes('auth/app-not-authorized') ||
    rawMsg.includes('UNAUTHORIZED_DOMAIN')
  ) {
    return `خطأ Firebase حقيقي [${rawCode || 'auth/unauthorized-domain'}]: النطاق الحالي (${currentHost}) غير مضاف ضمن النطاقات المصرح بها (Authorized domains). يرجى إضافته في Firebase Console > Authentication > Settings > Authorized domains.`;
  }
  if (
    code.includes('auth/billing-not-enabled') ||
    code.includes('auth/quota-exceeded') ||
    rawMsg.includes('BILLING_NOT_ENABLED') ||
    rawMsg.includes('QUOTA_EXCEEDED')
  ) {
    return `خطأ Firebase حقيقي [${rawCode || 'auth/billing-not-enabled'}]: إرسال رسائل SMS الفعلية عبر Firebase Phone Auth يتطلب تفعيل خطة الفوترة (Blaze Plan) في مشروع Firebase (${firebaseConfig.projectId})، أو إضافة رقمك كرقم اختبار في Firebase Console > Authentication > Sign-in method > Phone > Phone numbers for testing.`;
  }
  if (
    code.includes('auth/captcha-check-failed') ||
    code.includes('auth/invalid-app-credential') ||
    code.includes('auth/missing-app-credential')
  ) {
    return `خطأ Firebase حقيقي [${rawCode || 'auth/captcha-check-failed'}]: تعذر التحقق من reCAPTCHA v2 لإرسال رسالة SMS على النطاق (${currentHost}). تأكد من إكمال تحدي reCAPTCHA ومن إضافة النطاق (${currentHost}) ضمن Authorized domains في Firebase Console > Authentication > Settings.`;
  }
  if (code.includes('auth/popup-closed-by-user')) {
    return 'تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية [auth/popup-closed-by-user].';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'خطأ في الاتصال بالشبكة [auth/network-request-failed]. يرجى التحقق من اتصال الإنترنت وعدم حجب google.com/recaptcha.';
  }
  if (code.includes('auth/internal-error')) {
    return `خطأ داخلي من Firebase [auth/internal-error]: (${rawMsg}). غالباً ما يحدث بسبب عدم تفعيل مزود Phone في Firebase Console أو عدم تفويض النطاق (${currentHost}) في Authorized domains.`;
  }
  if (
    code.includes('token-service-api-has-not-been-used') ||
    rawMsg.includes('token-service-api-has-not-been-used') ||
    rawMsg.includes('securetoken.googleapis.com')
  ) {
    return `تنبيه إعدادات Google Cloud [auth/token-service-api-has-not-been-used]: خدمة Token Service API (securetoken.googleapis.com) غير مفعّلة في مشروع Google AI Studio Starter Tier رقم (892622995916) لأن حساب Starter Tier لا يملك صلاحية IAM (serviceusage.services.enable) لتفعيل واجهات Google Cloud الإضافية. تم تفعيل المعالجة البديلة في الكود لإصدار الرموز مباشرة عبر Identity Toolkit API دون الحاجة لـ Secure Token API.`;
  }
  if (code.includes('auth/requires-recent-login')) {
    return 'لأسباب أمنية [auth/requires-recent-login]، يرجى تسجيل الخروج ثم تسجيل الدخول مجدداً لإتمام هذه العملية الحساسة.';
  }

  return rawCode
    ? `خطأ من Firebase [${rawCode}]: ${rawMsg}`
    : rawMsg || 'حدث خطأ غير متوقع أثناء الاتصال بـ Firebase. يرجى المحاولة مرة أخرى.';
}

// ============================================================================
// 1. REAL FIREBASE AUTHENTICATION OPERATIONS
// ============================================================================

// Session credentials stored for the active signed-in session (cleared immediately on sign-out).
// Used strictly as a fallback when Secure Token API (securetoken.googleapis.com) is disabled
// in Starter Tier projects so Identity Toolkit API can mint a fresh idToken across tabs or after 1 hour.
let ephemeralSessionAuth: { email: string; password: string } | null = null;
const EPHEMERAL_SESSION_KEY = 'sahpy_ephemeral_reauth_v1';

function saveEphemeralSessionAuth(email: string, password: string): void {
  const cleanEmail = email.trim().toLowerCase();
  ephemeralSessionAuth = { email: cleanEmail, password };
  const serialized = JSON.stringify({ email: cleanEmail, password });
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(EPHEMERAL_SESSION_KEY, serialized);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EPHEMERAL_SESSION_KEY, serialized);
    }
  } catch {
    // ignore storage errors
  }
}

function getEphemeralSessionAuth(): { email: string; password: string } | null {
  if (ephemeralSessionAuth) return ephemeralSessionAuth;
  try {
    const raw =
      (typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem(EPHEMERAL_SESSION_KEY)) ||
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem(EPHEMERAL_SESSION_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email && parsed?.password) {
        ephemeralSessionAuth = {
          email: String(parsed.email),
          password: String(parsed.password),
        };
        return ephemeralSessionAuth;
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function clearEphemeralSessionAuth(): void {
  ephemeralSessionAuth = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(EPHEMERAL_SESSION_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(EPHEMERAL_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function decodeJwtPayload(token: string): {
  exp?: number;
  email_verified?: boolean;
  user_id?: string;
  sub?: string;
} | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenServiceDisabledError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    code.includes('token-service-api-has-not-been-used') ||
    msg.includes('token-service-api-has-not-been-used') ||
    msg.includes('securetoken.googleapis.com') ||
    code.includes('auth/user-token-expired')
  );
}

interface InternalStsTokenManager {
  accessToken: string | null;
  refreshToken: string | null;
  expirationTime: number | null;
  refresh?: (authInstance: unknown, oldToken: string) => Promise<void>;
  updateTokensAndExpiration?: (
    accessToken: string | null,
    refreshToken: string | null,
    expiresInSec: number
  ) => void;
  __sahpyPatched?: boolean;
}

/**
 * Patches Firebase Auth's internal `StsTokenManager.prototype.refresh` without modifying `window.fetch`
 * (which is a read-only getter in the AI Studio preview iframe).
 * When `securetoken.googleapis.com` is disabled in Google AI Studio Starter Tier projects (892622995916),
 * token refresh requests transparently fall back to `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
 * (when session credentials exist) or preserve non-expired JWTs so Firebase Auth and Firestore never fail.
 */
function patchStsTokenManagerObject(
  manager: InternalStsTokenManager | null | undefined
): void {
  if (!manager || typeof manager !== 'object') return;
  const proto = Object.getPrototypeOf(manager) as InternalStsTokenManager | null;
  const target = proto && typeof proto.refresh === 'function' ? proto : manager;
  if (target.__sahpyPatched || typeof target.refresh !== 'function') {
    return;
  }

  const originalRefresh = target.refresh;
  target.__sahpyPatched = true;

  target.refresh = async function (
    this: InternalStsTokenManager,
    authInstance: unknown,
    oldToken: string
  ): Promise<void> {
    try {
      await originalRefresh.call(this, authInstance, oldToken);
      return;
    } catch (err) {
      if (!isTokenServiceDisabledError(err)) {
        throw err;
      }

      // 1. If ephemeral session credentials are available, mint a fresh Google-signed idToken via Identity Toolkit
      const creds = getEphemeralSessionAuth();
      if (creds?.email && creds?.password) {
        try {
          const itkRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: creds.email,
                password: creds.password,
                returnSecureToken: true,
              }),
            }
          );
          if (itkRes.ok) {
            const itkData = await itkRes.json();
            if (itkData?.idToken) {
              const expiresInSec = Number(itkData.expiresIn || 3600);
              const nextRefresh = String(itkData.refreshToken || oldToken || '');
              if (typeof this.updateTokensAndExpiration === 'function') {
                this.updateTokensAndExpiration(
                  itkData.idToken,
                  nextRefresh,
                  expiresInSec
                );
              } else {
                this.accessToken = itkData.idToken;
                this.refreshToken = nextRefresh;
                this.expirationTime = Date.now() + expiresInSec * 1000;
              }
              return;
            }
          }
        } catch {
          // Fall through to valid non-expired JWT check
        }
      }

      // 2. Otherwise, if the existing JWT in memory is still valid and non-expired, preserve it
      if (this.accessToken) {
        const decoded = decodeJwtPayload(this.accessToken);
        const nowMs = Date.now();
        if (decoded?.exp && decoded.exp * 1000 > nowMs + 30000) {
          const remainingSec = Math.max(
            60,
            Math.floor((decoded.exp * 1000 - nowMs) / 1000)
          );
          if (typeof this.updateTokensAndExpiration === 'function') {
            this.updateTokensAndExpiration(
              this.accessToken,
              this.refreshToken || oldToken,
              remainingSec
            );
          } else {
            this.expirationTime = nowMs + remainingSec * 1000;
          }
          return;
        }
      }

      throw err;
    }
  };
}

export function patchFirebaseUserTokenManager(
  user: User | null | undefined
): void {
  if (!user) return;
  const rawUser = user as unknown as {
    stsTokenManager?: InternalStsTokenManager;
  };
  if (rawUser.stsTokenManager) {
    patchStsTokenManagerObject(rawUser.stsTokenManager);
  }
}

try {
  if (typeof auth.beforeAuthStateChanged === 'function') {
    auth.beforeAuthStateChanged((user) => {
      patchFirebaseUserTokenManager(user);
    });
  }
} catch {
  // ignore if unsupported in environment
}

/**
 * Ensures `auth.currentUser` has a valid, non-expired JWT idToken before making Firestore requests.
 * When `securetoken.googleapis.com` is disabled in Google AI Studio Starter Tier projects (892622995916),
 * an expired cached session in IndexedDB causes Firestore to send requests with `request.auth == null`,
 * resulting in `Missing or insufficient permissions.` on `users/{uid}`.
 * This helper automatically re-mints the token via Identity Toolkit (`signInWithEmailAndPassword`) if
 * session credentials are available, or cleanly signs out stale expired IndexedDB sessions.
 */
export async function ensureValidAuthTokenForFirestore(options?: {
  requireVerifiedClaim?: boolean;
  requireEmailVerifiedClaim?: boolean;
}): Promise<boolean> {
  if (!auth.currentUser) return false;
  patchFirebaseUserTokenManager(auth.currentUser);

  const mustHaveVerifiedClaim = Boolean(
    options?.requireVerifiedClaim || options?.requireEmailVerifiedClaim
  );
  const creds = getEphemeralSessionAuth();

  // Inspect cached stsTokenManager token before triggering getIdToken
  const rawUser = auth.currentUser as unknown as {
    stsTokenManager?: { accessToken?: string };
  };
  const cachedAccessToken = rawUser?.stsTokenManager?.accessToken;
  if (cachedAccessToken) {
    const cachedPayload = decodeJwtPayload(cachedAccessToken);
    if (
      cachedPayload?.exp !== undefined &&
      cachedPayload.exp * 1000 <= Date.now() + 30000 &&
      !creds
    ) {
      await signOutFromCloud().catch(() => {});
      return false;
    }
  }

  let token: string | null = null;

  try {
    token = await auth.currentUser.getIdToken(false);
  } catch (err) {
    if (creds) {
      try {
        const reauthed = await signInWithEmailAndPassword(
          auth,
          creds.email,
          creds.password
        );
        token = await reauthed.user.getIdToken(false);
      } catch {
        token = null;
      }
    }
    if (!token && isTokenServiceDisabledError(err)) {
      await signOutFromCloud().catch(() => {});
      return false;
    }
    if (!token) return false;
  }

  const payload = decodeJwtPayload(token);
  const nowMs = Date.now();
  const isExpiredOrExpiring =
    payload?.exp !== undefined && payload.exp * 1000 <= nowMs + 30000;

  if (isExpiredOrExpiring) {
    if (creds) {
      try {
        const reauthed = await signInWithEmailAndPassword(
          auth,
          creds.email,
          creds.password
        );
        token = await reauthed.user.getIdToken(false);
      } catch {
        await signOutFromCloud().catch(() => {});
        return false;
      }
    } else {
      await signOutFromCloud().catch(() => {});
      return false;
    }
  }

  const latestPayload = token ? decodeJwtPayload(token) : null;
  if (
    (mustHaveVerifiedClaim || auth.currentUser?.emailVerified) &&
    latestPayload?.email_verified !== true
  ) {
    if (creds) {
      try {
        const reauthed = await signInWithEmailAndPassword(
          auth,
          creds.email,
          creds.password
        );
        await reauthed.user.getIdToken(false);
        return Boolean(!mustHaveVerifiedClaim || reauthed.user.emailVerified);
      } catch {
        // If reauth failed, rely on Identity Toolkit's verified email status if token is valid
        return Boolean(!mustHaveVerifiedClaim || auth.currentUser?.emailVerified);
      }
    } else if (mustHaveVerifiedClaim) {
      return Boolean(auth.currentUser?.emailVerified);
    }
  }

  return true;
}

export async function handleEmailVerificationActionUrl(): Promise<{
  handled: boolean;
  verified: boolean;
  message?: string;
}> {
  if (typeof window === 'undefined') {
    return { handled: false, verified: false };
  }
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  if (mode !== 'verifyEmail' || !oobCode) {
    return { handled: false, verified: false };
  }

  try {
    await applyActionCode(auth, oobCode);
    // Clean URL query params so reload doesn't re-apply a consumed oobCode
    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
    await reloadAndCheckCurrentUser();
    return {
      handled: true,
      verified: true,
      message:
        'تم تفعيل وتأكيد بريدك الإلكتروني بنجاح عبر رابط التحقق من Firebase Authentication ✅',
    };
  } catch (err) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
    return {
      handled: true,
      verified: false,
      message: translateFirebaseAuthError(err),
    };
  }
}

export async function signInWithGoogleCloud(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  patchFirebaseUserTokenManager(cred.user);
  return cred.user;
}

export async function registerWithEmailAndPasswordCloud(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<User> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(
    auth,
    cleanEmail,
    params.password
  );
  saveEphemeralSessionAuth(cleanEmail, params.password);
  patchFirebaseUserTokenManager(cred.user);
  if (params.displayName.trim()) {
    await updateProfile(cred.user, {
      displayName: params.displayName.trim().slice(0, 80),
    });
  }
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function loginWithEmailAndPasswordCloud(
  email: string,
  password: string
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  saveEphemeralSessionAuth(cleanEmail, password);
  patchFirebaseUserTokenManager(cred.user);
  return cred.user;
}

export async function sendVerificationEmailToCurrentUser(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('لا يوجد مستخدم مسجل حالياً لإرسال رسالة التحقق.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function sendPasswordResetEmailCloud(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmailFormat(cleanEmail)) {
    throw new Error('يرجى إدخال بريد إلكتروني صالح لاستعادة كلمة المرور.');
  }
  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Safely reloads the current user via Identity Toolkit (accounts:lookup) without
 * crashing when Secure Token API (securetoken.googleapis.com) is disabled in
 * Google AI Studio Starter Tier projects.
 */
export async function reloadAndCheckCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  patchFirebaseUserTokenManager(auth.currentUser);
  const creds = getEphemeralSessionAuth();

  try {
    await auth.currentUser.reload();
  } catch (reloadErr) {
    if (isTokenServiceDisabledError(reloadErr) && creds) {
      try {
        const reauthed = await signInWithEmailAndPassword(
          auth,
          creds.email,
          creds.password
        );
        return reauthed.user;
      } catch {
        return auth.currentUser;
      }
    }
    if (!isTokenServiceDisabledError(reloadErr)) {
      throw reloadErr;
    }
  }

  if (auth.currentUser) {
    await ensureValidAuthTokenForFirestore({
      requireVerifiedClaim: Boolean(auth.currentUser.emailVerified),
    });
  }

  return auth.currentUser;
}

export async function signOutFromCloud(): Promise<void> {
  clearEphemeralSessionAuth();
  await signOut(auth);
}

export async function logoutFromFirebase(): Promise<void> {
  await signOutFromCloud();
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      callback(null);
      return;
    }
    patchFirebaseUserTokenManager(fbUser);
    const hasValidToken = await ensureValidAuthTokenForFirestore();
    if (!hasValidToken || !auth.currentUser) {
      callback(null);
      return;
    }
    callback(auth.currentUser);
  });
}

// ============================================================================
// 2. FIRESTORE USER PROFILES & ATOMIC UNIQUE USERNAME RESERVATION
// ============================================================================

export interface FirestoreUserProfileData {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  phoneTag: string;
  bio: string;
  wallpaperTheme: WallpaperThemeId;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarUrl?: string;
}

export interface PublicDirectoryUser {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  avatarFallbackColor: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarUrl?: string;
}

export async function checkUsernameAvailability(
  rawUsername: string,
  currentUid?: string
): Promise<{ available: boolean; ownerUid?: string }> {
  const cleanUsername = sanitizeUsername(rawUsername);
  if (!isValidUsernameFormat(cleanUsername)) {
    return { available: false };
  }

  // 1. If authenticated in Firebase with a valid token, query Firestore /usernames/{username} directly
  if (auth.currentUser) {
    const hasValidToken = await ensureValidAuthTokenForFirestore();
    if (hasValidToken && auth.currentUser) {
      const path = `usernames/${cleanUsername}`;
      try {
        const snap = await getDoc(doc(db, 'usernames', cleanUsername));
        if (snap.exists()) {
          const ownerUid = String(snap.data().uid || '');
          if (currentUid && ownerUid === currentUid) {
            return { available: true, ownerUid };
          }
          return { available: false, ownerUid };
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  }

  // 2. Also check backend registry (supports pre-signup username check before Firebase Auth account creation)
  try {
    const res = await fetch(
      `/api/users/check-username?username=${encodeURIComponent(cleanUsername)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.taken && (!currentUid || data.uid !== currentUid)) {
        return { available: false, ownerUid: data.uid };
      }
    }
  } catch {
    // ignore backend fallback error
  }

  return { available: true };
}

/**
 * Atomically reserves `/usernames/{username}` and creates/updates
 * `/directory/{uid}` (public non-PII) and `/users/{uid}` (private owner-only PII).
 * NEVER stores passwords or OTP codes in Firestore.
 */
export async function reserveUsernameAndSaveProfileToFirestore(params: {
  user: User;
  displayName: string;
  username: string;
  email: string;
  phoneTag: string;
  bio: string;
  wallpaperTheme: WallpaperThemeId;
  phoneVerified: boolean;
  avatarFallbackColor?: string;
  avatarUrl?: string;
}): Promise<FirestoreUserProfileData> {
  const hasVerifiedToken = await ensureValidAuthTokenForFirestore({
    requireVerifiedClaim: true,
  });
  if (!hasVerifiedToken || !auth.currentUser) {
    throw new Error('TOKEN_NEEDS_RELOGIN_FOR_VERIFIED_CLAIM');
  }

  const uid = auth.currentUser.uid;
  const cleanUsername = sanitizeUsername(params.username);
  if (!isValidUsernameFormat(cleanUsername)) {
    throw new Error(
      'اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفاً (أحرف إنجليزية صغيرة، أرقام، أو _ فقط).'
    );
  }

  const safeDisplayName = (params.displayName || cleanUsername || 'مستخدم')
    .trim()
    .slice(0, 80);
  const rawEmail = (auth.currentUser.email || params.user.email || params.email || '')
    .trim()
    .toLowerCase()
    .slice(0, 120);
  const safeEmail =
    rawEmail.length >= 5 ? rawEmail : `${cleanUsername}@sahpy.chat`.slice(0, 120);
  const safePhone = sanitizePhoneTag(params.phoneTag);
  const hasSearchablePhone =
    !isUnsetPhoneTag(safePhone) && /^\+[1-9]\d{6,18}$/.test(safePhone);
  const safeBio = (params.bio || 'متاح للمحادثة عبر SAHPY-CHAT ✨')
    .trim()
    .slice(0, 200);
  const safeColor = (params.avatarFallbackColor || 'bg-emerald-600').slice(
    0,
    40
  );
  const rawIncomingAvatar = String(
    params.avatarUrl || auth.currentUser.photoURL || ''
  )
    .trim()
    .slice(0, 240000);
  const emailVerified = Boolean(auth.currentUser.emailVerified || params.user.emailVerified);
  // Phone number is a regular profile field for search only (never marked verified via SMS)
  const phoneVerified = false;

  const userRef = doc(db, 'users', uid);
  const dirRef = doc(db, 'directory', uid);
  let previousPhoneTag = '';
  let existingAvatarUrl = '';

  // If a legacy user document exists from an older schema (missing uid/createdAt/wallpaperTheme),
  // clean it up first so the transaction creates a strictly compliant UserProfile document.
  try {
    const existingUserSnap = await getDoc(userRef);
    if (existingUserSnap.exists()) {
      const uData = existingUserSnap.data();
      previousPhoneTag = String(uData.phoneTag || uData.phone || '').trim();
      existingAvatarUrl = String(uData.avatarUrl || uData.avatar || '').trim();
      const hasLegacyShape =
        !uData.uid ||
        !uData.username ||
        !uData.email ||
        !uData.wallpaperTheme ||
        !uData.createdAt ||
        'name' in uData ||
        'phone' in uData ||
        'avatar' in uData;
      if (hasLegacyShape) {
        await deleteDoc(userRef);
      }
    }
    const existingDirSnap = await getDoc(dirRef);
    if (existingDirSnap.exists()) {
      const dData = existingDirSnap.data();
      if (!existingAvatarUrl && dData.avatarUrl) {
        existingAvatarUrl = String(dData.avatarUrl).trim();
      }
      const hasLegacyDirShape =
        !dData.uid ||
        !dData.username ||
        !dData.avatarFallbackColor ||
        !dData.createdAt;
      if (hasLegacyDirShape) {
        await deleteDoc(dirRef);
      }
    }
  } catch {
    // ignore pre-migration check error
  }

  const resolvedAvatarUrl = normalizeUserAvatarUrl(
    rawIncomingAvatar || existingAvatarUrl,
    uid,
    safeDisplayName
  ).slice(0, 240000);

  let resolvedUsername = cleanUsername;

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const dirSnap = await transaction.get(dirRef);

      // If the user already had an older username in a valid UserProfile doc, keep their immutable username
      const effectiveUsername =
        userSnap.exists() && userSnap.data().username
          ? String(userSnap.data().username)
          : cleanUsername;
      resolvedUsername = effectiveUsername;

      const effectiveUsernameRef = doc(db, 'usernames', effectiveUsername);
      const usernameSnap = await transaction.get(effectiveUsernameRef);

      if (usernameSnap.exists()) {
        const existingOwnerUid = String(usernameSnap.data().uid || '');
        if (existingOwnerUid && existingOwnerUid !== uid) {
          throw new Error('USERNAME_TAKEN');
        }
      }

      if (!usernameSnap.exists()) {
        transaction.set(effectiveUsernameRef, {
          uid,
          username: effectiveUsername,
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          avatarUrl: resolvedAvatarUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.update(effectiveUsernameRef, {
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          avatarUrl: resolvedAvatarUrl,
          updatedAt: serverTimestamp(),
        });
      }

      if (!dirSnap.exists()) {
        transaction.set(dirRef, {
          uid,
          username: effectiveUsername,
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          avatarUrl: resolvedAvatarUrl,
          emailVerified,
          phoneVerified,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.update(dirRef, {
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          avatarUrl: resolvedAvatarUrl,
          emailVerified,
          phoneVerified,
          updatedAt: serverTimestamp(),
        });
      }

      if (!userSnap.exists()) {
        transaction.set(userRef, {
          uid,
          displayName: safeDisplayName,
          username: effectiveUsername,
          email: safeEmail,
          phoneTag: safePhone,
          bio: safeBio,
          wallpaperTheme: params.wallpaperTheme,
          emailVerified,
          phoneVerified,
          avatarUrl: resolvedAvatarUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.update(userRef, {
          displayName: safeDisplayName,
          phoneTag: safePhone,
          bio: safeBio,
          wallpaperTheme: params.wallpaperTheme,
          emailVerified,
          phoneVerified,
          avatarUrl: resolvedAvatarUrl,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  // Sync non-PII phone search index (/phone_index/{phoneKey}) for phone lookup without exposing PII
  try {
    if (
      previousPhoneTag &&
      previousPhoneTag !== safePhone &&
      /^\+[1-9]\d{6,18}$/.test(previousPhoneTag) &&
      !isUnsetPhoneTag(previousPhoneTag)
    ) {
      const oldPhoneRef = doc(db, 'phone_index', previousPhoneTag);
      const oldPhoneSnap = await getDoc(oldPhoneRef);
      if (oldPhoneSnap.exists() && oldPhoneSnap.data().uid === uid) {
        await deleteDoc(oldPhoneRef);
      }
    }

    if (hasSearchablePhone) {
      const phoneRef = doc(db, 'phone_index', safePhone);
      const phoneSnap = await getDoc(phoneRef);
      if (!phoneSnap.exists()) {
        await setDoc(phoneRef, {
          uid,
          phoneKey: safePhone,
          username: resolvedUsername,
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          avatarUrl: resolvedAvatarUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (phoneSnap.data().uid === uid) {
        await updateDoc(phoneRef, {
          username: resolvedUsername,
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          avatarUrl: resolvedAvatarUrl,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch {
    // Non-fatal if another user already indexed the same unverified phone number
  }

  // Also propagate updated displayName and avatarUrl to active /chats/{chatId} rooms where this user is a participant
  try {
    const q1 = query(
      collection(db, 'chats'),
      where('participantOneUid', '==', uid)
    );
    const q2 = query(
      collection(db, 'chats'),
      where('participantTwoUid', '==', uid)
    );
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    for (const d of s1.docs) {
      const cData = d.data();
      await updateDoc(d.ref, {
        participantOneName: safeDisplayName,
        participantOneAvatar: resolvedAvatarUrl,
        lastMessageSenderUid: uid,
        lastMessageText: String(cData.lastMessageText || 'بدأت محادثة آمنة وموثقة 👋'),
        lastMessageTime: String(cData.lastMessageTime || 'الآن'),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    for (const d of s2.docs) {
      const cData = d.data();
      await updateDoc(d.ref, {
        participantTwoName: safeDisplayName,
        participantTwoAvatar: resolvedAvatarUrl,
        lastMessageSenderUid: uid,
        lastMessageText: String(cData.lastMessageText || 'بدأت محادثة آمنة وموثقة 👋'),
        lastMessageTime: String(cData.lastMessageTime || 'الآن'),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  } catch {
    // non-fatal chat room profile sync
  }

  cacheUsernameEmailMapping(resolvedUsername, safeEmail);

  return {
    uid,
    displayName: safeDisplayName,
    username: resolvedUsername,
    email: safeEmail,
    phoneTag: formatDisplayPhone(safePhone),
    bio: safeBio,
    wallpaperTheme: params.wallpaperTheme,
    emailVerified,
    phoneVerified: false,
    avatarUrl: resolvedAvatarUrl,
  };
}

export async function getOwnUserProfileFromFirestore(
  uid: string
): Promise<FirestoreUserProfileData | null> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return null;
  const hasValidToken = await ensureValidAuthTokenForFirestore();
  if (!hasValidToken || !auth.currentUser || auth.currentUser.uid !== uid) {
    return null;
  }
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    const displayName = String(d.displayName || d.name || '');
    return {
      uid: String(d.uid || uid),
      displayName,
      username: String(d.username || ''),
      email: String(d.email || auth.currentUser?.email || ''),
      phoneTag: formatDisplayPhone(String(d.phoneTag || d.phone || '')),
      bio: String(d.bio || ''),
      wallpaperTheme: (d.wallpaperTheme as WallpaperThemeId) || 'aurora-borealis',
      emailVerified: Boolean(d.emailVerified ?? auth.currentUser?.emailVerified),
      phoneVerified: false,
      avatarUrl: normalizeUserAvatarUrl(
        String(d.avatarUrl || d.avatar || auth.currentUser?.photoURL || ''),
        uid,
        displayName
      ),
    };
  } catch (error) {
    // If token expired right before getDoc in Starter Tier, attempt re-auth once before surfacing error
    const creds = getEphemeralSessionAuth();
    if (creds) {
      try {
        await signInWithEmailAndPassword(auth, creds.email, creds.password);
        const retrySnap = await getDoc(doc(db, 'users', uid));
        if (!retrySnap.exists()) return null;
        const d = retrySnap.data();
        const displayName = String(d.displayName || d.name || '');
        return {
          uid: String(d.uid || uid),
          displayName,
          username: String(d.username || ''),
          email: String(d.email || auth.currentUser?.email || ''),
          phoneTag: formatDisplayPhone(String(d.phoneTag || d.phone || '')),
          bio: String(d.bio || ''),
          wallpaperTheme:
            (d.wallpaperTheme as WallpaperThemeId) || 'aurora-borealis',
          emailVerified: Boolean(
            d.emailVerified ?? auth.currentUser?.emailVerified
          ),
          phoneVerified: false,
          avatarUrl: normalizeUserAvatarUrl(
            String(d.avatarUrl || d.avatar || auth.currentUser?.photoURL || ''),
            uid,
            displayName
          ),
        };
      } catch {
        // Fall through
      }
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getPublicDirectoryProfileByUid(
  targetUid: string
): Promise<PublicDirectoryUser | null> {
  if (!auth.currentUser || !targetUid) return null;
  const safeUid = sanitizeDocId(targetUid);
  if (!safeUid) return null;
  try {
    const snap = await getDoc(doc(db, 'directory', safeUid));
    if (!snap.exists()) return null;
    const d = snap.data();
    const displayName = String(d.displayName || d.username || '');
    return {
      uid: String(d.uid || safeUid),
      username: String(d.username || ''),
      displayName,
      bio: String(d.bio || ''),
      avatarFallbackColor: String(d.avatarFallbackColor || 'bg-emerald-600'),
      emailVerified: Boolean(d.emailVerified),
      phoneVerified: false,
      avatarUrl: normalizeUserAvatarUrl(
        String(d.avatarUrl || ''),
        String(d.uid || safeUid),
        displayName
      ),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 3. SEARCH REGISTERED USERS IN FIRESTORE BY @USERNAME, PHONE NUMBER, OR UID
//    (WITH RATE LIMITING & ZERO PII EXPOSURE)
// ============================================================================

const searchTimestampsMs: number[] = [];
const MAX_SEARCHES_PER_MINUTE = 18;
let lastSearchQueryCache: { query: string; result: PublicDirectoryUser | null; ts: number } | null = null;

function checkClientSearchRateLimit(queryKey: string): boolean {
  const now = Date.now();
  if (
    lastSearchQueryCache &&
    lastSearchQueryCache.query === queryKey &&
    now - lastSearchQueryCache.ts < 3000
  ) {
    return true;
  }
  while (searchTimestampsMs.length > 0 && now - searchTimestampsMs[0] > 60000) {
    searchTimestampsMs.shift();
  }
  if (searchTimestampsMs.length >= MAX_SEARCHES_PER_MINUTE) {
    return false;
  }
  searchTimestampsMs.push(now);
  return true;
}

export async function findRegisteredUserInFirestore(
  rawQuery: string,
  preferredCountryCode = '+20'
): Promise<PublicDirectoryUser | null> {
  if (!auth.currentUser) return null;
  const hasValidToken = await ensureValidAuthTokenForFirestore();
  if (!hasValidToken || !auth.currentUser) return null;

  const trimmed = String(rawQuery || '').trim();
  if (trimmed.length < 3) return null;

  const cacheKey = `${trimmed.toLowerCase()}|${preferredCountryCode}`;
  if (
    lastSearchQueryCache &&
    lastSearchQueryCache.query === cacheKey &&
    Date.now() - lastSearchQueryCache.ts < 3000
  ) {
    return lastSearchQueryCache.result;
  }

  if (!checkClientSearchRateLimit(cacheKey)) {
    throw new Error('SEARCH_RATE_LIMITED');
  }

  // 1. Try lookup by exact @username in /usernames/{username}
  const candidateUsername = sanitizeUsername(trimmed);
  if (isValidUsernameFormat(candidateUsername)) {
    try {
      const unameSnap = await getDoc(doc(db, 'usernames', candidateUsername));
      if (unameSnap.exists()) {
        const uData = unameSnap.data();
        const targetUid = String(uData.uid || '');
        if (targetUid) {
          const dirSnap = await getDoc(doc(db, 'directory', targetUid));
          if (dirSnap.exists()) {
            const d = dirSnap.data();
            const displayName = String(d.displayName || candidateUsername);
            const found: PublicDirectoryUser = {
              uid: String(d.uid || targetUid),
              username: String(d.username || candidateUsername),
              displayName,
              bio: String(d.bio || ''),
              avatarFallbackColor: String(
                d.avatarFallbackColor || 'bg-emerald-600'
              ),
              emailVerified: Boolean(d.emailVerified),
              phoneVerified: false,
              avatarUrl: normalizeUserAvatarUrl(
                String(d.avatarUrl || uData.avatarUrl || ''),
                String(d.uid || targetUid),
                displayName
              ),
            };
            lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
            return found;
          }
          const displayName = String(uData.displayName || candidateUsername);
          const found: PublicDirectoryUser = {
            uid: targetUid,
            username: String(uData.username || candidateUsername),
            displayName,
            bio: String(uData.bio || ''),
            avatarFallbackColor: String(
              uData.avatarFallbackColor || 'bg-emerald-600'
            ),
            emailVerified: true,
            phoneVerified: false,
            avatarUrl: normalizeUserAvatarUrl(
              String(uData.avatarUrl || ''),
              targetUid,
              displayName
            ),
          };
          lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
          return found;
        }
      }
    } catch (error) {
      console.warn('Firestore username lookup skipped:', error);
    }
  }

  // 2. Try lookup by normalized phone number in /phone_index/{phoneKey}
  const phoneCandidates = buildNormalizedPhoneSearchCandidates(
    trimmed,
    preferredCountryCode
  );
  for (const phoneKey of phoneCandidates) {
    try {
      const phoneSnap = await getDoc(doc(db, 'phone_index', phoneKey));
      if (phoneSnap.exists()) {
        const pData = phoneSnap.data();
        const targetUid = String(pData.uid || '');
        if (targetUid) {
          const dirSnap = await getDoc(doc(db, 'directory', targetUid));
          if (dirSnap.exists()) {
            const d = dirSnap.data();
            const displayName = String(d.displayName || pData.displayName || '');
            const found: PublicDirectoryUser = {
              uid: String(d.uid || targetUid),
              username: String(d.username || pData.username || ''),
              displayName,
              bio: String(d.bio || pData.bio || ''),
              avatarFallbackColor: String(
                d.avatarFallbackColor || pData.avatarFallbackColor || 'bg-emerald-600'
              ),
              emailVerified: Boolean(d.emailVerified),
              phoneVerified: false,
              avatarUrl: normalizeUserAvatarUrl(
                String(d.avatarUrl || pData.avatarUrl || ''),
                String(d.uid || targetUid),
                displayName
              ),
            };
            lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
            return found;
          }
          const displayName = String(pData.displayName || '');
          const found: PublicDirectoryUser = {
            uid: targetUid,
            username: String(pData.username || ''),
            displayName,
            bio: String(pData.bio || ''),
            avatarFallbackColor: String(
              pData.avatarFallbackColor || 'bg-emerald-600'
            ),
            emailVerified: true,
            phoneVerified: false,
            avatarUrl: normalizeUserAvatarUrl(
              String(pData.avatarUrl || ''),
              targetUid,
              displayName
            ),
          };
          lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
          return found;
        }
      }
    } catch (error) {
      console.warn('Firestore phone lookup candidate skipped:', error);
    }
  }

  // 3. Try lookup by exact Firebase Auth UID in /directory/{uid}
  const candidateUid = trimmed.replace(/^@+/, '');
  if (
    /^[a-zA-Z0-9_-]{6,128}$/.test(candidateUid) &&
    phoneCandidates.length === 0
  ) {
    try {
      const dirSnap = await getDoc(doc(db, 'directory', candidateUid));
      if (dirSnap.exists()) {
        const d = dirSnap.data();
        const displayName = String(d.displayName || '');
        const found: PublicDirectoryUser = {
          uid: String(d.uid || candidateUid),
          username: String(d.username || ''),
          displayName,
          bio: String(d.bio || ''),
          avatarFallbackColor: String(
            d.avatarFallbackColor || 'bg-emerald-600'
          ),
          emailVerified: Boolean(d.emailVerified),
          phoneVerified: false,
          avatarUrl: normalizeUserAvatarUrl(
            String(d.avatarUrl || ''),
            String(d.uid || candidateUid),
            displayName
          ),
        };
        lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
        return found;
      }
    } catch (error) {
      console.warn('Firestore directory UID lookup skipped:', error);
    }
  }

  // 4. Fallback to backend search endpoint (supports searching profiles by normalized phone, username, or UID)
  try {
    const res = await fetch(
      `/api/users/search?q=${encodeURIComponent(trimmed)}&cc=${encodeURIComponent(preferredCountryCode)}`
    );
    if (res.ok) {
      const data = await res.json();
      const firstMatched = data?.user || (Array.isArray(data?.users) ? data.users[0] : null);
      if (firstMatched && (firstMatched.uid || firstMatched.id)) {
        const uidVal = String(firstMatched.uid || firstMatched.id);
        const displayName = String(firstMatched.name || firstMatched.displayName || '');
        const found: PublicDirectoryUser = {
          uid: uidVal,
          username: String(firstMatched.username || ''),
          displayName,
          bio: String(firstMatched.bio || ''),
          avatarFallbackColor: 'bg-emerald-600',
          emailVerified: Boolean(firstMatched.emailVerified ?? true),
          phoneVerified: false,
          avatarUrl: normalizeUserAvatarUrl(
            String(firstMatched.avatar || firstMatched.avatarUrl || ''),
            uidVal,
            displayName
          ),
        };
        lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
        return found;
      }
    }
  } catch {
    // ignore backend fallback error
  }

  lastSearchQueryCache = { query: cacheKey, result: null, ts: Date.now() };
  return null;
}

// ============================================================================
// 4. REAL-TIME AUTHORIZED PARTICIPANT CHATS (/chats/{chatId})
// ============================================================================

export function buildDeterministicChatId(uidA: string, uidB: string): string {
  const a = sanitizeDocId(uidA);
  const b = sanitizeDocId(uidB);
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export async function createOrGetAuthorizedChatRoom(params: {
  myUid: string;
  myName: string;
  myUsername: string;
  myAvatar?: string;
  otherUid: string;
  otherName: string;
  otherUsername: string;
  otherAvatar?: string;
}): Promise<string> {
  if (!auth.currentUser || auth.currentUser.uid !== params.myUid) {
    throw new Error('يجب تسجيل الدخول والتحقق من الهوية لإنشاء محادثة.');
  }
  if (!auth.currentUser.emailVerified) {
    throw new Error(
      'لا يمكن إنشاء محادثة أو إرسال رسائل قبل تأكيد بريدك الإلكتروني.'
    );
  }
  if (params.myUid === params.otherUid) {
    throw new Error('لا يمكنك إنشاء محادثة مع نفسك.');
  }
  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) {
    throw new Error(
      'تم تأكيد البريد الإلكتروني، ولكن يلزم تسجيل الدخول مرة أخرى لتحديث جلسة الأمان قبل بدء المحادثة.'
    );
  }

  const chatId = buildDeterministicChatId(params.myUid, params.otherUid);
  const chatPath = `chats/${chatId}`;
  const chatRef = doc(db, 'chats', chatId);

  const isMeFirst = sanitizeDocId(params.myUid) < sanitizeDocId(params.otherUid);
  const participantOneUid = isMeFirst ? params.myUid : params.otherUid;
  const participantTwoUid = isMeFirst ? params.otherUid : params.myUid;
  const participantOneName = (
    isMeFirst ? params.myName : params.otherName
  ).slice(0, 80);
  const participantTwoName = (
    isMeFirst ? params.otherName : params.myName
  ).slice(0, 80);
  const participantOneUsername =
    sanitizeUsername(isMeFirst ? params.myUsername : params.otherUsername) ||
    `user_${sanitizeDocId(participantOneUid).slice(0, 8).toLowerCase()}`;
  const participantTwoUsername =
    sanitizeUsername(isMeFirst ? params.otherUsername : params.myUsername) ||
    `user_${sanitizeDocId(participantTwoUid).slice(0, 8).toLowerCase()}`;

  try {
    // Verify target user exists in /directory/{otherUid}
    const targetDirSnap = await getDoc(doc(db, 'directory', params.otherUid));
    if (!targetDirSnap.exists()) {
      throw new Error(
        'هذا المستخدم غير موجود في قاعدة بيانات Firestore المعتمدة.'
      );
    }
    const targetDirData = targetDirSnap.data();
    const resolvedOtherAvatar = normalizeUserAvatarUrl(
      String(params.otherAvatar || targetDirData.avatarUrl || ''),
      params.otherUid,
      params.otherName
    ).slice(0, 240000);
    const resolvedMyAvatar = normalizeUserAvatarUrl(
      String(params.myAvatar || auth.currentUser?.photoURL || ''),
      params.myUid,
      params.myName
    ).slice(0, 240000);

    const participantOneAvatar = isMeFirst
      ? resolvedMyAvatar
      : resolvedOtherAvatar;
    const participantTwoAvatar = isMeFirst
      ? resolvedOtherAvatar
      : resolvedMyAvatar;

    const existingChat = await getDoc(chatRef);
    if (!existingChat.exists()) {
      await setDoc(chatRef, {
        chatId,
        participantOneUid,
        participantTwoUid,
        participantOneName,
        participantTwoName,
        participantOneUsername,
        participantTwoUsername,
        participantOneAvatar,
        participantTwoAvatar,
        createdByUid: params.myUid,
        lastMessageText: '',
        lastMessageSenderUid: params.myUid,
        lastMessageTime: 'الآن',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return chatId;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('غير موجود في قاعدة بيانات')
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, chatPath);
  }
}

const inFlightAndSentMessageKeys = new Set<string>();

export function sanitizeVoiceDuration(rawDuration?: string | null): string {
  const cleaned = String(rawDuration || '').trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null' || cleaned === 'NaN') {
    return '0:05';
  }
  return cleaned.slice(0, 20);
}

export async function sendAuthorizedMessageToChatRoom(params: {
  chatId: string;
  messageId: string;
  senderUid: string;
  recipientUid: string;
  senderName: string;
  senderUsername: string;
  senderAvatar?: string;
  text: string;
  messageType: 'text' | 'voice' | 'image' | 'file' | 'poll' | 'sticker';
  voiceDuration?: string;
  imageUrl?: string;
  imageCaption?: string;
  stickerId?: string;
  stickerEmoji?: string;
  stickerLabel?: string;
  stickerGradient?: string;
  stickerPackId?: string;
  displayTime: string;
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== params.senderUid) {
    throw new Error('غير مصرح لك بإرسال رسائل قبل التحقق من هويتك.');
  }
  if (!auth.currentUser.emailVerified) {
    throw new Error('يرجى تأكيد البريد الإلكتروني أولاً قبل إرسال الرسائل.');
  }

  const safeChatId = sanitizeDocId(params.chatId);
  const safeMsgId = sanitizeDocId(params.messageId);
  const dedupeKey = `${safeChatId}:${safeMsgId}`;
  if (inFlightAndSentMessageKeys.has(dedupeKey)) {
    return;
  }
  inFlightAndSentMessageKeys.add(dedupeKey);

  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) {
    inFlightAndSentMessageKeys.delete(dedupeKey);
    throw new Error(
      'يرجى تسجيل الدخول مرة أخرى لتحديث جلسة الأمان قبل إرسال الرسائل.'
    );
  }

  const msgPath = `chats/${safeChatId}/messages/${safeMsgId}`;
  const msgRef = doc(db, 'chats', safeChatId, 'messages', safeMsgId);
  const chatRef = doc(db, 'chats', safeChatId);

  const safeText = (params.text || 'رسالة').slice(0, 2000);
  const safeSenderName = (params.senderName || 'مستخدم').slice(0, 80);
  const safeSenderUsername =
    sanitizeUsername(params.senderUsername) || 'user_chat';
  const safeTime = (params.displayTime || 'الآن').slice(0, 40);

  const payload: Record<string, any> = {
    chatId: safeChatId,
    senderUid: params.senderUid,
    recipientUid: params.recipientUid,
    senderName: safeSenderName,
    senderUsername: safeSenderUsername,
    text: safeText,
    messageType: params.messageType,
    displayTime: safeTime,
    isStarred: false,
    isPinned: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.senderAvatar) {
    payload.senderAvatar = String(params.senderAvatar).slice(0, 240000);
  }
  if (params.messageType === 'voice') {
    payload.voiceDuration = sanitizeVoiceDuration(params.voiceDuration);
  }
  if (params.messageType === 'image' && params.imageUrl) {
    payload.imageUrl = String(params.imageUrl).slice(0, 340000);
    if (params.imageCaption) {
      payload.imageCaption = String(params.imageCaption).slice(0, 500);
    }
  }
  if (params.messageType === 'sticker') {
    if (params.stickerId) payload.stickerId = String(params.stickerId).slice(0, 60);
    if (params.stickerEmoji) payload.stickerEmoji = String(params.stickerEmoji).slice(0, 40);
    if (params.stickerLabel) payload.stickerLabel = String(params.stickerLabel).slice(0, 100);
    if (params.stickerGradient) payload.stickerGradient = String(params.stickerGradient).slice(0, 160);
    if (params.stickerPackId) payload.stickerPackId = String(params.stickerPackId).slice(0, 40);
  }

  try {
    await setDoc(msgRef, payload);

    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const cData = chatSnap.data();
      const isMeOne = cData.participantOneUid === params.senderUid;
      const updatePayload: Record<string, any> = {
        lastMessageText: safeText.slice(0, 500),
        lastMessageSenderUid: params.senderUid,
        lastMessageTime: safeTime,
        participantOneName: isMeOne ? safeSenderName : cData.participantOneName,
        participantTwoName: isMeOne ? cData.participantTwoName : safeSenderName,
        updatedAt: serverTimestamp(),
      };
      if (params.senderAvatar) {
        if (isMeOne) {
          updatePayload.participantOneAvatar = String(params.senderAvatar).slice(0, 240000);
        } else {
          updatePayload.participantTwoAvatar = String(params.senderAvatar).slice(0, 240000);
        }
      }
      await updateDoc(chatRef, updatePayload);
    }
  } catch (error) {
    inFlightAndSentMessageKeys.delete(dedupeKey);
    handleFirestoreError(error, OperationType.CREATE, msgPath);
  }
}

export function subscribeToAuthorizedChatRooms(
  uid: string,
  onRoomsChanged: (
    rooms: Array<{
      chatId: string;
      otherUid: string;
      otherName: string;
      otherUsername: string;
      otherAvatar: string;
      lastMessageText: string;
      lastMessageTime: string;
      updatedAt?: number;
    }>
  ) => void
): () => void {
  if (!uid) return () => {};
  const path = 'chats';
  const q1 = query(
    collection(db, 'chats'),
    where('participantOneUid', '==', uid)
  );
  const q2 = query(
    collection(db, 'chats'),
    where('participantTwoUid', '==', uid)
  );

  const map1 = new Map<string, any>();
  const map2 = new Map<string, any>();

  const emitCombined = () => {
    const combined = new Map<string, any>([...map1, ...map2]);
    const list = Array.from(combined.values()).map((d) => {
      const isOne = d.participantOneUid === uid;
      const otherUid = String(isOne ? d.participantTwoUid : d.participantOneUid);
      const otherName = String(isOne ? d.participantTwoName : d.participantOneName);
      const rawOtherAvatar = String(
        isOne ? d.participantTwoAvatar || '' : d.participantOneAvatar || ''
      );
      return {
        chatId: String(d.chatId),
        otherUid,
        otherName,
        otherUsername: String(
          isOne ? d.participantTwoUsername : d.participantOneUsername
        ),
        otherAvatar: normalizeUserAvatarUrl(rawOtherAvatar, otherUid, otherName),
        lastMessageText: String(d.lastMessageText || ''),
        lastMessageTime: String(d.lastMessageTime || 'الآن'),
        updatedAt: d.updatedAt?.toMillis
          ? d.updatedAt.toMillis()
          : Number(d.updatedAt || 0),
      };
    });
    onRoomsChanged(list);
  };

  const unsub1 = onSnapshot(
    q1,
    (snap) => {
      map1.clear();
      snap.docs.forEach((docSnap) => map1.set(docSnap.id, docSnap.data()));
      emitCombined();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  const unsub2 = onSnapshot(
    q2,
    (snap) => {
      map2.clear();
      snap.docs.forEach((docSnap) => map2.set(docSnap.id, docSnap.data()));
      emitCombined();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  return () => {
    unsub1();
    unsub2();
  };
}

export function subscribeToAuthorizedDirectMessages(
  uid: string,
  chatId: string,
  onMessagesChanged: (
    messages: Array<{
      id: string;
      senderUid: string;
      recipientUid: string;
      senderName: string;
      senderUsername: string;
      senderAvatar?: string;
      text: string;
      messageType: 'text' | 'voice' | 'image' | 'file' | 'poll' | 'sticker';
      voiceDuration?: string;
      imageUrl?: string;
      imageCaption?: string;
      stickerId?: string;
      stickerEmoji?: string;
      stickerLabel?: string;
      stickerGradient?: string;
      stickerPackId?: string;
      displayTime: string;
      isStarred: boolean;
      isPinned: boolean;
      createdAtMs: number;
    }>
  ) => void
): () => void {
  if (!uid || !chatId) return () => {};
  const safeChatId = sanitizeDocId(chatId);
  const path = `chats/${safeChatId}/messages`;

  const qSent = query(
    collection(db, 'chats', safeChatId, 'messages'),
    where('senderUid', '==', uid)
  );
  const qReceived = query(
    collection(db, 'chats', safeChatId, 'messages'),
    where('recipientUid', '==', uid)
  );

  const sentMap = new Map<string, any>();
  const recvMap = new Map<string, any>();

  const emitMerged = () => {
    const merged = new Map<string, any>([...sentMap, ...recvMap]);
    const items = Array.from(merged.entries())
      .map(([id, d]) => {
        const msgType = (d.messageType || 'text') as
          | 'text'
          | 'voice'
          | 'image'
          | 'file'
          | 'poll'
          | 'sticker';
        let cleanText = String(d.text || '');
        if (msgType === 'voice') {
          cleanText = cleanText.replace(/\(undefined\)/gi, '').trim() || 'رسالة صوتية';
        }
        return {
          id,
          senderUid: String(d.senderUid || ''),
          recipientUid: String(d.recipientUid || ''),
          senderName: String(d.senderName || ''),
          senderUsername: String(d.senderUsername || ''),
          senderAvatar: d.senderAvatar ? String(d.senderAvatar) : undefined,
          text: cleanText,
          messageType: msgType,
          voiceDuration:
            msgType === 'voice'
              ? sanitizeVoiceDuration(d.voiceDuration)
              : undefined,
          imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
          imageCaption: d.imageCaption ? String(d.imageCaption) : undefined,
          stickerId: d.stickerId ? String(d.stickerId) : undefined,
          stickerEmoji: d.stickerEmoji ? String(d.stickerEmoji) : undefined,
          stickerLabel: d.stickerLabel ? String(d.stickerLabel) : undefined,
          stickerGradient: d.stickerGradient ? String(d.stickerGradient) : undefined,
          stickerPackId: d.stickerPackId ? String(d.stickerPackId) : undefined,
          displayTime: String(d.displayTime || 'الآن'),
          isStarred: Boolean(d.isStarred),
          isPinned: Boolean(d.isPinned),
          createdAtMs: d.createdAt?.toMillis
            ? d.createdAt.toMillis()
            : Number(d.createdAtMs || 0),
        };
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
    onMessagesChanged(items);
  };

  const unsub1 = onSnapshot(
    qSent,
    (snap) => {
      sentMap.clear();
      snap.docs.forEach((d) => sentMap.set(d.id, d.data()));
      emitMerged();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  const unsub2 = onSnapshot(
    qReceived,
    (snap) => {
      recvMap.clear();
      snap.docs.forEach((d) => recvMap.set(d.id, d.data()));
      emitMerged();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  return () => {
    unsub1();
    unsub2();
  };
}

// ============================================================================
// 5. OWNER WORKSPACE CONTACTS & MESSAGES (/users/{userId}/contacts/...)
// ============================================================================

export async function saveContactToFirestore(
  uid: string,
  contact: Contact
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) return;

  const safeContactId = sanitizeDocId(contact.uid || contact.id);
  const path = `users/${uid}/contacts/${safeContactId}`;
  const contactRef = doc(db, 'users', uid, 'contacts', safeContactId);

  const safeName = (contact.name || 'جهة اتصال').slice(0, 80);
  const safePhone = sanitizePhoneTag(contact.phone);
  const safeBio = (contact.bio || contact.roleOrBio || 'متاح للمحادثة').slice(
    0,
    200
  );
  const safeColor = (contact.avatarFallbackColor || 'bg-emerald-600').slice(
    0,
    40
  );
  const safeAvatar = normalizeUserAvatarUrl(
    contact.avatar,
    contact.uid || contact.id,
    safeName
  ).slice(0, 240000);
  const safeUsername = sanitizeUsername(contact.username || '').slice(0, 40);

  try {
    const parentUserSnap = await getDoc(doc(db, 'users', uid));
    if (!parentUserSnap.exists()) return;

    const snap = await getDoc(contactRef);
    if (!snap.exists()) {
      await setDoc(contactRef, {
        ownerUid: uid,
        contactName: safeName,
        contactPhone: safePhone,
        contactBio: safeBio,
        contactAvatar: safeAvatar,
        contactUsername: safeUsername,
        avatarFallbackColor: safeColor,
        isMuted: Boolean(contact.isMuted),
        isBlocked: Boolean(contact.isBlocked),
        isPinned: Boolean(contact.isPinned),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(contactRef, {
        contactName: safeName,
        contactBio: safeBio,
        contactAvatar: safeAvatar,
        contactUsername: safeUsername,
        isMuted: Boolean(contact.isMuted),
        isBlocked: Boolean(contact.isBlocked),
        isPinned: Boolean(contact.isPinned),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMessageToFirestore(
  uid: string,
  contactId: string,
  message: Message,
  fallbackSenderName: string
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) return;

  const safeContactId = sanitizeDocId(contactId);
  const safeMsgId = sanitizeDocId(message.id);
  const path = `users/${uid}/contacts/${safeContactId}/messages/${safeMsgId}`;
  const msgRef = doc(
    db,
    'users',
    uid,
    'contacts',
    safeContactId,
    'messages',
    safeMsgId
  );

  const validTypes = [
    'text',
    'voice',
    'image',
    'file',
    'poll',
    'sticker',
  ] as const;
  const safeType = validTypes.includes(message.type as any)
    ? message.type
    : 'text';

  try {
    const contactSnap = await getDoc(doc(db, 'users', uid, 'contacts', safeContactId));
    if (!contactSnap.exists()) return;

    await setDoc(msgRef, {
      ownerUid: uid,
      contactId: safeContactId,
      senderRole: message.senderId === 'me' ? 'me' : 'contact',
      senderName: (
        message.senderName ||
        (message.senderId === 'me' ? 'أنت' : fallbackSenderName) ||
        'مستخدم'
      ).slice(0, 80),
      text: (message.text || 'رسالة').slice(0, 2000),
      messageType: safeType,
      displayTime: (message.timestamp || 'الآن').slice(0, 40),
      isStarred: Boolean(message.isStarred),
      isPinned: Boolean(message.isPinned),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMessageFlagsInFirestore(
  uid: string,
  contactId: string,
  messageId: string,
  isStarred: boolean,
  isPinned: boolean
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) return;

  const safeContactId = sanitizeDocId(contactId);
  const safeMsgId = sanitizeDocId(messageId);
  const path = `users/${uid}/contacts/${safeContactId}/messages/${safeMsgId}`;
  const msgRef = doc(
    db,
    'users',
    uid,
    'contacts',
    safeContactId,
    'messages',
    safeMsgId
  );

  try {
    await updateDoc(msgRef, {
      isStarred: Boolean(isStarred),
      isPinned: Boolean(isPinned),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMessageFromFirestore(
  uid: string,
  contactId: string,
  messageId: string
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) return;

  const safeContactId = sanitizeDocId(contactId);
  const safeMsgId = sanitizeDocId(messageId);
  const path = `users/${uid}/contacts/${safeContactId}/messages/${safeMsgId}`;
  const msgRef = doc(
    db,
    'users',
    uid,
    'contacts',
    safeContactId,
    'messages',
    safeMsgId
  );

  try {
    await deleteDoc(msgRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Clears all messages in a conversation in Firestore after verifying current user authorization.
 * - If scope === 'me': records `clearedAtMs` on the user's contact record and deletes their private `/users/{uid}/contacts/{contactId}/messages` copies.
 * - If scope === 'both': also deletes the shared `/chats/{chatId}/messages` documents and resets `lastMessageText` on `/chats/{chatId}`.
 */
export async function clearConversationInFirestore(params: {
  myUid: string;
  contactId: string;
  otherUid?: string;
  scope: 'me' | 'both';
}): Promise<number> {
  if (!auth.currentUser || auth.currentUser.uid !== params.myUid) {
    throw new Error('غير مصرح لك بمسح هذه المحادثة. يرجى التحقق من تسجيل الدخول.');
  }
  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) {
    throw new Error('يرجى تسجيل الدخول مجدداً لتأكيد صلاحية مسح المحادثة.');
  }

  const nowMs = Date.now();
  const safeContactId = sanitizeDocId(params.contactId);
  const contactRef = doc(db, 'users', params.myUid, 'contacts', safeContactId);

  // 1. Delete owner-workspace messages & record clearedAtMs on contact doc
  try {
    const contactSnap = await getDoc(contactRef);
    if (contactSnap.exists() && contactSnap.data().ownerUid === params.myUid) {
      await updateDoc(contactRef, {
        clearedAtMs: nowMs,
        updatedAt: serverTimestamp(),
      });
      const qPrivateMsgs = query(
        collection(db, 'users', params.myUid, 'contacts', safeContactId, 'messages'),
        where('ownerUid', '==', params.myUid)
      );
      const privSnap = await getDocs(qPrivateMsgs);
      for (const mDoc of privSnap.docs) {
        await deleteDoc(mDoc.ref).catch(() => {});
      }
    }
  } catch {
    // non-fatal if contact wasn't persisted in subcollection yet
  }

  // 2. If scope === 'both' and this is a 2-participant chat room, delete shared messages in /chats/{chatId}/messages
  if (params.scope === 'both' && params.otherUid && params.otherUid !== params.myUid) {
    const chatId = buildDeterministicChatId(params.myUid, params.otherUid);
    const safeChatId = sanitizeDocId(chatId);
    const chatRef = doc(db, 'chats', safeChatId);
    try {
      const chatSnap = await getDoc(chatRef);
      if (
        chatSnap.exists() &&
        (chatSnap.data().participantOneUid === params.myUid ||
          chatSnap.data().participantTwoUid === params.myUid)
      ) {
        const qSent = query(
          collection(db, 'chats', safeChatId, 'messages'),
          where('senderUid', '==', params.myUid)
        );
        const qRecv = query(
          collection(db, 'chats', safeChatId, 'messages'),
          where('recipientUid', '==', params.myUid)
        );
        const [sSent, sRecv] = await Promise.all([getDocs(qSent), getDocs(qRecv)]);
        const allDocs = [...sSent.docs, ...sRecv.docs];
        for (const mDoc of allDocs) {
          await deleteDoc(mDoc.ref).catch(() => {});
        }
        await updateDoc(chatRef, {
          lastMessageText: '',
          lastMessageSenderUid: params.myUid,
          lastMessageTime: 'الآن',
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {
      // ignore if chat room doesn't exist in Firestore yet
    }
  }

  return nowMs;
}

/**
 * Deletes a specific conversation from the user's contact list in Firestore (and optionally clears messages for both sides).
 */
export async function deleteConversationFromFirestore(params: {
  myUid: string;
  contactId: string;
  otherUid?: string;
  scope: 'me' | 'both';
}): Promise<number> {
  const clearedAtMs = await clearConversationInFirestore(params);
  const safeContactId = sanitizeDocId(params.contactId);
  const contactRef = doc(db, 'users', params.myUid, 'contacts', safeContactId);
  try {
    const snap = await getDoc(contactRef);
    if (snap.exists() && snap.data().ownerUid === params.myUid) {
      await deleteDoc(contactRef);
    }
  } catch {
    // non-fatal
  }
  return clearedAtMs;
}

export function subscribeToUserContacts(
  uid: string,
  onContactsSnapshot: (
    cloudContacts: Array<{
      id: string;
      contactName: string;
      contactPhone: string;
      contactBio: string;
      contactAvatar: string;
      contactUsername: string;
      clearedAtMs: number;
      avatarFallbackColor: string;
      isMuted: boolean;
      isBlocked: boolean;
      isPinned: boolean;
    }>
  ) => void
) {
  const path = `users/${uid}/contacts`;
  const q = query(
    collection(db, 'users', uid, 'contacts'),
    where('ownerUid', '==', uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data();
        const contactName = String(data.contactName || '');
        return {
          id: d.id,
          contactName,
          contactPhone: formatDisplayPhone(String(data.contactPhone || '')),
          contactBio: String(data.contactBio || ''),
          contactAvatar: normalizeUserAvatarUrl(
            String(data.contactAvatar || ''),
            d.id,
            contactName
          ),
          contactUsername: String(data.contactUsername || ''),
          clearedAtMs: Number(data.clearedAtMs || 0),
          avatarFallbackColor: String(
            data.avatarFallbackColor || 'bg-emerald-600'
          ),
          isMuted: Boolean(data.isMuted),
          isBlocked: Boolean(data.isBlocked),
          isPinned: Boolean(data.isPinned),
        };
      });
      onContactsSnapshot(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Subscribes in real-time to a target user's public `/directory/{targetUid}` document
 * so that when the other user changes their profile picture, name, or bio,
 * it immediately updates in the chat list and chat header.
 */
export function subscribeToPublicDirectoryUser(
  targetUid: string,
  onProfileUpdate: (profile: PublicDirectoryUser) => void
): () => void {
  if (!auth.currentUser || !targetUid) return () => {};
  const safeUid = sanitizeDocId(targetUid);
  if (!safeUid || safeUid.startsWith('c') || safeUid.startsWith('u_')) {
    return () => {};
  }
  const dirRef = doc(db, 'directory', safeUid);
  return onSnapshot(
    dirRef,
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const displayName = String(d.displayName || d.username || '');
      onProfileUpdate({
        uid: String(d.uid || safeUid),
        username: String(d.username || ''),
        displayName,
        bio: String(d.bio || ''),
        avatarFallbackColor: String(d.avatarFallbackColor || 'bg-emerald-600'),
        emailVerified: Boolean(d.emailVerified),
        phoneVerified: false,
        avatarUrl: normalizeUserAvatarUrl(
          String(d.avatarUrl || ''),
          String(d.uid || safeUid),
          displayName
        ),
      });
    },
    () => {
      // Ignore permission or network errors on individual directory doc watch
    }
  );
}

export async function fetchUserProfileByUid(
  uid: string
): Promise<FirestoreUserProfileData | null> {
  return getOwnUserProfileFromFirestore(uid);
}

export function getDeterministicChatId(uidA: string, uidB: string): string {
  return buildDeterministicChatId(uidA, uidB);
}

export async function ensureAuthorizedChatRoomInFirestore(params: {
  myUid: string;
  otherUid: string;
  myName?: string;
  otherName?: string;
  myUsername?: string;
  otherUsername?: string;
  myAvatar?: string;
  otherAvatar?: string;
}): Promise<string> {
  const safeMyUsername =
    sanitizeUsername(params.myUsername || '') ||
    `user_${sanitizeDocId(params.myUid).slice(0, 8).toLowerCase()}`;
  const safeOtherUsername =
    sanitizeUsername(params.otherUsername || '') ||
    `user_${sanitizeDocId(params.otherUid).slice(0, 8).toLowerCase()}`;
  return createOrGetAuthorizedChatRoom({
    myUid: params.myUid,
    myName: params.myName || auth.currentUser?.displayName || safeMyUsername,
    myUsername: safeMyUsername,
    myAvatar: params.myAvatar,
    otherUid: params.otherUid,
    otherName: params.otherName || safeOtherUsername,
    otherUsername: safeOtherUsername,
    otherAvatar: params.otherAvatar,
  });
}

export async function sendDirectMessageToAuthorizedChat(params: {
  id?: string;
  senderUid: string;
  recipientUid: string;
  senderName: string;
  senderUsername?: string;
  senderAvatar?: string;
  recipientName?: string;
  recipientUsername?: string;
  text: string;
  type?: 'text' | 'voice' | 'image' | 'file' | 'poll' | 'sticker';
  voiceDuration?: string;
  imageUrl?: string;
  imageCaption?: string;
  stickerId?: string;
  stickerEmoji?: string;
  stickerLabel?: string;
  stickerGradient?: string;
  stickerPackId?: string;
  displayTime?: string;
}): Promise<void> {
  const chatId = await ensureAuthorizedChatRoomInFirestore({
    myUid: params.senderUid,
    otherUid: params.recipientUid,
    myName: params.senderName,
    myUsername: params.senderUsername,
    myAvatar: params.senderAvatar,
    otherName: params.recipientName,
    otherUsername: params.recipientUsername,
  });
  const msgId = params.id || `msg_${Date.now()}`;
  const timeStr =
    params.displayTime ||
    new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  const safeSenderUsername =
    sanitizeUsername(params.senderUsername || '') ||
    `user_${sanitizeDocId(params.senderUid).slice(0, 8).toLowerCase()}`;
  await sendAuthorizedMessageToChatRoom({
    chatId,
    messageId: msgId,
    senderUid: params.senderUid,
    recipientUid: params.recipientUid,
    senderName: params.senderName,
    senderUsername: safeSenderUsername,
    senderAvatar: params.senderAvatar,
    text: params.text,
    messageType: params.type || 'text',
    voiceDuration: params.voiceDuration,
    imageUrl: params.imageUrl,
    imageCaption: params.imageCaption,
    stickerId: params.stickerId,
    stickerEmoji: params.stickerEmoji,
    stickerLabel: params.stickerLabel,
    stickerGradient: params.stickerGradient,
    stickerPackId: params.stickerPackId,
    displayTime: timeStr,
  });
}

export function subscribeToAuthorizedChatMessages(
  chatId: string,
  onMessagesChanged: (
    messages: Array<{
      id: string;
      senderUid: string;
      recipientUid: string;
      senderName: string;
      senderAvatar?: string;
      text: string;
      displayTime: string;
      type: 'text' | 'voice' | 'image' | 'sticker';
      voiceDuration?: string;
      imageUrl?: string;
      imageCaption?: string;
      stickerId?: string;
      stickerEmoji?: string;
      stickerLabel?: string;
      stickerGradient?: string;
      stickerPackId?: string;
      isStarred?: boolean;
      isPinned?: boolean;
      createdAt: number;
    }>
  ) => void
): () => void {
  const uid = auth.currentUser?.uid || '';
  if (!uid || !chatId) return () => {};
  return subscribeToAuthorizedDirectMessages(uid, chatId, (items) => {
    onMessagesChanged(
      items.map((m) => ({
        id: m.id,
        senderUid: m.senderUid,
        recipientUid: m.recipientUid,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar,
        text: m.text,
        displayTime: m.displayTime,
        type:
          m.messageType === 'voice' ||
          m.messageType === 'image' ||
          m.messageType === 'sticker'
            ? m.messageType
            : 'text',
        voiceDuration: m.voiceDuration,
        imageUrl: m.imageUrl,
        imageCaption: m.imageCaption,
        stickerId: m.stickerId,
        stickerEmoji: m.stickerEmoji,
        stickerLabel: m.stickerLabel,
        stickerGradient: m.stickerGradient,
        stickerPackId: m.stickerPackId,
        isStarred: m.isStarred,
        isPinned: m.isPinned,
        createdAt: m.createdAtMs || Date.now(),
      }))
    );
  });
}

export function subscribeToFirestoreUsers(
  onUsersSnapshot: (
    cloudUsers: Array<{
      id: string;
      uid: string;
      name: string;
      phone: string;
      normalizedPhone: string;
      username: string;
      bio: string;
      avatar: string;
      clearedAtMs?: number;
      isOnline: boolean;
      lastSeen: string;
    }>
  ) => void
): () => void {
  const uid = auth.currentUser?.uid || '';
  if (!uid || !auth.currentUser?.emailVerified) return () => {};
  return subscribeToUserContacts(uid, (contacts) => {
    onUsersSnapshot(
      contacts.map((c) => ({
        id: c.id,
        uid: c.id,
        name: c.contactName,
        phone: c.contactPhone,
        normalizedPhone: c.contactPhone.replace(/\D/g, ''),
        username: c.contactUsername || sanitizeUsername(c.contactName) || c.id,
        bio: c.contactBio,
        avatar: c.contactAvatar,
        clearedAtMs: c.clearedAtMs,
        isOnline: true,
        lastSeen: 'موثق في Firestore',
      }))
    );
  });
}

/**
 * Subscribes to active 2-participant chat rooms so new incoming chat rooms appear in the user's contact list
 * without generating synthetic duplicate messages (`room_${chatId}`).
 */
export function subscribeToFirestoreMessages(
  onMessagesSnapshot: (
    cloudMsgs: Array<{
      id: string;
      senderPhone: string;
      senderName: string;
      recipientPhone: string;
      text: string;
      timestamp: string;
      type: 'text' | 'voice' | 'image' | 'sticker';
    }>
  ) => void
): () => void {
  // Intentionally returns a no-op for synthetic room messages so chat room metadata never creates fake messages.
  void onMessagesSnapshot;
  return () => {};
}

// Compatibility helpers used by App.tsx
export async function syncUserToFirestore(user: {
  name: string;
  phone: string;
  username?: string;
  email?: string;
  bio: string;
  avatar?: string;
  phoneVerified?: boolean;
}): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const uid = auth.currentUser.uid;
  let cleanUser =
    sanitizeUsername(user.username || '') ||
    sanitizeUsername((auth.currentUser.email || '').split('@')[0]) ||
    `user_${uid.slice(0, 6).toLowerCase()}`;

  const avail = await checkUsernameAvailability(cleanUser, uid).catch(() => ({
    available: true,
  }));
  if (!avail.available) {
    cleanUser = sanitizeUsername(
      `${cleanUser.slice(0, 20)}_${uid.slice(0, 5).toLowerCase()}`
    );
  }

  await reserveUsernameAndSaveProfileToFirestore({
    user: auth.currentUser,
    displayName: user.name,
    username: cleanUser,
    email: auth.currentUser.email || user.email || '',
    phoneTag: user.phone,
    bio: user.bio,
    wallpaperTheme: 'aurora-borealis',
    phoneVerified: false,
    avatarUrl: user.avatar,
  }).catch(() => {});
}

export async function syncContactToFirestore(contact: Contact): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  await saveContactToFirestore(auth.currentUser.uid, contact).catch(() => {});
}

export async function updateUserProfileAndSyncAvatarInFirestore(params: {
  uid?: string;
  name: string;
  phone: string;
  username?: string;
  email?: string;
  bio: string;
  avatarUrl: string;
}): Promise<void> {
  await syncUserToFirestore({
    name: params.name,
    phone: params.phone,
    username: params.username,
    email: params.email,
    bio: params.bio,
    avatar: params.avatarUrl,
    phoneVerified: false,
  });
}

export async function clearAuthorizedChatMessagesInFirestore(params: {
  myUid: string;
  otherUid?: string;
  contactId?: string;
  scope: 'me' | 'both';
}): Promise<number> {
  return clearConversationInFirestore({
    myUid: params.myUid,
    contactId: params.contactId || params.otherUid || 'chat',
    otherUid: params.otherUid,
    scope: params.scope,
  });
}

export async function deleteSavedContactFromFirestore(
  myUid: string,
  contactId: string,
  otherUid?: string,
  scope: 'me' | 'both' = 'me'
): Promise<number> {
  return deleteConversationFromFirestore({
    myUid,
    contactId,
    otherUid,
    scope,
  });
}

export function subscribeToSavedContacts(
  uid: string,
  onSavedContacts: (
    savedList: Array<{
      id: string;
      name: string;
      phone: string;
      bio: string;
      avatar: string;
      username: string;
      clearedAtMs: number;
      isMuted: boolean;
      isBlocked: boolean;
      isPinned: boolean;
    }>
  ) => void
): () => void {
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
    return () => {};
  }
  return subscribeToUserContacts(uid, (items) => {
    onSavedContacts(
      items.map((c) => ({
        id: c.id,
        name: c.contactName,
        phone: c.contactPhone,
        bio: c.contactBio,
        avatar: c.contactAvatar,
        username: c.contactUsername,
        clearedAtMs: c.clearedAtMs,
        isMuted: c.isMuted,
        isBlocked: c.isBlocked,
        isPinned: c.isPinned,
      }))
    );
  });
}

export async function sendMessageToFirestore(msg: {
  id: string;
  senderPhone: string;
  senderName: string;
  senderAvatar?: string;
  recipientPhone: string;
  recipientUid?: string;
  senderUsername?: string;
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
}): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const myUid = auth.currentUser.uid;
  await saveMessageToFirestore(
    myUid,
    msg.recipientUid || msg.recipientPhone,
    {
      id: msg.id,
      senderId: 'me',
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar,
      text: msg.text,
      timestamp: msg.timestamp,
      status: 'sent',
      type: msg.type,
      voiceDuration: msg.voiceDuration,
      imageUrl: msg.imageUrl,
      imageCaption: msg.imageCaption,
      stickerId: msg.stickerId,
      stickerEmoji: msg.stickerEmoji,
      stickerLabel: msg.stickerLabel,
      stickerGradient: msg.stickerGradient,
      stickerPackId: msg.stickerPackId,
      reactions: [],
    },
    msg.senderName
  ).catch(() => {});
}

export async function editDirectMessageInFirestore(params: {
  myUid: string;
  otherUid?: string;
  chatId?: string;
  messageId: string;
  newText: string;
}): Promise<boolean> {
  if (!auth.currentUser || !params.messageId || !params.newText.trim()) return false;
  const myUid = params.myUid || auth.currentUser.uid;
  const newText = params.newText.trim();
  const effectiveChatId =
    params.chatId ||
    (params.otherUid && myUid !== params.otherUid
      ? buildDeterministicChatId(myUid, params.otherUid)
      : '');

  let updated = false;
  if (effectiveChatId) {
    try {
      const msgRef = doc(db, 'chats', effectiveChatId, 'messages', params.messageId);
      await updateDoc(msgRef, {
        text: newText,
        isEdited: true,
        editedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updated = true;
    } catch {
      // non-fatal
    }
  }

  if (params.otherUid) {
    try {
      const contactMsgRef = doc(
        db,
        'users',
        myUid,
        'contacts',
        params.otherUid,
        'messages',
        params.messageId
      );
      await updateDoc(contactMsgRef, {
        text: newText,
        isEdited: true,
        editedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updated = true;
    } catch {
      // non-fatal
    }
  }

  return updated;
}

export async function changeUsernameInFirestore(params: {
  myUid: string;
  currentUsername: string;
  newUsername: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!auth.currentUser || auth.currentUser.uid !== params.myUid) {
    return { success: false, error: 'غير مصرح بتنفيذ هذه العملية دون تسجيل دخول صالح.' };
  }
  const cleanNewUser = sanitizeUsername(params.newUsername);
  if (!isValidUsernameFormat(cleanNewUser)) {
    return {
      success: false,
      error: 'اسم المستخدم يجب أن يكون بين 3 و30 حرفاً (أحرف إنجليزية صغيرة، أرقام، أو _).',
    };
  }

  const cleanOldUser = sanitizeUsername(params.currentUsername);
  if (cleanNewUser === cleanOldUser) {
    return { success: true };
  }

  const avail = await checkUsernameAvailability(cleanNewUser, params.myUid);
  if (!avail.available) {
    return {
      success: false,
      error: 'اسم المستخدم محجوز ومستخدم بالفعل من قبل حساب آخر.',
    };
  }

  const newUnameRef = doc(db, 'usernames', cleanNewUser);
  const userRef = doc(db, 'users', params.myUid);
  const dirRef = doc(db, 'directory', params.myUid);

  try {
    // 1. Create new username reservation
    await setDoc(newUnameRef, {
      uid: params.myUid,
      username: cleanNewUser,
      displayName: params.displayName || cleanNewUser,
      bio: params.bio || '',
      avatarFallbackColor: 'bg-emerald-600',
      avatarUrl: params.avatarUrl || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Update user private profile
    await updateDoc(userRef, {
      username: cleanNewUser,
      updatedAt: serverTimestamp(),
    });

    // 3. Update public directory
    await updateDoc(dirRef, {
      username: cleanNewUser,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    // 4. Delete old username reservation
    if (cleanOldUser && cleanOldUser !== cleanNewUser) {
      await deleteDoc(doc(db, 'usernames', cleanOldUser)).catch(() => {});
    }

    cacheUsernameEmailMapping(cleanNewUser, auth.currentUser.email || '');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'تعذر تغيير اسم المستخدم في Firestore.',
    };
  }
}

export async function changeUserEmailInFirebaseAuth(newEmail: string): Promise<{
  success: boolean;
  message: string;
}> {
  if (!auth.currentUser) {
    return {
      success: false,
      message: 'يجب تسجيل الدخول أولاً لتغيير البريد الإلكتروني.',
    };
  }
  const cleanEmail = String(newEmail || '').trim().toLowerCase();
  const validCheck = validateEmailWithArabicReason(cleanEmail);
  if (!validCheck.valid) {
    return {
      success: false,
      message: validCheck.reason || 'صيغة البريد الإلكتروني غير صحيحة.',
    };
  }

  try {
    if (typeof verifyBeforeUpdateEmail === 'function') {
      await verifyBeforeUpdateEmail(auth.currentUser, cleanEmail);
      return {
        success: true,
        message: `تم إرسال رابط تأكيد إلى "${cleanEmail}". يرجى فتح البريد الإلكتروني والضغط على الرابط لإتمام التحديث بأمان.`,
      };
    } else {
      await updateEmail(auth.currentUser, cleanEmail);
      await sendEmailVerification(auth.currentUser).catch(() => {});
      return {
        success: true,
        message: `تم تحديث البريد الإلكتروني إلى "${cleanEmail}". يرجى تأكيد البريد الجديد من رسالة التحقق.`,
      };
    }
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/requires-recent-login') {
      return {
        success: false,
        message:
          'لأسباب أمنية في Firebase، تتطلب هذه العملية إعادة تسجيل الدخول حديثاً. يرجى تسجيل الخروج ثم الدخول مجدداً.',
      };
    }
    if (code === 'auth/email-already-in-use') {
      return {
        success: false,
        message: 'هذا البريد الإلكتروني مسجل بالفعل بحساب آخر.',
      };
    }
    if (code === 'auth/invalid-email') {
      return {
        success: false,
        message: 'صيغة البريد الإلكتروني غير صالحة.',
      };
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'تعذر إرسال طلب تحديث البريد الإلكتروني حالياً.',
    };
  }
}

/**
 * Sets the real-time typing status of the current user in a specific Firestore chat room.
 * Ephemeral document stored at chats/{chatId}/typing/{userId}.
 */
export async function setTypingStatusInFirestore(
  chatId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    return;
  }
  const safeChatId = sanitizeDocId(chatId);
  const safeUid = sanitizeDocId(uid);
  if (!safeChatId || !safeUid) return;

  const typingPath = `chats/${safeChatId}/typing/${safeUid}`;
  const typingRef = doc(db, 'chats', safeChatId, 'typing', safeUid);

  try {
    await setDoc(
      typingRef,
      {
        chatId: safeChatId,
        uid: safeUid,
        isTyping: Boolean(isTyping),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, typingPath);
    } catch {
      // Ephemeral write fail ignored to keep typing responsive
    }
  }
}

/**
 * Subscribes to real-time typing status of the other participant in a Firestore chat room.
 * Invokes callback with boolean `isTyping`.
 */
export function subscribeToTypingStatusInFirestore(
  chatId: string,
  otherUid: string,
  onTypingChanged: (isTyping: boolean) => void
): () => void {
  const safeChatId = sanitizeDocId(chatId);
  const safeOtherUid = sanitizeDocId(otherUid);
  if (!safeChatId || !safeOtherUid) {
    onTypingChanged(false);
    return () => {};
  }

  const typingPath = `chats/${safeChatId}/typing/${safeOtherUid}`;
  const typingRef = doc(db, 'chats', safeChatId, 'typing', safeOtherUid);

  const unsubscribe = onSnapshot(
    typingRef,
    (snap) => {
      if (!snap.exists()) {
        onTypingChanged(false);
        return;
      }
      const data = snap.data();
      const isTyping = Boolean(data?.isTyping);
      if (!isTyping) {
        onTypingChanged(false);
        return;
      }

      const updatedAtVal = data?.updatedAt;
      let updatedAtMs = Date.now();
      if (updatedAtVal?.toMillis) {
        updatedAtMs = updatedAtVal.toMillis();
      } else if (updatedAtVal?.seconds) {
        updatedAtMs = updatedAtVal.seconds * 1000;
      }
      // Guard against client/server clock drifts with 15s window
      const isFresh = !updatedAtVal || Math.abs(Date.now() - updatedAtMs) < 15000;
      onTypingChanged(isFresh);
    },
    (error) => {
      onTypingChanged(false);
      try {
        handleFirestoreError(error, OperationType.GET, typingPath);
      } catch {
        // Ignored
      }
    }
  );

  return unsubscribe;
}


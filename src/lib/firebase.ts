import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  applyActionCode,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
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
  // Only treat as phone search if input has at least 7 digits and no letters
  if (/[a-zA-Z\u0600-\u06FF]/.test(ascii)) {
    return [];
  }
  const digitsOnly = ascii.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 16) {
    return [];
  }

  const candidates = new Set<string>();

  const primary = normalizePhoneToE164(ascii, preferredCountryCode);
  if (primary.valid && primary.e164) {
    candidates.add(primary.e164);
  }

  // If user typed a full international number without '+'
  if (!digitsOnly.startsWith('0') && digitsOnly.length >= 9 && digitsOnly.length <= 15) {
    candidates.add(`+${digitsOnly}`);
  }

  // If user typed a local number starting with 0 (e.g. 010... or 05...), also test common regional country codes
  const localPart = digitsOnly.replace(/^0+/, '');
  if (localPart.length >= 7 && localPart.length <= 11) {
    for (const cc of ['20', '966', '971', '965', '974', '962', '964', '212', '1']) {
      const cand = `+${cc}${localPart}`;
      if (/^\+[1-9]\d{6,14}$/.test(cand)) {
        candidates.add(cand);
      }
    }
  }

  return Array.from(candidates).slice(0, 4);
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
}

export interface PublicDirectoryUser {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  avatarFallbackColor: string;
  emailVerified: boolean;
  phoneVerified: boolean;
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
  const emailVerified = Boolean(auth.currentUser.emailVerified || params.user.emailVerified);
  // Phone number is a regular profile field for search only (never marked verified via SMS)
  const phoneVerified = false;

  const userRef = doc(db, 'users', uid);
  const dirRef = doc(db, 'directory', uid);
  let previousPhoneTag = '';

  // If a legacy user document exists from an older schema (missing uid/createdAt/wallpaperTheme),
  // clean it up first so the transaction creates a strictly compliant UserProfile document.
  try {
    const existingUserSnap = await getDoc(userRef);
    if (existingUserSnap.exists()) {
      const uData = existingUserSnap.data();
      previousPhoneTag = String(uData.phoneTag || uData.phone || '').trim();
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.update(effectiveUsernameRef, {
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (phoneSnap.data().uid === uid) {
        await updateDoc(phoneRef, {
          username: resolvedUsername,
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch {
    // Non-fatal if another user already indexed the same unverified phone number
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
    return {
      uid: String(d.uid || uid),
      displayName: String(d.displayName || d.name || ''),
      username: String(d.username || ''),
      email: String(d.email || auth.currentUser?.email || ''),
      phoneTag: formatDisplayPhone(String(d.phoneTag || d.phone || '')),
      bio: String(d.bio || ''),
      wallpaperTheme: (d.wallpaperTheme as WallpaperThemeId) || 'aurora-borealis',
      emailVerified: Boolean(d.emailVerified ?? auth.currentUser?.emailVerified),
      phoneVerified: false,
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
        return {
          uid: String(d.uid || uid),
          displayName: String(d.displayName || d.name || ''),
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
        };
      } catch {
        // Fall through
      }
    }
    handleFirestoreError(error, OperationType.GET, path);
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
    const usernamePath = `usernames/${candidateUsername}`;
    try {
      const unameSnap = await getDoc(doc(db, 'usernames', candidateUsername));
      if (unameSnap.exists()) {
        const targetUid = String(unameSnap.data().uid || '');
        if (targetUid) {
          const dirSnap = await getDoc(doc(db, 'directory', targetUid));
          if (dirSnap.exists()) {
            const d = dirSnap.data();
            const found: PublicDirectoryUser = {
              uid: String(d.uid || targetUid),
              username: String(d.username || candidateUsername),
              displayName: String(d.displayName || candidateUsername),
              bio: String(d.bio || ''),
              avatarFallbackColor: String(
                d.avatarFallbackColor || 'bg-emerald-600'
              ),
              emailVerified: Boolean(d.emailVerified),
              phoneVerified: false,
            };
            lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
            return found;
          }
          const uData = unameSnap.data();
          const found: PublicDirectoryUser = {
            uid: targetUid,
            username: String(uData.username || candidateUsername),
            displayName: String(uData.displayName || candidateUsername),
            bio: String(uData.bio || ''),
            avatarFallbackColor: String(
              uData.avatarFallbackColor || 'bg-emerald-600'
            ),
            emailVerified: true,
            phoneVerified: false,
          };
          lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
          return found;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, usernamePath);
    }
  }

  // 2. Try lookup by normalized phone number in /phone_index/{phoneKey}
  const phoneCandidates = buildNormalizedPhoneSearchCandidates(
    trimmed,
    preferredCountryCode
  );
  for (const phoneKey of phoneCandidates) {
    const phonePath = `phone_index/${phoneKey}`;
    try {
      const phoneSnap = await getDoc(doc(db, 'phone_index', phoneKey));
      if (phoneSnap.exists()) {
        const pData = phoneSnap.data();
        const targetUid = String(pData.uid || '');
        if (targetUid) {
          const dirSnap = await getDoc(doc(db, 'directory', targetUid));
          if (dirSnap.exists()) {
            const d = dirSnap.data();
            const found: PublicDirectoryUser = {
              uid: String(d.uid || targetUid),
              username: String(d.username || pData.username || ''),
              displayName: String(d.displayName || pData.displayName || ''),
              bio: String(d.bio || pData.bio || ''),
              avatarFallbackColor: String(
                d.avatarFallbackColor || pData.avatarFallbackColor || 'bg-emerald-600'
              ),
              emailVerified: Boolean(d.emailVerified),
              phoneVerified: false,
            };
            lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
            return found;
          }
          const found: PublicDirectoryUser = {
            uid: targetUid,
            username: String(pData.username || ''),
            displayName: String(pData.displayName || ''),
            bio: String(pData.bio || ''),
            avatarFallbackColor: String(
              pData.avatarFallbackColor || 'bg-emerald-600'
            ),
            emailVerified: true,
            phoneVerified: false,
          };
          lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
          return found;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, phonePath);
    }
  }

  // 3. Try lookup by exact Firebase Auth UID in /directory/{uid}
  const candidateUid = trimmed.replace(/^@+/, '');
  if (
    /^[a-zA-Z0-9_-]{6,128}$/.test(candidateUid) &&
    phoneCandidates.length === 0
  ) {
    const dirPath = `directory/${candidateUid}`;
    try {
      const dirSnap = await getDoc(doc(db, 'directory', candidateUid));
      if (dirSnap.exists()) {
        const d = dirSnap.data();
        const found: PublicDirectoryUser = {
          uid: String(d.uid || candidateUid),
          username: String(d.username || ''),
          displayName: String(d.displayName || ''),
          bio: String(d.bio || ''),
          avatarFallbackColor: String(
            d.avatarFallbackColor || 'bg-emerald-600'
          ),
          emailVerified: Boolean(d.emailVerified),
          phoneVerified: false,
        };
        lastSearchQueryCache = { query: cacheKey, result: found, ts: Date.now() };
        return found;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, dirPath);
    }
  }

  // 4. Fallback to backend privacy-preserving search endpoint (supports searching legacy profiles by normalized phone or username)
  try {
    const res = await fetch(
      `/api/users/search?q=${encodeURIComponent(trimmed)}&cc=${encodeURIComponent(preferredCountryCode)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.user?.uid) {
        const found: PublicDirectoryUser = {
          uid: String(data.user.uid),
          username: String(data.user.username || ''),
          displayName: String(data.user.name || data.user.displayName || ''),
          bio: String(data.user.bio || ''),
          avatarFallbackColor: 'bg-emerald-600',
          emailVerified: Boolean(data.user.emailVerified ?? true),
          phoneVerified: false,
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
  otherUid: string;
  otherName: string;
  otherUsername: string;
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
  const participantOneUsername = sanitizeUsername(
    isMeFirst ? params.myUsername : params.otherUsername
  );
  const participantTwoUsername = sanitizeUsername(
    isMeFirst ? params.otherUsername : params.myUsername
  );

  try {
    // Verify target user exists in /directory/{otherUid}
    const targetDirSnap = await getDoc(doc(db, 'directory', params.otherUid));
    if (!targetDirSnap.exists()) {
      throw new Error(
        'هذا المستخدم غير موجود في قاعدة بيانات Firestore المعتمدة.'
      );
    }

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
        createdByUid: params.myUid,
        lastMessageText: 'بدأت محادثة آمنة وموثقة 👋',
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

export async function sendAuthorizedMessageToChatRoom(params: {
  chatId: string;
  messageId: string;
  senderUid: string;
  recipientUid: string;
  senderName: string;
  senderUsername: string;
  text: string;
  messageType: 'text' | 'voice' | 'image' | 'file' | 'poll' | 'sticker';
  displayTime: string;
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== params.senderUid) {
    throw new Error('غير مصرح لك بإرسال رسائل قبل التحقق من هويتك.');
  }
  if (!auth.currentUser.emailVerified) {
    throw new Error('يرجى تأكيد البريد الإلكتروني أولاً قبل إرسال الرسائل.');
  }
  const hasValidToken = await ensureValidAuthTokenForFirestore({
    requireEmailVerifiedClaim: true,
  });
  if (!hasValidToken || !auth.currentUser) {
    throw new Error(
      'يرجى تسجيل الدخول مرة أخرى لتحديث جلسة الأمان قبل إرسال الرسائل.'
    );
  }

  const safeChatId = sanitizeDocId(params.chatId);
  const safeMsgId = sanitizeDocId(params.messageId);
  const msgPath = `chats/${safeChatId}/messages/${safeMsgId}`;
  const msgRef = doc(db, 'chats', safeChatId, 'messages', safeMsgId);
  const chatRef = doc(db, 'chats', safeChatId);

  const safeText = (params.text || 'رسالة').slice(0, 2000);
  const safeSenderName = (params.senderName || 'مستخدم').slice(0, 80);
  const safeSenderUsername =
    sanitizeUsername(params.senderUsername) || 'user_chat';
  const safeTime = (params.displayTime || 'الآن').slice(0, 40);

  try {
    await setDoc(msgRef, {
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
    });

    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const cData = chatSnap.data();
      await updateDoc(chatRef, {
        lastMessageText: safeText.slice(0, 500),
        lastMessageSenderUid: params.senderUid,
        lastMessageTime: safeTime,
        participantOneName: cData.participantOneName,
        participantTwoName: cData.participantTwoName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
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
      lastMessageText: string;
      lastMessageTime: string;
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
      return {
        chatId: String(d.chatId),
        otherUid: String(isOne ? d.participantTwoUid : d.participantOneUid),
        otherName: String(isOne ? d.participantTwoName : d.participantOneName),
        otherUsername: String(
          isOne ? d.participantTwoUsername : d.participantOneUsername
        ),
        lastMessageText: String(d.lastMessageText || ''),
        lastMessageTime: String(d.lastMessageTime || 'الآن'),
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
      text: string;
      messageType: 'text' | 'voice' | 'image' | 'file' | 'poll' | 'sticker';
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
      .map(([id, d]) => ({
        id,
        senderUid: String(d.senderUid || ''),
        recipientUid: String(d.recipientUid || ''),
        senderName: String(d.senderName || ''),
        senderUsername: String(d.senderUsername || ''),
        text: String(d.text || ''),
        messageType: (d.messageType || 'text') as
          | 'text'
          | 'voice'
          | 'image'
          | 'file'
          | 'poll'
          | 'sticker',
        displayTime: String(d.displayTime || 'الآن'),
        isStarred: Boolean(d.isStarred),
        isPinned: Boolean(d.isPinned),
        createdAtMs: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0,
      }))
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

  const safeContactId = sanitizeDocId(contact.id);
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

export function subscribeToUserContacts(
  uid: string,
  onContactsSnapshot: (
    cloudContacts: Array<{
      id: string;
      contactName: string;
      contactPhone: string;
      contactBio: string;
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
        return {
          id: d.id,
          contactName: String(data.contactName || ''),
          contactPhone: String(data.contactPhone || ''),
          contactBio: String(data.contactBio || ''),
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
    otherUid: params.otherUid,
    otherName: params.otherName || safeOtherUsername,
    otherUsername: safeOtherUsername,
  });
}

export async function sendDirectMessageToAuthorizedChat(params: {
  id?: string;
  senderUid: string;
  recipientUid: string;
  senderName: string;
  senderUsername?: string;
  recipientName?: string;
  recipientUsername?: string;
  text: string;
  type?: 'text' | 'voice' | 'image' | 'file' | 'poll' | 'sticker';
  displayTime?: string;
}): Promise<void> {
  const chatId = await ensureAuthorizedChatRoomInFirestore({
    myUid: params.senderUid,
    otherUid: params.recipientUid,
    myName: params.senderName,
    myUsername: params.senderUsername,
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
    text: params.text,
    messageType: params.type || 'text',
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
      text: string;
      displayTime: string;
      type: 'text' | 'voice' | 'image' | 'sticker';
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
        text: m.text,
        displayTime: m.displayTime,
        type:
          m.messageType === 'voice' ||
          m.messageType === 'image' ||
          m.messageType === 'sticker'
            ? m.messageType
            : 'text',
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
        username: sanitizeUsername(c.contactName) || c.id,
        bio: c.contactBio,
        avatar: '',
        isOnline: true,
        lastSeen: 'موثق في Firestore',
      }))
    );
  });
}

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
  const uid = auth.currentUser?.uid || '';
  if (!uid || !auth.currentUser?.emailVerified) return () => {};
  return subscribeToAuthorizedChatRooms(uid, (rooms) => {
    onMessagesSnapshot(
      rooms
        .filter((r) => Boolean(r.lastMessageText))
        .map((r) => ({
          id: `room_${r.chatId}`,
          senderPhone: r.otherUid,
          senderName: r.otherName,
          recipientPhone: uid,
          text: r.lastMessageText,
          timestamp: r.lastMessageTime,
          type: 'text' as const,
        }))
    );
  });
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
  }).catch(() => {});
}

export async function syncContactToFirestore(contact: Contact): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  await saveContactToFirestore(auth.currentUser.uid, contact).catch(() => {});
}

export async function sendMessageToFirestore(msg: {
  id: string;
  senderPhone: string;
  senderName: string;
  recipientPhone: string;
  recipientUid?: string;
  senderUsername?: string;
  text: string;
  timestamp: string;
  type: 'text' | 'voice' | 'image' | 'sticker';
}): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const myUid = auth.currentUser.uid;
  if (msg.recipientUid && msg.recipientUid !== myUid) {
    const chatId = buildDeterministicChatId(myUid, msg.recipientUid);
    await sendAuthorizedMessageToChatRoom({
      chatId,
      messageId: msg.id,
      senderUid: myUid,
      recipientUid: msg.recipientUid,
      senderName: msg.senderName,
      senderUsername: msg.senderUsername || 'user_chat',
      text: msg.text,
      messageType: msg.type,
      displayTime: msg.timestamp,
    }).catch(() => {});
  }
  await saveMessageToFirestore(
    myUid,
    msg.recipientUid || msg.recipientPhone,
    {
      id: msg.id,
      senderId: 'me',
      senderName: msg.senderName,
      text: msg.text,
      timestamp: msg.timestamp,
      status: 'sent',
      type: msg.type,
      reactions: [],
    },
    msg.senderName
  ).catch(() => {});
}

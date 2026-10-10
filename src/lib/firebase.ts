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
  updateProfile,
  onAuthStateChanged,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  signInWithPhoneNumber,
  ConfirmationResult,
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
export type { User, ConfirmationResult };

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

export function sanitizePhoneTag(rawPhone: string): string {
  const digits = String(rawPhone || '')
    .replace(/[^0-9+]/g, '')
    .slice(0, 20);
  return digits.length >= 7 ? digits : '+201000000000';
}

export function isValidEmailFormat(email: string): boolean {
  const trimmed = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 120;
}

export function isValidUsernameFormat(username: string): boolean {
  const clean = String(username || '').trim().replace(/^@+/, '');
  return /^[a-z0-9_]{3,30}$/.test(clean);
}

export function isValidPhoneE164Format(countryCode: string, localDigits: string): {
  valid: boolean;
  e164: string;
  reason?: string;
} {
  const cleanCode = String(countryCode || '+20').replace(/[^0-9+]/g, '');
  const normalizedDigits = String(localDigits || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^0+/, '');

  if (normalizedDigits.length < 7 || normalizedDigits.length > 14) {
    return {
      valid: false,
      e164: `${cleanCode}${normalizedDigits}`,
      reason: 'يرجى إدخال رقم هاتف صحيح (من 7 إلى 14 رقماً بدون الصفر الابتدائي).',
    };
  }

  const e164 = `${cleanCode.startsWith('+') ? cleanCode : `+${cleanCode}`}${normalizedDigits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    return {
      valid: false,
      e164,
      reason: 'صيغة رقم الهاتف الدولية (E.164) غير صالحة. تأكد من رمز الدولة والرقم.',
    };
  }

  return { valid: true, e164 };
}

export function translateFirebaseAuthError(error: unknown): string {
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  const code = (error as { code?: string })?.code || rawMsg;

  if (rawMsg.includes('USERNAME_TAKEN')) {
    return 'اسم المستخدم (Username) محجوز ومستخدم بالفعل من قبل حساب آخر. يرجى اختيار اسم مستخدم فريد.';
  }
  if (rawMsg.includes('EMAIL_ALREADY_REGISTERED')) {
    return 'البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استعادة كلمة المرور.';
  }
  if (rawMsg.includes('USERNAME_NOT_FOUND')) {
    return 'اسم المستخدم هذا غير مسجل. تأكد من كتابته بشكل صحيح أو سجّل الدخول بالبريد الإلكتروني.';
  }
  if (code.includes('auth/email-already-in-use')) {
    return 'البريد الإلكتروني مسجل بالفعل في Firebase Authentication. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.';
  }
  if (code.includes('auth/invalid-email')) {
    return 'صيغة البريد الإلكتروني غير صحيحة. يرجى كتابة بريد إلكتروني صالح.';
  }
  if (code.includes('auth/weak-password')) {
    return 'كلمة المرور ضعيفة. يجب أن تتكون من 8 أحرف على الأقل وتحتوي على أحرف وأرقام.';
  }
  if (
    code.includes('auth/user-not-found') ||
    code.includes('auth/wrong-password') ||
    code.includes('auth/invalid-credential')
  ) {
    return 'بيانات تسجيل الدخول غير صحيحة (البريد الإلكتروني أو كلمة المرور غير مطابقة).';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'تم إيقاف المحاولات مؤقتاً لحماية الحساب بسبب كثرة الطلبات المتتالية. يرجى المحاولة بعد دقائق.';
  }
  if (code.includes('auth/invalid-verification-code')) {
    return 'رمز التحقق (OTP) غير صحيح. يرجى التأكد من الأرقام الستة المرسلة إلى هاتفك.';
  }
  if (code.includes('auth/code-expired')) {
    return 'انتهت صلاحية رمز التحقق (OTP). يرجى الضغط على "إعادة إرسال رمز التحقق".';
  }
  if (code.includes('auth/invalid-phone-number')) {
    return 'رقم الهاتف غير صالح. تأكد من اختيار رمز الدولة الصحيح وإدخال الرقم بدون أخطاء.';
  }
  if (
    code.includes('auth/credential-already-in-use') ||
    code.includes('auth/phone-number-already-exists') ||
    code.includes('auth/account-exists-with-different-credential')
  ) {
    return 'رقم الهاتف أو البريد الإلكتروني مرتبط بالفعل بحساب مستخدم آخر.';
  }
  if (code.includes('auth/operation-not-allowed')) {
    return 'طريقة المصادقة هذه (Email/Password أو Phone SMS) غير مفعّلة بعد في Firebase Console. يرجى تفعيلها من Authentication > Sign-in method في لوحة تحكم Firebase، أو استخدام تسجيل الدخول عبر Google.';
  }
  if (
    code.includes('auth/billing-not-enabled') ||
    code.includes('auth/quota-exceeded')
  ) {
    return 'إرسال رسائل SMS الفعلية عبر Firebase Phone Auth يتطلب تفعيل خطة Blaze في Firebase Console أو إضافة الرقم ضمن "Phone numbers for testing" في إعدادات Phone Auth.';
  }
  if (
    code.includes('auth/captcha-check-failed') ||
    code.includes('auth/invalid-app-credential') ||
    code.includes('auth/missing-app-credential')
  ) {
    return 'تعذر التحقق من reCAPTCHA لإرسال رسالة SMS. تأكد من إضافة نطاق الموقع الحالي ضمن Authorized domains في Firebase Console > Authentication > Settings.';
  }
  if (code.includes('auth/popup-closed-by-user')) {
    return 'تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية.';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'خطأ في الاتصال بالشبكة. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
  }
  if (code.includes('auth/requires-recent-login')) {
    return 'لأسباب أمنية، يرجى تسجيل الخروج ثم تسجيل الدخول مجدداً لإتمام هذه العملية الحساسة.';
  }

  return rawMsg || 'حدث خطأ غير متوقع أثناء الاتصال بـ Firebase. يرجى المحاولة مرة أخرى.';
}

// ============================================================================
// 1. REAL FIREBASE AUTHENTICATION OPERATIONS
// ============================================================================

export async function signInWithGoogleCloud(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
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

export async function reloadAndCheckCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

let activeRecaptchaVerifier: RecaptchaVerifier | null = null;

export function clearRecaptchaVerifier(): void {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {
      // ignore cleanup error
    }
    activeRecaptchaVerifier = null;
  }
}

export async function sendPhoneOtpViaFirebase(
  phoneE164: string,
  recaptchaContainerId: string
): Promise<ConfirmationResult> {
  clearRecaptchaVerifier();
  const container = document.getElementById(recaptchaContainerId);
  if (container) {
    container.innerHTML = '';
  }

  activeRecaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
    size: 'normal',
  });

  await activeRecaptchaVerifier.render();

  if (auth.currentUser) {
    return await linkWithPhoneNumber(
      auth.currentUser,
      phoneE164,
      activeRecaptchaVerifier
    );
  }
  return await signInWithPhoneNumber(
    auth,
    phoneE164,
    activeRecaptchaVerifier
  );
}

export async function confirmPhoneOtpViaFirebase(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<User> {
  const cleanCode = String(otpCode || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw { code: 'auth/invalid-verification-code' };
  }
  const result = await confirmationResult.confirm(cleanCode);
  if (auth.currentUser) {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
  }
  clearRecaptchaVerifier();
  return result.user;
}

export async function signOutFromCloud(): Promise<void> {
  clearRecaptchaVerifier();
  await signOut(auth);
}

export async function logoutFromFirebase(): Promise<void> {
  await signOutFromCloud();
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
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

  // 1. If authenticated in Firebase, query Firestore /usernames/{username} directly
  if (auth.currentUser) {
    const path = `usernames/${cleanUsername}`;
    try {
      const snap = await getDocFromServer(doc(db, 'usernames', cleanUsername));
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
  const uid = params.user.uid;
  const cleanUsername = sanitizeUsername(params.username);
  if (!isValidUsernameFormat(cleanUsername)) {
    throw new Error(
      'اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفاً (أحرف إنجليزية صغيرة، أرقام، أو _ فقط).'
    );
  }

  const safeDisplayName = (params.displayName || cleanUsername)
    .trim()
    .slice(0, 80);
  const safeEmail = (params.user.email || params.email || '')
    .trim()
    .toLowerCase()
    .slice(0, 120);
  const safePhone = sanitizePhoneTag(
    params.user.phoneNumber || params.phoneTag
  );
  const safeBio = (params.bio || 'متاح للمحادثة عبر SAHPY-CHAT ✨')
    .trim()
    .slice(0, 200);
  const safeColor = (params.avatarFallbackColor || 'bg-emerald-600').slice(
    0,
    40
  );
  const emailVerified = Boolean(params.user.emailVerified);
  const phoneVerified = Boolean(
    params.phoneVerified || params.user.phoneNumber
  );

  const usernameRef = doc(db, 'usernames', cleanUsername);
  const userRef = doc(db, 'users', uid);
  const dirRef = doc(db, 'directory', uid);

  try {
    await runTransaction(db, async (transaction) => {
      const usernameSnap = await transaction.get(usernameRef);
      const userSnap = await transaction.get(userRef);
      const dirSnap = await transaction.get(dirRef);

      if (usernameSnap.exists()) {
        const existingOwnerUid = String(usernameSnap.data().uid || '');
        if (existingOwnerUid && existingOwnerUid !== uid) {
          throw new Error('USERNAME_TAKEN');
        }
      }

      // If the user already had an older username, keep their immutable username
      const effectiveUsername = userSnap.exists()
        ? String(userSnap.data().username || cleanUsername)
        : cleanUsername;

      const effectiveUsernameRef = doc(db, 'usernames', effectiveUsername);

      if (!usernameSnap.exists() && effectiveUsername === cleanUsername) {
        transaction.set(effectiveUsernameRef, {
          uid,
          username: effectiveUsername,
          displayName: safeDisplayName,
          bio: safeBio,
          avatarFallbackColor: safeColor,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (effectiveUsername === cleanUsername) {
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

  return {
    uid,
    displayName: safeDisplayName,
    username: cleanUsername,
    email: safeEmail,
    phoneTag: safePhone,
    bio: safeBio,
    wallpaperTheme: params.wallpaperTheme,
    emailVerified,
    phoneVerified,
  };
}

export async function getOwnUserProfileFromFirestore(
  uid: string
): Promise<FirestoreUserProfileData | null> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return null;
  const path = `users/${uid}`;
  try {
    const snap = await getDocFromServer(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid || uid),
      displayName: String(d.displayName || ''),
      username: String(d.username || ''),
      email: String(d.email || ''),
      phoneTag: String(d.phoneTag || ''),
      bio: String(d.bio || ''),
      wallpaperTheme: (d.wallpaperTheme as WallpaperThemeId) || 'aurora-borealis',
      emailVerified: Boolean(d.emailVerified),
      phoneVerified: Boolean(d.phoneVerified),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// ============================================================================
// 3. SEARCH REGISTERED USERS IN FIRESTORE BY @USERNAME OR UID
// ============================================================================

export async function findRegisteredUserInFirestore(
  rawQuery: string
): Promise<PublicDirectoryUser | null> {
  if (!auth.currentUser) return null;
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed) return null;

  // 1. Try lookup by exact @username in /usernames/{username}
  const candidateUsername = sanitizeUsername(trimmed);
  if (isValidUsernameFormat(candidateUsername)) {
    const usernamePath = `usernames/${candidateUsername}`;
    try {
      const unameSnap = await getDocFromServer(
        doc(db, 'usernames', candidateUsername)
      );
      if (unameSnap.exists()) {
        const targetUid = String(unameSnap.data().uid || '');
        if (targetUid) {
          const dirSnap = await getDocFromServer(doc(db, 'directory', targetUid));
          if (dirSnap.exists()) {
            const d = dirSnap.data();
            return {
              uid: String(d.uid || targetUid),
              username: String(d.username || candidateUsername),
              displayName: String(d.displayName || candidateUsername),
              bio: String(d.bio || ''),
              avatarFallbackColor: String(
                d.avatarFallbackColor || 'bg-emerald-600'
              ),
              emailVerified: Boolean(d.emailVerified),
              phoneVerified: Boolean(d.phoneVerified),
            };
          }
          // Fallback to data from /usernames/{username} if /directory doc is being synced
          const uData = unameSnap.data();
          return {
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
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, usernamePath);
    }
  }

  // 2. Try lookup by exact Firebase Auth UID in /directory/{uid}
  const candidateUid = trimmed.replace(/^@+/, '');
  if (/^[a-zA-Z0-9_-]{6,128}$/.test(candidateUid)) {
    const dirPath = `directory/${candidateUid}`;
    try {
      const dirSnap = await getDocFromServer(doc(db, 'directory', candidateUid));
      if (dirSnap.exists()) {
        const d = dirSnap.data();
        return {
          uid: String(d.uid || candidateUid),
          username: String(d.username || ''),
          displayName: String(d.displayName || ''),
          bio: String(d.bio || ''),
          avatarFallbackColor: String(
            d.avatarFallbackColor || 'bg-emerald-600'
          ),
          emailVerified: Boolean(d.emailVerified),
          phoneVerified: Boolean(d.phoneVerified),
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, dirPath);
    }
  }

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
    const targetDirSnap = await getDocFromServer(
      doc(db, 'directory', params.otherUid)
    );
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
    const snap = await getDocFromServer(contactRef);
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
  return createOrGetAuthorizedChatRoom({
    myUid: params.myUid,
    myName: params.myName || auth.currentUser?.displayName || 'مستخدم',
    myUsername: params.myUsername || 'user_chat',
    otherUid: params.otherUid,
    otherName: params.otherName || params.otherUsername || 'مستخدم',
    otherUsername: params.otherUsername || 'user_chat',
  });
}

export async function sendDirectMessageToAuthorizedChat(params: {
  id?: string;
  senderUid: string;
  recipientUid: string;
  senderName: string;
  senderUsername?: string;
  text: string;
  type?: 'text' | 'voice' | 'image' | 'file' | 'poll' | 'sticker';
  displayTime?: string;
}): Promise<void> {
  const chatId = buildDeterministicChatId(params.senderUid, params.recipientUid);
  const msgId = params.id || `msg_${Date.now()}`;
  const timeStr =
    params.displayTime ||
    new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  await sendAuthorizedMessageToChatRoom({
    chatId,
    messageId: msgId,
    senderUid: params.senderUid,
    recipientUid: params.recipientUid,
    senderName: params.senderName,
    senderUsername: params.senderUsername || 'user_chat',
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
  const cleanUser =
    sanitizeUsername(user.username || '') ||
    sanitizeUsername((auth.currentUser.email || '').split('@')[0]) ||
    `user_${auth.currentUser.uid.slice(0, 6).toLowerCase()}`;
  await reserveUsernameAndSaveProfileToFirestore({
    user: auth.currentUser,
    displayName: user.name,
    username: cleanUser,
    email: auth.currentUser.email || user.email || '',
    phoneTag: user.phone,
    bio: user.bio,
    wallpaperTheme: 'aurora-borealis',
    phoneVerified: Boolean(user.phoneVerified || auth.currentUser.phoneNumber),
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

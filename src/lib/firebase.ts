import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Contact, Message, WallpaperThemeId } from '../types/chat';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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

function sanitizeDocId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || 'item_1';
}

function sanitizePhoneTag(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/[^0-9+]/g, '').slice(0, 20);
  return digits.length >= 7 ? digits : '01094823190';
}

export async function signInWithGoogleCloud(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutFromCloud(): Promise<void> {
  await signOut(auth);
}

// Ensure UserProfile document exists in /users/{userId}
export async function syncUserProfileToFirestore(
  user: User,
  phoneTag: string,
  bio: string,
  wallpaperTheme: WallpaperThemeId
): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const safeDisplayName = (user.displayName || 'مستخدم SAHPY-CHAT').slice(0, 80);
  const safePhone = sanitizePhoneTag(phoneTag);
  const safeBio = (bio || 'متاح للمحادثة عبر SAHPY-CHAT').slice(0, 200);

  try {
    const snap = await getDocFromServer(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: safeDisplayName,
        phoneTag: safePhone,
        bio: safeBio,
        wallpaperTheme,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: safeDisplayName,
        phoneTag: safePhone,
        bio: safeBio,
        wallpaperTheme,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Save or update a contact under /users/{userId}/contacts/{contactId}
export async function saveContactToFirestore(
  uid: string,
  contact: Contact
): Promise<void> {
  const safeContactId = sanitizeDocId(contact.id);
  const path = `users/${uid}/contacts/${safeContactId}`;
  const contactRef = doc(db, 'users', uid, 'contacts', safeContactId);

  const safeName = (contact.name || 'جهة اتصال').slice(0, 80);
  const safePhone = sanitizePhoneTag(contact.phone);
  const safeBio = (contact.bio || 'متاح للمحادثة').slice(0, 200);
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

// Save a message under /users/{userId}/contacts/{contactId}/messages/{messageId}
export async function saveMessageToFirestore(
  uid: string,
  contactId: string,
  message: Message,
  fallbackSenderName: string
): Promise<void> {
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

  const validTypes = ['text', 'voice', 'image', 'file', 'poll'] as const;
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

// Update message star/pin state in Firestore
export async function updateMessageFlagsInFirestore(
  uid: string,
  contactId: string,
  messageId: string,
  isStarred: boolean,
  isPinned: boolean
): Promise<void> {
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

// Delete message from Firestore
export async function deleteMessageFromFirestore(
  uid: string,
  contactId: string,
  messageId: string
): Promise<void> {
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

// Subscribe to user's saved contacts in Firestore
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

// Convenience wrappers used by App.tsx
export async function syncUserToFirestore(user: {
  name: string;
  phone: string;
  bio: string;
  avatar?: string;
}): Promise<void> {
  if (!auth.currentUser) return;
  await syncUserProfileToFirestore(
    auth.currentUser,
    user.phone,
    user.bio,
    'aurora-borealis'
  ).catch(() => {});
}

export async function syncContactToFirestore(contact: Contact): Promise<void> {
  if (!auth.currentUser) return;
  await saveContactToFirestore(auth.currentUser.uid, contact).catch(() => {});
}

export async function sendMessageToFirestore(msg: {
  id: string;
  senderPhone: string;
  senderName: string;
  recipientPhone: string;
  text: string;
  timestamp: string;
  type: 'text' | 'voice' | 'image' | 'sticker';
}): Promise<void> {
  if (!auth.currentUser) return;
  await saveMessageToFirestore(
    auth.currentUser.uid,
    msg.recipientPhone,
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

export function subscribeToFirestoreUsers(
  _callback: (
    users: Array<{
      id: string;
      name: string;
      phone: string;
      normalizedPhone: string;
      bio: string;
      avatar: string;
      isOnline: boolean;
      lastSeen: string;
    }>
  ) => void
): () => void {
  return () => {};
}

export function subscribeToFirestoreMessages(
  _callback: (
    messages: Array<{
      id: string;
      senderPhone: string;
      senderName: string;
      recipientPhone: string;
      text: string;
      timestamp: string;
      type: 'text' | 'voice' | 'image';
    }>
  ) => void
): () => void {
  return () => {};
}


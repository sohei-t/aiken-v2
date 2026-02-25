import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import type { User as FirebaseUser, Auth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp, writeBatch, increment, limit as firestoreLimit } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { uploadToDrive, deleteFromDrive, downloadPublicFile } from './driveApi';
import type {
  UserData,
  CustomerData,
  Classroom,
  Content,
  WatchHistoryEntry,
  WatchHistoryMap,
  Quiz,
  QuizResult,
  DashboardStats,
  CustomerProgress,
  CustomerSettings,
  FileUploadResult,
  DriveDeleteResults,
} from '../types';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Platform admin email
const PLATFORM_ADMIN_EMAIL = 'pontaro.no1@gmail.com';

// ── Helper: customer-scoped collection path ──
const customerDoc = (customerId: string) => doc(db, 'customers', customerId);
const customerCollection = (customerId: string, collectionName: string) =>
  collection(db, 'customers', customerId, collectionName);
const customerDocRef = (customerId: string, collectionName: string, docId: string) =>
  doc(db, 'customers', customerId, collectionName, docId);

// Detect in-app browsers
export const isInAppBrowser = (): boolean => {
  const ua = navigator.userAgent || '';
  return /Line|LIFF|FBAN|FBAV|Instagram|Twitter|MicroMessenger/i.test(ua);
};

// ══════════════════════════════════════════
// Auth functions
// ══════════════════════════════════════════

export const signInWithGoogle = async (): Promise<FirebaseUser> => {
  if (isInAppBrowser()) {
    throw new Error(
      'アプリ内ブラウザではGoogleログインを使用できません。' +
      '画面右下の「…」メニューから「ブラウザで開く」を選択するか、' +
      'メールアドレスでログインしてください。'
    );
  }
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(result.user);
  return result.user;
};

export const signInWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const signUpWithEmail = async (email: string, password: string, displayName: string): Promise<FirebaseUser> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(result.user, displayName);
  return result.user;
};

export const logout = (): Promise<void> => signOut(auth);

export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('ユーザーが見つかりません');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

// ══════════════════════════════════════════
// User document management
// ══════════════════════════════════════════

export const ensureUserDocument = async (user: FirebaseUser, displayName: string | null = null): Promise<DocumentReference> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: displayName || user.displayName || user.email!.split('@')[0],
      role: isPlatformAdmin ? 'admin' : 'user',
      customerId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else if (isPlatformAdmin && userSnap.data().role !== 'admin') {
    await updateDoc(userRef, { role: 'admin', updatedAt: serverTimestamp() });
  }
  return userRef;
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } as UserData : null;
};

export const updateUserRole = async (uid: string, role: string): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role, updatedAt: serverTimestamp() });
};

export const getAllUsers = async (): Promise<UserData[]> => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
};

export const createUserByAdmin = async (
  email: string,
  password: string,
  displayName: string,
  customerId: string | null = null
): Promise<UserData> => {
  const secondaryApp = initializeApp(firebaseConfig, 'secondary');
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const result = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = result.user;
    await setDoc(doc(db, 'users', newUser.uid), {
      email: newUser.email,
      displayName: displayName || email.split('@')[0],
      role: 'user',
      customerId: customerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await secondaryAuth.signOut();
    return {
      id: newUser.uid,
      email: newUser.email!,
      displayName: displayName || email.split('@')[0],
      role: 'user',
      customerId
    };
  } finally {
    await deleteApp(secondaryApp);
  }
};

export const deleteUser = async (uid: string): Promise<void> => {
  const batch = writeBatch(db);
  const historyRef = collection(db, 'users', uid, 'watchHistory');
  const historyDocs = await getDocs(historyRef);
  historyDocs.forEach(histDoc => batch.delete(histDoc.ref));
  batch.delete(doc(db, 'users', uid));
  await batch.commit();
};

// ══════════════════════════════════════════
// Customer (tenant) management
// ══════════════════════════════════════════

export const getCustomer = async (customerId: string): Promise<CustomerData | null> => {
  const ref = customerDoc(customerId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } as CustomerData : null;
};

export const createCustomer = async (data: Record<string, unknown>): Promise<string> => {
  const customersRef = collection(db, 'customers');
  const docRef = await addDoc(customersRef, {
    ...data,
    plan: 'trial',
    trialStartedAt: serverTimestamp(),
    trialExpiresAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const updateCustomer = async (customerId: string, data: Record<string, unknown>): Promise<void> => {
  const ref = customerDoc(customerId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

// Assign user to customer
export const assignUserToCustomer = async (uid: string, customerId: string): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { customerId, updatedAt: serverTimestamp() });
};

// ══════════════════════════════════════════
// Classroom functions (customer-scoped)
// ══════════════════════════════════════════

export const getClassrooms = async (
  customerId: string | null,
  isAdmin: boolean = false,
  parentClassroomId?: string | null
): Promise<Classroom[]> => {
  if (!customerId) return [];
  const classroomsRef = customerCollection(customerId, 'classrooms');
  let q;

  if (isAdmin) {
    q = query(classroomsRef, orderBy('order', 'asc'));
  } else {
    q = query(classroomsRef, where('accessType', 'in', ['public', 'free']));
  }

  const snapshot = await getDocs(q);
  let classrooms = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as Classroom))
    .filter(c => c.isActive !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (parentClassroomId !== undefined) {
    classrooms = classrooms.filter(c => c.parentClassroomId === parentClassroomId);
  }

  return classrooms;
};

export const getRootClassrooms = async (customerId: string | null, isAdmin: boolean = false): Promise<Classroom[]> => {
  return getClassrooms(customerId, isAdmin, null);
};

export const getClassroom = async (customerId: string | null, classroomId: string): Promise<Classroom | null> => {
  if (!customerId) return null;
  const ref = customerDocRef(customerId, 'classrooms', classroomId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } as Classroom : null;
};

export const createClassroom = async (
  customerId: string,
  data: Record<string, unknown>,
  creatorId: string,
  parentClassroomId: string | null = null
): Promise<string> => {
  const classroomsRef = customerCollection(customerId, 'classrooms');

  let depth = 0;
  if (parentClassroomId) {
    const parentClassroom = await getClassroom(customerId, parentClassroomId);
    if (!parentClassroom) throw new Error('親教室が見つかりません');
    if (parentClassroom.depth >= 2) throw new Error('階層は3階層までです');
    depth = parentClassroom.depth + 1;
  }

  const docRef = await addDoc(classroomsRef, {
    ...data,
    parentClassroomId: parentClassroomId || null,
    depth,
    childCount: 0,
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    contentCount: 0,
    isActive: true
  });

  if (parentClassroomId) {
    const parentRef = customerDocRef(customerId, 'classrooms', parentClassroomId);
    await updateDoc(parentRef, {
      childCount: increment(1),
      updatedAt: serverTimestamp()
    });
  }

  return docRef.id;
};

export const updateClassroom = async (customerId: string, classroomId: string, data: Record<string, unknown>): Promise<void> => {
  const ref = customerDocRef(customerId, 'classrooms', classroomId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

// Collect classroom tree recursively
const collectClassroomTree = async (customerId: string, classroomId: string): Promise<string[]> => {
  const ids = [classroomId];
  const childrenQuery = query(
    customerCollection(customerId, 'classrooms'),
    where('parentClassroomId', '==', classroomId)
  );
  const childrenSnap = await getDocs(childrenQuery);
  for (const childDoc of childrenSnap.docs) {
    const descendantIds = await collectClassroomTree(customerId, childDoc.id);
    ids.push(...descendantIds);
  }
  return ids;
};

// Delete Drive file helper
const tryDeleteDriveFile = async (fileId: string, label: string = ''): Promise<boolean> => {
  try {
    await deleteFromDrive(auth, fileId);
    return true;
  } catch (e) {
    console.error(`[Drive] FAILED to delete ${label}: ${fileId}`, e);
    return false;
  }
};

// Delete contents by classroom IDs
const deleteContentsByClassroomIds = async (customerId: string, classroomIds: string[]): Promise<string[]> => {
  const driveFailures: string[] = [];
  for (const cid of classroomIds) {
    const contentsQuery = query(
      customerCollection(customerId, 'contents'),
      where('classroomId', '==', cid)
    );
    const contentsSnap = await getDocs(contentsQuery);
    for (const contentDoc of contentsSnap.docs) {
      const data = contentDoc.data();
      if (data.htmlFileId) {
        const ok = await tryDeleteDriveFile(data.htmlFileId, `html[${contentDoc.id}]`);
        if (!ok) driveFailures.push(data.htmlFileId);
      }
      if (data.mp3FileId) {
        const ok = await tryDeleteDriveFile(data.mp3FileId, `mp3[${contentDoc.id}]`);
        if (!ok) driveFailures.push(data.mp3FileId);
      }
    }
    const batch = writeBatch(db);
    contentsSnap.docs.forEach(d => batch.delete(d.ref));
    if (contentsSnap.docs.length > 0) await batch.commit();
  }
  return driveFailures;
};

export const deleteClassroom = async (customerId: string, classroomId: string): Promise<void> => {
  const classroom = await getClassroom(customerId, classroomId);
  if (!classroom) throw new Error('教室が見つかりません');

  const allIds = await collectClassroomTree(customerId, classroomId);
  await deleteContentsByClassroomIds(customerId, allIds);

  const batch = writeBatch(db);
  for (const id of allIds) {
    batch.delete(customerDocRef(customerId, 'classrooms', id));
  }

  if (classroom.parentClassroomId) {
    const parentRef = customerDocRef(customerId, 'classrooms', classroom.parentClassroomId);
    const parentSnap = await getDoc(parentRef);
    if (parentSnap.exists()) {
      batch.update(parentRef, {
        childCount: increment(-1),
        updatedAt: serverTimestamp()
      });
    }
  }

  await batch.commit();
};

export const deleteClassrooms = async (customerId: string, classroomIds: string[]): Promise<void> => {
  const allIdsSet = new Set<string>();
  const classroomData: Record<string, Classroom> = {};

  for (const classroomId of classroomIds) {
    const ids = await collectClassroomTree(customerId, classroomId);
    ids.forEach(id => allIdsSet.add(id));
    const classroom = await getClassroom(customerId, classroomId);
    if (classroom) classroomData[classroomId] = classroom;
  }

  const allIds = Array.from(allIdsSet);
  await deleteContentsByClassroomIds(customerId, allIds);

  for (let i = 0; i < allIds.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = allIds.slice(i, i + 400);
    chunk.forEach(id => batch.delete(customerDocRef(customerId, 'classrooms', id)));

    if (i === 0) {
      const parentUpdates: Record<string, number> = {};
      for (const classroomId of classroomIds) {
        const data = classroomData[classroomId];
        if (data?.parentClassroomId && !allIdsSet.has(data.parentClassroomId)) {
          parentUpdates[data.parentClassroomId] = (parentUpdates[data.parentClassroomId] || 0) + 1;
        }
      }
      for (const [parentId, count] of Object.entries(parentUpdates)) {
        batch.update(customerDocRef(customerId, 'classrooms', parentId), {
          childCount: increment(-count),
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
  }
};

// Get child classrooms
export const getChildClassrooms = async (customerId: string | null, parentId: string, isAdmin: boolean = false): Promise<Classroom[]> => {
  if (!customerId) return [];
  const q = query(
    customerCollection(customerId, 'classrooms'),
    where('parentClassroomId', '==', parentId)
  );
  const snapshot = await getDocs(q);
  let classrooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Classroom));

  if (!isAdmin) {
    classrooms = classrooms.filter(c => c.isActive !== false && c.accessType !== 'draft');
  }

  return classrooms.sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Get classroom hierarchy (for breadcrumb)
export const getClassroomHierarchy = async (customerId: string | null, classroomId: string): Promise<Classroom[]> => {
  const hierarchy: Classroom[] = [];
  let currentId: string | null = classroomId;
  while (currentId) {
    const classroom = await getClassroom(customerId, currentId);
    if (!classroom) break;
    hierarchy.unshift(classroom);
    currentId = classroom.parentClassroomId;
  }
  return hierarchy;
};

export const canCreateChildClassroom = async (customerId: string | null, parentId: string | null): Promise<boolean> => {
  if (!parentId) return true;
  const parentClassroom = await getClassroom(customerId, parentId);
  if (!parentClassroom) return false;
  return parentClassroom.depth < 2;
};

// Bulk update classroom orders
export const updateClassroomOrders = async (customerId: string, orderedClassrooms: Classroom[]): Promise<void> => {
  const batch = writeBatch(db);
  orderedClassrooms.forEach((classroom, index) => {
    const ref = customerDocRef(customerId, 'classrooms', classroom.id);
    batch.update(ref, { order: index, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};

// ══════════════════════════════════════════
// Content functions (customer-scoped)
// ══════════════════════════════════════════

export const getContents = async (customerId: string | null, classroomId: string): Promise<Content[]> => {
  if (!customerId) return [];
  const contentsRef = customerCollection(customerId, 'contents');
  const q = query(contentsRef, where('classroomId', '==', classroomId), where('isActive', '==', true), orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Content));
};

export const getContent = async (customerId: string | null, contentId: string): Promise<Content | null> => {
  if (!customerId) return null;
  const ref = customerDocRef(customerId, 'contents', contentId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } as Content : null;
};

export const createContent = async (
  customerId: string,
  data: Record<string, unknown>,
  classroomId: string,
  creatorId: string
): Promise<string> => {
  const contentsRef = customerCollection(customerId, 'contents');
  const docRef = await addDoc(contentsRef, {
    ...data,
    classroomId,
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: true
  });

  const classroomRef = customerDocRef(customerId, 'classrooms', classroomId);
  const classroomSnap = await getDoc(classroomRef);
  if (classroomSnap.exists()) {
    await updateDoc(classroomRef, {
      contentCount: (classroomSnap.data().contentCount || 0) + 1,
      updatedAt: serverTimestamp()
    });
  }

  return docRef.id;
};

export const deleteContent = async (customerId: string, contentId: string): Promise<void> => {
  const ref = customerDocRef(customerId, 'contents', contentId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const content = snap.data();
    const driveFailures: string[] = [];

    if (content.htmlFileId) {
      const ok = await tryDeleteDriveFile(content.htmlFileId, `html[${contentId}]`);
      if (!ok) driveFailures.push(content.htmlFileId);
    }
    if (content.mp3FileId) {
      const ok = await tryDeleteDriveFile(content.mp3FileId, `mp3[${contentId}]`);
      if (!ok) driveFailures.push(content.mp3FileId);
    }

    const classroomRef = customerDocRef(customerId, 'classrooms', content.classroomId);
    const classroomSnap = await getDoc(classroomRef);
    if (classroomSnap.exists()) {
      await updateDoc(classroomRef, {
        contentCount: Math.max(0, (classroomSnap.data().contentCount || 1) - 1),
        updatedAt: serverTimestamp()
      });
    }

    await deleteDoc(ref);

    if (driveFailures.length > 0) {
      throw new Error(`コンテンツは削除しましたが、Google Driveのファイル ${driveFailures.length}件の削除に失敗しました`);
    }
  }
};

export const deleteContents = async (customerId: string, contentIds: string[]): Promise<void> => {
  const contents: Array<{ id: string } & Record<string, unknown>> = [];
  for (const contentId of contentIds) {
    const ref = customerDocRef(customerId, 'contents', contentId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      contents.push({ id: contentId, ...snap.data() });
    }
  }

  const driveFailures: string[] = [];
  for (const content of contents) {
    if (content.htmlFileId) {
      const ok = await tryDeleteDriveFile(content.htmlFileId as string, `html[${content.id}]`);
      if (!ok) driveFailures.push(content.htmlFileId as string);
    }
    if (content.mp3FileId) {
      const ok = await tryDeleteDriveFile(content.mp3FileId as string, `mp3[${content.id}]`);
      if (!ok) driveFailures.push(content.mp3FileId as string);
    }
  }

  const classroomCounts: Record<string, number> = {};
  contents.forEach(content => {
    if (content.classroomId) {
      const cid = content.classroomId as string;
      classroomCounts[cid] = (classroomCounts[cid] || 0) + 1;
    }
  });

  const batch = writeBatch(db);
  for (const contentId of contentIds) {
    batch.delete(customerDocRef(customerId, 'contents', contentId));
  }

  for (const [classroomId, count] of Object.entries(classroomCounts)) {
    const classroomRef = customerDocRef(customerId, 'classrooms', classroomId);
    const classroomSnap = await getDoc(classroomRef);
    if (classroomSnap.exists()) {
      const currentCount = classroomSnap.data().contentCount || 0;
      batch.update(classroomRef, {
        contentCount: Math.max(0, currentCount - count),
        updatedAt: serverTimestamp()
      });
    }
  }

  await batch.commit();

  if (driveFailures.length > 0) {
    throw new Error(`コンテンツは削除しましたが、Google Driveのファイル ${driveFailures.length}件の削除に失敗しました`);
  }
};

// Bulk update content orders
export const updateContentOrders = async (customerId: string, orderedContents: Content[]): Promise<void> => {
  const batch = writeBatch(db);
  orderedContents.forEach((content, index) => {
    const ref = customerDocRef(customerId, 'contents', content.id);
    batch.update(ref, { order: index, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};

// ══════════════════════════════════════════
// Storage / Drive functions
// ══════════════════════════════════════════

export const uploadFile = async (file: File, classroomId: string): Promise<FileUploadResult> => {
  const result = await uploadToDrive(auth, file, classroomId);
  return {
    path: result.fileId,
    url: result.url,
    fileId: result.fileId
  };
};

export const fetchMp3AsBlob = async (fileId: string): Promise<string> => {
  return downloadPublicFile(fileId);
};

// ══════════════════════════════════════════
// Access control
// ══════════════════════════════════════════

export const hasClassroomAccess = async (
  customerId: string | null,
  userId: string | undefined,
  classroomId: string,
  isAdmin: boolean = false
): Promise<boolean> => {
  if (isAdmin) return true;
  const classroom = await getClassroom(customerId, classroomId);
  if (!classroom) return false;
  return classroom.accessType === 'public' || classroom.accessType === 'free';
};

// ══════════════════════════════════════════
// Watch History
// ══════════════════════════════════════════

const WATCH_HISTORY_STORAGE_KEY = 'viewerWatchHistory';

interface LocalWatchHistoryEntry {
  watchedAt: string;
  lastWatchedAt: string;
}

export const recordWatchHistory = async (userId: string | undefined, contentId: string): Promise<void> => {
  const now = new Date().toISOString();

  if (userId) {
    try {
      const historyRef = doc(db, 'users', userId, 'watchHistory', contentId);
      await setDoc(historyRef, {
        watchedAt: serverTimestamp(),
        lastWatchedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('[WatchHistory] Failed to save to Firestore:', e);
    }
  }

  try {
    const stored = localStorage.getItem(WATCH_HISTORY_STORAGE_KEY);
    const history: Record<string, LocalWatchHistoryEntry> = stored ? JSON.parse(stored) : {};
    history[contentId] = {
      watchedAt: history[contentId]?.watchedAt || now,
      lastWatchedAt: now
    };
    localStorage.setItem(WATCH_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('[WatchHistory] Failed to save to localStorage:', e);
  }
};

export const getWatchHistory = async (userId: string | undefined | null, contentIds: string[]): Promise<WatchHistoryMap> => {
  const result: WatchHistoryMap = {};

  try {
    const stored = localStorage.getItem(WATCH_HISTORY_STORAGE_KEY);
    if (stored) {
      const localHistory: Record<string, LocalWatchHistoryEntry> = JSON.parse(stored);
      contentIds.forEach(id => {
        if (localHistory[id]) {
          result[id] = {
            watchedAt: new Date(localHistory[id].watchedAt),
            lastWatchedAt: new Date(localHistory[id].lastWatchedAt),
            source: 'local'
          };
        }
      });
    }
  } catch (e) {
    console.warn('[WatchHistory] Failed to read from localStorage:', e);
  }

  if (userId) {
    try {
      const historyRef = collection(db, 'users', userId, 'watchHistory');
      const snapshot = await getDocs(historyRef);
      snapshot.docs.forEach(d => {
        const id = d.id;
        if (contentIds.includes(id)) {
          const data = d.data();
          result[id] = {
            watchedAt: data.watchedAt?.toDate() || result[id]?.watchedAt,
            lastWatchedAt: data.lastWatchedAt?.toDate() || result[id]?.lastWatchedAt,
            source: 'firestore'
          };
        }
      });
    } catch (e) {
      console.warn('[WatchHistory] Failed to read from Firestore:', e);
    }
  }

  return result;
};

// ══════════════════════════════════════════
// Maintenance utilities
// ══════════════════════════════════════════

export const cleanupOrphanedClassrooms = async (customerId: string): Promise<number> => {
  const classroomsRef = customerCollection(customerId, 'classrooms');
  const snapshot = await getDocs(classroomsRef);
  const allClassrooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Classroom));
  const classroomIds = new Set(allClassrooms.map(c => c.id));

  const orphans = allClassrooms.filter(c =>
    c.parentClassroomId && !classroomIds.has(c.parentClassroomId)
  );

  if (orphans.length === 0) return 0;

  const batch = writeBatch(db);
  for (const orphan of orphans) {
    batch.update(customerDocRef(customerId, 'classrooms', orphan.id), {
      parentClassroomId: null,
      depth: 0,
      updatedAt: serverTimestamp()
    });
  }
  await batch.commit();
  return orphans.length;
};

export const syncContentCounts = async (customerId: string): Promise<number> => {
  const classroomsSnap = await getDocs(customerCollection(customerId, 'classrooms'));
  const batch = writeBatch(db);
  let updated = 0;

  for (const classroomDoc of classroomsSnap.docs) {
    const contentsQuery = query(
      customerCollection(customerId, 'contents'),
      where('classroomId', '==', classroomDoc.id)
    );
    const contentsSnap = await getDocs(contentsQuery);

    let activeCount = 0;
    for (const contentDoc of contentsSnap.docs) {
      const data = contentDoc.data();
      if (data.isActive === undefined || data.isActive === null) {
        batch.update(contentDoc.ref, { isActive: true });
        updated++;
      }
      if (data.isActive !== false) activeCount++;
    }

    const storedCount = classroomDoc.data().contentCount || 0;
    if (activeCount !== storedCount) {
      batch.update(classroomDoc.ref, {
        contentCount: activeCount,
        updatedAt: serverTimestamp()
      });
      updated++;
    }
  }

  if (updated > 0) await batch.commit();
  return updated;
};

export const getAllReferencedDriveFileIds = async (customerId: string): Promise<string[]> => {
  const contentsRef = customerCollection(customerId, 'contents');
  const snapshot = await getDocs(contentsRef);
  const fileIds = new Set<string>();
  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.htmlFileId) fileIds.add(data.htmlFileId);
    if (data.mp3FileId) fileIds.add(data.mp3FileId);
  });
  return Array.from(fileIds);
};

export const deleteDriveFilesByIds = async (fileIds: string[]): Promise<DriveDeleteResults> => {
  const results: DriveDeleteResults = { success: 0, failed: 0, failedIds: [] };
  for (const fileId of fileIds) {
    const ok = await tryDeleteDriveFile(fileId, 'orphan-cleanup');
    if (ok) results.success++;
    else { results.failed++; results.failedIds.push(fileId); }
  }
  return results;
};

// ══════════════════════════════════════════
// Dashboard Stats
// ══════════════════════════════════════════

export const getDashboardStats = async (customerId: string | null): Promise<DashboardStats> => {
  if (!customerId) return { classroomCount: 0, contentCount: 0, userCount: 0 };

  const [classroomsSnap, contentsSnap, usersSnap] = await Promise.all([
    getDocs(customerCollection(customerId, 'classrooms')),
    getDocs(customerCollection(customerId, 'contents')),
    getDocs(query(collection(db, 'users'), where('customerId', '==', customerId))),
  ]);

  return {
    classroomCount: classroomsSnap.size,
    contentCount: contentsSnap.size,
    userCount: usersSnap.size,
  };
};

// Get all users belonging to a customer
export const getCustomerUsers = async (customerId: string | null): Promise<UserData[]> => {
  if (!customerId) return [];
  const q = query(collection(db, 'users'), where('customerId', '==', customerId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
};

// Get watch progress for all users in a customer across all contents
export const getCustomerProgress = async (customerId: string | null): Promise<CustomerProgress> => {
  if (!customerId) return {};

  const contentsSnap = await getDocs(customerCollection(customerId, 'contents'));
  const contentIds = contentsSnap.docs.map(d => d.id);
  if (contentIds.length === 0) return {};

  const users = await getCustomerUsers(customerId);
  const progress: CustomerProgress = {};

  for (const user of users) {
    const historyRef = collection(db, 'users', user.id, 'watchHistory');
    const historySnap = await getDocs(historyRef);
    const watchedContentIds = new Set(historySnap.docs.map(d => d.id));

    const watchedCount = contentIds.filter(id => watchedContentIds.has(id)).length;
    progress[user.id] = {
      watchedCount,
      totalCount: contentIds.length,
      progressPercent: contentIds.length > 0 ? Math.round((watchedCount / contentIds.length) * 100) : 0,
    };
  }

  return progress;
};

// ══════════════════════════════════════════
// Quiz Management
// ══════════════════════════════════════════

export const getQuiz = async (customerId: string | null, contentId: string): Promise<Quiz | null> => {
  if (!customerId || !contentId) return null;
  const q = query(
    customerCollection(customerId, 'quizzes'),
    where('contentId', '==', contentId),
    firestoreLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Quiz;
};

export const saveQuiz = async (customerId: string, quizData: Partial<Quiz> & { id?: string }): Promise<Quiz> => {
  if (!customerId) throw new Error('customerId required');
  const { id, ...data } = quizData;
  if (id) {
    const ref = customerDocRef(customerId, 'quizzes', id);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    return { id, ...data } as Quiz;
  } else {
    const ref = await addDoc(customerCollection(customerId, 'quizzes'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...data } as Quiz;
  }
};

export const deleteQuiz = async (customerId: string | null, quizId: string | null): Promise<void> => {
  if (!customerId || !quizId) return;
  await deleteDoc(customerDocRef(customerId, 'quizzes', quizId));
};

// Quiz results - stored per user
export const saveQuizResult = async (userId: string, quizId: string, result: Omit<QuizResult, 'id' | 'completedAt'>): Promise<void> => {
  if (!userId || !quizId) return;
  const ref = doc(db, 'users', userId, 'quizResults', quizId);
  await setDoc(ref, {
    ...result,
    completedAt: serverTimestamp(),
  }, { merge: true });
};

export const getQuizResult = async (userId: string | undefined, quizId: string): Promise<QuizResult | null> => {
  if (!userId || !quizId) return null;
  const ref = doc(db, 'users', userId, 'quizResults', quizId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } as QuizResult : null;
};

export const getQuizResults = async (userId: string | undefined): Promise<Record<string, QuizResult>> => {
  if (!userId) return {};
  const ref = collection(db, 'users', userId, 'quizResults');
  const snap = await getDocs(ref);
  const results: Record<string, QuizResult> = {};
  snap.docs.forEach(d => { results[d.id] = { id: d.id, ...d.data() } as QuizResult; });
  return results;
};

// ══════════════════════════════════════════
// Customer Settings (API keys, etc.)
// ══════════════════════════════════════════

export const getCustomerSettings = async (customerId: string | null): Promise<CustomerSettings> => {
  if (!customerId) return {};
  const ref = doc(db, 'customers', customerId, 'settings', 'config');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() as CustomerSettings : {};
};

export const updateCustomerSettings = async (customerId: string | null, settings: CustomerSettings): Promise<void> => {
  if (!customerId) return;
  const ref = doc(db, 'customers', customerId, 'settings', 'config');
  await setDoc(ref, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
};

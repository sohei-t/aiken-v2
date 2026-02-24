import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { uploadToDrive, deleteFromDrive, downloadPublicFile } from './driveApi';

// Firebase configuration - Replace with your Firebase project config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
// Note: Google Drive スコープは不要（サービスアカウント認証を使用）

// Admin email
const ADMIN_EMAIL = 'pontaro.no1@gmail.com';

// Detect in-app browsers (LINE, Instagram, Facebook, etc.)
// Google blocks OAuth entirely from WebViews ("安全なブラウザの使用" policy)
export const isInAppBrowser = () => {
  const ua = navigator.userAgent || '';
  return /Line|LIFF|FBAN|FBAV|Instagram|Twitter|MicroMessenger/i.test(ua);
};

// Auth functions
export const signInWithGoogle = async () => {
  // Google blocks OAuth from in-app browsers (WebViews) entirely
  // Neither popup nor redirect works - must use external browser
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

export const signInWithEmail = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const signUpWithEmail = async (email, password, displayName) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(result.user, displayName);
  return result.user;
};

export const logout = () => signOut(auth);

export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('ユーザーが見つかりません');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

// User document management
export const ensureUserDocument = async (user, displayName = null) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const isAdmin = user.email === ADMIN_EMAIL;

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: displayName || user.displayName || user.email.split('@')[0],
      role: isAdmin ? 'admin' : 'user',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else if (isAdmin && userSnap.data().role !== 'admin') {
    // Ensure admin email always has admin role
    await updateDoc(userRef, { role: 'admin', updatedAt: serverTimestamp() });
  }
  return userRef;
};

export const getUserData = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
};

// ── テストモード: サブスクリプション登録/解約 ──
// TODO: Stripe本番接続時はこれらの関数を削除し、Cloud Functions経由に切り替える
export const testSubscribe = async (uid) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    subscriptionStatus: 'active',
    updatedAt: serverTimestamp()
  });
};

export const testUnsubscribe = async (uid) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    subscriptionStatus: null,
    subscriptionId: null,
    subscriptionCurrentPeriodEnd: null,
    subscriptionCanceledAt: null,
    updatedAt: serverTimestamp()
  });
};

export const updateUserRole = async (uid, role) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role, updatedAt: serverTimestamp() });
};

export const getAllUsers = async () => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createUserByAdmin = async (email, password, displayName) => {
  const secondaryApp = initializeApp(firebaseConfig, 'secondary');
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const result = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = result.user;
    await setDoc(doc(db, 'users', newUser.uid), {
      email: newUser.email,
      displayName: displayName || email.split('@')[0],
      role: 'user',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await secondaryAuth.signOut();
    return { id: newUser.uid, email: newUser.email, displayName: displayName || email.split('@')[0], role: 'user' };
  } finally {
    await deleteApp(secondaryApp);
  }
};

export const deleteUser = async (uid) => {
  // Firestoreのユーザードキュメントとサブコレクションを削除
  const batch = writeBatch(db);

  // 視聴履歴サブコレクションを削除
  const historyRef = collection(db, 'users', uid, 'watchHistory');
  const historyDocs = await getDocs(historyRef);
  historyDocs.forEach(histDoc => batch.delete(histDoc.ref));

  // ユーザードキュメントを削除
  batch.delete(doc(db, 'users', uid));

  await batch.commit();
};

// Classroom functions
export const getClassrooms = async (isAuthenticated = false, userId = null, isAdmin = false, parentClassroomId = undefined) => {
  const classroomsRef = collection(db, 'classrooms');
  let q;

  if (isAdmin) {
    q = query(classroomsRef, orderBy('order', 'asc'));
  } else {
    // Non-admin users (authenticated or not) only see public classrooms
    q = query(classroomsRef, where('accessType', 'in', ['public', 'free']));
  }

  const snapshot = await getDocs(q);
  let classrooms = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(c => c.isActive !== false) // Allow undefined or true
    .sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort in JS

  // Filter by parentClassroomId if specified
  if (parentClassroomId !== undefined) {
    classrooms = classrooms.filter(c => c.parentClassroomId === parentClassroomId);
  }

  return classrooms;
};

// Get root classrooms only (parentClassroomId === null)
export const getRootClassrooms = async (isAuthenticated = false, userId = null, isAdmin = false) => {
  return getClassrooms(isAuthenticated, userId, isAdmin, null);
};

export const getClassroom = async (classroomId) => {
  const classroomRef = doc(db, 'classrooms', classroomId);
  const classroomSnap = await getDoc(classroomRef);
  return classroomSnap.exists() ? { id: classroomSnap.id, ...classroomSnap.data() } : null;
};

export const createClassroom = async (data, creatorId, parentClassroomId = null) => {
  const classroomsRef = collection(db, 'classrooms');

  // Calculate depth based on parent
  let depth = 0;
  if (parentClassroomId) {
    const parentClassroom = await getClassroom(parentClassroomId);
    if (!parentClassroom) {
      throw new Error('親教室が見つかりません');
    }
    if (parentClassroom.depth >= 2) {
      throw new Error('階層は3階層までです（親 > 子 > 孫 > コンテンツ）');
    }
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

  // Increment parent's childCount
  if (parentClassroomId) {
    const parentRef = doc(db, 'classrooms', parentClassroomId);
    await updateDoc(parentRef, {
      childCount: increment(1),
      updatedAt: serverTimestamp()
    });
  }

  return docRef.id;
};

export const updateClassroom = async (classroomId, data) => {
  const classroomRef = doc(db, 'classrooms', classroomId);
  await updateDoc(classroomRef, { ...data, updatedAt: serverTimestamp() });
};

// Collect a classroom and all its descendants recursively
const collectClassroomTree = async (classroomId) => {
  const ids = [classroomId];
  const childrenQuery = query(collection(db, 'classrooms'), where('parentClassroomId', '==', classroomId));
  const childrenSnap = await getDocs(childrenQuery);
  for (const childDoc of childrenSnap.docs) {
    const descendantIds = await collectClassroomTree(childDoc.id);
    ids.push(...descendantIds);
  }
  return ids;
};

// Delete a single file from Drive with proper error logging (returns success/failure)
const tryDeleteDriveFile = async (fileId, label = '') => {
  try {
    await deleteFromDrive(auth, fileId);
    console.log(`[Drive] Deleted ${label}: ${fileId}`);
    return true;
  } catch (e) {
    console.error(`[Drive] FAILED to delete ${label}: ${fileId}`, e);
    return false;
  }
};

// Delete contents belonging to a set of classrooms (Drive cleanup + Firestore delete)
const deleteContentsByClassroomIds = async (classroomIds) => {
  const driveFailures = [];
  for (const cid of classroomIds) {
    const contentsQuery = query(collection(db, 'contents'), where('classroomId', '==', cid));
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
  if (driveFailures.length > 0) {
    console.error(`[Drive] ${driveFailures.length} file(s) failed to delete:`, driveFailures);
  }
  return driveFailures;
};

export const deleteClassroom = async (classroomId) => {
  const classroomRef = doc(db, 'classrooms', classroomId);
  const classroomSnap = await getDoc(classroomRef);

  if (!classroomSnap.exists()) {
    throw new Error('教室が見つかりません');
  }

  const classroom = classroomSnap.data();

  // Collect this classroom and all descendants
  const allIds = await collectClassroomTree(classroomId);

  // Delete all contents in these classrooms
  await deleteContentsByClassroomIds(allIds);

  // Delete all classrooms in batch
  const batch = writeBatch(db);
  for (const id of allIds) {
    batch.delete(doc(db, 'classrooms', id));
  }

  // If this is a child classroom, decrement parent's childCount
  if (classroom.parentClassroomId) {
    const parentRef = doc(db, 'classrooms', classroom.parentClassroomId);
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

// Content functions
export const getContents = async (classroomId) => {
  const contentsRef = collection(db, 'contents');
  const q = query(contentsRef, where('classroomId', '==', classroomId), where('isActive', '==', true), orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getContent = async (contentId) => {
  const contentRef = doc(db, 'contents', contentId);
  const contentSnap = await getDoc(contentRef);
  return contentSnap.exists() ? { id: contentSnap.id, ...contentSnap.data() } : null;
};

export const createContent = async (data, classroomId, creatorId) => {
  const contentsRef = collection(db, 'contents');
  const docRef = await addDoc(contentsRef, {
    ...data,
    classroomId,
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: true
  });

  // Update classroom content count
  const classroomRef = doc(db, 'classrooms', classroomId);
  const classroomSnap = await getDoc(classroomRef);
  if (classroomSnap.exists()) {
    await updateDoc(classroomRef, {
      contentCount: (classroomSnap.data().contentCount || 0) + 1,
      updatedAt: serverTimestamp()
    });
  }

  return docRef.id;
};

export const deleteContent = async (contentId) => {
  const contentRef = doc(db, 'contents', contentId);
  const contentSnap = await getDoc(contentRef);

  if (contentSnap.exists()) {
    const content = contentSnap.data();
    const driveFailures = [];

    // Delete files from Google Drive (via Cloud Run API)
    if (content.htmlFileId) {
      const ok = await tryDeleteDriveFile(content.htmlFileId, `html[${contentId}]`);
      if (!ok) driveFailures.push(content.htmlFileId);
    }
    if (content.mp3FileId) {
      const ok = await tryDeleteDriveFile(content.mp3FileId, `mp3[${contentId}]`);
      if (!ok) driveFailures.push(content.mp3FileId);
    }

    // Update classroom content count
    const classroomRef = doc(db, 'classrooms', content.classroomId);
    const classroomSnap = await getDoc(classroomRef);
    if (classroomSnap.exists()) {
      await updateDoc(classroomRef, {
        contentCount: Math.max(0, (classroomSnap.data().contentCount || 1) - 1),
        updatedAt: serverTimestamp()
      });
    }

    await deleteDoc(contentRef);

    if (driveFailures.length > 0) {
      console.error(`[Drive] Failed to delete files for content ${contentId}:`, driveFailures);
      throw new Error(`コンテンツは削除しましたが、Google Driveのファイル ${driveFailures.length}件の削除に失敗しました`);
    }
  }
};

// Storage functions (using Google Drive via Cloud Run API)
export const uploadFile = async (file, classroomId) => {
  const result = await uploadToDrive(auth, file, classroomId);
  return {
    path: result.fileId,
    url: result.url,
    fileId: result.fileId
  };
};

export const hasClassroomAccess = async (userId, classroomId, isAdmin = false) => {
  if (isAdmin) return true;
  const classroom = await getClassroom(classroomId);
  if (!classroom) return false;
  return classroom.accessType === 'public' || classroom.accessType === 'free';
};

// Get child classrooms of a parent
export const getChildClassrooms = async (parentId, isAdmin = false) => {
  const classroomsRef = collection(db, 'classrooms');
  // Use simple query without orderBy to avoid requiring composite index
  const q = query(classroomsRef, where('parentClassroomId', '==', parentId));

  const snapshot = await getDocs(q);
  let classrooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter by isActive and accessType in JS (to support legacy data and avoid composite index)
  if (!isAdmin) {
    classrooms = classrooms.filter(c => c.isActive !== false && c.accessType !== 'draft');
  }

  // Sort by order in JS
  return classrooms.sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Get classroom hierarchy (for breadcrumb)
export const getClassroomHierarchy = async (classroomId) => {
  const hierarchy = [];
  let currentId = classroomId;

  while (currentId) {
    try {
      const classroom = await getClassroom(currentId);
      if (!classroom) break;
      hierarchy.unshift(classroom);
      currentId = classroom.parentClassroomId;
    } catch (e) {
      // May fail if parent classroom is private and user is unauthenticated
      console.warn('Failed to fetch parent classroom in hierarchy:', e);
      break;
    }
  }

  return hierarchy;
};

// Check if a child classroom can be created under a parent
export const canCreateChildClassroom = async (parentId) => {
  if (!parentId) return true; // Can always create root classrooms

  const parentClassroom = await getClassroom(parentId);
  if (!parentClassroom) return false;

  // Allow 3 levels (parent.depth must be 0 or 1)
  return parentClassroom.depth < 2;
};

// Fetch MP3 file from Google Drive as Blob URL (via Cloud Run API - 認証不要)
export const fetchMp3AsBlob = async (fileId) => {
  return downloadPublicFile(fileId);
};

// Find and fix orphaned classrooms (children whose parent no longer exists)
export const cleanupOrphanedClassrooms = async () => {
  const classroomsRef = collection(db, 'classrooms');
  const snapshot = await getDocs(classroomsRef);
  const allClassrooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const classroomIds = new Set(allClassrooms.map(c => c.id));

  const orphans = allClassrooms.filter(c =>
    c.parentClassroomId && !classroomIds.has(c.parentClassroomId)
  );

  if (orphans.length === 0) return 0;

  const batch = writeBatch(db);
  for (const orphan of orphans) {
    batch.update(doc(db, 'classrooms', orphan.id), {
      parentClassroomId: null,
      depth: 0,
      updatedAt: serverTimestamp()
    });
  }
  await batch.commit();
  return orphans.length;
};

// Bulk update classroom orders
export const updateClassroomOrders = async (orderedClassrooms) => {
  const batch = writeBatch(db);
  orderedClassrooms.forEach((classroom, index) => {
    const classroomRef = doc(db, 'classrooms', classroom.id);
    batch.update(classroomRef, { order: index, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};

// Bulk update content orders
export const updateContentOrders = async (orderedContents) => {
  const batch = writeBatch(db);
  orderedContents.forEach((content, index) => {
    const contentRef = doc(db, 'contents', content.id);
    batch.update(contentRef, { order: index, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};

// Bulk delete classrooms
export const deleteClassrooms = async (classroomIds) => {
  // Collect all classrooms including descendants
  const allIdsSet = new Set();
  const classroomData = {};

  for (const classroomId of classroomIds) {
    const ids = await collectClassroomTree(classroomId);
    ids.forEach(id => allIdsSet.add(id));
    const snap = await getDoc(doc(db, 'classrooms', classroomId));
    if (snap.exists()) classroomData[classroomId] = snap.data();
  }

  const allIds = Array.from(allIdsSet);

  // Delete all contents in these classrooms
  await deleteContentsByClassroomIds(allIds);

  // Delete all classrooms in batch (Firestore batch limit is 500)
  for (let i = 0; i < allIds.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = allIds.slice(i, i + 400);
    chunk.forEach(id => batch.delete(doc(db, 'classrooms', id)));

    // On first batch, update parent childCounts for top-level selected classrooms
    if (i === 0) {
      const parentUpdates = {};
      for (const classroomId of classroomIds) {
        const data = classroomData[classroomId];
        if (data?.parentClassroomId && !allIdsSet.has(data.parentClassroomId)) {
          parentUpdates[data.parentClassroomId] = (parentUpdates[data.parentClassroomId] || 0) + 1;
        }
      }
      for (const [parentId, count] of Object.entries(parentUpdates)) {
        batch.update(doc(db, 'classrooms', parentId), {
          childCount: increment(-count),
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
  }
};

// Get all Drive file IDs referenced by remaining contents in Firestore
export const getAllReferencedDriveFileIds = async () => {
  const contentsRef = collection(db, 'contents');
  const snapshot = await getDocs(contentsRef);
  const fileIds = new Set();
  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.htmlFileId) fileIds.add(data.htmlFileId);
    if (data.mp3FileId) fileIds.add(data.mp3FileId);
  });
  return Array.from(fileIds);
};

// Delete Drive files by IDs (for orphan cleanup)
export const deleteDriveFilesByIds = async (fileIds) => {
  const results = { success: 0, failed: 0, failedIds: [] };
  for (const fileId of fileIds) {
    const ok = await tryDeleteDriveFile(fileId, 'orphan-cleanup');
    if (ok) {
      results.success++;
    } else {
      results.failed++;
      results.failedIds.push(fileId);
    }
  }
  return results;
};

// Watch History functions
const WATCH_HISTORY_STORAGE_KEY = 'viewerWatchHistory';

// Record watch history (works for both authenticated and anonymous users)
export const recordWatchHistory = async (userId, contentId) => {
  const now = new Date().toISOString();
  console.log('[WatchHistory] Recording:', { userId, contentId, now });

  if (userId) {
    // Authenticated user: save to Firestore
    try {
      const historyRef = doc(db, 'users', userId, 'watchHistory', contentId);
      await setDoc(historyRef, {
        watchedAt: serverTimestamp(),
        lastWatchedAt: serverTimestamp()
      }, { merge: true });
      console.log('[WatchHistory] Saved to Firestore');
    } catch (e) {
      console.warn('[WatchHistory] Failed to save to Firestore:', e);
    }
  }

  // Always save to localStorage (for offline access and anonymous users)
  try {
    const stored = localStorage.getItem(WATCH_HISTORY_STORAGE_KEY);
    const history = stored ? JSON.parse(stored) : {};
    history[contentId] = {
      watchedAt: history[contentId]?.watchedAt || now,
      lastWatchedAt: now
    };
    localStorage.setItem(WATCH_HISTORY_STORAGE_KEY, JSON.stringify(history));
    console.log('[WatchHistory] Saved to localStorage:', history);
  } catch (e) {
    console.warn('[WatchHistory] Failed to save to localStorage:', e);
  }
};

// Get watch history for multiple contents
export const getWatchHistory = async (userId, contentIds) => {
  console.log('[WatchHistory] Getting history for:', { userId, contentIds });
  const result = {};

  // Get from localStorage first (always available)
  try {
    const stored = localStorage.getItem(WATCH_HISTORY_STORAGE_KEY);
    console.log('[WatchHistory] localStorage raw:', stored);
    if (stored) {
      const localHistory = JSON.parse(stored);
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

  // If authenticated, also check Firestore (and merge, preferring Firestore data)
  if (userId) {
    try {
      const historyRef = collection(db, 'users', userId, 'watchHistory');
      const snapshot = await getDocs(historyRef);
      console.log('[WatchHistory] Firestore docs:', snapshot.docs.length);
      snapshot.docs.forEach(doc => {
        const id = doc.id;
        if (contentIds.includes(id)) {
          const data = doc.data();
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

  console.log('[WatchHistory] Result:', result);
  return result;
};

// Bulk delete contents
export const deleteContents = async (contentIds) => {
  // First, get all content data for Drive file cleanup and classroom count updates
  const contents = [];
  for (const contentId of contentIds) {
    const contentRef = doc(db, 'contents', contentId);
    const contentSnap = await getDoc(contentRef);
    if (contentSnap.exists()) {
      contents.push({ id: contentId, ...contentSnap.data() });
    }
  }

  // Delete files from Google Drive
  const driveFailures = [];
  for (const content of contents) {
    if (content.htmlFileId) {
      const ok = await tryDeleteDriveFile(content.htmlFileId, `html[${content.id}]`);
      if (!ok) driveFailures.push(content.htmlFileId);
    }
    if (content.mp3FileId) {
      const ok = await tryDeleteDriveFile(content.mp3FileId, `mp3[${content.id}]`);
      if (!ok) driveFailures.push(content.mp3FileId);
    }
  }

  if (driveFailures.length > 0) {
    console.error(`[Drive] ${driveFailures.length} file(s) failed to delete:`, driveFailures);
  }

  // Group contents by classroom for count updates
  const classroomCounts = {};
  contents.forEach(content => {
    if (content.classroomId) {
      classroomCounts[content.classroomId] = (classroomCounts[content.classroomId] || 0) + 1;
    }
  });

  // Batch delete contents and update classroom counts
  const batch = writeBatch(db);

  for (const contentId of contentIds) {
    const contentRef = doc(db, 'contents', contentId);
    batch.delete(contentRef);
  }

  // Update classroom content counts
  for (const [classroomId, count] of Object.entries(classroomCounts)) {
    const classroomRef = doc(db, 'classrooms', classroomId);
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

// Sync classroom contentCount with actual contents and repair missing isActive fields
export const syncContentCounts = async () => {
  const classroomsSnap = await getDocs(collection(db, 'classrooms'));
  const batch = writeBatch(db);
  let countUpdated = 0;
  let contentsRepaired = 0;

  for (const classroomDoc of classroomsSnap.docs) {
    const contentsQuery = query(
      collection(db, 'contents'),
      where('classroomId', '==', classroomDoc.id)
    );
    const contentsSnap = await getDocs(contentsQuery);

    // Repair contents missing isActive field (causes getContents to return 0)
    let activeCount = 0;
    for (const contentDoc of contentsSnap.docs) {
      const data = contentDoc.data();
      if (data.isActive === undefined || data.isActive === null) {
        batch.update(contentDoc.ref, { isActive: true });
        contentsRepaired++;
      }
      if (data.isActive !== false) {
        activeCount++;
      }
    }

    // Fix contentCount if desynced
    const storedCount = classroomDoc.data().contentCount || 0;
    if (activeCount !== storedCount) {
      batch.update(classroomDoc.ref, {
        contentCount: activeCount,
        updatedAt: serverTimestamp()
      });
      countUpdated++;
    }
  }

  if (countUpdated > 0 || contentsRepaired > 0) {
    await batch.commit();
  }
  return countUpdated + contentsRepaired;
};

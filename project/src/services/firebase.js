import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { uploadToDrive, deleteFromDrive, downloadPublicFile } from './driveApi';

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
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Platform admin email
const PLATFORM_ADMIN_EMAIL = 'pontaro.no1@gmail.com';

// ── Helper: customer-scoped collection path ──
const customerDoc = (customerId) => doc(db, 'customers', customerId);
const customerCollection = (customerId, collectionName) =>
  collection(db, 'customers', customerId, collectionName);
const customerDocRef = (customerId, collectionName, docId) =>
  doc(db, 'customers', customerId, collectionName, docId);

// Detect in-app browsers
export const isInAppBrowser = () => {
  const ua = navigator.userAgent || '';
  return /Line|LIFF|FBAN|FBAV|Instagram|Twitter|MicroMessenger/i.test(ua);
};

// ══════════════════════════════════════════
// Auth functions
// ══════════════════════════════════════════

export const signInWithGoogle = async () => {
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

// ══════════════════════════════════════════
// User document management
// ══════════════════════════════════════════

export const ensureUserDocument = async (user, displayName = null) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const isPlatformAdmin = user.email === PLATFORM_ADMIN_EMAIL;

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: displayName || user.displayName || user.email.split('@')[0],
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

export const getUserData = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
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

export const createUserByAdmin = async (email, password, displayName, customerId = null) => {
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
    return { id: newUser.uid, email: newUser.email, displayName: displayName || email.split('@')[0], role: 'user', customerId };
  } finally {
    await deleteApp(secondaryApp);
  }
};

export const deleteUser = async (uid) => {
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

export const getCustomer = async (customerId) => {
  const ref = customerDoc(customerId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createCustomer = async (data) => {
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

export const updateCustomer = async (customerId, data) => {
  const ref = customerDoc(customerId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

// Assign user to customer
export const assignUserToCustomer = async (uid, customerId) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { customerId, updatedAt: serverTimestamp() });
};

// ══════════════════════════════════════════
// Classroom functions (customer-scoped)
// ══════════════════════════════════════════

export const getClassrooms = async (customerId, isAdmin = false, parentClassroomId = undefined) => {
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
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(c => c.isActive !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (parentClassroomId !== undefined) {
    classrooms = classrooms.filter(c => c.parentClassroomId === parentClassroomId);
  }

  return classrooms;
};

export const getRootClassrooms = async (customerId, isAdmin = false) => {
  return getClassrooms(customerId, isAdmin, null);
};

export const getClassroom = async (customerId, classroomId) => {
  if (!customerId) return null;
  const ref = customerDocRef(customerId, 'classrooms', classroomId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createClassroom = async (customerId, data, creatorId, parentClassroomId = null) => {
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

export const updateClassroom = async (customerId, classroomId, data) => {
  const ref = customerDocRef(customerId, 'classrooms', classroomId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

// Collect classroom tree recursively
const collectClassroomTree = async (customerId, classroomId) => {
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
const tryDeleteDriveFile = async (fileId, label = '') => {
  try {
    await deleteFromDrive(auth, fileId);
    return true;
  } catch (e) {
    console.error(`[Drive] FAILED to delete ${label}: ${fileId}`, e);
    return false;
  }
};

// Delete contents by classroom IDs
const deleteContentsByClassroomIds = async (customerId, classroomIds) => {
  const driveFailures = [];
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

export const deleteClassroom = async (customerId, classroomId) => {
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

export const deleteClassrooms = async (customerId, classroomIds) => {
  const allIdsSet = new Set();
  const classroomData = {};

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
      const parentUpdates = {};
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
export const getChildClassrooms = async (customerId, parentId, isAdmin = false) => {
  if (!customerId) return [];
  const q = query(
    customerCollection(customerId, 'classrooms'),
    where('parentClassroomId', '==', parentId)
  );
  const snapshot = await getDocs(q);
  let classrooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (!isAdmin) {
    classrooms = classrooms.filter(c => c.isActive !== false && c.accessType !== 'draft');
  }

  return classrooms.sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Get classroom hierarchy (for breadcrumb)
export const getClassroomHierarchy = async (customerId, classroomId) => {
  const hierarchy = [];
  let currentId = classroomId;
  while (currentId) {
    const classroom = await getClassroom(customerId, currentId);
    if (!classroom) break;
    hierarchy.unshift(classroom);
    currentId = classroom.parentClassroomId;
  }
  return hierarchy;
};

export const canCreateChildClassroom = async (customerId, parentId) => {
  if (!parentId) return true;
  const parentClassroom = await getClassroom(customerId, parentId);
  if (!parentClassroom) return false;
  return parentClassroom.depth < 2;
};

// Bulk update classroom orders
export const updateClassroomOrders = async (customerId, orderedClassrooms) => {
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

export const getContents = async (customerId, classroomId) => {
  if (!customerId) return [];
  const contentsRef = customerCollection(customerId, 'contents');
  const q = query(contentsRef, where('classroomId', '==', classroomId), where('isActive', '==', true), orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getContent = async (customerId, contentId) => {
  if (!customerId) return null;
  const ref = customerDocRef(customerId, 'contents', contentId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createContent = async (customerId, data, classroomId, creatorId) => {
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

export const deleteContent = async (customerId, contentId) => {
  const ref = customerDocRef(customerId, 'contents', contentId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const content = snap.data();
    const driveFailures = [];

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

export const deleteContents = async (customerId, contentIds) => {
  const contents = [];
  for (const contentId of contentIds) {
    const ref = customerDocRef(customerId, 'contents', contentId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      contents.push({ id: contentId, ...snap.data() });
    }
  }

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

  const classroomCounts = {};
  contents.forEach(content => {
    if (content.classroomId) {
      classroomCounts[content.classroomId] = (classroomCounts[content.classroomId] || 0) + 1;
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
export const updateContentOrders = async (customerId, orderedContents) => {
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

export const uploadFile = async (file, classroomId) => {
  const result = await uploadToDrive(auth, file, classroomId);
  return {
    path: result.fileId,
    url: result.url,
    fileId: result.fileId
  };
};

export const fetchMp3AsBlob = async (fileId) => {
  return downloadPublicFile(fileId);
};

// ══════════════════════════════════════════
// Access control
// ══════════════════════════════════════════

export const hasClassroomAccess = async (customerId, userId, classroomId, isAdmin = false) => {
  if (isAdmin) return true;
  const classroom = await getClassroom(customerId, classroomId);
  if (!classroom) return false;
  return classroom.accessType === 'public' || classroom.accessType === 'free';
};

// ══════════════════════════════════════════
// Watch History
// ══════════════════════════════════════════

const WATCH_HISTORY_STORAGE_KEY = 'viewerWatchHistory';

export const recordWatchHistory = async (userId, contentId) => {
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
    const history = stored ? JSON.parse(stored) : {};
    history[contentId] = {
      watchedAt: history[contentId]?.watchedAt || now,
      lastWatchedAt: now
    };
    localStorage.setItem(WATCH_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('[WatchHistory] Failed to save to localStorage:', e);
  }
};

export const getWatchHistory = async (userId, contentIds) => {
  const result = {};

  try {
    const stored = localStorage.getItem(WATCH_HISTORY_STORAGE_KEY);
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

  if (userId) {
    try {
      const historyRef = collection(db, 'users', userId, 'watchHistory');
      const snapshot = await getDocs(historyRef);
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

  return result;
};

// ══════════════════════════════════════════
// Maintenance utilities
// ══════════════════════════════════════════

export const cleanupOrphanedClassrooms = async (customerId) => {
  const classroomsRef = customerCollection(customerId, 'classrooms');
  const snapshot = await getDocs(classroomsRef);
  const allClassrooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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

export const syncContentCounts = async (customerId) => {
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

export const getAllReferencedDriveFileIds = async (customerId) => {
  const contentsRef = customerCollection(customerId, 'contents');
  const snapshot = await getDocs(contentsRef);
  const fileIds = new Set();
  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.htmlFileId) fileIds.add(data.htmlFileId);
    if (data.mp3FileId) fileIds.add(data.mp3FileId);
  });
  return Array.from(fileIds);
};

export const deleteDriveFilesByIds = async (fileIds) => {
  const results = { success: 0, failed: 0, failedIds: [] };
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

export const getDashboardStats = async (customerId) => {
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
export const getCustomerUsers = async (customerId) => {
  if (!customerId) return [];
  const q = query(collection(db, 'users'), where('customerId', '==', customerId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get watch progress for all users in a customer across all contents
export const getCustomerProgress = async (customerId) => {
  if (!customerId) return {};

  // Get all contents for this customer
  const contentsSnap = await getDocs(customerCollection(customerId, 'contents'));
  const contentIds = contentsSnap.docs.map(d => d.id);
  if (contentIds.length === 0) return {};

  // Get all users for this customer
  const users = await getCustomerUsers(customerId);
  const progress = {};

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

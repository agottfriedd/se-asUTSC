import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, where,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile, LessonProgress } from '../types';

// ─── USER PROFILE ──────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function createUserProfile(uid: string, profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', uid), { ...profile, createdAt: serverTimestamp() });
}

export async function updateUserProfile(uid: string, fields: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), fields);
}

// ─── PROGRESS ──────────────────────────────────────────────────
export async function getLessonProgress(uid: string): Promise<LessonProgress[]> {
  const q = query(collection(db, 'progress'), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as LessonProgress);
}

export async function saveLessonProgress(
  uid: string, lessonId: number, progress: number, completed: boolean,
): Promise<void> {
  const ref = doc(db, 'progress', `${uid}_${lessonId}`);
  await setDoc(ref, {
    userId: uid, lessonId, progress, completed,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Update global progress % on user profile
  if (completed) {
    await updateDoc(doc(db, 'users', uid), {
      totalCompleted: increment(1),
      updatedAt: serverTimestamp(),
    });
  }
}

// ─── STREAK ────────────────────────────────────────────────────
export async function updateStreak(uid: string): Promise<number> {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;

  const data     = snap.data();
  const now      = new Date();
  const lastDate = data.lastActiveDate?.toDate?.() ?? null;
  let   streak   = data.streak ?? 0;

  if (lastDate) {
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / 86_400_000);
    if (diffDays === 1) streak += 1;   // consecutive day
    else if (diffDays > 1) streak = 1; // streak broken
    // diffDays === 0 → same day, no change
  } else {
    streak = 1;
  }

  await updateDoc(ref, { streak, lastActiveDate: serverTimestamp() });
  return streak;
}

// ─── FAVORITES ─────────────────────────────────────────────────
export async function getFavorites(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'favorites', uid));
  return snap.exists() ? (snap.data().signIds as string[]) : [];
}

export async function toggleFavorite(uid: string, signId: string): Promise<string[]> {
  const ref  = doc(db, 'favorites', uid);
  const snap = await getDoc(ref);
  let   ids: string[] = snap.exists() ? snap.data().signIds : [];

  ids = ids.includes(signId) ? ids.filter(id => id !== signId) : [...ids, signId];
  await setDoc(ref, { signIds: ids, updatedAt: serverTimestamp() });
  return ids;
}

// ─── ADMIN — user list ─────────────────────────────────────────
export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
}

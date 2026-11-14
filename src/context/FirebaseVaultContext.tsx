// src/context/FirebaseVaultContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase.ts';

export type VaultRole = 'user' | 'admin';

export interface VaultUserProfile {
  uid: string;
  email: string;
  role: VaultRole;
  createdAt?: any;
}

interface FirebaseVaultContextType {
  firebaseUser: FirebaseUser | null;
  profile: VaultUserProfile | null;
  authReady: boolean;
  isAdmin: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutVault: () => Promise<void>;
}

const FirebaseVaultContext = createContext<FirebaseVaultContextType | undefined>(undefined);

export const FirebaseVaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<VaultUserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email || '',
            role: 'user',
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        // Record surfaced via snapshot listener or operation if permissions fail
        console.warn('User profile sync note:', err);
      }

      unsubProfile = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as VaultUserProfile;
            setProfile({
              uid: data.uid,
              email: data.email,
              role: data.role === 'admin' ? 'admin' : 'user',
              createdAt: data.createdAt,
            });
          } else {
            setProfile({
              uid: user.uid,
              email: user.email || '',
              role: 'user',
            });
          }
          setAuthReady(true);
        },
        (error) => {
          setAuthReady(true);
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      );
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  const signUpWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.trim();
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const userPath = `users/${cred.user.uid}`;
    try {
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email || cleanEmail,
        role: 'user',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, userPath);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.trim();
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const userPath = `users/${cred.user.uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail,
          role: 'user',
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userPath);
    }
  };

  const signOutVault = async () => {
    await signOut(auth);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <FirebaseVaultContext.Provider
      value={{
        firebaseUser,
        profile,
        authReady,
        isAdmin,
        signUpWithEmail,
        signInWithEmail,
        signOutVault,
      }}
    >
      {children}
    </FirebaseVaultContext.Provider>
  );
};

export const useFirebaseVault = () => {
  const ctx = useContext(FirebaseVaultContext);
  if (!ctx) {
    throw new Error('useFirebaseVault must be used within a FirebaseVaultProvider');
  }
  return ctx;
};

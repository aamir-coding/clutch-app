'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '@/lib/types';
import { authService } from '@/lib/firebase/auth';
import { firestoreService } from '@/lib/firebase/firestore';

export interface AuthContextType {
  user: FirebaseUser | null;
  dbUser: User | null;
  loading: boolean;
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          
          // Get additional user profile info from Firestore
          const fetchedDbUser = await firestoreService.getUser(firebaseUser.uid);
          setDbUser(fetchedDbUser);

          // Get a valid access token
          try {
            const token = await authService.getValidAccessToken(firebaseUser.uid);
            setAccessToken(token);
          } catch (tokenErr) {
            console.error('Could not retrieve valid Google access token on mount:', tokenErr);
            setAccessToken(null);
          }
        } else {
          setUser(null);
          setDbUser(null);
          setAccessToken(null);
        }
      } catch (err) {
        console.error('Error synchronizing auth state:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setLoading(true);
    try {
      const { user: loggedInUser, accessToken: token } = await authService.signInWithGoogle();
      setUser(loggedInUser);
      
      const fetchedDbUser = await firestoreService.getUser(loggedInUser.uid);
      setDbUser(fetchedDbUser);
      setAccessToken(token);
      
      router.push('/dashboard');
    } catch (err) {
      console.error('Sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      setDbUser(null);
      setAccessToken(null);
      router.push('/login');
    } catch (err) {
      console.error('Sign-out failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, accessToken, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

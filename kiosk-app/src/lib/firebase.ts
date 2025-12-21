import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  updatePassword as firebaseUpdatePassword,
  type User
} from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Check if Firebase is properly configured
const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
};

// Initialize Firebase only if configured
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
} else {
  console.warn('⚠️ Firebase not configured. Please set environment variables in .env file');
}

// Sign in with Google
export const signInWithGoogle = async () => {
  if (!auth || !googleProvider) {
    throw new Error('Firebase is not configured. Please check your .env file.');
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Sign out
export const signOut = async () => {
  if (!auth) {
    console.warn('Firebase auth not available');
    return;
  }
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Sign up with email and password
export const signUpWithEmail = async (email: string, password: string) => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please check your .env file.');
  }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error('Error signing up with email:', error);
    throw error;
  }
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please check your .env file.');
  }
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error('Error signing in with email:', error);
    throw error;
  }
};

// Auth state observer
export const onAuthChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    // If Firebase not configured, immediately call with null
    callback(null);
    return () => {}; // Return no-op unsubscribe function
  }
  return onAuthStateChanged(auth, callback);
};

// Check if email exists and get sign-in methods
export const checkEmailExists = async (email: string): Promise<{ exists: boolean; methods: string[] }> => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please check your .env file.');
  }
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return {
      exists: methods.length > 0,
      methods: methods, // e.g., ['google.com', 'password']
    };
  } catch (error: any) {
    console.error('Error checking email:', error);
    // If there's an error, assume email doesn't exist
    return { exists: false, methods: [] };
  }
};

// Reset password
export const resetPassword = async (email: string) => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please check your .env file.');
  }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// Update password for current user (used after magic link sign-in)
export const updatePassword = async (newPassword: string) => {
  if (!auth || !auth.currentUser) {
    throw new Error('No user is currently signed in.');
  }
  try {
    await firebaseUpdatePassword(auth.currentUser, newPassword);
  } catch (error: any) {
    console.error('Error updating password:', error);
    throw error;
  }
};

// Email link action code settings for admin invites
export const getActionCodeSettings = (email: string) => {
  // For development, use localhost for Firebase domain allowlist compatibility
  // In production, use the actual origin
  let origin = window.location.origin;
  if (origin.includes('127.0.0.1') || origin.includes('localhost')) {
    origin = 'http://localhost:8080';
  }
  return {
    url: `${origin}/admin-invite-callback?email=${encodeURIComponent(email)}`,
    handleCodeInApp: true,
  };
};

// Send sign-in link email for admin invites
export const sendAdminInviteLink = async (email: string) => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please check your .env file.');
  }
  try {
    const actionCodeSettings = getActionCodeSettings(email);
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Store email in localStorage for retrieval after redirect
    window.localStorage.setItem('emailForSignIn', email);
  } catch (error: any) {
    console.error('Error sending sign-in link:', error);
    throw error;
  }
};

// Check if current URL is a sign-in link
export const checkIsSignInWithEmailLink = (url: string): boolean => {
  if (!auth) return false;
  return isSignInWithEmailLink(auth, url);
};

// Complete sign-in with email link
export const completeSignInWithEmailLink = async (email: string, url: string) => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please check your .env file.');
  }
  try {
    const result = await signInWithEmailLink(auth, email, url);
    // Clear the stored email
    window.localStorage.removeItem('emailForSignIn');
    return result.user;
  } catch (error: any) {
    console.error('Error completing sign-in with email link:', error);
    throw error;
  }
};

export { auth, type User };


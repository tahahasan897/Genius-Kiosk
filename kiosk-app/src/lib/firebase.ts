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

export { auth, type User };


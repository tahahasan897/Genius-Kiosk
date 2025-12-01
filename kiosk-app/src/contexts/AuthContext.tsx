import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { 
  signInWithGoogle, 
  signInWithEmail,
  signUpWithEmail,
  signOut, 
  onAuthChange,
  checkEmailExists,
  type User 
} from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | void>;
  signInWithEmail: (email: string, password: string) => Promise<User | void>;
  signUpWithEmail: (email: string, password: string) => Promise<User | void>;
  signOut: () => Promise<void>;
  checkEmailExists: (email: string) => Promise<{ exists: boolean; methods: string[] }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Firebase is configured
    const hasFirebaseConfig = !!import.meta.env.VITE_FIREBASE_API_KEY;
    
    if (!hasFirebaseConfig) {
      console.warn('Firebase not configured - skipping auth initialization');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    // Timeout fallback - stop loading after 5 seconds if auth state doesn't resolve
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Firebase auth state check timed out');
        setLoading(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [loading]);

  const handleSignInWithGoogle = async () => {
    try {
      const user = await signInWithGoogle();
      return user;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const handleSignInWithEmail = async (email: string, password: string) => {
    try {
      const user = await signInWithEmail(email, password);
      return user;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const handleSignUpWithEmail = async (email: string, password: string) => {
    try {
      const user = await signUpWithEmail(email, password);
      return user;
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    checkEmailExists,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route component
interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};


import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  onAuthChange,
  checkEmailExists,
  resetPassword,
  type User
} from '@/lib/firebase';
import { checkAdminRole, type AdminRoleResponse } from '@/api/superadmin';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  adminRole: AdminRoleResponse | null;
  signInWithGoogle: () => Promise<User | void>;
  signInWithEmail: (email: string, password: string) => Promise<User | void>;
  signUpWithEmail: (email: string, password: string) => Promise<User | void>;
  signOut: () => Promise<void>;
  checkEmailExists: (email: string) => Promise<{ exists: boolean; methods: string[] }>;
  resetPassword: (email: string) => Promise<void>;
  refreshAdminRole: () => Promise<AdminRoleResponse | null>;
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
  const [adminRole, setAdminRole] = useState<AdminRoleResponse | null>(null);

  const fetchAdminRole = async (): Promise<AdminRoleResponse | null> => {
    try {
      const role = await checkAdminRole();
      setAdminRole(role);
      return role;
    } catch (error) {
      console.error('Error fetching admin role:', error);
      setAdminRole({ isAdmin: false, isSuperAdmin: false });
      return null;
    }
  };

  useEffect(() => {
    // Check if Firebase is configured
    const hasFirebaseConfig = !!import.meta.env.VITE_FIREBASE_API_KEY;

    if (!hasFirebaseConfig) {
      console.warn('Firebase not configured - skipping auth initialization');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (user) => {
      setUser(user);
      if (user) {
        // Fetch admin role when user logs in
        await fetchAdminRole();
      } else {
        setAdminRole(null);
      }
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

  const handleResetPassword = async (email: string) => {
    try {
      await resetPassword(email);
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isSuperAdmin: adminRole?.isSuperAdmin ?? false,
    adminRole,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    checkEmailExists,
    resetPassword: handleResetPassword,
    refreshAdminRole: fetchAdminRole,
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

// Super Admin Route component
export const SuperAdminRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isSuperAdmin, adminRole } = useAuth();
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
    // Redirect to super-admin login page
    return <Navigate to="/super-admin/login" state={{ from: location }} replace />;
  }

  if (!isSuperAdmin) {
    // User is logged in but not a super admin - show access denied
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">
            You don't have permission to access the super admin panel.
            Please contact your administrator if you believe this is an error.
          </p>
          <a
            href="/"
            className="mt-4 text-primary hover:underline"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};


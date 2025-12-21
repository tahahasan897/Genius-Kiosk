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
  sendAdminInviteLink,
  type User
} from '@/lib/firebase';
import { checkAdminRole, type AdminRoleResponse } from '@/api/superadmin';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTeamAdmin: boolean; // Can access /team page (super_admin or team_admin)
  role: 'super_admin' | 'team_admin' | 'store_admin' | null; // The actual role
  adminRole: AdminRoleResponse | null;
  signInWithGoogle: () => Promise<User | void>;
  signInWithEmail: (email: string, password: string) => Promise<User | void>;
  signUpWithEmail: (email: string, password: string) => Promise<User | void>;
  signOut: () => Promise<void>;
  checkEmailExists: (email: string) => Promise<{ exists: boolean; methods: string[] }>;
  resetPassword: (email: string) => Promise<void>;
  refreshAdminRole: () => Promise<AdminRoleResponse | null>;
  sendAdminInviteLink: (email: string) => Promise<void>;
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
      console.warn('Firebase auth state check timed out');
      setLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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

  const handleSendAdminInviteLink = async (email: string) => {
    try {
      await sendAdminInviteLink(email);
    } catch (error) {
      console.error('Failed to send admin invite link:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAdmin: adminRole?.isAdmin ?? false,
    isSuperAdmin: adminRole?.isSuperAdmin ?? false,
    isTeamAdmin: adminRole?.isTeamAdmin ?? adminRole?.isSuperAdmin ?? false, // Can access /team page
    role: adminRole?.role ?? null, // 'super_admin', 'team_admin', or 'store_admin'
    adminRole,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    checkEmailExists,
    resetPassword: handleResetPassword,
    refreshAdminRole: fetchAdminRole,
    sendAdminInviteLink: handleSendAdminInviteLink,
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

// Team Admin Route component - allows super_admin and team_admin (NOT store_admin)
// Store admins can only access /admin, not /team
export const SuperAdminRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, isTeamAdmin, role, adminRole, signOut, refreshAdminRole } = useAuth();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshAdminRole();
    } finally {
      setRetrying(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/team/login';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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
    // Redirect to team login page
    return <Navigate to="/team/login" state={{ from: location }} replace />;
  }

  // Check if user is a team admin (super_admin or team_admin)
  // Store admins (role='store_admin') cannot access the /team page
  if (!isTeamAdmin) {
    // Determine the appropriate message
    const isStoreAdmin = isAdmin && role === 'store_admin';
    const title = isStoreAdmin ? 'Team Access Required' : 'Access Denied';
    const message = isStoreAdmin
      ? 'You have Store Admin access. The Team Dashboard is only available to Team Admins and Super Admins. You can access the Store Admin panel at /admin.'
      : "You don't have permission to access the Team Dashboard. Please contact your administrator if you believe this is an error.";

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
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground max-w-md">
            {message}
          </p>
          {user?.email && (
            <p className="text-sm text-muted-foreground">
              Signed in as: {user.email}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {retrying ? 'Checking...' : 'Check Access Again'}
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-md border border-input hover:bg-accent hover:text-accent-foreground"
            >
              Sign Out
            </button>
          </div>
          <a
            href="/"
            className="mt-2 text-sm text-muted-foreground hover:underline"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};


import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Shield, Mail, Lock, ArrowLeft } from 'lucide-react';

const SuperAdminLogin = () => {
  const { signInWithGoogle, signInWithEmail, user, isAdmin, refreshAdminRole, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Get the intended destination or default to /super-admin
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/super-admin';

  // Check if user is already logged in and is an admin (super or chain)
  useEffect(() => {
    if (user && isAdmin) {
      navigate(from, { replace: true });
    }
  }, [user, isAdmin, navigate, from]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      // Refresh admin role to check if admin
      const role = await refreshAdminRole();

      if (role?.isAdmin) {
        toast.success('Signed in successfully!');
        navigate(from, { replace: true });
      } else {
        toast.error('Access denied. You are not an admin.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    setSignInError(null);
    setHasError(false);

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      // Refresh admin role to check if admin
      const role = await refreshAdminRole();

      if (role?.isAdmin) {
        toast.success('Signed in successfully!');
        navigate(from, { replace: true });
      } else {
        toast.error('Access denied. You are not an admin.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      setSignInError('Incorrect email or password.');
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(resetEmail);
      toast.success('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      const errorCode = error?.code || '';
      if (errorCode === 'auth/user-not-found') {
        toast.error('No account found with this email address.');
      } else if (errorCode === 'auth/invalid-email') {
        toast.error('Invalid email address.');
      } else {
        toast.error('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />

      <Card className="w-full max-w-md relative z-10 border-gray-700 shadow-2xl bg-gray-900 text-slate-100">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-100">
            Super Admin
          </CardTitle>
          <CardDescription className="text-base mt-2 text-slate-400">
            Sign in to access the super admin panel
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {showForgotPassword ? (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100">Reset Your Password</h3>
                <p className="text-sm text-slate-400">
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-slate-300">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleForgotPassword();
                      }
                    }}
                  />
                </div>
              </div>

              <Button
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full h-12 text-base font-medium bg-blue-500 hover:bg-blue-600 text-white"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                }}
                disabled={loading}
                className="w-full text-slate-400 hover:text-slate-100 hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${hasError ? 'text-red-400' : 'text-slate-500'}`} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (hasError) {
                          setSignInError(null);
                          setHasError(false);
                        }
                      }}
                      className={`pl-10 bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500 ${hasError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${hasError ? 'text-red-400' : 'text-slate-500'}`} />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (hasError) {
                          setSignInError(null);
                          setHasError(false);
                        }
                      }}
                      className={`pl-10 bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500 ${hasError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEmailSignIn();
                        }
                      }}
                    />
                  </div>
                  {signInError && (
                    <p className="text-sm text-red-400 mt-1">
                      {signInError}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleEmailSignIn}
                  disabled={loading}
                  className="w-full h-12 text-base font-medium bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setResetEmail(email);
                    }}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-900 px-2 text-slate-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                variant="outline"
                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 shadow-sm transition-all hover:shadow-md"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </div>
                )}
              </Button>
            </>
          )}

          <p className="text-center text-xs text-slate-500">
            This portal is for authorized team members only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminLogin;

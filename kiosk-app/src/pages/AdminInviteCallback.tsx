import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  checkIsSignInWithEmailLink,
  completeSignInWithEmailLink
} from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';

type CallbackState = 'verifying' | 'email_required' | 'success' | 'error' | 'already_authenticated';

const AdminInviteCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshAdminRole, isSuperAdmin, adminRole } = useAuth();

  const [state, setState] = useState<CallbackState>('verifying');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedSignIn = useRef(false);

  useEffect(() => {
    // Prevent running multiple times
    if (hasAttemptedSignIn.current) return;

    const processSignIn = async () => {
      // If user is already authenticated and is an admin, redirect
      if (user && (isSuperAdmin || adminRole?.isAdmin)) {
        setState('already_authenticated');
        setTimeout(() => navigate('/super-admin', { replace: true }), 2000);
        return;
      }

      // Check if this is a valid sign-in link
      const currentUrl = window.location.href;
      console.log('Checking sign-in link:', currentUrl);

      if (!checkIsSignInWithEmailLink(currentUrl)) {
        console.log('Not a valid sign-in link');
        setState('error');
        setError('Invalid or expired invitation link. Please request a new invite from your administrator.');
        return;
      }

      console.log('Valid sign-in link detected');

      // Try to get email from URL params or localStorage
      const emailFromUrl = searchParams.get('email');
      const emailFromStorage = window.localStorage.getItem('emailForSignIn');
      const detectedEmail = emailFromUrl || emailFromStorage;

      console.log('Email from URL:', emailFromUrl);
      console.log('Email from storage:', emailFromStorage);

      if (detectedEmail) {
        // Auto-complete sign-in
        hasAttemptedSignIn.current = true;
        await handleSignIn(detectedEmail);
      } else {
        // Need user to provide email
        setState('email_required');
      }
    };

    processSignIn();
  }, [user, isSuperAdmin, adminRole]);

  const handleSignIn = async (emailToUse: string) => {
    setLoading(true);
    setError(null);
    hasAttemptedSignIn.current = true;

    try {
      const currentUrl = window.location.href;
      await completeSignInWithEmailLink(emailToUse, currentUrl);

      // Refresh admin role to trigger auto-promotion
      const role = await refreshAdminRole();

      if (role?.isAdmin) {
        setState('success');
        toast.success('Welcome! You now have admin access.');
        setTimeout(() => {
          navigate('/super-admin', { replace: true });
        }, 2000);
      } else {
        setState('error');
        setError('Sign-in successful, but no pending invite was found for this email. Please contact your administrator.');
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setState('error');

      // Handle specific Firebase errors
      if (err.code === 'auth/invalid-action-code') {
        setError('This invitation link has expired or already been used. Please request a new invite from your administrator.');
      } else if (err.code === 'auth/invalid-email') {
        setError('The email address is invalid. Please check and try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already associated with an account. Please sign in through the normal login page.');
      } else {
        setError(err.message || 'Failed to complete sign-in. Please try again or contact your administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    handleSignIn(email.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />

      <Card className="w-full max-w-md relative z-10 border-gray-700 shadow-2xl bg-gray-900 text-slate-100">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
            {state === 'verifying' && <Loader2 className="h-8 w-8 text-white animate-spin" />}
            {state === 'success' && <CheckCircle className="h-8 w-8 text-white" />}
            {state === 'error' && <XCircle className="h-8 w-8 text-white" />}
            {state === 'email_required' && <Mail className="h-8 w-8 text-white" />}
            {state === 'already_authenticated' && <Shield className="h-8 w-8 text-white" />}
          </div>

          <CardTitle className="text-2xl font-bold text-slate-100">
            {state === 'verifying' && 'Verifying Invitation...'}
            {state === 'success' && 'Welcome Aboard!'}
            {state === 'error' && 'Something Went Wrong'}
            {state === 'email_required' && 'Confirm Your Email'}
            {state === 'already_authenticated' && 'Already Signed In'}
          </CardTitle>

          <CardDescription className="text-base mt-2 text-slate-400">
            {state === 'verifying' && 'Please wait while we verify your invitation...'}
            {state === 'success' && 'Your admin account has been activated.'}
            {state === 'error' && error}
            {state === 'email_required' && 'Please enter the email address where you received the invitation.'}
            {state === 'already_authenticated' && 'Redirecting to admin panel...'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {state === 'verifying' && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-slate-400 text-sm">Setting up your account...</p>
              </div>
            </div>
          )}

          {state === 'email_required' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                    disabled={loading}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Enter the same email address where you received the invitation.
                </p>
              </div>
              <Button
                onClick={handleEmailSubmit}
                disabled={loading}
                className="w-full h-12 text-base font-medium bg-blue-500 hover:bg-blue-600 text-white"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <Button
                onClick={() => navigate('/super-admin/login')}
                variant="outline"
                className="w-full h-12 text-base font-medium border-gray-600 text-slate-300 hover:bg-gray-800 hover:text-slate-100"
              >
                Go to Login
              </Button>
            </div>
          )}

          {(state === 'success' || state === 'already_authenticated') && (
            <div className="flex flex-col items-center justify-center py-4 gap-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-slate-400">Redirecting to admin panel...</span>
              </div>
              <Button
                onClick={() => navigate('/super-admin', { replace: true })}
                variant="ghost"
                className="text-blue-500 hover:text-blue-400 hover:bg-gray-800"
              >
                Click here if not redirected
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInviteCallback;

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Lock, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { sendVerificationCode, verifyCode } from '@/api/auth';

const Login = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, user, checkEmailExists, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Passcode verification states
  const [showPasscodeInput, setShowPasscodeInput] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'signin' | 'signup' | null>(null);
  
  // Error states for sign-in
  const [signInError, setSignInError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Get the intended destination or default to /admin
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin';

  // If already logged in and not in verification process, redirect
  if (user && !showPasscodeInput && !pendingAction) {
    navigate(from, { replace: true });
    return null;
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Signed in successfully!');
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    // Clear previous errors
    setSignInError(null);
    setHasError(false);
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // For sign-up: First check if email already exists in Firebase
        const emailCheck = await checkEmailExists(email);
        if (emailCheck.exists) {
          toast.error('This email is already registered. Please sign in instead.');
          setLoading(false);
          return;
        }
        
        // Email doesn't exist, proceed with verification
        await sendVerificationCode(email);
        setPendingEmail(email);
        setPendingPassword(password);
        setPendingAction('signup');
        setShowPasscodeInput(true);
        toast.success('Verification code sent to your email!');
      } else {
        // For sign-in: Set pending state BEFORE signing in to prevent redirect
        setPendingAction('signin');
        setPendingEmail(email);
        setPendingPassword(password);
        
        // Verify credentials are correct
        await signInWithEmail(email, password);
        
        // Credentials are valid - now send verification code
        await sendVerificationCode(email);
        setShowPasscodeInput(true);
        toast.success('Verification code sent to your email!');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // Reset pending state on error
      setPendingAction(null);
      setPendingEmail('');
      setPendingPassword('');
      
      // Check for Firebase error codes
      const errorCode = error?.code || '';
      
      if (isSignUp) {
        // Sign-up specific errors - show as toast
        let errorMessage = 'Failed to create account. Please try again.';
        
        if (errorCode === 'auth/email-already-in-use') {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (errorCode === 'auth/weak-password') {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (errorCode === 'auth/invalid-email') {
          errorMessage = 'Invalid email address. Please check and try again.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }
        
        toast.error(errorMessage);
      } else {
        // Sign-in errors - show universal message inline
        setSignInError('Incorrect email or password.');
        setHasError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasscode = async () => {
    if (!passcode || passcode.length !== 6) {
      toast.error('Please enter a 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      // Verify the passcode
      await verifyCode(pendingEmail, passcode);
      
      if (pendingAction === 'signup') {
        // For sign-up: Create the Firebase account after verification
        await signUpWithEmail(pendingEmail, pendingPassword);
        toast.success('Account created and verified successfully!');
      } else {
        // For sign-in: User is already signed in, just show success
        toast.success('Signed in successfully!');
      }
      
      // Clear states and navigate
      setShowPasscodeInput(false);
      setPasscode('');
      setPendingEmail('');
      setPendingPassword('');
      setPendingAction(null);
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error('Verification error:', error);
      const errorMessage = error.response?.data?.error || error.code === 'auth/email-already-in-use' 
        ? 'This email is already registered. Please sign in instead.'
        : 'Verification failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    try {
      await sendVerificationCode(pendingEmail);
      toast.success('Verification code resent to your email!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to resend code. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromPasscode = async () => {
    // If user was in sign-in verification, sign them out
    if (pendingAction === 'signin' && user) {
      await signOut();
    }
    setShowPasscodeInput(false);
    setPasscode('');
    setPendingEmail('');
    setPendingPassword('');
    setPendingAction(null);
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9ImhzbCh2YXIoLS1wcmltYXJ5KSkiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
      
      <Card className="w-full max-w-md relative z-10 border shadow-xl bg-card">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Lock className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">
            Admin Login
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {isSignUp ? 'Create your admin account' : 'Sign in to access the admin dashboard'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-4">
          <Tabs value={isSignUp ? 'signup' : 'signin'} onValueChange={async (v) => {
            // If switching while in verification, handle cleanup
            if (showPasscodeInput && pendingAction === 'signin' && user) {
              await signOut();
            }
            setIsSignUp(v === 'signup');
            // Clear all states when switching tabs
            setSignInError(null);
            setHasError(false);
            setShowPasscodeInput(false);
            setPasscode('');
            setPendingEmail('');
            setPendingPassword('');
            setPendingAction(null);
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-6">
              {showForgotPassword ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Reset Your Password</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your email and we'll send you a reset link
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10"
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
                    className="w-full h-12 text-base font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
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
                    className="w-full"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </div>
              ) : !showPasscodeInput ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-signin">Email</Label>
                    <div className="relative">
                      <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${hasError ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <Input
                        id="email-signin"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          // Clear error when user starts typing
                          if (hasError) {
                            setSignInError(null);
                            setHasError(false);
                          }
                        }}
                        className={`pl-10 ${hasError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password-signin">Password</Label>
                    <div className="relative">
                      <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${hasError ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <Input
                        id="password-signin"
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          // Clear error when user starts typing
                          if (hasError) {
                            setSignInError(null);
                            setHasError(false);
                          }
                        }}
                        className={`pl-10 ${hasError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        disabled={loading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleEmailAuth();
                          }
                        }}
                      />
                    </div>
                    {/* Error message displayed below password field */}
                    {signInError && (
                      <p className="text-sm text-destructive mt-1">
                        {signInError}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={handleEmailAuth}
                    disabled={loading}
                    className="w-full h-12 text-base font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
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
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <KeyRound className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Verify Your Identity</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a 6-digit verification code to
                    </p>
                    <p className="text-sm font-medium text-foreground">{pendingEmail}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="passcode-signin">Enter Verification Code</Label>
                    <Input
                      id="passcode-signin"
                      type="text"
                      inputMode="numeric"
                      value={passcode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPasscode(value);
                      }}
                      className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                      maxLength={6}
                      disabled={loading}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && passcode.length === 6) {
                          handleVerifyPasscode();
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Code expires in 10 minutes
                    </p>
                  </div>

                  <Button
                    onClick={handleVerifyPasscode}
                    disabled={loading || passcode.length !== 6}
                    className="w-full h-12 text-base font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        <span>Verifying...</span>
                      </div>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={loading}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      Didn't receive the code? Resend
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={handleBackFromPasscode}
                    disabled={loading}
                    className="w-full"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-6">
              {!showPasscodeInput ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-signup">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-signup"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password-signup">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password-signup"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        disabled={loading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleEmailAuth();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleEmailAuth}
                    disabled={loading}
                    className="w-full h-12 text-base font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        <span>Sending verification code...</span>
                      </div>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <KeyRound className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Verify Your Email</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a 6-digit verification code to
                    </p>
                    <p className="text-sm font-medium text-foreground">{pendingEmail}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="passcode">Enter Verification Code</Label>
                    <Input
                      id="passcode"
                      type="text"
                      inputMode="numeric"
                      value={passcode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPasscode(value);
                      }}
                      className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                      maxLength={6}
                      disabled={loading}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && passcode.length === 6) {
                          handleVerifyPasscode();
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Code expires in 10 minutes
                    </p>
                  </div>

                  <Button
                    onClick={handleVerifyPasscode}
                    disabled={loading || passcode.length !== 6}
                    className="w-full h-12 text-base font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        <span>Verifying...</span>
                      </div>
                    ) : (
                      'Verify & Create Account'
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={loading}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      Didn't receive the code? Resend
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={handleBackFromPasscode}
                    disabled={loading}
                    className="w-full"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
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

          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { updatePassword } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Shield, Eye, EyeOff, CheckCircle } from 'lucide-react';

const SetPassword = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password validation
  const isPasswordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSetPassword = async () => {
    if (!isPasswordValid) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      toast.success('Password set successfully! You can now sign in with email and password.');

      // Clear the flag
      window.localStorage.removeItem('needsPasswordSetup');

      // Navigate to admin panel after a brief delay
      setTimeout(() => {
        navigate('/super-admin', { replace: true });
      }, 2000);
    } catch (error: any) {
      console.error('Error setting password:', error);

      if (error.code === 'auth/requires-recent-login') {
        toast.error('For security reasons, please sign in again before setting your password.');
        navigate('/super-admin/login', { replace: true });
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Please use a stronger password.');
      } else {
        toast.error(error.message || 'Failed to set password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    window.localStorage.removeItem('needsPasswordSetup');
    navigate('/super-admin', { replace: true });
  };

  // If user is not logged in or not an admin, redirect
  if (!user || !isAdmin) {
    navigate('/super-admin/login', { replace: true });
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />

        <Card className="w-full max-w-md relative z-10 border-gray-700 shadow-2xl bg-gray-900 text-slate-100">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-100">
              Password Set!
            </CardTitle>
            <CardDescription className="text-base mt-2 text-slate-400">
              Your password has been set successfully. Redirecting to admin panel...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pt-4">
            <Button
              onClick={() => navigate('/super-admin', { replace: true })}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Go to Admin Panel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />

      <Card className="w-full max-w-md relative z-10 border-gray-700 shadow-2xl bg-gray-900 text-slate-100">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-100">
            Set Your Password
          </CardTitle>
          <CardDescription className="text-base mt-2 text-slate-400">
            Create a password so you can sign in with email and password in the future.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-200">
              Signed in as: <strong>{user?.email}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className={`text-xs ${isPasswordValid ? 'text-green-400' : 'text-slate-500'}`}>
                {isPasswordValid ? '✓ ' : ''}At least 8 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && (
                <p className={`text-xs ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                  {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </div>

            <Button
              onClick={handleSetPassword}
              disabled={loading || !isPasswordValid || !passwordsMatch}
              className="w-full h-12 text-base font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Setting password...</span>
                </div>
              ) : (
                'Set Password'
              )}
            </Button>

            <Button
              onClick={handleSkip}
              variant="ghost"
              disabled={loading}
              className="w-full text-slate-400 hover:text-slate-100 hover:bg-gray-800"
            >
              Skip for now
            </Button>

            <p className="text-center text-xs text-slate-500">
              You can always sign in with Google even without a password.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetPassword;

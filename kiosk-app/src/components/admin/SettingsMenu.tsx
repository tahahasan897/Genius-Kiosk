import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Settings,
  LogOut,
  HelpCircle,
  FileQuestion,
  BookOpen,
  User,
  Store,
  Copy,
  Check,
  Plus,
  Trash2,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

const SUPPORT_EMAIL = 'support@aislegenius.com';
const DOCS_URL = 'https://aislegenius.com/docs';
const FAQS_URL = 'https://aislegenius.com/faqs';

const SettingsMenu = () => {
  const { user, signOut } = useAuth();
  const { currentChain, currentStore, stores, chains } = useStore();

  const [helpExpanded, setHelpExpanded] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [showManageStores, setShowManageStores] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setEmailCopied(true);
      toast.success('Email copied to clipboard');
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy email');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  // Get stores for current chain
  const chainStores = stores.filter(s => s.chain_id === currentChain?.chain_id);

  // Placeholder plan info (will be dynamic later)
  const planInfo = {
    name: 'Basic Plan',
    maxStores: 3, // Will be fetched from DB later
    currentStores: chainStores.length,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all duration-200"
          >
            <Settings className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 bg-white border border-gray-200 shadow-lg rounded-xl p-1"
        >
          {/* Account Header */}
          <div className="px-3 py-2 border-b border-gray-100 mb-1">
            <p className="text-sm font-medium text-gray-900">
              {currentChain?.chain_name || 'My Account'}
            </p>
            <p className="text-xs text-gray-500">
              {user?.email || 'Not signed in'}
            </p>
          </div>

          {/* Account & Plan Info */}
          <DropdownMenuItem
            onClick={() => setShowAccountInfo(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <User className="h-4 w-4" />
            <span>Account & Plan</span>
          </DropdownMenuItem>

          {/* Manage Stores */}
          <DropdownMenuItem
            onClick={() => setShowManageStores(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <Store className="h-4 w-4" />
            <div className="flex-1 flex items-center justify-between">
              <span>Manage Stores</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {chainStores.length}/{planInfo.maxStores}
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-gray-100 my-1" />

          {/* Help - Expandable */}
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              setHelpExpanded(!helpExpanded);
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Help?</span>
          </DropdownMenuItem>

          {helpExpanded && (
            <div className="mx-2 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Contact support:</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700 flex-1 font-mono">
                  {SUPPORT_EMAIL}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyEmail}
                  className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600"
                >
                  {emailCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* FAQs */}
          <DropdownMenuItem
            onClick={() => window.open(FAQS_URL, '_blank')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <FileQuestion className="h-4 w-4" />
            <span>FAQs</span>
          </DropdownMenuItem>

          {/* Docs */}
          <DropdownMenuItem
            onClick={() => window.open(DOCS_URL, '_blank')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            <span>Docs</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-gray-100 my-1" />

          {/* Sign Out */}
          <DropdownMenuItem
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Account & Plan Dialog */}
      <Dialog open={showAccountInfo} onOpenChange={setShowAccountInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account & Plan</DialogTitle>
            <DialogDescription>
              Your account information and current plan details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Account Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-500">Account</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Email</span>
                  <span className="text-sm font-medium">{user?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Chain</span>
                  <span className="text-sm font-medium">{currentChain?.chain_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Current Store</span>
                  <span className="text-sm font-medium">{currentStore?.store_name || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Plan Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-500">Plan</h4>
              <div className="bg-blue-50 rounded-lg p-4 space-y-2 border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Current Plan</span>
                  <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    {planInfo.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Stores</span>
                  <span className="text-sm font-medium">
                    {planInfo.currentStores} / {planInfo.maxStores}
                  </span>
                </div>
              </div>
            </div>

            {/* Upgrade CTA */}
            <Button
              variant="outline"
              className="w-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
              onClick={() => window.open('https://aislegenius.com/pricing', '_blank')}
            >
              Upgrade Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Stores Dialog */}
      <Dialog open={showManageStores} onOpenChange={setShowManageStores}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Stores</DialogTitle>
            <DialogDescription>
              Add, edit, or remove stores for {currentChain?.chain_name || 'your chain'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Store Limit Banner */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
              <span className="text-sm text-gray-600">Store Limit</span>
              <span className="text-sm font-medium">
                {chainStores.length} / {planInfo.maxStores} stores
              </span>
            </div>

            {/* Store List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {chainStores.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Store className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No stores yet</p>
                </div>
              ) : (
                chainStores.map((store) => (
                  <div
                    key={store.store_id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Store className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {store.store_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {store.city ? `${store.city}, ${store.state}` : 'No location set'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => {
                        // TODO: Implement delete store
                        toast.info('Delete store coming soon');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Add Store Button */}
            <Button
              className="w-full"
              disabled={chainStores.length >= planInfo.maxStores}
              onClick={() => {
                // TODO: Implement add store
                toast.info('Add store coming soon');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Store
              {chainStores.length >= planInfo.maxStores && (
                <span className="ml-2 text-xs opacity-70">(Upgrade to add more)</span>
              )}
            </Button>

            {chainStores.length >= planInfo.maxStores && (
              <p className="text-xs text-center text-gray-500">
                You've reached your plan's store limit.{' '}
                <button
                  onClick={() => window.open('https://aislegenius.com/pricing', '_blank')}
                  className="text-blue-600 hover:underline"
                >
                  Upgrade your plan
                </button>
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingsMenu;

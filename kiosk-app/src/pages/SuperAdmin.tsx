import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Shield, LayoutDashboard, Building2, Store, Users, LogOut, Settings, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import SuperAdminDashboard from '@/components/super-admin/SuperAdminDashboard';
import ChainManagement from '@/components/super-admin/ChainManagement';
import StoreManagement from '@/components/super-admin/StoreManagement';
import AdminManagement from '@/components/super-admin/AdminManagement';

const SuperAdmin = () => {
  const { user, signOut, adminRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/super-admin/login');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg">
                <Shield className="h-6 w-6 text-slate-900" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">Super Admin</h1>
                <p className="text-xs text-slate-400">Aisle Genius Platform</p>
              </div>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-slate-300 hover:text-slate-100 hover:bg-slate-700"
                >
                  <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-amber-500">
                      {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-sm">
                    {adminRole?.displayName || user?.email?.split('@')[0] || 'Admin'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-slate-800 border-slate-700 text-slate-100"
              >
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{adminRole?.displayName || 'Super Admin'}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-400 hover:text-red-300 hover:bg-slate-700 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700 p-1">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 text-slate-400 hover:text-slate-100"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="chains"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 text-slate-400 hover:text-slate-100"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Chains
            </TabsTrigger>
            <TabsTrigger
              value="stores"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 text-slate-400 hover:text-slate-100"
            >
              <Store className="h-4 w-4 mr-2" />
              Stores
            </TabsTrigger>
            <TabsTrigger
              value="admins"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 text-slate-400 hover:text-slate-100"
            >
              <Users className="h-4 w-4 mr-2" />
              Admins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <SuperAdminDashboard onNavigateToTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="chains" className="mt-6">
            <ChainManagement />
          </TabsContent>

          <TabsContent value="stores" className="mt-6">
            <StoreManagement />
          </TabsContent>

          <TabsContent value="admins" className="mt-6">
            <AdminManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SuperAdmin;

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSuperAdminDashboard, type DashboardStats } from '@/api/superadmin';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2,
  Store,
  Package,
  Users,
  RefreshCw,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface SuperAdminDashboardProps {
  onNavigateToTab: (tab: string) => void;
}

const SuperAdminDashboard = ({ onNavigateToTab }: SuperAdminDashboardProps) => {
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getSuperAdminDashboard();
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <p className="text-red-400">Failed to load dashboard data</p>
          <Button onClick={fetchStats} variant="outline" className="border-gray-600 text-slate-300 hover:bg-gray-800">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className={`grid gap-4 md:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {/* Chain admins see "My Chain" instead of "Total Chains" */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              {isSuperAdmin ? 'Total Chains' : 'My Chain'}
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{stats.stats.totalChains}</div>
            {isSuperAdmin ? (
              <Button
                variant="link"
                className="p-0 h-auto text-xs text-blue-500 hover:text-blue-400"
                onClick={() => onNavigateToTab('chains')}
              >
                View all chains
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <p className="text-xs text-slate-500">Assigned chain</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              {isSuperAdmin ? 'Total Stores' : 'Stores'}
            </CardTitle>
            <Store className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{stats.stats.totalStores}</div>
            <Button
              variant="link"
              className="p-0 h-auto text-xs text-blue-500 hover:text-blue-400"
              onClick={() => onNavigateToTab('stores')}
            >
              {isSuperAdmin ? 'View all stores' : 'Manage stores'}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              {isSuperAdmin ? 'Total Products' : 'Products'}
            </CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{stats.stats.totalProducts}</div>
            <p className="text-xs text-slate-500">
              {isSuperAdmin ? 'Across all chains' : 'In your chain'}
            </p>
          </CardContent>
        </Card>

        {/* Only super admins see Admin Users card */}
        {isSuperAdmin && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Admin Users</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-100">{stats.stats.totalAdmins}</div>
              <Button
                variant="link"
                className="p-0 h-auto text-xs text-blue-500 hover:text-blue-400"
                onClick={() => onNavigateToTab('admins')}
              >
                Manage admins
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity Grid */}
      <div className={`grid gap-6 ${isSuperAdmin ? 'lg:grid-cols-2' : ''}`}>
        {/* Top Chains - only for super admins */}
        {isSuperAdmin && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100">Top Chains by Store Count</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topChains.length === 0 ? (
                <p className="text-slate-500 text-sm">No chains yet</p>
              ) : (
                <div className="space-y-3">
                  {stats.topChains.map((chain, index) => (
                    <div
                      key={chain.chain_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 text-sm font-bold">
                          {index + 1}
                        </div>
                        <span className="font-medium text-slate-200">{chain.chain_name}</span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {chain.store_count} {chain.store_count === 1 ? 'store' : 'stores'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Chains - only for super admins */}
        {isSuperAdmin && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100">Recently Added Chains</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentChains.length === 0 ? (
                <div className="text-center py-6">
                  <Building2 className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">No chains yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-gray-600 text-slate-300 hover:bg-gray-800"
                    onClick={() => onNavigateToTab('chains')}
                  >
                    Add First Chain
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentChains.map((chain) => (
                    <div
                      key={chain.chain_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-blue-500" />
                        <span className="font-medium text-slate-200">{chain.chain_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(chain.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Stores */}
        <Card className={`bg-gray-900 border-gray-700 ${isSuperAdmin ? 'lg:col-span-2' : ''}`}>
          <CardHeader>
            <CardTitle className="text-lg text-slate-100">Recently Added Stores</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentStores.length === 0 ? (
              <div className="text-center py-6">
                <Store className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-slate-500 text-sm">No stores yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-gray-600 text-slate-300 hover:bg-gray-800"
                  onClick={() => onNavigateToTab('stores')}
                >
                  Add First Store
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats.recentStores.map((store) => (
                  <div
                    key={store.store_id}
                    className="p-3 rounded-lg bg-gray-800/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-200">{store.store_name}</p>
                        <p className="text-xs text-slate-500">{store.chain_name}</p>
                      </div>
                      <Store className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                      <Clock className="h-3 w-3" />
                      {formatDate(store.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-slate-100">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {isSuperAdmin && (
              <Button
                variant="outline"
                className="border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                onClick={() => onNavigateToTab('chains')}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Add Chain
              </Button>
            )}
            <Button
              variant="outline"
              className="border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
              onClick={() => onNavigateToTab('stores')}
            >
              <Store className="h-4 w-4 mr-2" />
              Add Store
            </Button>
            {isSuperAdmin && (
              <Button
                variant="outline"
                className="border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                onClick={() => onNavigateToTab('admins')}
              >
                <Users className="h-4 w-4 mr-2" />
                Invite Admin
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;

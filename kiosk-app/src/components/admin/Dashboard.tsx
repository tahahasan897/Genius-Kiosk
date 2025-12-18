import { useEffect, useState, useMemo } from 'react';
import { getDashboardStats, type DashboardStats } from '@/api/admin';
import StatsCards from './StatsCards';
import GettingStarted from './GettingStarted';
import NotificationCenter from './NotificationCenter';
import QuickActions from './QuickActions';
import AnalyticsSummary from './AnalyticsSummary';
import { RefreshCw } from 'lucide-react';

interface DashboardProps {
  onNavigateToTab: (tab: string) => void;
  storeId?: number;
  chainId?: number;
}

const Dashboard = ({ onNavigateToTab, storeId = 1, chainId = 1 }: DashboardProps) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewCompleted, setPreviewCompleted] = useState(false);
  const [gettingStartedDismissed, setGettingStartedDismissed] = useState(false);

  // Check localStorage for preview completion and getting started dismissal (per chain, not per store)
  useEffect(() => {
    setPreviewCompleted(localStorage.getItem(`kioskPreviewCompleted_${chainId}`) === 'true');
    setGettingStartedDismissed(localStorage.getItem(`gettingStartedDismissed_${chainId}`) === 'true');
  }, [chainId]);

  const handleDismissGettingStarted = () => {
    localStorage.setItem(`gettingStartedDismissed_${chainId}`, 'true');
    setGettingStartedDismissed(true);
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats(storeId);
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [storeId]);

  // Calculate actual completed steps (including client-side preview check)
  // Must be called before any early returns to follow Rules of Hooks
  const actualCompletedSteps = useMemo(() => {
    if (!stats) return 0;
    let count = 0;
    stats.gettingStarted.steps.forEach(step => {
      if (step.id === 'preview-map') {
        if (previewCompleted) count++;
      } else if (step.completed) {
        count++;
      }
    });
    return count;
  }, [stats, previewCompleted]);

  const isGettingStartedComplete = stats
    ? actualCompletedSteps === stats.gettingStarted.totalSteps
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <button
            onClick={fetchStats}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Getting Started OR Analytics Summary */}
        {isGettingStartedComplete || gettingStartedDismissed ? (
          <AnalyticsSummary
            stats={stats}
            onNavigateToTab={onNavigateToTab}
          />
        ) : (
          <GettingStarted
            steps={stats.gettingStarted.steps}
            completedSteps={stats.gettingStarted.completedSteps}
            totalSteps={stats.gettingStarted.totalSteps}
            onNavigateToTab={onNavigateToTab}
            onDismiss={handleDismissGettingStarted}
            chainId={chainId}
          />
        )}

        {/* Right Column: Notification Center */}
        <NotificationCenter
          notifications={stats.notifications}
          onNavigateToTab={onNavigateToTab}
          onRefresh={fetchStats}
        />
      </div>

      {/* Quick Actions */}
      <QuickActions onNavigateToTab={onNavigateToTab} />
    </div>
  );
};

export default Dashboard;

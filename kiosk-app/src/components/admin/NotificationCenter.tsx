import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Bell,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  type Notification,
  type NotificationHistoryItem,
  getNotificationHistory,
  logNotifications,
  autoResolveNotifications,
} from '@/api/admin';

interface NotificationCenterProps {
  notifications: Notification[];
  onNavigateToTab: (tab: string) => void;
  onRefresh: () => void;
  chainId?: number;
}

const NotificationCenter = ({
  notifications,
  onNavigateToTab,
  onRefresh,
  chainId = 1,
}: NotificationCenterProps) => {
  const [showAllModal, setShowAllModal] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyData, setHistoryData] = useState<{
    notifications: NotificationHistoryItem[];
    hasNext: boolean;
    hasPrev: boolean;
    total: number;
  }>({ notifications: [], hasNext: false, hasPrev: false, total: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`dismissedNotifications_${chainId}`);
    if (stored) {
      setDismissedIds(JSON.parse(stored));
    }
  }, [chainId]);

  // Log notifications to history and auto-resolve when notifications change
  useEffect(() => {
    if (notifications.length > 0 && chainId) {
      // Log current notifications to history
      logNotifications(chainId, notifications).catch(console.error);

      // Auto-resolve notifications that are no longer active
      autoResolveNotifications(chainId, notifications.map(n => n.id)).catch(console.error);
    }
  }, [notifications, chainId]);

  // Fetch notification history when modal opens
  useEffect(() => {
    if (showAllModal && chainId) {
      fetchHistory();
    }
  }, [showAllModal, historyPage, chainId]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await getNotificationHistory(chainId, historyPage, 10);
      setHistoryData({
        notifications: data.notifications,
        hasNext: data.pagination.hasNext,
        hasPrev: data.pagination.hasPrev,
        total: data.pagination.total,
      });
    } catch (error) {
      console.error('Error fetching notification history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDismiss = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); // Prevent triggering the notification click
    const newDismissedIds = [...dismissedIds, notificationId];
    setDismissedIds(newDismissedIds);
    localStorage.setItem(`dismissedNotifications_${chainId}`, JSON.stringify(newDismissedIds));
  };

  // Filter out dismissed notifications
  const activeNotifications = useMemo(() =>
    notifications.filter(n => !dismissedIds.includes(n.id)),
    [notifications, dismissedIds]
  );

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBgColor = (type: Notification['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/5 border-red-500/20';
      case 'warning':
        return 'bg-amber-500/5 border-amber-500/20';
      case 'success':
        return 'bg-green-500/5 border-green-500/20';
      case 'info':
      default:
        return 'bg-blue-500/5 border-blue-500/20';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.action) {
      onNavigateToTab(notification.action);
      setShowAllModal(false);
    }
  };

  // Show only top 2 active notifications in the dashboard view
  const displayedNotifications = activeNotifications.slice(0, 2);
  const hasMore = activeNotifications.length > 2;

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <div
      className={`
        relative w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors group
        ${getBgColor(notification.type)}
      `}
    >
      <button
        onClick={(e) => handleDismiss(e, notification.id)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button
        onClick={() => handleNotificationClick(notification)}
        disabled={!notification.action}
        className={`flex items-start gap-3 flex-1 ${notification.action ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex-shrink-0 mt-0.5">
          {getIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium">{notification.title}</p>
          {notification.message && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {notification.message}
            </p>
          )}
          {notification.timestamp && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {new Date(notification.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </button>
    </div>
  );

  return (
    <>
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {displayedNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">All caught up! No notifications.</p>
            </div>
          ) : (
            <>
              {displayedNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => setShowAllModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    See all notifications
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification History Modal */}
      <Dialog open={showAllModal} onOpenChange={(open) => {
        setShowAllModal(open);
        if (!open) setHistoryPage(1); // Reset page when closing
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification History ({historyData.total})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {historyLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : historyData.notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No notification history</p>
              </div>
            ) : (
              historyData.notifications.map((item) => (
                <div
                  key={item.id}
                  className={`
                    relative w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors
                    ${item.is_resolved ? 'bg-gray-50 border-gray-200 opacity-70' : getBgColor(item.type)}
                  `}
                >
                  {/* Resolved checkmark */}
                  {item.is_resolved && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className={`text-sm font-medium ${item.is_resolved ? 'line-through text-muted-foreground' : ''}`}>
                      {item.title}
                    </p>
                    {item.message && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {new Date(item.created_at).toLocaleString()}
                      {item.is_resolved && item.resolved_at && (
                        <span className="ml-2 text-green-600">
                          (Resolved {new Date(item.resolved_at).toLocaleDateString()})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {(historyData.hasPrev || historyData.hasNext) && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <button
                onClick={() => setHistoryPage(p => p - 1)}
                disabled={!historyData.hasPrev}
                className={`flex items-center gap-1 text-sm ${historyData.hasPrev ? 'text-blue-600 hover:text-blue-700' : 'text-gray-300 cursor-not-allowed'}`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {historyPage}
              </span>
              <button
                onClick={() => setHistoryPage(p => p + 1)}
                disabled={!historyData.hasNext}
                className={`flex items-center gap-1 text-sm ${historyData.hasNext ? 'text-blue-600 hover:text-blue-700' : 'text-gray-300 cursor-not-allowed'}`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationCenter;

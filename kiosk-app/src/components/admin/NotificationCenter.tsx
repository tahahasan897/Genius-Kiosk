import { useState } from 'react';
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
  Bell,
  RefreshCw,
} from 'lucide-react';
import { type Notification } from '@/api/admin';

interface NotificationCenterProps {
  notifications: Notification[];
  onNavigateToTab: (tab: string) => void;
  onRefresh: () => void;
}

const NotificationCenter = ({
  notifications,
  onNavigateToTab,
  onRefresh,
}: NotificationCenterProps) => {
  const [showAllModal, setShowAllModal] = useState(false);

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

  // Show only top 5 notifications in the dashboard view
  const displayedNotifications = notifications.slice(0, 5);
  const hasMore = notifications.length > 5;

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <button
      onClick={() => handleNotificationClick(notification)}
      disabled={!notification.action}
      className={`
        w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors
        ${getBgColor(notification.type)}
        ${notification.action ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}
      `}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
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
      {notification.action && (
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      )}
    </button>
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
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-sm"
                  onClick={() => setShowAllModal(true)}
                >
                  View all notifications ({notifications.length})
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* All Notifications Modal */}
      <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              All Notifications ({notifications.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationCenter;

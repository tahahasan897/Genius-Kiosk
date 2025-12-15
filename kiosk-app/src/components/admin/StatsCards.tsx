import { Card, CardContent } from '@/components/ui/card';
import { Package, Link2, AlertTriangle, Bell } from 'lucide-react';
import { type DashboardStats } from '@/api/admin';

interface StatsCardsProps {
  stats: DashboardStats;
}

const StatsCards = ({ stats }: StatsCardsProps) => {
  const cards = [
    {
      label: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Linked to Map',
      value: stats.linkedProducts,
      icon: Link2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Low Stock',
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: stats.lowStockCount > 0 ? 'text-amber-500' : 'text-muted-foreground',
      bgColor: stats.lowStockCount > 0 ? 'bg-amber-500/10' : 'bg-muted/50',
    },
    {
      label: 'Active Alerts',
      value: stats.notifications.filter(n => n.type === 'warning' || n.type === 'error').length,
      icon: Bell,
      color: stats.notifications.some(n => n.type === 'warning' || n.type === 'error')
        ? 'text-red-500'
        : 'text-muted-foreground',
      bgColor: stats.notifications.some(n => n.type === 'warning' || n.type === 'error')
        ? 'bg-red-500/10'
        : 'bg-muted/50',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;

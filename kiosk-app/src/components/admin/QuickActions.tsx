import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileUp, Map, Eye } from 'lucide-react';

interface QuickActionsProps {
  onNavigateToTab: (tab: string) => void;
}

const QuickActions = ({ onNavigateToTab }: QuickActionsProps) => {
  const actions = [
    {
      label: 'Add Product',
      description: 'Create a new product manually',
      icon: Plus,
      action: 'products',
      variant: 'default' as const,
    },
    {
      label: 'Import CSV',
      description: 'Bulk import products from file',
      icon: FileUp,
      action: 'import',
      variant: 'outline' as const,
    },
    {
      label: 'Edit Map',
      description: 'Configure store layout',
      icon: Map,
      action: 'map',
      variant: 'outline' as const,
    },
    {
      label: 'Preview Kiosk',
      description: 'See how customers will view it',
      icon: Eye,
      action: 'preview',
      variant: 'outline' as const,
    },
  ];

  const handleAction = (action: string) => {
    if (action === 'preview') {
      // Open kiosk preview in new tab
      window.open('/', '_blank');
    } else {
      onNavigateToTab(action);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              className="h-auto py-4 flex-col gap-2"
              onClick={() => handleAction(action.action)}
            >
              <action.icon className="h-5 w-5" />
              <div className="text-center">
                <p className="font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {action.description}
                </p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;

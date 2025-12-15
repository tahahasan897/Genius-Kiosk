import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Search, Tag, ChevronRight } from 'lucide-react';
import { type DashboardStats } from '@/api/admin';

interface AnalyticsSummaryProps {
  stats: DashboardStats;
  onNavigateToTab: (tab: string) => void;
}

const AnalyticsSummary = ({ stats, onNavigateToTab }: AnalyticsSummaryProps) => {
  const analytics = stats.analytics;

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analytics Summary
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Searched Product */}
        {analytics?.topSearchedProduct ? (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Search className="h-4 w-4" />
              Most Searched Product
            </div>
            <p className="font-semibold text-lg">
              {analytics.topSearchedProduct.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {analytics.topSearchedProduct.searchCount} searches
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Search className="h-4 w-4" />
              Most Searched Product
            </div>
            <p className="text-sm text-muted-foreground">
              No search data yet. Analytics will appear once customers start searching.
            </p>
          </div>
        )}

        {/* Total Searches */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-2xl font-bold">{analytics?.totalSearches || 0}</p>
            <p className="text-xs text-muted-foreground">Total Searches</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-2xl font-bold">{analytics?.searchesToday || 0}</p>
            <p className="text-xs text-muted-foreground">Searches Today</p>
          </div>
        </div>

        {/* Popular Categories */}
        {analytics?.topCategories && analytics.topCategories.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" />
              Popular Categories
            </div>
            <div className="flex flex-wrap gap-2">
              {analytics.topCategories.slice(0, 3).map((category) => (
                <span
                  key={category.name}
                  className="px-3 py-1 rounded-full bg-muted text-sm"
                >
                  {category.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View Full Analytics */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onNavigateToTab('analytics')}
        >
          View Full Analytics
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default AnalyticsSummary;

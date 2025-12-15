import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { type GettingStartedStep } from '@/api/admin';

interface GettingStartedProps {
  steps: GettingStartedStep[];
  completedSteps: number;
  totalSteps: number;
  onNavigateToTab: (tab: string) => void;
}

const GettingStarted = ({
  steps,
  completedSteps,
  totalSteps,
  onNavigateToTab,
}: GettingStartedProps) => {
  // Check localStorage for preview completion
  const enhancedSteps = useMemo(() => {
    const previewCompleted = localStorage.getItem('kioskPreviewCompleted') === 'true';
    return steps.map(step => {
      if (step.id === 'preview-map') {
        return { ...step, completed: previewCompleted };
      }
      return step;
    });
  }, [steps]);

  const actualCompletedSteps = enhancedSteps.filter(s => s.completed).length;
  const progressPercent = Math.round((actualCompletedSteps / totalSteps) * 100);

  const handleStepClick = (step: GettingStartedStep) => {
    if (!step.completed && step.action) {
      onNavigateToTab(step.action);
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Getting Started</CardTitle>
          <span className="text-sm font-medium text-muted-foreground">
            {progressPercent}% Complete
          </span>
        </div>
        <Progress value={progressPercent} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-1">
        {enhancedSteps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => handleStepClick(step)}
            disabled={step.completed}
            className={`
              w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
              ${step.completed
                ? 'bg-green-500/5 cursor-default'
                : 'hover:bg-muted/50 cursor-pointer group'
              }
            `}
          >
            {step.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.completed ? 'text-muted-foreground line-through' : ''}`}>
                {index + 1}. {step.title}
              </p>
              {!step.completed && step.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {step.description}
                </p>
              )}
            </div>
            {!step.completed && (
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
};

export default GettingStarted;

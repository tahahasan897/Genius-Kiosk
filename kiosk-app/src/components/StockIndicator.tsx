import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface StockIndicatorProps {
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  level: number;
  size?: 'sm' | 'lg';
}

const StockIndicator = ({ status, level, size = 'sm' }: StockIndicatorProps) => {
  const iconSize = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  const textSize = size === 'lg' ? 'text-xl' : 'text-base';

  const config = {
    'in-stock': {
      icon: CheckCircle,
      text: `In Stock: ${level} units available`,
      className: 'text-success',
      bgClassName: 'bg-success/10',
    },
    'low-stock': {
      icon: AlertCircle,
      text: `Low Stock: ${level} units remaining`,
      className: 'text-warning',
      bgClassName: 'bg-warning/10',
    },
    'out-of-stock': {
      icon: XCircle,
      text: 'Out of Stock',
      className: 'text-destructive',
      bgClassName: 'bg-destructive/10',
    },
  };

  const { icon: Icon, text, className, bgClassName } = config[status];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${bgClassName} ${className}`}>
      <Icon className={iconSize} />
      <span className={`font-semibold ${textSize}`}>{text}</span>
    </div>
  );
};

export default StockIndicator;

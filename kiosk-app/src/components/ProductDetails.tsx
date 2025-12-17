import { Product } from '@/data/products';
import { MapPin, Package, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StockIndicator from './StockIndicator';

interface ProductDetailsProps {
  product: Product;
}

const ProductDetails = ({ product }: ProductDetailsProps) => {
  return (
    <div className="h-full bg-card rounded-2xl shadow-lg border-2 border-border overflow-hidden">
      <div className="h-full overflow-y-auto p-8">
        {/* Product Image */}
        <div className="w-full aspect-square bg-muted rounded-xl mb-6 flex items-center justify-center overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-32 w-32 text-muted-foreground" />
          )}
        </div>

        {/* Product Name */}
        <h2 className="text-3xl font-bold text-foreground mb-2">{product.name}</h2>
        
        {/* Category */}
        <div className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-lg text-base font-semibold mb-6">
          {product.category}
        </div>

        {/* Stock Status */}
        <div className="mb-6">
          <StockIndicator status={product.stockStatus} level={product.stockLevel} size="lg" />
        </div>

        {/* Location */}
        <div className="bg-secondary/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="h-7 w-7 text-primary mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">Location</h3>
              <p className="text-2xl font-semibold text-primary">
                {product.aisle}-{product.shelf}
              </p>
            </div>
          </div>
          <Button size="lg" className="w-full text-lg h-14 rounded-xl shadow-md" variant="default">
            <MapPin className="mr-2 h-6 w-6" />
            Get Directions
          </Button>
        </div>

        {/* Price */}
        <div className="flex items-center gap-3 mb-6 p-6 bg-accent/10 rounded-xl">
          <DollarSign className="h-8 w-8 text-accent" />
          <div>
            <p className="text-base text-muted-foreground">Price</p>
            <p className="text-3xl font-bold text-accent">${product.price.toFixed(2)}</p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-foreground mb-3">Product Details</h3>
          <p className="text-lg text-muted-foreground leading-relaxed">{product.description}</p>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;

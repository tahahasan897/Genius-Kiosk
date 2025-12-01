import { MapPin } from 'lucide-react';
import { Product } from '@/data/products';

interface StoreMapProps {
  selectedProduct: Product | null;
}

const StoreMap = ({ selectedProduct }: StoreMapProps) => {
  return (
    <div className="h-full bg-card rounded-2xl shadow-lg border-2 border-border overflow-hidden">
      <div className="h-full relative bg-secondary/30">
        {/* Store Map Grid */}
        <div className="absolute inset-0 p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground">Store Map</h2>
            <p className="text-lg text-muted-foreground mt-1">Find your product location</p>
          </div>

          {/* Map Grid */}
          <div className="relative w-full h-[calc(100%-5rem)] border-4 border-primary/20 rounded-xl bg-white overflow-hidden">
            {/* Entrance */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-12 bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg rounded-t-lg">
              ENTRANCE
            </div>

            {/* Aisles */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((aisle) => {
              const row = Math.floor((aisle - 1) / 4);
              const col = (aisle - 1) % 4;
              const left = 10 + col * 22;
              const top = 15 + row * 25;

              const isSelectedAisle = selectedProduct && selectedProduct.aisle === aisle;

              return (
                <div
                  key={aisle}
                  className={`absolute transition-all ${
                    isSelectedAisle ? 'bg-primary/20 border-primary border-2' : 'bg-muted border-border border'
                  } rounded-lg`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: '18%',
                    height: '18%',
                  }}
                >
                  <div className="flex items-center justify-center h-full">
                    <span className={`text-lg font-bold ${isSelectedAisle ? 'text-primary' : 'text-muted-foreground'}`}>
                      Aisle {aisle}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Product Location Pin */}
            {selectedProduct && (
              <div
                className="absolute transition-all duration-300 animate-bounce"
                style={{
                  left: `${selectedProduct.mapX}%`,
                  top: `${selectedProduct.mapY}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <MapPin className="h-12 w-12 text-destructive fill-destructive drop-shadow-lg" />
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-destructive text-destructive-foreground px-3 py-1 rounded-lg text-sm font-semibold shadow-lg">
                  Your Product
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border-2 border-border">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-destructive fill-destructive" />
                  <span className="text-sm font-medium">Product Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-primary/20 border-2 border-primary rounded"></div>
                  <span className="text-sm font-medium">Selected Aisle</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreMap;

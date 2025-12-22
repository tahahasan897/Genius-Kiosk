import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Users, Monitor, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface StoreInfo {
  store_id: number;
  store_name: string;
  chain_name: string;
  city: string | null;
  state: string | null;
}

const Landing = () => {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        // Fetch all active stores (public endpoint)
        const response = await fetch(`${API_URL}/api/products/stores`);
        if (response.ok) {
          const data = await response.json();
          setStores(data);
        }
      } catch (error) {
        console.error('Failed to fetch stores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
              <Store className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Aisle Genius</h1>
          <p className="text-xl text-gray-600">Store Kiosk Management System</p>
        </div>

        {/* Main Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Admin Dashboard */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>
                Manage products, inventory, and store maps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin">
                <Button className="w-full" size="lg">
                  Go to Admin
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Team Dashboard */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                <Store className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Team Dashboard</CardTitle>
              <CardDescription>
                Manage chains, stores, and admin users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/team">
                <Button variant="outline" className="w-full" size="lg">
                  Go to Team
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Kiosk Previews */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Monitor className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Kiosk Preview</CardTitle>
                <CardDescription>
                  Preview the customer-facing kiosk for each store
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading stores...</span>
              </div>
            ) : stores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No stores available</p>
                <p className="text-sm">Create stores in the Team Dashboard first</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {stores.map((store) => (
                  <Link
                    key={store.store_id}
                    to={`/kiosk/${store.store_id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                        <Store className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{store.store_name}</p>
                        <p className="text-sm text-gray-500">
                          {store.chain_name}
                          {store.city && ` • ${store.city}, ${store.state}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 group-hover:text-primary">
                      <span>/kiosk/{store.store_id}</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Aisle Genius Kiosk System • Development Mode
        </p>
      </div>
    </div>
  );
};

export default Landing;

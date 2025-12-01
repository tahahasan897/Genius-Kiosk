import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, Edit, Trash2, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  importProducts,
  type AdminProduct,
} from '@/api/admin';
import MapEditor from '@/components/MapEditor';

const Admin = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    product_name: '',
    category: '',
    base_price: '',
    aisle: '',
    shelf: '',
    image_url: '',
    description: '',
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await getAdminProducts(page, 50);
      setProducts(response.products);
      setTotalPages(response.pagination.pages);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await importProducts(file, '1');
      toast.success(`Successfully imported ${result.imported} of ${result.total} products`);
      if (result.errors && result.errors.length > 0) {
        console.error('Import errors:', result.errors);
        toast.error(`${result.errors.length} products failed to import`);
      }
      setIsImportDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.error || 'Failed to import products');
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setFormData({
      sku: '',
      product_name: '',
      category: '',
      base_price: '',
      aisle: '',
      shelf: '',
      image_url: '',
      description: '',
    });
    setIsProductDialogOpen(true);
  };

  const handleEditProduct = (product: AdminProduct) => {
    setSelectedProduct(product);
    setFormData({
      sku: product.sku,
      product_name: product.product_name,
      category: product.category || '',
      base_price: product.base_price.toString(),
      aisle: product.aisle || '',
      shelf: product.shelf || '',
      image_url: product.image_url || '',
      description: product.description || '',
    });
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.sku || !formData.product_name || !formData.category || !formData.base_price) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const productData = {
        sku: formData.sku,
        product_name: formData.product_name,
        category: formData.category,
        base_price: parseFloat(formData.base_price),
        aisle: formData.aisle || undefined,
        shelf: formData.shelf || undefined,
        image_url: formData.image_url || undefined,
        description: formData.description || undefined,
      };

      if (selectedProduct) {
        await updateProduct(selectedProduct.product_id, productData);
        toast.success('Product updated successfully');
      } else {
        await createProduct(productData);
        toast.success('Product created successfully');
      }
      setIsProductDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.response?.data?.error || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteProductId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProductId) return;

    setLoading(true);
    try {
      await deleteProduct(deleteProductId);
      toast.success('Product deleted successfully');
      setIsDeleteDialogOpen(false);
      setDeleteProductId(null);
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error.response?.data?.error || 'Failed to delete product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-2 border-border bg-card shadow-md">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
                <p className="text-muted-foreground">Manage products and inventory</p>
              </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                  <Button
                    onClick={signOut}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </Button>
            </div>
              )}
            <Button
              onClick={fetchProducts}
              variant="outline"
              size="lg"
              disabled={loading}
              className="h-12"
            >
              <RefreshCw className={`mr-2 h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-8 py-8">
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="map">Store Map</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Products ({total})</CardTitle>
                    <CardDescription>Manage your product catalog</CardDescription>
                  </div>
                  <Button onClick={handleCreateProduct} size="lg" className="h-12">
                    <Plus className="mr-2 h-5 w-5" />
                    Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading && products.length === 0 ? (
                  <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading products...</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">No products found</p>
                    <Button onClick={handleCreateProduct} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Product
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Aisle</TableHead>
                            <TableHead>Shelf</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((product) => (
                            <TableRow key={product.product_id}>
                              <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                              <TableCell className="font-medium">{product.product_name}</TableCell>
                              <TableCell>{product.category}</TableCell>
                              <TableCell>${Number(product.base_price).toFixed(2)}</TableCell>
                              <TableCell>{product.aisle || '-'}</TableCell>
                              <TableCell>{product.shelf || '-'}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditProduct(product)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(product.product_id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || loading}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import Products from CSV</CardTitle>
                <CardDescription>
                  Upload a CSV file to bulk import products into your catalog
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Upload CSV File</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a CSV file with product data to import
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleImport}
                    disabled={loading}
                    className="max-w-xs mx-auto"
                  />
                </div>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="font-medium text-sm">CSV Format Requirements:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Required columns: sku, product_name, category, base_price</li>
                    <li>Optional columns: aisle, shelf, image_url, description</li>
                    <li>First row should contain column headers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="space-y-6">
            <MapEditor storeId={1} onSave={fetchProducts} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Product Create/Edit Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? 'Edit Product' : 'Create New Product'}</DialogTitle>
            <DialogDescription>
              {selectedProduct
                ? 'Update the product information below.'
                : 'Fill in the product information to add it to your catalog.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">
                  SKU <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="APPL001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="base_price">
                  Price <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="3.99"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder="Red Apples"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Produce"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aisle">Aisle</Label>
                <Input
                  id="aisle"
                  value={formData.aisle}
                  onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelf">Shelf</Label>
                <Input
                  id="shelf"
                  value={formData.shelf}
                  onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                  placeholder="Display"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct} disabled={loading}>
              {loading ? 'Saving...' : selectedProduct ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product from your
              catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;


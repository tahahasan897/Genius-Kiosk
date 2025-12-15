import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, Edit, Trash2, LogOut, FileSpreadsheet, CheckCircle2, AlertCircle, Download, FileUp, Settings, RefreshCw, LayoutDashboard, FileDown } from 'lucide-react';
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
import Dashboard from '@/components/admin/Dashboard';

const Admin = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // Handle navigation from dashboard
  const handleNavigateToTab = (tab: string) => {
    if (tab === 'preview') {
      window.open('/', '_blank');
      // Mark preview as completed in localStorage
      localStorage.setItem('kioskPreviewCompleted', 'true');
    } else {
      setActiveTab(tab);
    }
  };

  // Import drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    total: number;
    errors?: Array<{ row: number; error: string }>;
  } | null>(null);

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
    await processImportFile(file);
    event.target.value = '';
  };

  const processImportFile = async (file: File) => {
    setLoading(true);
    setImportResult(null);
    try {
      const result = await importProducts(file, '1');
      setImportResult({
        success: true,
        imported: result.imported,
        total: result.total,
        errors: result.errors,
      });
      toast.success(`Successfully imported ${result.imported} of ${result.total} products`);
      if (result.errors && result.errors.length > 0) {
        console.error('Import errors:', result.errors);
      }
      fetchProducts();
    } catch (error: any) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        imported: 0,
        total: 0,
        errors: [{ row: 0, error: error.response?.data?.error || 'Failed to import products' }],
      });
      toast.error(error.response?.data?.error || 'Failed to import products');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        await processImportFile(file);
      } else {
        toast.error('Please drop a CSV file');
      }
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `sku,product_name,description,category,base_price,aisle,shelf_position,stock_quantity,is_available,image_url
APPL001,Red Apples,Fresh red apples from local farms,Produce,3.99,1,A,50,t,https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400
MILK001,Whole Milk,Fresh whole milk 1 gallon,Dairy,4.29,2,B,30,t,https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400
BREAD001,White Bread,Soft white sandwich bread,Bakery,2.99,3,C,25,t,https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_products.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Sample CSV downloaded!');
  };

  const handleExportProducts = async () => {
    try {
      // Fetch all products for export (not just current page)
      const response = await getAdminProducts(1, 10000);
      const allProducts = response.products;

      if (allProducts.length === 0) {
        toast.error('No products to export');
        return;
      }

      // Build CSV content
      const headers = ['sku', 'product_name', 'description', 'category', 'base_price', 'aisle', 'shelf_position', 'image_url'];
      const csvRows = [headers.join(',')];

      allProducts.forEach((product) => {
        const row = [
          `"${(product.sku || '').replace(/"/g, '""')}"`,
          `"${(product.product_name || '').replace(/"/g, '""')}"`,
          `"${(product.description || '').replace(/"/g, '""')}"`,
          `"${(product.category || '').replace(/"/g, '""')}"`,
          product.base_price || '',
          `"${(product.aisle || '').replace(/"/g, '""')}"`,
          `"${(product.shelf || '').replace(/"/g, '""')}"`,
          `"${(product.image_url || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${allProducts.length} products`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export products');
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
              variant="outline"
              size="icon"
              onClick={() => {
                // Settings button - currently non-functional
                // TODO: Open settings modal/page
              }}
            >
              <Settings className="h-5 w-5" />
            </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="map">Store Map</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard onNavigateToTab={handleNavigateToTab} storeId={1} />
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Products ({total})</CardTitle>
                    <CardDescription>Manage your product catalog</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleExportProducts} variant="outline" size="lg" className="h-12">
                      <FileDown className="mr-2 h-5 w-5" />
                      Export
                    </Button>
                    <Button onClick={handleCreateProduct} size="lg" className="h-12">
                      <Plus className="mr-2 h-5 w-5" />
                      Add Product
                    </Button>
                  </div>
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
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Image</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Aisle</TableHead>
                            <TableHead>Shelf</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="max-w-[200px]">Description</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((product) => (
                            <TableRow key={product.product_id}>
                              <TableCell>
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.product_name}
                                    className="h-10 w-10 rounded object-cover"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                    No img
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                              <TableCell className="font-medium">{product.product_name}</TableCell>
                              <TableCell>{product.category}</TableCell>
                              <TableCell>${Number(product.base_price).toFixed(2)}</TableCell>
                              <TableCell>{product.aisle || '-'}</TableCell>
                              <TableCell>{product.shelf || '-'}</TableCell>
                              <TableCell>
                                <span className={
                                  product.stock_quantity === 0 ? 'text-red-500 font-medium' :
                                  product.stock_quantity && product.stock_quantity < 10 ? 'text-amber-500 font-medium' :
                                  ''
                                }>
                                  {product.stock_quantity ?? '-'}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={product.description || ''}>
                                {product.description || '-'}
                              </TableCell>
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
            <div className="grid gap-6 md:grid-cols-2">
              {/* Upload Card */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-primary" />
                    Import Products
                  </CardTitle>
                  <CardDescription>
                    Drag & drop or click to upload a CSV file
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                      transition-all duration-300 ease-in-out
                      ${isDragging 
                        ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }
                      ${loading ? 'opacity-50 pointer-events-none' : ''}
                    `}
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImport}
                      disabled={loading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    {loading ? (
                      <div className="space-y-4">
                        <div className="relative mx-auto w-16 h-16">
                          <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                          <FileSpreadsheet className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                        </div>
                        <p className="text-lg font-medium text-primary animate-pulse">Importing...</p>
                        <p className="text-sm text-muted-foreground">Please wait while we process your file</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className={`
                          mx-auto w-16 h-16 rounded-full flex items-center justify-center
                          transition-all duration-300
                          ${isDragging 
                            ? 'bg-primary text-primary-foreground scale-110' 
                            : 'bg-muted text-muted-foreground'
                          }
                        `}>
                          <Upload className={`h-8 w-8 transition-transform duration-300 ${isDragging ? 'scale-110 -translate-y-1' : ''}`} />
                        </div>
                        <div>
                          <p className="text-lg font-semibold">
                            {isDragging ? 'Drop your file here!' : 'Drag & drop your CSV file'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            or <span className="text-primary font-medium underline underline-offset-2">browse</span> to choose a file
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>CSV files only • Max 10MB</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Import Result */}
                  {importResult && (
                    <div className={`
                      mt-4 p-4 rounded-lg border-2 animate-in fade-in slide-in-from-bottom-2 duration-300
                      ${importResult.success 
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                        : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                      }
                    `}>
                      <div className="flex items-start gap-3">
                        {importResult.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={`font-medium ${importResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                            {importResult.success 
                              ? `Successfully imported ${importResult.imported} of ${importResult.total} products!`
                              : 'Import failed'
                            }
                          </p>
                          {importResult.errors && importResult.errors.length > 0 && (
                            <div className="mt-2 text-sm">
                              <p className="text-muted-foreground mb-1">
                                {importResult.errors.length} error{importResult.errors.length > 1 ? 's' : ''}:
                              </p>
                              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground max-h-24 overflow-y-auto">
                                {importResult.errors.slice(0, 5).map((err, i) => (
                                  <li key={i}>Row {err.row}: {err.error}</li>
                                ))}
                                {importResult.errors.length > 5 && (
                                  <li className="text-muted-foreground/70">...and {importResult.errors.length - 5} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-transparent"
                          onClick={() => setImportResult(null)}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Instructions Card */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    CSV Format Guide
                  </CardTitle>
                  <CardDescription>
                    Prepare your data in the correct format
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Required Fields */}
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="font-medium text-sm flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      Required Columns
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['sku', 'product_name', 'category', 'base_price'].map((col) => (
                        <code key={col} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                          {col}
                        </code>
                      ))}
                    </div>
                  </div>

                  {/* Optional Fields */}
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="font-medium text-sm text-muted-foreground">Optional Columns</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['aisle', 'shelf_position', 'description', 'image_url', 'stock_quantity', 'is_available'].map((col) => (
                        <code key={col} className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs font-mono">
                          {col}
                        </code>
                      ))}
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      First row must contain column headers
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Use <code className="text-xs bg-muted px-1 rounded">t</code> or <code className="text-xs bg-muted px-1 rounded">true</code> for is_available
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Duplicate SKUs will update existing products
                    </p>
                  </div>

                  {/* Download Sample Button */}
                  <Button 
                    variant="outline" 
                    className="w-full mt-2 gap-2"
                    onClick={downloadSampleCSV}
                  >
                    <Download className="h-4 w-4" />
                    Download Sample CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
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


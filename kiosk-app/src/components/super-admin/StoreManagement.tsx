import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getStores,
  getChains,
  createStore,
  updateStore,
  deleteStore,
  restoreStore,
  type Store,
  type Chain,
} from '@/api/superadmin';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Store as StoreIcon,
  RotateCcw,
  Building2,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface StoreFormData {
  chain_id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
}

const emptyFormData: StoreFormData = {
  chain_id: '',
  store_name: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
};

const StoreManagement = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(emptyFormData);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storesData, chainsData] = await Promise.all([
        getStores({
          search: searchQuery,
          chainId: selectedChainFilter !== 'all' ? parseInt(selectedChainFilter) : undefined,
          includeInactive: showInactive,
        }),
        getChains({ includeInactive: false }),
      ]);
      setStores(storesData.stores);
      setChains(chainsData.chains);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, selectedChainFilter, showInactive]);

  const handleCreate = async () => {
    if (!formData.chain_id) {
      toast.error('Please select a chain');
      return;
    }
    if (!formData.store_name.trim()) {
      toast.error('Store name is required');
      return;
    }

    setSubmitting(true);
    try {
      await createStore({
        chain_id: parseInt(formData.chain_id),
        store_name: formData.store_name,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zip_code || undefined,
        phone: formData.phone || undefined,
      });
      toast.success('Store created successfully');
      setShowCreateDialog(false);
      setFormData(emptyFormData);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedStore || !formData.store_name.trim()) {
      toast.error('Store name is required');
      return;
    }

    setSubmitting(true);
    try {
      await updateStore(selectedStore.store_id, {
        chain_id: formData.chain_id ? parseInt(formData.chain_id) : undefined,
        store_name: formData.store_name,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zip_code || undefined,
        phone: formData.phone || undefined,
      });
      toast.success('Store updated successfully');
      setShowEditDialog(false);
      setSelectedStore(null);
      setFormData(emptyFormData);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStore) return;

    setSubmitting(true);
    try {
      await deleteStore(selectedStore.store_id);
      toast.success('Store deactivated successfully');
      setShowDeleteDialog(false);
      setSelectedStore(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to deactivate store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (store: Store) => {
    try {
      await restoreStore(store.store_id);
      toast.success('Store restored successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to restore store');
    }
  };

  const openEditDialog = (store: Store) => {
    setSelectedStore(store);
    setFormData({
      chain_id: store.chain_id.toString(),
      store_name: store.store_name,
      address: store.address || '',
      city: store.city || '',
      state: store.state || '',
      zip_code: store.zip_code || '',
      phone: store.phone || '',
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (store: Store) => {
    setSelectedStore(store);
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getLocationString = (store: Store) => {
    const parts = [store.city, store.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Store Management</h2>
          <p className="text-slate-400 text-sm">Manage all stores across all chains</p>
        </div>
        <Button
          onClick={() => {
            setFormData(emptyFormData);
            setShowCreateDialog(true);
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white"
          disabled={chains.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Store
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search stores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <Select value={selectedChainFilter} onValueChange={setSelectedChainFilter}>
              <SelectTrigger className="w-full lg:w-[200px] bg-gray-800 border-gray-600 text-slate-100">
                <SelectValue placeholder="Filter by chain" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-slate-100">
                <SelectItem value="all">All Chains</SelectItem>
                {chains.map((chain) => (
                  <SelectItem key={chain.chain_id} value={chain.chain_id.toString()}>
                    {chain.chain_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-inactive-stores"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                className="border-gray-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <Label htmlFor="show-inactive-stores" className="text-slate-400 text-sm cursor-pointer">
                Show inactive
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stores Table */}
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12">
              <StoreIcon className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">
                {showInactive
                  ? 'No inactive stores'
                  : chains.length === 0
                    ? 'Create a chain first before adding stores'
                    : 'No stores found'}
              </p>
              {chains.length > 0 && !showInactive && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  variant="outline"
                  className="mt-4 border-gray-600 text-slate-300 hover:bg-gray-800"
                >
                  Add First Store
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">Store Name</TableHead>
                  <TableHead className="text-slate-400">Chain</TableHead>
                  <TableHead className="text-slate-400">Location</TableHead>
                  <TableHead className="text-slate-400">Map Status</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400 w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow
                    key={store.store_id}
                    className="border-gray-700 hover:bg-gray-800/50"
                  >
                    <TableCell className="font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <StoreIcon className="h-4 w-4 text-blue-500" />
                        {store.store_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {store.chain_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {getLocationString(store)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {store.map_published_at ? (
                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Published
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-500/20 text-slate-400 hover:bg-slate-500/30">
                          Not Published
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {store.is_active ? (
                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {formatDate(store.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-slate-100 hover:bg-gray-800"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-gray-900 border-gray-700 text-slate-100"
                        >
                          <DropdownMenuItem
                            onClick={() => openEditDialog(store)}
                            className="hover:bg-gray-800 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {store.is_active ? (
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(store)}
                              className="text-red-400 hover:text-red-300 hover:bg-gray-800 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleRestore(store)}
                              className="text-green-400 hover:text-green-300 hover:bg-gray-800 cursor-pointer"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Store</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new store under an existing chain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Chain *</Label>
              <Select
                value={formData.chain_id}
                onValueChange={(value) => setFormData({ ...formData, chain_id: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-slate-100">
                  <SelectValue placeholder="Select a chain" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-slate-100">
                  {chains.map((chain) => (
                    <SelectItem key={chain.chain_id} value={chain.chain_id.toString()}>
                      {chain.chain_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Store Name *</Label>
              <Input
                placeholder="e.g., Downtown Branch, Mall Location"
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Address</Label>
              <Input
                placeholder="123 Main Street"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">City</Label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">State</Label>
                <Input
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">ZIP Code</Label>
                <Input
                  placeholder="12345"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Phone</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={submitting}
              className="border-gray-600 text-slate-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Store'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Store</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update the store information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Chain</Label>
              <Select
                value={formData.chain_id}
                onValueChange={(value) => setFormData({ ...formData, chain_id: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-slate-100">
                  <SelectValue placeholder="Select a chain" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-slate-100">
                  {chains.map((chain) => (
                    <SelectItem key={chain.chain_id} value={chain.chain_id.toString()}>
                      {chain.chain_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Store Name *</Label>
              <Input
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                className="bg-gray-800 border-gray-600 text-slate-100"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-gray-800 border-gray-600 text-slate-100"
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">ZIP Code</Label>
                <Input
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-slate-100"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={submitting}
              className="border-gray-600 text-slate-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={submitting}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Deactivate Store</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to deactivate <strong className="text-slate-200">{selectedStore?.store_name}</strong>?
              You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={submitting}
              className="border-gray-600 text-slate-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={submitting}
              variant="destructive"
              className="bg-red-500 hover:bg-red-600"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deactivating...
                </>
              ) : (
                'Deactivate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreManagement;

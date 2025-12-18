import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getChains,
  createChain,
  updateChain,
  deleteChain,
  restoreChain,
  type Chain,
} from '@/api/superadmin';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Building2,
  RotateCcw,
  Store,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

const ChainManagement = () => {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [formData, setFormData] = useState({ chain_name: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchChains = async () => {
    setLoading(true);
    try {
      const data = await getChains({
        search: searchQuery,
        includeInactive: showInactive,
      });
      setChains(data.chains);
    } catch (error) {
      console.error('Error fetching chains:', error);
      toast.error('Failed to load chains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChains();
  }, [searchQuery, showInactive]);

  const handleCreate = async () => {
    if (!formData.chain_name.trim()) {
      toast.error('Chain name is required');
      return;
    }

    setSubmitting(true);
    try {
      await createChain({ chain_name: formData.chain_name });
      toast.success('Chain created successfully');
      setShowCreateDialog(false);
      setFormData({ chain_name: '' });
      fetchChains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create chain');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedChain || !formData.chain_name.trim()) {
      toast.error('Chain name is required');
      return;
    }

    setSubmitting(true);
    try {
      await updateChain(selectedChain.chain_id, { chain_name: formData.chain_name });
      toast.success('Chain updated successfully');
      setShowEditDialog(false);
      setSelectedChain(null);
      setFormData({ chain_name: '' });
      fetchChains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update chain');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedChain) return;

    setSubmitting(true);
    try {
      await deleteChain(selectedChain.chain_id);
      toast.success('Chain deactivated successfully');
      setShowDeleteDialog(false);
      setSelectedChain(null);
      fetchChains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to deactivate chain');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (chain: Chain) => {
    try {
      await restoreChain(chain.chain_id);
      toast.success('Chain restored successfully');
      fetchChains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to restore chain');
    }
  };

  const openEditDialog = (chain: Chain) => {
    setSelectedChain(chain);
    setFormData({ chain_name: chain.chain_name });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (chain: Chain) => {
    setSelectedChain(chain);
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Chain Management</h2>
          <p className="text-slate-400 text-sm">Manage all chains across the platform</p>
        </div>
        <Button
          onClick={() => {
            setFormData({ chain_name: '' });
            setShowCreateDialog(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Chain
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search chains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                className="border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
              />
              <Label htmlFor="show-inactive" className="text-slate-400 text-sm cursor-pointer">
                Show inactive chains
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chains Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : chains.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No chains found</p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                variant="outline"
                className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Add your first chain
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">Chain Name</TableHead>
                  <TableHead className="text-slate-400">Stores</TableHead>
                  <TableHead className="text-slate-400">Products</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400 w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chains.map((chain) => (
                  <TableRow
                    key={chain.chain_id}
                    className="border-slate-700 hover:bg-slate-700/50"
                  >
                    <TableCell className="font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-amber-500" />
                        {chain.chain_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      <div className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {chain.store_count || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {chain.product_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      {chain.is_active ? (
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
                      {formatDate(chain.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-slate-100 hover:bg-slate-700"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-slate-800 border-slate-700 text-slate-100"
                        >
                          <DropdownMenuItem
                            onClick={() => openEditDialog(chain)}
                            className="hover:bg-slate-700 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {chain.is_active ? (
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(chain)}
                              className="text-red-400 hover:text-red-300 hover:bg-slate-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleRestore(chain)}
                              className="text-green-400 hover:text-green-300 hover:bg-slate-700 cursor-pointer"
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
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Add New Chain</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new chain to start adding stores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chain-name" className="text-slate-300">Chain Name</Label>
              <Input
                id="chain-name"
                placeholder="e.g., Walmart, Target, Kroger"
                value={formData.chain_name}
                onChange={(e) => setFormData({ chain_name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={submitting}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Chain'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit Chain</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update the chain information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-chain-name" className="text-slate-300">Chain Name</Label>
              <Input
                id="edit-chain-name"
                value={formData.chain_name}
                onChange={(e) => setFormData({ chain_name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-slate-100"
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={submitting}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
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
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Deactivate Chain</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to deactivate <strong className="text-slate-200">{selectedChain?.chain_name}</strong>?
              This will also deactivate all stores under this chain. You can restore them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={submitting}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
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

export default ChainManagement;

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
  getAdminUsers,
  getChains,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  type AdminUser,
  type Chain,
} from '@/api/superadmin';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Users,
  Shield,
  Building2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminFormData {
  firebase_uid: string;
  email: string;
  display_name: string;
  is_super_admin: boolean;
  chain_id: string;
}

const emptyFormData: AdminFormData = {
  firebase_uid: '',
  email: '',
  display_name: '',
  is_super_admin: false,
  chain_id: '',
};

const AdminManagement = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState<AdminFormData>(emptyFormData);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsData, chainsData] = await Promise.all([
        getAdminUsers(),
        getChains({ includeInactive: false }),
      ]);
      setAdmins(adminsData.admins);
      setChains(chainsData.chains);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formData.firebase_uid.trim()) {
      toast.error('Firebase UID is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!formData.is_super_admin && !formData.chain_id) {
      toast.error('Please select a chain for non-super-admin users');
      return;
    }

    setSubmitting(true);
    try {
      await createAdminUser({
        firebase_uid: formData.firebase_uid,
        email: formData.email,
        display_name: formData.display_name || undefined,
        is_super_admin: formData.is_super_admin,
        chain_id: formData.is_super_admin ? undefined : parseInt(formData.chain_id),
      });
      toast.success('Admin user created successfully');
      setShowCreateDialog(false);
      setFormData(emptyFormData);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create admin user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedAdmin) return;

    if (!formData.is_super_admin && !formData.chain_id) {
      toast.error('Please select a chain for non-super-admin users');
      return;
    }

    setSubmitting(true);
    try {
      await updateAdminUser(selectedAdmin.user_id, {
        display_name: formData.display_name || undefined,
        is_super_admin: formData.is_super_admin,
        chain_id: formData.is_super_admin ? null : (formData.chain_id ? parseInt(formData.chain_id) : null),
      });
      toast.success('Admin user updated successfully');
      setShowEditDialog(false);
      setSelectedAdmin(null);
      setFormData(emptyFormData);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update admin user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAdmin) return;

    setSubmitting(true);
    try {
      await deleteAdminUser(selectedAdmin.user_id);
      toast.success('Admin user deleted successfully');
      setShowDeleteDialog(false);
      setSelectedAdmin(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete admin user');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setFormData({
      firebase_uid: admin.firebase_uid,
      email: admin.email,
      display_name: admin.display_name || '',
      is_super_admin: admin.is_super_admin,
      chain_id: admin.chain_id?.toString() || '',
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Admin Management</h2>
          <p className="text-slate-400 text-sm">Manage admin users and their permissions</p>
        </div>
        <Button
          onClick={() => {
            setFormData(emptyFormData);
            setShowCreateDialog(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Admin
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-amber-500/10 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm text-amber-200 font-medium">How to add an admin user</p>
              <p className="text-xs text-amber-200/70 mt-1">
                1. Have the user create an account at /login using email or Google sign-in.<br />
                2. Get their Firebase UID from the Firebase Console (Authentication &gt; Users).<br />
                3. Add them here with their Firebase UID and email.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admins Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No admin users found</p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                variant="outline"
                className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Add your first admin
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-400">Chain</TableHead>
                  <TableHead className="text-slate-400">Last Login</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400 w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow
                    key={admin.user_id}
                    className="border-slate-700 hover:bg-slate-700/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-amber-500">
                            {(admin.display_name || admin.email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">
                            {admin.display_name || admin.email.split('@')[0]}
                          </p>
                          <p className="text-xs text-slate-500">{admin.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.is_super_admin ? (
                        <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
                          <Shield className="h-3 w-3 mr-1" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                          Chain Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {admin.is_super_admin ? (
                        <span className="text-slate-500">All chains</span>
                      ) : admin.chain_name ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {admin.chain_name}
                        </div>
                      ) : (
                        <span className="text-slate-500">No chain</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {formatDate(admin.last_login)}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {formatDate(admin.created_at)}
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
                            onClick={() => openEditDialog(admin)}
                            className="hover:bg-slate-700 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(admin)}
                            className="text-red-400 hover:text-red-300 hover:bg-slate-700 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
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
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new admin user to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Firebase UID *</Label>
              <Input
                placeholder="e.g., abc123xyz789..."
                value={formData.firebase_uid}
                onChange={(e) => setFormData({ ...formData, firebase_uid: e.target.value })}
                className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500 font-mono text-sm"
                disabled={submitting}
              />
              <p className="text-xs text-slate-500">
                Get this from Firebase Console &gt; Authentication &gt; Users
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email *</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Display Name</Label>
              <Input
                placeholder="John Doe"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-super-admin"
                checked={formData.is_super_admin}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_super_admin: checked as boolean, chain_id: '' })
                }
                className="border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                disabled={submitting}
              />
              <Label htmlFor="is-super-admin" className="text-slate-300 cursor-pointer">
                Super Admin (access to all chains)
              </Label>
            </div>
            {!formData.is_super_admin && (
              <div className="space-y-2">
                <Label className="text-slate-300">Assign to Chain *</Label>
                <Select
                  value={formData.chain_id}
                  onValueChange={(value) => setFormData({ ...formData, chain_id: value })}
                  disabled={submitting}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100">
                    <SelectValue placeholder="Select a chain" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    {chains.map((chain) => (
                      <SelectItem key={chain.chain_id} value={chain.chain_id.toString()}>
                        {chain.chain_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                'Create Admin'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update the admin user's permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input
                value={formData.email}
                className="bg-slate-700 border-slate-600 text-slate-400"
                disabled
              />
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Display Name</Label>
              <Input
                placeholder="John Doe"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-is-super-admin"
                checked={formData.is_super_admin}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_super_admin: checked as boolean, chain_id: '' })
                }
                className="border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                disabled={submitting}
              />
              <Label htmlFor="edit-is-super-admin" className="text-slate-300 cursor-pointer">
                Super Admin (access to all chains)
              </Label>
            </div>
            {!formData.is_super_admin && (
              <div className="space-y-2">
                <Label className="text-slate-300">Assign to Chain *</Label>
                <Select
                  value={formData.chain_id}
                  onValueChange={(value) => setFormData({ ...formData, chain_id: value })}
                  disabled={submitting}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100">
                    <SelectValue placeholder="Select a chain" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    {chains.map((chain) => (
                      <SelectItem key={chain.chain_id} value={chain.chain_id.toString()}>
                        {chain.chain_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <DialogTitle>Delete Admin</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <strong className="text-slate-200">{selectedAdmin?.display_name || selectedAdmin?.email}</strong>?
              This action cannot be undone.
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
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManagement;

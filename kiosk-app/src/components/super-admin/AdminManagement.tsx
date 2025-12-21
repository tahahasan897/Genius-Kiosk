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
  updateAdminUser,
  deleteAdminUser,
  getAdminInvites,
  createAdminInvite,
  deleteAdminInvite,
  type AdminUser,
  type AdminInvite,
  type Chain,
} from '@/api/superadmin';
import { sendAdminInviteLink } from '@/lib/firebase';
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
  Mail,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface InviteFormData {
  email: string;
  is_super_admin: boolean;
  chain_ids: number[];
}

interface EditFormData {
  display_name: string;
  is_super_admin: boolean;
  chain_ids: number[];
}

const emptyInviteFormData: InviteFormData = {
  email: '',
  is_super_admin: false,
  chain_ids: [],
};

const AdminManagement = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelInviteDialog, setShowCancelInviteDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<AdminInvite | null>(null);
  const [inviteFormData, setInviteFormData] = useState<InviteFormData>(emptyInviteFormData);
  const [editFormData, setEditFormData] = useState<EditFormData>({ display_name: '', is_super_admin: false, chain_ids: [] });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsData, invitesData, chainsData] = await Promise.all([
        getAdminUsers(),
        getAdminInvites('pending'),
        getChains({ includeInactive: false }),
      ]);
      setAdmins(adminsData.admins);
      setInvites(invitesData.invites);
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

  const handleInvite = async () => {
    if (!inviteFormData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!inviteFormData.is_super_admin && inviteFormData.chain_ids.length === 0) {
      toast.error('Please select at least one chain for non-super-admin users');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create invite in database
      await createAdminInvite({
        email: inviteFormData.email,
        is_super_admin: inviteFormData.is_super_admin,
        chain_ids: inviteFormData.is_super_admin ? undefined : inviteFormData.chain_ids,
      });

      // Step 2: Send magic link via Firebase
      await sendAdminInviteLink(inviteFormData.email);

      toast.success('Magic link sent! They can click the link in their email to activate admin access.');
      setShowInviteDialog(false);
      setInviteFormData(emptyInviteFormData);
      fetchData();
    } catch (error: any) {
      // Check if it's a Firebase error about email link not enabled
      if (error?.code === 'auth/operation-not-allowed') {
        toast.error('Email link sign-in is not enabled in Firebase. Please enable it in the Firebase Console under Authentication > Sign-in method > Email/Password > Email link.');
      } else {
        toast.error(error.response?.data?.error || error.message || 'Failed to send invitation');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedAdmin) return;

    if (!editFormData.is_super_admin && editFormData.chain_ids.length === 0) {
      toast.error('Please select at least one chain for non-super-admin users');
      return;
    }

    setSubmitting(true);
    try {
      await updateAdminUser(selectedAdmin.user_id, {
        display_name: editFormData.display_name || undefined,
        is_super_admin: editFormData.is_super_admin,
        chain_ids: editFormData.is_super_admin ? [] : editFormData.chain_ids,
      });
      toast.success('Admin user updated successfully');
      setShowEditDialog(false);
      setSelectedAdmin(null);
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

  const handleCancelInvite = async () => {
    if (!selectedInvite) return;

    setSubmitting(true);
    try {
      await deleteAdminInvite(selectedInvite.invite_id);
      toast.success('Invite cancelled');
      setShowCancelInviteDialog(false);
      setSelectedInvite(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel invite');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setEditFormData({
      display_name: admin.display_name || '',
      is_super_admin: admin.is_super_admin,
      chain_ids: admin.chain_ids || (admin.chain_id ? [admin.chain_id] : []),
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setShowDeleteDialog(true);
  };

  const openCancelInviteDialog = (invite: AdminInvite) => {
    setSelectedInvite(invite);
    setShowCancelInviteDialog(true);
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
          <p className="text-slate-400 text-sm">Manage admin users and invite new admins</p>
        </div>
        <Button
          onClick={() => {
            setInviteFormData(emptyInviteFormData);
            setShowInviteDialog(true);
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Admin
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-blue-200 font-medium">How the invite system works</p>
              <p className="text-xs text-blue-200/70 mt-1">
                1. Enter the email address of the person you want to invite.<br />
                2. Choose their role (Super Admin or Chain Admin).<br />
                3. They'll receive a magic link email - one click activates their admin access.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-blue-500" />
              <h3 className="font-medium text-slate-200">Pending Invites ({invites.length})</h3>
            </div>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.invite_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{invite.email}</p>
                      <p className="text-xs text-slate-500">
                        {invite.is_super_admin ? 'Super Admin' : `Chain Admin - ${invite.chain_name || 'No chain'}`}
                        {' • '}Invited {formatDate(invite.created_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCancelInviteDialog(invite)}
                    className="text-slate-400 hover:text-red-400 hover:bg-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admins Table */}
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No admin users yet</p>
              <Button
                onClick={() => setShowInviteDialog(true)}
                variant="outline"
                className="mt-4 border-gray-600 text-slate-300 hover:bg-gray-800"
              >
                Invite your first admin
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-transparent">
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
                    className="border-gray-700 hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-500">
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
                        <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                          <Shield className="h-3 w-3 mr-1" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                          Chain Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {admin.is_super_admin ? (
                        <span className="text-slate-500">All chains</span>
                      ) : admin.chain_names && admin.chain_names.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <Building2 className="h-3 w-3 flex-shrink-0" />
                          <span className="text-sm">
                            {admin.chain_names.length === 1
                              ? admin.chain_names[0]
                              : `${admin.chain_names.length} chains`}
                          </span>
                          {admin.chain_names.length > 1 && (
                            <span className="text-xs text-slate-500 block w-full ml-4">
                              {admin.chain_names.join(', ')}
                            </span>
                          )}
                        </div>
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
                            onClick={() => openEditDialog(admin)}
                            className="hover:bg-gray-800 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(admin)}
                            className="text-red-400 hover:text-red-300 hover:bg-gray-800 cursor-pointer"
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

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New Admin</DialogTitle>
            <DialogDescription className="text-slate-400">
              Send a magic link to grant admin access. They can click the link to activate their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Email Address *</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={inviteFormData.email}
                onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-super-admin"
                checked={inviteFormData.is_super_admin}
                onCheckedChange={(checked) =>
                  setInviteFormData({ ...inviteFormData, is_super_admin: checked as boolean, chain_ids: [] })
                }
                className="border-gray-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                disabled={submitting}
              />
              <Label htmlFor="is-super-admin" className="text-slate-300 cursor-pointer">
                Super Admin (access to all chains)
              </Label>
            </div>
            {!inviteFormData.is_super_admin && (
              <div className="space-y-2">
                <Label className="text-slate-300">Assign to Chain(s) *</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-gray-800 rounded-lg border border-gray-600">
                  {chains.length === 0 ? (
                    <p className="text-sm text-slate-500">No chains available</p>
                  ) : (
                    chains.map((chain) => (
                      <div key={chain.chain_id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`invite-chain-${chain.chain_id}`}
                          checked={inviteFormData.chain_ids.includes(chain.chain_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setInviteFormData({
                                ...inviteFormData,
                                chain_ids: [...inviteFormData.chain_ids, chain.chain_id],
                              });
                            } else {
                              setInviteFormData({
                                ...inviteFormData,
                                chain_ids: inviteFormData.chain_ids.filter((id) => id !== chain.chain_id),
                              });
                            }
                          }}
                          className="border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          disabled={submitting}
                        />
                        <Label
                          htmlFor={`invite-chain-${chain.chain_id}`}
                          className="text-slate-300 cursor-pointer text-sm"
                        >
                          {chain.chain_name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {inviteFormData.chain_ids.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {inviteFormData.chain_ids.length} chain{inviteFormData.chain_ids.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              disabled={submitting}
              className="border-gray-600 text-slate-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={submitting}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invite'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-slate-100 max-w-md">
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
                value={selectedAdmin?.email || ''}
                className="bg-gray-800 border-gray-600 text-slate-400"
                disabled
              />
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Display Name</Label>
              <Input
                placeholder="John Doe"
                value={editFormData.display_name}
                onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                className="bg-gray-800 border-gray-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-is-super-admin"
                checked={editFormData.is_super_admin}
                onCheckedChange={(checked) =>
                  setEditFormData({ ...editFormData, is_super_admin: checked as boolean, chain_ids: [] })
                }
                className="border-gray-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                disabled={submitting}
              />
              <Label htmlFor="edit-is-super-admin" className="text-slate-300 cursor-pointer">
                Super Admin (access to all chains)
              </Label>
            </div>
            {!editFormData.is_super_admin && (
              <div className="space-y-2">
                <Label className="text-slate-300">Assign to Chain(s) *</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-gray-800 rounded-lg border border-gray-600">
                  {chains.length === 0 ? (
                    <p className="text-sm text-slate-500">No chains available</p>
                  ) : (
                    chains.map((chain) => (
                      <div key={chain.chain_id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-chain-${chain.chain_id}`}
                          checked={editFormData.chain_ids.includes(chain.chain_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditFormData({
                                ...editFormData,
                                chain_ids: [...editFormData.chain_ids, chain.chain_id],
                              });
                            } else {
                              setEditFormData({
                                ...editFormData,
                                chain_ids: editFormData.chain_ids.filter((id) => id !== chain.chain_id),
                              });
                            }
                          }}
                          className="border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          disabled={submitting}
                        />
                        <Label
                          htmlFor={`edit-chain-${chain.chain_id}`}
                          className="text-slate-300 cursor-pointer text-sm"
                        >
                          {chain.chain_name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {editFormData.chain_ids.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {editFormData.chain_ids.length} chain{editFormData.chain_ids.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
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
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Invite Confirmation Dialog */}
      <Dialog open={showCancelInviteDialog} onOpenChange={setShowCancelInviteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Cancel Invite</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to cancel the invite for <strong className="text-slate-200">{selectedInvite?.email}</strong>?
              They will no longer be able to become an admin using this invite.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelInviteDialog(false)}
              disabled={submitting}
              className="border-gray-600 text-slate-300 hover:bg-gray-800"
            >
              Keep Invite
            </Button>
            <Button
              onClick={handleCancelInvite}
              disabled={submitting}
              variant="destructive"
              className="bg-red-500 hover:bg-red-600"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Invite'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManagement;

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Building2, Plus, MapPin, Pencil, Trash2 } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  location: string | null;
}

export function BranchManager() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdminOrManager } = useUserRole();

  const [formData, setFormData] = useState({
    name: '',
    location: '',
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .order('name');
    if (data) setBranches(data);
  };

  const openAddDialog = () => {
    setEditingBranch(null);
    setFormData({ name: '', location: '' });
    setOpen(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location || '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingBranch) {
      // Update existing branch
      const { error } = await supabase
        .from('branches')
        .update({
          name: formData.name,
          location: formData.location || null,
        })
        .eq('id', editingBranch.id);

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Branch updated successfully',
        });
        setOpen(false);
        setEditingBranch(null);
        setFormData({ name: '', location: '' });
        fetchBranches();
      }
    } else {
      // Add new branch
      const { error } = await supabase.from('branches').insert({
        name: formData.name,
        location: formData.location || null,
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Branch added successfully',
        });
        setOpen(false);
        setFormData({ name: '', location: '' });
        fetchBranches();
      }
    }

    setLoading(false);
  };

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`Are you sure you want to delete "${branch.name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', branch.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Branch deleted successfully',
      });
      fetchBranches();
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Branches & Locations
            </CardTitle>
            <CardDescription>Manage your fleet locations</CardDescription>
          </div>
          {isAdminOrManager && (
            <Button size="sm" className="gap-2" onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add Branch
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {branches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No branches added yet
          </p>
        ) : (
          <div className="space-y-2">
            {branches.map((branch) => (
              <div key={branch.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold">{branch.name}</p>
                    {branch.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {branch.location}
                      </p>
                    )}
                  </div>
                </div>
                {isAdminOrManager && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(branch)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(branch)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch ? 'Update the branch details below.' : 'Enter the details for the new branch location.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Branch Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Hamilton"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., 123 Main St, Hamilton, ON"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingBranch ? 'Update' : 'Add Branch'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
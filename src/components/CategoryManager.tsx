import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Tag, Plus, Wrench, Hammer, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: string;
}

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdminOrManager } = useUserRole();

  const [formData, setFormData] = useState({
    name: '',
    type: 'maintenance',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('expense_categories')
      .select('*')
      .order('type')
      .order('name');
    if (data) setCategories(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('expense_categories').insert({
      name: formData.name,
      type: formData.type,
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
        description: 'Category added successfully',
      });
      setOpen(false);
      setFormData({ name: '', type: 'maintenance' });
      fetchCategories();
    }

    setLoading(false);
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', category.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });
      fetchCategories();
    }
  };

  const maintenanceCategories = categories.filter(c => c.type === 'maintenance');
  const repairCategories = categories.filter(c => c.type === 'repair');

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Expense Categories
            </CardTitle>
            <CardDescription>Manage maintenance and repair categories</CardDescription>
          </div>
          {isAdminOrManager && (
            <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-secondary" />
              Maintenance
            </h4>
            <div className="flex flex-wrap gap-2">
              {maintenanceCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No maintenance categories</p>
              ) : (
                maintenanceCategories.map((category) => (
                  <Badge 
                    key={category.id} 
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {category.name}
                    {isAdminOrManager && (
                      <button
                        onClick={() => handleDelete(category)}
                        className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Hammer className="h-4 w-4 text-accent" />
              Repairs
            </h4>
            <div className="flex flex-wrap gap-2">
              {repairCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No repair categories</p>
              ) : (
                repairCategories.map((category) => (
                  <Badge 
                    key={category.id} 
                    variant="outline"
                    className="gap-1 pr-1"
                  >
                    {category.name}
                    {isAdminOrManager && (
                      <button
                        onClick={() => handleDelete(category)}
                        className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new expense category for maintenance or repairs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Oil Change"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Category Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Category'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
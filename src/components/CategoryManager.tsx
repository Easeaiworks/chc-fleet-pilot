import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Tag, Plus, Wrench, Hammer } from 'lucide-react';

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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Category
                </Button>
              </DialogTrigger>
...
            </Dialog>
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
              {categories.filter(c => c.type === 'maintenance').map((category) => (
                <Badge key={category.id} variant="secondary">
                  {category.name}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Hammer className="h-4 w-4 text-accent" />
              Repairs
            </h4>
            <div className="flex flex-wrap gap-2">
              {categories.filter(c => c.type === 'repair').map((category) => (
                <Badge key={category.id} variant="outline">
                  {category.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

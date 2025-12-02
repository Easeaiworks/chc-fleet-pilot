import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always start with loading true when user changes
    setLoading(true);
    
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;
        
        const rolesList = data?.map(r => r.role) || [];
        setRoles(rolesList);
      } catch (error) {
        console.error('Error fetching roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  const isAdmin = roles.includes('admin');
  const isManager = roles.includes('manager');
  const isStaff = roles.includes('staff');
  const isAdminOrManager = isAdmin || isManager;

  return {
    roles,
    loading,
    isAdmin,
    isManager,
    isStaff,
    isAdminOrManager,
  };
}

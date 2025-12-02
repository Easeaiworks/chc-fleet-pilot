import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    // Set loading true when starting to fetch roles
    setLoading(true);

    const fetchRoles = async () => {
      try {
        console.log('useUserRole: Fetching roles for user:', user.id);
        console.log('useUserRole: User email:', user.email);
        
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        console.log('useUserRole: Roles response data:', data);
        console.log('useUserRole: Roles response error:', error);
        
        if (error) {
          console.error('useUserRole: Error details:', JSON.stringify(error));
          throw error;
        }
        
        const rolesList = data?.map(r => r.role) || [];
        console.log('useUserRole: Final roles list:', rolesList);
        setRoles(rolesList);
      } catch (error) {
        console.error('useUserRole: Caught error:', error);
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

import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, BarChart3, Shield, CheckSquare } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAdminOrManager } = useUserRole();

  return (
    <nav className="flex gap-2">
      <Button
        variant={location.pathname === '/' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/')}
        className="gap-2"
      >
        <Home className="h-4 w-4" />
        Dashboard
      </Button>
      <Button
        variant={location.pathname === '/reports' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/reports')}
        className="gap-2"
      >
        <BarChart3 className="h-4 w-4" />
        Reports
      </Button>
      {isAdminOrManager && (
        <Button
          variant={location.pathname === '/approvals' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigate('/approvals')}
          className="gap-2"
        >
          <CheckSquare className="h-4 w-4" />
          Approvals
        </Button>
      )}
      {isAdmin && (
        <Button
          variant={location.pathname === '/roles' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigate('/roles')}
          className="gap-2"
        >
          <Shield className="h-4 w-4" />
          User Roles
        </Button>
      )}
    </nav>
  );
}

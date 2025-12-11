import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, BarChart3, Shield, CheckSquare, Settings, CircleDot } from 'lucide-react';
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
      <Button
        variant={location.pathname === '/tires' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/tires')}
        className="gap-2"
      >
        <CircleDot className="h-4 w-4" />
        Tires
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
      {isAdminOrManager && (
        <Button
          variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigate('/admin')}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Admin
        </Button>
      )}
    </nav>
  );
}

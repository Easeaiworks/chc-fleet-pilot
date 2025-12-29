import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, BarChart3, CheckSquare, Settings, CircleDot, ClipboardCheck, Receipt } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAdminOrManager } = useUserRole();

  return (
    <nav className="flex gap-2 flex-wrap">
      <Button
        variant={location.pathname === '/' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/')}
        className="gap-2"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </Button>
      <Button
        variant={location.pathname === '/expenses' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/expenses')}
        className="gap-2"
      >
        <Receipt className="h-4 w-4" />
        <span className="hidden sm:inline">Expenses</span>
      </Button>
      <Button
        variant={location.pathname === '/inspections' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/inspections')}
        className="gap-2"
      >
        <ClipboardCheck className="h-4 w-4" />
        <span className="hidden sm:inline">Inspections</span>
      </Button>
      <Button
        variant={location.pathname === '/tires' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/tires')}
        className="gap-2"
      >
        <CircleDot className="h-4 w-4" />
        <span className="hidden sm:inline">Tires</span>
      </Button>
      <Button
        variant={location.pathname === '/reports' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/reports')}
        className="gap-2"
      >
        <BarChart3 className="h-4 w-4" />
        <span className="hidden sm:inline">Reports</span>
      </Button>
      {isAdminOrManager && (
        <Button
          variant={location.pathname === '/approvals' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigate('/approvals')}
          className="gap-2"
        >
          <CheckSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Approvals</span>
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
          <span className="hidden sm:inline">Admin</span>
        </Button>
      )}
    </nav>
  );
}

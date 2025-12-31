import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, BarChart3, CheckSquare, Settings, CircleDot, ClipboardCheck, Receipt } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { FuelReceiptDialog } from './FuelReceiptDialog';

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAdminOrManager } = useUserRole();

  return (
    <nav className="flex items-center gap-1 flex-wrap">
      <Button
        variant={location.pathname === '/' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/')}
        className="gap-2 px-3"
      >
        <Home className="h-4 w-4" />
        Dashboard
      </Button>
      <Button
        variant={location.pathname === '/inspections' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/inspections')}
        className="gap-2 px-3"
      >
        <ClipboardCheck className="h-4 w-4" />
        Inspections
      </Button>
      <Button
        variant={location.pathname === '/tires' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/tires')}
        className="gap-2 px-3"
      >
        <CircleDot className="h-4 w-4" />
        Tires
      </Button>
      <Button
        variant={location.pathname === '/reports' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/reports')}
        className="gap-2 px-3"
      >
        <BarChart3 className="h-4 w-4" />
        Reports
      </Button>
      <Button
        variant={location.pathname === '/expenses' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => navigate('/expenses')}
        className="gap-2 px-3"
      >
        <Receipt className="h-4 w-4" />
        Expenses
      </Button>
      
      {/* Fuel Receipt Quick Action */}
      <FuelReceiptDialog />
      
      {isAdminOrManager && (
        <Button
          variant={location.pathname === '/approvals' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigate('/approvals')}
          className="gap-2 px-3"
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
          className="gap-2 px-3"
        >
          <Settings className="h-4 w-4" />
          Admin
        </Button>
      )}
    </nav>
  );
}

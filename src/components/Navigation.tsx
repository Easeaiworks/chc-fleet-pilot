import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, BarChart3 } from 'lucide-react';

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

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
    </nav>
  );
}

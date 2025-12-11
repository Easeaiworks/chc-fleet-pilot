import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigation } from './Navigation';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully',
      });
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <h1 className="text-xl font-bold text-primary">CHC Fleet Manager</h1>
              <p className="text-xs text-muted-foreground">Vehicle Management System</p>
            </div>
            <Navigation />
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">Fleet Manager</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 flex-1">
        {children}
      </main>
      <footer className="border-t bg-card py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">Powered by Refinish AI</p>
        </div>
      </footer>
    </div>
  );
}

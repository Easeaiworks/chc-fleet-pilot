import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { DashboardStats } from '@/components/DashboardStats';
import { BranchManager } from '@/components/BranchManager';
import { RecentExpensesFeed } from '@/components/RecentExpensesFeed';
import { BulkImportDialog } from '@/components/BulkImportDialog';
import { GPSUploadSection } from '@/components/GPSUploadSection';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your fleet performance</p>
        </div>
        
        <DashboardStats />

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Management Tools</h2>
          <BulkImportDialog />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BranchManager />
          </div>
          <RecentExpensesFeed />
        </div>

        <GPSUploadSection />
      </div>
    </Layout>
  );
};

export default Index;

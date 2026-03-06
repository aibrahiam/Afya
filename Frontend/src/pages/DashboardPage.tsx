// Dashboard Page Component

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaseList } from '../components/CaseList';
import { ImageViewer } from '../components/ImageViewer';
import { AIReportPanel } from '../components/AIReportPanel';
import { ReportTemplates } from '../components/ReportTemplates';
import { MyReports } from '../components/MyReports';
import { useCasesStore } from '../stores/useCasesStore';
import { useAuthStore } from '../stores/useAuthStore';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { 
  Activity, 
  LogOut, 
  Settings, 
  LayoutDashboard, 
  FileText,
  User,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

type ActiveView = 'workstation' | 'my-reports' | 'templates';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { 
    cases, 
    selectedCase, 
    selectedCaseAnalysis,
    fetchCases, 
    selectCase, 
    fetchStatistics,
    statistics,
    isLoading,
    error 
  } = useCasesStore();
  
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [activeView, setActiveView] = useState<ActiveView>('workstation');

  useEffect(() => {
    // Fetch initial data
    fetchCases();
    fetchStatistics();
  }, [fetchCases, fetchStatistics]);

  useEffect(() => {
    // Auto-select first case if none selected and in workstation view
    if (cases.length > 0 && !selectedCaseId && activeView === 'workstation') {
      setSelectedCaseId(cases[0].id);
      selectCase(cases[0].id);
    }
  }, [cases, selectedCaseId, selectCase, activeView]);

  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    selectCase(caseId);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { id: 'workstation' as const, label: 'Workstation', icon: LayoutDashboard },
    { id: 'my-reports' as const, label: 'My Reports', icon: ClipboardList },
    { id: 'templates' as const, label: 'Report Templates', icon: FileText },
  ];

  // Show error as toast popup instead of blocking the whole page
  useEffect(() => {
    if (error) {
      toast.error('Dashboard Error', {
        description: error,
        duration: 8000,
        action: {
          label: 'Retry',
          onClick: () => fetchCases(),
        },
      });
    }
  }, [error, fetchCases]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-3 lg:px-6 py-2 lg:py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-slate-900 font-bold">AfyaDX</h1>
              <p className="text-xs text-slate-500 hidden lg:block">AI-Assisted Diagnostic Platform</p>
            </div>
          </div>

          {/* Primary Nav */}
          <nav className="flex items-center gap-1 ml-2 lg:ml-4">
            {navItems.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={activeView === id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView(id)}
                className={activeView === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'}
              >
                <Icon className="w-4 h-4 lg:mr-2" />
                <span className="hidden lg:inline">{label}</span>
              </Button>
            ))}
          </nav>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="h-4 w-px bg-slate-300 hidden sm:block" />

          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-600 hover:text-slate-900"
            onClick={() => navigate('/settings')}
          >
            <Settings className="w-4 h-4 lg:mr-2" />
            <span className="hidden lg:inline">Settings</span>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 lg:mr-2" />
            <span className="hidden lg:inline">Sign Out</span>
          </Button>

          <div className="flex items-center gap-2 pl-2 lg:pl-3 border-l border-slate-300">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-blue-600 text-white text-sm">
                {user?.avatarInitials || user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="text-right hidden md:block">
              <p className="text-sm text-slate-900">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role?.toLowerCase() || 'User'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {activeView === 'workstation' ? (
        /* === Workstation Layout === */
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Column - Case List */}
          <div className="w-64 lg:w-72 xl:w-80 flex-shrink-0 h-full overflow-hidden">
            <CaseList
              selectedCaseId={selectedCaseId}
              onCaseSelect={handleCaseSelect}
            />
          </div>

          {/* Center & Right Columns - Image Viewer & AI Panel */}
          {selectedCase ? (
            <div className="flex-1 flex overflow-hidden h-full min-h-0">
              {/* Image Viewer */}
              <div className="flex-1 h-full overflow-hidden">
                <ImageViewer
                  caseId={selectedCase.id}
                  scanType={selectedCase.scanType}
                  imageUrl={selectedCase.images?.[0]?.storageUrl}
                  heatmapData={selectedCaseAnalysis?.heatmap ?? null}
                />
              </div>

              {/* AI Report Panel */}
              <div className="w-80 lg:w-96 xl:w-[420px] flex-shrink-0 h-full overflow-hidden">
                <AIReportPanel caseId={selectedCase.id} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center space-y-4">
                {isLoading ? (
                  <div>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-slate-600 mt-4">Loading cases...</p>
                  </div>
                ) : cases.length === 0 ? (
                  <div>
                    <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-900">No Cases Found</h2>
                    <p className="text-slate-600">There are no cases in the queue at this time.</p>
                  </div>
                ) : (
                  <div>
                    <LayoutDashboard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-900">Welcome, {user?.name || 'Doctor'}</h2>
                    <p className="text-slate-600">Select a case from the left panel to begin review.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : activeView === 'my-reports' ? (
        /* === My Reports === */
        <div className="flex-1 flex overflow-hidden">
          <MyReports
            onViewCase={(caseId) => {
              handleCaseSelect(caseId);
              setActiveView('workstation');
            }}
          />
        </div>
      ) : (
        /* === Report Templates === */
        <div className="flex-1 flex overflow-hidden">
          <ReportTemplates />
        </div>
      )}

      {/* Bottom Status Bar */}
      <footer className="sticky bottom-0 bg-slate-800 text-slate-300 px-3 lg:px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 lg:gap-6">
          <span>Status: <span className="text-green-400">Online</span></span>
          <span className="hidden sm:inline">AI: <span className="text-green-400">Active</span></span>
          <span className="hidden md:inline">Sync: {new Date().toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center gap-3 lg:gap-6">
          <span className="hidden lg:inline">User: {user?.name}</span>
          {statistics && (
            <>
              <span className="hidden md:inline">Today: {statistics.casesToday}</span>
              <span>Total: {statistics.totalCases}</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
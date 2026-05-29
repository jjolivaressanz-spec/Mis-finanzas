
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Training from './components/Training';
import AnnualAnalysis from './components/AnnualAnalysis';
import DictionaryManager from './components/DictionaryManager';
import Accounts from './components/Accounts';
import { ViewState, FilterState, Toast } from './types';
import { XCircle, CheckCircle, Info } from 'lucide-react';

const App: React.FC = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Global Filter State (Persisted during session)
  const [dashboardFilter, setDashboardFilter] = useState<FilterState>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  // Notifications State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast['type']) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            filter={dashboardFilter} 
            setFilter={setDashboardFilter}
            onError={(msg) => addToast(msg, 'error')}
          />
        );
      case 'accounts':
        return (
          <Accounts 
            onError={(msg) => addToast(msg, 'error')}
          />
        );
      case 'analysis':
        return (
          <AnnualAnalysis 
            onError={(msg) => addToast(msg, 'error')}
          />
        );
      case 'training':
        return (
          <Training 
            onNotify={addToast}
          />
        );
      case 'dictionary':
        return (
          <DictionaryManager 
            onNotify={(msg, type) => addToast(msg, type as Toast['type'])}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Layout currentView={currentView} onNavigate={setCurrentView}>
        {renderView()}
      </Layout>

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] animate-slide-in
              ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-blue-600'}
            `}
          >
            {toast.type === 'error' && <XCircle className="w-5 h-5" />}
            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {toast.type === 'info' && <Info className="w-5 h-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)} 
              className="ml-auto opacity-80 hover:opacity-100"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;

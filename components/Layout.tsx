
import { LayoutDashboard, BrainCircuit, CreditCard, Menu, X, Sun, Moon, Table2, BookOpen, Wallet, ChevronRight, Upload, LogOut } from 'lucide-react';
import React from 'react';
import { ViewState } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  id: ViewState;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface LayoutProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const { signOut } = useAuth();

  React.useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Configuración de las tarjetas de navegación
  const navItems: NavItem[] = [
    { 
      id: 'accounts', 
      label: 'Cuentas', 
      description: 'Liquidez y patrimonio',
      icon: Wallet, 
      color: 'emerald' 
    },
    { 
      id: 'dashboard', 
      label: 'Mensual', 
      description: 'KPIs y desglose del mes',
      icon: LayoutDashboard, 
      color: 'blue' 
    },
    { 
      id: 'analysis', 
      label: 'Anual', 
      description: 'Matriz de todo el año',
      icon: Table2, 
      color: 'indigo' 
    },
    { 
      id: 'dictionary', 
      label: 'Diccionario', 
      description: 'Gestión de reglas',
      icon: BookOpen, 
      color: 'amber' 
    },
    { 
      id: 'training', 
      label: 'Entrenamiento', 
      description: 'Enseñar al sistema',
      icon: BrainCircuit, 
      color: 'violet' 
    },
    { 
      id: 'import', 
      label: 'Importar', 
      description: 'Cargar Excel del banco',
      icon: Upload, 
      color: 'rose' 
    },
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    // Estado inactivo: transparente para fundirse con el menú, aparece al hacer hover
    if (!isActive) return 'border-transparent bg-transparent hover:bg-slate-50 hover:border-slate-200 dark:hover:bg-slate-800/40 dark:hover:border-slate-700';
    
    // Estado activo: colores vibrantes y bordes marcados
    const map: Record<string, string> = {
      emerald: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500 shadow-sm',
      blue: 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500 shadow-sm',
      indigo: 'border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500 shadow-sm',
      amber: 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500 shadow-sm',
      violet: 'border-violet-200 bg-violet-50 dark:bg-violet-900/20 ring-1 ring-violet-500 shadow-sm',
      rose: 'border-rose-200 bg-rose-50 dark:bg-rose-900/20 ring-1 ring-rose-500 shadow-sm',
    };
    return map[color] || map.blue;
  };

  const getIconColorClasses = (color: string, isActive: boolean) => {
    if (!isActive) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-white group-hover:text-slate-700 group-hover:shadow-sm transition-all';
    
    const map: Record<string, string> = {
      emerald: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20',
      blue: 'bg-blue-500 text-white shadow-md shadow-blue-500/20',
      indigo: 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20',
      amber: 'bg-amber-500 text-white shadow-md shadow-amber-500/20',
      violet: 'bg-violet-500 text-white shadow-md shadow-violet-500/20',
      rose: 'bg-rose-500 text-white shadow-md shadow-rose-500/20',
    };
    return map[color] || map.blue;
  };

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30 shadow-sm">
        <div className="p-6 flex items-center space-x-4 mb-2">
          <img src="/logo.png" alt="FinanzasPro Logo" className="w-20 h-20 object-contain rounded-3xl shadow-xl hover:scale-105 transition-transform duration-300" />
          <div>
            <span className="block text-xl font-black tracking-tight text-slate-800 dark:text-white leading-tight">FinanzasPro</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Personal Dashboard</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-3 overflow-y-auto py-2 custom-scrollbar">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`
                  w-full group flex items-start space-x-3 p-3 rounded-xl border transition-all duration-300 text-left relative overflow-hidden
                  ${getColorClasses(item.color, isActive)}
                `}
              >
                <div className={`p-2.5 rounded-lg transition-all duration-300 shrink-0 ${getIconColorClasses(item.color, isActive)}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                </div>
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold truncate ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white'}`}>
                      {item.label}
                    </span>
                    {isActive && <ChevronRight className="w-4 h-4 text-slate-400 opacity-70" />}
                  </div>
                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${isActive ? 'text-slate-600 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50">
          <button 
            onClick={toggleTheme}
            className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 w-full transition-all border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center space-x-3">
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-500" />}
              <span className="text-xs font-semibold">Modo {isDarkMode ? 'Claro' : 'Oscuro'}</span>
            </div>
            <div className={`w-9 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
               <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isDarkMode ? 'left-5' : 'left-1'}`} />
            </div>
          </button>
          
          <button 
            onClick={signOut}
            className="mt-2 flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl text-red-600 dark:text-red-400 w-full transition-all border border-red-100 dark:border-red-900/50 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-semibold">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Sidebar Overlay */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-40">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="FinanzasPro Logo" className="w-14 h-14 object-contain rounded-2xl shadow-lg" />
            <span className="font-extrabold text-slate-800 dark:text-white">FinanzasPro</span>
          </div>
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
            <div className="absolute top-0 left-0 w-80 h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-white">Menú Principal</span>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {navItems.map((item) => {
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center space-x-4 p-4 rounded-xl border transition-all
                        ${getColorClasses(item.color, isActive)}
                      `}
                    >
                      <div className={`p-2 rounded-lg ${getIconColorClasses(item.color, isActive)}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className={`block text-sm font-bold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{item.description}</span>
                      </div>
                    </button>
                  );
                })}
               </div>
               <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => {
                      signOut();
                      setSidebarOpen(false);
                    }}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 w-full transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-bold">Cerrar sesión</span>
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* Main Content Area - Responsive Width Logic */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-transparent relative scroll-smooth">
          {/* 
             Solo aplicamos 'max-w-[1920px]' (Wide Mode) si estamos en la vista 'analysis'.
             Para el resto (dashboard, accounts, etc), volvemos a 'max-w-7xl' para centrar el contenido.
          */}
          <div className={`mx-auto transition-all duration-300 ${currentView === 'analysis' ? 'w-full max-w-[1920px]' : 'max-w-7xl'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;


import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  onLoginClick?: () => void;
  onManualClick?: () => void;
  showLoginButton?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, onLoginClick, onManualClick, showLoginButton = true }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <header className="bg-agro-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
            <span className="font-serif text-2xl font-bold tracking-wide">
              BANDEIRA <span className="text-orange-500">AGRO</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             {showLoginButton && (
               <>
                 <button 
                  onClick={onManualClick} 
                  className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors border border-white/20"
                >
                   Manual
                 </button>
                 <button 
                  onClick={onLoginClick} 
                  className="bg-agro-700 hover:bg-agro-600 px-3 py-1.5 rounded text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors border border-agro-600 shadow-sm"
                >
                   Acesso Equipe
                 </button>
               </>
             )}
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-earth-800 text-agro-100 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} BANDEIRA AGRO - Inteligência em Avaliações.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

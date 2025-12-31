
import React, { useState, useEffect } from 'react';

const LoadingScreen: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = [
    "Sincronizando com Imovelweb e Zap Imóveis...",
    "Varrendo anúncios no VivaReal e OLX...",
    "Extraindo metadados e preços de mercado...",
    "Aplicando homogeneização (NBR 14653)...",
    "Alimentando Intelligence Pool Bandeira Agro...",
    "Finalizando cálculos estatísticos..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-32 animate-fade-in text-center">
      <div className="relative mb-10">
        <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-agro-500 border-opacity-30"></div>
        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
           <div className="bg-agro-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-agro-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
           </div>
        </div>
      </div>
      <h2 className="text-3xl font-serif font-bold text-agro-900 mb-3">Busca Integrada em Portais</h2>
      <div className="h-6 flex items-center justify-center">
        <p className="text-agro-600 font-medium transition-all duration-500 transform">{messages[messageIndex]}</p>
      </div>
      <div className="mt-12 w-64 bg-gray-200 h-1.5 rounded-full overflow-hidden">
        <div className="bg-agro-500 h-full animate-progress-bar rounded-full"></div>
      </div>
      
      <style>{`
        @keyframes progress-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress-bar {
          animation: progress-bar 18s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;

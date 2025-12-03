import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-agro-500 mb-6"></div>
      <h2 className="text-2xl font-serif font-bold text-gray-800">Processando Dados</h2>
      <p className="text-gray-500 mt-2">Consultando banco de dados interno...</p>
    </div>
  );
};

export default LoadingScreen;
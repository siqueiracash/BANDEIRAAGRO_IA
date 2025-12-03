import React from 'react';
import { PropertyType } from '../types';

interface StepSelectionProps {
  onSelect: (type: PropertyType) => void;
}

const StepSelection: React.FC<StepSelectionProps> = ({ onSelect }) => {
  return (
    <div className="w-full max-w-4xl flex flex-col items-center animate-fade-in-up">
      <h1 className="text-3xl md:text-4xl font-serif text-agro-900 font-bold mb-4 text-center">
        Avaliação de Imóvel
      </h1>
      <p className="text-gray-600 mb-12 text-center max-w-xl">
        Selecione a categoria do imóvel para iniciar o processo de avaliação conforme a norma NBR 14653. O sistema buscará amostras de mercado automaticamente.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Urban Option */}
        <button
          onClick={() => onSelect(PropertyType.URBAN)}
          className="group relative bg-white border-2 border-gray-100 hover:border-agro-500 rounded-xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-agro-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 p-4 bg-blue-100 rounded-full mb-6 text-blue-600 group-hover:bg-agro-500 group-hover:text-white transition-colors duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5h2m-1.636 4.5h1.636m-1.636 4.5h1.636m-3.75 3.75h3.75" />
            </svg>
          </div>
          <h3 className="relative z-10 text-2xl font-bold text-gray-800 group-hover:text-agro-700">Imóvel Urbano</h3>
          <p className="relative z-10 mt-2 text-gray-500 text-sm">Casas, Apartamentos, Terrenos Urbanos, Lojas Comerciais.</p>
        </button>

        {/* Rural Option */}
        <button
          onClick={() => onSelect(PropertyType.RURAL)}
          className="group relative bg-white border-2 border-gray-100 hover:border-agro-500 rounded-xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
        >
           <div className="absolute inset-0 bg-agro-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 p-4 bg-green-100 rounded-full mb-6 text-green-600 group-hover:bg-agro-500 group-hover:text-white transition-colors duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <h3 className="relative z-10 text-2xl font-bold text-gray-800 group-hover:text-agro-700">Imóvel Rural</h3>
          <p className="relative z-10 mt-2 text-gray-500 text-sm">Fazendas, Sítios, Chácaras, Terras para Plantio ou Pastagem.</p>
        </button>
      </div>
    </div>
  );
};

export default StepSelection;
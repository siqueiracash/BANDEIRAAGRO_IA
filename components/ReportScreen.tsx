
import React from 'react';
import { ValuationResult, PropertyData } from '../types';

interface ReportScreenProps {
  data: ValuationResult;
  property: PropertyData;
  onReset: () => void;
  onReview: () => void;
}

const ReportScreen: React.FC<ReportScreenProps> = ({ data, onReset, onReview }) => {
  return (
    <div className="w-full max-w-5xl animate-fade-in pb-10 print:pb-0 print:max-w-none">
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          header, footer, .no-print { display: none !important; }
          body { background: white !important; }
          #root, main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .report-page { page-break-after: always !important; break-after: page !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="bg-white shadow-2xl overflow-hidden rounded-3xl border border-gray-100 print:rounded-none print:border-none print:shadow-none">
        <div 
          className="report-content"
          dangerouslySetInnerHTML={{ __html: data.reportText }} 
        />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mt-12 no-print px-6 gap-6">
        <button 
          onClick={onReset} 
          className="w-full md:w-auto text-gray-500 border-2 border-gray-200 hover:border-gray-400 px-8 py-4 rounded-2xl font-bold transition-all"
        >
          Nova Avaliação
        </button>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <button 
            onClick={onReview} 
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-3"
          >
            Revisar Dados
          </button>

          <button 
            onClick={() => window.print()} 
            className="w-full md:w-auto bg-agro-900 hover:bg-black text-white px-10 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3"
          >
            Gerar PDF / Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportScreen;

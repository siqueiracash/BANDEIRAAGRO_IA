
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
          @page { 
            margin: 0; 
            size: A4 portrait; 
          }
          header, footer, .no-print { display: none !important; }
          body { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important; 
          }
          #root, main { 
            padding: 0 !important; 
            margin: 0 !important; 
            max-width: none !important; 
            width: 100% !important; 
            display: block !important; 
          }
          .report-container { 
            border: none !important; 
            box-shadow: none !important; 
            border-radius: 0 !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important; 
            max-width: none !important; 
          }
        }
        .report-content h1, .report-content h2, .report-content h3 { font-family: 'Playfair Display', serif; }
      `}</style>

      <div className="bg-gray-100 p-8 rounded-3xl border border-gray-200 print:bg-white print:p-0 print:rounded-none print:border-none report-container">
        <div 
          className="report-content"
          dangerouslySetInnerHTML={{ __html: data.reportText }} 
        />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mt-12 no-print px-6 gap-6">
        <button onClick={onReset} className="w-full md:w-auto text-gray-500 border-2 border-gray-200 hover:border-gray-400 px-8 py-4 rounded-2xl font-bold transition-all bg-white">
          Nova Avaliação
        </button>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <button onClick={onReview} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-3">
            Revisar Dados
          </button>

          <button onClick={() => window.print()} className="w-full md:w-auto bg-agro-900 hover:bg-black text-white px-10 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Gerar PDF / Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportScreen;


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
    <div className="w-full max-w-5xl animate-fade-in pb-10 print:pb-0">
      <style>{`
        @media print {
          @page { 
            margin: 0; 
            size: A4; 
          }
          
          html, body { 
            margin: 0 !important; 
            padding: 0 !important; 
            overflow: visible !important; 
            height: auto !important; 
            background: white !important;
            -webkit-print-color-adjust: exact;
          }

          header, footer, .no-print { display: none !important; }
          
          .report-page { 
            display: block !important;
            page-break-before: always !important;
            page-break-after: always !important;
            clear: both;
            box-shadow: none !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 16mm !important;
          }
          
          .report-page:first-child {
            page-break-before: avoid !important;
          }

          #root, main { 
            width: 100% !important; 
            max-width: 100% !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            display: block !important;
            overflow: visible !important;
          }
        }

        .report-content h1, .report-content h2, .report-content h3 { font-family: 'Playfair Display', serif; }
        .report-content p { line-height: 1.6; }
      `}</style>

      <div className="bg-white shadow-2xl md:p-0 print:shadow-none report-container overflow-hidden rounded-3xl border border-gray-100">
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Revisar Dados
          </button>

          <button 
            onClick={() => window.print()} 
            className="w-full md:w-auto bg-agro-900 hover:bg-black text-white px-10 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3"
          >
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

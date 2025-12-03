import React from 'react';
import { ValuationResult, PropertyData } from '../types';

interface ReportScreenProps {
  data: ValuationResult;
  property: PropertyData;
  onReset: () => void;
}

const ReportScreen: React.FC<ReportScreenProps> = ({ data, onReset }) => {
  return (
    <div className="w-full max-w-5xl animate-fade-in pb-10">
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background-color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .break-inside-avoid { break-inside: avoid; }
          
          /* Esconde cabeçalho e rodapé da app web */
          header, footer, .web-header { display: none !important; }
          main { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          
          /* Garante que o container ocupe a largura total */
          .report-container { box-shadow: none !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          
          /* Ajuste da Capa para preencher folha com Margens ABNT: Sup/Esq 3cm, Inf/Dir 2cm */
          /* Padding order: Top Right Bottom Left */
          .report-cover { height: 297mm; width: 210mm; padding: 30mm 20mm 20mm 30mm; }
          
          /* Ajuste das Seções internas com Margens ABNT */
          .report-section { padding: 30mm 20mm 20mm 30mm; min-height: 297mm; width: 210mm; }
        }

        /* Estilos Web */
        .report-content h1, .report-content h2, .report-content h3 { font-family: 'Playfair Display', serif; }
        .report-content p { margin-bottom: 0.75rem; }
      `}</style>

      <div className="bg-white shadow-xl md:p-0 print:shadow-none report-container overflow-hidden rounded-lg">
        {/* Renderização do HTML gerado pelo ValuationService */}
        <div 
          className="report-content"
          dangerouslySetInnerHTML={{ __html: data.reportText }} 
        />
      </div>

      <div className="flex justify-between mt-8 no-print px-4">
        <button 
          onClick={onReset} 
          className="text-gray-600 border-2 border-gray-300 hover:border-gray-400 px-6 py-3 rounded-lg font-bold transition-colors"
        >
          Nova Avaliação
        </button>
        <button 
          onClick={() => window.print()} 
          className="bg-agro-700 hover:bg-agro-800 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Imprimir PDF / Salvar
        </button>
      </div>
    </div>
  );
};

export default ReportScreen;
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ValuationResult, PropertyData, MarketSample, GroundingSource } from '../types';

interface ReportScreenProps {
  data: ValuationResult;
  property: PropertyData;
  onReset: () => void;
}

const ReportScreen: React.FC<ReportScreenProps> = ({ data, onReset }) => {
  // Type Guard to distinguish between MarketSample and GroundingSource
  const isMarketSample = (source: any): source is MarketSample => {
    return (source as MarketSample).price !== undefined;
  };

  const hasMarketSamples = data.sources.length > 0 && isMarketSample(data.sources[0]);

  return (
    <div className="w-full max-w-5xl animate-fade-in pb-10">
      <div className="bg-white shadow-xl p-8 md:p-12 print:shadow-none">
        <div className="border-b-2 border-agro-900 pb-6 mb-8 flex justify-between items-end">
          <h1 className="text-3xl font-serif font-bold text-agro-900">BANDEIRA AGRO</h1>
          <div className="text-right text-sm text-gray-500">ABNT NBR 14653</div>
        </div>

        <article className="prose prose-stone max-w-none">
          <ReactMarkdown>{data.reportText}</ReactMarkdown>
        </article>

        {data.sources.length > 0 && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="font-bold text-lg mb-4">
              {hasMarketSamples ? "Amostras Comparativas (Banco de Dados)" : "Fontes de Pesquisa (Web/Maps)"}
            </h3>
            
            {hasMarketSamples ? (
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr><th className="p-2 border">Local</th><th className="p-2 border">Valor</th><th className="p-2 border">Área</th></tr>
                </thead>
                <tbody>
                  {(data.sources as MarketSample[]).map((s, i) => (
                    <tr key={i}>
                      <td className="p-2 border">{s.city}/{s.state}</td>
                      <td className="p-2 border">R$ {s.price.toLocaleString('pt-BR')}</td>
                      <td className="p-2 border">{s.areaTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ul className="list-disc pl-5 space-y-2">
                {(data.sources as GroundingSource[]).map((s, i) => (
                  <li key={i}>
                    <a href={s.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {s.title || s.uri}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8 no-print">
        <button onClick={onReset} className="text-gray-600 border px-4 py-2 rounded">Nova Avaliação</button>
        <button onClick={() => window.print()} className="bg-agro-700 text-white px-6 py-3 rounded font-bold">Imprimir</button>
      </div>
    </div>
  );
};

export default ReportScreen;
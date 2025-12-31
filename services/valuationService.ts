
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90;

/**
 * Realiza os cálculos estatísticos e formata o laudo final em HTML conforme NBR 14653
 */
const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length === 0) {
    throw new Error("AMOSTRAS_INSUFICIENTES");
  }

  // Tratamento da amostra por fator de oferta
  const adjustedSamples = pool.map(s => {
    const adjustedPrice = s.price * OFFER_FACTOR;
    const adjustedPricePerUnit = adjustedPrice / s.areaTotal;
    return { ...s, adjustedPrice, adjustedPricePerUnit };
  });

  const sumUnit = adjustedSamples.reduce((acc, s) => acc + s.adjustedPricePerUnit, 0);
  const avgUnit = sumUnit / adjustedSamples.length;
  const finalValue = avgUnit * data.areaTotal;

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const valStr = formatter.format(finalValue);
  const unitLabel = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const reportHtml = `
    <div class="report-cover">
      <div class="text-center py-20">
        <h1 class="text-5xl font-serif font-bold text-agro-900 mb-2">LAUDO DE AVALIAÇÃO</h1>
        <p class="text-agro-600 tracking-widest uppercase font-bold">Bandeira Agro Intelligence Pool</p>
      </div>
      
      <div class="mt-40 border-l-8 border-orange-500 pl-10">
        <div class="mb-10">
          <p class="text-xs text-gray-400 uppercase font-bold mb-1">Finalidade</p>
          <p class="text-2xl font-bold text-gray-800">Avaliação de Valor de Mercado (NBR 14653)</p>
        </div>
        
        <div class="mb-10">
          <p class="text-xs text-gray-400 uppercase font-bold mb-1">Localização do Imóvel</p>
          <p class="text-xl text-gray-800">${data.city} - ${data.state}</p>
          <p class="text-gray-500">${data.neighborhood || ''} ${data.address || ''}</p>
        </div>
        
        <div>
          <p class="text-xs text-gray-400 uppercase font-bold mb-1">Data de Emissão</p>
          <p class="text-xl text-gray-800">${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>

    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-2 mb-6">1. Identificação do Imóvel</h2>
      <div class="grid grid-cols-2 gap-y-4 gap-x-8 text-sm bg-gray-50 p-6 rounded-lg">
        <div><span class="text-gray-500 font-bold uppercase text-[10px]">Tipo:</span> <p class="font-bold text-gray-800">${data.urbanSubType || data.ruralActivity || data.type}</p></div>
        <div><span class="text-gray-500 font-bold uppercase text-[10px]">Área Total:</span> <p class="font-bold text-gray-800">${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p></div>
        <div class="col-span-2"><span class="text-gray-500 font-bold uppercase text-[10px]">Observações:</span> <p class="mt-1 text-gray-700">${data.description || 'Não informada.'}</p></div>
      </div>

      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-2 mt-12 mb-6">2. Diagnóstico de Mercado</h2>
      <p class="text-sm text-gray-600 mb-6">
        Utilizou-se o <strong>Método Comparativo Direto de Dados de Mercado</strong>. 
        A pesquisa identificou ${pool.length} amostras relevantes, tratadas homogeneamente pelo fator de oferta (0,90).
      </p>
      
      <div class="overflow-hidden border border-gray-200 rounded-lg">
        <table class="w-full text-[10px] text-left border-collapse">
          <thead class="bg-gray-100 text-gray-700 uppercase">
            <tr>
              <th class="p-2 border-b">Amostra</th>
              <th class="p-2 border-b">Portal/Fonte</th>
              <th class="p-2 border-b">Área</th>
              <th class="p-2 border-b">Oferta (R$)</th>
              <th class="p-2 border-b">Unitário Homog.</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${adjustedSamples.map((s, idx) => `
              <tr>
                <td class="p-2">#${idx + 1}</td>
                <td class="p-2">${s.source}</td>
                <td class="p-2">${s.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</td>
                <td class="p-2">${formatter.format(s.price)}</td>
                <td class="p-2">${formatter.format(s.adjustedPricePerUnit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-2 mb-8">3. Conclusão de Valor</h2>
      
      <div class="bg-agro-900 text-white p-10 rounded-2xl shadow-xl relative overflow-hidden mb-10">
        <div class="absolute top-0 right-0 w-32 h-32 bg-agro-700 opacity-20 -mr-10 -mt-10 rounded-full"></div>
        <p class="text-orange-400 font-bold uppercase tracking-widest text-[10px] mb-2">Valor de Mercado Estimado</p>
        <p class="text-5xl font-serif font-bold">${valStr}</p>
        <div class="mt-8 pt-8 border-t border-agro-700 grid grid-cols-2 gap-4 text-sm">
          <div>
             <p class="text-agro-400 text-[10px] uppercase font-bold">Unitário Médio</p>
             <p>${formatter.format(avgUnit)}/${unitLabel}</p>
          </div>
          <div>
             <p class="text-agro-400 text-[10px] uppercase font-bold">Fator Oferta</p>
             <p>0,90 (Aplicado)</p>
          </div>
        </div>
      </div>
      
      <div class="bg-blue-50 p-6 rounded-lg border border-blue-100 text-sm text-blue-800 mb-10">
        <p><strong>Nota Técnica:</strong> O valor apresentado é uma estimativa estatística baseada em amostras de mercado coletadas em portais digitais. Não substitui vistoria técnica in loco para fins de garantias bancárias ou perícias judiciais.</p>
      </div>
      
      <div class="mt-20 flex justify-between items-end border-t border-gray-100 pt-10">
        <div class="text-center">
          <div class="w-40 border-b border-gray-400 mb-2"></div>
          <p class="text-[10px] text-gray-400 uppercase tracking-widest">BANDEIRA AGRO - INTELLIGENCE ENGINE</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] text-gray-300 italic">Documento emitido via sistema Bandeira Agro Valuation.</p>
        </div>
      </div>
    </div>
  `;

  return {
    reportText: reportHtml,
    sources: pool,
    estimatedValue: valStr
  };
};

/**
 * Lógica Central de Avaliação com Integração e Auto-Aprendizado
 */
export const performValuation = async (data: PropertyData): Promise<ValuationResult> => {
  let pool: MarketSample[] = [];
  
  if (data.type === PropertyType.RURAL) {
    pool = await filterSamples(data.type, data.city, data.state, data.ruralActivity);
  }

  if (pool.length < 5) {
    const aiSamples = await findMarketSamplesIA(data);
    
    if (aiSamples.length < 3) {
      const deepSamples = await findMarketSamplesIA(data, true);
      pool = [...pool, ...deepSamples];
    } else {
      pool = [...pool, ...aiSamples];
    }

    aiSamples.forEach(sample => {
      saveSample(sample).catch(() => {}); 
    });
  }

  const uniquePool = pool.filter((v, i, a) => 
    a.findIndex(t => (t.url && t.url === v.url) || t.id === v.id) === i
  );

  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

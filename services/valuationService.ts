
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const OTHERS_FACTOR = 1.05; 
const LIQUIDATION_FACTOR = 0.6979; 

const LogoSVG = `
  <div class="flex flex-col items-center">
    <div class="relative w-28 h-28 mb-6">
      <div class="absolute inset-0 border-[3px] border-[#f97316] rounded-full"></div>
      <div class="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 100 100" class="w-12 h-12 text-[#15803d] fill-current">
          <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
        </svg>
      </div>
    </div>
    <h1 class="text-2xl font-serif font-bold tracking-[0.5em] text-[#14532d] uppercase">BANDEIRA AGRO</h1>
  </div>
`;

const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length === 0) throw new Error("Não foram encontradas amostras suficientes para este imóvel.");

  const isRural = data.type === PropertyType.RURAL;
  const unit = isRural ? 'ha' : 'm²';

  const processed = pool.map(s => {
    const vub = s.price / s.areaTotal;
    const vuh = vub * OFFER_FACTOR * OTHERS_FACTOR;
    return { ...s, vub, vuh };
  });

  const vuhValues = processed.map(s => s.vuh);
  const avgVuh = vuhValues.reduce((a, b) => a + b, 0) / vuhValues.length;
  const finalValue = avgVuh * data.areaTotal;
  const liquidationValue = finalValue * LIQUIDATION_FACTOR;
  
  const variance = vuhValues.reduce((a, b) => a + Math.pow(b - avgVuh, 2), 0) / vuhValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / avgVuh) * 100;

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const locationDisplay = [data.address, data.neighborhood, data.city, data.state].filter(Boolean).join(', ');

  const reportHtml = `
    <div class="report-wrapper bg-white font-sans text-gray-800 p-10">
      <div class="text-center mb-10">${LogoSVG}</div>
      <h2 class="text-3xl font-serif font-bold text-agro-900 text-center mb-6">LAUDO DE AVALIAÇÃO</h2>
      <div class="grid grid-cols-2 gap-6 mb-10">
        <div class="border p-4 rounded-lg bg-gray-50">
          <p class="text-xs font-bold text-gray-400">VALOR DE MERCADO</p>
          <p class="text-2xl font-black text-gray-900">${fmt.format(finalValue)}</p>
        </div>
        <div class="border p-4 rounded-lg bg-gray-50">
          <p class="text-xs font-bold text-gray-400">VALOR POR ${unit.toUpperCase()}</p>
          <p class="text-xl font-bold text-agro-700">${fmt.format(avgVuh)}</p>
        </div>
      </div>
      <div class="mb-10">
        <h3 class="font-bold border-b mb-3">DADOS DO IMÓVEL</h3>
        <p><strong>Local:</strong> ${locationDisplay}</p>
        <p><strong>Área:</strong> ${data.areaTotal} ${unit}</p>
      </div>
      <div class="mb-10">
        <h3 class="font-bold border-b mb-3">MEMÓRIA DE CÁLCULO</h3>
        <table class="w-full text-xs text-left border">
          <thead class="bg-gray-100">
            <tr><th class="p-2 border">Amostra</th><th class="p-2 border">Preço</th><th class="p-2 border">Área</th><th class="p-2 border">VUH</th></tr>
          </thead>
          <tbody>
            ${processed.slice(0, 5).map((s, i) => `
              <tr><td class="p-2 border">Amostra ${i+1}</td><td class="p-2 border">${fmt.format(s.price)}</td><td class="p-2 border">${s.areaTotal} ${unit}</td><td class="p-2 border font-bold">${fmt.format(s.vuh)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return {
    reportText: reportHtml,
    sources: processed,
    estimatedValue: fmt.format(finalValue),
    liquidationValue: fmt.format(liquidationValue),
    stats: {
      average: avgVuh,
      sampleCount: processed.length,
      standardDeviation: fmt.format(stdDev)
    }
  };
};

export const performValuation = async (data: PropertyData): Promise<ValuationResult> => {
  // 1. Busca no Banco (Dashboard)
  let pool: MarketSample[] = await filterSamples(data.type, data.city, data.state);

  // 2. Se estiver vazio, tenta a IA uma única vez
  if (pool.length === 0) {
    try {
      const iaSamples = await findMarketSamplesIA(data);
      pool = iaSamples.filter(s => s.price > 0 && s.areaTotal > 0);
    } catch (e) {
      console.error("Erro na busca IA.");
    }
  }

  return calculateAndGenerateReport(data, pool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

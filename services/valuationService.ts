
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const INTEREST_RATE = 0.0151; // 1,51% ao mês
const ABSORPTION_MONTHS = 24; // 24 meses

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const LogoSVG = `
  <div class="flex flex-col items-center">
    <div class="relative w-32 h-32 flex items-center justify-center">
      <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full text-orange-500 fill-none stroke-current" stroke-width="4">
        <circle cx="50" cy="50" r="45" />
      </svg>
      <svg viewBox="0 0 100 100" class="w-20 h-20 text-green-700 fill-current">
        <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
      </svg>
    </div>
    <h1 class="mt-4 text-3xl font-serif font-bold tracking-[0.1em] text-gray-800 uppercase">BANDEIRA AGRO</h1>
  </div>
`;

const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length < 3) throw new Error("AMOSTRAS_INSUFICIENTES");

  // 1. Homogeneização base
  const allProcessed = pool.map(s => {
    const adjustedPricePerUnit = (s.price * OFFER_FACTOR) / s.areaTotal;
    const fOferta = OFFER_FACTOR;
    const fDim = 1.00;
    const fCap = data.type === PropertyType.RURAL ? 1.27 : 1.00;
    const fOutros = 1.08;
    const vuh = adjustedPricePerUnit * fDim * fCap * fOutros;
    
    return { ...s, adjustedPricePerUnit, vuh, fOferta, fDim, fCap, fOutros };
  });

  // 2. Saneamento por Mediana (Filtro de 40%)
  const sortedVuhs = [...allProcessed].map(s => s.vuh).sort((a, b) => a - b);
  const medianVuh = sortedVuhs[Math.floor(sortedVuhs.length / 2)];
  const sanitized = allProcessed.filter(s => {
    const ratio = s.vuh / medianVuh;
    return ratio >= 0.6 && ratio <= 1.4;
  });

  const finalPool = (sanitized.length >= 3 ? sanitized : allProcessed)
    .sort((a, b) => Math.abs(a.vuh - medianVuh) - Math.abs(b.vuh - medianVuh))
    .slice(0, 6);

  // 3. Cálculos Finais
  const vuhValues = finalPool.map(s => s.vuh);
  const avgVuh = vuhValues.reduce((a, b) => a + b, 0) / vuhValues.length;
  const finalValue = avgVuh * data.areaTotal;
  const factorLF = 1 / Math.pow((1 + INTEREST_RATE), ABSORPTION_MONTHS);
  const liquidationValue = finalValue * factorLF;

  const variance = vuhValues.reduce((a, b) => a + Math.pow(b - avgVuh, 2), 0) / vuhValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / avgVuh) * 100;

  let precisionGrade = cv <= 15 ? "GRAU III" : cv <= 30 ? "GRAU II" : "GRAU I";

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unit = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const reportHtml = `
    <div class="report-wrapper bg-white text-gray-900 font-sans">
      
      <!-- PÁGINA 1: CAPA -->
      <div class="report-page flex flex-col items-center justify-between py-20">
        <div class="mt-10">${LogoSVG}</div>
        <div class="text-center">
          <h2 class="text-5xl font-serif font-bold text-agro-900 mb-4 uppercase tracking-tighter">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
          <div class="w-32 h-1 bg-agro-900 mx-auto mt-6"></div>
          <p class="mt-4 text-gray-400 font-bold tracking-widest text-xs">NBR 14653 - INTELIGÊNCIA DE MERCADO</p>
        </div>
        <div class="w-full max-w-2xl border-t border-gray-100 pt-8">
          <table class="w-full text-left text-sm uppercase tracking-wider font-bold">
            <tr class="border-b border-gray-50"><td class="py-4 text-gray-400 text-[10px]">SOLICITANTE</td><td class="text-gray-800">BANDEIRA AGRO</td></tr>
            <tr class="border-b border-gray-50"><td class="py-4 text-gray-400 text-[10px]">OBJETIVO</td><td class="text-gray-800">DETERMINAÇÃO DE VALOR DE MERCADO</td></tr>
            <tr><td class="py-4 text-gray-400 text-[10px]">DATA BASE</td><td class="text-gray-800">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
        </div>
      </div>

      <!-- PÁGINA 2: RESUMO -->
      <div class="report-page">
        <h2 class="text-3xl font-serif font-bold text-agro-900 text-center mb-4 uppercase tracking-widest">RESUMO DA AVALIAÇÃO</h2>
        <div class="w-16 h-1 bg-gray-300 mx-auto mb-16"></div>
        <div class="space-y-10 max-w-3xl mx-auto border-b border-gray-100 pb-16">
          <div><h3 class="font-bold text-gray-400 uppercase text-xs tracking-widest mb-2">LOCALIZAÇÃO</h3><p class="text-xl text-gray-800 font-medium">${data.address || 'Área Rural'}, ${data.city} - ${data.state}</p></div>
          <div><h3 class="font-bold text-gray-400 uppercase text-xs tracking-widest mb-2">DIMENSÕES</h3><p class="text-xl text-gray-800 font-bold uppercase">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unit}</p></div>
        </div>
        <div class="mt-12 text-center">
          <h3 class="font-bold text-gray-900 uppercase text-sm tracking-widest mb-10">VALORES APURADOS</h3>
          <div class="space-y-6">
            <div class="p-4 bg-gray-50 rounded-xl inline-block px-10">
              <p class="text-gray-400 uppercase text-[10px] mb-1">Valor de Mercado</p>
              <p class="text-3xl text-gray-900 font-bold">${fmt.format(finalValue)}</p>
            </div>
            <div>
              <p class="text-gray-400 uppercase text-[10px] mb-1">Liquidação Forçada</p>
              <p class="text-2xl text-gray-600 font-bold">${fmt.format(liquidationValue)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- PÁGINA 3: METODOLOGIA -->
      <div class="report-page text-gray-700 text-sm leading-relaxed">
        <h2 class="text-xl font-bold mb-6 uppercase border-b pb-2">METODOLOGIA</h2>
        <p class="mb-8 text-justify">Utilizado o Método Comparativo Direto de Dados de Mercado (NBR 14653), com saneamento estatístico por mediana para eliminar outliers locais.</p>
        <h2 class="text-xl font-bold mb-6 uppercase border-b pb-2">LIQUIDAÇÃO FORÇADA</h2>
        <p class="mb-10 text-justify">Calculada com base na descapitalização financeira para um horizonte de 24 meses, utilizando taxa média de 1,51% a.m.</p>
        <div class="mt-auto p-6 bg-agro-50 rounded-xl border border-agro-100">
           <p class="text-xs font-bold text-agro-900 uppercase">Enquadramento Normativo</p>
           <p class="text-lg font-bold text-agro-800">${precisionGrade} (CV: ${cv.toFixed(2)}%)</p>
        </div>
      </div>

      <!-- ANEXOS -->
      ${chunkArray(finalPool, 3).map((chunk) => `
        <div class="report-page">
          <h2 class="text-xl font-bold mb-8 uppercase">ANEXO: FICHAS DE PESQUISA</h2>
          <div class="space-y-6">
            ${chunk.map((s, idx) => `
              <div class="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <div class="bg-agro-900 text-white p-3 font-bold text-[10px] uppercase">Amostra #${idx + 1} - ${s.city}</div>
                <div class="grid grid-cols-2 p-4 gap-4 text-xs">
                  <div><p class="text-gray-400 uppercase text-[8px] mb-1">Fonte</p><p class="truncate font-medium">${s.source}</p></div>
                  <div><p class="text-gray-400 uppercase text-[8px] mb-1">Valor Total</p><p class="font-bold">${fmt.format(s.price)}</p></div>
                  <div><p class="text-gray-400 uppercase text-[8px] mb-1">Área</p><p>${s.areaTotal} ${unit}</p></div>
                  <div><p class="text-gray-400 uppercase text-[8px] mb-1">VUH</p><p class="text-agro-700 font-bold">${fmt.format(s.vuh)}/${unit}</p></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <style>
      .report-page { background: white; width: 210mm; height: 297mm; margin: 0 auto; padding: 25mm; display: flex; flex-direction: column; box-sizing: border-box; }
      @media print { .report-page { page-break-after: always; height: 297mm; } }
    </style>
  `;

  return {
    reportText: reportHtml,
    sources: finalPool,
    estimatedValue: fmt.format(finalValue),
    liquidationValue: fmt.format(liquidationValue),
    stats: {
      average: avgVuh,
      sampleCount: finalPool.length,
      standardDeviation: fmt.format(stdDev)
    }
  };
};

export const performValuation = async (data: PropertyData): Promise<ValuationResult> => {
  let pool = await filterSamples(data.type, data.city, data.state);
  if (pool.length < 8) {
    const aiSamples = await findMarketSamplesIA(data);
    pool = [...pool, ...aiSamples];
    aiSamples.forEach(s => saveSample(s).catch(() => {}));
  }
  const uniquePool = pool.filter((v, i, a) => v.price > 0 && v.areaTotal > 0 && a.findIndex(t => t.url === v.url || t.id === v.id) === i);
  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

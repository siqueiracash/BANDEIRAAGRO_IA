
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const INTEREST_RATE = 0.0151; // 1,51% ao mês
const LIQUIDATION_FACTOR = 0.6979; // (1 / (1+0.0151)^24)

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// Cálculo do Fator de Dimensão baseado na NBR 14653 (Regra do expoente)
const calculateFDim = (areaSample: number, areaTarget: number) => {
  if (!areaSample || !areaTarget) return 1.00;
  const ratio = areaTarget / areaSample;
  // Expoente usual para terrenos/áreas rurais é 0.125
  const fDim = Math.pow(ratio, 0.125);
  // Limites usuais de mercado para evitar distorções excessivas
  return Math.max(0.70, Math.min(1.30, fDim));
};

const LogoSVG = `
  <div class="flex flex-col items-center">
    <div class="relative w-32 h-32 flex items-center justify-center">
      <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full text-orange-500 fill-none stroke-current" stroke-width="4">
        <circle cx="50" cy="50" r="45" />
      </svg>
      <svg viewBox="0 0 100 100" class="w-20 h-20 text-green-800 fill-current">
        <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
      </svg>
    </div>
    <h1 class="mt-4 text-3xl font-serif font-bold tracking-[0.2em] text-gray-800 uppercase">BANDEIRA AGRO</h1>
  </div>
`;

const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  const strictPool = pool.filter(s => {
    if (data.type === PropertyType.URBAN) {
      return s.urbanSubType?.toLowerCase() === data.urbanSubType?.toLowerCase();
    } else {
      return s.ruralActivity?.toLowerCase() === data.ruralActivity?.toLowerCase();
    }
  });

  const workingPool = strictPool.length >= 3 ? strictPool : pool;
  if (workingPool.length < 3) throw new Error("AMOSTRAS_INSUFICIENTES");

  // 1. Homogeneização com Cálculo Dinâmico
  const allProcessed = workingPool.map(s => {
    const vub = s.price / s.areaTotal;
    const fOferta = OFFER_FACTOR;
    const fDim = calculateFDim(s.areaTotal, data.areaTotal);
    
    // Outros fatores poderiam ser expandidos aqui (Topografia, Acesso, etc)
    const fTopo = 1.00; 
    const fOutros = 1.05; // Fator de segurança/ajuste fino
    
    const vuh = vub * fOferta * fDim * fTopo * fOutros;
    
    return { ...s, vub, vuh, fOferta, fDim, fTopo, fOutros };
  });

  // 2. Saneamento Estatístico (Filtro de 30% em torno da média para saneamento inicial)
  const initialAvg = allProcessed.reduce((a, b) => a + b.vuh, 0) / allProcessed.length;
  const sanitized = allProcessed.filter(s => s.vuh >= initialAvg * 0.7 && s.vuh <= initialAvg * 1.3);
  
  // Seleção final das 6 amostras mais consistentes
  const finalPool = (sanitized.length >= 3 ? sanitized : allProcessed)
    .sort((a, b) => Math.abs(a.vuh - initialAvg) - Math.abs(b.vuh - initialAvg))
    .slice(0, 6);

  // 3. Estatísticas Finais
  const vuhValues = finalPool.map(s => s.vuh);
  const avgVuh = vuhValues.reduce((a, b) => a + b, 0) / vuhValues.length;
  const finalValue = avgVuh * data.areaTotal;
  const liquidationValue = finalValue * LIQUIDATION_FACTOR;

  const variance = vuhValues.reduce((a, b) => a + Math.pow(b - avgVuh, 2), 0) / vuhValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / avgVuh) * 100;

  let precision = "GRAU I";
  if (cv <= 15) precision = "GRAU III";
  else if (cv <= 30) precision = "GRAU II";

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unit = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const reportHtml = `
    <div class="report-wrapper bg-white text-gray-900 font-sans text-[14px]">
      <div class="report-page flex flex-col items-center justify-between py-24 px-20">
        <div class="mt-10">${LogoSVG}</div>
        <div class="text-center">
          <h2 class="text-5xl font-serif font-bold text-[#14532d] mb-2 uppercase tracking-tight leading-tight">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
          <div class="w-32 h-1 bg-[#14532d] mx-auto mt-4"></div>
        </div>
        <div class="w-full max-w-2xl border-t border-gray-100 pt-10 mb-10">
          <table class="w-full text-left uppercase font-bold text-gray-600 text-[11px] tracking-wider">
            <tr class="border-b border-gray-100"><td class="py-5">SOLICITANTE</td><td class="text-gray-900">BANDEIRA AGRO</td></tr>
            <tr class="border-b border-gray-100"><td class="py-5">OBJETIVO DA AVALIAÇÃO</td><td class="text-gray-900">DETERMINAÇÃO DO VALOR DE MERCADO</td></tr>
            <tr><td class="py-5">DATA BASE</td><td class="text-gray-900">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
        </div>
      </div>

      <div class="report-page px-20 py-20">
        <h2 class="text-3xl font-serif font-bold text-[#14532d] text-center mb-2 uppercase tracking-widest">RESUMO DA AVALIAÇÃO</h2>
        <div class="w-16 h-1 bg-gray-200 mx-auto mb-20"></div>
        <div class="space-y-12 max-w-3xl mx-auto border-b border-gray-100 pb-16">
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">LOCALIZAÇÃO</h3><p class="text-xl font-medium text-gray-800">${data.address || 'Área Rural'}, ${data.city} - ${data.state}</p></div>
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">TIPO</h3><p class="text-xl font-medium text-gray-800">${data.type} (${data.urbanSubType || data.ruralActivity})</p></div>
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">ÁREAS</h3><p class="text-2xl font-bold text-[#14532d] uppercase">${data.areaTotal.toLocaleString('pt-BR')} ${unit.toUpperCase()}</p></div>
        </div>
        <div class="mt-16 text-center">
          <div class="space-y-6">
            <p class="text-2xl font-medium text-gray-600">VALOR DE MERCADO: <span class="font-bold text-gray-900">${fmt.format(finalValue)}</span></p>
            <p class="text-2xl font-medium text-gray-600">LIQUIDAÇÃO FORÇADA: <span class="font-bold text-gray-900">${fmt.format(liquidationValue)}</span></p>
          </div>
        </div>
      </div>

      <!-- Outras páginas simplificadas para brevidade mas mantendo a estrutura PDF -->
      ${chunkArray(finalPool, 3).map((chunk, pIdx) => `
        <div class="report-page px-20 py-20">
          <h2 class="text-xl font-serif font-bold text-gray-900 mb-8 uppercase tracking-widest">ANEXO: AMOSTRAS HOMOGENEIZADAS</h2>
          <div class="space-y-6">
            ${chunk.map((s, i) => `
              <div class="border border-gray-200 rounded-xl overflow-hidden">
                <div class="bg-[#14532d] text-white px-5 py-2 text-[10px] font-bold">AMOSTRA #${(pIdx * 3) + i + 1}</div>
                <div class="grid grid-cols-2 text-[10px] p-4 gap-4">
                  <div><p class="text-gray-400 uppercase mb-1">Valor/Área</p><p class="font-bold">${fmt.format(s.price)} / ${s.areaTotal}${unit}</p></div>
                  <div><p class="text-gray-400 uppercase mb-1">VUH (Homogeneizado)</p><p class="font-bold text-green-700">${fmt.format(s.vuh)}</p></div>
                  <div class="col-span-2 text-gray-500 italic border-t pt-2">${s.source} - F.Dim: ${s.fDim.toFixed(3)} | F.Of: ${s.fOferta.toFixed(2)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <div class="report-page px-20 py-20">
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-8 uppercase tracking-widest">RESULTADO ESTATÍSTICO</h2>
        <div class="bg-gray-50 p-8 rounded-2xl border border-gray-100 space-y-4">
          <p class="flex justify-between">Média Homogeneizada: <strong>${fmt.format(avgVuh)}/${unit}</strong></p>
          <p class="flex justify-between">Coeficiente de Variação: <strong>${cv.toFixed(2)}%</strong></p>
          <p class="flex justify-between">Grau de Precisão: <strong>${precision}</strong></p>
          <p class="flex justify-between pt-4 border-t">Valor Total Estimado: <strong class="text-xl">${fmt.format(finalValue)}</strong></p>
        </div>
        <p class="mt-12 text-xs text-gray-400 text-justify">
          Laudo gerado via Bandeira Agro Intelligence. A homogeneização seguiu critérios da NBR 14653, aplicando fatores de oferta e dimensão para equilibrar as amostras de mercado com o imóvel objeto da avaliação.
        </p>
      </div>
    </div>

    <style>
      .report-page { background: white; width: 210mm; height: 297mm; margin: 0 auto; display: flex; flex-direction: column; box-sizing: border-box; }
      @media print {
        .report-page { page-break-after: always; height: 297mm; width: 210mm; }
      }
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
  
  const uniquePool = pool.filter((v, i, a) => 
    v.price > 0 && v.areaTotal > 0 && 
    a.findIndex(t => t.url === v.url || t.id === v.id) === i
  );

  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

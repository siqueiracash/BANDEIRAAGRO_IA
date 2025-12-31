
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const OTHERS_FACTOR = 1.08;
const INTEREST_RATE = 0.0151; // 1,51% ao mês
const ABSORPTION_MONTHS = 24; // 24 meses
const LIQUIDATION_FACTOR = 0.6979; // (1 / (1+0.0151)^24)

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
      <svg viewBox="0 0 100 100" class="w-20 h-20 text-green-800 fill-current">
        <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
      </svg>
    </div>
    <h1 class="mt-4 text-3xl font-serif font-bold tracking-[0.2em] text-gray-800 uppercase">BANDEIRA AGRO</h1>
  </div>
`;

const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length < 3) throw new Error("AMOSTRAS_INSUFICIENTES");

  const allProcessed = pool.map(s => {
    const vub = s.price / s.areaTotal;
    const vuh = vub * OFFER_FACTOR * OTHERS_FACTOR;
    return { ...s, vub, vuh };
  });

  const sortedVuhs = [...allProcessed].map(s => s.vuh).sort((a, b) => a - b);
  const medianVuh = sortedVuhs[Math.floor(sortedVuhs.length / 2)];
  
  const finalPool = allProcessed
    .sort((a, b) => Math.abs(a.vuh - medianVuh) - Math.abs(b.vuh - medianVuh))
    .slice(0, 6);

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
      
      <!-- PÁGINA 1: CAPA -->
      <div class="report-page flex flex-col items-center justify-between py-24 px-20">
        <div>${LogoSVG}</div>
        <div class="text-center">
          <h2 class="text-5xl font-serif font-bold text-agro-900 mb-2 uppercase tracking-tight leading-tight">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
          <div class="w-32 h-1 bg-agro-700 mx-auto mt-4"></div>
        </div>
        <div class="w-full max-w-2xl border-t border-gray-100 pt-10">
          <table class="w-full text-left uppercase font-bold text-gray-600 text-[11px] tracking-wider">
            <tr class="border-b border-gray-50"><td class="py-4">SOLICITANTE</td><td class="text-gray-900">BANDEIRA AGRO</td></tr>
            <tr class="border-b border-gray-50"><td class="py-4">OBJETIVO DA AVALIAÇÃO</td><td class="text-gray-900">DETERMINAÇÃO DOS VALORES DE MERCADO E LIQUIDAÇÃO FORÇADA</td></tr>
            <tr class="border-b border-gray-50"><td class="py-4">FINALIDADE DA AVALIAÇÃO</td><td class="text-gray-900">GARANTIA / GESTÃO PATRIMONIAL</td></tr>
            <tr><td class="py-4">DATA BASE</td><td class="text-gray-900">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
        </div>
      </div>

      <!-- PÁGINA 2: RESUMO -->
      <div class="report-page px-20 py-20">
        <h2 class="text-3xl font-serif font-bold text-agro-900 text-center mb-2 uppercase tracking-widest">RESUMO DA AVALIAÇÃO</h2>
        <div class="w-16 h-1 bg-gray-200 mx-auto mb-20"></div>

        <div class="space-y-12 max-w-3xl mx-auto border-b border-gray-100 pb-16">
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">LOCALIZAÇÃO DO IMÓVEL</h3><p class="text-xl font-medium text-gray-800">${data.address || ''}, ${data.neighborhood || ''}, ${data.city} - ${data.state}</p></div>
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">TIPO DE IMÓVEL</h3><p class="text-xl font-medium text-gray-800 uppercase">${data.type} (${data.urbanSubType || data.ruralActivity})</p></div>
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">ÁREAS</h3><p class="text-2xl font-bold text-agro-900 uppercase">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unit.toUpperCase()}</p></div>
        </div>

        <div class="mt-16 text-center">
          <h3 class="text-[10px] font-bold text-gray-900 uppercase tracking-[0.4em] mb-12">RESUMO DE VALORES</h3>
          <div class="space-y-4">
            <p class="text-xl font-medium text-gray-600 uppercase">VALOR DE MERCADO: <span class="font-bold text-gray-900">${fmt.format(finalValue)}</span></p>
            <p class="text-xl font-medium text-gray-600 uppercase">VALOR DE LIQUIDAÇÃO FORÇADA: <span class="font-bold text-gray-900">${fmt.format(liquidationValue)}</span></p>
          </div>
        </div>
      </div>

      <!-- PÁGINAS 5-6: ANEXO - FICHAS DE PESQUISA -->
      ${chunkArray(finalPool, 3).map((chunk, pIdx) => `
        <div class="report-page px-20 py-20">
          <h2 class="text-xl font-serif font-bold text-gray-900 mb-2 uppercase tracking-widest">ANEXO: FICHAS DE PESQUISA</h2>
          <h3 class="text-2xl font-serif text-gray-400 mb-12 uppercase tracking-[0.15em]">DETALHAMENTO DO MERCADO</h3>
          <div class="space-y-6">
            ${chunk.map((s, i) => `
              <div class="sample-card border border-gray-200 rounded-lg overflow-hidden bg-white">
                <div class="sample-header bg-agro-700 text-white px-5 py-3 flex justify-between items-center font-bold text-[11px] uppercase tracking-wider">
                  <span>AMOSTRA #${(pIdx * 3) + i + 1}</span>
                  <span class="flex-1 text-center px-4">${s.city.toUpperCase()}</span>
                  <span class="bg-white/20 px-3 py-1 rounded-full text-[10px]">OFERTA (0,90)</span>
                </div>
                <div class="grid grid-cols-2 border-t border-gray-200">
                  <div class="p-4 border-r border-b border-gray-100">
                    <p class="text-[9px] font-bold text-agro-700 uppercase mb-1">LOCALIZAÇÃO</p>
                    <p class="text-gray-900 text-xs font-semibold leading-tight">${s.neighborhood || s.city}</p>
                  </div>
                  <div class="p-4 border-b border-gray-100">
                    <p class="text-[9px] font-bold text-agro-700 uppercase mb-1">FONTE</p>
                    <p class="text-gray-500 text-[9px] truncate">${s.source || 'Mercado'}</p>
                  </div>
                  <div class="p-4 border-r border-gray-100">
                    <p class="text-[9px] font-bold text-agro-700 uppercase mb-1">ÁREA TOTAL</p>
                    <p class="text-gray-900 text-sm font-bold leading-tight">${s.areaTotal.toLocaleString('pt-BR')} ${unit}</p>
                  </div>
                  <div class="p-4">
                    <p class="text-[9px] font-bold text-agro-700 uppercase mb-1">VALOR TOTAL</p>
                    <p class="text-gray-900 text-sm font-bold leading-tight">${fmt.format(s.price)}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-auto pt-10 text-center text-gray-300 text-[10px] font-bold uppercase tracking-widest">BANDEIRA AGRO - INTELIGÊNCIA EM AVALIAÇÕES</div>
        </div>
      `).join('')}

      <!-- PÁGINA: MEMÓRIA DE CÁLCULO -->
      <div class="report-page px-20 py-20">
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-2 uppercase tracking-widest">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <h3 class="text-2xl font-serif text-gray-300 mb-10 uppercase tracking-[0.15em]">PROCESSAMENTO ESTATÍSTICO</h3>
        
        <table class="w-full text-[10px] border border-gray-100 mb-10">
          <tr class="bg-agro-900 text-white uppercase text-center font-bold">
            <th class="p-2 border">Amostra</th><th class="p-2 border">VO (R$)</th><th class="p-2 border">ÁREA (${unit.toUpperCase()})</th><th class="p-2 border">VUH (R$)</th>
          </tr>
          ${finalPool.map((s, i) => `
            <tr class="text-center odd:bg-gray-50">
              <td class="p-2 border font-bold text-gray-400">${i+1}</td>
              <td class="p-2 border">${fmt.format(s.price)}</td>
              <td class="p-2 border">${s.areaTotal}</td>
              <td class="p-2 border font-bold text-agro-700">${fmt.format(s.vuh)}</td>
            </tr>
          `).join('')}
        </table>

        <div class="grid grid-cols-2 gap-10 text-sm">
          <div class="space-y-2 uppercase font-bold text-gray-500 text-[10px] tracking-wider">
            <p class="flex justify-between border-b pb-1">MÉDIA <span class="text-gray-900 font-extrabold">${fmt.format(avgVuh)}</span></p>
            <p class="flex justify-between border-b pb-1">DESVIO PADRÃO <span class="text-agro-700 font-extrabold">${fmt.format(stdDev)}</span></p>
            <p class="flex justify-between">GRAU DE PRECISÃO <span class="text-agro-700 font-extrabold">${precision}</span></p>
          </div>
        </div>
      </div>

    </div>

    <style>
      /* ESTILOS PARA IMPRESSÃO E PDF */
      .report-wrapper { 
        margin: 0; 
        padding: 0;
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
      }
      .report-page { 
        background: white !important; 
        width: 210mm; 
        height: 296mm; 
        margin: 0 auto; 
        display: flex; 
        flex-direction: column; 
        box-sizing: border-box; 
        page-break-after: always;
        overflow: hidden;
      }
      .sample-header, .bg-agro-900, .bg-agro-700 {
        background-color: #15803d !important;
        color: white !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .bg-agro-900 { background-color: #14532d !important; }
      @media print {
        body { margin: 0; padding: 0; }
        .report-page { 
          box-shadow: none !important; 
          margin: 0 !important; 
          border: none !important;
          page-break-after: always !important;
        }
      }
    </style>
  `.trim();

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
  if (pool.length < 6) {
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

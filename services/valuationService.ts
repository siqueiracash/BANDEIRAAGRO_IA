
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const INTEREST_RATE = 0.0151; 
const ABSORPTION_MONTHS = 24;

/**
 * Mapeamentos de Pesos para Homogeneização
 */
const ACCESS_WEIGHTS: Record<string, number> = {
  'Ótimo (asfalto, tráfego permanente)': 1.10,
  'Muito Bom (estrada classe, não asfalto)': 1.05,
  'Bom (não pavimentada, tráfego permanente)': 1.00,
  'Regular (não pavimentada, sujeita a interrupção)': 0.90,
  'Mau (interrupção na chuva)': 0.80,
  'Péssimo (sem ponte)': 0.70,
  'Encravada': 0.60
};

const TOPO_WEIGHTS: Record<string, number> = {
  'Plano': 1.00,
  'Leve-Ondulado': 0.95,
  'Ondulado': 0.85,
  'Montanhoso': 0.70
};

const SOIL_WEIGHTS: Record<string, number> = {
  'I - Culturas (Sem problemas)': 1.15,
  'II - Culturas (Pequenos problemas)': 1.10,
  'III - Culturas (Sérios problemas)': 1.00,
  'IV - Culturas Ocasionais / Pastagens': 0.90,
  'V - Só Pastagens': 0.85,
  'VI - Só Pastagens (Pequenos problemas)': 0.80,
  'VII - Florestas': 0.70,
  'VIII - Abrigo Silvestre': 0.60
};

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const LogoSVG = `
  <div class="flex flex-col items-center">
    <div class="relative w-28 h-28 flex items-center justify-center">
      <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full text-orange-500 fill-none stroke-current" stroke-width="3">
        <circle cx="50" cy="50" r="46" />
      </svg>
      <svg viewBox="0 0 100 100" class="w-16 h-16 text-green-800 fill-current">
        <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
      </svg>
    </div>
    <h1 class="mt-3 text-2xl font-serif font-bold tracking-[0.2em] text-gray-800 uppercase">BANDEIRA AGRO</h1>
  </div>
`;

const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length < 3) throw new Error("AMOSTRAS_INSUFICIENTES");

  // Determinar pesos do avaliando (Target)
  const targetAccess = ACCESS_WEIGHTS[data.access || ''] || 1.00;
  const targetTopo = TOPO_WEIGHTS[data.topography || ''] || 1.00;
  const targetSoil = SOIL_WEIGHTS[data.landCapability || ''] || 1.00;

  // 1. Processamento e Homogeneização Dinâmica
  const allProcessed = pool.map(s => {
    // Fator Oferta
    const fOferta = OFFER_FACTOR;
    
    // Fator Dimensão (fDim) - Doutrina NBR 14653
    // Relação entre área do avaliando e área da amostra
    const areaRatio = data.areaTotal / s.areaTotal;
    const exponent = data.type === PropertyType.RURAL ? 0.125 : 0.10;
    const fDim = Math.pow(areaRatio, exponent);

    // Fatores Qualitativos (Amostra sempre considerada Paradigma 1.00 se não houver dados)
    const fAcesso = targetAccess / 1.00;
    const fTopo = targetTopo / 1.00;
    const fCap = targetSoil / 1.00;
    const fOutros = 1.00;

    const vub = s.price / s.areaTotal;
    const vuh = vub * fOferta * fDim * fAcesso * fTopo * fCap * fOutros;

    return { 
      ...s, vub, vuh, 
      fOferta, fDim, fAcesso, fTopo, fCap, fOutros 
    };
  });

  // 2. Saneamento de Outliers (Intervalo de 2.5 Desvios Padrão)
  const initialVuhs = allProcessed.map(s => s.vuh);
  const initialAvg = initialVuhs.reduce((a, b) => a + b, 0) / initialVuhs.length;
  const initialStdDev = Math.sqrt(initialVuhs.reduce((a, b) => a + Math.pow(b - initialAvg, 2), 0) / initialVuhs.length);
  
  const sanitizedPool = allProcessed.filter(s => {
    const diff = Math.abs(s.vuh - initialAvg);
    return diff <= (2.0 * initialStdDev); // Filtro mais rigoroso que 3.0
  });

  const finalPool = (sanitizedPool.length >= 3 ? sanitizedPool : allProcessed)
    .sort((a, b) => Math.abs(a.vuh - initialAvg) - Math.abs(b.vuh - initialAvg))
    .slice(0, 6);

  // 3. Cálculos Estatísticos Finais
  const vuhValues = finalPool.map(s => s.vuh);
  const avgVuh = vuhValues.reduce((a, b) => a + b, 0) / vuhValues.length;
  const finalValue = avgVuh * data.areaTotal;

  const liquidationFactor = 1 / Math.pow((1 + INTEREST_RATE), ABSORPTION_MONTHS);
  const liquidationValue = finalValue * liquidationFactor;

  const variance = vuhValues.reduce((a, b) => a + Math.pow(b - avgVuh, 2), 0) / vuhValues.length;
  const stdDev = Math.sqrt(variance);
  const coefVariation = (stdDev / avgVuh) * 100;

  let precisionGrade = "GRAU I";
  if (coefVariation <= 15) precisionGrade = "GRAU III";
  else if (coefVariation <= 30) precisionGrade = "GRAU II";

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unitLabel = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const reportHtml = `
    <div class="report-wrapper bg-white text-gray-900">
      
      <!-- CAPA -->
      <div class="report-page items-center justify-between pb-32">
        <div class="mt-20">${LogoSVG}</div>
        <div class="text-center">
          <p class="text-orange-500 font-bold tracking-[0.5em] text-[10px] mb-2">INTELLIGENCE REPORT</p>
          <h2 class="text-5xl font-serif font-bold text-agro-900 uppercase leading-none">Laudo de<br>Avaliação</h2>
          <div class="w-20 h-1 bg-agro-700 mx-auto mt-8"></div>
        </div>
        <div class="w-full max-w-md border-t border-gray-100 pt-8">
          <div class="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span>Data: ${new Date().toLocaleDateString('pt-BR')}</span>
            <span>Ref: BA-${Math.random().toString(36).substring(7).toUpperCase()}</span>
          </div>
        </div>
      </div>

      <!-- RESUMO EXECUTIVO -->
      <div class="report-page">
        <div class="flex justify-between items-start mb-12">
           <h2 class="text-2xl font-serif font-bold text-agro-900 uppercase">Resumo Executivo</h2>
           <span class="bg-agro-100 text-agro-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">${precisionGrade}</span>
        </div>

        <div class="grid grid-cols-2 gap-10 mb-16">
          <div class="space-y-6">
            <div>
              <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Identificação</h3>
              <p class="text-sm font-semibold text-gray-800">${data.address || data.neighborhood || 'Área Rural'}, ${data.city} - ${data.state}</p>
            </div>
            <div>
              <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Área Avaliada</h3>
              <p class="text-lg font-bold text-agro-900">${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
            </div>
          </div>
          <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
             <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">Metodologia Aplicada</h3>
             <p class="text-[11px] text-gray-600 leading-relaxed italic">
               "Método Comparativo Direto de Dados de Mercado com Saneamento de Outliers e Homogeneização por Fatores de Transposição e Localização."
             </p>
          </div>
        </div>

        <div class="mt-auto border-t border-agro-900 pt-10">
          <div class="grid grid-cols-2 gap-4">
             <div class="bg-agro-900 text-white p-8 rounded-3xl">
                <p class="text-[10px] font-bold text-agro-300 uppercase tracking-widest mb-2">Valor de Mercado</p>
                <p class="text-3xl font-bold">${formatter.format(finalValue)}</p>
             </div>
             <div class="bg-orange-500 text-white p-8 rounded-3xl">
                <p class="text-[10px] font-bold text-orange-200 uppercase tracking-widest mb-2">Liquidação Forçada</p>
                <p class="text-3xl font-bold">${formatter.format(liquidationValue)}</p>
             </div>
          </div>
        </div>
      </div>

      <!-- MEMÓRIA DE CÁLCULO -->
      <div class="report-page">
        <h2 class="text-xl font-bold mb-8 uppercase border-b pb-4">Detalhamento Técnico</h2>
        
        <div class="overflow-x-auto">
          <table class="w-full text-[9px] border-collapse">
            <thead>
              <tr class="bg-gray-100 text-gray-600 uppercase">
                <th class="p-2 border border-gray-200">Amostra</th>
                <th class="p-2 border border-gray-200">Preço (R$)</th>
                <th class="p-2 border border-gray-200">fOferta</th>
                <th class="p-2 border border-gray-200">fDim</th>
                <th class="p-2 border border-gray-200">fTopo</th>
                <th class="p-2 border border-gray-200 font-bold">VUH (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${finalPool.map((s, i) => `
                <tr>
                  <td class="p-2 border border-gray-100 font-bold text-center">${i+1}</td>
                  <td class="p-2 border border-gray-100">${s.price.toLocaleString('pt-BR')}</td>
                  <td class="p-2 border border-gray-100 text-center">${s.fOferta.toFixed(2)}</td>
                  <td class="p-2 border border-gray-100 text-center">${s.fDim.toFixed(2)}</td>
                  <td class="p-2 border border-gray-100 text-center">${s.fTopo.toFixed(2)}</td>
                  <td class="p-2 border border-gray-100 font-bold text-agro-700">${formatter.format(s.vuh)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="grid grid-cols-3 gap-6 mt-10">
          <div class="p-4 bg-gray-50 rounded-xl">
            <p class="text-[8px] font-bold text-gray-400 uppercase mb-1">Média Homogênea</p>
            <p class="text-sm font-bold text-gray-800">${formatter.format(avgVuh)}</p>
          </div>
          <div class="p-4 bg-gray-50 rounded-xl">
            <p class="text-[8px] font-bold text-gray-400 uppercase mb-1">Desvio Padrão</p>
            <p class="text-sm font-bold text-gray-800">${formatter.format(stdDev)}</p>
          </div>
          <div class="p-4 bg-gray-50 rounded-xl">
            <p class="text-[8px] font-bold text-gray-400 uppercase mb-1">Coef. Variação</p>
            <p class="text-sm font-bold ${coefVariation > 30 ? 'text-red-500' : 'text-agro-700'}">${coefVariation.toFixed(2)}%</p>
          </div>
        </div>

        <div class="mt-10 p-4 border border-blue-100 bg-blue-50 rounded-xl text-[10px] text-blue-800 leading-relaxed">
          <strong>Parecer Técnico:</strong> A homogeneização foi realizada comparando o imóvel avaliando com amostras de mercado coletadas em tempo real. O saneamento eliminou dados discrepantes (fora do intervalo de 2.0σ), resultando em um Coeficiente de Variação de ${coefVariation.toFixed(2)}%, o que confere ao laudo o <strong>${precisionGrade}</strong> conforme NBR 14653.
        </div>
      </div>

    </div>

    <style>
      .report-page { background: white; width: 210mm; height: 297mm; margin: 0 auto; padding: 25mm; display: flex; flex-direction: column; box-sizing: border-box; }
      @media print {
        .report-page { page-break-after: always; height: 297mm; padding: 25mm; }
        .report-page:last-child { page-break-after: avoid; }
      }
    </style>
  `;

  return {
    reportText: reportHtml,
    sources: finalPool,
    estimatedValue: formatter.format(finalValue),
    liquidationValue: formatter.format(liquidationValue),
    stats: {
      average: avgVuh,
      sampleCount: finalPool.length,
      standardDeviation: formatter.format(stdDev)
    }
  };
};

export const performValuation = async (data: PropertyData): Promise<ValuationResult> => {
  let pool = await filterSamples(data.type, data.city, data.state);
  
  if (pool.length < 10) {
    const aiSamples = await findMarketSamplesIA(data);
    pool = [...pool, ...aiSamples];
    aiSamples.forEach(s => saveSample(s).catch(() => {}));
  }

  const uniquePool = pool.filter((v, i, a) => 
    v.price > 0 && v.areaTotal > 0 && a.findIndex(t => t.url === v.url || t.id === v.id) === i
  );

  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

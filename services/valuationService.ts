
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const OTHERS_FACTOR = 1.05; // Ajuste fino de mercado
const INTEREST_RATE = 0.0151; 
const LIQUIDATION_FACTOR = 0.6979; 

// TABELAS DE FATORES CONFORME PRÁTICA DE ENGENHARIA DE AVALIAÇÕES
const RURAL_FACTORS = {
  activity: {
    "Lavoura": 1.60,
    "Pecuária": 1.30,
    "Pasto": 1.00,
    "Floresta": 0.80,
    "Cerrado Nativo": 0.65,
    "Mata Nativa": 0.50
  },
  topography: {
    "Plano": 1.00,
    "Leve-Ondulado": 0.90,
    "Ondulado": 0.80,
    "Montanhoso": 0.65
  },
  access: {
    "Ótimo (asfalto, tráfego permanente)": 1.10,
    "Muito Bom (estrada classe, não asfalto)": 1.00,
    "Bom (não pavimentada, tráfego permanente)": 0.90,
    "Regular (não pavimentada, sujeita a interrupção)": 0.80,
    "Mau (interrupção na chuva)": 0.70,
    "Péssimo (interrupção por córrego sem ponte)": 0.60,
    "Encravada": 0.50
  },
  capability: {
    "I - Culturas (Sem problemas)": 1.25,
    "II - Culturas (Pequenos problemas)": 1.15,
    "III - Culturas (Sérios problemas)": 1.05,
    "IV - Culturas Ocasionais / Pastagens": 1.00,
    "V - Só Pastagens": 0.90,
    "VI - Só Pastagens (Pequenos problemas)": 0.80,
    "VII - Florestas": 0.70,
    "VIII - Abrigo Silvestre": 0.50
  }
};

const getFactorValue = (category: keyof typeof RURAL_FACTORS, value?: string, defaultValue = 1.00): number => {
  if (!value) return defaultValue;
  const table = RURAL_FACTORS[category] as Record<string, number>;
  return table[value] || defaultValue;
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
  if (pool.length < 1) throw new Error("AMOSTRAS_INSUFICIENTES");

  // FATORES DO IMÓVEL AVALIANDO (O seu imóvel)
  const fAtivAval = getFactorValue('activity', data.ruralActivity);
  const fTopoAval = getFactorValue('topography', data.topography);
  const fAcesAval = getFactorValue('access', data.access);
  const fCapAval = getFactorValue('capability', data.landCapability);

  const allProcessed = pool.map(s => {
    const vub = s.price / s.areaTotal;
    
    // Homogeneização: Fator = (Fator do Avaliando / Fator da Amostra)
    // Como a maioria dos anúncios de portais são de padrão médio (Pasto/Misto), 
    // assumimos o denominador como 1.0 caso não especificado na amostra.
    const fOferta = OFFER_FACTOR;
    const fAtiv = fAtivAval / (getFactorValue('activity', s.ruralActivity) || 1.0);
    const fTopo = fTopoAval / (getFactorValue('topography', s.topography) || 1.0);
    const fAces = fAcesAval / (getFactorValue('access', s.access) || 1.0);
    const fCap = fCapAval / (getFactorValue('capability', s.landCapability) || 1.0);
    const fOutros = OTHERS_FACTOR;

    // Valor Unitário Homogeneizado
    const vuh = vub * fOferta * fAtiv * fTopo * fAces * fCap * fOutros;

    return { ...s, vub, vuh, fOferta, fAtiv, fTopo, fAces, fCap, fOutros };
  });

  // Filtragem estatística (Saneamento da amostra)
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
  if (pool.length < 3) precision = "AMOSTRAGEM REDUZIDA";

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unit = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const locationParts = [data.address, data.neighborhood, data.city].filter(p => p && p.trim() !== "");
  const locationDisplay = locationParts.join(', ') + (data.state ? ` - ${data.state}` : '');

  const reportHtml = `
    <div class="report-wrapper bg-[#f3f4f6] font-sans text-[13px] leading-tight text-gray-800">
      
      <!-- PÁGINA 1: CAPA -->
      <div class="report-page px-16 pt-32 pb-16 flex flex-col items-center justify-between">
        <div>${LogoSVG}</div>
        <div class="text-center">
          <h2 class="text-[36px] font-serif font-bold text-[#15803d] uppercase tracking-tight leading-[1.1] mb-12">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
          <p class="text-[14px] text-gray-400 font-bold uppercase tracking-[0.3em]">IMÓVEL ${data.type}</p>
        </div>
        <div class="w-full">
          <table class="w-full text-left uppercase text-[10px] font-bold tracking-[0.05em]">
            <tr class="border-t border-gray-100"><td class="py-4 text-gray-400 w-1/3">SOLICITANTE</td><td class="text-gray-900">BANDEIRA AGRO</td></tr>
            <tr class="border-t border-gray-100"><td class="py-4 text-gray-400">OBJETIVO DA AVALIAÇÃO</td><td class="text-gray-900">DETERMINAÇÃO DOS VALORES DE MERCADO E LIQUIDAÇÃO FORÇADA</td></tr>
            <tr class="border-t border-gray-100"><td class="py-4 text-gray-400">FINALIDADE DA AVALIAÇÃO</td><td class="text-gray-900">GARANTIA / GESTÃO PATRIMONIAL</td></tr>
            <tr class="border-t border-b border-gray-100"><td class="py-4 text-gray-400">DATA BASE</td><td class="text-gray-900">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
        </div>
      </div>

      <!-- PÁGINA 2: RESUMO -->
      <div class="report-page px-16 py-16 flex flex-col">
        <h2 class="text-[26px] font-serif font-bold text-[#15803d] text-center mb-12 uppercase tracking-[0.2em]">RESUMO DA AVALIAÇÃO</h2>
        
        <div class="space-y-8">
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">LOCALIZAÇÃO DO IMÓVEL</h3>
            <p class="text-[17px] font-bold text-gray-900">${locationDisplay}</p>
          </div>
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">ATIVIDADE / USO ATUAL</h3>
            <p class="text-[17px] font-bold text-gray-900 uppercase">
              ${data.ruralActivity || 'AGROPECUÁRIA'} - ${data.landCapability || 'USO DIVERSO'}
            </p>
          </div>
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">TOPOGRAFIA E ACESSO</h3>
            <p class="text-[15px] font-bold text-gray-900 uppercase">
              RELEVO: ${data.topography || 'NÃO INF.'} | ACESSO: ${data.access ? data.access.split('(')[0] : 'NÃO INF.'}
            </p>
          </div>
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">ÁREAS</h3>
            <p class="text-[22px] font-bold text-[#15803d] uppercase">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unit.toUpperCase()}</p>
          </div>
        </div>

        <div class="mt-auto border-t border-gray-100 pt-10">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em] text-center mb-4">RESULTADOS FINAIS</p>
          <div class="space-y-4 text-center">
            <div>
              <p class="text-[14px] text-gray-400 uppercase font-bold">Valor de Mercado (Venda Direta)</p>
              <p class="text-[36px] font-black text-gray-900">${fmt.format(finalValue)}</p>
              <p class="text-[11px] text-[#15803d] font-bold uppercase tracking-widest">${fmt.format(avgVuh)} / ${unit.toUpperCase()}</p>
            </div>
            <div class="pt-4">
              <p class="text-[14px] text-gray-400 uppercase font-bold">Valor de Liquidação Forçada</p>
              <p class="text-[28px] font-bold text-gray-600">${fmt.format(liquidationValue)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- PÁGINA 7: MEMÓRIA DE CÁLCULO -->
      <div class="report-page px-16 py-10 flex flex-col">
        <h2 class="text-[18px] font-serif font-bold text-gray-900 mb-1 uppercase tracking-wide">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <h3 class="text-[22px] font-serif text-gray-300 mb-6 uppercase tracking-[0.15em]">PROCESSAMENTO ESTATÍSTICO</h3>
        
        <div class="mb-5">
          <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">1. DADOS DE MERCADO (VALORES BRUTOS)</p>
          <table class="w-full text-[9px] border-collapse border border-gray-100">
            <thead>
              <tr class="bg-gray-50 text-gray-400 uppercase font-bold text-center">
                <th class="p-2 border">ID</th><th class="p-2 border">ÁREA (${unit.toUpperCase()})</th><th class="p-2 border">VALOR (R$)</th><th class="p-2 border">UNIT. BRUTO (R$/${unit})</th>
              </tr>
            </thead>
            <tbody>
              ${finalPool.map((s, i) => `
                <tr class="text-center">
                  <td class="p-1.5 border font-bold text-gray-300">${i+1}</td>
                  <td class="p-1.5 border">${s.areaTotal}</td>
                  <td class="p-1.5 border">${fmt.format(s.price)}</td>
                  <td class="p-1.5 border font-bold text-gray-900">${fmt.format(s.vub)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="mb-8">
          <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">2. HOMOGENEIZAÇÃO (APLICAÇÃO DE FATORES NBR 14653)</p>
          <table class="w-full text-[8px] border-collapse border border-gray-100">
            <thead>
              <tr class="bg-[#15803d] text-white uppercase font-bold text-center">
                <th class="p-1.5 border">ID</th><th class="p-1.5 border">f.OFER</th><th class="p-1.5 border">f.ATIV</th><th class="p-1.5 border">f.TOPO</th><th class="p-1.5 border">f.ACES</th><th class="p-1.5 border">f.CAP</th><th class="p-1.5 border">f.OUT</th><th class="p-1.5 border">VUH (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${finalPool.map((s, i) => `
                <tr class="text-center hover:bg-gray-50">
                  <td class="p-1 border font-bold text-gray-300">${i+1}</td>
                  <td class="p-1 border">${s.fOferta.toFixed(2)}</td>
                  <td class="p-1 border font-bold ${s.fAtiv > 1 ? 'text-green-600' : ''}">${s.fAtiv.toFixed(2)}</td>
                  <td class="p-1 border">${s.fTopo.toFixed(2)}</td>
                  <td class="p-1 border">${s.fAces.toFixed(2)}</td>
                  <td class="p-1 border">${s.fCap.toFixed(2)}</td>
                  <td class="p-1 border">${s.fOutros.toFixed(2)}</td>
                  <td class="p-1 border font-bold text-gray-900 bg-gray-50">${fmt.format(s.vuh)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="text-[7px] text-gray-400 mt-2 uppercase">* Os fatores representam a relação entre o Imóvel Avaliando e a Amostra. Valores > 1.00 valorizam a amostra; < 1.00 depreciam.</p>
        </div>

        <div class="mt-2 grid grid-cols-2 gap-10">
          <div class="space-y-2">
            <div class="flex justify-between border-b border-gray-100 pb-1 text-[10px] font-bold"><span class="text-gray-400">VALOR MÉDIO UNITÁRIO</span><span class="text-gray-900">${fmt.format(avgVuh)}</span></div>
            <div class="flex justify-between border-b border-gray-100 pb-1 text-[10px] font-bold"><span class="text-gray-400">DESVIO PADRÃO</span><span class="text-gray-900">${fmt.format(stdDev)}</span></div>
            <div class="flex justify-between border-b border-gray-100 pb-1 text-[10px] font-bold"><span class="text-gray-400">COEFICIENTE DE VARIAÇÃO</span><span class="text-gray-900">${cv.toFixed(2)}%</span></div>
            <div class="flex justify-between text-[10px] font-bold"><span class="text-gray-400">GRAU DE FUNDAMENTAÇÃO</span><span class="text-[#15803d]">${precision}</span></div>
          </div>
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p class="text-[9px] font-black text-center mb-3 text-gray-400 uppercase">RESULTADO FINAL</p>
            <p class="text-[24px] font-black text-gray-900 text-center">${fmt.format(finalValue)}</p>
          </div>
        </div>
      </div>

    </div>

    <style>
      .report-page { 
        background: white; 
        width: 210mm; 
        height: 297mm; 
        margin: 10px auto; 
        display: flex; 
        flex-direction: column; 
        box-sizing: border-box; 
        box-shadow: 0 0 10px rgba(0,0,0,0.1); 
        page-break-after: always;
        overflow: hidden;
      }
      @media print {
        body { background: white !important; margin: 0 !important; }
        .report-page { box-shadow: none !important; margin: 0 !important; border: none !important; }
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
  
  if (data.type === PropertyType.RURAL && pool.length < 3) {
    const statePool = await filterSamples(data.type, null, data.state);
    const existingIds = new Set(pool.map(s => s.id));
    statePool.forEach(s => {
      if (!existingIds.has(s.id)) pool.push(s);
    });
  }

  if (pool.length < 6) {
    try {
      const aiSamples = await findMarketSamplesIA(data);
      if (aiSamples.length > 0) {
        pool = [...pool, ...aiSamples];
      }
    } catch (e) {}
  }
  
  const finalPool = pool.filter((v, i, a) => 
    v.price > 0 && v.areaTotal > 0 && 
    a.findIndex(t => (t.url && t.url === v.url) || t.id === v.id) === i
  );
  
  return calculateAndGenerateReport(data, finalPool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;


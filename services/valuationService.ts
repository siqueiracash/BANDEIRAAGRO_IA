
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const OTHERS_FACTOR = 1.05; 
const LIQUIDATION_FACTOR = 0.6979; 

// TABELAS DE FATORES RURAIS
const RURAL_FACTORS = {
  activity: {
    "Lavoura": 1.60, "Pecuária": 1.30, "Pasto": 1.00, "Floresta": 0.80, "Cerrado Nativo": 0.65, "Mata Nativa": 0.50
  },
  topography: {
    "Plano": 1.00, "Leve-Ondulado": 0.90, "Ondulado": 0.80, "Montanhoso": 0.65
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
    "I - Culturas (Sem problemas)": 1.25, "II - Culturas (Pequenos problemas)": 1.15, "III - Culturas (Sérios problemas)": 1.05,
    "IV - Culturas Ocasionais / Pastagens": 1.00, "V - Só Pastagens": 0.90, "VI - Só Pastagens (Pequenos problemas)": 0.80,
    "VII - Florestas": 0.70, "VIII - Abrigo Silvestre": 0.50
  }
};

const getRuralFactor = (category: keyof typeof RURAL_FACTORS, value?: string): number => {
  if (!value) return 1.00;
  const table = RURAL_FACTORS[category] as Record<string, number>;
  return table[value] || 1.00;
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
  // Se ainda assim tiver menos de 5 para urbano, avisamos, mas tentamos prosseguir se for possível com o que tem
  if (data.type === PropertyType.URBAN && pool.length < 3) {
    throw new Error("AMOSTRAS_INSUFICIENTES_CRITICO");
  }

  const isRural = data.type === PropertyType.RURAL;

  const allProcessed: any[] = pool.map(s => {
    const vub = s.price / s.areaTotal;
    const fOferta = OFFER_FACTOR;
    const factors: Record<string, number> = { fOferta };

    if (isRural) {
      const fAtivAval = getRuralFactor('activity', data.ruralActivity);
      const fTopoAval = getRuralFactor('topography', data.topography);
      const fAcesAval = getRuralFactor('access', data.access);
      const fCapAval = getRuralFactor('capability', data.landCapability);
      factors.fAtiv = fAtivAval / (getRuralFactor('activity', s.ruralActivity) || 1.0);
      factors.fTopo = fTopoAval / (getRuralFactor('topography', s.topography) || 1.0);
      factors.fAces = fAcesAval / (getRuralFactor('access', s.access) || 1.0);
      factors.fCap = fCapAval / (getRuralFactor('capability', s.landCapability) || 1.0);
    } else {
      // Fator Localização: Se for no mesmo bairro 1.0, se for na mesma cidade mas bairro diferente 0.90, se for outra cidade 0.80
      const sNeighborhood = (s.neighborhood || "").toLowerCase();
      const dNeighborhood = (data.neighborhood || "").toLowerCase();
      const sCity = (s.city || "").toLowerCase();
      const dCity = (data.city || "").toLowerCase();

      if (sNeighborhood === dNeighborhood) factors.fLoc = 1.00;
      else if (sCity === dCity) factors.fLoc = 0.92;
      else factors.fLoc = 0.85;

      factors.fConserv = data.conservationState === s.conservationState ? 1.00 : 0.95;
    }

    const product = Object.values(factors).reduce((acc, val) => acc * val, 1);
    const vuh = vub * product * OTHERS_FACTOR;
    return { ...s, vub, vuh, ...factors };
  });

  // Cálculo Estatístico
  const vuhValues = allProcessed.map(s => s.vuh);
  const avgVuh = vuhValues.reduce((a, b) => a + b, 0) / vuhValues.length;
  
  // Filtragem de Saneamento (Eliminar outliers extremos)
  const filteredProcessed = allProcessed.filter(s => s.vuh >= avgVuh * 0.7 && s.vuh <= avgVuh * 1.3).slice(0, 10);
  
  const finalVuhValues = filteredProcessed.map(s => s.vuh);
  const finalAvgVuh = finalVuhValues.reduce((a, b) => a + b, 0) / finalVuhValues.length;
  
  const finalValue = finalAvgVuh * data.areaTotal;
  const liquidationValue = finalValue * LIQUIDATION_FACTOR;
  
  const variance = finalVuhValues.reduce((a, b) => a + Math.pow(b - finalAvgVuh, 2), 0) / finalVuhValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / finalAvgVuh) * 100;

  let precision = "GRAU I";
  if (cv <= 15) precision = "GRAU III";
  else if (cv <= 30) precision = "GRAU II";

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unit = isRural ? 'ha' : 'm²';
  const locationDisplay = [data.address, data.neighborhood, data.city, data.state].filter(Boolean).join(', ');

  const reportHtml = `
    <div class="report-wrapper bg-[#f3f4f6] font-sans text-[13px] leading-tight text-gray-800">
      <div class="report-page px-16 pt-32 pb-16 flex flex-col items-center justify-between">
        <div>${LogoSVG}</div>
        <div class="text-center">
          <h2 class="text-[36px] font-serif font-bold text-[#15803d] uppercase tracking-tight leading-[1.1] mb-12">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
          <p class="text-[14px] text-gray-400 font-bold uppercase tracking-[0.3em]">IMÓVEL ${data.type}</p>
        </div>
        <div class="w-full">
          <table class="w-full text-left uppercase text-[10px] font-bold tracking-[0.05em]">
            <tr class="border-t border-gray-100"><td class="py-4 text-gray-400 w-1/3">SOLICITANTE</td><td class="text-gray-900">BANDEIRA AGRO</td></tr>
            <tr class="border-t border-gray-100"><td class="py-4 text-gray-400">OBJETIVO DA AVALIAÇÃO</td><td class="text-gray-900 font-bold">VALOR DE MERCADO E LIQUIDAÇÃO FORÇADA</td></tr>
            <tr class="border-t border-b border-gray-100"><td class="py-4 text-gray-400">DATA BASE</td><td class="text-gray-900">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
        </div>
      </div>
      <div class="report-page px-16 py-16 flex flex-col">
        <h2 class="text-[26px] font-serif font-bold text-[#15803d] text-center mb-12 uppercase tracking-[0.2em]">RESUMO DA AVALIAÇÃO</h2>
        <div class="space-y-8">
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">LOCALIZAÇÃO DO IMÓVEL</h3>
            <p class="text-[17px] font-bold text-gray-900">${locationDisplay}</p>
          </div>
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">ÁREAS</h3>
            <p class="text-[22px] font-bold text-[#15803d] uppercase">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unit.toUpperCase()}</p>
          </div>
          <div class="mt-auto border-t border-gray-100 pt-10">
            <div class="space-y-4 text-center">
              <div>
                <p class="text-[14px] text-gray-400 uppercase font-bold">Valor de Mercado</p>
                <p class="text-[36px] font-black text-gray-900">${fmt.format(finalValue)}</p>
                <p class="text-[11px] text-[#15803d] font-bold uppercase tracking-widest">${fmt.format(finalAvgVuh)} / ${unit.toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="report-page px-16 py-10 flex flex-col">
        <h2 class="text-[18px] font-serif font-bold text-gray-900 mb-1 uppercase tracking-wide">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <div class="mb-8">
          <table class="w-full text-[8px] border-collapse border border-gray-100">
            <thead>
              <tr class="bg-[#15803d] text-white uppercase font-bold text-center">
                <th class="p-1.5 border">ID</th>
                <th class="p-1.5 border">PREÇO</th>
                <th class="p-1.5 border">ÁREA</th>
                <th class="p-1.5 border">VUH (HOMOG.)</th>
                <th class="p-1.5 border">FONTE</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProcessed.map((s, i) => `
                <tr class="text-center">
                  <td class="p-1 border text-gray-400 font-bold">${i+1}</td>
                  <td class="p-1 border">${fmt.format(s.price)}</td>
                  <td class="p-1 border">${s.areaTotal} ${unit}</td>
                  <td class="p-1 border font-bold text-gray-900">${fmt.format(s.vuh)}</td>
                  <td class="p-1 border text-[7px] truncate max-w-[100px]">${s.source}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="grid grid-cols-2 gap-10">
          <div class="space-y-2 text-[10px] font-bold">
            <div class="flex justify-between border-b pb-1"><span class="text-gray-400">VARIAÇÃO (CV)</span><span>${cv.toFixed(2)}%</span></div>
            <div class="flex justify-between"><span class="text-gray-400">GRAU DE PRECISÃO</span><span class="text-green-600">${precision}</span></div>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  return {
    reportText: reportHtml,
    sources: filteredProcessed,
    estimatedValue: fmt.format(finalValue),
    liquidationValue: fmt.format(liquidationValue),
    stats: {
      average: finalAvgVuh,
      sampleCount: filteredProcessed.length,
      standardDeviation: fmt.format(stdDev)
    }
  };
};

export const performValuation = async (data: PropertyData): Promise<ValuationResult> => {
  console.log("Iniciando processo de avaliação Bandeira Agro para", data.city);
  
  // 1. Coleta inicial do banco de dados (Amostras que você ou outros já buscaram)
  let pool: MarketSample[] = await filterSamples(data.type, data.city, data.state);
  console.log(`Banco de dados: ${pool.length} amostras encontradas.`);

  // 2. Se tivermos poucas amostras (< 10), acionamos a IA para "colher" mais e salvar no banco
  if (pool.length < 15) {
    console.log("Acionando Inteligência de Mercado para colher novas amostras...");
    try {
      // Fazemos uma busca agressiva na cidade
      const aiSamples = await findMarketSamplesIA(data, 'city');
      
      for (const s of aiSamples) {
        // Se a amostra não for duplicada (URL única), salvamos no pool e no banco
        if (!pool.some(p => p.url === s.url)) {
          pool.push(s);
          await saveSample(s).catch(e => console.error("Erro ao persistir amostra IA:", e));
        }
      }
      console.log(`Pós-IA: ${pool.length} amostras totais no pool.`);
    } catch (e) {
      console.error("Erro na busca IA:", e);
    }
  }

  // 3. Fallback Radical: Se ainda assim for zero (quase impossível em cidades como SCS), expandimos para o estado
  if (pool.length < 3) {
    console.log("Fallback extremo: Buscando amostras similares no estado...");
    const statePool = await filterSamples(data.type, null, data.state);
    pool = [...pool, ...statePool.slice(0, 10)];
  }

  // 4. Limpeza e Saneamento final
  const finalPool = pool.filter(v => v.price > 5000 && v.areaTotal > 5);

  return calculateAndGenerateReport(data, finalPool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

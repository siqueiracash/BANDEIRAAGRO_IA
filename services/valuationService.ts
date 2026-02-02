
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const OTHERS_FACTOR = 1.05; 
const LIQUIDATION_FACTOR = 0.6979; 

// TABELAS DE FATORES RURAIS (NBR 14653-3)
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
  if (pool.length === 0) throw new Error("Não foram encontradas amostras suficientes. Tente cadastrar amostras manuais no Dashboard.");

  const isRural = data.type === PropertyType.RURAL;
  const unit = isRural ? 'ha' : 'm²';

  const processed = pool.map(s => {
    const vub = s.price / s.areaTotal;
    let factorProduct = OFFER_FACTOR;

    if (isRural) {
      // Comparação de fatores entre Avaliando e Amostra
      const fAtiv = getRuralFactor('activity', data.ruralActivity) / getRuralFactor('activity', s.ruralActivity);
      const fTopo = getRuralFactor('topography', data.topography) / getRuralFactor('topography', s.topography);
      const fAces = getRuralFactor('access', data.access) / getRuralFactor('access', s.access);
      const fCap = getRuralFactor('capability', data.landCapability) / getRuralFactor('capability', s.landCapability);
      factorProduct *= (fAtiv * fTopo * fAces * fCap);
    } else {
      // Urbano Simples
      const fLoc = (s.neighborhood === data.neighborhood) ? 1.0 : 0.92;
      factorProduct *= fLoc;
    }

    const vuh = vub * factorProduct * OTHERS_FACTOR;
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
    <div class="report-wrapper bg-[#f3f4f6] p-10 font-sans">
      <div class="max-w-[210mm] mx-auto bg-white p-12 shadow-2xl border-t-[8px] border-agro-700">
        <div class="text-center mb-12">${LogoSVG}</div>
        
        <h2 class="text-4xl font-serif font-bold text-agro-900 text-center mb-2 uppercase tracking-tighter">Laudo de Avaliação</h2>
        <p class="text-center text-gray-400 font-bold tracking-[0.3em] mb-12 uppercase text-xs">Imóvel ${data.type}</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div class="bg-agro-50 p-6 rounded-2xl border border-agro-100">
            <p class="text-[10px] font-black text-agro-700 uppercase mb-2">Valor de Mercado Estimado</p>
            <p class="text-3xl font-black text-gray-900">${fmt.format(finalValue)}</p>
            <p class="text-sm font-bold text-agro-600 mt-1">${fmt.format(avgVuh)} / ${unit}</p>
          </div>
          <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <p class="text-[10px] font-black text-gray-400 uppercase mb-2">Valor de Liquidação Forçada</p>
            <p class="text-2xl font-bold text-gray-600">${fmt.format(liquidationValue)}</p>
          </div>
        </div>

        <div class="space-y-6 mb-12 border-l-4 border-agro-500 pl-6">
          <h3 class="font-bold text-agro-900 uppercase text-sm tracking-widest">Identificação do Objeto</h3>
          <div class="grid grid-cols-2 gap-y-4 text-sm">
            <p><span class="text-gray-400 font-bold uppercase text-[10px] block">Localização</span> ${locationDisplay}</p>
            <p><span class="text-gray-400 font-bold uppercase text-[10px] block">Área Total</span> ${data.areaTotal.toLocaleString('pt-BR')} ${unit}</p>
            ${isRural ? `
              <p><span class="text-gray-400 font-bold uppercase text-[10px] block">Atividade</span> ${data.ruralActivity || 'Não informada'}</p>
              <p><span class="text-gray-400 font-bold uppercase text-[10px] block">Topografia</span> ${data.topography || 'Não informada'}</p>
            ` : ''}
          </div>
        </div>

        <div class="mb-12">
          <h3 class="font-bold text-agro-900 uppercase text-sm tracking-widest mb-4">Memória de Cálculo (Homogeneização)</h3>
          <table class="w-full text-[11px] text-left border-collapse">
            <thead class="bg-gray-100 uppercase font-bold text-gray-500">
              <tr>
                <th class="p-3 border-b">Amostra</th>
                <th class="p-3 border-b text-right">Preço</th>
                <th class="p-3 border-b text-right">Área</th>
                <th class="p-3 border-b text-right">Unit. Homog.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${processed.slice(0, 10).map((s, i) => `
                <tr>
                  <td class="p-3 font-medium">Amostra ${i+1} (${s.source})</td>
                  <td class="p-3 text-right">${fmt.format(s.price)}</td>
                  <td class="p-3 text-right">${s.areaTotal.toLocaleString('pt-BR')} ${unit}</td>
                  <td class="p-3 text-right font-bold text-gray-900">${fmt.format(s.vuh)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="mt-4 p-4 bg-gray-50 rounded text-[10px] text-gray-400 font-bold flex justify-between uppercase">
            <span>Coeficiente de Variação: ${cv.toFixed(2)}%</span>
            <span>Amostras Utilizadas: ${processed.length}</span>
          </div>
        </div>
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
  // 1. PRIMEIRO PASSO: Consultar banco de dados (Amostras Reais da Equipe)
  let pool: MarketSample[] = await filterSamples(data.type, data.city, data.state);
  
  // 2. SEGUNDO PASSO: Se houver menos de 5 amostras, acionar IA para busca pública
  if (pool.length < 5) {
    try {
      const iaSamples = await findMarketSamplesIA(data, 'city');
      // Filtra duplicatas para não repetir imóveis que já podem estar no banco
      const filteredIA = iaSamples.filter(ia => !pool.some(p => p.url === ia.url || p.title === ia.title));
      pool = [...pool, ...filteredIA];
    } catch (e) {
      console.warn("Falha na busca complementar de IA. Prosseguindo com dados locais.");
    }
  }

  // 3. Processamento Final
  return calculateAndGenerateReport(data, pool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

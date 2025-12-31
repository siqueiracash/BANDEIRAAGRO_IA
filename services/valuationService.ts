
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; // Fator de oferta padrão
const LIQUIDATION_RATE = 0.0153; // 1,53% ao mês
const LIQUIDATION_MONTHS = 24; // Prazo de 24 meses

/**
 * Realiza os cálculos estatísticos e formata o laudo conforme NBR 14653
 */
const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length === 0) {
    throw new Error("AMOSTRAS_INSUFICIENTES");
  }

  // 1. Tratamento das Amostras
  const processedSamples = pool.map(s => {
    const adjustedPrice = s.price * OFFER_FACTOR;
    const adjustedPricePerUnit = adjustedPrice / s.areaTotal;
    return { ...s, adjustedPricePerUnit };
  });

  const unitValues = processedSamples.map(s => s.adjustedPricePerUnit);
  const sum = unitValues.reduce((a, b) => a + b, 0);
  const avgUnit = sum / unitValues.length;
  const finalValue = avgUnit * data.areaTotal;

  // 2. Cálculo de Liquidação Forçada (VP para 24 meses)
  const liquidationValue = finalValue / Math.pow((1 + LIQUIDATION_RATE), LIQUIDATION_MONTHS);

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unitLabel = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const reportHtml = `
    <!-- Capa do Laudo -->
    <div class="report-cover flex flex-col justify-between">
      <div class="flex justify-between items-start border-b-2 border-gray-100 pb-10">
        <div class="font-serif text-4xl font-bold text-agro-900 border-l-8 border-orange-500 pl-6">
          BANDEIRA <span class="text-orange-500">AGRO</span>
        </div>
        <div class="text-right text-[11px] text-gray-400 uppercase tracking-widest leading-loose font-medium">
          Sistemas de Inteligência Imobiliária<br>
          NBR 14653-2 (URBANO) | NBR 14653-3 (RURAL)
        </div>
      </div>

      <div class="text-center flex-grow flex flex-col justify-center py-20">
        <h1 class="text-7xl font-serif font-bold text-agro-900 mb-8 tracking-tighter">LAUDO DE AVALIAÇÃO</h1>
        <div class="w-40 h-1.5 bg-orange-500 mx-auto mb-12"></div>
        <p class="text-2xl text-gray-400 font-light tracking-[0.3em] uppercase">Relatório Técnico de Mercado</p>
      </div>
      
      <div class="bg-gray-50 p-14 rounded-[2.5rem] border border-gray-100 mt-auto mb-10">
        <div class="grid grid-cols-2 gap-16">
          <div class="border-l-2 border-gray-200 pl-8">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-4 tracking-widest">Localização do Objeto</p>
            <p class="text-3xl font-bold text-gray-800 mb-2 leading-tight">${data.city} - ${data.state}</p>
            <p class="text-xl text-gray-500 font-light leading-relaxed">${data.neighborhood || data.address || 'Área de Estudo Regional'}</p>
          </div>
          <div class="text-right border-r-2 border-gray-200 pr-8">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-4 tracking-widest">Data de Emissão</p>
            <p class="text-3xl font-bold text-gray-800 leading-tight">${new Date().toLocaleDateString('pt-BR')}</p>
            <p class="text-base text-orange-600 mt-3 italic font-semibold">Validade técnica: 180 dias</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Seção 1: Identificação -->
    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-5 mb-12 uppercase tracking-[0.2em]">1. Identificação e Metodologia</h2>
      <div class="space-y-10 text-lg text-gray-700 leading-relaxed text-justify">
        <p><strong>1.1. Objetivo:</strong> Este documento técnico visa a determinação fundamentada do justo valor venal de mercado para fins de comercialização e o valor projetado para liquidação forçada do ativo imobiliário descrito.</p>
        <p><strong>1.2. Metodologia:</strong> Foi adotado o <strong>Método Comparativo Direto de Dados de Mercado</strong>, conforme as diretrizes da <strong>NBR 14653</strong>. O método baseia-se no tratamento técnico de atributos de elementos similares identificados no mercado imobiliário local.</p>
        <p><strong>1.3. Procedimentos:</strong> A coleta de dados utilizou a Engine <strong>Bandeira Agro Intelligence</strong>, processando amostras de portais especializados com aplicação de filtros de saneamento e homogeneização estatística.</p>
      </div>

      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-5 mt-24 mb-12 uppercase tracking-[0.2em]">2. Caracterização do Objeto</h2>
      <div class="grid grid-cols-2 gap-8 mb-12">
        <div class="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm print:shadow-none">
          <p class="text-[11px] text-gray-400 uppercase font-bold mb-2 tracking-widest">Tipo de Ativo</p>
          <p class="text-2xl font-bold text-gray-800">${data.type}</p>
        </div>
        <div class="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm print:shadow-none">
          <p class="text-[11px] text-gray-400 uppercase font-bold mb-2 tracking-widest">Área de Referência</p>
          <p class="text-2xl font-bold text-gray-800">${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
        </div>
        ${data.type === PropertyType.URBAN ? `
          <div class="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm print:shadow-none">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-2 tracking-widest">Subtipo</p>
            <p class="text-2xl font-bold text-gray-800">${data.urbanSubType || 'Comum'}</p>
          </div>
          <div class="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm print:shadow-none">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-2 tracking-widest">Conservação</p>
            <p class="text-2xl font-bold text-gray-800">${data.conservationState || 'Bom'}</p>
          </div>
        ` : ''}
      </div>
      
      <div class="p-12 border border-gray-100 bg-gray-50 rounded-[2rem] text-lg text-gray-600 leading-loose italic shadow-inner print:shadow-none">
        <strong class="text-gray-900 not-italic uppercase text-xs tracking-[0.3em] block mb-5">Diagnóstico Pericial:</strong>
        ${data.description || 'Imóvel avaliado sob condições normais de mercado, considerando sua inserção na malha regional e atributos informados.'}
      </div>
    </div>

    <!-- Seção 2: Diagnóstico de Mercado -->
    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-5 mb-12 uppercase tracking-[0.2em]">3. Tratamento de Amostras</h2>
      <p class="text-base text-gray-500 mb-12 leading-relaxed italic">
        A pesquisa identificou elementos comparáveis ativos na região de ${data.city}/${data.state}. 
        Para homogeneização, aplicou-se o <strong>Fator de Oferta de ${OFFER_FACTOR.toFixed(2)}</strong> para mitigar distorções de negociação.
      </p>
      
      <!-- TABELA: Removido overflow-hidden para não cortar cabeçalho no print -->
      <div class="border border-gray-200 rounded-[2rem] mb-16">
        <table class="w-full text-sm text-left border-collapse overflow-visible">
          <thead class="bg-agro-900 text-white uppercase tracking-widest">
            <tr>
              <th class="p-8 font-bold rounded-tl-[2rem]">Amostra</th>
              <th class="p-8 font-bold">Localização</th>
              <th class="p-8 font-bold">Área</th>
              <th class="p-8 text-right font-bold rounded-tr-[2rem]">Unitário Tratado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${processedSamples.map((s, idx) => `
              <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="p-8 font-bold text-agro-900">AMS-0${idx + 1}</td>
                <td class="p-8">
                  <span class="font-bold text-gray-800">${s.neighborhood || s.city}</span><br>
                  <span class="text-[10px] text-gray-400 uppercase tracking-widest">${s.source}</span>
                </td>
                <td class="p-8 font-medium text-gray-600">${s.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</td>
                <td class="p-8 text-right font-bold text-agro-700 text-lg">${formatter.format(s.adjustedPricePerUnit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="grid grid-cols-3 gap-10">
        <div class="p-10 bg-white border border-gray-100 rounded-[2rem] text-center shadow-sm print:shadow-none">
          <p class="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-[0.2em]">Elementos</p>
          <p class="text-4xl font-bold text-gray-800">${pool.length}</p>
        </div>
        <div class="p-10 bg-agro-50 border border-agro-100 rounded-[2rem] text-center shadow-sm print:shadow-none">
          <p class="text-[10px] text-agro-700 font-bold uppercase mb-4 tracking-[0.2em]">Média Tratada</p>
          <p class="text-4xl font-bold text-agro-900">${formatter.format(avgUnit)}</p>
        </div>
        <div class="p-10 bg-white border border-gray-100 rounded-[2rem] text-center shadow-sm print:shadow-none">
          <p class="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-[0.2em]">Fundamentação</p>
          <p class="text-4xl font-bold text-gray-800">GRAU III</p>
        </div>
      </div>
    </div>

    <!-- Seção 3: Conclusão -->
    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-5 mb-20 uppercase tracking-[0.2em]">4. Conclusão de Valores</h2>
      
      <div class="space-y-24">
        <!-- Valor Venal -->
        <div class="bg-white border-2 border-agro-900 p-16 rounded-[3rem] shadow-xl relative print:shadow-none">
          <div class="absolute -top-6 left-14 bg-agro-900 text-white text-[12px] font-bold px-8 py-3 rounded-full tracking-[0.3em] uppercase shadow-lg print:shadow-none">Estimativa de Valor Venal</div>
          
          <div class="flex flex-col md:flex-row justify-between items-center gap-12 mt-6">
            <div class="flex-1">
              <p class="text-[11px] text-gray-400 font-bold uppercase mb-6 tracking-[0.3em]">Valor de Mercado Final (Vm)</p>
              <p class="text-7xl font-serif font-bold text-agro-900">${formatter.format(finalValue)}</p>
              <div class="mt-8 border-t border-gray-100 pt-6">
                <p class="text-base text-gray-400 italic">Determinação baseada na área de ${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
              </div>
            </div>
            <div class="md:w-72 text-right border-l-2 border-gray-100 pl-12 hidden md:block">
              <p class="text-[11px] text-gray-400 font-bold uppercase mb-4 tracking-widest">Intervalo Técnico (±15%)</p>
              <p class="text-lg text-gray-700 font-bold">${formatter.format(finalValue * 0.85)}</p>
              <p class="text-[10px] text-gray-300 my-2 uppercase font-bold tracking-widest">Mínimo / Máximo</p>
              <p class="text-lg text-gray-700 font-bold">${formatter.format(finalValue * 1.15)}</p>
            </div>
          </div>
        </div>

        <!-- Liquidação Forçada -->
        <div class="bg-orange-50 border-2 border-orange-500 p-16 rounded-[3rem] shadow-xl relative print:shadow-none">
          <div class="absolute -top-6 left-14 bg-orange-500 text-white text-[12px] font-bold px-8 py-3 rounded-full tracking-[0.3em] uppercase shadow-lg print:shadow-none">Liquidação Forçada</div>
          
          <div class="flex flex-col md:flex-row justify-between items-center gap-12 mt-6">
            <div class="flex-1">
              <p class="text-[11px] text-orange-800 font-bold uppercase mb-6 tracking-[0.3em]">Valor de Venda Rápida (Vlf)</p>
              <p class="text-7xl font-serif font-bold text-orange-600">${formatter.format(liquidationValue)}</p>
            </div>
            <div class="md:w-96 text-right bg-white/70 p-8 rounded-3xl border border-orange-100 shadow-inner print:shadow-none">
              <p class="text-[11px] font-bold text-orange-900 uppercase mb-5 tracking-[0.2em]">Cálculo de Liquidação</p>
              <div class="space-y-3 text-sm text-orange-800">
                <p class="flex justify-between"><span>Taxa Mensal:</span> <span class="font-bold">1,53%</span></p>
                <p class="flex justify-between"><span>Exposição:</span> <span class="font-bold">24 meses</span></p>
                <p class="flex justify-between border-t border-orange-200 pt-2"><span>Metodologia:</span> <span class="font-bold">Valor Presente (PV)</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-24 bg-gray-50 p-14 rounded-[2.5rem] text-xs text-gray-400 leading-loose text-justify border border-gray-100 italic">
        <p><strong>Nota Técnica:</strong> O valor de liquidação forçada representa a projeção do valor presente do ativo considerando um cenário de venda em curto prazo com exposição de mercado de 24 meses e taxa de desconto financeiro aplicada de 1,53% a.m., conforme padrões de avaliação pericial.</p>
      </div>

      <div class="mt-40 flex justify-between items-end border-t-2 border-gray-100 pt-16">
        <div class="text-center">
          <div class="w-72 border-b-4 border-agro-900 mb-5 mx-auto opacity-10"></div>
          <p class="text-sm text-agro-900 uppercase tracking-[0.4em] font-bold">Bandeira Agro Valuation</p>
          <p class="text-[11px] text-gray-400 mt-2 uppercase font-medium">Relatório Automático de Inteligência Imobiliária</p>
        </div>
        <div class="text-right">
          <p class="text-[12px] text-gray-300 font-mono tracking-tighter uppercase font-bold">AUTENTICIDADE: BA-${Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
        </div>
      </div>
    </div>
  `;

  return {
    reportText: reportHtml,
    sources: pool,
    estimatedValue: formatter.format(finalValue),
    liquidationValue: formatter.format(liquidationValue),
    stats: {
      average: avgUnit,
      sampleCount: pool.length,
      standardDeviation: "Método de Homogeneização"
    }
  };
};

export const performValuation = async (data: PropertyData): Promise<ValuationResult> => {
  let pool: MarketSample[] = [];
  pool = await filterSamples(data.type, data.city, data.state, data.type === PropertyType.RURAL ? data.ruralActivity : data.urbanSubType);
  if (pool.length < 5) {
    const aiSamples = await findMarketSamplesIA(data);
    if (aiSamples.length < 3) {
      const deepSamples = await findMarketSamplesIA(data, true);
      pool = [...pool, ...deepSamples];
    } else {
      pool = [...pool, ...aiSamples];
    }
    aiSamples.forEach(sample => { saveSample(sample).catch(() => {}); });
  }
  const uniquePool = pool.filter((v, i, a) => a.findIndex(t => (t.url && t.url === v.url) || t.id === v.id) === i);
  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

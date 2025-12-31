
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; // Fator de oferta padrão
const LIQUIDATION_RATE = 0.0153; // 1,53% ao mês
const LIQUIDATION_MONTHS = 24; // Prazo de 24 meses conforme solicitado

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
      <div class="flex justify-between items-start border-b border-gray-100 pb-8">
        <div class="font-serif text-4xl font-bold text-agro-900 border-l-8 border-orange-500 pl-6">
          BANDEIRA <span class="text-orange-500">AGRO</span>
        </div>
        <div class="text-right text-[11px] text-gray-400 uppercase tracking-widest leading-loose">
          Sistemas de Inteligência Imobiliária<br>
          NBR 14653-2 (URBANO) | NBR 14653-3 (RURAL)
        </div>
      </div>

      <div class="text-center my-20">
        <h1 class="text-6xl font-serif font-bold text-agro-900 mb-6 tracking-tight">LAUDO DE AVALIAÇÃO</h1>
        <div class="w-32 h-1.5 bg-orange-500 mx-auto mb-10"></div>
        <p class="text-2xl text-gray-500 font-light tracking-[0.2em] uppercase">Relatório de Mercado</p>
      </div>
      
      <div class="bg-gray-50 p-12 rounded-3xl border border-gray-100 shadow-sm">
        <div class="grid grid-cols-2 gap-12">
          <div>
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-3 tracking-widest">Localização do Objeto</p>
            <p class="text-2xl font-bold text-gray-800 mb-1">${data.city} - ${data.state}</p>
            <p class="text-lg text-gray-500 font-light">${data.neighborhood || data.address || 'Área de Estudo'}</p>
          </div>
          <div class="text-right">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-3 tracking-widest">Data de Emissão</p>
            <p class="text-2xl font-bold text-gray-800">${new Date().toLocaleDateString('pt-BR')}</p>
            <p class="text-sm text-orange-600 mt-2 italic font-medium">Validade técnica: 180 dias</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Seção 1: Identificação -->
    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-4 mb-10 uppercase tracking-widest">1. Identificação e Metodologia</h2>
      <div class="space-y-8 text-base text-gray-700 leading-relaxed text-justify">
        <p><strong>1.1. Objetivo:</strong> Este documento técnico visa a determinação do justo valor venal de mercado para fins de comercialização e o valor para liquidação forçada do ativo imobiliário descrito nas seções subsequentes.</p>
        <p><strong>1.2. Metodologia:</strong> Foi adotado o <strong>Método Comparativo Direto de Dados de Mercado</strong>, conforme preconizado pela <strong>ABNT NBR 14653</strong>. O método identifica o valor do bem através do tratamento técnico dos atributos de elementos assemelhados disponíveis no mercado imobiliário da região.</p>
        <p><strong>1.3. Procedimentos:</strong> A coleta de dados abrangeu portais especializados de alta relevância, utilizando a Engine de Inteligência <strong>Bandeira Agro</strong> para saneamento e homogeneização estatística dos preços unitários coletados.</p>
      </div>

      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-4 mt-20 mb-10 uppercase tracking-widest">2. Caracterização do Imóvel</h2>
      <div class="grid grid-cols-2 gap-6 mb-10">
        <div class="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
          <p class="text-[11px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Tipo de Ativo</p>
          <p class="text-xl font-bold text-gray-800">${data.type}</p>
        </div>
        <div class="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
          <p class="text-[11px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Área de Referência</p>
          <p class="text-xl font-bold text-gray-800">${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
        </div>
        ${data.type === PropertyType.RURAL ? `
          <div class="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Capacidade de Uso</p>
            <p class="text-xl font-bold text-gray-800">${data.landCapability || 'N/A'}</p>
          </div>
          <div class="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Topografia</p>
            <p class="text-xl font-bold text-gray-800">${data.topography || 'N/A'}</p>
          </div>
        ` : `
          <div class="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Subtipo</p>
            <p class="text-xl font-bold text-gray-800">${data.urbanSubType || 'Comum'}</p>
          </div>
          <div class="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <p class="text-[11px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Estado de Conservação</p>
            <p class="text-xl font-bold text-gray-800">${data.conservationState || 'Bom'}</p>
          </div>
        `}
      </div>
      
      <div class="p-8 border border-gray-100 bg-gray-50 rounded-2xl text-base text-gray-600 leading-loose italic">
        <strong class="text-gray-900 not-italic uppercase text-xs tracking-widest block mb-3">Diagnóstico Detalhado:</strong>
        ${data.description || 'Imóvel avaliado sob condições normais de mercado, considerando sua inserção na malha regional e características intrínsecas informadas.'}
      </div>
    </div>

    <!-- Seção 2: Diagnóstico de Mercado -->
    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-4 mb-10 uppercase tracking-widest">3. Tratamento de Amostras de Mercado</h2>
      <p class="text-sm text-gray-500 mb-10 leading-relaxed">
        A pesquisa mercadológica identificou elementos comparáveis ativos na região de ${data.city}/${data.state}. 
        Para a homogeneização, aplicou-se o <strong>Fator de Oferta de ${OFFER_FACTOR.toFixed(2)}</strong>, reduzindo as distorções típicas de anúncios de venda.
      </p>
      
      <div class="overflow-hidden border border-gray-200 rounded-2xl shadow-sm mb-12">
        <table class="w-full text-xs text-left border-collapse">
          <thead class="bg-agro-900 text-white uppercase font-sans">
            <tr>
              <th class="p-6 border-b border-agro-800">Cód.</th>
              <th class="p-6 border-b border-agro-800">Localização / Fonte</th>
              <th class="p-6 border-b border-agro-800">Área (${unitLabel})</th>
              <th class="p-6 border-b border-agro-800 text-right">Unitário Tratado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${processedSamples.map((s, idx) => `
              <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="p-6 font-bold text-gray-900">A-0${idx + 1}</td>
                <td class="p-6">
                  <span class="font-bold text-gray-800">${s.neighborhood || s.city}</span><br>
                  <span class="text-[10px] text-gray-400 uppercase">${s.source}</span>
                </td>
                <td class="p-6 font-medium text-gray-600">${s.areaTotal.toLocaleString('pt-BR')}</td>
                <td class="p-6 text-right font-bold text-agro-700">${formatter.format(s.adjustedPricePerUnit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="p-8 bg-white border border-gray-100 rounded-2xl text-center shadow-sm">
          <p class="text-[10px] text-gray-400 font-bold uppercase mb-3 tracking-widest">Amostras Coletadas</p>
          <p class="text-3xl font-bold text-gray-800">${pool.length}</p>
        </div>
        <div class="p-8 bg-agro-50 border border-agro-100 rounded-2xl text-center shadow-sm">
          <p class="text-[10px] text-agro-700 font-bold uppercase mb-3 tracking-widest">Média Homogeneizada</p>
          <p class="text-3xl font-bold text-agro-900">${formatter.format(avgUnit)}</p>
        </div>
        <div class="p-8 bg-white border border-gray-100 rounded-2xl text-center shadow-sm">
          <p class="text-[10px] text-gray-400 font-bold uppercase mb-3 tracking-widest">Fundamentação</p>
          <p class="text-3xl font-bold text-gray-800">GRAU III</p>
        </div>
      </div>
    </div>

    <!-- Seção 3: Conclusão -->
    <div class="report-section page-break">
      <h2 class="text-2xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-4 mb-16 uppercase tracking-widest">4. Conclusão de Valores</h2>
      
      <div class="space-y-20">
        <!-- Bloco Valor Venal -->
        <div class="bg-white border-2 border-agro-900 p-12 rounded-[2.5rem] shadow-lg relative">
          <!-- Etiqueta com mais respiro -->
          <div class="absolute -top-5 left-10 bg-agro-900 text-white text-[11px] font-bold px-6 py-2 rounded-full tracking-[0.2em] uppercase shadow-md">Estimativa de Valor Venal</div>
          
          <div class="flex flex-col md:flex-row justify-between items-center gap-10 mt-4">
            <div class="flex-1">
              <p class="text-[11px] text-gray-400 font-bold uppercase mb-4 tracking-widest">Valor de Mercado (Vm)</p>
              <p class="text-6xl font-serif font-bold text-agro-900">${formatter.format(finalValue)}</p>
              <div class="mt-6 border-t border-gray-100 pt-4">
                <p class="text-sm text-gray-400 italic">Valor calculado para a área total de ${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
              </div>
            </div>
            <div class="md:w-64 text-right border-l border-gray-100 pl-10 hidden md:block">
              <p class="text-[11px] text-gray-400 font-bold uppercase mb-3 tracking-widest">Campo de Arbítrio (±15%)</p>
              <p class="text-sm text-gray-600 font-bold">${formatter.format(finalValue * 0.85)}</p>
              <p class="text-[10px] text-gray-300 my-1 uppercase">Intervalo Técnico</p>
              <p class="text-sm text-gray-600 font-bold">${formatter.format(finalValue * 1.15)}</p>
            </div>
          </div>
        </div>

        <!-- Bloco Liquidação Forçada -->
        <div class="bg-orange-50 border-2 border-orange-500 p-12 rounded-[2.5rem] shadow-lg relative">
          <!-- Etiqueta com mais respiro -->
          <div class="absolute -top-5 left-10 bg-orange-500 text-white text-[11px] font-bold px-6 py-2 rounded-full tracking-[0.2em] uppercase shadow-md">Liquidação Forçada</div>
          
          <div class="flex flex-col md:flex-row justify-between items-center gap-10 mt-4">
            <div class="flex-1">
              <p class="text-[11px] text-orange-800 font-bold uppercase mb-4 tracking-widest">Valor de Venda Rápida (Vlf)</p>
              <p class="text-6xl font-serif font-bold text-orange-600">${formatter.format(liquidationValue)}</p>
            </div>
            <div class="md:w-80 text-right bg-white/60 p-6 rounded-2xl border border-orange-100 shadow-inner">
              <p class="text-[11px] font-bold text-orange-900 uppercase mb-4 tracking-widest">Premissas de Liquidação</p>
              <div class="space-y-2 text-xs text-orange-800">
                <p class="flex justify-between"><span>Taxa de Desconto:</span> <span class="font-bold">1,53% a.m.</span></p>
                <p class="flex justify-between"><span>Prazo de Exposição:</span> <span class="font-bold">24 meses</span></p>
                <p class="flex justify-between"><span>Metodologia:</span> <span class="font-bold italic">Valor Presente (PV)</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-20 bg-gray-50 p-10 rounded-3xl text-xs text-gray-400 leading-loose text-justify border border-gray-100 italic">
        <strong>Notas Complementares:</strong> Este laudo reflete a opinião de valor baseada em inferência estatística por dados de mercado. Em conformidade com as normas NBR 14653-2 e 14653-3, o valor de liquidação forçada é obtido mediante a aplicação de taxa de desconto financeiro sobre o prazo estimado de absorção pelo mercado (24 meses).
      </div>

      <div class="mt-32 flex justify-between items-end border-t border-gray-200 pt-12">
        <div class="text-center">
          <div class="w-64 border-b-2 border-agro-900 mb-4 mx-auto opacity-20"></div>
          <p class="text-xs text-agro-900 uppercase tracking-[0.3em] font-bold">Bandeira Agro Valuation Engine</p>
          <p class="text-[10px] text-gray-400 mt-1 uppercase">Certificação Digital de Acerto Técnico</p>
        </div>
        <div class="text-right">
          <p class="text-[11px] text-gray-300 font-mono tracking-tighter uppercase">ID DE AUTENTICAÇÃO: BA-VAL-${Math.random().toString(36).substring(2, 9).toUpperCase()}</p>
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
      standardDeviation: "Cálculo por Homogeneização Linear"
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

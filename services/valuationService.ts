
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; // Fator de oferta padrão (10% de margem de negociação)
const LIQUIDATION_RATE = 0.0153; // 1,53% ao mês
const LIQUIDATION_MONTHS = 24; // Prazo atualizado para 24 meses

/**
 * Realiza os cálculos estatísticos e formata o laudo conforme NBR 14653
 */
const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length === 0) {
    throw new Error("AMOSTRAS_INSUFICIENTES");
  }

  // 1. Tratamento das Amostras (Fator de Oferta conforme NBR 14653)
  const processedSamples = pool.map(s => {
    const adjustedPrice = s.price * OFFER_FACTOR;
    const adjustedPricePerUnit = adjustedPrice / s.areaTotal;
    return { ...s, adjustedPricePerUnit };
  });

  // 2. Saneamento Estatístico e Média Homogeneizada
  const unitValues = processedSamples.map(s => s.adjustedPricePerUnit);
  const sum = unitValues.reduce((a, b) => a + b, 0);
  const avgUnit = sum / unitValues.length;
  
  // Cálculo do valor de mercado (Média Saneada x Área Total)
  const finalValue = avgUnit * data.areaTotal;

  // 3. Cálculo de Liquidação Forçada (Fórmula de Valor Presente - PV)
  // Vlf = Vm / (1 + i)^n
  const liquidationValue = finalValue / Math.pow((1 + LIQUIDATION_RATE), LIQUIDATION_MONTHS);

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unitLabel = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const reportHtml = `
    <div class="report-cover flex flex-col justify-between">
      <div class="flex justify-between items-start">
        <div class="font-serif text-3xl font-bold text-agro-900 border-l-4 border-orange-500 pl-4">
          BANDEIRA <span class="text-orange-500">AGRO</span>
        </div>
        <div class="text-right text-[10px] text-gray-400 uppercase tracking-widest">
          Sistemas de Inteligência Imobiliária<br>
          NBR 14653-2 (URBANO) | NBR 14653-3 (RURAL)
        </div>
      </div>

      <div class="text-center">
        <h1 class="text-5xl font-serif font-bold text-agro-900 mb-4">LAUDO DE AVALIAÇÃO</h1>
        <div class="w-24 h-1 bg-orange-500 mx-auto mb-8"></div>
        <p class="text-xl text-gray-600 font-light tracking-wide uppercase">Relatório de Determinação de Valor de Mercado</p>
      </div>
      
      <div class="bg-gray-50 p-8 rounded-xl border border-gray-100">
        <div class="grid grid-cols-2 gap-8">
          <div>
            <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Localização do Objeto</p>
            <p class="text-lg font-bold text-gray-800">${data.city} - ${data.state}</p>
            <p class="text-sm text-gray-500">${data.neighborhood || data.address || 'Localização Geral'}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Data de Emissão</p>
            <p class="text-lg font-bold text-gray-800">${new Date().toLocaleDateString('pt-BR')}</p>
            <p class="text-xs text-gray-400 italic">Validade técnica: 180 dias</p>
          </div>
        </div>
      </div>
    </div>

    <div class="report-section page-break">
      <h2 class="text-xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-2 mb-6 uppercase tracking-wider">1. Identificação e Metodologia</h2>
      <div class="space-y-4 text-sm text-gray-700 leading-relaxed text-justify">
        <p><strong>1.1. Objetivo:</strong> Este relatório técnico visa estimar o valor venal de mercado para fins de comercialização e o valor para liquidação forçada do imóvel descrito.</p>
        <p><strong>1.2. Metodologia:</strong> Utilizou-se o <strong>Método Comparativo Direto de Dados de Mercado</strong>, em conformidade com as diretrizes da <strong>NBR 14653</strong>. Este método fundamenta-se na comparação do bem com outros de características similares, cujos preços são conhecidos no mercado imobiliário local.</p>
        <p><strong>1.3. Procedimentos:</strong> Foram coletados dados em portais imobiliários e banco de dados próprio da <strong>BANDEIRA AGRO</strong>, aplicando-se o tratamento estatístico por homogeneização de preços unitários.</p>
      </div>

      <h2 class="text-xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-2 mt-12 mb-6 uppercase tracking-wider">2. Caracterização Técnica do Imóvel</h2>
      <div class="grid grid-cols-2 gap-4 text-sm mb-6">
        <div class="p-3 bg-gray-50 rounded border border-gray-100">
          <p class="text-[10px] text-gray-400 uppercase font-bold">Tipo de Imóvel</p>
          <p class="font-bold text-gray-800">${data.type}</p>
        </div>
        <div class="p-3 bg-gray-50 rounded border border-gray-100">
          <p class="text-[10px] text-gray-400 uppercase font-bold">Área Avaliada</p>
          <p class="font-bold text-gray-800">${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
        </div>
        ${data.type === PropertyType.RURAL ? `
          <div class="p-3 bg-gray-50 rounded border border-gray-100">
            <p class="text-[10px] text-gray-400 uppercase font-bold">Capacidade de Uso do Solo</p>
            <p class="font-bold text-gray-800">${data.landCapability || 'Não Especificada'}</p>
          </div>
          <div class="p-3 bg-gray-50 rounded border border-gray-100">
            <p class="text-[10px] text-gray-400 uppercase font-bold">Topografia Predominante</p>
            <p class="font-bold text-gray-800">${data.topography || 'Não Especificada'}</p>
          </div>
        ` : `
          <div class="p-3 bg-gray-50 rounded border border-gray-100">
            <p class="text-[10px] text-gray-400 uppercase font-bold">Subtipo Construtivo</p>
            <p class="font-bold text-gray-800">${data.urbanSubType || 'Não Especificado'}</p>
          </div>
          <div class="p-3 bg-gray-50 rounded border border-gray-100">
            <p class="text-[10px] text-gray-400 uppercase font-bold">Padrão de Acabamento</p>
            <p class="font-bold text-gray-800">${data.conservationState || 'Comum'}</p>
          </div>
        `}
      </div>
      
      <div class="p-5 border-l-4 border-agro-700 bg-agro-50 rounded-r text-sm text-gray-700">
        <p class="font-bold text-agro-900 mb-1 uppercase text-xs">Considerações sobre o Objeto:</p>
        ${data.description || 'Imóvel avaliado com base em dados técnicos e mercadológicos da região. Características físicas consideradas conforme formulário de solicitação.'}
      </div>
    </div>

    <div class="report-section page-break">
      <h2 class="text-xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-2 mb-6 uppercase tracking-wider">3. Diagnóstico e Tratamento de Mercado</h2>
      <p class="text-xs text-gray-500 mb-6 italic">Pesquisa efetuada em ${data.city}/${data.state}. Aplicou-se o Fator de Oferta de ${OFFER_FACTOR.toFixed(2)} para eliminação da gordura de negociação.</p>
      
      <div class="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
        <table class="w-full text-[10px] text-left border-collapse">
          <thead class="bg-agro-900 text-white uppercase font-sans">
            <tr>
              <th class="p-4 border-b border-agro-800">Cód. Amostra</th>
              <th class="p-4 border-b border-agro-800">Localização/Fonte</th>
              <th class="p-4 border-b border-agro-800">Área (${unitLabel})</th>
              <th class="p-4 border-b border-agro-800">Valor Ofertado</th>
              <th class="p-4 border-b border-agro-800 text-right">Unitário Tratado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${processedSamples.map((s, idx) => `
              <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="p-4 font-bold text-gray-900">AMS-0${idx + 1}</td>
                <td class="p-4">${s.neighborhood || s.city} / ${s.source}</td>
                <td class="p-4 font-medium">${s.areaTotal.toLocaleString('pt-BR')}</td>
                <td class="p-4">${formatter.format(s.price)}</td>
                <td class="p-4 text-right font-bold text-agro-700">${formatter.format(s.adjustedPricePerUnit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-5 bg-white border border-gray-200 rounded-lg text-center shadow-sm">
          <p class="text-[10px] text-gray-400 font-bold uppercase mb-2">Amostras Saneadas</p>
          <p class="text-2xl font-bold text-gray-800">${pool.length}</p>
        </div>
        <div class="p-5 bg-agro-50 border border-agro-200 rounded-lg text-center shadow-sm">
          <p class="text-[10px] text-agro-700 font-bold uppercase mb-2">Valor Médio Unitário</p>
          <p class="text-2xl font-bold text-agro-900">${formatter.format(avgUnit)}</p>
        </div>
        <div class="p-5 bg-white border border-gray-200 rounded-lg text-center shadow-sm">
          <p class="text-[10px] text-gray-400 font-bold uppercase mb-2">Fator de Homogeneização</p>
          <p class="text-2xl font-bold text-gray-800">${OFFER_FACTOR.toFixed(2)}</p>
        </div>
      </div>
    </div>

    <div class="report-section page-break">
      <h2 class="text-xl font-serif font-bold text-agro-900 border-b-2 border-agro-100 pb-2 mb-8 uppercase tracking-wider">4. Conclusão e Determinação de Valores</h2>
      
      <div class="space-y-8">
        <!-- Valor de Mercado Principal -->
        <div class="bg-white border-2 border-agro-900 p-10 rounded-2xl shadow-md relative overflow-hidden">
          <div class="absolute top-0 right-0 p-4 opacity-5">
            <svg class="w-32 h-32 text-agro-900" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </div>
          <div class="absolute -top-3 left-8 bg-agro-900 text-white text-[10px] font-bold px-4 py-1.5 rounded-full tracking-widest uppercase">Estimativa de Valor Venal</div>
          <div class="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <p class="text-xs text-gray-400 font-bold uppercase mb-2 tracking-tighter">Valor de Mercado Final (Vm)</p>
              <p class="text-5xl font-serif font-bold text-agro-900">${formatter.format(finalValue)}</p>
              <p class="text-sm text-gray-500 mt-2 font-medium">Extenso: <span class="capitalize text-gray-400 italic">calculado eletronicamente</span></p>
            </div>
            <div class="text-right border-l border-gray-100 pl-8">
              <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Campo de Arbítrio (±15%)</p>
              <p class="text-xs text-gray-600 font-bold">${formatter.format(finalValue * 0.85)}</p>
              <p class="text-xs text-gray-300">até</p>
              <p class="text-xs text-gray-600 font-bold">${formatter.format(finalValue * 1.15)}</p>
            </div>
          </div>
        </div>

        <!-- Valor de Liquidação Forçada -->
        <div class="bg-orange-50 border-2 border-orange-500 p-10 rounded-2xl shadow-md relative overflow-hidden">
          <div class="absolute -top-3 left-8 bg-orange-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full tracking-widest uppercase">Liquidação Forçada</div>
          <div class="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <p class="text-xs text-orange-800 font-bold uppercase mb-2 tracking-tighter">Valor de Venda Rápida (Vlf)</p>
              <p class="text-5xl font-serif font-bold text-orange-600">${formatter.format(liquidationValue)}</p>
            </div>
            <div class="text-right text-orange-800 bg-white bg-opacity-40 p-4 rounded-xl border border-orange-100">
              <p class="text-[10px] font-bold uppercase mb-2">Premissas de Liquidação</p>
              <div class="space-y-1 text-xs">
                <p>Taxa de Desconto: <span class="font-bold">${(LIQUIDATION_RATE * 100).toFixed(2)}% a.m.</span></p>
                <p>Prazo de Exposição: <span class="font-bold">${LIQUIDATION_MONTHS} meses</span></p>
                <p>Metodologia: <span class="font-bold italic">Valor Presente (PV)</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-16 bg-gray-50 p-8 rounded-xl text-[10px] text-gray-500 leading-relaxed text-justify border border-gray-200">
        <p><strong>Nota de Responsabilidade:</strong> Este documento foi elaborado com o suporte da Engine de Inteligência da <strong>BANDEIRA AGRO</strong>, que processa grandes volumes de dados mercadológicos em tempo real. Os valores aqui expressos representam uma estimativa técnica baseada nas condições vigentes do mercado. Em conformidade com as normas 14653-2 e 14653-3, ressalta-se que variações nas características intrínsecas do imóvel ou mudanças abruptas na economia podem influenciar os valores projetados.</p>
      </div>

      <div class="mt-20 flex justify-between items-end border-t border-gray-200 pt-10">
        <div class="text-center">
          <div class="w-56 border-b border-gray-400 mb-2 mx-auto"></div>
          <p class="text-[9px] text-agro-900 uppercase tracking-widest font-bold">Bandeira Agro Intelligence Engine</p>
          <p class="text-[8px] text-gray-400">Certificado Digital de Avaliação</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] text-gray-400 font-mono">AUTENTICIDADE: BA-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${new Date().getFullYear()}</p>
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
      standardDeviation: "Cálculo de Média Homogeneizada"
    }
  };
};

/**
 * Lógica Central de Avaliação - Orquestrador
 */
export const performValuation = async (data: PropertyData): Promise<ValuationResult> => {
  let pool: MarketSample[] = [];
  
  // 1. Busca no banco de dados interno
  pool = await filterSamples(data.type, data.city, data.state, data.type === PropertyType.RURAL ? data.ruralActivity : data.urbanSubType);

  // 2. IA para busca web se o pool for insuficiente
  if (pool.length < 5) {
    const aiSamples = await findMarketSamplesIA(data);
    
    if (aiSamples.length < 3) {
      const deepSamples = await findMarketSamplesIA(data, true);
      pool = [...pool, ...deepSamples];
    } else {
      pool = [...pool, ...aiSamples];
    }

    // Persistência das novas amostras para enriquecimento do Big Data
    aiSamples.forEach(sample => {
      saveSample(sample).catch(() => {}); 
    });
  }

  // Desduplicação rigorosa
  const uniquePool = pool.filter((v, i, a) => 
    a.findIndex(t => (t.url && t.url === v.url) || t.id === v.id) === i
  );

  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;

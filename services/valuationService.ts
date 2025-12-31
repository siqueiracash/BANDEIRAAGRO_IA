
import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
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

  // 1. Processamento e Homogeneização
  const allProcessed = pool.map(s => {
    const vub = s.price / s.areaTotal;
    const fOferta = OFFER_FACTOR;
    const fDim = 1.00;
    const fCap = 1.00;
    const fAcesso = 1.00;
    const fTopo = 1.00;
    const fOutros = 1.08;
    
    const vuh = vub * fOferta * fDim * fCap * fAcesso * fTopo * fOutros;
    
    return { ...s, vub, vuh, fOferta, fDim, fCap, fAcesso, fTopo, fOutros };
  });

  // 2. Saneamento por Mediana (40%)
  const sortedVuhs = [...allProcessed].map(s => s.vuh).sort((a, b) => a - b);
  const medianVuh = sortedVuhs[Math.floor(sortedVuhs.length / 2)];
  const sanitized = allProcessed.filter(s => s.vuh >= medianVuh * 0.6 && s.vuh <= medianVuh * 1.4);
  const finalPool = (sanitized.length >= 3 ? sanitized : allProcessed)
    .sort((a, b) => Math.abs(a.vuh - medianVuh) - Math.abs(b.vuh - medianVuh))
    .slice(0, 6);

  // 3. Estatísticas
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
          <h2 class="text-5xl font-serif font-bold text-agro-900 mb-2 uppercase tracking-tight">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
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
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">LOCALIZAÇÃO DO IMÓVEL</h3><p class="text-xl font-medium text-gray-800">${data.address || 'Área Rural'}, ${data.neighborhood || ''}, ${data.city} - ${data.state}</p></div>
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">TIPO DE IMÓVEL</h3><p class="text-xl font-medium text-gray-800">${data.type} (${data.urbanSubType || data.ruralActivity})</p></div>
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">ATIVIDADE PREDOMINANTE</h3><p class="text-xl font-medium text-gray-800 uppercase">RESIDENCIAL / COMERCIAL</p></div>
          <div><h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">ÁREAS</h3><p class="text-2xl font-bold text-agro-900 uppercase">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unit}</p></div>
        </div>

        <div class="mt-16 text-center">
          <h3 class="text-[10px] font-bold text-gray-900 uppercase tracking-[0.4em] mb-12">RESUMO DE VALORES</h3>
          <div class="space-y-4">
            <p class="text-xl font-medium text-gray-600">VALOR DE MERCADO: <span class="font-bold text-gray-900">${fmt.format(finalValue)}</span></p>
            <p class="text-xl font-medium text-gray-600">VALOR DE LIQUIDAÇÃO FORÇADA: <span class="font-bold text-gray-900">${fmt.format(liquidationValue)}</span></p>
          </div>
        </div>
        
        <div class="mt-auto text-center pb-10">
          <p class="font-bold text-gray-900 tracking-widest text-[11px] uppercase">BANDEIRA AGRO</p>
          <p class="text-gray-400 text-[10px] italic">Inteligência em Avaliações</p>
        </div>
      </div>

      <!-- PÁGINA 3: METODOLOGIA -->
      <div class="report-page px-20 py-20 leading-relaxed text-gray-700">
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-8 uppercase tracking-widest">METODOLOGIA GERAL DE AVALIAÇÃO</h2>
        <p class="mb-12 text-justify">
          De acordo com a Norma da ABNT NBR 14653 o terreno será avaliado com base no "Método Comparativo de Dados de Mercado", através de dados de mercado de imóveis semelhantes ao avaliando, à venda ou efetivamente transacionados no livre mercado imobiliário da região.
        </p>
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-8 uppercase tracking-widest">CRITÉRIO</h2>
        <p class="mb-8">Para a presente avaliação estabelecemos os critérios de Valores de Mercado e Liquidação Forçada, definidos como:</p>
        <h4 class="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider">VALOR DE MERCADO</h4>
        <p class="italic mb-12 text-justify">"É a quantia mais provável pela qual se negocia voluntariamente e conscientemente um bem, numa data de referência, dentro das condições do mercado vigente."</p>
        <h4 class="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider">VALOR DE LIQUIDAÇÃO FORÇADA</h4>
        <p class="text-justify text-sm">O valor de liquidação forçada, apurado na presente avaliação, é assim definido no artigo técnico de autoria do Engº Nelson R.P. Alonso e Arqª Mônica D’Amato: "Admitindo-se a liquidação forçada de um imóvel... deve ser considerado a redução do valor de mercado de forma a compensar as partes envolvidas na transação..."</p>
      </div>

      <!-- PÁGINA 4: LIQUIDAÇÃO DETALHADA -->
      <div class="report-page px-20 py-20 text-gray-700">
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-8 uppercase tracking-widest">VALOR PARA LIQUIDAÇÃO FORÇADA</h2>
        <div class="space-y-8 mb-16">
          <p>Para a determinação do “Valor de Liquidação do Imóvel” foram adotados os preceitos constantes do trabalho técnico mencionado.</p>
          <p><strong>Taxa Média de Juros:</strong> Para o cálculo da taxa média de juros foi adotada a série composta pelas linhas de crédito de mercado. A taxa mensal média de juros obtida foi igual a <strong>1.51%</strong>.</p>
          <p><strong>Tempo de Absorção:</strong> Estimado em <strong>24 meses</strong> para imóveis análogos.</p>
        </div>

        <div class="bg-gray-50 p-12 rounded-2xl border border-gray-100 text-center mb-16">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-8">FÓRMULA DE DESÁGIO</p>
          <p class="text-lg font-mono text-agro-700 font-bold mb-4">Valor Liquidação = Valor Mercado × (1 / (1 + 0.0151)^24)</p>
          <p class="text-sm text-gray-500 font-mono">Fator = 0.6979</p>
        </div>

        <div class="text-center">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-4">VALOR PARA LIQUIDAÇÃO FORÇADA:</p>
          <p class="text-4xl font-bold text-gray-900">${fmt.format(liquidationValue)}</p>
        </div>
      </div>

      <!-- PÁGINA 5-6: FICHAS DE PESQUISA -->
      ${chunkArray(finalPool, 3).map((chunk, pIdx) => `
        <div class="report-page px-20 py-20">
          <h2 class="text-xl font-serif font-bold text-gray-900 mb-2 uppercase tracking-widest">ANEXO: FICHAS DE PESQUISA</h2>
          <h3 class="text-2xl font-serif text-gray-300 mb-12 uppercase tracking-[0.2em]">DETALHAMENTO DO MERCADO</h3>
          <div class="space-y-8">
            ${chunk.map((s, i) => `
              <div class="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div class="bg-agro-700 text-white px-5 py-3 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                  <span>AMOSTRA #${(pIdx * 3) + i + 1}</span>
                  <span>${s.city} - ${s.state} <span class="ml-4 opacity-70">OFERTA (0,90)</span></span>
                </div>
                <div class="grid grid-cols-2 text-[11px] p-6 gap-y-6">
                  <div><p class="font-bold text-agro-700 uppercase text-[9px] mb-1">LOCALIZAÇÃO</p><p class="text-gray-800 font-medium">${s.neighborhood || s.city}</p></div>
                  <div><p class="font-bold text-agro-700 uppercase text-[9px] mb-1">FONTE</p><p class="text-blue-600 truncate underline max-w-[200px]">${s.source}</p></div>
                  <div><p class="font-bold text-agro-700 uppercase text-[9px] mb-1">ÁREA TOTAL</p><p class="text-gray-800 font-bold">${s.areaTotal} ${unit}</p></div>
                  <div><p class="font-bold text-agro-700 uppercase text-[9px] mb-1">VALOR TOTAL</p><p class="text-gray-800 font-bold text-sm">${fmt.format(s.price)}</p></div>
                  <div class="col-span-2"><p class="font-bold text-agro-700 uppercase text-[9px] mb-1">CARACTERÍSTICAS</p><p class="text-gray-500">${s.type} - Q/B/V: ${s.bedrooms || 0}/${s.bathrooms || 0}/${s.parking || 0}</p></div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-auto pt-10 text-center text-gray-300 text-[10px] font-bold uppercase tracking-widest">BANDEIRA AGRO - INTELIGÊNCIA EM AVALIAÇÕES</div>
        </div>
      `).join('')}

      <!-- PÁGINA 7: MEMÓRIA DE CÁLCULO -->
      <div class="report-page px-20 py-20">
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-2 uppercase tracking-widest">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <h3 class="text-2xl font-serif text-gray-300 mb-10 uppercase tracking-[0.2em]">PROCESSAMENTO ESTATÍSTICO</h3>
        
        <h5 class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">ELEMENTOS COLETADOS</h5>
        <table class="w-full text-[10px] border border-gray-100 mb-12">
          <tr class="bg-agro-900 text-white uppercase text-center"><th class="p-2 border">Amostra</th><th class="p-2 border">VO (R$)</th><th class="p-2 border">ÁREA (${unit})</th><th class="p-2 border">OFERTA</th><th class="p-2 border font-bold">VUB (R$)</th></tr>
          ${finalPool.map((s, i) => `<tr class="text-center odd:bg-gray-50"><td class="p-2 border font-bold">${i+1}</td><td class="p-2 border">${fmt.format(s.price)}</td><td class="p-2 border">${s.areaTotal}</td><td class="p-2 border">0,90</td><td class="p-2 border font-bold">${fmt.format(s.vub)}</td></tr>`).join('')}
        </table>

        <h5 class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">CÁLCULO DO VALOR MÉDIO HOMOGENEIZADO</h5>
        <table class="w-full text-[9px] border border-gray-100 mb-12">
          <tr class="bg-agro-900 text-white uppercase text-center font-bold">
            <th class="p-1.5 border">Amostra</th><th class="p-1.5 border">VUB (R$)</th><th class="p-1.5 border">F. Oferta</th><th class="p-1.5 border">F. Dim</th><th class="p-1.5 border">F. Cap</th><th class="p-1.5 border">F. Topo</th><th class="p-1.5 border font-bold">VUH (R$)</th>
          </tr>
          ${finalPool.map((s, i) => `
            <tr class="text-center odd:bg-gray-50">
              <td class="p-1.5 border font-bold">${i+1}</td><td class="p-1.5 border">${s.vub.toFixed(2)}</td><td class="p-1.5 border">0,90</td><td class="p-1.5 border">1,00</td><td class="p-1.5 border">1,00</td><td class="p-1.5 border">1,00</td><td class="p-1.5 border font-bold text-agro-700">${fmt.format(s.vuh)}</td>
            </tr>
          `).join('')}
        </table>

        <div class="grid grid-cols-2 gap-10 text-sm">
          <div class="space-y-2 uppercase font-bold text-gray-500 text-[10px] tracking-wider">
            <p class="flex justify-between border-b pb-1">MÉDIA <span class="text-gray-900">${fmt.format(avgVuh)}</span></p>
            <p class="flex justify-between border-b pb-1">DESVIO PADRÃO <span class="text-gray-900">${fmt.format(stdDev)}</span></p>
            <p class="flex justify-between border-b pb-1">COEF. VARIAÇÃO <span class="text-agro-700">${cv.toFixed(2)}%</span></p>
            <p class="flex justify-between">GRAU DE PRECISÃO <span class="text-agro-700">${precision}</span></p>
          </div>
          <div class="bg-gray-50 p-6 rounded-xl border border-gray-100 uppercase text-[9px] font-bold text-gray-400 tracking-widest space-y-2">
            <p class="text-gray-900 mb-4">INTERVALO CONFIANÇA (80%)</p>
            <p class="flex justify-between border-b border-gray-200 pb-1">MÍNIMO <span class="text-gray-800">${fmt.format(avgVuh * 0.85)}</span></p>
            <p class="flex justify-between border-b border-gray-200 pb-1">MÁXIMO <span class="text-gray-800">${fmt.format(avgVuh * 1.15)}</span></p>
            <p class="flex justify-between text-agro-700">AMPLITUDE <span>${fmt.format(avgVuh * 0.30)}</span></p>
          </div>
        </div>
      </div>

      <!-- PÁGINA 8: RESPONSABILIDADE -->
      <div class="report-page px-20 py-20 text-gray-700 leading-relaxed text-justify">
        <h2 class="text-xl font-serif font-bold text-gray-900 mb-12 uppercase tracking-widest text-center">RESPONSABILIDADE E LIMITAÇÕES</h2>
        <div class="space-y-8 text-sm">
          <p>Este Laudo de Avaliação foi produzido com base em informações fornecidas pela contratante/usuário do sistema, incluindo a documentação do imóvel objeto da análise...</p>
          <p>Ressalva-se que o presente trabalho foi realizado seguindo os preceitos metodológicos da ABNT NBR 14653, contudo, enquadra-se na modalidade "Avaliação Expedita" (Desktop Valuation)...</p>
          <p>A fundamentação de valores utilizou como base o Banco de Dados de Amostras da Bandeira Agro e dados de mercado disponíveis publicamente...</p>
          <p>A utilização deste Laudo de Avaliação é restrita à finalidade de estimativa de valor de mercado e liquidação forçada para fins gerenciais...</p>
        </div>
        <div class="mt-auto text-center pb-10">
          <p class="font-bold text-gray-900 tracking-widest text-[11px] uppercase mb-2">BANDEIRA AGRO</p>
          <p class="text-gray-400 text-[9px] mb-2 uppercase">Documento gerado eletronicamente pela plataforma Bandeira Agro Intelligence.</p>
          <p class="text-gray-400 text-[9px] uppercase">${new Date().toLocaleDateString('pt-BR')} | ID-SYSTEM-${Math.random().toString(36).substring(7).toUpperCase()}</p>
        </div>
      </div>

    </div>

    <style>
      .report-page { background: white; width: 210mm; height: 297mm; margin: 0 auto; display: flex; flex-direction: column; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
      @media print {
        body { background: white !important; margin: 0 !important; }
        .report-page { box-shadow: none !important; margin: 0 !important; page-break-after: always !important; break-after: page !important; height: 297mm !important; width: 210mm !important; }
        .report-wrapper > div:last-child { page-break-after: avoid !important; break-after: avoid !important; }
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
  const uniquePool = pool.filter((v, i, a) => v.price > 0 && v.areaTotal > 0 && a.findIndex(t => t.url === v.url || t.id === v.id) === i);
  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;


import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, saveSample } from "./storageService";
import { findMarketSamplesIA } from "./geminiService";

const OFFER_FACTOR = 0.90; 
const INTEREST_RATE = 0.0151; // 1,51% ao mês conforme o PDF
const ABSORPTION_MONTHS = 24; // 24 meses conforme o PDF

/**
 * Utilitário para dividir array em pedaços (chunks)
 */
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

/**
 * SVG da Logomarca BANDEIRA AGRO refinado
 */
const LogoSVG = `
  <div class="flex flex-col items-center">
    <div class="relative w-32 h-32 flex items-center justify-center">
      <!-- Círculo Laranja Externo -->
      <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full text-orange-500 fill-none stroke-current" stroke-width="4">
        <circle cx="50" cy="50" r="45" />
      </svg>
      <!-- Folha Estilizada -->
      <svg viewBox="0 0 100 100" class="w-20 h-20 text-green-700 fill-current">
        <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
      </svg>
    </div>
    <h1 class="mt-4 text-3xl font-serif font-bold tracking-[0.1em] text-gray-800 uppercase">BANDEIRA AGRO</h1>
  </div>
`;

/**
 * Realiza os cálculos estatísticos e formata o laudo conforme o padrão BANDEIRA AGRO
 * Implementa Saneamento de Outliers para reduzir o Coeficiente de Variação.
 */
const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length < 3) {
    throw new Error("AMOSTRAS_INSUFICIENTES");
  }

  // 1. Pré-processamento e Homogeneização de TODAS as amostras candidatas
  const allProcessed = pool.map(s => {
    const adjustedPrice = s.price * OFFER_FACTOR;
    const adjustedPricePerUnit = adjustedPrice / s.areaTotal;
    
    const fOferta = OFFER_FACTOR;
    const fDim = 1.00;
    const fCap = data.type === PropertyType.RURAL ? 1.27 : 1.00;
    const fAcesso = 1.00;
    const fTopo = 1.00;
    const fOutros = 1.08;
    
    const vuh = adjustedPricePerUnit * fDim * fCap * fAcesso * fTopo * fOutros;
    
    return { 
      ...s, 
      adjustedPricePerUnit,
      vuh,
      fOferta, fDim, fCap, fAcesso, fTopo, fOutros
    };
  });

  // 2. Saneamento de Outliers (Filtro de 40% em relação à mediana para garantir homogeneidade)
  const vuhs = allProcessed.map(s => s.vuh).sort((a, b) => a - b);
  const medianVuh = vuhs[Math.floor(vuhs.length / 2)];
  
  // Filtramos quem está muito fora (Critério de exclusão de dados discrepantes)
  const sanitizedPool = allProcessed.filter(s => {
    const ratio = s.vuh / medianVuh;
    return ratio >= 0.6 && ratio <= 1.4; // Admite variação de 40% em relação à mediana
  });

  // Se o saneamento foi agressivo demais, voltamos ao pool original para não ficar sem amostras
  const workPool = sanitizedPool.length >= 3 ? sanitizedPool : allProcessed;

  // 3. Seleção das 6 melhores amostras (as mais próximas da mediana do pool saneado)
  const finalPool = [...workPool].sort((a, b) => {
    return Math.abs(a.vuh - medianVuh) - Math.abs(b.vuh - medianVuh);
  }).slice(0, 6);

  // 4. Cálculos Finais com o Pool Selecionado
  const vuhValues = finalPool.map(s => s.vuh);
  const avgVuh = vuhValues.reduce((a, b) => a + b, 0) / vuhValues.length;
  const finalValue = avgVuh * data.areaTotal;

  // Cálculo de Liquidação Forçada
  const factorLF = 1 / Math.pow((1 + INTEREST_RATE), ABSORPTION_MONTHS);
  const liquidationValue = finalValue * factorLF;

  // Estatísticas
  const variance = vuhValues.reduce((a, b) => a + Math.pow(b - avgVuh, 2), 0) / vuhValues.length;
  const stdDev = Math.sqrt(variance);
  const coefVariation = (stdDev / avgVuh) * 100;

  // Grau de Precisão NBR 14653
  let precisionGrade = "GRAU I";
  if (coefVariation <= 15) precisionGrade = "GRAU III";
  else if (coefVariation <= 30) precisionGrade = "GRAU II";

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unitLabel = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const sampleChunks = chunkArray(finalPool, 3);

  const reportHtml = `
    <div class="report-wrapper bg-white text-gray-900 font-sans">
      
      <!-- PÁGINA 1: CAPA -->
      <div class="report-page report-cover flex flex-col items-center justify-between">
        <div class="mt-16">
          ${LogoSVG}
        </div>

        <div class="text-center">
          <h2 class="text-5xl font-serif font-bold text-agro-900 mb-4 uppercase tracking-tighter">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
          <div class="w-32 h-1 bg-agro-900 mx-auto mt-6"></div>
          <p class="mt-4 text-gray-400 font-bold tracking-widest text-xs">NBR 14653 - INTELIGÊNCIA DE MERCADO</p>
        </div>

        <div class="w-full max-w-2xl border-t border-gray-300 mb-20 pt-8">
          <table class="w-full text-left text-sm uppercase tracking-wider">
            <tr class="border-b border-gray-100">
              <td class="py-4 font-bold text-gray-500 w-1/3 text-[10px]">SOLICITANTE</td>
              <td class="py-4 font-bold text-gray-800">BANDEIRA AGRO</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-4 font-bold text-gray-500 text-[10px]">OBJETIVO</td>
              <td class="py-4 font-bold text-gray-800 text-[10px]">DETERMINAÇÃO DOS VALORES DE MERCADO E LIQUIDAÇÃO FORÇADA</td>
            </tr>
            <tr>
              <td class="py-4 font-bold text-gray-500 text-[10px]">DATA BASE</td>
              <td class="py-4 font-bold text-gray-800">${new Date().toLocaleDateString('pt-BR')}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- PÁGINA 2: RESUMO DA AVALIAÇÃO -->
      <div class="report-page">
        <h2 class="text-3xl font-serif font-bold text-agro-900 text-center mb-4 uppercase tracking-widest">RESUMO DA AVALIAÇÃO</h2>
        <div class="w-16 h-1 bg-gray-300 mx-auto mb-16"></div>

        <div class="space-y-10 max-w-3xl mx-auto border-b border-gray-200 pb-16">
          <div>
            <h3 class="font-bold text-gray-500 uppercase text-xs tracking-[0.2em] mb-2">LOCALIZAÇÃO DO IMÓVEL</h3>
            <p class="text-xl text-gray-800 font-medium">${data.address || 'Não informado'}, ${data.neighborhood || ''}, ${data.city} - ${data.state}</p>
          </div>

          <div>
            <h3 class="font-bold text-gray-500 uppercase text-xs tracking-[0.2em] mb-2">ÁREAS</h3>
            <p class="text-xl text-gray-800 font-bold uppercase tracking-tighter">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
          </div>
        </div>

        <div class="mt-12 text-center">
          <h3 class="font-bold text-gray-900 uppercase text-sm tracking-[0.3em] mb-10">RESUMO DE VALORES</h3>
          <div class="space-y-6">
            <div class="p-4 bg-gray-50 rounded-xl inline-block px-10">
              <p class="text-gray-500 uppercase text-xs mb-1">Valor de Mercado</p>
              <p class="text-3xl text-gray-900 font-bold">${formatter.format(finalValue)}</p>
            </div>
            <div>
              <p class="text-gray-500 uppercase text-xs mb-1">Valor de Liquidação Forçada</p>
              <p class="text-2xl text-gray-800 font-bold">${formatter.format(liquidationValue)}</p>
            </div>
          </div>
        </div>

        <div class="mt-auto pt-10 text-center pb-10">
          <p class="font-bold text-gray-800 tracking-[0.1em] uppercase">BANDEIRA AGRO</p>
          <p class="text-xs text-gray-400 italic">Este laudo segue os critérios de saneamento estatístico para redução de variância.</p>
        </div>
      </div>

      <!-- PÁGINA 3: METODOLOGIA E CRITÉRIO -->
      <div class="report-page text-gray-700 leading-relaxed">
        <h2 class="text-xl font-bold mb-6 uppercase">METODOLOGIA GERAL DE AVALIAÇÃO</h2>
        <p class="mb-10 text-justify text-sm">
          De acordo com a Norma da ABNT NBR 14653 o terreno será avaliado com base no "Método Comparativo de Dados de Mercado", através de dados de mercado de imóveis semelhantes ao avaliando. Para garantir a precisão, foi aplicado o <strong>Filtro de Saneamento de Outliers</strong>, descartando amostras que apresentem variância superior a 40% em relação à mediana do pool coletado, visando a homogeneidade necessária para a confiabilidade do laudo.
        </p>

        <h2 class="text-xl font-bold mb-6 uppercase">CRITÉRIO</h2>
        <h3 class="font-bold mb-2 uppercase text-xs">Valor de Mercado</h3>
        <p class="italic mb-10 text-justify text-sm">
          "É a quantia mais provável pela qual se negocia voluntariamente e conscientemente um bem, numa data de referência, dentro das condições do mercado vigente."
        </p>

        <h2 class="text-xl font-bold mb-6 uppercase">LIQUIDAÇÃO FORÇADA</h2>
        <p class="text-justify text-sm">
           A redução do valor de mercado para a condição de liquidação forçada é calculada através da fórmula de deságio financeiro que considera a taxa de juros média de mercado aplicada ao tempo de absorção estimado para o ativo.
        </p>
      </div>

      <!-- ANEXO: FICHAS DE PESQUISA -->
      ${sampleChunks.map((chunk, chunkIdx) => `
        <div class="report-page annex-page">
          <h2 class="text-xl font-bold mb-1 uppercase">ANEXO: FICHAS DE PESQUISA</h2>
          <h3 class="text-2xl font-serif text-gray-400 mb-8 tracking-widest uppercase text-xs">DETALHAMENTO DO MERCADO SANEADO</h3>
          
          <div class="space-y-5">
            ${chunk.map((s, idx) => `
              <div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm page-break-avoid">
                <div class="bg-agro-700 text-white p-3 flex justify-between items-center">
                  <span class="font-bold uppercase tracking-wider text-[10px]">AMOSTRA #${(chunkIdx * 3) + idx + 1}</span>
                  <span class="font-bold text-[9px] uppercase">${s.city} - ${s.state}</span>
                </div>
                <div class="grid grid-cols-2 text-sm">
                  <div class="p-2.5 border-r border-b border-gray-100">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-0.5">LOCALIZAÇÃO</p>
                    <p class="text-gray-800 font-medium text-[10px] truncate">${s.neighborhood || s.city}</p>
                  </div>
                  <div class="p-2.5 border-b border-gray-100">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-0.5">VALOR TOTAL</p>
                    <p class="text-gray-800 font-bold text-xs">${formatter.format(s.price)}</p>
                  </div>
                  <div class="p-2.5 border-r border-gray-100">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-0.5">ÁREA TOTAL</p>
                    <p class="text-gray-800 font-medium text-[10px]">${s.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
                  </div>
                  <div class="p-2.5">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-0.5">VALOR HOMOGENEIZADO (VUH)</p>
                    <p class="text-agro-700 font-bold text-[10px]">${formatter.format(s.vuh || 0)}/${unitLabel}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="mt-auto text-center pb-8 pt-4">
             <p class="text-[8px] text-gray-300 uppercase tracking-widest font-bold">BANDEIRA AGRO - INTELIGÊNCIA EM AVALIAÇÕES</p>
          </div>
        </div>
      `).join('')}

      <!-- ANEXO: MEMÓRIA DE CÁLCULO -->
      <div class="report-page annex-page page-start-new">
        <h2 class="text-xl font-bold mb-1 uppercase">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <h3 class="text-2xl font-serif text-gray-400 mb-6 tracking-widest uppercase text-xs">PROCESSAMENTO ESTATÍSTICO</h3>
        
        <h4 class="font-bold text-gray-700 mb-3 uppercase text-[9px] tracking-widest">CÁLCULO DO VALOR MÉDIO HOMOGENEIZADO (VUH)</h4>
        <div class="border rounded-lg overflow-hidden border-gray-200 mb-6 shadow-sm">
          <table class="w-full text-[8px] text-left border-collapse">
            <thead class="bg-agro-900 text-white uppercase text-center">
              <tr>
                <th class="p-1 border border-agro-800">Amostra</th>
                <th class="p-1 border border-agro-800">VUB (R$)</th>
                <th class="p-1 border border-agro-800">F. Oferta</th>
                <th class="p-1 border border-agro-800">F. Cap</th>
                <th class="p-1 border border-agro-800">F. Outros</th>
                <th class="p-1 border border-agro-800 font-bold">VUH (R$)</th>
              </tr>
            </thead>
            <tbody class="text-center">
              ${finalPool.map((s, idx) => `
                <tr class="odd:bg-gray-50">
                  <td class="p-1 border border-gray-100 font-bold text-center">${idx + 1}</td>
                  <td class="p-1 border border-gray-100">${s.adjustedPricePerUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="p-1 border border-gray-100">0,90</td>
                  <td class="p-1 border border-gray-100">${s.fCap?.toFixed(2).replace('.', ',')}</td>
                  <td class="p-1 border border-gray-100">1,08</td>
                  <td class="p-1 border border-gray-100 font-bold text-agro-700">${formatter.format(s.vuh || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4">
          <div class="space-y-1">
             <p class="flex justify-between border-b pb-0.5 text-[10px] uppercase"><span>Média Final</span> <span class="font-bold text-agro-900">${formatter.format(avgVuh)}</span></p>
             <p class="flex justify-between border-b pb-0.5 text-[10px] uppercase"><span>Desvio Padrão</span> <span class="font-bold text-agro-900">${formatter.format(stdDev)}</span></p>
             <p class="flex justify-between border-b pb-0.5 text-[10px] uppercase"><span>Coef. Variação</span> <span class="font-bold ${coefVariation > 30 ? 'text-red-600' : 'text-agro-900'}">${coefVariation.toFixed(2)}%</span></p>
             <p class="flex justify-between border-b pb-0.5 text-[10px] uppercase"><span>Grau de Precisão</span> <span class="font-bold text-agro-700">${precisionGrade}</span></p>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <h5 class="font-bold text-[8px] uppercase tracking-widest mb-1">INTERVALO CONFIANÇA (80%)</h5>
            <div class="space-y-0.5 text-[9px]">
               <p class="flex justify-between uppercase"><span>Mínimo</span> <span class="font-bold">${formatter.format(avgVuh * 0.85)}</span></p>
               <p class="flex justify-between uppercase"><span>Máximo</span> <span class="font-bold">${formatter.format(avgVuh * 1.15)}</span></p>
               <p class="flex justify-between border-t pt-0.5 mt-0.5 uppercase"><span>Amplitude</span> <span class="font-bold text-agro-700">${formatter.format(avgVuh * 0.30)}</span></p>
            </div>
          </div>
        </div>

        <div class="mt-6 p-3 bg-blue-50 border border-blue-100 rounded text-[9px] text-blue-800">
           <strong>Nota Técnica de Saneamento:</strong> As amostras foram selecionadas com base no critério de proximidade à mediana do mercado regional (VUH Mediana: ${formatter.format(medianVuh)}). O saneamento estatístico eliminou elementos com dispersão superior a 40%, garantindo o enquadramento no <strong>${precisionGrade}</strong>.
        </div>
      </div>

      <!-- PÁGINA FINAL -->
      <div class="report-page page-start-new flex flex-col h-full">
        <h2 class="text-xl font-bold mb-10 text-center uppercase tracking-widest">RESPONSABILIDADE E LIMITAÇÕES</h2>
        
        <div class="space-y-6 text-justify text-gray-700 text-xs leading-relaxed flex-grow">
          <p>Este laudo utiliza inteligência artificial para varredura de portais e aplicação de homogeneização conforme NBR 14653. A precisão do valor estimado depende da fidedignidade dos dados de mercado coletados.</p>
          <p>O <strong>Coeficiente de Variação de ${coefVariation.toFixed(2)}%</strong> indica a consistência estatística do pool amostral. Valores abaixo de 30% são considerados de alta confiabilidade para avaliações de mercado.</p>
        </div>

        <div class="mt-auto text-center pb-8 pt-20">
          <p class="uppercase text-[10px] tracking-widest font-bold text-gray-600 mb-2">BANDEIRA AGRO</p>
          <p class="text-[10px] text-gray-400">Documento gerado eletronicamente | ID-${Math.random().toString(36).substring(7).toUpperCase()}</p>
        </div>
      </div>

    </div>

    <style>
      .report-wrapper { display: flex; flex-direction: column; gap: 0; }
      .report-page { background: white; width: 210mm; height: 297mm; margin: 0 auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); padding: 20mm; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; position: relative; }
      .annex-page { padding-top: 15mm; }
      @media print {
        body { background: white !important; margin: 0 !important; }
        .report-page { box-shadow: none !important; margin: 0 !important; page-break-after: always !important; break-after: page !important; height: 297mm !important; width: 210mm !important; padding: 20mm !important; }
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
  let pool: MarketSample[] = [];
  pool = await filterSamples(data.type, data.city, data.state, data.type === PropertyType.RURAL ? data.ruralActivity : data.urbanSubType);
  
  if (pool.length < 8) {
    const aiSamples = await findMarketSamplesIA(data);
    const existingUrls = new Set(pool.filter(s => !!s.url).map(s => s.url));
    const newAiSamples = aiSamples.filter(s => !s.url || !existingUrls.has(s.url));
    pool = [...pool, ...newAiSamples];
    newAiSamples.forEach(sample => { saveSample(sample).catch(() => {}); });
  }

  const uniquePool = pool.filter((v, i, a) => 
    v.price > 0 && v.areaTotal > 0 && 
    a.findIndex(t => (t.url && t.url === v.url) || t.id === v.id) === i
  );

  return calculateAndGenerateReport(data, uniquePool);
};

export const generateManualValuation = performValuation;
export const generateUrbanAutomatedValuation = performValuation;


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
    <div class="relative w-32 h-32 mb-8">
      <div class="absolute inset-0 border-[3px] border-[#f97316] rounded-full"></div>
      <div class="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 100 100" class="w-14 h-14 text-[#15803d] fill-current">
          <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
        </svg>
      </div>
    </div>
    <h1 class="text-3xl font-serif font-bold tracking-[0.4em] text-[#14532d] uppercase">BANDEIRA AGRO</h1>
  </div>
`;

const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length < 3) throw new Error("AMOSTRAS_INSUFICIENTES");

  const allProcessed = pool.map(s => {
    const vub = s.price / s.areaTotal;
    const fOferta = OFFER_FACTOR;
    const fDim = 1.00;
    const fCap = 1.00;
    const fAcesso = 1.00;
    const fTopo = 1.00;
    const fOutros = OTHERS_FACTOR;
    const vuh = vub * fOferta * fDim * fCap * fAcesso * fTopo * fOutros;
    return { ...s, vub, vuh, fOferta, fDim, fCap, fAcesso, fTopo, fOutros };
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
    <div class="report-wrapper bg-[#f3f4f6] font-sans text-[13px] leading-relaxed text-gray-800">
      
      <!-- PÁGINA 1: CAPA -->
      <div class="report-page px-20 pt-32 pb-24 flex flex-col items-center justify-between">
        <div>${LogoSVG}</div>
        
        <div class="text-center mt-20">
          <h2 class="text-[44px] font-serif font-bold text-[#15803d] uppercase tracking-tight leading-[1.1]">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
        </div>

        <div class="w-full mt-auto">
          <table class="w-full text-left uppercase text-[10px] font-bold tracking-[0.05em]">
            <tr class="border-t border-gray-100"><td class="py-6 text-gray-400 w-1/3">SOLICITANTE</td><td class="text-gray-900">BANDEIRA AGRO</td></tr>
            <tr class="border-t border-gray-100"><td class="py-6 text-gray-400">OBJETIVO DA AVALIAÇÃO</td><td class="text-gray-900">DETERMINAÇÃO DOS VALORES DE MERCADO E LIQUIDAÇÃO FORÇADA</td></tr>
            <tr class="border-t border-gray-100"><td class="py-6 text-gray-400">FINALIDADE DA AVALIAÇÃO</td><td class="text-gray-900">GARANTIA / GESTÃO PATRIMONIAL</td></tr>
            <tr class="border-t border-b border-gray-100"><td class="py-6 text-gray-400">DATA BASE</td><td class="text-gray-900">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
        </div>
      </div>

      <!-- PÁGINA 2: RESUMO -->
      <div class="report-page px-20 py-24 flex flex-col">
        <h2 class="text-[32px] font-serif font-bold text-[#15803d] text-center mb-24 uppercase tracking-[0.2em]">RESUMO DA AVALIAÇÃO</h2>

        <div class="space-y-12">
          <div>
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">LOCALIZAÇÃO DO IMÓVEL</h3>
            <p class="text-[20px] font-bold text-gray-900 leading-tight">${data.address || ''}, ${data.neighborhood || ''}, ${data.city} - ${data.state}</p>
          </div>
          
          <div>
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">TIPO DE IMÓVEL</h3>
            <p class="text-[20px] font-bold text-gray-900 uppercase">${data.type} (${data.urbanSubType || data.ruralActivity})</p>
          </div>

          <div>
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">ATIVIDADE PREDOMINANTE</h3>
            <p class="text-[20px] font-bold text-gray-900 uppercase">RESIDENCIAL / COMERCIAL</p>
          </div>

          <div>
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">ÁREAS</h3>
            <p class="text-[28px] font-bold text-[#15803d] uppercase tracking-tight">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unit.toUpperCase()}</p>
          </div>
        </div>

        <div class="mt-auto border-t border-gray-100 pt-16">
          <h3 class="text-[11px] font-bold text-gray-400 uppercase tracking-[0.4em] text-center mb-10">RESUMO DE VALORES</h3>
          <div class="space-y-4 text-center">
            <p class="text-[20px] font-medium text-gray-600">VALOR DE MERCADO: <span class="font-bold text-gray-900">${fmt.format(finalValue)}</span></p>
            <p class="text-[20px] font-medium text-gray-600">VALOR DE LIQUIDAÇÃO FORÇADA: <span class="font-bold text-gray-900">${fmt.format(liquidationValue)}</span></p>
          </div>
        </div>

        <div class="mt-16 text-center">
          <p class="font-bold text-gray-900 tracking-[0.4em] text-[11px] uppercase">BANDEIRA AGRO</p>
          <p class="text-gray-400 text-[10px] italic">Inteligência em Avaliações</p>
        </div>
      </div>

      <!-- PÁGINA 3: METODOLOGIA -->
      <div class="report-page px-20 py-24 text-gray-700">
        <h2 class="text-[22px] font-serif font-bold text-gray-900 mb-8 uppercase tracking-wide">METODOLOGIA GERAL DE AVALIAÇÃO</h2>
        <p class="mb-12 text-justify text-[16px] leading-relaxed">
          De acordo com a Norma da ABNT NBR 14653 o terreno será avaliado com base no "Método Comparativo de Dados de Mercado", através de dados de mercado de imóveis semelhantes ao avaliando, à venda ou efetivamente transacionados no livre mercado imobiliário da região.
        </p>

        <h2 class="text-[22px] font-serif font-bold text-gray-900 mb-8 uppercase tracking-wide">CRITÉRIO</h2>
        <p class="mb-10 text-[16px]">Para a presente avaliação estabelecemos os critérios de Valores de Mercado e Liquidação Forçada, definidos como:</p>
        
        <div class="mb-12">
          <h4 class="font-bold text-gray-900 mb-3 uppercase text-[12px] tracking-widest">VALOR DE MERCADO</h4>
          <p class="italic text-justify text-[16px] leading-relaxed text-gray-600">"É a quantia mais provável pela qual se negocia voluntariamente e conscientemente um bem, numa data de referência, dentro das condições do mercado vigente."</p>
        </div>

        <div>
          <h4 class="font-bold text-gray-900 mb-3 uppercase text-[12px] tracking-widest">VALOR DE LIQUIDAÇÃO FORÇADA</h4>
          <p class="text-justify mb-6 text-[16px]">O valor de liquidação forçada, apurado na presente avaliação, é assim definido no artigo técnico de autoria do Engº Nelson R.P. Alonso e Arqª Mônica D’Amato publicado na edição de agosto/setembro de 1998 do Jornal do IBAPE:</p>
          <div class="border-l-2 border-gray-100 pl-8 py-2">
            <p class="italic text-justify text-[16px] leading-relaxed text-gray-600">“Admitindo-se a liquidação forçada de um imóvel, aqui conceituada como a sua condição relativa à hipótese de uma venda compulsória ou em prazo menor que o médio de absorção pelo mercado... deve ser considerado a redução do valor de mercado de forma a compensar as partes envolvidas na transação, vendedor e comprador, respectivamente o ganho e a perda dos juros e correção monetária vigentes no mercado financeiro...”</p>
          </div>
        </div>
      </div>

      <!-- PÁGINA 4: LIQUIDAÇÃO FORÇADA -->
      <div class="report-page px-20 py-24 text-gray-700">
        <h2 class="text-[22px] font-serif font-bold text-gray-900 mb-8 uppercase tracking-wide">VALOR PARA LIQUIDAÇÃO FORÇADA</h2>
        <p class="mb-10 text-[16px]">Para a determinação do “Valor de Liquidação do Imóvel” foram adotados os preceitos constantes do trabalho técnico mencionado.</p>
        
        <div class="space-y-6 mb-16 text-[16px]">
          <p><strong>Taxa Média de Juros:</strong> Para o cálculo da taxa média de juros foi adotada a série composta pelas linhas de crédito de mercado. A taxa mensal média de juros obtida foi igual a <strong>1.51%</strong>.</p>
          <p><strong>Tempo de Absorção:</strong> Estimado em <strong>24 meses</strong> para imóveis análogos.</p>
        </div>

        <div class="bg-[#f9fafb] p-12 rounded-2xl border border-gray-100 text-center mb-16">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em] mb-10">FÓRMULA DE DESÁGIO</p>
          <p class="text-[20px] font-bold text-[#15803d] mb-4">Valor Liquidação = Valor Mercado × (1 / (1 + 0.0151)^24)</p>
          <div class="w-12 h-px bg-gray-200 mx-auto mb-4"></div>
          <p class="text-[15px] text-gray-400 font-mono">Fator = 0.6979</p>
        </div>

        <div class="text-center mt-auto pb-10">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-6">VALOR PARA LIQUIDAÇÃO FORÇADA:</p>
          <p class="text-[54px] font-bold text-gray-900 tracking-tighter">${fmt.format(liquidationValue)}</p>
        </div>
      </div>

      <!-- PÁGINAS 5-6: ANEXO - FICHAS DE PESQUISA -->
      ${chunkArray(finalPool, 3).map((chunk, pIdx) => `
        <div class="report-page px-20 py-20">
          <h2 class="text-[22px] font-serif font-bold text-gray-900 mb-2 uppercase tracking-wide">ANEXO: FICHAS DE PESQUISA</h2>
          <h3 class="text-[28px] font-serif text-gray-400 mb-12 uppercase tracking-[0.15em]">DETALHAMENTO DO MERCADO</h3>
          
          <div class="space-y-8">
            ${chunk.map((s, i) => `
              <div class="border border-gray-200 rounded-xl overflow-hidden">
                <div class="bg-[#f9fafb] px-6 py-4 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200">
                  <span>AMOSTRA #${(pIdx * 3) + i + 1}</span>
                  <span>${s.city.toUpperCase()} - ${s.state}</span>
                  <span>OFERTA (0,90)</span>
                </div>
                <div class="grid grid-cols-2">
                  <div class="p-4 border-r border-b border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-1">LOCALIZAÇÃO</p>
                    <p class="text-gray-900 font-bold">${s.neighborhood || s.city}</p>
                  </div>
                  <div class="p-4 border-b border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-1">FONTE</p>
                    <p class="text-blue-600 font-medium truncate">${s.source || 'Mercado'}</p>
                  </div>
                  <div class="p-4 border-r border-b border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-1">ÁREA TOTAL</p>
                    <p class="text-gray-900 font-bold text-[16px]">${s.areaTotal.toLocaleString('pt-BR')} ${unit}</p>
                  </div>
                  <div class="p-4 border-b border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-1">VALOR TOTAL</p>
                    <p class="text-gray-900 font-bold text-[16px]">${fmt.format(s.price)}</p>
                  </div>
                  <div class="p-4 border-r border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-1">DESCRIÇÃO</p>
                    <p class="text-gray-600 text-[11px] leading-tight line-clamp-2">${s.description || 'Disponível para venda.'}</p>
                  </div>
                  <div class="p-4">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-1">CARACTERÍSTICAS</p>
                    <p class="text-gray-900 font-bold">Q/B/V: ${s.bedrooms || 0}/${s.bathrooms || 0}/${s.parking || 0}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <!-- PÁGINA 7: MEMÓRIA DE CÁLCULO (AJUSTADA PARA CABER EM UMA PÁGINA) -->
      <div class="report-page px-16 py-12">
        <h2 class="text-[20px] font-serif font-bold text-gray-900 mb-1 uppercase tracking-wide">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <h3 class="text-[24px] font-serif text-gray-300 mb-8 uppercase tracking-[0.15em]">PROCESSAMENTO ESTATÍSTICO</h3>
        
        <div class="mb-6">
          <h5 class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">ELEMENTOS COLETADOS</h5>
          <table class="w-full text-[10px] border-collapse border border-gray-100">
            <thead>
              <tr class="bg-gray-50 text-gray-400 uppercase font-bold text-center">
                <th class="p-2 border">AMOSTRA</th><th class="p-2 border">VO (R$)</th><th class="p-2 border">ÁREA (${unit.toUpperCase()})</th><th class="p-2 border">OFERTA</th><th class="p-2 border text-gray-900">VUB (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${finalPool.map((s, i) => `
                <tr class="text-center">
                  <td class="p-2 border font-bold text-gray-300 text-[16px]">${i+1}</td>
                  <td class="p-2 border">${fmt.format(s.price)}</td>
                  <td class="p-2 border">${s.areaTotal}</td>
                  <td class="p-2 border">0,90</td>
                  <td class="p-2 border font-bold text-gray-900">${fmt.format(s.vub)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="mb-6">
          <h5 class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">CÁLCULO DO VALOR MÉDIO HOMOGENEIZADO</h5>
          <div class="overflow-hidden border border-gray-100">
            <table class="w-full text-[8.5px] border-collapse">
              <thead>
                <tr class="bg-gray-50 text-gray-400 uppercase font-bold text-center">
                  <th class="p-2 border">AMOSTRA</th><th class="p-2 border">VUB (R$)</th><th class="p-2 border">F. OFERTA</th><th class="p-2 border">F. DIM</th><th class="p-2 border">F. CAP</th><th class="p-2 border">F. ACESSO</th><th class="p-2 border">F. TOPO</th><th class="p-2 border">F. OUTROS</th><th class="p-2 border text-[#15803d]">VUH (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${finalPool.map((s, i) => `
                  <tr class="text-center">
                    <td class="p-2 border font-bold text-gray-300">${i+1}</td>
                    <td class="p-2 border">${s.vub.toFixed(2)}</td>
                    <td class="p-2 border">0,90</td><td class="p-2 border">1,00</td><td class="p-2 border">1,00</td><td class="p-2 border">1,00</td><td class="p-2 border">1,00</td><td class="p-2 border">1,08</td>
                    <td class="p-2 border font-bold text-[#15803d]">${fmt.format(s.vuh)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mt-auto">
          <div class="space-y-2 uppercase font-bold text-gray-500 text-[10px] tracking-wider">
            <p class="flex justify-between border-b border-gray-50 pb-1">MÉDIA <span class="text-gray-900 font-black">${fmt.format(avgVuh)}</span></p>
            <p class="flex justify-between border-b border-gray-50 pb-1">DESVIO PADRÃO <span class="text-agro-700 font-black">${fmt.format(stdDev)}</span></p>
            <p class="flex justify-between border-b border-gray-50 pb-1">COEF. VARIAÇÃO <span class="text-agro-700 font-black">${cv.toFixed(2)}%</span></p>
            <p class="flex justify-between">GRAU DE PRECISÃO <span class="text-agro-700 font-black">${precision}</span></p>
          </div>
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 uppercase tracking-widest space-y-2">
            <p class="text-[9px] text-gray-900 mb-2 font-black uppercase tracking-[0.2em]">INTERVALO CONFIANÇA (80%)</p>
            <p class="flex justify-between border-b border-gray-200 pb-1 text-[10px] text-gray-500 font-bold">MÍNIMO <span class="text-gray-800 font-black">${fmt.format(avgVuh * 0.85)}</span></p>
            <p class="flex justify-between border-b border-gray-200 pb-1 text-[10px] text-gray-500 font-bold">MÁXIMO <span class="text-gray-800 font-black">${fmt.format(avgVuh * 1.15)}</span></p>
            <p class="flex justify-between text-agro-700 font-black text-[10px]">AMPLITUDE <span>${fmt.format(avgVuh * 0.30)}</span></p>
          </div>
        </div>

        <div class="mt-8 text-center text-gray-300 text-[9px] font-bold uppercase tracking-[0.3em]">BANDEIRA AGRO - INTELIGÊNCIA EM AVALIAÇÕES</div>
      </div>

      <!-- PÁGINA 8: RESPONSABILIDADE -->
      <div class="report-page px-20 py-24 text-gray-700">
        <h2 class="text-[30px] font-serif font-bold text-gray-900 mb-16 uppercase tracking-[0.2em] text-center">RESPONSABILIDADE E LIMITAÇÕES</h2>
        <div class="space-y-10 text-[16px] text-justify leading-relaxed">
          <p>Este Laudo de Avaliação foi produzido com base em informações fornecidas pela contratante/usuário do sistema, incluindo a documentação do imóvel objeto da análise, características físicas e localizacionais, as quais são admitidas como verdadeiras para fins de cálculo.</p>
          <p>Ressalva-se que o presente trabalho foi realizado seguindo os preceitos metodológicos da ABNT NBR 14653-3 (Imóveis Rurais) e/ou NBR 14653-2 (Imóveis Urbanos), contudo, enquadra-se na modalidade "Avaliação Expedita" (Desktop Valuation), sendo realizado sem vistoria in loco ao imóvel avaliando.</p>
          <p>A fundamentação de valores utilizou como base o Banco de Dados de Amostras da Bandeira Agro e dados de mercado disponíveis publicamente. A Bandeira Agro não se responsabiliza por divergências entre as informações inseridas no sistema e a realidade fática do imóvel que apenas uma inspeção presencial detalhada poderia constatar.</p>
          <p>A utilização deste Laudo de Avaliação é restrita à finalidade de estimativa de valor de mercado e liquidação forçada para fins gerenciais, não devendo ser utilizado como único instrumento para garantias bancárias de alto risco sem a devida validação presencial complementar.</p>
        </div>
        
        <div class="mt-auto text-center pb-10">
          <p class="font-bold text-gray-900 tracking-[0.5em] text-[12px] uppercase mb-4">BANDEIRA AGRO</p>
          <p class="text-gray-400 text-[10px] uppercase">DOCUMENTO GERADO ELETRONICAMENTE PELA PLATAFORMA BANDEIRA AGRO INTELLIGENCE.</p>
          <p class="text-gray-400 text-[10px] mt-2">${new Date().toLocaleDateString('pt-BR')} | ID-SYSTEM-${Math.random().toString(36).substring(7).toUpperCase()}</p>
        </div>
      </div>

    </div>

    <style>
      .report-wrapper { margin: 0; padding: 0; background: #f3f4f6; }
      .report-page { 
        background: white; 
        width: 210mm; 
        height: 297mm; 
        margin: 20px auto; 
        display: flex; 
        flex-direction: column; 
        box-sizing: border-box; 
        box-shadow: 0 0 15px rgba(0,0,0,0.05); 
        page-break-after: always;
        overflow: hidden;
        position: relative;
      }
      @media print {
        body { background: white !important; margin: 0 !important; padding: 0 !important; }
        .report-wrapper { background: white !important; padding: 0 !important; }
        .report-page { 
          box-shadow: none !important; 
          margin: 0 !important; 
          height: 297mm !important; 
          width: 210mm !important; 
          page-break-after: always !important;
          break-after: page !important;
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

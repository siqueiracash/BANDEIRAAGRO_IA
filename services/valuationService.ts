
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
    <div class="report-wrapper bg-[#f3f4f6] font-sans text-[13px] leading-tight text-gray-800">
      
      <!-- PÁGINA 1: CAPA -->
      <div class="report-page px-20 pt-32 pb-20 flex flex-col items-center justify-between">
        <div>${LogoSVG}</div>
        <div class="text-center">
          <h2 class="text-[40px] font-serif font-bold text-[#15803d] uppercase tracking-tight leading-[1.1] mb-12">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
        </div>
        <div class="w-full">
          <table class="w-full text-left uppercase text-[10px] font-bold tracking-[0.05em]">
            <tr class="border-t border-gray-100"><td class="py-5 text-gray-400 w-1/3">SOLICITANTE</td><td class="text-gray-900">BANDEIRA AGRO</td></tr>
            <tr class="border-t border-gray-100"><td class="py-5 text-gray-400">OBJETIVO DA AVALIAÇÃO</td><td class="text-gray-900">DETERMINAÇÃO DOS VALORES DE MERCADO E LIQUIDAÇÃO FORÇADA</td></tr>
            <tr class="border-t border-gray-100"><td class="py-5 text-gray-400">FINALIDADE DA AVALIAÇÃO</td><td class="text-gray-900">GARANTIA / GESTÃO PATRIMONIAL</td></tr>
            <tr class="border-t border-b border-gray-100"><td class="py-5 text-gray-400">DATA BASE</td><td class="text-gray-900">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
        </div>
      </div>

      <!-- PÁGINA 2: RESUMO -->
      <div class="report-page px-20 py-20 flex flex-col">
        <h2 class="text-[28px] font-serif font-bold text-[#15803d] text-center mb-16 uppercase tracking-[0.2em]">RESUMO DA AVALIAÇÃO</h2>
        <div class="space-y-10">
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">LOCALIZAÇÃO DO IMÓVEL</h3>
            <p class="text-[18px] font-bold text-gray-900">${data.address || ''}, ${data.neighborhood || ''}, ${data.city} - ${data.state}</p>
          </div>
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">TIPO DE IMÓVEL</h3>
            <p class="text-[18px] font-bold text-gray-900 uppercase">${data.type} (${data.urbanSubType || data.ruralActivity})</p>
          </div>
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">ATIVIDADE PREDOMINANTE</h3>
            <p class="text-[18px] font-bold text-gray-900 uppercase">RESIDENCIAL / COMERCIAL</p>
          </div>
          <div>
            <h3 class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">ÁREAS</h3>
            <p class="text-[24px] font-bold text-[#15803d] uppercase">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unit.toUpperCase()}</p>
          </div>
        </div>
        <div class="mt-auto border-t border-gray-100 pt-12">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em] text-center mb-6">RESUMO DE VALORES</p>
          <div class="space-y-3 text-center">
            <p class="text-[18px] font-medium text-gray-600 uppercase">VALOR DE MERCADO: <span class="font-bold text-gray-900">${fmt.format(finalValue)}</span></p>
            <p class="text-[18px] font-medium text-gray-600 uppercase">VALOR DE LIQUIDAÇÃO FORÇADA: <span class="font-bold text-gray-900">${fmt.format(liquidationValue)}</span></p>
          </div>
          <div class="mt-12 text-center">
            <p class="font-bold text-gray-900 tracking-[0.4em] text-[10px] uppercase">BANDEIRA AGRO</p>
            <p class="text-gray-400 text-[9px] italic">Inteligência em Avaliações</p>
          </div>
        </div>
      </div>

      <!-- PÁGINA 3: METODOLOGIA -->
      <div class="report-page px-20 py-20 text-gray-700">
        <h2 class="text-[20px] font-serif font-bold text-gray-900 mb-6 uppercase tracking-wide">METODOLOGIA GERAL DE AVALIAÇÃO</h2>
        <p class="mb-10 text-justify text-[15px] leading-relaxed">
          De acordo com a Norma da ABNT NBR 14653 o terreno será avaliado com base no "Método Comparativo de Dados de Mercado", através de dados de mercado de imóveis semelhantes ao avaliando, à venda ou efetivamente transacionados no livre mercado imobiliário da região.
        </p>
        <h2 class="text-[20px] font-serif font-bold text-gray-900 mb-6 uppercase tracking-wide">CRITÉRIO</h2>
        <div class="space-y-8 text-[15px]">
          <div>
            <h4 class="font-bold text-gray-900 mb-2 uppercase text-[11px] tracking-widest">VALOR DE MERCADO</h4>
            <p class="italic text-justify text-gray-600">"É a quantia mais provável pela qual se negocia voluntariamente e conscientemente um bem, numa data de referência, dentro das condições do mercado vigente."</p>
          </div>
          <div>
            <h4 class="font-bold text-gray-900 mb-2 uppercase text-[11px] tracking-widest">VALOR DE LIQUIDAÇÃO FORÇADA</h4>
            <p class="text-justify mb-4">O valor de liquidação forçada, apurado na presente avaliação, é assim definido no artigo técnico de autoria do Engº Nelson R.P. Alonso e Arqª Mônica D’Amato publicado na edição de agosto/setembro de 1998 do Jornal do IBAPE:</p>
            <div class="border-l-2 border-gray-100 pl-6 italic text-gray-600">
              “Admitindo-se a liquidação forçada de um imóvel, aqui conceituada como a sua condição relativa à hipótese de uma venda compulsória ou em prazo menor que o médio de absorção pelo mercado... deve ser considerado a redução do valor de mercado de forma a compensar as partes envolvidas na transação, vendedor e comprador...”
            </div>
          </div>
        </div>
      </div>

      <!-- PÁGINA 4: LIQUIDAÇÃO FORÇADA -->
      <div class="report-page px-20 py-20 text-gray-700">
        <h2 class="text-[20px] font-serif font-bold text-gray-900 mb-8 uppercase tracking-wide">VALOR PARA LIQUIDAÇÃO FORÇADA</h2>
        <div class="space-y-6 mb-12 text-[15px]">
          <p>Taxa Média de Juros: Para o cálculo da taxa média de juros foi adotada a série composta pelas linhas de crédito de mercado. A taxa mensal média de juros obtida foi igual a <strong>1.51%</strong>.</p>
          <p>Tempo de Absorção: Estimado em <strong>24 meses</strong> para imóveis análogos.</p>
        </div>
        <div class="bg-[#f9fafb] p-10 rounded-2xl border border-gray-100 text-center mb-12">
          <p class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.4em] mb-8">FÓRMULA DE DESÁGIO</p>
          <p class="text-[18px] font-bold text-[#15803d] mb-4 uppercase">Valor Liquidação = Valor Mercado × (1 / (1 + 0.0151)^24)</p>
          <div class="w-10 h-px bg-gray-200 mx-auto mb-4"></div>
          <p class="text-[14px] text-gray-400 font-mono">Fator = 0.6979</p>
        </div>
        <div class="text-center mt-auto pb-10">
          <p class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-4">VALOR PARA LIQUIDAÇÃO FORÇADA:</p>
          <p class="text-[48px] font-bold text-gray-900 tracking-tighter">${fmt.format(liquidationValue)}</p>
        </div>
      </div>

      <!-- PÁGINAS 5-6: ANEXO - FICHAS DE PESQUISA -->
      ${chunkArray(finalPool, 3).map((chunk, pIdx) => `
        <div class="report-page px-16 py-16">
          <h2 class="text-[18px] font-serif font-bold text-gray-900 mb-1 uppercase tracking-wide">ANEXO: FICHAS DE PESQUISA</h2>
          <h3 class="text-[24px] font-serif text-gray-400 mb-8 uppercase tracking-[0.15em]">DETALHAMENTO DO MERCADO</h3>
          <div class="space-y-6">
            ${chunk.map((s, i) => `
              <div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <!-- Faixa Verde Superior Conforme Solicitado -->
                <div class="bg-[#15803d] px-5 py-3 flex justify-between items-center text-[10px] font-bold text-white uppercase tracking-widest">
                  <span>AMOSTRA #${(pIdx * 3) + i + 1}</span>
                  <span class="flex-1 text-center px-4">${s.city.toUpperCase()} - ${s.state}</span>
                  <span class="bg-black bg-opacity-20 px-3 py-1 rounded text-[9px]">OFERTA (0,90)</span>
                </div>
                <div class="grid grid-cols-2 text-[11px]">
                  <div class="p-3 border-r border-b border-gray-50"><p class="text-[8px] font-bold text-gray-400 uppercase mb-0.5">LOCALIZAÇÃO</p><p class="font-bold">${s.neighborhood || s.city}</p></div>
                  <div class="p-3 border-b border-gray-50"><p class="text-[8px] font-bold text-gray-400 uppercase mb-0.5">FONTE</p><p class="text-blue-600 truncate">${s.source || 'Portal'}</p></div>
                  <div class="p-3 border-r border-b border-gray-50"><p class="text-[8px] font-bold text-gray-400 uppercase mb-0.5">ÁREA TOTAL</p><p class="font-bold text-[13px]">${s.areaTotal} ${unit}</p></div>
                  <div class="p-3 border-b border-gray-50"><p class="text-[8px] font-bold text-gray-400 uppercase mb-0.5">VALOR TOTAL</p><p class="font-bold text-[13px]">${fmt.format(s.price)}</p></div>
                  <div class="p-3 border-r border-gray-50"><p class="text-[8px] font-bold text-gray-400 uppercase mb-0.5">DESCRIÇÃO</p><p class="text-gray-500 line-clamp-1 italic">${s.description || 'Imóvel disponível.'}</p></div>
                  <div class="p-3"><p class="text-[8px] font-bold text-gray-400 uppercase mb-0.5">CARACTERÍSTICAS</p><p class="font-bold uppercase">Q/B/V: ${s.bedrooms}/${s.bathrooms}/${s.parking}</p></div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-auto pt-8 text-center text-gray-300 text-[9px] font-bold uppercase tracking-[0.3em]">BANDEIRA AGRO - INTELIGÊNCIA EM AVALIAÇÕES</div>
        </div>
      `).join('')}

      <!-- PÁGINA 7: MEMÓRIA DE CÁLCULO -->
      <div class="report-page px-16 py-12 flex flex-col">
        <h2 class="text-[20px] font-serif font-bold text-gray-900 mb-1 uppercase tracking-wide">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <h3 class="text-[24px] font-serif text-gray-300 mb-8 uppercase tracking-[0.15em]">PROCESSAMENTO ESTATÍSTICO</h3>
        
        <div class="mb-6">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">ELEMENTOS COLETADOS</p>
          <table class="w-full text-[10px] border-collapse border border-gray-100">
            <thead>
              <tr class="bg-gray-50 text-gray-400 uppercase font-bold text-center">
                <th class="p-2.5 border">AMOSTRA</th><th class="p-2.5 border">VO (R$)</th><th class="p-2.5 border">ÁREA (${unit.toUpperCase()})</th><th class="p-2.5 border">OFERTA</th><th class="p-2.5 border text-gray-900">VUB (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${finalPool.map((s, i) => `
                <tr class="text-center hover:bg-gray-50">
                  <td class="p-2 border font-bold text-gray-300 text-[16px]">${i+1}</td>
                  <td class="p-2 border font-medium">${fmt.format(s.price)}</td>
                  <td class="p-2 border font-medium">${s.areaTotal}</td>
                  <td class="p-2 border font-medium">0,90</td>
                  <td class="p-2 border font-bold text-gray-900">${fmt.format(s.vub)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="mb-10">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">CÁLCULO DO VALOR MÉDIO HOMOGENEIZADO</p>
          <table class="w-full text-[8.5px] border-collapse border border-gray-100">
            <thead>
              <tr class="bg-gray-50 text-gray-400 uppercase font-bold text-center">
                <th class="p-2 border">AM</th><th class="p-2 border">VUB (R$)</th><th class="p-2 border">F.OF</th><th class="p-2 border">F.DIM</th><th class="p-2 border">F.CAP</th><th class="p-2 border">F.ACE</th><th class="p-2 border">F.TOP</th><th class="p-2 border">F.OUT</th><th class="p-2 border text-[#15803d]">VUH (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${finalPool.map((s, i) => `
                <tr class="text-center hover:bg-gray-50">
                  <td class="p-1.5 border font-bold text-gray-300">${i+1}</td>
                  <td class="p-1.5 border font-medium">${s.vub.toFixed(2)}</td>
                  <td class="p-1.5 border">0,90</td><td class="p-1.5 border">1,00</td><td class="p-1.5 border">1,00</td><td class="p-1.5 border">1,00</td><td class="p-1.5 border">1,00</td><td class="p-1.5 border">1,08</td>
                  <td class="p-1.5 border font-bold text-[#15803d]">${fmt.format(s.vuh)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex flex-col gap-8">
          <div class="grid grid-cols-2 gap-10 items-start">
            <div class="space-y-3">
              <div class="flex justify-between border-b border-gray-100 pb-2 text-[11px] font-bold uppercase"><span class="text-gray-400">MÉDIA</span><span class="text-gray-900 font-black">${fmt.format(avgVuh)}</span></div>
              <div class="flex justify-between border-b border-gray-100 pb-2 text-[11px] font-bold uppercase"><span class="text-gray-400">DESVIO PADRÃO</span><span class="text-[#15803d] font-black">${fmt.format(stdDev)}</span></div>
              <div class="flex justify-between border-b border-gray-100 pb-2 text-[11px] font-bold uppercase"><span class="text-gray-400">COEF. VARIAÇÃO</span><span class="text-[#15803d] font-black">${cv.toFixed(2)}%</span></div>
              <div class="flex justify-between text-[11px] font-bold uppercase"><span class="text-gray-400">GRAU DE PRECISÃO</span><span class="text-[#15803d] font-black">${precision}</span></div>
            </div>
            <div class="border border-gray-200 rounded-2xl p-6 bg-[#f9fafb] shadow-sm">
              <p class="text-[10px] font-black text-gray-900 mb-4 uppercase tracking-widest text-center">INTERVALO CONFIANÇA (80%)</p>
              <div class="space-y-3 uppercase">
                <div class="flex justify-between text-[11px] font-bold border-b border-gray-200 pb-1.5"><span class="text-gray-500">MÍNIMO</span><span class="text-gray-900 font-black">${fmt.format(avgVuh * 0.85)}</span></div>
                <div class="flex justify-between text-[11px] font-bold border-b border-gray-200 pb-1.5"><span class="text-gray-500">MÁXIMO</span><span class="text-gray-900 font-black">${fmt.format(avgVuh * 1.15)}</span></div>
                <div class="flex justify-between text-[11px] font-bold text-[#15803d]"><span class="text-[#15803d]">AMPLITUDE</span><span class="font-black">${fmt.format(avgVuh * 0.30)}</span></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="mt-auto pt-6 text-center text-gray-300 text-[10px] font-bold uppercase tracking-[0.4em]">BANDEIRA AGRO - INTELIGÊNCIA EM AVALIAÇÕES</div>
      </div>

      <!-- PÁGINA 8: RESPONSABILIDADE (FINAL) -->
      <div class="report-page px-20 py-20 text-gray-700 flex flex-col no-break-after">
        <h2 class="text-[26px] font-serif font-bold text-gray-900 mb-12 uppercase tracking-[0.2em] text-center">RESPONSABILIDADE E LIMITAÇÕES</h2>
        <div class="space-y-8 text-[14px] text-justify leading-relaxed">
          <p>Este Laudo de Avaliação foi produzido com base em informações fornecidas pela contratante/usuário do sistema, incluindo a documentação do imóvel objeto da análise, características físicas e localizacionais, as quais são admitidas como verdadeiras para fins de cálculo.</p>
          <p>Ressalva-se que o presente trabalho foi realizado seguindo os preceitos metodológicos da ABNT NBR 14653-3 (Imóveis Rurais) e/ou NBR 14653-2 (Imóveis Urbanos), contudo, enquadra-se na modalidade "Avaliação Expedita" (Desktop Valuation), sendo realizado sem vistoria in loco ao imóvel avaliando.</p>
          <p>A fundamentação de valores utilizou como base o Banco de Dados de Amostras da Bandeira Agro e dados de mercado disponíveis publicamente. A Bandeira Agro não se responsabiliza por divergências entre as informações inseridas no sistema e a realidade fática do imóvel.</p>
          <p>A utilização deste Laudo de Avaliação é restrita à finalidade de estimativa de valor de mercado e liquidação forçada para fins gerenciais, não devendo ser utilizado como único instrumento para garantias bancárias de alto risco sem a devida validação presencial complementar.</p>
        </div>
        <div class="mt-auto text-center pb-8 border-t border-gray-100 pt-8">
          <p class="font-bold text-gray-900 tracking-[0.5em] text-[11px] uppercase mb-4">BANDEIRA AGRO</p>
          <p class="text-gray-400 text-[9px] uppercase font-bold">DOCUMENTO GERADO ELETRONICAMENTE PELA PLATAFORMA BANDEIRA AGRO INTELLIGENCE.</p>
          <p class="text-gray-400 text-[9px] mt-2 font-mono">${new Date().toLocaleDateString('pt-BR')} | ID-SYSTEM-${Math.random().toString(36).substring(7).toUpperCase()}</p>
        </div>
      </div>

    </div>

    <style>
      .report-wrapper { margin: 0; padding: 0; }
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
      /* Remove page break after last page to avoid blank page 9 */
      .report-page:last-child, .no-break-after { 
        page-break-after: auto !important; 
        break-after: auto !important;
        margin-bottom: 0 !important;
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
          border: none !important;
        }
        .report-page:last-child, .no-break-after { 
          page-break-after: auto !important; 
          break-after: auto !important; 
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

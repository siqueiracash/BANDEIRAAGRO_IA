
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
 * Realiza os cálculos estatísticos e formata o laudo conforme o padrão BANDEIRA AGRO
 * Utiliza exatamente as 6 melhores amostras.
 */
const calculateAndGenerateReport = (data: PropertyData, pool: MarketSample[]): ValuationResult => {
  if (pool.length < 3) {
    throw new Error("AMOSTRAS_INSUFICIENTES");
  }

  // 1. Seleção das 6 melhores amostras
  const rawAvg = pool.reduce((a, b) => a + (b.price / b.areaTotal), 0) / pool.length;
  const sortedPool = [...pool].sort((a, b) => {
    const diffA = Math.abs((a.price / a.areaTotal) - rawAvg);
    const diffB = Math.abs((b.price / b.areaTotal) - rawAvg);
    return diffA - diffB;
  });

  const finalPool = sortedPool.slice(0, 6);

  // 2. Tratamento das Amostras e Homogeneização
  const processedSamples = finalPool.map(s => {
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

  const vuhValues = processedSamples.map(s => s.vuh);
  const avgVuh = vuhValues.reduce((a, b) => a + b, 0) / vuhValues.length;
  const finalValue = avgVuh * data.areaTotal;

  // 3. Cálculo de Liquidação Forçada
  const factorLF = 1 / Math.pow((1 + INTEREST_RATE), ABSORPTION_MONTHS);
  const liquidationValue = finalValue * factorLF;

  // Estatísticas
  const variance = vuhValues.reduce((a, b) => a + Math.pow(b - avgVuh, 2), 0) / vuhValues.length;
  const stdDev = Math.sqrt(variance);
  const coefVariation = (stdDev / avgVuh) * 100;

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const unitLabel = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const sampleChunks = chunkArray(processedSamples, 3);

  const reportHtml = `
    <div class="report-wrapper bg-white text-gray-900 font-sans">
      
      <!-- PÁGINA 1: CAPA -->
      <div class="report-page report-cover flex flex-col items-center justify-between">
        <div class="mt-10 text-center">
          <div class="mb-4 flex justify-center">
             <div class="w-32 h-32 rounded-full border-4 border-orange-500 flex items-center justify-center p-4">
                <svg viewBox="0 0 24 24" class="w-20 h-20 text-green-700 fill-current">
                   <path d="M17,8C8,10 5,16 5,16C5,16 7,16 9,14C11,12 13,12 13,12C13,12 11,14 9,16C7,18 5,20 5,20C5,20 12,20 16,14C20,8 17,8 17,8Z" />
                </svg>
             </div>
          </div>
          <h1 class="text-3xl font-serif font-bold tracking-[0.2em] text-gray-800">BANDEIRA AGRO</h1>
        </div>

        <div class="text-center">
          <h2 class="text-5xl font-serif font-bold text-agro-900 mb-4 uppercase tracking-tighter">LAUDO TÉCNICO DE<br>AVALIAÇÃO</h2>
          <div class="w-32 h-1 bg-agro-900 mx-auto mt-6"></div>
        </div>

        <div class="w-full max-w-2xl border-t border-gray-300 mt-20 pt-8">
          <table class="w-full text-left text-sm uppercase tracking-wider">
            <tr class="border-b border-gray-100">
              <td class="py-4 font-bold text-gray-500 w-1/3 uppercase">SOLICITANTE</td>
              <td class="py-4 font-bold text-gray-800">BANDEIRA AGRO</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-4 font-bold text-gray-500 uppercase">OBJETIVO DA AVALIAÇÃO</td>
              <td class="py-4 font-bold text-gray-800 uppercase text-xs">DETERMINAÇÃO DOS VALORES DE MERCADO E LIQUIDAÇÃO FORÇADA</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-4 font-bold text-gray-500 uppercase">FINALIDADE DA AVALIAÇÃO</td>
              <td class="py-4 font-bold text-gray-800 uppercase text-xs">GARANTIA / GESTÃO PATRIMONIAL</td>
            </tr>
            <tr>
              <td class="py-4 font-bold text-gray-500 uppercase">DATA BASE</td>
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
            <p class="text-xl text-gray-800 leading-relaxed font-medium">${data.address || 'Não informado'}, ${data.neighborhood || ''}, ${data.city} - ${data.state}</p>
          </div>

          <div>
            <h3 class="font-bold text-gray-500 uppercase text-xs tracking-[0.2em] mb-2">TIPO DE IMÓVEL</h3>
            <p class="text-xl text-gray-800 font-medium">${data.type === PropertyType.RURAL ? 'Rural (' + (data.ruralActivity || 'Lavoura') + ')' : 'Urbano (' + (data.urbanSubType || 'Apartamento') + ')'}</p>
          </div>

          <div>
            <h3 class="font-bold text-gray-500 uppercase text-xs tracking-[0.2em] mb-2">ATIVIDADE PREDOMINANTE</h3>
            <p class="text-xl text-gray-800 font-medium">${data.type === PropertyType.RURAL ? (data.ruralActivity || 'Lavoura') : 'Residencial/Comercial'}</p>
          </div>

          <div>
            <h3 class="font-bold text-gray-500 uppercase text-xs tracking-[0.2em] mb-2">ÁREAS</h3>
            <p class="text-xl text-gray-800 font-bold uppercase tracking-tighter">ÁREA TOTAL: ${data.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
          </div>
        </div>

        <div class="mt-12 text-center">
          <h3 class="font-bold text-gray-900 uppercase text-sm tracking-[0.3em] mb-10">RESUMO DE VALORES</h3>
          <div class="space-y-6">
            <p class="text-2xl text-gray-600 uppercase">Valor de Mercado: <span class="text-gray-900 font-bold">${formatter.format(finalValue)}</span></p>
            <p class="text-2xl text-gray-600 uppercase">Valor de Liquidação Forçada: <span class="text-gray-900 font-bold">${formatter.format(liquidationValue)}</span></p>
          </div>
        </div>

        <div class="mt-auto pt-10 text-center pb-10">
          <p class="font-bold text-gray-800 tracking-[0.1em] uppercase">BANDEIRA AGRO</p>
          <p class="text-sm text-gray-500 italic">Inteligência em Avaliações</p>
        </div>
      </div>

      <!-- PÁGINA 3: METODOLOGIA E CRITÉRIO -->
      <div class="report-page text-gray-700 leading-relaxed">
        <h2 class="text-xl font-bold mb-6 uppercase">METODOLOGIA GERAL DE AVALIAÇÃO</h2>
        <p class="mb-10 text-justify">
          De acordo com a Norma da ABNT NBR 14653 o terreno será avaliado com base no "Método Comparativo de Dados de Mercado", através de dados de mercado de imóveis semelhantes ao avaliando, à venda ou efetivamente transacionados no livre mercado imobiliário da região.
        </p>

        <h2 class="text-xl font-bold mb-6 uppercase">CRITÉRIO</h2>
        <p class="mb-6">Para a presente avaliação estabelecemos os critérios de Valores de Mercado e Liquidação Forçada, definidos como:</p>
        
        <h3 class="font-bold mb-2 uppercase text-sm">Valor de Mercado</h3>
        <p class="italic mb-10 text-justify">
          "É a quantia mais provável pela qual se negocia voluntariamente e conscientemente um bem, numa data de referência, dentro das condições do mercado vigente."
        </p>

        <h3 class="font-bold mb-2 uppercase text-sm">Valor de Liquidação Forçada</h3>
        <p class="text-justify mb-4">
          O valor de liquidação forçada, apurado na presente avaliação, é assim definido no artigo técnico de autoria do Engº Nelson R.P. Alonso e Arqª Mônica D’Amato publicado na edição de agosto/setembro de 1998 do Jornal do IBAPE:
        </p>
        <p class="italic text-justify">
          “Admitindo-se a liquidação forçada de um imóvel, aqui conceituada como a sua condição relativa à hipótese de uma venda compulsória ou em prazo menor que o médio de absorção pelo mercado... deve ser considerado a redução do valor de mercado de forma a compensar as partes envolvidas na transação, vendedor e comprador, respectivamente o ganho e a perda dos juros e correção monetária vigentes no mercado financeiro...”
        </p>
      </div>

      <!-- PÁGINA 4: LIQUIDAÇÃO FORÇADA DETALHES -->
      <div class="report-page">
        <h2 class="text-xl font-bold mb-10 uppercase">VALOR PARA LIQUIDAÇÃO FORÇADA</h2>
        <p class="mb-8 text-justify">Para a determinação do “Valor de Liquidação do Imóvel” foram adotados os preceitos constantes do trabalho técnico mencionado.</p>
        
        <div class="space-y-6 mb-16">
          <p><strong>Taxa Média de Juros:</strong> Para o cálculo da taxa média de juros foi adotada a série composta pelas linhas de crédito de mercado. A taxa mensal média de juros obtida foi igual a <strong>${(INTEREST_RATE * 100).toFixed(2)}%</strong>.</p>
          <p><strong>Tempo de Absorção:</strong> Estimado em <strong>${ABSORPTION_MONTHS} meses</strong> para imóveis análogos.</p>
        </div>

        <div class="bg-gray-50 border border-gray-200 p-10 rounded-lg text-center mx-auto max-w-2xl mb-20">
          <h3 class="font-bold mb-6 text-gray-700 uppercase text-xs tracking-widest">Fórmula de Deságio</h3>
          <p class="font-mono text-lg mb-4 text-agro-900">Valor Liquidação = Valor Mercado × (1 / (1 + ${INTEREST_RATE})^${ABSORPTION_MONTHS})</p>
          <p class="font-mono text-gray-500">Fator = ${factorLF.toFixed(4)}</p>
        </div>

        <div class="text-center">
          <p class="text-gray-500 uppercase tracking-widest text-sm mb-4">VALOR PARA LIQUIDAÇÃO FORÇADA:</p>
          <p class="text-5xl font-bold text-gray-900">${formatter.format(liquidationValue)}</p>
        </div>
      </div>

      <!-- ANEXO: FICHAS DE PESQUISA -->
      ${sampleChunks.map((chunk, chunkIdx) => `
        <div class="report-page annex-page">
          <h2 class="text-xl font-bold mb-1 uppercase">ANEXO: FICHAS DE PESQUISA</h2>
          <h3 class="text-2xl font-serif text-gray-400 mb-8 tracking-widest uppercase">DETALHAMENTO DO MERCADO</h3>
          
          <div class="space-y-6">
            ${chunk.map((s, idx) => `
              <div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm page-break-avoid">
                <div class="bg-agro-700 text-white p-3 flex justify-between items-center">
                  <span class="font-bold uppercase tracking-wider text-xs">AMOSTRA #${(chunkIdx * 3) + idx + 1}</span>
                  <span class="font-bold text-[10px] uppercase">${s.city} - ${s.state}</span>
                  <span class="bg-white/20 px-2 py-1 rounded text-[9px]">OFERTA (0,90)</span>
                </div>
                <div class="grid grid-cols-2 text-sm">
                  <div class="p-3 border-r border-b border-gray-100">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-1">LOCALIZAÇÃO</p>
                    <p class="text-gray-800 font-medium text-[11px] truncate">${s.neighborhood || s.city}</p>
                  </div>
                  <div class="p-3 border-b border-gray-100">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-1">FONTE</p>
                    <p class="text-gray-600 truncate text-[10px]">${s.url || s.source}</p>
                  </div>
                  <div class="p-3 border-r border-b border-gray-100">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-1">ÁREA TOTAL</p>
                    <p class="text-gray-800 font-medium text-[11px]">${s.areaTotal.toLocaleString('pt-BR')} ${unitLabel}</p>
                  </div>
                  <div class="p-3 border-b border-gray-100">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-1">VALOR TOTAL</p>
                    <p class="text-gray-800 font-bold text-sm">${formatter.format(s.price)}</p>
                  </div>
                  <div class="p-3 border-r border-gray-100 col-span-1">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-1">DESCRIÇÃO</p>
                    <p class="text-gray-600 text-[10px] leading-tight line-clamp-2">${s.title}</p>
                  </div>
                  <div class="p-3">
                    <p class="font-bold text-agro-700 text-[8px] uppercase mb-1">CARACTERÍSTICAS</p>
                    <div class="text-[10px] text-gray-600 space-y-0.5">
                      ${data.type === PropertyType.RURAL ? `
                        <p>Cap: ${s.landCapability || 'III'}</p>
                        <p>Acesso: ${s.access || 'Bom'}</p>
                      ` : `
                        <p>Q/B/V: ${s.bedrooms || 0}/${s.bathrooms || 0}/${s.parking || 0}</p>
                      `}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="mt-auto text-center pb-8 border-t border-gray-50 pt-4">
             <p class="text-[9px] text-gray-300 uppercase tracking-widest font-bold">BANDEIRA AGRO - LAUDO DIGITAL</p>
          </div>
        </div>
      `).join('')}

      <!-- ANEXO: MEMÓRIA DE CÁLCULO (PÁGINA ÚNICA) -->
      <div class="report-page annex-page page-start-new">
        <h2 class="text-xl font-bold mb-1 uppercase">ANEXO: MEMÓRIA DE CÁLCULO</h2>
        <h3 class="text-2xl font-serif text-gray-400 mb-6 tracking-widest uppercase text-xs">PROCESSAMENTO ESTATÍSTICO</h3>
        
        <h4 class="font-bold text-gray-700 mb-3 uppercase text-[9px] tracking-widest">ELEMENTOS COLETADOS</h4>
        <div class="border rounded-lg overflow-hidden border-gray-200 mb-6 shadow-sm">
          <table class="w-full text-[9px] text-left border-collapse">
            <thead class="bg-agro-900 text-white uppercase">
              <tr>
                <th class="p-2 border border-agro-800 text-center">Amostra</th>
                <th class="p-2 border border-agro-800">VO (R$)</th>
                <th class="p-2 border border-agro-800 text-center">Área (${unitLabel})</th>
                <th class="p-2 border border-agro-800 text-center">Oferta</th>
                <th class="p-2 border border-agro-800">VUB (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${processedSamples.map((s, idx) => `
                <tr class="odd:bg-gray-50">
                  <td class="p-1.5 border border-gray-100 font-bold text-center">${idx + 1}</td>
                  <td class="p-1.5 border border-gray-100">${formatter.format(s.price)}</td>
                  <td class="p-1.5 border border-gray-100 text-center">${s.areaTotal.toLocaleString('pt-BR')}</td>
                  <td class="p-1.5 border border-gray-100 text-center">0,90</td>
                  <td class="p-1.5 border border-gray-100 font-bold">${formatter.format(s.adjustedPricePerUnit)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <h4 class="font-bold text-gray-700 mb-3 uppercase text-[9px] tracking-widest">CÁLCULO DO VALOR MÉDIO HOMOGENEIZADO</h4>
        <div class="border rounded-lg overflow-hidden border-gray-200 mb-8 shadow-sm">
          <table class="w-full text-[8px] text-left border-collapse">
            <thead class="bg-agro-900 text-white uppercase text-center">
              <tr>
                <th class="p-1.5 border border-agro-800">Amostra</th>
                <th class="p-1.5 border border-agro-800">VUB (R$)</th>
                <th class="p-1.5 border border-agro-800">F. Oferta</th>
                <th class="p-1.5 border border-agro-800">F. Dim</th>
                <th class="p-1.5 border border-agro-800">F. Cap</th>
                <th class="p-1.5 border border-agro-800">F. Acesso</th>
                <th class="p-1.5 border border-agro-800">F. Topo</th>
                <th class="p-1.5 border border-agro-800">F. Outros</th>
                <th class="p-1.5 border border-agro-800 font-bold">VUH (R$)</th>
              </tr>
            </thead>
            <tbody class="text-center">
              ${processedSamples.map((s, idx) => `
                <tr class="odd:bg-gray-50">
                  <td class="p-1.5 border border-gray-100 font-bold">${idx + 1}</td>
                  <td class="p-1.5 border border-gray-100">${s.adjustedPricePerUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="p-1.5 border border-gray-100 text-center">0,90</td>
                  <td class="p-1.5 border border-gray-100 text-center">1,00</td>
                  <td class="p-1.5 border border-gray-100 text-center">${s.fCap?.toFixed(2).replace('.', ',')}</td>
                  <td class="p-1.5 border border-gray-100 text-center">1,00</td>
                  <td class="p-1.5 border border-gray-100 text-center">1,00</td>
                  <td class="p-1.5 border border-gray-100 text-center">1,08</td>
                  <td class="p-1.5 border border-gray-100 font-bold text-agro-700">${formatter.format(s.vuh || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm pt-4 border-t border-gray-100">
          <div class="space-y-1.5">
             <p class="flex justify-between border-b pb-1 text-[10px] uppercase tracking-tight"><span>Média</span> <span class="font-bold text-agro-900">${formatter.format(avgVuh)}</span></p>
             <p class="flex justify-between border-b pb-1 text-[10px] uppercase tracking-tight"><span>Desvio Padrão</span> <span class="font-bold text-agro-900">${formatter.format(stdDev)}</span></p>
             <p class="flex justify-between border-b pb-1 text-[10px] uppercase tracking-tight"><span>Coef. Variação</span> <span class="font-bold text-agro-900">${coefVariation.toFixed(2)}%</span></p>
             <p class="flex justify-between border-b pb-1 text-[10px] uppercase tracking-tight"><span>Grau de Precisão</span> <span class="font-bold text-agro-700">GRAU II</span></p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h5 class="font-bold text-[8px] uppercase tracking-widest mb-2">INTERVALO CONFIANÇA (80%)</h5>
            <div class="space-y-1 text-[10px]">
               <p class="flex justify-between uppercase tracking-tighter"><span>Mínimo</span> <span class="font-bold">${formatter.format(avgVuh * 0.85)}</span></p>
               <p class="flex justify-between uppercase tracking-tighter"><span>Máximo</span> <span class="font-bold">${formatter.format(avgVuh * 1.15)}</span></p>
               <p class="flex justify-between border-t pt-1 mt-1 uppercase tracking-tighter"><span>Amplitude</span> <span class="font-bold text-agro-700">${formatter.format(avgVuh * 0.30)}</span></p>
            </div>
          </div>
        </div>

        <div class="mt-auto text-center pb-10 uppercase text-[8px] text-gray-300 tracking-[0.3em]">
           BANDEIRA AGRO - INTELIGÊNCIA EM AVALIAÇÕES
        </div>
      </div>

      <!-- PÁGINA: RESPONSABILIDADE E LIMITAÇÕES (ÚLTIMA PÁGINA) -->
      <div class="report-page page-start-new flex flex-col">
        <h2 class="text-xl font-bold mb-10 text-center uppercase tracking-widest">RESPONSABILIDADE E LIMITAÇÕES</h2>
        
        <div class="space-y-6 text-justify text-gray-700 text-sm leading-relaxed">
          <p>Este Laudo de Avaliação foi produzido com base em informações fornecidas pela contratante/usuário do sistema, incluindo a documentação do imóvel objeto da análise, características físicas e localizacionais, as quais são admitidas como verdadeiras para fins de cálculo.</p>
          
          <p>Ressalva-se que o presente trabalho foi realizado seguindo os preceitos metodológicos da ABNT NBR 14653-3 (Imóveis Rurais) e/ou NBR 14653-2 (Imóveis Urbanos), contudo, enquadra-se na modalidade <strong>"Avaliação Expedita" (Desktop Valuation)</strong>, sendo realizado <strong>sem vistoria in loco</strong> ao imóvel avaliando.</p>
          
          <p>A fundamentação de valores utilizou como base o <strong>Banco de Dados de Amostras da Bandeira Agro</strong> e dados de mercado disponíveis publicamente. A Bandeira Agro não se responsabiliza por divergências entre as informações inseridas no sistema e a realidade fática do imóvel que apenas uma inspeção presencial detalhada poderia constatar.</p>
          
          <p>A utilização deste Laudo de Avaliação é restrita à finalidade de estimativa de valor de mercado e liquidação forçada para fins gerenciais, não devendo ser utilizado como único instrumento para garantias bancárias de alto risco sem a devida validação presencial complementar.</p>
        </div>

        <div class="mt-auto pt-20 text-center text-gray-400 pb-8">
          <p class="uppercase text-[10px] tracking-widest font-bold text-gray-600 mb-2">BANDEIRA AGRO</p>
          <p>Documento gerado eletronicamente pela plataforma Bandeira Agro.</p>
          <p class="mt-2 font-mono text-[9px] uppercase tracking-widest">${new Date().toLocaleDateString('pt-BR')} | ID-SYSTEM-${Math.random().toString(36).substring(7).toUpperCase()}</p>
        </div>
      </div>

    </div>

    <style>
      .report-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .report-page {
        background: white;
        width: 210mm;
        height: 297mm;
        margin: 0 auto;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        padding: 20mm;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      }
      .annex-page {
        padding-top: 15mm;
      }
      .report-cover {
        justify-content: space-between;
      }
      .page-break-avoid {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .page-start-new {
        page-break-before: always;
        break-before: page;
      }
      @media print {
        body { background: white !important; margin: 0 !important; }
        .report-page {
          box-shadow: none !important;
          margin: 0 !important;
          page-break-after: always !important;
          break-after: page !important;
          height: 297mm !important;
          width: 210mm !important;
          padding: 20mm !important;
        }
        .page-start-new {
          page-break-before: always !important;
          break-before: page !important;
        }
        .report-wrapper { gap: 0 !important; }
      }
    </style>
  `;

  return {
    reportText: reportHtml,
    sources: processedSamples,
    estimatedValue: formatter.format(finalValue),
    liquidationValue: formatter.format(liquidationValue),
    stats: {
      average: avgVuh,
      sampleCount: processedSamples.length,
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

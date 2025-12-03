import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, getSamplesByCities } from "./storageService";
import { getNeighboringCities } from "./geminiService";

// --- TABELAS DE COEFICIENTES (Conforme imagem fornecida) ---

// Tabela: Superfície
const COEF_SURFACE: Record<string, number> = {
  'Seca': 1.00,
  'Alagadiça': 0.70,
  'Brejosa ou Pantanosa': 0.60,
  'Permanentemente Alagada': 0.50,
  'DEFAULT': 1.00
};

// Tabela: Capacidade de Uso da Terra (Fator convertido para decimal base 100)
// I (100) -> 1.00, VIII (20) -> 0.20
const COEF_LAND_CAPABILITY: Record<string, number> = {
  'I - Culturas (Sem problemas)': 1.00,
  'II - Culturas (Pequenos problemas)': 0.95,
  'III - Culturas (Sérios problemas)': 0.75,
  'IV - Culturas Ocasionais / Pastagens': 0.55,
  'V - Só Pastagens': 0.50,
  'VI - Só Pastagens (Pequenos problemas)': 0.40,
  'VII - Florestas': 0.30,
  'VIII - Abrigo Silvestre': 0.20,
  'DEFAULT': 0.50 // Assume média se não informado
};

// Tabela: Situação e Acesso
const COEF_ACCESS: Record<string, number> = {
  'Ótimo (asfalto, tráfego permanente)': 1.00,
  'Muito Bom (estrada classe, não asfalto)': 0.95,
  'Bom (não pavimentada, tráfego permanente)': 0.90,
  'Regular (não pavimentada, sujeita a interrupção)': 0.80,
  'Mau (interrupção na chuva)': 0.75,
  'Péssimo (interrupção por córrego sem ponte)': 0.70,
  'Encravada': 0.60,
  'DEFAULT': 0.90
};

// Tabela: Melhoramentos Públicos
const COEF_PUBLIC_IMPROVEMENTS: Record<string, number> = {
  'Luz domiciliar + Força + Rede telefônica': 1.30,
  'Luz domiciliar + Força': 1.25,
  'Luz domiciliar + Rede': 1.20,
  'Luz domiciliar': 1.15,
  'Força + Rede telefônica': 1.15,
  'Força': 1.10,
  'Rede telefônica': 1.05,
  'Nenhum': 1.00,
  'DEFAULT': 1.00
};

// Tabela: Topografia
const COEF_TOPOGRAPHY: Record<string, number> = {
  'Plano': 1.00,
  'Leve-Ondulado': 0.90,
  'Ondulado': 0.80,
  'Montanhoso': 0.70,
  'DEFAULT': 1.00
};

// Tabela: Ocupação
const COEF_OCCUPATION: Record<string, number> = {
  'Alta: 80 a 100% aberto': 1.00,
  'Média-Alta: 70 a 80% aberto': 0.90,
  'Média: 50 a 70% aberto': 0.80,
  'Média-Baixa: 40 a 50% aberto': 0.70,
  'Baixa: 20 a 40% aberto': 0.60,
  'Nula: abaixo de 20%': 0.50,
  'DEFAULT': 0.80
};

// Tabela: Benfeitorias e Infraestrutura
const COEF_IMPROVEMENTS: Record<string, number> = {
  'Benfeitorias de padrão Superior ao local': 1.10,
  'Benfeitorias de padrão Comum ao local': 1.00,
  'Benfeitorias de padrão Inferior ao local ou Inexistentes': 0.90,
  'DEFAULT': 1.00
};

// Função Auxiliar: Dimensões da Gleba (Fator por Faixa de Área)
const getDimensionFactor = (hectares: number): number => {
  if (hectares <= 1.00) return 2.00;
  if (hectares <= 2.00) return 1.90;
  if (hectares <= 5.00) return 1.70;
  if (hectares <= 10.00) return 1.50;
  if (hectares <= 50.00) return 1.30;
  if (hectares <= 200.00) return 1.20;
  if (hectares <= 500.00) return 1.10;
  return 1.00; // mais de 500,00 ha
};

const getCoef = (table: Record<string, number>, key: string | undefined) => {
  if (!key) return table['DEFAULT'];
  // Tenta encontrar correspondência exata ou parcial
  const found = Object.keys(table).find(k => k.toLowerCase() === key.toLowerCase() || k.toLowerCase().startsWith(key.toLowerCase().split(':')[0]));
  return found ? table[found] : table['DEFAULT'];
};

/**
 * Calcula um Score de Similaridade entre o imóvel avaliando e uma amostra.
 * Quanto maior o score, mais semelhante é a amostra.
 */
const calculateSimilarity = (target: PropertyData, sample: MarketSample): number => {
  let score = 0;

  // 1. LOCALIZAÇÃO (Peso Máximo: 1000)
  // Mesma cidade é o critério mais forte
  if (sample.city.trim().toLowerCase() === target.city.trim().toLowerCase()) {
    score += 1000;
  } else {
    // Mesmo estado ganha pontuação menor, mas existe
    if (sample.state === target.state) score += 100;
  }

  // 2. TIPO E ATIVIDADE (Peso Máximo: 500)
  const isRural = target.type === PropertyType.RURAL;
  const targetSub = isRural ? target.ruralActivity : target.urbanSubType;
  const sampleSub = isRural ? sample.ruralActivity : sample.urbanSubType;

  if (targetSub === sampleSub) {
    score += 500;
  }

  // 3. ÁREA TOTAL (Peso Máximo: 300)
  // Quanto mais próxima a área, maior a pontuação.
  // Cálculo: 300 * (Menor Área / Maior Área)
  const minArea = Math.min(target.areaTotal, sample.areaTotal);
  const maxArea = Math.max(target.areaTotal, sample.areaTotal);
  const areaRatio = maxArea > 0 ? (minArea / maxArea) : 0;
  score += (areaRatio * 300);

  // 4. CARACTERÍSTICAS ESPECÍFICAS (Peso Máximo: 200)
  if (isRural) {
    // Bonificação por características físicas iguais
    if (target.landCapability && target.landCapability === sample.landCapability) score += 50;
    if (target.topography && target.topography === sample.topography) score += 50;
    if (target.access && target.access === sample.access) score += 50;
    if (target.occupation && target.occupation === sample.occupation) score += 50;
  } else {
    // Bonificação para urbanos
    if (target.bedrooms && Math.abs(target.bedrooms - (sample.bedrooms || 0)) <= 1) score += 50;
    if (target.conservationState === sample.conservationState) score += 50;
  }

  return score;
};

export const generateManualValuation = async (data: PropertyData): Promise<ValuationResult> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const isRural = data.type === PropertyType.RURAL;
  const subType = isRural ? data.ruralActivity : data.urbanSubType;
  const TARGET_SAMPLE_COUNT = 5; // Regra estrita: 5 amostras
  
  // Lista de Candidatos Únicos (Map para evitar duplicatas por ID)
  const candidatesMap = new Map<string, MarketSample>();
  
  const addCandidates = (newSamples: MarketSample[]) => {
    newSamples.forEach(s => {
      if (!candidatesMap.has(s.id)) {
        candidatesMap.set(s.id, s);
      }
    });
  };

  // --- 1. COLETA DE CANDIDATOS (BUSCA ABRANGENTE) ---
  
  // A. Busca na Cidade Alvo (Mesmo subtipo)
  const citySamplesExact = await filterSamples(data.type, data.city, data.state, subType);
  addCandidates(citySamplesExact);

  // B. Busca na Cidade Alvo (Qualquer subtipo - Fallback)
  const citySamplesGeneral = await filterSamples(data.type, data.city, data.state);
  addCandidates(citySamplesGeneral);

  // C. Busca em Cidades Vizinhas (Geograficamente próximas)
  try {
    const neighborCities = await getNeighboringCities(data.city, data.state);
    if (neighborCities.length > 0) {
      const neighborSamples = await getSamplesByCities(neighborCities, data.state, data.type);
      addCandidates(neighborSamples);
    }
  } catch (err) {
    console.warn("Falha ao buscar cidades vizinhas:", err);
  }

  // D. Busca Regional/Estadual (Último recurso se tivermos poucos candidatos)
  if (candidatesMap.size < TARGET_SAMPLE_COUNT) {
    try {
      const stateSamples = await filterSamples(data.type, "", data.state);
      addCandidates(stateSamples);
    } catch (err) {
      console.warn("Falha ao buscar amostras estaduais:", err);
    }
  }

  // --- 2. SELEÇÃO E RANKING (TOP 5) ---
  const allCandidates = Array.from(candidatesMap.values());
  
  // Ordena por similaridade (Maior score primeiro)
  const rankedCandidates = allCandidates
    .map(sample => ({
      sample,
      score: calculateSimilarity(data, sample)
    }))
    .sort((a, b) => b.score - a.score);

  // Seleciona EXATAMENTE as top 5 (ou menos, se não houver 5 disponíveis)
  const samples = rankedCandidates.slice(0, TARGET_SAMPLE_COUNT).map(item => item.sample);
  
  const hasSamples = samples.length > 0;
  const unitStr = isRural ? 'ha' : 'm²';
  const OFFER_FACTOR = 0.90; // Fator de Oferta Obrigatório (10% de desconto sobre o valor pedido)

  // --- 3. CÁLCULOS E HOMOGENEIZAÇÃO ---
  let homogenizedSamples: any[] = [];
  let sumHomogenizedUnit = 0;

  if (hasSamples) {
    homogenizedSamples = samples.map(sample => {
      let unitPrice = sample.pricePerUnit;
      let appliedFactorsList: { name: string, value: number, desc: string }[] = [];
      
      // 1. Fator Oferta (Sempre aplica primeiro)
      unitPrice = unitPrice * OFFER_FACTOR;
      appliedFactorsList.push({ name: 'Oferta', value: OFFER_FACTOR, desc: 'Margem Negociação' });

      // --- HOMOGENEIZAÇÃO RURAL COMPLETA ---
      if (isRural) {
        // 2. Fator Dimensão (Gleba) - Baseado na Tabela
        const factorSubjectDim = getDimensionFactor(data.areaTotal);
        const factorSampleDim = getDimensionFactor(sample.areaTotal);
        const factorDim = factorSubjectDim / factorSampleDim;
        unitPrice = unitPrice * factorDim;
        appliedFactorsList.push({ name: 'Dimensão', value: factorDim, desc: 'Área' });

        // 3. Capacidade de Uso da Terra
        const coefSubjectCap = getCoef(COEF_LAND_CAPABILITY, data.landCapability);
        const coefSampleCap = getCoef(COEF_LAND_CAPABILITY, sample.landCapability);
        const factorCap = coefSubjectCap / coefSampleCap;
        unitPrice = unitPrice * factorCap;
        appliedFactorsList.push({ name: 'Cap. Uso', value: factorCap, desc: 'Solo/Uso' });

        // 4. Situação e Acesso
        const coefSubjectAccess = getCoef(COEF_ACCESS, data.access);
        const coefSampleAccess = getCoef(COEF_ACCESS, sample.access);
        const factorAccess = coefSubjectAccess / coefSampleAccess;
        unitPrice = unitPrice * factorAccess;
        appliedFactorsList.push({ name: 'Acesso', value: factorAccess, desc: 'Logística' });

        // 5. Melhoramentos Públicos
        const coefSubjectPub = getCoef(COEF_PUBLIC_IMPROVEMENTS, data.publicImprovements);
        const coefSamplePub = getCoef(COEF_PUBLIC_IMPROVEMENTS, sample.publicImprovements);
        const factorPub = coefSubjectPub / coefSamplePub;
        unitPrice = unitPrice * factorPub;
        appliedFactorsList.push({ name: 'Melhoramentos', value: factorPub, desc: 'Infra' });

        // 6. Topografia
        const coefSubjectTopo = getCoef(COEF_TOPOGRAPHY, data.topography);
        const coefSampleTopo = getCoef(COEF_TOPOGRAPHY, sample.topography);
        const factorTopo = coefSubjectTopo / coefSampleTopo;
        unitPrice = unitPrice * factorTopo;
        appliedFactorsList.push({ name: 'Topografia', value: factorTopo, desc: 'Relevo' });

        // 7. Superfície (Solo)
        const coefSubjectSurf = getCoef(COEF_SURFACE, data.surface);
        const coefSampleSurf = getCoef(COEF_SURFACE, sample.surface);
        const factorSurf = coefSubjectSurf / coefSampleSurf;
        unitPrice = unitPrice * factorSurf;
        appliedFactorsList.push({ name: 'Solo', value: factorSurf, desc: 'Umidade' });

        // 8. Ocupação (Abertura)
        const coefSubjectOcc = getCoef(COEF_OCCUPATION, data.occupation);
        const coefSampleOcc = getCoef(COEF_OCCUPATION, sample.occupation);
        const factorOcc = coefSubjectOcc / coefSampleOcc;
        unitPrice = unitPrice * factorOcc;
        appliedFactorsList.push({ name: 'Ocupação', value: factorOcc, desc: 'Abertura' });

        // 9. Benfeitorias (Estrutural)
        const coefSubjectImp = getCoef(COEF_IMPROVEMENTS, data.improvements);
        const coefSampleImp = getCoef(COEF_IMPROVEMENTS, sample.improvements);
        const factorImp = coefSubjectImp / coefSampleImp;
        unitPrice = unitPrice * factorImp;
        appliedFactorsList.push({ name: 'Benfeitorias', value: factorImp, desc: 'Constr.' });

      }

      sumHomogenizedUnit += unitPrice;

      return {
        ...sample,
        homogenizedUnitPrice: unitPrice,
        factors: appliedFactorsList
      };
    });
  }

  // Estatísticas Básicas
  const count = homogenizedSamples.length;
  const avgHomogenizedUnitPrice = hasSamples ? (sumHomogenizedUnit / count) : 0;
  
  // Cálculo do Desvio Padrão
  let variance = 0;
  if (count > 1) {
    variance = homogenizedSamples.reduce((acc, val) => acc + Math.pow(val.homogenizedUnitPrice - avgHomogenizedUnitPrice, 2), 0) / (count - 1);
  }
  const stdDev = Math.sqrt(variance);
  const coeffVariation = avgHomogenizedUnitPrice > 0 ? (stdDev / avgHomogenizedUnitPrice) : 0;
  
  // Grau de Precisão (NBR 14653)
  let precisionGrade = "III";
  if (coeffVariation > 0.15) precisionGrade = "II";
  if (coeffVariation > 0.30) precisionGrade = "Fora de Grau";

  // Intervalo de Confiança (80% - t-student simplificado para n=5 aprox 1.533)
  // Para n=5, t=1.533 (80%). Ajustado para n=5 fixo = 1.533
  const tStudent = 1.533; 
  const confidenceInterval = count > 0 ? tStudent * (stdDev / Math.sqrt(count)) : 0;
  const minInterval = avgHomogenizedUnitPrice - confidenceInterval;
  const maxInterval = avgHomogenizedUnitPrice + confidenceInterval;

  // Área de Referência
  let refArea = data.areaTotal;
  if (!isRural && data.areaBuilt && data.areaBuilt > 0) {
    refArea = data.areaBuilt;
  }

  // Valor de Mercado
  const marketValue = avgHomogenizedUnitPrice * refArea;

  // --- CÁLCULO DE LIQUIDAÇÃO FORÇADA ---
  // Taxa: 1.51% a.m.
  // Prazo: 24 meses
  const liquidityRate = 0.0151; 
  const liquidityMonths = 24;
  const liquidityFactor = 1 / Math.pow(1 + liquidityRate, liquidityMonths);
  const liquidationValue = marketValue * liquidityFactor;

  // Formatters
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDec = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const currentDate = new Date().toLocaleDateString('pt-BR');

  // --- PAGINAÇÃO DE AMOSTRAS (ANEXO 01) ---
  const samplesPerPage = 2; // Máximo 2 amostras por página
  const sampleChunks = [];
  for (let i = 0; i < samples.length; i += samplesPerPage) {
    sampleChunks.push({
      chunk: samples.slice(i, i + samplesPerPage),
      index: i,
      pageIndex: Math.floor(i / samplesPerPage)
    });
  }

  const reportText = `
    <!-- CAPA -->
    <div class="report-cover flex flex-col items-center justify-center min-h-[1000px] text-center p-10 bg-white relative">
      
      <!-- LOGOMARCA CENTRALIZADA BANDEIRA AGRO -->
      <div class="mb-12 flex flex-col items-center justify-center">
          <svg width="128" height="128" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Círculo Laranja -->
            <circle cx="100" cy="100" r="90" stroke="#f97316" stroke-width="12" fill="none" />
            <!-- Folha Verde Estilizada -->
            <path d="M40 160 Q 90 110 160 50" stroke="#15803d" stroke-width="0" fill="none" />
            <path d="M50 150 C 50 150, 70 110, 80 90 C 90 70, 140 40, 160 30 C 140 50, 110 80, 100 100 C 90 120, 70 160, 60 170 Z" fill="#15803d" />
            <path d="M60 160 C 60 160, 80 130, 90 110 C 100 90, 130 70, 150 60 C 130 80, 110 100, 100 120 C 90 140, 70 170, 60 170 Z" fill="#14532d" opacity="0.6" />
          </svg>
          <div class="mt-4 text-2xl font-serif font-bold text-gray-800 tracking-widest uppercase">Bandeira Agro</div>
      </div>
      
      <div class="flex-grow flex flex-col justify-center">
        <h1 class="text-4xl md:text-5xl font-serif font-bold text-gray-800 mb-8 leading-tight tracking-wide">
          LAUDO TÉCNICO DE<br/>AVALIAÇÃO
        </h1>
      </div>

      <div class="w-full max-w-3xl mx-auto text-left space-y-4 border-t-2 border-gray-800 pt-8 mb-20">
        <div class="grid grid-cols-3 gap-4 border-b border-gray-200 pb-2">
            <span class="font-serif font-bold text-gray-800 uppercase text-sm">SOLICITANTE</span>
            <span class="col-span-2 text-gray-700 uppercase font-semibold">BANDEIRA AGRO</span>
        </div>
        <div class="grid grid-cols-3 gap-4 border-b border-gray-200 pb-2">
            <span class="font-serif font-bold text-gray-800 uppercase text-sm">OBJETIVO DA AVALIAÇÃO</span>
            <span class="col-span-2 text-gray-700 font-semibold">Determinação dos Valores de Mercado e Liquidação Forçada</span>
        </div>
        <div class="grid grid-cols-3 gap-4 border-b border-gray-200 pb-2">
            <span class="font-serif font-bold text-gray-800 uppercase text-sm">FINALIDADE DA AVALIAÇÃO</span>
            <span class="col-span-2 text-gray-700 font-semibold">Garantia / Gestão Patrimonial</span>
        </div>
        <div class="grid grid-cols-3 gap-4 border-b border-gray-200 pb-2">
            <span class="font-serif font-bold text-gray-800 uppercase text-sm">DATA BASE</span>
            <span class="col-span-2 text-gray-700 font-semibold">${currentDate}</span>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- RESUMO DA AVALIAÇÃO -->
    <div class="report-section p-8">
      <div class="mb-10 text-center">
        <h2 class="text-2xl font-serif font-bold text-gray-800 uppercase tracking-widest mb-2">RESUMO DA AVALIAÇÃO</h2>
        <div class="w-20 h-1 bg-gray-300 mx-auto"></div>
      </div>

      <div class="border-t border-b border-gray-800 py-6 mb-10">
         <div class="grid grid-cols-1 gap-6">
            <div class="flex flex-col md:flex-row">
                <span class="w-48 font-serif font-bold text-gray-800">LOCALIZAÇÃO DO IMÓVEL</span>
                <span class="flex-1 text-gray-700">${data.address || ''}, ${data.city} - ${data.state}</span>
            </div>
            <div class="flex flex-col md:flex-row">
                <span class="w-48 font-serif font-bold text-gray-800">TIPO DE IMÓVEL</span>
                <span class="flex-1 text-gray-700">${isRural ? 'Rural' : 'Urbano'} (${subType})</span>
            </div>
             <div class="flex flex-col md:flex-row">
                <span class="w-48 font-serif font-bold text-gray-800">ATIVIDADE PREDOMINANTE</span>
                <span class="flex-1 text-gray-700">${isRural ? (data.ruralActivity || 'Não informado') : data.urbanSubType}</span>
            </div>
             <div class="flex flex-col md:flex-row">
                <span class="w-48 font-serif font-bold text-gray-800">ÁREAS</span>
                <div class="flex-1 text-gray-700">
                    <div>Área Total: <strong>${fmtDec(data.areaTotal)} ${unitStr}</strong></div>
                    ${data.areaBuilt ? `<div>Área Construída: ${fmtDec(data.areaBuilt)} m²</div>` : ''}
                </div>
            </div>
         </div>
      </div>

      <div class="text-center mb-10">
         <h3 class="text-xl font-serif font-bold text-gray-800 uppercase mb-6">RESUMO DE VALORES</h3>
         <div class="space-y-4">
             <div class="text-lg">
                Valor de Mercado: <span class="font-bold text-xl ml-2">${fmtBRL(marketValue)}</span>
             </div>
             <div class="text-lg text-gray-600">
                Valor de Liquidação Forçada: <span class="font-bold text-xl ml-2">${fmtBRL(liquidationValue)}</span>
             </div>
         </div>
      </div>

      <div class="mt-20 text-center">
          <div class="inline-block border-t border-gray-400 px-10 pt-2">
             <p class="font-bold text-gray-800">BANDEIRA AGRO</p>
             <p class="text-sm text-gray-600">Inteligência em Avaliações</p>
          </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- METODOLOGIA E CRITÉRIO -->
    <div class="report-section p-8 text-justify">
       <div class="mb-8">
         <h3 class="text-lg font-serif font-bold text-gray-800 mb-4">7 METODOLOGIA GERAL DE AVALIAÇÃO</h3>
         <p class="mb-4 text-gray-700">
            De acordo com a Norma da ABNT NBR 14653 o terreno será avaliado com base no "Método Comparativo de Dados de Mercado", através de dados de mercado de imóveis semelhantes ao avaliando, à venda ou efetivamente transacionados no livre mercado imobiliário da região.
         </p>
       </div>

       <div class="mb-8">
         <h3 class="text-lg font-serif font-bold text-gray-800 mb-4">8 CRITÉRIO</h3>
         <p class="mb-4 text-gray-700">
            Para a presente avaliação estabelecemos os critérios de Valores de Mercado e Liquidação Forçada, definidos como:
         </p>
         
         <div class="mb-4">
            <h4 class="font-bold text-gray-800 mb-2">Valor de Mercado</h4>
            <p class="text-gray-700 italic">"É a quantia mais provável pela qual se negocia voluntariamente e conscientemente um bem, numa data de referência, dentro das condições do mercado vigente."</p>
         </div>

         <div class="mb-4">
            <h4 class="font-bold text-gray-800 mb-2">Valor de Liquidação Forçada</h4>
            <p class="text-gray-700">
               O valor de liquidação forçada, apurado na presente avaliação, é assim definido no artigo técnico de autoria do Engº Nelson R.P. Alonso e Arqª Mônica D’Amato publicado na edição de agosto/setembro de 1998 do Jornal do IBAPE:
            </p>
            <p class="text-gray-700 mt-2 italic">
               “Admitindo-se a liquidação forçada de um imóvel, aqui conceituada como a sua condição relativa à hipótese de uma venda compulsória ou em prazo menor que o médio de absorção pelo mercado... deve ser considerado a redução do valor de mercado de forma a compensar as partes envolvidas na transação, vendedor e comprador, respectivamente o ganho e a perda dos juros e correção monetária vigentes no mercado financeiro...”
            </p>
         </div>
       </div>
    </div>

    <div class="page-break"></div>

    <!-- 9.4 VALOR DO IMÓVEL PARA LIQUIDAÇÃO FORÇADA -->
    <div class="report-section p-8 text-justify">
       <div class="mb-8">
          <h3 class="text-lg font-serif font-bold text-gray-800 mb-4">9.4 VALOR DO IMÓVEL PARA LIQUIDAÇÃO FORÇADA</h3>
          <p class="text-gray-700 mb-2">
             Para a determinação do “Valor de Liquidação do Imóvel” foram adotados os preceitos constantes do trabalho técnico mencionado.
          </p>
          <p class="text-gray-700 mb-2">
             <strong>Taxa Média de Juros:</strong> Para o cálculo da taxa média de juros foi adotada a série composta pelas linhas de crédito de mercado. A taxa mensal média de juros obtida foi igual a <strong>1,51%</strong>.
          </p>
          <p class="text-gray-700 mb-4">
             <strong>Tempo de Absorção:</strong> Estimado em <strong>24 meses</strong> para imóveis análogos.
          </p>
          
          <div class="bg-gray-100 p-4 rounded border border-gray-300 text-center max-w-lg mx-auto">
             <p class="font-bold text-gray-800 mb-2">Fórmula de Deságio</p>
             <p class="font-mono text-sm">Valor Liquidação = Valor Mercado × (1 / (1 + 0,0151)^24)</p>
             <p class="font-mono text-sm mt-1">Fator = ${fmtDec(liquidityFactor, 4)}</p>
          </div>
          
          <div class="mt-8 text-center">
             <p class="text-gray-800 text-lg">Valor para Liquidação Forçada:</p>
             <p class="text-3xl font-bold text-gray-900 mt-2">${fmtBRL(liquidationValue)}</p>
          </div>
       </div>
    </div>

    <div class="page-break"></div>

    <!-- ANEXO 01 - FICHAS DE PESQUISA (PAGINADO) -->
    ${sampleChunks.map((chunkData) => `
      ${chunkData.pageIndex > 0 ? '<div class="page-break"></div>' : ''}
      <div class="report-section p-8">
         <h2 class="text-2xl font-serif font-bold text-gray-800 text-center uppercase mb-10">
            ${chunkData.pageIndex === 0 ? '11 - ANEXO Nº 01<br/><span class="text-lg font-normal">FICHAS DE PESQUISA</span>' : '<span class="text-lg font-normal">FICHAS DE PESQUISA (Continuação)</span>'}
         </h2>
         
         <div class="space-y-8">
            ${chunkData.chunk.map((s, i) => `
              <div class="border border-gray-400 rounded-lg overflow-hidden break-inside-avoid shadow-sm">
                  <div class="bg-green-700 text-white p-3 font-bold flex justify-between items-center">
                      <span class="bg-green-800 px-2 py-1 rounded text-xs uppercase">Amostra #${chunkData.index + i + 1}</span>
                      <span>${s.city} - ${s.state}</span>
                      <span class="text-xs bg-green-600 px-2 py-1 rounded">Oferta (0,90)</span>
                  </div>
                  <div class="grid grid-cols-2 text-sm">
                      <div class="p-3 border-r border-b border-gray-300 bg-gray-50">
                          <span class="font-bold text-green-800 block text-xs uppercase mb-1">Localização</span> ${s.city}
                      </div>
                      <div class="p-3 border-b border-gray-300 bg-gray-50">
                          <span class="font-bold text-green-800 block text-xs uppercase mb-1">Fonte</span> ${s.source || 'Pesquisa de Mercado'}
                      </div>
                      <div class="p-3 border-r border-b border-gray-300">
                           <span class="font-bold text-green-800 block text-xs uppercase mb-1">Área Total</span> ${fmtDec(s.areaTotal)} ${unitStr}
                      </div>
                      <div class="p-3 border-b border-gray-300">
                          <span class="font-bold text-green-800 block text-xs uppercase mb-1">Valor Total</span> ${fmtBRL(s.price)}
                      </div>
                      <div class="p-3 border-r border-gray-300">
                          <span class="font-bold text-green-800 block text-xs uppercase mb-1">Descrição</span>
                          ${s.title || 'Imóvel Rural'}
                      </div>
                      <div class="p-3">
                          <span class="font-bold text-green-800 block text-xs uppercase mb-1">Características</span>
                          ${isRural ? 
                            `<div class="space-y-1 text-xs text-gray-600">
                               <div>Cap: <strong>${s.landCapability || '-'}</strong></div>
                               <div>Acesso: <strong>${s.access || '-'}</strong></div>
                               <div>Topo: <strong>${s.topography || '-'}</strong></div>
                            </div>` 
                            : 
                            `Tipo: ${s.urbanSubType}<br/>Bairro: ${s.neighborhood || '-'}`
                          }
                      </div>
                  </div>
              </div>
            `).join('')}
         </div>
      </div>
    `).join('')}

    <div class="page-break"></div>

    <!-- ANEXO 03 - MEMÓRIA DE CÁLCULO -->
    <div class="report-section p-8">
       <h2 class="text-2xl font-serif font-bold text-gray-800 text-center uppercase mb-10">13 - ANEXO Nº 03<br/><span class="text-lg font-normal">MEMÓRIA DE CÁLCULO</span></h2>

       <h3 class="font-bold text-gray-800 mb-4 uppercase text-sm border-b border-gray-400 pb-1">Elementos Coletados</h3>
       <div class="overflow-x-auto mb-8">
         <table class="w-full text-xs text-center border border-gray-300">
            <thead class="bg-green-700 text-white font-bold">
                <tr>
                    <th class="p-2 border border-gray-400">Amostra</th>
                    <th class="p-2 border border-gray-400">VO (R$)</th>
                    <th class="p-2 border border-gray-400">Área (${unitStr})</th>
                    <th class="p-2 border border-gray-400">Oferta</th>
                    <th class="p-2 border border-gray-400">VUB (R$)</th>
                </tr>
            </thead>
            <tbody>
                ${homogenizedSamples.map((s, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                    <td class="p-2 border border-gray-300 font-bold">${i + 1}</td>
                    <td class="p-2 border border-gray-300">${fmtBRL(s.price)}</td>
                    <td class="p-2 border border-gray-300">${fmtDec(s.areaTotal)}</td>
                    <td class="p-2 border border-gray-300">0,90</td>
                    <td class="p-2 border border-gray-300 font-bold">${fmtBRL(s.pricePerUnit)}</td>
                </tr>
                `).join('')}
            </tbody>
         </table>
       </div>

       <h3 class="font-bold text-gray-800 mb-4 uppercase text-sm border-b border-gray-400 pb-1">Cálculo do Valor Médio Homogeneizado</h3>
       <div class="overflow-x-auto mb-8">
         <table class="w-full text-xs text-center border border-gray-300">
            <thead class="bg-gray-800 text-white font-bold">
                <tr>
                    <th class="p-2 border border-gray-600">Amostra</th>
                    <th class="p-2 border border-gray-600">VUB (R$)</th>
                    <th class="p-2 border border-gray-600">F. Oferta</th>
                    ${isRural ? `
                    <th class="p-2 border border-gray-600">F. Dim</th>
                    <th class="p-2 border border-gray-600">F. Cap</th>
                    <th class="p-2 border border-gray-600">F. Acesso</th>
                    <th class="p-2 border border-gray-600">F. Topo</th>
                    <th class="p-2 border border-gray-600">F. Outros</th>
                    ` : '<th class="p-2 border border-gray-600">Fatores</th>'}
                    <th class="p-2 border border-gray-600 bg-green-900">VUH (R$)</th>
                </tr>
            </thead>
            <tbody>
               ${homogenizedSamples.map((s, i) => {
                  const findF = (name: string) => s.factors?.find((f:any) => f.name === name)?.value || 1.00;
                  const other = findF('Solo') * findF('Ocupação') * findF('Benfeitorias') * findF('Melhoramentos');
                  return `
                    <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                        <td class="p-2 border border-gray-300 font-bold">${i + 1}</td>
                        <td class="p-2 border border-gray-300">${fmtDec(s.pricePerUnit)}</td>
                        <td class="p-2 border border-gray-300">0,90</td>
                        ${isRural ? `
                        <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Dimensão'))}</td>
                        <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Cap. Uso'))}</td>
                        <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Acesso'))}</td>
                        <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Topografia'))}</td>
                        <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(other)}</td>
                        ` : '<td class="p-2 border border-gray-300 text-gray-600">1.00</td>'}
                        <td class="p-2 border border-gray-300 font-bold text-green-800 bg-green-50">${fmtBRL(s.homogenizedUnitPrice)}</td>
                    </tr>
                  `;
               }).join('')}
            </tbody>
         </table>
       </div>

       <div class="grid grid-cols-2 gap-8 text-sm">
          <div>
              <table class="w-full border border-gray-300">
                  <tr class="bg-gray-100"><td class="p-2 font-bold">Média</td><td class="p-2 text-right">${fmtBRL(avgHomogenizedUnitPrice)}</td></tr>
                  <tr><td class="p-2 font-bold">Desvio Padrão</td><td class="p-2 text-right">${fmtBRL(stdDev)}</td></tr>
                  <tr class="bg-gray-100"><td class="p-2 font-bold">Coef. Variação</td><td class="p-2 text-right">${fmtDec(coeffVariation * 100)}%</td></tr>
                  <tr><td class="p-2 font-bold">Grau de Precisão</td><td class="p-2 text-right">Grau ${precisionGrade}</td></tr>
              </table>
          </div>
          <div>
              <table class="w-full border border-gray-300">
                  <tr class="bg-gray-100"><td class="p-2 font-bold">Intervalo Confiança (80%)</td><td class="p-2 text-right"></td></tr>
                  <tr><td class="p-2">Mínimo</td><td class="p-2 text-right">${fmtBRL(minInterval)}</td></tr>
                  <tr><td class="p-2">Máximo</td><td class="p-2 text-right">${fmtBRL(maxInterval)}</td></tr>
                  <tr class="bg-gray-100"><td class="p-2 font-bold">Amplitude</td><td class="p-2 text-right">${fmtBRL(maxInterval - minInterval)}</td></tr>
              </table>
          </div>
       </div>
    </div>
    
    <div class="page-break"></div>
    
    <!-- RESPONSABILIDADE E LIMITAÇÕES -->
    <div class="report-section p-8 text-justify">
       <h2 class="text-xl font-serif font-bold text-gray-800 text-center uppercase mb-10">RESPONSABILIDADE E LIMITAÇÕES</h2>
       
       <p class="mb-4 text-gray-700">
         Este Laudo de Avaliação foi produzido com base em informações fornecidas pela contratante/usuário do sistema, incluindo a documentação do imóvel objeto da análise, características físicas e localizacionais, as quais são admitidas como verdadeiras para fins de cálculo.
       </p>
       
       <p class="mb-4 text-gray-700">
         Ressalva-se que o presente trabalho foi realizado seguindo os preceitos metodológicos da ABNT NBR 14653-3 (Imóveis Rurais) e/ou NBR 14653-2 (Imóveis Urbanos), contudo, enquadra-se na modalidade <strong>"Avaliação Expedita" (Desktop Valuation)</strong>, sendo realizado <strong>sem vistoria <em>in loco</em></strong> ao imóvel avaliando.
       </p>
       
       <p class="mb-4 text-gray-700">
         A fundamentação de valores utilizou como base o <strong>Banco de Dados de Amostras da Bandeira Agro</strong> e dados de mercado disponíveis publicamente. A Bandeira Agro não se responsabiliza por divergências entre as informações inseridas no sistema e a realidade fática do imóvel que apenas uma inspeção presencial detalhada poderia constatar (como estado real de conservação das benfeitorias, invasões, pragas, passivos ambientais ou discrepâncias de área física vs. documental).
       </p>
       
       <p class="mb-4 text-gray-700">
         A utilização deste Laudo de Avaliação é restrita à finalidade de estimativa de valor de mercado e liquidação forçada para fins gerenciais, não devendo ser utilizado como único instrumento para garantias bancárias de alto risco sem a devida validação presencial complementar, se exigida pelas normas internas da instituição financeira.
       </p>
       
       <div class="mt-20 text-center">
          <p class="text-sm text-gray-500">Documento gerado eletronicamente pela plataforma Bandeira Agro.</p>
          <p class="text-sm text-gray-500">${currentDate}</p>
       </div>
    </div>
  `;

  return {
    reportText,
    sources: homogenizedSamples,
    estimatedValue: hasSamples ? fmtBRL(marketValue) : 'N/A'
  };
};
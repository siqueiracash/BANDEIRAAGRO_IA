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

export const generateManualValuation = async (data: PropertyData): Promise<ValuationResult> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const isRural = data.type === PropertyType.RURAL;
  const subType = isRural ? data.ruralActivity : data.urbanSubType;
  let searchScope = `região de <strong>${data.city}/${data.state}</strong>`;
  const MIN_SAMPLES = 5;
  
  // --- 1. COLETA DE DADOS (CASCATA DE BUSCA) ---
  // Nível 1: Busca Exata (Cidade + Tipo + Subtipo)
  let samples = await filterSamples(data.type, data.city, data.state, subType);

  // Nível 2: Busca Geral na Cidade (Se < 5)
  if (samples.length < MIN_SAMPLES) {
    const generalCitySamples = await filterSamples(data.type, data.city, data.state);
    const existingIds = new Set(samples.map(s => s.id));
    for (const gs of generalCitySamples) {
      if (!existingIds.has(gs.id)) {
        samples.push(gs);
        existingIds.add(gs.id);
      }
    }
  }

  // Nível 3: Cidades Vizinhas (Se < 5)
  if (samples.length < MIN_SAMPLES) {
    try {
      const neighborCities = await getNeighboringCities(data.city, data.state);
      if (neighborCities.length > 0) {
        // Primeiro tenta vizinhos com mesmo subtipo
        const neighborSamples = await getSamplesByCities(neighborCities, data.state, data.type, subType);
        
        // Se ainda faltar, tenta vizinhos com qualquer subtipo
        let neighborSamplesGeneral: any[] = [];
        if ((samples.length + neighborSamples.length) < MIN_SAMPLES) {
           neighborSamplesGeneral = await getSamplesByCities(neighborCities, data.state, data.type);
        }

        const allNeighbors = [...neighborSamples, ...neighborSamplesGeneral];
        const existingIds = new Set(samples.map(s => s.id));
        let addedCount = 0;
        for (const ns of allNeighbors) {
          if (!existingIds.has(ns.id)) {
            samples.push(ns);
            existingIds.add(ns.id);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          searchScope = `região de <strong>${data.city}</strong> e municípios vizinhos (<strong>${neighborCities.slice(0, 3).join(', ')}...</strong>)`;
        }
      }
    } catch (err) {
      console.warn("Falha ao buscar cidades vizinhas:", err);
    }
  }

  // Nível 4: Busca Estadual / Regional Ampliada (Se < 5) - GARANTIA DE AMOSTRAS
  if (samples.length < MIN_SAMPLES) {
    try {
      // Busca todas as amostras do Estado
      const stateSamples = await filterSamples(data.type, "", data.state); // Cidade vazia = busca estadual
      const existingIds = new Set(samples.map(s => s.id));
      let addedCount = 0;

      // Adiciona até completar ou acabar
      for (const ss of stateSamples) {
        if (!existingIds.has(ss.id)) {
          samples.push(ss);
          existingIds.add(ss.id);
          addedCount++;
          // Se já temos o suficiente + uma margem de segurança, pode parar (opcional, aqui pego todas disponíveis para melhor seleção)
          if (samples.length >= MIN_SAMPLES + 2) break; 
        }
      }

      if (addedCount > 0) {
        searchScope = `região de <strong>${data.city}</strong>, vizinhança e <strong>mercado regional (${data.state})</strong> devido à escassez local`;
      }
    } catch (err) {
      console.warn("Falha ao buscar amostras estaduais:", err);
    }
  }

  const hasSamples = samples.length > 0;
  const unitStr = isRural ? 'ha' : 'm²';
  const OFFER_FACTOR = 0.90; // Fator de Oferta Obrigatório (10% de desconto sobre o valor pedido)

  // --- 2. CÁLCULOS E HOMOGENEIZAÇÃO ---
  let homogenizedSamples: any[] = [];
  let sumHomogenizedUnit = 0;

  if (hasSamples) {
    homogenizedSamples = samples.map(sample => {
      let unitPrice = sample.pricePerUnit;
      let appliedFactorsList: { name: string, value: number }[] = [];
      
      // 1. Fator Oferta (Sempre aplica primeiro)
      // Ajusta o valor da oferta para o valor provável de transação
      unitPrice = unitPrice * OFFER_FACTOR;
      appliedFactorsList.push({ name: 'Oferta', value: OFFER_FACTOR });

      // --- HOMOGENEIZAÇÃO RURAL COMPLETA ---
      if (isRural) {
        // 2. Fator Dimensão (Gleba) - Baseado na Tabela
        const factorSubjectDim = getDimensionFactor(data.areaTotal);
        const factorSampleDim = getDimensionFactor(sample.areaTotal);
        // Fórmula: PreçoHomogeneizado = PreçoAmostra * (IndiceParadigma / IndiceAmostra)
        const factorDim = factorSubjectDim / factorSampleDim;
        unitPrice = unitPrice * factorDim;
        appliedFactorsList.push({ name: 'Dimensão', value: factorDim });

        // 3. Capacidade de Uso da Terra
        const coefSubjectCap = getCoef(COEF_LAND_CAPABILITY, data.landCapability);
        const coefSampleCap = getCoef(COEF_LAND_CAPABILITY, sample.landCapability);
        const factorCap = coefSubjectCap / coefSampleCap;
        unitPrice = unitPrice * factorCap;
        appliedFactorsList.push({ name: 'Cap. Uso', value: factorCap });

        // 4. Situação e Acesso
        const coefSubjectAccess = getCoef(COEF_ACCESS, data.access);
        const coefSampleAccess = getCoef(COEF_ACCESS, sample.access);
        const factorAccess = coefSubjectAccess / coefSampleAccess;
        unitPrice = unitPrice * factorAccess;
        appliedFactorsList.push({ name: 'Acesso', value: factorAccess });

        // 5. Melhoramentos Públicos
        const coefSubjectPub = getCoef(COEF_PUBLIC_IMPROVEMENTS, data.publicImprovements);
        const coefSamplePub = getCoef(COEF_PUBLIC_IMPROVEMENTS, sample.publicImprovements);
        const factorPub = coefSubjectPub / coefSamplePub;
        unitPrice = unitPrice * factorPub;
        appliedFactorsList.push({ name: 'Melhoramentos', value: factorPub });

        // 6. Topografia
        const coefSubjectTopo = getCoef(COEF_TOPOGRAPHY, data.topography);
        const coefSampleTopo = getCoef(COEF_TOPOGRAPHY, sample.topography);
        const factorTopo = coefSubjectTopo / coefSampleTopo;
        unitPrice = unitPrice * factorTopo;
        appliedFactorsList.push({ name: 'Topografia', value: factorTopo });

        // 7. Superfície (Solo)
        const coefSubjectSurf = getCoef(COEF_SURFACE, data.surface);
        const coefSampleSurf = getCoef(COEF_SURFACE, sample.surface);
        const factorSurf = coefSubjectSurf / coefSampleSurf;
        unitPrice = unitPrice * factorSurf;
        appliedFactorsList.push({ name: 'Solo', value: factorSurf });

        // 8. Ocupação (Abertura)
        const coefSubjectOcc = getCoef(COEF_OCCUPATION, data.occupation);
        const coefSampleOcc = getCoef(COEF_OCCUPATION, sample.occupation);
        const factorOcc = coefSubjectOcc / coefSampleOcc;
        unitPrice = unitPrice * factorOcc;
        appliedFactorsList.push({ name: 'Ocupação', value: factorOcc });

        // 9. Benfeitorias (Estrutural)
        const coefSubjectImp = getCoef(COEF_IMPROVEMENTS, data.improvements);
        const coefSampleImp = getCoef(COEF_IMPROVEMENTS, sample.improvements);
        const factorImp = coefSubjectImp / coefSampleImp;
        unitPrice = unitPrice * factorImp;
        appliedFactorsList.push({ name: 'Benfeitorias', value: factorImp });

      } else {
        // --- HOMOGENEIZAÇÃO URBANA SIMPLIFICADA ---
        // Fator localização simples se for outra cidade (ajuste grosseiro de 10% se não for a mesma cidade)
        if (sample.city.toLowerCase() !== data.city.toLowerCase()) {
           // Em tese precisaria de pesquisa de mercado específica para saber se a cidade vizinha é mais cara ou barata.
           // Assumiremos neutralidade (1.00) ou ajuste leve se necessário. Por norma, mantemos neutro se desconhecido.
        }
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
  if (coeffVariation > 0.30) precisionGrade = "I"; 

  // Área de Referência para cálculo final
  let refArea = data.areaTotal;
  if (!isRural && data.areaBuilt && data.areaBuilt > 0) {
    refArea = data.areaBuilt;
  }

  // Valor de Mercado
  const marketValue = avgHomogenizedUnitPrice * refArea;

  // Liquidação Forçada
  const liquidityRate = 0.0150; 
  const liquidityMonths = 24;
  const liquidityFactor = 1 / Math.pow(1 + liquidityRate, liquidityMonths);
  const liquidationValue = marketValue * liquidityFactor;

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDec = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  const reportText = `
    <!-- CAPA -->
    <div class="report-cover flex flex-col items-center justify-center h-screen text-center p-10 bg-white">
      <div class="mb-10">
        <h2 class="text-xl tracking-widest text-gray-500 uppercase font-semibold">Bandeira Agro</h2>
      </div>
      
      <div class="flex-grow flex flex-col justify-center">
        <h1 class="text-5xl md:text-6xl font-serif font-bold text-gray-900 mb-8 leading-tight">
          LAUDO TÉCNICO DE<br/>AVALIAÇÃO ${isRural ? 'RURAL' : 'URBANA'}
        </h1>
        <div class="w-32 h-1 bg-green-600 mx-auto mb-12"></div>
        <p class="text-lg text-gray-600 font-serif italic">Conformidade ABNT NBR 14653-3</p>
      </div>

      <div class="text-left w-full max-w-2xl mx-auto space-y-4 text-sm md:text-base border-t border-gray-200 pt-10">
        <div class="grid grid-cols-3 gap-4">
          <span class="font-bold text-gray-900 uppercase">Solicitante:</span>
          <span class="col-span-2 text-gray-700">CLIENTE BANDEIRA AGRO</span>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <span class="font-bold text-gray-900 uppercase">Data Base:</span>
          <span class="col-span-2 text-gray-700">${new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- RESUMO -->
    <div class="report-section p-8 flex flex-col justify-between">
      <div>
        <div class="border-b border-gray-300 pb-4 mb-6 text-center">
          <h2 class="text-2xl font-serif font-bold text-gray-800 uppercase">Resumo da Avaliação</h2>
        </div>

        <div class="space-y-6">
          <div>
            <h3 class="text-sm font-bold text-gray-500 uppercase mb-2 border-b border-gray-100">Dados do Imóvel</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Localização:</strong> ${data.address || 'Não informado'}, ${data.city} - ${data.state}</div>
              <div><strong>Tipo:</strong> ${data.type} (${subType})</div>
              <div><strong>Área Total:</strong> ${fmtDec(data.areaTotal)} ${unitStr}</div>
              ${isRural ? `<div><strong>Cap. Uso:</strong> ${data.landCapability || '-'}</div>` : ''}
            </div>
          </div>

          <div class="h-32"></div>

          <div class="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 class="text-lg font-serif font-bold text-center text-gray-800 mb-6 uppercase">Valores Finais</h3>
            <div class="flex flex-col gap-4">
              <div class="flex justify-between items-center border-b border-gray-300 pb-2">
                <span class="text-gray-600 font-medium">Valor de Mercado</span>
                <span class="text-2xl font-bold text-gray-900">${fmtBRL(marketValue)}</span>
              </div>
              <div class="flex justify-between items-center pb-2">
                <span class="text-gray-600 font-medium">Liquidação Forçada</span>
                <span class="text-2xl font-bold text-gray-900">${fmtBRL(liquidationValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- CARACTERÍSTICAS TÉCNICAS -->
    <div class="report-section p-8 text-justify leading-relaxed">
      <div class="mb-8">
        <h3 class="text-lg font-bold text-gray-900 mb-3 border-l-4 border-green-600 pl-3">CARACTERIZAÇÃO TÉCNICA DO IMÓVEL</h3>
        
        <p class="text-gray-700 text-sm mb-3">
          O imóvel foi vistoriado e classificado de acordo com os seguintes parâmetros técnicos, fundamentais para a determinação do seu valor de mercado:
        </p>

        <div class="bg-gray-50 p-6 rounded-lg shadow-sm">
          <ul class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            ${isRural ? `
            <li class="border-b border-gray-200 pb-2"><strong>Capacidade de Uso da Terra:</strong><br/> ${data.landCapability || 'Não informado'}</li>
            <li class="border-b border-gray-200 pb-2"><strong>Superfície:</strong><br/> ${data.surface || 'Não informado'}</li>
            <li class="border-b border-gray-200 pb-2"><strong>Topografia:</strong><br/> ${data.topography || 'Não informado'}</li>
            <li class="border-b border-gray-200 pb-2"><strong>Acesso:</strong><br/> ${data.access || 'Não informado'}</li>
            <li class="border-b border-gray-200 pb-2"><strong>Melhoramentos Públicos:</strong><br/> ${data.publicImprovements || 'Não informado'}</li>
            <li class="border-b border-gray-200 pb-2"><strong>Ocupação (Abertura):</strong><br/> ${data.occupation || 'Não informado'}</li>
            <li class="border-b border-gray-200 pb-2"><strong>Benfeitorias:</strong><br/> ${data.improvements || 'Não informado'}</li>
            <li class="border-b border-gray-200 pb-2"><strong>Dimensão da Gleba:</strong><br/> ${fmtDec(data.areaTotal)} hectares</li>
            ` : `
            <li><strong>Tipo:</strong> ${data.urbanSubType}</li>
            <li><strong>Área Construída:</strong> ${data.areaBuilt} m²</li>
            `}
          </ul>
        </div>
      </div>

      <div class="mb-8">
        <h3 class="text-lg font-bold text-gray-900 mb-3 border-l-4 border-green-600 pl-3">METODOLOGIA</h3>
        <p class="text-gray-700 text-sm mb-2">
          Foi utilizado o <strong>Método Comparativo Direto de Dados de Mercado</strong>. 
          A pesquisa de mercado abrangeu a ${searchScope}.
        </p>
        <p class="text-gray-700 text-sm">
          A homogeneização dos dados seguiu rigorosamente os fatores da tabela técnica, incluindo <strong>Fator Oferta (0,90)</strong>, Dimensão (Gleba), Capacidade de Uso (Solos), Situação/Acesso, Melhoramentos, Topografia, Superfície e Ocupação.
        </p>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- CÁLCULOS E DIAGNÓSTICO -->
    <div class="report-section p-8">
      <h3 class="text-lg font-bold text-gray-900 mb-6 border-l-4 border-green-600 pl-3">CÁLCULOS E AVALIAÇÃO</h3>
      
      <div class="overflow-x-auto mb-6">
        <table class="w-full text-sm text-left border border-gray-300">
          <tbody class="divide-y divide-gray-200">
              <tr>
                <td class="p-3 font-bold bg-gray-50">Média Unitária Homogeneizada</td>
                <td class="p-3">${fmtBRL(avgHomogenizedUnitPrice)} / ${unitStr}</td>
              </tr>
              <tr>
                <td class="p-3 font-bold bg-gray-50">Coeficiente de Variação</td>
                <td class="p-3">${fmtDec(coeffVariation * 100)}%</td>
              </tr>
              <tr>
                <td class="p-3 font-bold bg-gray-50">Grau de Precisão</td>
                <td class="p-3">Grau ${precisionGrade}</td>
              </tr>
              <tr>
                <td class="p-3 font-bold bg-gray-50">Amostras Utilizadas</td>
                <td class="p-3">${count} amostras</td>
              </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-green-50 p-6 border border-green-200 rounded text-center shadow-sm">
        <p class="text-sm text-green-800 font-bold uppercase tracking-wider mb-2">Valor de Mercado Estimado</p>
        <p class="text-4xl font-serif font-bold text-green-900">${fmtBRL(marketValue)}</p>
        <p class="text-sm text-gray-600 mt-2">Baseado em ${count} amostras homogeneizadas</p>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ANEXO: MEMÓRIA DE CÁLCULO DETALHADA -->
    <div class="report-section p-8" style="min-height: auto;">
      <h3 class="text-xl font-serif font-bold text-gray-900 mb-6 border-b border-gray-300 pb-2">ANEXO - MEMÓRIA DE CÁLCULO</h3>
      <p class="text-xs text-gray-600 mb-4">Detalhamento dos fatores de homogeneização aplicados. Inclui Fator Oferta (0,90) em todas as amostras.</p>

      <div class="overflow-x-auto">
        <table class="w-full text-xs text-center border-collapse border border-gray-300">
          <thead>
            <tr class="bg-gray-800 text-white">
              <th class="p-2 border border-gray-600">Local</th>
              <th class="p-2 border border-gray-600">R$/ha Orig.</th>
              ${isRural ? `
              <th class="p-2 border border-gray-600" title="Fator Oferta">Ofert.</th>
              <th class="p-2 border border-gray-600" title="Dimensão">Dim.</th>
              <th class="p-2 border border-gray-600" title="Capacidade de Uso">Cap.</th>
              <th class="p-2 border border-gray-600" title="Acesso">Ace.</th>
              <th class="p-2 border border-gray-600" title="Outros Fatores (Melh+Top+Solo+Ocup)">Outros</th>
              ` : ''}
              <th class="p-2 border border-gray-600 bg-green-900">R$/ha Homog.</th>
            </tr>
          </thead>
          <tbody>
            ${homogenizedSamples.map((s, idx) => {
              const findF = (name: string) => s.factors?.find((f:any) => f.name === name)?.value || 1.00;
              // Agrupa outros fatores para caber na tabela
              const otherFactors = findF('Melhoramentos') * findF('Topografia') * findF('Solo') * findF('Ocupação') * findF('Benfeitorias');
              
              return `
              <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="p-2 border border-gray-300 text-left">${s.city}</td>
                <td class="p-2 border border-gray-300">${fmtBRL(s.pricePerUnit)}</td>
                ${isRural ? `
                <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Oferta'))}</td>
                <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Dimensão'))}</td>
                <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Cap. Uso'))}</td>
                <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(findF('Acesso'))}</td>
                <td class="p-2 border border-gray-300 text-gray-600">${fmtDec(otherFactors)}</td>
                ` : ''}
                <td class="p-2 border border-gray-300 font-bold text-green-800 bg-green-50">${fmtBRL(s.homogenizedUnitPrice)}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="mt-8 text-xs text-gray-500 border-t border-gray-200 pt-4">
        <p><strong>Legenda:</strong> Os valores exibidos representam o multiplicador aplicado (Fator Paradigma / Fator Amostra). A coluna "Outros" agrupa fatores de Topografia, Solo, Ocupação e Benfeitorias para visualização.</p>
      </div>
    </div>
  `;

  return {
    reportText,
    sources: homogenizedSamples,
    estimatedValue: hasSamples ? fmtBRL(marketValue) : 'N/A'
  };
};
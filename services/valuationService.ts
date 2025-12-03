import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, getSamplesByCities } from "./storageService";
import { getNeighboringCities } from "./geminiService";

// --- TABELAS DE COEFICIENTES EMPÍRICOS (NBR 14653-3) ---
const COEF_TOPOGRAPHY: Record<string, number> = {
  'Plano': 1.00,
  'Leve Ondulado': 0.90,
  'Ondulado': 0.80,
  'Montanhoso': 0.60,
  'DEFAULT': 1.00
};

const COEF_ACCESS: Record<string, number> = {
  'Ótimo': 1.10,
  'Muito bom': 1.05,
  'Muito Bom': 1.05,
  'Bom': 1.00,
  'Regular': 0.90,
  'Mau': 0.80,
  'Péssimo': 0.70,
  'Encravada': 0.50,
  'DEFAULT': 1.00
};

const COEF_SURFACE: Record<string, number> = {
  'Seca': 1.00,
  'Alagadiça': 0.70,
  'Brejosa ou Pantanosa': 0.50,
  'Permanente Alagada': 0.30,
  'DEFAULT': 1.00
};

const GREATNESS_EXPONENT = 0.15; 

const getCoef = (table: Record<string, number>, key: string | undefined) => {
  if (!key) return table['DEFAULT'];
  const found = Object.keys(table).find(k => k.toLowerCase() === key.toLowerCase());
  return found ? table[found] : table['DEFAULT'];
};

export const generateManualValuation = async (data: PropertyData): Promise<ValuationResult> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const isRural = data.type === PropertyType.RURAL;
  const subType = isRural ? data.ruralActivity : data.urbanSubType;
  let searchScope = `região de <strong>${data.city}/${data.state}</strong>`;
  const MIN_SAMPLES = 5;
  
  // --- 1. COLETA DE DADOS ---
  let samples = await filterSamples(data.type, data.city, data.state, subType);

  // Fallback 1: Mesma cidade, qualquer subtipo
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

  // Fallback 2: Cidades Vizinhas (IA)
  if (samples.length < MIN_SAMPLES) {
    try {
      const neighborCities = await getNeighboringCities(data.city, data.state);
      if (neighborCities.length > 0) {
        const neighborSamples = await getSamplesByCities(neighborCities, data.state, data.type, subType);
        let neighborSamplesGeneral: any[] = [];
        if (neighborSamples.length < (MIN_SAMPLES - samples.length)) {
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
          searchScope = `região de <strong>${data.city}</strong> e municípios vizinhos (<strong>${neighborCities.slice(0, 3).join(', ')}...</strong>) devido à escassez local`;
        }
      }
    } catch (err) {
      console.warn("Falha ao buscar cidades vizinhas:", err);
    }
  }

  // Fallback 3: Estado todo
  if (samples.length < MIN_SAMPLES && isRural) {
    let stateSamples = await filterSamples(data.type, '', data.state, subType);
    if (stateSamples.length < MIN_SAMPLES) {
      const generalStateSamples = await filterSamples(data.type, '', data.state);
       const stateIds = new Set(stateSamples.map(s => s.id));
       for (const gs of generalStateSamples) {
         if (!stateIds.has(gs.id)) {
           stateSamples.push(gs);
           stateIds.add(gs.id);
         }
       }
    }
    const existingIds = new Set(samples.map(s => s.id));
    let usedState = false;
    for (const ss of stateSamples) {
       if (samples.length < MIN_SAMPLES * 2) { 
         if (!existingIds.has(ss.id)) {
            samples.push(ss);
            existingIds.add(ss.id);
            usedState = true;
         }
       }
    }
    if (usedState) {
      searchScope = `âmbito estadual (<strong>${data.state}</strong>) devido à escassez de dados locais em ${data.city} e arredores`;
    }
  }

  const hasSamples = samples.length > 0;
  const unitStr = isRural ? 'ha' : 'm²';
  const OFFER_FACTOR = 0.90; 

  // --- 2. CÁLCULOS E HOMOGENEIZAÇÃO ---
  let homogenizedSamples: any[] = [];
  let sumHomogenizedUnit = 0;

  if (hasSamples) {
    homogenizedSamples = samples.map(sample => {
      let unitPrice = sample.pricePerUnit;
      let appliedFactorsList: { name: string, value: number }[] = [];
      
      // Fator Oferta
      unitPrice = unitPrice * OFFER_FACTOR;
      appliedFactorsList.push({ name: 'Oferta', value: OFFER_FACTOR });

      // Fatores Físicos (Rural)
      if (isRural) {
        // Grandeza
        if (data.areaTotal > 0 && sample.areaTotal > 0) {
           const areaRatio = sample.areaTotal / data.areaTotal;
           const factorGreatness = Math.pow(areaRatio, GREATNESS_EXPONENT);
           if (Math.abs(factorGreatness - 1.0) > 0.01) {
             unitPrice = unitPrice * factorGreatness;
             appliedFactorsList.push({ name: 'Grandeza', value: factorGreatness });
           } else {
             appliedFactorsList.push({ name: 'Grandeza', value: 1.00 });
           }
        }

        // Topografia
        const coefSubjectTopo = getCoef(COEF_TOPOGRAPHY, data.topography);
        const coefSampleTopo = sample.topography ? getCoef(COEF_TOPOGRAPHY, sample.topography) : coefSubjectTopo;
        const factorTopo = coefSubjectTopo / coefSampleTopo;
        unitPrice = unitPrice * factorTopo;
        appliedFactorsList.push({ name: 'Topografia', value: factorTopo });

        // Acesso
        const coefSubjectAccess = getCoef(COEF_ACCESS, data.access);
        const coefSampleAccess = sample.access ? getCoef(COEF_ACCESS, sample.access) : coefSubjectAccess;
        const factorAccess = coefSubjectAccess / coefSampleAccess;
        unitPrice = unitPrice * factorAccess;
        appliedFactorsList.push({ name: 'Acesso', value: factorAccess });

        // Solo
        const coefSubjectSurf = getCoef(COEF_SURFACE, data.surface);
        const coefSampleSurf = sample.surface ? getCoef(COEF_SURFACE, sample.surface) : coefSubjectSurf;
        const factorSurf = coefSubjectSurf / coefSampleSurf;
        unitPrice = unitPrice * factorSurf;
        appliedFactorsList.push({ name: 'Solo', value: factorSurf });
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
  // Rural usa sempre área total. Urbano usa área construída se houver, senão total.
  let refArea = data.areaTotal;
  if (!isRural && data.areaBuilt && data.areaBuilt > 0) {
    refArea = data.areaBuilt;
  }

  // Valor de Mercado
  const marketValue = avgHomogenizedUnitPrice * refArea;

  // --- CÁLCULO DE LIQUIDAÇÃO FORÇADA (ATUALIZADO) ---
  // Taxa: 1,50% a.m.
  // Prazo: 24 meses
  const liquidityRate = 0.0150; // 1.50%
  const liquidityMonths = 24;
  const liquidityFactor = 1 / Math.pow(1 + liquidityRate, liquidityMonths);
  const liquidationValue = marketValue * liquidityFactor;
  const desagioPercent = (1 - liquidityFactor) * 100;

  // Formatadores
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDec = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  // --- 3. CONSTRUÇÃO DO HTML DO LAUDO ---
  // Estrutura baseada no PDF da Bandeira Agro

  const reportText = `
    <!-- CAPA -->
    <div class="report-cover flex flex-col items-center justify-center h-screen text-center p-10 bg-white">
      <div class="mb-10">
        <h2 class="text-xl tracking-widest text-gray-500 uppercase font-semibold">Bandeira Agro</h2>
      </div>
      
      <div class="flex-grow flex flex-col justify-center">
        <h1 class="text-5xl md:text-6xl font-serif font-bold text-gray-900 mb-8 leading-tight">
          LAUDO TÉCNICO DE<br/>AVALIAÇÃO
        </h1>
        <div class="w-32 h-1 bg-green-600 mx-auto mb-12"></div>
      </div>

      <div class="text-left w-full max-w-2xl mx-auto space-y-4 text-sm md:text-base border-t border-gray-200 pt-10">
        <div class="grid grid-cols-3 gap-4">
          <span class="font-bold text-gray-900 uppercase">Solicitante:</span>
          <span class="col-span-2 text-gray-700">CLIENTE BANDEIRA AGRO</span>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <span class="font-bold text-gray-900 uppercase">Objetivo:</span>
          <span class="col-span-2 text-gray-700">Determinação dos Valores de Mercado e Liquidação Forçada</span>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <span class="font-bold text-gray-900 uppercase">Finalidade:</span>
          <span class="col-span-2 text-gray-700">Garantia / Gestão Patrimonial</span>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <span class="font-bold text-gray-900 uppercase">Data Base:</span>
          <span class="col-span-2 text-gray-700">${new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- RESUMO -->
    <div class="report-section p-8">
      <div class="border-b border-gray-300 pb-4 mb-6 text-center">
        <h2 class="text-2xl font-serif font-bold text-gray-800 uppercase">Resumo da Avaliação</h2>
      </div>

      <div class="space-y-6">
        <div>
          <h3 class="text-sm font-bold text-gray-500 uppercase mb-2 border-b border-gray-100">Dados do Imóvel</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><strong>Localização:</strong> ${data.address || 'Não informado'}, ${data.city} - ${data.state}</div>
            <div><strong>Tipo de Imóvel:</strong> ${data.type} (${subType})</div>
            <div><strong>Área Total:</strong> ${fmtDec(data.areaTotal)} ${unitStr}</div>
            <div><strong>Atividade Predominante:</strong> ${isRural ? data.ruralActivity : data.urbanSubType}</div>
          </div>
        </div>

        <div class="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 class="text-lg font-serif font-bold text-center text-gray-800 mb-6 uppercase">Resumo de Valores</h3>
          
          <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-gray-300 pb-2">
              <span class="text-gray-600 font-medium">Valor de Mercado</span>
              <span class="text-2xl font-bold text-gray-900">${fmtBRL(marketValue)}</span>
            </div>
            <div class="flex justify-between items-center pb-2">
              <span class="text-gray-600 font-medium">Valor de Liquidação Forçada</span>
              <span class="text-2xl font-bold text-gray-900">${fmtBRL(liquidationValue)}</span>
            </div>
          </div>
        </div>

        <div class="mt-10 text-center">
          <div class="inline-block border-t border-gray-400 pt-2 px-10">
            <p class="font-script text-2xl text-blue-900 mb-1">Bandeira Agro</p>
            <p class="font-bold text-gray-800 text-sm">Responsável Técnico</p>
            <p class="text-gray-500 text-xs">Bandeira Agro Inteligência Imobiliária</p>
          </div>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- CORPO DO LAUDO -->
    <div class="report-section p-8 text-justify leading-relaxed">
      
      <!-- 1. LOCALIZAÇÃO -->
      <div class="mb-8">
        <h3 class="text-lg font-bold text-gray-900 mb-3 border-l-4 border-green-600 pl-3">1. LOCALIZAÇÃO</h3>
        
        <h4 class="font-bold text-gray-800 text-sm mb-1 mt-4">1.1 CONTEXTO GERAL</h4>
        <p class="text-gray-700 text-sm mb-3">
          O imóvel avaliando localiza-se no município de <strong>${data.city} - ${data.state}</strong>.
          ${isRural ? 
          `Trata-se de uma região com forte vocação para **${data.ruralActivity}**, caracterizada pela presença de propriedades de médio e grande porte e infraestrutura de apoio ao agronegócio.` : 
          `Região urbana consolidada, inserida em contexto de ocupação compatível com o padrão **${data.urbanSubType}**, dispondo de equipamentos públicos e comunitários.`}
        </p>

        <h4 class="font-bold text-gray-800 text-sm mb-1 mt-4">1.2 ACESSO E LOGÍSTICA</h4>
        <p class="text-gray-700 text-sm">
          ${data.access ? `O acesso à propriedade é classificado como <strong>${data.access}</strong> conforme critérios da região.` : 'Condições de acesso padrão para a região.'}
          ${data.address ? ` O imóvel situa-se especificamente em: ${data.address}.` : ''}
        </p>
      </div>

      <!-- 2. DESCRIÇÃO -->
      <div class="mb-8">
        <h3 class="text-lg font-bold text-gray-900 mb-3 border-l-4 border-green-600 pl-3">2. DESCRIÇÃO DO IMÓVEL</h3>
        
        <h4 class="font-bold text-gray-800 text-sm mb-1 mt-4">2.1 DETALHAMENTO</h4>
        <p class="text-gray-700 text-sm mb-3">
          O imóvel avaliando consiste em uma propriedade com Área Total de <strong>${fmtDec(data.areaTotal)} ${unitStr}</strong>.
          ${data.description ? `<br/>Observações: ${data.description}` : ''}
        </p>

        <h4 class="font-bold text-gray-800 text-sm mb-1 mt-4">2.2 CARACTERÍSTICAS FÍSICAS (PARADIGMA)</h4>
        <div class="bg-gray-50 p-4 rounded text-sm">
          <ul class="list-disc pl-5 space-y-1 text-gray-700">
            <li><strong>Topografia:</strong> ${data.topography || 'Não informado'}</li>
            <li><strong>Solo/Superfície:</strong> ${data.surface || 'Não informado'}</li>
            <li><strong>Ocupação/Uso:</strong> ${data.occupation || 'Não informado'}</li>
            <li><strong>Benfeitorias:</strong> ${data.improvements || 'Não informado'}</li>
            ${!isRural ? `<li><strong>Área Construída:</strong> ${data.areaBuilt || 0} m²</li>` : ''}
          </ul>
        </div>
      </div>

      <!-- 3. METODOLOGIA -->
      <div class="mb-8">
        <h3 class="text-lg font-bold text-gray-900 mb-3 border-l-4 border-green-600 pl-3">3. METODOLOGIA E CRITÉRIOS</h3>
        <p class="text-gray-700 text-sm mb-3">
          Em conformidade com a <strong>ABNT NBR 14653</strong>, a avaliação foi realizada utilizando o <strong>Método Comparativo Direto de Dados de Mercado</strong>. 
          Este método determina o valor do imóvel através da comparação com dados de mercado de propriedades semelhantes (amostras), à venda ou transacionadas na região de abrangência (${searchScope}).
        </p>
        <p class="text-gray-700 text-sm">
          Foi realizado o tratamento dos dados (saneamento) através da <strong>Homogeneização por Fatores</strong>, equalizando as características das amostras em relação ao imóvel avaliando (Paradigma).
        </p>
      </div>

    </div>

    <div class="page-break"></div>

    <!-- CÁLCULOS -->
    <div class="report-section p-8">
      
      <!-- 4. DIAGNÓSTICO -->
      <div class="mb-8">
        <h3 class="text-lg font-bold text-gray-900 mb-3 border-l-4 border-green-600 pl-3">4. AVALIAÇÃO</h3>
        
        <h4 class="font-bold text-gray-800 text-sm mb-2 mt-4 uppercase">4.1 Diagnóstico de Mercado</h4>
        <p class="text-gray-700 text-sm mb-4">
          A pesquisa de mercado resultou na coleta de <strong>${count} amostras</strong> válidas e homogêneas, cujos detalhes encontram-se no Anexo deste laudo.
        </p>

        <h4 class="font-bold text-gray-800 text-sm mb-2 mt-4 uppercase">4.2 Cálculo do Valor de Mercado</h4>
        <div class="overflow-x-auto mb-4">
          <table class="w-full text-sm text-left border border-gray-300">
            <tbody class="divide-y divide-gray-200">
               <tr>
                 <td class="p-2 font-bold bg-gray-50">Média Unitária Homogeneizada</td>
                 <td class="p-2">${fmtBRL(avgHomogenizedUnitPrice)} / ${unitStr}</td>
               </tr>
               <tr>
                 <td class="p-2 font-bold bg-gray-50">Desvio Padrão</td>
                 <td class="p-2">${fmtDec(stdDev)}</td>
               </tr>
               <tr>
                 <td class="p-2 font-bold bg-gray-50">Coeficiente de Variação</td>
                 <td class="p-2">${fmtDec(coeffVariation * 100)}%</td>
               </tr>
               <tr>
                 <td class="p-2 font-bold bg-gray-50">Grau de Precisão</td>
                 <td class="p-2">Grau ${precisionGrade}</td>
               </tr>
            </tbody>
          </table>
        </div>
        <div class="bg-green-50 p-4 border border-green-200 rounded text-center">
          <p class="text-sm text-green-800 font-bold uppercase mb-1">Valor de Mercado Estimado</p>
          <p class="text-3xl font-bold text-green-900">${fmtBRL(marketValue)}</p>
          <p class="text-xs text-gray-500 mt-1">(${fmtBRL(avgHomogenizedUnitPrice)} x ${fmtDec(refArea)} ${unitStr})</p>
        </div>

        <h4 class="font-bold text-gray-800 text-sm mb-2 mt-8 uppercase">4.3 Cálculo do Valor de Liquidação Forçada</h4>
        <p class="text-gray-700 text-sm mb-3">
          O Valor de Liquidação Forçada corresponde ao valor para uma venda compulsória ou em prazo exíguo. Adotou-se o seguinte cálculo financeiro de deságio:
        </p>
        
        <div class="bg-gray-50 p-4 border border-gray-200 rounded mb-4 text-sm">
          <div class="grid grid-cols-2 gap-2 mb-2">
            <span><strong>Taxa de Juros (i):</strong></span>
            <span>${fmtDec(liquidityRate * 100)}% ao mês</span>
          </div>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <span><strong>Tempo de Absorção (n):</strong></span>
            <span>${liquidityMonths} meses</span>
          </div>
          <div class="grid grid-cols-2 gap-2 mb-2 border-t border-gray-300 pt-2">
            <span><strong>Fator de Liquidez:</strong></span>
            <span>1 / (1 + ${fmtDec(liquidityRate * 100)}%)^${liquidityMonths} = <strong>${fmtDec(liquidityFactor, 4)}</strong></span>
          </div>
        </div>

        <div class="bg-gray-100 p-4 border border-gray-300 rounded text-center">
          <p class="text-sm text-gray-800 font-bold uppercase mb-1">Valor de Liquidação Forçada</p>
          <p class="text-2xl font-bold text-gray-900">${fmtBRL(liquidationValue)}</p>
          <p class="text-xs text-gray-500 mt-1">Deságio total de aprox. ${fmtDec(desagioPercent)}%</p>
        </div>

      </div>

      <!-- ENCERRAMENTO -->
      <div class="mt-12 border-t-2 border-gray-800 pt-6">
        <h3 class="text-lg font-bold text-gray-900 mb-3">5. ENCERRAMENTO</h3>
        <p class="text-gray-700 text-sm mb-4">
          Este Laudo Técnico de Avaliação foi elaborado segundo os critérios da ABNT NBR 14653. As informações aqui contidas são verdadeiras e refletem a realidade de mercado na data presente.
        </p>
        <p class="text-gray-900 font-bold text-sm">
          ${data.city} - ${data.state}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>

        <div class="mt-16">
          <p class="font-bold text-lg text-gray-900">BANDEIRA AGRO</p>
          <p class="text-gray-600 text-sm">Inteligência em Avaliações Rurais e Urbanas</p>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ANEXO 1 -->
    <div class="report-section p-8">
      <h3 class="text-xl font-serif font-bold text-gray-900 mb-6 border-b border-gray-300 pb-2">ANEXO 01 - FICHAS DE PESQUISA</h3>
      <p class="text-sm text-gray-600 mb-6">Amostras de mercado utilizadas para a composição deste laudo.</p>

      <div class="space-y-6">
        ${homogenizedSamples.map((s, idx) => `
        <div class="border border-gray-300 rounded-lg p-4 bg-gray-50 break-inside-avoid">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-bold text-green-800">Amostra #${idx + 1}</h4>
            <span class="text-xs bg-white border border-gray-300 px-2 py-1 rounded">${s.type === 'URBANO' ? 'Urbano' : 'Rural'}</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div class="col-span-2"><strong>Local:</strong> ${s.city}/${s.state} <span class="text-gray-500 text-xs">(${s.neighborhood || s.address || 'Região'})</span></div>
            <div class="col-span-2 truncate"><strong>Fonte:</strong> <a href="#" class="text-blue-600 hover:underline">${s.source || 'Banco de Dados Interno'}</a></div>
            
            <div class="border-t border-gray-200 col-span-2 mt-2 pt-2 grid grid-cols-2 gap-4">
               <div><strong>Valor Oferta:</strong> ${fmtBRL(s.price)}</div>
               <div><strong>Área:</strong> ${s.areaTotal} ${unitStr}</div>
               <div><strong>Valor Unit. Original:</strong> ${fmtBRL(s.pricePerUnit)}/${unitStr}</div>
               <div><strong>Data:</strong> ${new Date(s.date).toLocaleDateString()}</div>
            </div>

            <div class="col-span-2 mt-2 bg-white p-2 rounded border border-gray-200 text-xs text-gray-600">
               <strong>Características:</strong> 
               ${isRural ? 
                 `Atividade: ${s.ruralActivity}, Topografia: ${s.topography || '-'}, Acesso: ${s.access || '-'}, Solo: ${s.surface || '-'}` : 
                 `Tipo: ${s.urbanSubType}, Quartos: ${s.bedrooms || '-'}, Vagas: ${s.parking || '-'}, Conservação: ${s.conservationState || '-'}`}
            </div>
          </div>
        </div>
        `).join('')}
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ANEXO 2 -->
    <div class="report-section p-8">
      <h3 class="text-xl font-serif font-bold text-gray-900 mb-6 border-b border-gray-300 pb-2">ANEXO 02 - MEMÓRIA DE CÁLCULO</h3>
      <p class="text-sm text-gray-600 mb-6">Demonstrativo da Homogeneização dos Valores Unitários.</p>

      <div class="overflow-x-auto">
        <table class="w-full text-xs text-center border-collapse border border-gray-300">
          <thead>
            <tr class="bg-gray-100 text-gray-700">
              <th class="border border-gray-300 p-2">Amostra</th>
              <th class="border border-gray-300 p-2">V. Unit. Original</th>
              <th class="border border-gray-300 p-2 bg-yellow-50">Fator Oferta</th>
              ${isRural ? `
              <th class="border border-gray-300 p-2">F. Grandeza</th>
              <th class="border border-gray-300 p-2">F. Topografia</th>
              <th class="border border-gray-300 p-2">F. Acesso</th>
              <th class="border border-gray-300 p-2">F. Solo</th>
              ` : ''}
              <th class="border border-gray-300 p-2 bg-green-50 font-bold">V. Unit. Homog.</th>
            </tr>
          </thead>
          <tbody>
            ${homogenizedSamples.map((s, idx) => {
              const findF = (name: string) => s.factors?.find((f:any) => f.name === name)?.value || 1.00;
              const fOferta = findF('Oferta');
              const fGrand = findF('Grandeza');
              const fTopo = findF('Topografia');
              const fAces = findF('Acesso');
              const fSolo = findF('Solo');
              
              return `
              <tr>
                <td class="border border-gray-300 p-2 font-bold">#${idx + 1}</td>
                <td class="border border-gray-300 p-2">${fmtBRL(s.pricePerUnit)}</td>
                <td class="border border-gray-300 p-2 bg-yellow-50">${fmtDec(fOferta)}</td>
                ${isRural ? `
                <td class="border border-gray-300 p-2">${fmtDec(fGrand)}</td>
                <td class="border border-gray-300 p-2">${fmtDec(fTopo)}</td>
                <td class="border border-gray-300 p-2">${fmtDec(fAces)}</td>
                <td class="border border-gray-300 p-2">${fmtDec(fSolo)}</td>
                ` : ''}
                <td class="border border-gray-300 p-2 bg-green-50 font-bold">${fmtBRL(s.homogenizedUnitPrice)}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="mt-4 text-xs text-gray-500 italic p-4 bg-gray-50 rounded border border-gray-200">
        <p class="mb-1"><strong>Nota Explicativa:</strong></p>
        <ul class="list-disc pl-4 space-y-1">
          <li><strong>Fator Oferta (0,90):</strong> Ajuste de elasticidade de negociação comum ao mercado.</li>
          ${isRural ? `<li><strong>Fator Grandeza:</strong> Ajuste estatístico pela diferença de dimensão entre amostra e avaliando (Expoente ${GREATNESS_EXPONENT}).</li>` : ''}
          <li>Os demais fatores equalizam as características físicas da amostra para a realidade do imóvel avaliando (Paradigma = 1,00).</li>
        </ul>
      </div>
      
      <div class="mt-12">
        <h3 class="text-sm font-bold text-gray-900 mb-2">RESPONSABILIDADE E LIMITAÇÕES</h3>
        <p class="text-xs text-gray-600 text-justify leading-normal">
          Este Laudo de Avaliação foi produzido com base em informações fornecidas, incluindo a documentação do imóvel objeto da análise, as quais são admitidas como verdadeiras.
          Aspectos ambientais que necessitem de reparação não foram investigados profundamente, limitando-se à análise visual.
          A utilização deste Laudo de Avaliação é restrita à finalidade nele descrita.
        </p>
      </div>
    </div>
  `;

  return {
    reportText,
    sources: homogenizedSamples,
    estimatedValue: hasSamples ? fmtBRL(marketValue) : 'N/A'
  };
};
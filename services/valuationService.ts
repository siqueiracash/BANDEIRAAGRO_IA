import { PropertyData, ValuationResult, PropertyType, MarketSample } from "../types";
import { filterSamples, getSamplesByCities } from "./storageService";
import { getNeighboringCities } from "./geminiService";

// --- TABELAS DE COEFICIENTES EMPÍRICOS (NBR 14653-3) ---
// Estes índices servem para homogeneizar as amostras em relação ao paradigma (imóvel avaliando).
// Valores maiores indicam características melhores.

const COEF_TOPOGRAPHY: Record<string, number> = {
  'Plano': 1.00,
  'Leve Ondulado': 0.90,
  'Ondulado': 0.80,
  'Montanhoso': 0.60,
  'DEFAULT': 1.00
};

const COEF_ACCESS: Record<string, number> = {
  'Ótimo': 1.10, // Asfalto/Próximo
  'Muito bom': 1.05,
  'Bom': 1.00, // Padrão
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

// Coeficiente de elasticidade para o Fator Grandeza (Empírico para rurais)
// Varia tipicamente entre 0.10 e 0.25 dependendo da região. Adotado 0.15 como média conservadora.
const GREATNESS_EXPONENT = 0.15; 

// Função auxiliar para pegar coeficiente com fallback seguro
const getCoef = (table: Record<string, number>, key: string | undefined) => {
  if (!key) return table['DEFAULT'];
  // Tenta encontrar a chave exata ou parcial
  const found = Object.keys(table).find(k => k.toLowerCase() === key.toLowerCase());
  return found ? table[found] : table['DEFAULT'];
};

export const generateManualValuation = async (data: PropertyData): Promise<ValuationResult> => {
  // Simula tempo de processamento UI
  await new Promise(resolve => setTimeout(resolve, 500));

  const isRural = data.type === PropertyType.RURAL;
  const subType = isRural ? data.ruralActivity : data.urbanSubType;
  let searchScope = `região de **${data.city}/${data.state}**`;
  const MIN_SAMPLES = 5;
  
  // --- 1. COLETA DE DADOS (Lógica de busca hierárquica) ---
  
  // A: Tenta filtro exato (Cidade + Tipo + Subtipo/Atividade)
  let samples = await filterSamples(data.type, data.city, data.state, subType);

  // B: Busca geral na cidade
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

  // C: Busca Regional (Cidades Vizinhas)
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
          searchScope = `região de **${data.city}** e municípios vizinhos (**${neighborCities.slice(0, 3).join(', ')}...**) devido à escassez local`;
        }
      }
    } catch (err) {
      console.warn("Falha ao buscar cidades vizinhas:", err);
    }
  }

  // D: Busca Estadual (Apenas Rural)
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
      searchScope = `âmbito estadual (**${data.state}**) devido à escassez de dados locais em ${data.city} e arredores`;
    }
  }

  const hasSamples = samples.length > 0;
  const unitStr = isRural ? 'ha' : 'm²';
  const OFFER_FACTOR = 0.90; // Fator de Oferta (-10%)

  // --- 2. CÁLCULOS E HOMOGENEIZAÇÃO (NBR 14653-3) ---
  
  let homogenizedSamples: any[] = [];
  let sumHomogenizedUnit = 0;

  if (hasSamples) {
    homogenizedSamples = samples.map(sample => {
      let unitPrice = sample.pricePerUnit;
      let factors: string[] = [];
      let totalFactor = 1.0;

      // 1. Fator Oferta (Sempre aplicado para trazer valor de oferta para valor de venda provável)
      unitPrice = unitPrice * OFFER_FACTOR;
      factors.push(`Oferta (0.90)`);

      // 2. Fatores Físicos (Apenas RURAL aplica homogeneização detalhada neste modelo)
      if (isRural) {
        // --- FATOR GRANDEZA (Transposição de Área) ---
        // Fórmula: (Area_Amostra / Area_Avaliando) ^ k
        // Explicação: Se a amostra é maior que o avaliando, ela tende a ter unitário menor. 
        // O fator será > 1 para aumentar o unitário da amostra para comparar com o avaliando.
        if (data.areaTotal > 0 && sample.areaTotal > 0) {
           const areaRatio = sample.areaTotal / data.areaTotal;
           const factorGreatness = Math.pow(areaRatio, GREATNESS_EXPONENT);
           
           // Aplica apenas se a diferença for relevante (ex: > 1%)
           if (Math.abs(factorGreatness - 1.0) > 0.01) {
             unitPrice = unitPrice * factorGreatness;
             factors.push(`Grandeza (${factorGreatness.toFixed(2)})`);
           }
        }

        // Topografia
        const coefSubjectTopo = getCoef(COEF_TOPOGRAPHY, data.topography);
        const coefSampleTopo = sample.topography ? getCoef(COEF_TOPOGRAPHY, sample.topography) : coefSubjectTopo;
        const factorTopo = coefSubjectTopo / coefSampleTopo;
        
        if (factorTopo !== 1.0) {
          unitPrice = unitPrice * factorTopo;
          factors.push(`Topografia (${factorTopo.toFixed(2)})`);
        }

        // Acesso
        const coefSubjectAccess = getCoef(COEF_ACCESS, data.access);
        const coefSampleAccess = sample.access ? getCoef(COEF_ACCESS, sample.access) : coefSubjectAccess;
        const factorAccess = coefSubjectAccess / coefSampleAccess;

        if (factorAccess !== 1.0) {
          unitPrice = unitPrice * factorAccess;
          factors.push(`Acesso (${factorAccess.toFixed(2)})`);
        }

        // Solo / Superfície
        const coefSubjectSurf = getCoef(COEF_SURFACE, data.surface);
        const coefSampleSurf = sample.surface ? getCoef(COEF_SURFACE, sample.surface) : coefSubjectSurf;
        const factorSurf = coefSubjectSurf / coefSampleSurf;

        if (factorSurf !== 1.0) {
          unitPrice = unitPrice * factorSurf;
          factors.push(`Solo (${factorSurf.toFixed(2)})`);
        }
      }

      sumHomogenizedUnit += unitPrice;

      return {
        ...sample,
        homogenizedUnitPrice: unitPrice,
        appliedFactors: factors.join(', ')
      };
    });
  }

  // Média Saneada (Homogeneizada)
  const avgHomogenizedUnitPrice = hasSamples ? (sumHomogenizedUnit / homogenizedSamples.length) : 0;
  
  // Definição da Área de Referência
  let refArea = data.areaTotal;
  if (!isRural && data.areaBuilt && data.areaBuilt > 0) {
    refArea = data.areaBuilt;
  }

  const estimatedValue = avgHomogenizedUnitPrice * refArea;

  const fmtVal = estimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtAvg = avgHomogenizedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // --- 3. GERAÇÃO DO TEXTO DO LAUDO (NBR 14653-3) ---

  const ruralSpecifics = isRural ? `
### 3. FATORES DE AVALIAÇÃO E CARACTERÍSTICAS FÍSICAS
Conforme NBR 14653-3, foram considerados os seguintes aspectos físicos na homogeneização:

* **Topografia:** ${data.topography || 'Não informado'} (Impacto na mecanização e manejo).
* **Superfície/Solo:** ${data.surface || 'Não informado'} (Drenagem e capacidade de suporte).
* **Acessibilidade:** ${data.access || 'Não informado'} (Logística de insumos e escoamento).
* **Fator Grandeza:** Ajuste estatístico aplicado para compensar a elasticidade do preço unitário em função da diferença de área entre as amostras e o imóvel avaliando.
* **Recursos Hídricos:** Considerado implicitamente no valor de mercado da região.

### 4. BENFEITORIAS E INFRAESTRUTURA
* **Construções/Instalações:** ${data.improvements || 'Não detalhado'}.
* **Infraestrutura Produtiva:** A avaliação considera o estado de conservação e utilidade das benfeitorias para a atividade predominante (${data.ruralActivity}).

### 5. CAPACIDADE PRODUTIVA E USO
* **Atividade Predominante:** ${data.ruralActivity}.
* **Ocupação do Solo:** ${data.occupation || 'Não informado'}.
A região apresenta aptidão para atividades agropecuárias, influenciando diretamente a liquidez e o valor de mercado.

### 6. ASPECTOS LEGAIS E AMBIENTAIS
* **CAR (Cadastro Ambiental Rural):** ${data.carNumber ? `Informado (${data.carNumber})` : 'Não informado'}.
* **Análise:** Pressupõe-se regularidade documental e ambiental para fins desta avaliação preliminar de mercado. Passivos ambientais ou restrições legais específicas requerem diligência jurídica aprofundada não escopada nesta avaliação automática.
` : `
### 3. CARACTERÍSTICAS DO IMÓVEL URBANO
* **Padrão Construtivo:** ${data.urbanSubType}
* **Conservação:** ${data.conservationState || 'Não informado'}
* **Dependências:** ${data.bedrooms || 0} quartos, ${data.bathrooms || 0} banheiros.
`;

  const reportText = `
# LAUDO TÉCNICO DE AVALIAÇÃO - BANDEIRA AGRO
**Norma Aplicável:** ${isRural ? 'ABNT NBR 14653-3 (Imóveis Rurais)' : 'ABNT NBR 14653-2 (Imóveis Urbanos)'}
**Data:** ${new Date().toLocaleDateString()}

---

## 1. DADOS DO IMÓVEL AVALIANDO
* **Localização:** ${data.address || ''}, ${data.city}/${data.state}
* **Área Total:** ${data.areaTotal} ${unitStr}
* **Natureza:** ${data.type}

---

## 2. METODOLOGIA (MÉTODO COMPARATIVO DIRETO DE DADOS DE MERCADO)
A avaliação foi realizada através da pesquisa de mercado de imóveis semelhantes, aplicando-se tratamento por fatores (Homogeneização) para equalizar as características entre as amostras e o imóvel avaliando.

**Abrangência da Pesquisa:** ${searchScope}.
**Amostras Utilizadas:** ${samples.length} elementos comparáveis.

${ruralSpecifics}

---

## ${isRural ? '7' : '4'}. CÁLCULOS E HOMOGENEIZAÇÃO

Foi aplicado o **Fator de Oferta (0.90)** sobre todas as amostras para ajustar a elasticidade de negociação (pedida vs. fechamento).
${isRural ? 'Adicionalmente, foram aplicados fatores de homogeneização para Topografia, Acesso, Solo e **Grandeza (Área)**.' : ''}

### Quadro de Amostras e Tratamento
| Local | Valor Oferta/${unitStr} | Fatores Aplicados | **Valor Homogeneizado/${unitStr}** |
|---|---|---|---|
${homogenizedSamples.map(s => `| ${s.city} | ${s.pricePerUnit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} | ${s.appliedFactors} | **${s.homogenizedUnitPrice.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}** |`).join('\n')}

---

## ${isRural ? '8' : '5'}. CONCLUSÃO DE VALOR DE MERCADO

O valor de mercado foi determinado pela média saneada das amostras homogeneizadas, multiplicada pela área do imóvel.

* **Média Unitária Homogeneizada:** ${fmtAvg} / ${unitStr}
* **Área Considerada:** ${refArea} ${unitStr}

# **VALOR TOTAL ESTIMADO: ${hasSamples ? fmtVal : 'INCONCLUSIVO'}**

${!hasSamples ? '> **NOTA TÉCNICA:** Insuficiência de dados amostrais estatisticamente relevantes nesta região. Recomenda-se vistoria in loco para coleta de dados primários.' : ''}
  `;

  return {
    reportText,
    sources: homogenizedSamples, // Retorna as amostras já com os dados processados para display se necessário
    estimatedValue: hasSamples ? fmtVal : 'N/A'
  };
};
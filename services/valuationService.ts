import { PropertyData, ValuationResult, PropertyType } from "../types";
import { filterSamples, getSamplesByCities } from "./storageService";
import { getNeighboringCities } from "./geminiService";

export const generateManualValuation = async (data: PropertyData): Promise<ValuationResult> => {
  // Simula tempo de processamento UI (opcional)
  await new Promise(resolve => setTimeout(resolve, 500));

  // 1. Busca no banco de dados
  const subType = data.type === PropertyType.URBAN ? data.urbanSubType : data.ruralActivity;
  let searchScope = `região de **${data.city}/${data.state}**`;
  const MIN_SAMPLES = 5;
  
  // A: Tenta filtro exato (Cidade + Tipo + Subtipo/Atividade)
  let samples = await filterSamples(data.type, data.city, data.state, subType);

  // Se não achar exato (menos de 5), busca geral na cidade (sem filtrar subtipo)
  if (samples.length < MIN_SAMPLES) {
    const generalCitySamples = await filterSamples(data.type, data.city, data.state);
    // Mescla evitando duplicatas (por ID)
    const existingIds = new Set(samples.map(s => s.id));
    for (const gs of generalCitySamples) {
      if (!existingIds.has(gs.id)) {
        samples.push(gs);
        existingIds.add(gs.id);
      }
    }
  }

  // --- LÓGICA RURAL/URBANA REGIONAL (CIDADES VIZINHAS) ---
  // Se ainda < 5, busca nas CIDADES VIZINHAS
  if (samples.length < MIN_SAMPLES) {
    try {
      // Pergunta para IA quais são as cidades vizinhas
      const neighborCities = await getNeighboringCities(data.city, data.state);
      
      if (neighborCities.length > 0) {
        // Busca no banco nessas cidades
        const neighborSamples = await getSamplesByCities(neighborCities, data.state, data.type, subType);
        
        // Se ainda pouco, busca geral nessas cidades
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

  // --- LÓGICA RURAL ESTADUAL (FALLBACK FINAL) ---
  // Se ainda for insuficiente E for Imóvel Rural, busca no ESTADO todo
  if (samples.length < MIN_SAMPLES && data.type === PropertyType.RURAL) {
    // Tenta Estado + Atividade (ex: Estado SP + Lavoura)
    let stateSamples = await filterSamples(data.type, '', data.state, subType);

    // Se ainda insuficiente, busca Estado Geral (ex: Estado SP + Qualquer Rural)
    if (stateSamples.length < MIN_SAMPLES) {
      const generalStateSamples = await filterSamples(data.type, '', data.state);
       // Mescla
       const stateIds = new Set(stateSamples.map(s => s.id));
       for (const gs of generalStateSamples) {
         if (!stateIds.has(gs.id)) {
           stateSamples.push(gs);
           stateIds.add(gs.id);
         }
       }
    }

    // Mescla com o que já temos
    const existingIds = new Set(samples.map(s => s.id));
    let usedState = false;

    for (const ss of stateSamples) {
       // Só adiciona se precisar preencher até atingir um número razoável ou se não tiver nada
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
  let avgUnitPrice = 0;
  let estimatedValue = 0;

  if (hasSamples) {
    const sumUnit = samples.reduce((acc, curr) => acc + curr.pricePerUnit, 0);
    avgUnitPrice = sumUnit / samples.length;
    
    const refArea = (data.areaBuilt && data.areaBuilt > 0) ? data.areaBuilt : data.areaTotal;
    estimatedValue = avgUnitPrice * refArea;
  }

  const fmtVal = estimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const unitStr = data.type === PropertyType.URBAN ? 'm²' : 'ha';

  const reportText = `
# LAUDO DE AVALIAÇÃO - BANDEIRA AGRO

**Data:** ${new Date().toLocaleDateString()}
**Natureza:** ${data.type}

---

## 1. DADOS DO IMÓVEL
* **Endereço:** ${data.address || 'N/A'}
* **Cidade/UF:** ${data.city}/${data.state}
* **Área Total:** ${data.areaTotal} ${unitStr}
* **Descrição:** ${data.description || '-'}

---

## 2. METODOLOGIA (MÉTODO COMPARATIVO)
Foi realizada pesquisa no Banco de Dados da Bandeira Agro com abrangência na ${searchScope}.

* **Amostras Utilizadas:** ${samples.length}

---

## 3. CÁLCULOS
* **Média Unitária:** ${avgUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ${unitStr}

---

## 4. CONCLUSÃO DE VALOR

# **${hasSamples ? fmtVal : 'INCONCLUSIVO (Sem amostras)'}**

${!hasSamples ? '> **AVISO:** Nenhuma amostra encontrada no banco de dados para esta região (Municipal ou Estadual). Cadastre amostras no Painel Administrativo.' : ''}
  `;

  return {
    reportText,
    sources: samples,
    estimatedValue: hasSamples ? fmtVal : 'N/A'
  };
};

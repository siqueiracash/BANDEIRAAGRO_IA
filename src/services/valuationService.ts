import { PropertyData, ValuationResult, PropertyType } from "../types";
import { filterSamples } from "./storageService";

export const generateManualValuation = async (data: PropertyData): Promise<ValuationResult> => {
  // Simula tempo de processamento
  await new Promise(resolve => setTimeout(resolve, 800));

  // 1. Busca no banco de dados
  const subType = data.type === PropertyType.URBAN ? data.urbanSubType : data.ruralActivity;
  let samples = filterSamples(data.type, data.city, data.state, subType);

  // Se não achar exato, busca geral na cidade
  if (samples.length < 3) {
    samples = filterSamples(data.type, data.city, data.state);
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
Foi realizada pesquisa no Banco de Dados Interno da Bandeira Agro na região de **${data.city}/${data.state}**.

* **Amostras Encontradas:** ${samples.length}

---

## 3. CÁLCULOS
* **Média Unitária:** ${avgUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ${unitStr}

---

## 4. CONCLUSÃO DE VALOR

# **${hasSamples ? fmtVal : 'INCONCLUSIVO (Sem amostras)'}**

${!hasSamples ? '> **AVISO:** Cadastre amostras nesta região no Painel Administrativo.' : ''}
  `;

  return {
    reportText,
    sources: samples,
    estimatedValue: hasSamples ? fmtVal : 'N/A'
  };
};
import { GoogleGenAI } from "@google/genai";
import { PropertyData, PropertyType, ValuationResult, GroundingSource } from "../types";

// Helper to get API Key safely across different environments (Vite, Next.js, Node)
const getApiKey = () => {
  // @ts-ignore - Vite uses import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  // Standard Node/Webpack process.env
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return '';
};

const apiKey = getApiKey();

if (!apiKey) {
  console.warn("API Key não encontrada. Configure VITE_API_KEY no arquivo .env");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

/**
 * Generates a valuation report by searching for comparables and applying ABNT NBR 14653 logic.
 */
export const generateValuationReport = async (data: PropertyData): Promise<ValuationResult> => {
  if (!apiKey) {
    throw new Error("Chave de API não configurada. Entre em contato com o administrador do sistema.");
  }

  const modelId = "gemini-2.5-flash"; 

  const areaUnit = data.type === PropertyType.RURAL ? "hectares" : "metros quadrados";
  const nbrStandard = data.type === PropertyType.URBAN ? "ABNT NBR 14653-2 (Imóveis Urbanos)" : "ABNT NBR 14653-3 (Imóveis Rurais)";
  
  let specificDetails = '';
  let searchDescriptors = '';

  if (data.type === PropertyType.URBAN) {
    specificDetails = `
    - Subtipo: ${data.urbanSubType || 'Não especificado'}
    - Quartos: ${data.bedrooms || 'Não informado'}
    - Banheiros: ${data.bathrooms || 'Não informado'}
    - Vagas: ${data.parking || 'Não informado'}
    - Estado de Conservação: ${data.conservationState || 'Não informado'}
    `;
    
    // Construct a more specific search term for Urban
    // Prioritize neighborhood if available, otherwise just city
    const locationTerm = data.neighborhood ? `bairro ${data.neighborhood} ${data.city}` : `${data.city} ${data.state}`;
    searchDescriptors = `${data.urbanSubType} ${data.bedrooms ? data.bedrooms + ' quartos' : ''} ${locationTerm}`;
  } else {
    specificDetails = `
    - Atividade Predominante: ${data.ruralActivity || 'Não informado'}
    - CAR: ${data.carNumber || 'Não informado'}
    - Superfície: ${data.surface || 'Não informado'}
    - Acessibilidade: ${data.access || 'Não informado'}
    - Topografia: ${data.topography || 'Não informado'}
    - Ocupação: ${data.occupation || 'Não informado'}
    - Classificação Benfeitorias: ${data.improvements || 'Não informado'}
    `;

    // Construct a more specific search term for Rural
    searchDescriptors = `fazenda sítio ${data.ruralActivity} ${data.areaTotal} hectares ${data.city} ${data.state}`;
  }

  // Construct optimized search query for Google Search Tool
  const searchTerm = `venda ${searchDescriptors} preço valor`;

  const prompt = `
    Atue como um Engenheiro de Avaliações Sênior expert na norma ${nbrStandard}.
    
    Sua tarefa é avaliar um IMÓVEL ${data.type} e gerar um Laudo de Avaliação Completo.
    
    DADOS DO IMÓVEL AVALIANDO:
    - Endereço/Localização: ${data.address || 'Não informado'}
    - Bairro/Região: ${data.neighborhood || ''}
    - Cidade/UF: ${data.city} - ${data.state}
    - Área Total: ${data.areaTotal} ${areaUnit}
    ${data.areaBuilt ? `- Área Construída: ${data.areaBuilt} m²` : ''}
    ${specificDetails}
    - Detalhes Adicionais: ${data.description}

    PROCEDIMENTO OBRIGATÓRIO (FUNDAMENTAL):
    1. ANÁLISE DE LOCALIZAÇÃO (Google Maps):
       - Utilize o Google Maps para validar a localização do endereço: "${data.address}, ${data.city}".
       - Descreva brevemente a região (infraestrutura, vizinhança e valorização) no Diagnóstico de Mercado.
       
    2. PESQUISA DE AMOSTRAS (Google Search):
       - Busque pelo menos 5 (CINCO) ofertas REAIS e ATUAIS de imóveis semelhantes na mesma região ou bairro.
       - Use o termo sugerido para ajudar: "${searchTerm}".
       - Se não houver amostras no bairro exato, busque na região imediata.

    3. CÁLCULOS:
       - Liste as 5 amostras em uma tabela detalhada.
       - Aplique o Método Comparativo Direto de Dados de Mercado conforme a ${nbrStandard}.
       - Realize a HOMOGENEIZAÇÃO dos valores.
       - Calcule o Valor de Mercado Total e Unitário.
    
    ESTRUTURA DO LAUDO (FORMATO MARKDOWN):
    Gere um LAUDO TÉCNICO DE AVALIAÇÃO formal contendo:
    
    ### 1. Identificação
    Dados do solicitante e descrição completa do imóvel avaliando.

    ### 2. Diagnóstico de Mercado e Localização
    Panorama da região de ${data.city} e características específicas da localização do imóvel (Use informações do Maps).

    ### 3. Pesquisa de Mercado (Amostragem)
    *TABELA OBRIGATÓRIA* com 5 amostras contendo (Inclua o LINK/FONTE na tabela):
    | Descrição | Localização | Área | Valor Oferta | Fonte (Site/Imobiliária) |
    |---|---|---|---|---|
    | ... | ... | ... | ... | ... |
    
    ### 4. Cálculos e Homogeneização
    Explique os fatores de homogeneização utilizados.

    ### 5. Conclusão do Valor de Mercado
    Determine o valor final do imóvel.
    **VALOR DE MERCADO ESTIMADO: R$ X.XXX.XXX,XX**
    
    ### 6. Encerramento
    Local e Data de hoje. Assinado: BANDEIRA AGRO - Inteligência em Avaliações.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        // Integrated Google Maps and Google Search
        tools: [
          { googleSearch: {} },
          { googleMaps: {} }
        ],
        systemInstruction: "Você é o avaliador chefe da BANDEIRA AGRO. Seu objetivo é fornecer avaliações precisas baseadas na NBR 14653. Você DEVE buscar dados reais na web e fornecer as fontes.",
        temperature: 0.3, 
      },
    });

    const text = response.text;
    
    // Extract grounding chunks (sources from Web and Maps)
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = [];

    groundingChunks.forEach((chunk: any) => {
      // Handle Web Search sources
      if (chunk.web) {
        sources.push({
          title: chunk.web.title,
          uri: chunk.web.uri,
        });
      }
      // Handle Google Maps sources
      else if (chunk.maps) {
        sources.push({
          title: chunk.maps.title || "Localização Google Maps",
          uri: chunk.maps.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address || data.city)}`,
        });
      }
    });

    // Simple regex to find the last occurrence of a currency value
    const valueMatch = text?.match(/R\$\s?[\d.,]+/g);
    const lastValue = valueMatch ? valueMatch[valueMatch.length - 1] : "Sob Consulta";

    return {
      reportText: text || "Não foi possível gerar o laudo. Tente novamente.",
      sources: sources,
      estimatedValue: lastValue
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Falha ao gerar a avaliação. Verifique a conexão ou tente novamente mais tarde.");
  }
};
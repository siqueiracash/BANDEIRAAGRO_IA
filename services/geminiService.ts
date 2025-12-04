import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PropertyData, PropertyType, ValuationResult, GroundingSource, MarketSample } from "../types";

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
 * Identifies neighboring cities for a given location to expand search scope.
 */
export const getNeighboringCities = async (city: string, state: string): Promise<string[]> => {
  if (!apiKey) return [];

  const modelId = "gemini-2.5-flash";
  const prompt = `Quais são as 5 a 8 cidades mais importantes e próximas geograficamente de ${city} no estado de ${state}? Liste cidades que provavelmente tenham mercado imobiliário rural ativo. Retorne apenas os nomes das cidades.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        } as Schema
      }
    });

    const cities = JSON.parse(response.text || "[]");
    return cities;
  } catch (error) {
    console.error("Erro ao buscar cidades vizinhas:", error);
    return [];
  }
};

/**
 * Searches for Urban Comparable Samples using Google Search Grounding.
 */
export const findUrbanSamples = async (data: PropertyData): Promise<MarketSample[]> => {
  if (!apiKey) {
    throw new Error("Chave de API não configurada.");
  }

  const modelId = "gemini-2.5-flash"; // Powerful enough for search + parsing

  // Construct a specific search query incl. new fields
  const searchQuery = `venda ${data.urbanSubType} ${data.neighborhood ? `bairro ${data.neighborhood}` : ''} ${data.city} ${data.state} ${data.bedrooms ? data.bedrooms + ' quartos' : ''} ${data.bathrooms ? data.bathrooms + ' banheiros' : ''} ${data.parking ? data.parking + ' vagas' : ''} ${data.areaTotal}m2 preço valor`;

  const prompt = `
    Atue como um Engenheiro de Avaliações.
    Pesquise na web por 5 a 8 ofertas REAIS e ATUAIS de imóveis semelhantes ao descrito abaixo para compor uma amostra de mercado (Método Comparativo Direto).
    
    IMÓVEL AVALIANDO:
    - Tipo: ${data.urbanSubType}
    - Local: ${data.neighborhood}, ${data.city} - ${data.state}
    - Área: ${data.areaTotal} m²
    - Quartos: ${data.bedrooms || 0}
    - Banheiros: ${data.bathrooms || 0}
    - Vagas: ${data.parking || 0}
    
    REGRAS:
    1. Busque em sites imobiliários brasileiros (Zap, VivaReal, OLX, Imovelweb, portais locais).
    2. Os imóveis devem ser na mesma cidade, preferencialmente no mesmo bairro ou região equivalente.
    3. As ofertas devem ter preço de venda (não aluguel).
    4. Se for "Terreno", ignore quartos/banheiros.
    5. Extraia os dados e retorne EXCLUSIVAMENTE um array JSON.

    SCHEMA JSON:
    [
      {
        "title": "Título do anúncio",
        "price": 500000.00 (Número puro),
        "areaTotal": 100 (Número puro em m²),
        "bedrooms": 2 (Número ou 0),
        "bathrooms": 2 (Número ou 0),
        "parking": 1 (Número ou 0),
        "address": "Endereço ou Bairro aproximado",
        "source": "Nome do Site (ex: VivaReal)",
        "url": "Link para o anúncio (se disponível na busca)",
        "description": "Breve descrição"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              price: { type: Type.NUMBER },
              areaTotal: { type: Type.NUMBER },
              bedrooms: { type: Type.NUMBER },
              bathrooms: { type: Type.NUMBER },
              parking: { type: Type.NUMBER },
              address: { type: Type.STRING },
              source: { type: Type.STRING },
              url: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "price", "areaTotal", "address", "source"]
          }
        } as Schema
      }
    });

    const rawSamples = JSON.parse(response.text || "[]");

    // Map to MarketSample interface
    const samples: MarketSample[] = rawSamples.map((s: any, index: number) => ({
      id: `ai-sample-${Date.now()}-${index}`,
      type: PropertyType.URBAN,
      title: s.title,
      address: s.address,
      city: data.city,
      state: data.state,
      neighborhood: data.neighborhood, // Assume similar neighborhood if not explicitly parsed
      price: s.price,
      areaTotal: s.areaTotal,
      areaBuilt: s.areaTotal, // Usually areaTotal = areaBuilt for apartments/houses in simple ads
      pricePerUnit: s.price / s.areaTotal,
      date: new Date().toISOString(),
      source: s.source + (s.url ? ` (${s.url})` : ''),
      urbanSubType: data.urbanSubType,
      bedrooms: s.bedrooms || 0,
      bathrooms: s.bathrooms || 0,
      parking: s.parking || 0,
      conservationState: 'Bom' // Default conservative assumption
    }));

    // Filter out invalid samples (e.g. zero price or area)
    return samples.filter(s => s.price > 0 && s.areaTotal > 0);

  } catch (error) {
    console.error("Erro ao buscar amostras urbanas via IA:", error);
    return []; // Handle gracefully in the controller
  }
};

import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, PropertyType, MarketSample } from "../types";

/**
 * Valida a chave de API antes de instanciar o SDK
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("AUTH_REQUIRED");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Busca Amostras com Integração Profunda em Portais
 */
export const findMarketSamplesIA = async (data: PropertyData, isDeepSearch = false): Promise<MarketSample[]> => {
  const ai = getAiClient();
  
  const locationContext = isDeepSearch 
    ? `${data.city} ${data.state} (bairros próximos ao ${data.neighborhood || 'Centro'})`
    : `bairro "${data.neighborhood}" em ${data.city} ${data.state}`;

  const prompt = `
    Aja como um Agente de Inteligência Imobiliária da BANDEIRA AGRO.
    Objetivo: Encontrar 15 amostras REAIS de venda de ${data.urbanSubType || data.ruralActivity} em ${locationContext}.
    FONTES: Imovelweb, Zap Imóveis, VivaReal e OLX.
    REGRAS: Ignore aluguéis, ignore sem preço/área. Extraia URL, preço e área.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
              area: { type: Type.NUMBER },
              neighborhood: { type: Type.STRING },
              source: { type: Type.STRING },
              url: { type: Type.STRING },
              bedrooms: { type: Type.NUMBER },
              bathrooms: { type: Type.NUMBER },
              parking: { type: Type.NUMBER }
            },
            required: ["price", "area", "url"]
          }
        }
      }
    });

    const results = JSON.parse(response.text || "[]");
    return results.map((s: any, index: number) => ({
      id: `ia-${Date.now()}-${index}`,
      type: data.type,
      title: s.title || `${data.urbanSubType} em ${s.neighborhood || data.city}`,
      address: s.neighborhood ? `${s.neighborhood}, ${data.city}` : data.city,
      city: data.city,
      state: data.state,
      neighborhood: s.neighborhood || data.neighborhood,
      price: Number(s.price),
      areaTotal: Number(s.area),
      pricePerUnit: Number(s.price) / Number(s.area),
      date: new Date().toISOString(),
      source: s.source || 'Portal Integrado',
      url: s.url,
      urbanSubType: data.urbanSubType,
      ruralActivity: data.ruralActivity,
      bedrooms: s.bedrooms || 0,
      bathrooms: s.bathrooms || 0,
      parking: s.parking || 0,
      conservationState: 'Bom'
    })).filter((s: any) => s.price > 5000);
  } catch (error) {
    console.error("Erro na busca integrada:", error);
    throw error;
  }
};

/**
 * Extrai dados técnicos de uma URL de anúncio
 */
export const extractSampleFromUrl = async (url: string, type: PropertyType): Promise<Partial<MarketSample> | null> => {
  try {
    const ai = getAiClient();
    const prompt = `Analise o anúncio: ${url}. Extraia metadados técnicos para imóvel ${type}.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            price: { type: Type.NUMBER },
            areaTotal: { type: Type.NUMBER },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            neighborhood: { type: Type.STRING }
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error("Erro na extração via URL:", error);
    return null;
  }
};

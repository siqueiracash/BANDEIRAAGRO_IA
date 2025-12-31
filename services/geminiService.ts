
import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, PropertyType, MarketSample } from "../types";

/**
 * Busca Amostras com Integração Profunda em Portais (Imovelweb, Zap, VivaReal, OLX)
 */
export const findMarketSamplesIA = async (data: PropertyData, isDeepSearch = false): Promise<MarketSample[]> => {
  // Instancia o cliente usando a variável de ambiente injetada
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const locationContext = isDeepSearch 
    ? `${data.city} ${data.state} (bairros próximos ao ${data.neighborhood || 'Centro'})`
    : `bairro "${data.neighborhood}" em ${data.city} ${data.state}`;

  const prompt = `
    Aja como um Agente de Inteligência Imobiliária da BANDEIRA AGRO.
    Objetivo: Encontrar 15 amostras REAIS de venda de ${data.urbanSubType || data.ruralActivity} em ${locationContext}.
    
    FONTES OBRIGATÓRIAS: Imovelweb, Zap Imóveis, VivaReal e OLX.
    
    REGRAS DE EXTRAÇÃO:
    1. Ignore anúncios de ALUGUEL.
    2. Ignore anúncios sem PREÇO ou sem ÁREA (m²/ha).
    3. Extraia o link (URL) original do anúncio.
    4. Identifique o padrão de conservação (Novo, Bom, Regular).
    5. Se encontrar poucos resultados no bairro, expanda para bairros adjacentes de mesmo padrão.
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
              source: { type: Type.STRING, description: "Nome do portal (ex: Imovelweb)" },
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
 * Extrai dados técnicos de uma URL de anúncio usando IA com Search Grounding
 */
export const extractSampleFromUrl = async (url: string, type: PropertyType): Promise<Partial<MarketSample> | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const prompt = `
    Analise rigorosamente o anúncio de imóvel no link: ${url}
    Extraia os metadados técnicos para um imóvel do tipo ${type}.
    Retorne apenas o JSON no formato solicitado.
  `;

  try {
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
            areaBuilt: { type: Type.NUMBER },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            neighborhood: { type: Type.STRING },
            address: { type: Type.STRING },
            description: { type: Type.STRING },
            urbanSubType: { type: Type.STRING },
            ruralActivity: { type: Type.STRING },
            bedrooms: { type: Type.NUMBER },
            bathrooms: { type: Type.NUMBER },
            parking: { type: Type.NUMBER }
          }
        }
      }
    });

    if (!response.text) return null;
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erro na extração via URL:", error);
    return null;
  }
};

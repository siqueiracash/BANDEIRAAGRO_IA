
import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, PropertyType, MarketSample } from "../types";

/**
 * Busca Amostras com Integração Profunda em Portais usando Modelos Pro
 */
export const findMarketSamplesIA = async (data: PropertyData, isDeepSearch = false): Promise<MarketSample[]> => {
  // Cria a instância no momento da chamada para garantir que process.env.API_KEY esteja disponível
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const locationContext = isDeepSearch 
    ? `${data.city} ${data.state} (bairros limítrofes ao ${data.neighborhood || 'Centro'})`
    : `bairro "${data.neighborhood}" em ${data.city} ${data.state}`;

  const prompt = `
    Aja como um Perito Avaliador Imobiliário sênior da BANDEIRA AGRO.
    Objetivo: Encontrar 15 amostras REAIS e ATUAIS de venda de ${data.urbanSubType || data.ruralActivity} em ${locationContext}.
    FONTES OBRIGATÓRIAS: Imovelweb, Zap Imóveis, VivaReal e OLX.
    REGRAS DE FILTRO: 
    1. Ignore anúncios de aluguel. 
    2. Ignore anúncios sem valor ou sem área informada. 
    3. Extraia o link direto da fonte.
    4. Homogeneíze os dados para o padrão da NBR 14653.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Upgrade para Pro para maior precisão em dados financeiros
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
      title: s.title || `${data.urbanSubType || data.ruralActivity} em ${s.neighborhood || data.city}`,
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
    })).filter((s: any) => s.price > 10000); // Filtro de segurança para evitar ruídos de leilão/aluguel
  } catch (error) {
    console.error("Erro na inteligência de mercado:", error);
    throw error;
  }
};

/**
 * Extrai dados técnicos de uma URL de anúncio via IA
 */
export const extractSampleFromUrl = async (url: string, type: PropertyType): Promise<Partial<MarketSample> | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const prompt = `Analise detalhadamente o anúncio deste link: ${url}. Extraia metadados técnicos específicos para um imóvel do tipo ${type}.`;
    
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

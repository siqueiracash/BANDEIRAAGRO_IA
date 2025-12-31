
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(request: any, response: any) {
  // Garantir que é um método POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, data, isDeepSearch, url, type } = request.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return response.status(500).json({ error: "API_KEY_MISSING_ON_SERVER" });
    }

    const ai = new GoogleGenAI({ apiKey });

    if (action === 'findSamples') {
      const locationContext = isDeepSearch 
        ? `${data.city} ${data.state} (bairros limítrofes ao ${data.neighborhood || 'Centro'})`
        : `bairro "${data.neighborhood}" em ${data.city} ${data.state}`;

      const prompt = `
        Aja como um Perito Avaliador Imobiliário sênior da BANDEIRA AGRO.
        Objetivo: Encontrar amostras REAIS e ATUAIS de venda de ${data.urbanSubType || data.ruralActivity} em ${locationContext}.
        FONTES: Imovelweb, Zap Imóveis, VivaReal e OLX.
        Retorne um array JSON com: title, price, area, neighborhood, source, url, bedrooms, bathrooms, parking.
      `;

      const genResult = await ai.models.generateContent({
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

      return response.status(200).json(JSON.parse(genResult.text || "[]"));
    }

    if (action === 'extractUrl') {
      const prompt = `Analise o anúncio: ${url}. Extraia metadados técnicos para o tipo ${type}.`;
      const genResult = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      return response.status(200).json(JSON.parse(genResult.text || "{}"));
    }

    return response.status(400).json({ error: "INVALID_ACTION" });

  } catch (error: any) {
    console.error("Erro no Servidor:", error);
    return response.status(500).json({ error: error.message });
  }
}

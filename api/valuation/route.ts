
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Este arquivo reside no SERVIDOR (Vercel).
 * Aqui o process.env.API_KEY é acessível e seguro.
 */
export async function POST(request: Request) {
  try {
    const { action, data, isDeepSearch, url, type } = await request.json();
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API_KEY_MISSING_ON_SERVER" }), { status: 500 });
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

      return new Response(response.text, { status: 200 });
    }

    if (action === 'extractUrl') {
      const prompt = `Analise o anúncio: ${url}. Extraia metadados técnicos para o tipo ${type}.`;
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
      return new Response(response.text, { status: 200 });
    }

    return new Response(JSON.stringify({ error: "INVALID_ACTION" }), { status: 400 });

  } catch (error: any) {
    console.error("Erro no Servidor:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}


import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { action, data, isDeepSearch, url, type } = request.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) return response.status(500).json({ error: "API_KEY_MISSING_ON_SERVER" });

    const ai = new GoogleGenAI({ apiKey });

    if (action === 'findSamples') {
      const location = isDeepSearch 
        ? `${data.city}/${data.state} (arredores)`
        : `${data.neighborhood || 'Centro'}, ${data.city}/${data.state}`;

      const prompt = `Encontre anúncios reais de venda para ${data.urbanSubType || data.ruralActivity} em ${location}. 
      Retorne JSON com: title, price, area, neighborhood, source, url, bedrooms, bathrooms, parking.`;

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
      const prompt = `Analise: ${url}. Extraia preço, área e localização para ${type}. Retorne JSON.`;
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
    console.error("Erro na Função Serverless:", error);
    // Repassa o status de erro da API do Google se disponível
    const statusCode = error.status || 500;
    return response.status(statusCode).json({ error: error.message || "Internal Server Error" });
  }
}


import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { action, data, url, type, searchScope } = request.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) return response.status(500).json({ error: "API_KEY_MISSING" });

    const ai = new GoogleGenAI({ apiKey });

    if (action === 'findSamples') {
      const street = data.address || '';
      const neighborhood = data.neighborhood || '';
      const city = data.city;
      const state = data.state;
      const typeLabel = data.urbanSubType || data.ruralActivity || "Imóvel";
      
      const isBroad = searchScope === 'broad';

      const prompt = `Aja como um perito avaliador imobiliário. Você PRECISA encontrar pelo menos 8 anúncios reais e recentes para ${typeLabel} em ${city}/${state}.
      
      SITES ALVO: zapimoveis.com.br, vivareal.com.br, imovelweb.com.br, olx.com.br, quintoandar.com.br.
      
      ESTRATEGIA DE BUSCA:
      ${isBroad 
        ? `FOCO AMPLO: Pesquise em todo o bairro "${neighborhood}" e arredores imediatos. Priorize anúncios que mencionem características similares a: ${data.description}.` 
        : `FOCO ESPECÍFICO: Priorize a rua "${street}" e o bairro "${neighborhood}". Se não houver resultados na rua, expanda imediatamente para o bairro.`
      }
      
      REQUISITOS OBRIGATÓRIOS:
      - O preço deve ser coerente com o mercado (venda, não aluguel).
      - Extraia a área útil/total corretamente.
      - Retorne apenas resultados com URLs válidas desses portais.
      
      Retorne um ARRAY JSON contendo: title, price (número), area (número), neighborhood, source, url.`;

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
                url: { type: Type.STRING }
              },
              required: ["price", "area", "url"]
            }
          }
        }
      });

      return response.status(200).json(JSON.parse(genResult.text || "[]"));
    }

    if (action === 'extractUrl') {
      const prompt = `Analise anúncio no link: ${url}. Extraia preço, área e localização para ${type}. Retorne JSON.`;
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
    const statusCode = error.status || 500;
    return response.status(statusCode).json({ error: error.message || "Internal Error" });
  }
}

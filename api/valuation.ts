
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
      
      let locationQuery = "";
      if (searchScope === 'specific') {
        locationQuery = `Rua "${street}" ou Bairro "${neighborhood}" em ${city}, ${state}`;
      } else if (searchScope === 'broad') {
        locationQuery = `Bairro "${neighborhood}" em ${city}, ${state}`;
      } else {
        locationQuery = `em toda a cidade de ${city}, ${state}`;
      }

      const prompt = `Você é um robô de extração de dados imobiliários especializado nos portais ZAP IMÓVEIS, VIVA REAL e IMOVELWEB.
      
      TAREFA: Encontre pelo menos 20 anúncios reais de VENDA de ${typeLabel} ${locationQuery}.
      
      REGRAS CRÍTICAS:
      1. IGNORE locações/aluguel. Apenas VENDA.
      2. Foque nos sites: zapimoveis.com.br, vivareal.com.br, imovelweb.com.br.
      3. Extraia o valor total de venda e a metragem (m2).
      4. Se for em ${city}, traga o máximo que encontrar. Não diga que não encontrou; os portais têm milhares de anúncios nesta cidade.
      
      FORMATO DE SAÍDA:
      Retorne APENAS um ARRAY JSON contendo objetos com: title, price (número), area (número), neighborhood, source, url.`;

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
      const prompt = `Analise anúncio no link: ${url}. Extraia preço total de venda, área e localização. Retorne JSON.`;
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

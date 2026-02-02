
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
      const city = data.city;
      const state = data.state;
      const typeLabel = data.urbanSubType || data.ruralActivity || "Imóvel";
      const neighborhood = data.neighborhood || "";
      
      const prompt = `Você é um especialista em mineração de dados imobiliários (Real Estate Data Scientist).
      
      TAREFA CRÍTICA: Extraia pelo menos 30 anúncios de VENDA reais para: ${typeLabel} em ${city}/${state}.
      
      INSTRUÇÕES DE BUSCA:
      1. Use o Google Search para encontrar links nos portais: zapimoveis.com.br, vivareal.com.br, imovelweb.com.br, olx.com.br.
      2. Foque PRIMEIRO no bairro "${neighborhood}", mas se houver poucos resultados, colete de toda a cidade de ${city}.
      3. Extraia: Título, Preço Total de Venda (Price), Área útil/total (Area), Bairro e a URL original.
      4. IGNORE QUALQUER ANÚNCIO DE ALUGUEL. Apenas VENDA.
      5. Não pare até ter pelo menos 20-30 itens. São Caetano do Sul e cidades similares possuem milhares de ofertas; sua missão é trazer uma lista farta para o banco de dados da BANDEIRA AGRO.
      
      FORMATO DE RETORNO:
      Um ARRAY JSON estrito. Cada objeto deve ter: title, price (número), area (número), neighborhood, source, url.`;

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
      const prompt = `Extraia dados de venda (Preço, Área, Bairro) deste link: ${url}. Retorne JSON.`;
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
    return response.status(500).json({ error: error.message || "Internal Error" });
  }
}

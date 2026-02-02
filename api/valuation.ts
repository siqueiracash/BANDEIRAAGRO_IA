
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { action, data, url, type } = request.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) return response.status(500).json({ error: "API_KEY_MISSING" });

    const ai = new GoogleGenAI({ apiKey });

    if (action === 'findSamples') {
      const city = data.city;
      const state = data.state;
      const isRural = data.type === 'RURAL';
      const typeLabel = isRural ? (data.ruralActivity || "Fazenda/Sítio") : (data.urbanSubType || "Imóvel Urbano");
      const unit = isRural ? "Hectares (ha)" : "m2";
      
      const prompt = `Aja como um Perito Avaliador Imobiliário da BANDEIRA AGRO. 
      Busque exclusivamente anúncios de VENDA ativos para: ${typeLabel} em ${city}/${state}.
      
      REGRAS:
      1. Extraia o valor total e a área em ${unit}.
      2. Foque em sites como Zap Imóveis, VivaReal, Imovelweb e sites especializados em agronegócio.
      3. Se for rural, ignore anúncios de locação de pasto ou arrendamento. Apenas VENDA de terra nua ou porteira fechada.
      
      Retorne um ARRAY JSON de objetos com: title, price, area, neighborhood, source, url.`;

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
              required: ["price", "area"]
            }
          }
        }
      });

      return response.status(200).json(JSON.parse(genResult.text || "[]"));
    }

    if (action === 'extractUrl') {
      const prompt = `Analise este link de anúncio e extraia Preço, Área e Localização. Retorne em JSON: ${url}`;
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
    return response.status(500).json({ error: "Erro na conexão com o motor de busca Bandeira Agro." });
  }
}


import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, MarketSample, PropertyType } from "../types";

const isPreview = () => !!(window as any).aistudio;

/**
 * Motor de IA local para uso no Preview do AI Studio (Usa o SDK diretamente)
 */
const runPreviewAI = async (payload: any) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  const ai = new GoogleGenAI({ apiKey });
  
  if (payload.action === 'findSamples') {
    const { data } = payload;
    const prompt = `Busque amostras de ${data.urbanSubType || data.ruralActivity} em ${data.city}. Retorne JSON.`;
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
    });
    return JSON.parse(res.text || "[]");
  }
  return {};
};

/**
 * Função centralizada para chamadas de IA (Backend Vercel ou SDK local)
 */
const callAI = async (payload: any) => {
  if (isPreview()) return await runPreviewAI(payload);

  try {
    const response = await fetch('/api/valuation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get("content-type");
    
    // Se o servidor retornar HTML (erro 404/500), isso causa o erro "Unexpected token T"
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("Resposta inválida do servidor (HTML):", errorText);
      throw new Error("O servidor da Vercel retornou uma página de erro em vez de dados. Verifique se o arquivo api/valuation.ts existe e se a API_KEY foi configurada no painel da Vercel.");
    }

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Erro desconhecido no servidor de IA.");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Falha na comunicação com a IA:", error);
    throw error;
  }
};

export const findMarketSamplesIA = async (data: PropertyData, isDeepSearch = false): Promise<MarketSample[]> => {
  try {
    const results = await callAI({ action: 'findSamples', data, isDeepSearch });
    if (!Array.isArray(results)) return [];

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
    })).filter((s: any) => s.price > 10000);
  } catch (error: any) {
    throw error;
  }
};

export const extractSampleFromUrl = async (url: string, type: PropertyType): Promise<Partial<MarketSample> | null> => {
  try {
    return await callAI({ action: 'extractUrl', url, type });
  } catch (error) {
    return null;
  }
};

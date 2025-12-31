
import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, MarketSample, PropertyType } from "../types";

const isPreview = () => !!(window as any).aistudio;

/**
 * Motor de IA local para uso no Preview do AI Studio
 */
const runPreviewAI = async (payload: any) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  const ai = new GoogleGenAI({ apiKey });
  
  if (payload.action === 'findSamples') {
    const { data, isDeepSearch } = payload;
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
 * Chama o backend no Vercel ou o SDK no Preview
 */
const callAI = async (payload: any) => {
  if (isPreview()) return await runPreviewAI(payload);

  const response = await fetch('/api/valuation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // Se o servidor devolver HTML em vez de JSON (Erro 404/500 padrão)
  const contentType = response.headers.get("content-type");
  if (!response.ok || !contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("Erro do Servidor (Não-JSON):", text);
    throw new Error("O servidor de IA não respondeu corretamente. Verifique se a API_KEY está configurada no painel da Vercel.");
  }

  return await response.json();
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
    console.error("Erro na busca de amostras:", error);
    throw error;
  }
};

export const extractSampleFromUrl = async (url: string, type: PropertyType): Promise<Partial<MarketSample> | null> => {
  try {
    return await callAI({ action: 'extractUrl', url, type });
  } catch (error) {
    console.error("Erro na extração:", error);
    return null;
  }
};

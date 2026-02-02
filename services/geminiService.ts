
import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, MarketSample, PropertyType } from "../types";

const isPreview = () => !!(window as any).aistudio;

async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const errorData = await response.json().catch(() => ({}));
      lastError = new Error(errorData.error || `Erro ${response.status}`);
      if (response.status === 429) {
        const delay = Math.pow(3, i) * 2000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (response.status >= 500) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw lastError;
    } catch (err) {
      lastError = err;
      if (i === maxRetries - 1) throw lastError;
    }
  }
  throw lastError;
}

const runPreviewAI = async (payload: any) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  const ai = new GoogleGenAI({ apiKey });
  
  if (payload.action === 'findSamples') {
    const { data, searchScope } = payload;
    const typeLabel = data.type === PropertyType.URBAN ? data.urbanSubType : data.ruralActivity;
    
    let scopeDesc = "";
    if (searchScope === 'specific') scopeDesc = `Rua ${data.address}, Bairro ${data.neighborhood}`;
    else if (searchScope === 'broad') scopeDesc = `Bairro ${data.neighborhood} e arredores`;
    else scopeDesc = `toda a cidade de ${data.city}`;

    const prompt = `Busque em portais como Zap, VivaReal e Imovelweb por anúncios de VENDA de ${typeLabel} em ${data.city}/${data.state}. 
    CONTEXTO DE LOCALIZAÇÃO: ${scopeDesc}.
    Retorne OBRIGATORIAMENTE 15 resultados reais e únicos em formato JSON (ARRAY de objetos com title, price, area, neighborhood, source, url).`;
    
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          tools: [{ googleSearch: {} }], 
          responseMimeType: "application/json" 
        }
      });
      return JSON.parse(res.text || "[]");
    } catch (e) {
      console.error("Erro na busca de amostras (Preview Mode):", e);
      return []; 
    }
  }
  return {};
};

const callAI = async (payload: any) => {
  if (isPreview()) return await runPreviewAI(payload);
  try {
    const response = await fetchWithRetry('/api/valuation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error: any) {
    if (payload.action === 'findSamples') return []; 
    throw error;
  }
};

export const findMarketSamplesIA = async (data: PropertyData, searchScope: 'specific' | 'broad' | 'city' = 'specific'): Promise<MarketSample[]> => {
  try {
    const results = await callAI({ action: 'findSamples', data, searchScope });
    if (!Array.isArray(results)) return [];

    return results.map((s: any, index: number) => ({
      id: `ia-${Date.now()}-${index}-${searchScope}`,
      type: data.type,
      title: s.title || `${data.urbanSubType || data.ruralActivity} em ${s.neighborhood || data.city}`,
      address: s.neighborhood ? `${s.neighborhood}, ${data.city}` : data.city,
      city: data.city,
      state: data.state,
      neighborhood: s.neighborhood || data.neighborhood || 'Centro',
      price: Number(s.price),
      areaTotal: Number(s.area),
      pricePerUnit: Number(s.price) / Number(s.area),
      date: new Date().toISOString(),
      source: s.source || 'Busca IA',
      url: s.url,
      urbanSubType: data.urbanSubType,
      ruralActivity: data.ruralActivity,
      bedrooms: s.bedrooms || 0,
      bathrooms: s.bathrooms || 0,
      parking: s.parking || 0,
      conservationState: 'Bom'
    })).filter((s: any) => s.price > 1000 && s.areaTotal > 1); // Filtro de sanidade relaxado para permitir mais amostras
  } catch (error: any) {
    console.error("findMarketSamplesIA falhou:", error);
    return []; 
  }
};

export const extractSampleFromUrl = async (url: string, type: PropertyType): Promise<Partial<MarketSample> | null> => {
  try {
    return await callAI({ action: 'extractUrl', url, type });
  } catch (error) {
    return null;
  }
};

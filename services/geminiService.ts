
import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, MarketSample, PropertyType } from "../types";

const isPreview = () => !!(window as any).aistudio;

/**
 * Função de auxílio para realizar fetch com retentativas (Backoff Exponencial)
 */
async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      const errorData = await response.json().catch(() => ({}));
      lastError = new Error(errorData.error || `Erro ${response.status}`);
      
      // Se for erro de cota (429) ou erro de servidor (5xx), tenta novamente
      if (response.status !== 429 && (response.status < 500 || response.status > 599)) {
        throw lastError;
      }
      
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.warn(`Tentativa ${i + 1} falhou (Cota/Servidor). Retentando em ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (err) {
      lastError = err;
      if (i === maxRetries - 1) throw lastError;
      // Pequena pausa antes de erro de rede
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

/**
 * Motor de IA local para uso no Preview do AI Studio
 */
const runPreviewAI = async (payload: any) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  const ai = new GoogleGenAI({ apiKey });
  
  if (payload.action === 'findSamples') {
    const { data } = payload;
    const typeLabel = data.type === PropertyType.URBAN ? data.urbanSubType : data.ruralActivity;
    
    const prompt = `Busque amostras reais e atuais de venda exclusivas para o tipo "${typeLabel}" na cidade de ${data.city}, ${data.state}. Retorne apenas JSON.`;
    
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        tools: [{ googleSearch: {} }], 
        responseMimeType: "application/json" 
      }
    });
    return JSON.parse(res.text || "[]");
  }
  return {};
};

/**
 * Função centralizada para chamadas de IA com tratamento de erros robusto
 */
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
    console.error("Falha na comunicação com a IA após retentativas:", error);
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
      neighborhood: s.neighborhood || data.neighborhood || 'Centro',
      price: Number(s.price),
      areaTotal: Number(s.area),
      pricePerUnit: Number(s.price) / Number(s.area),
      date: new Date().toISOString(),
      source: s.source || 'Portal Imobiliário',
      url: s.url,
      urbanSubType: data.urbanSubType,
      ruralActivity: data.ruralActivity,
      bedrooms: s.bedrooms || 0,
      bathrooms: s.bathrooms || 0,
      parking: s.parking || 0,
      conservationState: 'Bom'
    })).filter((s: any) => s.price > 10000 && s.areaTotal > 0);
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

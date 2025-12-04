import { GoogleGenAI } from "@google/genai";
import { PropertyData, PropertyType, MarketSample } from "../types";

// Acessa a chave diretamente do ambiente, conforme padrão da plataforma.
const apiKey = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey });

/**
 * Identifies neighboring cities for a given location to expand search scope.
 */
export const getNeighboringCities = async (city: string, state: string): Promise<string[]> => {
  if (!apiKey) return [];

  const modelId = "gemini-2.5-flash";
  const prompt = `Quais são as 5 a 8 cidades mais importantes e próximas geograficamente de ${city} no estado de ${state}? Liste cidades que provavelmente tenham mercado imobiliário rural ativo. Retorne apenas os nomes das cidades.`;

  try {
    // Para tarefas simples de texto sem ferramentas, podemos usar responseSchema se quisermos JSON,
    // mas aqui manteremos simples para evitar conflitos.
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    
    // Tenta limpar o texto caso venha com markdown
    const cleanText = response.text ? response.text.replace(/```json/g, '').replace(/```/g, '').trim() : "[]";
    
    try {
        const cities = JSON.parse(cleanText);
        return Array.isArray(cities) ? cities : [];
    } catch {
        // Se falhar o parse, retorna array vazio (fallback silencioso)
        return [];
    }
  } catch (error) {
    console.error("Erro ao buscar cidades vizinhas:", error);
    return [];
  }
};

/**
 * Searches for Urban Comparable Samples using Google Search Grounding.
 */
export const findUrbanSamples = async (data: PropertyData): Promise<MarketSample[]> => {
  if (!apiKey) {
    console.error("FATAL: API_KEY não encontrada em process.env");
    throw new Error("Chave de API não configurada. Se estiver rodando localmente, verifique seu arquivo .env.");
  }

  const modelId = "gemini-2.5-flash";

  // Construct a specific search query incl. new fields
  const searchQuery = `venda imóvel ${data.urbanSubType} ${data.neighborhood ? `bairro ${data.neighborhood}` : ''} ${data.city} ${data.state} ${data.bedrooms ? data.bedrooms + ' quartos' : ''} ${data.bathrooms ? data.bathrooms + ' banheiros' : ''} ${data.areaTotal}m2 preço valor`;

  // Updated Prompt: Explicitly asks for JSON string in natural language
  const prompt = `
    Atue como um Engenheiro de Avaliações.
    Utilize a ferramenta de BUSCA DO GOOGLE (Google Search) para encontrar e estruturar 5 a 8 ofertas REAIS e ATUAIS de imóveis semelhantes ao descrito.
    
    QUERY DE BUSCA SUGERIDA: "${searchQuery}"
    
    IMÓVEL AVALIANDO:
    - Tipo: ${data.urbanSubType}
    - Local: ${data.neighborhood || 'Centro'}, ${data.city} - ${data.state}
    - Área: ${data.areaTotal} m²
    - Quartos: ${data.bedrooms || 0}, Banheiros: ${data.bathrooms || 0}, Vagas: ${data.parking || 0}
    
    REGRAS DE EXTRAÇÃO:
    1. Pesquise em sites reais (Zap, VivaReal, OLX, etc).
    2. Extraia o Preço, Área Total, Quartos, Banheiros, Vagas, Endereço e Link (URL).
    3. Se não encontrar o número exato de quartos/vagas, aproxime ou deixe 0.
    4. O "source" deve ser o nome do portal (ex: VivaReal).
    5. O "url" deve ser o link direto para o anúncio encontrado.

    SAÍDA OBRIGATÓRIA:
    Retorne APENAS um array JSON válido. NÃO use formatação Markdown (sem \`\`\`json). Apenas o texto JSON cru.
    
    Exemplo de formato:
    [
      {
        "title": "Apartamento a venda...",
        "price": 500000,
        "areaTotal": 80,
        "bedrooms": 2,
        "bathrooms": 2,
        "parking": 1,
        "address": "Rua X, Bairro Y",
        "source": "Portal Z",
        "url": "https://..."
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
        // REMOVIDO: responseMimeType e responseSchema não podem ser usados junto com googleSearch
      }
    });

    // Log para debug da resposta bruta (útil para desenvolvimento)
    console.log("Gemini Response Raw:", response.text);

    // Limpeza de segurança caso o modelo insira blocos de código Markdown
    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Extração robusta do JSON
    let rawSamples = [];
    
    // Tenta parse direto
    try {
        rawSamples = JSON.parse(text);
    } catch (e) {
        // Fallback: tenta encontrar o array JSON dentro do texto usando Regex
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
            try {
                rawSamples = JSON.parse(jsonMatch[0]);
            } catch (e2) {
                console.error("Falha fatal no parse do JSON da IA.");
            }
        }
    }

    if (!Array.isArray(rawSamples)) {
        console.warn("IA não retornou um array válido:", rawSamples);
        return [];
    }

    // Map to MarketSample interface
    const samples: MarketSample[] = rawSamples.map((s: any, index: number) => ({
      id: `ai-sample-${Date.now()}-${index}`,
      type: PropertyType.URBAN,
      title: s.title || `${data.urbanSubType} em ${data.city}`,
      address: s.address || data.city,
      city: data.city,
      state: data.state,
      neighborhood: data.neighborhood,
      price: typeof s.price === 'string' ? parseFloat(s.price.replace(/[^0-9.]/g, '')) : Number(s.price),
      areaTotal: typeof s.areaTotal === 'string' ? parseFloat(s.areaTotal.replace(/[^0-9.]/g, '')) : Number(s.areaTotal),
      areaBuilt: s.areaTotal, 
      pricePerUnit: (typeof s.price === 'number' && typeof s.areaTotal === 'number') ? s.price / s.areaTotal : 0,
      date: new Date().toISOString(),
      source: s.source + (s.url ? ` (${s.url})` : ''),
      urbanSubType: data.urbanSubType,
      bedrooms: s.bedrooms || 0,
      bathrooms: s.bathrooms || 0,
      parking: s.parking || 0,
      conservationState: 'Bom' 
    }));

    // Filter out invalid samples (price or area missing)
    return samples.filter(s => s.price > 0 && s.areaTotal > 0);

  } catch (error) {
    console.error("Erro ao buscar amostras urbanas via IA:", error);
    // Relançar o erro para o App.tsx tratar
    throw error; 
  }
};


import { GoogleGenAI } from "@google/genai";
import { PropertyData, PropertyType, MarketSample } from "../types";

// Chave para fallback local (caso variáveis de ambiente falhem em static deploy)
const LOCAL_STORAGE_KEY_NAME = 'bandeira_agro_api_key';

// Helper para obter a chave de API de forma robusta
const getApiKey = (): string | undefined => {
  let key: string | undefined = undefined;

  // 1. Tenta LocalStorage (Salva-vidas para ambientes estáticos/sem build)
  try {
    if (typeof localStorage !== 'undefined') {
      const localKey = localStorage.getItem(LOCAL_STORAGE_KEY_NAME);
      if (localKey) key = localKey;
    }
  } catch (e) {
    // Ignora erro de acesso ao localStorage
  }

  // 2. Tenta padrão VITE (mais comum para React Apps modernos/Vercel)
  if (!key) {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        key = import.meta.env.VITE_API_KEY;
      }
    } catch (e) {
      // Ignora erro se import.meta não existir
    }
  }

  // 3. Tenta process.env (Node.js ou Webpack com polyfill)
  if (!key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        // Tenta variações comuns
        key = process.env.API_KEY || process.env.VITE_API_KEY || process.env.REACT_APP_API_KEY;
      }
    } catch (e) {
      // Ignora erro se process não existir
    }
  }

  // Limpeza final e validação básica
  if (key) {
      key = key.trim();
      // Remove aspas extras se houver (comum em arquivos .env mal formatados)
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
          key = key.slice(1, -1);
      }
  }
  
  return key;
};

const validateKey = (key: string | undefined) => {
    if (!key) {
        console.error("FATAL: Nenhuma API KEY encontrada (LocalStorage, VITE_API_KEY ou API_KEY).");
        throw new Error("API_KEY_MISSING");
    }
    if (!key.startsWith("AIza")) {
        console.error("FATAL: Formato de chave inválido. A chave deve começar com 'AIza'. Chave atual inicia com:", key.substring(0, 4));
        throw new Error("INVALID_KEY_FORMAT");
    }
};

/**
 * Identifies neighboring cities for a given location to expand search scope.
 */
export const getNeighboringCities = async (city: string, state: string): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return []; // Silently fail if no key, as this is optional

  // Validação básica sem throw para não quebrar fluxo opcional
  if (!apiKey.startsWith("AIza")) return [];

  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";
  const prompt = `Quais são as 5 a 8 cidades mais importantes e próximas geograficamente de ${city} no estado de ${state}? Liste cidades que provavelmente tenham mercado imobiliário rural ativo. Retorne apenas os nomes das cidades.`;

  try {
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
  const apiKey = getApiKey();
  validateKey(apiKey);

  // @ts-ignore - Garantido pelo validateKey
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  // --- ESTRATÉGIA DE BUSCA REFINADA (PORTAIS GIGANTES) ---
  
  // 1. Definição da Localização
  let streetName = "";
  if (data.address) {
    streetName = data.address.split(',')[0].split('-')[0].trim();
  }
  
  // 2. Construção da Query com Operador SITE:
  // Força o Google a olhar dentro dos grandes bancos de dados
  const portals = `(site:imovelweb.com.br OR site:zapimoveis.com.br OR site:vivareal.com.br OR site:olx.com.br OR site:chavesnamao.com.br)`;
  
  // Prioridade: Bairro + Cidade (A rua entra como palavra-chave opcional para não zerar a busca se não houver nada nela)
  // Ex: (site:...) comprar Apartamento "Vila Mariana" São Paulo "Rua Vergueiro"
  const searchQuery = `${portals} comprar ${data.urbanSubType} "${data.neighborhood}" ${data.city} ${data.state} "${streetName}"`;

  const prompt = `
    Atue como um Engenheiro de Avaliações Sênior especialista em NBR 14653.
    O usuário precisa encontrar amostras comparáveis para um imóvel urbano com ALTA PRECISÃO (Mínimo Grau II).
    
    QUERY DE BUSCA EXECUTADA: "${searchQuery}"
    
    OBJETIVO:
    Encontrar de 20 a 30 amostras de ofertas ATUAIS nos portais listados.
    QUANTO MAIS AMOSTRAS, MELHOR A PRECISÃO DO LAUDO.
    
    ESTRATÉGIA DE BUSCA E EXPANSÃO (IMPORTANTE):
    1. ALVO PRINCIPAL: Busque imóveis na Rua "${streetName}" e no Bairro "${data.neighborhood}".
    2. EXPANSÃO AUTOMÁTICA OBRIGATÓRIA: Se não encontrar pelo menos 15 amostras neste bairro exato, VOCÊ DEVE BUSCAR EM BAIRROS VIZINHOS OU SEMELHANTES na cidade de ${data.city}.
    3. CRITÉRIO DE SEMELHANÇA: Ao expandir, mantenha o mesmo padrão construtivo e perfil socioeconômico para garantir homogeneidade (Preço por m² próximo).
    
    DADOS DO IMÓVEL AVALIANDO:
    - Tipo: ${data.urbanSubType}
    - Bairro Alvo: ${data.neighborhood}
    - Rua Alvo: ${streetName}
    - Cidade: ${data.city}
    
    INSTRUÇÕES RÍGIDAS:
    - Ignore leilões ou preços simbólicos.
    - Extraia o preço e área do snippet da busca.
    - Se o anúncio for de um bairro vizinho, indique isso no campo 'neighborhood'.
    
    SAÍDA JSON OBRIGATÓRIA:
    Retorne APENAS um array JSON. Sem markdown.
    [
      {
        "title": "Título do Anúncio",
        "price": 500000,
        "areaTotal": 80,
        "bedrooms": 2,
        "bathrooms": 2,
        "parking": 1,
        "address": "Endereço encontrado (Rua ou Bairro)",
        "neighborhood": "Bairro encontrado",
        "source": "Imovelweb/Zap/etc",
        "url": "Link do anúncio"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      }
    });

    // --- CORREÇÃO DE LINKS VIA GROUNDING METADATA ---
    const realLinks: string[] = [];
    if (response.candidates && response.candidates[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          realLinks.push(chunk.web.uri);
        }
      });
    }
    console.log("Links verificados pelo Google:", realLinks);

    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let rawSamples = [];
    try {
        rawSamples = JSON.parse(text);
    } catch (e) {
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
            try { rawSamples = JSON.parse(jsonMatch[0]); } catch (e2) {}
        }
    }

    if (!Array.isArray(rawSamples)) return [];

    const samples: MarketSample[] = rawSamples.map((s: any, index: number) => {
      let finalUrl = "";
      
      // 1. Verifica se a URL bruta é lixo
      const rawUrl = s.url || "";
      const isGarbage = 
        !rawUrl.startsWith('http') || 
        rawUrl.includes('grounding-api') || 
        rawUrl.includes('googleusercontent');

      // 2. Tenta encontrar o link real nos metadados
      if (realLinks.length > 0) {
          // Procura por match parcial de domínio (ex: 'imovelweb')
          const sourceKey = (s.source || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const match = realLinks.find(link => sourceKey && link.toLowerCase().includes(sourceKey));
          
          if (match) {
              finalUrl = match;
          } else if (!isGarbage && realLinks.includes(rawUrl)) {
              finalUrl = rawUrl;
          }
      }

      // 3. FALLBACK DE SEGURANÇA:
      if (!finalUrl || isGarbage) {
          const query = encodeURIComponent(`site:imovelweb.com.br OR site:zapimoveis.com.br OR site:vivareal.com.br ${s.urbanSubType} ${s.neighborhood} ${data.city} ${s.price}`);
          finalUrl = `https://www.google.com/search?q=${query}`;
      }

      return {
        id: `ai-sample-${Date.now()}-${index}`,
        type: PropertyType.URBAN,
        title: s.title || `${data.urbanSubType} em ${data.city}`,
        address: s.address || (s.neighborhood ? `${s.neighborhood}, ${data.city}` : data.city),
        city: data.city,
        state: data.state,
        neighborhood: s.neighborhood || data.neighborhood,
        price: typeof s.price === 'string' ? parseFloat(s.price.replace(/[^0-9.]/g, '')) : Number(s.price),
        areaTotal: typeof s.areaTotal === 'string' ? parseFloat(s.areaTotal.replace(/[^0-9.]/g, '')) : Number(s.areaTotal),
        areaBuilt: s.areaTotal, 
        pricePerUnit: (typeof s.price === 'number' && typeof s.areaTotal === 'number') ? s.price / s.areaTotal : 0,
        date: new Date().toISOString(),
        source: s.source || 'Portal Imobiliário',
        url: finalUrl,
        urbanSubType: data.urbanSubType,
        bedrooms: s.bedrooms || 0,
        bathrooms: s.bathrooms || 0,
        parking: s.parking || 0,
        conservationState: 'Bom' 
      };
    });

    return samples.filter(s => s.price > 0 && s.areaTotal > 0);

  } catch (error: any) {
    console.error("Erro ao buscar amostras urbanas via IA:", error);
    if (error.message?.includes('403') || error.toString().includes('403') || error.status === 403) {
      throw new Error("API_KEY_RESTRICTION");
    }
    throw error; 
  }
};

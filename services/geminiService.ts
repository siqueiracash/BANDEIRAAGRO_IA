
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
 * FEATURE NOVA: Importador Inteligente de URL (Imovelweb, Zap, etc)
 * Usa o Google Search para ler os metadados da URL indexada e extrair o JSON.
 */
export const extractSampleFromUrl = async (url: string, type: PropertyType): Promise<Partial<MarketSample> | null> => {
  const apiKey = getApiKey();
  validateKey(apiKey);
  
  // @ts-ignore
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash"; // Modelo rápido e eficiente

  const prompt = `
    Atue como um extrator de dados imobiliários especializado.
    
    URL ALVO: "${url}"
    
    TAREFA:
    Use a ferramenta de busca para ler o conteúdo desta página (Imovelweb, Zap, VivaReal, OLX, etc) e extrair TODOS os dados técnicos possíveis.
    
    MAPEAMENTO OBRIGATÓRIO (JSON):
    1. urbanSubType: Identifique o tipo e mapeie EXATAMENTE para um destes valores: ['Apartamento', 'Casa', 'Sobrado', 'Terreno', 'Prédio Comercial']. Se for lote, mapeie para 'Terreno'.
    2. address: Tente encontrar o nome da Rua/Logradouro. Se não tiver, deixe em branco.
    3. description: Um resumo curto das características (ex: "Sol da manhã, reformado, varanda gourmet").
    4. areaTotal e areaBuilt: Se for Apartamento, geralmente são iguais. Se for Casa, tente distinguir Terreno vs Construída.
    
    SAÍDA JSON APENAS:
    {
      "title": "Título completo do anúncio",
      "description": "Texto descritivo resumido",
      "price": 0.00, // Numérico
      "areaTotal": 0.00, // Numérico
      "areaBuilt": 0.00, // Numérico
      "city": "Nome da Cidade",
      "state": "Sigla UF",
      "neighborhood": "Nome do Bairro",
      "address": "Rua Exemplo, 123 (ou vazio se não achar)",
      "bedrooms": 0,
      "bathrooms": 0,
      "parking": 0,
      "urbanSubType": "Apartamento" // Um dos valores da lista acima
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }] // Fundamental para ler "o que é essa URL"
      }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Tenta extrair JSON se houver texto em volta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        text = jsonMatch[0];
    }

    const data = JSON.parse(text);

    if (!data.price && !data.areaTotal) return null;

    return {
      type: type,
      url: url,
      source: new URL(url).hostname.replace('www.', ''),
      ...data
    };

  } catch (error) {
    console.error("Erro ao extrair dados da URL:", error);
    return null;
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

  // --- ESTRATÉGIA DE BUSCA EXPANDIDA (MAXIMIZAR RESULTADOS) ---
  
  const portals = `(site:imovelweb.com.br OR site:zapimoveis.com.br OR site:vivareal.com.br OR site:olx.com.br OR site:chavesnamao.com.br OR site:quintoandar.com.br OR site:dreamcasa.com.br OR site:mercadolivre.com.br)`;
  
  // Query Otimizada: Removemos 'intitle' para pegar resultados onde o bairro está na descrição
  // Adicionamos exclusão explícita de aluguel/locação
  const searchQuery = `${portals} venda ${data.urbanSubType} "${data.neighborhood}" ${data.city} ${data.state} -aluguel -locação -temporada`;

  const prompt = `
    Atue como um Engenheiro de Avaliações Sênior especialista em NBR 14653.
    
    OBJETIVO CRÍTICO (EXPANSÃO DE AMOSTRAS):
    Precisamos encontrar entre 15 a 20 amostras de mercado para um ${data.urbanSubType} em ${data.city}/${data.state}.
    
    LOCALIZAÇÃO:
    1. Prioridade Máxima: Bairro "${data.neighborhood}".
    2. Estratégia de Expansão: SE encontrar poucas ofertas no bairro exato, capture ofertas em BAIRROS VIZINHOS ou regiões próximas na mesma cidade que tenham padrão semelhante.
    
    QUERY DE BUSCA REALIZADA: "${searchQuery}"
    
    INSTRUÇÕES DE EXTRAÇÃO:
    1. Ignore anúncios de Aluguel/Locação. Apenas VENDA.
    2. Ignore Leilão ou ágio.
    3. Extraia o máximo de anúncios possível da busca (meta: 20 itens).
    4. Indique o bairro real encontrado no campo 'neighborhood'.
    
    SAÍDA JSON OBRIGATÓRIA (Array de objetos):
    [
      {
        "title": "Título Completo",
        "price": 500000,
        "areaTotal": 80,
        "bedrooms": 2,
        "bathrooms": 2,
        "parking": 1,
        "neighborhood": "Bairro Encontrado",
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
      
      const rawUrl = s.url || "";
      const isGarbage = 
        !rawUrl.startsWith('http') || 
        rawUrl.includes('grounding-api') || 
        rawUrl.includes('googleusercontent');

      if (realLinks.length > 0) {
          const sourceKey = (s.source || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const match = realLinks.find(link => sourceKey && link.toLowerCase().includes(sourceKey));
          
          if (match) {
              finalUrl = match;
          } else if (!isGarbage && realLinks.includes(rawUrl)) {
              finalUrl = rawUrl;
          }
      }

      if (!finalUrl || isGarbage) {
          // Reconstrói um link de busca se o link direto falhar
          const query = encodeURIComponent(`${s.source} ${s.urbanSubType} ${s.neighborhood} ${data.city} venda`);
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

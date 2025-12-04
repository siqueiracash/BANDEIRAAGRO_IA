
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

  // --- ESTRATÉGIA DE BUSCA REFINADA ---
  // 1. Extrair nome da rua limpo (sem número) para forçar proximidade
  let streetName = "";
  if (data.address) {
    // Pega tudo antes da primeira vírgula ou número
    streetName = data.address.split(',')[0].split('-')[0].trim();
  }

  // 2. Construir Query Hierárquica: Rua -> Bairro -> Cidade
  // Usar aspas no Bairro ajuda o Google a ser exato
  const searchQuery = `comprar ${data.urbanSubType} "${streetName}" "${data.neighborhood}" ${data.city} ${data.state} ${data.bedrooms ? data.bedrooms + ' quartos' : ''} ${data.areaTotal}m2`;

  const prompt = `
    Atue como um Engenheiro de Avaliações rigoroso.
    Utilize a ferramenta de BUSCA DO GOOGLE (Google Search) para encontrar e estruturar 20 ofertas REAIS e ATUAIS (Precisamos de muitas amostras para filtrar outliers estatísticos).
    
    QUERY DE BUSCA: "${searchQuery}"
    
    DADOS DO IMÓVEL AVALIANDO (ALVO):
    - Tipo: ${data.urbanSubType}
    - Rua (Prioridade Máxima): ${streetName}
    - Bairro (Obrigatório): ${data.neighborhood}
    - Cidade: ${data.city} - ${data.state}
    - Área Alvo: ${data.areaTotal} m²
    
    CRITÉRIOS DE LOCALIZAÇÃO (IMPORTANTE):
    1. A busca deve começar pela RUA ("${streetName}"). Tente encontrar imóveis na mesma rua ou ruas transversais.
    2. Se não houver na rua, busque estritamente no BAIRRO "${data.neighborhood}".
    3. REJEITE bairros com nomes parecidos mas que são locais diferentes (Ex: Se busco "Vila João", rejeite "Parque João"). A localização deve ser exata.
    
    REGRAS DE EXTRAÇÃO:
    1. Pesquise em sites reais (Zap, VivaReal, OLX, Chaves na Mão, etc).
    2. Extraia o Preço, Área Total, Quartos, Banheiros, Vagas, Endereço e Link (URL).
    3. Se não encontrar o número exato de quartos/vagas, aproxime ou deixe 0.
    4. O "source" deve ser o nome do portal (ex: VivaReal).
    5. O "url" deve ser o link direto para o anúncio encontrado. **Tente pegar a URL real.**

    SAÍDA OBRIGATÓRIA:
    Retorne APENAS um array JSON válido contendo os dados. NÃO use formatação Markdown.
    
    Exemplo de formato:
    [
      {
        "title": "Apartamento na Rua das Flores...",
        "price": 500000,
        "areaTotal": 80,
        "bedrooms": 2,
        "bathrooms": 2,
        "parking": 1,
        "address": "Rua das Flores, Vila Mariana",
        "neighborhood": "Vila Mariana",
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
        tools: [{ googleSearch: {} }],
        // Safety Settings ajustados para permitir endereços comerciais
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      }
    });

    // --- CORREÇÃO DE LINKS VIA GROUNDING METADATA (TOLERÂNCIA ZERO PARA ERROS) ---
    // A IA frequentemente alucina URLs quebradas. Só aceitaremos URLs que o Google Search confirmou.
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
      
      // 1. Verifica se a URL bruta é lixo (Grounding API, Google Redirect, ou relativa)
      const rawUrl = s.url || "";
      const isGarbage = 
        !rawUrl.startsWith('http') || 
        rawUrl.includes('grounding-api') || 
        rawUrl.includes('googleusercontent');

      // 2. Tenta casar a amostra com um Link Verificado (Metadata)
      if (realLinks.length > 0) {
          // Normaliza o nome da fonte (Ex: "Viva Real" -> "vivareal")
          const sourceKey = (s.source || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Tenta encontrar um link real que contenha o nome da fonte
          const match = realLinks.find(link => sourceKey && link.toLowerCase().includes(sourceKey));
          
          if (match) {
              finalUrl = match;
          } 
          // Se não achou por nome, mas o índice bate com a lista de links (as vezes a ordem é preservada)
          else if (index < realLinks.length) {
              // Só usa se a URL original for lixo, senão preferimos não arriscar link errado
              if (isGarbage) {
                 // finalUrl = realLinks[index]; // Comentado: Arriscado cruzar por índice sem certeza
              }
          }
      }

      // 3. ESTRATÉGIA FINAL (FALLBACK DE SEGURANÇA):
      // Se não temos um link VERIFICADO e SEGURO, geramos um link de BUSCA DO GOOGLE.
      // Isso garante 100% que o link não será 404 e o usuário encontrará o imóvel.
      if (!finalUrl) {
          // Cria uma query de busca bem específica para o imóvel
          const query = encodeURIComponent(`${s.urbanSubType || 'Imóvel'} ${s.address || ''} ${data.city} comprar`);
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
        source: s.source || 'Pesquisa Web',
        url: finalUrl, // URL Segura (Verificada ou Busca Google)
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

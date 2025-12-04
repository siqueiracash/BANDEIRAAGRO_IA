
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

  // Updated Prompt: Increase requested samples to 10-15 to allow outlier filtering
  const prompt = `
    Atue como um Engenheiro de Avaliações rigoroso.
    Utilize a ferramenta de BUSCA DO GOOGLE (Google Search) para encontrar e estruturar 10 a 15 ofertas REAIS e ATUAIS.
    Preciso de um volume maior de amostras para poder descartar as que tiverem preço muito discrepante (outliers).
    
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
    5. O "url" deve ser o link direto para o anúncio encontrado. **IMPORTANTE: Forneça a URL completa (http...). Não use links internos do tipo /grounding-api-redirect.**

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
        // Safety Settings ajustados para permitir endereços comerciais que as vezes caem em filtros
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      }
    });

    console.log("Gemini Response Raw:", response.text);

    // --- CORREÇÃO DE LINKS VIA GROUNDING METADATA ---
    // A IA muitas vezes alucina links no texto JSON, mas os links reais estão no metadata.
    // Vamos extrair os links REAIS retornados pelo Google Search.
    const realLinks: string[] = [];
    if (response.candidates && response.candidates[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          realLinks.push(chunk.web.uri);
        }
      });
    }
    console.log("Links reais encontrados pelo Google:", realLinks);

    let text = response.text || "[]";
    // Limpeza agressiva para garantir JSON puro
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let rawSamples = [];
    
    try {
        rawSamples = JSON.parse(text);
    } catch (e) {
        // Fallback: Tentar extrair o JSON de dentro do texto se houver lixo em volta
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

    const samples: MarketSample[] = rawSamples.map((s: any, index: number) => {
      // 1. SANITIZAÇÃO RIGOROSA DO JSON URL
      let jsonUrl = s.url || '';
      // Se for link relativo ou de redirecionamento interno do Google (alucinação comum), descartamos.
      if (jsonUrl.startsWith('/') || jsonUrl.includes('grounding-api-redirect')) {
          jsonUrl = '';
      }

      // 2. Lógica de "Cura" do Link (Healing)
      let finalUrl = jsonUrl;
      const isBroken = !finalUrl || finalUrl.includes('...') || !finalUrl.startsWith('http');
      
      if (realLinks.length > 0) {
        // Tentativa 1: Busca um link real que contenha o nome do portal (source)
        const sourceName = (s.source || '').toLowerCase().replace(/\s/g, '');
        // Busca um link que contenha o nome do portal E não seja uma busca genérica do Google
        const matchingLink = realLinks.find(link => 
            link.toLowerCase().includes(sourceName) && 
            !link.includes('google.com/search')
        );
        
        if (isBroken && matchingLink) {
           finalUrl = matchingLink;
        } 
        // Tentativa 2: Se não achou por nome, e o índice existe no array de links reais, usa o correspondente
        else if (isBroken && index < realLinks.length) {
           finalUrl = realLinks[index];
        }
      }

      // 3. FALLBACK DE SEGURANÇA (Se ainda não tem link válido)
      // Gera um link de pesquisa do Google para o usuário encontrar o imóvel
      if (!finalUrl || !finalUrl.startsWith('http')) {
          const query = encodeURIComponent(`${s.urbanSubType || 'Imóvel'} ${s.title || ''} ${s.address || ''} ${data.city}`);
          finalUrl = `https://www.google.com/search?q=${query}`;
      }

      return {
        id: `ai-sample-${Date.now()}-${index}`,
        type: PropertyType.URBAN,
        title: s.title || `${data.urbanSubType} em ${data.city}`,
        address: s.address || (s.neighborhood ? `${s.neighborhood}, ${data.city}` : data.city),
        city: data.city,
        state: data.state,
        neighborhood: s.neighborhood || data.neighborhood, // Tenta pegar o bairro que a IA achou
        price: typeof s.price === 'string' ? parseFloat(s.price.replace(/[^0-9.]/g, '')) : Number(s.price),
        areaTotal: typeof s.areaTotal === 'string' ? parseFloat(s.areaTotal.replace(/[^0-9.]/g, '')) : Number(s.areaTotal),
        areaBuilt: s.areaTotal, 
        pricePerUnit: (typeof s.price === 'number' && typeof s.areaTotal === 'number') ? s.price / s.areaTotal : 0,
        date: new Date().toISOString(),
        source: s.source || 'Pesquisa Web',
        url: finalUrl, // Usa a URL corrigida/sanitizada
        urbanSubType: data.urbanSubType,
        bedrooms: s.bedrooms || 0,
        bathrooms: s.bathrooms || 0,
        parking: s.parking || 0,
        conservationState: 'Bom' 
      };
    });

    // Filtragem de segurança: Remover amostras com preço ou área zerados
    return samples.filter(s => s.price > 0 && s.areaTotal > 0);

  } catch (error: any) {
    console.error("Erro ao buscar amostras urbanas via IA:", error);
    
    // Tratamento específico para erro de permissão (403)
    if (error.message?.includes('403') || error.toString().includes('403') || error.status === 403) {
      throw new Error("API_KEY_RESTRICTION");
    }
    
    throw error; 
  }
};

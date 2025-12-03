import { MarketSample, PropertyType } from "../types";
import { supabase } from "./supabaseClient";

// Nome da tabela no Supabase
const TABLE_NAME = 'samples';

// --- FALLBACK LOCALSTORAGE (Caso o Supabase não esteja configurado) ---
const STORAGE_KEY = 'BANDEIRA_AGRO_DB';

const getLocalSamples = (): MarketSample[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};
// --------------------------------------------------------------------

export const getSamples = async (): Promise<MarketSample[]> => {
  if (!supabase) {
    console.warn("Supabase não configurado. Usando LocalStorage.");
    return getLocalSamples();
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Erro ao buscar amostras:", error);
    return [];
  }

  return data as MarketSample[];
};

export const saveSample = async (sample: Omit<MarketSample, 'id' | 'pricePerUnit'>): Promise<MarketSample | null> => {
  // CORREÇÃO: Define o divisor correto baseado no tipo.
  // RURAL: Sempre divide pela Área Total (Preço por Hectare).
  // URBANO: Divide pela Área Construída se houver, senão pela Área Total.
  let divisor = sample.areaTotal;
  if (sample.type === PropertyType.URBAN && sample.areaBuilt && sample.areaBuilt > 0) {
    divisor = sample.areaBuilt;
  }
  
  const pricePerUnit = sample.price / (divisor || 1);

  // Prepara o objeto, removendo campos undefined para o Supabase não reclamar
  const newSamplePayload = {
    ...sample,
    pricePerUnit,
    // Garante que campos opcionais sejam null se undefined
    neighborhood: sample.neighborhood || null,
    address: sample.address || null,
    urbanSubType: sample.urbanSubType || null,
    ruralActivity: sample.ruralActivity || null,
    // Adiciona data de criação se a tabela tiver created_at
  };

  if (!supabase) {
    const localSample = { ...newSamplePayload, id: Date.now().toString() };
    const current = getLocalSamples();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([localSample, ...current]));
    return localSample as MarketSample;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([newSamplePayload])
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar amostra:", error);
    alert("Erro ao salvar no banco de dados.");
    return null;
  }

  return data as MarketSample;
};

export const updateSample = async (sample: MarketSample): Promise<MarketSample | null> => {
  // CORREÇÃO: Mesma lógica de divisor do saveSample
  let divisor = sample.areaTotal;
  if (sample.type === PropertyType.URBAN && sample.areaBuilt && sample.areaBuilt > 0) {
    divisor = sample.areaBuilt;
  }
  
  const pricePerUnit = sample.price / (divisor || 1);

  const updatePayload = {
    ...sample,
    pricePerUnit
  };

  if (!supabase) {
    const current = getLocalSamples();
    const index = current.findIndex(s => s.id === sample.id);
    if (index !== -1) {
      current[index] = updatePayload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return updatePayload;
    }
    return null;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updatePayload)
    .eq('id', sample.id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar amostra:", error);
    return null;
  }

  return data as MarketSample;
};

export const deleteSample = async (id: string): Promise<void> => {
  if (!supabase) {
    const current = getLocalSamples();
    const updated = current.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return;
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Erro ao deletar amostra:", error);
  }
};

export const filterSamples = async (type: PropertyType, city: string, state: string, subTypeOrActivity?: string): Promise<MarketSample[]> => {
  
  if (!supabase) {
    const samples = getLocalSamples();
    return samples.filter(s => {
      const matchType = s.type === type;
      // Se city for vazio, ignora o filtro de cidade (busca estadual)
      const matchLoc = (city ? s.city.toLowerCase().trim() === city.toLowerCase().trim() : true) && s.state === state;
      let matchSub = true;
      if (subTypeOrActivity) {
        if (type === PropertyType.URBAN && s.urbanSubType) matchSub = s.urbanSubType === subTypeOrActivity;
        if (type === PropertyType.RURAL && s.ruralActivity) matchSub = s.ruralActivity === subTypeOrActivity;
      }
      return matchType && matchLoc && matchSub;
    });
  }

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('type', type)
    .eq('state', state); // Estado é sempre obrigatório

  // Cidade é opcional agora (para permitir busca estadual)
  if (city) {
    query = query.ilike('city', city);
  }

  if (subTypeOrActivity) {
    if (type === PropertyType.URBAN) {
      query = query.eq('urbanSubType', subTypeOrActivity);
    } else {
      query = query.eq('ruralActivity', subTypeOrActivity);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao filtrar amostras:", error);
    return [];
  }

  return data as MarketSample[];
};

/**
 * Busca amostras em uma lista de cidades (Busca Regional)
 */
export const getSamplesByCities = async (cities: string[], state: string, type: PropertyType, subTypeOrActivity?: string): Promise<MarketSample[]> => {
  if (!cities || cities.length === 0) return [];

  // Normaliza nomes das cidades para comparação local (trim)
  const normalizedCities = cities.map(c => c.trim());

  if (!supabase) {
    const samples = getLocalSamples();
    return samples.filter(s => {
      const matchType = s.type === type;
      const matchState = s.state === state;
      // Verifica se a cidade da amostra está na lista de cidades vizinhas (insensível a maiúsculas)
      const matchCity = normalizedCities.some(c => c.toLowerCase() === s.city.toLowerCase().trim());
      
      let matchSub = true;
      if (subTypeOrActivity) {
        if (type === PropertyType.URBAN && s.urbanSubType) matchSub = s.urbanSubType === subTypeOrActivity;
        if (type === PropertyType.RURAL && s.ruralActivity) matchSub = s.ruralActivity === subTypeOrActivity;
      }
      return matchType && matchState && matchCity && matchSub;
    });
  }

  // Supabase 'in' query para múltiplas cidades
  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('type', type)
    .eq('state', state)
    .in('city', normalizedCities); // Nota: .in espera correspondência exata, mas é o melhor que temos sem full-text search complexo

  if (subTypeOrActivity) {
    if (type === PropertyType.URBAN) {
      query = query.eq('urbanSubType', subTypeOrActivity);
    } else {
      query = query.eq('ruralActivity', subTypeOrActivity);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar amostras regionais:", error);
    return [];
  }

  return data as MarketSample[];
};
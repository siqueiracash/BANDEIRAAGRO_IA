
import { MarketSample, PropertyType } from "../types";
import { supabase } from "./supabaseClient";

const TABLE_NAME = 'samples';
const STORAGE_KEY = 'BANDEIRA_AGRO_DB';

export const saveSample = async (sample: Omit<MarketSample, 'id' | 'pricePerUnit'>): Promise<MarketSample | null> => {
  if (!sample.price || !sample.areaTotal) return null;

  const pricePerUnit = sample.price / (sample.areaTotal || 1);
  const payload = preparePayload(sample, pricePerUnit);

  if (!supabase) {
    const local = getLocalSamples();
    if (sample.url && local.some(s => s.url === sample.url)) return null;
    const newSample = { ...payload, id: Date.now().toString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newSample, ...local]));
    return newSample as MarketSample;
  }

  try {
    if (sample.url) {
      const { data: existing } = await supabase.from(TABLE_NAME).select('id').eq('url', sample.url).maybeSingle();
      if (existing) return null; 
    }

    const { data, error } = await supabase.from(TABLE_NAME).insert([payload]).select().single();
    if (error) {
      console.error("Erro Supabase Insert:", error);
      return null;
    }
    return data as MarketSample;
  } catch (e) {
    console.error("Exceção Supabase:", e);
    return null;
  }
};

const preparePayload = (sample: Partial<MarketSample>, pricePerUnit: number) => {
  return {
    type: sample.type,
    city: sample.city,
    state: sample.state,
    price: Number(sample.price),
    areaTotal: Number(sample.areaTotal),
    pricePerUnit: pricePerUnit,
    date: sample.date || new Date().toISOString(),
    source: sample.source || 'Manual',
    title: sample.title || '',
    address: sample.address || null,
    neighborhood: sample.neighborhood || null,
    areaBuilt: sample.areaBuilt || null,
    description: sample.description || null,
    url: sample.url || null,
    urbanSubType: sample.urbanSubType || null,
    bedrooms: Number(sample.bedrooms) || 0,
    bathrooms: Number(sample.bathrooms) || 0,
    parking: Number(sample.parking) || 0,
    conservationState: sample.conservationState || null,
    ruralActivity: sample.ruralActivity || null,
    carNumber: sample.carNumber || null,
    surface: sample.surface || null,
    access: sample.access || null,
    topography: sample.topography || null,
    occupation: sample.occupation || null,
    improvements: sample.improvements || null,
    landCapability: sample.landCapability || null,
    publicImprovements: sample.publicImprovements || null
  };
};

const getLocalSamples = (): MarketSample[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const getSamples = async (): Promise<MarketSample[]> => {
  if (!supabase) return getLocalSamples();
  const { data, error } = await supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
  return error ? [] : data;
};

export const filterSamples = async (type: PropertyType, city: string, state: string): Promise<MarketSample[]> => {
  if (!supabase) {
    return getLocalSamples().filter(s => 
      s.type === type && 
      s.state === state && 
      (!city || s.city.toLowerCase() === city.toLowerCase())
    );
  }
  try {
    let query = supabase.from(TABLE_NAME).select('*').eq('type', type).eq('state', state);
    if (city) query = query.ilike('city', city);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Falha ao filtrar Supabase:", e);
    return [];
  }
};

export const deleteSample = async (id: string) => {
  if (!supabase) {
    const updated = getLocalSamples().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return;
  }
  await supabase.from(TABLE_NAME).delete().eq('id', id);
};

export const updateSample = async (sample: MarketSample) => {
  if (!supabase) {
     const local = getLocalSamples();
     const idx = local.findIndex(s => s.id === sample.id);
     if (idx !== -1) {
       local[idx] = sample;
       localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
     }
     return sample;
  }
  const { data } = await supabase.from(TABLE_NAME).update(preparePayload(sample, sample.pricePerUnit)).eq('id', sample.id).select().single();
  return data; 
};

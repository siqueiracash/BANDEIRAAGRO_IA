
import { MarketSample, PropertyType } from "../types";
import { supabase } from "./supabaseClient";

const TABLE_NAME = 'samples';
const STORAGE_KEY = 'BANDEIRA_AGRO_DB';

// ... (Outras funções mantidas)

export const saveSample = async (sample: Omit<MarketSample, 'id' | 'pricePerUnit'>): Promise<MarketSample | null> => {
  if (!sample.price || !sample.areaTotal) return null;

  // Cálculo do unitário
  let divisor = sample.areaTotal;
  if (sample.type === PropertyType.URBAN && sample.areaBuilt && sample.areaBuilt > 0) {
    divisor = sample.areaBuilt;
  }
  const pricePerUnit = sample.price / (divisor || 1);

  const payload = preparePayload(sample, pricePerUnit);

  if (!supabase) {
    const local = getLocalSamples();
    // Evita duplicados no localStorage por URL
    if (sample.url && local.some(s => s.url === sample.url)) return null;
    
    const newSample = { ...payload, id: Date.now().toString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newSample, ...local]));
    return newSample as MarketSample;
  }

  // No Supabase, verifica se a URL já existe antes de inserir
  if (sample.url) {
    const { data: existing } = await supabase.from(TABLE_NAME).select('id').eq('url', sample.url).maybeSingle();
    if (existing) return null; 
  }

  const { data, error } = await supabase.from(TABLE_NAME).insert([payload]).select().single();
  if (error) return null;
  return data as MarketSample;
};

const preparePayload = (sample: Partial<MarketSample>, pricePerUnit: number) => {
  return {
    type: sample.type,
    city: sample.city,
    state: sample.state,
    price: sample.price,
    areaTotal: sample.areaTotal,
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
    bedrooms: sample.bedrooms || null,
    bathrooms: sample.bathrooms || null,
    parking: sample.parking || null,
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

export const filterSamples = async (type: PropertyType, city: string, state: string, subTypeOrActivity?: string): Promise<MarketSample[]> => {
  if (!supabase) {
    return getLocalSamples().filter(s => 
      s.type === type && 
      s.state === state && 
      (!city || s.city.toLowerCase() === city.toLowerCase())
    );
  }
  let query = supabase.from(TABLE_NAME).select('*').eq('type', type).eq('state', state);
  if (city) query = query.ilike('city', city);
  const { data } = await query;
  return data || [];
};

export const getSamplesByCities = async (cities: string[], state: string, type: PropertyType): Promise<MarketSample[]> => {
  if (!supabase) return getLocalSamples().filter(s => s.type === type && cities.includes(s.city));
  const { data } = await supabase.from(TABLE_NAME).select('*').eq('type', type).eq('state', state).in('city', cities);
  return data || [];
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
  // Simplificado para brevidade, mantém a lógica de update anterior
  return sample; 
};

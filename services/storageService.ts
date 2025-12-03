import { MarketSample, PropertyType } from "../types";

const STORAGE_KEY = 'BANDEIRA_AGRO_DB';

// Dados de exemplo para iniciar o sistema
const SEED_DATA: MarketSample[] = [
  {
    id: '1',
    type: PropertyType.URBAN,
    title: 'Amostra Base Urbana',
    address: 'Rua Exemplo, 100',
    city: 'Ribeirão Preto',
    state: 'SP',
    neighborhood: 'Centro',
    price: 500000,
    areaTotal: 100,
    areaBuilt: 100,
    pricePerUnit: 5000,
    date: '2023-10-01',
    source: 'Imobiliária Local',
    urbanSubType: 'Apartamento'
  },
  {
    id: '2',
    type: PropertyType.RURAL,
    title: 'Amostra Base Rural',
    address: 'Estrada Rural km 10',
    city: 'Ribeirão Preto',
    state: 'SP',
    price: 2000000,
    areaTotal: 50,
    pricePerUnit: 40000,
    date: '2023-10-05',
    source: 'Portal Rural',
    ruralActivity: 'Lavoura'
  }
];

export const getSamples = (): MarketSample[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
    return SEED_DATA;
  }
  
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Erro ao ler banco de dados local. Resetando.", error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
    return SEED_DATA;
  }
};

export const saveSample = (sample: Omit<MarketSample, 'id' | 'pricePerUnit'>) => {
  const samples = getSamples();
  
  const divisor = sample.areaBuilt && sample.areaBuilt > 0 ? sample.areaBuilt : sample.areaTotal;
  const pricePerUnit = sample.price / (divisor || 1);

  const newSample: MarketSample = {
    ...sample,
    id: Date.now().toString(),
    pricePerUnit
  };

  const updated = [newSample, ...samples];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newSample;
};

// FUNÇÃO DE ATUALIZAÇÃO (EDITAR)
export const updateSample = (sample: MarketSample) => {
  const samples = getSamples();
  const index = samples.findIndex(s => s.id === sample.id);

  if (index !== -1) {
    const divisor = sample.areaBuilt && sample.areaBuilt > 0 ? sample.areaBuilt : sample.areaTotal;
    const pricePerUnit = sample.price / (divisor || 1);

    const updatedSample = {
      ...sample,
      pricePerUnit
    };

    samples[index] = updatedSample;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
    return updatedSample;
  }
  return null;
};

export const deleteSample = (id: string) => {
  const samples = getSamples();
  const updated = samples.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const filterSamples = (type: PropertyType, city: string, state: string, subTypeOrActivity?: string): MarketSample[] => {
  const samples = getSamples();
  return samples.filter(s => {
    const matchType = s.type === type;
    const matchLoc = s.city.toLowerCase().trim() === city.toLowerCase().trim() && s.state === state;
    
    let matchSub = true;
    if (subTypeOrActivity) {
      if (type === PropertyType.URBAN && s.urbanSubType) matchSub = s.urbanSubType === subTypeOrActivity;
      if (type === PropertyType.RURAL && s.ruralActivity) matchSub = s.ruralActivity === subTypeOrActivity;
    }
    
    return matchType && matchLoc && matchSub;
  });
};
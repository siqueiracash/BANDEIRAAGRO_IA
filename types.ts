
export enum PropertyType {
  URBAN = 'URBANO',
  RURAL = 'RURAL',
}

export interface PropertyData {
  type: PropertyType;
  city: string;
  state: string;
  address?: string;
  areaTotal: number;
  areaBuilt?: number;
  description: string;

  // Urban Specifics
  urbanSubType?: string;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  conservationState?: string;

  // Rural Specifics
  ruralActivity?: string;
  carNumber?: string;
  surface?: string;
  access?: string;
  topography?: string;
  occupation?: string;
  improvements?: string;
  
  // Novos campos baseados na tabela detalhada
  landCapability?: string; // Capacidade de Uso da Terra (I a VIII)
  publicImprovements?: string; // Melhoramentos Públicos (Luz, Força, etc)
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MarketSample {
  id: string;
  type: PropertyType;
  title: string;
  address: string;
  city: string;
  state: string;
  neighborhood?: string;
  price: number;
  areaTotal: number;
  areaBuilt?: number;
  pricePerUnit: number;
  date: string;
  source: string;
  url?: string;
  description?: string;
  
  // Campos Urbanos Específicos
  urbanSubType?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  conservationState?: string;

  // Campos Rurais Específicos
  ruralActivity?: string;
  carNumber?: string;
  surface?: string;
  access?: string;
  topography?: string;
  occupation?: string;
  improvements?: string;
  
  landCapability?: string;
  publicImprovements?: string;
}

export interface ValuationResult {
  reportText: string;
  sources: (MarketSample | GroundingSource)[];
  estimatedValue: string;
}

export enum AppStep {
  SETUP = -1,     // Novo: Verificação de Chave
  SELECTION = 0,
  FORM = 1,
  LOADING = 2,
  RESULT = 3,
  LOGIN = 4,
  DASHBOARD = 5
}

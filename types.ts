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
}

export interface GroundingSource {
  title: string;
  uri: string;
}

// NOVA: Interface para amostra de mercado manual
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
  pricePerUnit: number; // Calculado
  date: string;
  source: string;
  
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
}

// ATUALIZADA: Agora suporta MarketSample ou GroundingSource
export interface ValuationResult {
  reportText: string;
  sources: (MarketSample | GroundingSource)[];
  estimatedValue: string;
}

export enum AppStep {
  SELECTION = 0,
  FORM = 1,
  LOADING = 2,
  RESULT = 3,
  LOGIN = 4,      // Nova etapa
  DASHBOARD = 5   // Nova etapa
}
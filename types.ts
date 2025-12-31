
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
  landCapability?: string;
  publicImprovements?: string;
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
  urbanSubType?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  conservationState?: string;
  ruralActivity?: string;
  carNumber?: string;
  surface?: string;
  access?: string;
  topography?: string;
  occupation?: string;
  improvements?: string;
  landCapability?: string;
  publicImprovements?: string;
  
  // Campo para cálculo
  adjustedPricePerUnit?: number;
}

export interface ValuationResult {
  reportText: string;
  sources: MarketSample[];
  estimatedValue: string;
  liquidationValue: string;
  stats: {
    average: number;
    sampleCount: number;
    standardDeviation: string;
  };
}

export enum AppStep {
  SELECTION = 0,
  FORM = 1,
  LOADING = 2,
  RESULT = 3,
  LOGIN = 4,
  DASHBOARD = 5
}

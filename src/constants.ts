import { PropertyType } from "./types";

export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const INITIAL_PROPERTY_DATA = {
  type: PropertyType.URBAN,
  city: '',
  state: '',
  areaTotal: 0,
  description: '',
};
import React, { useState } from 'react';
import { PropertyData, PropertyType } from '../types';
import { BRAZIL_STATES } from '../constants';

interface StepFormProps {
  propertyType: PropertyType;
  initialData?: PropertyData; // New prop for pre-filling
  onSubmit: (data: PropertyData) => void;
  onBack: () => void;
}

const StepForm: React.FC<StepFormProps> = ({ propertyType, initialData, onSubmit, onBack }) => {
  const [formData, setFormData] = useState<Partial<PropertyData>>({
    type: propertyType,
    city: initialData?.city || '',
    state: initialData?.state || '',
    description: initialData?.description || '',
    address: initialData?.address || '',
    areaTotal: initialData?.areaTotal || 0,
    areaBuilt: initialData?.areaBuilt || 0,
    
    // Urban
    urbanSubType: initialData?.urbanSubType || 'Apartamento', 
    neighborhood: initialData?.neighborhood || '',
    bedrooms: initialData?.bedrooms || 0,
    bathrooms: initialData?.bathrooms || 0,
    parking: initialData?.parking || 0,
    conservationState: initialData?.conservationState || '',

    // Rural
    ruralActivity: initialData?.ruralActivity || 'Lavoura',
    carNumber: initialData?.carNumber || '',
    surface: initialData?.surface || '',
    access: initialData?.access || '',
    topography: initialData?.topography || '',
    occupation: initialData?.occupation || '',
    improvements: initialData?.improvements || '',
    landCapability: initialData?.landCapability || '',
    publicImprovements: initialData?.publicImprovements || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.city || !formData.state || !formData.areaTotal) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    if (propertyType === PropertyType.URBAN && !formData.address) {
      alert("O endereço/localização é obrigatório para imóveis urbanos.");
      return;
    }

    onSubmit(formData as PropertyData);
  };

  const isRural = propertyType === PropertyType.RURAL;

  return (
    <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-6 md:p-10 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-serif font-bold text-agro-900">
          Dados do {isRural ? 'Imóvel Rural' : 'Imóvel Urbano'}
        </h2>
        <p className="text-sm text-gray-500">
          Preencha rigorosamente as características para aumentar a precisão da avaliação conforme NBR 14653-3.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
            <input
              type="text"
              name="city"
              required
              value={formData.city}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500"
              placeholder="Ex: Ribeirão Preto"
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
            <select name="state" required value={formData.state} className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white" onChange={handleChange}>
              <option value="">UF</option>
              {BRAZIL_STATES.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        {/* MUDANÇA: Campo Bairro movido para cá se for Urbano */}
        {!isRural && (
          <div className="md:col-span-3">
             <label className="block text-sm font-medium text-gray-700 mb-1">Bairro *</label>
             <input
              type="text"
              name="neighborhood"
              required
              value={formData.neighborhood}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500"
              placeholder="Ex: Centro, Vila Madalena"
              onChange={handleChange}
            />
          </div>
        )}

        <div className="md:col-span-2">
           <label className="block text-sm font-medium text-gray-700 mb-1">Endereço / Localização</label>
           <input
            type="text"
            name="address"
            required={!isRural}
            value={formData.address}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500"
            placeholder={isRural ? "Ex: Estrada Municipal km 5" : "Ex: Rua das Flores, 123"}
            onChange={handleChange}
          />
        </div>

        {/* --- CAMPOS RURAIS DETALHADOS (Conforme Tabela) --- */}
        {isRural && (
          <div className="bg-agro-50 p-6 rounded-xl border border-agro-100 space-y-6">
            <h3 className="font-bold text-agro-900 border-b border-agro-200 pb-2">Características Físicas e Agronômicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Atividade Principal</label>
                <select name="ruralActivity" value={formData.ruralActivity} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="Lavoura">Lavoura</option>
                  <option value="Pecuária">Pecuária</option>
                  <option value="Pasto">Pasto</option>
                  <option value="Floresta">Floresta</option>
                  <option value="Cerrado Nativo">Cerrado Nativo</option>
                  <option value="Mata Nativa">Mata Nativa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Área Total (Hectares) *</label>
                <input
                  type="number"
                  name="areaTotal"
                  required
                  min="0"
                  step="0.01"
                  value={formData.areaTotal || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  onChange={handleChange}
                />
                <span className="text-xs text-gray-500">Atenção: O Fator Dimensão será aplicado automaticamente com base neste valor.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-800 mb-1">Uso de Solo</label>
                <select name="landCapability" value={formData.landCapability} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">Selecione...</option>
                  <option value="I - Culturas (Sem problemas)">I - Culturas (Sem problemas)</option>
                  <option value="II - Culturas (Pequenos problemas)">II - Culturas (Pequenos problemas)</option>
                  <option value="III - Culturas (Sérios problemas)">III - Culturas (Sérios problemas)</option>
                  <option value="IV - Culturas Ocasionais / Pastagens">IV - Culturas Ocasionais / Pastagens</option>
                  <option value="V - Só Pastagens">V - Só Pastagens</option>
                  <option value="VI - Só Pastagens (Pequenos problemas)">VI - Só Pastagens (Pequenos problemas)</option>
                  <option value="VII - Florestas">VII - Florestas</option>
                  <option value="VIII - Abrigo Silvestre">VIII - Abrigo Silvestre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acessibilidade</label>
                <select name="access" value={formData.access} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Ótimo (asfalto, tráfego permanente)">Ótimo (asfalto)</option>
                  <option value="Muito Bom (estrada classe, não asfalto)">Muito Bom (estrada classe)</option>
                  <option value="Bom (não pavimentada, tráfego permanente)">Bom (não pavimentada)</option>
                  <option value="Regular (não pavimentada, sujeita a interrupção)">Regular (interrupção possível)</option>
                  <option value="Mau (interrupção na chuva)">Mau (interrupção na chuva)</option>
                  <option value="Péssimo (interrupção por córrego sem ponte)">Péssimo (sem ponte)</option>
                  <option value="Encravada">Encravada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Melhoramentos Públicos</label>
                <select name="publicImprovements" value={formData.publicImprovements} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Luz domiciliar + Força + Rede telefônica">Luz + Força + Telefone</option>
                  <option value="Luz domiciliar + Força">Luz + Força</option>
                  <option value="Luz domiciliar + Rede">Luz + Rede</option>
                  <option value="Luz domiciliar">Somente Luz</option>
                  <option value="Força + Rede telefônica">Força + Telefone</option>
                  <option value="Nenhum">Nenhum</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topografia</label>
                <select name="topography" value={formData.topography} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Plano">Plano</option>
                  <option value="Leve-Ondulado">Leve-Ondulado</option>
                  <option value="Ondulado">Ondulado</option>
                  <option value="Montanhoso">Montanhoso</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Superfície (Solo)</label>
                <select name="surface" value={formData.surface} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Seca">Seca</option>
                  <option value="Alagadiça">Alagadiça</option>
                  <option value="Brejosa ou Pantanosa">Brejosa ou Pantanosa</option>
                  <option value="Permanentemente Alagada">Permanentemente Alagada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ocupação (Abertura)</label>
                <select name="occupation" value={formData.occupation} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Alta: 80 a 100% aberto">Alta: 80 a 100% aberto</option>
                  <option value="Média-Alta: 70 a 80% aberto">Média-Alta: 70 a 80%</option>
                  <option value="Média: 50 a 70% aberto">Média: 50 a 70%</option>
                  <option value="Média-Baixa: 40 a 50% aberto">Média-Baixa: 40 a 50%</option>
                  <option value="Baixa: 20 a 40% aberto">Baixa: 20 a 40%</option>
                  <option value="Nula: abaixo de 20%">Nula: abaixo de 20%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Benfeitorias e Infraestrutura</label>
                <select name="improvements" value={formData.improvements} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Benfeitorias de padrão Superior ao local">Superior ao local</option>
                  <option value="Benfeitorias de padrão Comum ao local">Comum ao local</option>
                  <option value="Benfeitorias de padrão Inferior ao local ou Inexistentes">Inferior ou Inexistentes</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* --- CAMPOS URBANOS --- */}
        {!isRural && (
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Imóvel</label>
                   <select name="urbanSubType" className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white" onChange={handleChange} value={formData.urbanSubType}>
                     <option value="Apartamento">Apartamento</option>
                     <option value="Casa">Casa</option>
                     <option value="Sobrado">Sobrado</option>
                     <option value="Terreno">Terreno</option> {/* Opção Adicionada */}
                     <option value="Prédio Comercial">Prédio Comercial</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Área Total (m²)</label>
                   <input type="number" name="areaTotal" required min="0" value={formData.areaTotal || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" onChange={handleChange} />
                </div>
                {/* Bairro foi movido para o topo */}
                
                {/* MUDANÇA: Campos de Quartos, Banheiros e Vagas em Grid */}
                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quartos</label>
                    <input type="number" name="bedrooms" min="0" value={formData.bedrooms || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" onChange={handleChange} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Banheiros</label>
                    <input type="number" name="bathrooms" min="0" value={formData.bathrooms || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" onChange={handleChange} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vagas</label>
                    <input type="number" name="parking" min="0" value={formData.parking || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" onChange={handleChange} placeholder="0" />
                  </div>
                </div>
             </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Detalhes Adicionais</label>
          <textarea
            name="description"
            rows={3}
            value={formData.description}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="Observações extras..."
            onChange={handleChange}
          ></textarea>
        </div>

        <div className="pt-4 flex flex-col md:flex-row gap-4">
          <button type="button" onClick={onBack} className="w-full md:w-1/3 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-xl">
            Voltar
          </button>
          
          <button type="submit" className="w-full md:w-2/3 bg-agro-700 hover:bg-agro-900 text-white font-bold py-4 rounded-xl shadow-md flex justify-center items-center">
            Gerar Avaliação (NBR 14653-3)
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 ml-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default StepForm;
import React, { useState } from 'react';
import { PropertyData, PropertyType } from '../types';
import { BRAZIL_STATES } from '../constants';

interface StepFormProps {
  propertyType: PropertyType;
  onSubmit: (data: PropertyData) => void;
  onBack: () => void;
}

const StepForm: React.FC<StepFormProps> = ({ propertyType, onSubmit, onBack }) => {
  const [formData, setFormData] = useState<Partial<PropertyData>>({
    type: propertyType,
    city: '',
    state: '',
    description: '',
    urbanSubType: 'Apartamento', 
    ruralActivity: 'Lavoura',
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
    <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-6 md:p-10 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-serif font-bold text-agro-900">
          Dados do {isRural ? 'Imóvel Rural' : 'Imóvel Urbano'}
        </h2>
        <p className="text-sm text-gray-500">Preencha as características para a busca de amostras comparativas.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Rural Specific Fields - Top Priority as requested */}
        {isRural && (
          <div className="bg-agro-50 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-agro-900 mb-2">Atividade Predominante</label>
              <select name="ruralActivity" onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white">
                <option value="Lavoura">Lavoura</option>
                <option value="Pasto">Pasto</option>
                <option value="Floresta">Floresta</option>
                <option value="Área de Preservação">Área de Preservação</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-agro-900 mb-2">Nº de CAR (Opcional)</label>
              <input type="text" name="carNumber" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white" placeholder="Registro CAR" onChange={handleChange} />
            </div>
          </div>
        )}

        {/* Urban Specific Fields */}
        {!isRural && (
          <div className="bg-agro-50 p-4 rounded-lg mb-4">
             <label className="block text-sm font-bold text-agro-900 mb-2">Tipo de Imóvel *</label>
             <select 
               name="urbanSubType" 
               className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-agro-500 bg-white"
               onChange={handleChange}
               required
               value={formData.urbanSubType}
             >
               <option value="Apartamento">Apartamento</option>
               <option value="Casa">Casa</option>
               <option value="Sobrado">Sobrado</option>
               <option value="Prédio Comercial">Prédio Comercial</option>
             </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
            <input
              type="text"
              name="city"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 focus:border-transparent outline-none transition-all"
              placeholder="Ex: Ribeirão Preto"
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
            <select
              name="state"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 focus:border-transparent outline-none transition-all bg-white"
              onChange={handleChange}
            >
              <option value="">UF</option>
              {BRAZIL_STATES.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
             <label className="block text-sm font-medium text-gray-700 mb-1">
               Endereço / Localização { !isRural && <span className="text-red-500">*</span> }
             </label>
             <input
              type="text"
              name="address"
              required={!isRural}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 focus:border-transparent outline-none transition-all"
              placeholder={isRural ? "Ex: Estrada Municipal km 5 (Opcional)" : "Ex: Rua das Flores, 123"}
              onChange={handleChange}
            />
          </div>
          {!isRural && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
              <input
                type="text"
                name="neighborhood"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 focus:border-transparent outline-none transition-all"
                placeholder="Ex: Centro"
                onChange={handleChange}
              />
            </div>
          )}
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Área Total ({isRural ? 'Hectares' : 'm²'}) *
            </label>
            <input
              type="number"
              name="areaTotal"
              required
              min="0"
              step="0.01"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 focus:border-transparent outline-none transition-all"
              placeholder="0.00"
              onChange={handleChange}
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">
              Área Construída (m²)
            </label>
            <input
              type="number"
              name="areaBuilt"
              min="0"
              step="0.01"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 focus:border-transparent outline-none transition-all"
              placeholder="0.00"
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Conservation State Moved Here for Urban */}
        {!isRural && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado de Conservação</label>
            <select name="conservationState" onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white">
              <option value="">Selecione...</option>
              <option value="Novo">Novo</option>
              <option value="Bom">Bom</option>
              <option value="Regular">Regular</option>
              <option value="Precisa de Reparos">Precisa de Reparos</option>
              <option value="Ruim">Ruim</option>
            </select>
          </div>
        )}
          
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isRural ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Superfície</label>
                <select name="surface" onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Seca">Seca</option>
                  <option value="Alagadiça">Alagadiça</option>
                  <option value="Brejosa ou Pantanosa">Brejosa ou Pantanosa</option>
                  <option value="Permanente Alagada">Permanente Alagada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acessibilidade</label>
                <select name="access" onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Ótimo">Ótimo</option>
                  <option value="Muito bom">Muito bom</option>
                  <option value="Bom">Bom</option>
                  <option value="Regular">Regular</option>
                  <option value="Mau">Mau</option>
                  <option value="Péssimo">Péssimo</option>
                  <option value="Encravada">Encravada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topografia</label>
                <select name="topography" onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Plano">Plano</option>
                  <option value="Leve Ondulado">Leve Ondulado</option>
                  <option value="Ondulado">Ondulado</option>
                  <option value="Montanhoso">Montanhoso</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ocupação</label>
                <select name="occupation" onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Alta: 80 a 100% aberto">Alta: 80 a 100% aberto</option>
                  <option value="Média-Alta: 70 a 80% aberto">Média-Alta: 70 a 80% aberto</option>
                  <option value="Média: 50 a 70% aberto">Média: 50 a 70% aberto</option>
                  <option value="Média-Baixa: 40 a 50% aberto">Média-Baixa: 40 a 50% aberto</option>
                  <option value="Baixa: 20 a 40% aberto">Baixa: 20 a 40% aberto</option>
                  <option value="Nula: abaixo de 20%">Nula: abaixo de 20%</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Benfeitorias</label>
                <select name="improvements" onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 bg-white">
                  <option value="">Selecione...</option>
                  <option value="Sem Benfeitorias">Sem Benfeitorias</option>
                  <option value="Benfeitorias de padrão Superior ao local">Benfeitorias de padrão Superior ao local</option>
                  <option value="Benfeitorias de padrão Comum ao local">Benfeitorias de padrão Comum ao local</option>
                  <option value="Benfeitorias de padrão Inferior ao local">Benfeitorias de padrão Inferior ao local</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quartos</label>
                <input type="number" name="bedrooms" min="0" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 outline-none" onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº de Banheiros</label>
                <input type="number" name="bathrooms" min="0" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 outline-none" onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vagas de Garagem</label>
                <input type="number" name="parking" min="0" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 outline-none" onChange={handleChange} />
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Detalhes Adicionais (Observações extras)</label>
          <textarea
            name="description"
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-agro-500 focus:border-transparent outline-none transition-all resize-none"
            placeholder="Descreva detalhes importantes..."
            onChange={handleChange}
          ></textarea>
        </div>

        <div className="pt-4 flex flex-col md:flex-row gap-4">
          <button
            type="button"
            onClick={onBack}
            className="w-full md:w-1/3 bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-xl shadow-sm transition-all duration-300 flex justify-center items-center text-lg"
          >
            Voltar
          </button>
          
          <button
            type="submit"
            className="w-full md:w-2/3 bg-agro-700 hover:bg-agro-900 text-white font-bold py-4 rounded-xl shadow-md transition-all duration-300 flex justify-center items-center text-lg"
          >
            Gerar Avaliação e Laudo
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
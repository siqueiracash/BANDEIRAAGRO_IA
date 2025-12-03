import React, { useState, useEffect } from 'react';
import { MarketSample, PropertyType } from '../types';
import { getSamples, saveSample, updateSample, deleteSample } from '../services/storageService';
import { BRAZIL_STATES } from '../constants';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [samples, setSamples] = useState<MarketSample[]>([]);
  const [activeTab, setActiveTab] = useState<'LIST' | 'ADD'>('LIST');
  
  // Estado para controlar Edição
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado local para o input de valor formatado (R$)
  const [priceDisplay, setPriceDisplay] = useState('');

  // Estado do formulário
  const [form, setForm] = useState<Partial<MarketSample>>({ 
    type: PropertyType.URBAN, 
    state: '', 
    city: '',
    urbanSubType: 'Apartamento',
    ruralActivity: 'Lavoura'
  });

  useEffect(() => { load(); }, []);

  const load = () => setSamples(getSamples());

  // Formata número para moeda BRL (ex: 1000 -> 1.000,00)
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Manipula a mudança no input de preço com máscara
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove tudo que não é número
    value = value.replace(/\D/g, "");

    if (value === "") {
        setPriceDisplay("");
        setForm(prev => ({ ...prev, price: 0 }));
        return;
    }
    
    // Converte para centavos e formata
    const numberValue = parseInt(value, 10) / 100;
    
    setPriceDisplay(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setForm(prev => ({ ...prev, price: numberValue }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({ 
      type: PropertyType.URBAN, 
      state: '', 
      city: '', 
      urbanSubType: 'Apartamento', 
      ruralActivity: 'Lavoura' 
    });
    setPriceDisplay('');
    setEditingId(null);
  };

  const handleEdit = (sample: MarketSample) => {
    setForm({ ...sample });
    setPriceDisplay(formatCurrency(sample.price));
    setEditingId(sample.id);
    setActiveTab('ADD');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações Gerais
    if (!form.city || !form.state || !form.price || !form.areaTotal) {
      alert('Preencha os campos obrigatórios gerais (Cidade, Estado, Valor, Área Total).');
      return;
    }

    // Validações Urbanas
    if (form.type === PropertyType.URBAN) {
      if (!form.address || !form.neighborhood) {
        alert('Para imóveis urbanos, Endereço e Bairro são obrigatórios.');
        return;
      }
    }

    const sampleData = {
      ...form,
      title: form.title || 'Amostra Manual',
      address: form.address || '',
      city: form.city,
      state: form.state || 'SP',
      price: Number(form.price),
      areaTotal: Number(form.areaTotal),
      areaBuilt: Number(form.areaBuilt || 0),
      date: form.date || new Date().toISOString(),
      source: form.source || 'Equipe Bandeira Agro',
      
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      parking: form.parking ? Number(form.parking) : undefined,
    } as any;

    if (editingId) {
      // UPDATE
      updateSample({ ...sampleData, id: editingId });
      alert('Amostra atualizada com sucesso!');
    } else {
      // CREATE
      saveSample(sampleData);
      alert('Amostra salva com sucesso!');
    }
    
    resetForm();
    setActiveTab('LIST');
    load();
  };

  const remove = (id: string) => {
    if (confirm('Excluir esta amostra permanentemente?')) { deleteSample(id); load(); }
  };

  const handleTabChange = (tab: 'LIST' | 'ADD') => {
    setActiveTab(tab);
    if (tab === 'LIST') resetForm();
    if (tab === 'ADD' && !editingId) resetForm();
  };

  return (
    <div className="w-full max-w-6xl animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-agro-900 font-serif">Gestão de Amostras</h2>
        <button onClick={onLogout} className="text-red-600 font-bold border border-red-200 px-4 py-2 rounded hover:bg-red-50 transition-colors">
          Sair
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button 
            onClick={() => handleTabChange('LIST')} 
            className={`pb-4 px-4 font-bold text-sm uppercase tracking-wide transition-colors ${activeTab === 'LIST' ? 'text-agro-700 border-b-2 border-agro-500' : 'text-gray-400 hover:text-agro-600'}`}
          >
            Lista de Amostras
          </button>
          <button 
            onClick={() => handleTabChange('ADD')} 
            className={`pb-4 px-4 font-bold text-sm uppercase tracking-wide transition-colors ${activeTab === 'ADD' ? 'text-agro-700 border-b-2 border-agro-500' : 'text-gray-400 hover:text-agro-600'}`}
          >
            {editingId ? 'Editar Amostra' : '+ Nova Amostra'}
          </button>
        </div>

        {activeTab === 'LIST' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 uppercase text-xs">
                  <th className="p-3 rounded-tl-lg">Local</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Detalhes</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3 rounded-tr-lg text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {samples.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-gray-800">{s.city}/{s.state}</div>
                      <div className="text-xs text-gray-500">{s.neighborhood || s.address}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${s.type === PropertyType.URBAN ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {s.type === PropertyType.URBAN ? 'URBANO' : 'RURAL'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-600">
                      {s.type === PropertyType.URBAN ? s.urbanSubType : s.ruralActivity} • {s.areaTotal} {s.type === PropertyType.URBAN ? 'm²' : 'ha'}
                    </td>
                    <td className="p-3 font-medium text-agro-900">
                      {s.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                    </td>
                    <td className="p-3 flex justify-center gap-2">
                      {/* BOTÃO EDITAR */}
                      <button 
                        onClick={() => handleEdit(s)} 
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-colors"
                        title="Editar"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      {/* BOTÃO EXCLUIR */}
                      <button 
                        onClick={() => remove(s.id)} 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                        title="Excluir"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {samples.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Nenhuma amostra cadastrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {editingId ? `Editando: ${form.city || 'Imóvel'}` : 'Cadastrar Nova Amostra'}
              </h3>
              {editingId && (
                <button type="button" onClick={() => handleTabChange('LIST')} className="text-sm text-gray-500 hover:underline">
                  Cancelar Edição
                </button>
              )}
            </div>

            {/* Seletor de Tipo */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
               <label className="block text-sm font-bold text-gray-700 mb-2">Categoria do Imóvel</label>
               <select 
                 name="type" 
                 className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-agro-500 bg-white font-medium"
                 value={form.type} 
                 onChange={e => setForm({...form, type: e.target.value as any})}
               >
                 <option value={PropertyType.URBAN}>Imóvel Urbano</option>
                 <option value={PropertyType.RURAL}>Imóvel Rural</option>
               </select>
            </div>

            {/* --- CAMPOS URBANOS --- */}
            {form.type === PropertyType.URBAN ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 pb-2 border-b border-gray-100 mb-2">
                  <h3 className="text-lg font-bold text-agro-900 font-serif">Dados Urbanos</h3>
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Imóvel *</label>
                   <select name="urbanSubType" value={form.urbanSubType} onChange={handleChange} className="w-full border p-2 rounded">
                     <option value="Apartamento">Apartamento</option>
                     <option value="Casa">Casa</option>
                     <option value="Sobrado">Sobrado</option>
                     <option value="Prédio Comercial">Prédio Comercial</option>
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Cidade *</label>
                    <input name="city" value={form.city} onChange={handleChange} className="w-full border p-2 rounded" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Estado *</label>
                    <select name="state" value={form.state} onChange={handleChange} className="w-full border p-2 rounded" required>
                       <option value="">UF</option>{BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-1">Endereço / Localização *</label>
                   <input name="address" value={form.address} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Rua, Número..." required />
                </div>

                <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-1">Bairro *</label>
                   <input name="neighborhood" value={form.neighborhood} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Bairro" required />
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Área Total (m²) *</label>
                   <input type="number" name="areaTotal" value={form.areaTotal || ''} onChange={handleChange} className="w-full border p-2 rounded" required />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Área Construída (m²)</label>
                   <input type="number" name="areaBuilt" value={form.areaBuilt || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Estado de Conservação</label>
                   <select name="conservationState" value={form.conservationState} onChange={handleChange} className="w-full border p-2 rounded">
                     <option value="">Selecione...</option>
                     <option value="Novo">Novo</option>
                     <option value="Bom">Bom</option>
                     <option value="Regular">Regular</option>
                     <option value="Precisa de Reparos">Precisa de Reparos</option>
                     <option value="Ruim">Ruim</option>
                   </select>
                </div>

                <div className="grid grid-cols-3 gap-2 md:col-span-2 bg-gray-50 p-3 rounded">
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Quartos</label>
                      <input type="number" name="bedrooms" value={form.bedrooms || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Banheiros</label>
                      <input type="number" name="bathrooms" value={form.bathrooms || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Vagas</label>
                      <input type="number" name="parking" value={form.parking || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                   </div>
                </div>
              </div>
            ) : (
              // --- CAMPOS RURAIS ---
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 pb-2 border-b border-gray-100 mb-2">
                  <h3 className="text-lg font-bold text-green-800 font-serif">Dados Rurais</h3>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Atividade Predominante</label>
                  <select name="ruralActivity" value={form.ruralActivity} onChange={handleChange} className="w-full border p-2 rounded">
                    <option value="Lavoura">Lavoura</option>
                    <option value="Pasto">Pasto</option>
                    <option value="Floresta">Floresta</option>
                    <option value="Área de Preservação">Área de Preservação</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nº de CAR (Opcional)</label>
                  <input name="carNumber" value={form.carNumber || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Cidade *</label>
                    <input name="city" value={form.city} onChange={handleChange} className="w-full border p-2 rounded" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Estado *</label>
                    <select name="state" value={form.state} onChange={handleChange} className="w-full border p-2 rounded" required>
                       <option value="">UF</option>{BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-1">Endereço / Localização</label>
                   <input name="address" value={form.address} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Estrada, km..." />
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Área Total (Hectares) *</label>
                   <input type="number" name="areaTotal" value={form.areaTotal || ''} onChange={handleChange} className="w-full border p-2 rounded" required />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Área Construída (m²)</label>
                   <input type="number" name="areaBuilt" value={form.areaBuilt || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Superfície</label>
                  <select name="surface" value={form.surface} onChange={handleChange} className="w-full border p-2 rounded">
                    <option value="">Selecione...</option>
                    <option value="Seca">Seca</option>
                    <option value="Alagadiça">Alagadiça</option>
                    <option value="Brejosa ou Pantanosa">Brejosa ou Pantanosa</option>
                    <option value="Permanente Alagada">Permanente Alagada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Acessibilidade</label>
                  <select name="access" value={form.access} onChange={handleChange} className="w-full border p-2 rounded">
                    <option value="">Selecione...</option>
                    <option value="Ótimo">Ótimo</option>
                    <option value="Muito Bom">Muito Bom</option>
                    <option value="Bom">Bom</option>
                    <option value="Regular">Regular</option>
                    <option value="Mau">Mau</option>
                    <option value="Péssimo">Péssimo</option>
                    <option value="Encravada">Encravada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Topografia</label>
                  <select name="topography" value={form.topography} onChange={handleChange} className="w-full border p-2 rounded">
                    <option value="">Selecione...</option>
                    <option value="Plano">Plano</option>
                    <option value="Leve Ondulado">Leve Ondulado</option>
                    <option value="Ondulado">Ondulado</option>
                    <option value="Montanhoso">Montanhoso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Ocupação</label>
                  <select name="occupation" value={form.occupation} onChange={handleChange} className="w-full border p-2 rounded">
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
                  <label className="block text-sm font-bold text-gray-700 mb-1">Benfeitorias</label>
                  <select name="improvements" value={form.improvements} onChange={handleChange} className="w-full border p-2 rounded">
                    <option value="">Selecione...</option>
                    <option value="Benfeitorias de padrão Superior ao local">Benfeitorias de padrão Superior ao local</option>
                    <option value="Benfeitorias de padrão Comum ao local">Benfeitorias de padrão Comum ao local</option>
                    <option value="Benfeitorias de padrão Inferior ao local">Benfeitorias de padrão Inferior ao local</option>
                    <option value="Inexistentes">Inexistentes</option>
                  </select>
                </div>
              </div>
            )}

            {/* --- CAMPOS COMUNS (Valor e Fonte) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Valor de Venda (R$) *</label>
                  <input 
                    type="text" 
                    name="priceDisplay" 
                    value={priceDisplay} 
                    onChange={handlePriceChange} 
                    className="w-full border border-gray-300 p-2 rounded font-bold text-agro-900" 
                    placeholder="0,00"
                    required 
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Fonte da Informação</label>
                  <input name="source" value={form.source || ''} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded" placeholder="Ex: Imobiliária X, ZAP, Placa" />
               </div>
            </div>

            <div className="pt-4 flex gap-4">
              {editingId && (
                <button 
                  type="button" 
                  onClick={() => handleTabChange('LIST')}
                  className="w-1/3 bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit" 
                className={`bg-agro-700 text-white font-bold py-4 rounded-xl hover:bg-agro-800 transition-colors shadow-lg ${editingId ? 'w-2/3' : 'w-full'}`}
              >
                {editingId ? 'Atualizar Amostra' : 'Salvar Amostra no Banco de Dados'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
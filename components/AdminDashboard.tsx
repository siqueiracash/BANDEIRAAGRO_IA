import React, { useState, useEffect } from 'react';
import { MarketSample, PropertyType } from '../types';
import { getSamples, saveSample, updateSample, deleteSample } from '../services/storageService';
import { BRAZIL_STATES } from '../constants';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [samples, setSamples] = useState<MarketSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'LIST' | 'ADD'>('LIST');
  
  // --- ESTADOS DO FILTRO ---
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    city: '',
    state: '',
    type: '',
    minPrice: '',
    maxPrice: '',
    minArea: '',
    maxArea: '',
  });

  // --- ESTADOS DO FORMULÁRIO ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDisplay, setPriceDisplay] = useState('');

  const [form, setForm] = useState<Partial<MarketSample>>({ 
    type: PropertyType.URBAN, 
    state: '', 
    city: '',
    urbanSubType: 'Apartamento',
    ruralActivity: 'Lavoura'
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await getSamples();
    setSamples(data);
    setLoading(false);
  };

  // --- LÓGICA DE FILTRAGEM ---
  const filteredSamples = samples.filter(sample => {
    // 1. Tipo
    if (filters.type && sample.type !== filters.type) return false;
    
    // 2. Estado
    if (filters.state && sample.state !== filters.state) return false;
    
    // 3. Cidade (Busca parcial, case insensitive)
    if (filters.city && !sample.city.toLowerCase().includes(filters.city.toLowerCase().trim())) return false;
    
    // 4. Preço
    if (filters.minPrice && sample.price < Number(filters.minPrice)) return false;
    if (filters.maxPrice && sample.price > Number(filters.maxPrice)) return false;
    
    // 5. Área
    if (filters.minArea && sample.areaTotal < Number(filters.minArea)) return false;
    if (filters.maxArea && sample.areaTotal > Number(filters.maxArea)) return false;

    return true;
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      city: '',
      state: '',
      type: '',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      maxArea: '',
    });
  };

  // --- LÓGICA DO FORMULÁRIO ---

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") {
        setPriceDisplay("");
        setForm(prev => ({ ...prev, price: 0 }));
        return;
    }
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!form.city || !form.state || !form.price || !form.areaTotal) {
      alert('Preencha os campos obrigatórios gerais.');
      setLoading(false);
      return;
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
    } as any;

    try {
      if (editingId) {
        await updateSample({ ...sampleData, id: editingId });
        alert('Amostra atualizada!');
      } else {
        await saveSample(sampleData);
        alert('Amostra salva!');
      }
      resetForm();
      setActiveTab('LIST');
      await load();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (confirm('Excluir esta amostra permanentemente?')) { 
      setLoading(true);
      await deleteSample(id); 
      await load(); 
      setLoading(false);
    }
  };

  const isRural = form.type === PropertyType.RURAL;

  return (
    <div className="w-full max-w-6xl animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-agro-900 font-serif">Gestão de Amostras</h2>
        <button onClick={onLogout} className="text-red-600 font-bold border border-red-200 px-4 py-2 rounded hover:bg-red-50">Sair</button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button onClick={() => setActiveTab('LIST')} className={`pb-4 px-4 font-bold text-sm uppercase ${activeTab === 'LIST' ? 'text-agro-700 border-b-2 border-agro-500' : 'text-gray-400'}`}>Lista de Amostras</button>
          <button onClick={() => setActiveTab('ADD')} className={`pb-4 px-4 font-bold text-sm uppercase ${activeTab === 'ADD' ? 'text-agro-700 border-b-2 border-agro-500' : 'text-gray-400'}`}>{editingId ? 'Editar Amostra' : 'Nova Amostra'}</button>
        </div>

        {loading && <div className="text-center py-10 text-gray-500">Carregando...</div>}

        {!loading && activeTab === 'LIST' ? (
          <div>
            {/* --- PAINEL DE FILTROS --- */}
            <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
              <div 
                className="bg-gray-50 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setShowFilters(!showFilters)}
              >
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17.414V11.414L4.293 6.707A1 1 0 014 6v-3z" clipRule="evenodd" />
                  </svg>
                  Pesquisar e Filtrar Amostras
                </h3>
                <span className="text-gray-500 text-sm">{showFilters ? 'Ocultar' : 'Mostrar'}</span>
              </div>
              
              {showFilters && (
                <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Linha 1: Local e Tipo */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Cidade</label>
                    <input 
                      type="text" 
                      name="city" 
                      value={filters.city} 
                      onChange={handleFilterChange} 
                      placeholder="Busca por nome..." 
                      className="w-full border p-2 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Estado</label>
                    <select name="state" value={filters.state} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm">
                      <option value="">Todos</option>
                      {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Categoria</label>
                    <select name="type" value={filters.type} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm">
                      <option value="">Todas</option>
                      <option value={PropertyType.RURAL}>Rural</option>
                      <option value={PropertyType.URBAN}>Urbano</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                     <button onClick={clearFilters} className="w-full text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 py-2 rounded">
                       Limpar Filtros
                     </button>
                  </div>

                  {/* Linha 2: Valores e Áreas */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Preço Mín (R$)</label>
                    <input type="number" name="minPrice" value={filters.minPrice} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Preço Máx (R$)</label>
                    <input type="number" name="maxPrice" value={filters.maxPrice} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm" placeholder="Sem limite" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Área Mín</label>
                    <input type="number" name="minArea" value={filters.minArea} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Área Máx</label>
                    <input type="number" name="maxArea" value={filters.maxArea} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm" placeholder="Sem limite" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-2 px-2">
              <span className="text-sm font-bold text-gray-600">
                {filteredSamples.length} amostras encontradas
              </span>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 uppercase text-xs">
                    <th className="p-3">Local</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Detalhes</th>
                    <th className="p-3">Valor Total</th>
                    <th className="p-3">Valor Unit.</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSamples.map(s => {
                    const unitPrice = s.price / s.areaTotal;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="font-bold">{s.city}/{s.state}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{s.neighborhood || s.address}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold border ${s.type === PropertyType.URBAN ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{s.type}</span>
                        </td>
                        <td className="p-3 text-xs text-gray-600">
                          <div className="font-semibold">{s.type === PropertyType.URBAN ? s.urbanSubType : s.ruralActivity}</div>
                          <div>{s.areaTotal.toLocaleString('pt-BR')} {s.type === PropertyType.URBAN ? 'm²' : 'ha'}</div>
                          {s.landCapability && <div className="text-gray-400 mt-1 truncate max-w-[150px]" title={s.landCapability}>Cap: {s.landCapability}</div>}
                        </td>
                        <td className="p-3 font-medium text-agro-900">{s.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                        <td className="p-3 text-xs text-gray-500">{unitPrice.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}/{s.type === PropertyType.URBAN ? 'm²' : 'ha'}</td>
                        <td className="p-3 flex justify-center gap-2">
                          <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 font-bold p-1" title="Editar">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                               <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                             </svg>
                          </button>
                          <button onClick={() => remove(s.id)} className="text-red-500 hover:text-red-700 font-bold p-1" title="Excluir">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                             </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSamples.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 bg-gray-50 italic">
                        Nenhuma amostra encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : !loading && activeTab === 'ADD' ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-gray-50 p-4 rounded border">
               <label className="block text-sm font-bold mb-2">Categoria</label>
               <select name="type" className="w-full border p-2 rounded" value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}>
                 <option value={PropertyType.URBAN}>Urbano</option>
                 <option value={PropertyType.RURAL}>Rural</option>
               </select>
            </div>

            {/* CAMPOS COMUNS (CIDADE, PREÇO, ÁREA) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
               <div>
                  <label className="block text-sm font-bold mb-1">Cidade *</label>
                  <input name="city" value={form.city} onChange={handleChange} className="w-full border p-2 rounded" required />
               </div>
               <div>
                  <label className="block text-sm font-bold mb-1">Estado *</label>
                  <select name="state" value={form.state} onChange={handleChange} className="w-full border p-2 rounded" required>
                     <option value="">UF</option>{BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-bold mb-1">Área Total {isRural ? '(ha)' : '(m²)'} *</label>
                  <input type="number" name="areaTotal" value={form.areaTotal || ''} onChange={handleChange} className="w-full border p-2 rounded" required />
               </div>
               <div>
                  <label className="block text-sm font-bold mb-1">Valor Total (R$) *</label>
                  <input type="text" value={priceDisplay} onChange={handlePriceChange} className="w-full border p-2 rounded font-bold" required />
               </div>
            </div>

            {/* FORMULÁRIO RURAL ATUALIZADO */}
            {isRural && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded bg-green-50 mt-4 animate-fade-in">
                 <h3 className="md:col-span-2 font-bold text-green-800 text-lg border-b border-green-200 pb-2">Detalhes Rurais de Alta Precisão</h3>
                 
                 {/* ATIVIDADE PRINCIPAL - CORREÇÃO: Adicionada pois estava faltando no form manual */}
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Atividade Principal</label>
                    <select name="ruralActivity" value={form.ruralActivity} onChange={handleChange} className="w-full border p-2 rounded bg-white">
                      <option value="Lavoura">Lavoura</option>
                      <option value="Pecuária">Pecuária</option>
                      <option value="Pasto">Pasto</option>
                      <option value="Floresta">Floresta</option>
                      <option value="Cerrado Nativo">Cerrado Nativo</option>
                      <option value="Mata Nativa">Mata Nativa</option>
                    </select>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Capacidade de Uso</label>
                    <select name="landCapability" value={form.landCapability} onChange={handleChange} className="w-full border p-2 rounded bg-white">
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
                    <label className="block text-xs font-bold text-gray-600 mb-1">Acesso</label>
                    <select name="access" value={form.access} onChange={handleChange} className="w-full border p-2 rounded bg-white">
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
                    <label className="block text-xs font-bold text-gray-600 mb-1">Topografia</label>
                    <select name="topography" value={form.topography} onChange={handleChange} className="w-full border p-2 rounded bg-white">
                      <option value="">Selecione...</option>
                      <option value="Plano">Plano</option>
                      <option value="Leve-Ondulado">Leve-Ondulado</option>
                      <option value="Ondulado">Ondulado</option>
                      <option value="Montanhoso">Montanhoso</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Melhoramentos</label>
                    <select name="publicImprovements" value={form.publicImprovements} onChange={handleChange} className="w-full border p-2 rounded bg-white">
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
                    <label className="block text-xs font-bold text-gray-600 mb-1">Superfície</label>
                    <select name="surface" value={form.surface} onChange={handleChange} className="w-full border p-2 rounded bg-white">
                      <option value="">Selecione...</option>
                      <option value="Seca">Seca</option>
                      <option value="Alagadiça">Alagadiça</option>
                      <option value="Brejosa ou Pantanosa">Brejosa ou Pantanosa</option>
                      <option value="Permanentemente Alagada">Permanentemente Alagada</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Ocupação</label>
                    <select name="occupation" value={form.occupation} onChange={handleChange} className="w-full border p-2 rounded bg-white">
                      <option value="">Selecione...</option>
                      <option value="Alta: 80 a 100% aberto">Alta: 80 a 100% aberto</option>
                      <option value="Média-Alta: 70 a 80% aberto">Média-Alta: 70 a 80%</option>
                      <option value="Média: 50 a 70% aberto">Média: 50 a 70%</option>
                      <option value="Média-Baixa: 40 a 50% aberto">Média-Baixa: 40 a 50%</option>
                      <option value="Baixa: 20 a 40% aberto">Baixa: 20 a 40%</option>
                      <option value="Nula: abaixo de 20%">Nula: abaixo de 20%</option>
                    </select>
                 </div>
                 <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Benfeitorias</label>
                    <select name="improvements" value={form.improvements} onChange={handleChange} className="w-full border p-2 rounded bg-white">
                      <option value="">Selecione...</option>
                      <option value="Benfeitorias de padrão Superior ao local">Superior ao local</option>
                      <option value="Benfeitorias de padrão Comum ao local">Comum ao local</option>
                      <option value="Benfeitorias de padrão Inferior ao local ou Inexistentes">Inferior ou Inexistentes</option>
                    </select>
                 </div>
              </div>
            )}

            <button type="submit" className="w-full bg-agro-700 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-agro-800">
              {editingId ? 'Atualizar Amostra' : 'Salvar Amostra'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
};

export default AdminDashboard;
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
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button onClick={() => setActiveTab('LIST')} className={`pb-4 px-4 font-bold text-sm uppercase ${activeTab === 'LIST' ? 'text-agro-700 border-b-2 border-agro-500' : 'text-gray-400'}`}>Lista</button>
          <button onClick={() => setActiveTab('ADD')} className={`pb-4 px-4 font-bold text-sm uppercase ${activeTab === 'ADD' ? 'text-agro-700 border-b-2 border-agro-500' : 'text-gray-400'}`}>{editingId ? 'Editar' : 'Nova Amostra'}</button>
        </div>

        {loading && <div className="text-center py-10 text-gray-500">Carregando...</div>}

        {!loading && activeTab === 'LIST' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-100 text-gray-700 uppercase text-xs">
                  <th className="p-3">Local</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Detalhes</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {samples.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-bold">{s.city}/{s.state}</div>
                      <div className="text-xs text-gray-500">{s.neighborhood || s.address}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${s.type === PropertyType.URBAN ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{s.type}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-600">
                      {s.type === PropertyType.URBAN ? s.urbanSubType : s.ruralActivity} • {s.areaTotal} {s.type === PropertyType.URBAN ? 'm²' : 'ha'}
                      {s.landCapability && <div className="text-gray-400 mt-1">Cap: {s.landCapability}</div>}
                    </td>
                    <td className="p-3 font-medium text-agro-900">{s.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                    <td className="p-3 flex justify-center gap-2">
                      <button onClick={() => handleEdit(s)} className="text-blue-600 font-bold">Editar</button>
                      <button onClick={() => remove(s.id)} className="text-red-500 font-bold">X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
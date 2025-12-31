
import React, { useState, useEffect } from 'react';
import { MarketSample, PropertyType } from '../types';
import { getSamples, saveSample, updateSample, deleteSample } from '../services/storageService';
import { extractSampleFromUrl } from '../services/geminiService';
import { BRAZIL_STATES } from '../constants';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [samples, setSamples] = useState<MarketSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'LIST' | 'ADD'>('LIST');
  
  const [filters, setFilters] = useState({
    city: '',
    state: '',
    type: '',
    minPrice: '',
    maxPrice: '',
  });

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<MarketSample>>({ 
    type: PropertyType.URBAN, 
    state: '', 
    city: '',
    urbanSubType: 'Apartamento'
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await getSamples();
    setSamples(data);
    setLoading(false);
  };

  const handleImport = async () => {
    if (!importUrl) return;
    setIsImporting(true);
    try {
      const extractedData = await extractSampleFromUrl(importUrl, form.type || PropertyType.URBAN);
      if (extractedData) {
        setForm(prev => ({ ...prev, ...extractedData }));
        if (extractedData.price) {
          setPriceDisplay(extractedData.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        }
      } else {
        alert("Falha ao extrair dados. Verifique o link.");
      }
    } catch (e) {
      alert("Erro na importação: " + (e as any).message);
    } finally {
      setIsImporting(false);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (!value) {
      setPriceDisplay("");
      setForm(prev => ({ ...prev, price: 0 }));
      return;
    }
    const numberValue = parseInt(value, 10) / 100;
    setPriceDisplay(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setForm(prev => ({ ...prev, price: numberValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.price || !form.areaTotal || !form.city) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateSample({ ...form, id: editingId } as MarketSample);
      } else {
        await saveSample(form as any);
      }
      setActiveTab('LIST');
      load();
      resetForm();
    } catch (e) {
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ type: PropertyType.URBAN, city: '', state: '', urbanSubType: 'Apartamento' });
    setPriceDisplay('');
    setEditingId(null);
    setImportUrl('');
  };

  return (
    <div className="w-full max-w-6xl animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-agro-900 font-serif">Dashboard Administrativo</h2>
        <button onClick={onLogout} className="text-red-600 font-bold px-4 py-2 rounded border border-red-200">Sair</button>
      </div>

      <div className="bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex bg-gray-50 border-b">
          <button onClick={() => setActiveTab('LIST')} className={`px-8 py-4 font-bold text-sm ${activeTab === 'LIST' ? 'bg-white text-agro-700 border-t-2 border-agro-600' : 'text-gray-400'}`}>LISTA DE AMOSTRAS</button>
          <button onClick={() => setActiveTab('ADD')} className={`px-8 py-4 font-bold text-sm ${activeTab === 'ADD' ? 'bg-white text-agro-700 border-t-2 border-agro-600' : 'text-gray-400'}`}>NOVA AMOSTRA</button>
        </div>

        <div className="p-6">
          {activeTab === 'LIST' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 uppercase text-xs font-bold text-gray-500">
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Localização</th>
                    <th className="p-4">Área</th>
                    <th className="p-4">Preço Total</th>
                    <th className="p-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {samples.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-4"><span className="px-2 py-1 rounded text-[10px] font-bold bg-agro-100 text-agro-800">{s.type}</span></td>
                      <td className="p-4">{s.city}/{s.state}</td>
                      <td className="p-4">{s.areaTotal} {s.type === PropertyType.URBAN ? 'm²' : 'ha'}</td>
                      <td className="p-4 font-bold">{s.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                      <td className="p-4">
                        <button onClick={() => { setForm(s); setEditingId(s.id); setActiveTab('ADD'); }} className="text-blue-600 mr-4">Editar</button>
                        <button onClick={() => { if(confirm('Excluir?')) deleteSample(s.id).then(load); }} className="text-red-500">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'ADD' && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-blue-50 p-6 rounded-xl mb-8 border border-blue-100">
                <h3 className="font-bold text-blue-900 mb-2">Importação por Link</h3>
                <div className="flex gap-2">
                  <input type="text" value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Cole o link do Zap, VivaReal, OLX..." className="flex-1 p-3 rounded-lg border border-blue-200 outline-none" />
                  <button onClick={handleImport} disabled={isImporting} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold disabled:bg-blue-300">
                    {isImporting ? 'Lendo...' : 'Importar'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Categoria</label>
                    <select className="w-full border p-2 rounded" value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}>
                      <option value={PropertyType.URBAN}>Urbano</option>
                      <option value={PropertyType.RURAL}>Rural</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Estado</label>
                    <select className="w-full border p-2 rounded" value={form.state} onChange={e => setForm({...form, state: e.target.value})}>
                      <option value="">UF</option>
                      {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Cidade</label>
                  <input className="w-full border p-2 rounded" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-xs font-bold mb-1">Valor Total (R$)</label>
                    <input className="w-full border p-2 rounded font-bold" value={priceDisplay} onChange={handlePriceChange} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Área ({form.type === PropertyType.URBAN ? 'm²' : 'ha'})</label>
                    <input className="w-full border p-2 rounded" type="number" step="0.01" value={form.areaTotal} onChange={e => setForm({...form, areaTotal: Number(e.target.value)})} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-agro-700 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-agro-800 transition-colors">
                  {editingId ? 'ATUALIZAR AMOSTRA' : 'SALVAR AMOSTRA'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

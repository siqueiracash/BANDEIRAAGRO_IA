
import React, { useState } from 'react';

interface ApiKeySetupProps {
  onConfigured: () => void;
}

const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onConfigured }) => {
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
      }
      // Regra do SDK: Assumir sucesso após disparar o diálogo e prosseguir
      onConfigured();
    } catch (e) {
      console.error("Erro ao abrir seletor de chaves:", e);
      // Mesmo com erro, tentamos prosseguir caso a chave já esteja no ambiente
      onConfigured();
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-10 text-center animate-fade-in border border-gray-100 mt-12">
      <div className="mb-8">
        <div className="w-20 h-20 bg-agro-50 rounded-full flex items-center justify-center mx-auto mb-4 text-agro-700">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h1 className="text-3xl font-serif font-bold text-agro-900 mb-2">Bandeira Agro Intelligence</h1>
        <p className="text-gray-600">
          Ative o motor de inteligência artificial para realizar buscas de mercado automatizadas e laudos profissionais.
        </p>
      </div>

      <button 
        onClick={handleActivate}
        disabled={isActivating}
        className="w-full bg-agro-700 hover:bg-agro-900 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 disabled:bg-gray-400"
      >
        {isActivating ? "Conectando Engine..." : "Ativar Engine de Inteligência"}
        {!isActivating && (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        )}
      </button>
      
      <p className="mt-4 text-xs text-gray-400">
        Requer conta Google Cloud vinculada.
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener" className="ml-1 underline">Mais detalhes</a>
      </p>
    </div>
  );
};

export default ApiKeySetup;

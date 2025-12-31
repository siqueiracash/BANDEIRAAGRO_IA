
import React from 'react';

interface ApiKeySetupProps {
  onConfigured: () => void;
}

const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onConfigured }) => {
  const handleActivate = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume sucesso conforme diretrizes e prossegue
      onConfigured();
    } else {
      // Se não houver helper (fora do AI Studio), apenas prossegue
      onConfigured();
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-10 text-center animate-fade-in border border-gray-100 mt-12">
      <div className="mb-8">
        <div className="w-20 h-20 bg-agro-50 rounded-full flex items-center justify-center mx-auto mb-4 text-agro-700">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <h1 className="text-3xl font-serif font-bold text-agro-900 mb-2">Motor de IA Bandeira Agro</h1>
        <p className="text-gray-600">
          Para iniciar as avaliações de alta precisão baseadas na NBR 14653, precisamos ativar sua conexão com o processamento Gemini.
        </p>
      </div>

      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 text-left">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-agro-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          Requisito de Ativação
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          Clique no botão abaixo para vincular sua chave de API do Google Cloud. Certifique-se de que o projeto possui faturamento ativo para busca de amostras em tempo real.
        </p>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-agro-600 hover:underline mt-4 inline-block font-semibold"
        >
          Consulte a documentação de faturamento →
        </a>
      </div>

      <button 
        onClick={handleActivate}
        className="w-full bg-agro-700 hover:bg-agro-900 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
      >
        Ativar Engine de Inteligência
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      </button>
    </div>
  );
};

export default ApiKeySetup;

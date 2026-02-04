
import React from 'react';

interface UserManualProps {
  onBack: () => void;
}

const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in">
      <div className="bg-agro-900 p-8 text-white">
        <h1 className="text-3xl font-serif font-bold">Manual de Operação - BANDEIRA AGRO</h1>
        <p className="opacity-80 mt-2">Guia oficial para emissão de laudos e gestão de amostras.</p>
      </div>

      <div className="p-8 space-y-12 text-gray-700 leading-relaxed">
        
        <section>
          <h2 className="text-xl font-bold text-agro-700 border-b-2 border-agro-100 pb-2 mb-4 flex items-center gap-2">
            <span className="bg-agro-100 text-agro-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">01</span>
            Visão Geral do Sistema
          </h2>
          <p>
            A plataforma <strong>BANDEIRA AGRO</strong> foi desenvolvida para automatizar o processo de avaliação de imóveis urbanos e rurais seguindo os preceitos da norma <strong>ABNT NBR 14653</strong>. 
            O motor do sistema utiliza uma lógica de <em>Busca em Cascata</em>: primeiro exaure as amostras qualificadas cadastradas pela nossa equipe interna e, caso não atinja o quórum mínimo (5 amostras), utiliza Inteligência Artificial para varrer portais imobiliários públicos.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
            <h3 className="font-bold text-agro-900 mb-3 uppercase text-sm tracking-wider">Avaliação Urbana</h3>
            <ul className="space-y-2 text-sm">
              <li><strong className="text-agro-700">Obrigatórios:</strong> Cidade, Estado, Bairro, Área (m²) e Endereço.</li>
              <li><strong className="text-blue-600">Opcionais:</strong> Quartos, Banheiros e Vagas.</li>
              <li><strong className="text-orange-500">Regra:</strong> O campo "Bairro" é essencial para o ajuste de localização.</li>
            </ul>
          </div>
          <div className="bg-agro-50 p-6 rounded-xl border border-agro-100">
            <h3 className="font-bold text-agro-900 mb-3 uppercase text-sm tracking-wider">Avaliação Rural</h3>
            <ul className="space-y-2 text-sm">
              <li><strong className="text-agro-700">Obrigatórios:</strong> Cidade, Estado, Área (ha) e Atividade.</li>
              <li><strong className="text-blue-600">Críticos:</strong> Topografia, Acesso e Capacidade do Solo.</li>
              <li><strong className="text-orange-500">Regra:</strong> Áreas rurais usam o "Fator de Dimensão" automático.</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-agro-700 border-b-2 border-agro-100 pb-2 mb-4 flex items-center gap-2">
            <span className="bg-agro-100 text-agro-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">02</span>
            Regras de Negócio (Equipe Interna)
          </h2>
          <div className="bg-agro-900 text-white p-6 rounded-xl space-y-4 shadow-lg">
            <div className="flex gap-4">
              <div className="font-black text-orange-500">A</div>
              <p className="text-sm italic">"Uma amostra com dados incompletos (sem topografia ou solo) gera um laudo menos preciso, pois o sistema não consegue aplicar os coeficientes de homogeneização da NBR."</p>
            </div>
            <div className="flex gap-4">
              <div className="font-black text-orange-500">B</div>
              <p className="text-sm italic">"Sempre que encontrar um anúncio de venda confirmado na região, cadastre-o no Dashboard. Isso reduz nossa dependência da busca via IA e aumenta a credibilidade do laudo."</p>
            </div>
            <div className="flex gap-4">
              <div className="font-black text-orange-500">C</div>
              <p className="text-sm italic">"O sistema aplica penalização automática de 12% para amostras de cidades vizinhas. No entanto, amostras locais (mesma cidade) têm peso máximo no cálculo."</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-agro-700 border-b-2 border-agro-100 pb-2 mb-4">Pós-Processamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 border rounded-lg">
              <div className="font-bold text-agro-700 mb-1">Revisão</div>
              <p className="text-xs text-gray-400">Ajuste os dados do imóvel avaliando sem perder as amostras encontradas.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="font-bold text-agro-700 mb-1">Impressão</div>
              <p className="text-xs text-gray-400">O laudo é otimizado para papel A4, incluindo papel timbrado e memória de cálculo.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="font-bold text-agro-700 mb-1">Homogeneização</div>
              <p className="text-xs text-gray-400">Os fatores de oferta e liquidação são aplicados conforme padrões da empresa.</p>
            </div>
          </div>
        </section>

        <div className="pt-8 border-t flex justify-center">
          <button 
            onClick={onBack}
            className="bg-agro-700 hover:bg-agro-900 text-white font-bold py-3 px-12 rounded-xl transition-all shadow-md"
          >
            Entendi, voltar para a Plataforma
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManual;

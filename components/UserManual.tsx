
import React from 'react';

interface UserManualProps {
  onBack: () => void;
}

const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in border border-gray-100">
      {/* Header Profissional */}
      <div className="bg-agro-900 p-10 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-4xl font-serif font-bold">Manual da Plataforma Bandeira Agro</h1>
          </div>
          <p className="opacity-90 text-lg max-w-2xl">
            Guia técnico completo para clientes e peritos internos. Aprenda a maximizar a precisão dos seus laudos através da excelência na entrada de dados.
          </p>
        </div>
      </div>

      <div className="p-8 md:p-12 space-y-20 text-gray-700">
        
        {/* GUIA DO CLIENTE */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <span className="bg-agro-700 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-lg text-xl">C</span>
            <div>
              <h2 className="text-3xl font-serif font-bold text-agro-900">Guia do Cliente / Usuário Final</h2>
              <p className="text-gray-500">Como emitir um laudo de alta precisão em minutos.</p>
            </div>
          </div>

          <div className="space-y-12">
            {/* Passo a Passo Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: "1", title: "Categoria", desc: "Escolha entre Urbano ou Rural no menu inicial." },
                { step: "2", title: "Localização", desc: "Informe a Cidade e Estado exatos para busca no banco." },
                { step: "3", title: "Atributos", desc: "Preencha as características físicas do seu imóvel." },
                { step: "4", title: "Geração", desc: "O sistema processa as amostras e gera o PDF." }
              ].map((item) => (
                <div key={item.step} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                  <div className="w-8 h-8 bg-agro-100 text-agro-700 rounded-full flex items-center justify-center mx-auto mb-4 font-black">{item.step}</div>
                  <h4 className="font-bold text-agro-900 mb-2">{item.title}</h4>
                  <p className="text-xs text-gray-500 leading-tight">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Checklist Detalhado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="border border-agro-100 rounded-3xl p-8 bg-white shadow-sm">
                <h3 className="text-xl font-bold text-agro-800 mb-6 flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                  Fluxo Urbano
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 mb-2 uppercase tracking-tighter">Obrigatórios</h4>
                    <ul className="text-sm space-y-2">
                      <li className="flex gap-2">✅ <span><strong>Cidade e Estado:</strong> Sem isso a busca não inicia.</span></li>
                      <li className="flex gap-2">✅ <span><strong>Bairro:</strong> Crucial para o fator de localização.</span></li>
                      <li className="flex gap-2">✅ <span><strong>Área Total (m²):</strong> Base para o valor unitário.</span></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-400 mb-2 uppercase tracking-tighter">Opcionais (Melhoram o Laudo)</h4>
                    <ul className="text-sm space-y-2 text-gray-500">
                      <li className="flex gap-2">🔹 <span>Quartos, Banheiros e Vagas (ajustam a comparação).</span></li>
                      <li className="flex gap-2">🔹 <span>Endereço Completo (ajuda a IA na busca por vizinhança).</span></li>
                      <li className="flex gap-2">🔹 <span>Estado de Conservação.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border border-agro-100 rounded-3xl p-8 bg-white shadow-sm">
                <h3 className="text-xl font-bold text-agro-800 mb-6 flex items-center gap-2">
                   <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                   Fluxo Rural
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 mb-2 uppercase tracking-tighter">Obrigatórios</h4>
                    <ul className="text-sm space-y-2">
                      <li className="flex gap-2">✅ <span><strong>Cidade e Estado:</strong> Filtro geográfico.</span></li>
                      <li className="flex gap-2">✅ <span><strong>Área Total (ha):</strong> Essencial para o Fator de Dimensão.</span></li>
                      <li className="flex gap-2">✅ <span><strong>Atividade:</strong> Ex: Lavoura, Pecuária, Mata.</span></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-agro-700 mb-2 uppercase tracking-tighter">Críticos (Determine o Valor!)</h4>
                    <ul className="text-sm space-y-2">
                      <li className="flex gap-2">🔥 <span><strong>Topografia e Solo:</strong> Mudam o valor em até 40%.</span></li>
                      <li className="flex gap-2">🔥 <span><strong>Acessibilidade:</strong> Impacto direto no escoamento.</span></li>
                      <li className="flex gap-2">🔥 <span><strong>Capacidade de Uso:</strong> Define o teto de produtividade.</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* GUIA DA EQUIPE INTERNA */}
        <section className="bg-agro-50 rounded-[40px] p-10 md:p-16 border border-agro-100">
          <div className="flex items-center gap-4 mb-8">
            <span className="bg-agro-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-lg text-xl">E</span>
            <div>
              <h2 className="text-3xl font-serif font-bold text-agro-900">Guia da Equipe Interna (Administrador)</h2>
              <p className="text-agro-700">A qualidade do laudo depende de você. Alimente a inteligência do banco.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <h3 className="text-lg font-bold text-agro-900">Passo a Passo para Inserção de Amostras:</h3>
              <ol className="space-y-6">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-agro-200 font-bold">1</span>
                  <p className="text-sm leading-snug"><strong>Extração via Link:</strong> Utilize o campo de importação por URL (Zap, OLX, etc) para carregar os dados base automaticamente. Isso reduz erros de digitação.</p>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-agro-200 font-bold">2</span>
                  <p className="text-sm leading-snug"><strong>Refino de Dados:</strong> Após importar, verifique se a área e o preço estão corretos. Muitas vezes anúncios rurais misturam valores de Alqueires com Hectares.</p>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-agro-200 font-bold">3</span>
                  <p className="text-sm leading-snug"><strong>Qualificação Técnica:</strong> Preencha os campos de topografia e solo mesmo que o anúncio original seja vago. Use seu conhecimento pericial para estimar ou investigar.</p>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-agro-200 font-bold">4</span>
                  <p className="text-sm leading-snug"><strong>Homogeneização:</strong> Lembre-se que o sistema usará estes dados para comparar com os imóveis dos clientes. Dados vazios geram laudos genéricos de "Grau I".</p>
                </li>
              </ol>
            </div>

            <div className="bg-agro-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
              <h3 className="text-xl font-bold mb-6 text-orange-500">Regras de Ouro da Curadoria:</h3>
              <ul className="space-y-4 text-sm opacity-90">
                <li className="border-b border-white/10 pb-4">
                  <strong>1. Prioridade absoluta para o Banco:</strong> O sistema sempre tentará usar nossos dados antes da IA. Se o banco estiver bem alimentado em uma região, a IA nunca será acionada, garantindo total controle sobre a média de mercado.
                </li>
                <li className="border-b border-white/10 pb-4">
                  <strong>2. Combate à Duplicidade:</strong> Amostras duplicadas (anúncios iguais em portais diferentes) poluem a estatística. Sempre verifique o banco antes de salvar.
                </li>
                <li className="border-b border-white/10 pb-4">
                  <strong>3. Georeferenciamento:</strong> Se a amostra for de uma cidade vizinha, o sistema aplicará 12% de desconto automaticamente. Não tente "enganar" o sistema colocando o bairro errado para evitar isso.
                </li>
                <li>
                  <strong>4. Data da Amostra:</strong> O mercado imobiliário é volátil. Reavalie o preço de amostras antigas (mais de 6 meses) no banco para manter a precisão.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SEÇÃO FINAL DE REVISÃO */}
        <div className="bg-gray-50 p-10 rounded-3xl text-center border border-dashed border-gray-300">
          <h2 className="text-2xl font-serif font-bold text-gray-800 mb-4">O que fazer após gerar o laudo?</h2>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div> Revisar atributos técnicos
            </span>
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div> Verificar memória de cálculo
            </span>
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div> Validar com o Dashboard Admin
            </span>
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div> Exportar PDF Profissional
            </span>
          </div>
        </div>

        {/* Botão de Retorno */}
        <div className="flex flex-col items-center pt-8">
          <button 
            onClick={onBack}
            className="group bg-agro-700 hover:bg-agro-900 text-white font-bold py-5 px-20 rounded-2xl transition-all shadow-2xl flex items-center gap-3"
          >
            Começar a Usar a Plataforma
            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <p className="mt-4 text-gray-400 text-xs font-bold uppercase tracking-widest">Bandeira Agro - Inteligência Imobiliária</p>
        </div>
      </div>
    </div>
  );
};

export default UserManual;

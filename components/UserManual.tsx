
import React from 'react';

interface UserManualProps {
  onBack: () => void;
}

const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
  return (
    <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in border border-gray-100">
      {/* Header do Manual */}
      <div className="bg-agro-900 p-10 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-serif font-bold">Manual de Inteligência Operacional</h1>
          <p className="opacity-90 mt-2 text-lg max-w-2xl">
            Entenda como a Bandeira Agro une a Norma NBR 14653 ao poder do Big Data e IA para gerar avaliações de alta precisão.
          </p>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <svg width="300" height="300" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50,85 C55,70 70,55 80,35 C75,45 65,50 55,55 C60,40 70,25 75,10 C65,20 55,30 50,45 C45,30 35,20 25,10 C30,25 40,40 45,55 C35,50 25,45 20,35 C30,55 45,70 50,85 Z" />
          </svg>
        </div>
      </div>

      <div className="p-8 md:p-12 space-y-16 text-gray-700 leading-relaxed">
        
        {/* SEÇÃO 01: O MOTOR DE BUSCA EM CASCATA */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <span className="bg-agro-700 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg">01</span>
            <h2 className="text-2xl font-serif font-bold text-agro-900">O Coração do Sistema: Busca em Cascata</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-agro-50 rounded-2xl border border-agro-100">
              <h3 className="font-bold text-agro-700 mb-2 uppercase text-xs tracking-widest">Nível 1: Banco Local</h3>
              <p className="text-sm">O sistema prioriza o <strong>nosso banco de dados proprietário</strong> filtrando amostras na mesma cidade. Estas têm peso 1.0 no cálculo (sem penalização).</p>
            </div>
            <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
              <h3 className="font-bold text-orange-700 mb-2 uppercase text-xs tracking-widest">Nível 2: Banco Regional</h3>
              <p className="text-sm">Se houver menos de 5 amostras locais, expandimos para <strong>cidades vizinhas no mesmo Estado</strong>, aplicando automaticamente o <em>Fator de Localização (0,88)</em>.</p>
            </div>
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
              <h3 className="font-bold text-blue-700 mb-2 uppercase text-xs tracking-widest">Nível 3: IA & Portais</h3>
              <p className="text-sm">Como último recurso, a IA varre portais (Zap, VivaReal) para completar o quórum, garantindo que nenhum laudo saia sem base estatística.</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gray-50 border-l-4 border-agro-500 rounded text-sm italic">
            <strong>Nota do Desenvolvedor:</strong> A precisão de um laudo é 40% maior quando utilizamos amostras do Nível 1. A alimentação do banco é a tarefa mais estratégica da equipe.
          </div>
        </section>

        {/* SEÇÃO 02: QUALIDADE DA INFORMAÇÃO X PRECISÃO DO LAUDO */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <span className="bg-agro-700 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg">02</span>
            <h2 className="text-2xl font-serif font-bold text-agro-900">Entrada de Dados e Resultados</h2>
          </div>
          <p className="mb-6">O sistema utiliza o <strong>Método Comparativo Direto de Dados de Mercado</strong>. Para isso, ele precisa comparar "maçãs com maçãs".</p>
          
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 border p-6 rounded-2xl">
                <h4 className="font-bold text-agro-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                  Dados de Alto Nível (Grau III)
                </h4>
                <p className="text-xs text-gray-500">Quando você preenche:</p>
                <ul className="text-xs list-disc pl-5 mt-2 space-y-1">
                  <li>Área Exata em Hectares (Rural) ou m² (Urbano)</li>
                  <li>Topografia, Acesso e Solo (Crucial para Rural)</li>
                  <li>Bairro e Conservação (Crucial para Urbano)</li>
                </ul>
                <div className="mt-4 p-2 bg-green-50 text-green-700 font-bold text-[10px] text-center rounded">RESULTADO: Erro Inferior a 5%</div>
              </div>

              <div className="flex-1 border p-6 rounded-2xl bg-gray-50 opacity-60">
                <h4 className="font-bold text-gray-400 mb-3 flex items-center gap-2">
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/></svg>
                  Dados Genéricos (Grau I)
                </h4>
                <p className="text-xs text-gray-400">Quando você deixa em branco atributos como solo, topografia ou acesso.</p>
                <div className="mt-4 p-2 bg-gray-200 text-gray-500 font-bold text-[10px] text-center rounded uppercase">RESULTADO: Estimativa de Baixa Precisão</div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 03: REGRAS PARA EQUIPE INTERNA (ADMIN) */}
        <section className="bg-agro-900 text-white p-10 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <span className="bg-orange-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg">03</span>
            <h2 className="text-2xl font-serif font-bold">Diretrizes para a Equipe Interna (Dashboard)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <h4 className="text-orange-500 font-bold uppercase text-xs mb-2">Higienização do Banco</h4>
                <p className="text-sm opacity-80 leading-relaxed">Não aceite duplicidade de URLs. Se um imóvel já estiver no banco, atualize o preço em vez de criar uma nova entrada. O sistema prioriza dados recentes.</p>
              </div>
              <div>
                <h4 className="text-orange-500 font-bold uppercase text-xs mb-2">Veracidade dos Links</h4>
                <p className="text-sm opacity-80 leading-relaxed">Sempre verifique se a área informada no anúncio condiz com a realidade. Erros de digitação em portais (ex: 1000ha em vez de 100ha) destroem a média estatística do laudo.</p>
              </div>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
              <h4 className="font-bold text-sm mb-4">Checklist de Cadastro de Amostra:</h4>
              <ul className="space-y-3 text-xs opacity-90">
                <li className="flex items-start gap-2">
                  <div className="w-4 h-4 mt-0.5 border rounded flex items-center justify-center border-orange-500 text-orange-500">✓</div>
                  <span>Tipo e Subtipo corretos (Ex: Lavoura vs Pasto)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-4 h-4 mt-0.5 border rounded flex items-center justify-center border-orange-500 text-orange-500">✓</div>
                  <span>Cidade e Estado (conferir se não é distrito)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-4 h-4 mt-0.5 border rounded flex items-center justify-center border-orange-500 text-orange-500">✓</div>
                  <span>Atributos de Solo e Acesso (mínimo obrigatório para Rural)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-4 h-4 mt-0.5 border rounded flex items-center justify-center border-orange-500 text-orange-500">✓</div>
                  <span>URL do Anúncio Original para auditoria futura</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SEÇÃO 04: PÓS-GERAÇÃO E LAUDO FINAL */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <span className="bg-agro-700 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg">04</span>
            <h2 className="text-2xl font-serif font-bold text-agro-900">Ações Pós-Geração</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="bg-gray-100 p-3 rounded-full h-fit">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </div>
              <div>
                <h4 className="font-bold text-gray-900">Revisão Iterativa</h4>
                <p className="text-sm text-gray-500 mt-1">Se o resultado parecer fora da realidade, revise os atributos do imóvel avaliando. Uma mudança na "Topografia" ou no "Acesso" pode alterar o laudo em até 25% através dos coeficientes de homogeneização.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-gray-100 p-3 rounded-full h-fit">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              </div>
              <div>
                <h4 className="font-bold text-gray-900">Emissão do PDF</h4>
                <p className="text-sm text-gray-500 mt-1">O laudo gerado é um documento profissional pronto para ser apresentado a bancos ou compradores. Ele contém a Memória de Cálculo detalhada, exigência legal para avaliações periciais.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer do Manual */}
        <div className="pt-12 border-t flex flex-col items-center gap-6">
          <p className="text-center text-sm text-gray-400 max-w-lg">
            A conformidade com estas regras garante que a <strong>BANDEIRA AGRO</strong> continue sendo a ferramenta de avaliação mais confiável do mercado agro brasileiro.
          </p>
          <button 
            onClick={onBack}
            className="bg-agro-700 hover:bg-agro-900 text-white font-bold py-4 px-16 rounded-2xl transition-all shadow-xl hover:shadow-agro-200"
          >
            Acessar a Plataforma Agora
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManual;

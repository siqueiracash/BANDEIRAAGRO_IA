
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import StepSelection from './components/StepSelection';
import StepForm from './components/StepForm';
import LoadingScreen from './components/LoadingScreen';
import ReportScreen from './components/ReportScreen';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import { AppStep, PropertyData, PropertyType, ValuationResult } from './types';
import { generateManualValuation, generateUrbanAutomatedValuation } from './services/valuationService';
import { INITIAL_PROPERTY_DATA } from './constants';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.SELECTION);
  const [propertyData, setPropertyData] = useState<PropertyData>(INITIAL_PROPERTY_DATA);
  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Verifica se o usuário já selecionou uma chave de API
  useEffect(() => {
    const checkKey = async () => {
      try {
        if ((window as any).aistudio) {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } else {
          setHasApiKey(!!process.env.API_KEY);
        }
      } catch (e) {
        setHasApiKey(!!process.env.API_KEY);
      }
    };
    checkKey();
  }, []);

  const handleActivateKey = async () => {
    try {
      if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
      }
    } finally {
      // Diretriz: Assumir sucesso após abrir o seletor e prosseguir
      setHasApiKey(true);
    }
  };

  const handleTypeSelect = (type: PropertyType) => {
    setPropertyData(prev => ({ ...prev, type }));
    setCurrentStep(AppStep.FORM);
  };

  const handleFormSubmit = async (data: PropertyData) => {
    setPropertyData(data);
    setCurrentStep(AppStep.LOADING);
    
    try {
      let result;
      if (data.type === PropertyType.RURAL) {
        result = await generateManualValuation(data);
      } else {
        result = await generateUrbanAutomatedValuation(data);
      }
      
      setValuationResult(result);
      setCurrentStep(AppStep.RESULT);
    } catch (error: any) {
      console.error("Valuation Error:", error);
      const msg = error.message || String(error);
      
      // Regra oficial de reset de chave:
      if (msg.includes("Requested entity was not found") || msg.includes("API key not found")) {
        setHasApiKey(false);
        setCurrentStep(AppStep.FORM);
        alert("A sessão da chave expirou ou a chave é inválida. Por favor, ative novamente.");
      } else if (msg.includes("AMOSTRAS_INSUFICIENTES")) {
        alert("Não encontramos dados suficientes nos portais para esta localização exata no momento. Tente um bairro maior ou cidade vizinha.");
        setCurrentStep(AppStep.FORM);
      } else {
        // Para qualquer outro erro (incluindo "API Key must be set"), mostramos o erro real para o usuário
        // e permitimos que ele tente novamente sem forçar o loop da tela verde,
        // a menos que ele decida voltar manualmente.
        alert(`Ocorreu um erro no processamento: ${msg}`);
        setCurrentStep(AppStep.FORM);
      }
    }
  };

  const handleReset = () => {
    setCurrentStep(AppStep.SELECTION);
    setPropertyData(INITIAL_PROPERTY_DATA);
    setValuationResult(null);
  };

  const handleReview = () => setCurrentStep(AppStep.FORM);
  const handleBackToSelection = () => {
    setCurrentStep(AppStep.SELECTION);
    setPropertyData(INITIAL_PROPERTY_DATA);
  };

  if (hasApiKey === null) return null;

  return (
    <Layout 
      onLoginClick={() => setCurrentStep(AppStep.LOGIN)} 
      showLoginButton={currentStep !== AppStep.DASHBOARD && currentStep !== AppStep.LOGIN}
    >
      {!hasApiKey ? (
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-10 text-center animate-fade-in border border-gray-100 mt-12">
          <div className="mb-8">
            <div className="w-20 h-20 bg-agro-50 rounded-full flex items-center justify-center mx-auto mb-4 text-agro-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h1 className="text-3xl font-serif font-bold text-agro-900 mb-2">Motor de IA Bandeira Agro</h1>
            <p className="text-gray-600">Para iniciar avaliações precisas (NBR 14653), ative a conexão com o processamento Gemini.</p>
          </div>
          <button 
            onClick={handleActivateKey}
            className="w-full bg-agro-700 hover:bg-agro-900 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            Ativar Engine de Inteligência
          </button>
          <p className="mt-4 text-xs text-gray-400">
            Requer uma chave de API do Google Cloud com faturamento ativo.
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="ml-1 underline">Saiba mais</a>
          </p>
        </div>
      ) : (
        <>
          {currentStep === AppStep.SELECTION && <StepSelection onSelect={handleTypeSelect} />}
          {currentStep === AppStep.FORM && (
            <StepForm 
              propertyType={propertyData.type} 
              initialData={propertyData}
              onSubmit={handleFormSubmit} 
              onBack={handleBackToSelection} 
            />
          )}
          {currentStep === AppStep.LOADING && <LoadingScreen />}
          {currentStep === AppStep.RESULT && valuationResult && (
            <ReportScreen 
              data={valuationResult} 
              property={propertyData} 
              onReset={handleReset} 
              onReview={handleReview}
            />
          )}
          {currentStep === AppStep.LOGIN && <LoginScreen onLoginSuccess={() => setCurrentStep(AppStep.DASHBOARD)} onBack={handleBackToSelection} />}
          {currentStep === AppStep.DASHBOARD && <AdminDashboard onLogout={handleReset} />}
        </>
      )}
    </Layout>
  );
};

export default App;


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
  const [isIAConfigured, setIsIAConfigured] = useState<boolean | null>(null);

  // Verifica se a chave de API está configurada no início
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsIAConfigured(hasKey);
      } else {
        // Se não estiver no ambiente AI Studio, assume que a chave está no process.env
        setIsIAConfigured(!!process.env.API_KEY);
      }
    };
    checkKey();
  }, []);

  const handleOpenIAConfig = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Conforme diretrizes, procedemos após o trigger mesmo com o delay de injeção
      setIsIAConfigured(true);
    }
  };

  const handleTypeSelect = (type: PropertyType) => {
    setPropertyData(prev => ({ ...prev, type }));
    setCurrentStep(AppStep.FORM);
  };

  const handleFormSubmit = async (data: PropertyData) => {
    // Verificação de segurança adicional
    if (!isIAConfigured && data.type === PropertyType.URBAN) {
      alert("A conexão com a Inteligência Artificial não foi configurada. Por favor, habilite a conexão no menu superior.");
      return;
    }

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
      console.error(error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      
      // Se a chave for inválida ou não encontrada, resetamos o estado para pedir nova seleção
      if (msg.includes("Requested entity was not found") || msg.includes("API_KEY") || msg.includes("403")) {
        setIsIAConfigured(false);
        alert(
          "ERRO DE CONEXÃO IA\n\n" +
          "A chave de API selecionada é inválida ou expirou. Por favor, selecione uma chave de um projeto GCP pago."
        );
      } else if (msg.includes("AMOSTRAS_INSUFICIENTES")) {
        alert("Não encontramos amostras suficientes para uma avaliação segura neste local.");
      } else {
        alert(`Erro ao processar a avaliação: ${msg}`);
      }
      
      setCurrentStep(AppStep.FORM);
    }
  };

  const handleBackToSelection = () => {
    setCurrentStep(AppStep.SELECTION);
    setPropertyData(INITIAL_PROPERTY_DATA);
  };

  const handleReview = () => {
    setCurrentStep(AppStep.FORM);
  };

  const handleReset = () => {
    setCurrentStep(AppStep.SELECTION);
    setPropertyData(INITIAL_PROPERTY_DATA);
    setValuationResult(null);
  };

  const handleLoginSuccess = () => {
    setCurrentStep(AppStep.DASHBOARD);
  };

  return (
    <Layout 
      onLoginClick={() => setCurrentStep(AppStep.LOGIN)} 
      showLoginButton={currentStep !== AppStep.DASHBOARD && currentStep !== AppStep.LOGIN}
    >
      {/* Banner de Configuração de Chave (Apenas se não configurado) */}
      {isIAConfigured === false && currentStep !== AppStep.LOGIN && (
        <div className="w-full mb-8 bg-orange-50 border-2 border-orange-200 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 text-white p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-orange-900 text-sm">Conexão IA Pendente</p>
              <p className="text-xs text-orange-700">Para gerar laudos automáticos, é necessário selecionar uma chave de API ativa.</p>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] text-orange-600 underline hover:text-orange-800">Ver documentação de faturamento do Google Cloud</a>
            </div>
          </div>
          <button 
            onClick={handleOpenIAConfig}
            className="whitespace-nowrap bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            Habilitar Inteligência Artificial
          </button>
        </div>
      )}

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
      
      {currentStep === AppStep.LOGIN && <LoginScreen onLoginSuccess={handleLoginSuccess} onBack={handleBackToSelection} />}
      {currentStep === AppStep.DASHBOARD && <AdminDashboard onLogout={handleReset} />}
    </Layout>
  );
};

export default App;

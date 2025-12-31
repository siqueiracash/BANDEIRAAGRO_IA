
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import StepSelection from './components/StepSelection';
import StepForm from './components/StepForm';
import LoadingScreen from './components/LoadingScreen';
import ReportScreen from './components/ReportScreen';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import ApiKeySetup from './components/ApiKeySetup';
import { AppStep, PropertyData, PropertyType, ValuationResult } from './types';
import { generateManualValuation, generateUrbanAutomatedValuation } from './services/valuationService';
import { INITIAL_PROPERTY_DATA } from './constants';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.SELECTION);
  const [propertyData, setPropertyData] = useState<PropertyData>(INITIAL_PROPERTY_DATA);
  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Verificação inicial de chave silenciosa
  useEffect(() => {
    const checkKey = async () => {
      try {
        if ((window as any).aistudio) {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } else {
          // Em Vercel/Standalone, se a env existir, consideramos como ok
          setHasApiKey(!!process.env.API_KEY);
        }
      } catch (e) {
        setHasApiKey(false);
      }
    };
    checkKey();
  }, []);

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
      
      // MUDANÇA CRUCIAL: Só resetamos o estado da chave se for um erro fatal de autenticação.
      // Erros de busca, rede ou amostras não devem voltar para a tela verde.
      const isAuthError = 
        msg.includes("Requested entity was not found") || 
        msg.includes("API_KEY_REQUIRED") || 
        msg.includes("401") || 
        msg.includes("403");

      if (isAuthError) {
        setHasApiKey(false);
        setCurrentStep(AppStep.FORM);
        alert("Sua conexão de IA expirou ou a chave é inválida. Por favor, reative a Engine.");
      } else if (msg.includes("AMOSTRAS_INSUFICIENTES")) {
        alert("A IA não localizou amostras suficientes nesta região exata. Tente ampliar a área de busca ou mudar o bairro.");
        setCurrentStep(AppStep.FORM);
      } else {
        // Erro genérico mantém o usuário no formulário
        alert(`Ocorreu um problema no processamento: ${msg}`);
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

  // Se estiver verificando a chave, não renderiza nada para evitar "flicker"
  if (hasApiKey === null) return null;

  return (
    <Layout 
      onLoginClick={() => setCurrentStep(AppStep.LOGIN)} 
      showLoginButton={currentStep !== AppStep.DASHBOARD && currentStep !== AppStep.LOGIN}
    >
      {!hasApiKey ? (
        <ApiKeySetup onConfigured={() => setHasApiKey(true)} />
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
          {currentStep === AppStep.LOGIN && (
            <LoginScreen 
              onLoginSuccess={() => setCurrentStep(AppStep.DASHBOARD)} 
              onBack={handleBackToSelection} 
            />
          )}
          {currentStep === AppStep.DASHBOARD && <AdminDashboard onLogout={handleReset} />}
        </>
      )}
    </Layout>
  );
};

export default App;

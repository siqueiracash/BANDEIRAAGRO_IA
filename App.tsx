
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
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.SETUP);
  const [propertyData, setPropertyData] = useState<PropertyData>(INITIAL_PROPERTY_DATA);
  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);

  // Verifica se a chave de API é válida
  const isKeyValid = () => {
    const key = process.env.API_KEY;
    return typeof key === 'string' && key.length > 5 && key !== 'undefined';
  };

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    // 1. Se a chave já estiver injetada e for válida, pula o setup
    if (isKeyValid()) {
      setCurrentStep(AppStep.SELECTION);
      return;
    }

    // 2. Se estiver no ambiente de IA Studio, verifica se já selecionou
    if (window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) {
          setCurrentStep(AppStep.SELECTION);
        } else {
          setCurrentStep(AppStep.SETUP);
        }
      } catch (e) {
        setCurrentStep(AppStep.SETUP);
      }
    } else {
      // Caso fora do AI Studio e sem chave, obriga o setup
      setCurrentStep(AppStep.SETUP);
    }
  };

  const handleStart = () => {
    // Após clicar em ativar, dá um tempo pequeno para o ambiente injetar a chave
    setTimeout(() => {
      setCurrentStep(AppStep.SELECTION);
    }, 500);
  };

  const handleTypeSelect = (type: PropertyType) => {
    setPropertyData(prev => ({ ...prev, type }));
    setCurrentStep(AppStep.FORM);
  };

  const handleFormSubmit = async (data: PropertyData) => {
    // Verificação de última hora
    if (!isKeyValid()) {
      alert("Chave de API não detectada. Por favor, ative o motor de IA.");
      setCurrentStep(AppStep.SETUP);
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
      console.error("Valuation Error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      
      if (msg.includes("AUTH_REQUIRED") || msg.includes("API Key") || msg.includes("not found")) {
        alert("Sua conexão com o motor de IA expirou ou é inválida. Vamos reativar.");
        setCurrentStep(AppStep.SETUP);
      } else if (msg.includes("AMOSTRAS_INSUFICIENTES")) {
        alert("Não encontramos amostras suficientes. Tente outro bairro ou cidade.");
        setCurrentStep(AppStep.FORM);
      } else {
        alert(`Erro técnico: ${msg}`);
        setCurrentStep(AppStep.FORM);
      }
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
      showLoginButton={currentStep !== AppStep.DASHBOARD && currentStep !== AppStep.LOGIN && currentStep !== AppStep.SETUP}
    >
      {currentStep === AppStep.SETUP && <ApiKeySetup onConfigured={handleStart} />}
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

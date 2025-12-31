
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

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    // 1. Verifica se a chave já está disponível no process.env (Vercel ou similar)
    if (process.env.API_KEY && process.env.API_KEY !== 'undefined' && process.env.API_KEY !== '') {
      setCurrentStep(AppStep.SELECTION);
      return;
    }

    // 2. Verifica via helper do AI Studio
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
      // Caso fora do AI Studio e sem chave, levamos para a seleção esperando que a chave apareça ou falhe graciosamente
      setCurrentStep(AppStep.SELECTION);
    }
  };

  const handleStart = () => {
    setCurrentStep(AppStep.SELECTION);
  };

  const handleTypeSelect = (type: PropertyType) => {
    setPropertyData(prev => ({ ...prev, type }));
    setCurrentStep(AppStep.FORM);
  };

  const handleFormSubmit = async (data: PropertyData) => {
    setPropertyData(data);
    setCurrentStep(AppStep.LOADING);
    
    try {
      // Verificação de segurança pré-vôo
      if (!process.env.API_KEY && window.aistudio) {
         const hasKey = await window.aistudio.hasSelectedApiKey();
         if (!hasKey) {
           throw new Error("AUTH_REQUIRED");
         }
      }

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
      
      // Tratamento de Erros de Autenticação / Chave
      if (msg.includes("Requested entity was not found") || 
          msg.includes("API_KEY_INVALID") || 
          msg.includes("AUTH_REQUIRED") ||
          msg.includes("API key not found")) {
        alert("Sua conexão com o motor de IA precisa ser renovada. Por favor, ative sua chave novamente.");
        setCurrentStep(AppStep.SETUP);
      } else if (msg.includes("AMOSTRAS_INSUFICIENTES")) {
        alert("Não encontramos amostras suficientes para uma avaliação segura neste local. Tente outro bairro ou cidade.");
        setCurrentStep(AppStep.FORM);
      } else {
        alert(`Ocorreu um problema técnico: ${msg}`);
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

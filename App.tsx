
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

  useEffect(() => {
    const checkKey = async () => {
      // Se estivermos no Vercel (hostname sem 'localhost' e sem aistudio), 
      // assumimos que o servidor tem a chave.
      const isAistudio = !!(window as any).aistudio;
      
      if (isAistudio) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Em produção, a "chave" é a existência da nossa própria API interna
        setHasApiKey(true); 
      }
    };
    checkKey();
  }, []);

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
      console.error("Erro na Requisição:", error);
      const msg = error.message || String(error);
      
      if (msg.includes("API_KEY_MISSING_ON_SERVER")) {
        alert("Erro de Configuração: A chave API_KEY não foi encontrada no servidor Vercel. Adicione-a nas Environment Variables do projeto.");
      } else {
        alert(`Ocorreu um problema: ${msg}`);
      }
      setCurrentStep(AppStep.FORM);
    }
  };

  // Add handleTypeSelect to fix "Cannot find name 'handleTypeSelect'" error
  const handleTypeSelect = (type: PropertyType) => {
    setPropertyData({ ...INITIAL_PROPERTY_DATA, type });
    setCurrentStep(AppStep.FORM);
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

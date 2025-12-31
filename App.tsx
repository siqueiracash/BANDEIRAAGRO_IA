
import React, { useState } from 'react';
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

  const handleTypeSelect = (type: PropertyType) => {
    setPropertyData(prev => ({ ...prev, type }));
    setCurrentStep(AppStep.FORM);
  };

  const handleFormSubmit = async (data: PropertyData) => {
    setPropertyData(data);
    setCurrentStep(AppStep.LOADING);
    
    try {
      let result;
      // RURAL -> BANCO DE DADOS + BUSCA REGIONAL
      if (data.type === PropertyType.RURAL) {
        result = await generateManualValuation(data);
      } 
      // URBANO -> INTELIGÊNCIA ARTIFICIAL (WEB SEARCH GROUNDING)
      else {
        result = await generateUrbanAutomatedValuation(data);
      }
      
      setValuationResult(result);
      setCurrentStep(AppStep.RESULT);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      
      if (msg.includes("API_KEY") || msg.includes("403") || msg.includes("401")) {
        alert(
          "ERRO DE AUTENTICAÇÃO\n\n" +
          "Não foi possível conectar aos serviços de inteligência artificial da Bandeira Agro."
        );
      } else if (msg.includes("AMOSTRAS_INSUFICIENTES")) {
        alert(
          "AVALIAÇÃO INTERROMPIDA: MERCADO ESCASSO\n\n" +
          "Não encontramos pelo menos 3 amostras válidas no bairro informado para realizar uma análise segura.\n\n" +
          "DICAS PARA RESOLVER:\n" +
          "1. Tente informar um BAIRRO vizinho mais popular.\n" +
          "2. Verifique se o tipo de imóvel (ex: Prédio Comercial) possui ofertas online na região.\n" +
          "3. Se você tiver um link de anúncio, use a área restrita para importar manualmente."
        );
      } else {
        alert(`Erro ao processar a avaliação: ${msg}\n\nTente novamente.`);
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

  const handleLogout = () => {
    handleBackToSelection();
  };

  return (
    <Layout 
      onLoginClick={() => setCurrentStep(AppStep.LOGIN)} 
      showLoginButton={currentStep !== AppStep.DASHBOARD && currentStep !== AppStep.LOGIN}
    >
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
      {currentStep === AppStep.DASHBOARD && <AdminDashboard onLogout={handleLogout} />}
    </Layout>
  );
};

export default App;

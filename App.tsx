
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
      // RURAL -> BANCO DE DADOS
      if (data.type === PropertyType.RURAL) {
        result = await generateManualValuation(data);
      } 
      // URBANO -> INTELIGÊNCIA ARTIFICIAL (WEB SEARCH)
      else {
        result = await generateUrbanAutomatedValuation(data);
      }
      
      setValuationResult(result);
      setCurrentStep(AppStep.RESULT);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      
      if (msg.includes("API_KEY_MISSING")) {
        alert(
          "ERRO DE CONFIGURAÇÃO DA CHAVE API\n\n" +
          "O sistema não conseguiu ler a Chave de API das variáveis de ambiente (comum em deploys estáticos).\n\n" +
          "SOLUÇÃO RÁPIDA (FAÇA ISSO AGORA):\n" +
          "1. Pressione F12 para abrir o Console do navegador.\n" +
          "2. Digite ou cole o comando abaixo e aperte Enter:\n\n" +
          "localStorage.setItem('bandeira_agro_api_key', 'SUA-CHAVE-AQUI')\n\n" +
          "3. Substitua 'SUA-CHAVE-AQUI' pela sua chave real AIza...\n" +
          "4. Recarregue a página e tente novamente."
        );
      } else {
        alert(`Erro ao processar a avaliação: ${msg}\n\nTente novamente ou verifique os dados de entrada.`);
      }
      
      setCurrentStep(AppStep.FORM);
    }
  };

  const handleBackToSelection = () => {
    setCurrentStep(AppStep.SELECTION);
    setPropertyData(INITIAL_PROPERTY_DATA);
  };

  const handleReview = () => {
    // Retorna para o formulário mantendo os dados atuais
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
      
      {/* Telas Administrativas */}
      {currentStep === AppStep.LOGIN && <LoginScreen onLoginSuccess={handleLoginSuccess} onBack={handleBackToSelection} />}
      {currentStep === AppStep.DASHBOARD && <AdminDashboard onLogout={handleLogout} />}
    </Layout>
  );
};

export default App;

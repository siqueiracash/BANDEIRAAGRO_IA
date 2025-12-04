
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
          "CONFIGURAÇÃO DE API NECESSÁRIA\n\n" +
          "O sistema não encontrou a chave da API. Se você configurou na Vercel:\n" +
          "1. Ignore o aviso amarelo 'This key... might expose sensitive information' na Vercel. Ele é normal.\n" +
          "2. Certifique-se que o nome da variável é VITE_API_KEY.\n" +
          "3. Faça um novo Deploy no painel da Vercel para aplicar a mudança.\n\n" +
          "SOLUÇÃO PALIATIVA (Se precisar usar AGORA):\n" +
          "Abra o Console (F12) e digite:\n" +
          "localStorage.setItem('bandeira_agro_api_key', 'SUA-CHAVE-AQUI')"
        );
      } else if (msg.includes("INVALID_KEY_FORMAT")) {
        alert(
            "CHAVE DE API INVÁLIDA\n\n" +
            "A chave que você está usando NÃO é do Gemini/AI Studio. Você provavelmente pegou uma chave do Vertex AI ou Service Account (começando com AQ...).\n\n" +
            "SOLUÇÃO:\n" +
            "1. Acesse https://aistudiocdn.com/app/apikey\n" +
            "2. Crie uma nova chave. Ela DEVE começar com 'AIza'.\n" +
            "3. Atualize a Vercel com essa nova chave."
        );
      } else if (msg.includes("API_KEY_RESTRICTION") || msg.includes("403")) {
        alert(
          "BLOQUEIO DE SEGURANÇA (ERRO 403)\n\n" +
          "Você restringiu a Chave de API para 'Sites da Web', mas esqueceu de adicionar este domínio.\n\n" +
          "SOLUÇÃO:\n" +
          "1. Vá no Google Cloud Console > Credenciais > Sua Chave.\n" +
          "2. Em 'Restrições de sites', adicione:\n" +
          "   https://bandeiraagro-ia.vercel.app/*\n" +
          "3. Salve e aguarde 2 minutos."
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

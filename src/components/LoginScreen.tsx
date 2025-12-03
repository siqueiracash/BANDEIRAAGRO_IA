import React, { useState } from 'react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onBack }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Normaliza o usuário para minúsculas
    const username = user.trim().toLowerCase();
    
    // Credenciais atualizadas conforme solicitação
    const isValidUser = username === 'admin@bandeiraagro.com.br';
    const isValidPass = pass === 'abcd1234';

    if (isValidUser && isValidPass) {
      onLoginSuccess();
    } else {
      setError('Credenciais inválidas. Verifique o e-mail e a senha.');
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 animate-fade-in mt-10">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-agro-900">Acesso Equipe</h2>
        <p className="text-sm text-gray-500">Gestão de Amostras de Mercado</p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">E-mail Corporativo</label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-agro-500 outline-none transition-all" 
            type="text" 
            value={user} 
            onChange={e => setUser(e.target.value)} 
            placeholder="admin@bandeiraagro.com.br"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
          <input 
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-agro-500 outline-none transition-all" 
            type="password" 
            value={pass} 
            onChange={e => setPass(e.target.value)} 
            placeholder="••••••••"
          />
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 text-center font-medium">
            {error}
          </div>
        )}

        <button 
          type="submit" 
          className="w-full bg-agro-700 text-white font-bold py-3 rounded-lg hover:bg-agro-800 transition-colors shadow-md"
        >
          Entrar no Dashboard
        </button>
      </form>
      
      <button 
        onClick={onBack} 
        className="w-full mt-6 text-sm text-gray-500 hover:text-agro-700 hover:underline"
      >
        Voltar para Avaliação Pública
      </button>
    </div>
  );
};

export default LoginScreen;
import { useEffect, useState } from 'react';
import { api } from './api/axios';

interface ApiResponse {
  message: string;
}

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get<ApiResponse>('/').then((res) => setMessage(res.data.message));
  }, []);

  return <div>{message}</div>;
}

export default App;
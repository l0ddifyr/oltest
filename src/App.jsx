import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Results from './pages/Results';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { background: '#333', color: '#fff' } }} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </>
  );
}

export default App;

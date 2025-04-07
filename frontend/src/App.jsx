import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SwordsMan from './page/SwordsMan';
import './App.css';
import Landing from './page/Landing';

// Import any other pages you might need
// import Dashboard from './pages/Dashboard';
// import Settings from './pages/Settings';
// import Login from './pages/Login';

function App() {
  return (
    <Router>
      <Routes>
        {/* Set SwordsMan as the default page */}
        <Route path="/" element={<Landing/>} />

        <Route path="/swordsman" element={<SwordsMan />} />
        
      </Routes>
    </Router>
  );
}

export default App;
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import AdminSetup from './pages/AdminSetup';
import AdminAccounts from './pages/AdminAccounts';
import AdminLedger from './pages/AdminLedger';
import AdminActions from './pages/AdminActions';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/setup" element={<AdminSetup />} />
        <Route path="/admin/accounts" element={<AdminAccounts />} />
        <Route path="/admin/ledger" element={<AdminLedger />} />
        <Route path="/admin/actions" element={<AdminActions />} />
      </Routes>
    </BrowserRouter>
  );
}

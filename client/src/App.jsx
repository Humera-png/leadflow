import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Leads from "./pages/Leads.jsx";
import LeadDetail from "./pages/LeadDetail.jsx";
import Templates from "./pages/Templates.jsx";
import Calendar from "./pages/Calendar.jsx";
import Analytics from "./pages/Analytics.jsx";
import CapturePage from "./pages/CapturePage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public, no sidebar — embeddable via iframe on an external site. */}
        <Route path="capture" element={<CapturePage />} />

        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="templates" element={<Templates />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

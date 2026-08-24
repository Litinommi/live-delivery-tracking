import { Route, Routes } from "react-router-dom";
import { CustomerPage } from "./pages/CustomerPage";
import { MobilePage } from "./pages/MobilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerPage />} />
      <Route path="/mobile" element={<MobilePage />} />
    </Routes>
  );
}

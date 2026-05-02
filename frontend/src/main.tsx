import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import AnalystPage    from "./pages/AnalystPage";
import DataPage       from "./pages/DataPage";
import SQLPage        from "./pages/SQLPage";
import DashboardPage  from "./pages/DashboardPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index          element={<AnalystPage />} />
          <Route path="data"    element={<DataPage />} />
          <Route path="sql"     element={<SQLPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

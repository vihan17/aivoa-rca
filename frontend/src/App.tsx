import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastHost } from "./components/ui";
import { api } from "./lib/api";
import Dashboard from "./pages/Dashboard";
import Workspace from "./pages/Workspace";
import { copilotActions } from "./store/copilotSlice";
import { useAppDispatch } from "./store/hooks";

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    api
      .options()
      .then((options) => dispatch(copilotActions.setProvider(options.ai)))
      .catch(() => {
        /* the copilot shows an offline badge until metadata is available */
      });
    api
      .samples()
      .then((response) => dispatch(copilotActions.setSamples(response.items)))
      .catch(() => {
        /* samples are optional */
      });
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<Workspace />} />
        <Route path="/investigations/:id" element={<Workspace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </BrowserRouter>
  );
}

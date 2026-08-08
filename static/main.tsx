import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import StudyApp, { RemoteLogin } from "../app/study/StudyApp";
import "../app/globals.css";

const root = createRoot(document.getElementById("root")!);
const renderApp = () => root.render(<StrictMode><StudyApp /></StrictMode>);

fetch("/api/state", { credentials: "include" })
  .then((response) => {
    if (response.status !== 401) renderApp();
    else root.render(<RemoteLogin onLogin={renderApp} />);
  })
  .catch(renderApp);

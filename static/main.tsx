import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import UnitStudyApp from "../app/study/unit-modules/UnitStudyApp";
import "../app/globals.css";
import "../app/study/unit-modules/unit-study.css";

const root = createRoot(document.getElementById("root")!);
const renderApp = () => root.render(<StrictMode><UnitStudyApp /></StrictMode>);

fetch("/api/state", { credentials: "include" })
  .then((response) => {
    if (response.status !== 401) renderApp();
    else renderApp();
  })
  .catch(renderApp);

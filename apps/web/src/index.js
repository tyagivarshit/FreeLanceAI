import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
let container = document.getElementById("root");
if (!container) {
    container = document.createElement("div");
    container.id = "root";
    document.body.prepend(container);
}
document.body.classList.add("react-app-mounted");
const root = createRoot(container);
root.render(<React.StrictMode>
    <App />
  </React.StrictMode>);

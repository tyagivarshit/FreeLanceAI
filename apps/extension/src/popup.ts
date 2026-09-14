import { ExtensionMessageClient } from "./messaging/client.js";
import { SessionStorageManager } from "./storage/session.js";

/* eslint-disable no-console */
console.log("Action popup initialized.");

document.addEventListener("DOMContentLoaded", async () => {
  const authorizeBtn = document.getElementById("authorizeBtn");
  const statusDiv = document.getElementById("status");
  const client = new ExtensionMessageClient();

  try {
    const session = await SessionStorageManager.getAuthSession();
    if (session && session.token) {
      if (authorizeBtn) authorizeBtn.style.display = 'none';
      if (statusDiv) statusDiv.textContent = "Authorized successfully!";
      return; // Stop initialization, we are authorized
    }
  } catch (e) {
    // Fail closed quietly
    console.log("Auth session check failed");
  }

  // Unauthorized state
  if (authorizeBtn) {
    authorizeBtn.style.display = 'block'; // Ensure it is visible
    authorizeBtn.addEventListener("click", () => {
      if (statusDiv) statusDiv.textContent = "Authorizing...";
      console.log("[AUTH_TRACE] popup send started");
      
      client.request("AUTHORIZE_EXTENSION", {}).then((response: any) => {
        if (response && response.success) {
          if (statusDiv) statusDiv.textContent = "Authorized successfully!";
          if (authorizeBtn) authorizeBtn.style.display = 'none';
        } else {
          if (statusDiv) statusDiv.textContent = "Failed: " + (response?.error || "Unknown error");
        }
      }).catch((err) => {
        if (statusDiv) statusDiv.textContent = "Error: " + err.message;
      });
    });
  }
});

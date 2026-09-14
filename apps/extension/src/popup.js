/* eslint-disable no-console */
console.log("Action popup initialized.");
document.addEventListener("DOMContentLoaded", () => {
    const authorizeBtn = document.getElementById("authorizeBtn");
    const statusDiv = document.getElementById("status");
    if (authorizeBtn) {
        authorizeBtn.addEventListener("click", () => {
            if (statusDiv)
                statusDiv.textContent = "Authorizing...";
            chrome.runtime.sendMessage({ type: "AUTHORIZE_EXTENSION" }, (response) => {
                if (chrome.runtime.lastError) {
                    if (statusDiv)
                        statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
                    return;
                }
                if (response && response.success) {
                    if (statusDiv)
                        statusDiv.textContent = "Authorized successfully!";
                }
                else {
                    if (statusDiv)
                        statusDiv.textContent = "Failed: " + (response?.error || "Unknown error");
                }
            });
        });
    }
});
export {};

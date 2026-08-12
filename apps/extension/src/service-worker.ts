/* eslint-disable no-console */
// Chrome Extension Background Service Worker (Manifest V3)
// Reference to Chrome types is enabled via @types/chrome devDependency.

chrome.runtime.onInstalled.addListener(() => {
  console.log("FreelanceOS Job Matcher Chrome Extension foundation established.");
});

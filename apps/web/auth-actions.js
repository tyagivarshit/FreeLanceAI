/**
 * Shared Authentication Actions for the FreelanceOS Frontend UI.
 * Exposes reusable, transport-independent API actions.
 */
window.authActions = {
  /**
   * Triggers the single-session or global device logout action.
   */
  async logout({ global = false } = {}) {
    const response = await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ global }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Logout failed");
    }
    return data;
  },
};

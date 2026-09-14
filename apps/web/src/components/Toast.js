import React from "react";
export const Toast = ({ toast }) => {
    if (!toast.visible)
        return null;
    return (<div id="toast-container" className="toast-container" role="status" aria-live="polite">
      <div id="toast-item" className={`toast ${toast.isError ? "toast-error" : "toast-success"}`}>
        <span id="toast-msg">{toast.message}</span>
      </div>
    </div>);
};

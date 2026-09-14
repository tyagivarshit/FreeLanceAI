import React from "react";
export const ProgressBar = ({ value, max = 100, label, variant = "primary", className = "", }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (<div className={`progress-track ${className}`.trim()} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={`progress-fill progress-${variant}`} style={{ width: `${percentage}%` }}/>
    </div>);
};

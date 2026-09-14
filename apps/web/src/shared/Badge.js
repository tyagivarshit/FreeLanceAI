import React from "react";
export const Badge = ({ variant = "primary", children, className = "" }) => {
    const variantClass = `badge-${variant}`;
    return <span className={`badge ${variantClass} ${className}`.trim()}>{children}</span>;
};

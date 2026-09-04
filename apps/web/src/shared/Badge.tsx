import React from "react";

export interface BadgeProps {
  variant?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "neutral"
    | "info"
    | "high"
    | "medium"
    | "low"
    | "trial";
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = "primary", children, className = "" }) => {
  const variantClass = `badge-${variant}`;

  return <span className={`badge ${variantClass} ${className}`.trim()}>{children}</span>;
};

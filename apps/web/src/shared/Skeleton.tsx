import React from "react";

export interface SkeletonProps {
  id?: string;
  className?: string;
  variant?: "text" | "card" | "row" | "avatar";
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  id,
  className = "",
  variant = "text",
  style,
}) => {
  const variantClass = {
    text: "skeleton-text",
    card: "skeleton-card",
    row: "skeleton-row",
    avatar: "skeleton-avatar",
  }[variant];

  return (
    <div
      id={id}
      className={`progressive-skeleton ${variantClass} ${className}`.trim()}
      style={style}
    />
  );
};

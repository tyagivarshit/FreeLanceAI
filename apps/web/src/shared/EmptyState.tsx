import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className="empty-icon-wrap" aria-hidden="true">
        {icon || (
          <svg className="icon" viewBox="0 0 24 24" width="40" height="40">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        )}
      </div>
      <h3 className="empty-title font-display">{title}</h3>
      <p className="empty-desc">{description}</p>
      {action && <div className="empty-actions">{action}</div>}
    </div>
  );
};

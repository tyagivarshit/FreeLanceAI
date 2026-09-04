import React from "react";

export interface ErrorAlertProps {
  title?: string;
  message?: string;
  errors?: string[];
  onRetry?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title = "Error",
  message,
  errors = [],
  onRetry,
  className = "",
}) => {
  return (
    <div className={`error-alert card-like-error ${className}`.trim()} role="alert">
      <div className="error-details-row">
        <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        <div className="error-content">
          <h4 className="error-title">{title}</h4>
          {message && <p className="error-desc">{message}</p>}
          {errors.length > 0 && (
            <ul className="error-list">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm btn-retry" onClick={onRetry} type="button">
          Retry
        </button>
      )}
    </div>
  );
};

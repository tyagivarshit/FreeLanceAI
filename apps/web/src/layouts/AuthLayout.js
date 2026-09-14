import React from "react";
export const AuthLayout = ({ title, subtitle, children }) => {
    return (<div className="signup-container auth-page-wrapper">
      <div className="signup-card">
        <div className="header">
          <div className="logo" aria-hidden="true">
            F
          </div>
          <h1 className="auth-card-title">{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>);
};

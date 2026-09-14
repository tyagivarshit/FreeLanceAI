import React from "react";
export const Button = ({ variant = "primary", size = "md", loading = false, block = false, icon, children, className = "", disabled, ...props }) => {
    const variantClass = {
        primary: "btn-primary",
        secondary: "btn-secondary",
        danger: "btn-danger",
        "danger-outline": "btn-danger-outline",
        outline: "btn-outline",
        ghost: "btn-ghost",
    }[variant];
    const sizeClass = {
        sm: "btn-sm",
        md: "btn-md",
        lg: "btn-lg",
    }[size];
    const blockClass = block ? "btn-block" : "";
    return (<button className={`btn ${variantClass} ${sizeClass} ${blockClass} ${className}`.trim()} disabled={disabled || loading} {...props}>
      {loading ? (<>
          <span className="spinner" aria-hidden="true"/>
          <span>{children}</span>
        </>) : (<>
          {icon && (<span className="btn-icon" aria-hidden="true">
              {icon}
            </span>)}
          {children}
        </>)}
    </button>);
};

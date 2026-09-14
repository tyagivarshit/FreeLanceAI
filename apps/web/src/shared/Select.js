import React from "react";
export const Select = ({ label, options, hint, error, id, className = "", ...props }) => {
    const selectId = id || props.name;
    return (<div className="form-group">
      {label && (<label htmlFor={selectId} className="form-label">
          {label}
        </label>)}
      <select id={selectId} className={`form-select ${className}`.trim()} {...props}>
        {options.map((opt) => (<option key={opt.value} value={opt.value}>
            {opt.label}
          </option>))}
      </select>
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && (<span className="form-error" role="alert">
          {error}
        </span>)}
    </div>);
};

import React from "react";
import { useAuth } from "../hooks/useAuth.js";
export const Topbar = ({ breadcrumbTitle, parentBreadcrumb, onOpenMobileMenu, actions, }) => {
    const { user } = useAuth();
    const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";
    return (<header className="topbar" aria-label="Top bar nav">
      <div className="topbar-left">
        <button id="mobile-drawer-toggle" className="mobile-menu-btn" aria-label="Open mobile navigation" onClick={onOpenMobileMenu}>
          <svg className="icon" viewBox="0 0 24 24" width="24" height="24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <span className="breadcrumb-item">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          {parentBreadcrumb && (<>
              <a href={parentBreadcrumb.href} className="breadcrumb-item breadcrumb-link">
                {parentBreadcrumb.label}
              </a>
              <span className="breadcrumb-separator">/</span>
            </>)}
          <span className="breadcrumb-item active">{breadcrumbTitle}</span>
        </nav>
      </div>

      <div className="topbar-right">
        {actions}
        <a href="/search.html" className="topbar-action-btn" aria-label="Search items">
          <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </a>

        <div className="account-menu">
          <div className="user-avatar" id="user-avatar-initials">
            {userInitial}
          </div>
        </div>
      </div>
    </header>);
};

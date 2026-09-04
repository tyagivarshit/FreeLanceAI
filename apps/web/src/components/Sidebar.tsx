import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.js";

export interface SidebarProps {
  currentPath: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, isMobileOpen, onCloseMobile }) => {
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const navItems = [
    {
      path: "/dashboard.html",
      aliases: ["/dashboard", "/dashboard.html"],
      label: "Dashboard",
      icon: (
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
      ),
    },
    {
      path: "/clients.html",
      aliases: ["/clients", "/clients.html", "/client-detail.html"],
      label: "Clients",
      icon: (
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 1.34 5 8s1.34 3 8 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      ),
    },
    {
      path: "/matching.html",
      aliases: ["/matching", "/matching.html"],
      label: "Matching",
      icon: (
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      ),
    },
    {
      path: "/search.html",
      aliases: ["/search", "/search.html"],
      label: "Search",
      icon: (
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      ),
    },
    {
      path: "/billing.html",
      aliases: ["/billing", "/billing.html"],
      label: "Billing",
      icon: (
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      ),
    },
    {
      path: "/settings.html",
      aliases: ["/settings", "/settings.html"],
      label: "Settings",
      icon: (
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      ),
    },
  ];

  const isCurrent = (aliases: string[]) => {
    return (
      aliases.some((a) => currentPath.startsWith(a)) ||
      (currentPath.startsWith("/clients/") && aliases.includes("/clients.html"))
    );
  };

  return (
    <>
      <aside
        id="sidebar"
        className={`sidebar ${collapsed ? "collapsed" : ""} ${isMobileOpen ? "drawer-open" : ""}`}
        aria-label="Main Navigation"
      >
        <div className="sidebar-header">
          <div className="logo" aria-hidden="true">
            F
          </div>
          <span className="brand-name font-display">FreelanceOS</span>
          <button
            id="sidebar-toggle"
            className="sidebar-toggle-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <svg className="icon icon-chevron" viewBox="0 0 24 24" width="16" height="16">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary nav">
          {navItems.map((item) => {
            const active = isCurrent(item.aliases);
            return (
              <a
                key={item.path}
                href={item.path}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={onCloseMobile}
              >
                {item.icon}
                <span className="nav-label">{item.label}</span>
                <span className="tooltip" role="tooltip">
                  {item.label}
                </span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            id="sidebar-logout-btn"
            className="sidebar-logout-btn"
            aria-label="Log out"
            onClick={() => logout(false)}
          >
            <svg className="icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
            </svg>
            <span className="logout-label">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        id="drawer-overlay"
        className={`drawer-overlay ${isMobileOpen ? "visible" : ""}`}
        aria-hidden={!isMobileOpen}
        onClick={onCloseMobile}
      />
    </>
  );
};

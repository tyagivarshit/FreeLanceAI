import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar.js";
import { Topbar } from "../components/Topbar.js";

export interface AppLayoutProps {
  currentPath: string;
  breadcrumbTitle: string;
  parentBreadcrumb?: { label: string; href: string } | undefined;
  topbarActions?: React.ReactNode | undefined;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPath,
  breadcrumbTitle,
  parentBreadcrumb,
  topbarActions,
  children,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="dashboard-body app-layout-wrapper">
      <Sidebar
        currentPath={currentPath}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="main-layout main-wrapper">
        <Topbar
          breadcrumbTitle={breadcrumbTitle}
          parentBreadcrumb={parentBreadcrumb}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          actions={topbarActions}
        />

        <main className="dashboard-content content-container" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
};

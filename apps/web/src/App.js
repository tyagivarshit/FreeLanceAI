import React from "react";
import { AuthContext, useAuthProvider } from "./hooks/useAuth.js";
import { LandingPage } from "./pages/LandingPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { ClientsPage } from "./pages/ClientsPage.js";
import { ClientDetailPage } from "./pages/ClientDetailPage.js";
import { MatchingPage } from "./pages/MatchingPage.js";
import { SearchPage } from "./pages/SearchPage.js";
import { BillingPage } from "./pages/BillingPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
export const App = () => {
    const auth = useAuthProvider();
    // Resolve current route from pathname and search with SPA navigation support
    const [currentRoute, setCurrentRoute] = React.useState(() => window.location.pathname + window.location.search);
    const pathname = window.location.pathname;
    React.useEffect(() => {
        const handlePopState = () => {
            setCurrentRoute(window.location.pathname + window.location.search);
        };
        const handleLinkClick = (e) => {
            const target = e.target.closest("a");
            if (!target)
                return;
            const href = target.getAttribute("href");
            if (!href)
                return;
            // Ignore external, anchor-only, or new tab links
            if (href.startsWith("http://") ||
                href.startsWith("https://") ||
                href.startsWith("mailto:") ||
                href.startsWith("#") ||
                target.getAttribute("target") === "_blank" ||
                e.ctrlKey ||
                e.metaKey ||
                e.shiftKey ||
                e.altKey) {
                return;
            }
            // Check if it's an internal route
            if (href.startsWith("/") || href.endsWith(".html")) {
                e.preventDefault();
                window.history.pushState(null, "", href);
                setCurrentRoute(window.location.pathname + window.location.search);
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        };
        window.addEventListener("popstate", handlePopState);
        document.addEventListener("click", handleLinkClick);
        // Watch for location changes (e.g. browser navigation or query parameter changes)
        const interval = setInterval(() => {
            const route = window.location.pathname + window.location.search;
            setCurrentRoute((prev) => (prev !== route ? route : prev));
        }, 100);
        return () => {
            window.removeEventListener("popstate", handlePopState);
            document.removeEventListener("click", handleLinkClick);
            clearInterval(interval);
        };
    }, []);
    const renderRoute = () => {
        if (pathname === "/" || pathname === "/landing" || pathname === "/landing.html") {
            return <LandingPage key={currentRoute}/>;
        }
        if (pathname === "/index.html" || pathname === "/signup") {
            return <SignupPage key={currentRoute}/>;
        }
        if (pathname === "/login.html" || pathname === "/login") {
            return <LoginPage key={currentRoute}/>;
        }
        if (pathname === "/dashboard.html" || pathname === "/dashboard") {
            return <DashboardPage key={currentRoute}/>;
        }
        if (pathname === "/clients.html" || pathname === "/clients") {
            return <ClientsPage key={currentRoute}/>;
        }
        if (pathname.startsWith("/clients/") || pathname === "/client-detail.html") {
            return <ClientDetailPage key={currentRoute}/>;
        }
        if (pathname === "/matching.html" || pathname === "/matching") {
            return <MatchingPage key={currentRoute}/>;
        }
        if (pathname === "/search.html" || pathname === "/search") {
            return <SearchPage key={currentRoute}/>;
        }
        if (pathname === "/billing.html" || pathname === "/billing") {
            return <BillingPage key={currentRoute}/>;
        }
        if (pathname === "/settings.html" || pathname === "/settings") {
            return <SettingsPage key={currentRoute}/>;
        }
        // Default fallback
        return <LandingPage key={currentRoute}/>;
    };
    return <AuthContext.Provider value={auth}>{renderRoute()}</AuthContext.Provider>;
};

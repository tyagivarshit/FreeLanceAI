import React from "react";
import { Navbar } from "../components/Navbar.js";
import { Footer } from "../components/Footer.js";
export const PublicLayout = ({ children }) => {
    return (<div className="landing-body public-layout-wrapper">
      <Navbar />
      <main id="main-content" className="landing-main">
        {children}
      </main>
      <Footer />
    </div>);
};

"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";

declare global {
  interface Window {
    googleTranslateElementInit: () => void;
    google: any;
  }
}

export default function GoogleTranslateToggle() {
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    // Check if script is already added
    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);

      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: "en", autoDisplay: false },
          "google_translate_element"
        );
      };
    }
  }, []);

  const toggleTranslate = () => {
    const googleCombo = document.querySelector(".goog-te-combo") as HTMLSelectElement;
    if (googleCombo) {
      const newLang = isArabic ? "en" : "ar";
      googleCombo.value = newLang;
      googleCombo.dispatchEvent(new Event("change"));
      setIsArabic(!isArabic);
      
      // Update body direction for Arabic
      if (newLang === "ar") {
        document.documentElement.dir = "rtl";
        document.documentElement.lang = "ar";
      } else {
        document.documentElement.dir = "ltr";
        document.documentElement.lang = "en";
      }
    } else {
        // If combo not ready yet, try again in a bit
        setTimeout(toggleTranslate, 500);
    }
  };

  return (
    <div className="flex items-center">
      <button 
        onClick={toggleTranslate}
        className="translate-toggle-btn"
        aria-label={isArabic ? "Translate to English" : "Translate to Arabic"}
        title={isArabic ? "Switch to English" : "Switch to Arabic"}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--nav-color)',
          transition: 'all 0.3s ease',
          borderRadius: '50%',
        }}
      >
        <Languages size={22} className={isArabic ? "text-primary" : ""} />
        <span className="ms-1 d-none d-md-inline" style={{ fontSize: '12px', fontWeight: 'bold' }}>
            {isArabic ? "EN" : "AR"}
        </span>
      </button>
      <div id="google_translate_element" style={{ display: "none" }}></div>
      <style jsx global>{`
        .goog-te-banner-frame.skiptranslate, 
        .goog-te-gadget-icon,
        .goog-te-gadget-simple img,
        .goog-te-menu-value span:nth-child(2),
        .goog-te-menu-value span:nth-child(3),
        .goog-te-menu-value span:nth-child(5) {
          display: none !important;
        }
        .goog-te-gadget-simple {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        body {
          top: 0px !important;
        }
        .goog-tooltip {
          display: none !important;
        }
        .goog-tooltip:hover {
          display: none !important;
        }
        .goog-text-highlight {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}

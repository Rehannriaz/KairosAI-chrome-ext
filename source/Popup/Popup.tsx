import * as React from "react";
import { useState, useEffect } from "react";
import "./styles.scss";
import Login from "./Login";

// Resume type definition
interface Resume {
  id: number;
  name: string;
  lastUpdated: string;
  isPrimary: boolean;
}

// Main Popup component with authentication
const Popup: React.FC = (): JSX.Element => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const authStatus = localStorage.getItem("kairosai_authenticated");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  return isAuthenticated ? (
    <HomeView />
  ) : (
    <Login onSuccessfulAuth={handleLoginSuccess} />
  );
};

// Home component with resume management
const HomeView: React.FC = (): JSX.Element => {
  // Static resume data
  const [resumes, setResumes] = useState<Resume[]>([
    {
      id: 1,
      name: "Software Engineer Resume",
      lastUpdated: "2025-04-15",
      isPrimary: true,
    },
    {
      id: 2,
      name: "Data Science Resume",
      lastUpdated: "2025-04-10",
      isPrimary: false,
    },
    {
      id: 3,
      name: "Project Manager Resume",
      lastUpdated: "2025-03-30",
      isPrimary: false,
    },
    {
      id: 4,
      name: "Frontend Developer Resume",
      lastUpdated: "2025-03-22",
      isPrimary: false,
    },
  ]);

  // Track the selected resume ID
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(1); // Default select the primary resume
  // State for detail view
  // Active tab state
  const [activeTab, setActiveTab] = useState("autofill");
  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Resume section visibility

  const handleAutofill = (): void => {
    alert("Autofilling the current page...");
  };

  const handleSelectResume = (id: number): void => {
    setSelectedResumeId(id);
    setDropdownOpen(false);
  };

  const handleTailorResume = (): void => {
    alert("Opening resume editor to tailor your resume...");
  };

  const toggleDropdown = (): void => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleClose = (): void => {
    // Close the extension popup
    window.close();
  };

  const handleViewResume = (): void => {};

  const selectedResume = resumes.find(
    (resume) => resume.id === selectedResumeId
  );

  return (
    <div className="simplify-app">
      <div className="app-header">
        <h2>
          <span className="logo">
            <div className="logo-placeholder">
              <img
                src="../assets/logo_black.png"
                alt="KairosAI Logo"
                className="logo-image"
              />
            </div>
            KairosAI
          </span>
        </h2>
        <div className="header-icons">
          <button className="icon-button close" onClick={handleClose}>
            <span>✕</span>
          </button>
        </div>
      </div>

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "autofill" ? "active" : ""}`}
          onClick={() => setActiveTab("autofill")}>
          <span className="icon">✏️</span> Autofill
        </button>
        <button
          className={`tab-button ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}>
          <span className="icon">👤</span> Profile
        </button>
      </div>

      {activeTab === "autofill" && (
        <>
          <div className="autofill-card">
            <div className="autofill-header">
              <div className="icon-container">
                <span className="lightning-icon">⚡</span>
              </div>
              <h3>Autofill this job application!</h3>
            </div>
            <button className="autofill-button" onClick={handleAutofill}>
              <span className="lightning-icon">⚡</span> Autofill this page
            </button>
          </div>

          <div className="resume-section">
            <div className="section-header">
              <h3>Resume</h3>
            </div>

            <>
              <div className="resume-selector">
                <div className="selected-resume" onClick={toggleDropdown}>
                  <span>{selectedResume?.name || "Select a resume"}</span>
                  <span className="dropdown-arrow">
                    {dropdownOpen ? "▲" : "▼"}
                  </span>
                </div>
                <button className="view-button" onClick={handleViewResume}>
                  <span className="eye-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="grey"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                </button>
              </div>

              {dropdownOpen && (
                <div className="resume-dropdown">
                  {resumes.map((resume) => (
                    <div
                      key={resume.id}
                      className={`resume-option ${selectedResumeId === resume.id ? "selected" : ""}`}
                      onClick={() => handleSelectResume(resume.id)}>
                      {resume.name}
                      {resume.isPrimary && (
                        <span className="primary-badge">Primary</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="tailor-resume-section">
                <button className="tailor-button" onClick={handleTailorResume}>
                  <span className="tailor-icon">✏️</span> Tailor Resume
                </button>
              </div>
            </>
          </div>
        </>
      )}

      {activeTab === "profile" && (
        <div className="profile-tab">
          <h3>Profile Settings</h3>
          <p>User profile information and settings would appear here.</p>
          <div className="profile-content">
            <div className="profile-section">
              <h4>Personal Information</h4>
              <p>Name, email, and contact details would appear here.</p>
            </div>
            <div className="profile-section">
              <h4>Preferences</h4>
              <p>User preferences and settings would appear here.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Popup;

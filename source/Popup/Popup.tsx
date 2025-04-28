import * as React from "react";
import { useState, useEffect, useRef } from "react";
import "./styles.scss";
import Login from "./Login";
import {
  handleAutofill,
  processAutofillContent,
  applyAutofill,
} from "./autofillService";
import CONFIG from "../../Config";
// Resume type definition
interface Resume {
  id: string;
  user_id: string;
  name: string;
  location: string;
  email: string;
  phone: string;
  professional_summary: string;
  skills: string[];
  employment_history: {
    company: string;
    end_date: string;
    job_title: string;
    start_date: string;
    description: string;
    achievements: string[];
  }[];
  education: {
    gpa: string | null;
    degree: string;
    honors: string[];
    end_date: string;
    start_date: string;
    institution: string;
  }[];
  preferences: {
    work_type: string | null;
    desired_role: string | null;
    available_from: string | null;
    desired_salary: string | null;
    desired_location: string | null;
  };
  link: string | null;
  skill_level: string | null;
  uploaddate: string;
  file_url: string;
  primary_resume_id: string;
  isPrimary?: boolean;
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
  // State for resumes fetched from API
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the selected resume ID
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  // Active tab state
  const [activeTab, setActiveTab] = useState("autofill");
  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Track loading state for autofill
  const [isAutofilling, setIsAutofilling] = useState(false);

  // Component mounted ref to prevent state updates after unmount
  const isMounted = useRef(true);

  // Clean up the ref when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch resumes from API on component mount
  useEffect(() => {
    const fetchResumes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        chrome.storage.local.get("token", async (result) => {
          const token = result.token;
          console.log("Fetched token from storage:", token);

          if (!token) {
            throw new Error("No authentication token found");
          }

          const response = await fetch(
            "https://kairos-ai-arthur.vercel.app/api/resumes",
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch resumes: ${response.status}`);
          }

          const data = await response.json();

          const processedResumes = data.map((resume: Resume) => ({
            ...resume,
            isPrimary: resume.id === resume.primary_resume_id,
          }));

          setResumes(processedResumes);

          const primaryResume = processedResumes.find((r) => r.isPrimary);
          if (primaryResume) {
            setSelectedResumeId(primaryResume.id);
          } else if (processedResumes.length > 0) {
            setSelectedResumeId(processedResumes[0].id);
          }
        });
      } catch (err) {
        console.error("Error fetching resumes:", err);
        setError(err instanceof Error ? err.message : "Failed to load resumes");
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    fetchResumes();
  }, []);
  const onAutofillClick = async () => {
    try {
      setIsAutofilling(true);

      // Get HTML content from active tab
      const htmlContent = await handleAutofill(isMounted);
      if (!isMounted.current) return;

      if (htmlContent) {
        // Find the selected resume to use for autofill
        const selectedResume = resumes.find(
          (resume) => resume.id === selectedResumeId
        );

        if (!selectedResume) {
          throw new Error("No resume selected for autofill");
        }

        // Process the HTML content to extract form fields
        const formFields = processAutofillContent(htmlContent);

        console.log("Detected form fields:", formFields);

        // Add check for no fields BEFORE making the API call
        if (
          formFields.inputs.length === 0 &&
          formFields.selects.length === 0 &&
          formFields.textareas.length === 0
        ) {
          alert("No Fields to AutoFill.");
          setIsAutofilling(false);
          return;
        }
        console.log("resume", selectedResume);

        // Prepare the API request to GPT-3.5 Turbo
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content:
                    "You are an AI assistant that maps resume data to form fields on job application websites. Return only a JSON object with form field selectors as keys and corresponding values from the resume data.",
                },
                {
                  role: "user",
                  content: `Map this resume data to the form fields. 
              Resume: ${JSON.stringify(selectedResume)}
              Form fields: ${JSON.stringify(formFields)}
              
              Return a JSON object where keys are the form field selectors and values are the appropriate data from the resume.
              For example: {"input[name='firstName']": "John", "input[name='email']": "john@example.com"}
              
              Be smart about mapping fields - look for patterns in field names and labels to determine what information should go where.
              If you're unsure about a field, it's better to leave it blank than guess incorrectly.`,
                },
              ],
              temperature: 0.3,
              max_tokens: 2000,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const autofillData = JSON.parse(data.choices[0].message.content.trim());

        console.log("AI-generated autofill data:", autofillData);

        // Apply the autofill data, passing the selected resume
        await applyAutofill(isMounted, autofillData, selectedResume);
      }
    } catch (error) {
      console.error("Autofill error:", error);
      alert(
        `Autofill failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      if (isMounted.current) {
        setIsAutofilling(false);
      }
    }
  };

  const handleSelectResume = (id: string): void => {
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

  const handleViewResume = (): void => {
    const selectedResume = resumes.find(
      (resume) => resume.id === selectedResumeId
    );
    if (selectedResume && selectedResume.file_url) {
      window.open(selectedResume.file_url, "_blank");
    } else {
      alert("No resume file available to view.");
    }
  };

  const selectedResume = resumes.find(
    (resume) => resume.id === selectedResumeId
  );

  // Format date function for displaying last updated
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
            <button
              className="autofill-button"
              onClick={onAutofillClick}
              disabled={isAutofilling || isLoading || !selectedResumeId}>
              <span className="lightning-icon">⚡</span>
              {isAutofilling ? "Autofilling..." : "Autofill this page"}
            </button>
          </div>

          <div className="resume-section">
            <div className="section-header">
              <h3>Resume</h3>
            </div>

            {isLoading ? (
              <div className="loading-state">Loading your resumes...</div>
            ) : error ? (
              <div className="error-state">
                <p>Error: {error}</p>
                <button
                  className="retry-button"
                  onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="resume-selector">
                  <div className="selected-resume" onClick={toggleDropdown}>
                    <span>{selectedResume?.name || "Select a resume"}</span>
                    <span className="dropdown-arrow">
                      {dropdownOpen ? "▲" : "▼"}
                    </span>
                  </div>
                  <button
                    className="view-button"
                    onClick={handleViewResume}
                    disabled={!selectedResume?.file_url}>
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
                    {resumes.length > 0 ? (
                      resumes.map((resume) => (
                        <div
                          key={resume.id}
                          className={`resume-option ${selectedResumeId === resume.id ? "selected" : ""}`}
                          onClick={() => handleSelectResume(resume.id)}>
                          <div className="resume-option-name">
                            {resume.name}
                          </div>
                          <div className="resume-option-details">
                            <span className="resume-updated">
                              Updated: {formatDate(resume.uploaddate)}
                            </span>
                            {resume.isPrimary && (
                              <span className="primary-badge">Primary</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-resumes">No resumes found</div>
                    )}
                  </div>
                )}

                <div className="tailor-resume-section">
                  <button
                    className="tailor-button"
                    onClick={handleTailorResume}
                    disabled={!selectedResumeId}>
                    <span className="tailor-icon">✏️</span> Tailor Resume
                  </button>
                </div>
              </>
            )}
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

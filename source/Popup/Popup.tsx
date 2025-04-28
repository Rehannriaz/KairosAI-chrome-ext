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

// User profile interface
interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  // Add any other user profile properties you need
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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

          // Set user profile from primary resume or first resume
          const primaryResume = processedResumes.find((r) => r.isPrimary);
          const profileResume =
            primaryResume ||
            (processedResumes.length > 0 ? processedResumes[0] : null);

          if (profileResume) {
            setSelectedResumeId(profileResume.id);

            // Extract user profile data from resume
            const profileData: UserProfile = {
              name: profileResume.name,
              email: profileResume.email,
              phone: profileResume.phone,
              location: profileResume.location,
              linkedin: profileResume.link || undefined,
              // You can add more fields as needed
            };

            setUserProfile(profileData);
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

  // Get initials from name for avatar
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);
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
                            {/* <span className="resume-updated">
                              Updated: {formatDate(resume.uploaddate)}
                            </span> */}
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

                {/* <div className="tailor-resume-section">
                  <button
                    className="tailor-button"
                    onClick={handleTailorResume}
                    disabled={!selectedResumeId}>
                    <span className="tailor-icon">✏️</span> Tailor Resume
                  </button>
                </div> */}
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "profile" && (
        <div className="profile-tab">
          {isLoading ? (
            <div className="loading-state">Loading your profile...</div>
          ) : error ? (
            <div className="error-state">
              <p>Error: {error}</p>
              <button
                className="retry-button"
                onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          ) : userProfile ? (
            <>
              <div className="profile-header">
                <h3 className="profile-name">{userProfile.name}</h3>
              </div>

              <div className="profile-info">
                <div className="profile-avatar">
                  <span className="avatar-initials">
                    {getInitials(userProfile.name)}
                  </span>
                </div>
                <div className="profile-details">
                  <p className="detail-item">{userProfile.location}</p>
                  <p className="detail-item">{userProfile.email}</p>
                  <p className="detail-item">{userProfile.phone}</p>
                </div>
              </div>

              {selectedResume && (
                <>
                  {selectedResume.education &&
                    selectedResume.education.length > 0 && (
                      <div className="section education-section">
                        <h4 className="section-title">Education</h4>
                        {selectedResume.education.map((edu, index) => (
                          <div className="education-item" key={index}>
                            <div className="education-details">
                              <h5 className="institution">{edu.institution}</h5>
                              <p className="degree">{edu.degree}</p>
                              <p className="period">
                                {edu.start_date} - {edu.end_date}
                              </p>
                              {edu.gpa && <p className="gpa">GPA: {edu.gpa}</p>}
                              {edu.honors && edu.honors.length > 0 && (
                                <p className="honors">
                                  Honors: {edu.honors.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {selectedResume.employment_history &&
                    selectedResume.employment_history.length > 0 && (
                      <div className="section experience-section">
                        <h4 className="section-title">Experience</h4>
                        {selectedResume.employment_history.map((job, index) => (
                          <div className="experience-item" key={index}>
                            <div className="experience-details">
                              <h5 className="job-title">{job.job_title}</h5>
                              <p className="company">
                                {job.company} • {selectedResume.location}
                              </p>
                              <p className="period">
                                {job.start_date} - {job.end_date}
                              </p>
                              <p className="description">{job.description}</p>
                              {job.achievements &&
                                job.achievements.length > 0 && (
                                  <div className="achievements">
                                    <p className="achievements-title">
                                      Achievements:
                                    </p>
                                    <ul>
                                      {job.achievements.map(
                                        (achievement, idx) => (
                                          <li key={idx}>{achievement}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {selectedResume.file_url && (
                    <div className="section uploads-section">
                      <h4 className="section-title">Uploads</h4>
                      <div className="upload-item">
                        <div className="upload-details">
                          <h5 className="upload-title">Resume</h5>
                          <p className="upload-info">
                            Uploaded: {formatDate(selectedResume.uploaddate)}
                          </p>
                          <a
                            href={selectedResume.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="preview-link">
                            Preview
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {userProfile.linkedin ||
                    userProfile.github ||
                    (selectedResume.link && (
                      <div className="section links-section">
                        <h4 className="section-title">Links</h4>

                        {userProfile.linkedin && (
                          <div className="link-item">
                            <div className="link-details">
                              <h5 className="link-title">LinkedIn</h5>
                              <a
                                href={userProfile.linkedin}
                                className="link-url"
                                target="_blank"
                                rel="noopener noreferrer">
                                {userProfile.linkedin}
                              </a>
                            </div>
                          </div>
                        )}

                        {userProfile.github && (
                          <div className="link-item">
                            <div className="link-details">
                              <h5 className="link-title">Github</h5>
                              <a
                                href={userProfile.github}
                                className="link-url"
                                target="_blank"
                                rel="noopener noreferrer">
                                {userProfile.github}
                              </a>
                            </div>
                          </div>
                        )}

                        {selectedResume.link &&
                          !userProfile.linkedin &&
                          !userProfile.github && (
                            <div className="link-item">
                              <div className="link-details">
                                <h5 className="link-title">Profile Link</h5>
                                <a
                                  href={selectedResume.link}
                                  className="link-url"
                                  target="_blank"
                                  rel="noopener noreferrer">
                                  {selectedResume.link}
                                </a>
                              </div>
                            </div>
                          )}
                      </div>
                    ))}

                  {selectedResume.skills &&
                    selectedResume.skills.length > 0 && (
                      <div className="section skills-section">
                        <h4 className="section-title">Skills</h4>
                        <div className="skills-container">
                          {selectedResume.skills.map((skill, index) => (
                            <span className="skill-tag" key={index}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </>
          ) : (
            <div className="no-profile">No profile information available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Popup;

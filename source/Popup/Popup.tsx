/* eslint-disable no-nested-ternary */
import * as React from "react";
import { useState, useEffect } from "react";
import "./styles.scss";

// Resume type definition
interface Resume {
  id: number;
  name: string;
  lastUpdated: string;
  isPrimary: boolean;
}

// Home component with resume management
const HomeView: React.FC<{
  onBackToWelcome: () => void;
}> = ({ onBackToWelcome }): JSX.Element => {
  // Static resume data for demonstration
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
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  // State for detail view
  const [showDetailView, setShowDetailView] = useState(false);

  const handleSetPrimary = (id: number): void => {
    setResumes((prevResumes) =>
      prevResumes.map((resume) => ({
        ...resume,
        isPrimary: resume.id === id,
      }))
    );
  };

  const handleSelectResume = (id: number): void => {
    setSelectedResumeId(id === selectedResumeId ? null : id);
  };

  const selectedResume = resumes.find(
    (resume) => resume.id === selectedResumeId
  );
  if (showDetailView && selectedResume) {
    return (
      <div className="resume-detail-view">
        <div className="detail-header">
          <button
            type="button"
            className="back-button"
            onClick={() => setShowDetailView(false)}
          >
            ← Back to Resumes
          </button>
          <h3>{selectedResume.name}</h3>
        </div>

        <div className="resume-details">
          <p>
            <strong>Resume ID:</strong> {selectedResume.id}
          </p>
          <p>
            <strong>Last Updated:</strong> {selectedResume.lastUpdated}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            {selectedResume.isPrimary ? "Primary" : "Secondary"}
          </p>

          <div className="resume-content">
            <h4>Resume Content</h4>
            <p>
              This is a placeholder for the actual resume content. In a real
              implementation, this would display the parsed or formatted resume
              data.
            </p>

            <div className="content-sections">
              <div className="section">
                <h5>Professional Experience</h5>
                <p>Sample experience details would appear here...</p>
              </div>

              <div className="section">
                <h5>Education</h5>
                <p>Sample education details would appear here...</p>
              </div>

              <div className="section">
                <h5>Skills</h5>
                <p>Sample skills would be listed here...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-view">
      <div className="home-header">
        <button type="button" className="back-button" onClick={onBackToWelcome}>
          ← Back
        </button>
        <h3>Your Resumes</h3>
      </div>

      <div className="table-container">
        <table className="resumes-table">
          <thead>
            <tr>
              <th>Resume Name</th>
              <th>Last Updated</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {resumes.map((resume) => (
              <tr
                key={resume.id}
                className={`${resume.isPrimary ? "primary-row" : ""} ${
                  selectedResumeId === resume.id ? "selected-row" : ""
                }`}
                onClick={() => handleSelectResume(resume.id)}
              >
                <td>{resume.name}</td>
                <td>{resume.lastUpdated}</td>
                <td>
                  {resume.isPrimary ? (
                    <span className="primary-badge">Primary</span>
                  ) : (
                    <span className="secondary-badge">Secondary</span>
                  )}
                </td>
                <td>
                  {!resume.isPrimary && (
                    <button
                      type="button"
                      className="set-primary-button"
                      onClick={() => handleSetPrimary(resume.id)}
                    >
                      Set as Primary
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedResumeId && (
        <div className="resume-action-buttons">
          <button
            type="button"
            className="next-button"
            onClick={() => setShowDetailView(true)}
          >
            View Resume Details →
          </button>
        </div>
      )}
    </div>
  );
};

// Welcome component to show after successful login
const WelcomeView: React.FC<{
  userName: string;
  email: string;
  onLogout: () => void;
  onNavigateToHome: () => void;
}> = ({ userName, email, onLogout, onNavigateToHome }): JSX.Element => {
  return (
    <div className="welcome-view">
      <div className="welcome-header">
        <button type="button" className="nav-button" onClick={onNavigateToHome}>
          My Resumes
        </button>
      </div>

      <h3>Welcome, {userName || email}!</h3>
      <p>You have successfully logged in.</p>
      <p>Your account information:</p>
      <ul className="account-info">
        <li>
          <strong>Name:</strong> {userName || "Not provided"}
        </li>
        <li>
          <strong>Email:</strong> {email}
        </li>
      </ul>
      <button type="button" className="logout-button" onClick={onLogout}>
        Log Out
      </button>
    </div>
  );
};

// Auth component for login and signup
const AuthForm: React.FC<{
  onSuccessfulAuth: (name: string, email: string) => void;
}> = ({ onSuccessfulAuth }): JSX.Element => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  const handleLogin = async (): Promise<void> => {
    try {
      const res = await fetch("http://localhost:5005/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Logged in successfully!");
        // Pass the user info to parent component
        onSuccessfulAuth(data.user.name || "", data.user.email);
      } else {
        setMessage(data.message || "Login failed.");
      }
    } catch {
      setMessage("Error connecting to server.");
    }
  };

  const handleSignUp = async (): Promise<void> => {
    try {
      const res = await fetch("http://localhost:5005/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Sign-up successful! Please log in.");
        setIsLogin(true); // Switch to login after sign up
      } else {
        setMessage(data.message || "Sign-up failed.");
      }
    } catch {
      setMessage("Error connecting to server.");
    }
  };

  return (
    <>
      <p className="subtitle">{isLogin ? "Log In" : "Sign Up"}</p>

      {!isLogin && (
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e): void => setName(e.target.value)}
          className="input"
        />
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e): void => setEmail(e.target.value)}
        className="input"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e): void => setPassword(e.target.value)}
        className="input"
      />

      <button
        type="button"
        className="login__button"
        onClick={isLogin ? handleLogin : handleSignUp}
      >
        {isLogin ? "Log In" : "Sign Up"}
      </button>

      {message && <p className="message">{message}</p>}

      <button
        type="button"
        className="link__button"
        onClick={(): void => setIsLogin(!isLogin)}
      >
        {isLogin
          ? "Don't have an account? Sign Up"
          : "Already have an account? Log In"}
      </button>
    </>
  );
};

const Popup: React.FC = (): JSX.Element => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [currentView, setCurrentView] = useState<"welcome" | "home">("welcome");

  // Check if user is already logged in on component mount
  useEffect(() => {
    const authData = localStorage.getItem("kairosAuthData");
    if (authData) {
      try {
        const { name, email } = JSON.parse(authData);
        setUserName(name);
        setUserEmail(email);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Failed to parse auth data:", error);
      }
    }
  }, []);

  const handleSuccessfulAuth = (name: string, email: string): void => {
    setUserName(name);
    setUserEmail(email);
    setIsAuthenticated(true);

    // Store auth data in local storage
    localStorage.setItem("kairosAuthData", JSON.stringify({ name, email }));
  };

  const handleLogout = (): void => {
    setIsAuthenticated(false);
    setUserName("");
    setUserEmail("");
    setCurrentView("welcome");
    localStorage.removeItem("kairosAuthData");
  };

  return (
    <section id="popup">
      <h2>
        Kairos<span>AI</span>
      </h2>

      {isAuthenticated ? (
        currentView === "welcome" ? (
          <WelcomeView
            userName={userName}
            email={userEmail}
            onLogout={handleLogout}
            onNavigateToHome={() => setCurrentView("home")}
          />
        ) : (
          <HomeView onBackToWelcome={() => setCurrentView("welcome")} />
        )
      ) : (
        <AuthForm onSuccessfulAuth={handleSuccessfulAuth} />
      )}
    </section>
  );
};

export default Popup;

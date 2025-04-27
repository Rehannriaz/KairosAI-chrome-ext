import * as React from "react";
import { useState } from "react";
import "./login-styles.scss";

interface LoginProps {
  onSuccessfulAuth: (name: string, email: string) => void;
}

const Login: React.FC<LoginProps> = ({ onSuccessfulAuth }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        "https://kairos-ai-auth-2.vercel.app/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );
      const data = await res.json();
      console.log("data", data);
      console.log("res", res);
      if (res.status === 200) {
        setMessage("Logged in successfully!");
        // Pass the user info to parent component
        localStorage.setItem("kairosai_authenticated", "true");
        chrome.storage.local.set({ token: data.token }, function () {
          console.log("Token saved to Chrome storage");
        });
        onSuccessfulAuth(data.user.name || "", data.user.email);
      } else {
        setMessage(data.message || "Login failed.");
        localStorage.setItem("kairosai_authenticated", "false");
      }
    } catch {
      setMessage("Error connecting to server.");
      localStorage.setItem("kairosai_authenticated", "false");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Welcome Back</h1>
        <p className="login-subtitle">
          Log in to your KairosAI account to continue your journey.
        </p>

        {message && (
          <div
            className={
              message.includes("success") ? "success-message" : "error-message"
            }>
            {message}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={togglePasswordVisibility}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="eye-icon">
                  {showPassword ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Logging In..." : "Log In"}
          </button>

          <div className="login-footer">
            <a
              href="#"
              className="forgot-password"
              onClick={(e) => {
                e.preventDefault();
                window.open("https://kairos-ai-two.vercel.app/login", "_blank");
              }}>
              Forgot password?
            </a>
            <a
              href="#"
              className="create-account"
              onClick={(e) => {
                e.preventDefault();
                window.open(
                  "https://kairos-ai-two.vercel.app/signup",
                  "_blank"
                );
              }}>
              Create an account
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

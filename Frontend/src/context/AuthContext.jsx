import React, { createContext, useContext, useState, useEffect } from "react";
import API_URL from "../config/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setTeacher(data.teacher);
        } else {
          // Token invalid, clear it
          localStorage.removeItem("token");
          setToken(null);
          setTeacher(null);
        }
      } catch (error) {
        console.error("Token verification failed:", error);
        localStorage.removeItem("token");
        setToken(null);
        setTeacher(null);
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  async function login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    localStorage.setItem("token", data.token);
    setToken(data.token);
    setTeacher(data.teacher);

    return data;
  }

  async function register(name, email, password) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Registration failed");
    }

    localStorage.setItem("token", data.token);
    setToken(data.token);
    setTeacher(data.teacher);

    return data;
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setTeacher(null);
  }

  // Helper to get auth headers for API calls
  function getAuthHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  // Helper to get auth header for FormData (no Content-Type, let browser set it)
  function getAuthHeadersMultipart() {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  const value = {
    teacher,
    token,
    loading,
    isAuthenticated: !!teacher,
    login,
    register,
    logout,
    getAuthHeaders,
    getAuthHeadersMultipart
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;

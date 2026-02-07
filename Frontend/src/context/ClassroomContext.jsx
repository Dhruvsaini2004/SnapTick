import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import API_URL from "../config/api";

const ClassroomContext = createContext(null);

export function ClassroomProvider({ children }) {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [activeClassroom, setActiveClassroom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch classrooms when authenticated
  const fetchClassrooms = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/classroom`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch classrooms");
      }

      const data = await res.json();
      setClassrooms(data);

      // If there's a stored active classroom, try to restore it
      const storedId = localStorage.getItem("activeClassroomId");
      if (storedId) {
        const found = data.find(c => c._id === storedId);
        if (found) {
          setActiveClassroom(found);
        } else if (data.length > 0) {
          // Stored classroom not found, use first available
          setActiveClassroom(data[0]);
          localStorage.setItem("activeClassroomId", data[0]._id);
        }
      } else if (data.length > 0 && !activeClassroom) {
        // No stored classroom, use first available
        setActiveClassroom(data[0]);
        localStorage.setItem("activeClassroomId", data[0]._id);
      }
    } catch (err) {
      console.error("Fetch classrooms error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders, activeClassroom]);

  useEffect(() => {
    fetchClassrooms();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set active classroom
  const selectClassroom = useCallback((classroom) => {
    setActiveClassroom(classroom);
    if (classroom) {
      localStorage.setItem("activeClassroomId", classroom._id);
    } else {
      localStorage.removeItem("activeClassroomId");
    }
  }, []);

  // Create a new classroom
  async function createClassroom(name, description = "") {
    const res = await fetch(`${API_URL}/classroom`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, description })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create classroom");
    }

    // Add to local state
    setClassrooms(prev => [data.classroom, ...prev]);
    
    // Set as active if it's the first one
    if (classrooms.length === 0) {
      selectClassroom(data.classroom);
    }

    return data.classroom;
  }

  // Update a classroom
  async function updateClassroom(id, name, description = "") {
    const res = await fetch(`${API_URL}/classroom/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, description })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to update classroom");
    }

    // Update local state
    setClassrooms(prev => prev.map(c => c._id === id ? data.classroom : c));

    // Update active if it was the active one
    if (activeClassroom?._id === id) {
      setActiveClassroom(data.classroom);
    }

    return data.classroom;
  }

  // Delete a classroom
  async function deleteClassroom(id) {
    const res = await fetch(`${API_URL}/classroom/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to delete classroom");
    }

    // Remove from local state
    setClassrooms(prev => prev.filter(c => c._id !== id));

    // Clear active if it was the deleted one
    if (activeClassroom?._id === id) {
      const remaining = classrooms.filter(c => c._id !== id);
      if (remaining.length > 0) {
        selectClassroom(remaining[0]);
      } else {
        selectClassroom(null);
      }
    }

    return data;
  }

  // Update student count for a specific classroom (called after student add/delete)
  const updateStudentCount = useCallback((classroomId, delta) => {
    setClassrooms(prev => prev.map(c => {
      if (c._id === classroomId) {
        return { ...c, studentCount: Math.max(0, (c.studentCount || 0) + delta) };
      }
      return c;
    }));

    // Also update activeClassroom if it matches
    if (activeClassroom?._id === classroomId) {
      setActiveClassroom(prev => ({
        ...prev,
        studentCount: Math.max(0, (prev.studentCount || 0) + delta)
      }));
    }
  }, [activeClassroom]);

  // Refresh student count for a classroom from the server
  const refreshClassroomCount = useCallback(async (classroomId) => {
    try {
      const res = await fetch(`${API_URL}/classroom/${classroomId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setClassrooms(prev => prev.map(c => 
          c._id === classroomId ? { ...c, studentCount: data.studentCount } : c
        ));
        if (activeClassroom?._id === classroomId) {
          setActiveClassroom(prev => ({ ...prev, studentCount: data.studentCount }));
        }
      }
    } catch (err) {
      console.error("Failed to refresh classroom count:", err);
    }
  }, [getAuthHeaders, activeClassroom]);

  const value = {
    classrooms,
    activeClassroom,
    loading,
    error,
    fetchClassrooms,
    selectClassroom,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    updateStudentCount,
    refreshClassroomCount
  };

  return (
    <ClassroomContext.Provider value={value}>
      {children}
    </ClassroomContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroom() {
  const context = useContext(ClassroomContext);
  if (!context) {
    throw new Error("useClassroom must be used within a ClassroomProvider");
  }
  return context;
}

export default ClassroomContext;

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation, Outlet } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { 
  FiArrowLeft, FiUsers, FiUploadCloud, FiGrid, FiFolder,
  FiChevronDown
} from "react-icons/fi";
import { useClassroom } from "../context/ClassroomContext";

export default function ClassroomView() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { classrooms, activeClassroom, selectClassroom, loading } = useClassroom();
  const [showDropdown, setShowDropdown] = useState(false);

  // Set active classroom from URL param
  useEffect(() => {
    if (classroomId && classrooms.length > 0) {
      const classroom = classrooms.find(c => c._id === classroomId);
      if (classroom) {
        selectClassroom(classroom);
      } else {
        // Classroom not found, redirect to dashboard
        navigate("/dashboard");
      }
    }
  }, [classroomId, classrooms, selectClassroom, navigate]);

  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes("/attendance")) return "attendance";
    if (path.includes("/records")) return "records";
    return "enroll";
  };

  const activeTab = getActiveTab();

  const tabs = [
    { id: "enroll", label: "Enrollment", icon: <FiUsers />, path: `/classroom/${classroomId}` },
    { id: "attendance", label: "Smart Scan", icon: <FiUploadCloud />, path: `/classroom/${classroomId}/attendance` },
    { id: "records", label: "Records", icon: <FiGrid />, path: `/classroom/${classroomId}/records` },
  ];

  if (loading || !activeClassroom) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header with classroom selector */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2">
          <Link 
            to="/dashboard" 
            className="hover:text-[var(--color-primary)] transition-colors flex items-center gap-1"
          >
            <FiArrowLeft size={14} />
            Classrooms
          </Link>
          <span>/</span>
          <span className="text-[var(--text-secondary)]">{activeClassroom.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          {/* Classroom Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 p-2 pr-4 rounded-xl hover:bg-[var(--bg-input)] transition-colors group"
            >
              <div className="h-10 w-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <FiFolder className="text-lg text-[var(--color-primary)]" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-[var(--text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                  {activeClassroom.name}
                </h1>
                <p className="text-sm text-[var(--text-muted)]">
                  {activeClassroom.studentCount || 0} students
                </p>
              </div>
              <FiChevronDown className={`text-[var(--text-muted)] transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowDropdown(false)} 
                />
                <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] shadow-lg z-20 overflow-hidden">
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {classrooms.map((classroom) => (
                      <button
                        key={classroom._id}
                        onClick={() => {
                          navigate(`/classroom/${classroom._id}`);
                          setShowDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          classroom._id === activeClassroom._id
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                            : 'hover:bg-[var(--bg-input)] text-[var(--text-main)]'
                        }`}
                      >
                        <FiFolder className="flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{classroom.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {classroom.studentCount || 0} students
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-[var(--border-subtle)] p-2">
                    <Link
                      to="/dashboard"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center justify-center gap-2 p-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-input)] transition-colors"
                    >
                      View All Classrooms
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 mb-6 bg-[var(--bg-input)] rounded-xl w-fit">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.path}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Content Area - Outlet for nested routes */}
      <Outlet context={{ classroomId: activeClassroom._id, classroom: activeClassroom }} />
    </Motion.div>
  );
}

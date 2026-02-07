import React, { useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { FiX, FiUserCheck, FiUserX } from "react-icons/fi";

const CorrectionModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  faceIndex, 
  currentMatch, 
  enrolledStudents 
}) => {
  const [correctionType, setCorrectionType] = useState("not_enrolled"); // "not_enrolled" | "different_student"
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [addToTraining, setAddToTraining] = useState(true);

  const handleSave = () => {
    if (correctionType === "not_enrolled") {
      onSave({
        faceIndex,
        action: "skip",
        studentId: null,
        addToTraining: false
      });
    } else if (correctionType === "different_student" && selectedStudentId) {
      onSave({
        faceIndex,
        action: "correct",
        studentId: selectedStudentId,
        addToTraining
      });
    }
    // Reset state
    setCorrectionType("not_enrolled");
    setSelectedStudentId("");
    setAddToTraining(true);
    onClose();
  };

  const handleClose = () => {
    setCorrectionType("not_enrolled");
    setSelectedStudentId("");
    setAddToTraining(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-md mx-4 bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
            <h2 className="text-lg font-bold text-[var(--text-main)]">
              Correct Face #{faceIndex + 1}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Current match info */}
            {currentMatch && (
              <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                <p className="text-sm text-[var(--text-muted)]">Currently matched as:</p>
                <p className="text-lg font-bold text-[var(--text-main)]">
                  {currentMatch.name || "Unknown"}
                </p>
              </div>
            )}

            {/* Correction options */}
            <div className="space-y-3">
              <p className="text-sm font-bold text-[var(--text-muted)]">This person is:</p>

              {/* Not enrolled option */}
              <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                correctionType === "not_enrolled" 
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" 
                  : "border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
              }`}>
                <input
                  type="radio"
                  name="correctionType"
                  value="not_enrolled"
                  checked={correctionType === "not_enrolled"}
                  onChange={() => setCorrectionType("not_enrolled")}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  correctionType === "not_enrolled" 
                    ? "border-[var(--color-primary)]" 
                    : "border-[var(--text-muted)]"
                }`}>
                  {correctionType === "not_enrolled" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <FiUserX className="text-[var(--text-muted)]" />
                  <span className="font-medium text-[var(--text-main)]">Not enrolled (skip this face)</span>
                </div>
              </label>

              {/* Different student option */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                correctionType === "different_student" 
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" 
                  : "border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
              }`}>
                <input
                  type="radio"
                  name="correctionType"
                  value="different_student"
                  checked={correctionType === "different_student"}
                  onChange={() => setCorrectionType("different_student")}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  correctionType === "different_student" 
                    ? "border-[var(--color-primary)]" 
                    : "border-[var(--text-muted)]"
                }`}>
                  {correctionType === "different_student" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FiUserCheck className="text-[var(--text-muted)]" />
                    <span className="font-medium text-[var(--text-main)]">A different student:</span>
                  </div>
                  
                  {/* Student dropdown */}
                  <select
                    value={selectedStudentId}
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      setCorrectionType("different_student");
                    }}
                    className="w-full p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:border-[var(--color-primary)] focus:outline-none"
                  >
                    <option value="">Select student...</option>
                    {enrolledStudents?.map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.name} ({student.rollNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            {/* Add to training checkbox */}
            {correctionType === "different_student" && selectedStudentId && (
              <Motion.label
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={addToTraining}
                  onChange={(e) => setAddToTraining(e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--border-subtle)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <div>
                  <p className="font-medium text-[var(--text-main)]">Add to training data</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Improves future recognition for this student
                  </p>
                </div>
              </Motion.label>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-input)]">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] font-bold hover:bg-[var(--bg-app)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={correctionType === "different_student" && !selectedStudentId}
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Correction
            </button>
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CorrectionModal;

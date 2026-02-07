import React, { useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { FiUploadCloud, FiCheck, FiAlertCircle, FiCpu, FiCamera, FiMaximize, FiSearch, FiX, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import CorrectionModal from "./CorrectionModal";
import API_URL from "../config/api";

// Compress image for preview to avoid browser lag
const createCompressedPreview = (file, maxWidth = 800) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
};

// Get confidence color based on percentage
const getConfidenceColor = (confidence) => {
  if (confidence >= 65) return "text-green-500";
  if (confidence >= 40) return "text-yellow-500";
  return "text-red-500";
};

const getConfidenceBgColor = (confidence) => {
  if (confidence >= 65) return "bg-green-500";
  if (confidence >= 40) return "bg-yellow-500";
  return "bg-red-500";
};

const AttendanceUploader = () => {
  const { classroomId } = useOutletContext();
  const { getAuthHeadersMultipart, token } = useAuth();
  const toast = useToast();
  
  // File upload states
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  
  // Detection/review states
  const [reviewMode, setReviewMode] = useState(false);
  const [detections, setDetections] = useState([]);
  const [markedImageUrl, setMarkedImageUrl] = useState("");
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [confirmations, setConfirmations] = useState({}); // faceIndex -> {status, studentId, addToTraining}
  
  // Final results
  const [markedStudents, setMarkedStudents] = useState([]);
  const [showResults, setShowResults] = useState(false);
  
  // Correction modal
  const [correctionModal, setCorrectionModal] = useState({ open: false, faceIndex: null, currentMatch: null });
  
  // Diagnose states
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResults, setDiagnosisResults] = useState(null);

  const handleFileSelect = async (selectedFile) => {
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      // Reset all states when new file is selected
      setFile(selectedFile);
      setMarkedStudents([]);
      setMessage("");
      setError("");
      setMarkedImageUrl("");
      setReviewMode(false);
      setDetections([]);
      setConfirmations({});
      setShowResults(false);
      setDiagnosisResults(null);
      const compressed = await createCompressedPreview(selectedFile);
      setPreviewUrl(compressed || URL.createObjectURL(selectedFile));
    }
  };
  
  const handleInputChange = (e) => handleFileSelect(e.target.files[0]);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  
  // Detect faces (first step)
  const handleDetect = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please upload an image."); return; }
    
    const formData = new FormData();
    formData.append("groupPhoto", file);
    formData.append("classroomId", classroomId);
    setLoading(true);
    setMessage("");
    setError("");
    setMarkedImageUrl("");
    setDiagnosisResults(null);

    try {
      const res = await fetch(`${API_URL}/attendance/upload`, { 
        method: "POST", 
        headers: getAuthHeadersMultipart(),
        body: formData 
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Processing failed.");
        return;
      }

      if (data.success && data.reviewMode) {
        // Enter review mode
        setReviewMode(true);
        setDetections(data.detections || []);
        setMarkedImageUrl(data.markedImageUrl ? `${data.markedImageUrl}?t=${Date.now()}` : "");
        setEnrolledStudents(data.enrolledStudents || []);
        
        // Initialize confirmations - all matched faces start as "pending"
        const initialConfirmations = {};
        data.detections?.forEach((det, idx) => {
          initialConfirmations[idx] = {
            status: "pending", // pending, confirmed, skipped, corrected
            studentId: det.match?.studentId || null,
            originalMatch: det.match,
            addToTraining: false,
            embedding: det.embedding
          };
        });
        setConfirmations(initialConfirmations);
        
        toast.success(`Detected ${data.faceCount} face(s), ${data.recognizedCount} recognized`);
      } else { 
        setError(data.error || "Processing failed."); 
      }
    } catch { 
      setError("Server error."); 
    } finally { 
      setLoading(false); 
    }
  };
  
  // Confirm all faces
  const handleConfirmAll = () => {
    const updated = { ...confirmations };
    Object.keys(updated).forEach(idx => {
      if (updated[idx].status === "pending" && updated[idx].studentId) {
        updated[idx].status = "confirmed";
      }
    });
    setConfirmations(updated);
  };
  
  // Toggle individual face confirmation
  const handleToggleConfirm = (faceIndex) => {
    setConfirmations(prev => {
      const current = prev[faceIndex];
      if (!current) return prev;
      
      // If it has a studentId, toggle between confirmed and pending
      if (current.studentId) {
        return {
          ...prev,
          [faceIndex]: {
            ...current,
            status: current.status === "confirmed" ? "pending" : "confirmed"
          }
        };
      }
      return prev;
    });
  };
  
  // Open correction modal for a face
  const handleWrongClick = (faceIndex) => {
    const detection = detections[faceIndex];
    setCorrectionModal({
      open: true,
      faceIndex,
      currentMatch: detection?.match
    });
  };
  
  // Save correction from modal
  const handleSaveCorrection = (correction) => {
    setConfirmations(prev => {
      const current = prev[correction.faceIndex] || {};
      
      if (correction.action === "skip") {
        return {
          ...prev,
          [correction.faceIndex]: {
            ...current,
            status: "skipped",
            studentId: null,
            addToTraining: false
          }
        };
      } else if (correction.action === "correct") {
        return {
          ...prev,
          [correction.faceIndex]: {
            ...current,
            status: "corrected",
            studentId: correction.studentId,
            addToTraining: correction.addToTraining
          }
        };
      }
      return prev;
    });
  };
  
  // Get count of confirmed faces
  const getConfirmedCount = () => {
    return Object.values(confirmations).filter(c => 
      c.status === "confirmed" || c.status === "corrected"
    ).length;
  };
  
  // Get student name by ID
  const getStudentName = (studentId) => {
    const student = enrolledStudents.find(s => s._id === studentId);
    return student ? student.name : "Unknown";
  };
  
  // Mark attendance (final step)
  const handleMarkAttendance = async () => {
    const confirmedFaces = Object.entries(confirmations)
      .filter(([, conf]) => conf.status === "confirmed" || conf.status === "corrected")
      .map(([faceIndex, conf]) => ({
        faceIndex: parseInt(faceIndex),
        studentId: conf.studentId,
        action: conf.status === "corrected" ? "correct" : "confirm",
        // Always add to training for both confirmed and corrected faces
        // This helps the model learn and improve over time
        addToTraining: true,
        embedding: conf.embedding
      }));
    
    // Also include skipped faces
    const skippedFaces = Object.entries(confirmations)
      .filter(([, conf]) => conf.status === "skipped")
      .map(([faceIndex]) => ({
        faceIndex: parseInt(faceIndex),
        studentId: null,
        action: "skip",
        addToTraining: false
      }));
    
    const allConfirmations = [...confirmedFaces, ...skippedFaces];
    
    if (confirmedFaces.length === 0) {
      toast.error("No faces confirmed for attendance");
      return;
    }
    
    setConfirming(true);
    
    try {
      const res = await fetch(`${API_URL}/attendance/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          classroomId,
          confirmations: allConfirmations
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to mark attendance");
        return;
      }
      
      // Show final results
      setMarkedStudents(data.markedStudents || []);
      setShowResults(true);
      setReviewMode(false);
      setMessage(data.message);
      toast.success(data.message);
      
    } catch {
      setError("Server error while marking attendance");
    } finally {
      setConfirming(false);
    }
  };
  
  // Reset everything
  const clearState = () => {
    setFile(null);
    setPreviewUrl("");
    setMarkedImageUrl("");
    setMarkedStudents([]);
    setMessage("");
    setError("");
    setReviewMode(false);
    setDetections([]);
    setConfirmations({});
    setShowResults(false);
    setDiagnosisResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  // Cancel review and go back
  const handleCancelReview = () => {
    // Keep the detection results but exit review mode visualization
    // User can still see the image and start over
    setReviewMode(false);
    setShowResults(false);
  };

  // Diagnose handler
  const handleDiagnose = async () => {
    if (!file) { setError("Please upload an image first."); return; }
    const formData = new FormData();
    formData.append("groupPhoto", file);
    formData.append("classroomId", classroomId);
    setDiagnosing(true); setError(""); setDiagnosisResults(null);

    try {
      const res = await fetch(`${API_URL}/attendance/diagnose`, {
        method: "POST",
        headers: getAuthHeadersMultipart(),
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Diagnosis failed.");
        return;
      }

      setDiagnosisResults(data);
      toast.success(`Diagnosed ${data.faces?.length || 0} face(s)`);
    } catch {
      setError("Server error during diagnosis.");
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--color-primary)] text-sm font-bold shadow-sm">
          <FiCpu className="animate-pulse" /> AI Engine Ready
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Card */}
        <div className="glass-card p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <FiCamera className="text-[var(--text-muted)]" /> Source Image
            </h2>
            {file && <button onClick={clearState} className="text-xs font-bold text-[var(--color-primary)] hover:text-[var(--text-main)] bg-[var(--bg-app)] px-3 py-1 rounded-full border border-[var(--border-subtle)]">Reset</button>}
          </div>

          <form onSubmit={handleDetect} className="flex-1 flex flex-col">
            <div
              onClick={() => !reviewMode && fileInputRef.current?.click()}
              onDrop={handleDrop} 
              onDragOver={handleDragOver} 
              onDragLeave={handleDragLeave}
              className={`flex-1 min-h-[350px] border-3 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group ${
                reviewMode ? "cursor-default" : "cursor-pointer"
              } ${
                isDragging ? "border-[var(--border-focus)] bg-[var(--bg-app)]" : "border-[var(--border-subtle)] bg-[var(--bg-input)] hover:border-[var(--border-focus)]"
              }`}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
              
              {/* Show marked image in review mode, otherwise show preview */}
              {markedImageUrl && (reviewMode || showResults) ? (
                <img src={markedImageUrl} alt="Detected faces" className="absolute inset-0 w-full h-full object-contain p-4 z-10" />
              ) : previewUrl ? (
                <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-4 z-10" />
              ) : (
                <div className="text-center z-10 p-6">
                  <div className="w-20 h-20 rounded-full bg-[var(--bg-app)] shadow-lg flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <FiUploadCloud className="text-4xl text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[var(--text-main)] font-bold text-lg">Click to Upload</p>
                  <p className="text-[var(--text-muted)] text-sm mt-1">or drag and drop classroom photo</p>
                </div>
              )}
            </div>

            {/* Buttons - change based on mode */}
            {!reviewMode && !showResults && (
              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={loading || diagnosing || !file}
                  className="flex-1 btn-primary py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></span> : <FiCpu />}
                  {loading ? "Detecting..." : "Detect Faces"}
                </button>
                <button
                  type="button"
                  onClick={handleDiagnose}
                  disabled={loading || diagnosing || !file}
                  className="px-4 py-4 rounded-xl font-bold text-sm bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  title="Diagnose matching issues"
                >
                  {diagnosing ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span> : <FiSearch />}
                  {diagnosing ? "..." : "Diagnose"}
                </button>
              </div>
            )}
            
            {/* Review mode buttons */}
            {reviewMode && (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelReview}
                  className="px-6 py-4 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] font-bold hover:bg-[var(--bg-app)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMarkAttendance}
                  disabled={confirming || getConfirmedCount() === 0}
                  className="flex-1 btn-primary py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {confirming ? <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></span> : <FiCheck />}
                  {confirming ? "Marking..." : `Mark Attendance (${getConfirmedCount()})`}
                </button>
              </div>
            )}
            
            {/* After marking - show new scan button */}
            {showResults && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={clearState}
                  className="w-full btn-primary py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3"
                >
                  <FiCamera /> New Scan
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Results Card */}
        <div className="glass-card p-8 h-full flex flex-col relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-bold text-[var(--text-main)]">
              {reviewMode ? "Review Detections" : showResults ? "Attendance Marked" : "Results"}
            </h2>
            {reviewMode && detections.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-extrabold">
                {detections.length} DETECTED
              </span>
            )}
            {showResults && markedStudents.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-[var(--status-present-bg)] text-[var(--status-present-text)] text-xs font-extrabold">
                {markedStudents.length} MARKED
              </span>
            )}
            {diagnosisResults && (
              <span className="px-3 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-extrabold">
                DIAGNOSIS
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto relative min-h-[300px]">
            <AnimatePresence>
              {/* Loading State */}
              {(loading || diagnosing || confirming) && (
                <Motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-[var(--bg-card)] backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-[var(--border-subtle)] border-t-[var(--border-focus)] rounded-full animate-spin"></div>
                  <p className="mt-4 text-[var(--color-primary)] font-bold animate-pulse">
                    {diagnosing ? "Diagnosing..." : confirming ? "Marking Attendance..." : "Detecting Faces..."}
                  </p>
                </Motion.div>
              )}

              {/* Error State */}
              {error && (
                <Motion.div initial={{y:10, opacity:0}} animate={{y:0, opacity:1}} className="p-4 rounded-xl bg-[var(--status-absent-bg)] border border-[var(--status-absent-text)]/20 text-[var(--status-absent-text)] font-medium flex items-center gap-3 mb-4">
                  <FiAlertCircle className="text-xl flex-shrink-0" /> {error}
                </Motion.div>
              )}
              
              {/* Empty State */}
              {!loading && !diagnosing && !error && !reviewMode && !showResults && !diagnosisResults && (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] border-2 border-dashed border-[var(--border-subtle)] rounded-3xl p-8">
                  <FiMaximize className="text-5xl mb-4 opacity-50" />
                  <p className="font-medium">Detection results will appear here</p>
                </div>
              )}

              {/* Review Mode - Face Cards */}
              {reviewMode && (
                <Motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="space-y-4">
                  {/* Confirm All Button */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-[var(--text-muted)]">
                      Review each face and confirm or correct
                    </p>
                    <button
                      onClick={handleConfirmAll}
                      className="text-xs font-bold text-[var(--color-primary)] hover:text-[var(--text-main)] bg-[var(--bg-app)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      Confirm All
                    </button>
                  </div>
                  
                  {/* Face Cards */}
                  {detections.map((detection, idx) => {
                    const conf = confirmations[idx] || {};
                    const isConfirmed = conf.status === "confirmed" || conf.status === "corrected";
                    const isSkipped = conf.status === "skipped";
                    const displayName = conf.status === "corrected" 
                      ? getStudentName(conf.studentId) 
                      : detection.match?.name || "Unknown";
                    const confidence = detection.match?.confidence || 0;
                    
                    return (
                      <Motion.div
                        key={idx}
                        initial={{opacity:0, x:-20}}
                        animate={{opacity:1, x:0}}
                        transition={{delay: idx * 0.05}}
                        className={`p-4 rounded-xl border transition-all ${
                          isSkipped 
                            ? "bg-[var(--bg-input)]/50 border-[var(--border-subtle)] opacity-60" 
                            : isConfirmed 
                              ? "bg-[var(--status-present-bg)]/20 border-[var(--status-present-text)]/30" 
                              : "bg-[var(--bg-input)] border-[var(--border-subtle)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Face number indicator */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                              isSkipped 
                                ? "bg-[var(--bg-app)] text-[var(--text-muted)]" 
                                : isConfirmed 
                                  ? "bg-[var(--status-present-bg)] text-[var(--status-present-text)]" 
                                  : "bg-[var(--color-primary)] text-[var(--color-primary-text)]"
                            }`}>
                              {isSkipped ? <FiX size={16} /> : isConfirmed ? <FiCheck size={16} /> : `#${idx + 1}`}
                            </div>
                            
                            <div>
                              <p className={`font-bold ${isSkipped ? "text-[var(--text-muted)] line-through" : "text-[var(--text-main)]"}`}>
                                {isSkipped ? detection.match?.name || "Unknown" : displayName}
                                {conf.status === "corrected" && (
                                  <span className="ml-2 text-xs text-[var(--color-primary)]">(corrected)</span>
                                )}
                              </p>
                              
                              {/* Confidence bar */}
                              {!isSkipped && detection.match?.status === "matched" && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-20 h-1.5 bg-[var(--bg-app)] rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${getConfidenceBgColor(confidence)}`}
                                      style={{ width: `${confidence}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold ${getConfidenceColor(confidence)}`}>
                                    {confidence}%
                                  </span>
                                </div>
                              )}
                              
                              {detection.match?.status === "unknown" && !isSkipped && conf.status !== "corrected" && (
                                <p className="text-xs text-[var(--status-absent-text)]">Not recognized</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            {!isSkipped && (
                              <>
                                {/* Confirm/Unconfirm button */}
                                {(detection.match?.studentId || conf.studentId) && (
                                  <button
                                    onClick={() => handleToggleConfirm(idx)}
                                    className={`p-2 rounded-lg transition-colors ${
                                      isConfirmed 
                                        ? "bg-[var(--status-present-bg)] text-[var(--status-present-text)]" 
                                        : "bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--status-present-text)]"
                                    }`}
                                    title={isConfirmed ? "Unconfirm" : "Confirm"}
                                  >
                                    <FiCheckCircle size={18} />
                                  </button>
                                )}
                                
                                {/* Wrong button */}
                                <button
                                  onClick={() => handleWrongClick(idx)}
                                  className="p-2 rounded-lg bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--status-absent-text)] hover:bg-[var(--status-absent-bg)] transition-colors"
                                  title="Wrong match"
                                >
                                  <FiXCircle size={18} />
                                </button>
                              </>
                            )}
                            
                            {isSkipped && (
                              <button
                                onClick={() => handleWrongClick(idx)}
                                className="text-xs text-[var(--color-primary)] hover:underline"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </div>
                      </Motion.div>
                    );
                  })}
                </Motion.div>
              )}

              {/* Final Results - After Marking Attendance */}
              {showResults && (
                <Motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="space-y-4">
                  {message && (
                    <div className="p-4 rounded-xl bg-[var(--status-present-bg)] border border-[var(--status-present-text)]/20 text-[var(--status-present-text)] font-medium flex items-center gap-3">
                      <FiCheck className="text-xl" /> {message}
                    </div>
                  )}
                  
                  <div className="grid gap-3">
                    {markedStudents.map((student) => (
                      <Motion.div 
                        key={student.rollNo || student.studentName}
                        initial={{opacity:0, x:-20}}
                        animate={{opacity:1, x:0}}
                        className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-text)] font-bold text-sm shadow-lg">
                            {student.studentName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[var(--text-main)]">{student.studentName}</p>
                            <p className="text-xs text-[var(--text-muted)] font-semibold">{student.rollNo || "No ID"}</p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[var(--status-present-bg)] flex items-center justify-center text-[var(--status-present-text)]">
                          <FiCheck />
                        </div>
                      </Motion.div>
                    ))}
                  </div>
                </Motion.div>
              )}

              {/* Diagnosis Results */}
              {diagnosisResults && !reviewMode && !showResults && (
                <Motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--text-muted)]">
                      Threshold: <strong className="text-[var(--text-main)]">{diagnosisResults.threshold}</strong> | 
                      Gap: <strong className="text-[var(--text-main)]">{diagnosisResults.maxGap}</strong>
                    </p>
                    <button 
                      onClick={() => setDiagnosisResults(null)} 
                      className="p-1 rounded-full hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                  
                  {diagnosisResults.faces?.map((face, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-[var(--text-main)]">Face #{idx + 1}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          face.isMatch 
                            ? "bg-[var(--status-present-bg)] text-[var(--status-present-text)]" 
                            : "bg-[var(--status-absent-bg)] text-[var(--status-absent-text)]"
                        }`}>
                          {face.isMatch ? face.bestMatch?.name : "Unknown"}
                        </span>
                      </div>
                      
                      {/* Top candidates */}
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--text-muted)] font-bold uppercase">Top Matches:</p>
                        {face.allCandidates?.slice(0, 3).map((candidate, cIdx) => (
                          <div key={cIdx} className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text-main)]">{candidate.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-[var(--bg-app)] rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    candidate.minDistance <= 0.35 ? "bg-green-500" :
                                    candidate.minDistance <= 0.50 ? "bg-yellow-500" :
                                    candidate.minDistance <= 0.60 ? "bg-orange-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${Math.max(5, (1 - candidate.minDistance) * 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-mono ${
                                candidate.minDistance <= 0.35 ? "text-green-500" :
                                candidate.minDistance <= 0.50 ? "text-yellow-500" :
                                candidate.minDistance <= 0.60 ? "text-orange-500" : "text-red-500"
                              }`}>
                                {candidate.minDistance.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Recommendations */}
                      {face.recommendations?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                          <p className="text-xs text-[var(--text-muted)] font-bold uppercase mb-1">Recommendations:</p>
                          {face.recommendations.map((rec, rIdx) => (
                            <p key={rIdx} className="text-xs text-[var(--color-primary)]">• {rec}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Correction Modal */}
      <CorrectionModal
        isOpen={correctionModal.open}
        onClose={() => setCorrectionModal({ open: false, faceIndex: null, currentMatch: null })}
        onSave={handleSaveCorrection}
        faceIndex={correctionModal.faceIndex}
        currentMatch={correctionModal.currentMatch}
        enrolledStudents={enrolledStudents}
      />
    </Motion.div>
  );
};

export default AttendanceUploader;

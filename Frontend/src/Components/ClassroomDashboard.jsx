import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { 
  FiPlus, FiUsers, FiEdit2, FiTrash2, FiX, 
  FiFolder, FiChevronRight, FiCalendar
} from "react-icons/fi";
import { useClassroom } from "../context/ClassroomContext";

export default function ClassroomDashboard() {
  const navigate = useNavigate();
  const { 
    classrooms, 
    loading, 
    createClassroom, 
    updateClassroom, 
    deleteClassroom,
    selectClassroom 
  } = useClassroom();

  const [showModal, setShowModal] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const openCreateModal = () => {
    setEditingClassroom(null);
    setFormData({ name: "", description: "" });
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (classroom, e) => {
    e.stopPropagation();
    setEditingClassroom(classroom);
    setFormData({ name: classroom.name, description: classroom.description || "" });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClassroom(null);
    setFormData({ name: "", description: "" });
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      if (editingClassroom) {
        await updateClassroom(editingClassroom._id, formData.name, formData.description);
      } else {
        await createClassroom(formData.name, formData.description);
      }
      closeModal();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteClassroom(id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleClassroomClick = (classroom) => {
    selectClassroom(classroom);
    navigate(`/classroom/${classroom._id}`);
  };

  if (loading) {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">My Classrooms</h1>
          <p className="text-[var(--text-muted)] mt-1">Manage your classes and track attendance</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary px-4 py-2.5 rounded-xl flex items-center gap-2"
        >
          <FiPlus /> New Classroom
        </button>
      </div>

      {/* Empty State */}
      {classrooms.length === 0 ? (
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center"
        >
          <div className="h-16 w-16 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-4">
            <FiFolder className="text-3xl text-[var(--color-primary)]" />
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-main)] mb-2">
            No classrooms yet
          </h3>
          <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
            Create your first classroom to start enrolling students and tracking attendance.
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary px-6 py-3 rounded-xl inline-flex items-center gap-2"
          >
            <FiPlus /> Create Your First Classroom
          </button>
        </Motion.div>
      ) : (
        /* Classroom Grid */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map((classroom, index) => (
            <Motion.div
              key={classroom._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleClassroomClick(classroom)}
              className="glass-card p-5 cursor-pointer group hover:border-[var(--color-primary)]/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                  <FiFolder className="text-xl text-[var(--color-primary)]" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => openEditModal(classroom, e)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(classroom);
                    }}
                    className="p-2 rounded-lg hover:bg-[var(--status-absent-bg)] text-[var(--text-muted)] hover:text-[var(--status-absent-text)] transition-colors"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-[var(--text-main)] mb-1 group-hover:text-[var(--color-primary)] transition-colors">
                {classroom.name}
              </h3>
              {classroom.description && (
                <p className="text-sm text-[var(--text-muted)] mb-3 line-clamp-2">
                  {classroom.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <FiUsers size={14} />
                    {classroom.studentCount || 0} students
                  </span>
                </div>
                <FiChevronRight className="text-[var(--text-muted)] group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all" />
              </div>
            </Motion.div>
          ))}

          {/* Add Classroom Card */}
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: classrooms.length * 0.05 }}
            onClick={openCreateModal}
            className="glass-card p-5 cursor-pointer border-dashed hover:border-[var(--color-primary)] transition-colors flex flex-col items-center justify-center min-h-[180px] text-[var(--text-muted)] hover:text-[var(--color-primary)]"
          >
            <FiPlus className="text-3xl mb-2" />
            <span className="font-medium">Add Classroom</span>
          </Motion.div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          >
            <Motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-[var(--text-main)]">
                  {editingClassroom ? "Edit Classroom" : "Create Classroom"}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]"
                >
                  <FiX />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--status-absent-bg)] text-[var(--status-absent-text)] text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Classroom Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Class 10A - Mathematics"
                    className="input-premium w-full px-4 py-3"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add a brief description..."
                    rows={3}
                    className="input-premium w-full px-4 py-3 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 btn-primary px-4 py-3 rounded-xl"
                  >
                    {formLoading ? (
                      <div className="w-5 h-5 border-2 border-[var(--color-primary-text)] border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : editingClassroom ? (
                      "Save Changes"
                    ) : (
                      "Create Classroom"
                    )}
                  </button>
                </div>
              </form>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <Motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 w-full max-w-sm text-center"
            >
              <div className="h-14 w-14 rounded-full bg-[var(--status-absent-bg)] flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="text-2xl text-[var(--status-absent-text)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-main)] mb-2">
                Delete Classroom?
              </h3>
              <p className="text-[var(--text-muted)] text-sm mb-6">
                This will permanently delete "{deleteConfirm.name}" and all its students and attendance records. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm._id)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--status-absent-text)] text-white hover:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
}

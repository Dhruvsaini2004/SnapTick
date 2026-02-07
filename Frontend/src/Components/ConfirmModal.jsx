import React from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { FiAlertTriangle, FiTrash2, FiX } from "react-icons/fi";

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger" // "danger" | "warning" | "info"
}) {
  const typeStyles = {
    danger: {
      icon: FiTrash2,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-400",
      confirmBtn: "bg-red-500 hover:bg-red-600 text-white"
    },
    warning: {
      icon: FiAlertTriangle,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      confirmBtn: "bg-amber-500 hover:bg-amber-600 text-white"
    },
    info: {
      icon: FiAlertTriangle,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      confirmBtn: "bg-blue-500 hover:bg-blue-600 text-white"
    }
  };

  const style = typeStyles[type] || typeStyles.danger;
  const Icon = style.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <Motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card p-6 w-full max-w-sm text-center"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]"
            >
              <FiX size={18} />
            </button>

            <div className={`h-14 w-14 rounded-full ${style.iconBg} flex items-center justify-center mx-auto mb-4`}>
              <Icon className={`text-2xl ${style.iconColor}`} />
            </div>
            
            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-2">
              {title}
            </h3>
            
            <p className="text-[var(--text-muted)] text-sm mb-6">
              {message}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors font-medium"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${style.confirmBtn}`}
              >
                {confirmText}
              </button>
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

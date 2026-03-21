
import React, { useState } from 'react';
import ErrorMessage from './ErrorMessage';
import type { Project, UpdateProjectPayload, TaskPriority, ProjectStatus } from '../types';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onSave: (projectData: UpdateProjectPayload) => Promise<void>;
}

const formElementClasses = "w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors";

const formatDateForInput = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    // Dataverse can return dates in ISO 8601 format (e.g., "2024-07-26T00:00:00Z")
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ''; // Check for invalid date
    // Return in YYYY-MM-DD format required by the input type="date"
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error("Failed to parse date string for input:", dateString, e);
    return '';
  }
};

const FormRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
);

const FormField: React.FC<{ label: string; id: string; children: React.ReactNode; required?: boolean }> = ({ label, id, children, required }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
            {label} {required && <span className="text-red-400">*</span>}
        </label>
        {children}
    </div>
);

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    ai_name: project.ai_name,
    crdfd_description: project.crdfd_description || '',
    crdfd_requester: project.requester || '',
    crdfd_priority: (project.crdfd_priority as TaskPriority) || 'N/A',
    crdfd_processstatus: (project.crdfd_processstatus as ProjectStatus) || 'Backlog',
    crdfd_user: project.itStaff?.join(', ') || '',
    wcg_group_chat: project.wcg_group_chat || '',
    crdfd_user_guide: project.crdfd_user_guide || '',
    crdfd_technical_docs: project.crdfd_technical_docs || '',
    crdfd_processurl: project.crdfd_processurl || '',
    crdfd_allstepurl: project.crdfd_allstepurl || '',
    wcg_start_date: formatDateForInput(project.wcg_start_date),
    crdfd_end_date: formatDateForInput(project.crdfd_end_date),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ai_name.trim()) {
      setError("Project name is required.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <header className="p-4 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Edit Project Details</h2>
          </header>
          <main className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <FormField label="Project Name" id="ai_name" required>
                <input
                    type="text" id="ai_name" name="ai_name" value={formData.ai_name}
                    onChange={handleInputChange} disabled={isLoading} required autoFocus
                    className={formElementClasses}
                />
            </FormField>
             <FormField label="Description" id="crdfd_description">
                <textarea
                    id="crdfd_description" name="crdfd_description" value={formData.crdfd_description}
                    onChange={handleInputChange} disabled={isLoading} rows={4}
                    className={formElementClasses}
                />
            </FormField>

            <FormRow>
                <FormField label="Requester" id="crdfd_requester">
                    <input type="text" id="crdfd_requester" name="crdfd_requester" value={formData.crdfd_requester} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
                <FormField label="IT Staff" id="crdfd_user">
                     <input type="text" id="crdfd_user" name="crdfd_user" value={formData.crdfd_user} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
            </FormRow>

            <FormRow>
                 <FormField label="Start Date" id="wcg_start_date">
                    <input type="date" id="wcg_start_date" name="wcg_start_date" value={formData.wcg_start_date} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
                <FormField label="End Date" id="crdfd_end_date">
                    <input type="date" id="crdfd_end_date" name="crdfd_end_date" value={formData.crdfd_end_date} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
            </FormRow>

            <FormRow>
                 <FormField label="Priority" id="crdfd_priority">
                    <select id="crdfd_priority" name="crdfd_priority" value={formData.crdfd_priority} onChange={handleInputChange} disabled={isLoading} className={formElementClasses}>
                        <option>N/A</option>
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                    </select>
                </FormField>
                 <FormField label="Status" id="crdfd_processstatus">
                    <select id="crdfd_processstatus" name="crdfd_processstatus" value={formData.crdfd_processstatus} onChange={handleInputChange} disabled={isLoading} className={formElementClasses}>
                        <option>Planning</option>
                        <option>Active</option>
                        <option>Backlog</option>
                        <option>Maintenance</option>
                        <option>Completed / Closed</option>
                    </select>
                </FormField>
            </FormRow>

            <FormField label="Group Chat" id="wcg_group_chat">
                <input type="text" id="wcg_group_chat" name="wcg_group_chat" value={formData.wcg_group_chat} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
            </FormField>
            
            <h3 className="text-lg font-semibold text-white pt-4 border-t border-slate-700">Links & Documents</h3>
            <FormRow>
                 <FormField label="User Guide URL" id="crdfd_user_guide">
                    <input type="url" id="crdfd_user_guide" name="crdfd_user_guide" value={formData.crdfd_user_guide} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
                <FormField label="Technical Docs URL" id="crdfd_technical_docs">
                    <input type="url" id="crdfd_technical_docs" name="crdfd_technical_docs" value={formData.crdfd_technical_docs} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
            </FormRow>
            <FormRow>
                <FormField label="Process URL" id="crdfd_processurl">
                    <input type="url" id="crdfd_processurl" name="crdfd_processurl" value={formData.crdfd_processurl} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
                <FormField label="All Steps URL" id="crdfd_allstepurl">
                    <input type="url" id="crdfd_allstepurl" name="crdfd_allstepurl" value={formData.crdfd_allstepurl} onChange={handleInputChange} disabled={isLoading} className={formElementClasses} />
                </FormField>
            </FormRow>

            {error && <ErrorMessage message={error} />}
          </main>
          <footer className="p-4 border-t border-slate-700 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-slate-200 transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-md text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;



import React from 'react';
import type { Project } from '../types';

interface ProjectListProps {
  projects: Project[];
  currentView: 'dashboard' | 'project';
  selectedProjectId: string | null;
  onSelectView: (view: 'dashboard' | 'project', projectId?: string) => void;
  isLoading: boolean;
  onAddProject: () => void;
  isAuthenticated: boolean;
  canEdit: boolean;
  onLoginRequest: () => void;
  onLogout: () => void;
}

const NavSkeleton: React.FC = () => (
  <div className="px-2 space-y-6">
    {[...Array(3)].map((_, i) => (
      <div key={i}>
        <div className="h-4 bg-slate-700 rounded w-2/5 mb-4"></div>
        <div className="space-y-2">
          {[...Array(3)].map((_, j) => (
            <div key={j} className="h-8 bg-slate-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    ))}
  </div>
);


const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}> = ({ label, icon, isSelected, onClick }) => (
  <li
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-base font-medium transition-colors ${
      isSelected
        ? 'bg-slate-700 text-white'
        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
    }`}
    aria-current={isSelected ? 'page' : undefined}
  >
    {icon}
    <span>{label}</span>
  </li>
);


const ProjectList: React.FC<ProjectListProps> = ({ projects, currentView, selectedProjectId, onSelectView, isLoading, onAddProject, isAuthenticated, canEdit, onLoginRequest, onLogout }) => {
  
  const [showCompleted, setShowCompleted] = React.useState(false);

  const categorizedProjects = {
    'ACTIVE PROJECTS': projects.filter(p => p.category === 'ACTIVE'),
    'MAINTENANCE / FIXES': projects.filter(p => p.category === 'MAINTENANCE'),
    'PLANNED PROJECTS': projects.filter(p => p.category === 'PLANNED'),
  };

  const completedProjects = projects.filter(p => p.category === 'COMPLETED');

  return (
    <div className="bg-slate-800 h-full flex flex-col p-4 rounded-lg">
       <div className="px-2 mb-6">
           <button
             onClick={isAuthenticated ? onLogout : onLoginRequest}
             className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-slate-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
             title={isAuthenticated ? "Logout" : "Admin Login"}
           >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <h1 className="text-xl font-bold text-white">Project Tracker</h1>
           </button>
      </div>
      <nav className="flex-1 space-y-6">
        <ul>
            <NavItem 
                label="Dashboard"
                isSelected={currentView === 'dashboard'}
                onClick={() => onSelectView('dashboard')}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>}
            />
        </ul>
        {isLoading ? (
            <NavSkeleton />
        ) : (
            Object.entries(categorizedProjects).map(([category, projectList]) => (
                projectList.length > 0 && (
                    <div key={category}>
                        <h3 className="px-3 mb-2 text-sm font-semibold tracking-wider text-slate-400 uppercase">{category}</h3>
                        <ul className="space-y-1">
                            {projectList.map(project => (
                                <li 
                                    key={project.ai_processid}
                                    onClick={() => onSelectView('project', project.ai_processid)}
                                    className={`px-3 py-2 rounded-md cursor-pointer text-base font-medium transition-colors truncate ${
                                        selectedProjectId === project.ai_processid && currentView === 'project'
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                                    }`}
                                    aria-current={selectedProjectId === project.ai_processid ? 'page' : undefined}
                                >
                                    {project.ai_name}
                                </li>
                            ))
                            }
                        </ul>
                    </div>
                )
            ))
        )}
        {/* Completed Projects - Collapsible */}
        {!isLoading && completedProjects.length > 0 && (
            <div>
                <button
                    onClick={() => setShowCompleted(prev => !prev)}
                    className="w-full flex items-center justify-between px-3 mb-2 text-sm font-semibold tracking-wider text-slate-400 uppercase hover:text-slate-200 transition-colors"
                >
                    <span>COMPLETED</span>
                    <span className="flex items-center gap-1">
                        <span className="bg-slate-700 text-slate-300 text-xs rounded-full px-1.5 py-0.5">{completedProjects.length}</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-3.5 w-3.5 transition-transform ${showCompleted ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </span>
                </button>
                {showCompleted && (
                    <ul className="space-y-1">
                        {completedProjects.map(project => (
                            <li
                                key={project.ai_processid}
                                onClick={() => onSelectView('project', project.ai_processid)}
                                className={`px-3 py-2 rounded-md cursor-pointer text-base font-medium transition-colors truncate ${
                                    selectedProjectId === project.ai_processid && currentView === 'project'
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                }`}
                                aria-current={selectedProjectId === project.ai_processid ? 'page' : undefined}
                            >
                                {project.ai_name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )}
      </nav>
      <div className="mt-auto">
        {canEdit && (
            <button 
                onClick={onAddProject}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span>Add Project</span>
            </button>
        )}
      </div>
    </div>
  );
};

export default ProjectList;
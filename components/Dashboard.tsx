import React, { useMemo } from 'react';
import type { Project, Task } from '../types';
import Card from './Card';
import ProjectCard, { ProjectCardSkeleton } from './ProjectCard';

interface LoggedInUser {
    id: string;
    name: string;
}

interface DashboardProps {
    projects: Project[];
    allTasks: Task[];
    onSelectProject: (projectId: string) => void;
    isLoading: boolean;
    loggedInUser: LoggedInUser | null;
    onGenerateReport: () => void;
    selectedDepartment?: number | number[];
    onDepartmentChange: (dep?: number | number[]) => void;
}

const SummaryCard: React.FC<{ icon: React.ReactNode, title: string, children: React.ReactNode }> = ({ icon, title, children }) => (
    <Card className="flex flex-col">
        <div className="flex items-center gap-3">
            <span className="flex-shrink-0 bg-slate-700 p-2 rounded-lg">{icon}</span>
            <h3 className="font-semibold text-white">{title}</h3>
        </div>
        <div className="mt-3 text-sm text-slate-400 flex-1">
            {children}
        </div>
    </Card>
)

const ActionButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
    <button
        onClick={onClick}
        title={title}
        className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    >
        {children}
    </button>
);

// Department Options
// Removed 'All' option. General and Logistics are primary buttons.
const DEP_OPTIONS = [
    { label: 'General', value: 191920006 },
    { label: 'Logistics', value: 191920002 },
    { label: 'Procurement', value: 191920001 },
    { label: 'Sales', value: 191920000 },
    { label: 'Finance', value: 191920003 },
    { label: 'HR', value: 191920004 },
];

const Dashboard: React.FC<DashboardProps> = ({ projects, allTasks, onSelectProject, isLoading, loggedInUser, onGenerateReport, selectedDepartment, onDepartmentChange }) => {
    const activeProjects = projects.filter(p => p.category === 'ACTIVE');

    const projectsWithBlockers = useMemo(() => {
        const activeProjectIds = new Set(projects.filter(p => p.category === 'ACTIVE').map(p => p.ai_processid));
        const pendingTasks = allTasks.filter(task =>
            task.status === 'Pending' && task.projectId && activeProjectIds.has(task.projectId)
        );

        const blockersByProject = pendingTasks.reduce((acc, task) => {
            if (!task.projectId) return acc;
            if (!acc[task.projectId]) {
                const project = projects.find(p => p.ai_processid === task.projectId);
                acc[task.projectId] = {
                    projectId: task.projectId,
                    projectName: project ? project.ai_name : 'Unknown Project',
                    blockerTasks: []
                };
            }
            acc[task.projectId].blockerTasks.push(task.name);
            return acc;
        }, {} as Record<string, { projectId: string; projectName: string; blockerTasks: string[] }>);

        return Object.values(blockersByProject);
    }, [allTasks, projects]);

    const isSelected = (val: number | undefined) => {
        if (val === undefined) return selectedDepartment === undefined;
        if (Array.isArray(selectedDepartment)) return selectedDepartment.includes(val);
        return selectedDepartment === val;
    };

    const getLabelForSelection = () => {
        if (selectedDepartment === undefined) return 'Project Tracker';
        if (Array.isArray(selectedDepartment)) {
            return 'Group View';
        }
        return DEP_OPTIONS.find(o => o.value === selectedDepartment)?.label || 'Selected Department';
    };

    return (
        <div className="p-6 lg:p-8 space-y-8">
            <div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Project Dashboard</h1>
                        <p className="mt-1 text-slate-400">A high-level overview of all ongoing initiatives.</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        {loggedInUser && (
                            <span className="text-sm text-slate-400">
                                Welcome, <span className="font-semibold text-white">{loggedInUser.name}</span>
                            </span>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex items-center shadow-sm">
                                <span className="px-3 text-xs font-bold text-slate-500 uppercase tracking-tight hidden sm:block">Filter:</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onDepartmentChange(null as unknown as number)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedDepartment === null
                                            ? 'bg-cyan-600 text-white shadow-lg'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                            }`}
                                    >
                                        All
                                    </button>
                                    {DEP_OPTIONS.slice(0, 2).map(opt => (
                                        <button
                                            key={opt.label}
                                            onClick={() => onDepartmentChange(opt.value)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isSelected(opt.value)
                                                ? 'bg-cyan-600 text-white shadow-lg'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                    <select
                                        className="bg-transparent border-none text-xs font-bold text-slate-400 focus:ring-0 cursor-pointer hover:text-white ml-2"
                                        value={Array.isArray(selectedDepartment) ? '' : (selectedDepartment || '')}
                                        onChange={(e) => onDepartmentChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                        title="Select department filter"
                                        aria-label="Select department filter"
                                    >
                                        <option value="" className="bg-slate-900" disabled={!Array.isArray(selectedDepartment)}>
                                            {Array.isArray(selectedDepartment) ? 'Grouped' : 'More...'}
                                        </option>
                                        {DEP_OPTIONS.slice(2).map(opt => (
                                            <option key={opt.label} value={opt.value} className="bg-slate-900">{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {loggedInUser && (
                                <div className="flex items-center gap-2">
                                    <ActionButton title="Weekly Report" onClick={onGenerateReport}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                                        </svg>
                                    </ActionButton>
                                    <ActionButton title="Trích Xuất Dữ Liệu" onClick={() => alert('Feature coming soon.')}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </ActionButton>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SummaryCard
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    title="Weekly Sync-Up"
                >
                    <p><strong className="text-slate-300">Schedule:</strong> Tuesday & Thursday, 30 minutes</p>
                    <p><strong className="text-slate-300">Purpose:</strong> Discuss progress, priorities, and any emerging issues.</p>
                    <p><strong className="text-slate-300">Assigned:</strong> Monthly summary of all project data for management.</p>
                </SummaryCard>
                <SummaryCard
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    title="Blockers / Pending Tasks"
                >
                    {projectsWithBlockers.length > 0 ? (
                        <ul className="space-y-2 -my-1">
                            {projectsWithBlockers.map(item => (
                                <li key={item.projectId}>
                                    <button
                                        onClick={() => onSelectProject(item.projectId)}
                                        className="text-left w-full hover:bg-slate-700/50 p-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                                    >
                                        <strong className="text-slate-200 block truncate">{item.projectName}</strong>
                                        <p className="text-xs text-yellow-400 truncate">{item.blockerTasks.join(', ')}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        "The backlog is clear! No pending tasks."
                    )}
                </SummaryCard>
                <SummaryCard
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    title="Recent Achievements"
                >
                    <p><strong className="text-slate-300">Logistics Optimization:</strong> Fulfillment systems are now showing real-time inventory updates across warehouses.</p>
                    <p className="mt-2 text-xs opacity-75">Switch to the specific department view to see details.</p>
                </SummaryCard>
            </div>

            <div>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-white">
                        {getLabelForSelection()}
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">{activeProjects.length} items</span>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {isLoading ? (
                        [...Array(3)].map((_, i) => <ProjectCardSkeleton key={i} />)
                    ) : (
                        activeProjects.map(project => {
                            const projectTasks = allTasks.filter(task => task.projectId === project.ai_processid);
                            return (
                                <ProjectCard
                                    key={project.ai_processid}
                                    project={project}
                                    tasks={projectTasks}
                                    onSelectProject={onSelectProject}
                                />
                            );
                        })
                    )}
                </div>
                {!isLoading && activeProjects.length === 0 && (
                    <div className="mt-6 text-center text-slate-400 py-16 bg-slate-900/50 rounded-lg border border-dashed border-slate-800">
                        <p>No active projects found for this filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
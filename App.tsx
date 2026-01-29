import React, { useState, useEffect, useCallback } from 'react';
import ProjectList from './components/ProjectList';
import ErrorMessage from './components/ErrorMessage';
import LoadingSpinner from './components/LoadingSpinner';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import AddProjectModal from './components/AddProjectModal';
import LoginModal from './components/LoginModal';
import WeeklyReportModal from './components/WeeklyReportModal';
import { getAccessToken, getProjects, getProductMembers, createProject, createTask, getWeCareSystems, getTasksForProjects } from './services/dataverseService';
import { DEFAULT_TASKS } from './constants';
import type { Project, ProductMember, NewProjectPayload, NewTaskPayload, WeCareSystem, Task } from './types';

interface LoggedInUser {
  id: string;
  name: string;
}

const USER_DEPARTMENT_MAP: { [userId: string]: number } = {
  '399bde80-1c54-ed11-9562-000d3ac7ccec': 191920006, // Hieu Le Hoang -> General
  '829bde80-1c54-ed11-9562-000d3ac7ccec': 191920006, // Hoàng Trần -> General
  '12b2dda8-e49f-ef11-8a69-000d3ac8d88c': 191920002, // Thông Cao Văn -> Logistics
  '106ab015-d788-ee11-be36-000d3aa3f53e': 191920001, // Hoàng Nguyễn Minh -> Procument
  'dced0234-5bb0-ef11-b8e8-000d3ac7ae9c': 191920001, // Nghĩa Phan Trọng -> Procument
  '654a811b-7a8f-f011-b4cc-0022485a6354': 191920003, // Lê Văn Thơ -> Finance
};

const LOGISTICS_DEP_ID = 191920002;
const GENERAL_DEP_ID = 191920006;

// Default View: General per user request
const DEFAULT_DEP_FILTER = GENERAL_DEP_ID;

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [productMembers, setProductMembers] = useState<ProductMember[]>([]);
  const [weCareSystems, setWeCareSystems] = useState<WeCareSystem[]>([]);
  const [view, setView] = useState<'dashboard' | 'project'>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Defaulting to General department
  // null = "All" selected explicitly, undefined = initial state (use user default)
  const [departmentFilter, setDepartmentFilter] = useState<number | number[] | null | undefined>(DEFAULT_DEP_FILTER);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = loggedInUser !== null;

  const fetchInitialData = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const token = await getAccessToken();
      setAccessToken(token);

      const [fetchedMembers, fetchedSystems] = await Promise.all([
        getProductMembers(token),
        getWeCareSystems(token),
      ]);
      setProductMembers(fetchedMembers);
      setWeCareSystems(fetchedSystems);

      let depToFetch: number | number[] | undefined = undefined;

      if (departmentFilter === null) {
        // "All" selected explicitly - fetch all departments
        depToFetch = undefined;
      } else if (departmentFilter !== undefined) {
        // Specific department(s) selected
        depToFetch = departmentFilter;
      } else if (loggedInUser) {
        // Initial state (undefined) - use user default
        depToFetch = USER_DEPARTMENT_MAP[loggedInUser.id];
      }

      const fetchedProjects = await getProjects(token, depToFetch);
      setProjects(fetchedProjects);

      if (fetchedProjects.length > 0) {
        const projectIds = fetchedProjects.map(p => p.ai_processid);
        const fetchedTasks = await getTasksForProjects(projectIds, token);
        setAllTasks(fetchedTasks);
      } else {
        setAllTasks([]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [loggedInUser, departmentFilter]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleLogin = (user: LoggedInUser) => {
    setLoggedInUser(user);
    setDepartmentFilter(USER_DEPARTMENT_MAP[user.id]);
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setDepartmentFilter(DEFAULT_DEP_FILTER);
  };

  const handleSelectView = (newView: 'dashboard' | 'project', projectId?: string) => {
    setView(newView);
    if (newView === 'project' && projectId) {
      setSelectedProjectId(projectId);
    } else if (newView === 'dashboard') {
      setSelectedProjectId(null);
    }
    setIsSidebarOpen(false);
  };

  const handleAddProject = async (projectData: NewProjectPayload) => {
    if (!accessToken || !loggedInUser) {
      throw new Error("Authentication token or User ID is not available.");
    }

    try {
      const newProject = await createProject(projectData, accessToken, loggedInUser.id);
      const newProjectId = newProject.ai_processid;

      const taskCreationPromises = DEFAULT_TASKS.map(task => {
        const taskPayload: NewTaskPayload = {
          name: task.name,
          description: task.description,
          projectId: newProjectId,
          status: 'To Do',
          priority: 'Medium'
        };
        return createTask(taskPayload, accessToken, loggedInUser.id);
      });
      await Promise.all(taskCreationPromises);

      setIsAddProjectModalOpen(false);
      await fetchInitialData();
      handleSelectView('project', newProjectId);

    } catch (err) {
      console.error("Failed to create project with default tasks:", err);
      throw err;
    }
  };

  const selectedProject = projects.find(p => p.ai_processid === selectedProjectId) || null;

  const renderMainContent = () => {
    if (isLoading && projects.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner message="Đang tải dữ liệu..." />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <ErrorMessage message={error} />
        </div>
      );
    }

    if (view === 'project') {
      if (selectedProject && accessToken) {
        return <ProjectDetail
          key={selectedProject.ai_processid}
          project={selectedProject}
          accessToken={accessToken}
          productMembers={productMembers}
          onProjectUpdate={fetchInitialData}
          isAuthenticated={isAuthenticated}
          loggedInUserId={loggedInUser?.id || null}
        />;
      }
    }

    return <Dashboard
      projects={projects}
      allTasks={allTasks}
      onSelectProject={(projectId) => handleSelectView('project', projectId)}
      isLoading={isLoading}
      loggedInUser={loggedInUser}
      onGenerateReport={() => setIsReportModalOpen(true)}
      selectedDepartment={departmentFilter}
      onDepartmentChange={setDepartmentFilter}
    />;
  };

  return (
    <>
      <div className="min-h-screen font-sans text-slate-300 lg:grid lg:grid-cols-[296px_1fr]">
        {isSidebarOpen && (
          <div className="lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 z-30"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            ></div>
            <aside className="fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 p-4">
              <ProjectList
                projects={projects}
                currentView={view}
                selectedProjectId={selectedProjectId}
                onSelectView={handleSelectView}
                isLoading={isLoading && projects.length === 0}
                isAuthenticated={isAuthenticated}
                onAddProject={() => {
                  setIsSidebarOpen(false);
                  setIsAddProjectModalOpen(true);
                }}
                onLoginRequest={() => {
                  setIsSidebarOpen(false);
                  setIsLoginModalOpen(true);
                }}
                onLogout={handleLogout}
              />
            </aside>
          </div>
        )}

        <aside className="h-screen sticky top-0 bg-slate-900 pt-4 pb-4 pl-4 hidden lg:block">
          <ProjectList
            projects={projects}
            currentView={view}
            selectedProjectId={selectedProjectId}
            onSelectView={handleSelectView}
            isLoading={isLoading && projects.length === 0}
            isAuthenticated={isAuthenticated}
            onAddProject={() => setIsAddProjectModalOpen(true)}
            onLoginRequest={() => setIsLoginModalOpen(true)}
            onLogout={handleLogout}
          />
        </aside>

        <main className="h-screen overflow-y-auto bg-slate-900">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 p-4 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 lg:hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 text-slate-400 hover:text-white"
              aria-label="Mở menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-white truncate">
              {view === 'dashboard' ? 'Dashboard' : (selectedProject?.ai_name || 'Chi tiết dự án')}
            </h2>
            <div className="w-6" />
          </header>
          {renderMainContent()}
        </main>
      </div>
      {isAuthenticated && isAddProjectModalOpen && (
        <AddProjectModal
          onClose={() => setIsAddProjectModalOpen(false)}
          onSave={handleAddProject}
          weCareSystems={weCareSystems}
        />
      )}
      {isAuthenticated && isReportModalOpen && accessToken && (
        <WeeklyReportModal
          onClose={() => setIsReportModalOpen(false)}
          productMembers={productMembers}
          accessToken={accessToken}
          loggedInUser={loggedInUser}
        />
      )}
      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={handleLogin}
        />
      )}
    </>
  );
};

export default App;
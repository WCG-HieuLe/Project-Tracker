

export type ProjectCategory = 'ACTIVE' | 'MAINTENANCE' | 'PLANNED' | 'COMPLETED';
export type ProjectStatus = 'Planning' | 'Active' | 'Backlog' | 'Maintenance' | 'Completed / Closed';

export interface Project {
  // Core fields
  ai_processid: string;
  ai_name: string;
  createdon: string;
  'createdon@OData.Community.Display.V1.FormattedValue': string;
  
  // Fields from Grid Definition
  category: ProjectCategory;
  crdfd_processurl?: string;
  crdfd_allstepurl?: string;
  crdfd_description?: string;
  department?: string;
  system?: string;
  user?: string; // Owner
  crdfd_objectives?: string;
  cr1bb_fullcontext?: string;
  requester?: string;
  wcg_group_chat?: string;
  crdfd_user_guide?: string;
  crdfd_technical_docs?: string;
  crdfd_priority?: string;
  'crdfd_priority@OData.Community.Display.V1.FormattedValue'?: string;
  wcg_start_date?: string;
  'wcg_start_date@OData.Community.Display.V1.FormattedValue'?: string;
  crdfd_end_date?: string;
  'crdfd_end_date@OData.Community.Display.V1.FormattedValue'?: string;
  crdfd_processstatus?: ProjectStatus;
  'crdfd_processstatus@OData.Community.Display.V1.FormattedValue'?: string;


  // --- Deprecated / Mocked fields ---
  // These are kept for potential reference but new data should use the fields above
  itStaff?: string[]; 
  progress?: {
    currentStep: string;
    nextStep: string;
    blockers: string;
  };
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Completed' | 'Pending' | 'Unknown' | 'Cancelled';
export type TaskPriority = 'High' | 'Medium' | 'Low' | 'N/A';

export interface TechResource {
  id: string;
  name: string;
  type?: string;
  version?: string;
  description?: string;
  resourceLink?: string;
  resourceJson?: string;
}

export interface NewTechResourcePayload {
  name: string;
  type?: string;
  version?: string;
  description?: string;
  resourceLink?: string;
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  assignee: string; // The assignee's name for display
  assigneeId?: string; // The assignee's ID for editing
  dueDate: string;
  endDateRaw?: string; // ISO String for reliable sorting

  // Detailed fields from Dataverse
  project: string;
  projectId?: string;
  description: string;
  startDate: string;
  startDateRaw?: string; // ISO String for reliable sorting
  priority: TaskPriority;
  createdOn: string;
  createdOnDate: string; // ISO String for sorting
  proofOfComplete?: string;
  techResource?: TechResource;
}

export interface ProductMember {
    id: string;
    name: string;
}

export interface WeCareSystem {
    id: string;
    name: string;
}


export interface DataverseCollectionResponse<T> {
  value: T[];
}

export interface NewTaskPayload {
  name: string;
  description?: string;
  projectId: string;
  startDate?: string;
  endDate?: string;
  // New comprehensive fields
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface UpdateTaskPayload {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  // New comprehensive fields
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  proofOfComplete?: string;
  techResourceId?: string | null;
}

export interface NewProjectPayload {
  ai_name: string;
  crdfd_description?: string;
  crdfd_requester?: string;
  crdfd_priority?: TaskPriority;
  crdfd_user?: string; // IT Staff is a single text field in Dataverse
  wcg_group_chat?: string;
  crdfd_user_guide?: string;
  crdfd_technical_docs?: string;
  crdfd_processurl?: string;
  crdfd_allstepurl?: string;
  wcg_start_date?: string;
  crdfd_end_date?: string;
  crdfd_systemid?: string;
  crdfd_department_?: number;
  crdfd_processstatus?: ProjectStatus;
}

export interface UpdateProjectPayload {
  ai_name?: string;
  crdfd_description?: string;
  crdfd_requester?: string;
  crdfd_priority?: TaskPriority;
  crdfd_user?: string; // IT Staff is a single text field in Dataverse
  wcg_group_chat?: string;
  crdfd_user_guide?: string;
  crdfd_technical_docs?: string;
  crdfd_processurl?: string;
  crdfd_allstepurl?: string;
  wcg_start_date?: string;
  crdfd_end_date?: string;
  crdfd_processstatus?: ProjectStatus;
}
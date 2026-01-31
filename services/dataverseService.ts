import { ACCESS_TOKEN_URL, DATAVERSE_BASE_URL, PROJECTS_ENTITY_SET, TASKS_ENTITY_SET, TECH_RESOURCES_ENTITY_SET, TECH_RESOURCE_TYPE_MAPPING } from '../constants';
import type { Project, DataverseCollectionResponse, ProjectCategory, Task, TaskStatus, NewTaskPayload, UpdateTaskPayload, TaskPriority, ProductMember, UpdateProjectPayload, NewProjectPayload, WeCareSystem, ProjectStatus, TechResource, NewTechResourcePayload } from '../types';

/**
 * Converts a 'YYYY-MM-DD' date string to a full ISO 8601 UTC string.
 */
const convertDateToUtcPlus7 = (dateString: string | undefined, timeType: 'start' | 'end'): string | undefined => {
    if (!dateString) {
        return undefined;
    }
    try {
        const time = timeType === 'start' ? '08:00:00' : '17:00:00';
        const isoStringWithOffset = `${dateString}T${time}+07:00`;
        const date = new Date(isoStringWithOffset);
        if (isNaN(date.getTime())) {
            return undefined;
        }
        return date.toISOString();
    } catch {
        return undefined;
    }
};

/**
 * Formats an ISO date string into a localized date string.
 */
const formatDateOnly = (isoString?: string): string => {
    if (!isoString) {
        return '';
    }
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'UTC',
        });
    } catch {
        return '';
    }
};

export async function getAccessToken(): Promise<string> {
    const response = await fetch(ACCESS_TOKEN_URL, {
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch access token');
    }
    const data = await response.json();
    return data.access_token || data;
}

async function dataverseFetch<T>(endpoint: string, token: string, options: RequestInit = {}, loggedInUserId: string | null = null): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    const method = options.method?.toUpperCase();
    if (loggedInUserId && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
        headers.set('MSCRMCallerID', loggedInUserId);
    }

    const preferHeaders = ['odata.include-annotations="OData.Community.Display.V1.FormattedValue"'];
    if (method === 'POST') {
        preferHeaders.push('return=representation');
    }
    headers.set('Prefer', preferHeaders.join(','));

    if (options.body) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${DATAVERSE_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 204) {
        return Promise.resolve(undefined as T);
    }

    if (!response.ok) {
        const responseData = await response.json();
        throw new Error(`Dataverse API Error: ${responseData.error?.message || response.statusText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : (undefined as T);
}

export async function getProductMembers(token: string): Promise<ProductMember[]> {
    const endpoint = `crdfd_productmembers?$select=crdfd_productmemberid,crdfd_name&$filter=statecode eq 0 and crdfd_name ne null&$orderby=crdfd_name asc`;
    try {
        const response = await dataverseFetch<DataverseCollectionResponse<{ crdfd_productmemberid: string; crdfd_name: string; }>>(endpoint, token);
        return response.value.map(member => ({
            id: member.crdfd_productmemberid,
            name: member.crdfd_name
        }));
    } catch (error) {
        console.error("Failed to fetch product members:", error);
        return [];
    }
}

export async function getWeCareSystems(token: string): Promise<WeCareSystem[]> {
    const endpoint = `crdfd_wecaresystems?$select=crdfd_wecaresystemid,crdfd_name&$orderby=crdfd_name asc`;
    try {
        const response = await dataverseFetch<DataverseCollectionResponse<{ crdfd_wecaresystemid: string; crdfd_name: string; }>>(endpoint, token);
        return response.value.map(system => ({
            id: system.crdfd_wecaresystemid,
            name: system.crdfd_name
        }));
    } catch (error) {
        console.error("Failed to fetch we care systems:", error);
        return [];
    }
}

/**
 * Fetches a list of projects from Dataverse and categorizes them.
 * Supports filtering by one or more department IDs.
 */
export async function getProjects(token: string, departmentValues?: number | number[]): Promise<Project[]> {
    const selectFields = [
        'ai_processid', 'ai_name', 'createdon',
        '_ownerid_value',
        'crdfd_user',
        'crdfd_department_',
        '_crdfd_system_value',
        'crdfd_requester',
        'crdfd_processurl',
        'crdfd_allstepurl',
        'crdfd_description',
        'crdfd_objectives',
        'cr1bb_fullcontext',
        'crdfd_groupchat',
        'crdfd_user_guide',
        'crdfd_technical_docs',
        'crdfd_priority',
        'crdfd_processstatus',
        'crdfd_start_date',
        'crdfd_end_date',
    ].join(',');

    let filter: string;

    if (departmentValues !== undefined) {
        const values = Array.isArray(departmentValues) ? departmentValues : [departmentValues];
        const depFilter = values.map(v => `crdfd_department_ eq ${v}`).join(' or ');
        filter = `statecode eq 0 and crdfd_processstatus ne 191920000 and (${depFilter})`;
    } else {
        filter = `statecode eq 0 and (crdfd_processstatus eq 191920001 or crdfd_processstatus eq 191920003)`;
    }

    const endpoint = `${PROJECTS_ENTITY_SET}?$select=${selectFields}&$filter=${filter}&$orderby=createdon desc`;
    const response = await dataverseFetch<DataverseCollectionResponse<any>>(endpoint, token);

    return response.value.map((p): Project => {
        const projectStatus = mapDataverseProjectStatusToAppStatus(p['crdfd_processstatus@OData.Community.Display.V1.FormattedValue']);

        let category: ProjectCategory;
        switch (projectStatus) {
            case 'Maintenance':
                category = 'MAINTENANCE';
                break;
            case 'Planning':
            case 'Backlog':
                category = 'PLANNED';
                break;
            case 'Completed / Closed':
                category = 'COMPLETED';
                break;
            case 'Active':
            default:
                category = 'ACTIVE';
                break;
        }

        return {
            ...p,
            category,
            department: p['crdfd_department_@OData.Community.Display.V1.FormattedValue'] || 'General',
            system: p['_crdfd_system_value@OData.Community.Display.V1.FormattedValue'] || 'General',
            user: p['_ownerid_value@OData.Community.Display.V1.FormattedValue'] || 'N/A',
            requester: p.crdfd_requester || 'N/A',
            crdfd_priority: p['crdfd_priority@OData.Community.Display.V1.FormattedValue'] || 'N/A',
            crdfd_processstatus: projectStatus,
            itStaff: p.crdfd_user ? [p.crdfd_user] : ['N/A'],
        };
    });
}

const mapDataverseStatusToAppStatus = (dataverseStatus: string): TaskStatus => {
    switch (dataverseStatus) {
        case 'Not Start': return 'To Do';
        case 'In Progress': return 'In Progress';
        case 'Review': return 'Review';
        case 'Completed': return 'Completed';
        case 'Pending': return 'Pending';
        case 'Cancelled': return 'Cancelled';
        default: return 'Unknown';
    }
};

const mapAppStatusToDataverseValue = (appStatus: TaskStatus): number | undefined => {
    switch (appStatus) {
        case 'To Do': return 191920000;
        case 'In Progress': return 191920001;
        case 'Review': return 191920002;
        case 'Completed': return 191920003;
        case 'Pending': return 191920004;
        default: return undefined;
    }
}

const mapAppPriorityToDataverseValue = (appPriority: TaskPriority): number | undefined => {
    switch (appPriority) {
        case 'High': return 191920000;
        case 'Medium': return 191920001;
        case 'Low': return 191920002;
        default: return undefined;
    }
}

const mapDataversePriorityToAppPriority = (dataversePriority: string): TaskPriority => {
    switch (dataversePriority) {
        case 'High':
        case 'Medium':
        case 'Low':
            return dataversePriority;
        default:
            return 'N/A';
    }
}

const mapAppProjectStatusToDataverseValue = (appStatus: ProjectStatus): number | undefined => {
    switch (appStatus) {
        case 'Planning': return 191920000;
        case 'Active': return 191920001;
        case 'Backlog': return 191920002;
        case 'Maintenance': return 191920003;
        case 'Completed / Closed': return 100000001;
        default: return undefined;
    }
}

const mapDataverseProjectStatusToAppStatus = (dataverseStatus: string): ProjectStatus => {
    switch (dataverseStatus) {
        case 'Planning':
        case 'Active':
        case 'Backlog':
        case 'Maintenance':
        case 'Completed / Closed':
            return dataverseStatus;
        default:
            return 'Backlog';
    }
}

const commonTaskSelectFields = [
    'crdfd_tech_tasksid',
    'crdfd_name',
    'crdfd_description',
    'crdfd_taskstatus',
    'statecode',
    '_crdfd_assignedtask_value',
    '_crdfd_tech_resource_value',
    'crdfd_start_date',
    'crdfd_enddate',
    'crdfd_priority',
    'createdon',
    'crdfd_proof_of_complete_',
    '_crdfd_process_value',
].join(',');

const commonTechResourceSelect = 'crdfd_tech_resourceid,crdfd_name,crdfd_type,crdfd_version,crdfd_description,crdfd_resourcelink,crdfd_resourcejson';

const transformDataverseTask = (t: any): Task => {
    const rawStatus = t['crdfd_taskstatus@OData.Community.Display.V1.FormattedValue'];
    const stateCode = t.statecode;
    const rawPriority = t['crdfd_priority@OData.Community.Display.V1.FormattedValue'];

    let status: TaskStatus;
    if (stateCode === 1) {
        if (rawStatus === 'Completed') {
            status = 'Completed';
        } else {
            status = 'Cancelled';
        }
    } else {
        status = mapDataverseStatusToAppStatus(rawStatus);
    }

    const techResourceData = t.crdfd_Tech_Resource;
    let techResource: TechResource | undefined = undefined;
    if (techResourceData) {
        techResource = {
            id: techResourceData.crdfd_tech_resourceid,
            name: techResourceData.crdfd_name,
            type: techResourceData['crdfd_type@OData.Community.Display.V1.FormattedValue'] || techResourceData.crdfd_type,
            version: techResourceData.crdfd_version,
            description: techResourceData.crdfd_description,
            resourceLink: techResourceData.crdfd_resourcelink,
            resourceJson: techResourceData.crdfd_resourcejson,
        };
    }

    return {
        id: t.crdfd_tech_tasksid,
        name: t.crdfd_name || 'Unnamed Task',
        status: status,
        assignee: t.crdfd_Assignedtask?.crdfd_name || 'Unassigned',
        assigneeId: t._crdfd_assignedtask_value,
        dueDate: formatDateOnly(t.crdfd_enddate) || 'No due date',
        endDateRaw: t.crdfd_enddate,
        project: t['_crdfd_process_value@OData.Community.Display.V1.FormattedValue'] || 'N/A',
        projectId: t._crdfd_process_value,
        description: t.crdfd_description || '',
        startDate: formatDateOnly(t.crdfd_start_date) || 'N/A',
        startDateRaw: t.crdfd_start_date,
        priority: mapDataversePriorityToAppPriority(rawPriority),
        createdOn: t['createdon@OData.Community.Display.V1.FormattedValue'] || 'N/A',
        createdOnDate: t.createdon,
        proofOfComplete: t.crdfd_proof_of_complete_ || undefined,
        techResource,
    };
};

export async function getAllTasks(token: string): Promise<Task[]> {
    const endpoint = `${TASKS_ENTITY_SET}?$select=${commonTaskSelectFields}&$expand=crdfd_Assignedtask($select=crdfd_name),crdfd_Tech_Resource($select=${commonTechResourceSelect})&$orderby=createdon asc`;
    const response = await dataverseFetch<DataverseCollectionResponse<any>>(endpoint, token);
    return response.value.map(transformDataverseTask);
}


export async function getTasksForProject(projectId: string, token: string): Promise<Task[]> {
    const endpoint = `${TASKS_ENTITY_SET}?$select=${commonTaskSelectFields}&$expand=crdfd_Assignedtask($select=crdfd_name),crdfd_Tech_Resource($select=${commonTechResourceSelect})&$filter=_crdfd_process_value eq ${projectId}&$orderby=createdon asc`;
    const response = await dataverseFetch<DataverseCollectionResponse<any>>(endpoint, token);
    return response.value.map(transformDataverseTask);
}

export async function getTasksForProjects(projectIds: string[], token: string): Promise<Task[]> {
    if (projectIds.length === 0) {
        return [];
    }

    const filter = projectIds.map(id => `_crdfd_process_value eq ${id}`).join(' or ');

    const endpoint = `${TASKS_ENTITY_SET}?$select=${commonTaskSelectFields}&$expand=crdfd_Assignedtask($select=crdfd_name),crdfd_Tech_Resource($select=${commonTechResourceSelect})&$filter=(${filter})&$orderby=createdon asc`;
    const response = await dataverseFetch<DataverseCollectionResponse<any>>(endpoint, token);
    return response.value.map(transformDataverseTask);
}

export async function createTask(taskData: NewTaskPayload, token: string, loggedInUserId: string | null): Promise<void> {
    const endpoint = TASKS_ENTITY_SET;
    const payload: any = {
        "crdfd_name": taskData.name,
        "crdfd_description": taskData.description,
        "crdfd_Process@odata.bind": `/${PROJECTS_ENTITY_SET}(${taskData.projectId})`,
    };

    if (taskData.assigneeId) {
        payload["crdfd_Assignedtask@odata.bind"] = `/crdfd_productmembers(${taskData.assigneeId})`;
    }

    payload.crdfd_start_date = convertDateToUtcPlus7(taskData.startDate, 'start');
    payload.crdfd_enddate = convertDateToUtcPlus7(taskData.endDate, 'end');

    const statusValue = taskData.status ? mapAppStatusToDataverseValue(taskData.status) : undefined;
    if (statusValue) payload["crdfd_taskstatus"] = statusValue;

    const priorityValue = taskData.priority ? mapAppPriorityToDataverseValue(taskData.priority) : undefined;
    if (priorityValue) payload["crdfd_priority"] = priorityValue;

    await dataverseFetch<void>(endpoint, token, {
        method: 'POST',
        body: JSON.stringify(payload),
    }, loggedInUserId);
}

export async function updateTask(taskId: string, taskData: UpdateTaskPayload, token: string, loggedInUserId: string | null): Promise<void> {
    const endpoint = `${TASKS_ENTITY_SET}(${taskId})`;

    if (taskData.status === 'Cancelled') {
        const deactivatePayload = {
            statecode: 1,
            crdfd_taskstatus: 191920002,
        };
        await dataverseFetch<void>(endpoint, token, {
            method: 'PATCH',
            body: JSON.stringify(deactivatePayload),
        }, loggedInUserId);
        return;
    }

    const payload: any = {};
    if (taskData.name !== undefined) payload.crdfd_name = taskData.name;
    if (taskData.description !== undefined) payload.crdfd_description = taskData.description;
    if (taskData.proofOfComplete !== undefined) payload.crdfd_proof_of_complete_ = taskData.proofOfComplete;

    if (taskData.startDate !== undefined) {
        payload.crdfd_start_date = taskData.startDate ? convertDateToUtcPlus7(taskData.startDate, 'start') : null;
    }
    if (taskData.endDate !== undefined) {
        payload.crdfd_enddate = taskData.endDate ? convertDateToUtcPlus7(taskData.endDate, 'end') : null;
    }

    if (taskData.assigneeId !== undefined) {
        if (taskData.assigneeId) {
            payload["crdfd_Assignedtask@odata.bind"] = `/crdfd_productmembers(${taskData.assigneeId})`;
        } else {
            try {
                await dataverseFetch<void>(`${endpoint}/crdfd_Assignedtask/$ref`, token, { method: 'DELETE' }, loggedInUserId);
            } catch (e: any) {
                if (!e.message || !e.message.includes('404')) {
                    throw e;
                }
            }
        }
    }

    if (taskData.techResourceId !== undefined) {
        if (taskData.techResourceId) {
            payload["crdfd_Tech_Resource@odata.bind"] = `/${TECH_RESOURCES_ENTITY_SET}(${taskData.techResourceId})`;
        } else {
            try {
                await dataverseFetch<void>(`${endpoint}/crdfd_Tech_Resource/$ref`, token, { method: 'DELETE' }, loggedInUserId);
            } catch (e: any) {
                if (!e.message || !e.message.includes('404')) {
                    throw e;
                }
            }
        }
    }

    if (taskData.status) {
        const statusValue = mapAppStatusToDataverseValue(taskData.status);
        if (statusValue) payload.crdfd_taskstatus = statusValue;
    }

    if (taskData.priority) {
        const priorityValue = mapAppPriorityToDataverseValue(taskData.priority);
        if (priorityValue) payload.crdfd_priority = priorityValue;
    }

    if (Object.keys(payload).length > 0) {
        await dataverseFetch<void>(endpoint, token, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }, loggedInUserId);
    }
}

export async function createProject(projectData: NewProjectPayload, token: string, loggedInUserId: string | null): Promise<Project> {
    const endpoint = PROJECTS_ENTITY_SET;
    const payload: any = { "ai_name": projectData.ai_name };

    if (projectData.crdfd_systemid) {
        payload["crdfd_System@odata.bind"] = `/crdfd_wecaresystems(${projectData.crdfd_systemid})`;
    }
    if (projectData.crdfd_department_ !== undefined) payload.crdfd_department_ = projectData.crdfd_department_;
    if (projectData.crdfd_description) payload.crdfd_description = projectData.crdfd_description;
    if (projectData.crdfd_requester) payload.crdfd_requester = projectData.crdfd_requester;
    if (projectData.crdfd_user) payload.crdfd_user = projectData.crdfd_user;
    if (projectData.crdfd_groupchat) payload.crdfd_groupchat = projectData.crdfd_groupchat;
    if (projectData.crdfd_user_guide) payload.crdfd_user_guide = projectData.crdfd_user_guide;
    if (projectData.crdfd_technical_docs) payload.crdfd_technical_docs = projectData.crdfd_technical_docs;
    if (projectData.crdfd_processurl) payload.crdfd_processurl = projectData.crdfd_processurl;
    if (projectData.crdfd_allstepurl) payload.crdfd_allstepurl = projectData.crdfd_allstepurl;
    if (projectData.crdfd_start_date) payload.crdfd_start_date = projectData.crdfd_start_date;
    if (projectData.crdfd_end_date) payload.crdfd_end_date = projectData.crdfd_end_date;

    if (projectData.crdfd_priority) {
        const priorityValue = mapAppPriorityToDataverseValue(projectData.crdfd_priority);
        if (priorityValue !== undefined) payload.crdfd_priority = priorityValue;
    }
    if (projectData.crdfd_processstatus) {
        const statusValue = mapAppProjectStatusToDataverseValue(projectData.crdfd_processstatus);
        if (statusValue !== undefined) payload.crdfd_processstatus = statusValue;
    }

    return await dataverseFetch<Project>(endpoint, token, {
        method: 'POST',
        body: JSON.stringify(payload),
    }, loggedInUserId);
}

export async function updateProject(projectId: string, projectData: UpdateProjectPayload, token: string, loggedInUserId: string | null): Promise<void> {
    const endpoint = `${PROJECTS_ENTITY_SET}(${projectId})`;
    const payload: any = {};
    if (projectData.ai_name !== undefined) payload.ai_name = projectData.ai_name;
    if (projectData.crdfd_description !== undefined) payload.crdfd_description = projectData.crdfd_description;
    if (projectData.crdfd_requester !== undefined) payload.crdfd_requester = projectData.crdfd_requester;
    if (projectData.crdfd_user !== undefined) payload.crdfd_user = projectData.crdfd_user;
    if (projectData.crdfd_groupchat !== undefined) payload.crdfd_groupchat = projectData.crdfd_groupchat;
    if (projectData.crdfd_user_guide !== undefined) payload.crdfd_user_guide = projectData.crdfd_user_guide;
    if (projectData.crdfd_technical_docs !== undefined) payload.crdfd_technical_docs = projectData.crdfd_technical_docs;
    if (projectData.crdfd_processurl !== undefined) payload.crdfd_processurl = projectData.crdfd_processurl;
    if (projectData.crdfd_allstepurl !== undefined) payload.crdfd_allstepurl = projectData.crdfd_allstepurl;

    if (projectData.crdfd_start_date !== undefined) payload.crdfd_start_date = projectData.crdfd_start_date || null;
    if (projectData.crdfd_end_date !== undefined) payload.crdfd_end_date = projectData.crdfd_end_date || null;

    if (projectData.crdfd_priority) {
        const priorityValue = mapAppPriorityToDataverseValue(projectData.crdfd_priority);
        if (priorityValue !== undefined) payload.crdfd_priority = priorityValue;
    }
    if (projectData.crdfd_processstatus) {
        const statusValue = mapAppProjectStatusToDataverseValue(projectData.crdfd_processstatus);
        if (statusValue !== undefined) payload.crdfd_processstatus = statusValue;
    }

    if (Object.keys(payload).length > 0) {
        await dataverseFetch<void>(endpoint, token, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }, loggedInUserId);
    }
}

export async function getTechResources(token: string): Promise<TechResource[]> {
    const endpoint = `${TECH_RESOURCES_ENTITY_SET}?$select=crdfd_tech_resourceid,crdfd_name,crdfd_type,crdfd_version,crdfd_description,crdfd_resourcelink,crdfd_resourcejson&$orderby=createdon desc`;
    try {
        const response = await dataverseFetch<DataverseCollectionResponse<any>>(endpoint, token);
        return response.value.map((r: any) => ({
            id: r.crdfd_tech_resourceid,
            name: r.crdfd_name,
            type: r['crdfd_type@OData.Community.Display.V1.FormattedValue'] || r.crdfd_type,
            version: r.crdfd_version,
            description: r.crdfd_description,
            resourceLink: r.crdfd_resourcelink,
            resourceJson: r.crdfd_resourcejson,
        }));
    } catch (error) {
        console.error("Failed to fetch tech resources:", error);
        return [];
    }
}

export async function createTechResource(data: NewTechResourcePayload, token: string, loggedInUserId: string | null): Promise<string> {
    const endpoint = TECH_RESOURCES_ENTITY_SET;
    const payload: any = {
        crdfd_name: data.name,
        crdfd_version: data.version,
        crdfd_description: data.description,
        crdfd_resourcelink: data.resourceLink
    };

    if (data.type && TECH_RESOURCE_TYPE_MAPPING[data.type]) {
        payload.crdfd_type = TECH_RESOURCE_TYPE_MAPPING[data.type];
    }

    const response = await dataverseFetch<any>(endpoint, token, {
        method: 'POST',
        body: JSON.stringify(payload)
    }, loggedInUserId);

    return response.crdfd_tech_resourceid;
}
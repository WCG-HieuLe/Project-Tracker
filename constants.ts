

export const ACCESS_TOKEN_URL = 'https://de210e4bcd22e60591ca8e841aad4b.8e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/8a726ce87be943a784746a966fb1028a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=LBWfWvNo6KkbYHVq2VvZaMrv5eusXpM0e9U4Tsc8Kxo';
export const DATAVERSE_BASE_URL = 'https://wecare-ii.crm5.dynamics.com/api/data/v9.2/';
export const PROJECTS_ENTITY_SET = 'ai_processes';
export const TASKS_ENTITY_SET = 'crdfd_tech_taskses';
export const TECH_RESOURCES_ENTITY_SET = 'crdfd_tech_resources';

export const USERS = [
  { id: '399bde80-1c54-ed11-9562-000d3ac7ccec', name: 'Hieu Le Hoang' },
  { id: '829bde80-1c54-ed11-9562-000d3ac7ccec', name: 'Hoàng Trần' },
  { id: '12b2dda8-e49f-ef11-8a69-000d3ac8d88c', name: 'Thông Cao Văn' },
  { id: '106ab015-d788-ee11-be36-000d3aa3f53e', name: 'Hoàng Nguyễn Minh' },
  { id: 'dced0234-5bb0-ef11-b8e8-000d3ac7ae9c', name: 'Nghĩa Phan Trọng' },
  { id: 'fe694d73-5bec-f011-8406-7ced8db4f488', name: 'Trần Tấn Phát' },
];

export const DEFAULT_TASKS = [
  {
    name: 'Requirement Gathering & Analysis',
    description: 'Thu thập yêu cầu từ user/team nghiệp vụ, xác định phạm vi, dữ liệu, vai trò, rủi ro. (Gather requirements from users/business teams, define scope, data, roles, risks.)',
  },
  {
    name: 'Design & Solution Definition',
    description: 'Thiết kế giải pháp, mô hình dữ liệu, flow xử lý, API, UX/UI, sơ đồ tích hợp. (Design the solution, data model, processing flow, API, UX/UI, integration diagrams.)',
  },
  {
    name: 'Testing & Quality Review',
    description: 'Kiểm thử tính năng, dữ liệu và hiệu suất; QA nội bộ; xác nhận kết quả với stakeholder. (Test functionality, data, and performance; internal QA; confirm results with stakeholders.)',
  },
  {
    name: 'Documentation & Demo',
    description: 'Ghi lại tài liệu kỹ thuật, hướng dẫn sử dụng; chuẩn bị demo và buổi bàn giao. (Write technical documentation, user guides; prepare for demo and handover sessions.)',
  },
  {
    name: 'Feedback & Revision',
    description: 'Thu thập phản hồi sau demo, cập nhật & tinh chỉnh hệ thống. (Collect feedback after the demo, update & refine the system.)',
  },
];

export const TECH_RESOURCE_TYPE_MAPPING: { [key: string]: number } = {
  'Model driven': 191920000,
  'Canvas app': 191920001,
  'Automate flow': 191920002,
  'Data flow': 191920003,
  'Report': 191920004,
  'HTML/JS': 191920005,
  'Web': 191920006,
  'Others': 191920007,
  'Calculated Column': 191920008
};
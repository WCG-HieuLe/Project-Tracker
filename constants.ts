

export const DATAVERSE_BASE_URL = import.meta.env.VITE_DATAVERSE_URL || '';
export const PROJECTS_ENTITY_SET = 'ai_processes';
export const TASKS_ENTITY_SET = 'crdfd_tech_taskses';
export const TECH_RESOURCES_ENTITY_SET = 'crdfd_tech_resources';

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

// Whitelist team members — dùng cho filter assignee dropdowns
export const TEAM_MEMBERS = [
    "Lê Hoàng Hiếu",
    "Trần Huy Hoàng",
    "Trần Tấn Phát",
    "Nguyễn Đào Minh Thuận",
    "Phan Trọng Nghĩa",
    "Nguyễn Minh Hoàng",
    "Cao Văn Thông",
    "Phan Hữu Nghiệp",
];
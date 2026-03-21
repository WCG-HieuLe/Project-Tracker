# Project Tracker

**Last Updated**: 2026-03-21

> Internal project & task management dashboard cho team IT WeCare, kết nối trực tiếp Dataverse (Power Platform) để quản lý projects, tasks, tech resources và generate weekly reports bằng AI.

---

## Tech Stack

- **Framework**: Vite 6 + React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS (CDN) + inline `<style>` trong `index.html`
- **AI**: Google Generative AI (`@google/genai`) — dùng cho Weekly Report generation
- **Data Source**: Dataverse Web API (OData v9.2) — WeCare II environment
- **Auth**: Power Automate Flow → lấy Access Token (Bearer), kết hợp `MSCRMCallerID` header

## Build Commands

```bash
npm install          # install dependencies
npm run dev          # dev server (port 3000)
npm run build        # build production → dist/
npm run preview      # preview built output
```

## Hosting & Deployment

- **Origin**: Tạo trên Google AI Studio, host trên Cloud Run
- **Current**: Chuyển sang GitHub Pages via GitHub Actions
- **Workflow**: `.github/workflows/deploy.yml` — trigger on push `main`
- **Base path**: `/Project-Tracker/` (config trong `vite.config.ts`)
- **Secrets cần set trong GitHub**:
  - `VITE_AZURE_OPENAI_ENDPOINT` — Azure OpenAI endpoint
  - `VITE_AZURE_OPENAI_KEY` — Azure OpenAI API key

## Project Structure

```
├── index.html                    # Entry HTML (Tailwind CDN + CKEditor styles)
├── index.tsx                     # React entry point
├── App.tsx                       # Main app — routing, state, auth
├── types.ts                      # TypeScript interfaces (Project, Task, TechResource...)
├── constants.ts                  # API URLs, users, default tasks, mappings
├── vite.config.ts                # Vite config (base path, env, alias)
├── services/
│   ├── dataverseService.ts       # Dataverse CRUD (projects, tasks, tech resources)
│   └── mockDataService.ts        # Mock data (unused?)
├── components/                   # 24 React components
│   ├── Dashboard.tsx             # Dashboard overview với charts
│   ├── ProjectList.tsx           # Sidebar project list
│   ├── ProjectDetail.tsx         # Project detail view (34KB — nhiều features)
│   ├── ProjectCard.tsx           # Project card component
│   ├── AddProjectModal.tsx       # Create project form
│   ├── EditProjectModal.tsx      # Edit project form
│   ├── TaskList.tsx              # Task list component
│   ├── TaskDetailModal.tsx       # Task detail/edit modal
│   ├── TaskOverviewModal.tsx     # Task overview (37KB — lớn nhất)
│   ├── AddTaskModal.tsx          # Create task form
│   ├── WeeklyReportModal.tsx     # AI Weekly Report generator (26KB)
│   ├── GenerateDocsModal.tsx     # AI generate documentation
│   ├── LoginModal.tsx            # User login (hardcoded users)
│   ├── TechResourceModal.tsx     # Tech resource management
│   ├── WebviewModal.tsx          # Embedded webview
│   ├── HtmlRenderer.tsx          # CKEditor HTML renderer
│   ├── Card.tsx                  # Generic card wrapper
│   ├── Checkbox.tsx              # Custom checkbox
│   ├── Tabs.tsx                  # Tab component
│   ├── Header.tsx                # Header component
│   ├── ErrorMessage.tsx          # Error display
│   ├── LoadingSpinner.tsx        # Loading indicator
│   ├── ReportRenderer.tsx        # Report display
│   └── ProjectTable.tsx          # Project table view
├── .github/workflows/
│   └── deploy.yml                # GitHub Pages deployment
└── docs/                         # Documentation folder
```

## Features

- [x] **Dashboard** — overview projects theo department, chart thống kê
- [x] **Project CRUD** — tạo/sửa/xem chi tiết project từ Dataverse `ai_process`
- [x] **Task Management** — CRUD tasks (`crdfd_tech_tasks`), assign members, priority, status
- [x] **Tech Resources** — quản lý resources (Canvas app, Model driven, Automate flow...)
- [x] **Department Filter** — lọc projects theo department (General, Logistics, Procurement)
- [x] **User Login** — hardcoded user list, set `MSCRMCallerID` cho Dataverse
- [x] **AI Weekly Report** — generate weekly report bằng Google GenAI
- [x] **AI Generate Docs** — tự động generate documentation
- [x] **Rich Text Display** — render CKEditor content từ Dataverse
- [x] **Responsive UI** — sidebar collapse trên mobile

## Authentication

- **Access Token**: Lấy qua Power Automate Flow (POST tới `ACCESS_TOKEN_URL` trong `constants.ts`)
- **Dataverse**: Bearer token + `MSCRMCallerID` header để impersonate user
- **Users**: Hardcoded list trong `constants.ts` (6 users)
- **Environment**: `wecare-ii.crm5.dynamics.com`

## Dataverse Entities

| Entity Set | Logical Name | Mục đích |
|------------|-------------|----------|
| `ai_processes` | `ai_process` | Projects |
| `crdfd_tech_taskses` | `crdfd_tech_tasks` | Tasks |
| `crdfd_tech_resources` | `crdfd_tech_resource` | Tech Resources |
| `crdfd_productmembers` | `crdfd_productmember` | Team Members |
| `crdfd_wecaresystems` | `crdfd_wecaresystem` | WeCare Systems |

## Known Issues

- **Bundle size lớn** (562KB): `TaskOverviewModal.tsx` (37KB), `ProjectDetail.tsx` (34KB), `WeeklyReportModal.tsx` (26KB) — cần code-split
- **Tailwind CDN**: Dùng CDN script thay vì build-time — không tối ưu cho production
- **Hardcoded users**: Login dựa vào danh sách tĩnh, chưa có proper auth flow
- **No error boundary**: Không có React Error Boundary component
- **Font size override**: Custom CSS trong `index.html` ghi đè Tailwind classes (12px base)
- **Mixed column prefixes**: Columns dùng nhiều prefix (`crdfd_`, `wcg_`, `cr1bb_`, `ai_`) — do nhiều publisher khác nhau

## Quyết Định Thiết Kế

- **Flat structure (không dùng features/)**: Project nhỏ, generate từ AI Studio nên giữ flat. Nếu scale lên nên refactor theo vertical slice
- **Tailwind CDN thay vì PostCSS**: AI Studio không hỗ trợ PostCSS build, giữ nguyên khi migrate
- **Power Automate lấy token**: Tránh expose client_secret/client_id ở frontend, dùng Flow như proxy auth
- **Import map đã xóa**: Đã xóa `importmap` từ `aistudiocdn.com` vì Vite handle module resolution

## Roadmap

- [ ] Migrate Tailwind từ CDN sang PostCSS build
- [ ] Code-split các modal lớn (TaskOverview, WeeklyReport, GenerateDocs)
- [ ] Implement proper auth (MSAL / Azure AD)
- [ ] Thêm React Error Boundary
- [ ] Refactor component structure theo features/
- [ ] Thêm form validation
- [ ] Unit tests

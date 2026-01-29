import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, ProductMember } from '../types';
import { getAllTasks } from '../services/dataverseService';

// Azure OpenAI Configuration (from environment variables)
const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY;
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import Tabs from './Tabs';

interface WeeklyReportModalProps {
    onClose: () => void;
    productMembers: ProductMember[];
    accessToken: string;
    loggedInUser?: { id: string; name: string } | null;
}

const formElementClasses = "w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors";

const DEPARTMENTS = ["R&D", "Sale", "Sourcing", "Logistic", "HR", "Accounting", "Finance"];

// Helper component for Editable HTML Content
const EditableReportContent: React.FC<{ initialContent: string; onChange: (html: string) => void }> = ({ initialContent, onChange }) => {
    const divRef = useRef<HTMLDivElement>(null);

    // We use a ref to track if content has been initialized. 
    // This component is intended to be keyed by generationCount from the parent, 
    // so it remounts on new generation, resetting this effect.
    useEffect(() => {
        if (divRef.current) {
            divRef.current.innerHTML = initialContent;
        }
    }, []); // Only run once on mount

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        onChange(e.currentTarget.innerHTML);
    };

    return (
        <div
            ref={divRef}
            className="report-content w-full h-full p-4 bg-slate-900 text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 overflow-y-auto"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleInput}
        />
    );
};

const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ onClose, productMembers, accessToken, loggedInUser }) => {
    const [assigneeId, setAssigneeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [department, setDepartment] = useState('R&D');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportContent, setReportContent] = useState<string>('');
    const [copyButtonText, setCopyButtonText] = useState('Copy All');

    const [viewMode, setViewMode] = useState<'Visual' | 'Source'>('Visual');
    const [generationCount, setGenerationCount] = useState(0);

    // Auto-select assignee based on logged-in user name
    useEffect(() => {
        if (loggedInUser && !assigneeId) {
            // Find product member with same name.
            // Dataverse name might contain department (e.g., "Name_Department")
            // Logged-in name is usually just "Name".
            const match = productMembers.find(pm =>
                pm.name.toLowerCase().includes(loggedInUser.name.toLowerCase()) ||
                loggedInUser.name.toLowerCase().includes(pm.name.toLowerCase())
            );
            if (match) {
                setAssigneeId(match.id);
            }
        }
    }, [loggedInUser, productMembers, assigneeId]);

    useEffect(() => {
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

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    const handleGenerateReport = useCallback(async () => {
        if (!assigneeId || !startDate || !endDate) {
            setError("Please select an assignee and the report period.");
            return;
        }

        setError(null);
        setIsLoading(true);
        setReportContent('');

        try {
            const selectedAssignee = productMembers.find(pm => pm.id === assigneeId);
            if (!selectedAssignee) {
                throw new Error("Selected assignee not found.");
            }

            // Fetch ALL tasks from Dataverse (not limited by Dashboard filter)
            const allTasks = await getAllTasks(accessToken);

            const normalizeId = (id: string | undefined | null) => id ? id.toLowerCase().trim() : '';
            const targetAssigneeId = normalizeId(assigneeId);

            // Filter Logic: Match either by ID OR by Name string.
            // This ensures robust filtering even if IDs are mismatched between environment and mock data.
            const checkAssigneeMatch = (task: Task) => {
                const idMatch = normalizeId(task.assigneeId) === targetAssigneeId;
                const nameMatch = task.assignee === selectedAssignee.name;
                return idMatch || nameMatch;
            };

            // 1. Filter Completed Tasks (within date range)
            const completedTasks = allTasks.filter(task => {
                if (!checkAssigneeMatch(task)) {
                    return false;
                }
                if (task.status !== 'Completed') {
                    return false;
                }

                // Check date validity
                if (!task.endDateRaw) {
                    return false;
                }
                const taskDate = new Date(task.endDateRaw);
                if (isNaN(taskDate.getTime())) {
                    return false;
                }

                // Robust Date Comparison: Compare YYYY-MM-DD strings
                // This avoids issues where time-of-day offsets might exclude a valid date.
                const year = taskDate.getFullYear();
                const month = String(taskDate.getMonth() + 1).padStart(2, '0');
                const day = String(taskDate.getDate()).padStart(2, '0');
                const taskDateStr = `${year}-${month}-${day}`;

                return taskDateStr >= startDate && taskDateStr <= endDate;
            });

            // 2. Filter Upcoming/Ongoing Tasks (for "Plan for next week")
            // Logic: Tasks assigned to user that are NOT Completed, Cancelled, or Unknown.
            const planningTasks = allTasks.filter(task => {
                return (
                    checkAssigneeMatch(task) &&
                    ['In Progress', 'To Do', 'Review', 'Pending'].includes(task.status)
                );
            });

            // Sort tasks chronologically
            const sortedCompletedTasks = completedTasks.sort((a, b) => {
                const dateA = a.endDateRaw ? new Date(a.endDateRaw).getTime() : 0;
                const dateB = b.endDateRaw ? new Date(b.endDateRaw).getTime() : 0;
                return dateA - dateB;
            });

            if (sortedCompletedTasks.length === 0 && planningTasks.length === 0) {
                setReportContent(`<h1>BÁO CÁO CÔNG VIỆC TUẦN</h1><div class='report-meta'><p>Không tìm thấy dữ liệu công việc (hoàn thành hoặc đang thực hiện) cho nhân sự <strong>${selectedAssignee.name}</strong> trong khoảng thời gian <strong>${formatDate(startDate)} đến ${formatDate(endDate)}</strong>.</p><p>Vui lòng kiểm tra lại bộ lọc hoặc đảm bảo công việc đã được gán đúng người và cập nhật trạng thái/ngày tháng.</p></div>`);
                setIsLoading(false);
                setGenerationCount(prev => prev + 1);
                return;
            }


            const formattedCompleted = sortedCompletedTasks.map(t => ({
                QuyTrinh: t.project,
                CongViec: t.name,
                MoTa: t.description.replace(/<[^>]*>/g, ' '), // Strip HTML tags
            }));

            const formattedPlanning = planningTasks.map(t => ({
                QuyTrinh: t.project,
                CongViec: t.name,
                TrangThai: t.status,
                HanChot: t.dueDate
            }));

            const reportTime = `${formatDate(startDate)} – ${formatDate(endDate)}`;
            const assigneeName = selectedAssignee.name?.split('_')[0] || selectedAssignee.name || 'N/A';

            const prompt = `
            Bạn là một trợ lý quản lý dự án chuyên nghiệp. Hãy tạo một "BÁO CÁO CÔNG VIỆC TUẦN" bằng tiếng Việt dựa trên dữ liệu JSON dưới đây.

            **Dữ liệu đầu vào:**
            1. Danh sách công việc ĐÃ HOÀN THÀNH trong tuần:
            ${JSON.stringify(formattedCompleted)}

            2. Danh sách công việc ĐANG THỰC HIỆN / KẾ HOẠCH (cho tuần tới):
            ${JSON.stringify(formattedPlanning)}

            **Thông tin chung:**
            - Người thực hiện: ${assigneeName}
            - Thời gian báo cáo: ${reportTime}
            - Phòng ban: ${department}

            **YÊU CẦU ĐỊNH DẠNG (HTML thuần túy, KHÔNG Markdown, KHÔNG thẻ <html>/<body>):**
            
            Bắt đầu báo cáo với:
            \`<h1>BÁO CÁO CÔNG VIỆC TUẦN</h1>\`
            \`<div class="report-meta"><p><strong>Người thực hiện:</strong> ${assigneeName}</p><p><strong>Thời gian:</strong> ${reportTime}</p><p><strong>Phòng ban:</strong> ${department}</p></div>\`

            Sau đó, hãy tạo chính xác 3 phần sau đây:

            **Phần 1: Tổng kết các công việc đã hoàn thành**
            - Sử dụng thẻ \`<h2>1. Tổng kết các công việc đã hoàn thành</h2>\`.
            - Dưới đó, viết một danh sách \`<ul>\` tóm tắt ngắn gọn những kết quả chính đạt được từ danh sách công việc đã hoàn thành. Viết văn phong tích cực.

            **Phần 2: Chi tiết**
            - Sử dụng thẻ \`<h2>2. Chi tiết</h2>\`.
            - Tạo một bảng \`<table>\` có border.
            - Các cột bảng (\`<thead>\`): "Quy trình / Dự án", "Công việc hoàn thành", "Khó khăn", "Kế hoạch tiếp theo".
            
            **QUY TẮC TRÌNH BÀY BẢNG:**
            1. **Gom nhóm theo Dự Án:** Mỗi Dự án / Quy trình chỉ hiển thị trên **một hàng (row)** duy nhất trong bảng.
            2. **Cột "Công việc hoàn thành":** Liệt kê TẤT CẢ tên các công việc (Task Name) thuộc dự án đó vào trong cùng một ô. 
               - Bắt buộc sử dụng thẻ danh sách \`<ul>\` với các mục \`<li>\` cho từng công việc để tạo danh sách gạch đầu dòng.
            3. **Cột "Khó khăn":** Dựa trên mô tả công việc, hãy suy luận và tóm tắt các khó khăn/vướng mắc chung của dự án.
               - Trình bày dạng gạch đầu dòng (\`<ul><li>...</li></ul>\`) nếu có nhiều ý.
               - Mô tả ngắn gọn, không quá chi tiết.
               - Nếu không có khó khăn, ghi "Không có".
            4. **Cột "Kế hoạch tiếp theo":** Đưa ra kế hoạch tiếp theo chung cho dự án đó.
               - Trình bày dạng gạch đầu dòng (\`<ul><li>...</li></ul>\`) nếu có nhiều ý.

            **Phần 3: Kế hoạch tuần tới**
            - Sử dụng thẻ \`<h2>3. Kế hoạch tuần tới</h2>\`.
            - Dựa vào dữ liệu "Danh sách công việc ĐANG THỰC HIỆN / KẾ HOẠCH", hãy viết một đoạn văn (hoặc 1-2 câu) mô tả chung, tổng quát về trọng tâm công việc tuần tới.
            - **KHÔNG** liệt kê chi tiết từng đầu việc (không dùng danh sách ul/li cho phần này). Chỉ mô tả định hướng chung.

            **Lưu ý:** Chỉ trả về mã HTML để render bên trong thẻ body.
        `;

            // Call Azure OpenAI API
            const response = await fetch(AZURE_OPENAI_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': AZURE_OPENAI_KEY,
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: 'Bạn là một trợ lý quản lý dự án chuyên nghiệp.' },
                        { role: 'user', content: prompt }
                    ],
                    max_completion_tokens: 4000,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Azure OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            let content = data.choices?.[0]?.message?.content || '';

            // Clean up potential markdown code fences that the AI might add
            content = content.replace(/^```html\s*/, '').replace(/```\s*$/, '');

            setReportContent(content.trim());
            setViewMode('Visual');
            setGenerationCount(prev => prev + 1); // Force editor to reload with new content

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while generating the report.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [assigneeId, startDate, endDate, department, productMembers, accessToken]);

    const handleCopy = async () => {
        if (reportContent) {
            try {
                // The ClipboardItem API allows writing rich text (HTML) to the clipboard.
                const blob = new Blob([reportContent], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                await navigator.clipboard.write([clipboardItem]);
                setCopyButtonText('Copied!');
                setTimeout(() => setCopyButtonText('Copy All'), 2000);
            } catch (err) {
                console.error('Failed to copy rich text: ', err);
                // Fallback for older browsers
                try {
                    await navigator.clipboard.writeText(reportContent);
                    setCopyButtonText('Copied (Plain Text)!');
                    setTimeout(() => setCopyButtonText('Copy All'), 2000);
                } catch (fallbackErr) {
                    console.error('Fallback copy failed: ', fallbackErr);
                    alert('Could not copy content. Please try copying manually.');
                }
            }
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
                className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[80vw] h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Generate Weekly Report</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1 rounded-full ml-4"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
                    {/* Settings Panel */}
                    <div className="lg:col-span-1 bg-slate-800 p-4 rounded-lg flex flex-col space-y-4">
                        <div>
                            <label htmlFor="assigneeId" className="block text-sm font-medium text-slate-300 mb-1">
                                Assignee <span className="text-red-400">*</span>
                            </label>
                            <select
                                id="assigneeId"
                                value={assigneeId}
                                onChange={(e) => setAssigneeId(e.target.value)}
                                className={formElementClasses}
                            >
                                <option value="" disabled>-- Select user --</option>
                                {productMembers.map(member => (
                                    <option key={member.id} value={member.id}>{member.name?.split('_')[0] || member.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Report Period <span className="text-red-400">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={formElementClasses}
                                    title="Start Date"
                                    aria-label="Start Date"
                                />
                                <span>-</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={formElementClasses}
                                    title="End Date"
                                    aria-label="End Date"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="department" className="block text-sm font-medium text-slate-300 mb-1">
                                Department (for report header)
                            </label>
                            <select
                                id="department"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className={formElementClasses}
                            >
                                {DEPARTMENTS.map(dep => (
                                    <option key={dep} value={dep}>{dep}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-auto">
                            {error && <ErrorMessage message={error} />}
                            <button
                                onClick={handleGenerateReport}
                                disabled={isLoading}
                                className="w-full mt-2 px-4 py-2 rounded-md text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>

                    {/* Report Panel */}
                    <div className="lg:col-span-3 bg-slate-800 p-4 rounded-lg flex flex-col min-h-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <LoadingSpinner message="AI is generating the report..." />
                            </div>
                        ) : reportContent ? (
                            <>
                                <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
                                    <Tabs tabs={['Visual', 'Source']} activeTab={viewMode} onTabClick={(tab) => setViewMode(tab as 'Visual' | 'Source')} />
                                    <button onClick={handleCopy} className="px-3 py-1 text-sm rounded-md bg-slate-600 hover:bg-slate-500 text-white transition-colors flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 5a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2h-6a2 2 0 01-2-2V5z" /><path d="M4 3a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>
                                        {copyButtonText}
                                    </button>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                                    {viewMode === 'Visual' ? (
                                        <div className="flex-1 overflow-y-auto border border-slate-700 rounded-md bg-slate-900">
                                            <EditableReportContent
                                                key={generationCount} // Force remount on new generation to reset content
                                                initialContent={reportContent}
                                                onChange={setReportContent}
                                            />
                                        </div>
                                    ) : (
                                        <textarea
                                            value={reportContent}
                                            onChange={(e) => setReportContent(e.target.value)}
                                            className="w-full h-full p-2 bg-slate-900 text-slate-300 border border-slate-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                                            aria-label="Edit report source code"
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                <p>Please select settings and generate a report to see the result here.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div >
        </div >
    );
};

export default WeeklyReportModal;
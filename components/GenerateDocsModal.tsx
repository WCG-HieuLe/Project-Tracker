

import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Project, Task } from '../types';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import ReportRenderer from './ReportRenderer';

interface GenerateDocsModalProps {
  project: Project;
  tasks: Task[];
  onClose: () => void;
}

type DocType = 'Requirement' | 'Technical' | 'User Guide';

const GenerateDocsModal: React.FC<GenerateDocsModalProps> = ({ project, tasks, onClose }) => {
  const [docType, setDocType] = useState<DocType>('Requirement');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState('');
  const [copyButtonText, setCopyButtonText] = useState('Copy HTML');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setGeneratedContent('');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const projectInfo = `
          Dự án: ${project.ai_name}
          Mô tả: ${project.crdfd_description}
          Người yêu cầu: ${project.requester}
          Nhân sự IT: ${project.itStaff?.join(', ')}
          Ngày bắt đầu: ${project['wcg_start_date@OData.Community.Display.V1.FormattedValue']}
          Ngày kết thúc: ${project['crdfd_end_date@OData.Community.Display.V1.FormattedValue']}
          Trạng thái: ${project.crdfd_processstatus}
        `;

        const taskInfo = tasks.map(t => `
          - Công việc: ${t.name}
          - Mô tả: ${t.description?.replace(/<[^>]*>/g, ' ')}
          - Trạng thái: ${t.status}
          - Người thực hiện: ${t.assignee}
        `).join('\n');

        const basePrompt = `
          Hãy đóng vai một Business Analyst chuyên nghiệp. 
          Dựa vào thông tin dự án và danh sách công việc được cung cấp, hãy sinh ra một tài liệu.
          
          **YÊU CẦU CHUNG:**
          - Định dạng đầu ra phải là một chuỗi HTML thuần túy, sẵn sàng để hiển thị. Sử dụng các thẻ <h1>, <h2>, <ul>, <li>, <p>, <strong>, và <pre> cho các sơ đồ ASCII. Phong cách chuyên nghiệp, rõ ràng, dễ hiểu.
          - **KHÔNG** bao gồm \`\`\`html, <html>, <head>, hoặc <body> tags.
          - Nội dung phải rõ ràng, gọn gàng.
          - Sử dụng nhiều sơ đồ ASCII cho các phần kỹ thuật.

          **Thông tin dự án và công việc để suy luận:**
          \`\`\`
          ${projectInfo}
          
          ${taskInfo}
          \`\`\`
          ---
        `;

        let specificPrompt = '';

        if (docType === 'Requirement') {
            specificPrompt = `
              ${basePrompt}
              **TÀI LIỆU CẦN TẠO: Requirement Document**
              **QUAN TRỌNG:**
              1.  Tiêu đề chính của tài liệu phải là "Requirement Document: ${project.ai_name}".
              2.  Toàn bộ nội dung còn lại viết bằng tiếng Việt.
              3.  **KHÔNG lặp lại** các thông tin chung của dự án (tên, người yêu cầu, nhân sự IT, thời gian) trong phần nội dung. Bắt đầu trực tiếp với các mục yêu cầu.
              4.  Giữ cho nội dung **ngắn gọn, súc tích**, tập trung vào các ý chính.

              Nội dung phải bao gồm các phần sau:
              - Business Requirements (BRD)
              - System Requirements Specification (SRS)
                - Functional Requirements
                - Non-functional Requirements
              - Use Case hoặc User Story
                - Danh sách
                - ASCII flow cho từng Use Case
              - Process Flow As-Is và To-Be bằng ASCII
              - ERD dạng ASCII
              - Assumptions and Constraints
            `;
        } else if (docType === 'Technical') {
            specificPrompt = `
              ${basePrompt}
              **TÀI LIỆU CẦN TẠO: Technical Document**
              **QUAN TRỌNG:** Tiêu đề chính của tài liệu phải là "Technical Document: ${project.ai_name}". Toàn bộ nội dung còn lại viết bằng tiếng Việt.
              
              **YÊU CẦU ĐẶC BIỆT:** Tập trung vào các sơ đồ ASCII để mô tả flow. Giữ phần mô tả văn bản ngắn gọn, súc tích và đi thẳng vào vấn đề kỹ thuật.

              Nội dung bao gồm các phần sau, theo đúng cấu trúc này:
              - Solution Overview
              - Architecture Diagram ASCII
              - Module hoặc Component Design
              - Process Flow Diagram ASCII
              - UI Wireframe ASCII (các màn hình chính)
              - Data Model hoặc Table Structure
              - Integration Design nếu có
              - Security và Access Control
            `;
        } else { // User Guide
            specificPrompt = `
              ${basePrompt}
              **TÀI LIỆU CẦN TẠO: User Guide Document**
              **QUAN TRỌNG:**
              1.  Tiêu đề chính của tài liệu phải là "User Guide Document: ${project.ai_name}".
              2.  Toàn bộ nội dung còn lại viết bằng tiếng Việt.
              3.  **Viết ngắn gọn, rõ ràng, và dễ hiểu.** Tránh các câu văn dài dòng. Sử dụng danh sách (bullet points) và tiêu đề rõ ràng để cấu trúc tài liệu một cách gọn gàng.

              Nội dung bao gồm các phần sau:
              - Introduction
              - System Access
              - Hướng dẫn tính năng: mô tả từng chức năng, kèm ASCII minh họa nếu cần
              - Tips và Troubleshooting
              - FAQ và Support
            `;
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: specificPrompt,
        });

        let content = response.text;
        content = content.replace(/^```html\s*/, '').replace(/```\s*$/, '');
        setGeneratedContent(content.trim());
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while generating the document.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [docType, project, tasks]);
  
  const handleCopy = async () => {
    if (!generatedContent) return;
    try {
        const blob = new Blob([`<div class="report-content">${generatedContent}</div>`], { type: 'text/html' });
        const clipboardItem = new ClipboardItem({ 'text/html': blob });
        await navigator.clipboard.write([clipboardItem]);
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy HTML'), 2000);
    } catch (err) {
        console.error('Failed to copy rich text, falling back to raw HTML text: ', err);
        try {
            await navigator.clipboard.writeText(generatedContent);
            setCopyButtonText('Copied as HTML!');
            setTimeout(() => setCopyButtonText('Copy HTML'), 2000);
        } catch (fallbackErr) {
            console.error('Fallback copy failed: ', fallbackErr);
            alert('Could not copy content. Please select text and copy manually.');
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[80vw] h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Generate Project Document</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full ml-4" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </header>
        <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
            {/* Settings Panel */}
            <div className="lg:col-span-1 bg-slate-800 p-4 rounded-lg flex flex-col space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Document Type</label>
                    <div className="space-y-2">
                        {(['Requirement', 'Technical', 'User Guide'] as DocType[]).map(type => (
                            <button key={type} onClick={() => setDocType(type)} disabled={isLoading}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${docType === type ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                                {type} Document
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-auto pt-4">
                    {error && <ErrorMessage message={error}/>}
                    <button onClick={handleGenerate} disabled={isLoading} className="w-full mt-2 px-4 py-2 rounded-md text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
                        {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>

            {/* Content Panel */}
            <div className="lg:col-span-3 bg-slate-800 p-4 rounded-lg flex flex-col min-h-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full"><LoadingSpinner message="AI is writing the document..."/></div>
                ) : generatedContent ? (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                       <ReportRenderer content={generatedContent} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>Select a document type and click "Generate".</p>
                         <p className="text-xs mt-2">The AI will analyze the project and its tasks to create a tailored document for you.</p>
                    </div>
                )}
            </div>
        </main>
         <footer className="p-4 border-t border-slate-700 flex justify-end gap-3">
            {generatedContent && !isLoading && (
                 <button onClick={handleCopy} className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-slate-200 transition-colors flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 5a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2h-6a2 2 0 01-2-2V5z" /><path d="M4 3a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>
                    {copyButtonText}
                </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-slate-200 transition-colors">
                Close
            </button>
        </footer>
      </div>
    </div>
  );
};

export default GenerateDocsModal;
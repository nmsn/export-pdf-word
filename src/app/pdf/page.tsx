'use client';

import { useState } from 'react';
import { exportPdf } from '@/lib/pdf';
import type { IHeading, ITable, IImg, IPage, IText } from '@/lib/pdf';

const testImg = '/test_1.png';
const testImg2 = '/pic.jpg';

export default function PdfPage() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // 示例数据
      const data: (IHeading | ITable | IImg | IPage | IText)[] = [
        {
          type: 'heading',
          data: { value: 'Sample Document', level: 1 }
        },
        {
          type: 'text',
          data: { value: 'This is a sample PDF export page. Click the button above to export the PDF file. This is a sample PDF export page. Click the button above to export the PDF file.' }
        },
        {
          type: 'table',
          data: {
            title: 'Sample Table',
            value: {
              head: ['Name', 'Description', 'Status'],
              body: [
                ['Project 1', 'Description 1', 'Completed'],
                ['Project 2', 'Description 2', 'In Progress'],
                ['Project 3', 'Description 3', 'Not Started'],
                ['Project 4', 'Description 4', 'Not Started'],
                ['Project 5', 'Description 5', 'Not Started'],
              ]
            }
          }
        },
        {
          type: 'heading',
          data: { value: 'Image Example', level: 2 }
        },
        {
          type: 'text',
          data: { value: 'This is a sample PDF export page. Click the button above to export the PDF file. This is a sample PDF export page. Click the button above to export the PDF file.', options: { indent: true } }
        },
        {
          type: 'heading',
          data: { value: 'Image Example', level: 2 }
        },
        {
          type: 'img',
          data: {
            value: testImg,
            options: { align: 'center', width: 200 }
          }
        },
        {
          type: 'text',
          data: { value: 'This is a sample PDF export page. Click the button above to export the PDF file. This is a sample PDF export page. Click the button above to export the PDF file.', options: { indent: true } }
        },
        {
          type: 'img',
          data: {
            value: testImg2,
            options: { align: 'center', width: 200 }
          }
        }
      ];

      await exportPdf(data, 'Test Article');
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* PDF导出部分 */}
        <div className="bg-white shadow-xl rounded-lg p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              PDF Export Sample Page
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Click the button below to export a sample PDF document
            </p>

            <button
              onClick={handleExport}
              disabled={loading}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  导出中...
                </>
              ) : (
                '导出PDF'
              )}
            </button>
          </div>
        </div>

        {/* 图片压缩工具部分 */}
        <div className="bg-white shadow-xl rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            图片压缩工具
          </h2>
        </div>
      </div>
    </div>
  );
}
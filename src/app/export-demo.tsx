"use client";

import React, { useState } from 'react';
import { exportPdf } from '@/lib/pdf';
import { exportDocx } from '@/lib/docx';

import { ExportData } from '@/lib/types';

const ExportDemo = () => {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDocxLoading, setIsDocxLoading] = useState(false);
  
  const sampleData: ExportData[] = [
    {
      type: 'heading' as const,
      data: {
        value: 'Introduction',
        level: 1
      }
    },
    {
      type: 'text' as const,
      data: {
        value: 'This is a sample text for the PDF and DOCX export functionality.'
      }
    },
    {
      type: 'heading' as const,
      data: {
        value: 'Features',
        level: 2
      }
    },
    {
      type: 'table' as const,
      data: {
        title: 'Sample Table',
        value: {
          head: [['Feature', 'Description']],
          body: [
            ['PDF Export', 'Export content to PDF format'],
            ['DOCX Export', 'Export content to DOCX format']
          ]
        },
        pdfOptions: {},
        wordOptions: {}
      }
    }
  ];
  
  const handleExportPdf = async () => {
    setIsPdfLoading(true);
    try {
      await exportPdf(sampleData, 'sample-document');
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsPdfLoading(false);
    }
  };
  
  const handleExportDocx = async () => {
    setIsDocxLoading(true);
    try {
      await exportDocx(sampleData, 'sample-document');
    } catch (error) {
      console.error('Error exporting DOCX:', error);
    } finally {
      setIsDocxLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Export Demo</h1>
        <p className="mb-6 text-gray-700 text-center">
          Click the buttons below to export sample data to PDF or DOCX format.
        </p>
        <div className="flex flex-col space-y-4">
          <button
            onClick={handleExportPdf}
            disabled={isPdfLoading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isPdfLoading ? 'Exporting...' : 'Export to PDF'}
          </button>
          <button
            onClick={handleExportDocx}
            disabled={isDocxLoading}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isDocxLoading ? 'Exporting...' : 'Export to DOCX'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDemo;
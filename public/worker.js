// PDF Worker - 在 Web Worker 中使用 jsPDF 创建 PDF
importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

// 获取 jsPDF
const jsPDF = self.jspdf.jsPDF;

// 监听主线程消息
self.onmessage = function(e) {
  const { type, data } = e.data;
  if (type === 'createPDF') {
    try {
      // 创建 PDF 文档
      const doc = new jsPDF();
      
      // 添加标题
      doc.setFontSize(20);
      doc.text('Web Worker PDF 示例', 20, 30);
      
      // 添加副标题
      doc.setFontSize(14);
      doc.text('通过 Web Worker 生成的 PDF 文件', 20, 50);
      
      // 添加当前时间
      doc.setFontSize(12);
      const now = new Date().toLocaleString('zh-CN');
      doc.text(`生成时间: ${now}`, 20, 70);
      
      // 获取 PDF 数据
      const pdfData = doc.output('arraybuffer');
      // 发送结果回主线程
      self.postMessage({
        type: 'pdfCreated',
        data: pdfData
      });
      
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error.message
      });
    }
  }
};
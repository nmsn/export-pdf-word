import { jsPDF } from 'jspdf';
import createWorkerFunction from './newGreenlet';
// import greenlet from 'greenlet';
const testJsPDFWorker = async () => {
  const doc = new jsPDF();
  doc.text("Hello, world!", 10, 10);
  doc.save("test.pdf");
};

export const test = createWorkerFunction(testJsPDFWorker);

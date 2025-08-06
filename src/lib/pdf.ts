
import JsPdf from 'jspdf';
import { autoTable } from 'jspdf-autotable'
// import font from './source-han-sans-normal.js';
import {
  createSerialStack,
  transformImageToBase64AndImg,

  // getHeaderImg,
  getCoverImg,
  getBackCoverImg,
  // getHeadingUnderlineImg,

  getCreateDate
} from './export-utils';

// 扩展的JsPdf类型定义
/// <reference path="./jspdf-extensions.d.ts" />

export const FONT_SIZE_BASE_H1 = 36; // 封面标题字号
export const FONT_SIZE_BASE_H2 = 24; // 章节标题（一级标题）
export const FONT_SIZE_BASE_H3 = 20; // 章节标题（二级标题）
export const FONT_SIZE_BASE_H4 = 16; // 大文本（目录标题）
export const FONT_SIZE_BASE_H5 = 14; // 标准文本（图片下标）
export const FONT_SIZE_BASE_H6 = 12; // 最小文本（封面标题，二级目录）
export const FONT_SIZE_BASE_H7 = 10; // table 文本的默认字号（一般情况下不用设置）

export const PDF_PADDING = 10;
export const PDF_BORDER = 20;


const TEST_TEXT = 'test_text';

interface PositionConfig {
  align?: 'center' | 'left' | 'right';
  pageWidth?: number;
  imgWidth?: number;
  border?: number;
}

const getPositionX = (config?: PositionConfig) => {
  const { align = 'center', pageWidth = 0, imgWidth = 0, border = 0 } = config || {};

  if (align === 'center') {
    return (pageWidth - imgWidth) / 2;
  }

  if (align === 'left') {
    return border;
  }

  if (align === 'right') {
    return pageWidth - border - imgWidth;
  }
};
interface TextConfig {
  x?: number;
  y?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  border?: number;
  maxWidth?: number;
  pageWidth?: number;
  indent?: boolean;
}

interface TextResult {
  y: number;
  endY: number;
  x: number;
  endX: number;
}

const drawText = (pdf: JsPdf, text: string, config?: TextConfig): TextResult => {
  const {
    x,
    y = 0,
    fontSize = FONT_SIZE_BASE_H2,
    align = 'left',
    // pdf 四周的留白
    border = PDF_BORDER,
    pageWidth = 0,
    indent = false,
  } = config || {};

  const maxWidth = config?.maxWidth ?? pageWidth ?? 0;

  pdf.setFontSize(fontSize);

  const textWidth = pdf.getTextWidth(text);
  const lines =
    maxWidth > 0 ? pdf.splitTextToSize(text, maxWidth, { fontSize }).length : 1;

  if (lines > 1) {
    let _positionX = 0;


    if (align === 'center') {
      _positionX = pageWidth / 2;
    }

    if (align === 'left') {
      _positionX = border;
    }

    if (align === 'right') {
      _positionX = pageWidth - border - maxWidth;
    }

    const { h } = pdf.getTextDimensions(text, { maxWidth });
    const textHeight = h * pdf.getLineHeightFactor();

    const singleLineHeight = textHeight / lines;

    if (indent) {
      // 有缩进的，那一定是左对齐
      _positionX = border;
      let _y = y + singleLineHeight;
      const _text = `xx${text}`;
      const indentLines = pdf.splitTextToSize(_text, maxWidth);

      const { w: indentWidth } = pdf.getTextDimensions('xx');
      indentLines.forEach((line, idx) => {
        const lineX = idx === 0 ? _positionX + indentWidth : _positionX; // 首行缩进，其余顶格
        const _line = idx === 0 ? line.slice(2) : line;
        pdf.text(_line, lineX, _y);
        _y += singleLineHeight;
      });

      return {
        y,
        endY: _y,
        x: _positionX,
        endX: _positionX + textWidth
      }
    }

    const realX = x ?? _positionX;


    const _y = y + singleLineHeight;
    const _endY = y + textHeight;

    pdf.text(text, realX, _y, {
      maxWidth,
      align
    });
    pdf.setDrawColor(0, 0, 0);

    return {
      y,
      endY: _endY,
      x: realX,
      endX: realX + maxWidth
    };
  }

  let _positionX = 0;

  // 计算文本的横向位置
  if (align === 'center') {
    _positionX = (pageWidth - textWidth) / 2;
  }

  if (align === 'left') {
    _positionX = border;
  }

  if (align === 'right') {
    _positionX = pageWidth - border - textWidth;
  }

  const realX = x ?? _positionX;

  const { h } = pdf.getTextDimensions(text, { maxWidth });
  const textHeight = h * pdf.getLineHeightFactor();
  const _y = y + textHeight;
  pdf.text(text, realX, _y, {
    maxWidth
  });
  pdf.setDrawColor(0, 0, 0);

  return {
    y,
    endY: _y,
    x: realX,
    endX: realX + textWidth
  };
};

interface ImgConfig {
  x?: number;
  y?: number;
  width?: number;
  align?: 'center' | 'left' | 'right';
  border?: number;
  headerHeight?: number;
  fill?: boolean;
  addPage?: () => Promise<{ y: number }>;
  autoAddPage?: boolean;
  minHeightPercent?: number;
  pageWidth?: number;
  pageHeight?: number;
  bottomText?: string;
}

interface ImgResult {
  x?: number;
  y: number;
  endX?: number;
  endY: number;
}

const drawImg = async (pdf: JsPdf, imgUrl: string, config?: ImgConfig): Promise<ImgResult> => {
  const {
    x = 0,
    y = 0,
    width,
    align = 'center',
    border = PDF_BORDER,
    headerHeight = 0,
    // blob url base64 imgObj
    fill = false,
    addPage,
    autoAddPage = true,
    minHeightPercent = 0.8, // 图片最小的高度占页面总高度的比例，用于图片缩放后的在最小高度
    pageWidth = 0,
    pageHeight = 0
  } = config || {};

  if (!imgUrl) {
    return {
      y,
      endY: y
    };
  }

  const maxWidth = pageWidth - 2 * border;

  // TODO 可能某些类型图片加载不出来
  // const img = await loadImage(imgUrl);

  const { base64: urlBase64, img } = await transformImageToBase64AndImg(imgUrl);

  const imgWidth = img.width;
  const imgHeight = img.height;

  let _width = (() => {
    if (width && fill) {
      return Math.min(width, maxWidth)
    }

    // 给了确定宽度
    if (width) {
      return width;
    }

    // 是否撑满
    if (fill) {
      return maxWidth;
    }

    return imgWidth > maxWidth ? maxWidth : imgWidth;
  })();

  const _ratio = imgWidth / _width;
  let _height = imgHeight / _ratio;
  let _bottomTextHeight = 0;

  // FIX: 如果图片存在底部文本，需要算在图片总高度中
  const bottomText = config?.bottomText;
  if (bottomText) {
    const { h } = pdf.getTextDimensions(bottomText, { maxWidth });
    _bottomTextHeight = h * pdf.getLineHeightFactor();
    _height += _bottomTextHeight;
  }

  const addPageInitY = headerHeight + border;

  // 一整个页面都不能完整放下图片的情况
  const isExceedPageLength = _height > pageHeight - 2 * border;
  if (isExceedPageLength && autoAddPage) {
    _height = pageHeight - 2 * border - _bottomTextHeight;
    const zoomRatio = _height / imgHeight;
    _width = imgWidth * zoomRatio;

    const _positionX = getPositionX({
      imgWidth: _width,
      pageWidth,
      align,
      border
    });
    const _x = x ?? _positionX;

    // 不是一个新的页面
    if (y !== PDF_BORDER && autoAddPage) {
      await addPage?.();
    }

    pdf.addImage(
      urlBase64,
      'JPEG',
      x ?? _positionX,
      addPageInitY,
      _width,
      _height,
      '',
      'FAST'
    );

    return {
      x: _x,
      y: y,
      endX: _x,
      endY: addPageInitY + _height
    };
  }

  // 当前页面剩下的空间不足以放下完整图片
  const isExceedCurrentLength = _height > pageHeight - y - border;
  if (isExceedCurrentLength) {
    // 伸缩图片，放在当前页面中
    const remainHeight = pageHeight - border - y - _bottomTextHeight;
    // 如果剩余空间全部放图片，当前图片占页面总高的比例
    const remainPercent = remainHeight / pageHeight;
    const imgZoomRatio = remainHeight / imgHeight;

    // 剩余的空间可以放下缩放后的图片
    if (remainPercent >= minHeightPercent) {
      const _positionX = getPositionX({
        imgWidth: imgZoomRatio * imgWidth,
        pageWidth,
        align,
        border
      });
      const _x = x ?? _positionX;

      pdf.addImage(
        urlBase64,
        'JPEG',
        _x,
        y,
        imgWidth * imgZoomRatio,
        remainHeight,
        '',
        'FAST'
      );

      return {
        x: _x,
        y: y,
        endX: _x,
        endY: y + remainHeight
      };
    }

    const _positionX = getPositionX({
      imgWidth: _width,
      pageWidth,
      align,
      border
    });
    const _x = x ?? _positionX;
    // 不伸缩，直接翻页显示
    let newY;
    if (autoAddPage) {
      // 翻页后，需要重新定位头部位置
      const { y: newPageInitY } = await addPage?.() ?? { y: 0 };
      newY = newPageInitY;
    }
    const realY = newY ?? y;
    pdf.addImage(urlBase64, 'JPEG', _x, realY, _width, _height, '', 'FAST');

    return {
      x: _x,
      y: realY,
      endX: _x,
      endY: realY + _height
    };
  }
  const _positionX = getPositionX({
    imgWidth: _width,
    pageWidth,
    align,
    border
  });
  const _x = x ?? _positionX;

  // 一般情况
  pdf.addImage(
    urlBase64,
    'JPEG',
    _x,
    y,
    _width,
    _height - _bottomTextHeight,
    '',
    'FAST'
  );

  return {
    x: _x,
    y,
    endX: _x,
    endY: y + _height - _bottomTextHeight
  };
};

interface TableStyles {
  [key: string]: any;
}

interface TableConfig {
  head?: (string | number | boolean)[][];
  body?: (string | number | boolean)[][];
  bodyStyles?: TableStyles;
  headStyles?: TableStyles;
  columnStyles?: TableStyles;
}

interface TableResult {
  endY: number;
}

interface DrawTableConfig {
  y?: number;
  title?: string;
  pageWidth?: number;
}

export const drawTable = (pdf: JsPdf, tableConfig?: TableConfig, config?: DrawTableConfig): TableResult => {
  const { y, title, pageWidth } = config || {};

  let tableY = y;
  if (title) {
    const { endY: endY2 } = drawText(pdf, title, {
      y,
      align: 'center',
      fontSize: 14,
      pageWidth
    });

    // FIX：添加表格标题后，+10防止表格遮挡标题
    tableY = endY2 + 10;
  }

  const {
    head = [],
    body = [],
    bodyStyles = {},
    headStyles = {},
    columnStyles = {}
  } = tableConfig || {};

  autoTable(pdf, {
    startY: tableY,
    theme: 'grid',
    head,
    body,
    styles: {
      font: 'font'
    },
    headStyles: {
      fillColor: '#c00000',
      font: 'font',
      halign: 'center',
      valign: 'middle',
      ...headStyles
    },
    bodyStyles: {
      font: 'font',
      halign: 'center',
      valign: 'middle',
      ...bodyStyles
    },
    columnStyles: {
      ...columnStyles
    }
  });

  const endPosY = pdf.lastAutoTable.finalY;

  return {
    // TODO 底部值处理
    endY: endPosY + 10
  };
};

interface ChapterItem {
  text: string;
  level: number;
  num: number;
}

interface SectionConfig extends TextConfig {
  y: number;
}

// TODO 放到函数当中
const drawSection = (pdf: JsPdf, chapter: ChapterItem[], config: SectionConfig) => {
  let { y: lastEndY } = config;
  chapter.forEach(item => {
    const { text, level, num } = item;
    const { border = PDF_BORDER, fontSize = FONT_SIZE_BASE_H6 } = config;

    // const no = level === 1 ? easyCn2An(index[0]) : index.join('.');
    // const title = `${no} ${text}`;
    // 文本
    const { endY: parentEndY, endX: sectionEndX } = drawText(pdf, text, {
      ...config,
      y: lastEndY,
      fontSize: fontSize,
      align: 'left',
      border: border + 12 * (level - 1)
    });

    // 页数
    const { x: pageNumX } = drawText(pdf, num.toString(), {
      ...config,
      y: lastEndY,
      align: 'right',
      fontSize,
      border: border + 12
    });

    // 控制 … 的宽度，达到连接顺畅的程度
    const _fontSize = fontSize - 3;
    const amount = Math.floor((pageNumX - sectionEndX) / _fontSize);
    for (let i = 1; i < amount - 1; i++) {
      drawText(pdf, '…', {
        ...config,
        y: lastEndY,
        x: pageNumX - (i + 1) * _fontSize,
        align: 'right'
      });
    }

    lastEndY = parentEndY + fontSize;
  });
};

const drawCover = async (pdf: JsPdf, name: string) => {
  pdf.insertPage(1);
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  await drawImg(pdf, getCoverImg(), {
    x: 0,
    y: 0,
    width,
    pageWidth: width,
    pageHeight: height,
    fill: true,
  });

  drawText(pdf, `${name}`, {
    align: 'left',
    x: 52,
    y: height * 0.75,
    fontSize: 32,
    maxWidth: 300,
    pageWidth: width
  });

  drawText(pdf, getCreateDate(), {
    align: 'left',
    x: 52,
    y: height * 0.895,
    fontSize: 14,
    pageWidth: width
  });
};

const drawBackCover = async (pdf: JsPdf) => {
  pdf.addPage();
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  await drawImg(pdf, getBackCoverImg(), {
    x: 0,
    y: 0,
    width,
    pageWidth: width,
    pageHeight: height,
    fill: true,
  });
};

interface PDFConfig {
  pageSize?: string;
  fontSize?: number;
  border?: number;
  padding?: number;
  headerImg?: string;
}

interface Chapter {
  index: number[];
  text: string;
  num: number;
  level: number;
}

interface AddPageResult {
  y: number;
}

interface FontSizeMap {
  [key: string]: number;
}

// 从export-utils.ts导入的SerialStack类型
interface SerialStack {
  setSerial: (level: number) => string;
  getSerial: () => string;
  getSerialArray: () => number[];
  getImgSerial: () => string;
  getTableSerial: () => string;
}

export class PDF {
  border: number;
  padding: number;
  pageSize: string;
  fontSize: number;
  headerImg: string;
  headerHeight: number;
  x: number;
  y: number;
  pdf: JsPdf;
  pageWidth: number;
  pageHeight: number;
  chapter: Chapter[];
  serialStack: SerialStack;

  constructor(config: PDFConfig = {}) {
    const {
      pageSize = 'a4',
      fontSize = FONT_SIZE_BASE_H2,
      border = PDF_BORDER,
      padding = PDF_PADDING,
      headerImg = ''
    } = config;
    // 纸张周围的留白，目前统一处理
    this.border = border;
    // 多个渲染内容之间的留白
    this.padding = padding;
    // 默认 a4
    this.pageSize = pageSize;
    // TODO 默认文本字体大小
    this.fontSize = fontSize;

    this.headerImg = headerImg;
    this.headerHeight = 0;

    // 初始化坐标
    this.x = border;
    this.y = border;

    // 添加 source-han-sans-normal 字体
    const pdf = new JsPdf('p', 'px', pageSize);
    // pdf.addFileToVFS('source-han-sans-normal.ttf', font);
    // pdf.addFont('source-han-sans-normal.ttf', 'source-han-sans', 'normal');
    // pdf.setFont('source-han-sans');

    this.pdf = pdf;

    this.pageWidth = pdf.internal.pageSize.getWidth();
    this.pageHeight = pdf.internal.pageSize.getHeight();

    this.chapter = [];

    this.serialStack = createSerialStack();
  }

  async addHeader(): Promise<void> {
    if (!this.headerImg) {
      // this.y = endY + 5;
      this.headerHeight = 0;
      return;
    }

    const { endY = 0 } = await drawImg(this.pdf, this.headerImg, {
      x: 0,
      y: 10,
      width: this.pageWidth - 10,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight
    });
    this.y = endY + 5;
    if (this.headerHeight === 0) {
      this.headerHeight = endY;
    }
  }

  async addPage(): Promise<AddPageResult> {
    this.pdf.addPage();
    // 自动添加头部图片
    if (this.headerImg) {
      await this.addHeader();
    } else {
      this.y = this.border + 5;
    }
    return {
      y: this.y
    };
  }

  getCurrentPageNum(): number {
    return this.pdf.getCurrentPageInfo().pageNumber;
  }

  // 增加章节信息
  async addChapter(title: string, level: number): Promise<void> {
    // 初始的默认有一页，为第一页添加头部图片
    if (level === 1 && this.chapter && !this.chapter.length) {
      await this.addHeader();
    }

    const fontSizeMap: FontSizeMap = {
      1: FONT_SIZE_BASE_H2,
      2: FONT_SIZE_BASE_H3,
      3: FONT_SIZE_BASE_H3
    };

    // TODO 第一个没有索引

    const _pageNum = this.getCurrentPageNum();

    this.serialStack.setSerial(level);

    const _title = `${this.serialStack.getSerial()} ${title}`;

    this.chapter.push({
      index: this.serialStack.getSerialArray(),
      text: _title,
      num: _pageNum,
      level
    });

    this.addText(_title, {
      y: level === 1 ? this.headerHeight : this.y,
      align: level === 1 ? 'center' : 'left',
      fontSize: fontSizeMap[level.toString()]
    });

    // 如果是二级标题，需要添加下划线
    // if (level === 2) {
    //   const { endY } = await drawImg(this.pdf, getHeadingUnderlineImg(), {
    //     x: 20,
    //     y: this.y,
    //     width: 100
    //   });
    //   this.y = endY + 10;
    // }
  }

  addCatalog(pageNum = 1): void {
    this.pdf.insertPage(pageNum);
    const { endY } = drawText(this.pdf, TEST_TEXT, {
      align: 'center',
      y: 80,
      fontSize: FONT_SIZE_BASE_H4,
      border: 40,
      pageWidth: this.pageWidth
    });

    drawSection(this.pdf, this.chapter, {
      align: 'center',
      y: endY + 10,
      fontSize: FONT_SIZE_BASE_H6,
      border: 40,
      pageWidth: this.pageWidth
    });
  }

  async addCover(name: string = TEST_TEXT): Promise<void> {
    await drawCover(this.pdf, name);
  }

  async addBackCover(): Promise<void> {
    await drawBackCover(this.pdf);
  }

  // TODO 需要拖进来跟内部逻辑一起处理，比如分页
  addText(text: string, config?: TextConfig): void {
    const { endY } = drawText(this.pdf, text, {
      y: this.y,
      border: this.border,
      pageWidth: this.pageWidth,
      ...config
    });

    this.y = endY + this.padding;
  }

  // addSection(text: string, config?: TextConfig & { indent?: boolean }): void {
  //   const { indent = false, fontSize = 0 } = config ?? {};
  //   const indentWidth = indent ? 2 * fontSize : 0;
  //   const textAllWidth = this.pageWidth - 2 * this.border;

  //   const fakerAllText = `xx${text}`;
  //   const lines = this.pdf.splitTextToSize(fakerAllText, textAllWidth);

  //   let y = y0;

  //   lines.forEach((line, idx) => {
  //     const lineX = idx === 0 ? x0 + indent : x0; // 首行缩进，其余顶格
  //     if (idx === 0) {

  //     }

  //     doc.text(line, lineX, y);
  //     y += lineGap;
  //   });
  //   return y; // 方便连续打印多段
  // }

  async addImage(img: string, config?: ImgConfig): Promise<void> {
    const { bottomText } = config || {};

    const { endY } = await drawImg(this.pdf, img, {
      y: this.y,
      headerHeight: this.headerHeight,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      addPage: this.addPage.bind(this),
      ...config
    });
    this.y = endY + this.padding;

    // 图片底部文本需要更贴近图片一点，所以回退 5 像素
    if (bottomText) {
      const index = this.serialStack.getImgSerial();
      this.addText(`${index ? `${TEST_TEXT}${index}` : ''} ${bottomText}`, {
        y: this.y - 5,
        fontSize: FONT_SIZE_BASE_H5,
        align: 'center'
      });
    }
  }

  addTable(tableMessage: TableConfig, title: string): void {
    const index = this.serialStack.getTableSerial();
    const { endY } = drawTable(this.pdf, tableMessage, {
      y: this.y - 5,
      title: `${index ? `${TEST_TEXT}${index}` : ''} ${title}`,
      pageWidth: this.pageWidth
    });

    this.y = endY + this.padding;
  }

  save(name: string): void {
    this.pdf.save(`${name}.pdf`);
  }
}

export interface IHeading {
  type: 'heading';
  data: {
    value: string;
    level: number;
  };
}

export interface ITable {
  type: 'table';
  data: {
    value: {
      head: (string | number | boolean)[];
      body: (string | number | boolean)[][];
    };
    title: string;
    pdfOptions?: TableConfig;
  };
}

export interface IImg {
  type: 'img';
  data: {
    value: string; // 图片URL或base64字符串
    options?: ImgConfig;
  };
}

export interface IPage {
  type: 'addPage';
}

export interface IText {
  type: 'text';
  data: {
    value: string;
    options?: TextConfig;
  };
}

interface ExportOptions {
  addBackCover?: boolean;
  headerImg?: string;
}

/**
 * 导出pdf文件
 * @param {(IHeading|ITable|IImg|IPage|IText)[]} data 导出数据的数组
 * @param {string} title 导出的文件名，成果物的标题
 * @param {ExportOptions} [options] PDF的配置
 * @returns {Promise<void>} 是否成功导出
 */
export async function exportPdf(
  data: (IHeading | ITable | IImg | IPage | IText)[],
  title: string,
  options: ExportOptions = {
    addBackCover: true
  }
): Promise<void> {
  const opts = {
    headerImg: '', // 默认带每页头图，如果需要自定义设置options.headerImg = '图片地址'
    ...options
  };
  const pdf = new PDF(opts);
  // 当前页有没有内容，如果没有内容就不需要在添加heading前翻页
  let isEmptyPage = true;
  for (const item of data) {
    if (item.type === 'heading') {
      if (!isEmptyPage) {
        await pdf.addPage();
      }
      await pdf.addChapter(item.data.value, item.data.level);
    }
    if (item.type === 'addPage') {
      await pdf.addPage();
    }
    if (item.type === 'table') {
      pdf.addTable(
        {
          ...item.data.pdfOptions,
          head: Array.isArray(item.data.value.head[0])
            ? item.data.value.head as any
            : [item.data.value.head as (string | number | boolean)[]],
          body: item.data.value.body
        },
        item.data.title
      );
    }
    if (item.type === 'img') {
      await pdf.addImage(item.data.value, item.data.options);
    }
    if (item.type === 'text') {
      pdf.addText(item.data.value, item.data.options || {});
    }
    isEmptyPage = item.type === 'heading';
  }
  pdf.addCatalog();
  await pdf.addCover(title);
  if (options.addBackCover) {
    await pdf.addBackCover();
  }
  pdf.save(title);
}
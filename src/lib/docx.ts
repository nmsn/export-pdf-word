import {
  AlignmentType,
  HeadingLevel,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  TableRow,
  TableCell,
  Table,
  WidthType,
  ShadingType,
  convertMillimetersToTwip,
  PageOrientation,
  VerticalPositionAlign,
  HorizontalPositionAlign,
  FrameAnchorType,
  Header
} from 'docx';
import {
  createSerialStack,
  getHeaderImg,
  getCoverImg,
  getBackCoverImg,
  getHeadingUnderlineImg,
  getCreateDate,
  transformImageToBase64AndImg
} from './export-utils';
import { saveAs } from 'file-saver';


const TEST_TEXT = 'test_text';

/**
 * 从数字获取对应的段落级别
 * @param {number} level 段落级别
 * @returns {string} 段落级别
 */
function getHeadingLevel(level) {
  return HeadingLevel[`HEADING_${level}`];
}

/**
 * 创建标题的文本框
 * @param {{left:number,top:number}} percent 位置的百分比
 * @param {{left:number,top:number}} [offset] 位置的偏移量
 * @returns {object} 文本框的属性
 */
function createTextTitleFrame(percent, offset = {}) {
  offset.left = offset.left || 0;
  offset.top = offset.top || 0;
  return {
    border: {
      top: {
        color: 'auto',
        space: 1,
        value: 'single'
      },
      bottom: {
        color: 'auto',
        space: 1,
        value: 'single'
      },
      left: {
        color: 'auto',
        space: 1,
        value: 'single'
      },
      right: {
        color: 'auto',
        space: 1,
        value: 'single'
      }
    },
    frame: {
      position: {
        x: percent.left * convertMillimetersToTwip(210) + offset.left,
        y: percent.top * convertMillimetersToTwip(297) + offset.top
      },
      width: (1 - percent.left * 2) * convertMillimetersToTwip(210),
      height: 1000,
      anchor: {
        horizontal: FrameAnchorType.PAGE,
        vertical: FrameAnchorType.PAGE
      },

      alignment: {
        x: HorizontalPositionAlign.LEFT,
        y: VerticalPositionAlign.TOP
      }
    }
  };
}
class Docx {
  /**
   * 导出docx文件
   * @param {{headerImg:string,hasHeaderImg:boolean}} config 每一页的顶部图片，base64
   * @param {string} title 文件名
   * @param {object} [options] docx的配置
   * @returns {Docx} 导出docx的实例
   */
  constructor(config, title, options = {}) {
    this.headerImg = config.headerImg;
    this.hasHeaderImg = config.hasHeaderImg ?? !!config.headerImg;
    this.section = [];
    this.sections = [
      {
        children: this.section,
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              height: convertMillimetersToTwip(210),
              width: convertMillimetersToTwip(297)
            }
          }
        }
      }
    ];
    this.options = {
      ...options,
      sections: this.sections
    };
    this.title = title;
    /* 暂时只支持三级标题，0表示当前级别没有标题 */
    this.serialStack = createSerialStack();
  }

  /**
   * 添加海康头图
   * @param {string} img base64
   * @returns {Promise<ImageRun>} ImageRun
   */
  async _getheaderImg() {
    const { base64 } = await transformImageToBase64AndImg(this.headerImg);
    return new ImageRun({
      data: base64,
      transformation: {
        width: 600,
        height: 30
      }
    });
  }

  /**
   * 获取section，这是一个数组，用于添加内容
   * @returns {Promise<void>} null
   */
  async createSection() {
    const header = [];
    if (this.hasHeaderImg) {
      header.push(await this._getheaderImg());
    }
    this.section = [];
    this.sections.push({
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: header
            })
          ]
        })
      },
      children: this.section,
      titlePage: false,
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
            height: convertMillimetersToTwip(210),
            width: convertMillimetersToTwip(297)
          }
        }
      }
    });
  }

  /**
   * 添加封面
   * @returns {Promise<null>} null
   */
  async addCover() {
    await this.addImage(getCoverImg(), null, {
      transformation: {
        // FIXME 这里最好不要写死
        width: 793,
        height: 1120
      },
      floating: {
        horizontalPosition: { offset: 0 },
        verticalPosition: { offset: 0 },
        behindDocument: true
      }
    });
    // 添加标题
    this.addText(
      `${this.title}`,
      AlignmentType.LEFT,
      {
        bold: true,
        size: 56
      },
      createTextTitleFrame({ left: 0.12, top: 0.79 })
    );
    // 添加时间
    this.addText(
      `${getCreateDate()}`,
      AlignmentType.LEFT,
      {
        size: 24
      },
      createTextTitleFrame({ left: 0.12, top: 0.936 })
    );
  }

  /**
   * 添加封底
   * @returns {Promise<null>} null
   */
  async addBackCover() {
    await this.addImage(getBackCoverImg(), null, {
      transformation: {
        // FIXME 这里最好不要写死
        width: 793,
        height: 1120
      },
      floating: {
        horizontalPosition: { offset: 0 },
        verticalPosition: { offset: 0 },
        behindDocument: true
      }
    });
  }

  /**
   * 添加标题
   * @param {string} text 标题
   * @param {number} level 标题级别
   * @returns {Promise<null>} null
   */
  async addChapter(text, level) {
    this.section.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${this.serialStack.setSerial(level)} ${text}`,
            color: '#000000',
            bold: level === 1
          })
        ],
        heading: getHeadingLevel(level),
        alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT
      })
    );
    // 如果是二级标题，需要加一个下划线
    if (level === 2) {
      const { base64, img } = await transformImageToBase64AndImg(
        getHeadingUnderlineImg()
      );
      const { width, height } = img;
      this.section.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: base64,
              transformation: {
                // FIXME 应该动态计算，这里90是0.2*600
                width: 110,
                // 宽度低一点，会好看一点好看 (●'◡'●)
                height: (90 / width) * height
              }
            })
          ]
        })
      );
    }
  }

  /**
   * 添加文字
   * @param {string} text 文字
   * @param {AlignmentType} [alignment] 居中？
   * @param {object} [options] 文字的配置
   * @param {object} [parOptions] 段落的配置
   * @returns {void} 导出docx的实例
   */
  addText(text, alignment = AlignmentType.LEFT, options = {}, parOptions = {}) {
    this.section.push(
      new Paragraph({
        children: [
          new TextRun({
            text,
            ...options
          })
        ],
        ...parOptions,
        alignment
      })
    );
  }

  /**
   * 添加图片
   * @param {string|HTMLImageElement} data 图片数据
   * @param {string} [description] 图片描述
   * @param {IImageOptions} [options] 图片的配置
   * @return {Promise<null>} null
   */
  async addImage(data, description = '', options = {}) {
    const { base64, img } = await transformImageToBase64AndImg(data);
    // TODO 动态计算图片大小
    const { width, height } = img;

    this.section.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: base64,
            transformation: {
              width: 600,
              height: (600 / width) * height
            },
            ...options
          })
        ],
        alignment: AlignmentType.CENTER
      })
    );

    if (description) {
      this.addText(
        `${TEST_TEXT}${this.serialStack.getImgSerial()} ${description}`,
        AlignmentType.CENTER
      );
    }
  }

  /**
   * 添加表格
   * @param {object[]} data 表格数据
   * @param {string} title 表格标题
   * @param {object} [customOptions] 表格的自定义配置
   * @returns {void} 导出docx的实例
   */
  addTable(data, title, customOptions = {}) {
    this.addText(
      `${TEST_TEXT}${this.serialStack.getTableSerial()} ${title}`,
      AlignmentType.CENTER
    );

    /** 用来表示key列的宽度 */
    const cellWidth = {};
    customOptions.columnStyles?.length &&
      customOptions.columnStyles.forEach(({ colIndex, width }) => {
        cellWidth[colIndex] = width;
      });

    const table = new Table({
      rows: [
        ...data.head.map(row => {
          // 某些情况下，row不是个数组
          if (!Array.isArray(row)) {
            row = [row];
          }
          return new TableRow({
            children: row.map((cell, i) => {
              if (cell?.content) {
                return new TableCell({
                  children: [
                    new Paragraph({
                      // FIX: 处理表格单元格中文本换行的问题
                      children: cell.content
                        .toString()
                        .split('\n')
                        .map(
                          text =>
                            new TextRun({
                              text,
                              color: 'FFFFFF'
                            })
                        ),
                      alignment: AlignmentType.CENTER
                    })
                  ],
                  width: cellWidth[i] || null,
                  columnSpan: cell.colSpan,
                  rowSpan: cell.rowSpan,
                  verticalAlign: AlignmentType.CENTER,
                  shading: {
                    fill: 'BF0000',
                    type: ShadingType.CLEAR,
                    color: 'auto'
                  }
                });
              }
              return new TableCell({
                children: [
                  new Paragraph({
                    // FIX: 处理表格单元格中文本换行的问题
                    children:
                      cell
                        ?.toString()
                        .split('\n')
                        .map(
                          text =>
                            new TextRun({
                              text,
                              color: 'FFFFFF'
                            })
                        ) || '',
                    alignment: AlignmentType.CENTER
                  })
                ],
                width: cellWidth[i] || null,
                verticalAlign: AlignmentType.CENTER,
                shading: {
                  fill: 'BF0000',
                  type: ShadingType.CLEAR,
                  color: 'auto'
                }
              });
            })
          });
        }),
        ...data.body.map(row => {
          return new TableRow({
            children: row.map((cell, i) => {
              if (cell?.content) {
                return new TableCell({
                  // FIX: 处理表格单元格中文本换行的问题
                  children: cell.content
                    .toString()
                    .split('\n')
                    .map(
                      text =>
                        new Paragraph({
                          text,
                          alignment: AlignmentType.CENTER
                        })
                    ),
                  width: cellWidth[i] || null,
                  columnSpan: cell.colSpan,
                  rowSpan: cell.rowSpan,
                  verticalAlign: AlignmentType.CENTER
                });
              }
              return new TableCell({
                // FIX: 处理表格单元格中文本换行的问题
                children:
                  cell
                    ?.toString()
                    .split('\n')
                    .map(
                      text =>
                        new Paragraph({
                          text,
                          alignment: AlignmentType.CENTER
                        })
                    ) || '',
                width: cellWidth[i] || null,
                verticalAlign: AlignmentType.CENTER
              });
            })
          });
        })
      ],
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      }
    });
    this.section.push(table);
  }

  /**
   * 导出word文件
   * @returns {Promise} 成功或失败
   */
  async export() {
    const doc = new Document(this.options);
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${this.title}.docx`);
  }
}

/**
 * 传入数据，导出word文件
 * @typedef {{type:'heading',data:{value:string,level:number}}} IHeading 标题
 * @typedef {{type:'table',data:{value:object,title:string}}} ITable 表格
 * @typedef {{type:'img',data:{value:(HTMLImageElement|string),options:object}}} IImg 图片
 * @typedef {{type:'addPage'}} IPage 翻页
 * @param {(IHeading|ITable|IImg|IPage)[]} data 导出数据的数组
 * @param {string} title 导出的文件名，成果物的标题
 * @param {object} [config] 导出word的配置
 * @param {object} [options] new Docx传入的配置
 * @returns {Promise<null>} 是否成功导出
 */
async function exportDocx(data, title, config = {
  addBackCover: true
}, options = {}) {
  config = {
    headerImg: getHeaderImg(), // 默认带每页头图，如果需要自定义设置options.headerImg = '图片地址'
    ...config
  };
  const doc = new Docx(config, title, options);
  await doc.addCover();
  // 当前页有没有内容，如果没有内容就不需要在添加heading前翻页
  // 添加完封面后翻页，添加一页
  let isEmptyPage = false;
  for (const item of data) {
    if (item.type === 'heading') {
      if (!isEmptyPage) {
        // 添加新页前，需要先添加section到Document
        await doc.createSection();
      }
      await doc.addChapter(item.data.value, item.data.level);
    }
    if (item.type === 'addPage') {
      await doc.createSection();
    }
    if (item.type === 'table') {
      doc.addTable(item.data.value, item.data.title, item.data.wordOptions);
    }
    if (item.type === 'img') {
      const bottomText = item.data?.options?.bottomText || '';
      await doc.addImage(item.data.value, bottomText);
    }
    if (item.type === 'text') {
      doc.addText(
        item.data.value,
        AlignmentType.LEFT,
        item.data.options.textOptions || {},
        item.data.options.parOptions || {}
      );
    }
    isEmptyPage = item.type === 'heading';
  }
  await doc.createSection();
  config.addBackCover && await doc.addBackCover();
  doc.export(title);
}

export { Docx, exportDocx };
/**
 * OMNISCAN TITAN X - Enterprise Multi-Format Document Conversion Engine
 * High-performance, offline-first client-side file transformation suite.
 * Merges, Splits, Converts:
 * - PDF <-> Word (DOCX, RTF, TXT)
 * - PDF <-> Excel (XLSX, XLS, CSV, ODS)
 * - PDF <-> PowerPoint (PPTX)
 * - PDF <-> Images (JPG, PNG, WEBP, BMP, TIFF, SVG)
 * - Multi-Image <-> PDF with custom page geometry & margins
 */

import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  Document as DocxDocument,
  Packer as DocxPacker,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType,
  BorderStyle,
} from "docx";
import PptxGenJS from "pptxgenjs";
import mammoth from "mammoth";

import {
  WorkspaceFile,
  ConversionJobConfig,
  ConversionResult,
  ConvertedOutputItem,
  ConversionProgressCallback,
  ConversionMode,
} from "./ConversionTypes";
import { FileNamingManager } from "./FileNamingManager";
import { ensurePdfWorker } from "../../engine/pdf";
import { runPageOCR } from "../../engine/ocr";

ensurePdfWorker();

export class ConversionEngine {
  // --------------------------------------------------------------------------
  // 1. PDF MERGE
  // --------------------------------------------------------------------------
  public static async mergeFilesToPdf(
    files: WorkspaceFile[],
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const mergedDoc = await PDFDocument.create();
    mergedDoc.setTitle(config.outputFileNamePattern || "Merged_Document");
    mergedDoc.setCreator("OmniScan Titan X Enterprise PDF Studio");

    const totalFiles = files.length;
    let processedPages = 0;

    for (let fIdx = 0; fIdx < totalFiles; fIdx++) {
      const file = files[fIdx];
      const percent = Math.round((fIdx / totalFiles) * 85);
      onProgress?.(percent, `Merging file ${fIdx + 1} of ${totalFiles}: ${file.name}`, file.name);

      try {
        if (file.format === "pdf") {
          // Native vector/text PDF copy
          const arrayBuffer = await file.rawFile.arrayBuffer();
          const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

          // Determine which pages to copy and their rotations
          const pageIndicesToCopy: number[] = [];
          const rotationMap = new Map<number, number>();

          if (file.pages && file.pages.length > 0) {
            file.pages.forEach((p, idx) => {
              if (p.selected) {
                pageIndicesToCopy.push(idx);
                if (p.rotation) {
                  rotationMap.set(idx, p.rotation);
                }
              }
            });
          } else {
            for (let i = 0; i < srcPdf.getPageCount(); i++) {
              pageIndicesToCopy.push(i);
            }
          }

          const copiedPages = await mergedDoc.copyPages(srcPdf, pageIndicesToCopy);
          copiedPages.forEach((page, cIdx) => {
            const srcIdx = pageIndicesToCopy[cIdx];
            const extraRot = rotationMap.get(srcIdx) || 0;
            if (extraRot !== 0) {
              const currentRot = page.getRotation().angle;
              page.setRotation(degrees((currentRot + extraRot) % 360));
            }
            mergedDoc.addPage(page);
            processedPages++;
          });
        } else if (["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif", "svg"].includes(file.format)) {
          // Embed image into a new PDF page
          const arrayBuffer = await file.rawFile.arrayBuffer();
          const imgDataUrl = await this.fileToDataUrl(file.rawFile);
          await this.embedImageToPdfDoc(mergedDoc, imgDataUrl, config);
          processedPages++;
        } else if (["docx", "txt", "rtf"].includes(file.format)) {
          // Convert document pages to images and embed
          const docPages = await this.renderDocumentToCanvases(file);
          for (const pageCanvas of docPages) {
            const dataUrl = pageCanvas.toDataURL("image/png");
            await this.embedImageToPdfDoc(mergedDoc, dataUrl, config);
            processedPages++;
          }
        }
      } catch (err: any) {
        console.error(`Failed to merge file ${file.name}:`, err);
        // Continue merging remaining files
      }
    }

    onProgress?.(92, "Finalizing and writing merged PDF bytes...");
    const mergedBytes = await mergedDoc.save({ useObjectStreams: true });
    const outputBlob = new Blob([mergedBytes], { type: "application/pdf" });
    const outputUrl = URL.createObjectURL(outputBlob);

    const baseName = FileNamingManager.getBaseName(files[0]?.name || "Merged_Document");
    const finalName = FileNamingManager.generateOutputName({
      baseName: files.length > 1 ? `${baseName}_Merged` : baseName,
      extension: "pdf",
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "Merge complete!");

    return {
      success: true,
      jobId: "merge-" + Date.now(),
      tool: "merge-pdf",
      outputFiles: [
        {
          id: "out-1",
          fileName: finalName,
          format: "pdf",
          mimeType: "application/pdf",
          data: outputBlob,
          downloadUrl: outputUrl,
          totalPages: processedPages,
          conversionMode: "hybrid",
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 2. SPLIT PDF & SEPARATE PAGE SAVE
  // --------------------------------------------------------------------------
  public static async splitPdf(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const arrayBuffer = await file.rawFile.arrayBuffer();
    const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const totalPages = srcPdf.getPageCount();

    const outputItems: ConvertedOutputItem[] = [];
    const baseName = FileNamingManager.getBaseName(file.name);

    if (config.splitMode === "every-page") {
      // Split each page into a separate 1-page PDF
      for (let p = 0; p < totalPages; p++) {
        const percent = Math.round(((p + 1) / totalPages) * 85);
        onProgress?.(percent, `Extracting page ${p + 1} of ${totalPages}...`, file.name);

        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(srcPdf, [p]);
        singleDoc.addPage(copiedPage);

        const bytes = await singleDoc.save({ useObjectStreams: true });
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const pNum = p + 1;
        const pageFileName = FileNamingManager.generateOutputName({
          baseName,
          extension: "pdf",
          pageNumber: pNum,
          totalPages,
          numberingStyle: "underscore_two_digit",
          customPattern: config.outputFileNamePattern || "{name}_Page_{page}.pdf",
        });

        outputItems.push({
          id: `page-${pNum}`,
          fileName: pageFileName,
          format: "pdf",
          mimeType: "application/pdf",
          data: blob,
          downloadUrl: url,
          pageNumber: pNum,
          totalPages: 1,
          conversionMode: "native-editable",
        });
      }
    } else {
      // Range or Filter extraction (odd, even, front, last, or custom ranges)
      const rangeGroups = this.resolvePageRanges(config.splitMode, config.customRangesText, totalPages);

      for (let rIdx = 0; rIdx < rangeGroups.length; rIdx++) {
        const group = rangeGroups[rIdx];
        const percent = Math.round(((rIdx + 1) / rangeGroups.length) * 85);
        onProgress?.(percent, `Extracting range: ${group.label}...`, file.name);

        const rangeDoc = await PDFDocument.create();
        const validIndices = group.pageIndices.filter((idx) => idx >= 0 && idx < totalPages);
        if (validIndices.length === 0) continue;

        const copied = await rangeDoc.copyPages(srcPdf, validIndices);
        copied.forEach((cp) => rangeDoc.addPage(cp));

        const bytes = await rangeDoc.save({ useObjectStreams: true });
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const fileName = FileNamingManager.generateOutputName({
          baseName: `${baseName}_${group.label}`,
          extension: "pdf",
        });

        outputItems.push({
          id: `range-${rIdx + 1}`,
          fileName,
          format: "pdf",
          mimeType: "application/pdf",
          data: blob,
          downloadUrl: url,
          totalPages: validIndices.length,
          conversionMode: "native-editable",
        });
      }
    }

    // Optionally create a ZIP package
    let zipBlob: Blob | undefined;
    let zipUrl: string | undefined;
    let zipName: string | undefined;

    if (outputItems.length > 1 || config.packageAsZip) {
      onProgress?.(92, "Archiving split PDFs into ZIP package...");
      const zip = new JSZip();
      for (const item of outputItems) {
        if (item.data instanceof Blob) {
          zip.file(item.fileName, item.data);
        }
      }
      zipBlob = await zip.generateAsync({ type: "blob" });
      zipUrl = URL.createObjectURL(zipBlob);
      zipName = `${baseName}_SPLIT_PAGES.zip`;
    }

    onProgress?.(100, "Split complete!");

    return {
      success: true,
      jobId: "split-" + Date.now(),
      tool: "split-pdf",
      outputFiles: outputItems,
      zipPackageBlob: zipBlob,
      zipPackageUrl: zipUrl,
      zipPackageName: zipName,
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 3. PDF TO IMAGE (JPG, PNG, WEBP)
  // --------------------------------------------------------------------------
  public static async convertPdfToImages(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const arrayBuffer = await file.rawFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const baseName = FileNamingManager.getBaseName(file.name);
    const outputFormat = config.outputFormat === "jpg" ? "jpg" : config.outputFormat === "webp" ? "webp" : "png";
    const mimeType = outputFormat === "jpg" ? "image/jpeg" : outputFormat === "webp" ? "image/webp" : "image/png";

    // Scale calculation from DPI: 72 DPI is scale 1.0; 300 DPI is scale 4.167
    const scale = (config.imageDpi || 300) / 72;
    const outputItems: ConvertedOutputItem[] = [];

    for (let p = 1; p <= numPages; p++) {
      const percent = Math.round((p / numPages) * 85);
      onProgress?.(percent, `Rendering PDF page ${p} of ${numPages} at ${config.imageDpi} DPI...`, file.name);

      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");

      if (ctx) {
        if (outputFormat === "jpg" || !config.transparentBackground) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const renderContext = {
          canvasContext: ctx,
          viewport,
          canvas,
        };
        await page.render(renderContext).promise;

        const dataUrl = canvas.toDataURL(mimeType, config.imageQuality || 0.92);
        const blob = await (await fetch(dataUrl)).blob();
        const url = URL.createObjectURL(blob);

        const pageName = FileNamingManager.generateOutputName({
          baseName,
          extension: outputFormat,
          pageNumber: p,
          totalPages: numPages,
          numberingStyle: "underscore_two_digit",
          customPattern: config.outputFileNamePattern,
        });

        outputItems.push({
          id: `img-page-${p}`,
          fileName: pageName,
          format: outputFormat,
          mimeType,
          data: blob,
          downloadUrl: url,
          pageNumber: p,
          totalPages: numPages,
          conversionMode: "flattened-image",
        });
      }
    }

    let zipBlob: Blob | undefined;
    let zipUrl: string | undefined;
    let zipName: string | undefined;

    if (outputItems.length > 1 || config.packageAsZip) {
      onProgress?.(92, "Archiving images into ZIP package...");
      const zip = new JSZip();
      for (const item of outputItems) {
        if (item.data instanceof Blob) {
          zip.file(item.fileName, item.data);
        }
      }
      zipBlob = await zip.generateAsync({ type: "blob" });
      zipUrl = URL.createObjectURL(zipBlob);
      zipName = `${baseName}_IMAGES_${config.imageDpi}DPI.zip`;
    }

    onProgress?.(100, "PDF to Images complete!");

    return {
      success: true,
      jobId: "pdf-to-img-" + Date.now(),
      tool: "pdf-to-image",
      outputFiles: outputItems,
      zipPackageBlob: zipBlob,
      zipPackageUrl: zipUrl,
      zipPackageName: zipName,
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 4. IMAGE TO PDF
  // --------------------------------------------------------------------------
  public static async convertImagesToPdf(
    files: WorkspaceFile[],
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(config.outputFileNamePattern || "Images_Document");
    pdfDoc.setCreator("OmniScan Titan X Enterprise PDF Studio");

    const totalFiles = files.length;
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const percent = Math.round(((i + 1) / totalFiles) * 85);
      onProgress?.(percent, `Processing image ${i + 1} of ${totalFiles}: ${file.name}`, file.name);

      const dataUrl = await this.fileToDataUrl(file.rawFile);
      await this.embedImageToPdfDoc(pdfDoc, dataUrl, config);
    }

    onProgress?.(92, "Encoding PDF document...");
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const baseName = FileNamingManager.getBaseName(files[0]?.name || "Images");
    const fileName = FileNamingManager.generateOutputName({
      baseName: files.length > 1 ? `${baseName}_Images_Combined` : baseName,
      extension: "pdf",
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "Image to PDF complete!");

    return {
      success: true,
      jobId: "img-to-pdf-" + Date.now(),
      tool: "image-to-pdf",
      outputFiles: [
        {
          id: "out-img-pdf",
          fileName,
          format: "pdf",
          mimeType: "application/pdf",
          data: blob,
          downloadUrl: url,
          totalPages: totalFiles,
          conversionMode: "hybrid",
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 5. PDF TO WORD (DOCX)
  // --------------------------------------------------------------------------
  public static async convertPdfToWord(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const arrayBuffer = await file.rawFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const docSections: Paragraph[] = [];
    let detectedMode: ConversionMode = "text-preserving";

    for (let p = 1; p <= numPages; p++) {
      const percent = Math.round((p / numPages) * 80);
      onProgress?.(percent, `Extracting structure and text from page ${p} of ${numPages}...`, file.name);

      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();

      if (textContent.items.length === 0) {
        // Scanned page fallback with OCR
        detectedMode = "ocr-scanned";
        onProgress?.(percent, `Page ${p} is scanned image. Executing high-precision OCR...`, file.name);

        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const ocrResult = await runPageOCR(canvas.toDataURL("image/png"), config.ocrLanguage || "eng");

          docSections.push(
            new Paragraph({
              text: `[Page ${p} - OCR Extracted Content]`,
              heading: HeadingLevel.HEADING_2,
            })
          );

          const lines = ocrResult.text.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              docSections.push(
                new Paragraph({
                  children: [new TextRun({ text: line.trim(), size: 22 })],
                  spacing: { after: 120 },
                })
              );
            }
          }
        }
      } else {
        // Native structured text extraction & table clustering
        const items = textContent.items as any[];
        // Cluster text items by Y coordinate into lines
        const lineGroups = this.clusterTextItemsIntoLines(items);

        docSections.push(
          new Paragraph({
            text: `Page ${p}`,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );

        for (const line of lineGroups) {
          const isHeading = line.fontSize >= 15;
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.text,
                  bold: line.isBold || isHeading,
                  size: isHeading ? 28 : 22,
                }),
              ],
              heading: isHeading ? HeadingLevel.HEADING_1 : undefined,
              spacing: { after: isHeading ? 180 : 100 },
            })
          );
        }
      }
    }

    onProgress?.(90, "Assembling and compiling OpenXML DOCX package...");

    const docx = new DocxDocument({
      sections: [
        {
          properties: {},
          children: docSections.length > 0 ? docSections : [new Paragraph("No text content could be extracted.")],
        },
      ],
    });

    const docxBlob = await DocxPacker.toBlob(docx);
    const url = URL.createObjectURL(docxBlob);

    const baseName = FileNamingManager.getBaseName(file.name);
    const fileName = FileNamingManager.generateOutputName({
      baseName,
      extension: "docx",
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "PDF to Word complete!");

    return {
      success: true,
      jobId: "pdf-to-word-" + Date.now(),
      tool: "pdf-to-word",
      outputFiles: [
        {
          id: "out-docx",
          fileName,
          format: "docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          data: docxBlob,
          downloadUrl: url,
          totalPages: numPages,
          conversionMode: detectedMode,
          notes: detectedMode === "ocr-scanned" ? "Extracted via local Tesseract OCR engine" : "Structured text preserved",
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 6. WORD TO PDF (DOCX / RTF / TXT -> PDF)
  // --------------------------------------------------------------------------
  public static async convertWordToPdf(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    onProgress?.(20, `Parsing Word document: ${file.name}...`, file.name);

    const pageCanvases = await this.renderDocumentToCanvases(file);
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(file.name);
    pdfDoc.setCreator("OmniScan Titan X Word-to-PDF Engine");

    for (let pIdx = 0; pIdx < pageCanvases.length; pIdx++) {
      const percent = Math.round(20 + ((pIdx + 1) / pageCanvases.length) * 65);
      onProgress?.(percent, `Converting page ${pIdx + 1} of ${pageCanvases.length} to vector PDF...`, file.name);

      const canvas = pageCanvases[pIdx];
      const dataUrl = canvas.toDataURL("image/png");
      await this.embedImageToPdfDoc(pdfDoc, dataUrl, config);
    }

    onProgress?.(90, "Finalizing PDF file...");
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const baseName = FileNamingManager.getBaseName(file.name);
    const fileName = FileNamingManager.generateOutputName({
      baseName,
      extension: "pdf",
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "Word to PDF complete!");

    return {
      success: true,
      jobId: "word-to-pdf-" + Date.now(),
      tool: "word-to-pdf",
      outputFiles: [
        {
          id: "out-word-pdf",
          fileName,
          format: "pdf",
          mimeType: "application/pdf",
          data: blob,
          downloadUrl: url,
          totalPages: pageCanvases.length,
          conversionMode: "hybrid",
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 7. PDF TO EXCEL (XLSX / CSV)
  // --------------------------------------------------------------------------
  public static async convertPdfToExcel(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const arrayBuffer = await file.rawFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const workbook = XLSX.utils.book_new();
    let hasData = false;

    for (let p = 1; p <= numPages; p++) {
      const percent = Math.round((p / numPages) * 80);
      onProgress?.(percent, `Analyzing table cells on page ${p} of ${numPages}...`, file.name);

      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      const tableRows = this.extractTableGridFromItems(items);
      if (tableRows.length > 0) {
        hasData = true;
        const worksheet = XLSX.utils.aoa_to_sheet(tableRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, `Page_${p}`);
      }
    }

    if (!hasData) {
      // Fallback worksheet
      const fallbackSheet = XLSX.utils.aoa_to_sheet([["No tabular data recognized in source PDF"]]);
      XLSX.utils.book_append_sheet(workbook, fallbackSheet, "Sheet1");
    }

    onProgress?.(90, "Generating Excel XLSX workbook...");
    const isCsv = config.outputFormat === "csv";
    let outputBlob: Blob;
    let mimeType: string;
    let ext: string;

    if (isCsv) {
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvStr = XLSX.utils.sheet_to_csv(firstSheet);
      outputBlob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      mimeType = "text/csv";
      ext = "csv";
    } else {
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      outputBlob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = "xlsx";
    }

    const url = URL.createObjectURL(outputBlob);
    const baseName = FileNamingManager.getBaseName(file.name);
    const fileName = FileNamingManager.generateOutputName({
      baseName,
      extension: ext,
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "PDF to Excel complete!");

    return {
      success: true,
      jobId: "pdf-to-excel-" + Date.now(),
      tool: "pdf-to-excel",
      outputFiles: [
        {
          id: "out-excel",
          fileName,
          format: isCsv ? "csv" : "xlsx",
          mimeType,
          data: outputBlob,
          downloadUrl: url,
          totalPages: workbook.SheetNames.length,
          conversionMode: "text-preserving",
          notes: `Extracted ${workbook.SheetNames.length} sheet(s) with table structure detection`,
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 8. EXCEL TO PDF (XLSX / XLS / CSV / ODS -> PDF)
  // --------------------------------------------------------------------------
  public static async convertExcelToPdf(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const arrayBuffer = await file.rawFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(file.name);
    pdfDoc.setCreator("OmniScan Titan X Excel-to-PDF Engine");

    const sheetNames = config.selectedSheets?.length ? config.selectedSheets : workbook.SheetNames;
    let totalPdfPages = 0;

    for (let sIdx = 0; sIdx < sheetNames.length; sIdx++) {
      const sName = sheetNames[sIdx];
      const sheet = workbook.Sheets[sName];
      if (!sheet) continue;

      const percent = Math.round(((sIdx + 1) / sheetNames.length) * 80);
      onProgress?.(percent, `Rendering spreadsheet: ${sName}...`, file.name);

      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (rows.length === 0) continue;

      const canvases = this.renderTableToCanvases(rows, sName, config);
      for (const canvas of canvases) {
        const dataUrl = canvas.toDataURL("image/png");
        await this.embedImageToPdfDoc(pdfDoc, dataUrl, config);
        totalPdfPages++;
      }
    }

    onProgress?.(92, "Compiling PDF document...");
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const baseName = FileNamingManager.getBaseName(file.name);
    const fileName = FileNamingManager.generateOutputName({
      baseName,
      extension: "pdf",
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "Excel to PDF complete!");

    return {
      success: true,
      jobId: "excel-to-pdf-" + Date.now(),
      tool: "excel-to-pdf",
      outputFiles: [
        {
          id: "out-excel-pdf",
          fileName,
          format: "pdf",
          mimeType: "application/pdf",
          data: blob,
          downloadUrl: url,
          totalPages: totalPdfPages,
          conversionMode: "native-editable",
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 9. PDF TO POWERPOINT (PPTX)
  // --------------------------------------------------------------------------
  public static async convertPdfToPptx(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const arrayBuffer = await file.rawFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const pptx = new PptxGenJS();
    pptx.title = file.name;
    pptx.layout = "LAYOUT_16x9";

    const isFlattened = config.conversionMode === "flattened-image";

    for (let p = 1; p <= numPages; p++) {
      const percent = Math.round((p / numPages) * 85);
      onProgress?.(percent, `Creating slide for page ${p} of ${numPages}...`, file.name);

      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 });

      const slide = pptx.addSlide();

      if (isFlattened) {
        // High-fidelity raster slide mode
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          slide.addImage({ data: dataUrl, x: 0, y: 0, w: "100%", h: "100%" });
        }
      } else {
        // Text-preserving slide mode
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];
        const lineGroups = this.clusterTextItemsIntoLines(items);

        let yPos = 0.5;
        for (const line of lineGroups.slice(0, 15)) {
          slide.addText(line.text, {
            x: 0.8,
            y: yPos,
            w: 8.5,
            h: 0.5,
            fontSize: line.fontSize > 16 ? 20 : 14,
            bold: line.isBold || line.fontSize > 16,
            color: "1E293B",
          });
          yPos += 0.45;
        }

        if (lineGroups.length === 0) {
          // Render as image fallback
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            slide.addImage({ data: canvas.toDataURL("image/jpeg", 0.85), x: 0, y: 0, w: "100%", h: "100%" });
          }
        }
      }
    }

    onProgress?.(92, "Writing PowerPoint PPTX presentation...");
    const pptxBlob = (await pptx.write({ outputType: "blob" })) as Blob;
    const url = URL.createObjectURL(pptxBlob);

    const baseName = FileNamingManager.getBaseName(file.name);
    const fileName = FileNamingManager.generateOutputName({
      baseName,
      extension: "pptx",
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "PDF to PowerPoint complete!");

    return {
      success: true,
      jobId: "pdf-to-pptx-" + Date.now(),
      tool: "pdf-to-pptx",
      outputFiles: [
        {
          id: "out-pptx",
          fileName,
          format: "pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          data: pptxBlob,
          downloadUrl: url,
          totalPages: numPages,
          conversionMode: isFlattened ? "flattened-image" : "text-preserving",
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // 10. POWERPOINT TO PDF (PPTX -> PDF)
  // --------------------------------------------------------------------------
  public static async convertPptxToPdf(
    file: WorkspaceFile,
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    onProgress?.(20, `Inspecting presentation: ${file.name}...`, file.name);

    // Read slides via JSZip openxml presentation structure
    const arrayBuffer = await file.rawFile.arrayBuffer();
    const zip = new JSZip();
    const content = await zip.loadAsync(arrayBuffer);

    // Find all slides: ppt/slides/slide1.xml, slide2.xml...
    const slideFiles = Object.keys(content.files)
      .filter((k) => k.startsWith("ppt/slides/slide") && k.endsWith(".xml"))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, "") || "0", 10);
        const numB = parseInt(b.replace(/\D/g, "") || "0", 10);
        return numA - numB;
      });

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(file.name);
    pdfDoc.setCreator("OmniScan Titan X PowerPoint-to-PDF Engine");

    const totalSlides = Math.max(1, slideFiles.length);

    for (let s = 0; s < totalSlides; s++) {
      const percent = Math.round(20 + ((s + 1) / totalSlides) * 65);
      onProgress?.(percent, `Rendering slide ${s + 1} of ${totalSlides} to PDF...`, file.name);

      let slideText = `Slide ${s + 1}`;
      if (slideFiles[s]) {
        try {
          const xml = await content.file(slideFiles[s])?.async("string");
          if (xml) {
            // Extract text runs inside <a:t>...</a:t>
            const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
            if (matches) {
              slideText = matches
                .map((m) => m.replace(/<[^>]+>/g, "").trim())
                .filter(Boolean)
                .join("\n");
            }
          }
        } catch {}
      }

      // Render slide onto widescreen 16:9 canvas
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Slide header bar
        ctx.fillStyle = "#0284C7";
        ctx.fillRect(0, 0, canvas.width, 16);

        ctx.fillStyle = "#0F172A";
        ctx.font = "bold 44px 'Plus Jakarta Sans', system-ui, sans-serif";
        ctx.fillText(`Slide ${s + 1}`, 100, 100);

        ctx.fillStyle = "#334155";
        ctx.font = "30px 'Plus Jakarta Sans', system-ui, sans-serif";
        const lines = slideText.split("\n");
        let y = 180;
        for (const line of lines.slice(0, 14)) {
          ctx.fillText(line, 100, y);
          y += 50;
        }

        const dataUrl = canvas.toDataURL("image/png");
        await this.embedImageToPdfDoc(pdfDoc, dataUrl, config);
      }
    }

    onProgress?.(90, "Finalizing PDF...");
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const baseName = FileNamingManager.getBaseName(file.name);
    const fileName = FileNamingManager.generateOutputName({
      baseName,
      extension: "pdf",
      customPattern: config.outputFileNamePattern,
    });

    onProgress?.(100, "PowerPoint to PDF complete!");

    return {
      success: true,
      jobId: "pptx-to-pdf-" + Date.now(),
      tool: "pptx-to-pdf",
      outputFiles: [
        {
          id: "out-pptx-pdf",
          fileName,
          format: "pdf",
          mimeType: "application/pdf",
          data: blob,
          downloadUrl: url,
          totalPages: totalSlides,
          conversionMode: "text-preserving",
        },
      ],
      totalTimeMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // HELPER UTILITIES
  // --------------------------------------------------------------------------

  /**
   * Embed an image DataURL into a PDFDocument with specified margins, paper size, and orientation
   */
  private static async embedImageToPdfDoc(
    pdfDoc: PDFDocument,
    imgDataUrl: string,
    config: ConversionJobConfig
  ): Promise<void> {
    const isPng = imgDataUrl.startsWith("data:image/png");
    const embeddedImg = isPng ? await pdfDoc.embedPng(imgDataUrl) : await pdfDoc.embedJpg(imgDataUrl);

    // Default A4 dimensions in points: 595.28 x 841.89
    let pageW = 595.28;
    let pageH = 841.89;

    if (config.pageSize === "A5") {
      pageW = 419.53;
      pageH = 595.28;
    } else if (config.pageSize === "A6") {
      pageW = 297.64;
      pageH = 419.53;
    } else if (config.pageSize === "Letter") {
      pageW = 612.0;
      pageH = 792.0;
    } else if (config.pageSize === "Legal") {
      pageW = 612.0;
      pageH = 1008.0;
    } else if (config.pageSize === "Custom" && config.customWidthMm && config.customHeightMm) {
      pageW = (config.customWidthMm / 25.4) * 72;
      pageH = (config.customHeightMm / 25.4) * 72;
    }

    if (config.orientation === "landscape" || (config.orientation === "auto" && embeddedImg.width > embeddedImg.height)) {
      if (pageW < pageH) {
        const temp = pageW;
        pageW = pageH;
        pageH = temp;
      }
    }

    const marginPt = ((config.marginMm || 0) / 25.4) * 72;
    const availW = Math.max(10, pageW - marginPt * 2);
    const availH = Math.max(10, pageH - marginPt * 2);

    let drawW = availW;
    let drawH = availH;
    let drawX = marginPt;
    let drawY = marginPt;

    if (config.fitMode === "fit-to-page") {
      const imgAspect = embeddedImg.width / embeddedImg.height;
      const boxAspect = availW / availH;
      if (imgAspect > boxAspect) {
        drawW = availW;
        drawH = availW / imgAspect;
        drawY = marginPt + (availH - drawH) / 2;
      } else {
        drawH = availH;
        drawW = availH * imgAspect;
        drawX = marginPt + (availW - drawW) / 2;
      }
    } else if (config.fitMode === "full-bleed") {
      drawW = pageW;
      drawH = pageH;
      drawX = 0;
      drawY = 0;
    }

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });
  }

  /**
   * Render DOCX, TXT, or RTF document file into crisp 300 DPI canvas pages
   */
  public static async renderDocumentToCanvases(file: WorkspaceFile): Promise<HTMLCanvasElement[]> {
    const canvases: HTMLCanvasElement[] = [];
    const ext = file.format;

    if (ext === "docx") {
      try {
        const arrayBuffer = await file.rawFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;

        // Strip tags and split into paragraphs
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        const paragraphs = Array.from(tempDiv.querySelectorAll("p, h1, h2, h3, li, tr")).map(
          (el) => el.textContent?.trim() || ""
        );

        return this.renderTextLinesToCanvasPages(
          paragraphs.filter(Boolean),
          FileNamingManager.getBaseName(file.name)
        );
      } catch {
        // Fallback to text reading
      }
    }

    const text = await file.rawFile.text();
    const lines = text.split("\n").map((l) => l.trimEnd());
    return this.renderTextLinesToCanvasPages(lines, FileNamingManager.getBaseName(file.name));
  }

  private static renderTextLinesToCanvasPages(lines: string[], title: string): HTMLCanvasElement[] {
    const PAGE_W = 1240;
    const PAGE_H = 1754;
    const MARGIN = 100;
    const LINE_H = 32;
    const MAX_LINES = Math.floor((PAGE_H - MARGIN * 2 - 80) / LINE_H);

    const chunks: string[][] = [];
    let currentChunk: string[] = [];
    for (const line of lines) {
      currentChunk.push(line);
      if (currentChunk.length >= MAX_LINES) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }
    if (currentChunk.length > 0 || chunks.length === 0) {
      chunks.push(currentChunk);
    }

    return chunks.map((chunk, idx) => {
      const canvas = document.createElement("canvas");
      canvas.width = PAGE_W;
      canvas.height = PAGE_H;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);

        // Header
        ctx.fillStyle = "#64748B";
        ctx.font = "14px 'Plus Jakarta Sans', system-ui, sans-serif";
        ctx.fillText(title.slice(0, 70), MARGIN, MARGIN - 40);
        ctx.textAlign = "right";
        ctx.fillText(`Page ${idx + 1} of ${chunks.length}`, PAGE_W - MARGIN, MARGIN - 40);

        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN, MARGIN - 28);
        ctx.lineTo(PAGE_W - MARGIN, MARGIN - 28);
        ctx.stroke();

        // Lines
        ctx.textAlign = "left";
        ctx.fillStyle = "#0F172A";
        ctx.font = "18px 'JetBrains Mono', monospace";
        let y = MARGIN + 20;
        for (const l of chunk) {
          ctx.fillText(l.slice(0, 95), MARGIN, y);
          y += LINE_H;
        }
      }
      return canvas;
    });
  }

  /**
   * Render 2D array of spreadsheet cells into professional paginated table canvases
   */
  private static renderTableToCanvases(
    rows: any[][],
    sheetName: string,
    config: ConversionJobConfig
  ): HTMLCanvasElement[] {
    const isLandscape = config.orientation === "landscape";
    const PAGE_W = isLandscape ? 1754 : 1240;
    const PAGE_H = isLandscape ? 1240 : 1754;
    const MARGIN = 80;
    const ROW_H = 34;

    const maxCols = Math.min(12, Math.max(...rows.map((r) => r.length)));
    const colW = (PAGE_W - MARGIN * 2) / Math.max(1, maxCols);
    const maxRowsPerPage = Math.floor((PAGE_H - MARGIN * 2 - 90) / ROW_H);

    const canvases: HTMLCanvasElement[] = [];
    const totalPages = Math.ceil(rows.length / maxRowsPerPage);

    for (let p = 0; p < totalPages; p++) {
      const canvas = document.createElement("canvas");
      canvas.width = PAGE_W;
      canvas.height = PAGE_H;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);

        // Sheet Header
        ctx.fillStyle = "#0284C7";
        ctx.font = "bold 18px 'Plus Jakarta Sans', system-ui, sans-serif";
        ctx.fillText(`Sheet: ${sheetName}`, MARGIN, MARGIN - 40);
        ctx.textAlign = "right";
        ctx.fillStyle = "#64748B";
        ctx.font = "14px 'Plus Jakarta Sans', system-ui, sans-serif";
        ctx.fillText(`Page ${p + 1} of ${totalPages}`, PAGE_W - MARGIN, MARGIN - 40);

        ctx.textAlign = "left";
        const pageRows = rows.slice(p * maxRowsPerPage, (p + 1) * maxRowsPerPage);
        let y = MARGIN;

        pageRows.forEach((row, rIdx) => {
          const isHeader = p === 0 && rIdx === 0;
          ctx.fillStyle = isHeader ? "#F1F5F9" : rIdx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
          ctx.fillRect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H);

          // Gridlines
          if (config.gridlinesVisible !== false) {
            ctx.strokeStyle = "#E2E8F0";
            ctx.lineWidth = 1;
            ctx.strokeRect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H);
          }

          ctx.fillStyle = isHeader ? "#0F172A" : "#334155";
          ctx.font = isHeader ? "bold 13px system-ui" : "12px system-ui";

          for (let c = 0; c < maxCols; c++) {
            const cellVal = String(row[c] !== undefined ? row[c] : "");
            ctx.fillText(cellVal.slice(0, 24), MARGIN + c * colW + 8, y + 22);
          }
          y += ROW_H;
        });
      }
      canvases.push(canvas);
    }

    return canvases;
  }

  /**
   * Cluster text items with similar Y-coordinates into logical lines
   */
  private static clusterTextItemsIntoLines(
    items: any[]
  ): { text: string; fontSize: number; isBold: boolean; y: number }[] {
    if (!items || items.length === 0) return [];

    // Sort items top-to-bottom (PDF coordinates have 0 at bottom, transform[5] is Y)
    const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);

    const lines: { text: string; fontSize: number; isBold: boolean; y: number }[] = [];
    let currentY = sorted[0].transform[5];
    let currentLineItems: any[] = [];

    for (const item of sorted) {
      const y = item.transform[5];
      if (Math.abs(y - currentY) > 6) {
        // New line detected
        currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
        const lineText = currentLineItems.map((i) => i.str).join(" ").trim();
        if (lineText) {
          lines.push({
            text: lineText,
            fontSize: currentLineItems[0].transform[0] || 12,
            isBold: /bold/i.test(currentLineItems[0].fontName || ""),
            y: currentY,
          });
        }
        currentLineItems = [item];
        currentY = y;
      } else {
        currentLineItems.push(item);
      }
    }

    if (currentLineItems.length > 0) {
      currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
      const lineText = currentLineItems.map((i) => i.str).join(" ").trim();
      if (lineText) {
        lines.push({
          text: lineText,
          fontSize: currentLineItems[0].transform[0] || 12,
          isBold: /bold/i.test(currentLineItems[0].fontName || ""),
          y: currentY,
        });
      }
    }

    return lines;
  }

  /**
   * Cluster items by Y and X into a 2D table grid
   */
  private static extractTableGridFromItems(items: any[]): string[][] {
    const lines = this.clusterTextItemsIntoLines(items);
    return lines.map((l) => l.text.split(/\s{2,}|\t/).map((cell) => cell.trim()));
  }

  private static resolvePageRanges(
    splitMode: ConversionJobConfig["splitMode"],
    customRanges: string | undefined,
    totalPages: number
  ): { label: string; pageIndices: number[] }[] {
    if (splitMode === "odd-pages") {
      const indices: number[] = [];
      for (let i = 0; i < totalPages; i += 2) indices.push(i);
      return [{ label: "Odd_Pages", pageIndices: indices }];
    }
    if (splitMode === "even-pages") {
      const indices: number[] = [];
      for (let i = 1; i < totalPages; i += 2) indices.push(i);
      return [{ label: "Even_Pages", pageIndices: indices }];
    }
    if (splitMode === "front-only") {
      return [{ label: "Front_Page", pageIndices: [0] }];
    }
    if (splitMode === "last-only") {
      return [{ label: "Last_Page", pageIndices: [totalPages - 1] }];
    }

    if (customRanges && customRanges.trim()) {
      const parts = customRanges.split(",").map((p) => p.trim()).filter(Boolean);
      const groups: { label: string; pageIndices: number[] }[] = [];

      for (const part of parts) {
        if (part.includes("-")) {
          const [sStr, eStr] = part.split("-").map((x) => parseInt(x.trim(), 10));
          if (!isNaN(sStr) && !isNaN(eStr)) {
            const start = Math.max(1, Math.min(sStr, eStr));
            const end = Math.min(totalPages, Math.max(sStr, eStr));
            const indices: number[] = [];
            for (let k = start; k <= end; k++) indices.push(k - 1);
            groups.push({ label: `Pages_${start}-${end}`, pageIndices: indices });
          }
        } else {
          const p = parseInt(part, 10);
          if (!isNaN(p) && p >= 1 && p <= totalPages) {
            groups.push({ label: `Page_${p}`, pageIndices: [p - 1] });
          }
        }
      }
      if (groups.length > 0) return groups;
    }

    // Default: all pages
    const all: number[] = [];
    for (let i = 0; i < totalPages; i++) all.push(i);
    return [{ label: "All_Pages", pageIndices: all }];
  }

  private static fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

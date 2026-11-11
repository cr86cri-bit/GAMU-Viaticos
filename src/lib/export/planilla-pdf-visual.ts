"use client";

import { centrarNumeroDocumento } from "./centrar-numero-documento";

/**
 * El PDF se construye a partir del MISMO HTML que se presenta en el modal.
 * De esta forma se conservan columnas, tamaños, colores, fuentes y firmas.
 * El PDF es una reproducción visual (imagen de alta resolución): no tiene texto seleccionable.
 */
export async function exportarPlanillaVisualPDF(numeroDocumento: string): Promise<Blob> {
  const documentElement = document.querySelector<HTMLElement>(
    '[data-gamu-print-document="true"]',
  );
  if (!documentElement) {
    throw new Error("Abre la previsualización antes de exportar la planilla.");
  }

  // Esperar a las variantes Regular y Bold y al escudo antes de tomar la imagen.
  if (document.fonts) {
    await Promise.all([
      document.fonts.load('400 14px "GAMU Twentieth Century"'),
      document.fonts.load('700 14px "GAMU Twentieth Century"'),
    ]);
    await document.fonts.ready;
  }
  if (document.fonts && (!document.fonts.check('400 14px "GAMU Twentieth Century"') || !document.fonts.check('700 14px "GAMU Twentieth Century"'))) {
    throw new Error('No se cargaron Twentieth Century Regular y Bold en la previsualización. Comprueba public/fonts.');
  }
  const imageElements = [...documentElement.querySelectorAll("img")];
  await Promise.all(imageElements.map(async (img) => {
    if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }
    if (img.complete && img.naturalWidth && typeof img.decode === "function") {
      await img.decode().catch(() => undefined);
    }
  }));

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // El número definitivo se cambia ÚNICAMENTE en el nodo del número.
  // No se reemplaza el texto ni la estructura del recuadro, que son los mismos
  // del HTML de previsualización.
  // Centrar los píxeles visibles del correlativo definitivo antes de
  // capturar la planilla completa; el renderizador del PDF usa ese mismo DOM.
  const numberCell = documentElement.querySelector<HTMLElement>(
    '[data-gamu-document-number="true"]',
  );
  const numberSpan = numberCell?.querySelector<HTMLElement>(".gamu-document-text");
  const previousNumber = numberSpan?.textContent ?? "";
  if (numberSpan) numberSpan.textContent = numeroDocumento;
  try {
    await centrarNumeroDocumento(documentElement, html2canvas);
  } finally {
    if (numberSpan) numberSpan.textContent = previousNumber;
  }

  const canvas = await html2canvas(documentElement, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    width: documentElement.scrollWidth,
    height: documentElement.scrollHeight,
    windowWidth: Math.max(window.innerWidth, documentElement.scrollWidth),
    onclone: (clonedDocument) => {
      const number = clonedDocument.querySelector<HTMLElement>(
        '[data-gamu-document-number="true"]',
      );
      if (number) {
        // Preservar el span interno que controla el centrado óptico.
        // Cambiar textContent del contenedor lo elimina y rompe la alineación
        // solamente en el PDF, aunque la previsualización se vea correcta.
        const text = number.querySelector<HTMLElement>(".gamu-document-text");
        if (text) text.textContent = numeroDocumento;
        else number.textContent = numeroDocumento;
      }

      const sheet = clonedDocument.querySelector<HTMLElement>(
        '[data-gamu-print-document="true"]',
      );
      if (sheet) {
        // Sin modificar medidas, bordes ni estilos: captura fiel del HTML.
        sheet.style.boxShadow = "none";
      }
    },
  });
  if (!canvas.width || !canvas.height) {
    throw new Error("No se pudo capturar el documento de la previsualización.");
  }

  // El HTML de 1480px ES la hoja, incluido su padding interior.
  // No sumar márgenes exteriores: eso cambia escalas y separaciones.
  const output = new jsPDF({
    orientation: "landscape", format: "a3", unit: "mm", compress: true,
  });
  const pageWidth = output.internal.pageSize.getWidth();
  const pageHeight = output.internal.pageSize.getHeight();
  const margin = 0;
  const width = pageWidth;
  const height = pageHeight;
  const pixelsPerMm = canvas.width / width;
  const pagePixels = Math.max(1, Math.floor(height * pixelsPerMm));

  // Para planillas extensas se distribuye la captura entre varias páginas A3.
  // Se reutiliza la misma imagen del HTML, sin volver a dibujar la tabla.
  let top = 0;
  let page = 0;
  while (top < canvas.height) {
    if (page > 0) output.addPage("a3", "landscape");
    const pixels = Math.min(pagePixels, canvas.height - top);
    const tile = document.createElement("canvas");
    tile.width = canvas.width;
    tile.height = pixels;
    const ctx = tile.getContext("2d");
    if (!ctx) throw new Error("No se pudo componer el PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tile.width, tile.height);
    ctx.drawImage(canvas, 0, top, canvas.width, pixels, 0, 0, canvas.width, pixels);
    output.addImage(tile.toDataURL("image/png"), "PNG", margin, margin,
      width, pixels / pixelsPerMm, undefined, "FAST");
    top += pixels;
    page++;
  }
  return output.output("blob");
}

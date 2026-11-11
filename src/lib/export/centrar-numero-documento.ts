"use client";

/**
 * Centra la tinta realmente dibujada, no la caja tipográfica (que para
 * Twentieth Century Bold tiene un espacio vertical interno asimétrico).
 * El mismo cálculo se usa en la previsualización y en la exportación.
 */
export async function centrarNumeroDocumento(
  root: ParentNode,
  html2canvas: typeof import("html2canvas")["default"],
): Promise<void> {
  const parts = [
    '[data-gamu-document-label="true"]',
    '[data-gamu-document-number="true"]',
  ];
  for (const selector of parts) {
    const cell = root.querySelector<HTMLElement>(selector);
    const span = cell?.querySelector<HTMLElement>(".gamu-document-text");
    if (!cell || !span) continue;

    // Restablecemos la corrección previa para evitar acumulación de offsets.
    span.style.setProperty("--gamu-ink-offset", "0px");
    const canvas = await html2canvas(cell, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: cell.clientWidth,
      height: cell.clientHeight,
    });
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;
    const { width, height } = canvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let first = height;
    let last = -1;
    // Ignorar el borde exterior y divisiones verticales del recuadro.
    const inset = Math.max(5, Math.round(height * 0.13));
    for (let y = inset; y < height - inset; y++) {
      let ink = 0;
      for (let x = 7; x < width - 7; x++) {
        const k = 4 * (y * width + x);
        if (pixels[k + 3] > 200 && pixels[k] < 110 && pixels[k + 1] < 110 && pixels[k + 2] < 110) ink++;
      }
      // Una sola línea antialiasing o borde no se considera texto.
      if (ink >= 3) {
        first = Math.min(first, y);
        last = y;
      }
    }
    if (last < first) continue;
    const target = (height - 1) / 2;
    const actual = (first + last) / 2;
    // Convertir píxeles de la captura a píxeles CSS; límite preventivo.
    const offset = Math.max(-14, Math.min(14, (target - actual) / 2));
    span.style.setProperty("--gamu-ink-offset", `${offset.toFixed(2)}px`);
  }
}

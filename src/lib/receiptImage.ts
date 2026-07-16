import html2canvas from 'html2canvas'

/**
 * Render a DOM node to a PNG image and open a print dialog that prints
 * only the image (no surrounding app UI). The image is rendered at high
 * resolution for crisp thermal-printer output.
 */
export async function printNodeAsImage(node: HTMLElement): Promise<void> {
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  })

  const dataUrl = canvas.toDataURL('image/png')
  await printImage(dataUrl, canvas.width, canvas.height)
}

export async function printNodeDomOnly(node: HTMLElement): Promise<void> {
  const iframe = createPrintFrame()
  const doc = iframe.contentWindow?.document

  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Unable to open print frame')
  }

  const widthPx = Math.ceil(node.scrollWidth)
  const heightPx = Math.ceil(node.scrollHeight)
  const widthMm = pxToMm(widthPx)
  const heightMm = pxToMm(heightPx)

  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${widthMm.toFixed(2)}mm ${heightMm.toFixed(2)}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${widthMm.toFixed(2)}mm; }
  .receipt-print-root { width: ${widthMm.toFixed(2)}mm; background: #fff; }
</style>
</head>
<body>
  <div class="receipt-print-root">${node.innerHTML}</div>
</body>
</html>`)
  doc.close()

  await waitForPrintFrame(doc, iframe.contentWindow!)
  triggerPrint(iframe)
}

async function printImage(dataUrl: string, width: number, height: number): Promise<void> {
  const iframe = createPrintFrame()
  const doc = iframe.contentWindow?.document

  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Unable to open print frame')
  }

  const widthMm = pxToMm(width / 2)
  const heightMm = pxToMm(height / 2)

  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${widthMm.toFixed(2)}mm ${heightMm.toFixed(2)}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  img { display: block; width: ${widthMm.toFixed(2)}mm; height: ${heightMm.toFixed(2)}mm; }
</style>
</head>
<body><img src="${dataUrl}" onload="window.__imgReady = true" /></body>
</html>`)
  doc.close()

  await waitForPrintFrame(doc, iframe.contentWindow!)
  triggerPrint(iframe)
}

function createPrintFrame(): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  return iframe
}

function pxToMm(px: number): number {
  return (px / 96) * 25.4
}

async function waitForPrintFrame(doc: Document, win: Window): Promise<void> {
  const img = doc.querySelector('img') as HTMLImageElement | null
  if (!img) return
  if (img.complete && img.naturalWidth > 0) return

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if ((win as Window & { __imgReady?: boolean }).__imgReady) {
        clearInterval(check)
        resolve()
      }
    }, 50)

    setTimeout(() => {
      clearInterval(check)
      resolve()
    }, 2000)
  })
}

function triggerPrint(iframe: HTMLIFrameElement): void {
  const win = iframe.contentWindow
  if (!win) {
    document.body.removeChild(iframe)
    return
  }

  win.focus()
  win.print()
  setTimeout(() => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe)
    }
  }, 500)
}

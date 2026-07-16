import html2canvas from 'html2canvas'

/**
 * Open a blank receipt print window immediately from the user gesture so
 * mobile browsers do not treat it as a blocked popup.
 */
export function openReceiptPrintWindow(): Window {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Unable to open print window')
  }

  const doc = printWindow.document
  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Preparing Receipt...</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: Arial, sans-serif;
    }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status {
      font-size: 14px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="status">Preparing receipt...</div>
</body>
</html>`)
  doc.close()

  return printWindow
}

/**
 * Render a DOM node to a PNG image and open a print dialog that prints
 * only the image (no surrounding app UI). The image is rendered at high
 * resolution for crisp thermal-printer output.
 */
export async function printNodeAsImage(node: HTMLElement, printWindow = openReceiptPrintWindow()): Promise<void> {
  try {
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    })

    const dataUrl = canvas.toDataURL('image/png')
    await renderImageDocument(printWindow, dataUrl, canvas.width, canvas.height)
    await triggerPrint(printWindow)
  } catch (error) {
    safelyClosePrintWindow(printWindow)
    throw error
  }
}

export async function printNodeDomOnly(node: HTMLElement, printWindow = openReceiptPrintWindow()): Promise<void> {
  try {
    const widthPx = Math.ceil(node.scrollWidth)
    const heightPx = Math.ceil(node.scrollHeight)
    const widthMm = pxToMm(widthPx)
    const heightMm = pxToMm(heightPx)
    const doc = printWindow.document

    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt Print</title>
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

    await waitForDocumentReady(printWindow)
    await triggerPrint(printWindow)
  } catch (error) {
    safelyClosePrintWindow(printWindow)
    throw error
  }
}

async function renderImageDocument(printWindow: Window, dataUrl: string, width: number, height: number): Promise<void> {
  const widthMm = pxToMm(width / 2)
  const heightMm = pxToMm(height / 2)
  const doc = printWindow.document

  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt Print</title>
  <style>
    @page { size: ${widthMm.toFixed(2)}mm ${heightMm.toFixed(2)}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    img {
      display: block;
      width: ${widthMm.toFixed(2)}mm;
      height: ${heightMm.toFixed(2)}mm;
    }
  </style>
</head>
<body></body>
</html>`)
  doc.close()

  await waitForDocumentReady(printWindow)

  const img = doc.createElement('img')
  const imageReady = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Receipt image failed to load in print window'))
  })

  img.src = dataUrl
  doc.body.innerHTML = ''
  doc.body.appendChild(img)

  await imageReady
}

function pxToMm(px: number): number {
  return (px / 96) * 25.4
}

async function waitForDocumentReady(printWindow: Window): Promise<void> {
  const doc = printWindow.document
  if (doc.readyState === 'complete' || doc.readyState === 'interactive') {
    return
  }

  await new Promise<void>((resolve) => {
    const onReady = () => {
      doc.removeEventListener('readystatechange', onReady)
      resolve()
    }
    doc.addEventListener('readystatechange', onReady)
    setTimeout(resolve, 500)
  })
}

async function triggerPrint(printWindow: Window): Promise<void> {
  await new Promise<void>((resolve) => {
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      resolve()
    }

    const onAfterPrint = () => {
      printWindow.removeEventListener('afterprint', onAfterPrint)
      done()
    }

    printWindow.addEventListener('afterprint', onAfterPrint)
    printWindow.focus()
    printWindow.print()

    setTimeout(() => {
      printWindow.removeEventListener('afterprint', onAfterPrint)
      done()
    }, 1500)
  })

  setTimeout(() => {
    safelyClosePrintWindow(printWindow)
  }, 1000)
}

function safelyClosePrintWindow(printWindow: Window): void {
  if (!printWindow.closed) {
    printWindow.close()
  }
}

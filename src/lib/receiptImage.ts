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
 * Render a DOM receipt into the blank print window as normal HTML/CSS so
 * text stays selectable and thermal printing is lighter than raster output.
 */
export async function printNodeDomOnly(node: HTMLElement, printWindow = openReceiptPrintWindow()): Promise<void> {
  try {
    const widthPx = Math.ceil(node.scrollWidth)
    const widthMm = pxToMm(widthPx)
    const doc = printWindow.document

    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt Print</title>
  <style>
    @page {
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }

    body {
      width: ${widthMm.toFixed(2)}mm;
      min-width: ${widthMm.toFixed(2)}mm;
      font-family: "JetBrains Mono", "Courier New", monospace;
    }

    .receipt-print-root {
      width: ${widthMm.toFixed(2)}mm;
      min-width: ${widthMm.toFixed(2)}mm;
      background: #fff;
    }

    .receipt-print-root * {
      box-sizing: border-box;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
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
    setTimeout(() => {
      doc.removeEventListener('readystatechange', onReady)
      resolve()
    }, 500)
  })
}

async function triggerPrint(printWindow: Window): Promise<void> {
  printWindow.focus()
  printWindow.print()
}

function safelyClosePrintWindow(printWindow: Window): void {
  if (!printWindow.closed) {
    printWindow.close()
  }
}

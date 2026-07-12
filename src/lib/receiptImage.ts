import html2canvas from 'html2canvas'

export async function printNodeAsImage(node: HTMLElement): Promise<void> {
  const canvas = await html2canvas(node, {
    scale: 3,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  })

  const dataUrl = canvas.toDataURL('image/png')
  printImage(dataUrl, canvas.width, canvas.height)
}

function printImage(dataUrl: string, width: number, height: number): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Unable to open print frame')
  }
  // Convert pixel dimensions to mm assuming 96 DPI (CSS reference pixel).
  const pxToMm = (px: number) => (px / 96) * 25.4
  const widthMm = pxToMm(width / 3) // undo scale for physical sizing
  const heightMm = pxToMm(height / 3)
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
  const win = iframe.contentWindow!
  const cleanup = () => document.body.removeChild(iframe)

  const triggerPrint = () => {
    win.focus()
    win.print()
    // Give the browser a moment before removing the iframe.
    setTimeout(cleanup, 500)
  }
  // Wait for the image to load before printing.
  const img = doc.querySelector('img') as HTMLImageElement | null
  if (img && img.complete && img.naturalWidth > 0) {
    triggerPrint()
  } else {
    const check = setInterval(() => {
      if ((win as any).__imgReady) {
        clearInterval(check)
        triggerPrint()
      }
    }, 50)
    // Safety timeout
    setTimeout(() => {
      clearInterval(check)
      triggerPrint()
    }, 2000)
  }
}

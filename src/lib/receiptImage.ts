import html2canvas from 'html2canvas'

const PRINT_IMG_ID = 'receipt-print-image'

/**
 * Render a DOM node to a PNG image and print it from the main window.
 * Injects a print-only <img> into the document and uses @media print CSS
 * (defined in index.css) to hide everything else during printing.
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

  let printImg = document.getElementById(PRINT_IMG_ID) as HTMLImageElement | null
  if (!printImg) {
    printImg = document.createElement('img')
    printImg.id = PRINT_IMG_ID
    document.body.appendChild(printImg)
  }

  // Wait for the image to finish loading before printing,
  // otherwise browsers may print a blank page.
  await new Promise<void>((resolve, reject) => {
    printImg!.onload = () => resolve()
    printImg!.onerror = () => reject(new Error('Failed to load receipt image'))
    printImg!.src = dataUrl
  })

  document.body.classList.add('printing-receipt-image')

  // Defer print so the browser applies the class and repaints.
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => requestAnimationFrame(r))

  window.print()

  setTimeout(() => {
    document.body.classList.remove('printing-receipt-image')
  }, 1000)
}

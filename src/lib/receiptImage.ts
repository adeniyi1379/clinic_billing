import html2canvas from 'html2canvas'

const PRINT_IMG_ID = 'receipt-print-image'

/**
 * Render a DOM node to a PNG image and print it from the main window.
 * Uses a print-only <img> element + @media print CSS so only the image
 * is visible in the print dialog. This avoids iframes, which mobile
 * browsers handle unreliably (zero-size iframes don't render content,
 * and iframe.print() is often a no-op on mobile).
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

  // Get or create the print-only image element in the main document.
  let printImg = document.getElementById(PRINT_IMG_ID) as HTMLImageElement | null
  if (!printImg) {
    printImg = document.createElement('img')
    printImg.id = PRINT_IMG_ID
    document.body.appendChild(printImg)
  }

  // Wait for the image to finish loading before calling print,
  // otherwise mobile browsers print a blank page.
  await new Promise<void>((resolve, reject) => {
    printImg!.onload = () => resolve()
    printImg!.onerror = () => reject(new Error('Failed to load receipt image'))
    printImg!.src = dataUrl
  })

  // Signal to the print CSS that we're in image-print mode.
  document.body.classList.add('printing-receipt-image')
  ensurePrintStyles()

  // Defer print so the browser has time to apply the class + repaint.
  await new Promise((r) => requestAnimationFrame(r))

  window.print()

  // Cleanup after printing settles.
  setTimeout(() => {
    document.body.classList.remove('printing-receipt-image')
  }, 1000)
}

let stylesInjected = false

function ensurePrintStyles() {
  if (stylesInjected) return
  const style = document.createElement('style')
  style.id = 'receipt-image-print-styles'
  style.textContent = `
    @media print {
      body.printing-receipt-image > *:not(#${PRINT_IMG_ID}) {
        display: none !important;
      }
      body.printing-receipt-image {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      body.printing-receipt-image #${PRINT_IMG_ID} {
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        max-width: 80mm !important;
        height: auto !important;
      }
    }
    @media screen {
      #${PRINT_IMG_ID} {
        position: absolute;
        left: -9999px;
        top: 0;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
      }
    }
  `
  document.head.appendChild(style)
  stylesInjected = true
}

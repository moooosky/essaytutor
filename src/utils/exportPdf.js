/**
 * 把指定 DOM 节点导出为 PDF（多页 A4 自动分页）
 *
 * 思路：
 *   1. html2canvas 整体截图（high DPI）
 *   2. 按 A4 高度切片，每片放一页 PDF
 *   3. jsPDF.save() 触发下载
 */
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// A4 物理尺寸（毫米）
const A4_W_MM = 210
const A4_H_MM = 297

/**
 * @param {HTMLElement} node - 要导出的 DOM
 * @param {string} fileName - 文件名（不含扩展名）
 */
export async function exportNodeToPdf(node, fileName = 'export') {
  if (!node) throw new Error('导出节点为空')

  // 等待节点中所有 <img> 加载完成（避免截图时图片还没解码出来）
  await waitImagesLoaded(node)

  // 高清截图
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight
  })

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  })

  // 每页对应的 canvas 像素高度
  const canvasW = canvas.width
  const canvasH = canvas.height
  const pageCanvasH = Math.floor((canvasW * A4_H_MM) / A4_W_MM)

  let renderedH = 0
  let pageIndex = 0

  while (renderedH < canvasH) {
    const sliceH = Math.min(pageCanvasH, canvasH - renderedH)

    // 把 canvas 的一段切到临时画布
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvasW
    pageCanvas.height = sliceH
    const ctx = pageCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, sliceH)
    ctx.drawImage(
      canvas,
      0, renderedH, canvasW, sliceH,
      0, 0, canvasW, sliceH
    )

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92)

    if (pageIndex > 0) pdf.addPage()
    // 切片高度按比例换算为 mm
    const sliceMM = (sliceH * A4_W_MM) / canvasW
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, sliceMM)

    renderedH += sliceH
    pageIndex += 1
  }

  pdf.save(`${fileName}.pdf`)
}

/**
 * 等待 DOM 内所有 <img> 加载完成
 */
function waitImagesLoaded(node) {
  const imgs = Array.from(node.querySelectorAll('img'))
  if (imgs.length === 0) return Promise.resolve()
  return Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve()
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    })
  }))
}

/**
 * 把上传的图片文件名变成"安全可用的 PDF 文件名"（去扩展名 + 去非法字符）
 */
export function buildPdfFileName(imageFileName, fallback = '作文批改') {
  if (!imageFileName) return `${fallback}_${todayStamp()}`
  // 去扩展名
  const dot = imageFileName.lastIndexOf('.')
  const stem = dot > 0 ? imageFileName.slice(0, dot) : imageFileName
  // 去掉文件系统不友好的字符
  const safe = stem.replace(/[\\/:*?"<>|]/g, '_').trim()
  return safe || `${fallback}_${todayStamp()}`
}

function todayStamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

export function todayDateString() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

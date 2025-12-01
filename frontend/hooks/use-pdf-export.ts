import { useCallback, useState } from 'react'

export interface PDFHeader {
  title: string
  patientName: string
  fields: { label: string; value: string }[]
}

export interface PDFExportOptions {
  header: PDFHeader
  content: string
  footer?: string
  filename: string
}

export interface PDFExportError {
  message: string
  error: unknown
}

/**
 * Custom hook for generating and downloading PDF documents
 *
 * Usage:
 * const { exportToPDF, isGenerating } = usePDFExport()
 *
 * exportToPDF({
 *   header: {
 *     title: "DISCHARGE INSTRUCTIONS",
 *     patientName: "John Doe",
 *     fields: [
 *       { label: "Discharge Date", value: "March 15, 2024" },
 *       { label: "Attending Physician", value: "Dr. Sarah Johnson, MD" }
 *     ]
 *   },
 *   content: "Your discharge instructions...",
 *   footer: "This content has been simplified using AI.",
 *   filename: "discharge-instructions-john-doe.pdf"
 * })
 */
export function usePDFExport() {
  const [isGenerating, setIsGenerating] = useState(false)

  const exportToPDF = useCallback(
    async (options: PDFExportOptions): Promise<boolean> => {
      const { header, content, footer, filename } = options

      setIsGenerating(true)
      try {
        // Dynamically import jsPDF to reduce initial bundle size
        const { default: jsPDF } = await import('jspdf')
        
        // Create PDF instance
        const pdf = new jsPDF()
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const margin = 20
        const maxWidth = pageWidth - margin * 2

        let yPosition = 30

        // Add title
        pdf.setFontSize(18)
        pdf.setFont('helvetica', 'bold')
        pdf.text(header.title, margin, yPosition)
        yPosition += 15

        // Add patient name
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'normal')
        pdf.text(header.patientName, margin, yPosition)
        yPosition += 10

        // Add header fields
        header.fields.forEach((field) => {
          pdf.text(`${field.label}: ${field.value}`, margin, yPosition)
          yPosition += 10
        })

        // Add spacing before content
        yPosition += 5

        // Add content with word wrapping
        const lines = pdf.splitTextToSize(content, maxWidth)
        pdf.setFontSize(10)

        for (let i = 0; i < lines.length; i++) {
          // Check if we need a new page
          if (yPosition > pageHeight - 30) {
            pdf.addPage()
            yPosition = 20
          }
          pdf.text(lines[i], margin, yPosition)
          yPosition += 6
        }

        // Add footer if provided
        if (footer) {
          // Ensure footer is on a page with enough space
          if (yPosition > pageHeight - 30) {
            pdf.addPage()
            yPosition = 20
          } else {
            yPosition += 10
          }

          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'italic')
          const footerLines = pdf.splitTextToSize(footer, maxWidth)
          footerLines.forEach((line: string) => {
            pdf.text(line, margin, yPosition)
            yPosition += 5
          })
        }

        // Save the PDF
        pdf.save(filename)
        return true
      } catch (error) {
        console.error('[usePDFExport] Error generating PDF:', error)

        // Fallback to text download
        try {
          await downloadAsText(options)
          return true
        } catch (fallbackError) {
          console.error('[usePDFExport] Fallback text download failed:', fallbackError)
          return false
        }
      } finally {
        setIsGenerating(false)
      }
    },
    []
  )

  return { exportToPDF, isGenerating }
}

/**
 * Fallback function to download content as plain text
 */
async function downloadAsText(options: PDFExportOptions): Promise<void> {
  const { header, content, footer, filename } = options

  // Create text content
  let textContent = `${header.title}\n\n`
  textContent += `${header.patientName}\n`
  header.fields.forEach((field) => {
    textContent += `${field.label}: ${field.value}\n`
  })
  textContent += `\n${content}`
  if (footer) {
    textContent += `\n\n${footer}`
  }

  // Create blob and download
  const blob = new Blob([textContent], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace('.pdf', '.txt')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

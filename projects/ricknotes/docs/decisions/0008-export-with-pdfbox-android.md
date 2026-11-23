# Exports are drawn with PdfBox-Android onto the PDF's own pages

An Export must keep the PDF's own pages as they are (sharp, with selectable slide text), draw the strokes over them and put Inserted pages between them. The app draws it with [PdfBox-Android](https://github.com/TomRoush/PdfBox-Android) 2.0.27.0, the Android port of Apache PDFBox 2.0.27, under the Apache License 2.0: it opens the Document's PDF, appends one content stream per page that has strokes, adds Inserted pages as new A4 pages in their place, and saves a new file. The PDF's own page content is copied unchanged, so nothing is turned into a picture. Each stroke is the outline of the mesh Jetpack Ink builds with the on-screen brush, filled as a vector shape; the highlighter's alpha goes in a graphics state, so it stays see-through.

**Considered options** (checked 23 Nov 2026):

| Option | Keeps the pages | Inserted pages | Why not |
|---|---|---|---|
| Android 16's PDF editing (`PdfRenderer.Page.addPageObject`, `PdfPagePathObject`) | yes | no: it can't add a page | Needs API 36.1 or SDK extension 18; the tablet is on 36.0. No see-through fill either. |
| `android.graphics.pdf.PdfDocument` | no | yes | Writes new pages only, so the PDF's pages would have to be pictures. |
| MuPDF, iText | yes | yes | AGPL, or a paid licence. |
| Apache PDFBox 3 (desktop) | yes | yes | Needs `java.awt`, which Android doesn't have. |

**APK size:** +3.1 MB on the release APK (31.7 → 34.8 MB, measured 23 Nov 2026). Its Bouncy Castle dependency is left out (`exclude(group = "org.bouncycastle")`): PdfBox-Android uses it only for certificate-encrypted PDFs, which Android's PDF viewer can't open either, and it would add another 9 MB. The usual password and permission encryption is handled without it.

**Encryption:** an Export is saved without the PDF's encryption (`isAllSecurityToBeRemoved`). A lecture PDF often carries a permissions lock that stops text being copied; the Export is for another reader and the AI apps, which must read the slide text (spec story 4). The PDF in the Study folder is never changed.

**Trade-offs:** PdfBox-Android has had no release since January 2023 and little upstream activity since. It is used through two files (`export/ExportDrawing.kt`, `export/InkExport.kt`) and only for opening, appending to and saving a PDF, which PDFBox 2.0 has done reliably for years. If it stops working on a newer Android, or the tablet reaches API 36.1 and the platform API gains a way to add pages, the drawing can move without touching `core`'s Export plan.

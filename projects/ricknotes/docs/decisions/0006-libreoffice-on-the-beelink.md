# Office files are converted by LibreOffice on the Beelink

"Convert to PDF" on a pptx or docx sends it over Tailscale to a LibreOffice service running in Docker on the home server, and saves the returned PDF beside the original. Android has no library that lays out PowerPoint or Word files properly, and LibreOffice inside the app would add hundreds of megabytes. Google Drive's conversion was the other option, but it needs a Google sign-in and a Cloud project, and the owner preferred a service they run themselves.

**Trade-offs:** converting only works while the Beelink is up and the tablet is on Tailscale, and it adds a small server to maintain. Manual conversion on the laptop remains the fallback.

**Update, 2026-11-23:** the conversion runs in `~/ee`'s daily job (`office_to_pdf.py`), which puts a PDF beside each Office file in the paired courses on Drive. The app has no "Convert to PDF" and no converter service; LibreOffice on the Beelink is still the converter.

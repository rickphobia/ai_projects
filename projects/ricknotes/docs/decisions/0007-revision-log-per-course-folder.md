# One Revision log per Course folder, stored as files inside it

The first spec had one Error log for every course in a single `_error_log` folder. The owner wants each course's mistakes and key points kept with that course, so each Course folder holds its own `_revision_log` folder: a `revision_log.json` that is the source of truth, two Snip images per Entry, and its own Versions. Like Ink files, the logs are plain files in the Study folder, so FolderSync backs them up and they survive reinstalling the app; the app's own storage holds only settings.

**Trade-offs:** Review has to walk the Study folder to find every log instead of reading one file, and an Entry's Document is stored as a path, so renaming a PDF outside the app leaves the Entry pointing at nothing until milestone 3's rename carries it along.

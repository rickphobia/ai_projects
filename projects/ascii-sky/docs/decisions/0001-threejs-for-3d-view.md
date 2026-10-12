# three.js draws the 3D view; we turn it into characters ourselves

The Cockpit view needs a real 3D World drawn as ASCII. We use three.js to render the scene into a small hidden image with one pixel per character cell, read each pixel's brightness back, and pick a character from the Character ramp ourselves. three.js handles the hard parts (projection, depth, lighting), and our own step keeps the exact fixed Screen grid, shares that grid with the Instrument panel, and can be unit-tested without a browser.

**Trade-offs:** a pure-ASCII game ships a full 3D library, and the 3D picture itself can only be checked in a real browser, not in unit tests.

## Considered Options

- **Our own small software renderer.** No dependency and fully testable, but several hundred lines of 3D maths to write and debug.
- **three.js `AsciiEffect` as shipped.** Least code, but its grid size follows the window's pixel size rather than a fixed column and row count, it samples only every second row, and its output is a separate HTML table that the Instrument panel cannot share.

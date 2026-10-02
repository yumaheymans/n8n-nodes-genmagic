# Changelog

## 0.1.2 (2026-10-02)

- The X-GenMagic-Client header carries the package's own version again (0.1.1 still sent 0.1.0); a test now fails if the two differ.

## 0.1.1 (2026-10-02)

- Node categories set to Marketing & Content and Productivity, from the categories n8n supports for community nodes.

## 0.1.0 (2026-10-02)

- First release of the GenMagic node for n8n.
- Image: Generate (prompt or reference image, size, up to 4 images, logo mode).
- Video: Generate (waits for the render, or returns the job ID) and Get.
- Audio: Generate Speech and Generate Music.
- Text: Generate (plain text, writing, code, SVG or a web page).
- Model: Get Many and Get. Account: Get Balance.
- Live model dropdowns listing GenMagic's catalog with each model's price.
- Generated files returned as binary data, with cost and remaining balance on every result.

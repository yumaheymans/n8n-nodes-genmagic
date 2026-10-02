# Changelog

## 0.1.3 (2026-10-02)

- Node version 2: each operation has its own model parameter (imageModel, videoModel, speechModel, musicModel, textModel). Version 1 shared one `model` parameter, and n8n keeps a parameter's value when only its display conditions change, so switching a node from Image to Audio sent the image model to the speech endpoint. Nodes saved as version 1 keep `model` and run unchanged.
- The model dropdowns read GenMagic's public model catalog when the node has no credential yet. n8n requests a newly added node's options before it attaches the saved credential, so the first list used to fail with "Error fetching options". With a credential the catalog is read with it, as before.

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

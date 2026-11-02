# Changelog

## 0.1.8 (2026-11-03)

- Search aliases for how people phrase what they want in the nodes panel (generate image, generate video, create image, create video, image generator, video generator, AI art, thumbnail, product photo) and for model generations by number (Veo 3, Kling 3, Seedance 2, FLUX 3), plus MiniMax (Hailuo's maker) and Krea.
- The credential, its help text, the wrong-key error and the README now send people to genmagic.co/get-api-key, which goes straight through sign-up and email verification to the key, instead of the API docs.

## 0.1.7 (2026-11-01)

- Search aliases for the model families GenMagic's catalog runs today and did not name yet (HeyGen, Wan, Grok Imagine, Gemini Image, Qwen Image), and for what n8n users make with the node (image to video, avatar, talking head, voiceover, YouTube Shorts, faceless video, UGC). n8n's nodes panel matches a community node on its display name and aliases only.
- README: links the ready-made, tested workflows at genmagic.co/n8n.

## 0.1.6 (2026-10-28)

- Video: Opening Image (a binary field or a URL) makes the clip open on that image, the image-to-video GenMagic's API takes since October 12.
- Video: Reference Images (binary fields and URLs, up to 9) keep characters, products and props consistent through the clip, on the video models made for it (Model > Get shows `references`). A clip follows references or opens on an image, not both.

## 0.1.5 (2026-10-08)

- Categories back to Marketing & Content and Productivity, with no subcategories. n8n's community package scan accepts only its community node categories, and AI is not one of them, so 0.1.4 failed the scan that n8n runs before it ships a version. The search aliases from 0.1.4 stay, and the codex test now checks the categories against n8n's list.

## 0.1.4 (2026-10-08)

- The codex (categories, docs links and search aliases) is now declared in the node's description. n8n builds the verified-node listing that its nodes panel searches from the description alone, so the aliases kept only in GenMagic.node.json never reached it, and a search for "video" or "text to speech" did not show GenMagic under More from the community. GenMagic.node.json repeats the same values, and a test keeps the two equal.
- Categories: AI (with the subcategories n8n's own multimodal vendor nodes use) and Marketing & Content (replaced in 0.1.5). Aliases name the media the node makes and the model families GenMagic runs today (Veo, Kling, Seedance, Hailuo, Runway, Nano Banana, GPT Image, FLUX, Seedream, Recraft, Lyria); Sora is gone, since GenMagic no longer offers it.
- The node's docs links point to GenMagic's n8n and authentication docs.
- README: installing from the nodes panel as a verified community node.

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

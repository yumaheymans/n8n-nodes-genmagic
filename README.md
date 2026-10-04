# n8n-nodes-genmagic

This is an n8n community node. It lets you use [GenMagic](https://genmagic.co/?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms) in your n8n workflows.

GenMagic gives you one API key and one pay-as-you-go balance for 450+ AI models from every major lab: images (GPT Image, FLUX, Seedream, Recraft and more), video (Sora, Veo, Seedance, Hailuo and more), speech, music and text. Pick a model per step, or let GenMagic pick one for you, and get the generated file straight into your workflow.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/n8n-community-license/community-license/) workflow automation platform.

[Installation](#installation) ·
[Operations](#operations) ·
[Credentials](#credentials) ·
[Usage](#usage) ·
[Pricing](#pricing) ·
[Compatibility](#compatibility) ·
[Resources](#resources) ·
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/) in the n8n community nodes documentation and install the package `n8n-nodes-genmagic`.

## Operations

| Resource | Operation | What it does |
| --- | --- | --- |
| Image | Generate | Generate an image from a prompt, or edit a reference image (from a binary field or a URL). Choose the size, up to 4 images per run, or steer the model toward a logo. |
| Video | Generate | Generate a video clip from a prompt with any text-to-video model. Set the aspect ratio, length, resolution and sound. The node waits for the render (up to a limit you set) and returns the clip. |
| Video | Get | Get a video job by ID, with the clip once it is ready. Use it after Generate with Wait for Completion turned off, for example after a Wait node. |
| Audio | Generate Speech | Turn text into spoken audio, with a choice of voice on models that offer several. |
| Audio | Generate Music | Generate an original music track from a description of its genre, mood, instruments and tempo. |
| Text | Generate | Write text, code, an SVG or a complete web page with any text model, with optional extra instructions. |
| Model | Get Many | List the models GenMagic offers, with their capabilities and prices. Filter by category, capability or name. |
| Model | Get | Get one model's capabilities, prices, supported video lengths and resolutions, and voices. |
| Account | Get Balance | Get the credit balance and total spend of your API key. |

Every generation returns the file as binary data (ready for nodes that upload, post or email files), its hosted URL, the model used, what the generation cost (`cost_usd`) and your remaining balance (`balance_usd`). Files are downloaded only from GenMagic's own hosts.

The node can also be used as a tool by n8n's AI Agent, which then receives each result's URL and details.

## Credentials

1. Create a free GenMagic account at [genmagic.co](https://genmagic.co/?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms) and verify your email address. New accounts start with a small free credit.
2. Open [genmagic.co/developers](https://genmagic.co/developers?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms) and create an API key.
3. In n8n, create a **GenMagic API** credential and paste the key. n8n checks it by reading your balance, which costs nothing.

## Usage

- **Model**: each generating operation has a model dropdown that lists GenMagic's live catalog, newest first, with each model's price. New models appear on their own. Choose **Auto** to let GenMagic pick a well-priced default, or set a model ID with an expression (Model > Get Many lists every ID).
- **Video**: rendering takes from a few seconds to a few minutes. With **Wait for Completion** on (the default), the node waits up to **Max Wait Time** and returns the clip. If the clip is still rendering by then, or if you turn waiting off, the node returns the job ID, and **Video > Get** fetches the clip later. A video is billed once, when it completes, and a failed render is never billed.
- **Editing an image**: add the **Reference Image (Binary Field)** option and name the input field that holds the image, for example `data`, then describe the change in the prompt.
- **Output field**: generated files go into the binary field named in **Put Output File in Field** (`data` by default).

Example workflow ideas:

- Turn new rows in a spreadsheet into product images and upload them to cloud storage.
- Write a short script with Text > Generate, voice it with Audio > Generate Speech, and add a clip from Video > Generate.
- Give an AI Agent the GenMagic node as a tool so it can make images and videos on request.

## Pricing

The node is free. Generations are billed to your GenMagic balance. The model dropdowns show each model's listed price (per 1M tokens for text, per image, per minute of speech, and the lowest per-second rate for video); the exact amount a generation cost comes back with its result as `cost_usd`, together with your remaining balance as `balance_usd`. Add credits at [genmagic.co/pricing](https://genmagic.co/pricing?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms).

If a run fails with "Your GenMagic balance is too low for this generation", add credits and run it again. Nothing is billed for a request that is refused or fails.

## Compatibility

Tested with n8n 2.41.6. The package has no runtime dependencies.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [GenMagic API documentation](https://genmagic.co/developers?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms)
- [GenMagic OpenAPI specification](https://genmagic.co/openapi.json)
- [GenMagic model library](https://genmagic.co/models?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms)
- Support: hello@genmagic.co

## Version history

### 0.1.3

Each operation has its own model dropdown, so switching a node from one resource to another (Image to Audio, for example) no longer carries the previous resource's model along. Nodes saved with an earlier version keep their model and run unchanged. The model dropdowns also load before a credential is attached, from GenMagic's public model catalog.

### 0.1.2

The node identifies its own version to GenMagic correctly.

### 0.1.1

The node is listed under Marketing & Content and Productivity in the nodes panel.

### 0.1.0

First release: Image, Video, Audio, Text, Model and Account resources, live model dropdowns with prices, binary file output and AI Agent tool support.

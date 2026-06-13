"""
Modal app — Z-Image-Turbo portrait generator.

Deploy with `modal deploy modal/portrait_app.py`.  Exposes a web endpoint that
takes {prompt, seed, width, height, steps} and returns a PNG.

GPU: A10G (24GB) — fits Z-Image-Turbo (6B params) comfortably and is the
cheapest CUDA option Modal offers (~$1.10/hr, ~$0.001/portrait).

Container scales to zero after 2 minutes idle.  Cold start ~30s (the model
weights are baked into the image so there's no network download); warm gens
take ~3s.  One process per container can run multiple sequential gens with
the model kept resident in VRAM.
"""

import io
import modal

APP_NAME = "aliveville-portraits"
HF_REPO = "Tongyi-MAI/Z-Image-Turbo"
HF_CACHE = "/root/.cache/huggingface"


def _download_weights() -> None:
    """Bake the Z-Image-Turbo weights into the container image."""
    from huggingface_hub import snapshot_download

    snapshot_download(repo_id=HF_REPO, cache_dir=HF_CACHE)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.5.1",
        "diffusers==0.32.2",
        "transformers==4.46.3",
        "accelerate==1.2.1",
        "safetensors==0.4.5",
        "huggingface_hub==0.26.5",
        "Pillow==11.0.0",
        "sentencepiece==0.2.0",
        "protobuf==5.29.1",
        "fastapi[standard]==0.115.6",
    )
    .run_function(_download_weights, timeout=900)
    .env({"HF_HUB_CACHE": HF_CACHE})
)

app = modal.App(APP_NAME, image=image)


@app.cls(
    gpu="A10G",
    scaledown_window=120,
    max_containers=2,
    timeout=300,
)
@modal.concurrent(max_inputs=1)
class Portraits:
    """Holds the loaded diffusion pipeline across many generations."""

    @modal.enter()
    def load(self) -> None:
        import torch
        from diffusers import AutoPipelineForText2Image

        self.pipe = AutoPipelineForText2Image.from_pretrained(
            HF_REPO,
            torch_dtype=torch.bfloat16,
            cache_dir=HF_CACHE,
        ).to("cuda")
        # No safety checker — these are anime character portraits, the prompts
        # are constrained by our style lock, and the safety checker adds latency
        # plus false positives on stylized art.

    @modal.fastapi_endpoint(method="POST", docs=False)
    def generate(self, payload: dict):
        from fastapi import HTTPException
        from fastapi.responses import Response
        import torch

        prompt = str(payload.get("prompt") or "")
        seed = int(payload.get("seed") or 0)
        width = int(payload.get("width") or 512)
        height = int(payload.get("height") or 512)
        steps = int(payload.get("steps") or 9)
        guidance = float(payload.get("guidance") or 1.0)

        if not prompt:
            raise HTTPException(status_code=400, detail="prompt is required")

        generator = torch.Generator(device="cuda").manual_seed(seed)
        result = self.pipe(
            prompt=prompt,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=guidance,
            generator=generator,
        )
        image = result.images[0]

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

"""
Modal app — Z-Anime portrait generator.

Z-Anime is the anime fine-tune of Z-Image (SeeSee21/Z-Anime, 6B S3-DiT,
trained specifically for anime style with natural-language prompts).  We use
the 8-step distilled variant for speed.

Deploy with `modal deploy modal/portrait_app.py`.  Exposes a web endpoint
that takes {prompt, seed, width, height, steps} and returns a PNG.

GPU: A10G (24GB) — fits comfortably (6B params + bf16 ≈ 12GB), Modal's
cheapest CUDA option (~$1.10/hr, ~$0.001/portrait).

Model weights live on a persistent Modal Volume — downloaded once on the
first cold start, reused forever after.  This sidesteps the 15-min image
build timeout when baking the full 12GB into the image.

Container scales to zero after 2 minutes idle.  Warm gens take ~3s.
Multiple sequential gens per container reuse the resident model in VRAM.
"""

import io
import modal

APP_NAME = "aliveville-portraits"
HF_REPO = "Tongyi-MAI/Z-Image-Turbo"
HF_SUBFOLDER = None  # Z-Image-Turbo lives at the repo root, no subfolder
HF_CACHE = "/root/.cache/huggingface"

# Persistent volume — weights download once and persist across deploys.
models_volume = modal.Volume.from_name("aliveville-models", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.5.1",
        # diffusers 0.35+ ships ZImagePipeline (Z-Image-Turbo's declared
        # pipeline class).  Older versions error on AttributeError at load.
        "diffusers>=0.35.0",
        "transformers>=4.50.0",
        "accelerate>=1.4.0",
        "safetensors>=0.5.0",
        "huggingface_hub>=0.28.0",
        "Pillow==11.0.0",
        "sentencepiece==0.2.0",
        "protobuf==5.29.1",
        "fastapi[standard]==0.115.6",
    )
    .env({"HF_HUB_CACHE": HF_CACHE})
)

app = modal.App(APP_NAME, image=image)


@app.cls(
    gpu="A10G",
    scaledown_window=120,
    max_containers=2,
    timeout=1800,  # first cold start downloads ~12GB; subsequent ones hit the cache
    volumes={HF_CACHE: models_volume},
)
@modal.concurrent(max_inputs=1)
class Portraits:
    """Holds the loaded diffusion pipeline across many generations."""

    @modal.enter()
    def load(self) -> None:
        import os
        import torch
        from diffusers import DiffusionPipeline
        from huggingface_hub import snapshot_download

        # Ensure the model is fully resident on the volume.  No-op once cached.
        snapshot_download(repo_id=HF_REPO, cache_dir=HF_CACHE)

        kwargs = {"torch_dtype": torch.bfloat16, "cache_dir": HF_CACHE}
        if HF_SUBFOLDER:
            kwargs["subfolder"] = HF_SUBFOLDER
        self.pipe = DiffusionPipeline.from_pretrained(HF_REPO, **kwargs).to("cuda")

    @modal.fastapi_endpoint(method="POST", docs=False)
    def generate(self, payload: dict):
        from fastapi import HTTPException
        from fastapi.responses import Response
        import torch

        prompt = str(payload.get("prompt") or "")
        seed = int(payload.get("seed") or 0)
        width = int(payload.get("width") or 512)
        height = int(payload.get("height") or 512)
        # Z-Image-Turbo: 9 steps at CFG 1.0 produced great village portraits
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

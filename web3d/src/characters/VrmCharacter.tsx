/**
 * VRM-based anime character (drop-in sibling of `ArchetypeCharacter.tsx`).
 *
 * VRMs are the de-facto standard for anime-style 3D avatars (VRoid Studio
 * exports this format) and ship with:
 *   - HUMANOID bone standard (`hips`, `leftUpperArm`, ...) so the same
 *     procedural locomotion drives every model regardless of skeleton names.
 *   - MToon materials — already the toon look we want. We do NOT swap to
 *     MeshToonMaterial here (unlike Kenney/Quaternius GLBs); MToon's outline
 *     + shading ramp is the correct visual.
 *   - Spring-bone physics for hair/skirt (kicks in when we call
 *     `vrm.update(delta)` every frame — this is what makes them "feel alive").
 *   - Blendshape expressions including `aa`/`ih`/`ou`/`ee`/`oh` for lipsync.
 *
 * Animation strategy: rather than ship .vrma animation files (extra bytes
 * + extra loader complexity), we drive the humanoid bones procedurally —
 * hip bob, arm + leg swing keyed off `setSpeed`. Combat triggers tween a
 * short pose. This is intentionally simple; it's still leagues ahead of a
 * T-pose because the bone retarget gives you proper anime body language.
 *
 * Exposes the same `CharacterAnimationHandle` interface as the rig and
 * archetype paths so `Npc.tsx` can swap implementations without changes.
 */
// `VRMHumanBoneName` and `VRMUtils` are re-exported by `@pixiv/three-vrm` but
// the package's shipped `.d.ts` files have broken re-export chains under
// NodeNext (VRMUtils has no `.d.ts`; VRMHumanBoneName lives in a nested
// @pixiv/three-vrm-core package that NodeNext can't traverse). They DO
// exist at runtime — grab them via a namespace import + cast.
import * as threeVrm from "@pixiv/three-vrm";
import {
  MToonMaterial,
  type VRM,
  VRMLoaderPlugin,
} from "@pixiv/three-vrm";
import {
  createVRMAnimationClip,
  type VRMAnimation,
  VRMAnimationLoaderPlugin,
} from "@pixiv/three-vrm-animation";
import { Outlines, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { scaledDelta } from "../controls/runtime.ts";
import type {
  CharacterAnimationHandle,
  CombatAnimKind,
  ReactionKind,
} from "./CharacterModel.tsx";
import { type VrmKey,VRMS } from "./vrm.ts";

interface VRMUtilsLike {
  removeUnnecessaryJoints: (scene: THREE.Object3D) => void;
}
const VRMUtils: VRMUtilsLike = (threeVrm as unknown as { VRMUtils: VRMUtilsLike })
  .VRMUtils;
const VRMHumanBoneName: Record<string, string> = (
  threeVrm as unknown as { VRMHumanBoneName: Record<string, string> }
).VRMHumanBoneName;

const TARGET_HEIGHT = 1.7;

/**
 * Baked one-shot reaction clips authored as `.vrma` files (humanoid + expression
 * tracks targeting the VRM standard skeleton). Played on social events
 * (dialogue open) via `AnimationMixer`. Procedural locomotion writes to the
 * same normalized humanoid bones are GATED while a reaction is active — see
 * `reactionUntilRef` in `useFrame` — otherwise they overwrite the clip every
 * frame and you see nothing.
 *
 * License + source per file are tracked in `docs/third-party-assets.md`.
 * Visual content has NOT been verified frame-by-frame; mapping from semantic
 * name → file is best-guess based on filenames in the upstream repos.
 */
const REACTION_VRMA: Record<ReactionKind, string> = {
  greet: "/assets/vrma/greet.vrma",
  surprised: "/assets/vrma/surprised.vrma",
  angry: "/assets/vrma/angry.vrma",
  nod: "/assets/vrma/nod.vrma",
  idle_variant: "/assets/vrma/idle_variant.vrma",
};

/** Ordered list used for blanket preload + per-instance mixer wiring. */
const REACTION_KINDS: ReactionKind[] = ["greet", "surprised", "angry", "nod", "idle_variant"];

const REACTION_FADE_IN_S = 0.18;
const REACTION_FADE_OUT_S = 0.22;

interface VrmCharacterProps {
  vrmKey: VrmKey;
  protagonist?: boolean;
}

/**
 * `gltf.userData.vrm` is populated by `VRMLoaderPlugin` after parse. Drei's
 * `useGLTF` caches the *parsed gltf* by url and accepts an `extendLoader`
 * callback (4th arg) where we register the plugin against the underlying
 * GLTFLoader.
 *
 * We register BOTH the VRM and VRM-Animation plugins on the same loader so
 * `useGLTF` can resolve `.vrm` and `.vrma` URLs through one cache key. The
 * plugins discriminate by file content — registering both is safe.
 */
function extendWithVrm(loader: GLTFLoader): void {
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
}

interface CombatPose {
  // duration ms
  duration: number;
  // (t in 0..1) → bone rotation overrides keyed by bone name. Apply on top of
  // the locomotion idle pose. Return null entries skip that bone.
  apply: (t: number, bones: BoneMap) => void;
}

type BoneMap = {
  hips: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  chest: THREE.Object3D | null;
  head: THREE.Object3D | null;
  leftUpperArm: THREE.Object3D | null;
  rightUpperArm: THREE.Object3D | null;
  leftLowerArm: THREE.Object3D | null;
  rightLowerArm: THREE.Object3D | null;
  leftUpperLeg: THREE.Object3D | null;
  rightUpperLeg: THREE.Object3D | null;
  leftLowerLeg: THREE.Object3D | null;
  rightLowerLeg: THREE.Object3D | null;
};

const COMBAT_POSES: Record<CombatAnimKind, CombatPose> = {
  attack1: {
    duration: 320,
    apply: (t, b) => {
      const punch = Math.sin(Math.min(1, t * 1.6) * Math.PI);
      if (b.rightUpperArm) b.rightUpperArm.rotation.x = -punch * 1.6;
      if (b.rightLowerArm) b.rightLowerArm.rotation.x = -punch * 0.6;
      if (b.spine) b.spine.rotation.y = -punch * 0.25;
    },
  },
  attack2: {
    duration: 320,
    apply: (t, b) => {
      const punch = Math.sin(Math.min(1, t * 1.6) * Math.PI);
      if (b.leftUpperArm) b.leftUpperArm.rotation.x = -punch * 1.6;
      if (b.leftLowerArm) b.leftLowerArm.rotation.x = -punch * 0.6;
      if (b.spine) b.spine.rotation.y = punch * 0.25;
    },
  },
  attack3: {
    duration: 460,
    apply: (t, b) => {
      // overhead two-handed slam
      const swing = Math.sin(Math.min(1, t * 1.4) * Math.PI);
      const lift = Math.min(1, t * 2.5);
      const drop = Math.max(0, t * 2 - 1); // back down after t=0.5
      const rot = -lift * 2.4 + drop * 3.0;
      if (b.rightUpperArm) b.rightUpperArm.rotation.x = rot;
      if (b.leftUpperArm) b.leftUpperArm.rotation.x = rot;
      if (b.spine) b.spine.rotation.x = swing * 0.2;
    },
  },
  dodge: {
    duration: 450,
    apply: (t, b) => {
      const roll = Math.sin(t * Math.PI);
      if (b.spine) b.spine.rotation.x = roll * 0.9;
      if (b.hips) b.hips.position.y = -roll * 0.15;
    },
  },
  hit: {
    duration: 280,
    apply: (t, b) => {
      const flinch = Math.sin(t * Math.PI);
      if (b.spine) b.spine.rotation.x = -flinch * 0.35;
      if (b.head) b.head.rotation.x = -flinch * 0.2;
    },
  },
  telegraph: {
    duration: 600,
    apply: (t, b) => {
      // ramp wind-up — right arm pulls back, never releases (release is on
      // the attack1 trigger that follows).
      const wind = Math.min(1, t * 2);
      if (b.rightUpperArm) b.rightUpperArm.rotation.x = wind * 1.2;
      if (b.spine) b.spine.rotation.y = wind * 0.18;
    },
  },
};

export const VrmCharacter = forwardRef<CharacterAnimationHandle, VrmCharacterProps>(
  function VrmCharacter({ vrmKey, protagonist = false }, ref) {
    const url = VRMS[vrmKey];
    const gltf = useGLTF(url, true, true, extendWithVrm) as unknown as {
      scene: THREE.Group;
      userData?: { vrm?: VRM };
    };
    const speedRef = useRef(0);
    const defeatedRef = useRef(false);
    const flashUntil = useRef(0);
    const telegraphUntil = useRef(0);
    const talkingRef = useRef(false);
    const phaseRef = useRef(Math.random() * Math.PI * 2);
    const combatAnim = useRef<{ kind: CombatAnimKind; startedAt: number } | null>(null);
    // Active VRMA reaction: gate procedural bone writes until this elapses so
    // the AnimationMixer can actually drive the humanoid joints.
    const reactionUntilRef = useRef(0);
    const activeReactionRef = useRef<THREE.AnimationAction | null>(null);

    // Load each reaction .vrma. `VRMAnimationLoaderPlugin` (registered above)
    // attaches the parsed `VRMAnimation[]` to `gltf.userData.vrmAnimations`.
    // Calling useGLTF unconditionally per kind keeps the hook order stable
    // across re-renders; drei caches the parsed result by URL.
    const greetGltf = useGLTF(REACTION_VRMA.greet, true, true, extendWithVrm) as unknown as {
      userData?: { vrmAnimations?: VRMAnimation[] };
    };
    const surprisedGltf = useGLTF(REACTION_VRMA.surprised, true, true, extendWithVrm) as unknown as {
      userData?: { vrmAnimations?: VRMAnimation[] };
    };
    const angryGltf = useGLTF(REACTION_VRMA.angry, true, true, extendWithVrm) as unknown as {
      userData?: { vrmAnimations?: VRMAnimation[] };
    };
    const nodGltf = useGLTF(REACTION_VRMA.nod, true, true, extendWithVrm) as unknown as {
      userData?: { vrmAnimations?: VRMAnimation[] };
    };
    const idleVariantGltf = useGLTF(REACTION_VRMA.idle_variant, true, true, extendWithVrm) as unknown as {
      userData?: { vrmAnimations?: VRMAnimation[] };
    };
    const vrmAnimationsByKind = useMemo<Record<ReactionKind, VRMAnimation | null>>(() => ({
      greet: greetGltf.userData?.vrmAnimations?.[0] ?? null,
      surprised: surprisedGltf.userData?.vrmAnimations?.[0] ?? null,
      angry: angryGltf.userData?.vrmAnimations?.[0] ?? null,
      nod: nodGltf.userData?.vrmAnimations?.[0] ?? null,
      idle_variant: idleVariantGltf.userData?.vrmAnimations?.[0] ?? null,
    }), [greetGltf, surprisedGltf, angryGltf, nodGltf, idleVariantGltf]);

    const { vrm, root, bones, mtoonMaterials, normalizeScale, isVrm0 } = useMemo(() => {
      // `useGLTF` returns the parsed gltf object. With our extendLoader the
      // VRM plugin attaches `vrm` to userData. NOTE: we do NOT clone the VRM
      // here — VRMs include skeleton + spring-bone state per instance, and a
      // safe per-instance clone needs `VRMUtils.deepCloneVrm` style work that
      // is non-trivial to ship. For now each VRM key is a singleton instance
      // in the world (multiple NPCs that map to the same key will share the
      // same scene, which is acceptable for v1 — Npc.tsx only ever has one
      // active per persona in normal play).
      const vrmInstance: VRM | undefined =
        (gltf as { userData?: { vrm?: VRM } }).userData?.vrm ??
        ((gltf as unknown as { vrm?: VRM }).vrm as VRM | undefined);

      if (!vrmInstance) {
        // Loader didn't attach VRM (corrupt or non-VRM file). Return an
        // empty placeholder so Npc.tsx's try/catch upstream can fall back.
        throw new Error(`VRM not attached to gltf for ${url}`);
      }

      // Defensive: disable frustum culling on every skinned mesh — long
      // sessions sometimes drop a mesh whose root world matrix hasn't
      // updated yet, same as the archetype loader.
      vrmInstance.scene.traverse((object: THREE.Object3D) => {
        const m = object as THREE.Mesh & { isMesh?: boolean; isSkinnedMesh?: boolean };
        if (m.isMesh || m.isSkinnedMesh) {
          m.frustumCulled = false;
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });

      // Strip joints not referenced by any skinned mesh. Trims GPU bone
      // matrix uploads and CPU updates — pixiv recommends this.
      VRMUtils.removeUnnecessaryJoints(vrmInstance.scene);

      // VRM 0.x faces -Z by default. VRM 1.0 faces +Z. Without conditional
      // rotation half the models moonwalk. Detect via meta.metaVersion.
      const metaVersion = (vrmInstance.meta as { metaVersion?: string } | undefined)?.metaVersion;
      const vrm0 = !metaVersion || metaVersion.startsWith("0");

      // Normalize to ~1.7m height. VRMs ship in real units (meters), so the
      // scale is usually close to 1.0 already.
      vrmInstance.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(vrmInstance.scene);
      const rawHeight = box.max.y - box.min.y;
      const normalize =
        Number.isFinite(rawHeight) && rawHeight > 0.01 ? TARGET_HEIGHT / rawHeight : 1;

      // Bone refs for procedural locomotion + combat poses.
      const humanoid = vrmInstance.humanoid as unknown as {
        getNormalizedBoneNode: (name: string) => THREE.Object3D | null;
      } | undefined;
      const get = (name: string): THREE.Object3D | null =>
        humanoid?.getNormalizedBoneNode(name) ?? null;
      const bn = VRMHumanBoneName;
      const boneMap: BoneMap = {
        hips: get(bn["Hips"]!),
        spine: get(bn["Spine"]!),
        chest: get(bn["Chest"]!) ?? get(bn["UpperChest"]!),
        head: get(bn["Head"]!),
        leftUpperArm: get(bn["LeftUpperArm"]!),
        rightUpperArm: get(bn["RightUpperArm"]!),
        leftLowerArm: get(bn["LeftLowerArm"]!),
        rightLowerArm: get(bn["RightLowerArm"]!),
        leftUpperLeg: get(bn["LeftUpperLeg"]!),
        rightUpperLeg: get(bn["RightUpperLeg"]!),
        leftLowerLeg: get(bn["LeftLowerLeg"]!),
        rightLowerLeg: get(bn["RightLowerLeg"]!),
      };

      // Collect MToon materials for emissive flash / telegraph pulses.
      const mtoons: MToonMaterial[] = [];
      vrmInstance.scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;
        const isMesh = (mesh as { isMesh?: boolean }).isMesh;
        if (!isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (mat instanceof MToonMaterial) mtoons.push(mat);
        }
      });

      return {
        vrm: vrmInstance,
        root: vrmInstance.scene,
        bones: boneMap,
        mtoonMaterials: mtoons,
        normalizeScale: normalize,
        isVrm0: vrm0,
      };
    }, [gltf, url]);

    // Build the AnimationMixer + per-kind clip map. Clips are retargeted to
    // THIS vrm instance via `createVRMAnimationClip` — VRMA tracks reference
    // the standard humanoid bone names, the converter wires them to the
    // actual `Object3D` UUIDs on `vrm.scene`.
    const { mixer, actions } = useMemo(() => {
      const m = new THREE.AnimationMixer(vrm.scene);
      const a: Partial<Record<ReactionKind, THREE.AnimationAction>> = {};
      for (const kind of REACTION_KINDS) {
        const vrmAnim = vrmAnimationsByKind[kind];
        if (!vrmAnim) continue;
        try {
          const clip = createVRMAnimationClip(vrmAnim, vrm);
          const action = m.clipAction(clip);
          action.loop = THREE.LoopOnce;
          action.clampWhenFinished = true;
          a[kind] = action;
        } catch {
          // VRMA targets unknown bones for this VRM — skip silently.
        }
      }
      return { mixer: m, actions: a };
    }, [vrm, vrmAnimationsByKind]);

    // Cache original emissive values so we can restore between pulses.
    const originalEmissive = useMemo(() => {
      return mtoonMaterials.map((mat) => ({
        color: mat.emissive ? mat.emissive.clone() : new THREE.Color(0, 0, 0),
        intensity: mat.emissiveIntensity ?? 0,
      }));
    }, [mtoonMaterials]);

    useEffect(() => {
      // Dispose materials on unmount to prevent VRAM leaks across world swaps.
      return () => {
        root.traverse((object: THREE.Object3D) => {
          const mesh = object as THREE.Mesh;
          if (!(mesh as { isMesh?: boolean }).isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) (mat as THREE.Material | null)?.dispose?.();
        });
      };
    }, [root]);

    // Stop the mixer + clear cached actions when the mixer instance changes
    // (vrm swap). Prevents stale actions referencing a disposed scene.
    useEffect(() => {
      return () => {
        mixer.stopAllAction();
        activeReactionRef.current = null;
        reactionUntilRef.current = 0;
      };
    }, [mixer]);

    useImperativeHandle(ref, () => ({
      setSpeed: (speed: number) => {
        speedRef.current = speed;
      },
      flash: () => {
        flashUntil.current = performance.now() + 140;
      },
      setTelegraph: (active: boolean) => {
        telegraphUntil.current = active ? performance.now() + 600 : 0;
      },
      setTalking: (talking: boolean) => {
        talkingRef.current = talking;
      },
      gesture: () => {
        // VRMs have no canned interact gesture; ignore (the talking lipsync
        // and idle bob already animate the body during dialogue).
      },
      trigger: (kind: CombatAnimKind) => {
        combatAnim.current = { kind, startedAt: performance.now() };
      },
      setDefeated: (defeated: boolean) => {
        defeatedRef.current = defeated;
      },
      playReaction: (kind: ReactionKind) => {
        const action = actions[kind];
        if (!action) return; // VRMA missing for this kind — silently no-op
        const now = performance.now();
        // If another reaction is mid-fade-out, cut it cleanly.
        const previous = activeReactionRef.current;
        if (previous && previous !== action) {
          previous.fadeOut(REACTION_FADE_OUT_S);
        }
        // Each play restarts from time=0 with a fresh fade-in.
        action.reset();
        action.setEffectiveWeight(1);
        action.fadeIn(REACTION_FADE_IN_S);
        action.play();
        activeReactionRef.current = action;
        const durationMs = action.getClip().duration * 1000;
        // Hold the gate slightly past clip duration so the fade-out tail
        // doesn't get overwritten by procedural locomotion.
        reactionUntilRef.current = now + durationMs + REACTION_FADE_OUT_S * 1000;
      },
    }));

    useFrame((_, rawDelta) => {
      const delta = scaledDelta(rawDelta);

      // Advance the reaction mixer BEFORE vrm.update so the humanoid pose is
      // current when spring-bones and look-at consume it. Then vrm.update
      // does its own pass to drive secondary motion.
      mixer.update(delta);

      // CRITICAL: vrm.update is what drives spring-bone physics (hair, skirt,
      // accessories), look-at, and expression manager updates. Skipping this
      // leaves the model frozen and lifeless.
      try {
        vrm.update(delta);
      } catch {
        // swallow — some VRMs without springBoneManager throw on update if the
        // mesh is mid-disposal; we don't want a crash wall in console.
      }

      const now = performance.now();
      const speed = speedRef.current;
      const walking = speed > 0.05;
      const running = speed > 2.4;

      // Is a baked .vrma reaction currently driving the humanoid bones? If so,
      // skip procedural arm/spine/head writes — they would overwrite the clip
      // on the same frame and the reaction would be invisible. Locomotion legs
      // also pause; characters playing reactions usually stand still anyway.
      const reactionActive = now < reactionUntilRef.current;
      if (!reactionActive && activeReactionRef.current) {
        // Clip + fade-out window finished. Stop the action so it can be reset
        // cleanly on next playReaction call.
        activeReactionRef.current.stop();
        activeReactionRef.current = null;
      }

      // ── locomotion: procedural idle bob + walk swing ──────────────────────
      // Reaction overlay takes priority over locomotion (the AnimationMixer
      // owns the humanoid bones for the duration). Defeated still wins over
      // reaction so we don't keep someone "alive" mid-greet if they die.
      if (!defeatedRef.current && !reactionActive) {
        const cadence = walking ? Math.max(2.5, Math.min(6.5, 1.5 + speed * 1.1)) : 1.5;
        phaseRef.current += delta * cadence;
        const phase = phaseRef.current;
        const sinP = Math.sin(phase);

        // hip bob (Y oscillation). Idle = subtle 1.5cm, walk = 3cm, run = 5cm.
        if (bones.hips) {
          const bob = walking ? (running ? 0.05 : 0.03) : 0.015;
          bones.hips.position.y = Math.abs(sinP) * bob;
        }

        // arm swing. Idle = tiny breathing motion, walk = ±0.4 rad, run grows.
        const armSwing = walking ? (running ? 0.6 : 0.4) : 0.05;
        if (bones.leftUpperArm) bones.leftUpperArm.rotation.x = sinP * armSwing;
        if (bones.rightUpperArm) bones.rightUpperArm.rotation.x = -sinP * armSwing;

        // leg swing. Idle = 0 (just plant), walk = ±0.5 rad with knee bend.
        const legSwing = walking ? (running ? 0.7 : 0.5) : 0;
        if (bones.leftUpperLeg) bones.leftUpperLeg.rotation.x = -sinP * legSwing;
        if (bones.rightUpperLeg) bones.rightUpperLeg.rotation.x = sinP * legSwing;
        if (bones.leftLowerLeg) {
          bones.leftLowerLeg.rotation.x = walking ? Math.max(0, sinP) * legSwing * 0.8 : 0;
        }
        if (bones.rightLowerLeg) {
          bones.rightLowerLeg.rotation.x = walking ? Math.max(0, -sinP) * legSwing * 0.8 : 0;
        }

        if (bones.spine) {
          bones.spine.rotation.y = walking ? sinP * 0.05 : 0;
          bones.spine.rotation.x = 0;
        }
      } else if (defeatedRef.current) {
        // defeated: tween hips toward floor + forward rotation. Don't touch
        // limbs — the pose collapse from gravity is enough for v1.
        if (bones.hips) {
          bones.hips.position.y +=
            (-0.6 - bones.hips.position.y) * Math.min(1, delta * 4);
          bones.hips.rotation.x += (Math.PI * 0.45 - bones.hips.rotation.x) * Math.min(1, delta * 5);
        }
      }
      // else: reaction is active and we deliberately skip all bone overrides
      // so the AnimationMixer's humanoid track output reaches the renderer.

      // ── combat overlay pose ──────────────────────────────────────────────
      // Skip the combat overlay while a reaction is playing — combat hits
      // shouldn't visually overwrite a greet wave mid-clip.
      const anim = reactionActive ? null : combatAnim.current;
      if (anim) {
        const elapsed = now - anim.startedAt;
        const pose = COMBAT_POSES[anim.kind];
        if (elapsed >= pose.duration) {
          combatAnim.current = null;
        } else {
          pose.apply(elapsed / pose.duration, bones);
        }
      }

      // ── lipsync via 'aa' expression ──────────────────────────────────────
      const expressions = vrm.expressionManager;
      if (expressions) {
        const aaValue = talkingRef.current ? 0.4 + 0.4 * Math.sin(now * 0.018) : 0;
        try {
          expressions.setValue("aa", Math.max(0, aaValue));
        } catch {
          // expression not present on this VRM — skip cleanly.
        }
      }

      // ── flash / telegraph emissive on MToon ──────────────────────────────
      const flashing = now < flashUntil.current;
      const telegraphing = !flashing && now < telegraphUntil.current;
      for (let i = 0; i < mtoonMaterials.length; i += 1) {
        const mat = mtoonMaterials[i]!;
        const orig = originalEmissive[i]!;
        if (flashing) {
          mat.emissive.set("#ff4030");
          mat.emissiveIntensity = 0.85;
        } else if (telegraphing) {
          const pulse = 0.28 + Math.sin(now * 0.018) * 0.18;
          mat.emissive.set("#ff8830");
          mat.emissiveIntensity = pulse;
        } else if (
          mat.emissiveIntensity !== orig.intensity ||
          !mat.emissive.equals(orig.color)
        ) {
          mat.emissive.copy(orig.color);
          mat.emissiveIntensity = orig.intensity;
        }
      }
    });

    // VRM 0.x face -Z (need PI rotation to align with our +Z forward
    // convention). VRM 1.x already faces +Z.
    const rotateY = isVrm0 ? Math.PI : 0;

    return (
      <group>
        <group rotation={[0, rotateY, 0]}>
          <primitive object={root} scale={normalizeScale} />
        </group>
        {protagonist ? <Outlines thickness={0.055} color="#c8382a" screenspace={false} /> : null}
      </group>
    );
  }
);

// Drei `useGLTF.preload` accepts the same `extendLoader` signature, so VRM
// preload also needs the plugin registered or the cache miss recomputes.
// We intentionally do NOT preload every VRM at module load — each is ~10-15
// MB, totalling >60 MB. Suspense + on-demand loading is the right shape.

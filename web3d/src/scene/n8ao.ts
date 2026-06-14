/**
 * n8ao.ts — typed re-export of @react-three/postprocessing's N8AO.
 *
 * N8AO is a real runtime export, but its named type re-export isn't resolved
 * under nodenext moduleResolution. Isolate the cast here so GameWorld stays clean.
 */

import * as Postprocessing from "@react-three/postprocessing";
import type { ComponentType } from "react";

type N8AOProps = { aoRadius?: number; intensity?: number; distanceFalloff?: number; halfRes?: boolean };

export const N8AO = (Postprocessing as unknown as { N8AO: ComponentType<N8AOProps> }).N8AO;

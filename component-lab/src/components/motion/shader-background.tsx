"use client";
// beui.dev/components/motion/shader-background

import { MeshGradient, type MeshGradientProps } from "@paper-design/shaders-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// The real beui.dev component supports ~20 shader variants (grain-gradient, dot-grid, warp,
// voronoi, metaballs, ...), each imported unconditionally and referenced from a variant->
// component map so any of them could be selected at runtime. This codebase only ever uses
// "mesh-gradient" (Masthead's hero background, TriviaBoard's low-opacity card fill) — every
// other variant was dead weight bundled into the main chunk with zero call sites (confirmed via
// a repo-wide grep for `variant="` before removing this). Trimmed to just the one variant this
// site actually renders; if a future section wants a different shader, re-add its import here
// rather than paying for the whole catalog up front for one still-unused variant.
export type ShaderBackgroundVariant = "mesh-gradient";

export type ShaderBackgroundProps = { variant: "mesh-gradient" } & MeshGradientProps & {
    className?: string;
  };

export const SHADER_BACKGROUND_VARIANTS: ShaderBackgroundVariant[] = ["mesh-gradient"];

/**
 * `speed` is frozen to 0 for reduced motion — MeshGradient is animated, unlike some of the
 * static-pattern variants the fuller beui.dev component also supports.
 */
export function ShaderBackground({ variant: _variant, className, ...rest }: ShaderBackgroundProps) {
  const reducedMotion = useReducedMotion();
  const speedProps = reducedMotion ? { speed: 0 } : {};

  return <MeshGradient {...rest} {...speedProps} className={cn("h-full w-full", className)} />;
}

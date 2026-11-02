import { cn } from "../utils/cn";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** Loading shimmer (components.md §8); mirrors target anatomy, no spinners. */
export function Skeleton({ width = "100%", height = 16, className }: SkeletonProps) {
  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };
  return <div className={cn("cp-skeleton", className)} style={style} aria-hidden="true" />;
}

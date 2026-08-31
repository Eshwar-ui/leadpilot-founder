import Image from "next/image";
import { cn } from "@/lib/utils";

export function AsanLogo({
  onLight = false,
  className,
}: {
  /** True on a light/white background: uses the navy-wordmark variant
   * directly, no dark chip needed. False (default) on a dark background,
   * where the wordmark is white. */
  onLight?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", className)}>
      <Image
        src={onLight ? "/asan-mark-light.png" : "/asan-mark-dark.png"}
        alt="Asan Innovators"
        width={1677}
        height={938}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

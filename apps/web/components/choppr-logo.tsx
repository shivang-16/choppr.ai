import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
}

export default function ChopprLogo({ size = 32, className }: Props) {
  return (
    <Image
      src="/choppr_logo.png"
      alt="Choppr"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}

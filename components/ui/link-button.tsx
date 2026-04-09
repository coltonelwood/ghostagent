import Link from "next/link";
import { buttonVariants } from "./button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}

export function LinkButton({ href, children, variant, size, className, external }: LinkButtonProps) {
  const cls = cn(buttonVariants({ variant, size }), className);
  if (external) {
    return <a href={href} className={cls} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

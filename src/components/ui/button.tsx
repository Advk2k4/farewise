import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { motion, type HTMLMotionProps } from "motion/react"
import { tap } from "@/lib/feedback"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-[15px] font-medium whitespace-nowrap transition-[background-color,box-shadow,transform,color] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:bg-primary/88 hover:shadow-float",
        outline:
          "border-border bg-background hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-pressed aria-expanded:bg-pressed",
        ghost:
          "hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-5",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-6 text-base",
        icon: "size-11",
        "icon-xs":
          "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const cls = cn(buttonVariants({ variant, size, className }))
  if (asChild) return <Slot.Root data-slot="button" data-variant={variant} data-size={size} className={cls} {...props} />
  // A springy press so every tap visibly registers (Motion respects reduced motion via MotionConfig)
  return (
    <motion.button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cls}
      whileTap={props.disabled ? undefined : { scale: 0.95 }}
      whileHover={props.disabled ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      {...(props as HTMLMotionProps<"button">)}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => { if (variant === "default") tap(); props.onClick?.(e) }}
    />
  )
}

export { Button, buttonVariants }

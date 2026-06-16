import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner config:
 * - bottom-right on desktop, bottom-center on mobile
 * - 3 second auto-dismiss
 * - max 3 visible toasts (older ones collapse)
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const [position, setPosition] = useState<ToasterProps["position"]>(
    typeof window !== "undefined" && window.innerWidth < 640
      ? "bottom-center"
      : "bottom-right",
  );

  useEffect(() => {
    const onResize = () => {
      setPosition(window.innerWidth < 640 ? "bottom-center" : "bottom-right");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <Sonner
      className="toaster group"
      position={position}
      duration={3000}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

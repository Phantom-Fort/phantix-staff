// Prompt Kit "Steps" — vendored for the staff portal, adapted to app-local
// primitives (context-based open state instead of radix Collapsible). Same
// component API as the command centre version: Steps > StepsItem >
// StepsTrigger / StepsContent.
import { ChevronDown } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { cx } from "@/lib/utils";

type StepsContextValue = { open: boolean; toggle: () => void };

const StepsContext = createContext<StepsContextValue>({ open: true, toggle: () => {} });

export type StepsProps = React.ComponentProps<"div"> & { defaultOpen?: boolean };

export function Steps({ defaultOpen = true, className, children, ...props }: StepsProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <StepsContext.Provider value={{ open, toggle: () => setOpen((v) => !v) }}>
      <div className={cx(className)} {...props}>
        {children}
      </div>
    </StepsContext.Provider>
  );
}

export type StepsItemProps = React.ComponentProps<"div">;

export const StepsItem = ({ children, className, ...props }: StepsItemProps) => (
  <div className={cx("text-sm text-slate-400", className)} {...props}>
    {children}
  </div>
);

export type StepsTriggerProps = React.ComponentProps<"button"> & {
  leftIcon?: React.ReactNode;
  swapIconOnHover?: boolean;
};

export const StepsTrigger = ({
  children,
  className,
  leftIcon,
  swapIconOnHover = true,
  ...props
}: StepsTriggerProps) => {
  const { open, toggle } = useContext(StepsContext);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={cx(
        "group flex w-full cursor-pointer items-center justify-start gap-1 text-left text-sm text-slate-400 transition-colors hover:text-slate-200",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2">
        {leftIcon ? (
          <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
            <span
              className={cx(
                "inline-flex transition-opacity",
                swapIconOnHover && "group-hover:opacity-0",
                swapIconOnHover && open && "opacity-0",
              )}
            >
              {leftIcon}
            </span>
            {swapIconOnHover && (
              <ChevronDown
                className={cx(
                  "absolute size-4 transition-all duration-150 group-hover:opacity-100",
                  open ? "rotate-180 opacity-100" : "opacity-0",
                )}
              />
            )}
          </span>
        ) : null}
        <span>{children}</span>
      </span>
      {!leftIcon && (
        <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} />
      )}
    </button>
  );
};

export type StepsContentProps = React.ComponentProps<"div"> & {
  bar?: React.ReactNode;
};

export const StepsContent = ({ children, className, bar, ...props }: StepsContentProps) => {
  const { open } = useContext(StepsContext);
  if (!open) return null;
  return (
    <div className={cx("overflow-hidden", className)} {...props}>
      <div className="mt-3 grid max-w-full min-w-0 grid-cols-[min-content_minmax(0,1fr)] items-start gap-x-3">
        <div className="min-w-0 self-stretch">{bar ?? <span className="block h-full w-[2px] bg-phantix-700/60" />}</div>
        <div className="min-w-0 space-y-2">{children}</div>
      </div>
    </div>
  );
};

// Prompt Kit "Tool" — vendored for the staff portal, adapted to app-local
// primitives (cx util, no radix). Same ToolPart/props API as the command
// centre version so stream renderers stay portable between apps.
import { CheckCircle, ChevronDown, Loader2, Settings, XCircle } from "lucide-react";
import { useState } from "react";
import { cx } from "@/lib/utils";

export type ToolPart = {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolCallId?: string;
  errorText?: string;
};

export type ToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
};

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { state, input, output, toolCallId } = toolPart;

  const getStateIcon = () => {
    switch (state) {
      case "input-streaming":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "input-available":
        return <Settings className="h-4 w-4 text-orange-500" />;
      case "output-available":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "output-error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Settings className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStateBadge = () => {
    const baseClasses = "px-2 py-0.5 rounded-full text-xs font-medium";
    switch (state) {
      case "input-streaming":
        return <span className={cx(baseClasses, "bg-blue-900/30 text-blue-400")}>Processing</span>;
      case "input-available":
        return <span className={cx(baseClasses, "bg-orange-900/30 text-orange-400")}>Ready</span>;
      case "output-available":
        return <span className={cx(baseClasses, "bg-green-900/30 text-green-400")}>Completed</span>;
      case "output-error":
        return <span className={cx(baseClasses, "bg-red-900/30 text-red-400")}>Error</span>;
      default:
        return <span className={cx(baseClasses, "bg-slate-800 text-slate-400")}>Pending</span>;
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  return (
    <div className={cx("mt-3 overflow-hidden rounded-lg border border-phantix-700/40", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex h-auto w-full items-center justify-between gap-2 bg-phantix-900/60 px-3 py-2 text-left font-normal transition-colors hover:bg-phantix-800/60"
      >
        <div className="flex min-w-0 items-center gap-2">
          {getStateIcon()}
          <span className="truncate font-mono text-sm font-medium">{toolPart.type}</span>
          {getStateBadge()}
        </div>
        <ChevronDown className={cx("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="space-y-3 border-t border-phantix-700/40 p-3">
          {input && Object.keys(input).length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-400">Input</h4>
              <div className="rounded border border-phantix-700/40 p-2 font-mono text-sm">
                {Object.entries(input).map(([key, value]) => (
                  <div key={key} className="mb-1 break-all">
                    <span className="text-slate-500">{key}:</span>{" "}
                    <span className="text-emerald-300">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {output && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-400">Output</h4>
              <div className="max-h-60 overflow-auto rounded border border-phantix-700/40 p-2 font-mono text-sm">
                <pre className="whitespace-pre-wrap break-words text-slate-300">{formatValue(output)}</pre>
              </div>
            </div>
          )}

          {state === "output-error" && toolPart.errorText && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-red-500">Error</h4>
              <div className="rounded border border-red-900/50 bg-red-900/20 p-2 text-sm">{toolPart.errorText}</div>
            </div>
          )}

          {state === "input-streaming" && (
            <div className="text-sm text-slate-400">Processing tool call...</div>
          )}

          {toolCallId && (
            <div className="border-t border-phantix-700/40 pt-2 text-xs text-slate-500">
              <span className="font-mono">Call ID: {toolCallId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { Tool };

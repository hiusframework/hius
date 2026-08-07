import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  type RenderContext,
  ScrollBoxRenderable,
  TextRenderable,
} from "@opentui/core";

export type EvalPaneOptions = {
  id: string;
  title: string;
  promptColor?: string;
  errorColor?: string;
  /** Runs on Enter — returns the text to append as the result line. */
  onSubmit: (input: string) => Promise<{ output: string; isError: boolean }>;
};

export type EvalPane = {
  box: BoxRenderable;
  input: InputRenderable;
  /** Appends a line to the pane's history without going through onSubmit — used by the caller for status/info lines (e.g. "target switched to test"). */
  appendLine: (text: string, color?: string) => void;
};

/**
 * One eval REPL pane: a scrolling history above a single-line input.
 * Generic over the eval function so the same shape backs both the
 * console pane (evalJs) and the db pane (evalSql) — the pane itself
 * knows nothing about JS or SQL, only "submit a line, get a result".
 */
export function createEvalPane(ctx: RenderContext, options: EvalPaneOptions): EvalPane {
  const box = new BoxRenderable(ctx, {
    id: options.id,
    flexGrow: 1,
    flexDirection: "column",
    border: true,
    title: options.title,
    focusedBorderColor: "#5fafff",
  });

  const history = new ScrollBoxRenderable(ctx, {
    id: `${options.id}:history`,
    flexGrow: 1,
    stickyScroll: true,
    stickyStart: "bottom",
  });
  box.add(history);

  const input = new InputRenderable(ctx, {
    id: `${options.id}:input`,
    placeholder: "…",
  });
  box.add(input);

  const promptColor = options.promptColor ?? "#5fafff";
  const errorColor = options.errorColor ?? "#ff5f5f";

  function appendLine(text: string, color?: string): void {
    for (const line of text.split("\n")) {
      history.add(new TextRenderable(ctx, { content: line, fg: color }));
    }
  }

  input.on(InputRenderableEvents.ENTER, async (value: string) => {
    if (value.trim().length === 0) return;
    input.value = "";
    appendLine(`> ${value}`, promptColor);
    const result = await options.onSubmit(value);
    if (result.output.length > 0) {
      appendLine(result.output, result.isError ? errorColor : undefined);
    }
  });

  return { box, input, appendLine };
}

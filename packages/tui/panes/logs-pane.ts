import {
  BoxRenderable,
  type RenderContext,
  ScrollBoxRenderable,
  TextRenderable,
} from "@opentui/core";
import type { LogLine } from "../target";

export type LogsPane = {
  box: BoxRenderable;
  appendLine: (line: LogLine) => void;
  clear: () => void;
};

const STREAM_COLOR: Record<LogLine["stream"], string | undefined> = {
  stdout: undefined,
  stderr: "#ff5f5f",
  info: "#5fafff",
};

/** A read-only, auto-scrolling pane — no input, just tails whatever the current target's onLog emits. */
export function createLogsPane(ctx: RenderContext, id: string, title: string): LogsPane {
  const box = new BoxRenderable(ctx, {
    id,
    flexGrow: 1,
    flexDirection: "column",
    border: true,
    title,
    focusedBorderColor: "#5fafff",
  });

  const history = new ScrollBoxRenderable(ctx, {
    id: `${id}:history`,
    flexGrow: 1,
    stickyScroll: true,
    stickyStart: "bottom",
  });
  box.add(history);

  return {
    box,
    appendLine: (line) => {
      const time = line.at.toTimeString().slice(0, 8);
      history.add(
        new TextRenderable(ctx, { content: `${time} ${line.text}`, fg: STREAM_COLOR[line.stream] }),
      );
    },
    clear: () => {
      for (const child of [...history.getChildren()]) history.remove(child);
    },
  };
}

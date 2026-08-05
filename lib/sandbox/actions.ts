/**
 * File: lib/sandbox/actions.ts
 * Purpose: Validate and execute shared computer and shell actions inside a desktop sandbox.
 * Problem solved: Prevents provider-specific tools from duplicating low-level xdotool, screenshot, and Bash logic.
 */
import { z } from "zod";
import { resolution } from "./config";
import { getReadyDesktop } from "./utils";

const wait = async (seconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

const DISPLAY_ENV = { DISPLAY: ":99" };

const coordinateSchema = z
  .array(z.number())
  .length(2)
  .describe(
    `An [x, y] pixel coordinate on the ${resolution.x}x${resolution.y} desktop.`,
  );

export const computerInputSchema = z.object({
  action: z.enum([
    "screenshot",
    "wait",
    "left_click",
    "double_click",
    "right_click",
    "mouse_move",
    "navigate",
    "type",
    "key",
    "scroll",
    "left_click_drag",
    "hold_key",
    "cursor_position",
    "left_mouse_down",
    "left_mouse_up",
    "middle_click",
    "triple_click",
  ]),
  coordinate: coordinateSchema.optional(),
  start_coordinate: coordinateSchema.optional(),
  text: z.string().optional(),
  duration: z.number().positive().optional(),
  scroll_amount: z.number().int().positive().optional(),
  scroll_direction: z.enum(["up", "down", "left", "right"]).optional(),
});

export type ComputerActionInput = z.infer<typeof computerInputSchema>;

export type ComputerActionResult =
  | { type: "image"; data: string; text?: string }
  | { type: "text"; text: string };

interface ComputerActionOptions {
  includeScreenText?: boolean;
}

const READ_VISIBLE_CHROME_SCRIPT = String.raw`
const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const target = targets.find((candidate) => candidate.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("Visible Chrome page is unavailable");

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let requestId = 0;
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  const callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  if (message.error) callback.reject(new Error(message.error.message));
  else callback.resolve(message.result);
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Chrome connection timed out")), 3000);
  socket.addEventListener("open", () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
  socket.addEventListener("error", () => {
    clearTimeout(timer);
    reject(new Error("Chrome connection failed"));
  }, { once: true });
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const browserObservation = () => {
  const inViewport = (rect) => rect.width > 0 && rect.height > 0 &&
    rect.bottom > 0 && rect.right > 0 &&
    rect.top < window.innerHeight && rect.left < window.innerWidth;
  const isVisible = (element) => {
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" &&
      Number(style.opacity || "1") > 0 && inViewport(element.getBoundingClientRect());
  };
  const lines = [];
  const seen = new Set();
  const add = (value) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    lines.push(text);
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent || !isVisible(parent)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if ([...range.getClientRects()].some(inViewport)) add(node.textContent);
  }
  const controls = [];
  for (const element of document.querySelectorAll("a,button,input,textarea,select,[role=button],[role=link],[role=textbox]")) {
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    const label = element.getAttribute("aria-label") || element.getAttribute("placeholder") ||
      element.innerText || element.value || element.getAttribute("title") || element.tagName.toLowerCase();
    const text = String(label || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    controls.push("[" + (element.getAttribute("role") || element.tagName.toLowerCase()) + "] " + text + " @ (" + Math.round(rect.left + rect.width / 2) + ", " + Math.round(rect.top + rect.height / 2) + ")");
  }
  return {
    title: document.title,
    url: location.href,
    text: lines.slice(0, 240),
    controls: controls.slice(0, 120),
  };
};
const expression = "(" + browserObservation.toString() + ")()";
const result = await send("Runtime.evaluate", {
  expression,
  returnByValue: true,
  awaitPromise: true,
});
socket.close();
const observation = result?.result?.value;
if (!observation) throw new Error("Chrome returned no visible-page observation");
const output = [
  "Visible Chrome page: " + (observation.title || "Untitled"),
  "URL: " + (observation.url || "unknown"),
  "Visible text:",
  ...(observation.text?.length ? observation.text : ["(No readable page text)"]),
  "Visible controls:",
  ...(observation.controls?.length ? observation.controls : ["(No page controls detected)"]),
].join("\n");
console.log(output.slice(0, 16000));
`;

/** Reads text and actionable controls from the same visible Chrome page shown through noVNC. */
async function readVisibleChromePage(
  sandbox: Awaited<ReturnType<typeof getReadyDesktop>>,
) {
  const result = await sandbox.runCommand({
    cmd: "node",
    args: ["--input-type=module", "-e", READ_VISIBLE_CHROME_SCRIPT],
  });
  if (result.exitCode !== 0) {
    const detail = (await result.stderr()).trim();
    return `Visible Chrome page text is unavailable${detail ? `: ${detail}` : "."}`;
  }
  return (await result.stdout()).trim() || "Visible Chrome page has no readable text.";
}

const keyMap: Record<string, string> = {
  Return: "Return",
  enter: "Return",
  tab: "Tab",
  space: "space",
  backspace: "BackSpace",
  delete: "Delete",
  escape: "Escape",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  home: "Home",
  end: "End",
  pageup: "Prior",
  pagedown: "Next",
  f1: "F1",
  f2: "F2",
  f3: "F3",
  f4: "F4",
  f5: "F5",
  f6: "F6",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  f10: "F10",
  f11: "F11",
  f12: "F12",
  shift: "Shift_L",
  control: "Control_L",
  ctrl: "Control_L",
  alt: "Alt_L",
  super: "Super_L",
  meta: "Super_L",
};

function mapKey(key: string): string {
  if (key.includes("+")) {
    return key
      .split("+")
      .map((part) => keyMap[part.toLowerCase()] || part)
      .join("+");
  }
  return keyMap[key.toLowerCase()] || keyMap[key] || key;
}

/**
 * Validates and executes one provider-neutral computer action against display :99.
 * Every provider wrapper delegates here so pointer, keyboard, screenshot, and result behavior stay identical.
 */
export async function executeComputerAction(
  sandboxId: string,
  input: ComputerActionInput,
  options: ComputerActionOptions = {},
): Promise<ComputerActionResult> {
  const sandbox = await getReadyDesktop(sandboxId);
  const {
    action,
    coordinate,
    text,
    duration,
    scroll_amount,
    scroll_direction,
    start_coordinate,
  } = input;

  switch (action) {
    case "screenshot": {
      await sandbox.runCommand({
        cmd: "import",
        args: ["-window", "root", "/tmp/screenshot.png"],
        env: DISPLAY_ENV,
      });
      const buffer = await sandbox.readFileToBuffer({
        path: "/tmp/screenshot.png",
      });
      if (!buffer) throw new Error("Failed to read screenshot");
      return {
        type: "image",
        data: buffer.toString("base64"),
        text: options.includeScreenText
          ? await readVisibleChromePage(sandbox)
          : undefined,
      };
    }
    case "wait": {
      const actualDuration = Math.min(duration ?? 1, 2);
      await wait(actualDuration);
      return { type: "text", text: `Waited for ${actualDuration} seconds` };
    }
    case "left_click":
    case "double_click":
    case "right_click":
    case "middle_click":
    case "triple_click": {
      if (!coordinate) throw new Error(`Coordinate required for ${action}`);
      const [x, y] = coordinate;
      const button =
        action === "right_click" ? "3" : action === "middle_click" ? "2" : "1";
      const repeatArgs =
        action === "double_click"
          ? ["--repeat", "2"]
          : action === "triple_click"
            ? ["--repeat", "3"]
            : [];
      await sandbox.runCommand({
        cmd: "xdotool",
        args: [
          "mousemove",
          "--sync",
          String(x),
          String(y),
          "click",
          ...repeatArgs,
          button,
        ],
        env: DISPLAY_ENV,
      });
      const label = action.replace("_", " ");
      return { type: "text", text: `${label} at ${x}, ${y}` };
    }
    case "mouse_move": {
      if (!coordinate)
        throw new Error("Coordinate required for mouse move action");
      const [x, y] = coordinate;
      await sandbox.runCommand({
        cmd: "xdotool",
        args: ["mousemove", "--sync", String(x), String(y)],
        env: DISPLAY_ENV,
      });
      return { type: "text", text: `Moved mouse to ${x}, ${y}` };
    }
    case "navigate": {
      if (!text) throw new Error("URL or search text required for navigate action");
      // Keep the three xdotool operations separate: `type` accepts trailing
      // positional arguments, so one chained invocation can swallow `key Return`
      // as literal text instead of submitting the omnibox.
      await sandbox.runCommand({
        cmd: "xdotool",
        args: ["key", "ctrl+l"],
        env: DISPLAY_ENV,
      });
      await sandbox.runCommand({
        cmd: "xdotool",
        args: ["type", "--clearmodifiers", text],
        env: DISPLAY_ENV,
      });
      await sandbox.runCommand({
        cmd: "xdotool",
        args: ["key", "Return"],
        env: DISPLAY_ENV,
      });
      return { type: "text", text: `Navigated to: ${text}` };
    }
    case "type": {
      if (!text) throw new Error("Text required for type action");
      await sandbox.runCommand({
        cmd: "xdotool",
        args: ["type", "--clearmodifiers", text],
        env: DISPLAY_ENV,
      });
      return { type: "text", text: `Typed: ${text}` };
    }
    case "key": {
      if (!text) throw new Error("Key required for key action");
      await sandbox.runCommand({
        cmd: "xdotool",
        args: ["key", mapKey(text)],
        env: DISPLAY_ENV,
      });
      return { type: "text", text: `Pressed key: ${text}` };
    }
    case "hold_key": {
      if (!text) throw new Error("Key required for hold key action");
      if (!duration) throw new Error("Duration required for hold key action");
      const mappedKey = mapKey(text);
      const actualDuration = Math.min(duration, 2);
      await sandbox.runCommand({
        cmd: "xdotool",
        args: [
          "keydown",
          mappedKey,
          "sleep",
          String(actualDuration),
          "keyup",
          mappedKey,
        ],
        env: DISPLAY_ENV,
      });
      return {
        type: "text",
        text: `Held key ${text} for ${actualDuration} seconds`,
      };
    }
    case "cursor_position": {
      const result = await sandbox.runCommand({
        cmd: "xdotool",
        args: ["getmouselocation", "--shell"],
        env: DISPLAY_ENV,
      });
      return { type: "text", text: (await result.stdout()).trim() };
    }
    case "left_mouse_down":
    case "left_mouse_up": {
      const positionArgs = coordinate
        ? ["mousemove", "--sync", String(coordinate[0]), String(coordinate[1])]
        : [];
      const mouseAction = action === "left_mouse_down" ? "mousedown" : "mouseup";
      await sandbox.runCommand({
        cmd: "xdotool",
        args: [...positionArgs, mouseAction, "1"],
        env: DISPLAY_ENV,
      });
      return {
        type: "text",
        text: action === "left_mouse_down" ? "Left mouse down" : "Left mouse up",
      };
    }
    case "scroll": {
      if (!scroll_direction)
        throw new Error("Scroll direction required for scroll action");
      if (!scroll_amount)
        throw new Error("Scroll amount required for scroll action");
      const buttonByDirection = { up: "4", down: "5", left: "6", right: "7" };
      await sandbox.runCommand({
        cmd: "xdotool",
        args: [
          "click",
          "--repeat",
          String(scroll_amount),
          buttonByDirection[scroll_direction],
        ],
        env: DISPLAY_ENV,
      });
      return {
        type: "text",
        text: `Scrolled ${scroll_direction} by ${scroll_amount}`,
      };
    }
    case "left_click_drag": {
      if (!start_coordinate || !coordinate)
        throw new Error("Coordinates required for drag action");
      const [startX, startY] = start_coordinate;
      const [endX, endY] = coordinate;
      await sandbox.runCommand({
        cmd: "xdotool",
        args: [
          "mousemove",
          String(startX),
          String(startY),
          "mousedown",
          "1",
          "mousemove",
          "--sync",
          String(endX),
          String(endY),
          "mouseup",
          "1",
        ],
        env: DISPLAY_ENV,
      });
      return {
        type: "text",
        text: `Dragged mouse from ${startX}, ${startY} to ${endX}, ${endY}`,
      };
    }
  }
}

/** Executes a background command inside the same Sandbox while returning bounded text output. */
export async function executeBashCommand(
  sandboxId: string | undefined,
  command: string,
) {
  const sandbox = await getReadyDesktop(sandboxId);

  try {
    const result = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", command],
      env: DISPLAY_ENV,
    });
    return (
      (await result.stdout()) ||
      "(Command executed successfully with no output)"
    );
  } catch (error) {
    console.error("Bash command failed:", error);
    return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
  }
}

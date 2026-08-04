/**
 * File: lib/ai/browser-routing.ts
 * Purpose: Detect user requests that must begin on the visible remote desktop.
 * Problem solved: Prevents web and current-information tasks from being answered from model memory or hidden shell requests.
 */
import type { UIMessage } from "ai";

const visibleBrowserIntent = new RegExp(
  [
    "\\bweather\\b",
    "\\bforecast\\b",
    "\\bweb(?:site|page)?\\b",
    "\\bbrowser\\b",
    "\\bsearch(?: for)?\\b",
    "\\blook up\\b",
    "\\bfind (?:it |this |that )?online\\b",
    "\\bgoogle\\b",
    "\\bbing\\b",
    "\\blatest (?:news|post|tweet|price|result|information)\\b",
    "天气",
    "预报",
    "浏览器",
    "网页",
    "网站",
    "搜索",
    "查一下",
    "查询",
  ].join("|"),
  "i",
);

function currentUserText(messages: UIMessage[]) {
  const message = messages.at(-1);
  if (message?.role !== "user") return null;

  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> =>
      part.type === "text",
    )
    .map((part) => part.text)
    .join(" ");
}

/**
 * Returns true when the newest user turn requires observable browser work.
 * The API uses this decision only for the first step, then restores automatic tool selection.
 */
export function shouldStartWithVisibleComputer(messages: UIMessage[]) {
  const text = currentUserText(messages);
  return text ? visibleBrowserIntent.test(text) : false;
}

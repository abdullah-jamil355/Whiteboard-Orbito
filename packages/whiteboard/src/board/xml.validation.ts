import type { Board } from "./board";
import { parseErrorMessage } from "./xml.validation.helpers";
import { parseBoardDocument } from "./xml.document.validation";

export const MAX_WHITEBOARD_XML_BYTES = 5 * 1024 * 1024;

type BoardXmlParseResult = Readonly<
  | { ok: true; board: Board }
  | { ok: false; error: string }
>;

export const parseBoardXml = (source: string): BoardXmlParseResult => {
  if (source.length > MAX_WHITEBOARD_XML_BYTES) {
    return { ok: false, error: "This Whiteboard XML file is too large to open." };
  }
  if (new TextEncoder().encode(source).byteLength > MAX_WHITEBOARD_XML_BYTES) {
    return { ok: false, error: "This Whiteboard XML file is too large to open." };
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) {
    return { ok: false, error: "This file contains a forbidden XML declaration." };
  }
  if (/<\?(?!xml\s)/i.test(source.replace(/^\uFEFF?\s*<\?xml\s+[^?]*\?>/i, ""))) {
    return { ok: false, error: "This file contains an unsupported XML processing instruction." };
  }
  if (typeof DOMParser === "undefined") {
    return { ok: false, error: "XML projects can only be opened in the browser." };
  }

  try {
    const document = new DOMParser().parseFromString(source, "application/xml");
    if (document.getElementsByTagName("parsererror").length > 0) {
      return { ok: false, error: "This file is not well-formed Whiteboard XML." };
    }
    const board = parseBoardDocument(document);
    return { ok: true, board };
  } catch (error) {
    return { ok: false, error: parseErrorMessage(error) };
  }
};

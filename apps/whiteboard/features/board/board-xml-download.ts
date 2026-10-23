import { getBoardFilename, serializeBoardXml, type Board } from "@workspace/whiteboard";

export const downloadBoardXml = (board: Board): boolean => {
  let url: string | undefined;
  let link: HTMLAnchorElement | undefined;
  try {
    const xml = serializeBoardXml(board);
    url = URL.createObjectURL(new Blob([xml], { type: "application/xml;charset=utf-8" }));
    link = document.createElement("a");
    link.href = url;
    link.download = getBoardFilename(board.title);
    document.body.append(link);
    link.click();
    return true;
  } catch {
    return false;
  } finally {
    link?.remove();
    if (url !== undefined) {
      const objectUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  }
};

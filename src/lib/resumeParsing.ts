import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export async function parseResumeFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    // unpdf rejects Node's Buffer even though it's a Uint8Array subclass —
    // it wants a plain Uint8Array.
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim();
  }

  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  if (name.endsWith(".txt") || file.type === "text/plain") {
    return buffer.toString("utf-8").trim();
  }

  throw new Error(
    "Unsupported file type. Please upload a PDF, DOCX, or TXT resume.",
  );
}

import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import type { Material, Task } from "@/types/grading";
import { dataDir } from "./config";
import { HttpError } from "./auth";

export function filePath(taskId: string, fileId: string) {
  if (!/^[a-f0-9-]{36}$/.test(taskId) || !/^[a-f0-9-]{36}$/.test(fileId))
    throw new HttpError("文件不存在", 404);
  return path.join(dataDir(), "files", taskId, fileId);
}
export async function putFile(
  taskId: string,
  buffer: Buffer,
  name: string,
  role: Material["role"],
  studentId?: string,
): Promise<Material> {
  if (!buffer.length || buffer.length > 15 * 1024 * 1024)
    throw new HttpError("单个文件应大于 0 且不超过 15 MB");
  let mime: string,
    pages = 1;
  if (buffer.subarray(0, 5).toString() === "%PDF-") {
    mime = "application/pdf";
    try {
      pages = (await PDFDocument.load(buffer)).getPageCount();
    } catch {
      throw new HttpError("PDF 无法打开或已加密，请换一个文件");
    }
    if (pages < 1 || pages > 20)
      throw new HttpError("每个 PDF 请控制在 1～20 页");
  } else {
    try {
      const info = await sharp(buffer, {
        limitInputPixels: 40_000_000,
      }).metadata();
      if (
        !info.width ||
        !info.height ||
        !["png", "jpeg"].includes(info.format || "")
      )
        throw new Error();
      mime = info.format === "png" ? "image/png" : "image/jpeg";
      await sharp(buffer, { limitInputPixels: 40_000_000 }).stats();
    } catch {
      throw new HttpError("文件不是可读取的 JPG、PNG 或 PDF，请检查文件");
    }
  }
  const id = randomUUID();
  await mkdir(path.join(dataDir(), "files", taskId), { recursive: true });
  await writeFile(filePath(taskId, id), buffer, { flag: "wx" });
  return {
    id,
    name: name.slice(0, 180),
    mime,
    pages,
    size: buffer.length,
    role,
    studentId,
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}
export async function deleteTaskFiles(id: string) {
  filePath(id, randomUUID());
  await rm(path.join(dataDir(), "files", id), { recursive: true, force: true });
}
export async function materialBytes(task: Task, id: string) {
  if (!task.materials.some((m) => m.id === id))
    throw new HttpError("文件不存在", 404);
  return readFile(filePath(task.id, id));
}
export async function pageImages(
  task: Task,
  file: Material,
): Promise<Buffer[]> {
  const data = await materialBytes(task, file.id);
  if (file.mime !== "application/pdf")
    return [await sharp(data).rotate().png().toBuffer()];
  const canvas = await import("@napi-rs/canvas");
  Object.assign(globalThis, {
    DOMMatrix: canvas.DOMMatrix,
    ImageData: canvas.ImageData,
    Path2D: canvas.Path2D,
  });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });
  const pdf = await loading.promise;
  const images: Buffer[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2, 2200 / Math.max(original.width, original.height)),
      });
      const surface = canvas.createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = surface.getContext("2d");
      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        canvas: surface as unknown as HTMLCanvasElement,
        viewport,
      }).promise;
      images.push(surface.toBuffer("image/png"));
      page.cleanup();
    }
  } finally {
    await loading.destroy();
  }
  return images;
}
export async function cropRegion(
  task: Task,
  imageId: string,
  box: [number, number, number, number],
  name: string,
) {
  const data = await materialBytes(task, imageId);
  const meta = await sharp(data).metadata();
  const [x1, y1, x2, y2] = box.map(Math.round);
  if (
    x1 < 0 ||
    y1 < 0 ||
    x2 <= x1 ||
    y2 <= y1 ||
    x2 > (meta.width || 0) ||
    y2 > (meta.height || 0)
  )
    throw new Error("作答位置超出页面范围");
  const crop = await sharp(data)
    .extract({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 })
    .png()
    .toBuffer();
  const material = await putFile(task.id, crop, name, "crop");
  task.materials.push(material);
  return material.id;
}

import { describe, expect, it } from "vitest";
import { extensionFor, formatClipLength, mediaMime, storageHost, uploadMode } from "./kind";

describe("media helpers", () => {
  it("picks resumable uploads above 6 MB", () => {
    expect(uploadMode(6 * 1024 * 1024)).toBe("plain");
    expect(uploadMode(6 * 1024 * 1024 + 1)).toBe("resumable");
  });

  it("normalises what phones report", () => {
    expect(mediaMime("video/quicktime", "IMG_0001.MOV")).toBe("video/quicktime");
    expect(mediaMime("", "clip.mov")).toBe("video/quicktime");
    expect(mediaMime("video/mp4;codecs=avc1")).toBe("video/mp4");
    expect(mediaMime("image/jpeg")).toBe("image/jpeg");
    expect(mediaMime("application/pdf", "x.pdf")).toBeNull();
    expect(extensionFor("video/quicktime")).toBe("mov");
    expect(extensionFor("image/jpeg")).toBe("jpg");
  });

  it("uses the storage hostname for a hosted project only", () => {
    expect(storageHost("https://abcdefghij.supabase.co")).toBe("https://abcdefghij.storage.supabase.co");
    expect(storageHost("https://abcdefghij.supabase.co/")).toBe("https://abcdefghij.storage.supabase.co");
    expect(storageHost("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
  });

  it("formats a clip's length", () => {
    expect(formatClipLength(12.4)).toBe("0:12");
    expect(formatClipLength(61)).toBe("1:01");
    expect(formatClipLength(null)).toBe("");
  });
});

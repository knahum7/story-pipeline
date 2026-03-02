import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

const execAsync = promisify(execFile);

/**
 * Mux a video buffer and an audio buffer into a single MP4.
 * Uses ffmpeg-static so no system install is required.
 * The audio replaces any existing audio track; `-shortest` trims
 * to whichever stream ends first.
 */
export async function muxAudioVideo(
  videoBuffer: ArrayBuffer,
  audioBuffer: ArrayBuffer
): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not found");
  }

  const tmp = tmpdir();
  const ts = Date.now();
  const videoPth = join(tmp, `vid-${ts}.mp4`);
  const audioPth = join(tmp, `aud-${ts}.mp3`);
  const outPth = join(tmp, `mux-${ts}.mp4`);

  await writeFile(videoPth, Buffer.from(videoBuffer));
  await writeFile(audioPth, Buffer.from(audioBuffer));

  try {
    await execAsync(ffmpegPath, [
      "-y",
      "-i", videoPth,
      "-i", audioPth,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      "-movflags", "+faststart",
      outPth,
    ]);

    return await readFile(outPth);
  } finally {
    await Promise.all([
      unlink(videoPth),
      unlink(audioPth),
      unlink(outPth),
    ]).catch(() => {});
  }
}

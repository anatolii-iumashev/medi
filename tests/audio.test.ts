import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const audioPath = resolve('public/audio/breathing-triangle.mp3');

function decodePcm(): Float32Array {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    audioPath,
    '-f',
    'f32le',
    '-acodec',
    'pcm_f32le',
    '-ac',
    '1',
    '-ar',
    '48000',
    'pipe:1',
  ], { maxBuffer: 8 * 1024 * 1024 });
  expect(result.error?.message).toBeUndefined();
  expect(result.status, result.stderr?.toString()).toBe(0);
  return new Float32Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.byteLength / 4);
}

function rms(samples: Float32Array, start: number, end: number): number {
  let squares = 0;
  for (let index = start * 48_000; index < end * 48_000; index += 1) {
    squares += samples[index] ** 2;
  }
  return Math.sqrt(squares / ((end - start) * 48_000));
}

describe('breathing triangle audio', () => {
  it('is a 21-second mono MP3 at 48 kHz and 48 kbps', () => {
    const result = spawnSync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name,sample_rate,channels,bit_rate,duration',
      '-of',
      'json',
      audioPath,
    ], { encoding: 'utf8' });
    expect(result.error?.message).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const stream = JSON.parse(result.stdout).streams[0];
    expect(stream).toMatchObject({
      codec_name: 'mp3',
      sample_rate: '48000',
      channels: 1,
      bit_rate: '48000',
    });
    expect(Number(stream.duration)).toBeGreaterThanOrEqual(20.9);
    expect(Number(stream.duration)).toBeLessThanOrEqual(21.1);
  });

  it('has seven seconds of silence and a decaying human exhale', () => {
    const silence = spawnSync('ffmpeg', [
      '-hide_banner',
      '-i',
      audioPath,
      '-af',
      'silencedetect=noise=-50dB:d=0.15',
      '-f',
      'null',
      '-',
    ], { encoding: 'utf8' });
    expect(silence.error?.message).toBeUndefined();
    expect(silence.status, silence.stderr).toBe(0);
    const output = `${silence.stdout}${silence.stderr}`;
    const starts = [...output.matchAll(/silence_start: ([\d.]+)/g)];
    const ends = [...output.matchAll(/silence_end: ([\d.]+)/g)];
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect(Number(starts[0][1])).toBeGreaterThanOrEqual(6.8);
    expect(Number(starts[0][1])).toBeLessThanOrEqual(7.05);
    expect(Number(ends[0][1])).toBeGreaterThanOrEqual(13.95);
    expect(Number(ends[0][1])).toBeLessThanOrEqual(14.1);

    const samples = decodePcm();
    expect(rms(samples, 0.5, 6.5)).toBeGreaterThan(0.001);
    expect(rms(samples, 7.2, 13.8)).toBeLessThan(0.000001);
    const earlyExhale = rms(samples, 14.2, 15.2);
    const lateExhale = rms(samples, 19.8, 20.8);
    expect(20 * Math.log10(lateExhale / earlyExhale)).toBeLessThan(-6);
  });

  it('has no abnormal sample jumps at phase boundaries or the loop seam', () => {
    const samples = decodePcm();
    const differences = new Float32Array(samples.length - 1);
    for (let index = 1; index < samples.length; index += 1) {
      differences[index - 1] = Math.abs(samples[index] - samples[index - 1]);
    }
    const sorted = Array.from(differences).sort((a, b) => a - b);
    const ordinaryJump = sorted[Math.floor(sorted.length * 0.999)];
    for (const second of [7, 14]) {
      const index = second * 48_000;
      expect(Math.abs(samples[index] - samples[index - 1])).toBeLessThanOrEqual(ordinaryJump * 1.5);
    }
    expect(Math.abs(samples[0] - samples[samples.length - 1])).toBeLessThanOrEqual(ordinaryJump * 1.5);
  });
});

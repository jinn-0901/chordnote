const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const CHORD_TYPES = [
  { suffix: "", intervals: [0, 4, 7] },
  { suffix: "m", intervals: [0, 3, 7] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "aug", intervals: [0, 4, 8] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "7", intervals: [0, 4, 7, 10] },
  { suffix: "maj7", intervals: [0, 4, 7, 11] },
  { suffix: "m7", intervals: [0, 3, 7, 10] }
];

function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wLenR = Math.cos(angle), wLenI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const uR = real[i + j], uI = imag[i + j];
        const vR = real[i + j + len / 2] * wr - imag[i + j + len / 2] * wi;
        const vI = real[i + j + len / 2] * wi + imag[i + j + len / 2] * wr;
        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;
        real[i + j + len / 2] = uR - vR;
        imag[i + j + len / 2] = uI - vI;
        const nextR = wr * wLenR - wi * wLenI;
        wi = wr * wLenI + wi * wLenR;
        wr = nextR;
      }
    }
  }
}

function chromaForFrame(samples, sampleRate) {
  const n = samples.length;
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    real[i] = samples[i] * window;
  }
  fft(real, imag);
  const chroma = new Float64Array(12);
  for (let bin = 2; bin < n / 2; bin++) {
    const frequency = bin * sampleRate / n;
    if (frequency < 55 || frequency > 1800) continue;
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const note = ((Math.round(midi) % 12) + 12) % 12;
    const magnitude = Math.hypot(real[bin], imag[bin]);
    chroma[note] += Math.sqrt(magnitude);
  }
  const max = Math.max(...chroma);
  if (max > 0) for (let i = 0; i < 12; i++) chroma[i] /= max;
  return chroma;
}

function bestChord(chroma) {
  let best = { name: "N", score: -Infinity };
  for (let root = 0; root < 12; root++) {
    for (const type of CHORD_TYPES) {
      let score = 0;
      const chordNotes = new Set(type.intervals.map(x => (root + x) % 12));
      for (let note = 0; note < 12; note++) {
        score += chroma[note] * (chordNotes.has(note) ? 1 : -0.22);
      }
      score /= type.intervals.length;
      if (score > best.score) best = { name: NOTE_NAMES[root] + type.suffix, score };
    }
  }
  const energy = chroma.reduce((a, b) => a + b, 0);
  return energy < 0.15 || best.score < 0.08 ? { name: "N", score: 0 } : best;
}

function estimateKey(chroma) {
  const major = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minor = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  let best = { score: -Infinity, name: "알 수 없음" };
  for (let root = 0; root < 12; root++) {
    for (const [profile, mode] of [[major, ""], [minor, "m"]]) {
      let score = 0;
      for (let i = 0; i < 12; i++) score += chroma[(i + root) % 12] * profile[i];
      if (score > best.score) best = { score, name: NOTE_NAMES[root] + mode };
    }
  }
  return best.name;
}

export async function analyzeAudio(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("이 브라우저에서는 오디오 분석을 지원하지 않아요.");
  const context = new AudioContextClass();
  try {
    const buffer = await file.arrayBuffer();
    const audio = await context.decodeAudioData(buffer);
    const channels = [];
    for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c));
    const mono = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (const channel of channels) sum += channel[i];
      mono[i] = sum / channels.length;
    }

    const frameSize = 8192;
    const hopSize = 4096;
    const segmentFrames = Math.max(1, Math.round(audio.sampleRate * 1.6 / hopSize));
    const frames = [];
    const totalChroma = new Float64Array(12);
    for (let start = 0; start + frameSize <= mono.length; start += hopSize) {
      const chroma = chromaForFrame(mono.subarray(start, start + frameSize), audio.sampleRate);
      for (let i = 0; i < 12; i++) totalChroma[i] += chroma[i];
      frames.push({ time: start / audio.sampleRate, chroma });
    }
    if (!frames.length) throw new Error("파일이 너무 짧거나 분석할 수 없는 오디오예요.");

    const chords = [];
    for (let i = 0; i < frames.length; i += segmentFrames) {
      const group = frames.slice(i, i + segmentFrames);
      const avg = new Float64Array(12);
      for (const frame of group) for (let n = 0; n < 12; n++) avg[n] += frame.chroma[n] / group.length;
      const found = bestChord(avg);
      const start = group[0].time;
      const end = Math.min(audio.duration, group[group.length - 1].time + hopSize / audio.sampleRate);
      const previous = chords[chords.length - 1];
      if (previous && previous.name === found.name) previous.end = end;
      else chords.push({ index: chords.length, name: found.name, start, end, confidence: found.score });
    }

    const keyChroma = totalChroma.map(v => v / frames.length);
    return { duration: audio.duration, key: estimateKey(keyChroma), chords };
  } finally {
    await context.close();
  }
}
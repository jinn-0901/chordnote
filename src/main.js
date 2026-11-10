import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { analyzeAudio } from "./services/audio-analyzer.js";

const h = React.createElement;
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function App() {
  const [file, setFile] = React.useState(null);
  const [fileUrl, setFileUrl] = React.useState("");
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [selectedChord, setSelectedChord] = React.useState(-1);
  const [dragging, setDragging] = React.useState(false);
  const [youtubeInput, setYoutubeInput] = React.useState("");
  const [youtubeId, setYoutubeId] = React.useState("");
  const [youtubeError, setYoutubeError] = React.useState("");
  const inputRef = React.useRef(null);
  const audioRef = React.useRef(null);

  React.useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  function loadFile(nextFile) {
    if (!nextFile) return;
    const audioExtensions = /\.(mp3|wav|m4a|aac|ogg|oga|flac|aiff|aif|opus|webm)$/i;
    if (!nextFile.type.startsWith("audio/") && !audioExtensions.test(nextFile.name)) {
      setError("오디오 파일만 업로드할 수 있어요.");
      return;
    }
    if (nextFile.size > 80 * 1024 * 1024) {
      setError("파일은 80MB 이하로 업로드해 주세요.");
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(nextFile);
    setFileUrl(URL.createObjectURL(nextFile));
    setResult(null);
    setError("");
    setStatus("idle");
  }

  function getYouTubeId(value) {
    try {
      const url = new URL(value.trim());
      const host = url.hostname.toLowerCase();
      const normalizedHost = host.startsWith("www.") ? host.slice(4) : host;
      const parts = url.pathname.split("/").filter(Boolean);
      let id = "";
      if (normalizedHost === "youtu.be") id = parts[0] || "";
      else if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(normalizedHost)) {
        if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
        else if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1] || "";
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    } catch {
      return "";
    }
  }

  function loadYouTubeLink() {
    const id = getYouTubeId(youtubeInput);
    if (!id) {
      setYoutubeError("올바른 유튜브 영상 링크를 입력해 주세요.");
      setYoutubeId("");
      return;
    }
    setYoutubeId(id);
    setYoutubeError("");
  }

  async function runAnalysis() {
    if (!file) return;
    setStatus("analyzing");
    setError("");
    setResult(null);
    try {
      const data = await analyzeAudio(file);
      setResult(data);
      setStatus("done");
      setSelectedChord(0);
    } catch (e) {
      setError(e.message || "분석 중 문제가 발생했어요.");
      setStatus("idle");
    }
  }

  function jumpToChord(chord) {
    setSelectedChord(chord.index);
    if (audioRef.current) {
      audioRef.current.currentTime = chord.start;
      audioRef.current.play().catch(() => {});
    }
  }

  const activeChord = result?.chords?.[selectedChord];

  return h("div", { className: "app-shell" },
    h("header", { className: "topbar" },
      h("a", { className: "brand", href: "./", "aria-label": "Chordnote home" },
        h("span", { className: "brand-mark" }, "♪"),
        h("span", null, "chordnote")
      ),
      h("span", { className: "top-note" }, "FREE AUDIO CHORD ANALYZER")
    ),
    h("main", { className: "main-content" },
      h("section", { className: "hero" },
        h("div", { className: "eyebrow" }, h("span", { className: "eyebrow-dot" }), "YOUR MUSIC, DECODED"),
        h("h1", null, "Find the ", h("span", null, "chords.")),
        h("p", { className: "hero-copy" }, "음원을 넣고 코드 진행을 확인하세요."),
        h("p", { className: "hero-subcopy" }, "음원 업로드 · 코드 분석")
      ),
      h("section", { className: "workspace" },
        h("div", { className: "section-heading" },
          h("div", null, h("span", { className: "step-label" }, "01 / SOURCE"), h("h2", null, "음악 불러오기")),
          h("span", { className: "format-note" }, "MP3 · WAV · M4A · OGG")
        ),
        h("div", {
          className: "upload-zone" + (dragging ? " is-dragging" : "") + (file ? " has-file" : ""),
          onDragOver: e => { e.preventDefault(); setDragging(true); },
          onDragLeave: () => setDragging(false),
          onDrop: e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files?.[0]); }
        },
          h("input", { ref: inputRef, type: "file", accept: "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.aiff,.aif,.opus,.webm", hidden: true, onChange: e => loadFile(e.target.files?.[0]) }),
          h("div", { className: "upload-icon" }, file ? "♫" : "↑"),
          h("strong", null, file ? file.name : "오디오 파일을 여기에 놓으세요"),
          h("span", { className: "upload-caption" }, file ? "파일이 준비됐어요. 아래 버튼으로 분석할 수 있어요." : "또는"),
          h("button", { className: "button button-secondary", onClick: () => inputRef.current?.click() }, file ? "다른 파일 선택" : "파일 선택하기")
        ),
        file && h("div", { className: "file-strip" },
          h("span", { className: "file-type" }, "AUDIO"),
          h("span", { className: "file-name" }, file.name),
          h("button", { className: "text-button", onClick: () => { setFile(null); setFileUrl(""); setResult(null); setStatus("idle"); } }, "삭제")
        ),
        h("div", { className: "divider-label" }, h("span"), h("i", null, "OR"), h("span")),
        h("div", { className: "youtube-panel" },
          h("div", { className: "youtube-heading" },
            h("strong", null, "유튜브 링크로 재생"),
            h("span", null, "영상 링크를 붙여넣으세요")
          ),
          h("div", { className: "youtube-form" },
            h("input", {
              className: "youtube-input",
              type: "url",
              value: youtubeInput,
              placeholder: "https://www.youtube.com/watch?v=...",
              onChange: e => setYoutubeInput(e.target.value),
              onKeyDown: e => { if (e.key === "Enter") loadYouTubeLink(); },
              "aria-label": "유튜브 영상 링크"
            }),
            h("button", { className: "button button-secondary", onClick: loadYouTubeLink }, "불러오기")
          ),
          youtubeError && h("p", { className: "error-message" }, youtubeError),
          youtubeId && h("div", { className: "youtube-player" },
            h("iframe", {
              src: "https://www.youtube-nocookie.com/embed/" + youtubeId,
              title: "YouTube video player",
              allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
              referrerPolicy: "strict-origin-when-cross-origin",
              allowFullScreen: true
            }),
            h("button", { className: "text-button youtube-clear", onClick: () => setYoutubeId("") }, "영상 닫기")
          ),
          h("p", { className: "youtube-note" }, "일부 영상은 업로더 설정이나 저작권 제한으로 외부 사이트에서 재생되지 않을 수 있어요. 유튜브 링크는 재생용이며 코드 분석은 오디오 파일 업로드가 필요해요.")
        ),
        file && h("button", { className: "button button-primary analyze-button", disabled: status === "analyzing", onClick: runAnalysis },
          status === "analyzing" ? h(React.Fragment, null, h("span", { className: "spinner" }), "코드 분석 중...") : "코드 분석하기  →"
        ),
        error && h("p", { className: "error-message" }, error),
        status === "analyzing" && h("p", { className: "processing-note" }, "음원의 주파수 정보를 살펴보고 있어요. 파일 길이에 따라 시간이 걸릴 수 있어요.")
      ),
      result && h("section", { className: "results-section" },
        h("div", { className: "section-heading results-heading" },
          h("div", null, h("span", { className: "step-label" }, "02 / RESULT"), h("h2", null, "코드 분석 결과")),
          h("span", { className: "result-meta" }, `${formatTime(result.duration)} · ${result.chords.length}개 구간`)
        ),
        h("div", { className: "result-summary" },
          h("div", null, h("span", { className: "summary-label" }, "추정 조성"), h("strong", null, result.key)),
          
        ),
        h("div", { className: "player-card" },
          h("div", { className: "now-playing" },
            h("span", { className: "summary-label" }, "NOW PLAYING"),
            h("strong", null, activeChord?.name || "—")
          ),
          h("audio", { ref: audioRef, controls: true, src: fileUrl, onTimeUpdate: e => {
            const t = e.currentTarget.currentTime;
            const idx = result.chords.findIndex((c, i) => t >= c.start && (t < c.end || i === result.chords.length - 1));
            if (idx >= 0 && idx !== selectedChord) setSelectedChord(idx);
          } })
        ),
        h("div", { className: "chord-list" },
          result.chords.map(chord => h("button", {
            key: chord.index,
            className: "chord-chip" + (selectedChord === chord.index ? " active" : ""),
            onClick: () => jumpToChord(chord)
          },
            h("strong", null, chord.name),
            h("span", null, formatTime(chord.start))
          ))
        ),
        h("p", { className: "disclaimer" }, "자동 분석 결과는 참고용 추정치예요. 보컬·악기 구성, 녹음 상태에 따라 실제 코드와 다를 수 있어요.")
      )
    ),
    h("footer", { className: "footer" },
      h("span", null, "chordnote"),
      h("span", null, "Made for the love of music.")
    )
  );
}

createRoot(document.getElementById("root")).render(h(App));
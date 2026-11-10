import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { analyzeAudio } from "./services/audio-analyzer.js";

const h = React.createElement;
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function getYouTubeId(value) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/");
      if (["embed", "shorts", "live"].includes(parts[1])) return parts[2];
    }
  } catch {}
  return null;
}

function App() {
  const [file, setFile] = React.useState(null);
  const [fileUrl, setFileUrl] = React.useState("");
  const [youtubeQuery, setYoutubeQuery] = React.useState("");
  const [youtubeApiKey, setYoutubeApiKey] = React.useState("");
  const [youtubeResults, setYoutubeResults] = React.useState([]);
  const [youtubeLoading, setYoutubeLoading] = React.useState(false);
  const [selectedVideo, setSelectedVideo] = React.useState(null);
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [selectedChord, setSelectedChord] = React.useState(-1);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef(null);
  const audioRef = React.useRef(null);

  React.useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  function loadFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("audio/")) {
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
    setSelectedVideo(null);
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

  async function searchYouTube() {
    const query = youtubeQuery.trim();
    const key = youtubeApiKey.trim();
    if (!query) {
      setError("검색할 노래나 영상 제목을 입력해 주세요.");
      return;
    }
    if (!key) {
      setError("YouTube Data API 키를 먼저 입력해 주세요.");
      return;
    }
    setYoutubeLoading(true);
    setError("");
    setYoutubeResults([]);
    setSelectedVideo(null);
    try {
      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        videoEmbeddable: "true",
        safeSearch: "moderate",
        maxResults: "10",
        key
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await response.json();
      if (!response.ok) {
        const reason = data?.error?.errors?.[0]?.reason;
        if (reason === "keyInvalid") throw new Error("API 키가 올바르지 않아요. 키를 다시 확인해 주세요.");
        if (reason === "quotaExceeded") throw new Error("오늘 YouTube 검색 할당량을 모두 사용했어요. 내일 다시 시도해 주세요.");
        throw new Error(data?.error?.message || "YouTube 검색에 실패했어요.");
      }
      setYoutubeResults((data.items || []).filter(item => item.id?.videoId));
      if (!data.items?.length) setError("검색 결과가 없어요. 다른 검색어를 입력해 보세요.");
    } catch (e) {
      setError(e.message || "YouTube 검색 중 문제가 발생했어요.");
    } finally {
      setYoutubeLoading(false);
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
        h("p", { className: "hero-copy" }, "음악 파일을 올리면 코드 진행을 자동으로 분석해요."),
        h("p", { className: "hero-subcopy" }, "무료 · 회원가입 없음 · 브라우저에서 분석")
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
          h("input", { ref: inputRef, type: "file", accept: "audio/*", hidden: true, onChange: e => loadFile(e.target.files?.[0]) }),
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
        h("div", { className: "youtube-search" },
          h("div", { className: "youtube-label" }, h("span", { className: "youtube-icon" }, "▶"), h("span", null, "YouTube에서 영상 검색")),
          h("div", { className: "api-key-row" },
            h("input", { className: "youtube-input", type: "password", value: youtubeApiKey, onChange: e => setYoutubeApiKey(e.target.value), placeholder: "YouTube Data API 키 입력", autoComplete: "off" }),
            h("span", { className: "api-key-hint" }, "키는 이 브라우저에서만 사용하고 저장하지 않아요")
          ),
          h("div", { className: "youtube-input-wrap" },
            h("input", { className: "youtube-input", value: youtubeQuery, onChange: e => setYoutubeQuery(e.target.value), placeholder: "노래 제목이나 아티스트 검색", onKeyDown: e => { if (e.key === "Enter") searchYouTube(); } }),
            h("button", { className: "button button-small", onClick: searchYouTube, disabled: youtubeLoading }, youtubeLoading ? "검색 중..." : "검색")
          )
        ),
        youtubeResults.length > 0 && h("div", { className: "youtube-results" },
          h("div", { className: "search-result-count" }, `검색 결과 ${youtubeResults.length}개`),
          youtubeResults.map(item => h("button", { key: item.id.videoId, className: "youtube-result" + (selectedVideo?.id?.videoId === item.id.videoId ? " selected" : ""), onClick: () => { setSelectedVideo(item); setFile(null); setResult(null); setStatus("idle"); } },
            h("img", { src: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url, alt: "", loading: "lazy" }),
            h("span", { className: "youtube-result-copy" },
              h("strong", null, item.snippet.title),
              h("small", null, item.snippet.channelTitle)
            )
          ))
        ),
        selectedVideo && h("div", { className: "youtube-panel" },
          h("iframe", { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(selectedVideo.id.videoId)}`, title: selectedVideo.snippet.title, allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share", allowFullScreen: true }),
          h("p", null, "YouTube 영상은 재생만 지원해요. 영상의 음원을 추출하지 않으며, 코드 분석은 권한이 있는 오디오 파일 업로드로 이용해 주세요.")
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
          h("div", null, h("span", { className: "summary-label" }, "분석 방식"), h("strong", null, "Chroma + 코드 패턴 비교"))
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
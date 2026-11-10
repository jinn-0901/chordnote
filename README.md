# Chordnote

무료 브라우저 기반 오디오 코드 분석 웹앱입니다.

## 현재 기능
- 오디오 파일 업로드 (최대 80MB)
- 브라우저 Web Audio API를 이용한 코드 추정
- 추정 조성 및 시간대별 코드 표시
- 결과 코드 구간을 눌러 해당 위치 재생
- YouTube Data API v3로 영상 제목 검색
- 검색 결과에서 영상을 선택해 앱 안에서 재생

## 분석 관련 안내
현재 분석은 FFT 기반 chroma 특징과 코드 템플릿을 비교하는 방식입니다. 보컬과 반주가 섞인 음원에서도 작동을 시도하지만, 악기 구성·음질·전조·복잡한 화음에 따라 오차가 발생할 수 있습니다. 결과는 참고용 추정치입니다.

YouTube 영상은 검색 및 임베드 재생만 지원합니다. 영상의 오디오를 추출하거나 다운로드하지 않으며, YouTube 영상 자체를 코드 분석하지 않습니다. 분석할 권한이 있는 오디오 파일을 업로드해 주세요.

### YouTube 검색 설정
앱에서 YouTube 검색을 사용하려면 Google Cloud 프로젝트에서 YouTube Data API v3를 활성화하고 API 키를 발급해야 합니다. 앱의 API 키 입력란에 키를 붙여넣으면 현재 페이지가 열려 있는 동안 검색에 사용하며, 키를 브라우저 저장소나 저장소 코드에 저장하지 않습니다. 브라우저에서 API를 호출하는 구조이므로 키는 완전히 비밀로 유지되지 않습니다. 반드시 HTTP 리퍼러 제한에 `https://jinn-0901.github.io/*`를 추가하고, API 제한은 YouTube Data API v3만 허용하도록 설정하세요. API 키를 다른 사람과 공유하지 마세요.

1. Google Cloud Console에서 프로젝트를 만들거나 선택합니다.
2. API 라이브러리에서 YouTube Data API v3를 사용 설정합니다.
3. 사용자 인증 정보에서 API 키를 만듭니다.
4. 키 제한에서 웹사이트(HTTP 리퍼러)를 선택하고 `https://jinn-0901.github.io/*`를 추가합니다.
5. API 제한에서 YouTube Data API v3만 선택하고 저장합니다.

공식 안내: https://developers.google.com/youtube/v3/getting-started

## 실행
정적 파일로 구성되어 있어 별도 빌드 도구가 필요하지 않습니다. GitHub Pages에서 바로 제공할 수 있습니다. React 18은 esm.sh CDN에서 모듈로 불러옵니다.

## 배포
GitHub 저장소의 Settings → Pages에서 배포 소스를 GitHub Actions로 설정하고, 정적 사이트 배포 워크플로를 실행합니다.

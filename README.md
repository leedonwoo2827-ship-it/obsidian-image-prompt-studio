# 이미지 프롬프트 옵시디안

옵시디안 원고를 넣으면 **로컬 Ollama**로 FlowGenie용 **이미지 프롬프트 JSON + TXT + 미리보기 MD**를 한 번에 만들어줍니다.
우측 사이드바에 **진행 중 / 최근 기록**이 실시간으로 표시됩니다.

> 이 저장소는 "**하나의 완성 플러그인**"이면서 동시에 "**각자 용도에 맞는 파생 플러그인 스타터**"입니다.
> `src/branding.ts`와 `src/prompts.ts`만 바꾸면 본인만의 이미지 프롬프트 플러그인이 됩니다.

---

## 0. 준비 (최초 1회)

### 0-1. Ollama 설치

Windows: https://ollama.com/download/OllamaSetup.exe 실행해서 설치.
설치 후 작업표시줄에 라마 아이콘이 떠 있으면 OK.

### 0-2. AI 모델 받기

명령 프롬프트(cmd) 열고 아래 중 하나:

```
ollama pull gemma4:e4b
```

- `gemma4:e4b` : 권장 (균형, 약 5GB)
- `gemma4:e2b` : 저사양 PC용 (경량, 약 2GB) — `ollama pull gemma4:e2b`

### 0-3. Obsidian 설치 (없는 분만)

https://obsidian.md/download

---

## 1. 플러그인 설치

### 방법 A. 수동 설치 (비개발자 권장)

1. 배포 zip을 받아 압축 해제 → 폴더 안에 `main.js`, `manifest.json`, `styles.css` 3개 파일이 있어야 합니다.
2. 본인의 **Obsidian Vault 폴더** → `.obsidian/plugins/image-prompt-obsidian/` 폴더를 만들고 위 3개 파일을 그대로 복사.
3. Obsidian 재시작 → 설정 → 커뮤니티 플러그인 → **"이미지 프롬프트 옵시디안" ON**.

### 방법 B. BRAT (업데이트 자동화, 개발 경험 있는 분용)

BRAT 플러그인 설치 → `Add Beta Plugin` → `leedonwoo2827-ship-it/obsidian-image-prompt-studio` 입력.

---

## 2. 첫 설정

Obsidian 설정 → "이미지 프롬프트 옵시디안":

- **Ollama 서버 URL**: 기본값 그대로(`http://localhost:11434`)
- **Ollama 모델**: `gemma4:e4b` 선택
- **"Ollama 연결 테스트"** 버튼 클릭 → `✓ 연결 성공` 확인
- **FlowGenie 이미지 모델**: `nano_banana` (스크린샷 선택값)
- **출력 폴더**: `ImagePrompts` (원하는 Vault 내 경로로 변경 가능)

---

## 3. 사용법

1. 원고 노트를 연 상태에서 우측 리본의 🖼 아이콘을 눌러 **사이드바 열기** ("진행 중 / 최근 기록" 패널).
2. 명령 팔레트(Ctrl+P) → **"이미지 프롬프트 생성 (현재 노트)"**.
3. 사이드바에 `진행 중 (1) — [2/4] Ollama 호출 중...` → `[3/4] 검증 중` → `[4/4] 저장 중` 단계가 표시됩니다.
4. 완료되면 **최근 기록**에 `✅ 원고명 — N scenes, HH:MM` 이 추가됩니다.
5. 행의 **MD / JSON / TXT** 링크를 클릭하면 해당 파일이 바로 열립니다.
6. **JSON 파일을 FlowGenie 사이드패널에 드래그** → Queue에 로드되어 이미지 대량 생성 시작.

### 파일 선택으로 실행
명령 팔레트 → **"이미지 프롬프트 생성 (파일 선택)"** → Vault 내 임의의 .md 선택.

---

## 4. 트러블슈팅

- **[T1] Ollama 연결 실패** → 작업표시줄 라마 아이콘 우클릭 재시작, 보안 프로그램(V3·알약 등)에 `localhost:11434` 예외 등록.
- **[T2] 모델 없음** → `ollama pull gemma4:e4b` 재실행.
- **[T3] JSON 파싱 실패** → 자동 재시도됨. 그래도 실패하면 `{출력폴더}/_debug/*.raw.txt` 확인. 모델을 `gemma4:e4b`로 업그레이드 권장.
- **[T4] 한글 깨짐** → 원고 파일을 UTF-8로 저장.
- **[T5] 원고가 너무 김** → 원고를 절반으로 나누거나 설정에서 **목표 씬 개수**를 줄이세요.
- **[T6] 플러그인이 목록에 없음** → `.obsidian/plugins/image-prompt-obsidian/` 경로와 3파일(`main.js`, `manifest.json`, `styles.css`)이 모두 있는지 확인, Obsidian 재시작.

---

## 5. 나만의 플러그인으로 파생하기 (개발 가능한 동료용)

1. 이 저장소 fork 또는 zip 다운로드.
2. **`src/branding.ts`와 `manifest.json`의 `id`·`name`·`description`·`author` 반드시 변경.**
   (같은 Vault에 여러 파생 플러그인을 설치할 때 ID가 겹치면 로드 실패)
3. `src/prompts.ts` 수정:
   - `OBSIDIAN_VISUAL_STYLE`을 본인 브랜딩 가이드로 교체
   - `FEW_SHOT_SCENE`을 자기 스타일의 영어 프롬프트 예시로 교체
4. 필요시 `src/settings.ts`의 `DEFAULT_SETTINGS`, `styles.css` 조정.
5. 빌드:

```
npm install
npm run build
```

→ 생성된 `main.js` + `manifest.json` + `styles.css` 3개 파일을 배포.

---

## 6. 문의

담당자 Slack (사내 채널에 링크).

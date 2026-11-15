# 해부 데일리

해부학 사진 빈칸 학습 · 퀴즈 · 족보 · 빈칸 카드 웹앱. 서버 없이 브라우저에서 동작하고, 원하면 내 Google 드라이브에 동기화해요.

- 자료·기록은 각 기기 브라우저(IndexedDB)에 저장돼요. 이 저장소에는 앱 코드만 있어요.
- Google 드라이브 동기화: 설정 › Google 드라이브 동기화 › Google 계정으로 연결. 드라이브의 숨김 앱 폴더(appDataFolder)만 사용해요.

## 로컬 실행
`실행하기.bat` 더블클릭 → http://127.0.0.1:5180

## Google 드라이브 연동 설정 (처음 한 번)
1. https://console.cloud.google.com → 새 프로젝트
2. API 및 서비스 › 라이브러리 › **Google Drive API** 사용 설정
3. OAuth 동의 화면 → 외부(External) → 앱 이름·이메일 입력 → 범위에 `.../auth/drive.appdata` 추가 → **테스트 사용자에 내 구글 계정 추가**
4. 사용자 인증 정보 › 사용자 인증 정보 만들기 › OAuth 클라이언트 ID › 웹 애플리케이션
   - 승인된 JavaScript 원본: `https://cyil36.github.io`, `http://127.0.0.1:5180`
5. 만들어진 클라이언트 ID를 `js/config.js`의 `GOOGLE_CLIENT_ID`에 넣기 (공개해도 되는 값이에요)

앱 주소: https://cyil36.github.io/Daily_anatomy_yon/

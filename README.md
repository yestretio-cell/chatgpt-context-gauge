# GPT Session Token Counter

ChatGPT의 현재 채팅 세션의 `o200k_base` 토큰 수를 보여주는 Chrome 확장 프로그램입니다.

## 설치

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 오른쪽 위 `Developer mode`를 켭니다.
3. `Load unpacked`를 누르고 이 폴더를 선택합니다.
4. `https://chatgpt.com/`에서 채팅을 열면 오른쪽 위에 토큰 패널이 표시됩니다.

## 기능

- 현재 보이는 ChatGPT 대화의 전체 `o200k_base` 토큰 수 계산
- 메시지 수, 문자 수, 작성 중인 프롬프트 토큰 수, 가장 긴 메시지 토큰 수 표시
- 작성 중인 프롬프트 포함 여부 토글
- 패널 드래그 이동, 접기, 닫기, 수동 새로고침, 통계 복사
- 토큰 계산에 사용한 raw text 보기 및 복사
- Raw text 창의 접힌 debug details에서 exported raw text 길이, 실제 counted string 길이, encoding, token count, counted string 앞/뒤 200자 표시

닫은 패널은 확장 프로그램 팝업의 `Show panel` 버튼으로 다시 열 수 있습니다.

## 정확도

이 확장은 페이지에 보이는 텍스트를 raw text로 모은 뒤, 그 문자열 그대로 `o200k_base` tokenizer에 전달합니다. 토큰화 전에 공백 normalize, trim, markdown 제거, code block 제거를 하지 않습니다.

실제 ChatGPT 서비스 내부 컨텍스트에는 화면에 보이지 않는 시스템/도구 메시지나 hidden metadata가 포함될 수 있으므로, 이 확장은 페이지에서 export 가능한 raw text 기준의 토큰 수를 계산합니다.

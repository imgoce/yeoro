"""약관·개인정보처리방침 html → 앱 내장용 js 로 변환한다.

안드로이드 앱은 화면을 file:// 로 열기 때문에 옆에 있는 html 파일을
fetch로 읽지 못한다(브라우저 보안 정책). 그래서 문서 본문을 js 파일에
담아 앱과 함께 배포한다.

사용법 (프로젝트 루트에서):
    python tools/build-policy-data.py
"""

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
OUT = FRONTEND / "js" / "policy-data.js"

DOCS = {
    "privacy": FRONTEND / "privacy-policy.html",
    "terms": FRONTEND / "terms.html",
}

HEADER = """/* ── 약관·개인정보처리방침 본문 (앱 내장) ────────────────────────
   privacy-policy.html / terms.html 의 본문을 그대로 담아 둔 것이다.

   왜 파일을 직접 읽지 않고 여기에 넣어두는가
     안드로이드 앱은 화면을 file:// 로 열기 때문에, 옆에 있는 html 파일을
     fetch로 읽으려 하면 브라우저 보안 정책에 막혀 "불러오지 못했어요"가 뜬다.
     문서는 자주 바뀌지 않으므로 앱에 함께 담아 어디서든 바로 보여준다.

   ⚠️ 원본 html을 고치면 아래 명령으로 이 파일을 다시 만들어야 한다.
      python tools/build-policy-data.py
   ────────────────────────────────────────────────────────────────*/
"""


def body_of(path: pathlib.Path) -> str:
    """<body> 안쪽만 꺼낸다 (문서의 <head> 스타일은 앱 화면과 충돌한다)."""
    text = path.read_text(encoding="utf-8")
    match = re.search(r"<body[^>]*>(.*?)</body>", text, re.S)
    return (match.group(1) if match else text).strip()


def main() -> None:
    bodies = {key: body_of(path) for key, path in DOCS.items()}
    lines = [HEADER, "const POLICY_HTML = {"]
    for key, html in bodies.items():
        lines.append(f"    {key}: {json.dumps(html, ensure_ascii=False)},")
    lines.append("};\n")
    OUT.write_text("\n".join(lines), encoding="utf-8")

    for key, html in bodies.items():
        print(f"  {key}: {len(html):,}자")
    print(f"생성: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

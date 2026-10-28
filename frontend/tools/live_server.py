"""
UI/UX 작업 중 실시간 미리보기용 개발 서버.

frontend/ 디렉터리를 HTTP로 서빙하면서, .html 응답에 작은 자동새로고침
스크립트를 주입한다. 별도 빌드 도구 없이(Node 불필요) 표준 라이브러리만
사용해서, 파일을 저장할 때마다 브라우저가 자동으로 새로고침된다.

이 스크립트를 실행하면 backend/(FastAPI) 서버도 자동으로 함께 기동된다 —
따로 uvicorn을 켤 필요 없이 이 파일 하나만 실행하면 프론트+백엔드가 같이 뜬다.

사용법:
    python tools/live_server.py [port]   (기본 포트 5500)
    브라우저에서 http://localhost:5500/ 접속
"""
import atexit
import http.server
import os
import signal
import socketserver
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500

BACKEND_DIR = os.path.join(os.path.dirname(ROOT), 'backend')
BACKEND_PORT = 8000
_backend_process = None


def _backend_already_running() -> bool:
    try:
        urllib.request.urlopen(f'http://127.0.0.1:{BACKEND_PORT}/health', timeout=1)
        return True
    except Exception:
        return False


def _backend_python() -> str:
    """backend/venv가 있으면 그 안의 파이썬을, 없으면 지금 이 스크립트를 실행 중인
    파이썬을 그대로 쓴다 (의존성이 이미 전역/현재 환경에 설치되어 있다고 가정)."""
    venv_python = os.path.join(
        BACKEND_DIR, 'venv',
        'Scripts' if os.name == 'nt' else 'bin',
        'python.exe' if os.name == 'nt' else 'python',
    )
    return venv_python if os.path.isfile(venv_python) else sys.executable


def start_backend():
    global _backend_process
    if not os.path.isdir(BACKEND_DIR):
        return
    if _backend_already_running():
        print(f'백엔드가 이미 http://localhost:{BACKEND_PORT} 에서 실행 중이라 그대로 사용합니다.')
        return
    try:
        _backend_process = subprocess.Popen(
            [_backend_python(), '-m', 'uvicorn', 'app.main:app',
             '--host', '127.0.0.1', '--port', str(BACKEND_PORT)],
            cwd=BACKEND_DIR,
        )
    except OSError as e:
        print(f'[경고] 백엔드 자동 기동 실패: {e} — 프론트엔드만 폴백 데이터로 계속 동작합니다.')
        return
    atexit.register(stop_backend)

    # 실제로 응답할 때까지 잠깐 대기 (최대 15초)
    for _ in range(30):
        if _backend_already_running():
            print(f'백엔드 자동 기동됨: http://localhost:{BACKEND_PORT}')
            return
        if _backend_process.poll() is not None:
            print('[경고] 백엔드 프로세스가 바로 종료됐어요 — 의존성이 설치돼 있는지 확인해주세요 '
                  '(cd backend && pip install -r requirements.txt). 프론트엔드는 폴백 데이터로 계속 동작합니다.')
            return
        time.sleep(0.5)
    print('[경고] 백엔드가 15초 안에 응답하지 않았어요. 계속 백그라운드에서 기동 중일 수 있습니다.')


def stop_backend():
    if _backend_process is not None and _backend_process.poll() is None:
        _backend_process.terminate()

RELOAD_SCRIPT = b"""
<script>
(function(){
    let last = null;
    setInterval(function(){
        fetch('/__livereload').then(r=>r.text()).then(v=>{
            if (last === null) { last = v; return; }
            if (v !== last) location.reload();
        }).catch(()=>{});
    }, 800);
})();
</script>
</body>"""


def latest_mtime():
    newest = 0.0
    for dirpath, _dirnames, filenames in os.walk(ROOT):
        if os.sep + 'tools' in dirpath + os.sep:
            continue
        for name in filenames:
            path = os.path.join(dirpath, name)
            try:
                newest = max(newest, os.path.getmtime(path))
            except OSError:
                pass
    return newest


class LiveReloadHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path == '/__livereload':
            body = str(latest_mtime()).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, 'index.html')
        if path.endswith('.html') and os.path.isfile(path):
            with open(path, 'rb') as f:
                content = f.read()
            if b'</body>' in content:
                content = content.replace(b'</body>', RELOAD_SCRIPT, 1)
            else:
                content += RELOAD_SCRIPT
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            import io
            return io.BytesIO(content)
        return super().send_head()


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def _handle_sigterm(signum, frame):
    stop_backend()
    sys.exit(0)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, _handle_sigterm)
    start_backend()
    # HOST 인자로 바인딩 주소 지정 (기본 127.0.0.1). '0.0.0.0'이면 같은 Wi-Fi의
    # 다른 사람도 http://<이_PC_IP>:PORT/ 로 접속할 수 있다.
    HOST = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
    with ReusableTCPServer((HOST, PORT), LiveReloadHandler) as httpd:
        if HOST == '0.0.0.0':
            import socket as _s
            try:
                _ip = _s.gethostbyname(_s.gethostname())
            except Exception:
                _ip = '이_PC의_IP'
            print(f'Live preview (외부 공유): http://{_ip}:{PORT}/  (같은 Wi-Fi에서 접속, Ctrl+C to stop)')
        else:
            print(f'Live preview: http://localhost:{PORT}/  (Ctrl+C to stop)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            stop_backend()

"""
UI/UX 작업 중 실시간 미리보기용 개발 서버.

frontend/ 디렉터리를 HTTP로 서빙하면서, .html 응답에 작은 자동새로고침
스크립트를 주입한다. 별도 빌드 도구 없이(Node 불필요) 표준 라이브러리만
사용해서, 파일을 저장할 때마다 브라우저가 자동으로 새로고침된다.

사용법:
    python tools/live_server.py [port]   (기본 포트 5500)
    브라우저에서 http://localhost:5500/ 접속
"""
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500

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


if __name__ == '__main__':
    with ReusableTCPServer(('127.0.0.1', PORT), LiveReloadHandler) as httpd:
        print(f'Live preview: http://localhost:{PORT}/  (Ctrl+C to stop)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

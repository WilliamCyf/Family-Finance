"""FamFi dev server: threaded and never cached, so edits show on a plain reload.
(Live prices come straight from Finnhub / Twelve Data / CoinGecko / the ECB in the
browser — no server-side code is needed.)

Usage: python3 FamFi/tests/devserver.py 8644
"""
import sys, os, functools, http.server

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8644
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **{'.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.svg': 'image/svg+xml'})

    def do_GET(self):
        if self.path.split('?')[0] == '/__rules.json':  # tests/two-phones.html reads the hub's rules
            body = open(os.path.join(root, 'database.rules.json'), 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()

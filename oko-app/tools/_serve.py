from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import functools, sys
D = '/home/user/OKO-TEAM/oko-app/prototype'
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=D, **kw)
    def log_message(self, *a): pass
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()

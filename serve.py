import functools
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True

    def server_bind(self):
        # allow both IPv6 (::1) and IPv4 (127.0.0.1) on localhost
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


def main():
    handler = functools.partial(SimpleHTTPRequestHandler, directory="out")
    with DualStackServer(("::", 3000), handler) as httpd:
        print("Serving ./out on http://localhost:3000 (threaded, dual-stack)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()

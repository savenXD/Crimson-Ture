"""Work out this machine's address on the local network, so a phone on the same Wi-Fi can open the app.

    python -m backend.app.lan 8000     # prints the link and a QR code
"""
import socket
import sys


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))     # no packet is sent; this only picks the outgoing interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    url = f"http://{lan_ip()}:{sys.argv[1] if len(sys.argv) > 1 else 8000}"
    print(f"  On your phone (same Wi-Fi):  {url}")
    try:
        import qrcode
        q = qrcode.QRCode(border=1)
        q.add_data(url)
        q.make()
        q.print_ascii(invert=True)
    except ImportError:
        pass


if __name__ == "__main__":
    main()

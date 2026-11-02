"""Web Push alerts: subscriptions, server keys, alert rules, and a background checker.

Browsers only allow push on https or localhost, so on a plain http Wi-Fi link the app falls back to showing the same alerts in-app.
Subscriptions and the private key live in .nox/ (git-ignored).
"""
import base64
import json
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ml.aqi import category, pm25_to_aqi

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / ".nox"
SUBS = DIR / "subs.json"
router = APIRouter(prefix="/api/push")
LOCK = threading.Lock()
IST = timezone(timedelta(hours=5, minutes=30))
HI = {"Good": "अच्छी", "Satisfactory": "संतोषजनक", "Moderate": "मध्यम", "Poor": "खराब", "Very Poor": "बहुत खराब", "Severe": "गंभीर"}
DEFAULT_RULES = {"headsup": True, "daybefore": True, "severe": True}
_started = False


# ---------- keys and storage ----------
def keys():
    from py_vapid import Vapid
    from cryptography.hazmat.primitives import serialization
    DIR.mkdir(exist_ok=True)
    priv = DIR / "vapid_private.pem"
    if not priv.exists():
        v = Vapid()
        v.generate_keys()
        v.save_key(str(priv))
    v = Vapid.from_file(str(priv))
    raw = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return str(priv), base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def load():
    return json.loads(SUBS.read_text()) if SUBS.exists() else []


def save(subs):
    DIR.mkdir(exist_ok=True)
    SUBS.write_text(json.dumps(subs, indent=1))


# ---------- forecast helpers (reuse the API's loaded forecast) ----------
def _m():
    from backend.app import main as M
    return M


def aqi_series(h3):
    M = _m()
    p50, _, _ = M.need()
    g, _ = M.grid()
    hit = np.where(g.h3.values == h3)[0]
    if not len(hit):
        raise HTTPException(404, "area not found")
    i = int(hit[0])
    return pm25_to_aqi(p50[:, i]), str(g.station.iloc[i])


def when(t, lang="en"):
    d = _m().START + timedelta(hours=int(t))
    return d.strftime("%a %-d %b, %-I %p")


def cat(a, lang):
    c = category(float(a))
    return HI[c] if lang == "hi" else c


def advice(a, lang):
    en, hi = _m().advice(float(a))
    return hi if lang == "hi" else en


def events(h3):
    """The moments this area deserves an alert, from the forecast."""
    M = _m()
    aqi, near = aqi_series(h3)
    dt = M.DIWALI_T
    lo, hi = int(max(0, dt - 6)), int(min(len(aqi), dt + 15))
    pk = lo + int(np.argmax(aqi[lo:hi]))
    # first hour around Diwali when the air is Very Poor or worse (this is when the heads-up is about)
    first_bad = next((h for h in range(max(1, int(dt - 30)), min(len(aqi), int(dt + 8))) if aqi[h] >= 301), pk)
    severe = next((h for h in range(len(aqi)) if aqi[h] >= 401), None)
    return {"aqi": aqi, "near": near, "peak": pk, "bad": first_bad, "severe": severe, "daybefore_t": dt - 36}


def message(kind, h3, lang="en"):
    e = events(h3)
    a = e["aqi"]
    where = f"Near {e['near']}" if lang == "en" else f"{e['near']} के पास"
    if kind == "welcome":
        t = e["peak"]
        title = "Alerts are on" if lang == "en" else "अलर्ट चालू हैं"
        body = (f"{where}: air may reach {cat(a[t], lang)} (AQI {int(a[t])}) around {when(t)}. We'll warn you before it does."
                if lang == "en" else f"{where}: {when(t)} के आसपास हवा {cat(a[t], lang)} (AQI {int(a[t])}) तक जा सकती है। हम पहले बता देंगे।")
        level = "info"
    elif kind == "daybefore":
        t = e["peak"]
        title = "Diwali is tomorrow" if lang == "en" else "कल दिवाली है"
        body = (f"{where}: AQI may reach {int(a[t])} ({cat(a[t], lang)}) around {when(t)}. {advice(a[t], lang)}"
                if lang == "en" else f"{where}: {when(t)} के आसपास AQI {int(a[t])} ({cat(a[t], lang)}) हो सकता है। {advice(a[t], lang)}")
        level = "warn"
    elif kind == "headsup":
        t = e["bad"]
        title = f"Air turning {cat(a[t], lang)} soon" if lang == "en" else f"जल्द ही हवा {cat(a[t], lang)} होगी"
        body = (f"Around {when(t)}. {where}. {advice(a[t], lang)}" if lang == "en" else f"{when(t)} के आसपास, {where}। {advice(a[t], lang)}")
        level = "warn"
    elif kind == "severe":
        t = e["severe"] if e["severe"] is not None else e["peak"]
        title = "Severe air right now" if lang == "en" else "अभी हवा गंभीर है"
        body = (f"{where}: AQI {int(a[t])}. {advice(a[t], lang)}" if lang == "en" else f"{where}: AQI {int(a[t])}। {advice(a[t], lang)}")
        level = "severe"
    else:
        t = e["peak"]
        title = "Test alert" if lang == "en" else "टेस्ट अलर्ट"
        body = (f"This is how NOx alerts look. {where}: peak AQI {int(a[t])} around {when(t)}." if lang == "en"
                else f"NOx अलर्ट ऐसे दिखते हैं। {where}: {when(t)} के आसपास अधिकतम AQI {int(a[t])}।")
        level = "info"
    return {"title": title, "body": body, "url": f"/?area={h3}&t={int(t)}", "tag": f"nox-{kind}", "level": level, "t": int(t)}


def preview(h3, lang="en"):
    """What will be sent, and when. Shown in the app even where push isn't available."""
    M = _m()
    e = events(h3)
    out = [("daybefore", e["daybefore_t"]), ("headsup", max(0, e["bad"] - 3))]
    if e["severe"] is not None:
        out.append(("severe", e["severe"]))
    res = []
    for kind, t in out:
        m = message(kind, h3, lang)
        res.append({"kind": kind, "send_at": (M.START + timedelta(hours=float(t))).isoformat(), "title": m["title"], "body": m["body"], "level": m["level"]})
    return sorted(res, key=lambda r: r["send_at"])


# ---------- sending ----------
def send(sub, payload):
    from pywebpush import WebPushException, webpush
    priv, _ = keys()
    try:
        webpush(subscription_info=sub["sub"], data=json.dumps(payload), vapid_private_key=priv, vapid_claims={"sub": "mailto:alerts@nox.local"}, ttl=3600)
        return True
    except WebPushException as ex:
        code = getattr(getattr(ex, "response", None), "status_code", None)
        if code in (404, 410):             # the phone removed the subscription
            with LOCK:
                save([s for s in load() if s["sub"]["endpoint"] != sub["sub"]["endpoint"]])
        return False


def due(sub, now_t):
    """Alerts this subscriber should get right now, according to the real clock."""
    e = events(sub["h3"])
    n = len(e["aqi"])
    rules, sent, out = sub["rules"], sub.setdefault("sent", {}), []
    if rules.get("daybefore") and e["daybefore_t"] <= now_t < e["daybefore_t"] + 30 and "daybefore" not in sent:
        out.append(("daybefore", "daybefore"))
    if rules.get("headsup") and 0 <= now_t < n:
        for h in range(int(now_t) + 1, min(n, int(now_t) + 4)):
            if e["aqi"][h] >= 301 and e["aqi"][h - 1] < 301 and f"head{h}" not in sent:
                out.append(("headsup", f"head{h}"))
    if rules.get("severe") and 0 <= now_t < n and e["aqi"][int(now_t)] >= 401 and f"sev{int(now_t) // 6}" not in sent:
        out.append(("severe", f"sev{int(now_t) // 6}"))
    return out


def tick():
    M = _m()
    if M.loaded() is None:
        return
    now_t = (datetime.now(IST) - M.START).total_seconds() / 3600
    with LOCK:
        subs = load()
    changed = False
    for s in subs:
        for kind, key in due(s, now_t):
            if send(s, message(kind, s["h3"], s.get("lang", "en"))):
                s.setdefault("sent", {})[key] = datetime.now(IST).isoformat()
                changed = True
    if changed:
        with LOCK:
            keep = {x["sub"]["endpoint"]: x for x in subs}
            save([keep.get(x["sub"]["endpoint"], x) for x in load()])


def start():
    global _started
    if _started:
        return
    _started = True

    def loop():
        while True:
            try:
                tick()
            except Exception:
                pass
            time.sleep(60)
    threading.Thread(target=loop, daemon=True, name="nox-alerts").start()


# ---------- API ----------
class SubIn(BaseModel):
    subscription: dict
    h3: str
    lang: str = "en"
    rules: dict = DEFAULT_RULES


class EndpointIn(BaseModel):
    endpoint: str
    kind: str = "test"


@router.get("/key")
def get_key():
    return {"key": keys()[1]}


@router.get("/preview")
def get_preview(h3: str, lang: str = "en"):
    return {"alerts": preview(h3, lang), "now": datetime.now(IST).isoformat()}


@router.post("/subscribe")
def subscribe(b: SubIn):
    aqi_series(b.h3)                                           # validates the area
    sub = {"sub": b.subscription, "h3": b.h3, "lang": b.lang if b.lang in ("en", "hi") else "en", "rules": {**DEFAULT_RULES, **b.rules}, "sent": {}}
    with LOCK:
        subs = [s for s in load() if s["sub"]["endpoint"] != b.subscription.get("endpoint")]
        subs.append(sub)
        save(subs)
    sent = send(sub, message("welcome", b.h3, sub["lang"]))
    return {"ok": True, "welcome_sent": sent, "subscribers": len(subs)}


@router.post("/unsubscribe")
def unsubscribe(b: EndpointIn):
    with LOCK:
        save([s for s in load() if s["sub"]["endpoint"] != b.endpoint])
    return {"ok": True}


@router.post("/send")
def send_now(b: EndpointIn):
    """Send one alert to this device right now (test or demo of the real alert text)."""
    if b.kind not in ("test", "daybefore", "headsup", "severe"):
        raise HTTPException(400, "unknown alert kind")
    s = next((x for x in load() if x["sub"]["endpoint"] == b.endpoint), None)
    if not s:
        raise HTTPException(404, "this device is not subscribed")
    m = message(b.kind, s["h3"], s.get("lang", "en"))
    return {"sent": send(s, m), "message": m}

"""Grupo CUN: fechas, entregas, archivos, links e integrantes de un grupo de estudio.

Una sola app Flask. Guarda todo (incluidos los archivos) en la base de datos que
diga DATABASE_URL; sin esa variable usa SQLite en ./data/grupo.db.
"""
import calendar as cal
import hashlib
import hmac
import mimetypes
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from functools import wraps
from io import BytesIO
from urllib.parse import quote, urlencode

from flask import (Flask, abort, flash, g, jsonify, redirect, render_template,
                   request, send_file, session, url_for)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import deferred
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

GROUP_NAME = os.environ.get("GROUP_NAME", "Grupo CUN")
GROUP_CODE = os.environ.get("GROUP_CODE", "CUN-GRUPO")
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "20"))
# Colombia es UTC-5 todo el año (sin horario de verano).
LOCAL_TZ = timezone(timedelta(hours=int(os.environ.get("TZ_OFFSET_HOURS", "-5"))))

EVENT_KINDS = {
    "entrega": "Entrega",
    "parcial": "Parcial / examen",
    "reunion": "Reunión",
    "clase": "Clase / sesión",
    "otro": "Otro",
}
RESOURCE_CATEGORIES = {
    "solucion": "Solución de parcial",
    "entrega": "Entrega / trabajo",
    "material": "Material de clase",
    "guia": "Guía / enunciado",
    "otro": "Otro",
}
# Solo estos tipos se abren dentro del navegador; el resto se descarga.
INLINE_MIMETYPES = {"application/pdf", "image/png", "image/jpeg", "image/gif",
                    "image/webp", "text/plain"}


def database_url():
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)
        return "sqlite:///" + os.path.join(BASE_DIR, "data", "grupo.db")
    # Render, Neon y Supabase entregan postgres:// o postgresql://
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


app = Flask(__name__)
# Render y Hugging Face ponen un proxy HTTPS delante; así los enlaces salen con https://
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config.update(
    # Sin SECRET_KEY se deriva una del código del grupo, para que las sesiones sobrevivan
    # reinicios y funcionen con varios workers. En producción conviene definirla.
    SECRET_KEY=os.environ.get("SECRET_KEY")
    or hashlib.sha256(("grupo-cun:" + GROUP_CODE + os.environ.get("DATABASE_URL", "")).encode()).hexdigest(),
    SQLALCHEMY_DATABASE_URI=database_url(),
    SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},
    MAX_CONTENT_LENGTH=(MAX_UPLOAD_MB + 1) * 1024 * 1024,
    PERMANENT_SESSION_LIFETIME=timedelta(days=60),
    SESSION_COOKIE_HTTPONLY=True,
)
if os.environ.get("SPACE_ID"):
    # Hugging Face muestra la app dentro de un iframe: la cookie debe poder cruzar sitios.
    app.config.update(SESSION_COOKIE_SAMESITE="None", SESSION_COOKIE_SECURE=True)
elif os.environ.get("RENDER") or os.environ.get("COOKIE_SECURE"):
    app.config.update(SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=True)

db = SQLAlchemy(app)


def now_local():
    return datetime.now(LOCAL_TZ).replace(tzinfo=None)


# ---------------------------------------------------------------- modelos

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), default="")
    phone = db.Column(db.String(40), default="")
    whatsapp = db.Column(db.String(40), default="")
    birthday = db.Column(db.Date, nullable=True)
    about = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=now_local)

    @property
    def first_name(self):
        return self.name.split()[0] if self.name else self.username

    @property
    def whatsapp_link(self):
        digits = "".join(c for c in (self.whatsapp or self.phone or "") if c.isdigit())
        if not digits:
            return ""
        if len(digits) == 10:  # celular colombiano sin indicativo
            digits = "57" + digits
        return "https://wa.me/" + digits


class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    kind = db.Column(db.String(20), default="entrega")
    subject = db.Column(db.String(120), default="")
    due = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.Text, default="")
    link = db.Column(db.String(500), default="")
    done = db.Column(db.Boolean, default=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    created_by = db.relationship("User")
    created_at = db.Column(db.DateTime, default=now_local)
    comments = db.relationship("Comment", backref="event", cascade="all, delete-orphan",
                               order_by="Comment.created_at")

    @property
    def kind_label(self):
        return EVENT_KINDS.get(self.kind, "Otro")

    def status(self, now=None):
        """hecho | vencido | hoy | pronto (<=3 días) | semana (<=7 días) | luego"""
        now = now or now_local()
        if self.done:
            return "hecho"
        if self.due < now:
            return "vencido"
        if self.due.date() == now.date():
            return "hoy"
        if self.due - now <= timedelta(days=3):
            return "pronto"
        if self.due - now <= timedelta(days=7):
            return "semana"
        return "luego"

    def google_calendar_url(self):
        start = self.due.replace(tzinfo=LOCAL_TZ).astimezone(timezone.utc)
        end = start + timedelta(hours=1)
        fmt = "%Y%m%dT%H%M%SZ"
        details = self.description or ""
        if self.link:
            details += ("\n\n" if details else "") + self.link
        params = {
            "action": "TEMPLATE",
            "text": f"[{GROUP_NAME}] {self.title}",
            "dates": f"{start.strftime(fmt)}/{end.strftime(fmt)}",
            "details": details,
        }
        return "https://calendar.google.com/calendar/render?" + urlencode(params)

    def whatsapp_share_url(self):
        text = (f"📌 *{self.kind_label}: {self.title}*\n"
                f"🗓️ {format_dt(self.due)}")
        if self.subject:
            text += f"\n📚 {self.subject}"
        if self.link:
            text += f"\n🔗 {self.link}"
        return "https://wa.me/?text=" + quote(text)


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    body = db.Column(db.Text, nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=True)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    author = db.relationship("User")
    pinned = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=now_local)


class Resource(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    kind = db.Column(db.String(10), nullable=False)  # archivo | link
    category = db.Column(db.String(20), default="material")
    subject = db.Column(db.String(120), default="")
    description = db.Column(db.Text, default="")
    url = db.Column(db.String(1000), default="")
    filename = db.Column(db.String(255), default="")
    mimetype = db.Column(db.String(120), default="")
    size = db.Column(db.Integer, default=0)
    data = deferred(db.Column(db.LargeBinary, nullable=True))
    created_by_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    created_by = db.relationship("User")
    created_at = db.Column(db.DateTime, default=now_local)

    @property
    def category_label(self):
        return RESOURCE_CATEGORIES.get(self.category, "Otro")


with app.app_context():
    db.create_all()
    db.engine.dispose()  # gunicorn --preload: que cada worker abra sus propias conexiones


# ---------------------------------------------------------------- utilidades

DAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
          "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def format_dt(dt):
    hour = dt.strftime("%I:%M %p").lstrip("0").lower().replace("am", "a. m.").replace("pm", "p. m.")
    return f"{DAYS[dt.weekday()]} {dt.day} de {MONTHS[dt.month - 1]}, {hour}"


def format_size(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def relative(dt, now=None):
    now = now or now_local()
    delta = dt - now
    secs = delta.total_seconds()
    past = secs < 0
    secs = abs(secs)
    if secs < 3600:
        text = f"{max(1, int(secs // 60))} min"
    elif secs < 86400:
        text = f"{int(secs // 3600)} h"
    else:
        days = int(secs // 86400)
        text = f"{days} día" + ("s" if days != 1 else "")
    return f"hace {text}" if past else f"en {text}"


def next_birthday(bday, today):
    for year in (today.year, today.year + 1):
        try:
            candidate = bday.replace(year=year)
        except ValueError:  # 29 de febrero
            candidate = date(year, 3, 1)
        if candidate >= today:
            return candidate


def parse_due(form):
    raw = (form.get("due") or "").strip()
    try:
        return datetime.strptime(raw, "%Y-%m-%dT%H:%M")
    except ValueError:
        return None


def clean_url(raw):
    raw = (raw or "").strip()
    if raw and not raw.lower().startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


def calendar_token():
    key = (app.config["SECRET_KEY"] if os.environ.get("SECRET_KEY") else GROUP_CODE).encode()
    return hmac.new(key, b"calendario", hashlib.sha256).hexdigest()[:32]


def upcoming_alarms(now=None):
    """Pendientes vencidos (últimos 7 días) y los de los próximos 7 días."""
    now = now or now_local()
    events = (Event.query.filter(Event.done.is_(False),
                                 Event.due >= now - timedelta(days=7),
                                 Event.due <= now + timedelta(days=7))
              .order_by(Event.due).all())
    return events


app.jinja_env.filters.update(dt=format_dt, size=format_size, rel=relative)


# ---------------------------------------------------------------- sesión y seguridad

PUBLIC_ENDPOINTS = {"login", "register", "static", "calendar_feed", "health"}


@app.before_request
def load_user():
    g.user = None
    if "uid" in session:
        g.user = db.session.get(User, session["uid"])
        if g.user is None:
            session.pop("uid", None)
    if "csrf" not in session:
        session["csrf"] = secrets.token_urlsafe(24)
    if request.method == "POST":
        sent = request.form.get("csrf") or request.headers.get("X-CSRF-Token")
        if not sent or not hmac.compare_digest(sent, session["csrf"]):
            abort(400, "La página expiró. Recarga e intenta otra vez.")
    if request.endpoint not in PUBLIC_ENDPOINTS and g.user is None:
        return redirect(url_for("login", next=request.full_path))


@app.after_request
def security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "same-origin")
    return resp


@app.context_processor
def inject_globals():
    ctx = {
        "group_name": GROUP_NAME,
        "csrf_token": session.get("csrf", ""),
        "EVENT_KINDS": EVENT_KINDS,
        "RESOURCE_CATEGORIES": RESOURCE_CATEGORIES,
        "max_upload_mb": MAX_UPLOAD_MB,
        "now": now_local(),
    }
    if g.get("user"):
        alarms = upcoming_alarms(ctx["now"])
        ctx["urgent_count"] = sum(1 for e in alarms if e.status(ctx["now"]) in ("vencido", "hoy", "pronto"))
    return ctx


@app.errorhandler(413)
def too_large(_):
    flash(f"El archivo pesa más de {MAX_UPLOAD_MB} MB. Súbelo a Drive y comparte el link.", "error")
    return redirect(url_for("resources"))


@app.errorhandler(400)
def bad_request(e):
    return render_template("error.html", message=e.description), 400


@app.errorhandler(404)
def not_found(_):
    return render_template("error.html", message="No encontramos eso."), 404


# ---------------------------------------------------------------- cuentas

@app.route("/healthz")
def health():
    return "ok"


@app.route("/entrar", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, request.form.get("password", "")):
            session.clear()
            session.permanent = True
            session["uid"] = user.id
            session["csrf"] = secrets.token_urlsafe(24)
            nxt = request.args.get("next", "")
            return redirect(nxt if nxt.startswith("/") and not nxt.startswith("//") else url_for("dashboard"))
        flash("Usuario o contraseña incorrectos.", "error")
    return render_template("login.html", has_users=User.query.count() > 0)


@app.route("/registro", methods=["GET", "POST"])
def register():
    form = request.form
    if request.method == "POST":
        username = form.get("username", "").strip().lower()
        errors = []
        if not hmac.compare_digest(form.get("group_code", "").strip(), GROUP_CODE):
            errors.append("El código del grupo no es correcto. Pídeselo a quien montó la app.")
        if not username.replace("_", "").replace(".", "").isalnum() or len(username) < 3:
            errors.append("El usuario debe tener al menos 3 letras o números (sin espacios).")
        elif User.query.filter_by(username=username).first():
            errors.append("Ese usuario ya existe.")
        if len(form.get("password", "")) < 6:
            errors.append("La contraseña debe tener al menos 6 caracteres.")
        if not form.get("name", "").strip():
            errors.append("Escribe tu nombre.")
        if errors:
            for e in errors:
                flash(e, "error")
        else:
            user = User(username=username, name=form["name"].strip(),
                        password_hash=generate_password_hash(form["password"]),
                        email=form.get("email", "").strip(),
                        whatsapp=form.get("whatsapp", "").strip())
            db.session.add(user)
            db.session.commit()
            session.clear()
            session.permanent = True
            session["uid"] = user.id
            flash(f"¡Bienvenido/a, {user.first_name}! Completa tu perfil para que el grupo te pueda contactar.", "ok")
            return redirect(url_for("profile"))
    return render_template("register.html", form=form)


@app.route("/salir", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------------------------------------------------------------- inicio

@app.route("/")
def dashboard():
    now = now_local()
    alarms = upcoming_alarms(now)
    today = now.date()
    birthdays = []
    for u in User.query.filter(User.birthday.isnot(None)).all():
        nb = next_birthday(u.birthday, today)
        if (nb - today).days <= 14:
            birthdays.append((nb, u))
    birthdays.sort(key=lambda x: x[0])
    later = (Event.query.filter(Event.done.is_(False), Event.due > now + timedelta(days=7))
             .order_by(Event.due).limit(5).all())
    pinned = Comment.query.filter_by(event_id=None, pinned=True).order_by(Comment.created_at.desc()).all()
    recent_posts = (Comment.query.filter_by(event_id=None, pinned=False)
                    .order_by(Comment.created_at.desc()).limit(4).all())
    recent_resources = Resource.query.order_by(Resource.created_at.desc()).limit(5).all()
    return render_template("dashboard.html", alarms=alarms, later=later, birthdays=birthdays,
                           today=today, pinned=pinned, recent_posts=recent_posts,
                           recent_resources=recent_resources)


@app.route("/api/alarmas")
def api_alarms():
    """Lo usa el navegador para lanzar notificaciones mientras la app está abierta."""
    now = now_local()
    return jsonify([
        {"id": e.id, "title": e.title, "kind": e.kind_label, "status": e.status(now),
         "due": e.due.isoformat(), "when": format_dt(e.due), "rel": relative(e.due, now),
         "minutes": int((e.due - now).total_seconds() // 60),
         "url": url_for("event_detail", event_id=e.id)}
        for e in upcoming_alarms(now)
    ])


# ---------------------------------------------------------------- fechas

@app.route("/fechas")
def events():
    show = request.args.get("ver", "pendientes")
    q = Event.query
    if show == "pendientes":
        q = q.filter(Event.done.is_(False)).order_by(Event.due)
    elif show == "pasadas":
        q = q.filter((Event.done.is_(True)) | (Event.due < now_local())).order_by(Event.due.desc())
    else:
        q = q.order_by(Event.due.desc())
    kind = request.args.get("tipo")
    if kind in EVENT_KINDS:
        q = q.filter(Event.kind == kind)
    return render_template("events.html", events=q.all(), show=show, kind=kind)


@app.route("/fechas/nueva", methods=["GET", "POST"])
@app.route("/fechas/<int:event_id>/editar", methods=["GET", "POST"])
def event_form(event_id=None):
    ev = db.get_or_404(Event, event_id) if event_id else None
    if request.method == "POST":
        due = parse_due(request.form)
        title = request.form.get("title", "").strip()
        if not title or not due:
            flash("Pon al menos un título y la fecha con hora.", "error")
        else:
            if ev is None:
                ev = Event(created_by=g.user)
                db.session.add(ev)
            ev.title = title
            ev.kind = request.form.get("kind") if request.form.get("kind") in EVENT_KINDS else "otro"
            ev.subject = request.form.get("subject", "").strip()
            ev.description = request.form.get("description", "").strip()
            ev.link = clean_url(request.form.get("link"))
            ev.due = due
            db.session.commit()
            flash("Fecha guardada. Todo el grupo ya la ve.", "ok")
            return redirect(url_for("event_detail", event_id=ev.id))
    default_due = (now_local() + timedelta(days=7)).replace(hour=23, minute=59)
    return render_template("event_form.html", ev=ev, form=request.form,
                           default_due=default_due.strftime("%Y-%m-%dT%H:%M"),
                           subjects=known_subjects())


@app.route("/fechas/<int:event_id>")
def event_detail(event_id):
    ev = db.get_or_404(Event, event_id)
    return render_template("event_detail.html", ev=ev)


@app.route("/fechas/<int:event_id>/listo", methods=["POST"])
def event_toggle(event_id):
    ev = db.get_or_404(Event, event_id)
    ev.done = not ev.done
    db.session.commit()
    flash("Marcada como lista ✔" if ev.done else "Marcada como pendiente otra vez.", "ok")
    return redirect(request.form.get("back") or url_for("event_detail", event_id=ev.id))


@app.route("/fechas/<int:event_id>/borrar", methods=["POST"])
def event_delete(event_id):
    ev = db.get_or_404(Event, event_id)
    db.session.delete(ev)
    db.session.commit()
    flash("Fecha borrada.", "ok")
    return redirect(url_for("events"))


@app.route("/fechas/<int:event_id>/comentar", methods=["POST"])
def event_comment(event_id):
    ev = db.get_or_404(Event, event_id)
    body = request.form.get("body", "").strip()
    if body:
        db.session.add(Comment(body=body, event=ev, author=g.user))
        db.session.commit()
    return redirect(url_for("event_detail", event_id=ev.id) + "#comentarios")


@app.route("/calendario")
def calendar_view():
    today = now_local().date()
    try:
        year = int(request.args.get("y", today.year))
        month = int(request.args.get("m", today.month))
        first = date(year, month, 1)
    except ValueError:
        first = today.replace(day=1)
    weeks = cal.Calendar(firstweekday=0).monthdatescalendar(first.year, first.month)
    start = datetime.combine(weeks[0][0], datetime.min.time())
    end = datetime.combine(weeks[-1][-1], datetime.max.time())
    by_day = {}
    for ev in Event.query.filter(Event.due >= start, Event.due <= end).order_by(Event.due):
        by_day.setdefault(ev.due.date(), []).append(ev)
    prev_m = (first - timedelta(days=1)).replace(day=1)
    next_m = (first + timedelta(days=32)).replace(day=1)
    feed = url_for("calendar_feed", token=calendar_token(), _external=True)
    return render_template("calendar.html", weeks=weeks, first=first, by_day=by_day,
                           today=today, prev_m=prev_m, next_m=next_m,
                           month_name=MONTHS[first.month - 1], feed_url=feed,
                           day_names=DAYS)


def ics_escape(text):
    return (text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


@app.route("/calendario/<token>.ics")
def calendar_feed(token):
    """Feed para suscribirse desde Google Calendar, Outlook o el celular."""
    if not hmac.compare_digest(token, calendar_token()):
        abort(404)
    fmt = "%Y%m%dT%H%M%SZ"
    stamp = datetime.now(timezone.utc).strftime(fmt)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//grupo-cun//ES",
             "CALSCALE:GREGORIAN", "METHOD:PUBLISH", f"X-WR-CALNAME:{ics_escape(GROUP_NAME)}"]
    for ev in Event.query.order_by(Event.due).all():
        start = ev.due.replace(tzinfo=LOCAL_TZ).astimezone(timezone.utc)
        desc = ev.description or ""
        if ev.link:
            desc += ("\n\n" if desc else "") + ev.link
        lines += [
            "BEGIN:VEVENT",
            f"UID:evento-{ev.id}@grupo-cun",
            f"DTSTAMP:{stamp}",
            f"DTSTART:{start.strftime(fmt)}",
            f"DTEND:{(start + timedelta(hours=1)).strftime(fmt)}",
            f"SUMMARY:{ics_escape(('✔ ' if ev.done else '') + ev.kind_label + ': ' + ev.title)}",
            f"DESCRIPTION:{ics_escape(desc)}",
            "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D",
            f"DESCRIPTION:{ics_escape('Mañana: ' + ev.title)}", "END:VALARM",
            "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT2H",
            f"DESCRIPTION:{ics_escape('En 2 horas: ' + ev.title)}", "END:VALARM",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    body = "\r\n".join(lines) + "\r\n"
    return app.response_class(body, mimetype="text/calendar; charset=utf-8")


def known_subjects():
    rows = db.session.query(Event.subject).distinct().all() + db.session.query(Resource.subject).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


# ---------------------------------------------------------------- archivos y links

@app.route("/archivos")
def resources():
    q = Resource.query
    cat = request.args.get("cat")
    if cat in RESOURCE_CATEGORIES:
        q = q.filter(Resource.category == cat)
    kind = request.args.get("tipo")
    if kind in ("archivo", "link"):
        q = q.filter(Resource.kind == kind)
    subject = request.args.get("materia", "")
    if subject:
        q = q.filter(Resource.subject == subject)
    text = request.args.get("q", "").strip()
    if text:
        like = f"%{text}%"
        q = q.filter(Resource.title.ilike(like) | Resource.description.ilike(like) | Resource.filename.ilike(like))
    return render_template("resources.html", items=q.order_by(Resource.created_at.desc()).all(),
                           cat=cat, kind=kind, subject=subject, text=text, subjects=known_subjects())


@app.route("/archivos/subir", methods=["POST"])
def resource_upload():
    f = request.files.get("file")
    kind = "archivo" if f and f.filename else "link"
    url = clean_url(request.form.get("url"))
    if kind == "link" and not url:
        flash("Elige un archivo o pega un link.", "error")
        return redirect(url_for("resources"))
    title = request.form.get("title", "").strip()
    category = request.form.get("category")
    res = Resource(kind=kind, created_by=g.user,
                   category=category if category in RESOURCE_CATEGORIES else "otro",
                   subject=request.form.get("subject", "").strip(),
                   description=request.form.get("description", "").strip())
    if kind == "archivo":
        data = f.read()
        res.filename = os.path.basename(f.filename)[:255]
        res.mimetype = f.mimetype or mimetypes.guess_type(res.filename)[0] or "application/octet-stream"
        res.size = len(data)
        res.data = data
        res.title = title or res.filename
    else:
        res.url = url
        res.title = title or url
    db.session.add(res)
    db.session.commit()
    flash("Listo, ya está en la biblioteca del grupo.", "ok")
    return redirect(url_for("resources"))


@app.route("/archivos/<int:res_id>/<path:name>")
@app.route("/archivos/<int:res_id>")
def resource_download(res_id, name=None):
    res = db.get_or_404(Resource, res_id)
    if res.kind == "link":
        return redirect(res.url)
    inline = res.mimetype in INLINE_MIMETYPES and request.args.get("descargar") is None
    return send_file(BytesIO(res.data or b""), mimetype=res.mimetype,
                     as_attachment=not inline, download_name=res.filename)


@app.route("/archivos/<int:res_id>/borrar", methods=["POST"])
def resource_delete(res_id):
    res = db.get_or_404(Resource, res_id)
    db.session.delete(res)
    db.session.commit()
    flash("Eliminado.", "ok")
    return redirect(url_for("resources"))


# ---------------------------------------------------------------- muro

@app.route("/muro", methods=["GET", "POST"])
def wall():
    if request.method == "POST":
        body = request.form.get("body", "").strip()
        if body:
            db.session.add(Comment(body=body, author=g.user, pinned=bool(request.form.get("pinned"))))
            db.session.commit()
        return redirect(url_for("wall"))
    posts = (Comment.query.filter_by(event_id=None)
             .order_by(Comment.pinned.desc(), Comment.created_at.desc()).limit(200).all())
    return render_template("wall.html", posts=posts)


@app.route("/comentarios/<int:cid>/fijar", methods=["POST"])
def comment_pin(cid):
    c = db.get_or_404(Comment, cid)
    c.pinned = not c.pinned
    db.session.commit()
    return redirect(request.form.get("back") or url_for("wall"))


@app.route("/comentarios/<int:cid>/borrar", methods=["POST"])
def comment_delete(cid):
    c = db.get_or_404(Comment, cid)
    if c.author_id != g.user.id:
        abort(403)
    back = url_for("event_detail", event_id=c.event_id) + "#comentarios" if c.event_id else url_for("wall")
    db.session.delete(c)
    db.session.commit()
    return redirect(back)


# ---------------------------------------------------------------- integrantes

@app.route("/integrantes")
def members():
    return render_template("members.html", users=User.query.order_by(User.name).all())


@app.route("/perfil", methods=["GET", "POST"])
def profile():
    u = g.user
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        if name:
            u.name = name
        for field in ("email", "phone", "whatsapp", "about"):
            setattr(u, field, request.form.get(field, "").strip())
        raw_bday = request.form.get("birthday", "").strip()
        try:
            u.birthday = date.fromisoformat(raw_bday) if raw_bday else None
        except ValueError:
            flash("La fecha de cumpleaños no es válida.", "error")
        new_pw = request.form.get("new_password", "")
        if new_pw:
            if not check_password_hash(u.password_hash, request.form.get("current_password", "")):
                flash("La contraseña actual no coincide; no se cambió.", "error")
            elif len(new_pw) < 6:
                flash("La nueva contraseña debe tener al menos 6 caracteres.", "error")
            else:
                u.password_hash = generate_password_hash(new_pw)
                flash("Contraseña cambiada.", "ok")
        db.session.commit()
        flash("Perfil guardado.", "ok")
        return redirect(url_for("profile"))
    return render_template("profile.html", u=u)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=bool(os.environ.get("DEBUG")))

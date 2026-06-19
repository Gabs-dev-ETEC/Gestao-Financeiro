from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from flask import send_file
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import io
import json
import os
import threading
import queue
from datetime import date
from sqlalchemy import text
from dotenv import load_dotenv

# ==============================
# CONFIGURAÇÃO APP
# ==============================

load_dotenv()
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "chave-secreta-local")

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///financeiro.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "home"

# ==============================
# SSE — BROADCAST PARA CLIENTES
# ==============================

_sse_listeners = []
_sse_lock = threading.Lock()

def _broadcast(msg: str):
    """Grita para todos os clientes SSE conectados."""
    dead = []
    with _sse_lock:
        for q in _sse_listeners:
            try:
                q.put_nowait(msg)
            except queue.Full:
                dead.append(q)
        for q in dead:
            _sse_listeners.remove(q)

# ==============================
# MODEL USUÁRIO
# ==============================

class Usuario(UserMixin, db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    tipo          = db.Column(db.String(20), nullable=False)

    def get_id(self):
        return str(self.id)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


@login_manager.user_loader
def load_user(user_id):
    return Usuario.query.filter_by(id=user_id).first()


# ==============================
# TABELA COLABORADORES
# ==============================

class Colaborador(db.Model):
    id     = db.Column(db.Integer, primary_key=True)
    nome   = db.Column(db.String(100))
    cpf    = db.Column(db.String(20))
    numero = db.Column(db.String(20))
    cargo  = db.Column(db.String(50))
    pix    = db.Column(db.String(200))
    ativo  = db.Column(db.Boolean, default=True)
    fichas = db.relationship("Ficha", backref="colaborador")


class Ficha(db.Model):
    id               = db.Column(db.Integer, primary_key=True)
    colaborador_id   = db.Column(db.Integer, db.ForeignKey("colaborador.id"))
    nome_ficha       = db.Column(db.String(50))
    tipo             = db.Column(db.String(20))
    conteudo         = db.Column(db.Text)
    secao            = db.Column(db.String(100))
    alterado_por     = db.Column(db.String(100))
    ultima_alteracao = db.Column(db.DateTime, default=datetime.utcnow)
    pago             = db.Column(db.Integer, default=0)

# ==============================
# TABELA CATEGORIA
# ==============================

class Categoria(db.Model):
    id   = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    cor  = db.Column(db.String(20), default="#1e4d8c")

    def to_dict(self):
        return {"id": self.id, "nome": self.nome, "cor": self.cor}



# ==============================
# CAMPOS DAS FICHAS (espelho do JS)
# ==============================

CAMPOS_NORMAL = [
    {"key": "mes_ref",           "label": "Mês de Referência",       "desconta": False, "soValor": False, "soCaixa": False, "sosBruto": False},
    {"key": "caixa",             "label": "Caixa",                   "desconta": False, "soValor": True,  "soCaixa": True,  "sosBruto": False},
    {"key": "valores_recebidos", "label": "Salário",                 "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "clt",               "label": "CLT",                     "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "gratificacao",      "label": "Gratificação",            "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "meta",              "label": "Meta",                    "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "vt_pago",           "label": "Vale Transporte (pago)",  "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "vt_desconto",       "label": "Desconto VT",             "desconta": True,  "soValor": True,  "soCaixa": False, "sosBruto": False},
    {"key": "va_pago",           "label": "Vale Alimentação (pago)", "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "va_desconto",       "label": "Desconto VA",             "desconta": True,  "soValor": True,  "soCaixa": False, "sosBruto": False},
    {"key": "adiantamento",      "label": "Adiantamento",            "desconta": True,  "soValor": True,  "soCaixa": False, "sosBruto": False},
]

CAMPOS_META = [
    {"key": "fez_mes_passado",   "label": "Fez mês passado",    "desconta": False, "soValor": True,  "soCaixa": True,  "sosBruto": False},
    {"key": "caixa_mes",         "label": "Caixa deste mês",    "desconta": False, "soValor": True,  "soCaixa": True,  "sosBruto": False},
    {"key": "clt",               "label": "CLT",                "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "gratificacao",      "label": "Gratificação",       "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "metas_recebidas",   "label": "Metas recebidas",    "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "total_metas",       "label": "Total metas",        "desconta": False, "soValor": True,  "soCaixa": False, "sosBruto": True },
    {"key": "adiantamento",      "label": "Adiantamento",       "desconta": True,  "soValor": True,  "soCaixa": False, "sosBruto": False},
]

def get_campos(tipo):
    return CAMPOS_NORMAL if tipo == "normal" else CAMPOS_META

def fmt_moeda(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "—"
    return "R$ {:,.2f}".format(v).replace(",", "X").replace(".", ",").replace("X", ".")

def parse_moeda(s):
    if not s:
        return 0.0
    try:
        return float(str(s).replace("R$", "").replace(" ", "").replace(".", "").replace(",", "."))
    except ValueError:
        return 0.0


CATEGORIAS_PADRAO = [
    {"nome": "Com juros",       "cor": "#c0392b"},
    {"nome": "Colaboradores",   "cor": "#1e4d8c"},
    {"nome": "Recorrentes",     "cor": "#1a7a4a"},
    {"nome": "Vagas",           "cor": "#8e44ad"},
    {"nome": "Contas pessoais", "cor": "#e67e22"},
    {"nome": "Outros",          "cor": "#5a6a85"},
]


# ==============================
# ROTA MANIFEST PWA
# ==============================

@app.route("/manifest.json")
def manifest():
    return send_file("manifest.json", mimetype="application/manifest+json")


# ==============================
# ROTA SSE
# ==============================

@app.route("/api/eventos")
@login_required
def sse_eventos():
    def stream():
        q = queue.Queue(maxsize=10)
        with _sse_lock:
            _sse_listeners.append(q)
        try:
            yield "data: conectado\n\n"
            while True:
                try:
                    msg = q.get(timeout=25)
                    yield f"data: {msg}\n\n"
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            with _sse_lock:
                try:
                    _sse_listeners.remove(q)
                except ValueError:
                    pass

    return app.response_class(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ==============================
# ROTAS CATEGORIAS
# ==============================

@app.route("/api/categorias", methods=["GET"])
@login_required
def listar_categorias():
    return jsonify([c.to_dict() for c in Categoria.query.order_by(Categoria.id).all()])


@app.route("/api/categorias", methods=["POST"])
@login_required
def criar_categoria():
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    data = request.json
    nome = (data.get("nome") or "").strip()
    if not nome:
        return jsonify({"erro": "Nome obrigatório"}), 400
    if Categoria.query.filter_by(nome=nome).first():
        return jsonify({"erro": "Categoria já existe"}), 409
    nova = Categoria(nome=nome, cor=data.get("cor", "#1e4d8c"))
    db.session.add(nova)
    db.session.commit()
    _broadcast("atualizar")
    return jsonify(nova.to_dict()), 201


@app.route("/api/categorias/<int:id>", methods=["DELETE"])
@login_required
def deletar_categoria(id):
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    cat = Categoria.query.get(id)
    if not cat:
        return jsonify({"erro": "Não encontrada"}), 404
    db.session.delete(cat)
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"ok": True})


# ==============================
# ROTAS COLABORADORES
# ==============================

@app.route("/api/colaboradores", methods=["POST"])
@login_required
def criar_colaborador():
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    data = request.json
    cpf  = "".join(filter(str.isdigit, data["cpf"]))[:11]
    cpf_fmt = f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:11]}"
    novo = Colaborador(
        nome=data["nome"],
        cpf=cpf_fmt,
        numero=data["numero"],
        cargo=data["cargo"],
        pix=data.get("pix", "")
    )
    db.session.add(novo)
    db.session.commit()
    _broadcast("atualizar")
    return {"status": "ok"}


@app.route("/api/colaboradores")
@login_required
def listar_colaboradores():
    return jsonify([{
        "id": c.id, "nome": c.nome, "cpf": c.cpf,
        "numero": c.numero, "cargo": c.cargo,
        "pix": c.pix or "",
        "ativo": c.ativo
    } for c in Colaborador.query.all()])


@app.route("/api/colaboradores/<int:id>/status", methods=["PUT"])
@login_required
def alterar_status_colaborador(id):
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    c = Colaborador.query.get(id)
    if not c:
        return {"erro": "Não encontrado"}, 404
    c.ativo = not c.ativo
    db.session.commit()
    _broadcast("atualizar")
    return {"ok": True}


@app.route("/api/colaboradores/<int:id>", methods=["DELETE"])
@login_required
def deletar_colaborador(id):
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    c = Colaborador.query.get(id)
    if not c:
        return {"erro": "Não encontrado"}, 404
    Ficha.query.filter_by(colaborador_id=id).delete()
    db.session.delete(c)
    db.session.commit()
    _broadcast("atualizar")
    return {"ok": True}


# ==============================
# ROTAS FICHAS
# ==============================

@app.route("/api/fichas", methods=["POST"])
@login_required
def criar_ficha():
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    data  = request.json
    ficha = Ficha(
        colaborador_id=data.get("colaborador_id"),
        nome_ficha=data.get("nome_ficha"),
        tipo=data.get("tipo"),
        conteudo=data.get("conteudo"),
        secao=data.get("secao") or "Geral",
        alterado_por=current_user.username,
        ultima_alteracao=datetime.now()
    )
    db.session.add(ficha)
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"ok": True, "id": ficha.id})


@app.route("/api/fichas/<int:colaborador_id>")
@login_required
def listar_fichas(colaborador_id):
    fichas = Ficha.query.filter_by(colaborador_id=colaborador_id).all()
    return jsonify([{
        "id": f.id,
        "nome_ficha": f.nome_ficha,
        "tipo": f.tipo,
        "conteudo": f.conteudo,
        "secao": f.secao or "Geral",
        "pago": f.pago or 0,
        "alteradoPor": f.alterado_por or "",
        "ultimaAlteracao": f.ultima_alteracao.strftime("%Y-%m-%d %H:%M:%S") if f.ultima_alteracao else ""
    } for f in fichas])


@app.route("/api/fichas/<int:id>", methods=["DELETE"])
@login_required
def deletar_ficha(id):
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    ficha = Ficha.query.get(id)
    if not ficha:
        return {"erro": "Não encontrada"}, 404
    db.session.delete(ficha)
    db.session.commit()
    _broadcast("atualizar")
    return {"ok": True}


# ==============================
# GERAR PDF DA FICHA
# ==============================

@app.route("/api/fichas/pdf/<int:id>")
@login_required
def gerar_pdf_ficha(id):

    ficha = Ficha.query.get(id)
    if not ficha:
        return {"erro": "Ficha não encontrada"}, 404

    colaborador = Colaborador.query.get(ficha.colaborador_id)

    try:
        conteudo = json.loads(ficha.conteudo)
        if not isinstance(conteudo, dict):
            conteudo = {}
    except (TypeError, ValueError):
        conteudo = {}

    campos   = get_campos(ficha.tipo)
    riscados = conteudo.get("__riscados__", {})
    extras   = conteudo.get("__outros__",   [])

    caixa = bruto = descontos = 0.0
    for c in campos:
        if not c["soValor"]:
            continue
        if riscados.get(c["key"]):
            continue
        v = parse_moeda(conteudo.get(c["key"], "0"))
        if   c["soCaixa"]:          caixa     += v
        elif c["desconta"]:         descontos += v
        elif c.get("sosBruto"):     bruto     += v

    for ex in extras:
        if ex.get("riscado"):
            continue
        descontos += parse_moeda(ex.get("valor", "0"))

    liquido = bruto - descontos

    buffer = io.BytesIO()
    pdf    = canvas.Canvas(buffer, pagesize=A4)
    W, H   = A4

    AZUL_ESCURO = (0.05, 0.13, 0.25)
    AZUL_MEDIO  = (0.10, 0.23, 0.42)
    LARANJA     = (0.96, 0.48, 0.13)
    BRANCO      = (1,    1,    1   )
    CINZA_CLARO = (0.95, 0.96, 0.98)
    CINZA_TEXTO = (0.35, 0.42, 0.52)
    PRETO_SUAVE = (0.10, 0.15, 0.25)
    VERDE       = (0.05, 0.44, 0.25)
    VERMELHO    = (0.70, 0.12, 0.10)

    def rect_fill(x, y, w, h, rgb):
        pdf.setFillColorRGB(*rgb)
        pdf.rect(x, y, w, h, stroke=0, fill=1)

    HEADER_H = 110
    rect_fill(0, H - HEADER_H, W, HEADER_H, AZUL_ESCURO)
    rect_fill(0, H - 6, W, 6, LARANJA)
    rect_fill(0, H - HEADER_H, W, 3, LARANJA)

    from reportlab.lib.utils import ImageReader
    logo_path = os.path.join(app.root_path, "static", "img", "desenho.png")
    logo_x, logo_y, logo_size = 42, H - HEADER_H + 22, 56
    if os.path.exists(logo_path):
        pdf.drawImage(ImageReader(logo_path), logo_x, logo_y,
                      width=logo_size, height=logo_size, mask="auto")

    pdf.setFillColorRGB(*BRANCO)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(logo_x + logo_size + 14, H - HEADER_H + 62, "ETEC Cursos")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColorRGB(0.7, 0.78, 0.88)
    pdf.drawString(logo_x + logo_size + 15, H - HEADER_H + 46,
                   "Centro de Qualificação Profissional")

    tipo_label = "FICHA PADRÃO" if ficha.tipo == "normal" else "FICHA DE METAS"
    badge_w = 120
    rect_fill(W - badge_w - 36, H - HEADER_H + 46, badge_w, 22, LARANJA)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.setFillColorRGB(*BRANCO)
    pdf.drawCentredString(W - badge_w / 2 - 36, H - HEADER_H + 54, tipo_label)

    data_hoje = date.today().strftime("%d/%m/%Y")
    pdf.setFont("Helvetica", 8)
    pdf.setFillColorRGB(0.6, 0.70, 0.82)
    pdf.drawRightString(W - 36, H - HEADER_H + 28, f"Emitido em {data_hoje}")

    y = H - HEADER_H - 30
    pdf.setFont("Helvetica-Bold", 20)
    pdf.setFillColorRGB(*AZUL_ESCURO)
    pdf.drawString(42, y, (ficha.nome_ficha or "SEM NOME").upper())
    pdf.setStrokeColorRGB(*LARANJA)
    pdf.setLineWidth(2.5)
    pdf.line(42, y - 6, W - 42, y - 6)

    y -= 30
    CARD_H = 74
    rect_fill(36, y - CARD_H, W - 72, CARD_H, CINZA_CLARO)
    rect_fill(36, y - CARD_H, 4, CARD_H, LARANJA)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.setFillColorRGB(*CINZA_TEXTO)
    pdf.drawString(50, y - 14, "COLABORADOR")
    pdf.setFont("Helvetica-Bold", 14)
    pdf.setFillColorRGB(*AZUL_ESCURO)
    pdf.drawString(50, y - 30, colaborador.nome)
    pdf.setFont("Helvetica", 9)
    pdf.setFillColorRGB(*CINZA_TEXTO)
    pdf.drawString(50, y - 46,
                   f"CPF: {colaborador.cpf}   •   Tel: {colaborador.numero}"
                   f"   •   Cargo: {colaborador.cargo.title()}")
    if colaborador.pix:
        pdf.setFont("Helvetica", 9)
        pdf.setFillColorRGB(*CINZA_TEXTO)
        pdf.drawString(50, y - 60, f"PIX: {colaborador.pix}")

    y -= CARD_H + 16

    RESUMO_H = 52
    terca    = (W - 72 - 16) / 3

    rect_fill(36, y - RESUMO_H, terca, RESUMO_H, (0.94, 0.96, 1.0))
    rect_fill(36, y - RESUMO_H, 4, RESUMO_H, AZUL_MEDIO)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.setFillColorRGB(*CINZA_TEXTO)
    pdf.drawString(50, y - 14, "CAIXA GERADO")
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColorRGB(*AZUL_ESCURO)
    pdf.drawString(50, y - 32, fmt_moeda(caixa))

    cx2 = 36 + terca + 8
    rect_fill(cx2, y - RESUMO_H, terca, RESUMO_H, (0.93, 0.95, 1.0))
    rect_fill(cx2, y - RESUMO_H, 4, RESUMO_H, AZUL_MEDIO)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.setFillColorRGB(*CINZA_TEXTO)
    pdf.drawString(cx2 + 14, y - 14, "SALÁRIO BRUTO")
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColorRGB(*AZUL_ESCURO)
    pdf.drawString(cx2 + 14, y - 32, fmt_moeda(bruto))

    cx3     = cx2 + terca + 8
    cor_liq = VERDE if liquido >= 0 else VERMELHO
    rect_fill(cx3, y - RESUMO_H, terca, RESUMO_H,
              (0.94, 1.0, 0.96) if liquido >= 0 else (1.0, 0.95, 0.95))
    rect_fill(cx3, y - RESUMO_H, 4, RESUMO_H, cor_liq)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.setFillColorRGB(*CINZA_TEXTO)
    pdf.drawString(cx3 + 14, y - 14, "SALÁRIO LÍQUIDO")
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColorRGB(*cor_liq)
    pdf.drawString(cx3 + 14, y - 32, fmt_moeda(liquido))

    y -= RESUMO_H + 18
    LINHA_H  = 34
    MARGIN_X = 36
    TABLE_W  = W - 72

    rect_fill(MARGIN_X, y - 20, TABLE_W, 20, AZUL_ESCURO)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.setFillColorRGB(*LARANJA)
    pdf.drawString(MARGIN_X + 10, y - 13, "DESCRIÇÃO")
    pdf.setFillColorRGB(*BRANCO)
    pdf.drawRightString(MARGIN_X + TABLE_W - 10, y - 13, "VALOR")
    y -= 20

    for i, campo in enumerate(campos):
        raw_val  = conteudo.get(campo["key"], "")
        is_last  = (i == len(campos) - 1) and not extras
        is_even  = (i % 2 == 0)
        riscado  = riscados.get(campo["key"], False)

        bg = CINZA_CLARO if is_even else BRANCO
        rect_fill(MARGIN_X, y - LINHA_H, TABLE_W, LINHA_H, bg)

        if   campo["soCaixa"]:  cor_borda = AZUL_MEDIO
        elif campo["desconta"]: cor_borda = VERMELHO
        else:                   cor_borda = (0.10, 0.55, 0.30)
        rect_fill(MARGIN_X, y - LINHA_H, 3, LINHA_H, cor_borda)

        label_txt = campo["label"]
        pdf.setFont("Helvetica-Bold", 9)
        pdf.setFillColorRGB(*(CINZA_TEXTO if riscado else PRETO_SUAVE))
        pdf.drawString(MARGIN_X + 12, y - LINHA_H + 13, label_txt)
        if riscado:
            pdf.setStrokeColorRGB(*CINZA_TEXTO)
            pdf.setLineWidth(0.8)
            tx = MARGIN_X + 12
            ty = y - LINHA_H + 13 + 3
            pdf.line(tx, ty, tx + pdf.stringWidth(label_txt, "Helvetica-Bold", 9), ty)

        if campo["soValor"]:
            v_str   = fmt_moeda(parse_moeda(raw_val)) if raw_val else "—"
            cor_val = VERMELHO if campo["desconta"] else PRETO_SUAVE
        else:
            v_str   = raw_val if raw_val else "—"
            cor_val = CINZA_TEXTO

        if riscado:
            cor_val = CINZA_TEXTO
        pdf.setFont("Helvetica", 10)
        pdf.setFillColorRGB(*cor_val)
        pdf.drawRightString(MARGIN_X + TABLE_W - 10, y - LINHA_H + 13, v_str)
        if riscado:
            pdf.setStrokeColorRGB(*CINZA_TEXTO)
            pdf.setLineWidth(0.8)
            vx = MARGIN_X + TABLE_W - 10 - pdf.stringWidth(v_str, "Helvetica", 10)
            vy = y - LINHA_H + 13 + 3
            pdf.line(vx, vy, MARGIN_X + TABLE_W - 10, vy)

        if not is_last:
            pdf.setStrokeColorRGB(0.88, 0.90, 0.93)
            pdf.setLineWidth(0.4)
            pdf.line(MARGIN_X, y - LINHA_H, MARGIN_X + TABLE_W, y - LINHA_H)

        y -= LINHA_H

    if extras:
        y -= 6
        rect_fill(MARGIN_X, y - 18, TABLE_W, 18, AZUL_MEDIO)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColorRGB(*LARANJA)
        pdf.drawString(MARGIN_X + 10, y - 12, "OUTROS")
        pdf.setFillColorRGB(*BRANCO)
        pdf.drawRightString(MARGIN_X + TABLE_W - 10, y - 12, "VALOR")
        y -= 18

        for j, ex in enumerate(extras):
            label   = ex.get("label", "") or "—"
            valor   = ex.get("valor", "") or ""
            riscado = ex.get("riscado", False)
            is_last_ex = (j == len(extras) - 1)
            is_even = (j % 2 == 0)

            bg = CINZA_CLARO if is_even else BRANCO
            rect_fill(MARGIN_X, y - LINHA_H, TABLE_W, LINHA_H, bg)
            rect_fill(MARGIN_X, y - LINHA_H, 3, LINHA_H, VERMELHO)

            pdf.setFont("Helvetica-Bold", 9)
            pdf.setFillColorRGB(*(CINZA_TEXTO if riscado else PRETO_SUAVE))
            pdf.drawString(MARGIN_X + 12, y - LINHA_H + 13, label)
            if riscado:
                pdf.setStrokeColorRGB(*CINZA_TEXTO)
                pdf.setLineWidth(0.8)
                tx = MARGIN_X + 12
                ty = y - LINHA_H + 13 + 3
                pdf.line(tx, ty, tx + pdf.stringWidth(label, "Helvetica-Bold", 9), ty)

            v_str = fmt_moeda(parse_moeda(valor)) if valor else "—"
            pdf.setFont("Helvetica", 10)
            pdf.setFillColorRGB(*(CINZA_TEXTO if riscado else VERMELHO))
            pdf.drawRightString(MARGIN_X + TABLE_W - 10, y - LINHA_H + 13, v_str)
            if riscado:
                pdf.setStrokeColorRGB(*CINZA_TEXTO)
                pdf.setLineWidth(0.8)
                vx = MARGIN_X + TABLE_W - 10 - pdf.stringWidth(v_str, "Helvetica", 10)
                vy = y - LINHA_H + 13 + 3
                pdf.line(vx, vy, MARGIN_X + TABLE_W - 10, vy)

            if not is_last_ex:
                pdf.setStrokeColorRGB(0.88, 0.90, 0.93)
                pdf.setLineWidth(0.4)
                pdf.line(MARGIN_X, y - LINHA_H, MARGIN_X + TABLE_W, y - LINHA_H)

            y -= LINHA_H

    pdf.setStrokeColorRGB(*LARANJA)
    pdf.setLineWidth(1.5)
    pdf.line(MARGIN_X, y, MARGIN_X + TABLE_W, y)

    rect_fill(0, 0, W, 36, AZUL_ESCURO)
    rect_fill(0, 36, W, 3, LARANJA)
    pdf.setFont("Helvetica", 8)
    pdf.setFillColorRGB(0.55, 0.65, 0.78)
    pdf.drawCentredString(W / 2, 14,
        f"ETEC Cursos — Centro de Qualificação Profissional   •   Emitido em {data_hoje}")

    pdf.save()
    buffer.seek(0)

    nome_arquivo = (
        f"ficha_{colaborador.nome.replace(' ', '_')}"
        f"_{ficha.nome_ficha}.pdf"
    )
    return send_file(buffer, as_attachment=True,
                     download_name=nome_arquivo, mimetype="application/pdf")


# ==============================
# TABELA CONTA
# ==============================

class Conta(db.Model):
    id                    = db.Column(db.Integer, primary_key=True)
    categoria             = db.Column(db.String(100))
    descricao             = db.Column(db.String(200))
    valor                 = db.Column(db.Float)
    vencimento            = db.Column(db.String(20))
    metodo_pagamento_tipo = db.Column(db.String(100))
    metodo_pagamento      = db.Column(db.Text)
    observacoes           = db.Column(db.Text)
    paga                  = db.Column(db.Boolean, default=False)
    data_pagamento        = db.Column(db.DateTime)
    ultima_atualizacao    = db.Column(db.DateTime, default=datetime.utcnow)
    alterado_por          = db.Column(db.String(100))

# ==============================
# TABELA SALDO
# ==============================

class Saldo(db.Model):
    id    = db.Column(db.Integer, primary_key=True)
    valor = db.Column(db.Float, nullable=False)


class Pasta(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    colaborador_id = db.Column(db.Integer, db.ForeignKey("colaborador.id"))
    nome           = db.Column(db.String(100), nullable=False)
    criada_em      = db.Column(db.DateTime, default=datetime.utcnow)

# ==============================
# ROTAS PRINCIPAIS
# ==============================

@app.route("/")
def home():
    return render_template("login.html")

@app.route("/sistema")
@login_required
def sistema():
    return render_template("index.html", tipo=current_user.tipo)

@app.route("/colaboradores")
def colaboradores():
    return render_template("colaboradores.html")


# ==============================
# LOGIN / LOGOUT
# ==============================

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    user = Usuario.query.filter_by(username=data.get("username")).first()
    if user and user.check_password(data.get("password")):
        login_user(user)
        return jsonify({"mensagem": "Login realizado", "tipo": user.tipo})
    return jsonify({"erro": "Login inválido"}), 401

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"mensagem": "Logout realizado"})


@app.route('/setup-usuario-temp-xyz123')
def setup_usuario():
    from werkzeug.security import generate_password_hash
    usuarios = [
    ("07663696174", "07663696174", "admin"),
    ("07626243102", "07626243102", "admin"),
    ("05405469173", "05405469173", "admin"),
    ("03774249199", "03774249199", "admin"),
    ("07626249143", "07626249143", "admin"),

    ("86496824134", "86496824134", "usuario"), 
    ]
    for username, senha, tipo in usuarios:
        existe = Usuario.query.filter_by(username=username).first()
        if not existe:
            novo = Usuario(
                username=username,
                password_hash=generate_password_hash(senha),
                tipo=tipo
            )
            db.session.add(novo)
    db.session.commit()
    return 'Pronto!'


@app.route('/debug-usuarios-temp-xyz123')
def debug_usuarios():
    usuarios = Usuario.query.all()
    return jsonify([{"id": u.id, "username": u.username, "tipo": u.tipo} for u in usuarios])

# ==============================
# ROTAS CONTAS
# ==============================

@app.route("/api/contas", methods=["GET"])
@login_required
def listar_contas():
    return jsonify([{
        "id": c.id, "categoria": c.categoria, "descricao": c.descricao,
        "valor": c.valor, "vencimento": c.vencimento,
        "metodoPagamentoTipo": c.metodo_pagamento_tipo,
        "metodoPagamento": c.metodo_pagamento,
        "observacoes": c.observacoes, "paga": c.paga,
        "ultimaAtualizacao": c.ultima_atualizacao.strftime("%Y-%m-%d %H:%M:%S"),
        "alteradoPor": c.alterado_por or ""
    } for c in Conta.query.all()])


@app.route("/api/contas", methods=["POST"])
@login_required
def criar_conta():
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    data = request.json
    nova = Conta(
        categoria=data["categoria"], descricao=data["descricao"],
        valor=data["valor"], vencimento=data["vencimento"],
        metodo_pagamento_tipo=data.get("metodoPagamentoTipo"),
        metodo_pagamento=data.get("metodoPagamento"),
        observacoes=data.get("observacoes"), paga=False,
        alterado_por=current_user.username,
        ultima_atualizacao=datetime.now()
    )
    db.session.add(nova)
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"mensagem": "Conta criada"})


@app.route("/api/contas/<int:id>", methods=["PUT"])
@login_required
def atualizar_conta(id):
    conta = Conta.query.get_or_404(id)
    dados = request.json

    if current_user.tipo != "admin" and set(dados.keys()) - {"paga"}:
        return jsonify({"erro": "Acesso negado"}), 403

    if "paga" in dados:
        conta.paga = dados["paga"]
        conta.data_pagamento = datetime.now() if dados["paga"] else None

    if current_user.tipo == "admin":
        if "categoria"           in dados: conta.categoria             = dados["categoria"]
        if "descricao"           in dados: conta.descricao             = dados["descricao"]
        if "valor"               in dados: conta.valor                 = float(dados["valor"])
        if "vencimento"          in dados: conta.vencimento            = dados["vencimento"]
        if "metodoPagamentoTipo" in dados: conta.metodo_pagamento_tipo = dados["metodoPagamentoTipo"]
        if "metodoPagamento"     in dados: conta.metodo_pagamento      = dados["metodoPagamento"]
        if "observacoes"         in dados: conta.observacoes           = dados["observacoes"]

    conta.ultima_atualizacao = datetime.now()
    conta.alterado_por = current_user.username
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"mensagem": "Conta atualizada"})

@app.route("/api/contas/<int:id>", methods=["DELETE"])
@login_required
def deletar_conta(id):
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    conta = Conta.query.get_or_404(id)
    db.session.delete(conta)
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"mensagem": "Conta deletada"})


# ==============================
# HISTÓRICO
# ==============================

@app.route("/api/historico", methods=["GET"])
@login_required
def historico():
    return jsonify([{
        "id": c.id, "categoria": c.categoria, "descricao": c.descricao,
        "valor": c.valor, "vencimento": c.vencimento,
        "dataPagamento": c.data_pagamento.strftime("%Y-%m-%d %H:%M:%S") if c.data_pagamento else None
    } for c in Conta.query.filter_by(paga=True).all()])


# ==============================
# ROTAS SALDO
# ==============================

@app.route("/api/saldo", methods=["GET"])
@login_required
def pegar_saldo():
    saldo = Saldo.query.first()
    return jsonify({"valor": saldo.valor if saldo else 0})

@app.route("/api/saldo", methods=["POST"])
@login_required
def salvar_saldo():
    if current_user.tipo != "admin":
        return jsonify({"erro": "Acesso negado"}), 403
    data  = request.json
    saldo = Saldo.query.first()
    if saldo:
        saldo.valor = data["valor"]
    else:
        db.session.add(Saldo(valor=data["valor"]))
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"mensagem": "Saldo salvo"})


@app.route('/api/fichas/<int:id>/pago', methods=['PUT'])
@login_required
def marcar_ficha_paga(id):
    data = request.get_json()
    ficha = Ficha.query.get(id)
    if not ficha:
        return jsonify({"erro": "Não encontrada"}), 404
    ficha.pago = 1 if data.get('pago') else 0
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"ok": True})


@app.route('/api/dashboard/fichas')
@login_required
def dashboard_fichas():
    fichas = db.session.query(Ficha, Colaborador).join(
        Colaborador, Colaborador.id == Ficha.colaborador_id
    ).filter(Ficha.pago == 0, Colaborador.ativo == True).all()

    return jsonify([{
        "id": f.id,
        "nome_ficha": f.nome_ficha,
        "tipo": f.tipo,
        "conteudo": f.conteudo,
        "colaborador_id": f.colaborador_id,
        "colab_nome": c.nome,
        "colab_cargo": c.cargo,
        "colab_pix": c.pix or ""
    } for f, c in fichas])

# ==============================
# TIPO DO USUÁRIO LOGADO
# ==============================

@app.route("/api/me")
@login_required
def me():
    return jsonify({"tipo": current_user.tipo})


# ==============================
# INICIALIZAÇÃO
# ==============================
def migrar_banco():
    migracoes = [
        ("colaborador", "pix",              "VARCHAR(200)"),
        ("conta",       "alterado_por",     "VARCHAR(100)"),
        ("ficha",       "alterado_por",     "VARCHAR(100)"),
        ("ficha",       "ultima_alteracao", "DATETIME"),
        ("ficha",       "secao",            "VARCHAR(100)"),
        ("ficha",       "pago",             "INTEGER DEFAULT 0"),
    ]
    with db.engine.connect() as conn:
        for tabela, coluna, tipo in migracoes:
            try:
                conn.execute(text(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {tipo}"))
                conn.commit()
                print(f"[migração] Coluna '{coluna}' adicionada em '{tabela}'")
            except Exception:
                pass

@app.route('/api/fichas/<int:id>/pagos-parciais', methods=['PUT'])
@login_required
def salvar_pagos_parciais(id):
    ficha = Ficha.query.get(id)
    if not ficha:
        return jsonify({"erro": "Não encontrada"}), 404
    data = request.get_json()
    try:
        conteudo = json.loads(ficha.conteudo or "{}")
    except:
        conteudo = {}
    conteudo["__pagos_parciais__"] = data.get("pagos", [])
    ficha.conteudo = json.dumps(conteudo)
    db.session.commit()
    _broadcast("atualizar")
    return jsonify({"ok": True})

def inicializar_banco():
    with app.app_context():
        db.create_all()
        migrar_banco()

        if Categoria.query.count() == 0:
            for cat in CATEGORIAS_PADRAO:
                db.session.add(Categoria(nome=cat["nome"], cor=cat["cor"]))

        if not Saldo.query.first():
            db.session.add(Saldo(valor=0))

        db.session.commit()

inicializar_banco()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10000, debug=False)
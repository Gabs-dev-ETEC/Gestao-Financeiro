document.addEventListener("DOMContentLoaded", () => {

// ================= NAVEGAÇÃO SIDEBAR =================

function setActiveView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'))
    document.querySelectorAll('.navItem').forEach(b => b.classList.remove('active'))
    document.getElementById(viewId).classList.add('active-view')
}

document.getElementById("btnContas").onclick = () => {
    setActiveView("contasView")
    document.getElementById("btnContas").classList.add("active")
}

document.getElementById("btnColaboradores").onclick = () => {
    setActiveView("colaboradoresView")
    document.getElementById("btnColaboradores").classList.add("active")
    carregarColaboradores()
    carregarDashboardColaboradores()
}

document.getElementById("btnHistorico").onclick = () => {
    setActiveView("historicoView")
    document.getElementById("btnHistorico").classList.add("active")
    carregarHistorico()
}

setActiveView("contasView")
document.getElementById("btnContas").classList.add("active")

const colaboradorForm = document.getElementById("colaboradorForm")
if (colaboradorForm) {
    colaboradorForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        const nome   = document.getElementById("nomeColaborador").value
        const cpf    = document.getElementById("cpf").value
        const numero = document.getElementById("numeroColaborador").value
        const cargo  = document.getElementById("cargoColaborador").value
        const pix    = (document.getElementById("pixColaborador")?.value || "").trim()
        if (!nome || !cpf || !numero || !cargo) return
        await fetch("/api/colaboradores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, cpf, numero, cargo, pix })
        })
        e.target.reset()
        carregarColaboradores()
    })
}

const cpfInput = document.getElementById("cpf")
if (cpfInput) {
    cpfInput.addEventListener("input", function () {
        let v = this.value.replace(/\D/g, "").slice(0, 11)
        if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4")
        else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3")
        else if (v.length > 3) v = v.replace(/(\d{3})(\d+)/, "$1.$2")
        this.value = v
    })
}

const numeroInput = document.getElementById("numeroColaborador")
if (numeroInput) {
    numeroInput.addEventListener("input", function () {
        let v = this.value.replace(/\D/g, "").slice(0, 11)
        if (v.length > 6)      v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3")
        else if (v.length > 2) v = v.replace(/(\d{2})(\d+)/, "($1) $2")
        else                   v = v.replace(/(\d*)/, "($1")
        this.value = v
    })
}

document.getElementById("tipoFicha").addEventListener("change", (e) => {
    if (_modalColabId !== null) renderFichaModal(e.target.value)
})

setActiveView("contasView")
    document.getElementById("btnContas").classList.add("active")

    // Inicialização das fichas na aba contas
    renderizarFichasEmContas()
    setInterval(() => {
        renderizarFichasEmContas()
    }, 30000)

}) 



// ═══════════════════════════════════════════════════════════════════════════
// VARIÁVEIS GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════

let _modalColab      = null
let _modalColabId    = null
let _fichaEditandoId = null
let _secaoAtual      = null

// ═══════════════════════════════════════════════════════════════════════════
// CAMPOS
// ═══════════════════════════════════════════════════════════════════════════

const CAMPOS_NORMAL = [
    { key: "mes_ref",           label: "Mês de Referência",  desc: "Competência",              soValor: false, soCaixa: false, temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "caixa",             label: "Caixa",              desc: "Caixa gerado no mês",      soValor: true,  soCaixa: true,  temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "valores_recebidos", keyDesc: "valores_recebidos_desc", label: "Salário",         desc: "Salário base",         soValor: true, soCaixa: false, temDesconto: true,  somenteDesconto: false, excluiLiquido: false },
    { key: "clt",               keyDesc: "clt_desc",               label: "CLT",             desc: "Salário base CLT",     soValor: true, soCaixa: false, temDesconto: true,  somenteDesconto: false, excluiLiquido: false },
    { key: "gratificacao",      keyDesc: "gratificacao_desc",      label: "Gratificação",    desc: "Bônus / gratificação", soValor: true, soCaixa: false, temDesconto: true,  somenteDesconto: false, excluiLiquido: false },
    { key: "meta",              keyDesc: "meta_desc",              label: "Meta",            desc: "Comissão por metas",   soValor: true, soCaixa: false, temDesconto: true,  somenteDesconto: false, excluiLiquido: false },
    { key: "vt_valor",          keyDesc: "vt_desconto",            label: "Vale Transporte", desc: "Vale Transporte",      soValor: true, soCaixa: false, temDesconto: true,  somenteDesconto: false, excluiLiquido: false },
    { key: "va_valor",          keyDesc: "va_desconto",            label: "Vale Alimentação",desc: "Vale Alimentação",     soValor: true, soCaixa: false, temDesconto: true,  somenteDesconto: false, excluiLiquido: false },
    { key: "adiantamento",      label: "Adiantamento",       desc: "Descontado do salário líquido", soValor: true, soCaixa: false, temDesconto: false, somenteDesconto: true, excluiLiquido: false },
]

const CAMPOS_META = [
    { key: "fez_mes_passado", label: "Fez mês passado",  desc: "Resultado anterior",   soValor: true, soCaixa: true,  temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "caixa_mes",       label: "Caixa deste mês",  desc: "Caixa gerado no mês",  soValor: true, soCaixa: true,  temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "clt",             label: "CLT",               desc: "Salário base CLT",     soValor: true, soCaixa: false, temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "gratificacao",    label: "Gratificação",      desc: "Bônus / gratificação", soValor: true, soCaixa: false, temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "metas_recebidas", label: "Metas recebidas",   desc: "Metas atingidas",      soValor: true, soCaixa: false, temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "total_metas",     label: "Total metas",       desc: "Soma das metas",       soValor: true, soCaixa: false, temDesconto: false, somenteDesconto: false, excluiLiquido: false },
    { key: "adiantamento",    label: "Adiantamento",      desc: "Descontado do total",  soValor: true, soCaixa: false, temDesconto: false, somenteDesconto: true,  excluiLiquido: false },
]

function getCampos(tipo) { return tipo === "meta" ? CAMPOS_META : CAMPOS_NORMAL }

// ═══════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════

function parseMoeda(str) {
    if (!str) return 0
    const n = parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
}
function fmtMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function popup(msg) { if (typeof mostrarPopup === "function") mostrarPopup(msg); else alert(msg) }
function preencherHeaderModal(col) {
    const elNome  = document.getElementById("fichaHeaderNome")
    const elCargo = document.getElementById("fichaHeaderCargo")
    if (elNome)  elNome.textContent  = col.nome  || ""
    if (elCargo) elCargo.textContent = col.cargo?.toUpperCase() || ""
}
function copiarPix(pix) {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(pix)
    else { const el = document.createElement("textarea"); el.value = pix; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el) }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATAS AUTOMÁTICAS
// ═══════════════════════════════════════════════════════════════════════════

const MESES_PT = {
    "janeiro":0,"fevereiro":1,"março":2,"abril":3,
    "maio":4,"junho":5,"julho":6,"agosto":7,
    "setembro":8,"outubro":9,"novembro":10,"dezembro":11,
}

function parsearMesFicha(str) {
    if (!str || !str.trim()) return null
    str = str.trim().toLowerCase()
    const m1 = str.match(/^([a-záéíóúãõâêôç]+)[\/\s\-]+(\d{4})$/)
    if (m1) { const idx = MESES_PT[m1[1]]; if (idx !== undefined) return { ano: parseInt(m1[2]), mes: idx } }
    const m2 = str.match(/^(\d{1,2})[\/\-](\d{4})$/)
    if (m2) return { ano: parseInt(m2[2]), mes: parseInt(m2[1]) - 1 }
    const m3 = str.match(/^(\d{4})[\/\-](\d{2})$/)
    if (m3) return { ano: parseInt(m3[1]), mes: parseInt(m3[2]) - 1 }
    return null
}

function calcularDiaUtil(ano, mes, n = 5) {
    const fimDoMes = new Date(ano, mes + 1, 0).getDate()
    let count = 0
    for (let dia = 1; dia <= fimDoMes; dia++) {
        const dow = new Date(ano, mes, dia).getDay()
        if (dow !== 0 && dow !== 6) { count++; if (count === n) return new Date(ano, mes, dia) }
    }
    return null
}

function formatarParaInputDate(date) {
    if (!date) return ""
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

function preencherDatasAutomaticas() {
    if (!IS_ADMIN) return
    const mes = document.getElementById("mesFicha")?.value?.trim()
    if (!mes) return
    const parsed = parsearMesFicha(mes)
    if (!parsed) return
    const { ano, mes: mesIdx } = parsed
    const mapaChaveData = {
        "clt":               formatarParaInputDate(calcularDiaUtil(ano, mesIdx, 5)),
        "gratificacao":      formatarParaInputDate(new Date(ano, mesIdx, 20)),
        "valores_recebidos": formatarParaInputDate(new Date(ano, mesIdx, 20)),
    }
    const corpo = document.getElementById("conteudoFicha")
    if (!corpo) return
    Object.entries(mapaChaveData).forEach(([key, valorData]) => {
        if (!valorData) return
        const item = corpo.querySelector(`#listaFixa [data-campo-key="${key}"]`)
        if (!item) return
        const inputData = item.querySelector("input[data-role='data']")
        if (inputData && !inputData.value) inputData.value = valorData
    })
}

function atualizarHeaderMes(valor) { preencherDatasAutomaticas() }

// ═══════════════════════════════════════════════════════════════════════════
// MODAL FICHA
// ═══════════════════════════════════════════════════════════════════════════

function abrirModalFicha(colaborador) {
    document.body.style.overflow = "hidden"
    _modalColab = colaborador; _modalColabId = colaborador.id; _fichaEditandoId = null
    preencherHeaderModal(colaborador)
    const elMes = document.getElementById("mesFicha"); elMes.value = ""; elMes.disabled = !IS_ADMIN
    const elTipo = document.getElementById("tipoFicha"); elTipo.innerHTML = ""
    elTipo.appendChild(new Option("Ficha Normal", "normal"))
    if (colaborador.cargo?.toLowerCase().trim() === "consultor") elTipo.appendChild(new Option("Ficha de Meta", "meta"))
    elTipo.disabled = !IS_ADMIN
    renderFichaModal("normal")
    document.getElementById("modalFicha").classList.remove("hidden")
}

function fecharModalFicha() {
    document.body.style.overflow = "auto"
    document.getElementById("modalFicha").classList.add("hidden")
    _modalColab = null; _modalColabId = null; _fichaEditandoId = null
}

function renderFichaModal(tipo, dadosIniciais = null) {
    const campos = getCampos(tipo)
    const corpo  = document.getElementById("conteudoFicha")
    corpo.innerHTML = ""
    const dados    = dadosIniciais ? { ...dadosIniciais } : {}
    const riscados = dados["__riscados__"] || {}
    const datas    = dados["__datas__"]    || {}
    const extras   = dados["__outros__"]   || []
    delete dados["__riscados__"]; delete dados["__outros__"]; delete dados["__datas__"]

    const resumo = document.createElement("div")
    resumo.className = "ficha-resumo"
    resumo.innerHTML = `
        <div class="ficha-resumo-card">
            <span class="ficha-resumo-label">Caixa gerado</span>
            <span class="ficha-resumo-valor" id="resumoCaixa">R$ 0,00</span>
        </div>
        <div class="ficha-resumo-card" style="border-left:3px solid #1e4d8c;">
            <span class="ficha-resumo-label" style="color:#1e4d8c">Salário Bruto</span>
            <span class="ficha-resumo-valor" id="resumoBruto" style="color:#1e4d8c">R$ 0,00</span>
        </div>
        <div class="ficha-resumo-card ficha-resumo-card--green">
            <span class="ficha-resumo-label" style="color:#15803d">Salário Líquido</span>
            <span class="ficha-resumo-valor ficha-resumo-valor--green" id="resumoLiquido">R$ 0,00</span>
        </div>`
    corpo.appendChild(resumo)

    const thead = document.createElement("div")
    thead.className = "ficha-table-head"
    thead.innerHTML = `
        <span class="ficha-th">Descrição</span>
        <span class="ficha-th ficha-th--center">Data Pgto</span>
        <span class="ficha-th ficha-th--right" style="color:#e67e22;">Desconto</span>
        <span class="ficha-th ficha-th--right">Valor</span>
        <span></span>`
    corpo.appendChild(thead)

    const lista = document.createElement("div")
    lista.className = "ficha-lista"; lista.id = "listaFixa"
    lista.style.cssText = "border-radius:0 0 10px 10px;border:1.5px solid var(--cinza-borda);border-top:none;"
    corpo.appendChild(lista)

    campos.forEach((campo, idx) => {
        const valorSalvo    = campo.somenteDesconto ? "" : (dados[campo.key] ?? "")
        const descontoSalvo = campo.keyDesc ? (dados[campo.keyDesc] ?? "") : (campo.somenteDesconto ? (dados[campo.key] ?? "") : "")
        const dataSalva     = datas[campo.key] ?? ""
        lista.appendChild(criarItemFolha(campo, valorSalvo, descontoSalvo, dataSalva, riscados[campo.key] === true, idx === campos.length - 1, campos))
    })

    const outrosWrap = document.createElement("div"); outrosWrap.id = "outrosWrap"; outrosWrap.style.cssText = "margin-top:18px;"
    corpo.appendChild(outrosWrap)

    const othead = document.createElement("div")
    othead.className = "ficha-table-head"
    othead.innerHTML = `
        <span class="ficha-th" style="color:#e67e22;">Outros / Descontos</span>
        <span class="ficha-th ficha-th--center" style="color:rgba(255,255,255,0.45);">Data Pgto</span>
        <span class="ficha-th ficha-th--right" style="color:#e67e22;">Desconto</span>
        <span class="ficha-th ficha-th--right">Valor</span>
        <span></span>`
    outrosWrap.appendChild(othead)

    const outrosList = document.createElement("div"); outrosList.className = "ficha-lista"; outrosList.id = "outrosList"
    outrosList.style.cssText = "border-radius:0 0 10px 10px;border:1.5px solid var(--cinza-borda);border-top:none;"
    outrosWrap.appendChild(outrosList)

    extras.forEach(ex => adicionarItemOutros(ex.label || "", ex.desconto || "", ex.valor || "", ex.data || "", ex.riscado === true))
    atualizarPlaceholderOutros()

    if (IS_ADMIN) {
        const btnAdd = document.createElement("button"); btnAdd.className = "ficha-btn-add-linha"; btnAdd.style.cssText = "margin-top:8px;"
        btnAdd.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar item`
        btnAdd.onclick = () => { adicionarItemOutros("", "", "", "", false); atualizarPlaceholderOutros() }
        outrosWrap.appendChild(btnAdd)
    }

    if (!dadosIniciais) preencherDatasAutomaticas()
    recalcularTudo(campos)
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE INPUT
// ═══════════════════════════════════════════════════════════════════════════

function mkMoneyInput(value, placeholder, role, color) {
    const inp = document.createElement("input")
    inp.type = "text"; inp.value = value; inp.placeholder = placeholder; inp.dataset.role = role
    inp.style.cssText = `width:100%;text-align:right;border:1px solid var(--cinza-borda);border-radius:6px;padding:5px 8px;font-size:0.84rem;color:${color};font-weight:600;background:var(--cinza-claro);`
    return inp
}

function mkSpan(text, role, color) {
    const s = document.createElement("span"); s.dataset.role = role
    s.style.cssText = `font-size:0.88rem;font-weight:600;color:${color};white-space:nowrap;display:block;text-align:right;`
    s.textContent = text; return s
}

function mkDateInput(value) {
    if (IS_ADMIN) {
        const inp = document.createElement("input")
        inp.type = "date"; inp.value = value; inp.dataset.role = "data"
        inp.style.cssText = `width:100%;border:1px solid var(--cinza-borda);border-radius:6px;padding:5px 6px;font-size:0.78rem;color:var(--texto-suave);background:var(--cinza-claro);cursor:pointer;`
        inp.addEventListener("change", () => autoSalvarFicha())
        return inp
    } else {
        const s = document.createElement("span")
        s.dataset.role = "data"
        s.style.cssText = "font-size:0.78rem;color:var(--texto-suave);white-space:nowrap;display:block;text-align:center;"
        s.textContent = value ? new Date(value + "T00:00:00").toLocaleDateString("pt-BR") : "—"
        return s
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM DA TABELA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

function criarItemFolha(campo, valorInicial, descontoInicial, dataInicial, estaRiscado, isLast, camposRef) {
    const item = document.createElement("div")
    item.className = "ficha-item ficha-item--grid"
    item.dataset.campoKey    = campo.key
    item.dataset.soCaixa     = campo.soCaixa        ? "1" : "0"
    item.dataset.temDesconto = campo.temDesconto     ? "1" : "0"
    item.dataset.somenteDesc = campo.somenteDesconto ? "1" : "0"
    item.dataset.excluiLiq   = campo.excluiLiquido   ? "1" : "0"
    item.dataset.riscado     = "0"
    if (!isLast) item.style.borderBottom = "1px solid var(--cinza-borda)"

    const colInfo = document.createElement("div"); colInfo.className = "ficha-col-desc"
    const tagApart = campo.excluiLiquido ? `<span class="ficha-tag-apart">à parte</span>` : ""
    colInfo.innerHTML = `
        <p class="ficha-item-desc" style="margin:0;display:flex;align-items:center;gap:6px;">${campo.label}${tagApart}</p>
        <p class="ficha-item-subdesc" style="margin:0;">${campo.desc}</p>`

    const colDate = document.createElement("div"); colDate.className = "ficha-col-date"
    colDate.appendChild(mkDateInput(dataInicial))

    const colDesc = document.createElement("div"); colDesc.className = "ficha-col-money"
    if (campo.temDesconto || campo.somenteDesconto) {
        if (IS_ADMIN) {
            const inp = mkMoneyInput(descontoInicial, "R$ 0,00", "desconto", "#c0392b")
            inp.addEventListener("input", () => recalcularTudo(camposRef))
            colDesc.appendChild(inp)
        } else {
            colDesc.appendChild(mkSpan(descontoInicial ? fmtMoeda(parseMoeda(descontoInicial)) : "—", "desconto", "#c0392b"))
        }
    } else {
        colDesc.innerHTML = `<span style="color:var(--cinza-borda);display:block;text-align:right;">—</span>`
    }

    const colVal = document.createElement("div"); colVal.className = "ficha-col-money"
    if (campo.somenteDesconto) {
        colVal.innerHTML = `<span style="color:var(--cinza-borda);display:block;text-align:right;">—</span>`
    } else if (campo.soValor) {
        const cor = campo.soCaixa ? "#1e4d8c" : campo.excluiLiquido ? "#7c4dbd" : "#15803d"
        if (IS_ADMIN) {
            const inp = mkMoneyInput(valorInicial, "R$ 0,00", "valor", cor)
            inp.addEventListener("input", () => recalcularTudo(camposRef))
            colVal.appendChild(inp)
        } else {
            colVal.appendChild(mkSpan(valorInicial ? fmtMoeda(parseMoeda(valorInicial)) : "—", "valor", cor))
        }
    } else {
        if (IS_ADMIN) {
            const inp = mkMoneyInput(valorInicial, "Ex: Março 2024", "valor", "var(--texto)")
            inp.style.textAlign = "left"; colVal.appendChild(inp)
        } else {
            colVal.appendChild(mkSpan(valorInicial || "—", "valor", "var(--texto)"))
        }
    }

    const check = document.createElement("div"); check.className = "ficha-check-box"
    if (IS_ADMIN) check.onclick = () => {
        const r = item.dataset.riscado === "1"
        item.dataset.riscado = r ? "0" : "1"
        aplicarEstadoRiscado(item, !r, camposRef)
        autoSalvarFicha()
    }

    item.appendChild(colInfo); item.appendChild(colDate); item.appendChild(colDesc)
    item.appendChild(colVal); item.appendChild(check)

    if (estaRiscado) { item.dataset.riscado = "1"; aplicarEstadoRiscado(item, true, camposRef) }
    return item
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM "OUTROS"
// ═══════════════════════════════════════════════════════════════════════════

function adicionarItemOutros(labelInicial, descontoInicial, valorInicial, dataInicial, estaRiscado) {
    const lista  = document.getElementById("outrosList")
    const campos = getCampos(document.getElementById("tipoFicha").value)
    const item   = document.createElement("div")
    item.className = "ficha-item ficha-item--grid ficha-item--outro"
    item.dataset.riscado = estaRiscado ? "1" : "0"
    item.style.borderBottom = "1px solid var(--cinza-borda)"

    const colInfo = document.createElement("div"); colInfo.className = "ficha-col-desc"
    if (IS_ADMIN) {
        const lbl = document.createElement("input"); lbl.type = "text"; lbl.value = labelInicial
        lbl.placeholder = "Descrição"
        lbl.style.cssText = "border:1px solid var(--cinza-borda);border-radius:6px;padding:5px 8px;font-size:0.84rem;color:var(--texto);background:var(--cinza-claro);width:100%;"
        colInfo.appendChild(lbl)
    } else {
        const p = document.createElement("p")
        p.style.cssText = "font-size:0.88rem;font-weight:600;color:var(--texto);margin:0;"
        p.textContent = labelInicial || "—"; colInfo.appendChild(p)
    }

    const colDate = document.createElement("div"); colDate.className = "ficha-col-date"
    colDate.appendChild(mkDateInput(dataInicial))

    const colDesc = document.createElement("div"); colDesc.className = "ficha-col-money"
    if (IS_ADMIN) {
        const inp = mkMoneyInput(descontoInicial, "R$ 0,00", "desconto", "#c0392b")
        inp.addEventListener("input", () => recalcularTudo(campos)); colDesc.appendChild(inp)
    } else {
        colDesc.appendChild(mkSpan(descontoInicial ? fmtMoeda(parseMoeda(descontoInicial)) : "—", "desconto", "#c0392b"))
    }

    const colVal = document.createElement("div"); colVal.className = "ficha-col-money"
    if (IS_ADMIN) {
        const inp = mkMoneyInput(valorInicial, "R$ 0,00", "valor", "#15803d")
        inp.addEventListener("input", () => recalcularTudo(campos)); colVal.appendChild(inp)
    } else {
        colVal.appendChild(mkSpan(valorInicial ? fmtMoeda(parseMoeda(valorInicial)) : "—", "valor", "#15803d"))
    }

    const acoes = document.createElement("div"); acoes.style.cssText = "display:flex;align-items:center;justify-content:flex-end;gap:3px;"
    const check = document.createElement("div"); check.className = "ficha-check-box"
    if (IS_ADMIN) check.onclick = () => {
        const r = item.dataset.riscado === "1"
        item.dataset.riscado = r ? "0" : "1"
        aplicarEstadoRiscadoOutro(item, !r, campos)
        autoSalvarFicha()
    }
    acoes.appendChild(check)
    if (IS_ADMIN) {
        const btnRem = document.createElement("button")
        btnRem.style.cssText = "background:none;border:none;cursor:pointer;color:#c0392b;padding:0;display:flex;opacity:0;transition:opacity 0.15s;"
        btnRem.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        btnRem.onclick = () => { item.remove(); atualizarPlaceholderOutros(); recalcularTudo(campos); autoSalvarFicha() }
        item.addEventListener("mouseenter", () => btnRem.style.opacity = "1")
        item.addEventListener("mouseleave", () => btnRem.style.opacity = "0")
        acoes.appendChild(btnRem)
    }

    item.appendChild(colInfo); item.appendChild(colDate); item.appendChild(colDesc)
    item.appendChild(colVal); item.appendChild(acoes)

    if (estaRiscado) { item.dataset.riscado = "1"; aplicarEstadoRiscadoOutro(item, true, campos) }
    lista.appendChild(item)
    recalcularTudo(campos)
}

function atualizarPlaceholderOutros() {
    const lista = document.getElementById("outrosList"); if (!lista) return
    const existente = lista.querySelector(".outros-placeholder")
    const temItens  = lista.querySelectorAll(".ficha-item--outro").length > 0
    if (temItens && existente) existente.remove()
    else if (!temItens && !existente) {
        const ph = document.createElement("div"); ph.className = "outros-placeholder"
        ph.style.cssText = "padding:14px 16px;font-size:0.82rem;color:#c5cdd8;font-style:italic;text-align:center;"
        ph.textContent = IS_ADMIN ? "Nenhum item adicionado. Clique em + Adicionar item." : "Nenhum item adicional."
        lista.appendChild(ph)
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO RISCADO
// ═══════════════════════════════════════════════════════════════════════════

function aplicarEstadoRiscado(item, riscado, campos) {
    const check = item.querySelector(".ficha-check-box")
    const desc  = item.querySelector(".ficha-item-desc")
    const sub   = item.querySelector(".ficha-item-subdesc")
    const els   = item.querySelectorAll("input[data-role], span[data-role]")
    if (riscado) {
        item.style.opacity = "0.4"; item.style.background = "#f5f5f7"
        if (desc) { desc.style.textDecoration = "line-through"; desc.style.color = "#aab2c0" }
        if (sub)  { sub.style.textDecoration  = "line-through"; sub.style.color  = "#c5cdd8" }
        els.forEach(el => { el.style.textDecoration = "line-through"; el.style.color = "#aab2c0" })
        check.style.background = "#c5cdd8"; check.style.borderColor = "#c5cdd8"
        check.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    } else {
        item.style.opacity = ""; item.style.background = ""
        if (desc) { desc.style.textDecoration = ""; desc.style.color = "" }
        if (sub)  { sub.style.textDecoration  = ""; sub.style.color  = "" }
        els.forEach(el => {
            el.style.textDecoration = ""
            const r = el.dataset.role
            if      (r === "desconto") el.style.color = "#c0392b"
            else if (r === "valor")    el.style.color = item.dataset.soCaixa === "1" ? "#1e4d8c" : "#15803d"
        })
        check.style.background = "#fff"; check.style.borderColor = "var(--cinza-borda)"; check.innerHTML = ""
    }
    recalcularTudo(campos)
}

function aplicarEstadoRiscadoOutro(item, riscado, campos) {
    const check = item.querySelector(".ficha-check-box")
    const els   = item.querySelectorAll("input, span[data-role], p")
    if (riscado) {
        item.style.opacity = "0.4"; item.style.background = "#f5f5f7"
        els.forEach(el => { el.style.textDecoration = "line-through"; el.style.color = "#aab2c0" })
        check.style.background = "#c5cdd8"; check.style.borderColor = "#c5cdd8"
        check.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    } else {
        item.style.opacity = ""; item.style.background = ""
        els.forEach(el => {
            el.style.textDecoration = ""
            const r = el.dataset?.role
            if (r === "desconto") el.style.color = "#c0392b"
            else if (r === "valor") el.style.color = "#15803d"
            else el.style.color = ""
        })
        check.style.background = "#fff"; check.style.borderColor = "var(--cinza-borda)"; check.innerHTML = ""
    }
    recalcularTudo(campos)
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO
// ═══════════════════════════════════════════════════════════════════════════

function recalcularTudo(campos) {
    const corpo = document.getElementById("conteudoFicha"); if (!corpo) return
    let caixa = 0, brutoTotal = 0, brutoParaLiquido = 0, descontos = 0

    campos.forEach(c => {
        const item = corpo.querySelector(`#listaFixa [data-campo-key="${c.key}"]`)
        if (!item || item.dataset.riscado === "1") return
        if (!c.somenteDesconto) {
            const el = item.querySelector("[data-role='valor']")
            const v  = parseMoeda(el?.value || el?.textContent || "0")
            if (c.soCaixa) { caixa += v }
            else if (c.soValor) { brutoTotal += v; if (!c.excluiLiquido) brutoParaLiquido += v }
        }
        if ((c.temDesconto || c.somenteDesconto) && !c.excluiLiquido) {
            const el = item.querySelector("[data-role='desconto']")
            descontos += parseMoeda(el?.value || el?.textContent || "0")
        }
    })

    corpo.querySelectorAll("#outrosList .ficha-item--outro").forEach(item => {
        if (item.dataset.riscado === "1") return
        const elD = item.querySelector("[data-role='desconto']")
        const elV = item.querySelector("[data-role='valor']")
        descontos        += parseMoeda(elD?.value || elD?.textContent || "0")
        brutoParaLiquido += parseMoeda(elV?.value || elV?.textContent || "0")
        brutoTotal       += parseMoeda(elV?.value || elV?.textContent || "0")
    })

    const liquido = brutoParaLiquido - descontos
    const elC = document.getElementById("resumoCaixa")
    const elB = document.getElementById("resumoBruto")
    const elL = document.getElementById("resumoLiquido")
    if (elC) elC.textContent = fmtMoeda(caixa)
    if (elB) elB.textContent = fmtMoeda(brutoTotal)
    if (elL) { elL.textContent = fmtMoeda(liquido); elL.style.color = liquido < 0 ? "#c0392b" : "#15803d" }
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

function serializarFicha(campos) {
    const corpo = document.getElementById("conteudoFicha")
    const dados = {}, riscados = {}, datas = {}

    campos.forEach(c => {
        const item   = corpo.querySelector(`#listaFixa [data-campo-key="${c.key}"]`)
        const elVal  = item?.querySelector("[data-role='valor']")
        const elDesc = item?.querySelector("[data-role='desconto']")
        const elData = item?.querySelector("[data-role='data']")
        dados[c.key]  = elVal?.value  ?? elVal?.textContent  ?? ""
        if (c.keyDesc)         dados[c.keyDesc]       = elDesc?.value ?? elDesc?.textContent ?? ""
        if (c.somenteDesconto) dados[c.key + "_desc"] = elDesc?.value ?? elDesc?.textContent ?? ""
        if (item?.dataset.riscado === "1") riscados[c.key] = true
        if (elData?.value) datas[c.key] = elData.value
    })

    if (Object.keys(riscados).length > 0) dados["__riscados__"] = riscados
    if (Object.keys(datas).length > 0)    dados["__datas__"]    = datas

    const extras = []
    corpo.querySelectorAll("#outrosList .ficha-item--outro").forEach(item => {
        const lEl  = item.querySelector("input:not([data-role]), p")
        const dEl  = item.querySelector("[data-role='desconto']")
        const vEl  = item.querySelector("[data-role='valor']")
        const dtEl = item.querySelector("[data-role='data']")
        const label = lEl?.value ?? lEl?.textContent ?? ""
        const desc  = dEl?.value ?? dEl?.textContent ?? ""
        const valor = vEl?.value ?? vEl?.textContent ?? ""
        const data  = dtEl?.value ?? ""
        if (label || desc || valor) extras.push({ label: label.trim(), desconto: desc.trim(), valor: valor.trim(), data, riscado: item.dataset.riscado === "1" })
    })
    if (extras.length > 0) dados["__outros__"] = extras
    return dados
}

// ═══════════════════════════════════════════════════════════════════════════
// SALVAR / CARREGAR FICHAS
// ═══════════════════════════════════════════════════════════════════════════

async function autoSalvarFicha() {
    if (!IS_ADMIN) return
    const mes = document.getElementById("mesFicha").value.trim(); if (!mes) return
    const tipo = document.getElementById("tipoFicha").value
    const dados = serializarFicha(getCampos(tipo))
    if (_fichaEditandoId) await fetch(`/api/fichas/${_fichaEditandoId}`, { method: "DELETE" })
    const res = await fetch("/api/fichas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ colaborador_id: _modalColabId, nome_ficha: mes, tipo, conteudo: JSON.stringify(dados) }) })
    if (res.ok) { const json = await res.json(); _fichaEditandoId = json.id || null; await carregarFichas(_modalColabId) }
}

async function salvarFicha() {
    if (!IS_ADMIN) return
    const colabId = _modalColabId; if (!colabId) { alert("Erro: colaborador não identificado."); return }
    const mes  = document.getElementById("mesFicha").value.trim()
    const tipo = document.getElementById("tipoFicha").value
    if (!mes) { alert("Informe o mês da ficha."); return }
    const dados = serializarFicha(getCampos(tipo))
    if (_fichaEditandoId) { await fetch(`/api/fichas/${_fichaEditandoId}`, { method: "DELETE" }); _fichaEditandoId = null }
    const res = await fetch("/api/fichas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaborador_id: colabId, nome_ficha: mes, tipo, secao: _secaoAtual, conteudo: JSON.stringify(dados) })
    })
    if (res.ok) {
        try { const json = await res.json(); _fichaEditandoId = json.id || null } catch(e) { _fichaEditandoId = null }
        await carregarFichas(colabId)
        await carregarDashboardColaboradores()
        popup("Ficha salva com sucesso! ✅")
    } else alert("Erro ao salvar ficha.")
}

// ═══════════════════════════════════════════════════════════════════════════
// CARREGAR FICHAS 
// ═══════════════════════════════════════════════════════════════════════════

async function carregarFichas(colaboradorId) {
    const res    = await fetch(`/api/fichas/${colaboradorId}`)
    const fichas = await res.json()
    const miniCard = document.getElementById(`fichas-${colaboradorId}`); if (!miniCard) return
    miniCard.innerHTML = ""

    if (fichas.length === 0) {
        miniCard.innerHTML = `<p style="font-size:0.8rem;color:#aab2c0;">Nenhuma ficha salva.</p>`
        adicionarBotaoNovaSecao(miniCard, colaboradorId)
        return
    }

    const secoes = {}
    fichas.forEach(f => {
        const nome = f.secao || "Sem seção"
        if (!secoes[nome]) secoes[nome] = []
        secoes[nome].push(f)
    })

    Object.entries(secoes).forEach(([nomeSecao, fichasDaSecao]) => {
        const secaoDiv = document.createElement("div")
        secaoDiv.className = "secao-fichas"
        secaoDiv.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;"
                 onclick="const corpo=this.parentElement.querySelector('.secao-corpo');const seta=this.querySelector('.secao-seta');const aberto=corpo.style.display!=='none';corpo.style.display=aberto?'none':'';seta.style.transform=aberto?'rotate(-90deg)':'';">
                <strong>${nomeSecao}</strong>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span class="secao-seta" style="display:inline-block;transition:transform 0.2s;">▾</span>
                    <button onclick="event.stopPropagation(); abrirModalNovaFicha(${colaboradorId}, '${nomeSecao}')">+</button>
                </div>
            </div>
            <div class="secao-corpo"></div>`

        const corpo = secaoDiv.querySelector('.secao-corpo')

        fichasDaSecao.forEach(f => {
            const colaborador = JSON.parse(
                document.querySelector(`[data-colab-id="${colaboradorId}"]`)?.dataset.colabJson || "{}"
            )

            const fichaRow = document.createElement("div")
            fichaRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px;border-radius:6px;transition:background 0.15s;"
            fichaRow.onmouseenter = () => fichaRow.style.background = "rgba(0,0,0,0.04)"
            fichaRow.onmouseleave = () => fichaRow.style.background = ""

            const fichaEl = document.createElement("span")
            fichaEl.textContent = `📄 ${f.nome_ficha}`
            fichaEl.style.cssText = `cursor:pointer;flex:1;font-size:0.83rem;${f.pago ? "opacity:0.4;text-decoration:line-through;" : ""}`
            fichaEl.onclick = () => abrirFicha(f, colaborador)

            const chkPago = document.createElement("input")
            chkPago.type = "checkbox"
            chkPago.title = "Marcar como paga"
            chkPago.checked = f.pago === 1 || f.pago === true
            chkPago.style.cssText = "width:15px;height:15px;cursor:pointer;accent-color:#1a7a4a;flex-shrink:0;"
            chkPago.onchange = async (e) => {
                e.stopPropagation()
                const res = await fetch(`/api/fichas/${f.id}/pago`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pago: chkPago.checked })
                })
                if (res.ok) {
                    await carregarFichas(colaboradorId)
                    await carregarDashboardColaboradores()
                }
            }
const btnPdf = document.createElement("button")
btnPdf.title = "Baixar PDF"
btnPdf.style.cssText = "background:none;border:none;cursor:pointer;color:#1e4d8c;padding:2px 4px;display:flex;align-items:center;flex-shrink:0;opacity:0.6;transition:opacity 0.15s;"
btnPdf.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="13" y2="17"/>
</svg>`
btnPdf.onmouseenter = () => btnPdf.style.opacity = "1"
btnPdf.onmouseleave = () => btnPdf.style.opacity = "0.6"
btnPdf.onclick = (e) => { e.stopPropagation(); baixarPDF(f.id) }

fichaRow.appendChild(fichaEl)
fichaRow.appendChild(btnPdf)
fichaRow.appendChild(chkPago)
corpo.appendChild(fichaRow)
        })

        miniCard.appendChild(secaoDiv)
    })

    adicionarBotaoNovaSecao(miniCard, colaboradorId)
}

function adicionarBotaoNovaSecao(miniCard, colaboradorId) {
    const btnNovaSecao = document.createElement("button")
    btnNovaSecao.textContent = "+ Nova Seção"
    btnNovaSecao.style.cssText = "margin-top:6px;background:none;border:1px dashed var(--cinza-borda);border-radius:6px;padding:4px 10px;font-size:0.78rem;color:var(--texto-suave);cursor:pointer;width:100%;"
  btnNovaSecao.onclick = () => abrirModalNovaSecaoNome(colaboradorId)
    miniCard.appendChild(btnNovaSecao)
}

function abrirModalNovaSecaoNome(colabId) {
    const overlay = document.createElement("div")
    overlay.style.cssText = `
        position:fixed; inset:0;
        background:rgba(0,0,0,0.4);
        display:flex; align-items:center; justify-content:center;
        z-index:9999;
    `

    const modal = document.createElement("div")
    modal.style.cssText = `
        background:#fff;
        border-radius:12px;
        padding:20px;
        width:280px;
        box-shadow:0 10px 25px rgba(0,0,0,0.2);
        display:flex;
        flex-direction:column;
        gap:12px;
        font-family:'Barlow Condensed', sans-serif;
    `

    modal.innerHTML = `
        <h3 style="font-size:1.1rem;color:#1e4d8c;">Nova Seção</h3>
        <input type="text" placeholder="Ex: Comissões, Extras..."
            style="border:1px solid #d0d5dd;border-radius:8px;padding:8px;font-size:0.9rem;">
        <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="cancelar">Cancelar</button>
            <button class="salvar">Criar</button>
        </div>
    `

    const input = modal.querySelector("input")

    modal.querySelector(".cancelar").onclick = () => overlay.remove()

    modal.querySelector(".salvar").onclick = () => {
        const nome = input.value.trim()
        if (!nome) return

        criarSecaoVisual(colabId, nome)
        overlay.remove()
    }

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    input.focus()
}


function criarSecaoVisual(colabId, nome) {
    const container = document.getElementById(`fichas-${colabId}`)
    const btnExistente = container.querySelector("button")
    const secaoDiv = document.createElement("div")
    secaoDiv.className = "secao-fichas"
    secaoDiv.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;"
             onclick="const corpo=this.parentElement.querySelector('.secao-corpo');const seta=this.querySelector('.secao-seta');const aberto=corpo.style.display!=='none';corpo.style.display=aberto?'none':'';seta.style.transform=aberto?'rotate(-90deg)':'';">
            <strong>${nome}</strong>
            <div style="display:flex;align-items:center;gap:6px;">
                <span class="secao-seta" style="display:inline-block;transition:transform 0.2s;">▾</span>
                <button onclick="event.stopPropagation(); abrirModalNovaFicha(${colabId}, '${nome}')">+</button>
            </div>
        </div>
        <div class="secao-corpo">
            <p style="font-size:0.8rem;color:#aab2c0;padding:4px 6px;">Nenhuma ficha nesta seção.</p>
        </div>`
    if (btnExistente) container.insertBefore(secaoDiv, btnExistente)
    else container.appendChild(secaoDiv)
}

function abrirFicha(ficha, colaborador) {
    document.body.style.overflow = "hidden"
    _modalColab      = colaborador
    _modalColabId    = colaborador.id
    _fichaEditandoId = ficha.id
    _secaoAtual      = ficha.secao || "Sem seção"
    preencherHeaderModal(colaborador)
    const elMes = document.getElementById("mesFicha")
    elMes.value = ficha.nome_ficha; elMes.disabled = !IS_ADMIN
    let dados = null
    try { dados = JSON.parse(ficha.conteudo); if (Array.isArray(dados)) dados = null } catch(e) {}
    renderFichaModal(ficha.tipo, dados)
    preencherDatasAutomaticas()   // ← adicionar esta linha
    document.getElementById("modalFicha").classList.remove("hidden")
}

async function excluirFicha(fichaId, colaboradorId) {
    if (!IS_ADMIN) return
    if (!confirm("Deseja excluir essa ficha?")) return
    await fetch(`/api/fichas/${fichaId}`, { method: "DELETE" })
    await carregarFichas(colaboradorId)
    popup("Ficha excluída.")
}

function baixarPDF(id) { window.open(`/api/fichas/pdf/${id}`, "_blank") }

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD DE COLABORADORES
// ═══════════════════════════════════════════════════════════════════════════

async function carregarDashboardColaboradores() {
    const container = document.getElementById("dashColabContainer")
    if (!container) return

    try {
        const res = await fetch("/api/dashboard/fichas")
        if (!res.ok) return
        const fichas = await res.json()

        const porColab = {}
        fichas.forEach(f => {
            if (!porColab[f.colaborador_id]) {
                porColab[f.colaborador_id] = { nome: f.colab_nome, cargo: f.colab_cargo, fichas: [] }
            }

            let liquido = 0
            try {
                const dados   = JSON.parse(f.conteudo || "{}")
                const campos  = f.tipo === "meta" ? CAMPOS_META : CAMPOS_NORMAL
                const riscados = dados["__riscados__"] || {}
                const extras  = dados["__outros__"] || []

                campos.forEach(c => {
                    if (!c.soValor || riscados[c.key] || c.soCaixa) return
                    const v = parseMoeda(dados[c.key] || "0")
                    if (!c.somenteDesconto && !c.excluiLiquido) liquido += v
                    if (c.somenteDesconto) liquido -= v
                    if (c.temDesconto && !c.excluiLiquido) {
                        const kd = c.keyDesc || null
                        if (kd) liquido -= parseMoeda(dados[kd] || "0")
                    }
                })
                extras.forEach(ex => {
                    if (ex.riscado) return
                    liquido += parseMoeda(ex.valor || "0")
                    liquido -= parseMoeda(ex.desconto || "0")
                })
            } catch(e) {}

            porColab[f.colaborador_id].fichas.push({ nome: f.nome_ficha, liquido })
        })

        container.innerHTML = ""

        if (Object.keys(porColab).length === 0) {
            container.innerHTML = `<p style="font-size:0.82rem;color:#aab2c0;">Nenhuma ficha pendente de pagamento.</p>`
            return
        }

        Object.values(porColab).forEach(({ nome, cargo, fichas }) => {
            const totalLiquido = fichas.reduce((s, f) => s + f.liquido, 0)
            const iniciais = nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()

            const card = document.createElement("div")
            card.style.cssText = "background:var(--branco);border:1.5px solid var(--cinza-borda);border-left:4px solid var(--azul-claro);border-radius:12px;padding:14px 16px;box-shadow:var(--sombra);display:flex;flex-direction:column;gap:8px;"
            card.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;border-radius:8px;background:var(--azul);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:0.9rem;flex-shrink:0;">${iniciais}</div>
                    <div style="min-width:0;">
                        <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.95rem;color:var(--azul);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nome}</p>
                        <p style="font-size:0.72rem;color:var(--texto-suave);">${cargo || ""}</p>
                    </div>
                </div>
                <div style="border-top:1px solid var(--cinza-borda);padding-top:8px;">
                    <p style="font-size:0.7rem;color:var(--texto-suave);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">${fichas.length} ficha${fichas.length > 1 ? "s" : ""} pendente${fichas.length > 1 ? "s" : ""}</p>
                    <p style="font-family:'Barlow Condensed',sans-serif;font-size:1.3rem;font-weight:800;color:${totalLiquido >= 0 ? "#15803d" : "#c0392b"};">${fmtMoeda(totalLiquido)}</p>
                </div>`
            container.appendChild(card)
        })
    } catch(e) {
        console.error("Erro ao carregar dashboard:", e)
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COLABORADORES
// ═══════════════════════════════════════════════════════════════════════════

async function carregarColaboradores() {
    const res   = await fetch("/api/colaboradores"); const lista = await res.json()
    const listaAtivos      = document.getElementById("listaColaboradores")
    const listaDesativados = document.getElementById("listaDesativados")
    listaAtivos.innerHTML = ""; listaDesativados.innerHTML = ""
    if (lista.filter(c => c.ativo).length === 0)  listaAtivos.innerHTML      = '<p class="text-gray-400 text-sm">Nenhum colaborador ativo.</p>'
    if (lista.filter(c => !c.ativo).length === 0) listaDesativados.innerHTML = '<p class="text-gray-400 text-sm">Nenhum colaborador desativado.</p>'

    lista.forEach(c => {
        const div = document.createElement("div"); div.dataset.colabId = c.id; div.dataset.colabJson = JSON.stringify(c)
        div.style.cssText = `background:${c.ativo ? "var(--branco)" : "#e8ecf2"};border:1.5px solid var(--cinza-borda);border-radius:12px;box-shadow:var(--sombra);overflow:hidden;transition:box-shadow 0.2s;`

        const header = document.createElement("div")
        header.style.cssText = `padding:14px 16px;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;gap:10px;transition:background 0.15s;border-left:4px solid ${c.ativo ? "var(--azul-claro)" : "#8a95a3"};`
        header.onmouseenter = () => header.style.background = "var(--cinza-claro)"
        header.onmouseleave = () => header.style.background = ""

        const iniciais = c.nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
        const avatar = document.createElement("div")
        avatar.style.cssText = `width:40px;height:40px;border-radius:10px;background:${c.ativo ? "var(--azul)" : "#8a95a3"};color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:1rem;flex-shrink:0;letter-spacing:0.04em;`
        avatar.textContent = iniciais

        const info = document.createElement("div"); info.style.cssText = "flex:1;min-width:0;"
        const badge = !c.ativo ? `<span style="font-size:0.68rem;background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:999px;margin-left:6px;font-weight:700;">INATIVO</span>` : ""
        info.innerHTML = `<p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1rem;color:var(--azul);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nome}${badge}</p><p style="font-size:0.78rem;color:var(--texto-suave);margin-top:2px;">${c.cargo} &nbsp;·&nbsp; ${c.numero}</p>`

        const seta = document.createElement("span")
        seta.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--texto-suave);transition:transform 0.25s;flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>`
        header.appendChild(avatar); header.appendChild(info); header.appendChild(seta)

        const body = document.createElement("div")
        body.style.cssText = "border-top:1px solid var(--cinza-borda);background:var(--cinza-claro);display:none;flex-direction:column;gap:10px;padding:14px 16px;"

        const detalhes = document.createElement("div")
        detalhes.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.82rem;color:var(--texto-suave);background:var(--branco);border-radius:8px;padding:10px 12px;border:1px solid var(--cinza-borda);"
        detalhes.innerHTML = `<span><strong style="color:var(--texto);">CPF:</strong> ${c.cpf}</span><span><strong style="color:var(--texto);">Tel:</strong> ${c.numero}</span><span><strong style="color:var(--texto);">Cargo:</strong> ${c.cargo}</span>`

        if (c.pix) {
            const lp = document.createElement("span"); lp.style.cssText = "grid-column:span 2;display:flex;align-items:center;gap:6px;margin-top:4px;padding-top:6px;border-top:1px solid var(--cinza-borda);"
            const rot = document.createElement("strong"); rot.style.cssText = "color:var(--texto);white-space:nowrap;"; rot.textContent = "PIX:"
            const vp  = document.createElement("span");  vp.style.cssText  = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; vp.textContent = c.pix
            const bc  = document.createElement("button"); bc.textContent = "Copiar"; bc.style.cssText = "background:var(--azul);color:#fff;border:none;border-radius:5px;padding:3px 10px;font-size:0.75rem;cursor:pointer;white-space:nowrap;font-family:'Barlow Condensed',sans-serif;font-weight:700;flex-shrink:0;"
            bc.onclick = () => copiarPix(c.pix)
            lp.appendChild(rot); lp.appendChild(vp); lp.appendChild(bc); detalhes.appendChild(lp)
        }
        body.appendChild(detalhes)

        const acoes = document.createElement("div"); acoes.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;"
        const btnFicha = document.createElement("button"); btnFicha.textContent = IS_ADMIN ? "+ Nova Ficha" : "Ver Fichas"
        btnFicha.style.cssText = "background:var(--azul-claro);color:#fff;border:none;border-radius:6px;padding:6px 14px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.85rem;letter-spacing:0.05em;cursor:pointer;"
        btnFicha.onclick = (e) => { e.stopPropagation(); abrirModalFicha(c) }
        acoes.appendChild(btnFicha)
        if (IS_ADMIN) {
            const btnS = document.createElement("button"); btnS.textContent = c.ativo ? "Desativar" : "Ativar"
            btnS.style.cssText = `background:${c.ativo ? "#e67e22" : "#1a7a4a"};color:#fff;border:none;border-radius:6px;padding:6px 14px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.85rem;cursor:pointer;`
            btnS.onclick = (e) => { e.stopPropagation(); alterarStatus(c.id) }
            acoes.appendChild(btnS)
            if (!c.ativo) {
                const btnD = document.createElement("button"); btnD.textContent = "Excluir"
                btnD.style.cssText = "background:#c0392b;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.85rem;cursor:pointer;"
                btnD.onclick = (e) => { e.stopPropagation(); excluirColaborador(c.id) }
                acoes.appendChild(btnD)
            }
        }
        body.appendChild(acoes)

        const tituloFichas = document.createElement("p")
        tituloFichas.style.cssText = "font-family:'Barlow Condensed',sans-serif;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--texto-suave);"
        tituloFichas.textContent = "Fichas salvas"; body.appendChild(tituloFichas)

        const fichasContainer = document.createElement("div")
        fichasContainer.id = `fichas-${c.id}`
        fichasContainer.style.cssText = "display:flex;flex-direction:column;gap:4px;"
        body.appendChild(fichasContainer)

        let carregou = false
        header.onclick = () => {
            const aberto = body.style.display === "flex"
            document.querySelectorAll("[data-colab-id]").forEach(card => {
                const b = card.querySelector(":scope > div:last-child"); const s = card.querySelector(":scope > div:first-child > span svg")
                if (card !== div && b && b.style.display === "flex") { b.style.display = "none"; if (s) s.style.transform = ""; card.style.boxShadow = "var(--sombra)" }
            })
            body.style.display = aberto ? "none" : "flex"
            seta.querySelector("svg").style.transform = aberto ? "" : "rotate(180deg)"
            div.style.boxShadow = aberto ? "var(--sombra)" : "var(--sombra-forte)"
            if (!aberto && !carregou) { carregou = true; carregarFichas(c.id) }
        }
        div.appendChild(header); div.appendChild(body)
        if (c.ativo) listaAtivos.appendChild(div); else listaDesativados.appendChild(div)
    })
}

async function alterarStatus(id) { if (!IS_ADMIN) return; await fetch(`/api/colaboradores/${id}/status`, { method: "PUT" }); carregarColaboradores() }
async function excluirColaborador(id) { if (!IS_ADMIN) return; if (!confirm("Tem certeza que deseja excluir este colaborador?")) return; await fetch(`/api/colaboradores/${id}`, { method: "DELETE" }); carregarColaboradores() }

// ═══════════════════════════════════════════════════════════════════════════
// HISTÓRICO
// ═══════════════════════════════════════════════════════════════════════════

async function carregarHistorico() {
    const res = await fetch("/api/historico"); const contas = await res.json()
    const lista = document.getElementById("historicoList"); lista.innerHTML = ""
    if (contas.length === 0) { lista.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--texto-suave);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem;display:block;opacity:0.35"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p style="font-family:'Barlow Condensed',sans-serif;font-size:1.1rem;font-weight:700;">Nenhuma conta paga ainda</p></div>`; return }
    const grupos = {}
    contas.forEach(c => { const dt = c.dataPagamento ? new Date(c.dataPagamento) : null; const mes = dt ? dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Sem data"; if (!grupos[mes]) grupos[mes] = []; grupos[mes].push(c) })
    Object.entries(grupos).forEach(([mes, itens]) => {
        const titulo = document.createElement("div"); titulo.style.cssText = "font-family:'Barlow Condensed',sans-serif;font-size:0.8rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--texto-suave);margin:1.25rem 0 0.5rem;padding-bottom:0.4rem;border-bottom:2px solid var(--cinza-borda);"
        titulo.textContent = mes; lista.appendChild(titulo)
        itens.forEach(c => {
            const card = document.createElement("div"); card.style.cssText = "background:var(--branco);border:1.5px solid var(--cinza-borda);border-left:4px solid #1a7a4a;border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;box-shadow:var(--sombra);"
            const dtPag = c.dataPagamento ? new Date(c.dataPagamento).toLocaleDateString("pt-BR") : "—"
            const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.valor || 0)
            card.innerHTML = `<div style="flex:1;min-width:0;"><p style="font-size:0.92rem;font-weight:600;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.descricao}</p><p style="font-size:0.75rem;color:var(--texto-suave);margin-top:2px;">${c.categoria} &nbsp;·&nbsp; Pago em ${dtPag}</p></div><div style="display:flex;align-items:center;gap:10px;flex-shrink:0;"><span style="font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:700;color:#1a7a4a;">${valor}</span><span style="background:#dcfce7;color:#15803d;font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:0.06em;">PAGO</span></div>`
            lista.appendChild(card)
        })
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// NOVA FICHA / SEÇÃO
// ═══════════════════════════════════════════════════════════════════════════

function abrirModalNovaFicha(colabId, secao) {
    _secaoAtual = secao
    const colaborador = JSON.parse(
        document.querySelector(`[data-colab-id="${colabId}"]`)?.dataset.colabJson || "{}"
    )
    abrirModalFicha(colaborador)
}

async function renderizarFichasEmContas() {
    const container = document.getElementById("fichasColabContainer");
    if (!container) return;

    try {
        const res = await fetch("/api/dashboard/fichas");
        if (!res.ok) return;
        const fichas = await res.json();
        if (fichas.length === 0) { container.innerHTML = ""; return; }

        const porColab = {};
        fichas.forEach(f => {
            if (!porColab[f.colaborador_id]) {
                porColab[f.colaborador_id] = {
                    nome: f.colab_nome,
                    cargo: f.colab_cargo,
                    fichas: []
                };
            }

            let liquido = 0;
            try {
                const dados    = JSON.parse(f.conteudo || "{}");
                const campos   = f.tipo === "meta" ? CAMPOS_META : CAMPOS_NORMAL;
                const riscados = dados["__riscados__"] || {};
                const extras   = dados["__outros__"] || [];

                campos.forEach(c => {
                    if (!c.soValor || riscados[c.key] || c.soCaixa) return;
                    const v = parseMoeda(dados[c.key] || "0");
                    if (!c.somenteDesconto && !c.excluiLiquido) liquido += v;
                    if (c.somenteDesconto) liquido -= v;
                    if (c.temDesconto && !c.excluiLiquido) {
                        const kd = c.keyDesc || null;
                        if (kd) liquido -= parseMoeda(dados[kd] || "0");
                    }
                });
                extras.forEach(ex => {
                    if (ex.riscado) return;
                    liquido += parseMoeda(ex.valor || "0");
                    liquido -= parseMoeda(ex.desconto || "0");
                });
            } catch(e) {}

            porColab[f.colaborador_id].fichas.push({
                id:        f.id,
                nome:      f.nome_ficha,
                liquido,
                criado_em: f.criado_em || null
            });
        });

        container.innerHTML = "";

        const titulo = document.createElement("div");
        titulo.className = "categoria-bloco";
        titulo.style.cssText = "--cat-cor: #1e4d8c;";

        const header = document.createElement("div");
        header.className = "categoria-header";

        const left = document.createElement("div");
        left.className = "categoria-header-left";
        left.innerHTML = `
            <div class="categoria-icon" style="background:#1e4d8c20;color:#1e4d8c;font-size:14px;font-weight:700;">CO</div>
            <div>
                <span class="categoria-nome">Colaboradores</span>
                <span class="categoria-count">${fichas.length} ficha${fichas.length !== 1 ? "s" : ""} pendente${fichas.length !== 1 ? "s" : ""}</span>
            </div>`;

        const totalGeral = Object.values(porColab)
            .flatMap(c => c.fichas)
            .reduce((s, f) => s + f.liquido, 0);

        const right = document.createElement("div");
        right.className = "categoria-header-right";
        right.innerHTML = `
            <span class="categoria-total" style="color:#1e4d8c">${formatarMoeda(totalGeral)}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20"
                fill="currentColor" style="color:var(--texto-suave);transition:transform 0.3s;flex-shrink:0;">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>`;

        header.appendChild(left);
        header.appendChild(right);

        const lista = document.createElement("div");
        lista.className = "contas-lista";
        lista.style.display = "none";

Object.entries(porColab).forEach(([colabId, { nome, cargo, fichas: fichasColab }]) => {
    fichasColab.forEach(f => {
        const card = document.createElement("div");
        card.className = "conta-card";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <div class="conta-card-barra" style="background:#1e4d8c;"></div>
            <div class="conta-card-corpo">
                <div class="conta-card-topo">
                    <span class="conta-descricao">${nome}</span>
                    <span class="conta-valor">${formatarMoeda(f.liquido)}</span>
                </div>
                <div class="conta-card-rodape">
                    <span class="conta-metodo">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2">
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/>
                        </svg>
                        ${cargo || "Colaborador"}
                    </span>
                    <span class="badge badge-normal">${f.nome}</span>
                </div>
            </div>
            <svg class="conta-card-seta" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        `;
        card.addEventListener("click", () => abrirFichaDeContas(parseInt(colabId), f.id));
        lista.appendChild(card);
    });
});
        let aberto = false;
        const setaEl = right.querySelector("svg");
        header.addEventListener("click", () => {
            aberto = !aberto;
            lista.style.display = aberto ? "flex" : "none";
            setaEl.style.transform = aberto ? "rotate(180deg)" : "";
        });

        titulo.appendChild(header);
        titulo.appendChild(lista);
        container.appendChild(titulo);

    } catch(e) {
        console.error("Erro ao renderizar fichas em contas:", e);
    }
}
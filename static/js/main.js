


// ================= HELPERS DE NAVEGAÇÃO =================

function setActiveView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'))
    document.getElementById(viewId).classList.add('active-view')
}

// ================= PERMISSÕES =================
const IS_ADMIN = (typeof USER_TIPO !== 'undefined') && USER_TIPO === 'admin'

// ================= ELEMENTOS DO DOM =================

const deleteButton               = document.getElementById('deleteButton')
const returnButton               = document.getElementById('returnButton')
const saldoInicialDisplay        = document.getElementById('saldoInicialDisplay')
const totalGastoDisplay          = document.getElementById('totalGastoDisplay')
const ajusteGastosDisplay        = document.getElementById('ajusteGastosDisplay')
const saldoFinalElement          = document.getElementById('saldoFinal')
const contaForm                  = document.getElementById('contaForm')
const categoriasList             = document.getElementById('categoriasList')
const detalhesNomeElement        = document.getElementById('detalhesNome')
const detalhesValorElement       = document.getElementById('detalhesValor')
const detalhesVencimentoElement  = document.getElementById('detalhesVencimento')
const detalhesMetodoTipoElement  = document.getElementById('detalhesMetodoTipo')
const detalhesObservacoesElement = document.getElementById('detalhesObservacoes')
const metodoPagamentoInput       = document.getElementById('metodoPagamentoInput')
const copyButton                 = document.getElementById('copyButton')
const pagaCheck                  = document.getElementById('pagaCheck')
const popupOverlay               = document.getElementById('popupOverlay')
const popupMessage               = document.getElementById('popupMessage')
const confettiContainer          = document.getElementById('confettiContainer')
const showOverdueOnlyCheck       = document.getElementById('showOverdueOnlyCheck')
const overdueTitleElement        = document.getElementById('overdueTitle')
const detalhesAtualizacaoElement = document.getElementById('detalhesAtualizacao')
const historicoList              = document.getElementById('historicoList')

const csvFileInput              = document.getElementById('csvFileInput')
const importButton              = document.getElementById('importButton')
const importMessage             = document.getElementById('importMessage')
const addContaHeader            = document.getElementById('addContaHeader')
const addContaContent           = document.getElementById('addContaContent')
const atualizacaoValoresHeader  = document.getElementById('atualizacaoValoresHeader')
const atualizacaoValoresContent = document.getElementById('atualizacaoValoresContent')
const saldoInicialInput         = document.getElementById('saldoInicialInput')
const updateSaldoButton         = document.getElementById('updateSaldoButton')

const CSV_FILE_HEADERS = ["categoria","descricao","valor","vencimento","metodoPagamentoTipo","metodoPagamento","observacoes"]

let contas = {}
let saldoInicial = 0
let contaAtualIndex = -1
let contaAtualCategoria = ''

// ================= UTILITÁRIO: DATA BR =================
function dataParaBR(str) {
    if (!str) return ''
    const partes = str.split('-')
    if (partes.length !== 3) return str
    return `${partes[2]}/${partes[1]}/${partes[0]}`
}

// ================= CATEGORIAS DINÂMICAS =================

let _categorias = []

function getCorCategoria(nome) {
    const cat = _categorias.find(c => c.nome === nome)
    return cat ? cat.cor : "#5a6a85"
}

async function carregarCategorias() {
    const res   = await fetch("/api/categorias")
    _categorias = await res.json()
    preencherSelectCategoria()
    renderizarListaCategorias()
}

function preencherSelectCategoria() {
    const sel = document.getElementById("categoriaInput")
    if (!sel) return
    const valorAtual = sel.value
    sel.innerHTML = '<option value="" disabled selected>Selecione a Categoria</option>'
    _categorias.forEach(cat => {
        const opt = document.createElement("option")
        opt.value       = cat.nome
        opt.textContent = cat.nome
        if (cat.nome === valorAtual) opt.selected = true
        sel.appendChild(opt)
    })
}

function renderizarListaCategorias() {
    const lista = document.getElementById("listaCategorias")
    if (!lista) return
    lista.innerHTML = ""

    if (_categorias.length === 0) {
        lista.innerHTML = `<p style="font-size:0.85rem;color:#aab2c0;text-align:center;
            padding:1rem;">Nenhuma categoria cadastrada.</p>`
        return
    }

  _categorias.forEach(cat => {
    const item = document.createElement("div")
    item.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        padding:8px 12px;background:var(--branco);border:1.5px solid var(--cinza-borda);
        border-left:4px solid ${cat.cor || '#5a6a85'};border-radius:8px;
        font-size:0.85rem;
    `
    item.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:12px;height:12px;border-radius:50%;
                background:${cat.cor || '#5a6a85'};display:inline-block;"></span>
            <span style="font-weight:600;color:var(--texto);">${cat.nome}</span>
        </div>
        ${IS_ADMIN ? `<button onclick="excluirCategoria(${cat.id}, '${cat.nome}')"
            style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:0.8rem;
            font-weight:700;padding:2px 8px;border-radius:5px;opacity:0.7;"
            title="Excluir categoria">✕</button>` : ''}
    `
    lista.appendChild(item)
})
}

async function adicionarCategoria() {
    const nomeInput = document.getElementById("nomeNovaCategoria")
    const corInput  = document.getElementById("corNovaCategoria")
    const nome = nomeInput.value.trim()
    if (!nome) { nomeInput.focus(); return }

    const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cor: corInput.value })
    })

    if (res.ok) {
        nomeInput.value = ""
        corInput.value  = "#1e4d8c"
        await carregarCategorias()
        mostrarPopup("Categoria adicionada!")
    } else {
        const err = await res.json()
        alert(err.erro || "Erro ao adicionar categoria.")
    }
}

async function excluirCategoria(id, nome) {
    if (!confirm(`Excluir a categoria "${nome}"?\n\nContas com essa categoria não serão afetadas.`)) return
    const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" })
    if (res.ok) {
        await carregarCategorias()
        mostrarPopup("Categoria excluída.")
    } else {
        alert("Erro ao excluir categoria.")
    }
}

// ================= APLICAR RESTRIÇÕES DE USER =================

function aplicarRestricoesUser() {
    if (IS_ADMIN) return
    if (deleteButton) deleteButton.style.display = 'none'
}

// ================= UTILITÁRIOS =================

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function gerarConfetes(quantidade) {
    confettiContainer.innerHTML = ''
    const cores = ['#ef4444','#22c55e','#3b82f6','#f59e0b','#ec4899']
    for (let i = 0; i < quantidade; i++) {
        const c = document.createElement('div')
        c.className = 'confetti'
        c.style.left = `${Math.random() * 100}vw`
        c.style.animationDuration = `${Math.random() * 1.5 + 1}s`
        c.style.backgroundColor = cores[Math.floor(Math.random() * cores.length)]
        confettiContainer.appendChild(c)
    }
}

function mostrarPopup(mensagem, comConfetes = false, tempo = 1500) {
    popupMessage.textContent = mensagem
    popupOverlay.classList.add('show')

    if (comConfetes) gerarConfetes(50)

    setTimeout(() => {
        popupOverlay.classList.remove('show')
        setTimeout(() => confettiContainer.innerHTML = '', 300)
    }, tempo)
}

function formatarDataRelativa(dataString, alteradoPor = "") {
    if (!dataString) return ''
    const data = new Date(dataString)
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const dataSemHora = new Date(dataString); dataSemHora.setHours(0,0,0,0)
    const diffDias = Math.floor((hoje - dataSemHora) / (1000*60*60*24))
    let diaRelativo = diffDias === 0 ? 'hoje'
        : diffDias === 1 ? 'ontem'
        : diffDias === 2 ? 'anteontem'
        : `${diffDias} dias atrás`
    const horas   = data.getHours().toString().padStart(2,'0')
    const minutos = data.getMinutes().toString().padStart(2,'0')
    // Nome: pega só o primeiro nome para não poluir
    const primeiroNome = alteradoPor ? alteradoPor.trim().split(" ")[0] : ""
    const sufixo = primeiroNome ? ` por ${primeiroNome}` : ""
    return `Atualizado ${diaRelativo}, às ${horas}:${minutos}${sufixo}`
}
// ================= TOTAIS =================

async function atualizarTotais() {
    let totalPago = 0, totalAPagar = 0
    Object.keys(contas).forEach(cat => {
        contas[cat].forEach(c => {
            if (c.paga) totalPago += parseFloat(c.valor)
            else totalAPagar += parseFloat(c.valor)
        })
    })

    try {
        const res = await fetch("/api/dashboard/fichas")
        if (res.ok) {
            const fichas = await res.json()
            fichas.forEach(f => {
                let liquido = 0
                try {
                    const dados    = JSON.parse(f.conteudo || "{}")
                    const campos   = f.tipo === "meta" ? CAMPOS_META : CAMPOS_NORMAL
                    const riscados = dados["__riscados__"] || {}
                    const extras   = dados["__outros__"] || []

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

                totalAPagar += liquido
            })
        }
} catch(e) {}

    await renderizarFichasEmContas();

    saldoInicialDisplay.textContent = formatarMoeda(saldoInicial)
    totalGastoDisplay.textContent   = formatarMoeda(totalPago)
    ajusteGastosDisplay.textContent = formatarMoeda(totalAPagar)
    saldoFinalElement.textContent   = formatarMoeda(saldoInicial - totalPago - totalAPagar)
}

// ================= ABRIR FICHA A PARTIR DAS CONTAS =================

async function abrirFichaDeContas(colaboradorId, fichaId) {
    document.querySelectorAll('.navItem').forEach(b => b.classList.remove('active'))
    document.getElementById('btnColaboradores').classList.add('active')
    setActiveView('colaboradoresView')

    await carregarColaboradores()

    const cardColab = document.querySelector(`[data-colab-id="${colaboradorId}"]`)
    if (!cardColab) return

    const headerColab = cardColab.querySelector(':scope > div:first-child')
    if (headerColab) headerColab.click()

    setTimeout(() => {
        cardColab.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)

    setTimeout(async () => {
        const res = await fetch(`/api/fichas/${colaboradorId}`)
        const fichas = await res.json()
        const ficha = fichas.find(f => f.id === fichaId)
        if (!ficha) return
        const colaborador = JSON.parse(cardColab.dataset.colabJson || '{}')
        abrirFicha(ficha, colaborador)
    }, 600)
}

// ================= CARREGAR DO SERVIDOR =================

async function carregarSaldoDoServidor() {
    const res  = await fetch("/api/saldo")
    const data = await res.json()
    saldoInicial = data.valor || 0
    atualizarTotais()
}

async function carregarContasDoServidor() {
    const res = await fetch("/api/contas")
    if (!res.ok) { console.error("Erro ao buscar contas"); return }
    const dados = await res.json()
    contas = {}
    dados.forEach(conta => {
        const cat = conta.categoria || "Outros"
        if (!contas[cat]) contas[cat] = []
        contas[cat].push({ ...conta, valor: parseFloat(conta.valor) })
    })
    renderizarCategorias(showOverdueOnlyCheck.checked)
}

// ================= RENDERIZAR CATEGORIAS =================

function renderizarCategorias(showOverdueOnly = false) {
    categoriasList.innerHTML = ''
    const today = new Date().toISOString().split('T')[0]
    const hasOverdue = Object.values(contas).flat().some(c => !c.paga && c.vencimento < today)
    overdueTitleElement.textContent = hasOverdue ? 'Contas Vencidas' : 'Contas a Pagar'

    const ordemCats = [
        ..._categorias.map(c => c.nome),
        ...Object.keys(contas).filter(k => !_categorias.find(c => c.nome === k))
    ]

    ordemCats.forEach(categoria => {
        const contasCat = contas[categoria] || []
        const sorted   = [...contasCat].sort((a,b) => a.vencimento.localeCompare(b.vencimento))
        const filtered = showOverdueOnly
            ? sorted.filter(c => !c.paga && c.vencimento <= today)
            : sorted.filter(c => !c.paga)

        if (filtered.length === 0) return

        const cor   = getCorCategoria(categoria)
        const total = filtered.reduce((s, c) => s + parseFloat(c.valor), 0)

        const categoriaDiv = document.createElement('div')
        categoriaDiv.className = 'categoria-bloco'
        categoriaDiv.style.setProperty('--cat-cor', cor)

        const header = document.createElement('div')
        header.className = 'categoria-header'

        const left = document.createElement('div')
        left.className = 'categoria-header-left'
        left.innerHTML = `
            <div class="categoria-icon" style="background:${cor}20;color:${cor};
                font-size:14px;font-weight:700;letter-spacing:0.04em;">
                ${categoria.substring(0,2).toUpperCase()}
            </div>
            <div>
                <span class="categoria-nome">${categoria}</span>
                <span class="categoria-count">${filtered.length} conta${filtered.length > 1 ? 's' : ''}</span>
            </div>
        `

        const right = document.createElement('div')
        right.className = 'categoria-header-right'
        right.innerHTML = `
            <span class="categoria-total" style="color:${cor}">${formatarMoeda(total)}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20"
                fill="currentColor" style="color:var(--texto-suave);transition:transform 0.3s;flex-shrink:0;">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
        `

        header.appendChild(left)
        header.appendChild(right)

        const listaContasDiv = document.createElement('div')
        listaContasDiv.className = 'contas-lista'
        listaContasDiv.style.display = 'none'

        filtered.forEach(conta => {
            const originalIndex = contas[categoria].indexOf(conta)
            const isOverdue = !conta.paga && conta.vencimento < today
            const isHoje    = conta.vencimento === today

            let badgeClass = 'badge-normal'
            let badgeLabel = dataParaBR(conta.vencimento)
            if (isOverdue) { badgeClass = 'badge-vencida'; badgeLabel = 'VENCIDA' }
            else if (isHoje) { badgeClass = 'badge-hoje';   badgeLabel = 'HOJE' }

            const contaCard = document.createElement('div')
            contaCard.className = `conta-card${isOverdue ? ' conta-card--vencida' : ''}`
            contaCard.innerHTML = `
                <div class="conta-card-barra" style="background:${cor};"></div>
                <div class="conta-card-corpo">
                    <div class="conta-card-topo">
                        <span class="conta-descricao">${conta.descricao}</span>
                        <span class="conta-valor">${formatarMoeda(conta.valor)}</span>
                    </div>
                    <div class="conta-card-rodape">
                        <span class="conta-metodo">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2">
                                <rect x="1" y="4" width="22" height="16" rx="2"/>
                                <line x1="1" y1="10" x2="23" y2="10"/>
                            </svg>
                            ${conta.metodoPagamentoTipo || '—'}
                        </span>
                        <span class="badge ${badgeClass}">${badgeLabel}</span>
                    </div>
                </div>
                <svg class="conta-card-seta" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            `
            contaCard.addEventListener('click', () => mostrarDetalhes(conta, categoria, originalIndex))
            listaContasDiv.appendChild(contaCard)
        })

        let aberto = false
        const setaEl = right.querySelector('svg')
        header.addEventListener('click', () => {
            aberto = !aberto
            listaContasDiv.style.display = aberto ? 'flex' : 'none'
            setaEl.style.transform = aberto ? 'rotate(180deg)' : ''
        })

        categoriaDiv.appendChild(header)
        categoriaDiv.appendChild(listaContasDiv)
        categoriasList.appendChild(categoriaDiv)
    })

    atualizarTotais()
}

// ================= DETALHES =================
function mostrarDetalhes(conta, categoria, index) {
    setActiveView('detalhesView')
    detalhesAtualizacaoElement.textContent = conta.ultimaAtualizacao
        ? formatarDataRelativa(conta.ultimaAtualizacao, conta.alteradoPor || "")  // ← NOVO: segundo argumento
        : ''
    detalhesNomeElement.textContent        = conta.descricao
    detalhesValorElement.textContent       = formatarMoeda(conta.valor)
    detalhesVencimentoElement.textContent  = dataParaBR(conta.vencimento)
    detalhesMetodoTipoElement.textContent  = conta.metodoPagamentoTipo || 'Não informado'
    detalhesObservacoesElement.textContent = conta.observacoes || 'Nenhuma'
    metodoPagamentoInput.value             = conta.metodoPagamento || ''
    pagaCheck.checked                      = conta.paga || false
    contaAtualIndex                        = index
    contaAtualCategoria                    = categoria
    if (deleteButton) deleteButton.style.display = IS_ADMIN ? '' : 'none'
}
// ================= PAGAR / EXCLUIR =================

pagaCheck.addEventListener('change', async () => {
    if (!contaAtualCategoria || contaAtualIndex === -1) return
    const conta = contas[contaAtualCategoria][contaAtualIndex]
    await fetch(`/api/contas/${conta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paga: pagaCheck.checked })
    })
    mostrarPopup(pagaCheck.checked ? 'Conta marcada como paga!' : 'Conta desmarcada como paga.', pagaCheck.checked)
    await carregarContasDoServidor()
    setActiveView('contasView')
})

if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
        if (!IS_ADMIN) { mostrarPopup('Acesso negado.'); return }
        if (!contaAtualCategoria || contaAtualIndex === -1) return
        const conta = contas[contaAtualCategoria][contaAtualIndex]
        if (!confirm("Tem certeza que deseja excluir esta conta?")) return
        await fetch(`/api/contas/${conta.id}`, { method: "DELETE" })
        mostrarPopup("Conta excluída com sucesso!")
        await carregarContasDoServidor()
        setActiveView('contasView')
    })
}

// ================= HISTÓRICO =================

async function carregarHistorico() {
    const res    = await fetch("/api/historico")
    const dados  = await res.json()
    historicoList.innerHTML = ""

    if (dados.length === 0) {
        historicoList.innerHTML = `
            <div style="text-align:center;padding:3rem 1rem;color:var(--texto-suave);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.5" style="margin:0 auto 1rem;display:block;opacity:0.35">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <p style="font-family:'Barlow Condensed',sans-serif;font-size:1.1rem;font-weight:700;">
                    Nenhuma conta paga ainda
                </p>
            </div>`
        return
    }

    const grupos = {}
    dados.forEach(c => {
        const dt  = c.dataPagamento ? new Date(c.dataPagamento) : null
        const mes = dt ? dt.toLocaleDateString("pt-BR", { month:"long", year:"numeric" }) : "Sem data"
        if (!grupos[mes]) grupos[mes] = []
        grupos[mes].push(c)
    })

    Object.entries(grupos).forEach(([mes, itens]) => {
        const titulo = document.createElement("div")
        titulo.style.cssText = `
            font-family:'Barlow Condensed',sans-serif;font-size:0.8rem;font-weight:700;
            letter-spacing:0.12em;text-transform:uppercase;color:var(--texto-suave);
            margin:1.25rem 0 0.5rem;padding-bottom:0.4rem;
            border-bottom:2px solid var(--cinza-borda);
        `
        titulo.textContent = mes
        historicoList.appendChild(titulo)

        itens.forEach(c => {
            const cor  = getCorCategoria(c.categoria)
            const card = document.createElement("div")
            card.style.cssText = `
                background:var(--branco);border:1.5px solid var(--cinza-borda);
                border-left:4px solid ${cor};border-radius:10px;
                padding:12px 16px;display:flex;align-items:center;
                justify-content:space-between;gap:12px;margin-bottom:6px;
                box-shadow:var(--sombra);
            `
            const dtPag = c.dataPagamento
                ? new Date(c.dataPagamento).toLocaleDateString("pt-BR") : "—"
            const valor = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c.valor||0)

            card.innerHTML = `
                <div style="flex:1;min-width:0;">
                    <p style="font-size:0.92rem;font-weight:600;color:var(--texto);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.descricao}</p>
                    <p style="font-size:0.75rem;color:var(--texto-suave);margin-top:2px;">
                        ${c.categoria} &nbsp;·&nbsp; Pago em ${dtPag}
                    </p>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                    <span style="font-family:'Barlow Condensed',sans-serif;font-size:1rem;
                        font-weight:700;color:#1a7a4a;">${valor}</span>
                    <span style="background:#dcfce7;color:#15803d;font-size:0.68rem;
                        font-weight:700;padding:2px 8px;border-radius:999px;
                        text-transform:uppercase;letter-spacing:0.06em;">PAGO</span>
                </div>
            `
            historicoList.appendChild(card)
        })
    })
}

// ================= COPIAR =================

copyButton.addEventListener('click', () => {
    const text = metodoPagamentoInput.value
    if (!text) return
    navigator.clipboard.writeText(text)
        .then(() => mostrarPopup('Conteúdo copiado!'))
        .catch(() => mostrarPopup('Erro ao copiar.'))
})

// ================= ADICIONAR CONTA =================

if (contaForm) {
    contaForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        const novaConta = {
            categoria:           document.getElementById('categoriaInput').value,
            descricao:           document.getElementById('descricaoInput').value,
            valor:               parseFloat(document.getElementById('valorInput').value),
            vencimento:          document.getElementById('vencimentoInput').value,
            metodoPagamentoTipo: document.getElementById('metodoPagamentoTipoInput').value,
            metodoPagamento:     document.getElementById('metodoPagamentoValorInput').value,
            observacoes:         document.getElementById('observacoesInput').value
        }
        await fetch("/api/contas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(novaConta)
        })
        contaForm.reset()
        await carregarContasDoServidor()
        mostrarPopup("Conta adicionada com sucesso!")
    })
}

// ================= IMPORTAR CSV =================

if (importButton) {
    importButton.addEventListener('click', () => {
        const file = csvFileInput.files[0]
        if (!file) {
            importMessage.textContent = "Por favor, selecione um arquivo .csv primeiro."
            return
        }
        const reader = new FileReader()
reader.onload = async function(e) {
    try {
        const rows = e.target.result
            .split('\n')
            .map(r => r.trim())
            .filter(r => r.length > 0)

        if (rows.length < 2) throw new Error("Arquivo vazio ou sem dados suficientes.")

        // Detecta separador automaticamente (vírgula ou ponto e vírgula)
        const separador = rows[0].includes(';') ? ';' : ','

        const headers = rows[0].split(separador).map(h => h.trim().replace(/^"|"$/g, ''))
        if (JSON.stringify(headers) !== JSON.stringify(CSV_FILE_HEADERS))
            throw new Error(`Cabeçalhos inválidos. Esperado: ${CSV_FILE_HEADERS.join(', ')}`)

        importMessage.textContent = "Importando..."
        importButton.disabled = true

        let importedCount = 0, erros = 0

        for (const row of rows.slice(1)) {
            // Split respeitando campos entre aspas
            const values = row.split(separador).map(v => v.trim().replace(/^"|"$/g, ''))

            // Preenche campos faltando com string vazia
            while (values.length < CSV_FILE_HEADERS.length) values.push('')

            const novaConta = {
                categoria:           values[0],
                descricao:           values[1],
                valor:               parseFloat(values[2].replace(',', '.')),
                vencimento:          values[3],
                metodoPagamentoTipo: values[4],
                metodoPagamento:     values[5],
                observacoes:         values[6] || ""
            }

            if (!novaConta.categoria || !novaConta.descricao || isNaN(novaConta.valor)) continue

            const res = await fetch("/api/contas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(novaConta)
            })

            if (res.ok) importedCount++
            else erros++
        }

        await carregarContasDoServidor()
        csvFileInput.value = ""

        if (erros > 0)
            importMessage.textContent = `${importedCount} importada(s), ${erros} com erro.`
        else
            importMessage.textContent = `✅ ${importedCount} conta(s) importada(s) com sucesso!`

        if (importedCount > 0) mostrarPopup(`${importedCount} conta(s) importada(s)!`)

    } catch (err) {
        importMessage.textContent = `Erro: ${err.message}`
    } finally {
        importButton.disabled = false
    }
}
        reader.readAsText(file)
    })
}

// ================= SALDO =================

if (updateSaldoButton) {
    updateSaldoButton.addEventListener('click', async () => {
        const newSaldo = parseFloat(saldoInicialInput.value)
        if (isNaN(newSaldo)) return
        await fetch("/api/saldo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valor: newSaldo })
        })
        saldoInicial = newSaldo
        atualizarTotais()
        mostrarPopup('Saldo inicial atualizado!')
        saldoInicialInput.value = ''
    })
}

// ================= SEÇÕES MINIMIZÁVEIS =================

if (addContaHeader) {
    addContaHeader.addEventListener('click', () => {
        addContaContent.classList.toggle('hidden')
        addContaHeader.querySelector('svg').classList.toggle('rotated-icon')
    })
}

if (atualizacaoValoresHeader) {
    atualizacaoValoresHeader.addEventListener('click', () => {
        atualizacaoValoresContent.classList.toggle('hidden')
        atualizacaoValoresHeader.querySelector('svg').classList.toggle('rotated-icon')
    })
}

const gerenciarCategoriasHeader  = document.getElementById('gerenciarCategoriasHeader')
const gerenciarCategoriasContent = document.getElementById('gerenciarCategoriasContent')
if (gerenciarCategoriasHeader) {
    gerenciarCategoriasHeader.addEventListener('click', () => {
        gerenciarCategoriasContent.classList.toggle('hidden')
        gerenciarCategoriasHeader.querySelector('svg').classList.toggle('rotated-icon')
    })
}

// ================= FILTRO =================

showOverdueOnlyCheck.addEventListener('change', () => {
    renderizarCategorias(showOverdueOnlyCheck.checked)
})

// ================= NAVEGAÇÃO SIDEBAR =================

document.getElementById('btnContas').addEventListener('click', () => {
    document.querySelectorAll('.navItem').forEach(b => b.classList.remove('active'))
    document.getElementById('btnContas').classList.add('active')
    setActiveView('contasView')
})

document.getElementById('btnColaboradores').addEventListener('click', () => {
    document.querySelectorAll('.navItem').forEach(b => b.classList.remove('active'))
    document.getElementById('btnColaboradores').classList.add('active')
    setActiveView('colaboradoresView')
    carregarColaboradores()
})

document.getElementById('btnHistorico').addEventListener('click', () => {
    document.querySelectorAll('.navItem').forEach(b => b.classList.remove('active'))
    document.getElementById('btnHistorico').classList.add('active')
    setActiveView('historicoView')
    carregarHistorico()
})

if (returnButton) {
    returnButton.addEventListener('click', () => {
        setActiveView('contasView')
    })
}

// ================= INICIALIZAÇÃO =================

document.addEventListener('DOMContentLoaded', async () => {
    aplicarRestricoesUser()
    await carregarCategorias()
    await carregarSaldoDoServidor()
    await carregarContasDoServidor()
})
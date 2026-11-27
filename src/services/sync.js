// Sincronização Firebird -> PostgreSQL (wb_empresas).
//
// A cada ciclo lê todos os clientes do Firebird e faz UPSERT por CNPJ no
// Postgres: insere os novos e atualiza os existentes (licenças, chave,
// limite de NFes e pacotes mudam com o tempo, então não basta copiar os novos).
//
// Uso:
//   npm install node-firebird
//   node src/services/sync.js

require("dotenv").config();

const Firebird = require("node-firebird");
const { clientes } = require("../config/database");

const firebirdOptions = {
    host: process.env.FB_HOST || "127.0.0.1",
    port: Number(process.env.FB_PORT || 3050),
    database: process.env.FB_DATABASE || "C:\\dados\\BANCO.FDB",
    user: process.env.FB_USER || "SYSDBA",
    password: process.env.FB_PASSWORD || "masterkey",
    lowercase_keys: true, // nomes de coluna voltam em minúsculo
};

// Padrão: 5 minutos. Pode ser alterado com SYNC_INTERVAL_MS no .env.
const INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 300_000);

let timer = null;
let rodando = false;

// Tabela e colunas do Firebird.
// Colunas com null ainda não foram encontradas no Firebird: ficam fora do
// SELECT e do UPDATE, então o valor que já está no Postgres é preservado.
const FIREBIRD_TABLE = process.env.FB_TABELA_CLIENTES || "CLIENTES";
const MAPA = {
    razao_social: "RAZAO_SOCIAL",          // Razão social
    nome_fantasia: "FANTASIA",             // Fantasia
    cnpj: "CNPJ",                          // CNPJ
    chave: null,                           // Chave (dias) -> também define o status. TODO
    max_licencas: "NUM_LICENCA",           // Quantidade de licenças (confirmar)
    quantidade_notas: null,                // Limite de NFes. TODO
    detalhamento_pacotes: null,            // Pacotes contratados. TODO
};

// Como cada coluna é convertida antes de ir para o Postgres.
const CONVERSAO = {
    razao_social: texto,
    nome_fantasia: texto,
    cnpj: texto,
    chave: (v) => (texto(v) === null ? null : inteiro(v)),
    max_licencas: inteiro,
    quantidade_notas: inteiro,
    detalhamento_pacotes: texto,
};

const COLUNAS_MAPEADAS = Object.keys(MAPA).filter((coluna) => MAPA[coluna]);

// Abre uma conexão Firebird, executa uma consulta e fecha.
function firebirdQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        Firebird.attach(firebirdOptions, (err, db) => {
            if (err) return reject(err);
            db.query(sql, params, (err, rows) => {
                if (err) {
                    db.detach();
                    return reject(err);
                }
                lerBlobs(rows)
                    .then(resolve, reject)
                    .finally(() => db.detach());
            });
        });
    });
}

// Campos BLOB SUB_TYPE TEXT chegam como função no node-firebird; lê o conteúdo.
async function lerBlobs(rows) {
    for (const row of rows) {
        for (const [col, valor] of Object.entries(row)) {
            if (typeof valor !== "function") continue;
            row[col] = await new Promise((resolve, reject) => {
                valor((err, _name, emitter) => {
                    if (err) return reject(err);
                    const partes = [];
                    emitter.on("data", (c) => partes.push(c));
                    emitter.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
                    emitter.on("error", reject);
                });
            });
        }
    }
    return rows;
}

function texto(valor) {
    if (valor === null || valor === undefined) return null;
    if (Buffer.isBuffer(valor)) valor = valor.toString("utf8");
    const t = String(valor).trim(); // CHAR do Firebird vem com espaços à direita
    return t === "" ? null : t;
}

function inteiro(valor) {
    const n = Number(texto(valor));
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

// Converte uma linha do Firebird em um objeto com só as colunas mapeadas.
function converter(row) {
    const empresa = {};

    for (const coluna of COLUNAS_MAPEADAS) {
        empresa[coluna] = CONVERSAO[coluna](row[MAPA[coluna].toLowerCase()]);
    }

    empresa.cnpj = (empresa.cnpj || "").replace(/\D/g, "");
    empresa.razao_social = empresa.razao_social || empresa.nome_fantasia || empresa.cnpj;

    if ("chave" in empresa) {
        empresa.status = (empresa.chave || 0) > 0 ? "Ativa" : "Inativa";
    }

    return empresa;
}

// Grava uma empresa no Postgres (insere ou atualiza pelo CNPJ).
async function gravarEmpresa(db, empresa) {
    const colunas = Object.keys(empresa);
    const valores = Object.values(empresa);
    const parametros = colunas.map((_, i) => `$${i + 1}`);
    const atualizacoes = colunas
        .filter((coluna) => coluna !== "cnpj")
        .map((coluna) => `${coluna} = EXCLUDED.${coluna}`);

    await db.query(
        `INSERT INTO public.wb_empresas (${colunas.join(", ")}, ultima_sincronizacao)
         VALUES (${parametros.join(", ")}, NOW())
         ON CONFLICT (cnpj) DO UPDATE SET
            ${atualizacoes.join(",\n            ")},
            ultima_sincronizacao = NOW(),
            atualizado_em = NOW()`,
        valores
    );
}

// Executa uma sincronização completa. `db` pode ser o pool ou um client em
// transação (usado em testes); `limite` restringe quantos clientes lê.
async function sincronizar(db = clientes, { limite } = {}) {
    const first = limite ? `FIRST ${Number(limite)} ` : "";
    const rows = await firebirdQuery(
        `SELECT ${first}${COLUNAS_MAPEADAS.map((c) => MAPA[c]).join(", ")} FROM ${FIREBIRD_TABLE}`
    );

    const resultado = { processados: 0, ignorados: 0, cnpjs: [] };

    for (const row of rows) {
        const empresa = converter(row);

        if (empresa.cnpj.length !== 14) {
            resultado.ignorados++;
            continue;
        }

        await gravarEmpresa(db, empresa);
        resultado.processados++;
        resultado.cnpjs.push(empresa.cnpj);
    }

    return resultado;
}

async function sync() {
    try {
        const { processados, ignorados } = await sincronizar();

        console.log(
            `[SYNC] ${processados} empresa(s) sincronizada(s)` +
            (ignorados ? `, ${ignorados} ignorada(s) por CNPJ inválido.` : ".")
        );
    } catch (err) {
        console.error("[SYNC] Erro na sincronização:", err.message);
    } finally {
        // Agenda a próxima verificação só depois que esta terminou.
        if (rodando) timer = setTimeout(sync, INTERVAL_MS);
    }
}

function iniciarSincronizacao() {
    if (rodando) return;
    rodando = true;
    console.log(`[SYNC] Sincronização iniciada (intervalo: ${INTERVAL_MS / 1000}s).`);
    sync();
}

function pararSincronizacao() {
    rodando = false;
    if (timer) clearTimeout(timer);
    timer = null;
}

module.exports = { iniciarSincronizacao, pararSincronizacao, sincronizar };

// Execução avulsa: node src/services/sync.js
if (require.main === module) {
    iniciarSincronizacao();
}

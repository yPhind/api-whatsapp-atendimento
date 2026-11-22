
// src/scripts/migrarClientes.js

require("dotenv").config();

const { atendimento, clientes } = require("../config/database");

function normalizar(valor) {
    return valor === null || valor === undefined
        ? null
        : String(valor).trim();
}

function adicionarConflito(conflitos, tipo, identificador, descricao) {
    conflitos.push({
        tipo,
        identificador,
        descricao
    });
}

function verificarConflitos(empresasOrigem, usuariosOrigem, empresasDestino, usuariosDestino) {
    const conflitos = [];

    const empresasPorId = new Map(
        empresasDestino.map(item => [String(item.id), item])
    );

    const empresasPorCnpj = new Map(
        empresasDestino.map(item => [normalizar(item.cnpj), item])
    );

    const usuariosPorId = new Map(
        usuariosDestino.map(item => [String(item.id), item])
    );

    const usuariosPorTelefone = new Map(
        usuariosDestino.map(item => [normalizar(item.telefone), item])
    );

    const usuariosPorWhatsapp = new Map(
        usuariosDestino
            .filter(item => item.whatsapp_id)
            .map(item => [normalizar(item.whatsapp_id), item])
    );

    for (const empresa of empresasOrigem) {
        const porId = empresasPorId.get(String(empresa.id));
        const porCnpj = empresasPorCnpj.get(normalizar(empresa.cnpj));

        if (porId && normalizar(porId.cnpj) !== normalizar(empresa.cnpj)) {
            adicionarConflito(
                conflitos,
                "empresa",
                empresa.id,
                "O ID já existe no destino com outro CNPJ."
            );
        }

        if (porCnpj && String(porCnpj.id) !== String(empresa.id)) {
            adicionarConflito(
                conflitos,
                "empresa",
                empresa.cnpj,
                "O CNPJ já existe no destino com outro ID."
            );
        }
    }

    for (const usuario of usuariosOrigem) {
        const porId = usuariosPorId.get(String(usuario.id));
        const porTelefone = usuariosPorTelefone.get(normalizar(usuario.telefone));
        const porWhatsapp = usuario.whatsapp_id
            ? usuariosPorWhatsapp.get(normalizar(usuario.whatsapp_id))
            : null;

        if (porId && normalizar(porId.telefone) !== normalizar(usuario.telefone)) {
            adicionarConflito(
                conflitos,
                "usuário",
                usuario.id,
                "O ID já existe no destino com outro telefone."
            );
        }

        if (porTelefone && String(porTelefone.id) !== String(usuario.id)) {
            adicionarConflito(
                conflitos,
                "usuário",
                usuario.telefone,
                "O telefone já existe no destino com outro ID."
            );
        }

        if (porWhatsapp && String(porWhatsapp.id) !== String(usuario.id)) {
            adicionarConflito(
                conflitos,
                "usuário",
                usuario.whatsapp_id,
                "O WhatsApp ID já existe no destino com outro usuário."
            );
        }
    }

    const idsEmpresasOrigem = new Set(
        empresasOrigem.map(item => String(item.id))
    );

    const idsEmpresasDestino = new Set(
        empresasDestino.map(item => String(item.id))
    );

    for (const usuario of usuariosOrigem) {
        if (!usuario.empresa_id) continue;

        const empresaExiste =
            idsEmpresasOrigem.has(String(usuario.empresa_id)) ||
            idsEmpresasDestino.has(String(usuario.empresa_id));

        if (!empresaExiste) {
            adicionarConflito(
                conflitos,
                "referência de empresa",
                usuario.id,
                `A empresa ${usuario.empresa_id} não foi encontrada.`
            );
        }
    }

    return conflitos;
}

async function atualizarSequencia(client, tabela) {
    await client.query(
        `
        SELECT setval(
            pg_get_serial_sequence($1, 'id'),
            COALESCE((SELECT MAX(id) FROM public.${tabela}), 1),
            EXISTS (SELECT 1 FROM public.${tabela})
        )
        `,
        [`public.${tabela}`]
    );
}

async function validarIds(client, tabela, registros) {
    if (registros.length === 0) return;

    const ids = registros.map(item => String(item.id));

    const resultado = await client.query(
        `
        SELECT id
        FROM public.${tabela}
        WHERE id = ANY($1::bigint[])
        `,
        [ids]
    );

    const encontrados = new Set(
        resultado.rows.map(item => String(item.id))
    );

    const faltantes = ids.filter(id => !encontrados.has(id));

    if (faltantes.length > 0) {
        throw new Error(
            `Validação de ${tabela} falhou. IDs não encontrados: ${faltantes.slice(0, 20).join(", ")}`
        );
    }
}

async function migrar() {
    const executar = process.argv.includes("--executar");

    console.log("\n======================================");
    console.log(" MIGRAÇÃO DE CLIENTES");
    console.log("======================================\n");

    console.log(`Modo: ${executar ? "EXECUÇÃO REAL" : "SIMULAÇÃO"}\n`);

    const [empresasOrigemResult, usuariosOrigemResult] = await Promise.all([
        atendimento.query(`
            SELECT
                id,
                cnpj,
                razao_social,
                nome_fantasia,
                status,
                criado_em,
                atualizado_em
            FROM public.wb_empresas
            ORDER BY id
        `),

        atendimento.query(`
            SELECT
                id,
                nome,
                telefone,
                identificacao,
                whatsapp_id,
                ativo,
                criado_em,
                atualizado_em,
                empresa_id
            FROM public.wb_usuarios
            ORDER BY id
        `)
    ]);

    const [empresasDestinoResult, usuariosDestinoResult] = await Promise.all([
        clientes.query(`
            SELECT id, cnpj
            FROM public.wb_empresas
        `),

        clientes.query(`
            SELECT id, telefone, whatsapp_id
            FROM public.wb_usuarios
        `)
    ]);

    const empresasOrigem = empresasOrigemResult.rows;
    const usuariosOrigem = usuariosOrigemResult.rows;
    const empresasDestino = empresasDestinoResult.rows;
    const usuariosDestino = usuariosDestinoResult.rows;

    console.log(`Empresas encontradas na origem: ${empresasOrigem.length}`);
    console.log(`Usuários encontrados na origem: ${usuariosOrigem.length}`);
    console.log(`Empresas já existentes no destino: ${empresasDestino.length}`);
    console.log(`Usuários já existentes no destino: ${usuariosDestino.length}`);

    const conflitos = verificarConflitos(
        empresasOrigem,
        usuariosOrigem,
        empresasDestino,
        usuariosDestino
    );

    if (conflitos.length > 0) {
        console.error("\nForam encontrados conflitos. Nenhum registro foi migrado.\n");

        conflitos.slice(0, 50).forEach((conflito, index) => {
            console.error(
                `${index + 1}. [${conflito.tipo}] ${conflito.identificador}: ${conflito.descricao}`
            );
        });

        if (conflitos.length > 50) {
            console.error(`... e mais ${conflitos.length - 50} conflito(s).`);
        }

        throw new Error("Corrija os conflitos antes de executar a migração.");
    }

    console.log("\nNenhum conflito encontrado.");

    if (!executar) {
        console.log("\nSIMULAÇÃO CONCLUÍDA.");
        console.log("Nenhum dado foi alterado.");
        console.log("Para executar a migração, utilize: npm run migrar:clientes -- --executar");
        return;
    }

    const client = await clientes.connect();

    try {
        await client.query("BEGIN");

        for (const empresa of empresasOrigem) {
            await client.query(
                `
                INSERT INTO public.wb_empresas (
                    id,
                    cnpj,
                    razao_social,
                    nome_fantasia,
                    status,
                    criado_em,
                    atualizado_em
                )
                OVERRIDING SYSTEM VALUE
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                    cnpj = EXCLUDED.cnpj,
                    razao_social = EXCLUDED.razao_social,
                    nome_fantasia = EXCLUDED.nome_fantasia,
                    status = EXCLUDED.status,
                    criado_em = EXCLUDED.criado_em,
                    atualizado_em = EXCLUDED.atualizado_em
                `,
                [
                    empresa.id,
                    empresa.cnpj,
                    empresa.razao_social,
                    empresa.nome_fantasia,
                    empresa.status,
                    empresa.criado_em,
                    empresa.atualizado_em
                ]
            );
        }

        console.log(`${empresasOrigem.length} empresa(s) processada(s).`);

        for (const usuario of usuariosOrigem) {
            await client.query(
                `
                INSERT INTO public.wb_usuarios (
                    id,
                    nome,
                    telefone,
                    identificacao,
                    whatsapp_id,
                    ativo,
                    criado_em,
                    atualizado_em,
                    empresa_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    nome = EXCLUDED.nome,
                    telefone = EXCLUDED.telefone,
                    identificacao = EXCLUDED.identificacao,
                    whatsapp_id = EXCLUDED.whatsapp_id,
                    ativo = EXCLUDED.ativo,
                    criado_em = EXCLUDED.criado_em,
                    atualizado_em = EXCLUDED.atualizado_em,
                    empresa_id = EXCLUDED.empresa_id
                `,
                [
                    usuario.id,
                    usuario.nome,
                    usuario.telefone,
                    usuario.identificacao,
                    usuario.whatsapp_id,
                    usuario.ativo,
                    usuario.criado_em,
                    usuario.atualizado_em,
                    usuario.empresa_id
                ]
            );
        }

        console.log(`${usuariosOrigem.length} usuário(s) processado(s).`);

        await validarIds(client, "wb_empresas", empresasOrigem);
        await validarIds(client, "wb_usuarios", usuariosOrigem);

        await atualizarSequencia(client, "wb_empresas");
        await atualizarSequencia(client, "wb_usuarios");

        await client.query("COMMIT");

        console.log("\n======================================");
        console.log(" MIGRAÇÃO CONCLUÍDA COM SUCESSO");
        console.log("======================================");
        console.log(`Empresas validadas: ${empresasOrigem.length}`);
        console.log(`Usuários validados: ${usuariosOrigem.length}`);
        console.log("IDs originais preservados.");
        console.log("Tabelas antigas mantidas.");
    } catch (erro) {
        await client.query("ROLLBACK");
        throw erro;
    } finally {
        client.release();
    }
}

migrar().catch(erro => {
    console.error("\nERRO NA MIGRAÇÃO:");
    console.error(erro.message);
    process.exitCode = 1;
});

# Banco de Dados — API WhatsApp Atendimento

Esta pasta contém a documentação e os scripts SQL responsáveis pela estrutura dos bancos de dados auxiliares da aplicação **API WhatsApp Atendimento**.

O projeto utiliza bancos PostgreSQL separados para organizar os dados de clientes, tarefas e registros técnicos.

## 1. Arquitetura dos bancos

A aplicação trabalha com quatro bancos de dados independentes:

| Banco | Responsabilidade |
|---|---|
| `wbatendimento` | Atendimentos, usuários internos, setores, mensagens e sessões |
| `clientewbatendimento` | Empresas e contatos dos clientes |
| `tarefawbatendimento` | Tarefas dos analistas e anexos |
| `logwbatendimento` | Auditoria e registros técnicos da aplicação |

O banco principal `wbatendimento` não faz parte das migrações auxiliares documentadas nesta etapa.

### 1.1. clientewbatendimento

Responsável pelo armazenamento das empresas e dos contatos utilizados na identificação dos clientes pelo WhatsApp.

**Tabelas:**

- `wb_empresas`: cadastro das empresas, incluindo CNPJ, razão social, nome fantasia e situação cadastral.
- `wb_usuarios`: cadastro dos contatos, incluindo nome, telefone, identificador do WhatsApp e vínculo lógico com a empresa.

### 1.2. tarefawbatendimento

Responsável pelo gerenciamento das tarefas dos analistas.

**Tabelas:**

- `wb_tarefas`: armazena título, observação, data prevista, responsável e situação da tarefa.
- `wb_tarefas_anexos`: armazena os metadados dos arquivos anexados às tarefas.

**Regras de anexos:**

- Tamanho máximo por arquivo: 50 MB.
- Formatos aceitos: PDF, JPEG e PNG.
- Até 20 arquivos por envio, conforme configuração da aplicação.
- Os arquivos físicos são armazenados no diretório `storage/tarefas`.

### 1.3. logwbatendimento

Responsável pelo armazenamento dos eventos técnicos e registros de auditoria da aplicação.

**Tabela:**

- `wb_logs`: registra nível, origem, evento, mensagem, usuário responsável, atendimento relacionado, identificador de correlação e contexto adicional.

**Níveis de registro:**

- `debug`
- `info`
- `warn`
- `error`
- `fatal`

O campo `contexto` utiliza o tipo JSONB do PostgreSQL.

## 2. Estrutura de diretórios

Os scripts de criação inicial estão organizados por banco:

```text
database/
└── migrations/
    ├── clientewbatendimento/
    │   └── 001_estrutura_inicial.sql
    │
    ├── tarefawbatendimento/
    │   └── 001_estrutura_inicial.sql
    │
    └── logwbatendimento/
        └── 001_estrutura_inicial.sql
```

Cada diretório contém a estrutura inicial correspondente ao banco identificado pelo seu nome.

## 3. Requisitos

Para utilizar os bancos de dados, é necessário:

- PostgreSQL instalado e em execução.
- Usuário PostgreSQL com permissão para criar bancos e tabelas.
- Node.js instalado.
- Variáveis de conexão configuradas no arquivo `.env`.

## 4. Configuração das conexões

A aplicação utiliza as seguintes variáveis de ambiente:

```env
DB_HOST=localhost
DB_PORT=3051
DB_USER=postgres
DB_PASSWORD=sua_senha

DB_NAME=wbatendimento
DB_ATENDIMENTO=wbatendimento
DB_CLIENTES=clientewbatendimento
DB_TAREFAS=tarefawbatendimento
DB_LOGS=logwbatendimento
```

**Observações:**

- `DB_NAME` é utilizado como alternativa quando `DB_ATENDIMENTO` não está configurado.
- `DB_CLIENTES` identifica o banco de empresas e contatos.
- `DB_TAREFAS` identifica o banco de tarefas.
- `DB_LOGS` identifica o banco de registros técnicos.
- Ajuste a porta e as credenciais conforme a instalação do PostgreSQL.

Nunca publique senhas reais no repositório.

## 5. Instalação em um ambiente novo

### Etapa 1 — Criar os bancos

No PostgreSQL, crie os bancos auxiliares:

```sql
CREATE DATABASE clientewbatendimento;
CREATE DATABASE tarefawbatendimento;
CREATE DATABASE logwbatendimento;
```

O banco principal `wbatendimento` deve ser criado e configurado conforme sua documentação própria.

### Etapa 2 — Executar as migrações

Execute cada arquivo no banco correspondente.

Exemplo utilizando `psql`:

**Banco de clientes:**

```bash
psql -U postgres -d clientewbatendimento -f database/migrations/clientewbatendimento/001_estrutura_inicial.sql
```

**Banco de tarefas:**

```bash
psql -U postgres -d tarefawbatendimento -f database/migrations/tarefawbatendimento/001_estrutura_inicial.sql
```

**Banco de logs:**

```bash
psql -U postgres -d logwbatendimento -f database/migrations/logwbatendimento/001_estrutura_inicial.sql
```

### Etapa 3 — Configurar o arquivo `.env`

Preencha as variáveis de conexão conforme a instalação local ou do servidor.

### Etapa 4 — Iniciar a aplicação

Após configurar os bancos e as credenciais, inicie a aplicação conforme os scripts definidos no `package.json`.

## 6. Regras importantes de arquitetura

### Separação dos bancos

Cada banco possui uma responsabilidade específica. A aplicação acessa cada um por meio de sua conexão correspondente.

### Relacionamentos entre bancos

Não são utilizadas chaves estrangeiras entre bancos diferentes.

Quando uma informação de outro banco for necessária, a consulta deve ser realizada pela aplicação Node.js, utilizando a conexão apropriada.

### Padrão de nomenclatura

As tabelas utilizam o prefixo:

```text
wb_
```

Esse padrão facilita a identificação das estruturas pertencentes à aplicação.

### Integridade dos dados

As restrições, índices e relacionamentos internos de cada banco são definidos nos respectivos scripts SQL.

## 7. Atenção sobre as migrações

Os arquivos `001_estrutura_inicial.sql` representam a estrutura inicial para instalações novas.

**Não execute esses arquivos diretamente nos bancos que já estão em funcionamento.**

Os bancos existentes já possuem tabelas, índices e restrições. Alterações futuras deverão ser documentadas em novas migrações específicas, com numeração sequencial e finalidade claramente identificada.

Exemplo:

```text
002_adicionar_novo_campo.sql
003_criar_novo_indice.sql
004_atualizar_restricao.sql
```

Antes de executar qualquer alteração em um banco existente, faça backup e valide o script em um ambiente de teste.

## 8. Backup e recuperação

Recomenda-se manter backups independentes dos quatro bancos.

Exemplo de exportação utilizando `pg_dump`:

```bash
pg_dump -U postgres -d clientewbatendimento -F c -f backup_clientes.dump
pg_dump -U postgres -d tarefawbatendimento -F c -f backup_tarefas.dump
pg_dump -U postgres -d logwbatendimento -F c -f backup_logs.dump
pg_dump -U postgres -d wbatendimento -F c -f backup_atendimento.dump
```

Os arquivos de backup devem ser armazenados em local seguro, fora do repositório público.

---

**Projeto:** API WhatsApp Atendimento  
**Banco de dados:** PostgreSQL  
**Backend:** Node.js / Express  
**Padrão de tabelas:** `wb_`  
**Documentação:** Estrutura e migrações dos bancos de dados.
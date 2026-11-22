# API Atendimento WhatsApp

Plataforma de atendimento ao cliente integrada à **WhatsApp Business Cloud API**, desenvolvida para centralizar conversas, organizar solicitações por setores e oferecer aos analistas e supervisores uma interface de gerenciamento dos chamados.

O projeto combina uma API REST em Node.js com uma aplicação web de atendimento, permitindo acompanhar o ciclo da solicitação desde a identificação da empresa até a conclusão do atendimento.

> **Status do projeto:** em desenvolvimento. Algumas funcionalidades e configurações podem evoluir conforme as próximas implementações.

## Objetivo

Organizar e profissionalizar o atendimento realizado pelo WhatsApp, substituindo fluxos dispersos por um processo estruturado, rastreável e compartilhado entre os setores da equipe.

A aplicação busca garantir que cada solicitação seja identificada, direcionada ao setor adequado, registrada com um protocolo e acompanhada por um analista responsável.

## Como funciona

O fluxo inicial do cliente pelo WhatsApp segue estas etapas:

1. **Identificação da empresa:** o cliente informa o CNPJ. A aplicação consulta a base de empresas e valida se o cadastro existe e está ativo.
2. **Seleção do atendimento:** após a validação, o cliente escolhe uma opção no menu interativo de suporte.
3. **Descrição da solicitação:** o cliente descreve o motivo do contato em uma mensagem.
4. **Abertura do atendimento:** a aplicação registra o chamado, vincula a empresa e o setor, gera um protocolo e registra a mensagem inicial.
5. **Atendimento pelo analista:** a equipe acompanha a fila pelo painel, assume ou recebe chamados, conversa com o cliente e atualiza o andamento até a conclusão.

Quando já existe um atendimento aberto para o telefone, novas mensagens podem ser vinculadas à conversa existente, evitando a abertura indevida de um novo chamado.

## Funcionalidades

### Atendimento via WhatsApp
- Integração com a WhatsApp Business Cloud API.
- Recebimento de mensagens por webhook.
- Menu interativo para seleção do tipo de suporte.
- Identificação da empresa por CNPJ antes da abertura do chamado.
- Validação de cadastro e situação da empresa.
- Registro de descrição, mensagens e protocolo do atendimento.
- Continuidade da conversa quando existe atendimento em aberto.
- Envio de mensagens pelo painel para o WhatsApp do cliente.

### Gestão de atendimentos
- Fila de atendimentos organizada por setor.
- Consulta dos atendimentos sob responsabilidade do analista.
- Ação para assumir um atendimento disponível.
- Atribuição de atendimentos pelo supervisor.
- Devolução de atendimentos para a fila.
- Transferência entre setores, conforme permissões.
- Alteração do status e edição de informações do atendimento.
- Consulta de conversas e histórico de atendimentos.
- Registro de eventos e logs para acompanhamento operacional.

### Painel administrativo
- Interface web para analistas e supervisores.
- Autenticação de usuários.
- Controle de acesso conforme perfil.
- Atualizações em tempo real por Socket.IO.
- Dashboard e indicadores de acompanhamento.
- Relatórios de atendimento.

### Usuários e segurança
- Autenticação com tokens JWT.
- Senhas protegidas com bcrypt.
- Validação de dados com Zod.
- Limitação de tentativas em rotas sensíveis.
- Cabeçalhos de segurança com Helmet.
- Controle de acesso por perfil e permissões.
- Fluxo de recuperação e redefinição de senha.

### Tarefas e anexos
- Cadastro e acompanhamento de tarefas.
- Separação entre tarefas em andamento e realizadas.
- Inclusão e gerenciamento de anexos.
- Suporte a arquivos PDF, JPG, JPEG e PNG, conforme os limites definidos na aplicação.

## Tecnologias utilizadas

| Tecnologia | Aplicação |
| --- | --- |
| Node.js | Ambiente de execução do servidor |
| Express 5 | API REST e rotas da aplicação |
| PostgreSQL | Persistência dos dados |
| WhatsApp Business Cloud API | Comunicação com clientes |
| Socket.IO | Comunicação e atualizações em tempo real |
| JavaScript | Lógica do backend e frontend |
| HTML5 e CSS3 | Estrutura e apresentação do painel |
| JWT | Autenticação e autorização baseada em token |
| bcrypt | Proteção de senhas |
| Zod | Validação de dados |
| Multer | Recebimento de arquivos |
| Nodemailer | Envio de e-mails |
| ExcelJS e PDFKit | Geração de relatórios e documentos |

## Arquitetura do projeto

O backend está organizado em camadas para separar responsabilidades e facilitar a manutenção:

- **config:** configurações e conexões com os bancos de dados.
- **controllers:** recebe as requisições e coordena as respostas HTTP.
- **middlewares:** autenticação, permissões e tratamento de erros.
- **repositories:** acesso e operações de persistência.
- **routes:** definição dos endpoints da API.
- **services:** regras de negócio e integrações externas.
- **realtime:** comunicação e notificações em tempo real.
- **utils:** funções auxiliares e validações.
- **scripts:** rotinas administrativas e de inicialização.

A interface web está localizada em `public/`, enquanto os scripts e arquivos de evolução do banco estão organizados em `database/`.

## Organização dos bancos de dados

A aplicação utiliza PostgreSQL e permite configurar pools separados para diferentes responsabilidades:

- **Atendimento:** dados operacionais dos chamados.
- **Clientes:** informações utilizadas na identificação das empresas.
- **Tarefas:** dados relacionados às tarefas da equipe.
- **Logs:** registros de eventos e auditoria.

Os nomes dos bancos e as credenciais são definidos por variáveis de ambiente. Consulte a configuração atual do projeto antes de preparar o ambiente.

## Requisitos

- Node.js compatível com as dependências do projeto.
- PostgreSQL.
- Conta e configuração da WhatsApp Business Cloud API para testar a integração real.
- Credenciais e permissões necessárias para acessar os bancos utilizados pela aplicação.

## Instalação e execução

1. Clone o repositório:

   ```bash
   git clone https://github.com/yPhind/api-atendimento-whatsapp.git
   cd api-atendimento-whatsapp
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente em um arquivo `.env` na raiz do projeto. Utilize os nomes esperados pelo código e preencha as credenciais do seu próprio ambiente.

   Entre as configurações utilizadas estão:

   - `PORT`
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
   - `DB_ATENDIMENTO` ou `DB_NAME`
   - `DB_CLIENTES`, `DB_TAREFAS`, `DB_LOGS`
   - `JWT_SECRET`
   - `CORS_ORIGENS`
   - Credenciais e identificadores exigidos pela integração WhatsApp e pelo serviço de e-mail.

   **Importante:** não publique o arquivo `.env`, tokens, senhas ou credenciais reais no repositório.

4. Prepare os bancos de dados e aplique os scripts SQL necessários disponíveis em `database/patches/`. A aplicação depende das estruturas correspondentes às funcionalidades habilitadas.

5. Inicie em modo de desenvolvimento:

   ```bash
   npm run dev
   ```

   Ou inicie em modo normal:

   ```bash
   npm start
   ```

Por padrão, o servidor utiliza a porta `3000`, caso a variável `PORT` não esteja definida. Com o servidor em execução, a interface web é servida pela própria aplicação.

### Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm install` | Instala as dependências |
| `npm run dev` | Inicia o servidor em modo de desenvolvimento |
| `npm start` | Inicia o servidor |
| `npm run criar:supervisor` | Executa o script de criação do usuário supervisor |

## Integração com o WhatsApp

A integração utiliza a WhatsApp Business Cloud API. Para receber mensagens, é necessário configurar o webhook na plataforma da Meta e informar à aplicação os tokens, identificadores e parâmetros exigidos pela API.

A configuração da integração real depende de uma conta válida na plataforma WhatsApp Business e das permissões concedidas ao aplicativo cadastrado na Meta.

Consulte a documentação oficial da Meta: https://developers.facebook.com/docs/whatsapp/cloud-api/

## Contribuição

Contribuições são bem-vindas! Antes de propor alterações, consulte o guia [CONTRIBUTING.md](CONTRIBUTING.md), que apresenta o fluxo de contribuição, os padrões de desenvolvimento e as orientações para abertura de issues e pull requests.

## Segurança

Não inclua dados reais de clientes, números de telefone, CNPJs, tokens, senhas ou arquivos confidenciais em issues, commits, testes ou exemplos públicos.

Ao identificar uma vulnerabilidade, evite publicar detalhes que possam facilitar sua exploração. Entre em contato com os mantenedores de forma privada.

## Licença

A licença do projeto ainda deve ser definida pelo mantenedor. Até que um arquivo de licença seja adicionado ao repositório, não presuma que o código está liberado para redistribuição ou uso sob uma licença open source específica.

## Autor

Desenvolvido por [yPhind](https://github.com/yPhind).

---

Projeto em evolução contínua, com foco em organização, rastreabilidade e eficiência no atendimento ao cliente.

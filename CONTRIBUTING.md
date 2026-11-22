# Contributing

Obrigado pelo interesse em contribuir com o **API Atendimento WhatsApp**!

Este documento reúne as orientações para propor melhorias, corrigir problemas e colaborar com a evolução do projeto de forma organizada e segura.

## Antes de começar

Antes de implementar uma alteração:

1. Consulte o [README.md](README.md) para entender o objetivo e a arquitetura da aplicação.
2. Verifique as issues existentes para evitar trabalho duplicado.
3. Em mudanças maiores, abra uma issue para discutir a proposta antes de iniciar a implementação.
4. Não publique credenciais, tokens, dados reais de clientes ou informações confidenciais.

## Como contribuir

### 1. Faça um fork do repositório

Crie um fork do projeto para sua conta GitHub:

https://github.com/yPhind/api-atendimento-whatsapp

### 2. Clone o seu fork

Substitua `SEU_USUARIO` pelo seu nome de usuário no GitHub:

```bash
git clone https://github.com/SEU_USUARIO/api-atendimento-whatsapp.git
cd api-atendimento-whatsapp
```

Adicione o repositório original como remoto:

```bash
git remote add upstream https://github.com/yPhind/api-atendimento-whatsapp.git
```

### 3. Crie uma branch

Utilize uma branch específica para cada alteração:

```bash
git checkout -b tipo/descricao-da-alteracao
```

Sugestões de prefixos:

| Prefixo | Finalidade |
| --- | --- |
| `feature/` | Nova funcionalidade |
| `fix/` | Correção de erro |
| `refactor/` | Refatoração sem alterar o comportamento esperado |
| `docs/` | Documentação |
| `test/` | Testes |
| `security/` | Melhoria relacionada à segurança |

Exemplos:

```bash
git checkout -b feature/filtro-atendimentos
git checkout -b fix/validacao-cnpj
git checkout -b docs/atualiza-readme
```

### 4. Implemente a alteração

Durante o desenvolvimento:

- Preserve a arquitetura e a separação de responsabilidades existentes.
- Mantenha regras de negócio nos serviços, persistência nos repositories, validações e respostas HTTP nos controllers e definição de endpoints nas routes.
- Evite alterar fluxos existentes sem avaliar os impactos nas demais funcionalidades.
- Respeite os perfis de acesso de analistas e supervisores.
- Considere os efeitos da alteração na integração com WhatsApp, nos registros de mensagens e nas notificações em tempo real.
- Em alterações de banco, inclua scripts SQL versionados em `database/patches/` e explique como aplicá-los.
- Não inclua dependências desnecessárias.
- Não remova dados, histórico ou regras operacionais sem discussão prévia com os mantenedores.

### 5. Valide suas alterações

Antes de enviar uma contribuição:

- Execute a aplicação e verifique se ela inicia corretamente.
- Teste os fluxos afetados pela mudança.
- Verifique os cenários de sucesso, entradas inválidas e falhas de integração.
- Confirme que as permissões de acesso continuam sendo respeitadas.
- Revise o diff para remover arquivos temporários, credenciais e dados pessoais.

Quando uma alteração depender de credenciais externas ou de um ambiente específico, descreva essa limitação no pull request. Não inclua credenciais reais para facilitar a reprodução.

### 6. Faça commits claros

Prefira mensagens curtas que indiquem o propósito da alteração:

```bash
git add .
git commit -m "feat: adiciona filtro por setor"
```

Sugestões de tipos:

- `feat:` nova funcionalidade.
- `fix:` correção.
- `refactor:` refatoração.
- `docs:` documentação.
- `test:` testes.
- `chore:` manutenção e tarefas auxiliares.

### 7. Envie sua branch

```bash
git push origin tipo/descricao-da-alteracao
```

### 8. Abra um Pull Request

No GitHub, abra um Pull Request direcionado à branch principal (`main`) do repositório original.

O Pull Request deve apresentar:

- **Objetivo:** qual problema a alteração resolve ou qual melhoria oferece.
- **Descrição:** o que foi implementado e como funciona.
- **Impactos:** quais módulos, rotas, serviços ou bancos foram afetados.
- **Banco de dados:** informe se há scripts SQL ou mudanças de estrutura.
- **Validação:** descreva os testes executados e seus resultados.
- **Evidências:** inclua capturas de tela ou exemplos sem dados reais ou confidenciais, quando aplicável.

Aguarde a análise dos mantenedores. Podem ser solicitados ajustes antes da aprovação e integração da contribuição.

## Diretrizes específicas do projeto

### Fluxo de atendimento

O fluxo principal deve ser preservado:

**Identificação da empresa → seleção do atendimento → descrição da solicitação → abertura do atendimento → atendimento pelo analista.**

Alterações nesse fluxo devem considerar a sessão do WhatsApp, a validação da empresa, a seleção do setor, a criação do protocolo e o registro da conversa.

### Bancos de dados

A aplicação possui conexões separadas por responsabilidade. Alterações devem respeitar a finalidade de cada banco e manter consistência entre as estruturas utilizadas.

Scripts SQL devem ser versionados e organizados em `database/patches/`, seguindo a divisão existente por banco.

### Segurança e privacidade

- Nunca envie arquivos `.env` ou credenciais.
- Não utilize dados reais de clientes em exemplos, testes ou capturas de tela.
- Valide entradas recebidas pela API.
- Respeite autenticação, autorização e permissões.
- Evite registrar tokens ou informações sensíveis nos logs.

## Relatando problemas

Ao abrir uma issue para relatar um erro, informe:

- O que aconteceu.
- O que era esperado.
- Passos para reproduzir o problema.
- Módulo ou funcionalidade afetada.
- Mensagens de erro relevantes, removendo dados sensíveis.
- Ambiente e versões utilizadas, quando relevantes.

Para sugerir uma funcionalidade, descreva o problema que ela pretende resolver, o comportamento esperado e os possíveis impactos no fluxo atual.

## Conduta

Esperamos uma colaboração respeitosa, objetiva e construtiva. Todas as contribuições devem considerar a qualidade do código, a segurança dos dados e a estabilidade da aplicação.

## Observação

O projeto está em desenvolvimento e suas regras, estrutura e funcionalidades podem mudar. Em caso de dúvida sobre uma alteração que afete a arquitetura ou o fluxo de atendimento, converse com os mantenedores antes de implementá-la.

Obrigado por contribuir!

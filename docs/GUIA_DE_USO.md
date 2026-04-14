# Guia de Uso — Constru Manager

## Iniciando a aplicação

**Backend** (porta 3000):
```bash
cd server
npm run dev
```

**Frontend** (porta 5173):
```bash
cd client
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

---

## Criando usuários de teste

Na primeira vez (ou ao resetar o banco), rode o seed para criar os usuários padrão:

```bash
cd server
npx prisma db seed
```

### Credenciais de acesso

| Usuário | Email | Senha | Papel |
|---------|-------|-------|-------|
| Administrador | admin@constru.dev | admin123 | ADMIN |
| Vendedor | vendas@constru.dev | sales123 | SALES |
| Financeiro | financeiro@constru.dev | finance123 | FINANCE |

---

## Papéis e permissões

| Funcionalidade | ADMIN | SALES | FINANCE |
|----------------|-------|-------|---------|
| Clientes | ✓ | ✓ | — |
| Produtos | ✓ | — | — |
| Kits | ✓ | — | — |
| Orçamentos | ✓ | ✓ | — |
| Financeiro | ✓ | — | ✓ |
| Despesas Fixas | ✓ | — | ✓ |
| Registrar usuários | ✓ | — | — |

---

## Fluxo principal: Orçamento → Venda

### 1. Cadastrar pré-requisitos

Antes de criar um orçamento, garanta que existem:

- **Cliente** — Menu *Clientes* → Novo cliente (nome, CPF/CNPJ obrigatórios)
- **Produto** *(opcional)* — Menu *Produtos* → Novo produto (preço base, markup, estoque)
- **Kit** *(opcional)* — Menu *Kits* → Novo kit (agrupa produtos com preço fixo)

### 2. Criar orçamento

1. Menu *Orçamentos* → **Novo orçamento**
2. Selecione o cliente
3. Adicione itens (produto ou kit) com quantidade — o total é calculado automaticamente
4. Informe custo de mão de obra e desconto (em centavos)
5. Clique em **Criar**

O orçamento é criado com status **PENDING_REVIEW**.

### 3. Gerenciar o orçamento

Na página de detalhe do orçamento você pode:

| Ação | Condição |
|------|----------|
| **Adicionar revisão** | Qualquer status ativo |
| **Marcar como Aceito** | Status PENDING_REVIEW |
| **Marcar como Rejeitado** | Status PENDING_REVIEW |
| **Marcar como Sem resposta** | Status PENDING_REVIEW |

### 4. Aceitar o orçamento

Ao clicar em **Aceitar**:

1. Escolha o tipo de pagamento:
   - **À vista (LUMP_SUM)** — informe entrada (pode ser 0)
   - **Parcelado (INSTALLMENTS)** — informe entrada + parcelas (data e valor de cada uma)
2. Confirme — uma **Venda** é criada automaticamente vinculada ao orçamento

---

## Status dos orçamentos

| Status | Significado |
|--------|-------------|
| `PENDING_REVIEW` | Aguardando decisão do cliente |
| `ACCEPTED` | Cliente aceitou — venda gerada |
| `REJECTED` | Cliente recusou |
| `NO_RESPONSE` | Sem retorno do cliente |

> Orçamentos com status `DRAFT` são versões intermediárias e não aparecem nas ações de status.

---

## Módulo financeiro

Acessível pelos papéis **ADMIN** e **FINANCE** via menu *Financeiro* e *Despesas Fixas*.

### Saldo em Caixa

O saldo exibido é calculado automaticamente:

```
Saldo = Saldo Inicial + Σ receitas pagas − Σ despesas pagas
```

Para definir o saldo inicial, clique em **Editar saldo inicial** no card de saldo e informe o valor em reais (ex: `5000.00`).

### Dashboard mensal

Use as setas `< >` para navegar entre meses. O dashboard exibe:

| Card | Descrição |
|------|-----------|
| **Previsto Entrar** | Soma das parcelas pendentes/vencidas no mês |
| **Previsto Sair** | Soma das despesas fixas pendentes no mês |
| **Lucro Líquido** | Receitas pagas menos despesas pagas no mês |

### Marcar parcelas como pagas

A tabela *Parcelas do Mês* lista todas as parcelas com vencimento no mês selecionado. Clique em **Marcar como pago** para registrar o recebimento — o saldo é atualizado automaticamente.

### Despesas Fixas

Menu *Despesas Fixas* → **Nova Despesa** para cadastrar uma despesa recorrente (ex: aluguel, energia).

Campos: Nome, Valor (R$), Dia de Vencimento (1–28), Categoria (opcional).

A cada vez que o dashboard financeiro é aberto para um mês, as despesas fixas ativas são registradas automaticamente para aquele mês. Na tabela *Despesas Fixas do Mês*, clique em **Marcar como pago** para registrar o pagamento.

---

## Cadastro de novos usuários

Apenas usuários com papel **ADMIN** podem registrar novos usuários.

**Via API** (autenticado como ADMIN):

```bash
POST http://localhost:3000/auth/register
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "novo@constru.dev",
  "password": "senha123",
  "role": "SALES"
}
```

Papéis disponíveis: `ADMIN`, `SALES`, `FINANCE`

---

## Referência rápida de rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Renovar token |
| POST | `/auth/logout` | Logout |
| POST | `/auth/register` | Registrar usuário (ADMIN) |
| GET | `/clients` | Listar clientes |
| POST | `/clients` | Criar cliente |
| GET | `/products` | Listar produtos |
| POST | `/products` | Criar produto |
| GET | `/kits` | Listar kits |
| POST | `/kits` | Criar kit |
| GET | `/quotes` | Listar orçamentos |
| POST | `/quotes` | Criar orçamento |
| GET | `/quotes/:id` | Detalhe do orçamento |
| POST | `/quotes/:id/versions` | Adicionar revisão |
| PATCH | `/quotes/:id/status` | Atualizar status |
| POST | `/quotes/:id/accept` | Aceitar (gera venda) |
| GET | `/fixed-expenses` | Listar despesas fixas |
| POST | `/fixed-expenses` | Criar despesa fixa |
| PUT | `/fixed-expenses/:id` | Editar despesa fixa |
| DELETE | `/fixed-expenses/:id` | Desativar despesa fixa |
| GET | `/finance/balance` | Consultar saldo inicial |
| PUT | `/finance/balance` | Definir saldo inicial |
| GET | `/finance/summary` | Dashboard mensal (`?month=&year=`) |
| PATCH | `/finance/installments/:id/pay` | Marcar parcela como paga |
| PATCH | `/finance/expense-logs/:id/pay` | Marcar despesa fixa do mês como paga |

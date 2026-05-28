# PrecoMap

Sistema empresarial de inteligência comercial que transforma XML de notas fiscais em histórico organizado de clientes, produtos, pedidos e preços.

## Funcionalidades:

- Upload de XML de NF-e/NFC-e.
- Extração automática de cliente, produtos, quantidades e preços.
- Revisão antes de salvar.
- Cadastro automático de clientes.
- Cadastro automático de produtos.
- Histórico de pedidos por cliente.
- Histórico de preços por produto.
- Cálculo de preço por embalagem.
- Cálculo de preço por unidade interna.
- Relatórios comerciais.
- Alertas de variação de preço.
- Detecção de duplicidade.
- Login por e-mail e senha via Supabase Auth.
- Sincronização cloud do banco local operacional por usuário.

## Como Executar

Instale as dependências:
```bash
npm install
```

Rode o projeto em modo desenvolvimento:
```bash
npm run dev
```

Compile o projeto:
```bash
npm run build
```

## Banco Cloud e Login

1. Crie um projeto no Supabase.
2. Rode o SQL de `supabase/schema.sql` no SQL Editor do Supabase.
3. Crie usuários em Authentication > Users.
4. Configure no Vercel as variáveis:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica
```

O app usa Supabase Auth para login e salva um snapshot JSON por usuário em `precomap_snapshots`, com RLS para cada usuário acessar apenas os próprios dados.

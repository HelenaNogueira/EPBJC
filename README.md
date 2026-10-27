# EPBJC — Requisição de Equipamentos

Aplicação web estática (HTML + CSS + JavaScript) para requisição de equipamentos por alunos.

## Funcionalidades

- Autenticação com conta Microsoft institucional.
- Restrição por tenant Microsoft Entra ID.
- Verificação adicional do domínio de email.
- Registo de requisições no Cloud Firestore.
- Estado inicial automático: `Pendente`.
- Histórico individual por aluno.
- Indicadores de pedidos pendentes, em empréstimo e devolvidos.
- Filtro por estado.
- Regras do Firestore para impedir que um aluno consulte pedidos de outros utilizadores.
- Preparado para publicação no GitHub Pages.

---

## 1. Criar o projeto Firebase

1. Acede a https://console.firebase.google.com/
2. Cria um projeto, por exemplo:
   `epbjc-requisicoes`
3. Em **Project settings > Your apps**, cria uma aplicação **Web**.
4. Copia o objeto `firebaseConfig`.
5. Abre `app.js` e substitui os valores de `firebaseConfig`.

---

## 2. Criar a base de dados

No Firebase:

1. **Build > Firestore Database**
2. **Create database**
3. Seleciona a região mais adequada.
4. Não uses regras abertas em produção.

Depois:

1. Abre o separador **Rules**.
2. Copia o conteúdo de `firestore.rules`.
3. Publica as regras.

A coleção `requisicoes` é criada automaticamente no primeiro pedido.

---

## 3. Configurar autenticação Microsoft

No Firebase:

1. **Authentication**
2. **Sign-in method**
3. Ativa **Microsoft**.

No Microsoft Entra Admin Center:

1. **App registrations > New registration**
2. Cria a aplicação.
3. Obtém:
   - Application (client) ID
   - Directory (tenant) ID
4. Cria um **Client Secret**.
5. No Firebase, introduz:
   - Client ID
   - Client Secret

### Redirect URI

No registo da aplicação Microsoft, adiciona o domínio Firebase indicado na configuração
do provider Microsoft, normalmente no formato:

`https://TEU-PROJETO.firebaseapp.com/__/auth/handler`

Usa exatamente o URI indicado pelo Firebase Console.

---

## 4. Restringir aos alunos da escola

Em `app.js`, altera:

```js
const ALLOWED_EMAIL_DOMAIN = "DOMINIO_DA_ESCOLA";
const MICROSOFT_TENANT_ID = "TENANT_ID_DA_ESCOLA";
```

Exemplo conceptual:

```js
const ALLOWED_EMAIL_DOMAIN = "alunos.escola.pt";
const MICROSOFT_TENANT_ID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
```

Não uses este exemplo sem confirmar o domínio real da EPBJC.

> A restrição por tenant é mais forte do que confiar apenas no texto do email.

---

## 5. Domínios autorizados no Firebase

Em:

**Firebase > Authentication > Settings > Authorized domains**

Adiciona:

- `localhost` para testes locais;
- `TEU-UTILIZADOR.github.io` para GitHub Pages.

---

## 6. Publicar no GitHub Pages

Cria um repositório GitHub, por exemplo:

`epbjc-requisicoes`

Coloca na raiz:

- `index.html`
- `style.css`
- `app.js`
- `firestore.rules`
- `README.md`

Depois:

1. GitHub > repositório > **Settings**
2. **Pages**
3. Em **Build and deployment**, escolhe **Deploy from a branch**
4. Branch: `main`
5. Pasta: `/ (root)`
6. Guarda.

O endereço ficará aproximadamente:

`https://TEU-UTILIZADOR.github.io/epbjc-requisicoes/`

Adiciona o domínio `TEU-UTILIZADOR.github.io` aos **Authorized domains** do Firebase Authentication.

---

## 7. Administradores / professor

As regras incluídas suportam administradores através da coleção:

`admins`

Para tornar um professor administrador:

1. O professor entra uma primeira vez na aplicação.
2. Em Firebase > Authentication > Users, copia o respetivo **UID**.
3. Em Firestore cria a coleção `admins`.
4. Cria um documento cujo **Document ID seja exatamente o UID** do professor.

Não é necessário guardar campos no documento.

Um administrador pode ler e atualizar todas as requisições através de uma futura área de gestão.

---

## 8. Estrutura de cada requisição

Exemplo:

```json
{
  "codigo": "REQ-20261013-A1B2",
  "uid": "UID_FIREBASE",
  "requisitante": "Nome do aluno",
  "email": "aluno@dominio.pt",
  "equipamento": "Portátil01",
  "dataPedido": "2026-10-13",
  "devolucaoPrevista": "2026-10-14",
  "estado": "Pendente",
  "observacoes": "Utilização numa apresentação de turma.",
  "criadoEm": "timestamp"
}
```

---

## 9. Evolução recomendada

Fase seguinte:

- área de administração/professor;
- tabela de equipamentos;
- disponibilidade automática;
- impedir duas requisições simultâneas do mesmo equipamento;
- aprovação/recusa;
- registo de devolução efetiva;
- histórico de alterações;
- QR Code por equipamento;
- pesquisa por aluno/equipamento;
- exportação CSV/PDF.

Para um sistema escolar real, a disponibilidade do equipamento deve ser confirmada na base de dados
e não apenas inferida visualmente no browser.

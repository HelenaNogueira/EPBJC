// ============================================================
// EPBJC | Requisição de Equipamentos
// Firebase Authentication (Microsoft) + Cloud Firestore
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/*
  1) No Firebase Console > Project settings > Your apps > Web app,
     copia a configuração e substitui os valores abaixo.

  2) Indica também:
     - o domínio institucional de email permitido;
     - o Tenant ID Microsoft Entra da escola.

  IMPORTANTE:
  A firebaseConfig não é uma palavra-passe. A segurança deve ser garantida
  pelas regras do Firestore e pelas configurações de autenticação.
*/

const firebaseConfig = {
  apiKey: "AIzaSyAvHFjWehOTA7FLp2iC98Ib83aQw_LAgPY",
  authDomain: "epbjc-requisicao-equipamentos.firebaseapp.com",
  projectId: "epbjc-requisicao-equipamentos",
  storageBucket: "epbjc-requisicao-equipamentos.firebasestorage.app",
  messagingSenderId: "617613639843",
  appId: "1:617613639843:web:3a1698151c3f5f6f347f16",
};

// Exemplo: "alunos.escola.pt" ou "epbjc.pt"
const ALLOWED_EMAIL_DOMAIN = "AEBJC.onmicrosoft.com";

// Microsoft Entra ID > Overview > Tenant ID
const MICROSOFT_TENANT_ID = "4334e4b0-48f4-4a76-ae54-cec847437a72";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const microsoftProvider = new OAuthProvider("microsoft.com");

// Limita o ecrã de autenticação ao tenant institucional.
if (!MICROSOFT_TENANT_ID.startsWith("COLOCA_")) {
  microsoftProvider.setCustomParameters({
    tenant: MICROSOFT_TENANT_ID,
    prompt: "select_account"
  });
}

// -------- Elementos da interface --------
const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const userArea = document.querySelector("#userArea");
const loginBtn = document.querySelector("#loginBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const userName = document.querySelector("#userName");
const userEmail = document.querySelector("#userEmail");
const newRequestBtn = document.querySelector("#newRequestBtn");
const requestDialog = document.querySelector("#requestDialog");
const closeDialogBtn = document.querySelector("#closeDialogBtn");
const cancelBtn = document.querySelector("#cancelBtn");
const requestForm = document.querySelector("#requestForm");
const equipment = document.querySelector("#equipment");
const requestDate = document.querySelector("#requestDate");
const returnDate = document.querySelector("#returnDate");
const observations = document.querySelector("#observations");
const formMessage = document.querySelector("#formMessage");
const submitBtn = document.querySelector("#submitBtn");
const requestsList = document.querySelector("#requestsList");
const statusFilter = document.querySelector("#statusFilter");
const toast = document.querySelector("#toast");

const statTotal = document.querySelector("#statTotal");
const statPending = document.querySelector("#statPending");
const statLoaned = document.querySelector("#statLoaned");
const statReturned = document.querySelector("#statReturned");

let currentRequests = [];

// -------- Utilitários --------
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

function showFormError(message) {
  formMessage.textContent = message;
  formMessage.classList.remove("hidden");
}

function clearFormError() {
  formMessage.textContent = "";
  formMessage.classList.add("hidden");
}

function isInstitutionalEmail(email = "") {
  if (!ALLOWED_EMAIL_DOMAIN || ALLOWED_EMAIL_DOMAIN.startsWith("COLOCA_")) {
    console.warn("Configura ALLOWED_EMAIL_DOMAIN antes de publicar.");
    return true; // facilita testes iniciais; as regras devem ser configuradas antes da produção.
  }

  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pt-PT").format(date);
}

function generateRequestCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `REQ-${y}${m}${d}-${random}`;
}

function setToday() {
  const today = new Date();
  const value = today.toISOString().slice(0, 10);
  requestDate.value = value;
  requestDate.min = value;
  returnDate.min = value;
}

function badgeClass(status) {
  const classes = {
    "Pendente": "badge-pending",
    "Em empréstimo": "badge-loaned",
    "Devolvido": "badge-returned",
    "Recusado": "badge-refused"
  };
  return classes[status] || "badge-pending";
}

// -------- Autenticação --------
loginBtn.addEventListener("click", async () => {
  loginBtn.disabled = true;
  loginBtn.textContent = "A iniciar sessão...";

  try {
    const result = await signInWithPopup(auth, microsoftProvider);
    const email = result.user.email || "";

    if (!isInstitutionalEmail(email)) {
      await signOut(auth);
      alert("Acesso reservado a contas institucionais da EPBJC.");
      return;
    }
  } catch (error) {
    console.error(error);

    if (error.code !== "auth/popup-closed-by-user") {
      alert("Não foi possível iniciar sessão. Confirma a configuração Microsoft no Firebase.");
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = `
      <span class="ms-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      Entrar com Microsoft
    `;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.classList.remove("hidden");
    dashboardView.classList.add("hidden");
    userArea.classList.add("hidden");
    currentRequests = [];
    return;
  }

  if (!isInstitutionalEmail(user.email || "")) {
    await signOut(auth);
    return;
  }

  userName.textContent = user.displayName || "Aluno";
  userEmail.textContent = user.email || "";

  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  userArea.classList.remove("hidden");

  await loadRequests();
});

// -------- Modal --------
newRequestBtn.addEventListener("click", () => {
  requestForm.reset();
  clearFormError();
  setToday();
  requestDialog.showModal();
});

function closeDialog() {
  clearFormError();
  requestDialog.close();
}

closeDialogBtn.addEventListener("click", closeDialog);
cancelBtn.addEventListener("click", closeDialog);

// -------- Criar requisição --------
requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormError();

  const user = auth.currentUser;

  if (!user) {
    showFormError("A tua sessão terminou. Inicia sessão novamente.");
    return;
  }

  if (!equipment.value || !requestDate.value || !returnDate.value) {
    showFormError("Preenche todos os campos obrigatórios.");
    return;
  }

  if (returnDate.value < requestDate.value) {
    showFormError("A data de devolução não pode ser anterior à data do pedido.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "A enviar...";

  try {
    await addDoc(collection(db, "requisicoes"), {
      codigo: generateRequestCode(),
      uid: user.uid,
      requisitante: user.displayName || "Aluno",
      email: user.email || "",
      equipamento: equipment.value,
      dataPedido: requestDate.value,
      devolucaoPrevista: returnDate.value,
      estado: "Pendente",
      observacoes: observations.value.trim(),
      criadoEm: serverTimestamp()
    });

    requestDialog.close();
    showToast("Pedido registado com sucesso.");
    await loadRequests();
  } catch (error) {
    console.error(error);
    showFormError("Não foi possível guardar o pedido. Verifica as regras do Firestore.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar pedido";
  }
});

// -------- Consultar requisições --------
async function loadRequests() {
  const user = auth.currentUser;
  if (!user) return;

  requestsList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <h3>A carregar pedidos...</h3>
    </div>
  `;

  try {
    // O filtro por uid também é obrigatório para satisfazer as regras de segurança.
    const q = query(
      collection(db, "requisicoes"),
      where("uid", "==", user.uid)
    );

    const snapshot = await getDocs(q);
    currentRequests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Ordenação no browser: evita exigir um índice composto no Firestore.
    currentRequests.sort((a, b) => {
      const da = a.criadoEm?.seconds || 0;
      const db = b.criadoEm?.seconds || 0;
      return db - da;
    });

    updateStats();
    renderRequests();
  } catch (error) {
    console.error(error);
    requestsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Não foi possível carregar os pedidos</h3>
        <p>Confirma a configuração do Firebase e as regras do Firestore.</p>
      </div>
    `;
  }
}

statusFilter.addEventListener("change", renderRequests);

function updateStats() {
  statTotal.textContent = currentRequests.length;
  statPending.textContent = currentRequests.filter(r => r.estado === "Pendente").length;
  statLoaned.textContent = currentRequests.filter(r => r.estado === "Em empréstimo").length;
  statReturned.textContent = currentRequests.filter(r => r.estado === "Devolvido").length;
}

function renderRequests() {
  const filter = statusFilter.value;
  const visible = filter === "Todos"
    ? currentRequests
    : currentRequests.filter(item => item.estado === filter);

  if (!visible.length) {
    requestsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>Sem pedidos para mostrar</h3>
        <p>${filter === "Todos"
          ? "Cria o primeiro pedido quando precisares de equipamento."
          : "Não tens pedidos com este estado."}
        </p>
      </div>
    `;
    return;
  }

  requestsList.innerHTML = visible.map(item => `
    <article class="request-row">
      <div class="request-main">
        <strong>${escapeHtml(item.equipamento || "Equipamento")}</strong>
        <span>${escapeHtml(item.codigo || item.id)}</span>
      </div>

      <div class="request-meta">
        <small>Pedido</small>
        <span>${formatDate(item.dataPedido)}</span>
      </div>

      <div class="request-meta">
        <small>Devolução prevista</small>
        <span>${formatDate(item.devolucaoPrevista)}</span>
      </div>

      <div class="request-meta">
        <small>Observações</small>
        <span title="${escapeHtml(item.observacoes || "")}">
          ${escapeHtml((item.observacoes || "—").slice(0, 38))}
          ${(item.observacoes || "").length > 38 ? "…" : ""}
        </span>
      </div>

      <span class="badge ${badgeClass(item.estado)}">
        ${escapeHtml(item.estado || "Pendente")}
      </span>
    </article>
  `).join("");
}

// Evita injetar HTML através de campos de texto.
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

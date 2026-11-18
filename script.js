// --- GITHUB API KONFIGURACIJA ZA SINHRONIZACIJU ---
const GH_OWNER = "lukagojkovic01-oss";
const GH_REPO = "homehub";
const GH_FILE_PATH = "data.json";

// Automatski uzmi token iz memorije pretraživača, ili pitaj korisnika ako ga nema
let GH_TOKEN = localStorage.getItem("homehub_gh_token") || "";

if (!GH_TOKEN) {
    GH_TOKEN = prompt("Unesi svoj GitHub Personal Access Token (biće sačuvan bezbedno samo na tvom uređaju):");
    if (GH_TOKEN) {
        localStorage.setItem("homehub_gh_token", GH_TOKEN.trim());
    }
}

// --- STANJE APLIKACIJE ---
let registeredAccounts = [];
let currentUser = null;
let shoppingList = [];
let todoList = [];
let eventList = [];
let expenseList = [];
let monthlyLimit = 500;
let assignableMembers = ["Svi"];

// --- INICIJALIZACIJA ---
document.addEventListener('DOMContentLoaded', async () => {
    initClock();
    
    // Učitaj podatke sa GitHub-a pre pokretanja interfejsa
    await loadDataFromGitHub();

    populateProfileSelector();
    initAuth();
    
    renderShopping();
    renderTodos();
    renderEvents();
    renderExpenses();
    initCanvas();

    // Event listeneri
    document.getElementById('shop-add-btn').addEventListener('click', addShoppingItem);
    document.getElementById('todo-add-btn').onclick = addTodoItem;
    document.getElementById('event-add-btn').addEventListener('click', addEventItem);
    document.getElementById('expense-add-btn').addEventListener('click', addExpenseItem);
    document.getElementById('set-limit-btn').addEventListener('click', changeMonthlyLimit);

    document.getElementById('personal-expense-add-btn').addEventListener('click', addPersonalExpenseItem);
    document.getElementById('set-personal-limit-btn').addEventListener('click', changePersonalLimit);

    document.getElementById('create-profile-btn').addEventListener('click', createLocalAccount);
    document.getElementById('login-profile-btn').addEventListener('click', loginLocalAccount);
    document.getElementById('logout-btn').addEventListener('click', logoutLocalAccount);

    // Automatska provera osveženja sa GitHub-a svakih 10 sekundi
    setInterval(async () => {
        await loadDataFromGitHub(true);
    }, 10000);
});

// --- GITHUB API: UČITAVANJE I ČUVANJE ---
async function loadDataFromGitHub(isBackground = false) {
    try {
        const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE_PATH}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${GH_TOKEN}` }
        });

        if (response.status === 401) {
            // Ako je token nevažeći ili obrisan, traži novi ponovo
            localStorage.removeItem("homehub_gh_token");
            GH_TOKEN = prompt("GitHub token nije validan ili je istekao. Unesi novi token:");
            if (GH_TOKEN) {
                localStorage.setItem("homehub_gh_token", GH_TOKEN.trim());
            }
            return;
        }

        if (response.ok) {
            const fileData = await response.json();
            const decodedContent = JSON.parse(decodeURIComponent(escape(atob(fileData.content))));
            
            registeredAccounts = decodedContent.accounts || [];
            currentUser = decodedContent.currentUser || null;
            shoppingList = decodedContent.shopping || [];
            todoList = decodedContent.todo || [];
            eventList = decodedContent.events || [];
            expenseList = decodedContent.expenses || [];
            monthlyLimit = decodedContent.limit || 500;
            
            window.ghFileSha = fileData.sha;

            if (isBackground) {
                populateProfileSelector();
                renderShopping();
                renderTodos();
                renderEvents();
                renderExpenses();
                renderPersonalBudget();
            }
        }
    } catch (e) {
        console.log("Greška pri učitavanju sa GitHub-a.", e);
    }
}

async function saveDataToGitHub() {
    try {
        const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE_PATH}`;
        
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${GH_TOKEN}` } });
        let sha = window.ghFileSha;
        if (getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
            window.ghFileSha = sha;
        }

        const dataObject = {
            accounts: registeredAccounts,
            currentUser: currentUser,
            shopping: shoppingList,
            todo: todoList,
            events: eventList,
            expenses: expenseList,
            limit: monthlyLimit
        };

        const jsonString = JSON.stringify(dataObject, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

        const bodyData = {
            message: "HomeHub auto-sync update",
            content: encodedContent,
            sha: sha
        };

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });

        if (putRes.ok) {
            const resJson = await putRes.json();
            window.ghFileSha = resJson.content.sha;
        }
    } catch (e) {
        console.log("Greška pri snimanju na GitHub:", e);
    }
}

// --- SAT I DATUM (LATINICA) ---
function initClock() {
    const clockEl = document.getElementById('live-clock');
    const dateEl = document.getElementById('current-date');
    
    const dani = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
    const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

    function update() {
        const now = new Date();
        clockEl.textContent = now.toTimeString().split(' ')[0];
        
        const danNaziv = dani[now.getDay()];
        const danBroj = now.getDate();
        const mesecNaziv = meseci[now.getMonth()];
        const godina = now.getFullYear();

        dateEl.textContent = `${danNaziv}, ${danBroj}. ${mesecNaziv} ${godina}.`;
    }
    update();
    setInterval(update, 1000);
}

// --- SISTEM NALOGA ---
function populateProfileSelector() {
    const selector = document.getElementById('profile-selector');
    if(!selector) return;
    selector.innerHTML = '<option value="">Izaberi nalog...</option>';
    
    registeredAccounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.name;
        opt.textContent = acc.pin ? `🔒 ${acc.name}` : acc.name;
        selector.appendChild(opt);
    });
}

function createLocalAccount() {
    const rawName = prompt("Unesite ime za novi nalog (npr. Marko, Luka):");
    if (!rawName || !rawName.trim()) return;
    
    const name = rawName.trim();
    if (registeredAccounts.some(acc => acc.name.toLowerCase() === name.toLowerCase())) {
        alert("Nalog sa tim imenom već postoji!");
        return;
    }

    const rawPin = prompt(`Postavite PIN šifru za nalog "${name}" (ostavite prazno bez šifre):`);
    const pin = rawPin ? rawPin.trim() : "";

    const newAccount = { name, pin };
    registeredAccounts.push(newAccount);
    currentUser = newAccount;
    
    populateProfileSelector();
    initAuth();
    saveDataToGitHub();
}

function loginLocalAccount() {
    const selectedName = document.getElementById('profile-selector').value;
    if (!selectedName) return;

    const account = registeredAccounts.find(acc => acc.name === selectedName);
    if (!account) return;

    if (account.pin) {
        const enteredPin = prompt(`Unesite PIN šifru za nalog "${account.name}":`);
        if (enteredPin !== account.pin) {
            alert("Pogrešan PIN!");
            return;
        }
    }

    currentUser = account;
    initAuth();
    saveDataToGitHub();
}

function logoutLocalAccount() {
    currentUser = null;
    populateProfileSelector();
    initAuth();
    saveDataToGitHub();
}

function initAuth() {
    const loggedOutControls = document.getElementById('logged-out-controls');
    const userInfo = document.getElementById('user-info');
    const avatarInitial = document.getElementById('user-avatar-initial');
    const userName = document.getElementById('user-name');

    assignableMembers = ["Svi"];

    if (currentUser) {
        loggedOutControls.classList.add('hidden');
        userInfo.classList.remove('hidden');
        avatarInitial.textContent = currentUser.name.charAt(0);
        userName.textContent = currentUser.name;
        assignableMembers.push(currentUser.name);
    } else {
        loggedOutControls.classList.remove('hidden');
        userInfo.classList.add('hidden');
    }
    
    updateAssignDropdowns();
    renderPersonalBudget();
}

function updateAssignDropdowns() {
    const selects = ['shop-assignee', 'todo-assignee', 'expense-payer'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if(!select) return;
        select.innerHTML = '';
        assignableMembers.forEach(member => {
            const opt = document.createElement('option');
            opt.value = member;
            opt.textContent = member;
            select.appendChild(opt);
        });
        if (currentUser) select.value = currentUser.name;
        else select.value = "Svi";
    });
}

// --- 1. SPISAK ZA KUPOVINU ---
function addShoppingItem() {
    const input = document.getElementById('shop-input');
    const assignee = document.getElementById('shop-assignee').value;
    if (!input.value.trim()) return;

    shoppingList.push({ id: Date.now(), text: input.value.trim(), assignee, completed: false });
    input.value = '';
    saveAndRenderShop();
}

function toggleShop(id) {
    shoppingList = shoppingList.map(item => item.id === id ? { ...item, completed: !item.completed } : item);
    saveAndRenderShop();
}

function deleteShop(id) {
    shoppingList = shoppingList.filter(item => item.id !== id);
    saveAndRenderShop();
}

function saveAndRenderShop() {
    renderShopping();
    saveDataToGitHub();
}

function renderShopping() {
    const listEl = document.getElementById('shop-list');
    const counterEl = document.getElementById('shop-counter');
    if(!listEl) return;
    listEl.innerHTML = '';
    counterEl.textContent = `${shoppingList.length} stavki`;

    if (shoppingList.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Spisak je prazan.</p>';
        return;
    }

    shoppingList.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-row';
        li.innerHTML = `
            <div class="item-content ${item.completed ? 'completed' : ''}" onclick="toggleShop(${item.id})">
                <input type="checkbox" ${item.completed ? 'checked' : ''} style="pointer-events:none;">
                <span>${item.text}</span>
                <span class="tag-assigned">${item.assignee}</span>
            </div>
            <button class="delete-btn" onclick="deleteShop(${item.id})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

// --- 2. TO-DO ---
function addTodoItem() {
    const input = document.getElementById('todo-input');
    const assignee = document.getElementById('todo-assignee').value;
    if (!input.value.trim()) return;

    todoList.push({ id: Date.now(), text: input.value.trim(), assignee, completed: false });
    input.value = '';
    saveAndRenderTodo();
}

function toggleTodo(id) {
    todoList = todoList.map(item => item.id === id ? { ...item, completed: !item.completed } : item);
    saveAndRenderTodo();
}

function deleteTodo(id) {
    todoList = todoList.filter(item => item.id !== id);
    saveAndRenderTodo();
}

function saveAndRenderTodo() {
    renderTodos();
    saveDataToGitHub();
}

function renderTodos() {
    const listEl = document.getElementById('todo-list');
    const counterEl = document.getElementById('todo-counter');
    if(!listEl) return;
    listEl.innerHTML = '';
    counterEl.textContent = `${todoList.length} zadataka`;

    if (todoList.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Nema obaveza.</p>';
        return;
    }

    todoList.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-row';
        li.innerHTML = `
            <div class="item-content ${item.completed ? 'completed' : ''}" onclick="toggleTodo(${item.id})">
                <input type="checkbox" ${item.completed ? 'checked' : ''} style="pointer-events:none;">
                <span>${item.text}</span>
                <span class="tag-assigned">${item.assignee}</span>
            </div>
            <button class="delete-btn" onclick="deleteTodo(${item.id})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

// --- 3. DOGAĐAJI ---
function addEventItem() {
    const input = document.getElementById('event-input');
    const dateInput = document.getElementById('event-date');
    const category = document.getElementById('event-category').value;

    if (!input.value.trim() || !dateInput.value) return;

    eventList.push({ id: Date.now(), text: input.value.trim(), date: dateInput.value, category });
    eventList.sort((a, b) => new Date(a.date) - new Date(b.date));

    input.value = '';
    dateInput.value = '';
    saveAndRenderEvents();
}

function deleteEvent(id) {
    eventList = eventList.filter(item => item.id !== id);
    saveAndRenderEvents();
}

function saveAndRenderEvents() {
    renderEvents();
    saveDataToGitHub();
}

function renderEvents() {
    const listEl = document.getElementById('event-list');
    const counterEl = document.getElementById('event-counter');
    if(!listEl) return;
    listEl.innerHTML = '';
    counterEl.textContent = `${eventList.length} događaja`;

    if (eventList.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Nema unetih događaja.</p>';
        return;
    }

    eventList.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-row';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(item.date);
        const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        
        let timeText = `Za ${diffDays} dana`;
        if (diffDays === 0) timeText = 'Danas!';
        else if (diffDays < 0) timeText = 'Prošlo';

        li.innerHTML = `
            <div class="item-content" style="cursor:default;">
                <span class="event-badge cat-${item.category}">${item.text}</span>
                <span style="font-size:12px; color:#94a3b8;">${item.date} (${timeText})</span>
            </div>
            <button class="delete-btn" onclick="deleteEvent(${item.id})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

// --- 4. ZAJEDNIČKI BUDŽET ---
function addExpenseItem() {
    const input = document.getElementById('expense-input');
    const amountInput = document.getElementById('expense-amount');
    const category = document.getElementById('expense-category').value;
    const payer = document.getElementById('expense-payer').value;

    if (!input.value.trim() || !amountInput.value) return;

    expenseList.push({ id: Date.now(), text: input.value.trim(), amount: parseFloat(amountInput.value), category, payer });
    input.value = '';
    amountInput.value = '';
    saveAndRenderExpenses();
}

function deleteExpense(id) {
    expenseList = expenseList.filter(item => item.id !== id);
    saveAndRenderExpenses();
}

function changeMonthlyLimit() {
    const newLimit = prompt("Unesite novi mesečni limit zajedničkog budžeta (€):", monthlyLimit);
    if (newLimit !== null && !isNaN(newLimit) && newLimit > 0) {
        monthlyLimit = parseFloat(newLimit);
        saveAndRenderExpenses();
    }
}

function saveAndRenderExpenses() {
    renderExpenses();
    saveDataToGitHub();
}

function renderExpenses() {
    const listEl = document.getElementById('expense-list');
    const totalEl = document.getElementById('total-expense');
    const limitDisplay = document.getElementById('limit-display');
    const leftEl = document.getElementById('budget-left');
    if(!listEl) return;
    
    listEl.innerHTML = '';
    limitDisplay.textContent = monthlyLimit;

    let total = expenseList.reduce((sum, item) => sum + item.amount, 0);
    let left = monthlyLimit - total;

    totalEl.textContent = total.toFixed(2);
    leftEl.textContent = left.toFixed(2) + ' €';
    leftEl.style.color = left < 0 ? '#f87171' : '#34d399';

    if (expenseList.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Nema unetih troškova.</p>';
        return;
    }

    expenseList.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-row';
        const catIcons = { hrana: '🛒', racuni: '💡', gorivo: '⛽', stan: '🏠', zabava: '🎉', ostalo: '📦' };
        const icon = catIcons[item.category] || '💰';

        li.innerHTML = `
            <div class="item-content" style="cursor:default;">
                <span style="font-size:14px;">${icon}</span>
                <span style="flex:1;">${item.text}</span>
                <strong style="color:#34d399;">${item.amount.toFixed(2)} €</strong>
                <span class="tag-assigned">${item.payer}</span>
            </div>
            <button class="delete-btn" onclick="deleteExpense(${item.id})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

// --- 5. LIČNI BUDŽET PO KORISNIKU ---
function addPersonalExpenseItem() {
    if (!currentUser) return;
    const input = document.getElementById('personal-expense-input');
    const amountInput = document.getElementById('personal-expense-amount');

    if (!input.value.trim() || !amountInput.value) return;

    if (!currentUser.personalExpenses) currentUser.personalExpenses = [];
    currentUser.personalExpenses.push({ id: Date.now(), text: input.value.trim(), amount: parseFloat(amountInput.value) });
    
    input.value = '';
    amountInput.value = '';
    renderPersonalBudget();
    saveDataToGitHub();
}

function deletePersonalExpense(id) {
    if (!currentUser || !currentUser.personalExpenses) return;
    currentUser.personalExpenses = currentUser.personalExpenses.filter(item => item.id !== id);
    renderPersonalBudget();
    saveDataToGitHub();
}

function changePersonalLimit() {
    if (!currentUser) return;
    const currentLimit = currentUser.personalLimit || 200;
    const newLimit = prompt(`Unesite lični mesečni limit za profil (${currentUser.name}) u €:`, currentLimit);
    if (newLimit !== null && !isNaN(newLimit) && newLimit > 0) {
        currentUser.personalLimit = parseFloat(newLimit);
        renderPersonalBudget();
        saveDataToGitHub();
    }
}

function renderPersonalBudget() {
    const titleEl = document.getElementById('personal-budget-title');
    const controlsEl = document.getElementById('personal-budget-controls');
    const promptEl = document.getElementById('personal-login-prompt');
    const contentEl = document.getElementById('personal-budget-content');
    if(!titleEl) return;

    if (!currentUser) {
        titleEl.textContent = "Lični budžet";
        controlsEl.classList.add('hidden');
        contentEl.classList.add('hidden');
        promptEl.classList.remove('hidden');
        return;
    }

    titleEl.textContent = `Lični budžet (${currentUser.name})`;
    controlsEl.classList.remove('hidden');
    promptEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const expenses = currentUser.personalExpenses || [];
    const limit = currentUser.personalLimit || 200;

    const listEl = document.getElementById('personal-expense-list');
    const totalEl = document.getElementById('personal-total-expense');
    const limitDisplay = document.getElementById('personal-limit-display');
    const leftEl = document.getElementById('personal-budget-left');

    listEl.innerHTML = '';
    limitDisplay.textContent = limit;

    let total = expenses.reduce((sum, item) => sum + item.amount, 0);
    let left = limit - total;

    totalEl.textContent = total.toFixed(2);
    leftEl.textContent = left.toFixed(2) + ' €';
    leftEl.style.color = left < 0 ? '#f87171' : '#34d399';

    if (expenses.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Nema unetih ličnih troškova.</p>';
        return;
    }

    expenses.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-row';
        li.innerHTML = `
            <div class="item-content" style="cursor:default;">
                <span style="flex:1;">${item.text}</span>
                <strong style="color:#818cf8;">${item.amount.toFixed(2)} €</strong>
            </div>
            <button class="delete-btn" onclick="deletePersonalExpense(${item.id})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

// --- 6. TABLA ZA CRTANJE ---
function initCanvas() {
    const canvas = document.getElementById('drawing-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    resizeCanvas();

    let painting = false;
    function startPosition(e) { painting = true; draw(e); }
    function endPosition() { painting = false; ctx.beginPath(); }

    function draw(e) {
        if (!painting) return;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#38bdf8';

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', endPosition);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', (e) => { startPosition(e); e.preventDefault(); });
    canvas.addEventListener('touchend', endPosition);
    canvas.addEventListener('touchmove', (e) => { draw(e); e.preventDefault(); });

    document.getElementById('clear-canvas-btn').addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

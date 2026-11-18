// --- UČITAVANJE I STANJE APLIKACIJE ---
let registeredAccounts = JSON.parse(localStorage.getItem('homehub_accounts')) || [];
let currentUser = JSON.parse(localStorage.getItem('homehub_user')) || null;

let shoppingList = JSON.parse(localStorage.getItem('homehub_shop')) || [];
let todoList = JSON.parse(localStorage.getItem('homehub_todo')) || [];
let eventList = JSON.parse(localStorage.getItem('homehub_events')) || [];
let expenseList = JSON.parse(localStorage.getItem('homehub_expenses')) || [];
let monthlyLimit = parseFloat(localStorage.getItem('homehub_limit')) || 500;

let assignableMembers = ["Svi"];

// --- INICIJALIZACIJA PRI UČITAVANJU ---
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    populateProfileSelector();
    initAuth();
    
    renderShopping();
    renderTodos();
    renderEvents();
    renderExpenses();
    initCanvas();

    // Event listeneri za module
    document.getElementById('shop-add-btn').addEventListener('click', addShoppingItem);
    document.getElementById('todo-add-btn').onclick = addTodoItem;
    document.getElementById('event-add-btn').addEventListener('click', addEventItem);
    document.getElementById('expense-add-btn').addEventListener('click', addExpenseItem);
    document.getElementById('set-limit-btn').addEventListener('click', changeMonthlyLimit);

    // Lični budžet listeneri
    document.getElementById('personal-expense-add-btn').addEventListener('click', addPersonalExpenseItem);
    document.getElementById('set-personal-limit-btn').addEventListener('click', changePersonalLimit);

    // Lokalni nalozi listeneri
    document.getElementById('create-profile-btn').addEventListener('click', createLocalAccount);
    document.getElementById('login-profile-btn').addEventListener('click', loginLocalAccount);
    document.getElementById('logout-btn').addEventListener('click', logoutLocalAccount);
});

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

// --- SISTEM LOKALNIH NALOGA (BEZ GOOGLE-A) ---
function populateProfileSelector() {
    const selector = document.getElementById('profile-selector');
    selector.innerHTML = '<option value="">Izaberi nalog...</option>';
    
    registeredAccounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.name;
        opt.textContent = acc.pin ? `🔒 ${acc.name}` : acc.name;
        selector.appendChild(opt);
    });
}

function createLocalAccount() {
    const rawName = prompt("Unesite ime za novi nalog (npr. Marko, Ana):");
    if (!rawName || !rawName.trim()) return;
    
    const name = rawName.trim();
    if (registeredAccounts.some(acc => acc.name.toLowerCase() === name.toLowerCase())) {
        alert("Nalog sa tim imenom već postoji! Izaberite ga iz liste.");
        return;
    }

    const rawPin = prompt(`Postavite PIN šifru za nalog "${name}" radi privatnosti ličnog budžeta (ostavite prazno ako ne želite šifru):`);
    const pin = rawPin ? rawPin.trim() : "";

    const newAccount = { name, pin };
    registeredAccounts.push(newAccount);
    localStorage.setItem('homehub_accounts', JSON.stringify(registeredAccounts));

    currentUser = newAccount;
    localStorage.setItem('homehub_user', JSON.stringify(currentUser));
    
    populateProfileSelector();
    initAuth();
}

function loginLocalAccount() {
    const selectedName = document.getElementById('profile-selector').value;
    if (!selectedName) {
        alert("Prvo izaberite nalog iz liste ili kliknite na '+ Novi'.");
        return;
    }

    const account = registeredAccounts.find(acc => acc.name === selectedName);
    if (!account) return;

    if (account.pin) {
        const enteredPin = prompt(`Unesite PIN šifru za nalog "${account.name}":`);
        if (enteredPin !== account.pin) {
            alert("Pogrešan PIN! Pristup odbijen.");
            return;
        }
    }

    currentUser = account;
    localStorage.setItem('homehub_user', JSON.stringify(currentUser));
    initAuth();
}

function logoutLocalAccount() {
    localStorage.removeItem('homehub_user');
    currentUser = null;
    populateProfileSelector();
    initAuth();
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
        
        if (currentUser) {
            select.value = currentUser.name;
        } else {
            select.value = "Svi";
        }
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
    localStorage.setItem('homehub_shop', JSON.stringify(shoppingList));
    renderShopping();
}

function renderShopping() {
    const listEl = document.getElementById('shop-list');
    const counterEl = document.getElementById('shop-counter');
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

// --- 2. KUĆNE OBAVEZE (TO-DO) ---
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
    localStorage.setItem('homehub_todo', JSON.stringify(todoList));
    renderTodos();
}

function renderTodos() {
    const listEl = document.getElementById('todo-list');
    const counterEl = document.getElementById('todo-counter');
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

// --- 3. BITNI DOGAĐAJI ---
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
    localStorage.setItem('homehub_events', JSON.stringify(eventList));
    renderEvents();
}

function renderEvents() {
    const listEl = document.getElementById('event-list');
    const counterEl = document.getElementById('event-counter');
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

// --- 4. ZAJEDNIČKI KUĆNI BUDŽET ---
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
        localStorage.setItem('homehub_limit', monthlyLimit);
        renderExpenses();
    }
}

function saveAndRenderExpenses() {
    localStorage.setItem('homehub_expenses', JSON.stringify(expenseList));
    renderExpenses();
}

function renderExpenses() {
    const listEl = document.getElementById('expense-list');
    const totalEl = document.getElementById('total-expense');
    const limitDisplay = document.getElementById('limit-display');
    const leftEl = document.getElementById('budget-left');
    
    listEl.innerHTML = '';
    limitDisplay.textContent = monthlyLimit;

    let total = expenseList.reduce((sum, item) => sum + item.amount, 0);
    let left = monthlyLimit - total;

    totalEl.textContent = total.toFixed(2);
    leftEl.textContent = left.toFixed(2) + ' €';

    leftEl.style.color = left < 0 ? '#f87171' : '#34d399';

    if (expenseList.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Nema unetih troškova ovog meseca.</p>';
        return;
    }

    expenseList.forEach(item => {
        const li = document.createElement('li');
        li.className = 'item-row';
        
        const catIcons = { hrana: '🛒', racuni: '💡', gorivo: '⛽', stan: '🏠', zabava: '🎉', ostalo: '📦' };
        const icon = catIcons[item.category] || '💰';

        li.innerHTML = `
            <div class="item-content" style="cursor:default;">
                <span style="font-size:14px;" title="${item.category}">${icon}</span>
                <span style="flex:1;">${item.text}</span>
                <strong style="color:#34d399;">${item.amount.toFixed(2)} €</strong>
                <span class="tag-assigned">${item.payer}</span>
            </div>
            <button class="delete-btn" onclick="deleteExpense(${item.id})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

// --- 5. LIČNI / INDIVIDUALNI BUDŽET PO KORISNIKU (STROGO IZOLOVANO) ---
function getPersonalData() {
    if (!currentUser) return { expenses: [], limit: 200 };
    const keyExp = `homehub_personal_exp_${currentUser.name}`;
    const keyLim = `homehub_personal_lim_${currentUser.name}`;
    return {
        expenses: JSON.parse(localStorage.getItem(keyExp)) || [],
        limit: parseFloat(localStorage.getItem(keyLim)) || 200
    };
}

function addPersonalExpenseItem() {
    if (!currentUser) return;
    const input = document.getElementById('personal-expense-input');
    const amountInput = document.getElementById('personal-expense-amount');

    if (!input.value.trim() || !amountInput.value) return;

    const data = getPersonalData();
    data.expenses.push({ id: Date.now(), text: input.value.trim(), amount: parseFloat(amountInput.value) });
    
    localStorage.setItem(`homehub_personal_exp_${currentUser.name}`, JSON.stringify(data.expenses));
    input.value = '';
    amountInput.value = '';
    renderPersonalBudget();
}

function deletePersonalExpense(id) {
    if (!currentUser) return;
    const data = getPersonalData();
    const updated = data.expenses.filter(item => item.id !== id);
    localStorage.setItem(`homehub_personal_exp_${currentUser.name}`, JSON.stringify(updated));
    renderPersonalBudget();
}

function changePersonalLimit() {
    if (!currentUser) return;
    const data = getPersonalData();
    const newLimit = prompt(`Unesite lični mesečni limit za profil (${currentUser.name}) u evrima (€):`, data.limit);
    if (newLimit !== null && !isNaN(newLimit) && newLimit > 0) {
        localStorage.setItem(`homehub_personal_lim_${currentUser.name}`, parseFloat(newLimit));
        renderPersonalBudget();
    }
}

function renderPersonalBudget() {
    const titleEl = document.getElementById('personal-budget-title');
    const controlsEl = document.getElementById('personal-budget-controls');
    const promptEl = document.getElementById('personal-login-prompt');
    const contentEl = document.getElementById('personal-budget-content');

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

    const data = getPersonalData();
    const listEl = document.getElementById('personal-expense-list');
    const totalEl = document.getElementById('personal-total-expense');
    const limitDisplay = document.getElementById('personal-limit-display');
    const leftEl = document.getElementById('personal-budget-left');

    listEl.innerHTML = '';
    limitDisplay.textContent = data.limit;

    let total = data.expenses.reduce((sum, item) => sum + item.amount, 0);
    let left = data.limit - total;

    totalEl.textContent = total.toFixed(2);
    leftEl.textContent = left.toFixed(2) + ' €';
    leftEl.style.color = left < 0 ? '#f87171' : '#34d399';

    if (data.expenses.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Nema unetih ličnih troškova.</p>';
        return;
    }

    data.expenses.forEach(item => {
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

// --- 6. INTERAKTIVNA TABLA ZA CRTANJE (CANVAS) ---
function initCanvas() {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        const savedDrawing = localStorage.getItem('homehub_drawing');
        if (savedDrawing) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = savedDrawing;
        }
    }
    
    resizeCanvas();
    window.addEventListener('resize', () => {
        const dataURL = canvas.toDataURL();
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = dataURL;
    });

    let painting = false;

    function startPosition(e) {
        painting = true;
        draw(e);
    }

    function endPosition() {
        painting = false;
        ctx.beginPath();
        localStorage.setItem('homehub_drawing', canvas.toDataURL());
    }

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
        localStorage.removeItem('homehub_drawing');
    });
}
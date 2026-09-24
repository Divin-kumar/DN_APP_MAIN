// This array holds the current user's expense records while the app is open.
let expenses = [];
let incomes = [];
let events = [];
let selectedMonth = new Date();
let selectedEventId = null;
let eventFormMode = "create";
let eventEditingId = null;
let selectedActivityIds = [];

window.setEventsFromStorage = function(records){
    events = records || [];
    renderEvents();
};

function isGuestMode(){
    return window.guestMode === true;
}

function refreshGuestData(){
    const snapshot = window.getGuestSnapshot();
    expenses = snapshot.expenses.map(expense => ({
        eventId: null,
        ...expense
    }));
    incomes = snapshot.incomes;
    events = snapshot.events;
}

window.refreshGuestData = refreshGuestData;

window.prepareGoogleUpgrade = function(){
    if(isGuestMode() && window.guestStorage.hasData()){
        window.markGuestMigrationPending();
    }
    window.signInGoogle();
};

window.continueAsGuest = async function(){
    window.startGuestSession();
    window.currentUser = null;
    refreshGuestData();
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
    document.getElementById("guestBanner").style.display = "block";
    document.getElementById("userName").textContent = "Guest";
    document.getElementById("userPhoto").style.display = "none";
    showModule("expenses");
    setTodayDate();
    renderExpenses();
    renderIncomeList();
};

window.mergeGuestData = async function(){
    try{
        await window.mergeGuestDataIntoAccount(window.getGuestSnapshot());
        window.guestStorage.clear();
        window.clearGuestMigrationPending();
        document.getElementById("migrationModal").style.display = "none";
        await initializeExpenseApp();
        await initializeIncomeApp();
        alert("Local data merged into your account.");
    }catch(error){
        console.error(error);
        alert("Could not merge local data. Your local data is still stored locally.");
    }
};

window.startFreshAccount = function(){
    window.guestStorage.clear();
    window.clearGuestMigrationPending();
    document.getElementById("migrationModal").style.display = "none";
    expenses = [];
    incomes = [];
    renderExpenses();
    renderIncomeList();
};

function formatCurrency(amount){
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function isInSelectedMonth(date){
    const value = new Date(`${date}T00:00:00`);

    return value.getMonth() === selectedMonth.getMonth()
        && value.getFullYear() === selectedMonth.getFullYear();
}

function isBeforeSelectedMonth(date){
    const value = new Date(`${date}T00:00:00`);
    const monthStart = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
    );

    return value < monthStart;
}

function monthKey(date){
    const value = new Date(`${date}T00:00:00`);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function selectedMonthKey(){
    return `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`;
}

function populateMonthFilters(){
    const keys = new Set([
        selectedMonthKey(),
        ...expenses.map(expense => monthKey(expense.date)),
        ...incomes.map(income => monthKey(income.date))
    ]);
    const options = [...keys].sort().reverse();

    ["expenseMonthFilter", "incomeMonthFilter"].forEach(id => {
        const filter = document.getElementById(id);
        if(!filter){
            return;
        }

        const currentValue = selectedMonthKey();
        filter.innerHTML = options.map(key => {
            const [year, month] = key.split("-").map(Number);
            const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric"
            });
            return `<option value="${key}">${label}</option>`;
        }).join("");
        filter.value = currentValue;
    });
}

window.selectMonthFromFilter = function(value){
    if(!value){
        return;
    }

    const [year, month] = value.split("-").map(Number);
    selectedMonth = new Date(year, month - 1, 1);
    renderFinanceOverview();
    renderExpenses();
    renderIncomeList();
};

function renderFinanceOverview(){
    const monthExpenses = expenses.filter(expense => isInSelectedMonth(expense.date));
    const monthIncome = incomes.filter(income => isInSelectedMonth(income.date));
    const expenseTotal = monthExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const incomeTotal = monthIncome.reduce((total, income) => total + Number(income.amount || 0), 0);
    const previousIncome = incomes
        .filter(income => isBeforeSelectedMonth(income.date))
        .reduce((total, income) => total + Number(income.amount || 0), 0);
    const previousExpenses = expenses
        .filter(expense => isBeforeSelectedMonth(expense.date))
        .reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const openingBalance = previousIncome - previousExpenses;
    const closingBalance = openingBalance + incomeTotal - expenseTotal;

    populateMonthFilters();

    document.getElementById("selectedMonthLabel").textContent = selectedMonth.toLocaleDateString(
        "en-US",
        window.innerWidth <= 380
            ? { month: "short", year: "2-digit" }
            : { month: "long", year: "numeric" }
    );
    document.getElementById("overviewBalance").textContent = formatCurrency(closingBalance);
    document.getElementById("overviewIncome").textContent = formatCurrency(incomeTotal);
    document.getElementById("overviewExpenses").textContent = formatCurrency(expenseTotal);
    document.getElementById("overviewTransactions").textContent = monthExpenses.length + monthIncome.length;
    document.getElementById("overviewOpeningBalance").textContent = formatCurrency(openingBalance);
    document.getElementById("overviewIncomeDetail").textContent = formatCurrency(incomeTotal);
    document.getElementById("overviewExpensesDetail").textContent = formatCurrency(expenseTotal);
    document.getElementById("overviewClosingBalance").textContent = formatCurrency(closingBalance);
}

function renderIncomeList(){
    const list = document.getElementById("incomeList");
    if(!list){
        return;
    }

    const incomeTypeFilter =
        document.getElementById("incomeTypeFilter")?.value || "all";
    const visibleIncomes = incomes.filter(income =>
        isInSelectedMonth(income.date)
        &&
        (incomeTypeFilter === "all" || income.type === incomeTypeFilter)
    );
    list.innerHTML = "";

    if(!visibleIncomes.length){
        list.innerHTML = '<div class="empty-state">No income added for this month.</div>';
    }else{
        visibleIncomes.forEach(income => {
            list.innerHTML += `
                <div class="income-item">
                    <div>
                        <strong>${income.name}</strong>
                        <span>${income.type} • ${income.date}</span>
                    </div>
                        <div class="income-item-actions">
                            <span class="income-amount">${formatCurrency(income.amount)}</span>
                            <button class="income-edit-btn" onclick="editIncome(${income.id})">Edit</button>
                            <button class="delete-btn" onclick="deleteIncome(${income.id})">Delete</button>
                        </div>
                </div>
            `;
        });
    }

    const monthTotal = visibleIncomes.reduce(
        (total, income) => total + Number(income.amount || 0),
        0
    );
    const totalEl = document.querySelector(".income-summary strong");
    if(totalEl){
        totalEl.textContent = formatCurrency(monthTotal);
    }
}

window.changeMonth = function(offset){
    selectedMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + offset,
        1
    );

    renderFinanceOverview();
    renderExpenses();
    renderIncomeList();
};

window.toggleIncomePanel = function(){
    const panel = document.getElementById("incomeHistoryPanel");
    const button = panel.querySelector(".history-toggle");
    const collapsed = panel.classList.toggle("income-collapsed");

    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed ? "Show" : "Hide";
};

// Load expenses from Firestore and refresh the dashboard after login.
window.initializeExpenseApp =
async function(){

    try{
		if(isGuestMode()){
            refreshGuestData();
        }else{
            expenses = (await window.loadExpensesFromFirestore()).map(expense => ({
                eventId: null,
                ...expense
            }));
        }
		setTodayDate();
        renderExpenses();

    }catch(error){

        console.error(error);
    }
}

// Add a new expense after validating the fields entered by the user.
window.addExpense = async function(){

    let name =
    document.getElementById("name").value;

    let amount =
    Number(document.getElementById("amount").value);

    let category =
    document.getElementById("category").value;

    let date =
    document.getElementById("date").value;

    if(!name || !amount || !date){

        alert("Fill all fields");
        return;
    }

    const expense = {

    id: Date.now(),

    name,

    amount,

    category,

    date,
    eventId: null
};

expenses.push(expense);

if(isGuestMode()){
    window.guestStorage.add("expenses", expense);
}else{
    saveExpenseToFirestore(expense);
}

    document.getElementById("name").value="";
    document.getElementById("amount").value="";
	
    setTodayDate();

    initializeExpenseApp();
}

window.cancelExpenseForm = function(){
    document.getElementById("name").value = "";
    document.getElementById("amount").value = "";
    document.getElementById("category").selectedIndex = 0;
    setTodayDate();
};

// Show or hide the launcher menu from the top navigation bar.
window.toggleLauncher = function(event){

    if(event){
        event.stopPropagation();
    }

    const launcher =
        document.getElementById("appLauncher");

    launcher.style.display =
        launcher.style.display === "grid"
        ? "none"
        : "grid";
};

window.addEventListener("click", function(event){

    const launcher =
        document.getElementById("appLauncher");

    const button =
        document.querySelector(".launcher-btn");

    if(
        !launcher.contains(event.target) &&
        !button.contains(event.target)
    ){
        launcher.style.display = "none";
    }

});

// Set the form date to today's date by default for faster entry.
window.setTodayDate = function(){

    const today = new Date();

    const formattedDate = today.toISOString().split("T")[0];

    document.getElementById("date").value = formattedDate;
}

// Delete one expense item from Firestore and refresh the list.
window.deleteExpense = async function(id){

    const expense =
    expenses.find(
        e => e.id === id
    );

    if(isGuestMode()){
        window.guestStorage.remove("expenses", id);
    }else{
        await deleteExpenseFromFirestore(expense.firestoreId);
    }

    await initializeExpenseApp();
}

// Fill the edit modal with the selected expense so it can be updated.
window.editExpense = function(id){

    const expense =
    expenses.find(e => e.id === id);

    document.getElementById("editId").value =
    expense.id;

    document.getElementById("editName").value =
    expense.name;

    document.getElementById("editAmount").value =
    expense.amount;

    document.getElementById("editCategory").value =
    expense.category;

    document.getElementById("editDate").value =
    expense.date;

    document.getElementById("editModal").style.display =
    "block";
}

// Save the edited expense data back to Firestore and reload the page state.
window.saveExpense = async function(){

    const id =
    Number(document.getElementById("editId").value);

    const expense =
    expenses.find(e => e.id === id);

    expense.name =
    document.getElementById("editName").value;

    expense.amount =
    Number(document.getElementById("editAmount").value);

    expense.category =
    document.getElementById("editCategory").value;

    expense.date =
    document.getElementById("editDate").value;

    if(isGuestMode()){
        window.guestStorage.update("expenses", expense);
    }else{
        await updateExpenseInFirestore(expense);
    }

closeModal();

initializeExpenseApp();
}

// Close the edit modal after saving or cancelling.
window.closeModal = function(){
    document.getElementById("editModal")
    .style.display="none";
}

// Rebuild the table and summary values from the current expense list.
window.renderExpenses = function(){

    let table =
    document.getElementById("expenseTable");

    let search =
    document.getElementById("searchExpense")
    ?.value.toLowerCase() || "";

    let categoryFilter =
    document.getElementById("historyCategoryFilter")
    ?.value || "all";

    table.innerHTML="";

    let total = 0;

    let monthTotal = 0;

    let categories = {};

    let monthExpenses = expenses.filter(expense =>
        isInSelectedMonth(expense.date)
    );
    let monthCategories = {};

    monthExpenses.forEach(expense => {
        monthCategories[expense.category] =
            (monthCategories[expense.category] || 0)
            + Number(expense.amount || 0);
    });

    let filtered =
    expenses.filter(expense =>
        isInSelectedMonth(expense.date)
        &&
        (
            expense.name.toLowerCase()
            .includes(search)

            ||

            expense.category.toLowerCase()
            .includes(search)
        )
        &&
        (categoryFilter === "all" || expense.category === categoryFilter)
    );

    filtered.forEach(expense => {

        total += expense.amount;

        categories[expense.category] =
        (categories[expense.category] || 0)
        + expense.amount;

        monthTotal += expense.amount;

        table.innerHTML += `
        <tr>

            <td>${expense.date}</td>

            <td>${expense.name}</td>

            <td>${expense.category}</td>

            <td class="amount">
                ₹${expense.amount}
            </td>

            <td>

                <button
                class="expense-edit-btn"
                onclick="editExpense(${expense.id})">
                Edit
                </button>

                <button
                class="delete-btn"
                onclick="deleteExpense(${expense.id})">
                Delete
                </button>

            </td>

        </tr>`;
    });

    if(!filtered.length){
        table.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="table-empty-state">
                        <strong>No expenses found</strong>
                        <span>${search ? "Try a different search." : "Add an expense to see it here."}</span>
                    </div>
                </td>
            </tr>`;
    }

    let monthTopCategory = "-";
    let monthTopAmount = 0;
    for(let category in monthCategories){
        if(monthCategories[category] > monthTopAmount){
            monthTopAmount = monthCategories[category];
            monthTopCategory = category;
        }
    }

    document.getElementById("expenseFormSummaryPeriod").textContent =
        selectedMonth.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric"
        });
    document.getElementById("formSummaryTotal").textContent =
        formatCurrency(monthExpenses.reduce(
            (sum, expense) => sum + Number(expense.amount || 0),
            0
        ));
    document.getElementById("formSummaryCount").textContent = monthExpenses.length;
    document.getElementById("formSummaryCategory").textContent = monthTopCategory;

    document.getElementById("totalAmount")
    .innerText = total;

    document.getElementById("transactionCount")
    .innerText = filtered.length;

    document.getElementById("monthTotal")
    .innerText = monthTotal;

    let topCategory = "-";
    let max = 0;

    for(let cat in categories){

        if(categories[cat] > max){
            max = categories[cat];
            topCategory = cat;
        }
    }

    document.getElementById("topCategory")
    .innerText = topCategory;

    let breakdown =
    document.getElementById("categoryBreakdown");

    breakdown.innerHTML = "";

    for(let cat in categories){

        breakdown.innerHTML += `
        <div
        style="
            padding:10px;
            margin-bottom:8px;
            background:#edf6ef;
            border-radius:8px;
        ">
            ${cat} : ₹${categories[cat]}
        </div>`;
    }

    renderFinanceOverview();
}

window.toggleHistoryPanel = function(){
    const panel = document.getElementById("expenseHistoryPanel");
    const button = document.querySelector(".history-toggle");
    const collapsed = panel.classList.toggle("history-collapsed");

    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed ? "Show" : "Hide";
};

// Switch the visible module in the app when the user chooses a menu item.
window.showModule = function(module){

    const modules = [

        "expenses",
        "income",
        "events",
        "reminders",
        "memories",
        "settings"

    ];

    modules.forEach(m=>{

        const el =
            document.getElementById(
                m + "Module"
            );

        if(el){

            el.style.display =
                "none";

        }

    });

    const selected =
        document.getElementById(
            module + "Module"
        );

    if(selected){

        selected.style.display =
            "block";

    }

    const financeOverview = document.querySelector(".finance-overview");
    if(financeOverview){
        financeOverview.style.display = module === "events" ? "none" : "";
    }

    if(module === "events"){
        renderEvents();
    }

    document.querySelectorAll(".app-card").forEach(card => {
        card.classList.toggle(
            "active",
            card.dataset.module === module
        );
    });

    document.getElementById(
        "appLauncher"
    ).style.display = "none";

}

window.showEventForm = function(){
    const form = document.getElementById("eventForm");
    eventFormMode = "create";
    eventEditingId = null;
    document.getElementById("eventSaveButton").textContent = "Save Event";
    form.style.display = "block";
    if(document.getElementById("eventDate").value === ""){
        document.getElementById("eventDate").value = new Date().toISOString().split("T")[0];
    }
};

window.cancelEventForm = function(){
    document.getElementById("eventForm").style.display = "none";
    document.getElementById("eventName").value = "";
    document.getElementById("eventCustomType").value = "";
    document.getElementById("eventNotes").value = "";
    eventFormMode = "create";
    eventEditingId = null;
};

window.toggleCustomEventType = function(){
    const type = document.getElementById("eventType").value;
    document.getElementById("eventCustomType").style.display =
        type === "Other" ? "block" : "none";
};

window.saveEventForm = async function(){
    const name = document.getElementById("eventName").value.trim();
    const date = document.getElementById("eventDate").value;
    const type = document.getElementById("eventType").value;
    const customType = document.getElementById("eventCustomType").value.trim();
    const recurrence = document.getElementById("eventRecurrence").value;
    const notes = document.getElementById("eventNotes").value.trim();
    if(!name || !date || (type === "Other" && !customType)){
        alert("Fill all event fields");
        return;
    }

    const eventRecord = {
        id: Date.now(),
        name,
        date,
        type,
        customType,
        recurrence,
        notes,
        activities: []
    };

    if(eventFormMode === "edit"){
        const existing = events.find(item => item.id === eventEditingId);
        if(!existing){
            return;
        }
        Object.assign(existing, {
            name, date, type, customType, recurrence, notes
        });
        await persistEvent(existing);
    }else{
        events.push(eventRecord);
        if(isGuestMode()){
            window.guestStorage.add("events", eventRecord);
        }else{
            await window.saveEventToFirestore(eventRecord);
        }
    }

    cancelEventForm();
    renderEvents();
};

window.editEvent = function(id){
    const eventRecord = events.find(item => item.id === id);
    if(!eventRecord){
        return;
    }
    eventFormMode = "edit";
    eventEditingId = id;
    document.getElementById("eventName").value = eventRecord.name;
    document.getElementById("eventType").value = eventRecord.type || "Other";
    document.getElementById("eventCustomType").value = eventRecord.customType || "";
    document.getElementById("eventDate").value = eventRecord.date;
    document.getElementById("eventRecurrence").value = eventRecord.recurrence || "none";
    document.getElementById("eventNotes").value = eventRecord.notes || "";
    toggleCustomEventType();
    document.getElementById("eventSaveButton").textContent = "Update Event";
    document.getElementById("eventForm").style.display = "block";
};

window.deleteEvent = async function(id){
    const eventRecord = events.find(item => item.id === id);
    if(!eventRecord || !window.confirm(`Delete event "${eventRecord.name}"?`)){
        return;
    }
    if(isGuestMode()){
        window.guestStorage.remove("events", id);
    }else if(window.deleteEventFromFirestore){
        await window.deleteEventFromFirestore(eventRecord.firestoreId);
    }
    events = events.filter(item => item.id !== id);
    selectedEventId = null;
    renderEvents();
    document.getElementById("eventDetailPanel").innerHTML = '<div class="empty-state">Select an event to view its details.</div>';
};

function renderEvents(){
    const list = document.getElementById("eventsList");
    if(!list){
        return;
    }

    list.innerHTML = events.length ? events.map(eventRecord => {
        const eventExpenses = expenses.filter(expense => expense.eventId === eventRecord.id);
        const expenseTotal = eventExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        return `
        <button class="event-item ${selectedEventId === eventRecord.id ? "active" : ""}" onclick="selectEvent(${eventRecord.id})">
            <div>
                <strong>${eventRecord.name}</strong>
                <span>${eventRecord.customType || eventRecord.type || "Other"} · ${eventRecord.date}</span>
            </div>
            <div class="event-item-stats">
                <strong>${(eventRecord.activities || []).length} activities</strong>
                <span>${formatCurrency(expenseTotal)} expenses</span>
            </div>
            <span class="event-item-arrow">›</span>
        </button>
    `;
    }).join("") : '<div class="empty-state">No events added yet.</div>';

    if(selectedEventId !== null){
        renderEventDetail();
    }
}

window.selectEvent = function(id){
    selectedEventId = id;
    selectedActivityIds = [];
    renderEvents();
};

function renderEventDetail(){
    const eventRecord = events.find(item => item.id === selectedEventId);
    const detail = document.getElementById("eventDetailPanel");
    if(!eventRecord || !detail){
        return;
    }

    const linkedExpenses = expenses.filter(expense => expense.eventId === eventRecord.id);
    const activities = eventRecord.activities || [];
    const eventTotal = linkedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    detail.innerHTML = `
        <div class="module-header">
            <div>
                <span class="panel-eyebrow">Event details</span>
                <h2>${eventRecord.name}</h2>
                <span class="event-date">${eventRecord.date}</span>
                <span class="event-meta">${eventRecord.customType || eventRecord.type || "Other"} · ${eventRecord.recurrence || "none"}</span>
            </div>
            <div class="event-detail-actions">
                <button class="compact-action" onclick="editEvent(${eventRecord.id})">Edit</button>
                <button class="delete-btn" onclick="deleteEvent(${eventRecord.id})">Delete</button>
            </div>
        </div>
        <div class="event-section">
            <div class="section-heading"><h3>Activities</h3><span>${activities.length} total · ${formatCurrency(eventTotal)}</span></div>
            <div class="activity-selection-actions">
                <span>${selectedActivityIds.length ? `${selectedActivityIds.length} selected` : "Select an activity to manage it"}</span>
                ${selectedActivityIds.length ? `<button class="compact-action" onclick="editSelectedActivity()">Edit</button><button class="delete-btn" onclick="deleteSelectedActivities()">Delete Selected</button><button class="secondary-action" onclick="clearActivitySelection()">Cancel</button>` : ""}
            </div>
            <div class="activity-list">
                ${activities.length ? activities.map(activity => renderActivityCard(activity, eventRecord)).join("") : '<div class="empty-state">No activities yet.</div>'}
            </div>
            <div class="activity-add-row">
                <input id="activityTitle" type="text" placeholder="Add activity">
                <input id="activityDate" type="date" value="${eventRecord.date}">
                <button class="compact-action" onclick="addActivity()">Add</button>
            </div>
        </div>`;

    detail.innerHTML += `
        <div class="event-section event-notes-section">
            <div class="section-heading"><h3>Notes</h3></div>
            <p class="event-notes">${eventRecord.notes || "No notes added."}</p>
        </div>
        <div class="event-section">
            <div class="section-heading"><h3>Timeline</h3></div>
            <div class="event-timeline"><span></span><p>Event created on ${eventRecord.date}</p></div>
        </div>`;
};

function renderActivityCard(activity, eventRecord){
    const activityExpenses = expenses.filter(expense => expense.activityId === activity.id);
    const activityTotal = activityExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    return `
        <details class="activity-card" ${activity.expanded ? "open" : ""}>
            <summary>
                <input class="activity-select" type="checkbox" ${selectedActivityIds.includes(activity.id) ? "checked" : ""} onclick="selectActivity(event, ${activity.id})" aria-label="Select ${activity.title}">
                <span class="activity-check ${activity.completed ? "done" : ""}">${activity.completed ? "✓" : ""}</span>
                <span class="activity-card-title">${activity.title}<small>${activity.date || eventRecord.date}</small></span>
                <strong>${formatCurrency(activityTotal)}</strong>
            </summary>
            <div class="activity-card-content">
                <div class="activity-card-actions"><span>Activity details</span></div>
                <div class="activity-expenses">
                    ${activityExpenses.length ? activityExpenses.map(expense => `<div class="event-expense-item"><span>${expense.name}</span><strong>${formatCurrency(expense.amount)}</strong><div class="event-expense-actions"><button class="expense-edit-btn" onclick="editExpense(${expense.id})">Edit</button><button class="delete-btn" onclick="deleteExpense(${expense.id})">Delete</button></div></div>`).join("") : '<div class="empty-state">No expenses for this activity.</div>'}
                </div>
                <div class="activity-expense-form">
                    <input id="activityExpenseName-${activity.id}" type="text" placeholder="Expense name">
                    <input id="activityExpenseAmount-${activity.id}" type="number" placeholder="Amount">
                    <select id="activityExpenseCategory-${activity.id}"><option>Food</option><option>Hospital</option><option>Shopping</option><option>Travel</option><option>Entertainment</option><option>Other</option></select>
                    <button onclick="addActivityExpense(${activity.id})">Save Expense</button>
                    <button class="secondary-action" onclick="cancelActivityExpense(${activity.id})">Cancel</button>
                </div>
            </div>
        </details>`;
}

window.cancelActivityView = function(event){
    event.preventDefault();
    event.currentTarget.closest("details").open = false;
};

window.cancelActivityExpense = function(id){
    ["Name", "Amount"].forEach(field => {
        const input = document.getElementById(`activityExpense${field}-${id}`);
        if(input){ input.value = ""; }
    });
};

async function persistEvent(eventRecord){
    if(isGuestMode()){
        window.guestStorage.update("events", eventRecord);
    }else if(window.updateEventInFirestore){
        await window.updateEventInFirestore(eventRecord);
    }
}

window.addActivity = async function(){
    const eventRecord = events.find(item => item.id === selectedEventId);
    const input = document.getElementById("activityTitle");
    const title = input?.value.trim();
    if(!eventRecord || !title){
        return;
    }
    eventRecord.activities = eventRecord.activities || [];
    const date = document.getElementById("activityDate").value || eventRecord.date;
    eventRecord.activities.push({id: Date.now(), title, date, completed: false});
    await persistEvent(eventRecord);
    renderEventDetail();
};

window.editActivity = function(id){
    const eventRecord = events.find(item => item.id === selectedEventId);
    const activity = eventRecord?.activities?.find(item => item.id === id);
    if(!activity){ return; }
    const title = window.prompt("Activity name", activity.title);
    if(title === null){ return; }
    const date = window.prompt("Activity date (YYYY-MM-DD)", activity.date || eventRecord.date);
    if(date === null){ return; }
    activity.title = title.trim() || activity.title;
    activity.date = date || activity.date;
    persistEvent(eventRecord).then(renderEventDetail);
};

window.deleteActivity = async function(id, skipConfirm = false){
    const eventRecord = events.find(item => item.id === selectedEventId);
    if(!eventRecord || (!skipConfirm && !window.confirm("Delete this activity and its linked expenses?"))){ return; }
    const activityExpenses = expenses.filter(expense => expense.activityId === id);
    for(const expense of activityExpenses){
        if(isGuestMode()){
            window.guestStorage.remove("expenses", expense.id);
        }else{
            await window.deleteExpenseFromFirestore(expense.firestoreId);
        }
    }
    eventRecord.activities = (eventRecord.activities || []).filter(item => item.id !== id);
    await persistEvent(eventRecord);
    expenses = expenses.filter(expense => expense.activityId !== id);
    renderEventDetail();
    renderExpenses();
};

window.toggleActivity = async function(id){
    const eventRecord = events.find(item => item.id === selectedEventId);
    const activity = eventRecord?.activities?.find(item => item.id === id);
    if(!activity){
        return;
    }
    activity.completed = !activity.completed;
    await persistEvent(eventRecord);
    renderEventDetail();
};

window.addActivityExpense = async function(activityId){
    const eventRecord = events.find(item => item.id === selectedEventId);
    const name = document.getElementById(`activityExpenseName-${activityId}`).value.trim();
    const amount = Number(document.getElementById(`activityExpenseAmount-${activityId}`).value);
    const category = document.getElementById(`activityExpenseCategory-${activityId}`).value;
    if(!eventRecord || !name || !amount){
        alert("Fill all event expense fields");
        return;
    }

    const activity = eventRecord.activities.find(item => item.id === activityId);
    const expense = { id: Date.now(), name, amount, category, date: activity.date || eventRecord.date, eventId: eventRecord.id, activityId };
    expenses.push(expense);
    if(isGuestMode()){
        window.guestStorage.add("expenses", expense);
    }else{
        await window.saveExpenseToFirestore(expense);
    }
    renderEventDetail();
    renderExpenses();
};

// Adds a new income entry while keeping the existing expense workflow untouched.
window.addIncome = async function(){

    if(!window.currentUser && !isGuestMode()){
        return;
    }

    const name = document.getElementById("incomeName").value;
    const type = document.getElementById("incomeType").value;
    const amount = Number(document.getElementById("incomeAmount").value);
    const date = document.getElementById("incomeDate").value;

    if(!name || !amount || !date){
        alert("Fill all income fields");
        return;
    }

    const income = {
        id: Date.now(),
        name,
        type,
        amount,
        date
    };

    incomes.push(income);

    if(isGuestMode()){
        window.guestStorage.add("incomes", income);
    }else if(window.saveIncomeToFirestore){
        await window.saveIncomeToFirestore(income);
    }

    document.getElementById("incomeName").value = "";
    document.getElementById("incomeAmount").value = "";
    document.getElementById("incomeDate").value = "";

    if(window.initializeIncomeApp){
        await window.initializeIncomeApp();
    }
}

    window.editIncome = function(id){
        const income = incomes.find(item => item.id === id);
        if(!income){
            return;
        }

        document.getElementById("editIncomeId").value = income.id;
        document.getElementById("editIncomeName").value = income.name;
        document.getElementById("editIncomeType").value = income.type;
        document.getElementById("editIncomeAmount").value = income.amount;
        document.getElementById("editIncomeDate").value = income.date;
        document.getElementById("editIncomeModal").style.display = "block";
    };

    window.saveIncome = async function(){
        const id = Number(document.getElementById("editIncomeId").value);
        const income = incomes.find(item => item.id === id);
        if(!income){
            return;
        }

        income.name = document.getElementById("editIncomeName").value;
        income.type = document.getElementById("editIncomeType").value;
        income.amount = Number(document.getElementById("editIncomeAmount").value);
        income.date = document.getElementById("editIncomeDate").value;

        if(!income.name || !income.amount || !income.date){
            alert("Fill all income fields");
            return;
        }

        if(isGuestMode()){
            window.guestStorage.update("incomes", income);
        }else{
            await window.updateIncomeInFirestore(income);
        }
        closeIncomeModal();
        await initializeIncomeApp();
    };

    window.deleteIncome = async function(id){
        const income = incomes.find(item => item.id === id);
        if(!income){
            return;
        }

        if(!window.confirm(`Delete income entry "${income.name}"?`)){
            return;
        }

        if(isGuestMode()){
            window.guestStorage.remove("incomes", id);
        }else{
            await window.deleteIncomeFromFirestore(income.firestoreId);
        }
        await initializeIncomeApp();
    };

    window.closeIncomeModal = function(){
        document.getElementById("editIncomeModal").style.display = "none";
    };

// Loads income records for the current signed-in user without affecting expense logic.
window.initializeIncomeApp = async function(){
    try{
        if(!window.currentUser){
            incomes = [];
            return;
        }

        if(isGuestMode()){
            refreshGuestData();
        }else if(window.loadIncomesFromFirestore){
            incomes = await window.loadIncomesFromFirestore();
        }

        if(document.getElementById("incomeDate")){
            const today = new Date();
            document.getElementById("incomeDate").value = today.toISOString().split("T")[0];
        }

        renderIncomeList();
        renderFinanceOverview();
    }catch(error){
        console.error(error);
    }
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
}

window.cancelIncomeForm = function(){
    document.getElementById("incomeName").value = "";
    document.getElementById("incomeAmount").value = "";
    document.getElementById("incomeType").selectedIndex = 0;
    if(document.getElementById("incomeDate")){
        document.getElementById("incomeDate").value = new Date().toISOString().split("T")[0];
    }
};

window.selectActivity = function(event, id){
    event.preventDefault();
    event.stopPropagation();
    selectedActivityIds = selectedActivityIds.includes(id)
        ? selectedActivityIds.filter(item => item !== id)
        : [...selectedActivityIds, id];
    renderEventDetail();
};

window.clearActivitySelection = function(){
    selectedActivityIds = [];
    renderEventDetail();
};

window.editSelectedActivity = function(){
    if(selectedActivityIds.length !== 1){
        alert("Select one activity to edit");
        return;
    }
    editActivity(selectedActivityIds[0]);
};

window.deleteSelectedActivities = async function(){
    if(!selectedActivityIds.length || !window.confirm("Delete selected activities and their linked expenses?")){
        return;
    }
    for(const id of [...selectedActivityIds]){
        await deleteActivity(id, true);
    }
    selectedActivityIds = [];
    renderEventDetail();
};
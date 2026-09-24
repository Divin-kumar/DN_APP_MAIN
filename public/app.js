// This array holds the current user's expense records while the app is open.
let expenses = [];
let incomes = [];
let selectedMonth = new Date();

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

    document.getElementById("selectedMonthLabel").textContent = selectedMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });
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

    document.getElementById("incomeHistoryPeriod").textContent =
        selectedMonth.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric"
        });

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
        expenses =
        await window.loadExpensesFromFirestore();
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

    date
};

expenses.push(expense);

saveExpenseToFirestore(expense);

    document.getElementById("name").value="";
    document.getElementById("amount").value="";
	
    setTodayDate();

    initializeExpenseApp();
}

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

    await deleteExpenseFromFirestore(
        expense.firestoreId
    );

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

    await updateExpenseInFirestore(
    expense
);

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

    document.getElementById("expenseHistoryPeriod").textContent =
        selectedMonth.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric"
        });

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

// Adds a new income entry while keeping the existing expense workflow untouched.
window.addIncome = async function(){

    if(!window.currentUser){
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

    if(window.saveIncomeToFirestore){
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

        await window.updateIncomeInFirestore(income);
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

        await window.deleteIncomeFromFirestore(income.firestoreId);
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

        if(window.loadIncomesFromFirestore){
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
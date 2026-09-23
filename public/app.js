let expenses = [];

document.addEventListener("DOMContentLoaded", function () {
    const signInBtn = document.querySelector(".signin-btn");
    const createBtn = document.querySelector(".signup-link");
    const googleBtn = document.querySelector(".google-btn");

    if (signInBtn) {
        signInBtn.addEventListener("click", function () {
            if (typeof window.loginUser === "function") {
                window.loginUser();
            } else {
                alert("Authentication is still loading. Please try again in a moment.");
            }
        });
    }

    if (createBtn) {
        createBtn.addEventListener("click", function () {
            if (typeof window.registerUser === "function") {
                window.registerUser();
            } else {
                alert("Authentication is still loading. Please try again in a moment.");
            }
        });
    }

    if (googleBtn) {
        googleBtn.addEventListener("click", function () {
            if (typeof window.signInGoogle === "function") {
                window.signInGoogle();
            } else {
                alert("Authentication is still loading. Please try again in a moment.");
            }
        });
    }
});

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

window.setTodayDate = function(){

    const today = new Date();

    const formattedDate = today.toISOString().split("T")[0];

    document.getElementById("date").value = formattedDate;
}

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

window.closeModal = function(){
    document.getElementById("editModal")
    .style.display="none";
}

window.renderExpenses = function(){

    let table =
    document.getElementById("expenseTable");

    let search =
    document.getElementById("searchExpense")
    ?.value.toLowerCase() || "";

    table.innerHTML="";

    let total = 0;

    let monthTotal = 0;

    let categories = {};

    let thisMonth =
    new Date().getMonth();

    let thisYear =
    new Date().getFullYear();

    let filtered =
    expenses.filter(expense =>

        expense.name.toLowerCase()
        .includes(search)

        ||

        expense.category.toLowerCase()
        .includes(search)
    );

    filtered.forEach(expense => {

        total += expense.amount;

        categories[expense.category] =
        (categories[expense.category] || 0)
        + expense.amount;

        let expDate =
        new Date(expense.date);

        if(
            expDate.getMonth() === thisMonth &&
            expDate.getFullYear() === thisYear
        ){
            monthTotal += expense.amount;
        }

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
                style="background:#1976d2;width:auto;padding:8px 12px;"
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
}

window.showModule = function(module){

    const modules = [

        "expenses",
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

    document.getElementById(
        "appLauncher"
    ).style.display = "none";

}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
}
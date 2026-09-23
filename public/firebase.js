import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
}
from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
}
from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCWks2wkCCsoYY3NRLl5BIBgf23vsgqqlI",
    authDomain: "expense-tracker-divin.firebaseapp.com",
    projectId: "expense-tracker-divin",
    storageBucket: "expense-tracker-divin.firebasestorage.app",
    messagingSenderId: "666300141270",
    appId: "1:666300141270:web:23a208ea5797010f384377",
    measurementId: "G-FFGVMYZDLR"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const db = getFirestore(app);

window.registerUser = async function(){

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    if(!email || !password){
        alert("Enter email and password");
        return;
    }

    try{

        await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        alert("Account created successfully");

    }catch(error){

        alert(error.message);
    }
};

window.loginUser = async function(){

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    try{

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

    }catch(error){

        alert(error.message);
    }
};

window.saveExpenseToFirestore =
async function(expense){

    await addDoc(

        collection(
            db,
            "users",
            window.currentUser.uid,
            "expenses"
        ),

        expense
    );
};

window.loadExpensesFromFirestore =
async function(){

    const snapshot =
    await getDocs(
        collection(
   db,
   "users",
   window.currentUser.uid,
   "expenses"
)
    );

    const data = [];

    snapshot.forEach(doc => {

        data.push({
            firestoreId: doc.id,
            ...doc.data()
        });

    });

    return data;
};

window.deleteExpenseFromFirestore =
async function(firestoreId){

    await deleteDoc(
        doc(
    db,
    "users",
    window.currentUser.uid,
    "expenses",
    firestoreId
)
    );
};

window.updateExpenseInFirestore =
async function(expense){

    await updateDoc(

        doc(
    db,
    "users",
    window.currentUser.uid,
    "expenses",
    expense.firestoreId
),

        {
            name: expense.name,
            amount: expense.amount,
            category: expense.category,
            date: expense.date
        }
    );
};


window.signInGoogle = async function(){

    const provider =
    new GoogleAuthProvider();

    await signInWithPopup(
        auth,
        provider
    );
};

window.logoutUser = async function () {
    try {
        await signOut(auth);
        alert("Logged out successfully");
    } catch (error) {
        console.error("Logout failed:", error);
    }
};



onAuthStateChanged(auth, async user => {

    window.currentUser = user;

    const loginPage =
        document.getElementById("loginPage");

    const appContainer =
        document.getElementById("appContainer");

    if(user){

        loginPage.style.display = "none";

        appContainer.style.display = "block";

const userNameEl = document.getElementById("userName");

if (window.innerWidth <= 768) {

    userNameEl.style.display = "none";

} else {

    userNameEl.style.display = "inline";
    userNameEl.innerText = user.displayName;

}

        document.getElementById(
            "userPhoto"
        ).src =
        user.photoURL;

        if(window.initializeExpenseApp){

            await window.initializeExpenseApp();

        }

    }else{

        loginPage.style.display = "flex";

        appContainer.style.display = "none";

        expenses = [];

    }

});


console.log("Firebase Auth Ready");
console.log("load fn =", window.loadExpensesFromFirestore);
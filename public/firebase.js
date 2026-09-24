// Firebase app, auth, and Firestore imports for the expense tracker.
import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
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

// Firebase project configuration used to connect the app to Google Authentication and Firestore.
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

// Save a single expense record under the logged-in user's Firestore collection.
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

// Read all saved expense records for the current signed-in user.
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

// Delete one expense document from Firestore by its document ID.
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

// Update an existing expense item with the edited values.
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


// Trigger Google sign-in so the user can access their personal expense data.
window.signInGoogle = async function(){

    const provider =
    new GoogleAuthProvider();

    await signInWithPopup(
        auth,
        provider
    );
};

// Log the user out from Firebase and end the current session.
window.logoutUser = async function () {
    try {
        await signOut(auth);
        alert("Logged out successfully");
    } catch (error) {
        console.error("Logout failed:", error);
    }
};



// Keep track of the auth state and show or hide the app according to login status.
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
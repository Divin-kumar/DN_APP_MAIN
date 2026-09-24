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

// Save a single income record under a separate collection to keep expense logic isolated.
window.saveIncomeToFirestore =
async function(income){

    await addDoc(
        collection(
            db,
            "users",
            window.currentUser.uid,
            "incomes"
        ),
        income
    );
};

// Read all income records for the current signed-in user.
window.loadIncomesFromFirestore =
async function(){

    const snapshot =
    await getDocs(
        collection(
            db,
            "users",
            window.currentUser.uid,
            "incomes"
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

window.updateIncomeInFirestore =
async function(income){

    await updateDoc(
        doc(
            db,
            "users",
            window.currentUser.uid,
            "incomes",
            income.firestoreId
        ),
        {
            name: income.name,
            type: income.type,
            amount: income.amount,
            date: income.date
        }
    );
};

window.mergeGuestDataIntoAccount = async function(snapshot){
    const collections = ["expenses", "incomes", "eventGroups", "reminders"];

    for(const type of collections){
        const records = type === "eventGroups"
            ? (snapshot.eventGroups || snapshot.events || [])
            : (snapshot[type] || []);

        for(const record of records){
            const copy = {...record};
            delete copy.firestoreId;
            await addDoc(
                collection(db, "users", window.currentUser.uid, type),
                copy
            );
        }
    }
};

window.saveEventToFirestore = async function(eventRecord){
    await addDoc(
        collection(db, "users", window.currentUser.uid, "eventGroups"),
        {
            ...eventRecord,
            type: eventRecord.type || "Other",
            customType: eventRecord.customType || "",
            recurrence: eventRecord.recurrence || "none",
            activities: eventRecord.activities || [],
            notes: eventRecord.notes || ""
        }
    );
};

window.updateEventInFirestore = async function(eventRecord){
    await updateDoc(
        doc(db, "users", window.currentUser.uid, "eventGroups", eventRecord.firestoreId),
        {
            name: eventRecord.name,
            date: eventRecord.date,
            type: eventRecord.type || "Other",
            customType: eventRecord.customType || "",
            recurrence: eventRecord.recurrence || "none",
            activities: eventRecord.activities || [],
            notes: eventRecord.notes || ""
        }
    );
};

window.deleteEventFromFirestore = async function(firestoreId){
    await deleteDoc(
        doc(db, "users", window.currentUser.uid, "eventGroups", firestoreId)
    );
};

window.loadEventsFromFirestore = async function(){
    const eventGroupsRef = collection(db, "users", window.currentUser.uid, "eventGroups");
    let snapshot = await getDocs(eventGroupsRef);

    if(snapshot.empty){
        const legacySnapshot = await getDocs(
            collection(db, "users", window.currentUser.uid, "events")
        );

        for(const eventDoc of legacySnapshot.docs){
            await addDoc(eventGroupsRef, {
                ...eventDoc.data(),
                type: eventDoc.data().type || "Other",
                customType: eventDoc.data().customType || "",
                recurrence: eventDoc.data().recurrence || "none",
                activities: eventDoc.data().activities || [],
                notes: eventDoc.data().notes || ""
            });
            await deleteDoc(eventDoc.ref);
        }

        snapshot = await getDocs(eventGroupsRef);
    }

    const data = [];
    snapshot.forEach(eventDoc => {
        data.push({
            firestoreId: eventDoc.id,
            ...eventDoc.data()
        });
    });
    return data;
};

window.deleteIncomeFromFirestore =
async function(firestoreId){

    await deleteDoc(
        doc(
            db,
            "users",
            window.currentUser.uid,
            "incomes",
            firestoreId
        )
    );
};

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

        {
            ...expense,
            eventId: expense.eventId ?? null
        }
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
            date: expense.date,
            eventId: expense.eventId ?? null,
            activityId: expense.activityId ?? null
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
        if(window.isGuestSession && window.isGuestSession()){
            window.endGuestSession();
            window.location.reload();
            return;
        }
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

        document.getElementById("guestBanner").style.display = "none";

        if(window.isGuestMigrationPending && window.isGuestMigrationPending() && window.guestStorage.hasData()){
            document.getElementById("migrationModal").style.display = "block";
        }

        if(window.showModule){
            window.showModule("expenses");
        }

        if(window.initializeExpenseApp){

            await window.initializeExpenseApp();

        }

        if(window.initializeIncomeApp){

            await window.initializeIncomeApp();

        }

        if(window.loadEventsFromFirestore){
            const eventRecords = await window.loadEventsFromFirestore();
            if(window.setEventsFromStorage){
                window.setEventsFromStorage(eventRecords);
            }
        }

    }else if(window.isGuestSession && window.isGuestSession()){

        window.guestMode = true;
        window.currentUser = null;
        document.getElementById("loginPage").style.display = "none";
        document.getElementById("appContainer").style.display = "block";
        document.getElementById("guestBanner").style.display = "block";

        if(window.refreshGuestData){
            window.refreshGuestData();
        }
        if(window.showModule){
            window.showModule("expenses");
        }
        if(window.initializeExpenseApp){
            await window.initializeExpenseApp();
        }
        if(window.initializeIncomeApp){
            await window.initializeIncomeApp();
        }

    }else{

        loginPage.style.display = "flex";

        appContainer.style.display = "none";

        expenses = [];

    }

});


console.log("Firebase Auth Ready");
console.log("load fn =", window.loadExpensesFromFirestore);
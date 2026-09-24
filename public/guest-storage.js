// Local-only storage adapter used when the user continues as a guest.
const guestStorageKeys = {
    expenses: "lifehub_guest_expenses",
    incomes: "lifehub_guest_incomes",
    events: "lifehub_guest_eventGroups",
    reminders: "lifehub_guest_reminders"
};

function readGuestRecords(type){
    try{
        const currentKey = guestStorageKeys[type];
        const legacyKey = type === "events" ? "lifehub_guest_events" : null;
        const stored = localStorage.getItem(currentKey)
            || (legacyKey ? localStorage.getItem(legacyKey) : null)
            || "[]";
        const records = JSON.parse(stored);

        if(legacyKey && !localStorage.getItem(currentKey) && records.length){
            localStorage.setItem(currentKey, JSON.stringify(records));
            localStorage.removeItem(legacyKey);
        }

        return records;
    }catch(error){
        console.error("Guest data could not be read:", error);
        return [];
    }
}

function writeGuestRecords(type, records){
    localStorage.setItem(guestStorageKeys[type], JSON.stringify(records));
}

window.guestStorage = {
    load(type){
        return readGuestRecords(type);
    },

    add(type, record){
        const records = readGuestRecords(type);
        records.push(record);
        writeGuestRecords(type, records);
        return record;
    },

    update(type, record){
        const records = readGuestRecords(type).map(item =>
            item.id === record.id ? record : item
        );
        writeGuestRecords(type, records);
    },

    remove(type, id){
        writeGuestRecords(
            type,
            readGuestRecords(type).filter(item => item.id !== id)
        );
    },

    hasData(){
        return ["expenses", "incomes", "events", "reminders"]
            .some(type => readGuestRecords(type).length > 0);
    },

    snapshot(){
        return {
            expenses: readGuestRecords("expenses"),
            incomes: readGuestRecords("incomes"),
            events: readGuestRecords("events"),
            reminders: readGuestRecords("reminders")
        };
    },

    clear(){
        Object.values(guestStorageKeys).forEach(key => localStorage.removeItem(key));
    }
};

window.startGuestSession = function(){
    localStorage.setItem("lifehub_guest_mode", "true");
    window.guestMode = true;
};

window.endGuestSession = function(){
    localStorage.removeItem("lifehub_guest_mode");
    window.guestMode = false;
};

window.markGuestMigrationPending = function(){
    localStorage.setItem("lifehub_guest_migration_pending", "true");
    localStorage.removeItem("lifehub_guest_mode");
    window.guestMode = false;
};

window.isGuestMigrationPending = function(){
    return localStorage.getItem("lifehub_guest_migration_pending") === "true";
};

window.clearGuestMigrationPending = function(){
    localStorage.removeItem("lifehub_guest_migration_pending");
};

window.isGuestSession = function(){
    return localStorage.getItem("lifehub_guest_mode") === "true";
};

window.getGuestSnapshot = function(){
    return window.guestStorage.snapshot();
};

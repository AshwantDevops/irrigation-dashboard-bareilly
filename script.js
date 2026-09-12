async function sendWhatsAppNotification(
    whatsappRecipient,
    taskTitle,
    deadline
) {
    const PHONE_NUMBER_ID = '1289877754212511';
    const ACCESS_TOKEN = 'EAAsNG5Sd0LsBSUuhaIR0aNZAeSSAKKqATwfjvPGLyN9syLRUO8AzdjKr6dArDw9TOm1kdzTXEr56023hmy7nGUKPYbbCinbpVh77O0MtY2xnukbYH2JCGuJmh8iQOBZCPOtZA5KuoKureWAU0FKBerKc1iYFb9Of58dsMOh4ZB4OXln5egh0RWiR8q8qnwFEZAgZDZD';

    // Validate WhatsApp recipient
    if (
        !whatsappRecipient ||
        String(whatsappRecipient).trim() === ''
    ) {
        console.error(
            "WhatsApp Error: WhatsApp recipient ID is missing!"
        );

        showToast(
            "WhatsApp not sent: employee has no WhatsApp recipient ID configured.",
            "error"
        );

        return;
    }

    // Remove spaces, +, -, brackets, etc.
    let cleanPhone =
        String(whatsappRecipient).replace(/\D/g, '');

    // Add India country code when only a 10-digit number is provided
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }

    // Basic validation
    if (cleanPhone.length < 10) {
        console.error(
            "WhatsApp Error: Invalid WhatsApp recipient:",
            whatsappRecipient
        );

        showToast(
            "WhatsApp not sent: invalid WhatsApp recipient ID.",
            "error"
        );

        return;
    }

    const url =
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
        messaging_product: "whatsapp",

        to: cleanPhone,

        type: "text",

        text: {
            body:
                `📢 Irrigation Division Bareilly\n\n` +
                `New Task Assigned:\n` +
                `📋 Task: ${taskTitle}\n` +
                `⏰ Deadline: ${deadline}\n\n` +
                `Please check your dashboard.`
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',

            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {

            console.log(
                "WhatsApp message sent successfully:",
                result
            );

            showToast(
                "WhatsApp notification delivered to employee.",
                "success"
            );

            return true;

        } else {

            console.error(
                "Failed to send WhatsApp:",
                result
            );

            const errMsg =
                result?.error?.message ||
                "Unknown error from WhatsApp API";

            showToast(
                `WhatsApp failed: ${errMsg}`,
                "error"
            );

            return false;
        }

    } catch (error) {

        console.error(
            "Error connecting to WhatsApp API:",
            error
        );

        showToast(
            "WhatsApp API connection error. Check console / network.",
            "error"
        );

        return false;
    }
}
// ================= WHATSAPP USER CONFIGURATION =================

let whatsappUsers = {};
let whatsappUsersLoaded = false;

async function loadWhatsAppUsers() {
    if (whatsappUsersLoaded) {
        return whatsappUsers;
    }

    try {
        const response = await fetch('./whatsapp-users.json', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const config = await response.json();

        whatsappUsers = config?.users || {};
        whatsappUsersLoaded = true;

    } catch (error) {
        console.error(
            'Unable to load whatsapp-users.json:',
            error
        );

        whatsappUsers = {};
    }

    return whatsappUsers;
}

function getWhatsAppRecipient(employee) {
    if (!employee) {
        return '';
    }

    const configuredId =
        whatsappUsers[String(employee.id)]?.whatsappUserId;

    if (configuredId && String(configuredId).trim()) {
        return String(configuredId).trim();
    }

    // Fallback to employee phone number
    return employee.phone || '';
}

// ================= GLOBAL APP STATE =================

let currentUser = null;

// Employee data is maintained in employees.json.
// Do not hardcode employee/user information in this file.

let employees = [];

let employeesLoaded = false;

// ================= EMPLOYEE DATA =================

async function loadEmployees() {
    if (employeesLoaded) {
        return employees;
    }

    try {
        const response = await fetch('./employees.json', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Support either:
        // 1. { "employees": [...] }
        // 2. [...]
        employees = Array.isArray(data)
            ? data
            : (data?.employees || []);

        employeesLoaded = true;

        console.log(
            `Loaded ${employees.length} employees from employees.json`
        );

        return employees;

    } catch (error) {

        console.error(
            'Unable to load employees.json:',
            error
        );

        employees = [];

        return employees;
    }
}

let tasks = JSON.parse(localStorage.getItem('irr_tasks')) || [];

let masterSchedule = JSON.parse(localStorage.getItem('irr_master')) || [
    { id: 1, work: "Daily report by J.E. (Spillway)", deadline: "8:00 AM" },
    { id: 2, work: "Recording the level and discharge of P.O.A.O. and P.A.O. during the monsoon season", deadline: "Weekly" },
    { id: 3, work: "Verification of the dam and submergence-area land by the Ziledar/Revenue Officials", deadline: "15th of every month" },
    { id: 4, work: "Submission of report regarding the dam/submergence area and all government land by the J.E.", deadline: "30th of every month" },
    { id: 5, work: "Submission of monthly report on the equipment installed at the dam by the J.E.", deadline: "1st of every month" },
    { id: 6, work: "Inspection of watercourses by the Ziledar/Revenue Officials", deadline: "30th of every month" },
    { id: 7, work: "Organizing training on DBM, Design Flood Review Code, Dam Manual and Dam Safety Act", deadline: "Second Wednesday of every month" },
    { id: 8, work: "Preparation of O&M", deadline: "Once every 3 years (31 May)" },
    { id: 9, work: "Inspection of Sub-Divisional Office by the Accounts Officer", deadline: "April" },
    { id: 10, work: "Updating the Land Register", deadline: "10 April" },
    { id: 11, work: "Annual presentation by all staff", deadline: "10 April to 30 April" },
    { id: 12, work: "Inspection of watercourses by the Assistant Engineer", deadline: "30 April" },
    { id: 13, work: "Inspection of watercourses by the Executive Engineer", deadline: "30 April" },
    { id: 14, work: "Pre-Monsoon Inspection", deadline: "30 April" },
    { id: 15, work: "Performance Report of all projects", deadline: "30 April" },
    { id: 16, work: "Submission of works executed during the previous year to the Divisional Office", deadline: "30 April" },
    { id: 17, work: "Preparation of Annual Report", deadline: "30 April" },
    { id: 18, work: "Inspection of watercourses and land by the Assistant Engineer", deadline: "30 May / 30 November" },
    { id: 19, work: "Inspection of Sub-Divisional Office by the Executive Engineer", deadline: "May" },
    { id: 20, work: "Preparation of ARO", deadline: "15 June" },
    { id: 21, work: "Creation of WhatsApp Group by the Ziledar", deadline: "15 June" },
    { id: 22, work: "Availability of emergency essential materials through J.E. (Mechanical)", deadline: "15 June" },
    { id: 23, work: "Ensuring availability of emergency essential materials through J.E. (Civil)", deadline: "15 June" },
    { id: 24, work: "Post-Monsoon Inspection", deadline: "30 November" },
    { id: 25, work: "Updating the Hydrology of the Dam", deadline: "30 November" },
    { id: 26, work: "Annual action plan for works to be carried out at the dam, along with an approval report", deadline: "31 December" },
    { id: 27, work: "Review of the Incident Register and proposing necessary works", deadline: "31 December" },
    { id: 28, work: "Updating the Map/Sheet by the Ziledar", deadline: "31 December" },
    { id: 29, work: "Submission of Drone/Google Map of the Dam and Submergence Area to the Divisional Office", deadline: "31 January" },
    { id: 30, work: "Submission of the Annual Report received from the instruments", deadline: "31 January" },
    { id: 31, work: "Organization of the Annual Sports Meet", deadline: "January" },
    { id: 32, work: "Workshop on the Design of Hydraulic Structures", deadline: "February" },
    { id: 33, work: "Obtaining irrigation-related data from other divisions", deadline: "31 March" },
    { id: 34, work: "Video Work", deadline: "15 April" }
];
if (!localStorage.getItem('irr_master')) {
    localStorage.setItem('irr_master', JSON.stringify(masterSchedule));
}

let chatMessages = JSON.parse(localStorage.getItem('irr_chat')) || [
    { sender: "System", text: "Welcome to the Irrigation Office Portal chat.", time: "10:00 AM" }
];

let officePieInstance = null;
let officeBarInstance = null;

// ================= GOOGLE SIGN-IN AUTHENTICATION =================
// Decodes the JWT "credential" returned by Google Identity Services so we
// can read the signed-in user's email/name/picture without any extra library.
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error decoding Google credential JWT:", e);
        return null;
    }
}

function showLoginError(message) {
    const errEl = document.getElementById('loginError');
    if (errEl) {
        errEl.textContent = message;
        errEl.classList.remove('hidden');
    }
}

function hideLoginError() {
    const errEl = document.getElementById('loginError');
    if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }
}

function showAuthModal() {
    const authModal = document.getElementById('authModal');
    const mainDashboard = document.getElementById('mainDashboard');
    if (authModal) authModal.classList.remove('hidden');
    if (mainDashboard) mainDashboard.classList.add('hidden');
}

function hideAuthModal() {
    const authModal = document.getElementById('authModal');
    const mainDashboard = document.getElementById('mainDashboard');
    if (authModal) authModal.classList.add('hidden');
    if (mainDashboard) mainDashboard.classList.remove('hidden');
}

// This is the function referenced by data-callback="handleGoogleSignIn"
// on the #g_id_onload element in the HTML. Google Identity Services calls
// it automatically once the user completes Google Sign-In.
function handleGoogleSignIn(response) {
    hideLoginError();

    if (!response || !response.credential) {
        showLoginError("Google Sign-In failed. Please try again.");
        return;
    }

    const payload = parseJwt(response.credential);
    if (!payload || !payload.email) {
        showLoginError("Could not read your Google account details. Please try again.");
        return;
    }

    const signedInEmail = payload.email.trim().toLowerCase();

    // Only pre-registered departmental staff (matched by email in the
    // employees list) are allowed into the dashboard.
    const matchedEmployee = employees.find(
        emp => emp.email && emp.email.trim().toLowerCase() === signedInEmail
    );

    if (!matchedEmployee) {
        showLoginError(`Access denied: "${payload.email}" is not registered as departmental personnel. Contact admin.`);
        return;
    }

    // Use the Google account photo as a fallback avatar only if the
    // employee hasn't already uploaded a custom profile picture.
    if (!matchedEmployee.avatar && payload.picture) {
        matchedEmployee.avatar = payload.picture;
    }

    currentUser = matchedEmployee;

    sessionStorage.setItem('irr_logged_user', JSON.stringify(currentUser));
    localStorage.setItem('irr_current_user', JSON.stringify(currentUser));

    saveData();
    hideAuthModal();
    initDashboard();
    showToast(`Welcome, ${currentUser.name}!`, "success");
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('irr_logged_user');
    localStorage.removeItem('irr_current_user');

    // Let the user pick a different Google account next time instead of
    // being silently auto-signed back in.
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }

    hideLoginError();
    showAuthModal();
    showToast("Logged out successfully.", "info");
}

// ================= INITIALIZATION (single listener) =================
document.addEventListener('DOMContentLoaded', () => {
    // Try to restore a previous session (e.g. after a page refresh) instead
    // of forcing the user to sign in with Google again every time.
    const savedUser = sessionStorage.getItem('irr_logged_user') || localStorage.getItem('irr_current_user');

    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
        } catch (e) {
            currentUser = null;
        }
    }

    const bindEvent = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    bindEvent('addEmployeeForm', 'submit', handleAddEmployee);
    bindEvent('taskForm', 'submit', handleAssignTask);
    bindEvent('chatForm', 'submit', handleSendMessage);
    bindEvent('addMasterScheduleForm', 'submit', handleAddMasterSchedule);

    // Re-validate that the restored session still corresponds to a real,
    // currently-registered employee before letting them straight in.
    const stillValid = !!currentUser && employees.some(
        emp => emp.email && currentUser.email && emp.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
    );

    if (stillValid) {
        hideAuthModal();
        initDashboard();
    } else {
        currentUser = null;
        sessionStorage.removeItem('irr_logged_user');
        localStorage.removeItem('irr_current_user');
        showAuthModal();
    }
});

// ================= DASHBOARD INITIALIZATION =================
function initDashboard() {
    const mainDashboard = document.getElementById('mainDashboard');
    if (mainDashboard) mainDashboard.classList.remove('hidden');

    updateUserUI();
    renderEmployees();
    renderTasks();
    renderChat();
    renderMasterSchedule();
    renderAccountTab();
}

// ================= UTILS & STORAGE (single definitions) =================
function saveData() {
    localStorage.setItem('irr_employees', JSON.stringify(employees));
    localStorage.setItem('irrigation_employees', JSON.stringify(employees));
    localStorage.setItem('irr_tasks', JSON.stringify(tasks));
    localStorage.setItem('irr_master', JSON.stringify(masterSchedule));
    localStorage.setItem('irr_chat', JSON.stringify(chatMessages));
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');

    let bgCol = type === 'success' ? 'bg-emerald-600 text-white'
        : type === 'error' ? 'bg-red-600 text-white'
        : 'bg-blue-600 text-white';

    toast.className = `${bgCol} px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl transition transform translate-y-2 opacity-0 pointer-events-auto flex items-center gap-2`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}</span> ${message}`;

    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 50);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ================= TAB SWITCHING =================
function switchTab(tabId) {
    const tabs = ['dashboard', 'chat', 'Schedule', 'Account', 'analytics'];
    tabs.forEach(t => {
        const el = document.getElementById(`tab${t}`);
        if (el) el.classList.add('hidden');

        const btn = document.getElementById(`tabBtn${t}`);
        if (btn) {
            btn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-white transition";
        }
    });

    const activeEl = document.getElementById(`tab${tabId}`);
    if (activeEl) {
        activeEl.classList.remove('hidden');

        if (tabId === 'Schedule') renderMasterSchedule();
        if (tabId === 'Account') renderAccountTab();
        if (tabId === 'analytics') {
            setTimeout(() => { renderAnalyticsCharts(); }, 50);
        }
    }

    const activeBtn = document.getElementById(`tabBtn${tabId}`);
    if (activeBtn) {
        activeBtn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition";
    }
}

// ================= USER UI & PROFILE UPDATES =================
function updateUserUI() {
    if (!currentUser) return;

    const userDisplay = document.getElementById('loggedInUserDisplay');
    if (userDisplay) userDisplay.textContent = currentUser.name;

    const avatarEls = [
        document.getElementById('sidebarUserAvatar'),
        document.getElementById('modalUserAvatar'),
        document.getElementById('accountUserAvatar')
    ];

    avatarEls.forEach(img => {
        if (!img) return;
        if (currentUser.avatar) {
            img.src = currentUser.avatar;
            img.classList.remove('hidden');
        } else {
            img.classList.add('hidden');
        }
    });

    const placeholderEls = [
        document.getElementById('circlePlaceholder'),
        document.getElementById('accountUserPlaceholder')
    ];

    placeholderEls.forEach(p => {
        if (p) p.style.display = currentUser.avatar ? 'none' : 'flex';
    });
}

function openProfileSettings() {
    if (!currentUser) return;
    const nameEl = document.getElementById('modalUserName');
    const postEl = document.getElementById('modalUserPost');
    const modal = document.getElementById('profileModal');

    if (nameEl) nameEl.textContent = currentUser.name;
    if (postEl) postEl.textContent = currentUser.post;
    if (modal) modal.classList.remove('hidden');
}

function closeProfileSettings() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('hidden');
}

function updateProfileImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            currentUser.avatar = e.target.result;
            const idx = employees.findIndex(e => e.email && e.email.toLowerCase() === currentUser.email.toLowerCase());
            if (idx !== -1) employees[idx].avatar = currentUser.avatar;

            saveData();
            updateUserUI();
            closeProfileSettings();
            showToast("Profile picture updated successfully!", "success");
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function removeProfilePicture() {
    if (!currentUser) return;
    currentUser.avatar = "";
    const idx = employees.findIndex(e => e.email && e.email.toLowerCase() === currentUser.email.toLowerCase());
    if (idx !== -1) employees[idx].avatar = "";

    saveData();
    updateUserUI();
    closeProfileSettings();
    showToast("Profile picture removed.", "info");
}

function closeFullImageView() {
    const modal = document.getElementById('fullImageViewModal');
    if (modal) modal.classList.add('hidden');
}

// ================= EMPLOYEE DIRECTORY =================
function handleAddEmployee(e) {
    e.preventDefault();
    const name = document.getElementById('newEmpName').value.trim();
    const post = document.getElementById('newEmpPost').value.trim();
    const email = document.getElementById('newEmpEmail').value.trim();
    const phone = document.getElementById('newEmpPhone').value.trim();

    if (employees.some(emp => emp.email.toLowerCase() === email.toLowerCase())) {
        showToast("Employee with this email already exists!", "error");
        return;
    }

    const newId = employees.length > 0 ? Math.max(...employees.map(emp => emp.id || 0)) + 1 : 1;
    employees.push({ id: newId, name, post, email, phone, avatar: "" });

    saveData();
    renderEmployees();
    document.getElementById('addEmployeeForm').reset();
    showToast("New staff member added & saved permanently!", "success");
    renderAnalyticsCharts();
}

function renderEmployees() {
    const list = document.getElementById('employeeList');
    const empCountBadge = document.getElementById('empCountBadge');

    if (!list) return;
    list.innerHTML = '';

    if (empCountBadge) {
        empCountBadge.innerText = `${employees.length} Staff`;
    }

    employees.forEach((emp) => {
        const div = document.createElement('div');
        div.className = "bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition";
        div.innerHTML = `
            <div class="flex items-center gap-3 truncate min-w-0">
                <div class="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                    ${emp.name.charAt(0)}
                </div>
                <div class="min-w-0">
                    <h4 class="text-xs font-bold text-white truncate">${emp.name}</h4>
                    <p class="text-[11px] text-cyan-400 font-medium">${emp.post}</p>
                    <p class="text-[10px] text-slate-400 truncate">📧 ${emp.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <a href="tel:${emp.phone}" class="bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white text-xs px-2.5 py-1.5 rounded-lg transition border border-purple-500/30 flex items-center gap-1 shadow" title="Call ${emp.phone}">
                    📞 Call
                </a>
                <button onclick="deleteEmployee(${emp.id})" class="text-red-400 hover:bg-red-500/20 p-2 rounded-lg text-xs transition" title="Delete Staff">🗑️</button>
            </div>
        `;
        list.appendChild(div);
    });
    populateEmployeeOptions();
}

function deleteEmployee(id) {
    employees = employees.filter(emp => emp.id !== id);
    saveData();
    renderEmployees();
    showToast("Staff member removed.", "info");
    renderAnalyticsCharts();
}

function populateEmployeeOptions() {
    const datalist = document.getElementById('employeeOptions');
    if (!datalist) return;
    datalist.innerHTML = '';
    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.name;
        datalist.appendChild(option);
    });
}
function openAddEmployeeModal() {
    const modal = document.getElementById('addEmployeeModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddEmployeeModal() {
    const modal = document.getElementById('addEmployeeModal');
    if (modal) modal.style.display = 'none';
}

// ================= TASK MANAGEMENT =================

async function handleAssignTask(e) {
    if (e) e.preventDefault();

    const assigneeInput = document.getElementById('taskAssignee');
    const deadlineInput = document.getElementById('taskDeadline');
    const descInput = document.getElementById('taskDesc');

    if (!assigneeInput || !deadlineInput || !descInput) {
        return;
    }

    const assignee = assigneeInput.value.trim();
    const deadline = deadlineInput.value;
    const desc = descInput.value.trim();

    if (!assignee || !deadline || !desc) {
        showToast("Please fill all task fields!", "error");
        return;
    }

    // Find employee using the selected employee name.
    const foundEmp = employees.find(
        emp =>
            emp.name &&
            emp.name.trim().toLowerCase() ===
            assignee.toLowerCase()
    );

    if (!foundEmp) {
        showToast(
            `No matching employee found for "${assignee}". Check spelling or pick from the list.`,
            "error"
        );

        // Keep the existing behavior:
        // task is still created even if employee is not found.
    }

    // Create the task.
    const newTask = {
        id: Date.now(),
        assignee,
        deadline,
        desc,

        m80: false,
        m50: false,
        m10: false,

        status: "Pending",
        done: false,

        notifiedDone: false,
        notifiedMissed: false
    };

    // Save task.
    tasks.push(newTask);

    saveData();
    renderTasks();
    renderAccountTab();

    // Reset form.
    const taskForm = document.getElementById('taskForm');

    if (taskForm) {
        taskForm.reset();
    }

    // ================= WHATSAPP NOTIFICATION =================
    //
    // Employee ID is used to find the WhatsApp recipient
    // from whatsapp-users.json.
    //
    // Example:
    //
    // Employee ID 12
    //       ↓
    // whatsapp-users.json
    //       ↓
    // whatsappUserId
    //       ↓
    // WhatsApp API

    if (foundEmp) {
        await loadWhatsAppUsers();

        const whatsappRecipient =
            getWhatsAppRecipient(foundEmp);

        if (whatsappRecipient) {

            showToast(
                "Task assigned. Sending WhatsApp notification...",
                "info"
            );

            await sendWhatsAppNotification(
                whatsappRecipient,
                desc,
                deadline
            );

        } else {

            showToast(
                "Task assigned, but no WhatsApp recipient ID is configured for this employee.",
                "warning"
            );

            console.warn(
                "No WhatsApp recipient configured for employee:",
                foundEmp.id,
                foundEmp.name
            );
        }
    }
}
// Returns true if a task's deadline (YYYY-MM-DD, from the date input) has
// already passed as of today.
function isTaskOverdue(deadlineStr) {
    if (!deadlineStr) return false;
    const dl = new Date(deadlineStr);
    if (isNaN(dl.getTime())) return false;
    const today = new Date();
    dl.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return dl.getTime() < today.getTime();
}

// Single source of truth for what badge a task should show, combining the
// milestone-based status with the "Done" tick and deadline check.
function getTaskStatusBadge(task) {
    if (task.done) {
        return { label: "Completed", cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    }
    if (isTaskOverdue(task.deadline)) {
        return { label: "Missed Deadline", cls: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    }
    return { label: task.status || "Pending", cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
}

function renderTasks() {
    const tbody = document.getElementById('taskTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (typeof tasks === 'undefined' || tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-xs text-slate-500">No active work assignments found.</td></tr>`;
        return;
    }

    const validTasks = tasks.filter(task => task && task.desc && task.desc.trim() !== "");
    const uniqueTasks = Array.from(new Map(validTasks.map(task => [task.id, task])).values());

    uniqueTasks.forEach((task) => {
        const badge = getTaskStatusBadge(task);
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 transition border-b border-slate-800/50";
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-200 text-xs">${task.assignee}</td>
            <td class="p-3 text-slate-300 text-xs max-w-xs truncate">${task.desc}</td>
            <td class="p-3 text-slate-400 text-xs">${task.deadline}</td>
            <td class="p-3 text-center"><input type="checkbox" ${task.m80 ? 'checked' : ''} onchange="toggleMilestone(${task.id}, 'm80')" class="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"></td>
            <td class="p-3 text-center"><input type="checkbox" ${task.m50 ? 'checked' : ''} onchange="toggleMilestone(${task.id}, 'm50')" class="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"></td>
            <td class="p-3 text-center"><input type="checkbox" ${task.m10 ? 'checked' : ''} onchange="toggleMilestone(${task.id}, 'm10')" class="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"></td>
            <td class="p-3">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${badge.cls}">
                    ${badge.label}
                </span>
            </td>
            <td class="p-3 text-center">
                ${task.done
                    ? `<span class="text-emerald-500 font-bold text-xs">✔ Done</span>`
                    : `<input type="checkbox" onchange="markTaskDone(${task.id})" class="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer" title="Mark this task as done">`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Fire (once each) any "missed deadline" notifications for tasks that
    // slipped past their deadline without being marked done.
    checkOverdueNotifications();
}

function toggleMilestone(id, milestoneKey) {
    if (typeof tasks === 'undefined') return;
    const task = tasks.find(t => t.id === id);
    if (task) {
        task[milestoneKey] = !task[milestoneKey];
        if (task.m80 && task.m50 && task.m10) {
            task.status = "Completed";
        } else {
            task.status = "In Progress";
        }
        saveData();
        renderTasks();
        renderAccountTab();
    }
}

// Called when the employee ticks the "Done" checkbox for their task.
// Marks the task complete and fires a happy toast celebrating them by name.
function markTaskDone(id) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.done) return;

    task.done = true;
    task.status = "Completed";

    if (!task.notifiedDone) {
        showToast(`🎉 Task completed by ${task.assignee}!`, "success");
        task.notifiedDone = true;
    }

    saveData();
    renderTasks();
    renderAccountTab();
    renderAnalyticsCharts();
}

// Scans all tasks for ones that are overdue and were never marked done,
// and fires a one-time sad toast for each. Guarded by task.notifiedMissed
// so the same task doesn't re-announce itself on every render.
function checkOverdueNotifications() {
    let changed = false;
    tasks.forEach(task => {
        if (!task.done && isTaskOverdue(task.deadline) && !task.notifiedMissed) {
            task.notifiedMissed = true;
            showToast(`😔 ${task.assignee} couldn't complete the task on time (deadline was ${task.deadline})`, "error");
            changed = true;
        }
    });
    if (changed) saveData();
}

function clearAllTasks() {
    if (confirm("Are you sure you want to clear all tasks?")) {
        tasks = [];
        saveData();
        renderTasks();
        renderAccountTab();
        showToast("All tasks cleared.", "info");
    }
}

// ================= CHAT SYSTEM =================
function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chatMessageInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !currentUser) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    chatMessages.push({ sender: currentUser.name, text, time });

    saveData();
    renderChat();
    input.value = '';
}

function renderChat() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    chatBox.innerHTML = '';

    chatMessages.forEach(msg => {
        const isMe = currentUser && msg.sender === currentUser.name;
        const div = document.createElement('div');
        div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;
        div.innerHTML = `
            <span class="text-[10px] text-slate-400 mb-0.5 px-1">${msg.sender} • ${msg.time}</span>
            <div class="max-w-md p-3 rounded-2xl text-xs ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}">
                ${msg.text}
            </div>
        `;
        chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

function clearChat() {
    chatMessages = [];
    saveData();
    renderChat();
}

// ================= MASTER SCHEDULE =================
function renderMasterSchedule() {
    const tbody = document.getElementById('masterScheduleTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    masterSchedule.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition text-xs border-b border-slate-800/60";

        tr.innerHTML = `
            <td class="p-3.5 text-slate-400 font-medium">${index + 1}</td>
            <td class="p-3.5 font-semibold text-slate-200">${item.work}</td>
            <td class="p-3.5 text-cyan-400">${item.deadline}</td>
            <td class="p-3.5 text-center flex items-center justify-center gap-2">
                <button onclick="assignFromMaster('${item.work.replace(/'/g, "\\'")}', '${item.deadline.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white border border-cyan-500/30 rounded-lg font-medium transition">Assign</button>
                <button onclick="deleteMasterTask(${item.id})" class="px-2.5 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 rounded-lg font-medium transition">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function handleAddMasterSchedule(event) {
    if (event) event.preventDefault();
    const workInput = document.getElementById('newMasterWork');
    const deadlineInput = document.getElementById('newMasterDeadline');

    if (!workInput || !deadlineInput) return;

    const workText = workInput.value.trim();
    const deadlineText = deadlineInput.value.trim();

    if (!workText || !deadlineText) return;

    const newItem = {
        id: Date.now(),
        work: workText,
        deadline: deadlineText
    };

    masterSchedule.push(newItem);
    saveData();

    workInput.value = '';
    deadlineInput.value = '';

    renderMasterSchedule();
    renderAnalyticsCharts();
}

function deleteMasterTask(id) {
    masterSchedule = masterSchedule.filter(item => item.id !== id);
    saveData();
    renderMasterSchedule();
    renderAnalyticsCharts();
}

function assignFromMaster(workTitle, frequency) {
    switchTab('dashboard');

    const descInput = document.getElementById('taskDesc');
    if (descInput) {
        descInput.value = workTitle;
    }

    const deadlineInput = document.getElementById('taskDeadline');
    if (deadlineInput) {
        deadlineInput.value = calculateDeadlineDate(frequency);
    }

    showToast(`Task loaded: "${workTitle}"`, "info");
}

function calculateDeadlineDate(freqText) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const text = freqText.trim();

    const months = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
    };

    let targetDate = new Date(today);
    const lowerText = text.toLowerCase();

    if (lowerText.includes('weekly') || lowerText.includes('week')) {
        targetDate.setDate(today.getDate() + 7);
    } else {
        let foundMonth = null;
        let foundDay = 1;

        for (let m in months) {
            if (lowerText.includes(m)) {
                foundMonth = months[m];
                break;
            }
        }

        const match = text.match(/\d+/);
        if (match) {
            foundDay = parseInt(match[0]);
        }

        if (foundMonth !== null) {
            targetDate.setFullYear(currentYear);
            targetDate.setMonth(foundMonth);
            targetDate.setDate(foundDay);

            if (targetDate < today) {
                targetDate.setFullYear(currentYear + 1);
            }
        } else if (match) {
            const dayNum = parseInt(match[0]);
            if (today.getDate() > dayNum) {
                targetDate.setMonth(today.getMonth() + 1);
            }
            targetDate.setDate(dayNum);
        } else {
            targetDate.setDate(today.getDate() + 3);
        }
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function openCalendar() {
    const dateInput = document.getElementById('taskDeadline');
    if (dateInput) {
        if (typeof dateInput.showPicker === 'function') {
            dateInput.showPicker();
        } else {
            dateInput.focus();
            dateInput.click();
        }
    }
}

// ================= ACCOUNT TAB & PROGRESS =================
function renderAccountTab() {
    if (!currentUser) return;
    const nameEl = document.getElementById('accountUserName');
    const postEl = document.getElementById('accountUserPost');
    if (nameEl) nameEl.textContent = currentUser.name;
    if (postEl) postEl.textContent = currentUser.post;

    const avatarImg = document.getElementById('accountUserAvatar');
    const placeholder = document.getElementById('accountUserPlaceholder');
    if (avatarImg && placeholder) {
        if (currentUser.avatar) {
            avatarImg.src = currentUser.avatar;
            avatarImg.classList.remove('hidden');
            placeholder.style.display = 'none';
        } else {
            avatarImg.classList.add('hidden');
            placeholder.style.display = 'flex';
        }
    }

    const myTasks = tasks.filter(t => t.assignee.toLowerCase() === currentUser.name.toLowerCase());
    const completedCount = myTasks.filter(t => t.done || t.status === 'Completed').length;
    const completedCountEl = document.getElementById('accountCompletedCount');
    if (completedCountEl) completedCountEl.textContent = completedCount;

    const tbody = document.getElementById('accountTaskTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (myTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-xs text-slate-500">You have no tasks assigned currently.</td></tr>`;
        return;
    }

    myTasks.forEach(task => {
        const badge = getTaskStatusBadge(task);
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 transition";
        tr.innerHTML = `
            <td class="p-3.5 font-medium text-slate-200 text-xs">${task.desc}</td>
            <td class="p-3.5 text-slate-400 text-xs">${task.deadline}</td>
            <td class="p-3.5 text-center text-xs text-slate-300">
                80% [${task.m80 ? '✓' : '•'}] | 50% [${task.m50 ? '✓' : '•'}] | 10% [${task.m10 ? '✓' : '•'}]
            </td>
            <td class="p-3.5">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${badge.cls}">
                    ${badge.label}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ================= ANALYTICS CHARTS ENGINE =================
function renderAnalyticsCharts() {
    const hasEmployees = Array.isArray(employees) && employees.length > 0;
    const hasTasks = Array.isArray(tasks);

    // ---- Pie / Doughnut Chart ----
    const pieCtx = document.getElementById('overallPieChart');
    if (pieCtx) {
        if (officePieInstance) officePieInstance.destroy();

        let totalCompleted = 0;
        let totalPending = 0;
        let totalInProgress = 0;

        if (hasTasks) {
            totalCompleted = tasks.filter(t => t.done || t.status === "Completed").length;
            totalPending = tasks.filter(t => !t.done && (t.status === "Pending" || !t.status)).length;
            totalInProgress = tasks.filter(t => !t.done && t.status === "In Progress").length;
        }

        const pieData = (totalCompleted === 0 && totalPending === 0 && totalInProgress === 0)
            ? [1, 0, 0]
            : [totalCompleted, totalPending, totalInProgress];

        officePieInstance = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending', 'In Progress'],
                datasets: [{
                    data: pieData,
                    backgroundColor: ['#10B981', '#F59E0B', '#3B82F6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94A3B8', font: { size: 11 } }
                    },
                    tooltip: {
                        enabled: hasTasks && tasks.length > 0
                    }
                }
            }
        });
    }

    // ---- Employee-wise Horizontal Bar Chart ----
    const barCtx = document.getElementById('employeeHorizontalBar');
    if (barCtx) {
        if (officeBarInstance) officeBarInstance.destroy();

        let staffNames = [];
        let staffTasksCount = [];

        if (hasEmployees) {
            employees.forEach(emp => {
                staffNames.push(emp.name);
                let count = 0;
                if (hasTasks) {
                    count = tasks.filter(t =>
                        t.assignee &&
                        t.assignee.toLowerCase() === emp.name.toLowerCase() &&
                        (t.done || t.status === "Completed")
                    ).length;
                }
                staffTasksCount.push(count);
            });
        }

        if (staffNames.length === 0) {
            staffNames = ["No Staff Available"];
            staffTasksCount = [0];
        }

        officeBarInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: staffNames,
                datasets: [{
                    label: 'Tasks Completed',
                    data: staffTasksCount,
                    backgroundColor: '#3B82F6',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94A3B8', stepSize: 1 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#94A3B8', font: { size: 10 } }
                    }
                }
            }
        });
    }

    setTimeout(() => {
        if (officePieInstance) officePieInstance.resize();
        if (officeBarInstance) officeBarInstance.resize();
    }, 50);
}

// ================= AUTOMATIC WHATSAPP REMINDERS (NEW — fully additive) =================
// Nothing above this line has been changed. This section only reads from
// the existing `tasks` and `employees` arrays and reuses the same WhatsApp
// Cloud API credentials already used for the "task assigned" notification.

const REMINDER_PHONE_NUMBER_ID = '1289877754212511';
const REMINDER_ACCESS_TOKEN = 'EAAsNG5Sd0LsBSUuhaIR0aNZAeSSAKKqATwfjvPGLyN9syLRUO8AzdjKr6dArDw9TOm1kdzTXEr56023hmy7nGUKPYbbCinbpVh77O0MtY2xnukbYH2JCGuJmh8iQOBZCPOtZA5KuoKureWAU0FKBerKc1iYFb9Of58dsMOh4ZB4OXln5egh0RWiR8q8qnwFEZAgZDZD';

// Tracks which reminders have already gone out, keyed by task id + day, so
// the same task never gets the same reminder twice. Stored separately from
// `tasks` in its own localStorage key — the shape of `tasks` is untouched.
let reminderLog = JSON.parse(localStorage.getItem('irr_reminder_log')) || {};

function saveReminderLog() {
    localStorage.setItem('irr_reminder_log', JSON.stringify(reminderLog));
}

function cleanWhatsAppPhone(phone) {
    let clean = String(phone).replace(/\D/g, '');
    if (clean.length === 10) clean = '91' + clean;
    return clean;
}

// Generic WhatsApp text sender used only by the reminder engine below —
// separate from sendWhatsAppNotification() so that function is never touched.
async function sendWhatsAppReminderMessage(phone, message) {
    if (!phone || phone === 'N/A' || String(phone).trim() === '') {
        console.error("Reminder WhatsApp Error: phone number missing.");
        return false;
    }

    const cleanPhone = cleanWhatsAppPhone(phone);
    const url = `https://graph.facebook.com/v17.0/${REMINDER_PHONE_NUMBER_ID}/messages`;
    const data = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: message }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REMINDER_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
            console.log("Reminder sent:", result);
            return true;
        } else {
            console.error("Reminder failed:", result);
            const errMsg = result?.error?.message || "Unknown WhatsApp API error";
            showToast(`Reminder not sent: ${errMsg}`, "error");
            return false;
        }
    } catch (err) {
        console.error("Reminder network error:", err);
        showToast("Reminder failed: network/API error. Check console.", "error");
        return false;
    }
}

// Scans every task and sends:
//  - a "due tomorrow" reminder exactly 1 day before the deadline
//  - a "still overdue" reminder once per calendar day, for as long as a
//    task stays incomplete past its deadline
// Tasks marked done, or whose employee has no phone on file, are skipped.
async function runAutomaticWhatsAppReminders() {
    if (typeof tasks === 'undefined' || !Array.isArray(tasks) || typeof employees === 'undefined') return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const task of tasks) {
        if (!task || !task.desc || task.done) continue;

        const emp = employees.find(
            e => e.name && task.assignee && e.name.trim().toLowerCase() === task.assignee.trim().toLowerCase()
        );
        if (!emp) continue;

await loadWhatsAppUsers();

const whatsappRecipient =
    getWhatsAppRecipient(emp);

if (!whatsappRecipient) {
    console.warn(
        "No WhatsApp recipient configured for:",
        emp.id,
        emp.name
    );

    continue;
}

const deadlineDate =
    new Date(task.deadline);
        if (isNaN(deadlineDate.getTime())) continue;
        deadlineDate.setHours(0, 0, 0, 0);

        const diffDays = Math.round((deadlineDate - today) / (1000 * 60 * 60 * 24));

        // 1 day before deadline
        if (diffDays === 1) {
            const key = `upcoming_${task.id}`;
            if (!reminderLog[key]) {
                const msg = `⏰ Reminder - Irrigation Division Bareilly\n\nHi ${task.assignee}, your task "${task.desc}" is due TOMORROW (${task.deadline}). Please complete it and update your dashboard.`;
                sendWhatsAppReminderMessage(
    whatsappRecipient,
    msg
)
                if (sent) {
                    reminderLog[key] = true;
                    saveReminderLog();
                }
            }
        }

        // Overdue - once per calendar day it stays incomplete
        if (diffDays < 0) {
            const key = `overdue_${task.id}_${todayKey}`;
            if (!reminderLog[key]) {
                const msg = `⚠️ Reminder - Irrigation Division Bareilly\n\nHi ${task.assignee}, your task "${task.desc}" was due on ${task.deadline} and is still incomplete. Please complete it as soon as possible.`;
                const sent = await sendWhatsAppReminderMessage(emp.phone, msg);
                if (sent) {
                    reminderLog[key] = true;
                    saveReminderLog();
                }
            }
        }
    }
}

// Starts the reminder engine: runs once immediately, then every 6 hours
// for as long as this dashboard tab stays open in a browser.
function startAutomaticReminderEngine() {
    runAutomaticWhatsAppReminders();
    setInterval(runAutomaticWhatsAppReminders, 6 * 60 * 60 * 1000); // every 6 hours
}

// Kicks the engine off once the page has loaded. This is a SEPARATE
// DOMContentLoaded listener — the original one higher up in this file is
// untouched, and both listeners run fine side by side.
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startAutomaticReminderEngine, 4000); // small delay so tasks/employees finish loading first
});

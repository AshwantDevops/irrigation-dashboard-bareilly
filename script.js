// Main script

const WHATSAPP_PHONE_NUMBER_ID = "1288119947723289";
const WHATSAPP_API_VERSION = "v17.0";
const WHATSAPP_ACCESS_TOKEN = "EAAXLCtl2jx0BSZAqcKPYpGXc9ydqZAy5GQncPSAor9QjF40RoZAVYNxNtuGhXGGcECXD2P5NPa8KYHtSCh4lk2XFfquMZB3I3oB0EgbEFZCZBqX23UZCxaypxAOE0x18PFHF7k75fCNwQhvsB6rSZCTMXdx1IRb8dM0t6rmXTjHTyYz63UUZAIrYiSaB5I8HfnAZDZD";

async function sendWhatsAppNotification(whatsappRecipient, taskTitle, deadline, taskId, publicToken) {
    try {
        const response = await apiRequest('/api/whatsapp', {
            method: 'POST',
            body: JSON.stringify({
                action: 'assignment',
                recipient: whatsappRecipient,
                taskTitle,
                deadline,
                taskId,
                publicToken
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'WhatsApp API request failed');
        }

        showToast("Task assigned. WhatsApp notification sent.", "success");
        return true;
    } catch (error) {
        console.error("WhatsApp notification error:", error);
        showToast("Task assigned, but WhatsApp notification failed.", "error");
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
        const response = await fetch('./whatsapp-users.json', { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const config = await response.json();
        whatsappUsers = config?.users || {};
        whatsappUsersLoaded = true;

        console.log(`Loaded ${Object.keys(whatsappUsers).length} WhatsApp users`);
    } catch (error) {
        console.error('Unable to load whatsapp-users.json:', error);
        whatsappUsers = {};
    }

    return whatsappUsers;
}

function getWhatsAppRecipient(employeeId) {
    if (!employeeId) {
        return '';
    }

    const recipient = whatsappUsers[String(employeeId)]?.whatsappUserId;
    return recipient ? String(recipient).trim() : '';
}

// ================= GLOBAL APP STATE =================
let currentUser = null;

// Employee data is maintained in employees.json.
// Do not hardcode employee/user information in this file.
let employees = [];
let employeesLoaded = false;
let canManageEmployees = false;
let tasks = [];
let tasksLoaded = false;

// ================= EMPLOYEE DATA =================
async function loadEmployees() {
    // Employee records are read-only application configuration.
    // Source of truth: employees.json.
    if (employeesLoaded) {
        return employees;
    }

    try {
        const response = await apiRequest('/api/employees');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        employees = Array.isArray(data)
            ? data
            : (data?.employees || []);

        canManageEmployees = !!data?.canManageEmployees;
        employeesLoaded = true;
        console.log(`Loaded ${employees.length} employees from employees.json`);

        return employees;
    } catch (error) {
        console.error('Unable to load employees from API:', error);

        // Fallback to the read-only employee master file so the
        // directory and task assignment still work if the API is unavailable.
        try {
            const fallbackResponse = await fetch('./employees.json', { cache: 'no-store' });
            if (!fallbackResponse.ok) {
                throw new Error(`HTTP ${fallbackResponse.status}`);
            }

            const fallbackData = await fallbackResponse.json();
            employees = Array.isArray(fallbackData)
                ? fallbackData
                : (fallbackData?.employees || []);

            // The static fallback is read-only and never grants admin rights.
            canManageEmployees = false;
            employeesLoaded = true;
            console.log(`Loaded ${employees.length} employees from employees.json fallback`);
        } catch (fallbackError) {
            console.error('Unable to load employees.json fallback:', fallbackError);
            employees = [];
        }

        return employees;
    }
}

// ================= ASSIGNED TASK STATE =================
// Assigned tasks are persisted server-side through the Vercel API.
async function loadAssignedTasks() {
    if (tasksLoaded) return tasks;

    try {
        const response = await apiRequest('/api/tasks');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        tasks = Array.isArray(data) ? data : (data?.tasks || []);
        tasksLoaded = true;
    } catch (error) {
        console.error('Unable to load assigned tasks:', error);
        tasks = [];
    }

    return tasks;
}

// ================= MASTER TASK STATE =================
// Master task definitions are maintained in tasks.json.
let masterSchedule = [];
let masterScheduleLoaded = false;

async function loadMasterSchedule() {
    if (masterScheduleLoaded) {
        return masterSchedule;
    }

    try {
        const response = await fetch('./tasks.json', { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        masterSchedule = Array.isArray(data)
            ? data
            : (data?.tasks || []);

        masterScheduleLoaded = true;
        console.log(`Loaded ${masterSchedule.length} master tasks from tasks.json`);

        return masterSchedule;
    } catch (error) {
        console.error('Unable to load tasks.json:', error);
        masterSchedule = [];
        return masterSchedule;
    }
}

// ================= CHAT STATE =================
let chatMessages = JSON.parse(localStorage.getItem('irr_chat')) || [
    {
        sender: "System",
        text: "Welcome to the Irrigation Office Portal chat.",
        time: "10:00 AM"
    }
];

// ================= CHART STATE =================
let officePieInstance = null;
let officeBarInstance = null;

// ================= GOOGLE SIGN-IN AUTHENTICATION =================
async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    const credential = sessionStorage.getItem('irr_google_credential');
    if (credential) {
        headers.set('Authorization', `Bearer ${credential}`);
    }

    return fetch(url, { ...options, headers });
}

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

async function handleGoogleSignIn(response) {
    hideLoginError();

    // Ensure the latest employee master data is loaded before
    // validating the Google account against employees.json.
    await loadEmployees();

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

    const matchedEmployee = employees.find(
        emp => emp.email && emp.email.trim().toLowerCase() === signedInEmail
    );

    if (matchedEmployee) {
        // Registered departmental employee.
        if (!matchedEmployee.avatar && payload.picture) {
            matchedEmployee.avatar = payload.picture;
        }

        currentUser = matchedEmployee;

        console.log(
            "Departmental employee login:",
            signedInEmail
        );

    } else {
        // Any authenticated Google user is allowed to sign in.
        // employees.json is used only to enrich known departmental users;
        // it is no longer an authentication allow-list.
        currentUser = {
            id: `google_${payload.sub || signedInEmail}`,
            name: payload.name || signedInEmail.split('@')[0],
            post: "User",
            phone: "",
            email: signedInEmail,
            avatar: payload.picture || ""
        };

        console.log(
            "New Google user login:",
            signedInEmail
        );
    }

    sessionStorage.setItem(
        'irr_logged_user',
        JSON.stringify(currentUser)
    );

    sessionStorage.setItem(
        'irr_google_credential',
        response.credential
    );

    localStorage.setItem(
        'irr_current_user',
        JSON.stringify(currentUser)
    );

    saveData();
    hideAuthModal();
    initDashboard();

    showToast(
        `Welcome, ${currentUser.name}!`,
        "success"
    );
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('irr_logged_user');
    sessionStorage.removeItem('irr_google_credential');
    localStorage.removeItem('irr_current_user');

    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }

    hideLoginError();
    showAuthModal();
    showToast("Logged out successfully.", "info");
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
    // Restore the authenticated session before calling protected APIs.
    const savedUser =
        sessionStorage.getItem('irr_logged_user') ||
        localStorage.getItem('irr_current_user');

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

    const stillValid =
        !!currentUser &&
        !!currentUser.email &&
        !!sessionStorage.getItem('irr_google_credential');

    if (stillValid) {
        await Promise.all([
            loadEmployees(),
            loadWhatsAppUsers(),
            loadMasterSchedule(),
            loadAssignedTasks()
        ]);

        hideAuthModal();
        initDashboard();
    } else {
        currentUser = null;
        sessionStorage.removeItem('irr_logged_user');
        sessionStorage.removeItem('irr_google_credential');
        localStorage.removeItem('irr_current_user');
        await Promise.all([
            loadWhatsAppUsers(),
            loadMasterSchedule()
        ]);
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

    // Auto-populate the logged-in employee in the task assignment form.
    const taskAssignee = document.getElementById('taskAssignee');
    if (taskAssignee && currentUser?.name) {
        taskAssignee.value = currentUser.name;
    }
}

// ================= UTILS & STORAGE =================
function saveData() {
    // Tasks and employee master data are persisted by the Vercel API.
    // Keep chat locally for now.
    localStorage.setItem('irr_chat', JSON.stringify(chatMessages));
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');

    let bgCol = type === 'success'
        ? 'bg-emerald-600 text-white'
        : type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-blue-600 text-white';

    toast.className = `${bgCol} px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl transition transform translate-y-2 opacity-0 pointer-events-auto flex items-center gap-2`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}</span> ${message}`;

    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 50);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ================= TAB SWITCHING =================
function switchTab(tabId) {
    const tabs = ['dashboard', 'chat', 'Employee', 'Schedule', 'Account', 'analytics'];
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
        if (tabId === 'Employee') renderEmployeeDirectoryTab();
        if (tabId === 'Schedule') renderMasterSchedule();
        if (tabId === 'Account') renderAccountTab();
        if (tabId === 'analytics') setTimeout(() => renderAnalyticsCharts(), 50);
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
            const idx = employees.findIndex(
                e => e.email && e.email.toLowerCase() === currentUser.email.toLowerCase()
            );
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
    const idx = employees.findIndex(
        e => e.email && e.email.toLowerCase() === currentUser.email.toLowerCase()
    );
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
async function handleAddEmployee(e) {
    e.preventDefault();

    if (!canManageEmployees) {
        showToast("Administrator access is required to add employees.", "error");
        return;
    }

    const name = document.getElementById('newEmpName').value.trim();
    const post = document.getElementById('newEmpPost').value.trim();
    const email = document.getElementById('newEmpEmail').value.trim();
    const phone = document.getElementById('newEmpPhone').value.trim();

    if (!name || !post || !email || !phone) {
        showToast("Please fill all employee fields.", "error");
        return;
    }

    try {
        const response = await apiRequest('/api/employees', {
            method: 'POST',
            body: JSON.stringify({
                action: 'create',
                employee: { name, post, email, phone, avatar: "" }
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to add employee.');

        employees = result.employees || employees;
        renderEmployees();
        document.getElementById('addEmployeeForm').reset();
        showToast("Employee added successfully.", "success");
        renderAnalyticsCharts();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to add employee.", "error");
    }
}

function renderEmployees() {
    const list = document.getElementById('employeeList');
    const empCountBadge = document.getElementById('empCountBadge');
    if (!list) return;

    list.innerHTML = '';

    if (empCountBadge) {
        empCountBadge.innerText = `${employees.length} Staff`;
    }

    employees.forEach(emp => {
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
                    📞
                </a>
                ${canManageEmployees ? `<button onclick="editEmployee(${emp.id})" class="text-blue-700 hover:bg-blue-100 p-2 rounded-lg text-xs transition" title="Edit Staff">✏️</button>` : ''}
                ${canManageEmployees ? `<button onclick="deleteEmployee(${emp.id})" class="text-red-400 hover:bg-red-500/20 p-2 rounded-lg text-xs transition" title="Delete Staff">🗑️</button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    populateEmployeeOptions();
    renderEmployeeDirectoryTab();
}

async function editEmployee(id) {
    if (!canManageEmployees) {
        showToast("Administrator access is required to edit employee information.", "error");
        return;
    }

    const employee = employees.find(emp => Number(emp.id) === Number(id));
    if (!employee) return;

    const name = prompt("Employee name:", employee.name);
    if (name === null) return;
    const post = prompt("Post/designation:", employee.post);
    if (post === null) return;
    const email = prompt("Email ID:", employee.email);
    if (email === null) return;
    const phone = prompt("Phone number:", employee.phone || "");
    if (phone === null) return;

    try {
        const response = await apiRequest('/api/employees', {
            method: 'POST',
            body: JSON.stringify({
                action: 'update',
                employee: {
                    ...employee,
                    name: name.trim(),
                    post: post.trim(),
                    email: email.trim(),
                    phone: phone.trim()
                }
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to update employee.');

        employees = result.employees || employees;
        renderEmployees();
        populateEmployeeOptions();
        showToast("Employee information updated.", "success");
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to update employee.", "error");
    }
}

async function deleteEmployee(id) {
    if (!canManageEmployees) {
        showToast("Administrator access is required to delete employees.", "error");
        return;
    }

    if (!confirm("Delete this employee?")) return;

    try {
        const response = await apiRequest(`/api/employees?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to delete employee.');

        employees = result.employees || [];
        renderEmployees();
        showToast("Staff member removed.", "info");
        renderAnalyticsCharts();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to remove employee.", "error");
    }
}

function renderEmployeeDirectoryTab() {
    const list = document.getElementById('employeeDirectoryTabList');
    const count = document.getElementById('employeeTabCount');
    if (!list) return;

    if (count) {
        count.innerText = `${employees.length} Staff`;
    }

    if (!employees.length) {
        list.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-10 text-center text-slate-500">
                    No employee records found.
                </td>
            </tr>
        `;
        return;
    }

    list.innerHTML = employees.map((emp, index) => `
        <tr class="hover:bg-cyan-50/60 transition-colors">
            <td class="px-4 py-3.5 text-slate-500 font-bold">${index + 1}</td>
            <td class="px-4 py-3.5">
                <div class="flex items-center gap-3 min-w-[190px]">
                    <div class="w-10 h-10 rounded-full bg-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-800 font-bold shrink-0">
                        ${(emp.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold text-slate-900">${emp.name || 'Unnamed employee'}</div>
                        <div class="text-[11px] text-slate-500">Employee ID: ${emp.id || '—'}</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3.5 text-cyan-700 font-bold whitespace-nowrap">${emp.post || '—'}</td>
            <td class="px-4 py-3.5 text-slate-700">
                ${emp.email ? `<a href="mailto:${emp.email}" class="hover:text-cyan-700 hover:underline">${emp.email}</a>` : '—'}
            </td>
            <td class="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                ${emp.phone ? `<a href="tel:${emp.phone}" class="hover:text-cyan-700 hover:underline">${emp.phone}</a>` : '—'}
            </td>
            <td class="px-4 py-3.5">
                <div class="flex items-center justify-center gap-2">
                    ${emp.phone ? `<a href="tel:${emp.phone}" class="px-3 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white transition" title="Call ${emp.phone}">📞</a>` : ''}
                    ${canManageEmployees ? `<button onclick="editEmployee(${emp.id})" class="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition" title="Edit Staff">✏️</button>` : ''}
                    ${canManageEmployees ? `<button onclick="deleteEmployee(${emp.id})" class="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" title="Delete Staff">🗑️</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
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

    if (!assigneeInput || !deadlineInput || !descInput) return;

    const assignee = assigneeInput.value.trim();
    const deadline = deadlineInput.value;
    const desc = descInput.value.trim();

    if (!assignee || !deadline || !desc) {
        showToast("Please fill all task fields!", "error");
        return;
    }

    let foundEmp = employees.find(
        emp => emp.name && emp.name.trim().toLowerCase() === assignee.toLowerCase()
    );

    // If the employee API is temporarily unavailable, allow the
    // authenticated employee to assign a task using the identity from
    // the current Google session.
    if (
        !foundEmp &&
        currentUser?.id &&
        currentUser?.name &&
        currentUser.name.trim().toLowerCase() === assignee.toLowerCase()
    ) {
        foundEmp = currentUser;
    }

    if (!foundEmp) {
        showToast(`No matching employee found for "${assignee}".`, "error");
        return;
    }

    try {
        const response = await apiRequest('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({
                assigneeId: foundEmp.id,
                assignee: foundEmp.name,
                deadline,
                desc
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to assign task.');

        tasks = result.tasks || tasks;
        renderTasks();
        renderAccountTab();

        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.reset();

            // Keep the logged-in employee selected for the next assignment.
            const assigneeField = document.getElementById('taskAssignee');
            if (assigneeField && currentUser?.name) {
                assigneeField.value = currentUser.name;
            }
        }

        if (result.whatsappSent === false) {
            showToast("Task assigned, but WhatsApp notification was not sent.", "warning");
        } else {
            showToast("Task assigned and WhatsApp notification sent.", "success");
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to assign task.", "error");
    }
}

function isTaskOverdue(deadlineStr) {
    if (!deadlineStr) return false;

    const dl = new Date(deadlineStr);
    if (isNaN(dl.getTime())) return false;

    const today = new Date();
    dl.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return dl.getTime() < today.getTime();
}

function getTaskStatusBadge(task) {
    if (task.done) {
        return {
            label: "Completed",
            cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        };
    }

    if (isTaskOverdue(task.deadline)) {
        return {
            label: "Missed Deadline",
            cls: "bg-rose-500/10 text-rose-400 border border-rose-500/20"
        };
    }

    return {
        label: task.status || "Pending",
        cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20"
    };
}

function renderTasks() {
    const tbody = document.getElementById('taskTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (typeof tasks === 'undefined' || tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-xs text-slate-500">No active work assignments found.</td></tr>`;
        return;
    }

    const validTasks = tasks.filter(
        task => task && task.desc && task.desc.trim() !== ""
    );

    const uniqueTasks = Array.from(
        new Map(validTasks.map(task => [task.id, task])).values()
    );

    uniqueTasks.forEach(task => {
        const badge = getTaskStatusBadge(task);
        const tr = document.createElement('tr');

        tr.className = "hover:bg-slate-900/40 transition border-b border-slate-800/50";

        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-200 text-xs">${task.assignee}</td>
            <td class="p-3 text-slate-300 text-xs max-w-xs truncate">${task.desc}</td>
            <td class="p-3 text-slate-400 text-xs">${task.deadline}</td>
            <td class="p-3 text-xs">
                ${task.publicToken
                    ? `<a href="task.html?id=${encodeURIComponent(task.id)}&token=${encodeURIComponent(task.publicToken)}" target="_blank" class="text-blue-600 hover:text-blue-800 underline font-bold">Open Task</a>`
                    : '<span class="text-slate-400">N/A</span>'}
            </td>
            <td class="p-3 text-center">
                <input type="checkbox" ${task.m80 ? 'checked' : ''}
                    onchange="toggleMilestone(${task.id}, 'm80')"
                    class="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer">
            </td>
            <td class="p-3 text-center">
                <input type="checkbox" ${task.m50 ? 'checked' : ''}
                    onchange="toggleMilestone(${task.id}, 'm50')"
                    class="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer">
            </td>
            <td class="p-3 text-center">
                <input type="checkbox" ${task.m10 ? 'checked' : ''}
                    onchange="toggleMilestone(${task.id}, 'm10')"
                    class="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer">
            </td>
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

async function markTaskDone(id) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.done) return;

    try {
        const response = await apiRequest(`/api/tasks?id=${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                action: 'complete',
                token: task.publicToken || ''
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to complete task.');

        tasks = result.tasks || tasks.map(t => t.id === id ? { ...t, done: true, status: 'Completed' } : t);
        showToast(`🎉 Task completed by ${task.assignee}!`, "success");
        renderTasks();
        renderAccountTab();
        renderAnalyticsCharts();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to complete task.", "error");
    }
}

function checkOverdueNotifications() {
    let changed = false;

    tasks.forEach(task => {
        if (
            !task.done &&
            isTaskOverdue(task.deadline) &&
            !task.notifiedMissed
        ) {
            task.notifiedMissed = true;

            showToast(
                `😔 ${task.assignee} couldn't complete the task on time (deadline was ${task.deadline})`,
                "error"
            );

            changed = true;
        }
    });

    if (changed) saveData();
}

async function clearAllTasks() {
    if (!confirm("Are you sure you want to clear all tasks?")) return;

    try {
        const response = await apiRequest('/api/tasks?all=true', { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to clear tasks.');

        tasks = [];
        renderTasks();
        renderAccountTab();
        showToast("All tasks cleared.", "info");
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to clear tasks.", "error");
    }
}

// ================= CHAT SYSTEM =================
function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chatMessageInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text || !currentUser) return;

    const time = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    chatMessages.push({
        sender: currentUser.name,
        text,
        time
    });

    saveData();
    renderChat();
    input.value = '';
}

function renderChat() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    chatBox.innerHTML = '';

    chatMessages.forEach(msg => {
        const isMe =
            currentUser &&
            msg.sender === currentUser.name;

        const div = document.createElement('div');
        div.className =
            `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;

        div.innerHTML = `
            <span class="text-[10px] text-slate-400 mb-0.5 px-1">
                ${msg.sender} • ${msg.time}
            </span>
            <div class="max-w-md p-3 rounded-2xl text-xs ${
                isMe
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 rounded-bl-none'
            }">
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
    if (descInput) descInput.value = workTitle;

    const deadlineInput = document.getElementById('taskDeadline');
    if (deadlineInput) deadlineInput.value = calculateDeadlineDate(frequency);

    showToast(`Task loaded: "${workTitle}"`, "info");
}

function calculateDeadlineDate(freqText) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const text = freqText.trim();

    const months = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11
    };

    let targetDate = new Date(today);
    const lowerText = text.toLowerCase();

    if (lowerText.includes('weekly') || lowerText.includes('week')) {
        targetDate.setDate(today.getDate() + 7);
    } else {
        let foundMonth = null;
        let foundDay = 1;

        for (const m in months) {
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
    if (!dateInput) return;

    if (typeof dateInput.showPicker === 'function') {
        dateInput.showPicker();
    } else {
        dateInput.focus();
        dateInput.click();
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

    const myTasks = tasks.filter(
        t =>
            t.assignee &&
            t.assignee.toLowerCase() === currentUser.name.toLowerCase()
    );

    const completedCount =
        myTasks.filter(
            t => t.done || t.status === 'Completed'
        ).length;

    const completedCountEl =
        document.getElementById('accountCompletedCount');

    if (completedCountEl) {
        completedCountEl.textContent = completedCount;
    }

    const tbody =
        document.getElementById('accountTaskTableBody');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (myTasks.length === 0) {
        tbody.innerHTML =
            `<tr><td colspan="4" class="p-6 text-center text-xs text-slate-500">You have no tasks assigned currently.</td></tr>`;
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
                80% [${task.m80 ? '✓' : '•'}] |
                50% [${task.m50 ? '✓' : '•'}] |
                10% [${task.m10 ? '✓' : '•'}]
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
    const hasEmployees =
        Array.isArray(employees) && employees.length > 0;

    const hasTasks = Array.isArray(tasks);

    const pieCtx =
        document.getElementById('overallPieChart');

    if (pieCtx) {
        if (officePieInstance) {
            officePieInstance.destroy();
        }

        let totalCompleted = 0;
        let totalPending = 0;
        let totalInProgress = 0;

        if (hasTasks) {
            totalCompleted = tasks.filter(
                t => t.done || t.status === "Completed"
            ).length;

            totalPending = tasks.filter(
                t =>
                    !t.done &&
                    (t.status === "Pending" || !t.status)
            ).length;

            totalInProgress = tasks.filter(
                t =>
                    !t.done &&
                    t.status === "In Progress"
            ).length;
        }

        const pieData =
            totalCompleted === 0 &&
            totalPending === 0 &&
            totalInProgress === 0
                ? [1, 0, 0]
                : [
                    totalCompleted,
                    totalPending,
                    totalInProgress
                ];

        officePieInstance = new Chart(
            pieCtx,
            {
                type: 'doughnut',
                data: {
                    labels: [
                        'Completed',
                        'Pending',
                        'In Progress'
                    ],
                    datasets: [{
                        data: pieData,
                        backgroundColor: [
                            '#10B981',
                            '#F59E0B',
                            '#3B82F6'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#94A3B8',
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            enabled:
                                hasTasks &&
                                tasks.length > 0
                        }
                    }
                }
            }
        );
    }

    const barCtx =
        document.getElementById('employeeHorizontalBar');

    if (barCtx) {
        if (officeBarInstance) {
            officeBarInstance.destroy();
        }

        let staffNames = [];
        let staffTasksCount = [];

        if (hasEmployees) {
            employees.forEach(emp => {
                staffNames.push(emp.name);

                let count = 0;

                if (hasTasks) {
                    count = tasks.filter(
                        t =>
                            t.assignee &&
                            t.assignee.toLowerCase() ===
                                emp.name.toLowerCase() &&
                            (t.done ||
                                t.status === "Completed")
                    ).length;
                }

                staffTasksCount.push(count);
            });
        }

        if (staffNames.length === 0) {
            staffNames = ["No Staff Available"];
            staffTasksCount = [0];
        }

        officeBarInstance = new Chart(
            barCtx,
            {
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
                            grid: {
                                color:
                                    'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#94A3B8',
                                stepSize: 1
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: '#94A3B8',
                                font: { size: 10 }
                            }
                        }
                    }
                }
            }
        );
    }

    setTimeout(() => {
        if (officePieInstance) {
            officePieInstance.resize();
        }

        if (officeBarInstance) {
            officeBarInstance.resize();
        }
    }, 50);
}

// ================= SERVER-SIDE WHATSAPP REMINDERS =================
// Reminder delivery is handled by /api/reminders through Vercel Cron.
// Keeping credentials and scheduled delivery off the browser prevents token exposure
// and allows reminders to run even when nobody has the dashboard open.

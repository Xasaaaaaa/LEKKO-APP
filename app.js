const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user;
const chatId = tg.initDataUnsafe?.user?.id;
const SERVER = "https://lekko-app-production.up.railway.app";

// =========================
// ПРИВЕТСТВИЕ
// =========================

function getGreeting() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "🌅 Доброе утро";
    if (h >= 12 && h < 17) return "☀️ Добрый день";
    if (h >= 17 && h < 22) return "🌆 Добрый вечер";
    return "🌙 Доброй ночи";
}

if (document.getElementById("user")) {
    document.getElementById("user").innerHTML =
        user ? `${getGreeting()}, <b>${user.first_name}</b>! 👋` : "Пользователь не найден";
}

let photos = [];

// =========================
// ОТПРАВКА НА СЕРВЕР
// =========================

function sendToServer(data) {
    return fetch(`${SERVER}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, chat_id: chatId })
    }).catch(err => console.error("Ошибка отправки:", err));
}

function setupSoftwareIdMask() {
    const input = document.getElementById("software_id");
    if (!input) return;

    input.addEventListener("input", () => {
        let val = input.value;

        val = val.replace(/\D/g, "");

        val = val.slice(0, 9);

        input.value = val;
    });
}

// =========================
// НАВИГАЦИЯ МЕЖДУ СТРАНИЦАМИ
// =========================

function openPage(page) {
    const pages = ["dashboard", "pharmacy", "shift", "profile", "history", "pharmacy_history_page"];
    pages.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    
    const target = document.getElementById(page);
    if (target) target.style.display = "block";
    
    if (page === "pharmacy") {
        clearPharmacyForm();
    }
    
    if (page === "shift") { checkUndoWindow(); renderDailyPlan(); }
    if (page === "profile") renderProfile();
    if (page === "history") renderHistory();
    if (page === "pharmacy_history_page") renderPharmacyHistory();
}

function back() {
    openPage("dashboard");
}

// =========================
// ТОСТ-УВЕДОМЛЕНИЯ
// =========================

function showToast(text) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.innerText = text;
    t.style.display = "block";
    setTimeout(() => { t.style.display = "none"; }, 3000);
}

// =========================
// ЛОГИКА ОКНА АПТЕКИ
// =========================

function toggleSoftwareInput() {
    const s = document.getElementById("software").value;
    const sc = document.getElementById("software_custom");
    const idContainer = document.getElementById("software_id_container");

    if (s === "Другая") {
        if (sc) sc.style.display = "block";
    } else {
        if (sc) {
            sc.style.display = "none";
            sc.value = "";
        }
    }

    if (s === "LEKKO" || s === "ABU") {
        if (idContainer) idContainer.style.display = "block";
    } else {
        if (idContainer) {
            idContainer.style.display = "none";
            const idInput = document.getElementById("software_id");
            if (idInput) idInput.value = ""; 
        }
    }
}

function openFilePicker() {
    document.getElementById("photo").click();
}

function previewPhotos() {
    const files = document.getElementById("photo").files;
    const container = document.getElementById("photoContainer");
    
    for (let f of files) {
        if (photos.length >= 4) {
            showToast("⚠️ Максимум 4 фотографии");
            break;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            photos.push(e.target.result);
            const img = document.createElement("img");
            img.src = e.target.result;
            img.className = "img-preview";
            container.appendChild(img);
        };
        reader.readAsDataURL(f);
    }
}

function clearPhotos() {
    photos = [];
    const container = document.getElementById("photoContainer");
    if (container) container.innerHTML = "";
    const fileInput = document.getElementById("photo");
    if (fileInput) fileInput.value = "";
}

function clearPharmacyForm() {
    if (document.getElementById("name")) document.getElementById("name").value = "";
    if (document.getElementById("lpr_name")) document.getElementById("lpr_name").value = "";
    if (document.getElementById("lpr_phone")) document.getElementById("lpr_phone").value = "+998 ";
    if (document.getElementById("software")) document.getElementById("software").value = "";
    
    if (document.getElementById("software_custom")) {
        document.getElementById("software_custom").value = "";
        document.getElementById("software_custom").style.display = "none";
    }
    if (document.getElementById("software_id_container")) {
        document.getElementById("software_id_container").style.display = "none";
        const idInput = document.getElementById("software_id");
        if (idInput) idInput.value = "";
    }
    if (document.getElementById("pharmacy_status")) document.getElementById("pharmacy_status").value = "";
    if (document.getElementById("contact_comment")) document.getElementById("contact_comment").value = "";
    clearPhotos();
}

// =========================
// ВАЛИДАЦИЯ И СОХРАНЕНИЕ
// =========================

function savePharmacy() {
    const name = document.getElementById("name").value.trim();
    const lprName = document.getElementById("lpr_name").value.trim();
    const lprPhone = document.getElementById("lpr_phone").value.trim();
    let software = document.getElementById("software").value;
    const softwareCustom = document.getElementById("software_custom").value.trim();
    const softwareId = document.getElementById("software_id")?.value.trim() || null;
    const status = document.getElementById("pharmacy_status").value;
    const comment = document.getElementById("contact_comment").value.trim();

    if (!name) { showToast("⚠️ Укажите название аптеки"); return; }
    if (lprPhone.length < 19) {
        showToast("⚠️ Заполните телефон: +998 (99) 999-99-99");
        return;
    }
    if (!status) { showToast("⚠️ Выберите статус контакта"); return; }
    if (software === "Другая") software = softwareCustom || "Другая";

    if (!navigator.geolocation) {
        alert("❌ Геолокация не поддерживается вашим устройством.");
        return;
    }

    showToast("🛰 Получение геолокации...");

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;

            const data = {
                event: "pharmacy_add",
                user: user,
                name: name,
                lprName: lprName,
                lprPhone: lprPhone,
                software: software,
                softwareId: softwareId,
                status: status,
                comment: comment,
                photosCount: photos.length,
                latitude: lat,
                longitude: lon,
                map: mapLink,
                date: new Date().toLocaleString("ru-RU")
            };

            sendToServer(data);
            addPharmacyStat();

            try {
                let localHistory = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]");
                localHistory.unshift(data);
                localStorage.setItem("pharmacyHistoryList", JSON.stringify(localHistory));
            } catch(e) { console.error("Ошибка локальной истории:", e); }

            const fact = Number(localStorage.getItem("dayFact") || 0);
            localStorage.setItem("dayFact", fact + 1);

            showPharmacyCard(data);
        },
        function() {
            alert("❌ Не удалось получить локацию аптеки. Запись отменена.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function showPharmacyCard(data) {
    const statusLabels = { cold: "Холодный контакт", inwork: "В работе", deal: "Договорились", decline: "Отказ" };
    
    const overlay = document.createElement("div");
    overlay.id = "pharmacyModal";
    overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(8,15,26,0.95);z-index:10000;padding:24px;display:flex;flex-direction:column;justify-content:center;overflow-y:auto;";
    
    overlay.innerHTML = `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:24px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
            <div style="text-align:center;font-size:40px;margin-bottom:16px;">✨</div>
            <h3 style="font-family:'Syne',sans-serif;font-size:22px;text-align:center;margin-bottom:20px;color:var(--white);">Аптека сохранена!</h3>
            
            <div style="font-size:14px;color:var(--muted);line-height:1.6;margin-bottom:24px;background:var(--bg2);padding:16px;border-radius:16px;border:1px solid rgba(255,255,255,0.02);">
                <p style="margin-bottom:6px;">🏪 Название: <b style="color:var(--white);">${data.name}</b></p>
                <p style="margin-bottom:6px;">👤 ЛПР: <b style="color:var(--white);">${data.lprName || "—"}</b></p>
                <p style="margin-bottom:6px;">📞 Телефон: <b style="color:var(--white);">${data.lprPhone}</b></p>
                <p style="margin-bottom:6px;">💻 ПО: <b style="color:var(--white);">${data.software}</b></p>
                <p>📊 Статус: <b style="color:var(--teal);">${statusLabels[data.status] || data.status}</b></p>
                <p>📍 Локация: 
                    <a href="${data.map}" target="_blank" style="color:var(--accent); text-decoration:none;">
                        Открыть в Google Maps
                    </a>
                </p>
            </div>
            
            <button onclick="document.getElementById('pharmacyModal').remove(); openPage('pharmacy_history_page');" style="margin-bottom:10px; background:linear-gradient(135deg, var(--teal), var(--teal2)); color:#080f1a;">🏢 История аптек</button>
            <button onclick="document.getElementById('pharmacyModal').remove(); back();" style="margin-bottom:10px; background:var(--card2); border:1px solid var(--border); color:var(--white);">🏠 Главное меню</button>
            <button onclick="document.getElementById('pharmacyModal').remove(); clearPharmacyForm();" style="background:#152238; border:1px solid var(--green); color:var(--green);">➕ Добавить еще аптеку</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// =========================
// ОТРИСОВКА ИСТОРИИ АПТЕК
// =========================

function renderPharmacyHistory() {
    const list = document.getElementById("pharmacyHistoryList");
    if (!list) return;
    
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]");
    } catch(e) { history = []; }
    
    if (history.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px 0;font-size:14px;">📭 История аптек пуста</div>`;
        return;
    }
    
    const statusLabels = {
        cold:    "❄️ Холодный контакт",
        inwork:  "🔄 В работе",
        deal:    "✅ Договорились",
        decline: "❌ Отказ"
    };

    list.innerHTML = history.map(item => `
        <div class="history-item" style="line-height:1.6; background:var(--card); border:1px solid var(--border); border-radius:16px; padding:14px; margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px;">
                <span>📅 ${item.date || '—'}</span>
                <span style="color:var(--teal);font-weight:500;">${statusLabels[item.status] || item.status}</span>
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:6px;">🏥 ${item.name}</div>
            <div style="font-size:13px;color:var(--muted);">👤 ЛПР: <b style="color:var(--white);">${item.lprName || '—'}</b></div>
            <div style="font-size:13px;color:var(--muted);">📞 Тел: <b style="color:var(--white);">${item.lprPhone}</b></div>
            <div style="font-size:13px;color:var(--muted);">💻 ПО: <b style="color:var(--white);">${item.software}${item.softwareId ? ' (ID: '+item.softwareId+')' : ''}</b></div>
            ${item.comment ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);font-size:13px;color:var(--muted);font-style:italic;">💬 ${item.comment}</div>` : ""}
            ${item.map ? `
                <a href="${item.map}" target="_blank" style="display:inline-block;margin-top:8px;font-size:13px;color:var(--accent);text-decoration:none;">
                    📍 Открыть локацию в Google Maps
                </a>
            ` : ""}
        </div>
    `).join("");
}

// =========================
// МАСКА ДЛЯ ТЕЛЕФОНА ЛПР
// =========================

function setupPhoneMask() {
    const input = document.getElementById("lpr_phone");
    if (!input) return;

    input.addEventListener("focus", () => {
        if (!input.value.startsWith("+998")) {
            input.value = "+998 ";
        }
    });

    input.addEventListener("input", () => {
        let matrix = "+998 (__) ___-__-__",
            i = 0,
            def = matrix.replace(/\D/g, ""),
            val = input.value.replace(/\D/g, "");

        if (def.length >= val.length) val = def;

        input.value = matrix.replace(/./g, function(a) {
            return /[_\d]/.test(a) && i < val.length ? val.charAt(i++) : i >= val.length ? "" : a;
        });
    });
    
    input.addEventListener("keydown", (e) => {
        if (input.selectionStart < 5 && (e.key === "Backspace" || e.key === "Delete")) {
            e.preventDefault();
        }
    });
}

// =========================
// СТАТИСТИКА И ПРОФИЛЬ
// =========================

function addPharmacyStat() {
    const p = Number(localStorage.getItem("dayPlan") || 10);
    let f = Number(localStorage.getItem("dayFact") || 0);
    f += 1;
    localStorage.setItem("dayFact", f);
}

function renderProfile() {
    if (user) {
        if(document.getElementById("prof_name")) document.getElementById("prof_name").innerText = user.first_name || "Сотрудник";
        if(document.getElementById("prof_tg")) document.getElementById("prof_tg").innerText = user.username ? `@${user.username}` : `@id${chatId}`;
        
        // Первая буква имени в аватарку
        const avatarEl = document.getElementById("prof_avatar");
        if(avatarEl && user.first_name) {
            avatarEl.innerText = user.first_name.charAt(0).toUpperCase();
        }
    }
    
    // Вывод количества отработанных смен из истории смен
    try {
        let shiftHistory = JSON.parse(localStorage.getItem("shift_history") || "[]");
        if(document.getElementById("stat_fact")) document.getElementById("stat_fact").innerText = shiftHistory.length;
    } catch(e) {
        if(document.getElementById("stat_fact")) document.getElementById("stat_fact").innerText = "0";
    }
}

// =========================
// ЛОГИКА РАБОЧИХ СМЕН
// =========================

let shiftInterval = null;

function startShift() {
    if (localStorage.getItem("shift_start")) { showToast("⚠️ Смена уже идет"); return; }
    localStorage.setItem("shift_start", new Date().getTime());
    localStorage.setItem("dayPlan", 10);
    localStorage.setItem("dayFact", 0);
    showToast("🟢 Смена успешно начата");
    checkUndoWindow();
    renderDailyPlan();
}

function saveDailyPlan() {
    const planInput = document.getElementById("dayPlanInput");
    if (!planInput) return;
    
    const val = planInput.value.trim();
    if (!val) {
        showToast("⚠️ Введите количество аптек");
        return;
    }
    
    localStorage.setItem("dayPlan", val);
    showToast("✅ План на день обновлен");
    renderDailyPlan();
    planInput.value = ""; // очищаем поле ввода
}

function endShift() {
    const start = localStorage.getItem("shift_start");
    if (!start) { showToast("⚠️ Смена не начата"); return; }
    
    const end = new Date().getTime();
    const durationMs = end - Number(start);
    const durationMin = Math.round(durationMs / 60000);
    
    const historyItem = {
        date: new Date(Number(start)).toLocaleDateString("ru-RU"),
        start: new Date(Number(start)).toLocaleTimeString("ru-RU", {hour:'2-digit', minute:'2-digit'}),
        end: new Date(end).toLocaleTimeString("ru-RU", {hour:'2-digit', minute:'2-digit'}),
        duration: durationMin,
        fact: localStorage.getItem("dayFact") || 0
    };
    
    let history = JSON.parse(localStorage.getItem("shift_history") || "[]");
    history.unshift(historyItem);
    localStorage.setItem("shift_history", JSON.stringify(history));
    
    sendToServer({
        event: "shift_end",
        user: user,
        duration: durationMin,
        fact: historyItem.fact
    });
    
    localStorage.removeItem("shift_start");
    if (shiftInterval) clearInterval(shiftInterval);
    
    showToast("🔴 Смена завершена");
    checkUndoWindow();
    renderDailyPlan();
}

function checkUndoWindow() {
    const start = localStorage.getItem("shift_start");
    const timerDiv = document.getElementById("shiftTimer");
    const statusDiv = document.getElementById("shiftStatus");
    
    if (shiftInterval) clearInterval(shiftInterval);
    
    if (!start) {
        if(timerDiv) timerDiv.innerHTML = "<p style='color:var(--danger);font-weight:600;'>Смена закрыта</p>";
        if(statusDiv) statusDiv.innerHTML = "";
        return;
    }
    
    function updateTimer() {
        const now = new Date().getTime();
        const diff = now - Number(start);
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if(timerDiv) timerDiv.innerHTML = `<p>Время на смене: <b style="color:var(--green);font-size:18px;">${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</b></p>`;
    }
    
    updateTimer();
    shiftInterval = setInterval(updateTimer, 1000);
    if(statusDiv) statusDiv.innerHTML = "<p style='color:var(--green); font-weight:600;'>🟢 Вы сейчас на смене</p>";
}

function renderDailyPlan() {
    const planDiv = document.getElementById("dailyPlan");
    if (!planDiv) return;
    const start = localStorage.getItem("shift_start");
    if (!start) { planDiv.innerHTML = ""; return; }
    
    const p = localStorage.getItem("dayPlan") || 10;
    const f = localStorage.getItem("dayFact") || 0;
    planDiv.innerHTML = `
        <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border)">
            <p>Выполнение плана на день: <b>${f} из ${p} аптек</b></p>
        </div>
    `;
}

function validatePharmacyForm() {
    const name = document.getElementById("name")?.value.trim();
    const lprPhone = document.getElementById("lpr_phone")?.value.trim();
    const status = document.getElementById("pharmacy_status")?.value;
    const software = document.getElementById("software")?.value;
    const softwareId = document.getElementById("software_id")?.value.trim();

    const saveBtn = document.getElementById("saveBtn");
    if (!saveBtn) return;

    let valid = true;

    // проверка обязательных полей
    if (!name) valid = false;
    if (!status) valid = false;
    if (!lprPhone || lprPhone.length < 19) valid = false;

    // если LEKKO или ABU — нужен ID
    if (software === "LEKKO" || software === "ABU") {
        if (!softwareId || softwareId.length !== 9) valid = false;
    }

    saveBtn.disabled = !valid;
}

function renderHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    
    let history = JSON.parse(localStorage.getItem("shift_history") || "[]");
    if (history.length === 0) {
        list.innerHTML = "<p style='text-align:center;color:var(--muted);padding:20px;'>История смен пуста</p>";
        return;
    }
    
    list.innerHTML = history.map(item => `
        <div class="history-item" style="background:var(--card); border:1px solid var(--border); border-radius:16px; padding:14px; margin-bottom:10px;">
            <p>📅 Дата: <b>${item.date}</b></p>
            <p>⏱ Время: <b>${item.start} - ${item.end}</b> (${item.duration} мин)</p>
            <p>🏪 Посещено аптек: <b style="color:var(--teal);">${item.fact}</b></p>
        </div>
    `).join("");
}

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    setupPhoneMask();
    setupSoftwareIdMask();
    checkUndoWindow();

    // 🔥 авто-валидация формы
    const fields = [
        "name",
        "lpr_phone",
        "pharmacy_status",
        "software",
        "software_id"
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", validatePharmacyForm);
            el.addEventListener("change", validatePharmacyForm);
        }
    });

    validatePharmacyForm(); // стартовая проверка
});
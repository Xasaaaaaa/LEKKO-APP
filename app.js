
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

function renderDashboard() {
    const fact = Number(localStorage.getItem("dayFact") || 0);
    const plan = Number(localStorage.getItem("dayPlan") || 0);
 
    const factEl = document.getElementById("dash_fact");
    const pctEl = document.getElementById("dash_pct");
    const barEl = document.getElementById("dash_bar");
    const labelEl = document.getElementById("dash_label");
    const remainEl = document.getElementById("dash_remain");
    const timeEl = document.getElementById("dash_time");
 
    if (factEl) factEl.textContent = fact;
 
    if (plan > 0) {
        const pct = Math.round((fact / plan) * 100);
        if (pctEl) pctEl.textContent = pct + "%";
        if (barEl) barEl.style.width = Math.min(pct, 100) + "%";
        if (labelEl) labelEl.textContent = fact + " из " + plan + " аптек по плану";
        const rem = plan - fact;
        if (remainEl) remainEl.textContent = rem > 0 ? "+" + rem + " осталось" : "✓ план выполнен";
    } else {
        if (pctEl) pctEl.textContent = "—";
        if (barEl) barEl.style.width = "0%";
        if (labelEl) labelEl.textContent = "План не задан";
        if (remainEl) remainEl.textContent = "";
    }
 
    const shiftStart = localStorage.getItem("shift_start");
    if (shiftStart && timeEl) {
        const elapsed = Date.now() - Number(shiftStart);
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        timeEl.textContent = h > 0 ? h + "ч " + m + "м" : m + "м";
    } else if (timeEl) {
        timeEl.textContent = "—";
    }
}
 
if (document.getElementById("user")) {
    document.getElementById("user").innerHTML =
        user ? `${getGreeting()}, <b>${user.first_name}</b>! 👋` : "Пользователь не найден";
}

renderDashboard();

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
    const pages = ["dashboard", "pharmacy", "shift", "profile", "history", "pharmacy_history_page", "map_page"];
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
    if (page === "map_page") {
        initMap();
        populateShiftDropdown();
        showMapForToday();
    }
}

function back() {
    openPage("dashboard");
    renderDashboard();
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
            const mapLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

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
                timestamp: Date.now(),
                date: new Date().toLocaleDateString("ru-RU"),
                time: new Date().toLocaleTimeString("ru-RU", {hour: '2-digit', minute: '2-digit'})
            };

            sendToServer(data);
            addPharmacyStat();

            try {
                let localHistory = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]");
                localHistory.unshift(data);
                localStorage.setItem("pharmacyHistoryList", JSON.stringify(localHistory));
            } catch(e) { console.error("Ошибка локальной истории:", e); }

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
                <p style="margin-top:6px;">📍 Локация: 
                    <a href="${data.map}" target="_blank" style="color:var(--accent); text-decoration:none; font-weight:bold;">
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
                <span>📅 ${item.date || '—'} ${item.time || ''}</span>
                <span style="color:var(--teal);font-weight:500;">${statusLabels[item.status] || item.status}</span>
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:6px;">🏥 ${item.name}</div>
            <div style="font-size:13px;color:var(--muted);">👤 ЛПР: <b style="color:var(--white);">${item.lprName || '—'}</b></div>
            <div style="font-size:13px;color:var(--muted);">📞 Тел: <b style="color:var(--white);">${item.lprPhone}</b></div>
            <div style="font-size:13px;color:var(--muted);">💻 ПО: <b style="color:var(--white);">${item.software}${item.softwareId ? ' (ID: '+item.softwareId+')' : ''}</b></div>
            ${item.comment ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);font-size:13px;color:var(--muted);font-style:italic;">💬 ${item.comment}</div>` : ""}
            ${item.latitude ? `
                <a href="https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}" target="_blank" style="display:inline-block;margin-top:8px;font-size:13px;color:var(--accent);text-decoration:none;font-weight:500;">
                    📍 Открыть локацию в Google Maps
                </a>
            ` : ""}
        </div>
    `).join("");
}

// =========================
// ЛОГИКА ПОСТРОЕНИЯ МАРШРУТОВ НА КАРТЕ
// =========================

function openMapForToday() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]"); } catch(e) { return; }
    
    const today = new Date().toLocaleDateString("ru-RU");
    const todayPharms = history.filter(p => p.date === today && p.latitude && p.longitude);

    if (todayPharms.length === 0) {
        showToast("📭 Сегодня аптек с геолокацией нет");
        return;
    }

    todayPharms.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    openGoogleMapsWithPoints(todayPharms);
}

function openMapForPeriod(days) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]"); } catch(e) { return; }
    
    const from = Date.now() - days * 86400000;
    const filtered = history.filter(p => p.timestamp && p.timestamp >= from && p.latitude && p.longitude);

    if (filtered.length === 0) {
        showToast(`📭 За ${days} дней аптек с геолокацией нет`);
        return;
    }

    filtered.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    openGoogleMapsWithPoints(filtered);
}

function openGoogleMapsWithPoints(pharmacies) {
    if (pharmacies.length === 1) {
        const p = pharmacies[0];
        window.open(`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`, "_blank");
        return;
    }

    const origin = `${pharmacies[0].latitude},${pharmacies[0].longitude}`;
    const destination = `${pharmacies[pharmacies.length - 1].latitude},${pharmacies[pharmacies.length - 1].longitude}`;

    const waypoints = pharmacies.slice(1, -1)
        .map(p => `${p.latitude},${p.longitude}`)
        .join("|");

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;
    if (waypoints) {
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }

    window.open(url, "_blank");
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
    let f = Number(localStorage.getItem("dayFact") || 0);
    f += 1;
    localStorage.setItem("dayFact", f);
}

function renderProfile() {
    if (user) {
        if(document.getElementById("prof_name")) document.getElementById("prof_name").innerText = user.first_name || "Сотрудник";
        if(document.getElementById("prof_tg")) document.getElementById("prof_tg").innerText = user.username ? `@${user.username}` : `@id${chatId}`;
        
        const avatarEl = document.getElementById("prof_avatar");
        if(avatarEl && user.first_name) {
            avatarEl.innerText = user.first_name.charAt(0).toUpperCase();
        }
    }
    
    try {
        let shiftHistory = JSON.parse(localStorage.getItem("shift_history") || "[]");
        if(document.getElementById("stat_shifts_count")) document.getElementById("stat_shifts_count").innerText = shiftHistory.length;
    } catch(e) {
        if(document.getElementById("stat_shifts_count")) document.getElementById("stat_shifts_count").innerText = "0";
    }

    try {
        let pharmHistory = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]");
        if(document.getElementById("stat_pharmacies_count")) document.getElementById("stat_pharmacies_count").innerText = pharmHistory.length;
    } catch(e) {
        if(document.getElementById("stat_pharmacies_count")) document.getElementById("stat_pharmacies_count").innerText = "0";
    }
}

// =========================
// ЛОГИКА РАБОЧИХ СМЕН
// =========================

let shiftInterval = null;
let shiftStartLocation = null;
let shiftEndLocation = null;

function startShift() {
    if (localStorage.getItem("shift_start")) { 
        showToast("⚠️ Смена уже идет"); 
        return; 
    }

    localStorage.setItem("shift_start", new Date().getTime());
    localStorage.setItem("dayPlan", 10);
    localStorage.setItem("dayFact", 0);

    showToast("🟢 Получаем локацию...");

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                shiftStartLocation = { lat, lon };

                showToast("🟢 Смена успешно начата");
                checkUndoWindow();
                renderDailyPlan();
            },
            function() {
                showToast("⚠️ Не удалось получить локацию старта");
                checkUndoWindow();
                renderDailyPlan();
            }
        );
    } else {
        showToast("⚠️ Геолокация не поддерживается");
    }
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
    planInput.value = "";
}

function endShift() {
    const start = localStorage.getItem("shift_start");
    if (!start) { showToast("⚠️ Смена не начата"); return; }

    const end = new Date().getTime();
    const durationMs = end - Number(start);
    const durationMin = Math.round(durationMs / 60000);

    showToast("🔴 Получаем финальную локацию...");

    function finish(endLoc = null) {
        const historyItem = {
            date: new Date(Number(start)).toLocaleDateString("ru-RU"),
            start: new Date(Number(start)).toLocaleTimeString("ru-RU", {hour:'2-digit', minute:'2-digit'}),
            end: new Date(end).toLocaleTimeString("ru-RU", {hour:'2-digit', minute:'2-digit'}),
            duration: durationMin,
            fact: localStorage.getItem("dayFact") || 0,
            startLat: shiftStartLocation?.lat || null,
            startLon: shiftStartLocation?.lon || null,
            endLat: endLoc?.lat || null,
            endLon: endLoc?.lon || null,
            startMap: shiftStartLocation ? `https://www.google.com/maps/search/?api=1&query=${shiftStartLocation.lat},${shiftStartLocation.lon}` : null,
            endMap: endLoc ? `https://www.google.com/maps/search/?api=1&query=${endLoc.lat},${endLoc.lon}` : null,
            startTimestamp: Number(start),
            endTimestamp: end
        };

        let history = JSON.parse(localStorage.getItem("shift_history") || "[]");
        history.unshift(historyItem);
        localStorage.setItem("shift_history", JSON.stringify(history));

        sendToServer({
            event: "shift_end",
            user: user,
            duration: durationMin,
            fact: historyItem.fact,
            startLocation: shiftStartLocation,
            endLocation: endLoc
        });

        localStorage.removeItem("shift_start");
        if (shiftInterval) clearInterval(shiftInterval);

        showToast("🔴 Смена завершена");
        checkUndoWindow();
        renderDailyPlan();
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                shiftEndLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                finish(shiftEndLocation);
            },
            function() { finish(null); }
        );
    } else {
        finish(null);
    }
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
    if (!name) valid = false;
    if (!status) valid = false;
    if (!lprPhone || lprPhone.length < 19) valid = false;

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
            ${item.startMap ? `<p style="margin-top:6px;">📍 Старт: <a href="${item.startMap}" target="_blank" style="color:var(--accent); text-decoration:none;">открыть карту</a></p>` : ""}
            ${item.endMap ? `<p>📍 Финиш: <a href="${item.endMap}" target="_blank" style="color:var(--accent); text-decoration:none;">открыть карту</a></p>` : ""}
        </div>
    `).join("");
}

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    setupPhoneMask();
    setupSoftwareIdMask();
    checkUndoWindow();

    const fields = ["name", "lpr_phone", "pharmacy_status", "software", "software_id"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", validatePharmacyForm);
            el.addEventListener("change", validatePharmacyForm);
        }
    });

    validatePharmacyForm();
});

// =========================
// ИНТЕГРИРОВАННАЯ КАРТА LEAFLET
// =========================

let mapInstance = null;
let mapMarkersGroup = null;
let mapPolyline = null;

function initMap() {
    if (mapInstance) {
        setTimeout(() => {
            mapInstance.invalidateSize();
        }, 100);
        return;
    }

    // Default center Tashkent
    mapInstance = L.map('map-canvas').setView([41.311081, 69.240562], 12);
    mapMarkersGroup = L.featureGroup().addTo(mapInstance);

    // Dark tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(mapInstance);
}

function showMapForToday() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]"); } catch(e) { return; }
    
    const today = new Date().toLocaleDateString("ru-RU");
    const todayPharms = history.filter(p => p.date === today && p.latitude && p.longitude);

    updateMapControlActiveButton(0);
    document.getElementById("mapShiftSelect").value = "";
    document.getElementById("mapDateFrom").value = "";
    document.getElementById("mapDateTo").value = "";

    if (todayPharms.length === 0) {
        clearMapData();
        showMapSummary("📭 Сегодня аптек с геолокацией нет");
        return;
    }

    todayPharms.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    renderMapData(todayPharms, "Сегодняшний маршрут", true);
}

function showMapForWeek() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]"); } catch(e) { return; }
    
    const from = Date.now() - 7 * 86400000;
    const filtered = history.filter(p => p.timestamp && p.timestamp >= from && p.latitude && p.longitude);

    updateMapControlActiveButton(1);
    document.getElementById("mapShiftSelect").value = "";
    document.getElementById("mapDateFrom").value = "";
    document.getElementById("mapDateTo").value = "";

    if (filtered.length === 0) {
        clearMapData();
        showMapSummary("📭 За последние 7 дней аптек с геолокацией нет");
        return;
    }

    filtered.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    renderMapData(filtered, "Аптеки за последние 7 дней", false);
}

function showMapForAll() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]"); } catch(e) { return; }
    
    const filtered = history.filter(p => p.latitude && p.longitude);

    updateMapControlActiveButton(2);
    document.getElementById("mapShiftSelect").value = "";
    document.getElementById("mapDateFrom").value = "";
    document.getElementById("mapDateTo").value = "";

    if (filtered.length === 0) {
        clearMapData();
        showMapSummary("📭 История аптек с геолокацией пуста");
        return;
    }

    filtered.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    renderMapData(filtered, "Все посещенные аптеки", false);
}

function populateShiftDropdown() {
    const select = document.getElementById("mapShiftSelect");
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>🔍 Выбрать смену из истории...</option>';

    let shiftHistory = [];
    try {
        shiftHistory = JSON.parse(localStorage.getItem("shift_history") || "[]");
    } catch(e) { return; }

    shiftHistory.forEach((shift, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = `📅 ${shift.date} (${shift.start} - ${shift.end}) — ${shift.fact} апт.`;
        select.appendChild(option);
    });
}

function showMapForSelectedShift() {
    const select = document.getElementById("mapShiftSelect");
    if (!select) return;

    const shiftIndex = select.value;
    if (shiftIndex === "") return;

    updateMapControlActiveButton(-1);
    document.getElementById("mapDateFrom").value = "";
    document.getElementById("mapDateTo").value = "";

    let shiftHistory = [];
    try {
        shiftHistory = JSON.parse(localStorage.getItem("shift_history") || "[]");
    } catch(e) { return; }

    const shift = shiftHistory[shiftIndex];
    if (!shift) return;

    let history = [];
    try { history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]"); } catch(e) { return; }

    let shiftPharms = [];
    
    if (shift.startTimestamp && shift.endTimestamp) {
        shiftPharms = history.filter(p => p.timestamp && p.timestamp >= shift.startTimestamp && p.timestamp <= shift.endTimestamp && p.latitude && p.longitude);
    } else {
        shiftPharms = history.filter(p => p.date === shift.date && p.latitude && p.longitude);
        shiftPharms.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }

    shiftPharms.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    clearMapData();

    if (shift.startLat && shift.startLon) {
        const startMarker = L.circleMarker([shift.startLat, shift.startLon], {
            radius: 9,
            fillColor: '#2f80ed',
            color: '#2f80ed',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(mapMarkersGroup);
        startMarker.bindPopup(`<b>🟢 Старт смены</b><br>${shift.date} в ${shift.start}`);
    }

    if (shift.endLat && shift.endLon) {
        const endMarker = L.circleMarker([shift.endLat, shift.endLon], {
            radius: 9,
            fillColor: '#ff4f6d',
            color: '#ff4f6d',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(mapMarkersGroup);
        endMarker.bindPopup(`<b>🔴 Финиш смены</b><br>${shift.date} в ${shift.end}`);
    }

    shiftPharms.forEach((p, idx) => {
        addPharmacyMarker(p, idx + 1);
    });

    const routePoints = [];
    if (shift.startLat && shift.startLon) {
        routePoints.push([shift.startLat, shift.startLon]);
    }
    shiftPharms.forEach(p => {
        routePoints.push([p.latitude, p.longitude]);
    });
    if (shift.endLat && shift.endLon) {
        routePoints.push([shift.endLat, shift.endLon]);
    }

    if (routePoints.length > 1) {
        mapPolyline = L.polyline(routePoints, {
            color: '#2edd8e',
            weight: 3,
            dashArray: '5, 8',
            opacity: 0.7
        }).addTo(mapInstance);
    }

    if (mapMarkersGroup.getLayers().length > 0) {
        mapInstance.fitBounds(mapMarkersGroup.getBounds(), { padding: [40, 40] });
    }

    let summaryText = `<b>Смена ${shift.date} (${shift.start} - ${shift.end})</b><br>`;
    summaryText += `⏱ Продолжительность: ${shift.duration} мин<br>`;
    summaryText += `🏪 Аптек на карте: ${shiftPharms.length} из ${shift.fact} посещенных`;
    showMapSummary(summaryText);
}

function clearMapData() {
    if (mapMarkersGroup) mapMarkersGroup.clearLayers();
    if (mapPolyline) {
        mapInstance.removeLayer(mapPolyline);
        mapPolyline = null;
    }
}

function addPharmacyMarker(p, number) {
    const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: 8,
        fillColor: '#2edd8e',
        color: '#111e30',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.9
    }).addTo(mapMarkersGroup);

    const statusLabels = { cold: "Холодный контакт", inwork: "В работе", deal: "Договорились", decline: "Отказ" };
    const statusEmojis = { cold: "❄️", inwork: "🔄", deal: "✅", decline: "❌" };

    const popupContent = `
        <div style="font-family:'DM Sans',sans-serif; font-size:13px; color:var(--white);">
            <div style="font-weight:700; font-size:15px; margin-bottom:6px; color:var(--accent);">🏪 ${number ? number + '. ' : ''}${p.name}</div>
            <div style="margin-bottom:4px;">📅 ${p.date} в ${p.time}</div>
            <div style="margin-bottom:4px;">👤 ЛПР: <b>${p.lprName || '—'}</b></div>
            <div style="margin-bottom:4px;">📞 Тел: <b>${p.lprPhone}</b></div>
            <div style="margin-bottom:4px;">💻 ПО: <b>${p.software}${p.softwareId ? ' (ID: ' + p.softwareId + ')' : ''}</b></div>
            <div style="margin-top:6px; font-weight:600; color:var(--green);">${statusEmojis[p.status] || ''} ${statusLabels[p.status] || p.status}</div>
            ${p.comment ? `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-style:italic; color:var(--muted);">💬 ${p.comment}</div>` : ''}
        </div>
    `;
    marker.bindPopup(popupContent);
}

function renderMapData(pharmacies, title, drawRoute) {
    clearMapData();

    pharmacies.forEach((p, idx) => {
        addPharmacyMarker(p, idx + 1);
    });

    if (drawRoute && pharmacies.length > 1) {
        const routePoints = pharmacies.map(p => [p.latitude, p.longitude]);
        mapPolyline = L.polyline(routePoints, {
            color: '#2edd8e',
            weight: 3,
            dashArray: '5, 8',
            opacity: 0.7
        }).addTo(mapInstance);
    }

    if (mapMarkersGroup.getLayers().length > 0) {
        mapInstance.fitBounds(mapMarkersGroup.getBounds(), { padding: [40, 40] });
    }

    showMapSummary(`<b>${title}</b><br>📍 Всего аптек на карте: ${pharmacies.length}`);
}

function showMapSummary(text) {
    const card = document.getElementById("mapSummaryCard");
    const container = document.getElementById("mapSummaryText");
    if (!card || !container) return;

    container.innerHTML = text;
    card.style.display = "block";
}

function updateMapControlActiveButton(activeIndex) {
    const buttons = document.querySelectorAll("#map_page .map-control-box button");
    buttons.forEach((btn, idx) => {
        if (idx === activeIndex) {
            btn.style.background = "linear-gradient(135deg, var(--teal), var(--teal2))";
            btn.style.color = "#080f1a";
            btn.style.borderColor = "transparent";
        } else {
            btn.style.background = "var(--card2)";
            btn.style.color = "var(--white)";
            btn.style.borderColor = "var(--border)";
        }
    });
}

function showMapForCustomDateRange() {
    const fromInput = document.getElementById("mapDateFrom");
    const toInput = document.getElementById("mapDateTo");
    if (!fromInput || !toInput) return;

    const fromVal = fromInput.value;
    const toVal = toInput.value;

    if (!fromVal || !toVal) {
        showToast("⚠️ Укажите обе даты");
        return;
    }

    updateMapControlActiveButton(-1);
    document.getElementById("mapShiftSelect").value = "";

    let history = [];
    try { history = JSON.parse(localStorage.getItem("pharmacyHistoryList") || "[]"); } catch(e) { return; }

    const startTimestamp = new Date(fromVal + "T00:00:00").getTime();
    const endTimestamp = new Date(toVal + "T23:59:59").getTime();

    if (startTimestamp > endTimestamp) {
        showToast("⚠️ Начальная дата не может быть больше конечной");
        return;
    }

    const filtered = history.filter(p => p.timestamp && p.timestamp >= startTimestamp && p.timestamp <= endTimestamp && p.latitude && p.longitude);

    if (filtered.length === 0) {
        clearMapData();
        showMapSummary(`📭 За период с ${formatDateString(fromVal)} по ${formatDateString(toVal)} аптек с геолокацией нет`);
        return;
    }

    filtered.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    const title = `Аптеки с ${formatDateString(fromVal)} по ${formatDateString(toVal)}`;
    renderMapData(filtered, title, false);
}

function formatDateString(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
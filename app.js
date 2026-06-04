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


// =========================
// ТОСТ УВЕДОМЛЕНИЕ
// =========================

function showToast(message) {
    const old = document.getElementById("toast");
    if (old) old.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: linear-gradient(135deg, #20d2b4, #2edd8e);
        color: #080f1a;
        padding: 14px 24px;
        border-radius: 16px;
        font-family: 'Syne', sans-serif;
        font-weight: 600;
        font-size: 15px;
        z-index: 9999;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: 0 8px 30px rgba(32,210,180,0.4);
        white-space: nowrap;
        max-width: 90vw;
        text-align: center;
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// =========================
// КАРТОЧКА СОХРАНЁННОЙ АПТЕКИ
// =========================

function showPharmacyCard(data) {
    const old = document.getElementById("pharmacyModal");
    if (old) old.remove();

    const statusLabels = {
        cold:    "❄️ Холодный контакт",
        inwork:  "🔄 В работе",
        deal:    "✅ Договорились",
        decline: "❌ Отказ"
    };

    const overlay = document.createElement("div");
    overlay.id = "pharmacyModal";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(8,15,26,0.85);
        backdrop-filter: blur(6px);
        z-index: 9998;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.25s ease;
    `;

    overlay.innerHTML = `
        <div style="
            background: #111e30;
            border: 1px solid rgba(32,210,180,0.25);
            border-radius: 24px;
            padding: 28px 24px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(32,210,180,0.08);
            animation: slideUp 0.3s ease;
        ">
            <div style="
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
            ">
                <div style="
                    width: 44px; height: 44px;
                    background: linear-gradient(135deg, #20d2b4, #2edd8e);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 22px;
                    flex-shrink: 0;
                ">🏥</div>
                <div>
                    <div style="
                        font-family: 'Syne', sans-serif;
                        font-weight: 700;
                        font-size: 17px;
                        color: #eef6f8;
                    ">${data.name}</div>
                    <div style="
                        font-size: 12px;
                        color: #20d2b4;
                        margin-top: 2px;
                        font-weight: 500;
                    ">✅ Аптека сохранена</div>
                </div>
            </div>

            <div style="
                background: #0d1829;
                border-radius: 16px;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                font-size: 14px;
            ">
                ${data.lprName ? `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#7a9ab8;">👤 ЛПР</span>
                    <span style="color:#eef6f8;font-weight:500;">${data.lprName}</span>
                </div>` : ""}

                ${data.lprPhone ? `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#7a9ab8;">📞 Телефон</span>
                    <span style="color:#eef6f8;font-weight:500;">${data.lprPhone}</span>
                </div>` : ""}

                ${data.software ? `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#7a9ab8;">💻 Программа</span>
                    <span style="color:#eef6f8;font-weight:500;">${data.software}${data.softwareId ? ' (ID: ' + data.softwareId + ')' : ''}</span>
                </div>` : ""}

                ${data.status ? `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#7a9ab8;">📊 Статус</span>
                    <span style="color:#eef6f8;font-weight:500;">${statusLabels[data.status] || data.status}</span>
                </div>` : ""}

                ${data.comment ? `
                <div style="
                    padding-top: 10px;
                    border-top: 1px solid rgba(32,210,180,0.1);
                    color: #7a9ab8;
                    font-size: 13px;
                    line-height: 1.6;
                ">💬 ${data.comment}</div>` : ""}

                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#7a9ab8;">📸 Фото</span>
                    <span style="color:#eef6f8;font-weight:500;">${data.photosCount} шт.</span>
                </div>
            </div>

            <button onclick="closePharmacyModal()" style="
                margin-top: 16px;
                width: 100%;
                min-height: 50px;
                background: linear-gradient(135deg, #20d2b4, #16b89d);
                color: #080f1a;
                border: none;
                border-radius: 14px;
                font-family: 'Syne', sans-serif;
                font-weight: 700;
                font-size: 15px;
                cursor: pointer;
                letter-spacing: 0.3px;
            ">➕ Добавить ещё аптеку</button>

            <button onclick="document.getElementById('pharmacyModal').remove(); back();" style="
                margin-top: 8px;
                width: 100%;
                min-height: 44px;
                background: transparent;
                border: 1px solid rgba(32,210,180,0.2);
                color: #7a9ab8;
                border-radius: 14px;
                font-family: 'DM Sans', sans-serif;
                font-size: 14px;
                cursor: pointer;
            ">← На главную</button>
        </div>

        <style>
            @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes slideUp { from { transform:translateY(30px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        </style>
    `;

    document.body.appendChild(overlay);
}

function closePharmacyModal() {
    const modal = document.getElementById("pharmacyModal");
    if (modal) modal.remove();
    clearPharmacyForm();
}

function clearPharmacyForm() {
    document.getElementById("name").value = "";
    document.getElementById("lpr_name").value = "";
    document.getElementById("lpr_phone").value = "";
    document.getElementById("software").value = "";
    document.getElementById("software_custom").value = "";
    document.getElementById("software_custom").style.display = "none";
    
    // Сброс и скрытие ID программы (Задачи 1, 2)
    if (document.getElementById("software_id_container")) {
        document.getElementById("software_id_container").style.display = "none";
        document.getElementById("software_id").value = "";
    }
    
    document.getElementById("pharmacy_status").value = "";
    document.getElementById("contact_comment").value = "";
    clearPhotos();
}


// =========================
// АВАТАРКА
// =========================

function loadAvatar() {
    const saved = localStorage.getItem("userAvatar");
    const el = document.getElementById("avatarImg");
    const letter = document.getElementById("avatarLetter");
    if (saved && el && letter) {
        el.src = saved;
        el.style.display = "block";
        letter.style.display = "none";
    }
}

function changeAvatar() {
    document.getElementById("avatarInput").click();
}

function onAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        const data = ev.target.result;
        localStorage.setItem("userAvatar", data);
        const el = document.getElementById("avatarImg");
        const letter = document.getElementById("avatarLetter");
        if (el && letter) {
            el.src = data;
            el.style.display = "block";
            letter.style.display = "none";
        }
    };
    reader.readAsDataURL(file);
}


// =========================
// СТАТИСТИКА
// =========================

function getStats() {
    return {
        shiftsCount:     Number(localStorage.getItem("stat_shifts") || 0),
        pharmaciesCount: Number(localStorage.getItem("stat_pharmacies") || 0),
        totalMinutes:    Number(localStorage.getItem("stat_totalMinutes") || 0),
        lastShiftDate:   localStorage.getItem("stat_lastShiftDate") || null,
        bestShift:       Number(localStorage.getItem("stat_bestShift") || 0),
        streak:          Number(localStorage.getItem("stat_streak") || 0),
        streakLastDate:  localStorage.getItem("stat_streakLastDate") || null
    };
}

function addShiftStat(minutes) {
    const s = getStats();
    const today = new Date().toLocaleDateString("ru-RU");
    let streak = s.streak;
    if (s.streakLastDate) {
        const last = new Date(s.streakLastDate.split(".").reverse().join("-"));
        const diff = Math.floor((Date.now() - last) / 86400000);
        if (diff === 1) streak += 1;
        else if (diff > 1) streak = 1;
    } else {
        streak = 1;
    }
    localStorage.setItem("stat_shifts",        s.shiftsCount + 1);
    localStorage.setItem("stat_totalMinutes",   s.totalMinutes + minutes);
    localStorage.setItem("stat_lastShiftDate",  today);
    localStorage.setItem("stat_bestShift",      Math.max(s.bestShift, minutes));
    localStorage.setItem("stat_streak",         streak);
    localStorage.setItem("stat_streakLastDate", today);
}

function addPharmacyStat() {
    localStorage.setItem("stat_pharmacies", getStats().pharmaciesCount + 1);
}

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}м`;
    return `${h}ч ${m}м`;
}

function getRank(shifts) {
    if (shifts === 0) return { label: "Новичок",     icon: "🌱" };
    if (shifts < 5)  return { label: "Стажёр",       icon: "📋" };
    if (shifts < 15) return { label: "Специалист",   icon: "💼" };
    if (shifts < 30) return { label: "Профессионал", icon: "🏅" };
    if (shifts < 60) return { label: "Эксперт",      icon: "🔥" };
    return                  { label: "Легенда",       icon: "👑" };
}

function getRankProgress(shifts) {
    if (shifts === 0) return "ещё 1 смена до ранга 📋 Стажёр";
    if (shifts < 5)  return `ещё ${5  - shifts} смен до ранга 💼 Специалист`;
    if (shifts < 15) return `ещё ${15 - shifts} смен до ранга 🏅 Профессионал`;
    if (shifts < 30) return `ещё ${30 - shifts} смен до ранга 🔥 Эксперт`;
    if (shifts < 60) return `ещё ${60 - shifts} смен до ранга 👑 Легенда`;
    return "👑 Максимальный ранг достигнут!";
}


// =========================
// МОТИВАЦИЯ
// =========================

function getMotivation(hours, minutes) {
    const total = hours * 60 + minutes;
    if (total < 30)  return "⚡ Только начало — ты уже в деле!";
    if (total < 60)  return "💪 Хорошее начало — продолжай в том же духе!";
    if (hours === 1) return "🔥 1 час позади — ты в ритме, так держать!";
    if (hours === 2) return "🚀 2 часа — ты настоящая машина!";
    if (hours === 3) return "💎 3 часа — это уже серьёзно. Ты молодец!";
    if (hours === 4) return "🏆 4 часа — результат, которым можно гордиться!";
    if (hours === 5) return "⭐ 5 часов — настоящий профессионал за работой!";
    if (hours === 6) return "🦁 6 часов — сегодня ты показал на что способен!";
    if (hours === 7) return "🔱 7 часов — легендарная смена. Ты герой дня!";
    if (hours >= 8)  return "👑 8+ часов — dedication на максимуме. Респект!";
    return "✅ Отличная работа!";
}


// =========================
// ИСТОРИЯ СМЕН
// =========================

function getShiftHistory() {
    try { return JSON.parse(localStorage.getItem("shiftHistory") || "[]"); }
    catch { return []; }
}

function saveShiftToHistory(entry) {
    const history = getShiftHistory();
    history.unshift(entry);
    if (history.length > 50) history.pop();
    localStorage.setItem("shiftHistory", JSON.stringify(history));
}


// =========================
// ТАЙМЕР СМЕНЫ
// =========================

let shiftTimerInterval = null;

function startShiftTimer() {
    stopShiftTimer();
    const timerEl = document.getElementById("shiftTimer");
    if (!timerEl) return;
    shiftTimerInterval = setInterval(() => {
        const start = Number(localStorage.getItem("shiftStart"));
        if (!start) return;
        const elapsed = Date.now() - start;
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        timerEl.innerHTML =
            `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    }, 1000);
}

function stopShiftTimer() {
    if (shiftTimerInterval) { clearInterval(shiftTimerInterval); shiftTimerInterval = null; }
    const timerEl = document.getElementById("shiftTimer");
    if (timerEl) timerEl.innerHTML = "";
}


// =========================
// ВОССТАНОВЛЕНИЕ СМЕНЫ
// =========================

window.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("shiftActive") === "true") {
        const start = localStorage.getItem("shiftStart");
        const startDate = new Date(Number(start));
        const formatted = startDate.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
        const status = document.getElementById("shiftStatus");
        if (status) {
            status.style.display = "block";
            status.innerHTML = `🟢 Смена начата в <b>${formatted}</b>`;
        }
        startShiftTimer();
    }
    checkUndoWindow();
    renderDailyPlan();
});


// =========================
// ПЛАН НА ДЕНЬ
// =========================

function renderDailyPlan() {
    const plan = Number(localStorage.getItem("dayPlan") || 0);
    const fact = Number(localStorage.getItem("dayFact") || 0);
    const el = document.getElementById("dailyPlan");
    if (!el) return;

    if (plan === 0) {
        el.innerHTML = `
            <div style="margin-top:12px;background:#111e30;border:1px solid rgba(32,210,180,0.15);border-radius:16px;padding:16px;">
                <div style="font-size:14px;color:#7a9ab8;margin-bottom:8px;">🎯 План на день</div>
                <input id="planInput" type="number" placeholder="Сколько аптек планируете посетить?" style="margin-top:0;">
                <button onclick="savePlan()" style="min-height:44px;font-size:15px;margin-top:8px;">Сохранить план</button>
            </div>`;
    } else {
        const pct = Math.min(100, Math.round((fact / plan) * 100));
        el.innerHTML = `
            <div style="margin-top:12px;background:#111e30;border:1px solid rgba(32,210,180,0.15);border-radius:16px;padding:16px;">
                <div style="font-size:14px;color:#7a9ab8;margin-bottom:10px;">🎯 План на день</div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span>Факт: <b>${fact}</b></span>
                    <span>План: <b>${plan}</b></span>
                </div>
                <div style="background:#080f1a;border-radius:8px;height:10px;overflow:hidden;">
                    <div style="background:${pct>=100?"#2edd8e":"#20d2b4"};width:${pct}%;height:100%;border-radius:8px;transition:width 0.4s;"></div>
                </div>
                <div style="font-size:13px;color:#7a9ab8;margin-top:6px;text-align:right;">
                    ${pct}% выполнено ${pct >= 100 ? "🎉" : ""}
                </div>
                <button onclick="resetPlan()" style="min-height:36px;font-size:13px;margin-top:8px;background:transparent;border:1px solid rgba(32,210,180,0.15);color:#7a9ab8;">
                    Сбросить план
                </button>
            </div>`;
    }
}

function savePlan() {
    const val = Number(document.getElementById("planInput")?.value);
    if (!val || val < 1) { showToast("⚠️ Введите число аптек"); return; }
    localStorage.setItem("dayPlan", val);
    localStorage.setItem("dayFact", 0);
    renderDailyPlan();
}

function resetPlan() {
    localStorage.removeItem("dayPlan");
    localStorage.removeItem("dayFact");
    renderDailyPlan();
}


// =========================
// КНОПКА ВОЗВРАТА
// =========================

function checkUndoWindow() {
    const endedAt = localStorage.getItem("shiftEndedAt");
    if (!endedAt) return;
    const elapsed = Date.now() - Number(endedAt);
    if (elapsed < 60000) {
        showUndoButton(Math.ceil((60000 - elapsed) / 1000));
    } else {
        localStorage.removeItem("shiftEndedAt");
        localStorage.removeItem("shiftEndedData");
    }
}

function showUndoButton(seconds) {
    const old = document.getElementById("undoBtn");
    if (old) { clearInterval(old._timer); old.remove(); }

    const btn = document.createElement("button");
    btn.id = "undoBtn";
    btn.style.cssText = `
        background: linear-gradient(135deg, #ffb547, #f59e0b);
        color: #080f1a;
        margin-top: 12px;
        font-family: 'Syne', sans-serif;
        font-weight: 700;
    `;
    btn.innerHTML = `↩️ Вернуться на смену (${seconds}с)`;
    btn.onclick = undoEndShift;

    const shiftDiv = document.getElementById("shift");
    if (shiftDiv) {
        const startBtn = shiftDiv.querySelector("button[onclick='startShift()']");
        if (startBtn) startBtn.parentNode.insertBefore(btn, startBtn);
    }

    let timeLeft = seconds;
    const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timer);
            btn.remove();
            localStorage.removeItem("shiftEndedAt");
            localStorage.removeItem("shiftEndedData");
        } else {
            btn.innerHTML = `↩️ Вернуться на смену (${timeLeft}с)`;
        }
    }, 1000);
    btn._timer = timer;
}

function undoEndShift() {
    const savedData = localStorage.getItem("shiftEndedData");
    if (!savedData) return;
    const { startTime, startFormatted, totalMinutes } = JSON.parse(savedData);

    localStorage.setItem("shiftStart", startTime);
    localStorage.setItem("shiftActive", "true");
    localStorage.removeItem("shiftEndedAt");
    localStorage.removeItem("shiftEndedData");

    const s = getStats();
    localStorage.setItem("stat_shifts", Math.max(0, s.shiftsCount - 1));
    localStorage.setItem("stat_totalMinutes", Math.max(0, s.totalMinutes - totalMinutes));

    const history = getShiftHistory();
    history.shift();
    localStorage.setItem("shiftHistory", JSON.stringify(history));

    const btn = document.getElementById("undoBtn");
    if (btn) { clearInterval(btn._timer); btn.remove(); }

    const status = document.getElementById("shiftStatus");
    if (status) {
        status.style.display = "block";
        status.innerHTML = `🟢 Смена начата в <b>${startFormatted}</b>`;
    }
    startShiftTimer();
    showToast("✅ Смена восстановлена!");
}


// =========================
// НАВИГАЦИЯ
// =========================

function openPage(page) {
    ["dashboard","pharmacy","shift","profile","history"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    const target = document.getElementById(page);
    if (target) target.style.display = "block";
    
    if (page === "shift") { checkUndoWindow(); renderDailyPlan(); }
    if (page === "profile") renderProfile();
    if (page === "history") renderHistory();
}

function back() { openPage("dashboard"); }


// =========================
// ПРОФИЛЬ
// =========================

function renderProfile() {
    const s = getStats();
    const rank = getRank(s.shiftsCount);
    
    if (document.getElementById("profileRankIcon")) document.getElementById("profileRankIcon").innerHTML = rank.icon;
    if (document.getElementById("profileRankLabel")) document.getElementById("profileRankLabel").innerHTML = rank.label;
    if (document.getElementById("profileProgress")) document.getElementById("profileProgress").innerHTML = getRankProgress(s.shiftsCount);
    
    if (document.getElementById("stat_shifts")) document.getElementById("stat_shifts").innerHTML = s.shiftsCount;
    if (document.getElementById("stat_pharmacies")) document.getElementById("stat_pharmacies").innerHTML = s.pharmaciesCount;
    if (document.getElementById("stat_time")) document.getElementById("stat_time").innerHTML = formatTime(s.totalMinutes);
    if (document.getElementById("stat_streak")) document.getElementById("stat_streak").innerHTML = `${s.streak} 🔥`;
    
    loadAvatar();
}


// =========================
// ИСТОРИЯ (ИНТЕРФЕЙС)
// =========================

function renderHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    const history = getShiftHistory();
    if (history.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:#7a9ab8;padding:40px 0;font-size:14px;">📭 История смен пуста</div>`;
        return;
    }
    list.innerHTML = history.map(item => `
        <div class="history-item" style="background:#111e30;border:1px solid rgba(32,210,180,0.15);border-radius:16px;padding:16px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;color:#7a9ab8;margin-bottom:6px;">
                <span>📅 ${item.date}</span>
                <span style="color:#20d2b4;font-weight:500;">⏱ ${item.worked}</span>
            </div>
            <div style="font-size:15px;font-weight:500;color:#eef6f8;">⏱ ${item.start} – ${item.end}</div>
            ${item.pharmacies ? `<div style="margin-top:6px;font-size:13px;color:#2edd8e;">🏥 Посещено аптек: <b>${item.pharmacies}</b></div>` : ""}
        </div>
    `).join("");
}


// =========================
// ДИНАМИЧЕСКИЙ ВВОД ПРОГРАММЫ (ЗАДАЧИ 1, 2)
// =========================

function toggleSoftwareInput() {
    const select = document.getElementById("software");
    const custom = document.getElementById("software_custom");
    const idContainer = document.getElementById("software_id_container");
    if (!select) return;

    // Показываем поле ввода ID только для ABU и LEKKO
    if (select.value === "ABU" || select.value === "LEKKO") {
        if (idContainer) idContainer.style.display = "block";
    } else {
        if (idContainer) {
            idContainer.style.display = "none";
            const idInput = document.getElementById("software_id");
            if (idInput) idInput.value = "";
        }
    }

    // Кастомное поле для варианта "Другая"
    if (select.value === "Другая") {
        if (custom) custom.style.display = "block";
    } else {
        if (custom) {
            custom.style.display = "none";
            custom.value = "";
        }
    }
}


// =========================
// ФОТОГРАФИИ
// =========================

function openFilePicker() {
    document.getElementById("photo").click();
}

function previewPhotos() {
    const files = Array.from(document.getElementById("photo").files);
    const container = document.getElementById("photoContainer");
    if (!container) return;

    files.forEach(file => {
        if (photos.length >= 10) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            photos.push(e.target.result);
            const div = document.createElement("div");
            div.className = "photo-preview";
            div.style.cssText = `
                position:relative; width:70px; height:70px;
                border-radius:10px; overflow:hidden; border:1px solid rgba(32,210,180,0.3);
            `;
            div.innerHTML = `
                <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">
                <span onclick="removePhoto(this, '${e.target.result}')" style="
                    position:absolute; top:2px; right:2px; background:rgba(255,79,109,0.8);
                    color:white; width:16px; height:16px; border-radius:50%; text-align:center;
                    line-height:14px; font-size:12px; cursor:pointer; font-weight:bold;
                ">×</span>
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removePhoto(btn, src) {
    btn.parentNode.remove();
    photos = photos.filter(p => p !== src);
}

function clearPhotos() {
    photos = [];
    const container = document.getElementById("photoContainer");
    if (container) container.innerHTML = "";
    const input = document.getElementById("photo");
    if (input) input.value = "";
}


// =========================
// СТАРТ / СТОП СМЕНЫ
// =========================

function startShift() {
    if (localStorage.getItem("shiftActive") === "true") return;

    if (!navigator.geolocation) {
        alert("❌ Геолокация не поддерживается вашим устройством.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const now = Date.now();
            const startFormatted = new Date(now).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;

            localStorage.setItem("shiftActive", "true");
            localStorage.setItem("shiftStart", now);

            sendToServer({
                event: "shift_start",
                user: user,
                startTime: startFormatted,
                latitude: lat,
                longitude: lon,
                map: mapLink
            });

            const status = document.getElementById("shiftStatus");
            if (status) {
                status.style.display = "block";
                status.innerHTML = `🟢 Смена начата в <b>${startFormatted}</b>`;
            }
            startShiftTimer();
            showToast("🟢 Смена успешно открыта!");
        },
        function() { alert("❌ Не удалось получить геолокацию для старта смены."); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function endShift() {
    if (localStorage.getItem("shiftActive") !== "true") return;

    if (!navigator.geolocation) {
        alert("❌ Геолокация не поддерживается.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const start = Number(localStorage.getItem("shiftStart"));
            const elapsed = Date.now() - start;

            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const workedText = `${hours}ч ${minutes}м`;
            const endFormatted = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
            const motivation = getMotivation(hours, minutes);
            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;

            stopShiftTimer();
            const status = document.getElementById("shiftStatus");
            if (status) {
                status.style.display = "none";
                status.innerHTML = "";
            }

            const todayStr = new Date().toLocaleDateString("ru-RU");
            const fact = Number(localStorage.getItem("dayFact") || 0);

            addShiftStat(hours * 60 + minutes);
            saveShiftToHistory({
                date: todayStr,
                start: new Date(start).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
                end: endFormatted,
                worked: workedText,
                pharmacies: fact
            });

            localStorage.setItem("shiftEndedAt", Date.now());
            localStorage.setItem("shiftEndedData", JSON.stringify({
                startTime: start,
                startFormatted: new Date(start).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
                totalMinutes: hours * 60 + minutes
            }));

            sendToServer({
                event: "shift_end",
                user: user,
                worked: workedText,
                startTime: new Date(start).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
                endTime: endFormatted,
                latitude: lat,
                longitude: lon,
                map: mapLink
            });

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
                .then(r => r.json())
                .then(geo => {
                    const address = geo.display_name || `${lat}, ${lon}`;
                    alert(`🔴 Смена завершена в ${endFormatted}\n⏱ Отработано: ${workedText}\n\n${motivation}\n\n📍 Локация:\n${address}\n\n🗺 Google Maps:\n${mapLink}`);
                })
                .catch(() => {
                    alert(`🔴 Смена завершена в ${endFormatted}\n⏱ Отработано: ${workedText}\n\n${motivation}\n\n📍 Координаты: ${lat}, ${lon}\n\n🗺 Google Maps:\n${mapLink}`);
                });

            localStorage.removeItem("shiftActive");
            localStorage.removeItem("shiftStart");
        },
        function() { alert("❌ Не удалось получить геолокацию."); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}


// =========================
// СОХРАНЕНИЕ АПТЕКИ
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
                softwareId: softwareId, // Передаем ID на сервер
                status: status,
                comment: comment,
                photosCount: photos.length,
                latitude: lat,
                longitude: lon,
                map: mapLink
            };

            sendToServer(data);
            addPharmacyStat();

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
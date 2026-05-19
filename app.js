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

document.getElementById("user").innerHTML =
    user ? `${getGreeting()}, <b>${user.first_name}</b>! 👋` : "Пользователь не найден";

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
            `⏱ <b>${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}</b>`;
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
        status.style.display = "block";
        status.innerHTML = `🟢 Смена начата в <b>${formatted}</b>`;
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
            <div style="margin-top:12px;background:#1e293b;border-radius:14px;padding:16px;">
                <div style="font-size:14px;color:#94a3b8;margin-bottom:8px;">🎯 План на день</div>
                <input id="planInput" type="number" placeholder="Сколько аптек планируете посетить?" style="margin-top:0;">
                <button onclick="savePlan()" style="min-height:44px;font-size:15px;margin-top:8px;">Сохранить план</button>
            </div>`;
    } else {
        const pct = Math.min(100, Math.round((fact / plan) * 100));
        el.innerHTML = `
            <div style="margin-top:12px;background:#1e293b;border-radius:14px;padding:16px;">
                <div style="font-size:14px;color:#94a3b8;margin-bottom:10px;">🎯 План на день</div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span>Факт: <b>${fact}</b></span>
                    <span>План: <b>${plan}</b></span>
                </div>
                <div style="background:#0f172a;border-radius:8px;height:10px;overflow:hidden;">
                    <div style="background:${pct>=100?"#22c55e":"#3b82f6"};width:${pct}%;height:100%;border-radius:8px;transition:width 0.4s;"></div>
                </div>
                <div style="font-size:13px;color:#94a3b8;margin-top:6px;text-align:right;">
                    ${pct}% выполнено ${pct >= 100 ? "🎉" : ""}
                </div>
                <button onclick="resetPlan()" style="min-height:36px;font-size:13px;margin-top:8px;background:#0f172a;color:#94a3b8;">
                    Сбросить план
                </button>
            </div>`;
    }
}

function savePlan() {
    const val = Number(document.getElementById("planInput")?.value);
    if (!val || val < 1) { alert("Введите число аптек"); return; }
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
    btn.style.background = "#f59e0b";
    btn.style.marginTop = "12px";
    btn.innerHTML = `↩️ Вернуться на смену (${seconds}с)`;
    btn.onclick = undoEndShift;

    const shiftDiv = document.getElementById("shift");
    const startBtn = shiftDiv.querySelector("button[onclick='startShift()']");
    startBtn.parentNode.insertBefore(btn, startBtn);

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
    localStorage.setItem("stat_shifts",       Math.max(0, s.shiftsCount - 1));
    localStorage.setItem("stat_totalMinutes", Math.max(0, s.totalMinutes - totalMinutes));

    const history = getShiftHistory();
    history.shift();
    localStorage.setItem("shiftHistory", JSON.stringify(history));

    const btn = document.getElementById("undoBtn");
    if (btn) { clearInterval(btn._timer); btn.remove(); }

    const status = document.getElementById("shiftStatus");
    status.style.display = "block";
    status.innerHTML = `🟢 Смена начата в <b>${startFormatted}</b>`;

    startShiftTimer();
    alert("✅ Смена восстановлена!");
}


// =========================
// НАВИГАЦИЯ
// =========================

function openPage(page) {
    ["dashboard","pharmacy","shift","profile","history"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    document.getElementById(page).style.display = "block";
    if (page === "shift")   { checkUndoWindow(); renderDailyPlan(); }
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
    const name = user?.first_name || "Сотрудник";
    const username = user?.username ? `@${user.username}` : "";
    const savedAvatar = localStorage.getItem("userAvatar");

    const avatarContent = savedAvatar
        ? `<img id="avatarImg" src="${savedAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : `<span id="avatarLetter" style="font-size:36px;">${name.charAt(0).toUpperCase()}</span>`;

    document.getElementById("profileContent").innerHTML = `
        <div style="text-align:center;padding:20px 0 10px;">
            <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;margin:0 auto 6px;overflow:hidden;cursor:pointer;position:relative;" onclick="changeAvatar()">
                ${avatarContent}
                <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.45);font-size:11px;color:white;padding:3px 0;border-radius:0 0 50px 50px;">✏️</div>
            </div>
            <input type="file" id="avatarInput" accept="image/*" style="display:none;" onchange="onAvatarChange(event)">
            <div style="font-size:22px;font-weight:bold;margin-top:8px;">${name}</div>
            <div style="color:#94a3b8;font-size:14px;margin-top:4px;">${username}</div>
            <div style="display:inline-flex;align-items:center;gap:6px;background:#1e293b;border-radius:20px;padding:6px 16px;margin-top:12px;font-size:14px;color:#60a5fa;">${rank.icon} ${rank.label}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">
            <div style="background:#1e293b;border-radius:16px;padding:16px;text-align:center;">
                <div style="font-size:28px;font-weight:bold;color:#3b82f6;">${s.shiftsCount}</div>
                <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Смен отработано</div>
            </div>
            <div style="background:#1e293b;border-radius:16px;padding:16px;text-align:center;">
                <div style="font-size:28px;font-weight:bold;color:#3b82f6;">${s.pharmaciesCount}</div>
                <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Аптек загружено</div>
            </div>
            <div style="background:#1e293b;border-radius:16px;padding:16px;text-align:center;">
                <div style="font-size:22px;font-weight:bold;color:#3b82f6;">${formatTime(s.totalMinutes)}</div>
                <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Всего отработано</div>
            </div>
            <div style="background:#1e293b;border-radius:16px;padding:16px;text-align:center;">
                <div style="font-size:22px;font-weight:bold;color:#3b82f6;">${formatTime(s.bestShift)}</div>
                <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Рекорд смены</div>
            </div>
        </div>

        <div style="background:#1e293b;border-radius:16px;padding:16px;margin-top:12px;text-align:center;">
            <div style="font-size:32px;font-weight:bold;color:#f59e0b;">🔥 ${s.streak}</div>
            <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Дней подряд на работе</div>
        </div>

        <div style="background:#1e293b;border-radius:16px;padding:16px;margin-top:12px;font-size:14px;color:#94a3b8;line-height:1.8;">
            📊 ${getRankProgress(s.shiftsCount)}<br>
            📅 Последняя смена: ${s.lastShiftDate || "—"}
        </div>
    `;
}


// =========================
// ИСТОРИЯ СМЕН
// =========================

function renderHistory() {
    const history = getShiftHistory();
    const el = document.getElementById("historyContent");

    if (history.length === 0) {
        el.innerHTML = `<div style="text-align:center;color:#94a3b8;margin-top:40px;font-size:15px;">📭 История смен пока пуста</div>`;
        return;
    }

    el.innerHTML = history.map((entry, i) => `
        <div style="background:#1e293b;border-radius:14px;padding:16px;margin-top:12px;line-height:1.8;">
            <div style="font-weight:bold;color:#60a5fa;margin-bottom:6px;">📅 ${entry.date}</div>
            <div>🟢 Начало: <b>${entry.start}</b></div>
            <div>🔴 Конец: <b>${entry.end}</b></div>
            <div>⏱ Отработано: <b>${entry.worked}</b></div>
            ${entry.pharmacies ? `<div>🏥 Аптек: <b>${entry.pharmacies}</b></div>` : ""}
            ${entry.note
                ? `<div style="margin-top:8px;padding:10px;background:#0f172a;border-radius:10px;font-size:14px;color:#94a3b8;">📝 ${entry.note}</div>`
                : `<div style="margin-top:8px;">
                       <input id="note_${i}" placeholder="Добавить заметку о смене..." style="margin-top:4px;height:44px;font-size:14px;">
                       <button onclick="saveNote(${i})" style="min-height:38px;font-size:14px;margin-top:6px;background:#1d4ed8;">💾 Сохранить заметку</button>
                   </div>`
            }
        </div>
    `).join("");
}

function saveNote(index) {
    const input = document.getElementById(`note_${index}`);
    if (!input || !input.value.trim()) return;
    const history = getShiftHistory();
    if (history[index]) {
        history[index].note = input.value.trim();
        localStorage.setItem("shiftHistory", JSON.stringify(history));
        renderHistory();
    }
}


// =========================
// ФОТО АПТЕКИ
// =========================

function openFilePicker() { document.getElementById("photo").click(); }

function previewPhotos() {
    const files = document.getElementById("photo").files;
    const container = document.getElementById("photoContainer");
    for (let file of files) {
        photos.push(file);
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        container.appendChild(img);
    }
}

function clearPhotos() {
    photos = [];
    document.getElementById("photoContainer").innerHTML = "";
    document.getElementById("photo").value = "";
}


// =========================
// МАСКА ТЕЛЕФОНА
// =========================

const phoneInput = document.getElementById("lpr_phone");

phoneInput.addEventListener("focus", () => {
    if (phoneInput.value === "") phoneInput.value = "+998 ";
});

phoneInput.addEventListener("input", function(e) {
    let x = e.target.value.replace(/\D/g, "");
    if (!x.startsWith("998")) x = "998" + x;
    x = x.substring(0, 12);
    let formatted = "+998";
    if (x.length > 3)  formatted += " (" + x.substring(3, 5);
    if (x.length >= 5) formatted += ") " + x.substring(5, 8);
    if (x.length >= 8) formatted += "-" + x.substring(8, 10);
    if (x.length >= 10) formatted += "-" + x.substring(10, 12);
    e.target.value = formatted;
});


// =========================
// СОХРАНЕНИЕ АПТЕКИ
// =========================

function savePharmacy() {
    let softwareValue = document.getElementById("software").value;
    if (softwareValue === "other") {
        softwareValue = document.getElementById("software_custom").value;
    }

    const comment = document.getElementById("contact_comment").value.trim();
    const name = document.getElementById("name").value;

    if (!name)            { alert("Введите название аптеки"); return; }
    if (photos.length === 0) { alert("Добавьте фото"); return; }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;

            addPharmacyStat();
            const fact = Number(localStorage.getItem("dayFact") || 0);
            localStorage.setItem("dayFact", fact + 1);

            sendToServer({
                type: "PHARMACY_CREATED",
                user: user?.first_name || null,
                latitude: lat,
                longitude: lon,
                map: mapLink,
                data: {
                    name,
                    lprName:     document.getElementById("lpr_name").value,
                    lprPhone:    document.getElementById("lpr_phone").value,
                    software:    softwareValue,
                    status:      document.getElementById("pharmacy_status").value,
                    comment,
                    photosCount: photos.length
                }
            });

            alert("🏥 Аптека сохранена");
        },
        function() {
            addPharmacyStat();
            const fact = Number(localStorage.getItem("dayFact") || 0);
            localStorage.setItem("dayFact", fact + 1);

            sendToServer({
                type: "PHARMACY_CREATED",
                user: user?.first_name || null,
                data: {
                    name,
                    lprName:     document.getElementById("lpr_name").value,
                    lprPhone:    document.getElementById("lpr_phone").value,
                    software:    softwareValue,
                    status:      document.getElementById("pharmacy_status").value,
                    comment,
                    photosCount: photos.length
                }
            });

            alert("🏥 Аптека сохранена");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}


// =========================
// НАЧАЛО СМЕНЫ
// =========================

function startShift() {
    if (localStorage.getItem("shiftActive") === "true") {
        alert("🟢 Смена уже начата");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;

            const startTime = new Date();
            localStorage.setItem("shiftStart", startTime.getTime());
            localStorage.setItem("shiftActive", "true");

            const formattedTime = startTime.toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit'
            });

            const status = document.getElementById("shiftStatus");
            status.style.display = "block";
            status.innerHTML = `🟢 Смена начата в <b>${formattedTime}</b>`;

            startShiftTimer();

            sendToServer({
                type: "SHIFT_STARTED",
                user: user?.first_name,
                time: formattedTime,
                latitude: lat,
                longitude: lon,
                map: mapLink
            });

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
                .then(r => r.json())
                .then(geo => {
                    const address = geo.display_name || `${lat}, ${lon}`;
                    alert(`🟢 Смена начата в ${formattedTime}\n\n📍 Локация:\n${address}\n\n🗺 Google Maps:\n${mapLink}`);
                })
                .catch(() => {
                    alert(`🟢 Смена начата в ${formattedTime}\n\n📍 Координаты: ${lat}, ${lon}\n\n🗺 Google Maps:\n${mapLink}`);
                });
        },
        function() {
            alert("❌ Не удалось получить геолокацию.\nРазрешите GPS в Telegram.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}


// =========================
// ЗАВЕРШЕНИЕ СМЕНЫ
// =========================

function endShift() {
    if (localStorage.getItem("shiftActive") !== "true") {
        alert("❌ Смена не начата");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;

            const endTime   = new Date();
            const startDate = new Date(Number(localStorage.getItem("shiftStart")));
            const workedMs  = endTime - startDate;

            const hours        = Math.floor(workedMs / 3600000);
            const minutes      = Math.floor((workedMs % 3600000) / 60000);
            const totalMinutes = hours * 60 + minutes;
            const workedText   = `${hours}ч ${minutes}м`;

            const startFormatted = startDate.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
            const endFormatted   = endTime.toLocaleTimeString([],   { hour:'2-digit', minute:'2-digit' });
            const today          = new Date().toLocaleDateString("ru-RU");
            const motivation     = getMotivation(hours, minutes);

            addShiftStat(totalMinutes);
            stopShiftTimer();

            saveShiftToHistory({
                date:       today,
                start:      startFormatted,
                end:        endFormatted,
                worked:     workedText,
                pharmacies: localStorage.getItem("dayFact") || 0,
                note:       ""
            });

            const status = document.getElementById("shiftStatus");
            status.style.display = "block";
            status.innerHTML =
                `🟢 Смена начата в <b>${startFormatted}</b><br>` +
                `🔴 Завершена в <b>${endFormatted}</b><br>` +
                `⏱ Отработано: <b>${workedText}</b><br><br>` +
                `${motivation}`;

            localStorage.setItem("shiftEndedAt", Date.now());
            localStorage.setItem("shiftEndedData", JSON.stringify({
                startTime: startDate.getTime(),
                startFormatted,
                totalMinutes
            }));

            showUndoButton(60);

            sendToServer({
                type: "SHIFT_ENDED",
                user: user?.first_name,
                time: endFormatted,
                worked: workedText,
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
// ПЕРЕКЛЮЧЕНИЕ ПРОГРАММЫ
// =========================

function toggleSoftwareInput() {
    const select = document.getElementById("software");
    const custom = document.getElementById("software_custom");
    if (!select || !custom) return;
    if (select.value === "other") {
        custom.style.display = "block";
    } else {
        custom.style.display = "none";
        custom.value = "";
    }
}
// Variables globales
let isWorking = false;
let currentSession = null;
let currentViewMonth = new Date();
let coinInterval = null;

// Configuration par défaut
let config = {
    hourlyGross: 12.50,
    hourlyNet: 10.00,
    weeklyHours: 35,
    dailyHours: 7,
    workStartTime: '08:30',
    workEndTime: '17:00',
    earlyStartLimit: '07:30',
    lateEndLimit: '18:00'
};

// ======================
// GESTION DATE DE TRAVAIL
// ======================

function getWorkDate(dateTime) {
    const date = new Date(dateTime);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    const earlyLimitMinutes = 7 * 60 + 30;

    if (timeInMinutes < earlyLimitMinutes) {
        const previousDay = new Date(date);
        previousDay.setDate(date.getDate() - 1);
        return previousDay.toISOString().split('T')[0];
    } else {
        return date.toISOString().split('T')[0];
    }
}

function validatePunchTime(dateTime) {
    const date = new Date(dateTime);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    if (timeStr < '07:30' || timeStr > '18:00') {
        return {
            valid: false,
            message: `⚠️ Pointage hors horaires autorisés !\n🕐 Créneaux : 7h30 - 18h00\n⏰ Votre pointage : ${timeStr}`
        };
    }

    return { valid: true };
}

// Initialisation au chargement
window.onload = function() {
    console.log('🚀 TimeTracker Pro - Initialisation...');

    // Attendre que le DOM soit chargé
    setTimeout(() => {
        loadConfig();
        loadCurrentSession();
        updateClock();
        updateDisplay();
        updateMonthView(); // Ceci va appeler generateCalendar()

        // Intervalles de mise à jour
        setInterval(updateClock, 1000);
        setInterval(updateDisplay, 1000); // CORRECTION : Mise à jour continue

        console.log('✅ TimeTracker Pro - Prêt !');
    }, 100);
};

// ======================
// GESTION DU TEMPS
// ======================

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR');
    const element = document.getElementById('currentTime');
    if (element) {
        element.textContent = timeStr;
    }
}

function formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

// ======================
// PIGGY BANK
// ======================

function createCoin() {
    const coinContainer = document.getElementById('coin-container');
    if (!coinContainer) return;

    const coin = document.createElement('div');
    coin.className = 'coin';

    const startX = Math.random() * (coinContainer.offsetWidth - 20);
    coin.style.left = `${startX}px`;

    coinContainer.appendChild(coin);

    setTimeout(() => {
        coin.remove();
    }, 2000);
}

// ======================
// LOGIQUE DE POINTAGE
// ======================

function togglePunch() {
    if (isWorking) {
        punchOut();
    } else {
        punchIn();
    }
}

function punchIn() {
    const now = new Date();

    const validation = validatePunchTime(now);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    console.log('📍 Pointage ENTRÉE');

    const workDate = getWorkDate(now);

    currentSession = {
        workDate: workDate,
        startTime: now.toISOString(),
        endTime: null,
        sessionHourlyGross: config.hourlyGross,
        sessionHourlyNet: config.hourlyNet
    };

    isWorking = true;

    const button = document.getElementById('punchButton');
    const statusBar = document.getElementById('statusBar');

    if (button) {
        button.textContent = '🔴 Pointer Sortie';
        button.className = 'punch-button punch-out';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const workDateInfo = workDate !== todayStr ? ` (pour le ${workDate})` : '';

    if (statusBar) {
        statusBar.textContent = `✅ Au travail depuis ${now.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}${workDateInfo}`;
        statusBar.className = 'status-bar working';
    }

    saveCurrentSession();
    updateDisplay(); // CORRECTION : Mise à jour immédiate

    if (coinInterval) clearInterval(coinInterval);
    coinInterval = setInterval(createCoin, 3000);
}

function punchOut() {
    if (!currentSession) return;

    const now = new Date();

    const validation = validatePunchTime(now);
    if (!validation.valid) {
        if (!confirm(validation.message + '\n\nContinuer quand même le pointage sortie ?')) {
            return;
        }
    }

    console.log('📍 Pointage SORTIE');

    const workDateOut = getWorkDate(now);
    if (workDateOut !== currentSession.workDate) {
        const confirmMsg = `⚠️ Attention : Dates de travail différentes !\n\n` +
                          `📅 Entrée : ${currentSession.workDate}\n` +
                          `📅 Sortie : ${workDateOut}\n\n` +
                          `Voulez-vous continuer ?\n(La journée sera enregistrée pour ${currentSession.workDate})`;

        if (!confirm(confirmMsg)) {
            return;
        }
    }

    currentSession.endTime = now.toISOString();

    const startTime = new Date(currentSession.startTime);
    const endTime = new Date(currentSession.endTime);
    const durationMs = endTime - startTime;
    const durationHours = durationMs / (1000 * 60 * 60);

    const grossEarning = durationHours * currentSession.sessionHourlyGross;
    const netEarning = durationHours * currentSession.sessionHourlyNet;

    const workDay = {
        date: currentSession.workDate,
        startTime: startTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}),
        endTime: endTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}),
        startDateTime: currentSession.startTime,
        endDateTime: currentSession.endTime,
        duration: formatDuration(durationMs),
        durationMs: durationMs,
        grossEarning: grossEarning.toFixed(2),
        netEarning: netEarning.toFixed(2),
        hourlyGross: currentSession.sessionHourlyGross,
        hourlyNet: currentSession.sessionHourlyNet
    };

    saveToHistory(workDay);

    const savedWorkDate = currentSession.workDate;
    currentSession = null;
    isWorking = false;

    const button = document.getElementById('punchButton');
    const statusBar = document.getElementById('statusBar');

    if (button) {
        button.textContent = '🟢 Pointer Entrée';
        button.className = 'punch-button punch-in';
    }

    if (statusBar) {
        statusBar.textContent = '📴 Pas au travail';
        statusBar.className = 'status-bar not-working';
    }

    saveCurrentSession();
    updateDisplay(); // CORRECTION : Mise à jour immédiate
    updateMonthView(); // CORRECTION : Recharger le calendrier

    if (coinInterval) clearInterval(coinInterval);

    const workDateStr = new Date(savedWorkDate).toLocaleDateString('fr-FR');
    alert(`✅ Journée terminée pour le ${workDateStr} !\n⏱️ Temps travaillé : ${workDay.duration}\n💰 Gains nets : ${workDay.netEarning}€`);
}

// ======================
// CALCULS TEMPS RÉEL
// ======================

function updateDisplay() {
    const workedTimeEl = document.getElementById('workedTime');
    const grossEarningsEl = document.getElementById('grossEarnings');
    const netEarningsEl = document.getElementById('netEarnings');
    const projectionEl = document.getElementById('projection');

    if (!workedTimeEl || !grossEarningsEl || !netEarningsEl || !projectionEl) {
        return; // Protection si éléments n'existent pas
    }

    if (!isWorking || !currentSession) {
        workedTimeEl.textContent = '0h 00m';
        grossEarningsEl.textContent = '0,00€';
        netEarningsEl.textContent = '0,00€';
        projectionEl.textContent = '--€';
        return;
    }

    const now = new Date();
    const startTime = new Date(currentSession.startTime);
    const durationMs = now - startTime;
    const durationHours = durationMs / (1000 * 60 * 60);

    const grossEarning = durationHours * currentSession.sessionHourlyGross;
    const netEarning = durationHours * currentSession.sessionHourlyNet;

    workedTimeEl.textContent = formatDuration(durationMs);
    grossEarningsEl.textContent = grossEarning.toFixed(2) + '€';
    netEarningsEl.textContent = netEarning.toFixed(2) + '€';

    updateProjection();
}

function updateProjection() {
    const projectionEl = document.getElementById('projection');
    const targetTimeEl = document.getElementById('endTimeTarget');

    if (!projectionEl || !targetTimeEl) return;

    if (!isWorking || !currentSession) {
        projectionEl.textContent = '--€';
        return;
    }

    const targetTime = targetTimeEl.value;
    if (!targetTime) return;

    const now = new Date();
    const startTime = new Date(currentSession.startTime);
    const workDate = new Date(currentSession.workDate + 'T00:00:00');
    const [hours, minutes] = targetTime.split(':');
    const endTime = new Date(workDate);
    endTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (now.getDate() !== workDate.getDate()) {
        endTime.setDate(now.getDate());
    }

    if (endTime <= startTime) {
        projectionEl.textContent = 'Heure dépassée';
        return;
    }

    const totalDurationMs = endTime - startTime;
    const totalDurationHours = totalDurationMs / (1000 * 60 * 60);
    const projectionNet = totalDurationHours * currentSession.sessionHourlyNet;

    projectionEl.textContent = projectionNet.toFixed(2) + '€';
}

// ======================
// CONFIGURATION
// ======================

function saveConfig() {
    if (isWorking) {
        alert('⚠️ Impossible de modifier la configuration pendant le travail.\n\n💡 Dépointer puis repointer pour appliquer les nouveaux paramètres.');
        loadConfig();
        return;
    }

    config.hourlyGross = parseFloat(document.getElementById('hourlyGross').value) || 12.50;
    config.hourlyNet = parseFloat(document.getElementById('hourlyNet').value) || 10.00;
    config.weeklyHours = parseInt(document.getElementById('weeklyHours').value) || 35;
    config.dailyHours = parseFloat(document.getElementById('dailyHours').value) || 7;
    config.workStartTime = document.getElementById('workStartTime').value || '08:30';
    config.workEndTime = document.getElementById('workEndTime').value || '17:00';

    const endTargetEl = document.getElementById('endTimeTarget');
    if (endTargetEl) {
        endTargetEl.value = config.workEndTime;
    }

    localStorage.setItem('timetracker_config', JSON.stringify(config));
    updateDisplay(); // CORRECTION : Mise à jour après changement config
    console.log('⚙️ Configuration sauvegardée', config);
}

function loadConfig() {
    const saved = localStorage.getItem('timetracker_config');
    if (saved) {
        config = JSON.parse(saved);

        const elements = [
            'hourlyGross', 'hourlyNet', 'weeklyHours', 'dailyHours',
            'workStartTime', 'workEndTime', 'endTimeTarget'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element && config[id] !== undefined) {
                element.value = config[id];
            }
        });

        // Valeurs par défaut
        const endTargetEl = document.getElementById('endTimeTarget');
        if (endTargetEl && !endTargetEl.value) {
            endTargetEl.value = config.workEndTime || '17:00';
        }
    }
}

// ======================
// GESTION SESSION
// ======================

function saveCurrentSession() {
    if (currentSession && isWorking) {
        localStorage.setItem('timetracker_current_session', JSON.stringify({
            session: currentSession,
            isWorking: isWorking
        }));
    } else {
        localStorage.removeItem('timetracker_current_session');
    }
}

function loadCurrentSession() {
    const saved = localStorage.getItem('timetracker_current_session');
    if (saved) {
        const data = JSON.parse(saved);
        currentSession = data.session;
        isWorking = data.isWorking;

        if (isWorking) {
            const button = document.getElementById('punchButton');
            const statusBar = document.getElementById('statusBar');

            if (button) {
                button.textContent = '🔴 Pointer Sortie';
                button.className = 'punch-button punch-out';
            }

            const startTime = new Date(currentSession.startTime);
            const todayStr = new Date().toISOString().split('T')[0];
            const workDateInfo = currentSession.workDate !== todayStr ? ` (pour le ${currentSession.workDate})` : '';

            if (statusBar) {
                statusBar.textContent = `✅ Au travail depuis ${startTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}${workDateInfo}`;
                statusBar.className = 'status-bar working';
            }

            if (coinInterval) clearInterval(coinInterval);
            coinInterval = setInterval(createCoin, 3000);
        }
    }
}

// ======================
// HISTORIQUE
// ======================

function saveToHistory(workDay) {
    let history = JSON.parse(localStorage.getItem('timetracker_history') || '[]');

    const existingIndex = history.findIndex(day => day.date === workDay.date);
    if (existingIndex !== -1) {
        if (confirm(`⚠️ Une journée existe déjà pour le ${workDay.date}.\nVoulez-vous la remplacer ?`)) {
            history[existingIndex] = workDay;
            console.log('🔄 Journée remplacée dans l\'historique');
        } else {
            return;
        }
    } else {
        history.unshift(workDay);
    }

    history = history.slice(0, 250);
    localStorage.setItem('timetracker_history', JSON.stringify(history));
}

function getHistoryForMonth(year, month) {
    const history = JSON.parse(localStorage.getItem('timetracker_history') || '[]');
    return history.filter(day => {
        const date = new Date(day.date);
        return date.getFullYear() === year && date.getMonth() === month;
    });
}

function changeMonth(direction) {
    currentViewMonth.setMonth(currentViewMonth.getMonth() + direction);
    updateMonthView();
}

function updateMonthView() {
    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const monthStr = `${monthNames[currentViewMonth.getMonth()]} ${currentViewMonth.getFullYear()}`;
    const currentMonthEl = document.getElementById('currentMonth');
    if (currentMonthEl) {
        currentMonthEl.textContent = monthStr;
    }

    const monthHistory = getHistoryForMonth(currentViewMonth.getFullYear(), currentViewMonth.getMonth());

    const totalDays = monthHistory.length;
    const totalMs = monthHistory.reduce((sum, day) => sum + (day.durationMs || 0), 0);
    const totalEarnings = monthHistory.reduce((sum, day) => sum + parseFloat(day.netEarning || 0), 0);

    const elements = {
        monthDays: totalDays,
        monthHours: formatDuration(totalMs),
        monthEarnings: totalEarnings.toFixed(2) + '€'
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    // CORRECTION : Générer le calendrier
    setTimeout(generateCalendar, 50); // Petit délai pour s'assurer que DOM est prêt
}

// ======================
// MINI CALENDRIER
// ======================

function generateCalendar() {
    console.log('🗓️ Génération du calendrier...');

    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) {
        console.warn('⚠️ Element calendarGrid non trouvé');
        return;
    }

    const year = currentViewMonth.getFullYear();
    const month = currentViewMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    calendarGrid.innerHTML = '';

    const today = new Date();
    const monthHistory = getHistoryForMonth(year, month);

    // Jours du mois précédent
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startDay - 1; i >= 0; i--) {
        const dayNum = prevMonth.getDate() - i;
        const dayElement = createDayElement(dayNum, 'other-month');
        calendarGrid.appendChild(dayElement);
    }

    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayStr = currentDate.toISOString().split('T')[0];

        let dayClass = '';
        let dayData = null;

        if (currentDate.toDateString() === today.toDateString()) {
            dayClass = 'today';
        } else if (currentDate > today) {
            dayClass = 'future';
        } else {
            dayData = monthHistory.find(entry => entry.date === dayStr);
            if (dayData) {
                const hoursWorked = dayData.durationMs / (1000 * 60 * 60);
                dayClass = hoursWorked >= 7 ? 'full-day' : 'partial-day';
            }
        }

        const dayElement = createDayElement(day, dayClass, dayData);
        calendarGrid.appendChild(dayElement);
    }

    // Compléter la grille
    const totalCells = calendarGrid.children.length;
    const remainingCells = 42 - totalCells;

    for (let day = 1; day <= remainingCells && day <= 14; day++) {
        const dayElement = createDayElement(day, 'other-month');
        calendarGrid.appendChild(dayElement);
    }

    console.log('✅ Calendrier généré avec', calendarGrid.children.length, 'jours');
}

function createDayElement(dayNum, dayClass, dayData = null) {
    const dayElement = document.createElement('div');
    dayElement.className = `calendar-day ${dayClass}`;
    dayElement.textContent = dayNum;

    if (dayData) {
        dayElement.title = `${dayData.duration}\n${dayData.netEarning}€ net\n${dayData.startTime} → ${dayData.endTime}`;
        dayElement.addEventListener('click', () => {
            showDayDetails(dayData);
        });
        dayElement.style.cursor = 'pointer';
    }

    return dayElement;
}

function showDayDetails(dayData) {
    const modal = document.getElementById('day-modal');
    const modalDate = document.getElementById('modal-date');
    const modalDetails = document.getElementById('modal-details');
    const closeButton = document.querySelector('.close-button');

    const date = new Date(dayData.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    modalDate.textContent = `📅 ${date}`;
    modalDetails.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">⏰ Heures :</span>
            <span class="stat-value">${dayData.startTime} → ${dayData.endTime}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">⏱️ Durée :</span>
            <span class="stat-value">${dayData.duration}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">💰 Gains bruts :</span>
            <span class="stat-value">${dayData.grossEarning}€</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">💵 Gains nets :</span>
            <span class="stat-value">${dayData.netEarning}€</span>
        </div>
    `;

    modal.style.display = 'block';

    closeButton.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
}

// ======================
// EXPORT CSV
// ======================

function exportCurrentMonth() {
    const monthHistory = getHistoryForMonth(currentViewMonth.getFullYear(), currentViewMonth.getMonth());
    const monthNames = [
        'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
    ];

    const filename = `timetracker_${monthNames[currentViewMonth.getMonth()]}_${currentViewMonth.getFullYear()}.csv`;
    exportToCSV(monthHistory, filename);
}

function exportAllData() {
    const allHistory = JSON.parse(localStorage.getItem('timetracker_history') || '[]');
    exportToCSV(allHistory, 'timetracker_historique_complet.csv');
}

function exportToCSV(data, filename) {
    if (data.length === 0) {
        alert('Aucune donnée à exporter pour cette période.');
        return;
    }

    const headers = [
        'Date', 'Jour', 'Heure Debut', 'Heure Fin', 'Duree',
        'Taux Brut/h', 'Taux Net/h', 'Gains Brut', 'Gains Net', 'Notes'
    ];

    const csvContent = [
        headers.join(','),
        ...data.map(day => {
            const date = new Date(day.date);
            const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });

            let notes = '';
            if (day.startDateTime && day.endDateTime) {
                const startDate = new Date(day.startDateTime).getDate();
                const endDate = new Date(day.endDateTime).getDate();
                if (startDate !== endDate) {
                    notes = 'Travail de nuit';
                }
            }

            return [
                day.date, dayName, day.startTime, day.endTime, day.duration,
                day.hourlyGross + '€', day.hourlyNet + '€',
                day.grossEarning + '€', day.netEarning + '€', notes
            ].join(',');
        })
    ].join('\n');

    const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(csvBlob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`📤 Export CSV: ${filename} (${data.length} entrées)`);
    alert(`✅ Export réussi !\n📁 Fichier: ${filename}\n📊 ${data.length} journée(s) exportée(s)`);
}

function clearHistory() {
    if (confirm('Êtes-vous sûr de vouloir effacer tout l\'historique ?')) {
        localStorage.removeItem('timetracker_history');
        updateMonthView();
        console.log('🗑️ Historique effacé');
    }
}

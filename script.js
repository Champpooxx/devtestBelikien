// Variables globales
let isWorking = false;
let currentSession = null;
let currentViewMonth = new Date();
let coinInterval = null;
let monthChartInstance = null;

// Configuration par défaut
let config = {
    hourlyGross: 12.50,
    hourlyNet: 10.00,
    weeklyHours: 35,
    dailyHours: 7,
    workStartTime: '08:30',
    workEndTime: '17:00',
    authorizedStartTime: '07:30',
    authorizedEndTime: '18:00',
    theme: 'dark',
    soundsEnabled: true
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
    // La validation est maintenant désactivée, retourne toujours vrai.
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
        setupCollapsibleSections(); // Initialiser les sections pliables

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

function playSound(soundId) {
    if (!config.soundsEnabled) return;
    const sound = document.getElementById(soundId);
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => console.error(`Erreur de lecture du son: ${error}`));
    }
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
    const endX = startX + (Math.random() - 0.5) * 60; // Mouvement horizontal
    const rotation = (Math.random() - 0.5) * 720; // Rotation en degrés
    const duration = 1500 + Math.random() * 1000; // Durée variable

    coin.style.left = `${startX}px`;
    coin.style.setProperty('--end-x', `${endX}px`);
    coin.style.setProperty('--rotation', `${rotation}deg`);
    coin.style.setProperty('--duration', `${duration}ms`);

    coinContainer.appendChild(coin);

    setTimeout(() => {
        coin.remove();
    }, duration);
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

function togglePause() {
    if (!isWorking || !currentSession) return;

    const now = new Date();
    const pauseButton = document.getElementById('pauseButton');
    const statusBar = document.getElementById('statusBar');
    const punchButton = document.getElementById('punchButton');

    currentSession.isPaused = !currentSession.isPaused;

    if (currentSession.isPaused) {
        // --- MISE EN PAUSE ---
        currentSession.pauseStartTime = now.toISOString();
        console.log('⏸️ PAUSE');
        playSound('sound-pause');

        pauseButton.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">Reprendre</span>';
        pauseButton.classList.add('on-pause');

        statusBar.textContent = `⏸️ En pause depuis ${now.toLocaleTimeString('fr-FR')}`;
        statusBar.className = 'status-bar paused';

        punchButton.disabled = true; // Désactiver le pointage sortie pendant la pause
        if (coinInterval) clearInterval(coinInterval);

    } else {
        // --- REPRISE ---
        const pauseStart = new Date(currentSession.pauseStartTime);
        const pauseEnd = now;
        const pauseDurationMs = pauseEnd - pauseStart;

        currentSession.totalPauseMs += pauseDurationMs;
        currentSession.pauses.push({
            start: currentSession.pauseStartTime,
            end: pauseEnd.toISOString(),
            duration: pauseDurationMs
        });
        currentSession.pauseStartTime = null;
        console.log('▶️ REPRISE');

        pauseButton.innerHTML = '<span class="btn-icon">||</span><span class="btn-text">Pause</span>';
        pauseButton.classList.remove('on-pause');

        statusBar.textContent = `✅ Au travail depuis ${new Date(currentSession.startTime).toLocaleTimeString('fr-FR')}`;
        statusBar.className = 'status-bar working';

        punchButton.disabled = false; // Réactiver le pointage sortie
        coinInterval = setInterval(createCoin, 3000);
    }

    saveCurrentSession();
    updateDisplay();
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
        sessionHourlyNet: config.hourlyNet,
        isPaused: false,
        pauseStartTime: null,
        totalPauseMs: 0,
        pauses: []
    };

    isWorking = true;
    playSound('sound-punch-in');

    const button = document.getElementById('punchButton');
    const statusBar = document.getElementById('statusBar');
    const pauseButton = document.getElementById('pauseButton');

    if (button) {
        button.innerHTML = '<span class="btn-icon">■</span><span class="btn-text">Pointer Sortie</span>';
        button.className = 'punch-button punch-out';
    }
    if (pauseButton) {
        pauseButton.disabled = false;
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

    // Si en pause, terminer la pause avant de dépointer
    if (currentSession.isPaused) {
        const pauseStart = new Date(currentSession.pauseStartTime);
        const pauseEnd = now;
        const pauseDurationMs = pauseEnd - pauseStart;
        currentSession.totalPauseMs += pauseDurationMs;
        currentSession.pauses.push({
            start: currentSession.pauseStartTime,
            end: pauseEnd.toISOString(),
            duration: pauseDurationMs
        });
    }

    const startTime = new Date(currentSession.startTime);
    const endTime = new Date(currentSession.endTime);
    const totalDurationMs = endTime - startTime;
    const workedDurationMs = totalDurationMs - currentSession.totalPauseMs;
    const durationHours = workedDurationMs / (1000 * 60 * 60);

    const grossEarning = durationHours * currentSession.sessionHourlyGross;
    const netEarning = durationHours * currentSession.sessionHourlyNet;

    const workDay = {
        date: currentSession.workDate,
        startTime: startTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}),
        endTime: endTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}),
        startDateTime: currentSession.startTime,
        endDateTime: currentSession.endTime,
        duration: formatDuration(workedDurationMs),
        durationMs: workedDurationMs,
        totalPauseMs: currentSession.totalPauseMs,
        pauses: currentSession.pauses,
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

    const pauseButton = document.getElementById('pauseButton');
    if (button) {
        button.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">Pointer Entrée</span>';
        button.className = 'punch-button punch-in';
    }
    if (pauseButton) {
        pauseButton.innerHTML = '<span class="btn-icon">||</span><span class="btn-text">Pause</span>';
        pauseButton.disabled = true;
        pauseButton.classList.remove('on-pause');
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
    playSound('sound-punch-out');
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
    let currentPauseMs = 0;

    if (currentSession.isPaused && currentSession.pauseStartTime) {
        currentPauseMs = now - new Date(currentSession.pauseStartTime);
    }

    const workedMs = (now - startTime) - (currentSession.totalPauseMs + currentPauseMs);
    const durationHours = workedMs / (1000 * 60 * 60);

    const grossEarning = durationHours * currentSession.sessionHourlyGross;
    const netEarning = durationHours * currentSession.sessionHourlyNet;

    workedTimeEl.textContent = formatDuration(workedMs);
    grossEarningsEl.textContent = grossEarning.toFixed(2) + '€';
    netEarningsEl.textContent = netEarning.toFixed(2) + '€';

    updateProjection();
    updateProgressBar(workedMs);
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

function updateProgressBar(workedMs) {
    const progressBar = document.getElementById('dailyProgressBar');
    const progressPercentEl = document.getElementById('progressPercent');
    const progressTimeEl = document.getElementById('progressTimeRemaining');

    if (!progressBar || !progressPercentEl || !progressTimeEl) return;

    if (!isWorking || !currentSession) {
        progressBar.style.width = '0%';
        progressPercentEl.textContent = '0%';
        progressTimeEl.textContent = `Objectif : ${config.dailyHours}h`;
        progressBar.className = 'progress-bar';
        return;
    }

    const dailyGoalMs = config.dailyHours * 60 * 60 * 1000;
    const percent = Math.min((workedMs / dailyGoalMs) * 100, 100);

    progressBar.style.width = `${percent}%`;
    progressPercentEl.textContent = `${Math.floor(percent)}%`;

    progressBar.classList.remove('approaching', 'overtime');
    if (percent >= 100) {
        const overtimeMs = workedMs - dailyGoalMs;
        progressTimeEl.textContent = `Objectif atteint ! (+${formatDuration(overtimeMs)})`;
        progressBar.classList.add('overtime');
    } else if (percent >= 80) {
        const remainingMs = dailyGoalMs - workedMs;
        progressTimeEl.textContent = `Restant : ${formatDuration(remainingMs)}`;
        progressBar.classList.add('approaching');
    } else {
        const remainingMs = dailyGoalMs - workedMs;
        progressTimeEl.textContent = `Restant : ${formatDuration(remainingMs)}`;
    }
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
    config.theme = document.querySelector('input[name="theme"]:checked').value || 'dark';
    config.soundsEnabled = document.getElementById('soundsEnabled').checked;


    const endTargetEl = document.getElementById('endTimeTarget');
    if (endTargetEl) {
        endTargetEl.value = config.workEndTime;
    }

    localStorage.setItem('timetracker_config', JSON.stringify(config));
    applyTheme();
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

        // Appliquer le thème
        const themeRadio = document.querySelector(`input[name="theme"][value="${config.theme || 'dark'}"]`);
        if (themeRadio) {
            themeRadio.checked = true;
        }
        applyTheme();

        // Appliquer le son
        const soundsCheckbox = document.getElementById('soundsEnabled');
        if (soundsCheckbox) {
            soundsCheckbox.checked = config.soundsEnabled;
        }
    }

    // Attacher les écouteurs d'événements pour le thème
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', saveConfig);
    });
}

function applyTheme() {
    let themeToApply = config.theme;
    if (themeToApply === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        themeToApply = prefersDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', themeToApply);
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

            const pauseButton = document.getElementById('pauseButton');

            if (button) {
                button.innerHTML = '<span class="btn-icon">■</span><span class="btn-text">Pointer Sortie</span>';
                button.className = 'punch-button punch-out';
                pauseButton.disabled = false;
            }

            const startTime = new Date(currentSession.startTime);
            const todayStr = new Date().toISOString().split('T')[0];
            const workDateInfo = currentSession.workDate !== todayStr ? ` (pour le ${currentSession.workDate})` : '';

            if (currentSession.isPaused) {
                const pauseTime = new Date(currentSession.pauseStartTime);
                statusBar.textContent = `⏸️ En pause depuis ${pauseTime.toLocaleTimeString('fr-FR')}`;
                statusBar.className = 'status-bar paused';
                pauseButton.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">Reprendre</span>';
                pauseButton.classList.add('on-pause');
                button.disabled = true;
                if (coinInterval) clearInterval(coinInterval);
            } else {
                statusBar.textContent = `✅ Au travail depuis ${startTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}${workDateInfo}`;
                statusBar.className = 'status-bar working';
                pauseButton.innerHTML = '<span class="btn-icon">||</span><span class="btn-text">Pause</span>';
                pauseButton.classList.remove('on-pause');
                if (coinInterval) clearInterval(coinInterval);
                coinInterval = setInterval(createCoin, 3000);
            }
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
    generateMonthChart(monthHistory);
}

function generateMonthChart(monthData) {
    const ctx = document.getElementById('monthChart');
    if (!ctx) return;

    if (monthChartInstance) {
        monthChartInstance.destroy();
    }

    const labels = monthData.map(d => new Date(d.date).getDate()).reverse();
    const data = monthData.map(d => d.durationMs / (1000 * 60 * 60)).reverse();
    const dailyGoal = config.dailyHours || 7;

    const goalLinePlugin = {
        id: 'goalLine',
        afterDatasetsDraw: (chart) => {
            const { ctx, scales: { y } } = chart;
            const yValue = y.getPixelForValue(dailyGoal);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(chart.chartArea.left, yValue);
            ctx.lineTo(chart.chartArea.right, yValue);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)';
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = 'rgba(255, 193, 7, 0.8)';
            ctx.font = '12px Segoe UI';
            ctx.textAlign = 'right';
            ctx.fillText(`Objectif: ${dailyGoal}h`, chart.chartArea.right, yValue - 5);
            ctx.restore();
        }
    };

    monthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Heures travaillées',
                data: data,
                fill: true,
                backgroundColor: 'rgba(138, 99, 210, 0.2)',
                borderColor: 'rgba(138, 99, 210, 1)',
                pointBackgroundColor: 'rgba(255, 255, 255, 1)',
                pointBorderColor: 'rgba(138, 99, 210, 1)',
                pointHoverRadius: 6,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: dailyGoal + 2,
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + 'h';
                            }
                            return label;
                        }
                    }
                }
            }
        },
        plugins: [goalLinePlugin]
    });
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
        dayElement.title = `${dayData.duration}\n${dayData.netEarning}€ net\n${dayData.startTime} → ${dayData.endTime}\n(clic pour détails, ✏️ pour éditer)`;
        dayElement.addEventListener('click', () => {
            showDayDetails(dayData);
        });
        dayElement.style.cursor = 'pointer';

        const editButton = document.createElement('button');
        editButton.className = 'edit-icon-btn';
        editButton.innerHTML = '✏️';
        editButton.title = 'Modifier cette journée';
        editButton.onclick = (e) => {
            e.stopPropagation(); // Empêche l'ouverture de la modale de détails
            openEditModal(dayData);
        };
        dayElement.appendChild(editButton);
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
        ${dayData.totalPauseMs > 0 ? `
        <div class="stat-item">
            <span class="stat-label">⏸️ Temps de pause :</span>
            <span class="stat-value">${formatDuration(dayData.totalPauseMs)}</span>
        </div>
        ` : ''}
        <div class="stat-item">
            <span class="stat-label">💰 Gains bruts :</span>
            <span class="stat-value">${dayData.grossEarning}€</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">💵 Gains nets :</span>
            <span class="stat-value">${dayData.netEarning}€</span>
        </div>
    `;

    if (dayData.modifications && dayData.modifications.length > 0) {
        let modificationsHtml = `
            <div class="modifications-history">
                <h4>Historique des modifications</h4>
        `;
        dayData.modifications.forEach(mod => {
            const modDate = new Date(mod.timestamp).toLocaleString('fr-FR');
            let changesStr = mod.changes.map(c => `<li>${c.field}: ${c.oldValue} → ${c.newValue}</li>`).join('');
            modificationsHtml += `
                <div class="modification-item">
                    <p><strong>Le ${modDate}</strong></p>
                    <p><em>Motif : ${mod.reason}</em></p>
                    <ul>${changesStr}</ul>
                </div>
            `;
        });
        modificationsHtml += '</div>';
        modalDetails.innerHTML += modificationsHtml;
    }

    const editButton = document.createElement('button');
    editButton.textContent = '✏️ Modifier cette journée';
    editButton.className = 'btn-small edit-day-btn';
    editButton.onclick = () => {
        modal.style.display = 'none'; // Fermer la modale de détails
        openEditModal(dayData);
    };

    modalDetails.appendChild(document.createElement('br'));
    modalDetails.appendChild(editButton);

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
// SECTIONS PLIABLES
// ======================

function setupCollapsibleSections() {
    const collapsibles = document.querySelectorAll('.collapsible');
    const openSections = JSON.parse(localStorage.getItem('timetracker_open_sections')) || [];

    collapsibles.forEach((card, index) => {
        const header = card.querySelector('.card-header');
        card.setAttribute('data-index', index); // ID pour le stockage

        // Restaurer l'état
        if (openSections.includes(index)) {
            card.classList.add('is-open');
        }

        header.addEventListener('click', () => {
            const isOpen = card.classList.toggle('is-open');
            const currentlyOpen = JSON.parse(localStorage.getItem('timetracker_open_sections')) || [];

            if (isOpen) {
                if (!currentlyOpen.includes(index)) {
                    currentlyOpen.push(index);
                }
            } else {
                const idx = currentlyOpen.indexOf(index);
                if (idx > -1) {
                    currentlyOpen.splice(idx, 1);
                }
            }
            localStorage.setItem('timetracker_open_sections', JSON.stringify(currentlyOpen));
        });
    });
}

// ======================
// MODALE D'ÉDITION
// ======================

function openEditModal(dayData) {
    const modal = document.getElementById('edit-modal');
    document.getElementById('edit-date-original').value = dayData.date;
    document.getElementById('edit-date').value = dayData.date;
    document.getElementById('edit-startTime').value = dayData.startTime;
    document.getElementById('edit-endTime').value = dayData.endTime;
    document.getElementById('edit-reason').value = '';
    document.getElementById('edit-validation-error').style.display = 'none';

    const pausesContainer = document.getElementById('edit-pauses-container');
    pausesContainer.innerHTML = ''; // Vider les anciennes pauses

    if (dayData.pauses && dayData.pauses.length > 0) {
        dayData.pauses.forEach(pause => {
            addPauseElement(pause);
        });
    }

    modal.style.display = 'block';

    // Attacher les écouteurs
    document.getElementById('edit-modal-close').onclick = () => modal.style.display = 'none';
    document.getElementById('cancel-edit-button').onclick = () => modal.style.display = 'none';
    document.getElementById('add-pause-button').onclick = () => addPauseElement();
    document.getElementById('save-edit-button').onclick = saveEditedSession;
}

function addPauseElement(pause = null) {
    const pausesContainer = document.getElementById('edit-pauses-container');
    const pauseElement = document.createElement('div');
    pauseElement.className = 'edit-pause-item';

    const startTime = pause ? new Date(pause.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const endTime = pause ? new Date(pause.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

    pauseElement.innerHTML = `
        <input type="time" class="edit-pause-start" value="${startTime}">
        <input type="time" class="edit-pause-end" value="${endTime}">
        <button class="remove-pause-btn">X</button>
    `;

    pausesContainer.appendChild(pauseElement);

    pauseElement.querySelector('.remove-pause-btn').onclick = () => {
        pauseElement.remove();
    };
}

function saveEditedSession() {
    const originalDate = document.getElementById('edit-date-original').value;
    const newDate = document.getElementById('edit-date').value;
    const startTimeStr = document.getElementById('edit-startTime').value;
    const endTimeStr = document.getElementById('edit-endTime').value;
    const reason = document.getElementById('edit-reason').value.trim();
    const errorContainer = document.getElementById('edit-validation-error');

    // --- 1. Validation ---
    if (!reason) {
        errorContainer.textContent = 'Le motif de la modification est obligatoire.';
        errorContainer.style.display = 'block';
        return;
    }

    const startDateTime = new Date(`${newDate}T${startTimeStr}`);
    const endDateTime = new Date(`${newDate}T${endTimeStr}`);

    if (endDateTime <= startDateTime) {
        errorContainer.textContent = 'L\'heure de fin doit être après l\'heure de début.';
        errorContainer.style.display = 'block';
        return;
    }

    let history = JSON.parse(localStorage.getItem('timetracker_history') || '[]');
    const originalSessionIndex = history.findIndex(day => day.date === originalDate);
    if (originalSessionIndex === -1) {
        errorContainer.textContent = 'Erreur: session originale introuvable.';
        errorContainer.style.display = 'block';
        return;
    }
    const originalSession = history[originalSessionIndex];

    // Vérifier les chevauchements si la date change
    if (newDate !== originalDate && history.some(day => day.date === newDate)) {
        errorContainer.textContent = `Une session existe déjà pour le ${newDate}.`;
        errorContainer.style.display = 'block';
        return;
    }

    // --- 2. Recalcul des pauses ---
    const pauseElements = document.querySelectorAll('.edit-pause-item');
    let totalPauseMs = 0;
    let newPauses = [];
    for (const el of pauseElements) {
        const pauseStartStr = el.querySelector('.edit-pause-start').value;
        const pauseEndStr = el.querySelector('.edit-pause-end').value;
        if (!pauseStartStr || !pauseEndStr) continue;

        const pauseStart = new Date(`${newDate}T${pauseStartStr}`);
        const pauseEnd = new Date(`${newDate}T${pauseEndStr}`);

        if (pauseEnd <= pauseStart) {
            errorContainer.textContent = 'La fin d\'une pause doit être après son début.';
            errorContainer.style.display = 'block';
            return;
        }
        if (pauseStart < startDateTime || pauseEnd > endDateTime) {
            errorContainer.textContent = 'Les pauses doivent être comprises dans la plage de travail.';
            errorContainer.style.display = 'block';
            return;
        }
        const pauseDuration = pauseEnd - pauseStart;
        totalPauseMs += pauseDuration;
        newPauses.push({ start: pauseStart.toISOString(), end: pauseEnd.toISOString(), duration: pauseDuration });
    }

    // --- 3. Recalcul de la session ---
    const totalDurationMs = endDateTime - startDateTime;
    const workedDurationMs = totalDurationMs - totalPauseMs;
    const durationHours = workedDurationMs / (1000 * 60 * 60);
    const grossEarning = durationHours * originalSession.hourlyGross;
    const netEarning = durationHours * originalSession.hourlyNet;

    // --- 4. Historique des modifications ---
    if (!originalSession.modifications) {
        originalSession.modifications = [];
    }
    const timestamp = new Date().toISOString();
    const changes = [];
    if (originalSession.date !== newDate) changes.push({ field: 'date', oldValue: originalSession.date, newValue: newDate });
    if (originalSession.startTime !== startTimeStr) changes.push({ field: 'startTime', oldValue: originalSession.startTime, newValue: startTimeStr });
    if (originalSession.endTime !== endTimeStr) changes.push({ field: 'endTime', oldValue: originalSession.endTime, newValue: endTimeStr });
    // On pourrait ajouter une comparaison détaillée des pauses
    if (originalSession.totalPauseMs !== totalPauseMs) changes.push({ field: 'pauses', oldValue: formatDuration(originalSession.totalPauseMs), newValue: formatDuration(totalPauseMs) });

    if(changes.length > 0) {
         originalSession.modifications.push({
            timestamp,
            reason,
            changes
        });
    }

    // --- 5. Mise à jour de la session ---
    const updatedSession = {
        ...originalSession,
        date: newDate,
        startTime: startTimeStr,
        endTime: endTimeStr,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        duration: formatDuration(workedDurationMs),
        durationMs: workedDurationMs,
        totalPauseMs: totalPauseMs,
        pauses: newPauses,
        grossEarning: grossEarning.toFixed(2),
        netEarning: netEarning.toFixed(2),
    };

    // --- 6. Sauvegarde ---
    history[originalSessionIndex] = updatedSession;
    localStorage.setItem('timetracker_history', JSON.stringify(history));

    // --- 7. Finalisation ---
    document.getElementById('edit-modal').style.display = 'none';
    updateMonthView();
    alert('✅ Session modifiée avec succès !');
    console.log("📝 Session modifiée : ", { original: originalSession, updated: updatedSession });
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

    const formatCsvRow = (items) => {
        return items.map(item => `"${String(item || '').replace(/"/g, '""')}"`).join(';');
    };

    let csvRows = [];

    const reportTitle = filename.includes('complet') ? 'Export Complet' : `Mois de ${currentViewMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
    const totalDays = data.length;
    const totalMs = data.reduce((sum, day) => sum + (day.durationMs || 0), 0);
    const totalNetEarnings = data.reduce((sum, day) => sum + parseFloat(day.netEarning || 0), 0);
    const totalGrossEarnings = data.reduce((sum, day) => sum + parseFloat(day.grossEarning || 0), 0);
    const totalPauseMs = data.reduce((sum, day) => sum + (day.totalPauseMs || 0), 0);

    csvRows.push(formatCsvRow(['Rapport TimeTracker', reportTitle]));
    csvRows.push(formatCsvRow(['Exporté le', new Date().toLocaleString('fr-FR')]));
    csvRows.push('');

    csvRows.push(formatCsvRow(['Résumé de la période']));
    csvRows.push(formatCsvRow(['Jours travaillés', totalDays]));
    csvRows.push(formatCsvRow(['Durée totale de travail', formatDuration(totalMs)]));
    csvRows.push(formatCsvRow(['Durée totale de pause', formatDuration(totalPauseMs)]));
    csvRows.push(formatCsvRow(['Gains bruts totaux', `${totalGrossEarnings.toFixed(2)}€`]));
    csvRows.push(formatCsvRow(['Gains nets totaux', `${totalNetEarnings.toFixed(2)}€`]));
    csvRows.push('');

    csvRows.push(formatCsvRow(['Détail des journées']));
    const headers = [
        'Date', 'Jour', 'Heure Début', 'Heure Fin', 'Durée Travail', 'Durée Pause',
        'Gains Nets (€)', 'Taux Net (€/h)', 'Gains Bruts (€)', 'Taux Brut (€/h)', 'Détail Pauses', 'Notes', 'Historique Modifications'
    ];
    csvRows.push(formatCsvRow(headers));

    data.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(day => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });

        let notes = '';
        if (day.startDateTime && day.endDateTime) {
            const startDate = new Date(day.startDateTime);
            const endDate = new Date(day.endDateTime);
            if (startDate.toISOString().split('T')[0] !== endDate.toISOString().split('T')[0]) {
                notes = 'Travail de nuit';
            }
        }

        const pauseDetails = (day.pauses || [])
            .map(p => {
                const start = new Date(p.start).toLocaleTimeString('fr-FR');
                const end = new Date(p.end).toLocaleTimeString('fr-FR');
                return `${start}-${end} (${formatDuration(p.duration)})`;
            })
            .join(', ');

        const modificationDetails = (day.modifications || [])
            .map(mod => {
                const modDate = new Date(mod.timestamp).toLocaleString('fr-FR');
                const changesStr = mod.changes.map(c => `${c.field}: ${c.oldValue} -> ${c.newValue}`).join(', ');
                return `[${modDate}] Motif: ${mod.reason} | Changements: ${changesStr}`;
            })
            .join('; ');

        const row = [
            day.date,
            dayName,
            day.startTime,
            day.endTime,
            day.duration,
            formatDuration(day.totalPauseMs || 0),
            day.netEarning,
            day.hourlyNet,
            day.grossEarning,
            day.hourlyGross,
            pauseDetails,
            notes,
            modificationDetails
        ];
        csvRows.push(formatCsvRow(row));
    });

    const csvContent = csvRows.join('\n');
    const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(csvBlob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`📤 Export CSV amélioré: ${filename} (${data.length} entrées)`);
    alert(`✅ Export réussi !\n📁 Fichier: ${filename}\n📊 ${data.length} journée(s) exportée(s) dans un format amélioré.`);
}

function clearHistory() {
    if (confirm('Êtes-vous sûr de vouloir effacer tout l\'historique ?')) {
        localStorage.removeItem('timetracker_history');
        updateMonthView();
        console.log('🗑️ Historique effacé');
    }
}

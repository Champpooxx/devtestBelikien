// ==================================
// SYSTÈME DE SAUVEGARDE AUTOMATIQUE
// ==================================

/**
 * Lit une valeur depuis localStorage de manière sécurisée.
 * @param {string} key La clé à récupérer.
 * @returns {any | null} La valeur parsée ou null en cas d'erreur.
 */
function safeGetFromStorage(key) {
    try {
        const item = localStorage.getItem(key);
        if (item === null || item === "undefined") {
            return null;
        }
        return JSON.parse(item);
    } catch (error) {
        console.error(`Erreur en lisant "${key}" depuis localStorage:`, error);
        return null;
    }
}

/**
 * Sauvegarde automatiquement les données critiques dans une clé de backup.
 * La sauvegarde est horodatée pour permettre une restauration précise.
 */
function autoBackup() {
    console.log('🔄 Lancement du backup automatique...');
    try {
        const dataToBackup = {
            history: safeGetFromStorage('timetracker_history'),
            config: safeGetFromStorage('timetracker_config'),
            // Ne pas sauvegarder la session en cours car elle est transitoire
        };

        if (!dataToBackup.history && !dataToBackup.config) {
            console.warn('⚠️ Backup annulé : aucune donnée à sauvegarder.');
            return;
        }

        const backupData = {
            timestamp: new Date().toISOString(),
            data: dataToBackup
        };

        localStorage.setItem('timetracker_autobackup', JSON.stringify(backupData));
        console.log(`✅ Backup automatique réussi à ${new Date(backupData.timestamp).toLocaleTimeString()}`);
    } catch (error) {
        console.error('❌ Échec du backup automatique:', error);
    }
}


/**
 * Exporte toutes les données de l'application dans un fichier JSON téléchargeable.
 * Le nom du fichier contient la date et l'heure de l'export.
 */
function exportToJSON() {
    console.log('📤 Préparation de l\'export JSON...');
    try {
        const dataToExport = {
            timetracker_history: safeGetFromStorage('timetracker_history') || [],
            timetracker_config: safeGetFromStorage('timetracker_config') || {},
            // On ajoute également le dernier auto-backup pour plus de sécurité
            timetracker_autobackup: safeGetFromStorage('timetracker_autobackup') || {}
        };

        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        a.download = `timetracker_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('✅ Export JSON terminé avec succès.');
        alert('✅ Export JSON des données terminé !');
    } catch (error) {
        console.error('❌ Échec de l\'export JSON:', error);
        alert('❌ Une erreur est survenue lors de l\'export des données.');
    }
}


/**
 * Restaure les données depuis la dernière sauvegarde automatique.
 * Demande une confirmation à l'utilisateur avant d'écraser les données actuelles.
 */
function restoreFromBackup() {
    const backupData = safeGetFromStorage('timetracker_autobackup');

    if (!backupData || !backupData.timestamp) {
        alert('Aucune sauvegarde automatique trouvée.');
        return;
    }

    const backupDate = new Date(backupData.timestamp).toLocaleString('fr-FR');
    const confirmation = confirm(
        `Voulez-vous vraiment restaurer les données à partir de la sauvegarde du ${backupDate} ?\n\n` +
        `⚠️ ATTENTION : Cela écrasera toutes les données actuelles (historique et configuration).`
    );

    if (confirmation) {
        try {
            console.log('🔄 Restauration depuis le backup...');

            const { history, config } = backupData.data;

            if (history) {
                localStorage.setItem('timetracker_history', JSON.stringify(history));
            }
            if (config) {
                localStorage.setItem('timetracker_config', JSON.stringify(config));
            }

            // Forcer un rechargement de la page pour appliquer les changements
            alert('✅ Restauration terminée avec succès. L\'application va maintenant se recharger.');
            window.location.reload();

        } catch (error) {
            console.error('❌ Échec de la restauration:', error);
            alert('❌ Une erreur est survenue lors de la restauration des données.');
        }
    } else {
        console.log('ℹ️ Restauration annulée par l\'utilisateur.');
    }
}

/**
 * Déclenche l'export JSON quotidien si nécessaire.
 * Vérifie si le dernier export date de plus de 24 heures.
 */
function triggerDailyExport() {
    const now = new Date();
    const lastExportDate = safeGetFromStorage('timetracker_last_export_date');

    if (lastExportDate) {
        const lastDate = new Date(lastExportDate);
        const hoursSinceLastExport = (now - lastDate) / (1000 * 60 * 60);
        if (hoursSinceLastExport < 24) {
            return; // Pas encore l'heure
        }
    }

    console.log('🕰️ Déclenchement de l\'export JSON quotidien automatique...');
    exportToJSON();
    localStorage.setItem('timetracker_last_export_date', JSON.stringify(now.toISOString()));
}

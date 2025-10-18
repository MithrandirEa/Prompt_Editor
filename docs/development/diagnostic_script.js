/**
 * @fileoverview Manual Diagnostic Script for Prompt Editor v2.0
 * @description Script to run in browser console to test all functionalities
 * @version 2.0.0
 */

console.log('🔍 DIAGNOSTIC PROMPT EDITOR v2.0 - DÉBUT');
console.log('=========================================');

// Test 1: Vérifier que l'app est chargée
console.log('📱 1. VÉRIFICATION APPLICATION');
if (window.app) {
    console.log('✅ App instance trouvée:', window.app);
    console.log('   - Version:', window.app.version);
    console.log('   - État initialisé:', window.app.state.isInitialized);
    console.log('   - État prêt:', window.app.state.isReady);
} else {
    console.error('❌ App instance non trouvée');
}

// Test 2: Vérifier les modules
console.log('\n🧩 2. VÉRIFICATION MODULES');
const modules = ['logger', 'state'];
modules.forEach(module => {
    if (window[module]) {
        console.log(`✅ Module ${module} disponible`);
    } else {
        console.error(`❌ Module ${module} manquant`);
    }
});

// Test 3: Vérifier les éléments DOM critiques
console.log('\n🎯 3. VÉRIFICATION ÉLÉMENTS DOM');
const criticalElements = [
    'toggle-sidebar',
    'theme-toggle', 
    'editor-tab',
    'manager-tab',
    'save-template',
    'new-template-btn',
    'global-search',
    'nav-back-btn',
    'nav-forward-btn',
    'new-folder-btn'
];

criticalElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ Élément #${id} trouvé`);
    } else {
        console.error(`❌ Élément #${id} manquant`);
    }
});

// Test 4: Vérifier les event listeners
console.log('\n⚡ 4. TEST EVENT LISTENERS');

function testButton(id, description) {
    const element = document.getElementById(id);
    if (element) {
        const hasListeners = element.onclick || element.addEventListener;
        console.log(`${hasListeners ? '✅' : '❌'} ${description} (${id})`);
        return hasListeners;
    } else {
        console.error(`❌ ${description} - Élément manquant (${id})`);
        return false;
    }
}

testButton('toggle-sidebar', 'Basculement sidebar');
testButton('theme-toggle', 'Basculement thème');
testButton('editor-tab', 'Onglet éditeur');
testButton('manager-tab', 'Onglet gestionnaire');
testButton('save-template', 'Sauvegarde template');
testButton('new-folder-btn', 'Nouveau dossier');

// Test 5: Tester les API endpoints
console.log('\n🌐 5. TEST API ENDPOINTS');

async function testAPI() {
    try {
        // Test GET templates
        const templatesResponse = await fetch('/api/templates');
        console.log(`${templatesResponse.ok ? '✅' : '❌'} GET /api/templates - Status: ${templatesResponse.status}`);
        
        // Test GET folders
        const foldersResponse = await fetch('/api/folders');
        console.log(`${foldersResponse.ok ? '✅' : '❌'} GET /api/folders - Status: ${foldersResponse.status}`);
        
        if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json();
            console.log(`   📊 Templates trouvés: ${templatesData.data ? templatesData.data.length : 0}`);
        }
        
        if (foldersResponse.ok) {
            const foldersData = await foldersResponse.json();
            console.log(`   📁 Dossiers trouvés: ${foldersData.data ? foldersData.data.length : 0}`);
        }
        
    } catch (error) {
        console.error('❌ Erreur API:', error);
    }
}

testAPI();

// Test 6: Vérifier le thème
console.log('\n🎨 6. VÉRIFICATION THÈME');
const isDark = document.documentElement.classList.contains('dark');
console.log(`📱 Mode actuel: ${isDark ? 'Sombre' : 'Clair'}`);
const themeInStorage = localStorage.getItem('theme');
console.log(`💾 Thème en localStorage: ${themeInStorage || 'Non défini'}`);

// Test 7: Test des fonctionnalités critiques
console.log('\n🧪 7. TEST FONCTIONNALITÉS CRITIQUES');

// Test sidebar toggle
function testSidebarToggle() {
    const sidebar = document.getElementById('templates-sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    
    if (sidebar && toggleBtn) {
        console.log('🔄 Test du toggle sidebar...');
        const initialDisplay = getComputedStyle(sidebar).display;
        toggleBtn.click();
        setTimeout(() => {
            const newDisplay = getComputedStyle(sidebar).display;
            console.log(`${initialDisplay !== newDisplay ? '✅' : '❌'} Sidebar toggle fonctionne`);
        }, 100);
    }
}

// Test theme toggle
function testThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        console.log('🔄 Test du toggle thème...');
        const initialTheme = document.documentElement.classList.contains('dark');
        themeBtn.click();
        setTimeout(() => {
            const newTheme = document.documentElement.classList.contains('dark');
            console.log(`${initialTheme !== newTheme ? '✅' : '❌'} Theme toggle fonctionne`);
        }, 100);
    }
}

// Test tab switching
function testTabSwitching() {
    const editorTab = document.getElementById('editor-tab');
    const managerTab = document.getElementById('manager-tab');
    const editorContent = document.getElementById('editor-content');
    const managerContent = document.getElementById('manager-content');
    
    if (editorTab && managerTab && editorContent && managerContent) {
        console.log('🔄 Test du changement d\'onglets...');
        
        // Switch to manager tab
        managerTab.click();
        setTimeout(() => {
            const managerVisible = !managerContent.classList.contains('hidden');
            const editorHidden = editorContent.classList.contains('hidden');
            console.log(`${managerVisible && editorHidden ? '✅' : '❌'} Switch vers Manager fonctionne`);
            
            // Switch back to editor
            editorTab.click();
            setTimeout(() => {
                const editorVisible = !editorContent.classList.contains('hidden');
                const managerHidden = managerContent.classList.contains('hidden');
                console.log(`${editorVisible && managerHidden ? '✅' : '❌'} Switch vers Editor fonctionne`);
            }, 100);
        }, 100);
    }
}

// Exécuter les tests
setTimeout(() => {
    testSidebarToggle();
    testThemeToggle();
    testTabSwitching();
}, 1000);

// Test 8: Vérifier la structure des données
console.log('\n📊 8. VÉRIFICATION STRUCTURE DONNÉES');
if (window.app && window.app.modules) {
    console.log('✅ Modules app disponibles:', Array.from(window.app.modules.keys()));
} else {
    console.warn('❌ Modules app non accessibles');
}

// Test 9: Vérifier les erreurs dans la console
console.log('\n🐛 9. VÉRIFICATION ERREURS CONSOLE');
console.log('   (Vérifiez manuellement les erreurs rouges dans la console)');

// Résumé final
setTimeout(() => {
    console.log('\n🎯 RÉSUMÉ DIAGNOSTIC');
    console.log('==================');
    console.log('✅ = Fonctionnel');
    console.log('❌ = Problème détecté');
    console.log('⚠️ = À vérifier manuellement');
    console.log('\n📋 Actions recommandées:');
    console.log('1. Corriger tous les éléments marqués ❌');
    console.log('2. Tester manuellement chaque fonctionnalité');
    console.log('3. Vérifier la console pour des erreurs');
    console.log('4. Tester sur différents navigateurs');
    console.log('\n🔍 DIAGNOSTIC PROMPT EDITOR v2.0 - FIN');
}, 3000);
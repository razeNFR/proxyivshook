// ==UserScript==
// @name         Twitch HLS Proxy v1.2.3
// @namespace    twitch-proxy-ivs
// @version      1.2.3
// @author       razeNFR
// @description  Twitch HLS via plusieurs proxys - Dashboard + fallback automatique + résultats persistants + proxys personnalisés
// @match        https://www.twitch.tv/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/razeNFR/proxyivshook/main/proxyivshook.user.js
// @downloadURL  https://raw.githubusercontent.com/razeNFR/proxyivshook/main/proxyivshook.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================

    var STORAGE_KEY = 'twitchProxyManagerV1';
    var CHANNEL_CACHE_KEY = 'twitchProxyLastChannelV1';

    var DEFAULT_TIMEOUT = 2000;
    var DEFAULT_CACHE_DELAY = 5;

    var DEFAULT_PROXIES = [
        {
            id: 'luminous-eu',
            name: 'Luminous EU',
            url: 'https://eu.luminous.dev/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'luminous-eu2',
            name: 'Luminous EU 2',
            url: 'https://eu2.luminous.dev/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
		{
            id: 'luminous-eu3',
            name: 'Luminous EU 3',
            url: 'https://eu3.luminous.dev/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
		{
            id: 'luminous-as',
            name: 'Luminous AS',
            url: 'https://as.luminous.dev/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-eu5',
            name: 'Perfprod EU 5',
            url: 'https://lb-eu5.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'Nadeko',
            name: 'Nadeko',
            url: 'https://twitch-al.nadeko.net/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-eu',
            name: 'Perfprod EU',
            url: 'https://lb-eu.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-eu2',
            name: 'Perfprod EU 2',
            url: 'https://lb-eu2.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-eu3',
            name: 'Perfprod EU 3',
            url: 'https://lb-eu3.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-eu4',
            name: 'Perfprod EU 4',
            url: 'https://lb-eu4.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-na',
            name: 'Perfprod NA',
            url: 'https://lb-na.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-as',
            name: 'Perfprod Asia',
            url: 'https://lb-as.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        },
        {
            id: 'perfprod-sa',
            name: 'Perfprod SA',
            url: 'https://lb-sa.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: true
        }
    ];

    console.log('[TwitchProxy] ===== SCRIPT START =====');

    var NativeWorker = window.Worker;

    if (!NativeWorker) {
        console.error('[TwitchProxy] ERREUR: Worker introuvable');
        return;
    }

    console.log('[TwitchProxy] Native Worker trouvé');


    // ============================================================
    // CONFIGURATION
    // ============================================================

    function createDefaultProxy(p) {

        return {
            id: p.id,
            name: p.name,
            url: p.url,
            enabled: p.enabled
        };

    }


    function generateCustomProxyId() {

        return (
            'custom-' +
            Date.now().toString(36) +
            '-' +
            Math.random()
                .toString(36)
                .substring(2, 9)
        );

    }


    function isDefaultProxy(id) {

        return DEFAULT_PROXIES.some(function (p) {
            return p.id === id;
        });

    }


    // Construit un objet config valide (proxys fusionnés avec les
    // défauts, champs validés) à partir d'un objet arbitraire —
    // utilisé à la fois pour charger depuis localStorage et pour
    // l'import d'un fichier JSON exporté.
    function buildConfigFromParsed(parsed) {

        var config = {
            proxies: DEFAULT_PROXIES.map(
                createDefaultProxy
            ),
            fallback: true,
            timeout: DEFAULT_TIMEOUT,
            cacheDelay: DEFAULT_CACHE_DELAY,
            keepQualityInBackground: false
        };

        if (!parsed || typeof parsed !== 'object') {
            return config;
        }

        if (
            Array.isArray(parsed.proxies)
        ) {

            var ordered = [];

            parsed.proxies.forEach(
                function (savedProxy) {

                    if (
                        !savedProxy ||
                        !savedProxy.id
                    ) {
                        return;
                    }


                    var original =
                        DEFAULT_PROXIES.find(
                            function (p) {
                                return (
                                    p.id ===
                                    savedProxy.id
                                );
                            }
                        );


                    // ------------------------------------------------
                    // Proxy par défaut
                    // ------------------------------------------------

                    if (original) {

                        ordered.push({

                            id: original.id,

                            name: original.name,

                            url: original.url,

                            enabled:
                                !!savedProxy.enabled,

                            lastTest:
                                savedProxy.lastTest ||
                                null

                        });

                        return;

                    }


                    // ------------------------------------------------
                    // Proxy personnalisé
                    // ------------------------------------------------

                    if (
                        savedProxy.name &&
                        savedProxy.url &&
                        savedProxy.url.indexOf(
                            '{channel}'
                        ) >= 0
                    ) {

                        ordered.push({

                            id:
                                savedProxy.id,

                            name:
                                savedProxy.name,

                            url:
                                savedProxy.url,

                            enabled:
                                savedProxy.enabled !== false,

                            custom:
                                true,

                            lastTest:
                                savedProxy.lastTest ||
                                null

                        });

                    }

                }
            );


            // ------------------------------------------------
            // Ajoute les nouveaux proxys par défaut absents
            // ------------------------------------------------

            DEFAULT_PROXIES.forEach(
                function (original) {

                    var exists =
                        ordered.some(
                            function (p) {
                                return (
                                    p.id ===
                                    original.id
                                );
                            }
                        );


                    if (!exists) {

                        ordered.push(
                            createDefaultProxy(
                                original
                            )
                        );

                    }

                }
            );


            config.proxies =
                ordered;

        }


        if (
            typeof parsed.fallback ===
            'boolean'
        ) {

            config.fallback =
                parsed.fallback;

        }


        if (
            typeof parsed.timeout ===
            'number' &&
            parsed.timeout >= 1000 &&
            parsed.timeout <= 30000
        ) {

            config.timeout =
                parsed.timeout;

        }

        if (
            typeof parsed.cacheDelay ===
            'number' &&
            parsed.cacheDelay >= 1 &&
            parsed.cacheDelay <= 180
        ) {

            config.cacheDelay =
                parsed.cacheDelay;

        }

        if (
            typeof parsed.keepQualityInBackground ===
            'boolean'
        ) {

            config.keepQualityInBackground =
                parsed.keepQualityInBackground;

        }

        return config;

    }


    function loadConfig() {

        try {

            var saved =
                localStorage.getItem(
                    STORAGE_KEY
                );

            if (saved) {

                return buildConfigFromParsed(
                    JSON.parse(saved)
                );

            }

        } catch (e) {

            console.warn(
                '[TwitchProxy] Configuration invalide:',
                e
            );

        }

        return buildConfigFromParsed(
            null
        );

    }


    function saveConfig(config) {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(config)
            );

        } catch (e) {

            console.warn(
                '[TwitchProxy] Impossible de sauvegarder:',
                e
            );

        }

    }


    // ============================================================
    // EXPORT / IMPORT DE LA CONFIGURATION
    // ============================================================

    function exportConfig() {

        try {

            // On exporte une config "propre" : ni les résultats de
            // test (lastTest), ni rien de lié au réseau/à la chaîne
            // regardée au moment de l'export — juste la structure
            // des proxys et les réglages, réutilisable tel quel.
            var cleanConfig = {

                proxies:
                    pageConfig.proxies.map(
                        function (proxy) {

                            var clean = {
                                id: proxy.id,
                                name: proxy.name,
                                url: proxy.url,
                                enabled: proxy.enabled
                            };

                            if (proxy.custom) {
                                clean.custom = true;
                            }

                            return clean;

                        }
                    ),

                fallback:
                    pageConfig.fallback,

                timeout:
                    pageConfig.timeout,

                cacheDelay:
                    pageConfig.cacheDelay,

                keepQualityInBackground:
                    pageConfig.keepQualityInBackground

            };

            var json =
                JSON.stringify(
                    cleanConfig,
                    null,
                    2
                );

            var blob =
                new Blob(
                    [json],
                    { type: 'application/json' }
                );

            var url =
                URL.createObjectURL(
                    blob
                );

            var link =
                document.createElement(
                    'a'
                );

            link.href = url;

            link.download =
                'twitch-proxy-config.json';

            document.body.appendChild(
                link
            );

            link.click();

            document.body.removeChild(
                link
            );

            setTimeout(
                function () {

                    URL.revokeObjectURL(
                        url
                    );

                },
                1000
            );

        } catch (e) {

            console.warn(
                '[TwitchProxy] Export impossible:',
                e
            );

            alert(
                "Impossible d'exporter la configuration."
            );

        }

    }


    function importConfigFromFile(file) {

        var reader =
            new FileReader();

        reader.onload =
            function () {

                try {

                    var parsed =
                        JSON.parse(
                            reader.result
                        );

                    pageConfig =
                        buildConfigFromParsed(
                            parsed
                        );

                    saveConfig(
                        pageConfig
                    );

                    broadcastConfig();

                    renderDashboard();

                    alert(
                        'Configuration importée avec succès.'
                    );

                } catch (e) {

                    console.warn(
                        '[TwitchProxy] Import impossible:',
                        e
                    );

                    alert(
                        "Fichier invalide : impossible d'importer cette configuration."
                    );

                }

            };

        reader.onerror =
            function () {

                alert(
                    'Erreur de lecture du fichier.'
                );

            };

        reader.readAsText(
            file
        );

    }


    var pageConfig =
        loadConfig();


    // ============================================================
    // GARDER LA QUALITÉ QUAND L'ONGLET EST EN ARRIÈRE-PLAN
    // ============================================================

    (function setupBackgroundQualitySpoof() {

        try {

            var hiddenDescriptor =
                Object.getOwnPropertyDescriptor(
                    Document.prototype,
                    'hidden'
                );

            var visibilityStateDescriptor =
                Object.getOwnPropertyDescriptor(
                    Document.prototype,
                    'visibilityState'
                );

            if (
                !hiddenDescriptor ||
                !hiddenDescriptor.get ||
                !visibilityStateDescriptor ||
                !visibilityStateDescriptor.get
            ) {
                return;
            }

            Object.defineProperty(document, 'hidden', {
                configurable: true,
                get: function () {

                    if (pageConfig.keepQualityInBackground) {
                        return false;
                    }

                    return hiddenDescriptor.get.call(document);

                }
            });

            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: function () {

                    if (pageConfig.keepQualityInBackground) {
                        return 'visible';
                    }

                    return visibilityStateDescriptor.get.call(document);

                }
            });

            // Enregistré au tout début (document-start) : bloque
            // les listeners "visibilitychange" enregistrés plus
            // tard par Twitch quand l'option est activée.
            document.addEventListener(
                'visibilitychange',
                function (event) {

                    if (pageConfig.keepQualityInBackground) {
                        event.stopImmediatePropagation();
                    }

                },
                true
            );

        } catch (e) {

            console.warn(
                '[TwitchProxy] Spoof visibilité impossible:',
                e
            );

        }

    })();


    // ============================================================
    // BROADCAST CONFIG VERS LES WORKERS
    // ============================================================

    var configChannel = null;

    try {

        configChannel =
            new BroadcastChannel(
                'twitch-proxy-config-v1'
            );

    } catch (e) {

        console.warn(
            '[TwitchProxy] BroadcastChannel indisponible'
        );

    }


    function broadcastConfig() {

        if (!configChannel) {
            return;
        }

        try {

            configChannel.postMessage({
                type: 'config',
                config: pageConfig
            });

        } catch (e) {}

    }


    // Info sur le proxy réellement utilisé pour la lecture en
    // cours, remontée par le Worker via le même BroadcastChannel.
    var activeProxyInfo = null;

    if (configChannel) {

        configChannel.addEventListener(
            'message',
            function (event) {

                try {

                    if (
                        event.data &&
                        event.data.type === 'activeProxy'
                    ) {

                        activeProxyInfo =
                            event.data;

                        renderDashboard();

                    }

                } catch (e) {}

            }
        );

    }


    // ============================================================
    // DASHBOARD
    // ============================================================

    var dashboard = null;
    var dashboardButton = null;
    var dashboardVisible = false;


    function createDashboard() {

        if (dashboard) {
            return;
        }


        dashboard =
            document.createElement('div');


        dashboard.id =
            'tp9-dashboard';


        dashboard.innerHTML = `

            <div class="tp9-header">

                <div class="tp9-title">
                    🛡 Twitch Proxy
                </div>

                <button
                    class="tp9-close"
                    type="button"
                >
                    ×
                </button>

            </div>


            <div class="tp9-content">

<div class="tp9-active-proxy"></div>

<div class="tp9-section-title">
    PROXYS
</div>

<div class="tp9-proxy-list"></div>

<button
    class="tp9-add-proxy"
    type="button"
>
    ＋ Ajouter un proxy
</button>

<div class="tp9-add-container"></div>

<div class="tp9-divider"></div>


                <div class="tp9-option">

                    <label>

                        <input
                            type="checkbox"
                            class="tp9-fallback"
                        >

                        Fallback automatique

                    </label>

                </div>


                <div class="tp9-option">

                    <label>

                        <input
                            type="checkbox"
                            class="tp9-keep-quality"
                        >

                        Garder la qualité en arrière-plan

                    </label>

                </div>


                <div class="tp9-timeout">

                    <label>

                        Timeout

                        <select
                            class="tp9-timeout-select"
                        >

                            <option value="2000">
                                2 s
                            </option>

                            <option value="3000">
                                3 s
                            </option>

                            <option value="4000">
                                4 s
                            </option>

                            <option value="5000">
                                5 s
                            </option>

                            <option value="8000">
                                8 s
                            </option>

                            <option value="10000">
                                10 s
                            </option>

                        </select>

                    </label>

                </div>

                <div class="tp9-timeout">

                    <label>

                        Re-test auto

                        <select
                            class="tp9-cache-select"
                        >

                            <option value="5">
                                5 min
                            </option>

                            <option value="10">
                                10 min
                            </option>

                            <option value="20">
                                20 min
                            </option>

                            <option value="30">
                                30 min
                            </option>

                            <option value="60">
                                1 heure
                            </option>

                            <option value="180">
                                3 heures
                            </option>

                        </select>

                    </label>

                </div>


                <div class="tp9-actions">

                    <button
                        class="tp9-test"
                        type="button"
                    >
                        🧪 Tester
                    </button>

                    <button
                        class="tp9-reset"
                        type="button"
                    >
                        ↺ Reset
                    </button>

                </div>


                <div class="tp9-actions tp9-actions-secondary">

                    <button
                        class="tp9-export"
                        type="button"
                    >
                        ⬇ Export
                    </button>

                    <button
                        class="tp9-import"
                        type="button"
                    >
                        ⬆ Import
                    </button>

                </div>

                <input
                    type="file"
                    class="tp9-import-file"
                    accept="application/json"
                    style="display:none;"
                >


                <div class="tp9-current">
                    Aucun proxy testé
                </div>

            </div>

        `;


        document.body.appendChild(
    dashboard
);


document.addEventListener(
    'click',
    function (event) {

        if (
            !dashboardVisible
        ) {
            return;
        }

        if (
            event.target.closest(
                '#tp9-dashboard'
            ) ||
            event.target.closest(
                '#tp9-player-button'
            )
        ) {
            return;
        }

        hideDashboard();

    }
);


        injectDashboardCSS();


        dashboard
            .querySelector('.tp9-close')
            .addEventListener(
                'click',
                function () {

                    hideDashboard();

                }
            );


        dashboard
            .querySelector('.tp9-fallback')
            .addEventListener(
                'change',
                function (event) {

                    pageConfig.fallback =
                        event.target.checked;

                    saveConfig(pageConfig);

                    broadcastConfig();

                    renderDashboard();

                }
            );


        dashboard
            .querySelector('.tp9-keep-quality')
            .addEventListener(
                'change',
                function (event) {

                    pageConfig.keepQualityInBackground =
                        event.target.checked;

                    saveConfig(pageConfig);

                    renderDashboard();

                }
            );


        dashboard
            .querySelector('.tp9-timeout-select')
            .addEventListener(
                'change',
                function (event) {

                    pageConfig.timeout =
                        parseInt(
                            event.target.value,
                            10
                        );

                    saveConfig(pageConfig);

                    broadcastConfig();

                }
            );

        dashboard
            .querySelector('.tp9-cache-select')
            .addEventListener(
                'change',
                function (event) {

                    pageConfig.cacheDelay =
                        parseInt(
                            event.target.value,
                            10
                        );

                    saveConfig(pageConfig);

                    broadcastConfig();

                }
            );


        dashboard
            .querySelector('.tp9-test')
            .addEventListener(
                'click',
                function () {

                    testAllProxies();

                }
            );


        dashboard
            .querySelector('.tp9-reset')
            .addEventListener(
                'click',
                function () {

                    if (
                        !confirm(
                            'Réinitialiser les proxys ?\n\n' +
                            'Les proxys personnalisés seront supprimés.'
                        )
                    ) {
                        return;
                    }


                    pageConfig = {

                        proxies:
                            DEFAULT_PROXIES.map(
                                createDefaultProxy
                            ),

                        fallback: true,

                        timeout:
                            DEFAULT_TIMEOUT,

                        cacheDelay:
                            DEFAULT_CACHE_DELAY,

                        keepQualityInBackground:
                            false

                    };


                    saveConfig(
                        pageConfig
                    );

                    broadcastConfig();

                    renderDashboard();

                }
            );


        dashboard
            .querySelector('.tp9-export')
            .addEventListener(
                'click',
                function () {

                    exportConfig();

                }
            );


        dashboard
            .querySelector('.tp9-import')
            .addEventListener(
                'click',
                function () {

                    dashboard
                        .querySelector(
                            '.tp9-import-file'
                        )
                        .click();

                }
            );


        dashboard
            .querySelector('.tp9-import-file')
            .addEventListener(
                'change',
                function (event) {

                    var file =
                        event.target.files &&
                        event.target.files[0];

                    if (!file) {
                        return;
                    }

                    if (
                        !confirm(
                            'Importer cette configuration ?\n\n' +
                            'Elle remplacera entièrement la configuration actuelle.'
                        )
                    ) {

                        event.target.value = '';

                        return;

                    }

                    importConfigFromFile(file);

                    event.target.value = '';

                }
            );


        dashboard
            .querySelector('.tp9-add-proxy')
            .addEventListener(
                'click',
                function () {

                    showAddProxyForm();

                }
            );


        renderDashboard();

    }


    // ============================================================
    // RENDU DASHBOARD
    // ============================================================

    function renderDashboard() {

        if (!dashboard) {
            return;
        }


        var list =
            dashboard.querySelector(
                '.tp9-proxy-list'
            );


        list.innerHTML = '';


        pageConfig.proxies.forEach(
            function (proxy, index) {

                var row =
                    document.createElement(
                        'div'
                    );


                row.className =
                    'tp9-proxy';


                var lastTest =
                    proxy.lastTest;


                var statusText =
                    '⚪ non testé';


                var statusClass =
                    'tp9-status-never';


                if (lastTest) {

                    if (
                        lastTest.ok
                    ) {

                        statusText =
                            '🟢 OK · ' +
                            lastTest.latency +
                            ' ms';

                        statusClass =
                            'tp9-status-ok';

                    } else {

                        statusText =
                            '🔴 ' +
                            lastTest.status;

                        if (
                            lastTest.latency
                        ) {

                            statusText +=
                                ' · ' +
                                lastTest.latency +
                                ' ms';

                        }

                        statusClass =
                            'tp9-status-error';

                    }

                }


                var lastTestInfo =
                    '';


                if (
                    lastTest &&
                    lastTest.timestamp
                ) {

                    lastTestInfo =
                        '<span class="tp9-test-time">' +
                        escapeHTML(
                            formatTestDate(
                                lastTest.timestamp
                            )
                        ) +
                        '</span>';

                }


                var customBadge =
                    proxy.custom
                        ? '<span class="tp9-custom">CUSTOM</span>'
                        : '';


                var deleteButton =
                    proxy.custom
                        ? `
                            <button
                                class="tp9-delete"
                                type="button"
                                title="Supprimer"
                            >
                                ×
                            </button>
                        `
                        : '';


                row.innerHTML = `

                    <div class="tp9-proxy-main">

                        <input
                            type="checkbox"
                            class="tp9-enabled"
                            ${proxy.enabled ? 'checked' : ''}
                        >


                        <div class="tp9-proxy-info">

                            <div class="tp9-proxy-name">

                                ${escapeHTML(proxy.name)}

                                ${customBadge}

                            </div>


                            <div
                                class="tp9-status ${statusClass}"
                                data-status="${escapeHTML(proxy.id)}"
                            >

                                ${escapeHTML(statusText)}

                                ${lastTestInfo}

                            </div>

                        </div>

                    </div>


                    <div class="tp9-move">

                        ${deleteButton}

                        <button
                            class="tp9-up"
                            type="button"
                            ${index === 0 ? 'disabled' : ''}
                            title="Monter"
                        >
                            ▲
                        </button>

                        <button
                            class="tp9-down"
                            type="button"
                            ${
                                index ===
                                pageConfig.proxies.length - 1
                                    ? 'disabled'
                                    : ''
                            }
                            title="Descendre"
                        >
                            ▼
                        </button>

                    </div>

                `;


                row
                    .querySelector(
                        '.tp9-enabled'
                    )
                    .addEventListener(
                        'change',
                        function (event) {

                            proxy.enabled =
                                event.target.checked;

                            saveConfig(
                                pageConfig
                            );

                            broadcastConfig();

                            renderDashboard();

                        }
                    );


                row
                    .querySelector(
                        '.tp9-up'
                    )
                    .addEventListener(
                        'click',
                        function (event) {

                            event.stopPropagation();

                            moveProxy(
                                index,
                                -1
                            );

                        }
                    );


                row
                    .querySelector(
                        '.tp9-down'
                    )
                    .addEventListener(
                        'click',
                        function (event) {

                            event.stopPropagation();

                            moveProxy(
                                index,
                                1
                            );

                        }
                    );


                if (proxy.custom) {

                    row
                        .querySelector(
                            '.tp9-delete'
                        )
                        .addEventListener(
                            'click',
                            function () {

                                deleteCustomProxy(
                                    proxy.id
                                );

                            }
                        );

                }


                list.appendChild(
                    row
                );

            }
        );


        dashboard
            .querySelector(
                '.tp9-fallback'
            )
            .checked =
            pageConfig.fallback;


        dashboard
            .querySelector(
                '.tp9-keep-quality'
            )
            .checked =
            !!pageConfig.keepQualityInBackground;


        dashboard
            .querySelector(
                '.tp9-timeout-select'
            )
            .value =
            String(
                pageConfig.timeout
            );

        dashboard
            .querySelector(
                '.tp9-cache-select'
            )
            .value =
            String(
                pageConfig.cacheDelay ||
                DEFAULT_CACHE_DELAY
            );


        updateCurrentTestInfo();

        updateAutoTestStatus();

        updateActiveProxyDisplay();

    }


    // ============================================================
    // DATE DU TEST
    // ============================================================

    function formatTestDate(timestamp) {

        try {

            var date =
                new Date(timestamp);


            return (
                'testé ' +
                date.toLocaleTimeString(
                    [],
                    {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }
                )
            );

        } catch (e) {

            return '';

        }

    }


    function updateCurrentTestInfo() {

        if (!dashboard) {
            return;
        }


        var current =
            dashboard.querySelector(
                '.tp9-current'
            );


        if (!current) {
            return;
        }


        var tested =
            pageConfig.proxies.filter(
                function (proxy) {
                    return !!proxy.lastTest;
                }
            );


        if (!tested.length) {

            current.textContent =
                'Aucun proxy testé';

            return;

        }


        var successful =
            tested.filter(
                function (proxy) {
                    return proxy.lastTest.ok;
                }
            );


        current.textContent =
            successful.length +
            ' proxy(s) OK · ' +
            tested.length +
            ' testé(s)';

    }

    function updateAutoTestStatus() {

        if (!dashboard) {
            return;
        }

        var current = dashboard.querySelector('.tp9-current');

        if (!current) {
            return;
        }

        var channel = getTestChannel();

        if (!channel) {
            return;
        }

        var tested = pageConfig.proxies.filter(function (p) {
            return p.lastTest && p.lastTest.channel === channel;
        });

        if (!tested.length) {
            current.textContent = 'Auto-test en cours…';
            return;
        }

        var ok = tested.filter(function (p) {
            return p.lastTest.ok;
        });

        var best = ok.length ? ok[0] : null;

        if (best) {
            current.textContent =
                '✅ ' + ok.length + ' OK · meilleur : ' +
                best.name + ' (' + best.lastTest.latency + ' ms)';
        } else {
            current.textContent = '❌ Aucun proxy fonctionnel pour : ' + channel;
        }

    }


    // Affiche le proxy réellement utilisé par le Worker pour la
    // lecture en cours (remonté via BroadcastChannel), à ne pas
    // confondre avec les résultats de l'auto-test ci-dessus.
    function updateActiveProxyDisplay() {

        if (!dashboard) {
            return;
        }

        var el =
            dashboard.querySelector(
                '.tp9-active-proxy'
            );

        if (!el) {
            return;
        }

        var channel =
            getTestChannel();

        if (
            !activeProxyInfo ||
            !channel ||
            activeProxyInfo.channel !== channel
        ) {

            el.textContent = '';

            return;

        }

        if (activeProxyInfo.direct) {

            el.textContent =
                '📡 Lecture actuelle : Twitch (direct, aucun proxy)';

        } else {

            el.textContent =
                '📡 Lecture actuelle : ' +
                activeProxyInfo.proxyName;

        }

    }


    // ============================================================
    // DÉPLACEMENT DES PROXYS
    // ============================================================

    function moveProxy(
        index,
        direction
    ) {

        var newIndex =
            index + direction;


        if (
            newIndex < 0 ||
            newIndex >=
            pageConfig.proxies.length
        ) {
            return;
        }


        var temp =
            pageConfig.proxies[index];


        pageConfig.proxies[index] =
            pageConfig.proxies[newIndex];


        pageConfig.proxies[newIndex] =
            temp;


        saveConfig(
            pageConfig
        );


        broadcastConfig();


        renderDashboard();

    }


    // ============================================================
    // AJOUT PROXY
    // ============================================================

function showAddProxyForm() {

    if (!dashboard) {
        return;
    }

    var container =
        dashboard.querySelector(
            '.tp9-add-container'
        );

    if (!container) {
        return;
    }

    // Évite d'ouvrir plusieurs formulaires
    if (
        container.querySelector(
            '.tp9-add-form'
        )
    ) {
        return;
    }

    container.innerHTML = `

        <div class="tp9-section-title tp9-add-title">
            AJOUTER UN PROXY
        </div>

        <div class="tp9-add-form">

            <label>
                Nom
            </label>

            <input
                type="text"
                class="tp9-new-name"
                placeholder="Mon proxy"
                autocomplete="off"
            >

            <label>
                URL
            </label>

            <input
                type="text"
                class="tp9-new-url"
                placeholder="https://exemple.com/live/{channel}"
                autocomplete="off"
            >

            <div class="tp9-help">
                L'URL doit contenir
                <code>{channel}</code>
            </div>

            <div class="tp9-form-error"></div>

            <div class="tp9-actions">

                <button
                    class="tp9-cancel-add"
                    type="button"
                >
                    Annuler
                </button>

                <button
                    class="tp9-confirm-add"
                    type="button"
                >
                    Ajouter
                </button>

            </div>

        </div>

    `;

    var nameInput =
        container.querySelector(
            '.tp9-new-name'
        );

    var urlInput =
        container.querySelector(
            '.tp9-new-url'
        );

    var error =
        container.querySelector(
            '.tp9-form-error'
        );

    // ------------------------------------------------------------
    // ANNULER
    // ------------------------------------------------------------

    container
        .querySelector(
            '.tp9-cancel-add'
        )
        .addEventListener(
            'click',
            function () {

                container.innerHTML = '';

                renderDashboard();

            }
        );

    // ------------------------------------------------------------
    // AJOUTER
    // ------------------------------------------------------------

    container
        .querySelector(
            '.tp9-confirm-add'
        )
        .addEventListener(
            'click',
            function () {

                var name =
                    nameInput.value.trim();

                var url =
                    urlInput.value.trim();

                // ------------------------------------------------
                // Validation nom
                // ------------------------------------------------

                if (!name) {

                    error.textContent =
                        'Veuillez entrer un nom.';

                    nameInput.focus();

                    return;

                }

                // ------------------------------------------------
                // Validation URL
                // ------------------------------------------------

                if (!url) {

                    error.textContent =
                        'Veuillez entrer une URL.';

                    urlInput.focus();

                    return;

                }

                if (
                    url.indexOf(
                        '{channel}'
                    ) === -1
                ) {

                    error.textContent =
                        "L'URL doit contenir {channel}.";

                    urlInput.focus();

                    return;

                }

                try {

                    /*
                     * On remplace temporairement {channel}
                     * uniquement pour permettre à URL()
                     * de valider correctement l'adresse.
                     *
                     * Le proxy enregistré conserve
                     * évidemment {channel}.
                     */

                    var testURL =
                        url.replace(
                            '{channel}',
                            'testchannel'
                        );

                    var parsed =
                        new URL(testURL);

                    if (
                        parsed.protocol !==
                            'http:' &&
                        parsed.protocol !==
                            'https:'
                    ) {

                        throw new Error();

                    }

                } catch (e) {

                    error.textContent =
                        'URL invalide.';

                    urlInput.focus();

                    return;

                }

                // ------------------------------------------------
                // Empêche les doublons
                // ------------------------------------------------

                var duplicate =
                    pageConfig.proxies.some(
                        function (proxy) {

                            return (
                                proxy.url === url ||
                                (
                                    proxy.name &&
                                    proxy.name
                                        .toLowerCase() ===
                                    name.toLowerCase()
                                )
                            );

                        }
                    );

                if (duplicate) {

                    error.textContent =
                        'Un proxy avec ce nom ou cette URL existe déjà.';

                    return;

                }

                // ------------------------------------------------
                // Création
                // ------------------------------------------------

                var newProxy = {

                    id:
                        generateCustomProxyId(),

                    name:
                        name,

                    url:
                        url,

                    enabled:
                        true,

                    custom:
                        true,

                    lastTest:
                        null

                };

                pageConfig.proxies.push(
                    newProxy
                );

                saveConfig(
                    pageConfig
                );

                broadcastConfig();

                /*
                 * Très important :
                 * on détruit uniquement le formulaire.
                 * Le reste du dashboard n'est jamais supprimé.
                 */

                container.innerHTML = '';

                renderDashboard();

            }
        );

    // ------------------------------------------------------------
    // ENTER = AJOUTER
    // ------------------------------------------------------------

    urlInput.addEventListener(
        'keydown',
        function (event) {

            if (
                event.key ===
                'Enter'
            ) {

                container
                    .querySelector(
                        '.tp9-confirm-add'
                    )
                    .click();

            }

        }
    );

    nameInput.focus();

}


    // ============================================================
    // SUPPRESSION PROXY CUSTOM
    // ============================================================

    function deleteCustomProxy(id) {

        var proxy =
            pageConfig.proxies.find(
                function (p) {
                    return p.id === id;
                }
            );


        if (!proxy) {
            return;
        }


        if (!proxy.custom) {
            return;
        }


        if (
            !confirm(
                'Supprimer le proxy "' +
                proxy.name +
                '" ?'
            )
        ) {
            return;
        }


        pageConfig.proxies =
            pageConfig.proxies.filter(
                function (p) {
                    return p.id !== id;
                }
            );


        saveConfig(
            pageConfig
        );


        broadcastConfig();


        renderDashboard();

    }


    function escapeHTML(text) {

        return String(text)
            .replace(
                /&/g,
                '&amp;'
            )
            .replace(
                /</g,
                '&lt;'
            )
            .replace(
                />/g,
                '&gt;'
            )
            .replace(
                /"/g,
                '&quot;'
            )
            .replace(
                /'/g,
                '&#039;'
            );

    }


    // ============================================================
    // BOUTON PLAYER
    // ============================================================

    function createPlayerButton() {

        if (dashboardButton) {
            return;
        }


        dashboardButton =
            document.createElement(
                'button'
            );


        dashboardButton.id =
            'tp9-player-button';


        dashboardButton.innerHTML =
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"/></svg>';


        dashboardButton.title =
    'Twitch Proxy Manager';

dashboardButton.style.visibility =
    'hidden';


        dashboardButton.addEventListener(
            'click',
            function () {

                if (dashboardVisible) {

                    hideDashboard();

                } else {

                    showDashboard();

                }

            }
        );


        document.body.appendChild(
            dashboardButton
        );


        createDashboard();

        positionPlayerUI();

    }


    function findPlayer() {

        var video =
            document.querySelector(
                'video'
            );


        if (!video) {
            return null;
        }


        var element =
            video;


        while (
            element &&
            element !== document.body
        ) {

            var rect =
                element.getBoundingClientRect();


            if (
                rect.width > 400 &&
                rect.height > 200
            ) {

                return element;

            }


            element =
                element.parentElement;

        }


        return video.parentElement;

    }


    // ============================================================
    // RECHERCHE DU BOUTON FOLLOW / COEUR
    // ============================================================

    function findFollowButton() {

        var selectors = [

            '[data-a-target="follow-button"]',

            '[data-a-target="channel-follow-button"]',

            'button[data-a-target*="follow"]',

            'button[aria-label*="Follow"]',

            'button[aria-label*="follow"]',

            'button[aria-label*="Suivre"]',

            'button[aria-label*="suivre"]'

        ];


        for (
            var i = 0;
            i < selectors.length;
            i++
        ) {

            var element =
                document.querySelector(
                    selectors[i]
                );


            if (
                element &&
                element.offsetParent !== null
            ) {

                return element;

            }

        }


        var buttons =
            document.querySelectorAll(
                'button'
            );


        for (
            var j = 0;
            j < buttons.length;
            j++
        ) {

            var button =
                buttons[j];


            if (
                button.offsetParent === null
            ) {
                continue;
            }


            var text =
                (
                    button.innerText ||
                    button.textContent ||
                    ''
                )
                .trim()
                .toLowerCase();


            var aria =
                (
                    button.getAttribute(
                        'aria-label'
                    ) ||
                    ''
                )
                .toLowerCase();


            if (
                text === 'follow' ||
                text === 'suivre' ||
                aria.indexOf('follow') >= 0 ||
                aria.indexOf('suivre') >= 0
            ) {

                return button;

            }

        }


        return null;

    }


    // Le mini-player Twitch (lecteur flottant qui persiste quand
    // on navigue ailleurs sur le site, ou qu'on scroll sur la page
    // de la chaîne) est toujours affiché en "position: fixed" et
    // dans un format nettement plus petit que le lecteur principal.
    function isMiniPlayerVideo(video) {

        try {

            var rect =
                video.getBoundingClientRect();

            if (rect.width < 500) {

                var element = video;

                while (
                    element &&
                    element !== document.body
                ) {

                    var computed =
                        window.getComputedStyle(
                            element
                        );

                    if (
                        computed &&
                        computed.position === 'fixed'
                    ) {

                        return true;

                    }

                    element =
                        element.parentElement;

                }

            }

        } catch (e) {}

        return false;

    }


    function positionPlayerUI() {

        if (!dashboardButton) {
            return;
        }


        // On ne veut le bouton QUE sur la page de la chaîne en
        // cours de visionnage, jamais accroché à un follow button
        // qui traînerait ailleurs sur le site (accueil, grille de
        // chaînes recommandées, etc.).
        if (!getTestChannel()) {

            dashboardButton.style.visibility =
                'hidden';

            return;

        }


    var followButton =
        findFollowButton();


    if (followButton) {

        var video =
            document.querySelector(
                'video'
            );

        if (
            !video ||
            video.readyState === 0
        ) {

            dashboardButton.style.visibility =
                'hidden';

            return;

        }

        if (isMiniPlayerVideo(video)) {

            dashboardButton.style.visibility =
                'hidden';

            return;

        }

        dashboardButton.style.visibility =
            'visible';

        var followRect =
            followButton.getBoundingClientRect();


        dashboardButton.style.position =
            'fixed';


        dashboardButton.style.left =
            (
                followRect.left -
                44
            ) + 'px';


        dashboardButton.style.top =
            (
                followRect.top +
                (
                    followRect.height -
                    32
                ) / 2
            ) + 'px';


            if (dashboardVisible) {

                dashboard.style.position =
                    'fixed';


                dashboard.style.left =
                    (
                        followRect.left -
                        360
                    ) + 'px';


                dashboard.style.top =
                    (
                        followRect.bottom -
                        460
                    ) + 'px';

            }


            return;

        }


            dashboardButton.style.visibility =
        'hidden';

    var player =
        findPlayer();


    if (!player) {

        dashboardButton.style.position =
            'fixed';


        dashboardButton.style.left =
            '20px';


        dashboardButton.style.bottom =
            '20px';


        return;

    }


        var rect =
            player.getBoundingClientRect();


        dashboardButton.style.position =
            'fixed';


        dashboardButton.style.left =
            rect.left + 'px';


        dashboardButton.style.top =
            (
                rect.bottom +
                8
            ) + 'px';


        if (dashboardVisible) {

            dashboard.style.position =
                'fixed';


            dashboard.style.left =
                rect.left + 'px';


            dashboard.style.top =
                (
                    rect.bottom +
                    55
                ) + 'px';

        }

    }


    function showDashboard() {

        dashboardVisible = true;

        dashboard.style.display =
            'block';

        renderDashboard();

        positionPlayerUI();

    }


    function hideDashboard() {

        dashboardVisible = false;

        dashboard.style.display =
            'none';

    }


    // ============================================================
    // CSS
    // ============================================================

    function injectDashboardCSS() {

        if (
            document.getElementById(
                'tp9-style'
            )
        ) {
            return;
        }


        var style =
            document.createElement(
                'style'
            );


        style.id =
            'tp9-style';


        style.textContent = `

            /* =====================================================
               BOUTON PROXY
            ===================================================== */

            #tp9-player-button {

                z-index: 2147483646;

                width: auto;
                height: 32px;

                min-width: 32px;
                min-height: 32px;

                padding: 0 12px;
                margin: 0;

                display: inline-flex;

                position: fixed;

                align-items: center;
                justify-content: center;

                vertical-align: middle;

                overflow: hidden;

                text-decoration: none;
                white-space: nowrap;
                user-select: none;

                font-family:
                    "Inter",
                    "Noto Sans Arabic",
                    "Roobert",
                    "Helvetica Neue",
                    Helvetica,
                    Arial,
                    sans-serif;

                font-weight: 600;

                font-size: 16px;

                line-height: 1;

                border: 0;

                border-radius: 9000px;

                background-color:
                    rgba(83, 83, 95, .48);

                color: #efeff1;

                cursor: pointer;

                box-sizing: border-box;

                appearance: none;
                -webkit-appearance: none;

                outline: none;

                box-shadow: none;

                opacity: 1;

                transition:
                    background-color .12s ease,
                    color .12s ease;

            }


            #tp9-player-button:hover {

                background-color:
                    rgba(83, 83, 95, .7);

                color: #fff;

                transform: none;

                box-shadow: none;

            }


            #tp9-player-button:active {

                background-color:
                    rgba(0, 0, 0, .85);

                transform: none;

            }


            #tp9-player-button:focus-visible {

                outline:
                    2px solid #fff;

                outline-offset: 2px;

                box-shadow: none;

            }


            /* =====================================================
               DASHBOARD
            ===================================================== */

            #tp9-dashboard {

                display: none;

                z-index: 2147483647;

                width: 340px;

                max-height: 470px;

                overflow: hidden;

                color: #fff;

                background:
                    rgba(15,15,15,.97);

                border:
                    1px solid rgba(255,255,255,.15);

                border-radius: 12px;

                box-shadow:
                    0 10px 40px rgba(0,0,0,.65);

                font-family:
                    Arial,
                    sans-serif;

                font-size: 13px;

                backdrop-filter:
                    blur(12px);

            }


            .tp9-header {

                display: flex;

                align-items: center;

                justify-content: space-between;

                padding: 13px 15px;

                border-bottom:
                    1px solid rgba(255,255,255,.1);

            }


            .tp9-title {

                font-size: 15px;

                font-weight: bold;

            }


            .tp9-close {

                border: 0;

                background: transparent;

                color: #aaa;

                font-size: 22px;

                cursor: pointer;

            }


            .tp9-close:hover {

                color: white;

            }


            .tp9-content {

                padding: 12px;

                max-height: 400px;

                overflow-y: auto;

            }


            .tp9-section-title {

                font-size: 10px;

                color: #888;

                letter-spacing: 1px;

                margin-bottom: 8px;

            }


            .tp9-proxy {

                display: flex;

                align-items: center;

                justify-content: space-between;

                padding: 8px;

                margin-bottom: 5px;

                border-radius: 7px;

                background:
                    rgba(255,255,255,.045);

            }


            .tp9-proxy:hover {

                background:
                    rgba(255,255,255,.08);

            }


            .tp9-proxy-main {

                display: flex;

                align-items: center;

                min-width: 0;

                flex: 1;

            }


            .tp9-enabled {

                margin-right: 9px;

                flex: 0 0 auto;

            }


            .tp9-proxy-info {

                min-width: 0;

            }


            .tp9-proxy-name {

                font-weight: 600;

                white-space: nowrap;

                overflow: hidden;

                text-overflow: ellipsis;

            }


            .tp9-custom {

                display: inline-block;

                margin-left: 6px;

                padding: 1px 5px;

                border-radius: 4px;

                background:
                    rgba(145,71,255,.18);

                color: #bf94ff;

                font-size: 8px;

                font-weight: bold;

                vertical-align: 2px;

            }


            .tp9-status {

                color: #888;

                font-size: 11px;

                margin-top: 2px;

                white-space: nowrap;

            }


            .tp9-status-ok {

                color: #00d084;

            }


            .tp9-status-error {

                color: #ff6b6b;

            }


            .tp9-status-never {

                color: #888;

            }


            .tp9-test-time {

                margin-left: 5px;

                color: #666;

                font-size: 9px;

            }


            .tp9-move {

                display: flex;

                gap: 2px;

                margin-left: 8px;

                flex: 0 0 auto;

            }


            .tp9-move button {

                width: 25px;
                height: 23px;

                padding: 0;

                border: 0;

                border-radius: 4px;

                background:
                    rgba(255,255,255,.08);

                color: #aaa;

                cursor: pointer;

            }


            .tp9-move button:hover {

                background:
                    rgba(255,255,255,.17);

                color: white;

            }


            .tp9-move button:disabled {

                opacity: .25;

                cursor: default;

            }


            .tp9-delete {

                color: #ff6b6b !important;

            }


            .tp9-delete:hover {

                background:
                    rgba(255,70,70,.18) !important;

            }


            .tp9-add-proxy {

                width: 100%;

                margin-top: 4px;

                padding: 8px;

                border: 1px dashed
                    rgba(255,255,255,.16);

                border-radius: 6px;

                background:
                    transparent;

                color: #aaa;

                cursor: pointer;

                font-size: 12px;

            }


            .tp9-add-proxy:hover {

                background:
                    rgba(255,255,255,.06);

                color: white;

                border-color:
                    rgba(255,255,255,.28);

            }


            .tp9-divider {

                height: 1px;

                background:
                    rgba(255,255,255,.1);

                margin:
                    12px 0;

            }


            .tp9-option {

                margin-bottom: 10px;

            }


            .tp9-timeout {

                margin-bottom: 12px;

                color: #bbb;

            }


            .tp9-timeout select {

                float: right;

                background: #222;

                color: white;

                border: 1px solid #444;

                border-radius: 5px;

                padding: 3px 6px;

            }


            .tp9-actions {

                display: flex;

                gap: 7px;

            }


            .tp9-actions button {

                flex: 1;

                padding: 8px;

                border: 0;

                border-radius: 6px;

                background:
                    rgba(255,255,255,.1);

                color: white;

                cursor: pointer;

            }


            .tp9-actions button:hover {

                background:
                    rgba(255,255,255,.18);

            }


            .tp9-current {

                margin-top: 10px;

                padding: 8px;

                border-radius: 6px;

                background:
                    rgba(0,0,0,.25);

                color: #aaa;

                font-size: 11px;

            }


            .tp9-active-proxy {

                margin-bottom: 10px;

                padding: 7px 8px;

                border-radius: 6px;

                background:
                    rgba(145,71,255,.12);

                color: #bf94ff;

                font-size: 11px;

                font-weight: 600;

            }


            .tp9-active-proxy:empty {

                display: none;

            }


            .tp9-actions-secondary {

                margin-top: 7px;

            }


            /* =====================================================
               FORMULAIRE AJOUT
            ===================================================== */

            .tp9-add-form {

                display: flex;

                flex-direction: column;

                gap: 7px;

            }


            .tp9-add-form label {

                color: #aaa;

                font-size: 11px;

                font-weight: 600;

                margin-top: 3px;

            }


            .tp9-add-form input {

                width: 100%;

                min-height: 34px;

                padding:
                    7px 9px;

                border:
                    1px solid
                    rgba(255,255,255,.12);

                border-radius: 6px;

                outline: none;

                background: #222;

                color: white;

                font-family: Arial, sans-serif;

                font-size: 12px;

                box-sizing: border-box;

            }


            .tp9-add-form input:focus {

                border-color:
                    #9147ff;

            }

			.tp9-add-container {
    margin-top: 10px;
}

.tp9-add-title {
    margin-top: 10px;
    margin-bottom: 8px;
}

            .tp9-help {

                color: #777;

                font-size: 10px;

            }


            .tp9-help code {

                color: #bf94ff;

                background:
                    rgba(255,255,255,.06);

                padding:
                    1px 4px;

                border-radius: 3px;

            }


            .tp9-form-error {

                min-height: 15px;

                color: #ff6b6b;

                font-size: 11px;

            }

        `;


        document.head.appendChild(
            style
        );

    }


    // ============================================================
    // TEST DES PROXYS
    // ============================================================

    // Empêche testAllProxies() et autoTestOnLoad() de tourner
    // en même temps et de se marcher dessus sur pageConfig.proxies
    var testInProgress = false;


    var NON_CHANNEL_PATHS = [
        'directory',
        'search',
        'downloads',
        'videos',
        'moderator',
        'subscriptions',
        'settings',
        'wallet',
        'drops',
        'inventory',
        'friends',
        'p',
        'payments',
        'popout',
        'jobs',
        'turbo',
        'prime',
        'store'
    ];


    function getTestChannel() {

        try {

            var path =
                location.pathname
                    .split('/')
                    .filter(Boolean);


            if (
                path.length &&
                path[0] &&
                NON_CHANNEL_PATHS.indexOf(
                    path[0].toLowerCase()
                ) === -1
            ) {

                return path[0].toLowerCase();

            }

        } catch (e) {}

        return null;

    }


    async function testProxy(
        proxy,
        channel
    ) {

        var url =
            proxy.url.replace(
                '{channel}',
                encodeURIComponent(
                    channel
                )
            );


        var start =
            performance.now();


        try {

            var controller =
                new AbortController();


            var timer =
                setTimeout(
                    function () {

                        controller.abort();

                    },
                    pageConfig.timeout
                );


            var response =
                await fetch(
                    url,
                    {
                        method: 'GET',
                        signal:
                            controller.signal,
                        cache: 'no-store'
                    }
                );


            clearTimeout(timer);


            var elapsed =
                Math.round(
                    performance.now() -
                    start
                );


            if (!response.ok) {

                return {

                    ok: false,

                    status:
                        response.status,

                    latency:
                        elapsed

                };

            }


            var text =
                await response.text();


            var looksLikeHLS =
                text.indexOf(
                    '#EXTM3U'
                ) >= 0
                ||
                text.indexOf(
                    '#EXT-X-'
                ) >= 0;


            return {

                ok:
                    looksLikeHLS,

                status:
                    response.status,

                latency:
                    elapsed

            };


        } catch (error) {

            return {

                ok: false,

                status:
                    error &&
                    error.name ===
                    'AbortError'
                        ? 'TIMEOUT'
                        : 'ERR',

                latency:
                    Math.round(
                        performance.now() -
                        start
                    )

            };

        }

    }


    async function testAllProxies() {

        if (testInProgress) {

            alert(
                'Un test est déjà en cours, merci de patienter.'
            );

            return;

        }


        var channel =
            getTestChannel();


        if (!channel) {

            alert(
                'Impossible de déterminer la chaîne actuelle.'
            );

            return;

        }


        var enabled =
            pageConfig.proxies.filter(
                function (p) {
                    return p.enabled;
                }
            );


        if (!enabled.length) {

            alert(
                'Aucun proxy activé.'
            );

            return;

        }


        testInProgress = true;

        try {

            console.log(
                '[TwitchProxy] ===== TEST PROXYS ====='
            );


            for (
                var i = 0;
                i < enabled.length;
                i++
            ) {

                var proxy =
                    enabled[i];


                updateProxyStatus(
                    proxy.id,
                    '🟡 test...'
                );


                var result =
                    await testProxy(
                        proxy,
                        channel
                    );


                // ----------------------------------------------------
                // NOUVEAU
                // Sauvegarde du dernier résultat
                // ----------------------------------------------------

                proxy.lastTest = {

                    ok:
                        result.ok,

                    status:
                        result.ok
                            ? 'OK'
                            : result.status,

                    latency:
                        result.latency,

                    timestamp:
                        Date.now(),

                    channel:
                        channel

                };


                saveConfig(
                    pageConfig
                );


                broadcastConfig();


                if (result.ok) {

                    updateProxyStatus(
                        proxy.id,
                        '🟢 OK · ' +
                        result.latency +
                        ' ms'
                    );

                } else {

                    updateProxyStatus(
                        proxy.id,
                        '🔴 ' +
                        result.status +
                        (
                            result.latency
                                ? ' · ' +
                                  result.latency +
                                  ' ms'
                                : ''
                        )
                    );

                }

            }


            updateCurrentTestInfo();


            console.log(
                '[TwitchProxy] ===== FIN TEST ====='
            );

        } finally {

            testInProgress = false;

        }

    }


    function updateProxyStatus(
        id,
        text
    ) {

        if (!dashboard) {
            return;
        }


        var element =
            dashboard.querySelector(
                '[data-status="' +
                id +
                '"]'
            );


        if (element) {

            element.textContent =
                text;

        }

    }


    // ============================================================
    // CHANNEL CACHE
    // ============================================================

    function saveLastWorkingProxy(
        channel,
        proxyId
    ) {

        try {

            var data = {};

            var existing =
                localStorage.getItem(
                    CHANNEL_CACHE_KEY
                );


            if (existing) {

                data =
                    JSON.parse(existing);

            }


            data[channel] =
                proxyId;


            localStorage.setItem(
                CHANNEL_CACHE_KEY,
                JSON.stringify(data)
            );

        } catch (e) {}

    }


    function getLastWorkingProxy(
        channel
    ) {

        try {

            var existing =
                localStorage.getItem(
                    CHANNEL_CACHE_KEY
                );


            if (!existing) {
                return null;
            }


            var data =
                JSON.parse(existing);


            return (
                data[channel] ||
                null
            );

        } catch (e) {

            return null;

        }

    }


    // ============================================================
    // CODE INJECTÉ DANS LE WORKER
    // ============================================================

    function makePatch() {

        var workerConfig =
            JSON.stringify(pageConfig);


        var lines = [];

        lines.push('(function(){');

        lines.push(
            'console.log("[TwitchProxy] Worker patch actif");'
        );

        lines.push(
            'var __tp_originalFetch = self.fetch;'
        );


        // --------------------------------------------------------
        // Configuration initiale
        // --------------------------------------------------------

        lines.push(
            'var __tp_config = ' +
            workerConfig +
            ';'
        );


        // --------------------------------------------------------
        // Réception des changements depuis le dashboard
        // --------------------------------------------------------

        lines.push(`
            try {

                var __tp_bc =
                    new BroadcastChannel(
                        'twitch-proxy-config-v1'
                    );

                __tp_bc.onmessage =
                    function(event) {

                        try {

                            if (
                                event.data &&
                                event.data.type === 'config'
                            ) {

                                __tp_config =
                                    event.data.config;

                                console.log(
                                    '[TwitchProxy] Configuration mise à jour'
                                );

                            }

                        } catch(e) {}

                    };

            } catch(e) {}

        `);


        // --------------------------------------------------------
        // Extraction channel
        // --------------------------------------------------------

        lines.push(`
            function __tp_getChannel(url){

                try {

                    var u = new URL(url);

                    var parts =
                        u.pathname
                            .split("/")
                            .filter(Boolean);

                    var i =
                        parts.indexOf("hls");

                    if (
                        i >= 0 &&
                        parts[i + 1]
                    ) {

                        var ch =
                            parts[i + 1];

                        ch =
                            ch.replace(
                                /\\.m3u8$/i,
                                ""
                            );

                        ch =
                            ch.trim()
                                .toLowerCase();

                        if (ch) {
                            return ch;
                        }

                    }

                    var q =
                        u.searchParams.get(
                            "channel"
                        );

                    if (q) {

                        q =
                            q.replace(
                                /\\.m3u8$/i,
                                ""
                            );

                        q =
                            q.trim()
                                .toLowerCase();

                        if (q) {
                            return q;
                        }

                    }

                } catch(e) {

                    console.warn(
                        "[TwitchProxy] Erreur extraction channel:",
                        e
                    );

                }

                return null;
            }
        `);


        // --------------------------------------------------------
        // Construction URL proxy
        // --------------------------------------------------------

        lines.push(`
            function __tp_buildURL(proxy, channel){

                return proxy.url.replace(
                    "{channel}",
                    encodeURIComponent(channel)
                );

            }
        `);


        // --------------------------------------------------------
        // Validation HLS
        // --------------------------------------------------------

        lines.push(`
            function __tp_validateResponse(response){

                if (
                    !response ||
                    !response.ok
                ) {
                    return Promise.resolve(false);
                }

                try {

                    return response
                        .clone()
                        .text()
                        .then(function(text){

                            return (
                                text.indexOf(
                                    "#EXTM3U"
                                ) >= 0
                                ||
                                text.indexOf(
                                    "#EXT-X-"
                                ) >= 0
                            );

                        })
                        .catch(function(){

                            return false;

                        });

                } catch(e) {

                    return Promise.resolve(false);

                }

            }
        `);


        // --------------------------------------------------------
        // Fetch avec timeout
        // --------------------------------------------------------

        lines.push(`
            function __tp_fetchProxy(
                proxyURL,
                init,
                timeout,
                controller
            ){

                return new Promise(
                    function(resolve, reject){

                        var finished = false;

                        var timer =
                            setTimeout(
                                function(){

                                    if (!finished) {

                                        finished = true;

                                        try {
                                            controller.abort();
                                        } catch(e) {}

                                        reject(
                                            new Error(
                                                "Proxy timeout"
                                            )
                                        );

                                    }

                                },
                                timeout
                            );


                        var fetchInit =
                            init
                                ? Object.assign({}, init, { signal: controller.signal })
                                : { signal: controller.signal };


                        __tp_originalFetch.call(
                            self,
                            proxyURL,
                            fetchInit
                        )
                        .then(function(response){

                            if (finished) {
                                return;
                            }

                            finished = true;

                            clearTimeout(timer);

                            resolve(response);

                        })
                        .catch(function(error){

                            if (finished) {
                                return;
                            }

                            finished = true;

                            clearTimeout(timer);

                            reject(error);

                        });

                    }
                );

            }
        `);


        // --------------------------------------------------------
        // Hook fetch
        // --------------------------------------------------------

        lines.push(`
            self.fetch = function(input, init){

                var originalURL = "";

                try {

                    if (
                        typeof input === "string"
                    ) {

                        originalURL = input;

                    } else if (
                        input &&
                        input.url
                    ) {

                        originalURL =
                            input.url;

                    }

                } catch(e) {}


                var lowerURL =
                    originalURL.toLowerCase();


                var isUsher =
                    lowerURL.indexOf(
                        "usher.ttvnw.net"
                    ) >= 0
                    ||
                    lowerURL.indexOf(
                        "usher.twitchapps.com"
                    ) >= 0;


                if (!isUsher) {

                    return __tp_originalFetch.call(
                        this,
                        input,
                        init
                    );

                }


                console.log(
                    "[TwitchProxy] Usher détecté:",
                    originalURL
                );


                var isHls =
                    lowerURL.indexOf(
                        "/hls/"
                    ) >= 0
                    ||
                    /\\.m3u8([?#]|$)/i.test(
                        originalURL
                    );


                if (!isHls) {

                    console.log(
                        "[TwitchProxy] Usher non-HLS → original"
                    );

                    return __tp_originalFetch.call(
                        this,
                        input,
                        init
                    );

                }


                var channel =
                    __tp_getChannel(
                        originalURL
                    );


                if (!channel) {

                    console.warn(
                        "[TwitchProxy] Channel introuvable"
                    );

                    return __tp_originalFetch.call(
                        this,
                        input,
                        init
                    );

                }


                var enabled =
                    (
                        __tp_config &&
                        Array.isArray(
                            __tp_config.proxies
                        )
                    )
                    ?
                    __tp_config.proxies.filter(
                        function(proxy){
                            return proxy.enabled;
                        }
                    )
                    :
                    [];


                if (!enabled.length) {

                    console.warn(
                        "[TwitchProxy] Aucun proxy activé → Twitch"
                    );

                    return __tp_originalFetch.call(
                        this,
                        input,
                        init
                    );

                }


                console.log(
                    "[TwitchProxy] ================================="
                );

                console.log(
                    "[TwitchProxy] Channel :",
                    channel
                );

                console.log(
                    "[TwitchProxy] Proxys actifs :",
                    enabled.map(
                        function(p){
                            return p.name;
                        }
                    )
                );

                console.log(
                    "[TwitchProxy] ================================="
                );


                var timeout =
                    (
                        __tp_config &&
                        __tp_config.timeout
                    )
                    ||
                    4000;


                var fallbackEnabled =
                    !(
                        __tp_config &&
                        __tp_config.fallback === false
                    );


                // Les proxys sont tentés en PARALLÈLE (au lieu
                // d'un par un) : on garde le premier qui répond
                // avec un manifest HLS valide et on annule les
                // autres tentatives encore en vol.
                var controllers =
                    [];


                var winnerFound =
                    false;


                var winnerResponse =
                    null;


                var winnerProxy =
                    null;


                console.log(
                    "[TwitchProxy] Lancement en parallèle sur " +
                    enabled.length +
                    " proxys :",
                    enabled.map(
                        function(proxy){

                            return {
                                name: proxy.name,
                                url: __tp_buildURL(proxy, channel)
                            };

                        }
                    )
                );


                var attempts =
                    enabled.map(
                        function(proxy){

                            var controller =
                                new AbortController();

                            controllers.push(
                                controller
                            );


                            var proxyURL =
                                __tp_buildURL(
                                    proxy,
                                    channel
                                );


                            var start =
                                performance.now();


                            return __tp_fetchProxy(
                                proxyURL,
                                init,
                                timeout,
                                controller
                            )
                            .then(
                                function(response){

                                    return __tp_validateResponse(
                                        response
                                    )
                                    .then(
                                        function(valid){

                                            if (!valid) {

                                                console.warn(
                                                    "[TwitchProxy] 🔴 Proxy HLS invalide:",
                                                    proxy.name
                                                );

                                                return;

                                            }


                                            if (
                                                winnerFound
                                            ) {
                                                return;
                                            }


                                            winnerFound = true;

                                            winnerResponse =
                                                response;

                                            winnerProxy =
                                                proxy;


                                            var elapsed =
                                                Math.round(
                                                    performance.now()
                                                    -
                                                    start
                                                );


                                            console.log(
                                                "[TwitchProxy] 🟢 Proxy OK:",
                                                proxy.name,
                                                response.status,
                                                elapsed + "ms"
                                            );


                                            controllers.forEach(
                                                function(other){

                                                    if (
                                                        other !==
                                                        controller
                                                    ) {

                                                        try {
                                                            other.abort();
                                                        } catch(e) {}

                                                    }

                                                }
                                            );


                                            if (__tp_bc) {

                                                try {

                                                    __tp_bc.postMessage({
                                                        type: "activeProxy",
                                                        proxyId: proxy.id,
                                                        proxyName: proxy.name,
                                                        channel: channel,
                                                        direct: false,
                                                        timestamp: Date.now()
                                                    });

                                                } catch(e) {}

                                            }

                                        }
                                    );

                                }
                            )
                            .catch(
                                function(error){

                                    if (
                                        error &&
                                        error.name === "AbortError"
                                    ) {
                                        return;
                                    }

                                    console.warn(
                                        "[TwitchProxy] 🔴 Proxy erreur:",
                                        proxy.name,
                                        error
                                    );

                                }
                            );

                        }
                    );


                return Promise.all(
                    attempts
                )
                .then(
                    function(){

                        if (
                            winnerResponse
                        ) {

                            return winnerResponse;

                        }


                        console.warn(
                            "[TwitchProxy] Tous les proxys ont échoué"
                        );


                        if (__tp_bc) {

                            try {

                                __tp_bc.postMessage({
                                    type: "activeProxy",
                                    proxyId: null,
                                    proxyName: null,
                                    channel: channel,
                                    direct: true,
                                    timestamp: Date.now()
                                });

                            } catch(e) {}

                        }


                        if (
                            fallbackEnabled
                        ) {

                            console.log(
                                "[TwitchProxy] → Fallback Twitch"
                            );

                            return __tp_originalFetch.call(
                                this,
                                input,
                                init
                            );

                        }


                        return __tp_originalFetch.call(
                            this,
                            input,
                            init
                        );

                    }.bind(this)
                );

            };
        `);


        lines.push('})();');


        return lines.join('\n');

    }


    // ============================================================
    // LECTURE BLOB WORKER
    // ============================================================

    function getBlobCode(blobURL) {

        try {

            var xhr =
                new XMLHttpRequest();


            xhr.open(
                'GET',
                blobURL,
                false
            );


            xhr.send(null);


            if (
                xhr.status >= 200 &&
                xhr.status < 300
            ) {

                return xhr.responseText;

            }

        } catch (e) {

            console.warn(
                '[TwitchProxy] Lecture Blob impossible:',
                e
            );

        }


        return null;

    }


    // ============================================================
    // HOOK WORKER
    // ============================================================

    // URL du dernier Blob Worker patché créé. On la libère
    // seulement quand un NOUVEAU Worker est créé (donc que
    // l'ancien a forcément déjà fini de charger son script),
    // pour éviter d'accumuler des Blob non libérés en mémoire
    // à chaque changement de chaîne/qualité.
    var lastPatchedBlobURL = null;


    window.Worker =
        function (
            scriptURL,
            options
        ) {

            console.log(
                '[TwitchProxy] Worker() appelé:',
                typeof scriptURL === 'string'
                    ? scriptURL.substring(
                        0,
                        120
                    )
                    : scriptURL
            );


            if (
                typeof scriptURL === 'string' &&
                scriptURL.indexOf('blob:') === 0
            ) {

                var originalCode =
                    getBlobCode(
                        scriptURL
                    );


                if (originalCode) {

                    console.log(
                        '[TwitchProxy] Blob Worker lu:',
                        originalCode.length,
                        'caractères'
                    );


                    var patchedCode =
                        makePatch() +
                        '\n' +
                        originalCode;


                    var blob =
                        new Blob(
                            [patchedCode],
                            {
                                type:
                                    'application/javascript'
                            }
                        );


                    var newURL =
                        URL.createObjectURL(
                            blob
                        );


                    if (lastPatchedBlobURL) {

                        URL.revokeObjectURL(
                            lastPatchedBlobURL
                        );

                    }

                    lastPatchedBlobURL =
                        newURL;


                    console.log(
                        '[TwitchProxy] >>> Blob Worker PATCHÉ'
                    );


                    return new NativeWorker(
                        newURL,
                        options
                    );

                }


                console.warn(
                    '[TwitchProxy] Impossible de lire le Blob → Worker original'
                );

            }


            return new NativeWorker(
                scriptURL,
                options
            );

        };


    window.Worker.prototype =
        NativeWorker.prototype;


    // ============================================================
    // INITIALISATION UI
    // ============================================================

    // ============================================================
    // TRI AUTOMATIQUE DES PROXYS PAR PING
    // ============================================================

    function autoSortProxies() {

        var tested = pageConfig.proxies.filter(function (p) {
            return p.lastTest && p.lastTest.ok;
        });

        var failed = pageConfig.proxies.filter(function (p) {
            return !p.lastTest || !p.lastTest.ok;
        });

        tested.sort(function (a, b) {
            return a.lastTest.latency - b.lastTest.latency;
        });

        var reordered = tested.concat(failed);

        // Évite de sauvegarder/broadcast/logger pour rien quand le
        // tri ne change en fait rien à l'ordre (appelé toutes les
        // minutes par le re-test périodique même sans nouveaux
        // résultats) — ça spammait la console et les Workers.
        var unchanged =
            reordered.length === pageConfig.proxies.length &&
            reordered.every(function (p, i) {
                return p.id === pageConfig.proxies[i].id;
            });

        if (unchanged) {
            return;
        }

        pageConfig.proxies = reordered;

        saveConfig(pageConfig);

        broadcastConfig();

        renderDashboard();

        console.log('[TwitchProxy] Proxys re-triés par ping');

    }


    // ============================================================
    // TEST AUTO AU DÉMARRAGE
    // ============================================================

    async function autoTestOnLoad() {

        if (testInProgress) {
            console.log('[TwitchProxy] Auto-test ignoré : un test est déjà en cours');
            return;
        }

        var channel = getTestChannel();

        if (!channel) {
            console.log('[TwitchProxy] Auto-test ignoré : pas de chaîne détectée');
            return;
        }

        var delay =
            (pageConfig.cacheDelay || DEFAULT_CACHE_DELAY) * 60 * 1000;
        var now = Date.now();

        var recentTest = pageConfig.proxies.some(function (p) {
            return (
                p.lastTest &&
                p.lastTest.channel === channel &&
                p.lastTest.timestamp &&
                (now - p.lastTest.timestamp) < delay
            );
        });

        if (recentTest) {
            console.log('[TwitchProxy] Auto-test ignoré : résultats récents');
            autoSortProxies();
            return;
        }

        var enabled = pageConfig.proxies.filter(function (p) {
            return p.enabled;
        });

        if (!enabled.length) {
            return;
        }

        testInProgress = true;

        try {

            console.log('[TwitchProxy] ===== AUTO-TEST DÉMARRAGE =====');

            for (var i = 0; i < enabled.length; i++) {

                var proxy = enabled[i];

                var result = await testProxy(proxy, channel);

                proxy.lastTest = {
                    ok: result.ok,
                    status: result.ok ? 'OK' : result.status,
                    latency: result.latency,
                    timestamp: Date.now(),
                    channel: channel
                };

            }

            autoSortProxies();

            console.log('[TwitchProxy] ===== AUTO-TEST TERMINÉ =====');

        } finally {

            testInProgress = false;

        }

    }


    // ============================================================
    // DÉTECTION NAVIGATION SPA (changement de stream sans reload)
    // ============================================================

    var lastKnownChannel = null;

    function handlePossibleChannelChange() {

        var channel = getTestChannel();

        if (!channel || channel === lastKnownChannel) {
            return;
        }

        lastKnownChannel = channel;

        console.log('[TwitchProxy] Changement de chaîne détecté :', channel);

        setTimeout(function () {
            autoTestOnLoad();
        }, 3000);

    }

    (function hookHistoryForNavigation() {

        var originalPushState = history.pushState;
        var originalReplaceState = history.replaceState;

        history.pushState = function () {

            var result = originalPushState.apply(this, arguments);

            window.dispatchEvent(new Event('tp9-locationchange'));

            return result;

        };

        history.replaceState = function () {

            var result = originalReplaceState.apply(this, arguments);

            window.dispatchEvent(new Event('tp9-locationchange'));

            return result;

        };

        window.addEventListener('popstate', function () {

            window.dispatchEvent(new Event('tp9-locationchange'));

        });

        window.addEventListener(
            'tp9-locationchange',
            handlePossibleChannelChange
        );

    })();


    function initUI() {

        if (!document.body) {

            setTimeout(
                initUI,
                100
            );

            return;

        }


        lastKnownChannel = getTestChannel();

        createPlayerButton();

        // Lancement du test auto après 3 secondes
        // (laisse le temps à la page de charger)
        setTimeout(function () {
            autoTestOnLoad();
        }, 3000);


        // Le chat Twitch déclenche des dizaines de mutations DOM
        // par seconde sur document.body : on throttle l'appel à
        // positionPlayerUI() pour éviter de le relancer en boucle
        // (les mutations de chat n'affectent quasiment jamais la
        // position réelle du bouton, un léger délai ne se voit pas).
        var positionUIThrottleTimer = null;
        var positionUILastRun = 0;
        var POSITION_UI_THROTTLE_MS = 300;

        function throttledPositionPlayerUI() {

            var now = Date.now();
            var elapsed = now - positionUILastRun;

            if (elapsed >= POSITION_UI_THROTTLE_MS) {

                positionUILastRun = now;
                positionPlayerUI();
                return;

            }

            if (positionUIThrottleTimer) {
                return;
            }

            positionUIThrottleTimer = setTimeout(
                function () {

                    positionUIThrottleTimer = null;
                    positionUILastRun = Date.now();
                    positionPlayerUI();

                },
                POSITION_UI_THROTTLE_MS - elapsed
            );

        }


        // Pour scroll/resize, la position DOIT suivre en temps réel
        // (le bouton est en position: fixed et doit rester collé au
        // bouton Follow pendant le scroll) : on cale l'appel sur
        // requestAnimationFrame plutôt que sur un délai fixe, pour
        // rester fluide (~60fps) tout en évitant les appels
        // redondants si plusieurs events arrivent avant la frame.
        var positionUIRafPending = false;

        function rafPositionPlayerUI() {

            if (positionUIRafPending) {
                return;
            }

            positionUIRafPending = true;

            requestAnimationFrame(function () {

                positionUIRafPending = false;
                positionPlayerUI();

            });

        }


        var observer =
            new MutationObserver(
                function () {

                    throttledPositionPlayerUI();

                }
            );


        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );


        window.addEventListener(
            'resize',
            rafPositionPlayerUI
        );


        window.addEventListener(
            'scroll',
            rafPositionPlayerUI,
            true
        );


        setInterval(
            positionPlayerUI,
            1500
        );


        // Re-test périodique en arrière-plan : autoTestOnLoad()
        // gère déjà lui-même le cooldown via "Re-test auto",
        // on l'appelle juste régulièrement pour qu'il puisse
        // se déclencher sans changement de chaîne ni refresh.
        setInterval(
            function () {
                autoTestOnLoad();
            },
            60 * 1000
        );

    }


    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            initUI,
            {
                once: true
            }
        );

    } else {

        initUI();

    }


    console.log(
        '[TwitchProxy] ===== HOOK INSTALLE ====='
    );

})();

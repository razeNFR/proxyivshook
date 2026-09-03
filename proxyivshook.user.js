// ==UserScript==
// @name         Twitch HLS Proxy v1.0.3
// @namespace    twitch-proxy-ivs
// @version      1.0.3
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

    var DEFAULT_TIMEOUT = 4000;

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
            id: 'luminous-eu3',
            name: 'Luminous EU 3',
            url: 'https://eu3.luminous.dev/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
        },
        {
            id: 'perfprod-eu',
            name: 'Perfprod EU',
            url: 'https://lb-eu.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
        },
        {
            id: 'perfprod-eu2',
            name: 'Perfprod EU 2',
            url: 'https://lb-eu2.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
        },
        {
            id: 'perfprod-eu3',
            name: 'Perfprod EU 3',
            url: 'https://lb-eu3.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
        },
        {
            id: 'perfprod-eu4',
            name: 'Perfprod EU 4',
            url: 'https://lb-eu4.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
        },
        {
            id: 'perfprod-na',
            name: 'Perfprod NA',
            url: 'https://lb-na.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
        },
        {
            id: 'perfprod-as',
            name: 'Perfprod Asia',
            url: 'https://lb-as.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
        },
        {
            id: 'perfprod-sa',
            name: 'Perfprod SA',
            url: 'https://lb-sa.cdn-perfprod.com/live/{channel}?allow_source=true&allow_audio_only=true&fast_bread=true',
            enabled: false
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


    function loadConfig() {

        var config = {
            proxies: DEFAULT_PROXIES.map(
                createDefaultProxy
            ),
            fallback: true,
            timeout: DEFAULT_TIMEOUT
        };

        try {

            var saved =
                localStorage.getItem(
                    STORAGE_KEY
                );

            if (saved) {

                var parsed =
                    JSON.parse(saved);

                if (
                    parsed &&
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

            }

        } catch (e) {

            console.warn(
                '[TwitchProxy] Configuration invalide:',
                e
            );

        }

        return config;

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


    var pageConfig =
        loadConfig();


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
                            DEFAULT_TIMEOUT

                    };


                    saveConfig(
                        pageConfig
                    );

                    broadcastConfig();

                    renderDashboard();

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
                '.tp9-timeout-select'
            )
            .value =
            String(
                pageConfig.timeout
            );


        updateCurrentTestInfo();

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


    function positionPlayerUI() {

        if (!dashboardButton) {
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

    function getTestChannel() {

        try {

            var path =
                location.pathname
                    .split('/')
                    .filter(Boolean);


            if (
                path.length &&
                path[0] &&
                path[0] !== 'directory' &&
                path[0] !== 'search' &&
                path[0] !== 'downloads'
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
                timeout
            ){

                return new Promise(
                    function(resolve, reject){

                        var finished = false;

                        var timer =
                            setTimeout(
                                function(){

                                    if (!finished) {

                                        finished = true;

                                        reject(
                                            new Error(
                                                "Proxy timeout"
                                            )
                                        );

                                    }

                                },
                                timeout
                            );


                        __tp_originalFetch.call(
                            self,
                            proxyURL,
                            init
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


                var chain =
                    Promise.resolve();


                var successfulResponse =
                    null;


                enabled.forEach(
                    function(proxy, index){

                        chain =
                            chain.then(
                                function(){

                                    if (
                                        successfulResponse
                                    ) {
                                        return;
                                    }


                                    var proxyURL =
                                        __tp_buildURL(
                                            proxy,
                                            channel
                                        );


                                    console.log(
                                        "[TwitchProxy] Test proxy:",
                                        proxy.name
                                    );

                                    console.log(
                                        "[TwitchProxy] URL:",
                                        proxyURL
                                    );


                                    var start =
                                        performance.now();


                                    return __tp_fetchProxy(
                                        proxyURL,
                                        init,
                                        timeout
                                    )
                                    .then(
                                        function(response){

                                            return __tp_validateResponse(
                                                response
                                            )
                                            .then(
                                                function(valid){

                                                    if (
                                                        valid
                                                    ) {

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


                                                        successfulResponse =
                                                            response;


                                                        return;

                                                    }


                                                    console.warn(
                                                        "[TwitchProxy] 🔴 Proxy HLS invalide:",
                                                        proxy.name
                                                    );

                                                }
                                            );

                                        }
                                    )
                                    .catch(
                                        function(error){

                                            console.warn(
                                                "[TwitchProxy] 🔴 Proxy erreur:",
                                                proxy.name,
                                                error
                                            );

                                        }
                                    );

                                }
                            );

                    }
                );


                return chain.then(
                    function(){

                        if (
                            successfulResponse
                        ) {

                            return successfulResponse;

                        }


                        console.warn(
                            "[TwitchProxy] Tous les proxys ont échoué"
                        );


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

    function initUI() {

        if (!document.body) {

            setTimeout(
                initUI,
                100
            );

            return;

        }


        createPlayerButton();


        var observer =
            new MutationObserver(
                function () {

                    positionPlayerUI();

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
            positionPlayerUI
        );


        window.addEventListener(
            'scroll',
            positionPlayerUI,
            true
        );


        setInterval(
            positionPlayerUI,
            1500
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

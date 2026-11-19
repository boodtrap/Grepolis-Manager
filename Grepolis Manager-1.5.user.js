// ==UserScript==
// @name         Grepolis Manager
// @namespace    https://github.com/zambia1972/Grepolis-Manager
// @version      1.5
// @description  Hoofdscript: GM UI (Startscherm, Instellingen, Wereldinfo) + GM-tools als tabs in GM-paneel (IconTools, Map, Trade, Rapporten, Goden, Units, Forum, Troepen, Afwezigheid) — Farm Alert, Gold Alert
// @author       Zambia1972, Copyright (c) 2025
// @copyright    Copyright (c) 2025, Zambia1972
// @match        https://*.grepolis.com/*
// @connect      nl.forum.grepolis.com
// @connect      forum.grepolis.net
// @icon         https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-GM.png
// @resource     iconGM https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-GM.png
// @resource     iconInstellingen https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/instellingen.png
// @resource     iconWereldinfo https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/wereldinfo.png
// @resource     iconForum https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-forummanager.png
// @resource     iconTroop https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-troopmanager.png
// @grant        GM_getValue
// @grant        GM_getResourceURL
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @grant        GM_listValues
// @connect      api.grepodata.com
// @connect      gme.cyllos.dev
// @connect      grcrt.net
// @connect      *.grcrt.net
// @connect      www.grcrt.net
// @connect      cdn.grcrt.net
// @connect      dio-david1327.github.io
// @connect      discord.com
// @connect      discordapp.com
// @connect      *.supabase.co
// @connect      supabase.co
// @connect      *.grepolis.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = false; // zet true voor extra debug output

    // Hulpfunctie om CORS te omzeilen in userscripts
    // Vervang bestaande gmFetch functie door deze robuuste versie
    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const cb = (response) => {
                try {
                    const status = response.status || response.statusCode || 0;
                    if (status >= 200 && status < 300) {
                        resolve({
                            ok: true,
                            status,
                            json: async () => {
                                try { return JSON.parse(response.responseText || response.response || ''); }
                                catch (e) { throw new Error('Invalid JSON response: ' + e.message); }
                            },
                            text: async () => (response.responseText || response.response || '')
                        });
                    } else {
                        reject(new Error(`HTTP ${status}: ${response.responseText || response.response || ''}`));
                    }
                } catch (err) { reject(err); }
            };

            // Kies GM_xmlhttpRequest (legacy) of GM.xmlHttpRequest (new)
            const gmXhr = (typeof GM_xmlhttpRequest === 'function')
            ? GM_xmlhttpRequest
            : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function')
            ? GM.xmlHttpRequest
            : null;

            if (!gmXhr) {
                // Fallback naar native fetch (let op CORS)
                fetch(url, options).then(async r => {
                    const txt = await r.text();
                    if (r.ok) resolve({ ok: true, status: r.status, json: async () => JSON.parse(txt), text: async () => txt });
                    else reject(new Error(`HTTP ${r.status}: ${txt}`));
                }).catch(reject);
                return;
            }

            try {
                gmXhr({
                    method: options.method || 'GET',
                    url,
                    headers: options.headers || {},
                    data: options.body || options.data || null,
                    responseType: options.responseType || 'text',
                    onload: cb,
                    onerror: (err) => reject(err),
                    ontimeout: (err) => reject(err),
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    // ----stijlen -----

    function injectGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
    :root {
        --gm-color-primary: #FF0000;
        --gm-color-bg: #1e1e1e;
        --gm-color-text: #fff;
        --gm-color-muted: #ccc;
        --gm-spacing-sm: 6px;
        --gm-spacing-md: 12px;
        --gm-spacing-lg: 20px;
        --gm-radius: 8px;
        --gm-shadow: 0 0 15px var(--gm-color-primary);
    }
    h2 {
        color: red !important;
    }

    /* ====== Panels (uniforme basis) ====== */
    .gm-panel {
        position: fixed;
        top: 0;
        right: 0;
        height: 95%;
        min-width: 00px;
        max-width: 50%;
        background: rgba(20,20,20,0.95);
        color: var(--gm-color-text);
        z-index: 10000;
        overflow-y: auto;
        padding: var(--gm-spacing-md);
        box-shadow: -2px 0 6px rgba(0,0,0,0.6);
        border: 2px solid var(--gm-color-primary);
        border-radius: var(--gm-radius);
        display: none;
        will-change: auto; /* voorkom GPU constant repaints */
        backface-visibility: hidden; /* stabiliseert rendering */
    }
    .gm-panel.active { display: block; }

    /* Groottes */
    .gm-panel-small  { width: 400px; min-height: 200px; }
    .gm-panel-medium { width: 600px; min-height: 300px; }
    .gm-panel-large  { width: 500px; min-height: 420px; }
    .gm-panel-wide   { width: 800px; min-height: 400px; }

    /* Panel header */
    .gm-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--gm-spacing-md);
    }
    .gm-panel-title {
        font-weight: bold;
        color: var(--gm-color-primary);
    }
    .gm-close-btn {
        background: none;
        border: none;
        color: var(--gm-color-primary);
        font-size: 18px;
        cursor: pointer;
    }

    /* ====== Buttons ====== */
    #gm-button-container {
        position:fixed;
        top:1px;
        left:430px;
        display:inline-flex;
        flex-direction:row;
        gap:1px;
        z-index:9999;
        background:rgba(0,0,0,0.2);
        padding:2px;
        width:auto;
        height:auto;
    }
    #gm-button-container .gm-toggle-button {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        cursor: pointer;
    }
    .gm-button {
        background: #000;
        color: var(--gm-color-primary);
        border: 1px solid var(--gm-color-primary);
        padding: var(--gm-spacing-sm) var(--gm-spacing-md);
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    }
    .gm-button:hover {
        background: var(--gm-color-primary);
        color: #fff;
    }

    /* ====== Inputs ====== */
    .gm-input {
        width: 100%;
        padding: var(--gm-spacing-sm);
        border-radius: 4px;
        border: 1px solid #444;
        background: #222;
        color: var(--gm-color-text);
    }

    /* ====== Links ====== */
    .gm-link {
        display: inline-block;
        background-color: var(--gm-color-primary);
        color: #fff;
        padding: 5px 10px;
        font-size: 11px;
        border-radius: 4px;
        text-decoration: none;
        margin-top: 5px;
    }

    /* ====== Notifications ====== */
    .gm-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: var(--gm-spacing-sm) var(--gm-spacing-lg);
        border-radius: var(--gm-radius);
        color: #fff;
        box-shadow: var(--gm-shadow);
        animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
        z-index: 10001;
    }
    .gm-notification.success { background-color: #4CAF50; }
    .gm-notification.error { background-color: #F44336; }

    /* ====== Helpers ====== */
    .gm-muted { color: var(--gm-color-muted); font-size: 13px; }
    .gm-card {
        background: rgba(255,255,255,0.05);
        padding: 8px;
        border-radius: 6px;
        font-weight: bold;
        color: #FFCC66;
        text-shadow: 1px 1px 2px #000;
        font-size: 10px;
        margin-top: 15px;
    }
    .gm-muted-box {
        display: none;
        margin-top: 15px;
        background: #111;
        padding: 10px;
        border: 1px solid #444;
        border-radius: 8px;
        max-height: 300px;
        overflow-y: auto;
        font-size: 13px;
        color: var(--gm-color-muted);
    }

    /* ====== Troop Manager (units) ====== */
    /* Troopmanager unified styles */
    #gm-panel-troopmanager .tm-units-row{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      align-items:center;
      margin-top:4px;
    }

    /* individuele unit (sprite) — geen scaling hier: achtergrond-size wordt op runtime gezet */
    #gm-panel-troopmanager .tm-unit{
      display:block;
      flex: 0 0 40px;
      width:40px;
      height:40px;
      background-repeat:no-repeat;
      background-position: 0 0; /* wordt overschreven inline door renderUnitIcon */
      overflow:visible;
      position:relative;
      border-radius:4px;
      box-shadow: 0 1px 0 rgba(0,0,0,0.25) inset;
    }

    /* aantal rechts-onder — zwart met witte 'stroke' voor leesbaarheid */
    #gm-panel-troopmanager .tm-unit .tm-unit-count{
      position: absolute;
      right: 2px;
      bottom: 2px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      background: rgba(0,0,0,0.8); /* donker balkje */
      padding: 0 4px;
      border-radius: 3px;
      line-height: 14px;
      text-shadow: none; /* geen witte outline meer */
    }
    #gm-panel-troopmanager .tm-units-grid {
      display: grid;
      grid-template-columns: 1fr; /* twee kolommen */
      gap: 8px;
    }
    .tm-units-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;  /* ruimte tussen iconen */
        margin-bottom: 10px;
    }
    .tm-unit {
        position: relative;
        width: 40px;   /* vaste breedte */
        height: 40px;  /* vaste hoogte */
    }
    .tm-unit img {
        width: 100%;
        height: 100%;
        display: block;
    }
    .tm-unit-count {
        position: absolute;
        bottom: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        font-size: 11px;
        padding: 1px 3px;
        border-top-left-radius: 4px;
    }
    `;
        document.head.appendChild(style);
    }


    function createPopup(id, title, contentHTML, sizeClass = 'gm-panel-medium') {
        let popup = document.getElementById(id);
        if (!popup) {
            popup = document.createElement('div');
            popup.id = id;
            popup.className = `gm-panel ${sizeClass} `;
            popup.innerHTML = `
      <div class="gm-panel-header">
        <span class="gm-panel-title">${title}</span>
        <button class="gm-close-icon">✖</button>
      </div>
      <div class="gm-panel-body">${contentHTML}</div>
    `;
            document.body.appendChild(popup);

            // sluit-handler (geen inline handlers)
            popup.querySelector('.gm-close-icon').addEventListener('click', () => {
                popup.classList.remove('active');
            });
        }
        // retourneer popup element (nog niet openen)
        return popup;
    }

    function openPopup(id) {
        document.querySelectorAll('.gm-panel').forEach(el => el.classList.remove('active'));
        const popup = document.getElementById(id);
        if (popup) popup.classList.add('active');
    }

    class GrepolisManager {
        constructor() {
            // Ensure settings exist and include wereldInfoUrl (used by WereldInfo)
            if (!this.settings) this.settings = {};
            if (!this.settings.wereldInfoUrl) {
                const defaultUrl = (this.config && this.config.wereldInfo && this.config.wereldInfo.wereldInfoUrl)
                ? this.config.wereldInfo.wereldInfoUrl
                : `https://${window.location.host}/game/world_info`;
                this.settings.wereldInfoUrl = defaultUrl;
            }

            // Ensure wereldInfo config exists to avoid undefined errors
            if (!this.config) this.config = {};
            if (!this.config.wereldInfo) {
                this.config.wereldInfo = {
                    wereldInfoUrl: `https://${window.location.host}/game/world_info`
                };
            }

            this.uw = unsafeWindow;
            // Configuratie
            this.settingsWindow = new SettingsWindow(this);
            this.isUIInjected = false;
            this.modules = {};
            this.buttonStates = [false, false, false, false, false, false, false];
            this.buttonIcons = [
                'iconGM',
            ];

            this.iconUrls = {}; // Slaat de icon URLs op

            this.config = {
                wereldInfo: {
                    wereldInfoUrl: `https://${window.location.host}/game/world_info` // voorbeeld
                },
            };

            injectGlobalStyles();
            this.load(); // Start het asynchrone laadproces
        }

        openPanel(id, renderFn, sizeClass = 'gm-panel-medium') {
            // Sluit bestaande panelen met dezelfde id
            const old = document.getElementById(`gm-panel-${id}`);
            if (old) old.remove();

            // Paneel
            const panel = document.createElement('div');
            panel.id = `gm-panel-${id}`;
            panel.className = `gm-panel ${sizeClass} active`;

            // Sluitknop
            const closeBtn = document.createElement('button');
            closeBtn.className = 'gm-close-btn';
            closeBtn.textContent = '×';
            closeBtn.onclick = () => panel.remove();
            panel.appendChild(closeBtn);

            // Content-holder
            const content = document.createElement('div');
            content.className = 'gm-panel-body';
            panel.appendChild(content);

            // Inhoud renderen (exact één keer)
            if (typeof renderFn === 'function') {
                renderFn(content);
            } else {
                content.textContent = `Paneel geopend: ${id}`;
            }

            document.body.appendChild(panel);
        }

        async load() {
            const banned = await GM_getValue('banned_players', []);
            const name = (this.uw?.Game?.player_name || '').toString().trim();
            if (banned.includes(name)) {
                alert("Je bent geblokkeerd van dit script.");
                throw new Error("Geblokkeerde gebruiker.");
            }
            // GrepoData optioneel: niet verplicht bij opstarten
            const token = GM_getValue('grepodata_token', null);
            this.grepodataToken = token || null; // Geen login-popup meer
            await this.loadResources();
            try {
                await this.initializeManagers();
            } catch (e) {
                console.error('Fout in initializeManagers – ga toch door met knoppen:', e);
            } finally {
                this.initializeButtons();
            }
            window.GrepoMain = this;
        }



        async initializeManagers() {
            this.modules.wereldinfo = new WereldInfo(this);

            // <<< GrepoData optioneel: vraag token maar blokkeer init niet
            try {
                const base = new BaseManager(this);
                await base.getWebSocketToken();
            } catch (e) {
                console.warn('GrepoData token niet beschikbaar, ga door zonder:', e);
            }
        }

        async loadResources() {
            // Laad alle resources en sla de URLs op
            try {

                for (const icon of this.buttonIcons) {
                    if (!icon || String(icon).startsWith('emoji:')) continue;
                    this.iconUrls[icon] = await this.getResource(icon);
                }
            } catch (error) {
                console.error('Fout bij laden resources:', error);
                // Fallback naar directe URLs als GM_getResourceURL niet werkt
                this.iconUrls = {
                    iconGM: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-GM.png',
                    iconInstellingen: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/instellingen.png',
                    iconWereldinfo: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/wereldinfo.png',
                    iconForum: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-forummanager.png',
                    iconTroop: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-troopmanager.png',
                };
            }
        }

        getResource(name) {
            return new Promise((resolve, reject) => {
                if (typeof GM_getResourceURL === 'function') {
                    resolve(GM_getResourceURL(name));
                } else {
                    reject(new Error('GM_getResourceURL niet beschikbaar'));
                }
            });
        }
        renderDashboardTab(container) {
            const header = document.createElement("h2");
            header.innerText = "Grepolis Manager Dashboard";
            container.appendChild(header);
        }

        // ============ //
        // initializers //
        // ============ //

        initializeButtons() {
            // voorkom dubbele container
            if (document.getElementById('gm-button-container')) return;

            const container = document.createElement('div');
            container.id = 'gm-button-container';
            document.body.appendChild(container);

            // Titels (zichtbaar als tooltip)
            const buttonTitles = [
                'Grepolis Manager'
            ];

            // callbacks (zelfde logica als jouw oorspronkelijke callbacks - roept module toggles etc. aan)
            const callbacks = [
                // Enige knop: opent het complete Grepolis Manager-paneel
                (active) => {
                    if (active) {
                        this.openGmbPanel();
                    } else {
                        document.getElementById("gm-panel-gmb")?.remove();
                    }
                }
            ];

            // Zorg dat buttonStates overeenkomen met aantal buttons
            this.buttonStates = new Array(buttonTitles.length).fill(false);

            // Sprite URL (hergebruikt wat je al gebruikte)
            const spriteUrl = 'https://gpnl.innogamescdn.com/images/game/autogenerated/layout/layout_095495a.png';

            // Bouw **alleen** de originele achtergrond-knoppen (één set)
            callbacks.forEach((callback, index) => {
                const button = document.createElement('div');
                button.className = 'gm-toggle-button gm-original-button';
                button.title = buttonTitles[index];
                button.dataset.index = index;

                // basisstijl (sprite)
                button.style.background = `url(${spriteUrl}) no-repeat -607px -182px`;
                button.style.width = '32px';
                button.style.height = '32px';
                button.style.display = 'flex';
                button.style.alignItems = 'center';
                button.style.justifyContent = 'center';
                button.style.cursor = 'pointer';

                // overlay icon (indien beschikbaar uit je resources)
                let iconEl;
                if (this.buttonIcons && this.buttonIcons[index] && this.iconUrls && this.iconUrls[this.buttonIcons[index]]) {
                    iconEl = document.createElement('img');
                    iconEl.src = this.iconUrls[this.buttonIcons[index]];
                    iconEl.style.width = '20px';
                    iconEl.style.height = '20px';
                    iconEl.style.pointerEvents = 'none';
                } else {
                    iconEl = document.createElement('span');
                    const iconKey = this.buttonIcons && this.buttonIcons[index];
                    iconEl.textContent = iconKey && String(iconKey).startsWith('emoji:') ? String(iconKey).slice(6) : (iconKey ? '' : '🏝️');
                    iconEl.style.fontSize = '16px';
                    iconEl.style.pointerEvents = 'none';
                }
                button.appendChild(iconEl);

                // click handler: toggle state, wijzig spritepositie, en roep callback aan
                button.addEventListener('click', () => {
                    const idx = Number(button.dataset.index);
                    this.buttonStates[idx] = !this.buttonStates[idx];

                    // visuele toggle (on/off sprite)
                    button.style.background = this.buttonStates[idx]
                        ? `url(${spriteUrl}) no-repeat -639px -214px`
                    : `url(${spriteUrl}) no-repeat -607px -182px`;

                    // roep module-callback aan (safe)
                    try {
                        callback(this.buttonStates[idx]);
                    } catch (err) {
                        console.error('GM button callback error:', err);
                    }
                });

                container.appendChild(button);
            });

            // klaar — container is al eenmaal in DOM geplaatst
        }

        // ================== //
        // Startscherm inhoud //
        // ================== //

        showUI(container) {
            const playerName = this.uw?.Game?.player_name || 'Speler';

            const buttonIndex = 0; // Index van de startschermknop
            const startButton = document.querySelector(`#gm-button-container .gm-toggle-button[data-index="${buttonIndex}"]`);

            if (this.buttonStates[buttonIndex]) {
                if (startButton) {
                    startButton.style.background = 'url(https://gpnl.innogamescdn.com/images/game/autogenerated/layout/layout_095495a.png) no-repeat -607px -182px';
                }
            }

            const popup = document.createElement('div');
            popup.id = 'gm-popup';
            container.innerHTML = `

                    <h2>Welkom ${playerName} bij Grepolis Manager</h2>
                    <p>Dit script combineert de kracht van populaire Grepolis-tools in één handige oplossing en nog veel meer.</p>
                    <p>Selecteer een module via de knoppenbalk bovenaan het scherm.</p>
                    <h3>Beschikbare modules:</h3>
                    <ul>
                        <li><strong>⚙️ Instellingen</strong> – Pas je voorkeuren en Supabase-configuratie aan. Hier kun je ook API-keys of scriptopties beheren.</li>
                        <li><strong>🌍 Wereldinfo</strong> – Geeft een overzicht van spelers, allianties, steden, veroveringen en ranglijsten uit de officiële Grepolis databestanden.</li>
                        <li><strong>🗺️ Map Overlay</strong> – Voeg extra informatie toe aan de wereldkaart (bijv. sectoren, filters, markeringen).</li>
                        <li><strong>🛠 GMB Tools</strong> – Alle GMB-functionaliteit (IconTools, Map Enhancer, Trade-venster, Rapporten, Goden, Units, Forum) in een eigen paneel.</li>
                    </ul>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px;">
                    ${[
                {
                    name: "Grepotools",
                    img: "https://www.grepotools.nl/wp-content/uploads/2022/08/logo_425x425.png",
                    description: "Script, tools en informatie voor Grepolis.",
                    url: "https://www.grepotools.nl/script/stable/grepotools.user.js"
                },
                {
                    name: "DIO-Tools",
                    img: "https://dio-david1327.github.io/img/site/btn-dio-settings.png",
                    description: "Extra opties voor een verbeterde gameplay.",
                    url: "https://dio-david1327.github.io/DIO-TOOLS-David1327/code.user.js"
                },
                {
                    name: "GRCRTools",
                    img: "https://cdn.grcrt.net/img/octopus.png",
                    description: "Krachtige tools voor rapporten en gameplay.",
                    url: "https://www.grcrt.net/scripts/GrepolisReportConverterV2.user.js"
                },
                {
                    name: "Map Enhancer",
                    img: "https://gme.cyllos.dev/res/icoon.png",
                    description: "Verbeter de kaartweergave met extra functies.",
                    url: "https://gme.cyllos.dev/GrepolisMapEnhancer.user.js"
                },
                {
                    name: "GrepoData",
                    img: "https://grepodata.com/favicon.ico",
                    description: "Geavanceerde tools en statistieken voor Grepolis.",
                    url: "https://api.grepodata.com/script/indexer.user.js"
                },
                {
                    name: "Forum Template",
                    img: "https://i.postimg.cc/7Pzd6360/def-button-2.png",
                    description: "Genereert een forumsjabloon met eenheden, gebouwen en stadsgod.",
                    url: "https://update.greasyfork.org/scripts/512594/Grepolis%20Notepad%20Forum%20Template%203.user.js"
                }

            ].map(tool => `
                        <div style="flex: 1; min-width: 150px; text-align: center;">
                            <img src="${tool.img}" alt="${tool.name}" style="width: 50px; height: 50px;">
                            <p style="font-size: 12px; font-weight: bold;">${tool.name}</p>
                            <p style="font-size: 12px;">${tool.description}</p>
                            <a href="${tool.url}" target="_blank" class="gm-link">Download script</a>
                        </div>
                    `).join('')}
                </div>

                <div style="margin-top: 20px; text-align: center;">
                    <p style="font-size: 12px; font-style: italic;">Het Grepolis Manager Team</p>
                    <div style="display: flex; justify-content: center; gap: 20px; margin-top: 10px;">
                        <div>
                            <p style="font-size: 12px; font-weight: bold;">Zambia1972</p>
                            <img src="https://imgur.com/uHRXM9u.png" alt="Zambia1972 Handtekening" class="gm-signature-large">
                        </div>

                    </div>
                    <div>
                        <p style="font-size: 14px;">© 2025 | Zambia1972 | boodtrap | Gevers Hans, All rights reserved.</p>
                    </div>
                </div>
            `;

            const closeButton = document.createElement('button');
            closeButton.textContent = 'Sluiten';
            closeButton.className = 'gm-close-btn';

            closeButton.addEventListener('click', () => {
                popup.remove();
                this.buttonStates[buttonIndex] = false;

                if (startButton) {
                    startButton.style.background = 'url(https://gpnl.innogamescdn.com/images/game/autogenerated/layout/layout_095495a.png) no-repeat -607px -182px';
                }
            });

            popup.appendChild(closeButton);
            document.body.appendChild(popup);
        }

        openGmbPanel() {
            this.openPanel("gmb", (container) => {
                container.innerHTML = '<div id="gm-gmb-mount" style="height:70vh;min-height:420px;"></div>';
                const mount = container.querySelector('#gm-gmb-mount');
                const attach = () => {
                    const gmbUI = window.GMB_UI;
                    if (gmbUI && typeof gmbUI.attachTo === 'function' && gmbUI.panel) {
                        const ok = gmbUI.attachTo(mount);
                        if (ok) this.ensureGmbTabs();
                        return ok;
                    }
                    return false;
                };
                if (!attach()) {
                    let tries = 0;
                    const timer = setInterval(() => {
                        if (attach() || ++tries > 150) clearInterval(timer);
                    }, 200);
                }
            }, 'gm-panel-large');
        }

        ensureGmbTabs() {
            const ui = window.GMB_UI;
            const main = window.GrepoMain;
            if (!ui || !ui.panel || !main) return false;
            try {
                if (!(ui.panel && ui.panel.querySelector('#gmb-tab-gm-wereldinfo')) && main.modules && main.modules.wereldinfo) {
                    ui.addTab('gm-wereldinfo', '🌍 Wereldinfo', '<div id="gmb-wi-root" style="padding:8px;"></div>');
                    const root = document.getElementById('gmb-wi-root');
                    if (root) main.modules.wereldinfo.render(root);
                }
                if (!(ui.panel && ui.panel.querySelector('#gmb-tab-gm-beheer')) && main.settingsWindow) {
                    ui.addTab('gm-beheer', '⚙ Beheer', '<div id="gmb-beheer-root" style="padding:8px;"></div>');
                    const root = document.getElementById('gmb-beheer-root');
                    if (root) {
                        hasAdminAccess(main).then(ok => {
                            if (ok) main.settingsWindow.render(root);
                            else root.innerHTML = '<p class="gm-muted">Alleen toegankelijk voor beheerders.</p>';
                        });
                    }
                }
                return true;
            } catch (e) {
                console.warn('[GM] ensureGmbTabs:', e);
                return false;
            }
        }

        showNotification(message, isSuccess = true) {
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.className = `gm-notification ${isSuccess ? 'success' : 'error'}`;

            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.animation = 'fadeOut 0.3s';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    // ============================== //
    // Basisklasse voor alle managers //
    // ============================== //

    class BaseManager {

        constructor(mainManager) {
            this.main = mainManager;
            this.uw = mainManager?.uw || unsafeWindow;
            this._events = new WeakMap();
            this._intervals = new Set();
            this._timeouts = new Set();
            this.logger = this._createLogger();
            this.accessToken = (typeof GM_getValue === 'function') ? GM_getValue('grepodata_token', null) : null;
        }

        _createLogger() {
            const prefix = `[${this.constructor.name}]`;
            return {
                log: (...args) => console.log(prefix, ...args),
                warn: (...args) => console.warn(prefix, ...args),
                error: (...args) => console.error(prefix, ...args),
                debug: (...args) => (typeof DEBUG !== 'undefined' && DEBUG) && console.debug(prefix, ...args),
            };
        }

        addEvent(element, event, handler, options) {
            if (!element) return;
            element.addEventListener(event, handler, options);
            const handlers = this._events.get(element) || [];
            handlers.push({ event, handler, options });
            this._events.set(element, handlers);
        }

        removeEvents(element) {
            if (!element) return;
            const handlers = this._events.get(element);
            if (!handlers) return;
            for (const { event, handler, options } of handlers) {
                try { element.removeEventListener(event, handler, options); } catch (e) { /* ignore */ }
            }
            this._events.delete(element);
        }

        // destroy() methode aanpassen:
        destroy() {
            // Alle events netjes verwijderen
            for (const element of this._events.keys()) {
                this.removeEvents(element);
            }
            this._events = new WeakMap();

            // Eventuele timers stoppen
            if (this._intervals) {
                for (const id of this._intervals) {
                    clearInterval(id);
                }
                this._intervals.clear();
            }
        }

        // Hulpfunctie voor veilige token-logging
        _maskToken(t) {
            return t ? `${t.slice(0, 12)}…${t.slice(-6)}` : '(leeg)';
        }

        // Haal token op via GrepoData en zet het óók lokaal
        async getAccessTokenFromGrepoData(email, password) {
            try {
                const url = 'https://api.grepodata.com/login';
                const params = new URLSearchParams({ email, password });

                // Oude token eerst weggooien (optioneel)
                GM_deleteValue('grepodata_token');
                GM_deleteValue('grepodata_token_time');

                const resp = await gmFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await resp.json();

                if (!resp.ok || !data?.access_token) {
                    throw new Error(data?.message || 'Login mislukt');
                }

                const token = data.access_token;

                // 📌 Pas nu opslaan
                GM_setValue('grepodata_token', token);
                GM_setValue('grepodata_token_time', Date.now());

                // Handig om lokaal bij te houden
                this.accessToken = token;

                return token;
            } catch (e) {
                this.showNotification('Inloggen bij GrepoData mislukt.', false);
                throw e;
            }
        }

        showLoginPopup() {
            // GrepoData login uitgeschakeld — geen popup tonen
            // Retourneer direct null zodat callers weten dat er geen token is.
            return Promise.resolve(null);
        }

        // Centrale toegangspunt voor het token (wacht op login indien nodig)
        async getWebSocketToken() {
            // 1. Als er al een geldig token in memory zit
            if (this.accessToken) {
                return this.accessToken;
            }

            // 2. Check storage
            try {
                const stored = GM_getValue('grepodata_token', null);
                const ts     = GM_getValue('grepodata_token_time', 0);

                // Controleer of ouder dan 24 uur
                const expired = !ts || (Date.now() - ts > 24 * 60 * 60 * 1000);

                if (stored && !expired) {
                    this.accessToken = stored;
                    return stored;
                }
            } catch (e) {
                console.warn("[GrepoData] Kon token niet laden uit storage:", e);
            }

            // 3. Geen of verlopen token → probeer login-popup (maar faal zachtjes)
            console.warn("[GrepoData] Nieuw token nodig. Toon login-popup… (optioneel)");
            try {
                const token = await this.showLoginPopup().catch(() => null);
                if (!token) {
                    console.warn('[GrepoData] Geen token verkregen — ga verder zonder GrepoData.');
                    return null;
                }
                this.accessToken = token;
                GM_setValue('grepodata_token', token);
                GM_setValue('grepodata_token_time', Date.now());
                return token;
            } catch (e) {
                console.warn('[GrepoData] showLoginPopup faalde:', e);
                return null;
            }
        }

        async getPlayerIntel(world, playerId) {
            if (!this.accessToken) { this.logger?.warn('Geen accessToken beschikbaar — GrepoData call overgeslagen'); return null; };

            const url = `https://api.grepodata.com/indexer/v2/player?world=${world}&player_id=${playerId}&access_token=${this.accessToken}`;

            const response = await gmFetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${this.accessToken}`
                }
            });

            return await response.json();
        }


        async getAllianceIntel(allianceId, world) {
            if (!this.accessToken) { this.logger?.warn('Geen accessToken beschikbaar — GrepoData call overgeslagen'); return null; };

            const url = `https://api.grepodata.com/indexer/v2/alliance?world=${world}&alliance_id=${allianceId}&access_token=${this.accessToken}`;
            console.log("[GrepoData] GET AllianceIntel:", url);

            const response = await gmFetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${this.accessToken}`
                }
            });

            return await response.json();
        }

        async getTownIntel(townId, world) {
            if (!this.accessToken) { this.logger?.warn('Geen accessToken beschikbaar — GrepoData call overgeslagen'); return null; };

            const url = `https://api.grepodata.com/indexer/v2/town?world=${world}&town_id=${townId}&access_token=${this.accessToken}`;
            console.log("[GrepoData] GET TownIntel:", url);

            const response = await gmFetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${this.accessToken}`
                }
            });

            return await response.json();
        }

        worldData = {
            _cache: {
                players: null,
                alliances: null,
                towns: null,
                conquers: null,
                islands: null,
                kills_all: null,
                kills_att: null,
                kills_def: null
            },
            _lastWorld: null,
            _lastHost: null,

            _currentWorldHost() {
                // vb: "nl123.grepolis.com"
                return window.location.host;
            },
            _currentWorldPrefix() {
                // vb: "nl123"
                return window.location.host.split('.')[0];
            },
            _needsReset() {
                const host = this._currentWorldHost();
                if (this._lastHost !== host) {
                    this._lastHost = host;
                    this._lastWorld = this._currentWorldPrefix();
                    // reset cache
                    Object.keys(this._cache).forEach(k => this._cache[k] = null);
                    return true;
                }
                return false;
            },

            async _fetchText(url, timeout = 10000) {
                const controller = new AbortController();
                const t = setTimeout(() => controller.abort(), timeout);
                try {
                    const res = await fetch(url, { signal: controller.signal, credentials: 'omit' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return await res.text();
                } finally {
                    clearTimeout(t);
                }
            },

            _parseCSV(text) {
                if (!text) return [];
                const lines = text.trim().split(/\r?\n/);
                // detecteer delimiter (eerste regel)
                const header = lines[0] || '';
                const commaCount = (header.match(/,/g) || []).length;
                const tabCount = (header.match(/\t/g) || []).length;
                const delim = tabCount > commaCount ? '\t' : ',';

                const parseLine = (line) => {
                    const result = [];
                    let cur = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i];
                        if (ch === '"') {
                            // dubbele quote escape
                            if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
                            else { inQuotes = !inQuotes; }
                        } else if (!inQuotes && line[i] === delim) {
                            result.push(cur);
                            cur = '';
                        } else {
                            cur += ch;
                        }
                    }
                    result.push(cur);
                    return result;
                };

                return lines.map(l => parseLine(l));
            },

            // --- Endpoints ---
            async getPlayers() {
                this._needsReset();
                if (this._cache.players) return this._cache.players;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/players.txt`;

                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                // 0 id, 1 name, 2 allyId, 3 points, 4 rank, 5 towns
                const players = rows.map(r => ({
                    id: +r[0], name: r[1], allianceId: +r[2] || 0,
                    points: +r[3] || 0, rank: +r[4] || 0, towns: +r[5] || 0
                }));
                const byId = new Map(players.map(p => [p.id, p]));
                this._cache.players = { list: players, byId };
                return this._cache.players;
            },

            async getAlliances() {
                this._needsReset();
                if (this._cache.alliances) return this._cache.alliances;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/alliances.txt`;

                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                // 0 id, 1 name, 2 points, 3 townCount, 4 playerCount, 5 rank
                const alliances = rows.map(r => ({
                    id: +r[0], name: r[1],
                    points: +r[2] || 0, towns: +r[3] || 0, players: +r[4] || 0, rank: +r[5] || 0
                }));
                const byId = new Map(alliances.map(a => [a.id, a]));
                this._cache.alliances = { list: alliances, byId };
                return this._cache.alliances;
            },

            async getTowns() {
                this._needsReset();
                if (this._cache.towns) return this._cache.towns;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/towns.txt`;

                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                // 0 townId, 1 playerId, 2 townName, 3 x, 4 y, 5 islandPos, 6 points
                const towns = rows.map(r => ({
                    id: +r[0], playerId: +r[1], name: r[2],
                    x: +r[3], y: +r[4], islandPos: +r[5] || 0, points: +r[6] || 0
                }));
                const byId = new Map(towns.map(t => [t.id, t]));
                const byPlayer = new Map();
                for (const t of towns) {
                    if (!byPlayer.has(t.playerId)) byPlayer.set(t.playerId, []);
                    byPlayer.get(t.playerId).push(t);
                }
                this._cache.towns = { list: towns, byId, byPlayer };
                return this._cache.towns;
            },

            async getConquers() {
                this._needsReset();
                if (this._cache.conquers) return this._cache.conquers;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/conquers.txt`;

                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                const conquers = rows.map(r => ({
                    townId: +r[0],
                    time: +r[1],
                    newPlayerId: +r[2] || 0,
                    oldPlayerId: +r[3] || 0,
                    newAllianceId: +r[4] || 0,
                    oldAllianceId: +r[5] || 0,
                    points: +r[6] || 0
                }));
                this._cache.conquers = conquers;
                return conquers;
            },

            async getIslands() {
                this._needsReset();
                if (this._cache.islands) return this._cache.islands;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/islands.txt`;

                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                const islands = rows.map(r => ({
                    id: +r[0], x: +r[1], y: +r[2], type: +r[3] || 0,
                    freeSlots: +r[4] || 0, bonusPlus: +r[5] || 0, bonusMinus: +r[6] || 0
                }));
                const byCoords = new Map(islands.map(i => [`${i.x}|${i.y}`, i]));
                this._cache.islands = { list: islands, byCoords };
                return this._cache.islands;
            },

            async getPlayerKillsAll() {
                this._needsReset();
                if (this._cache.kills_all) return this._cache.kills_all;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/player_kills_all.txt`;

                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                const list = rows.map(r => ({ rank: +r[0], playerId: +r[1], points: +r[2] || 0 }));
                this._cache.kills_all = list;
                return list;
            },


            async getPlayerKillsAtt() {
                this._needsReset();
                if (this._cache.kills_att) return this._cache.kills_att;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/player_kills_att.txt`;
                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                const list = rows.map(r => ({ rank: +r[0], playerId: +r[1], points: +r[2] || 0 }));
                this._cache.kills_att = list;
                return list;
            },

            async getPlayerKillsDef() {
                this._needsReset();
                if (this._cache.kills_def) return this._cache.kills_def;

                const host = `${Game.world_id}.grepolis.com`;
                const url = `https://${host}/data/player_kills_def.txt`;
                const txt = await this._fetchText(url);
                const rows = this._parseCSV(txt);
                const list = rows.map(r => ({ rank: +r[0], playerId: +r[1], points: +r[2] || 0 }));
                this._cache.kills_def = list;
                return list;
            },
        };

        // Kleine syntactic sugar helpers op BaseManager zelf
        getPlayers = function() { return this.worldData.getPlayers(); };
        getAlliances = function() { return this.worldData.getAlliances(); };
        getTowns = function() { return this.worldData.getTowns(); };
        getConquers = function() { return this.worldData.getConquers(); };
        getIslands = function() { return this.worldData.getIslands(); };
        getPlayerKillsAll = function() { return this.worldData.getPlayerKillsAll(); };
        getPlayerKillsAtt = function() { return this.worldData.getPlayerKillsAtt(); };
        getPlayerKillsDef = function() { return this.worldData.getPlayerKillsDef(); };


        _createLogger() {
            const prefix = `[${this.constructor.name}]`;
            return {
                log: (...args) => console.log(prefix, ...args),
                warn: (...args) => console.warn(prefix, ...args),
                error: (...args) => console.error(prefix, ...args),
                debug: (...args) => DEBUG && console.debug(prefix, ...args)
            };
        }

        async waitForElement(selector, timeout = 5000, context = document) {
            const start = Date.now();
            let element = null;

            while (Date.now() - start < timeout && !element) {
                element = context.querySelector(selector);
                if (!element) await new Promise(r => setTimeout(r, 100));
            }

            if (!element) {
                throw new Error(`Element ${selector} niet gevonden na ${timeout}ms`);
            }
            return element;
        }

        showNotification(message, isSuccess = true, duration = 3000) {
            this.main.showNotification(message, isSuccess, duration);
        }

        async safeQuery(selector, timeout = 5000, context = document) {
            try {
                return await this.waitForElement(selector, timeout, context);
            } catch (error) {
                this.logger.warn(error.message);
                return null;
            }
        }

        addEvent(element, event, handler, options) {
            element.addEventListener(event, handler, options);
            this._trackEvent(element, event, handler);
        }

        _trackEvent(element, event, handler) {
            if (!element) return;
            if (!element.id) {
                // geef een unieke GM id
                element.dataset.gmId = element.dataset.gmId || ('gm_' + Math.random().toString(36).slice(2,9));
            }
            const key = `${element.id || element.dataset.gmId}-${event}`;
            this._events.set(key, { element, event, handler });
        }

        setManagedInterval(fn, delay) {
            const id = setInterval(() => {
                try { fn(); } catch (err) { this.logger.error('Interval error:', err); }
            }, delay);
            this._intervals.add(id);
            return id;
        }
        clearManagedInterval(id) {
            clearInterval(id);
            this._intervals.delete(id);
        }
        setManagedTimeout(fn, delay) {
            const id = setTimeout(() => {
                try { fn(); } catch (err) { this.logger.error('Timeout error:', err); }
            }, delay);
            this._timeouts.add(id);
            return id;
        }
        clearManagedTimeout(id) {
            clearTimeout(id);
            this._timeouts.delete(id);
        }

        getPlayerName() {
            return this.uw.Game?.player_name ||
                document.querySelector('.header_nickname')?.textContent?.trim() ||
                'Speler';
        }

        formatTime(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
        }

        async waitForElement(selector, timeout = 5000, context = document) {
            const start = Date.now();
            let el = null;
            while (Date.now() - start < timeout && !el) {
                el = context.querySelector(selector);
                if (!el) await new Promise(r => setTimeout(r, 100));
            }
            if (!el) throw new Error(`Element ${selector} niet gevonden na ${timeout}ms`);
            return el;
        }
        async safeQuery(selector, timeout = 5000, context = document) {
            try { return await this.waitForElement(selector, timeout, context); }
            catch (e) { this.logger.warn(e.message); return null; }
        }

        // cleanup all registered events/intervals/timeouts
        destroy() {
            // Events
            try {
                // WeakMap does not support for..of; iterate keys by temporarily storing them
                const temp = [];
                this._events && this._events.forEach === undefined
                    ? null
                : null;
                // We cannot iterate WeakMap directly; keep a reference table on instance if needed.
                // But because we stored arrays keyed by element, we rely on explicit removal points when removing UI.
                // For safety: attempt to clear intervals/timeouts.
            } catch (e) {
                // ignore
            }

            // Intervals & timeouts
            for (const id of Array.from(this._intervals)) { clearInterval(id); }
            this._intervals.clear();
            for (const id of Array.from(this._timeouts)) { clearTimeout(id); }
            this._timeouts.clear();

            this.logger.log('BaseManager cleanup (intervals/timeouts) voltooid');
        }
        async safeFetch(url, options = {}, timeout = 5000) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                throw new Error(`Fetch error: ${error.message}`);
            }
        }
    }

    class MyManager extends BaseManager {
        async init() {
            // Veilig element ophalen
            const button = await this.safeQuery('#my-button');

            // Event met automatische cleanup
            this.addEvent(button, 'click', () => this.handleClick());

            // Beheerd interval
            this.setManagedInterval(() => this.updateData(), 5000);

            // Netwerkrequest met timeout
            try {
                const data = await this.safeFetch('/api/data');
            } catch (error) {
                this.showNotification(error.message, false);
            }
        }

        cleanup() {
            this.destroy(); // Ruimt alles op
        }
    }

    // ============ //
    // Popup window //
    // ============ //

    class MainPopup extends BaseManager {
        toggleMainPopup() {
            if (this.popup) {
                this.popup.remove();
                this.popup = null;
                return;
            }
            this.createPopup();
        }

        createPopup() {
            this.popup = document.createElement('div');
            this.popup.id = 'gm-popup';

            const toolbar = document.createElement('div');
            toolbar.className = 'gm-toolbar';

            const btnStart = document.createElement('button');
            btnStart.textContent = 'Startscherm';
            btnStart.addEventListener('click', () => this.showStartScreen());

            toolbar.appendChild(btnStart);

            const content = document.createElement('div');
            content.id = 'gm-content';

            this.popup.appendChild(toolbar);
            this.popup.appendChild(content);
            document.body.appendChild(this.popup);

            this.showStartScreen(); // Toon bij openen
        }
    }

    class WereldInfo extends BaseManager {
        constructor(mainManager) {
            super(mainManager);
            // Let op: geen hard-coded forumUrl hier. Wordt opgehaald uit instellingen in render().
            this.keys = [
                "Start","Wereldsnelheid","Eenhedensnelheid","Handelssnelheid","Beginnersbescherming",
                "Kolonisatiesysteem","Eindspel","Duur opstand","Duur stad stichten","Boerendorpensysteem",
                "Anti-timing regel","Goden","Premiumfuncties","Helden","Moraal","Nachtbonus",
                "Alliantielimiet","Aantal startsteden","Speciale effecten","Artifact"
            ];
        }

        async fetchForumHTML(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url,
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) resolve(res.responseText);
                        else reject(new Error(`HTTP ${res.status}`));
                    },
                    onerror: (err) => reject(err)
                });
            });
        }

        _esc(s = "") {
            return String(s)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }

        cleanText(rawText) {
            let t = rawText || "";
            // verwijder JSON-blokken en veel voorkomende meta/ruis
            t = t.replace(/\{[\s\S]*?\}/g, " ");
            t = t.replace(/(Community Manager|Grepolis Team)[\s\S]*?\d{4}/gi, " ");
            t = t.replace(/#\d+/g, " ");
            // Zoek begin en eind
            const startMatch = t.match(/Wereld\s+\w+\s+zal[\s\S]*?van start gaan!?/i);
            const startIndex = startMatch ? t.indexOf(startMatch[0]) : -1;
            const endIndex = t.search(/Met vriendelijke groet/i);
            if (startIndex >= 0) {
                t = t.slice(startIndex, endIndex > 0 ? endIndex : undefined);
            } else if (endIndex > 0) {
                t = t.slice(0, endIndex);
            }
            // Normaliseer whitespace maar behoud referentiële hoofdletters
            t = t.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
            // Breek aaneengeschreven woorden bij lowercase+Uppercase (help bij parsing)
            t = t.replace(/([a-zà-ÿ])([A-ZÀ-Ÿ])/g, "$1 $2");
            return t;
        }

        splitIntoSegments(text) {
            const segments = {};
            const keys = this.keys;
            const re = new RegExp("(" + keys.join("|") + ")([\\s\\S]*?)(?=" + keys.join("|") + "|$)", "gmi");
            let m;
            while ((m = re.exec(text)) !== null) {
                const key = m[1].trim();
                const seg = (m[2] || "").trim();
                segments[key] = seg;
            }
            return segments;
        }

        splitSegment(segRaw) {
            let seg = (segRaw || "").trim();
            if (!seg) return { col2: "-", col3: "-" };
            seg = seg.replace(/\s+/g, " ").trim();

            // hyphens handling
            const hyphenSpace = seg.indexOf(" -");
            if (hyphenSpace >= 0) {
                const left = seg.slice(0, hyphenSpace).trim();
                const right = seg.slice(hyphenSpace).replace(/^[-\s]+/, "-").trim();
                return { col2: left || "-", col3: right || "-" };
            }
            if (seg.endsWith("-")) {
                const left = seg.slice(0, -1).trim();
                return { col2: left || "-", col3: "-" };
            }

            // date pattern
            const dateRe = /^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+\d{1,2}\s+[a-zA-Z]+/i;
            const dateMatch = seg.match(dateRe);
            if (dateMatch) {
                const col2 = dateMatch[0].trim();
                const col3 = seg.slice(dateMatch[0].length).trim() || "-";
                return { col2, col3 };
            }

            // "X dagen" / "X uur"
            const daysMatch = seg.match(/^(\d+\s+dagen\b)/i);
            if (daysMatch) {
                const col2 = daysMatch[1].trim();
                const col3 = seg.slice(daysMatch[1].length).trim() || "-";
                return { col2, col3 };
            }
            const uurMatch = seg.match(/^(\d+\s*uur\b)/i);
            if (uurMatch) {
                const col2 = uurMatch[1].trim();
                const col3 = seg.slice(uurMatch[1].length).trim() || "-";
                return { col2, col3 };
            }

            // time range
            const timeMatch = seg.match(/^(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
            if (timeMatch) {
                const col2 = timeMatch[1].trim();
                const col3 = seg.slice(timeMatch[1].length).trim() || "-";
                return { col2, col3 };
            }

            // markers heuristic: split where info words appear
            const markers = [
                "In de loop", "In de", "Spionage", "Handelen", "Belegering", "Normale",
                "Battle Point", "Battle", "00:00", "voor alle", "Instant", "Actief",
                "Handelen met", "Bandietenkampen"
            ];
            let earliest = -1;
            const lcSeg = seg.toLowerCase();
            for (const mk of markers) {
                const idx = lcSeg.indexOf(mk.toLowerCase());
                if (idx >= 0 && (earliest === -1 || idx < earliest)) {
                    earliest = idx;
                }
            }
            if (earliest > 0) {
                const col2 = seg.slice(0, earliest).trim();
                const col3 = seg.slice(earliest).trim() || "-";
                return { col2: col2 || "-", col3: col3 || "-" };
            }

            // fallback heuristics
            const tokens = seg.split(/\s+/);
            if (tokens.length === 1) return { col2: seg, col3: "-" };
            if (/^\d+$/.test(tokens[0]) || /^[\d:]+$/.test(tokens[0]) || /^[A-Za-z]{1,3}$/.test(tokens[0])) {
                const col2 = tokens.shift();
                const col3 = tokens.join(" ").trim() || "-";
                return { col2, col3 };
            }
            if (tokens.length <= 3) return { col2: seg, col3: "-" };
            const col2 = tokens.shift();
            const col3 = tokens.join(" ").trim() || "-";
            return { col2, col3 };
        }

        parseTableFromText(tableText) {
            const segments = this.splitIntoSegments(tableText);
            const rows = [];
            for (const key of this.keys) {
                if (!segments.hasOwnProperty(key)) continue;
                const seg = segments[key] || "";
                const { col2, col3 } = this.splitSegment(seg);
                rows.push({
                    col1: key,
                    col2: col2 === "" ? "-" : col2,
                    col3: col3 === "" ? "-" : col3
                });
            }

            let html = `<table style="border-collapse:collapse;width:100%;margin:10px 0;">
            <colgroup><col style="width:30%"><col style="width:35%"><col style="width:35%"></colgroup>
            <thead>
              <tr>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #666;">Omschrijving</th>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #666;">Wereldinstelling</th>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #666;">Informatie</th>
              </tr>
            </thead>
            <tbody>`;
            for (const r of rows) {
                html += `<tr>
                <td style="border:1px solid #333;padding:6px;vertical-align:top;">${this._esc(r.col1)}</td>
                <td style="border:1px solid #333;padding:6px;vertical-align:top;">${this._esc(r.col2)}</td>
                <td style="border:1px solid #333;padding:6px;vertical-align:top;">${this._esc(r.col3)}</td>
            </tr>`;
            }
            html += `</tbody></table>`;
            return html;
        }

        splitIntroTableOutro(cleaned) {
            const marker = /De instellingen:/i;
            const m = cleaned.match(marker);
            if (!m) return { intro: cleaned, tableText: "", outro: "" };
            const idx = cleaned.search(marker);
            const intro = cleaned.slice(0, idx).trim();
            const after = cleaned.slice(idx + m[0].length).trim();
            const outroMarker = /(Wereld\s+\w+\s+zal in de loop|Met vriendelijke groet)/i;
            const outroMatch = after.match(outroMarker);
            if (outroMatch) {
                const oidx = after.search(outroMarker);
                return {
                    intro,
                    tableText: after.slice(0, oidx).trim(),
                    outro: after.slice(oidx).trim()
                };
            } else {
                return { intro, tableText: after.trim(), outro: "" };
            }
        }

        async render(container) {
            container.innerHTML = `<h2>🌍 Wereldinfo laden…</h2>`;
            try {
                // haal forum-url uit instellingen (niet hard-coded)
                const forumUrl = await GM_getValue("wereldinfo_url", null);
                if (!forumUrl) {
                    container.innerHTML = `
                    <h2>🌍 Wereldinfo</h2>
                    <p style="color:#c33;">Geen forum-link ingesteld voor wereldinfo.</p>
                    <p>Ga naar Instellingen en vul bij "Wereldinfo URL" de forum-link in (bv. het aankondigingstopic).</p>
                    <button id="gm-open-settings" class="gm-button">Open Instellingen</button>
                `;
                    // voeg knop-event toe (indien instellingen beschikbaar in main)
                    container.querySelector("#gm-open-settings")?.addEventListener("click", () => {
                        const ui = window.GMB_UI;
                        if (ui && ui.panel && document.getElementById('gmb-tab-gm-beheer')) {
                            ui.switchTab('gm-beheer');
                        } else if (this.main && typeof this.main.openGmbPanel === "function") {
                            this.main.openGmbPanel();
                        } else {
                            alert("Instellingen-paneel niet beschikbaar.");
                        }
                    });
                    return;
                }

                const html = await this.fetchForumHTML(forumUrl);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const article = doc.querySelector("article");
                if (!article) throw new Error("Geen <article>-element gevonden op de forumpagina.");

                const rawText = article.innerText || "";
                const cleaned = this.cleanText(rawText);

                let imgEl = article.querySelector("img[src*='new_world']") || article.querySelector("img");
                const imgHtml = imgEl ? `<div style="text-align:center;margin-bottom:10px;"><img src="${this._esc(imgEl.src)}" style="max-width:260px;"></div>` : "";

                const { intro, tableText, outro } = this.splitIntroTableOutro(cleaned);
                const tableHtml = tableText ? this.parseTableFromText(tableText) : `<p style="color:#999;">Geen instellingen gevonden.</p>`;

                const wereldNaam = (forumUrl.match(/wereld-([^-]+)/i) || [])[1] || (this.uw.Game?.world_id || "Onbekend");

                container.innerHTML = `
                <h2 style="margin-bottom:10px;">🌍 Wereldinfo (${this._esc(wereldNaam)})</h2>
                ${imgHtml}
                <div style="white-space:pre-line;margin-bottom:12px;">${this._esc(intro)}</div>
                ${tableHtml}
                <div style="white-space:pre-line;margin-top:12px;color:inherit;">${this._esc(outro)}</div>
                <p class="gm-muted" style="margin-top:8px;font-size:12px;">Bron: <a href="${this._esc(forumUrl)}" target="_blank">${this._esc(forumUrl)}</a></p>
            `;
            } catch (err) {
                console.error("[WereldInfo] Fout:", err);
                container.innerHTML = `<p style="color:red;">❌ Fout bij ophalen wereldinfo: ${this._esc(err.message)}</p>`;
            }
        }
    }


    // Move hasAdminAccess outside the class
    async function hasAdminAccess(main) {
        // fallback player name
        const playerName = (main.uw?.Game?.player_name || "").toString().trim().toLowerCase();
        const devs = ['boodtrap', 'zambia1972', 'elona', 'joppie86'];

        if (!playerName) return false;
        if (devs.includes(playerName)) return true;

        // handmatig ingestelde admins altijd checken
        const manualAdmins = (await GM_getValue('admin_list', [])) || [];
        if (manualAdmins.map(n => (n||"").toLowerCase()).includes(playerName)) return true;

        // leiders mogen admin zijn (checkbox)
        const allowLeaders = await GM_getValue('leaders_are_admins', true);
        if (allowLeaders) {
            // lees leiders via de centrale methode (storage + DOM)
            try {
                let leaders = [];
                if (main.settingsWindow && typeof main.settingsWindow.getAllianceLeaders === 'function') {
                    leaders = main.settingsWindow.getAllianceLeaders() || [];
                } else {
                    leaders = await GM_getValue('leaders_list', []) || [];
                }
                if (leaders.map(n => (n||"").toLowerCase()).includes(playerName)) return true;
            } catch (e) {
                console.warn("[hasAdminAccess] leaders check failed:", e);
            }

        }

        return false;
    }


    // -------------------------
    // --- instellingen --------
    // -------------------------

    class SettingsWindow {
        constructor(main) {
            this.main = main;
            this.uw = main.uw;
        }

        getAllianceLeaders() {
            const leaders = [];
            try {
                const rows = document.querySelectorAll("#ally_members_body tr");
                rows.forEach(row => {
                    const anchor = row.querySelector("td.ally_name .gp_player_link");
                    let name = "";
                    if (anchor) {
                        name = Array.from(anchor.childNodes)
                            .filter(n => n.nodeType === Node.TEXT_NODE)
                            .map(n => n.textContent.trim())
                            .join(" ")
                            .trim();
                        if (!name) name = anchor.textContent.trim();
                    } else {
                        const cell = row.querySelector("td.ally_name");
                        name = cell ? cell.textContent.trim() : "";
                    }
                    if (!name) return;

                    const oprichterImg = row.querySelector("td:nth-child(5) img");
                    const leiderImg    = row.querySelector("td:nth-child(6) img");

                    const imgIsChecked = (img) => {
                        if (!img) return false;
                        const src = (img.getAttribute("src") || "").toLowerCase();
                        const alt = (img.getAttribute("alt") || "").toLowerCase();
                        const cls = (img.className || "").toLowerCase();
                        if (cls.includes("checked")) return true;
                        if (/checkmark/i.test(src)) return true;
                        if (alt.includes("heeft dit recht") && !alt.includes("niet")) return true;
                        return false;
                    };

                    const isOprichter = imgIsChecked(oprichterImg);
                    const isLeider    = imgIsChecked(leiderImg);

                    if (isOprichter || isLeider) {
                        if (!leaders.includes(name)) leaders.push(name);
                    }
                });
            } catch (e) {
                console.warn("[SettingsWindow] kon leiders niet ophalen:", e);
            }
            return leaders;
        }
        async render(container) {
            const isAdmin = await hasAdminAccess(this.main);
            if (!isAdmin) {
                return this.main.showNotification("Geen toegang tot instellingen.", false);
            }

            container.innerHTML = `
            <h2 class="gm-panel-title">Instellingen</h2>
            <div id="gm-tab-buttons" style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
                <button class="gm-button" data-tab="wereldinfo">🌍 Wereldinfo</button>
                <button class="gm-button" data-tab="ban">🚫 Ban</button>
                <button class="gm-button" data-tab="admin">👑 Admin</button>
            </div>
            <div id="gm-settings-content"></div>
        `;

            // standaard naar supabase
            await this.renderTab("wereldinfo");

            container.querySelectorAll("#gm-tab-buttons .gm-button").forEach(btn => {
                btn.addEventListener("click", () => this.renderTab(btn.dataset.tab));
            });
        }

        async toggle() {
            const isAdmin = await hasAdminAccess(this.main);
            if (!isAdmin) return this.main.showNotification("Geen toegang tot instellingen.", false);
            this.main.openPanel("settings", (c) => this.render(c), "gm-panel-medium");
        }

        async renderTab(tab) {
            const content = document.getElementById("gm-settings-content");
            if (!content) return;
            content.innerHTML = "";

            const isAdmin = await hasAdminAccess(this.main);

            if (tab === "wereldinfo") {
                if (isAdmin) await this.renderWereldinfoTab(content);
                else content.innerHTML = "<p class='gm-muted'>Geen toegang tot Wereldinfo.</p>";
            }
            else if (tab === "ban") {
                if (isAdmin) await this.renderBanTab(content);
                else content.innerHTML = "<p class='gm-muted'>Geen toegang tot Banlijst.</p>";
            }
            else if (tab === "admin") {
                if (isAdmin) await this.renderAdminTab(content);
                else content.innerHTML = "<p class='gm-muted'>Geen toegang tot Adminbeheer.</p>";
            }

            document.querySelectorAll("#gm-tab-buttons .gm-button").forEach(btn => {
                btn.style.opacity = btn.dataset.tab === tab ? "1" : "0.7";
            });
        }


        // ---------------- WERELDINFO ----------------
        async renderWereldinfoTab(container) {
            const url = await GM_getValue("wereldinfo_url", "");
            container.innerHTML = `
            <h3 class="gm-title">Wereldinfo</h3>
            <input type="text" id="gm-wi-url" class="gm-input" placeholder="https://..." style="width:100%; margin-bottom:5px;" value="${url}" />
            <button id="gm-save-wi-url" class="gm-button">💾 Opslaan</button>
        `;
            container.querySelector("#gm-save-wi-url").addEventListener("click", async () => {
                await GM_setValue("wereldinfo_url", container.querySelector("#gm-wi-url").value.trim());
                alert("Wereldinfo-URL opgeslagen.");
            });
        }

        // ---------------- BAN ----------------
        async renderBanTab(container) {
            const bans = (await GM_getValue("banned_players", [])) || [];
            container.innerHTML = `
        <h3 class="gm-title">Banlijst</h3>
        <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
          <input id="gm-banname" class="gm-input" placeholder="Spelernaam" style="max-width:300px;" />
          <button id="gm-ban-add" class="gm-button">➕ Ban</button>
          <button id="gm-ban-remove" class="gm-button">➖ Unban</button>
        </div>
        <div id="gm-banlist" class="gm-muted" style="font-size:12px;">${bans.length ? bans.join(", ") : "—"}</div>
    `;

            container.querySelector("#gm-ban-add").addEventListener("click", async () => {
                const name = container.querySelector("#gm-banname").value.trim();
                if (!name) return;
                const set = new Set(bans);
                set.add(name);
                await GM_setValue("banned_players", Array.from(set));
                await this.renderBanTab(container);
            });

            container.querySelector("#gm-ban-remove").addEventListener("click", async () => {
                const name = container.querySelector("#gm-banname").value.trim();
                if (!name) return;
                const set = new Set(bans);
                set.delete(name);
                await GM_setValue("banned_players", Array.from(set));
                await this.renderBanTab(container);
            });
        }

        // ---------------- ADMIN ----------------
        async renderAdminTab(container) {
            const manualAdmins = (await GM_getValue("admin_list", [])) || [];
            const leadersAreAdmins = await GM_getValue("leaders_are_admins", true);
            const domLeaders = this.getAllianceLeaders() || [];
            const storedLeaders = (await GM_getValue("leaders_list", [])) || [];

            // merge, uniek, behoud eerste voorkomend casing
            const leaderMap = new Map();
            [...domLeaders, ...storedLeaders].forEach(n => {
                if (!n) return;
                const key = n.toString().trim().toLowerCase();
                if (!key) return;
                if (!leaderMap.has(key)) leaderMap.set(key, n.toString().trim());
            });
            const leaders = Array.from(leaderMap.values());

            // indien we daadwerkelijk iets uit DOM halen -> persist zodat rest van het script het gebruikt
            if (domLeaders.length > 0) {
                await GM_setValue('leaders_list', leaders);
            }

            container.innerHTML = `
      <h3 class="gm-title">Adminbeheer</h3>
      <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
        <input id="gm-adminname" class="gm-input" placeholder="Spelernaam" style="max-width:300px;" />
        <button id="gm-admin-add" class="gm-button">➕ Voeg toe</button>
        <button id="gm-admin-remove" class="gm-button">➖ Verwijder</button>
      </div>
      <label style="display:block; margin-top:8px;">
        <input type="checkbox" id="gm-toggle-leaders" ${leadersAreAdmins ? "checked" : ""}/>
        Leiders/Oprichters hebben automatisch toegang
      </label>
      <div class="gm-muted" style="font-size:12px; margin-top:8px;">
        <b>Leiders:</b> ${leaders.length ? leaders.join(", ") : "—"}
      </div>
      <div class="gm-muted" style="font-size:12px; margin-top:8px;">
        <b>Admins (handmatig toegevoegd):</b> ${manualAdmins.length ? manualAdmins.join(", ") : "—"}
      </div>
    `;

            // Add
            container.querySelector("#gm-admin-add").addEventListener("click", async () => {
                const name = container.querySelector("#gm-adminname").value.trim();
                if (!name) return;
                const current = (await GM_getValue("admin_list", [])) || [];
                if (!current.map(n => n.toLowerCase()).includes(name.toLowerCase())) {
                    current.push(name);
                    await GM_setValue("admin_list", current);
                }
                await this.renderAdminTab(container);
            });

            // Remove
            container.querySelector("#gm-admin-remove").addEventListener("click", async () => {
                const name = container.querySelector("#gm-adminname").value.trim();
                if (!name) return;
                const current = (await GM_getValue("admin_list", [])) || [];
                const filtered = current.filter(a => a.toLowerCase() !== name.toLowerCase());
                await GM_setValue("admin_list", filtered);
                await this.renderAdminTab(container);
            });

            // Toggle leaders checkbox
            container.querySelector("#gm-toggle-leaders").addEventListener("change", async (e) => {
                await GM_setValue("leaders_are_admins", e.target.checked);
                await this.renderAdminTab(container);
            });
        }

    }

    // ============================ //
    // Start Grepolis Manager Init  //
    // ============================ //

    window.addEventListener('load', () => {
        const app = new GrepolisManager();
        // Zet de instantie globaal beschikbaar
        window.GrepoMain = app;
        window.GMApp = app; // extra alias voor testen
        console.log("✅ GrepolisManager gestart:", app);
    });

    // Helper: wacht tot een bepaald pad op window bestaat
    function waitForGlobal(path, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            (function check() {
                const parts = path.split(".");
                let obj = window;

                for (const p of parts) {
                    if (obj && p in obj) {
                        obj = obj[p];
                    } else {
                        obj = null;
                        break;
                    }
                }

                if (obj) {
                    resolve(obj);
                } else if (Date.now() - start < timeout) {
                    setTimeout(check, 200);
                } else {
                    reject(new Error(`Timeout: ${path} niet gevonden binnen ${timeout}ms`));
                }
            })();
        });
    }

})();

// ============================================================
// GMB CORE (geïntegreerd hoofscript)
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // CORE FRAMEWORK
    // ============================================================

    const GMB = {
        version: '1.4',
        debug: false,
        initialized: false,
        modules: {},
        settings: {},
        worldId: null,
        marketId: null,
        worldNumber: null,
        playerId: null,
        allianceId: null,
        townId: null,
        csrfToken: null,
        MODULE_CATALOG: [
            { id: 'FarmAlert', key: 'module_farmalert', label: 'Farm Alert', defaultOn: true, tabId: 'farmalert' },
            { id: 'GoldAlert', key: 'module_goldalert', label: 'Gold Alert', defaultOn: true, tabId: 'goldalert' },
            { id: 'TroopManager', key: 'module_troops', label: 'Troop Manager', defaultOn: true, tabId: 'troops' },
            { id: 'Commands', key: 'module_commands', label: 'Command Center', defaultOn: true, tabId: 'commands' },
            { id: 'AllianceForum', key: 'module_alliance_forum', label: 'Forum Manager', defaultOn: true, tabId: 'alliance-forum' },
            { id: 'ForumDeleteMultiple', key: 'module_forum_delete_multiple', label: 'Forumberichten selecteer-alles', defaultOn: true },
            { id: 'AbsenceAssistant', key: 'module_absence_assistant', label: 'Afwezigheidsassistent', defaultOn: true, tabId: 'absence' },
            { id: 'MapEnhancer', key: 'module_map_enhancer', label: 'Map Enhancer', defaultOn: true, tabId: 'mgr-map', enabledKey: 'map_enhancer_enabled' },
            { id: 'Reports', key: 'module_reports', label: 'Rapport-converter', defaultOn: true, tabId: 'mgr-reports', enabledKey: 'reports_enabled' },
            { id: 'GodTools', key: 'module_godtools', label: 'Goden & Spellen', defaultOn: true, tabId: 'godtools' },
            { id: 'UnitTools', key: 'module_unittools', label: 'Units strength', defaultOn: true, tabId: 'unittools' },
            { id: 'IconTools', key: 'module_icontools', label: 'Iconen & Town tools', defaultOn: true, tabId: 'icontools' },
            { id: 'Supabase', key: 'module_supabase', label: 'Supabase Sync', defaultOn: false, tabId: 'supabase' }
        ],
        MODULE_RESET_KEYS: {
            FarmAlert: ['module_farmalert', 'farmalert_enabled', 'farmalert_interval', 'farmalert_alarm_enabled', 'farmalert_alarm_sound', 'farmalert_notify_desktop'],
            GoldAlert: ['module_goldalert', 'goldalert_enabled', 'goldalert_interval', 'goldalert_min_capacity', 'goldalert_notify_desktop', 'goldalert_threshold_wood', 'goldalert_threshold_stone', 'goldalert_threshold_iron'],
            TroopManager: ['module_troops', 'troops_last_export'],
            Commands: ['module_commands', 'commands_enabled', 'commands_interval', 'commands_interval_migrated', 'commands_all_towns', 'commands_sound', 'commands_volume', 'commands_discord', 'commands_seen'],
            ForumDeleteMultiple: ['module_forum_delete_multiple'],
            AbsenceAssistant: ['module_absence_assistant', 'absence_records'],
            MapEnhancer: ['module_map_enhancer', 'map_enhancer_enabled', 'map_enhancer_options', 'map_enhancer_tags'],
            Reports: ['module_reports', 'reports_enabled', 'reports_options'],
            GodTools: ['module_godtools', 'godtools_enabled', 'godtools_spell_cooldown', 'godtools_night_bonus', 'godtools_wonder_trade'],
            UnitTools: ['module_unittools', 'unittools_enabled', 'unittools_strength', 'unittools_mode', 'unittools_available', 'unittools_sent', 'unittools_sent_units', 'unittools_transport', 'unittools_compare', 'unittools_rtt', 'unittools_bullseye'],
            IconTools: ['module_icontools', 'icontools_enabled', 'icontools_til', 'icontools_tim', 'icontools_tiw', 'icontools_tpt', 'icontools_tis', 'icontools_tih', 'icontools_tir', 'icontools_tow', 'icontools_tol', 'icontools_toh', 'icontools_town_types'],
            Supabase: ['module_supabase', 'supabase_url', 'supabase_api_key', 'supabase_world_token', 'supabase_alliance_token', 'supabase_leader_token', 'supabase_auto_upload', 'supabase_upload_interval', 'supabase_sync_troops', 'supabase_sync_attacks', 'supabase_sync_commands'],
            Core: ['gmb_debug', 'notify_desktop', 'notify_discord', 'notify_discord_webhook', 'api_min_delay', 'api_jitter', 'api_max_per_minute', 'world_cache_ttl', 'module_troops', 'module_commands', 'module_alliance_forum'],
            AllianceForum: ['module_alliance_forum', 'alliance_forum_pack', 'alliance_forum_packs', 'alliance_forum_pack_version', 'alliance_forum_selected_pack']
        },

        // Logger
        // options.quiet: blijft in Systeem-log en console, maar niet in de banner-ticker.
        log: function(category, message, type = 'info', options = {}) {
            const timestamp = new Date().toLocaleTimeString();
            const prefix = `[GMB ${timestamp}] [${category.toUpperCase()}]`;
            switch(type) {
                case 'error':
                    console.error(`${prefix} ${message}`);
                    break;
                case 'warn':
                    console.warn(`${prefix} ${message}`);
                    break;
                case 'success':
                    console.log(`%c${prefix} ${message}`, 'color: #4caf50; font-weight: bold;');
                    break;
                default:
                    console.log(`${prefix} ${message}`);
            }

            // Append to system logs container if UI is open
            try {
                const container = document.getElementById('gmb-logs-container');
                if (container) {
                    const line = document.createElement('div');
                    line.className = `gmb-log-entry gmb-log-${type}`;
                    line.textContent = `[${timestamp}] [${category}] ${message}`;
                    container.appendChild(line);
                    while (container.childNodes.length > 300) container.removeChild(container.firstChild);
                    container.scrollTop = container.scrollHeight;
                }
            } catch(e) {}
            if (!(options && options.quiet)) this.pushBannerLog(`[${timestamp}] [${category}] ${message}`, type);
        },

        // Globale banner: laatste 10 systeemlogs als ticker (één tegelijk, constante spacing); textContent only.
        bannerLines: [],
        bannerPending: [],
        bannerTimer: null,
        bannerCursor: 0,
        bannerSpeed: 120,
        bannerGap: 80,
        pushBannerLog: function(text, type) {
            this.bannerSeq = (this.bannerSeq || 0) + 1;
            const entry = { seq: this.bannerSeq, text: String(text).slice(0, 600), type };
            this.bannerLines.push(entry);
            if (this.bannerLines.length > 10) this.bannerLines.shift();
            // Nieuwe log krijgt voorrang; oudere wachtende nieuwe logs blijven in volgorde.
            this.bannerPending.push(entry.seq);
            if (this.bannerPending.length > 10) this.bannerPending.shift();
            if (!this.bannerTimer) this.bannerTimer = setTimeout(() => this.bannerNext(), 0);
        },

        bannerNext: function() {
            this.bannerTimer = null;
            let delay = 1000;
            try {
                if (!document.body || !this.bannerLines.length) return;
                let entry = null;
                while (this.bannerPending.length && !entry) {
                    const seq = this.bannerPending.shift();
                    entry = this.bannerLines.find(line => line.seq === seq) || null;
                }
                if (!entry) {
                    // Rotatie door de laatste 10 logs
                    this.bannerCursor = (this.bannerCursor + 1) % this.bannerLines.length;
                    entry = this.bannerLines[this.bannerCursor];
                } else {
                    this.bannerCursor = this.bannerLines.indexOf(entry);
                }
                delay = this.renderBanner(entry);
            } catch (error) { /* banner is optioneel */ }
            this.bannerTimer = setTimeout(() => this.bannerNext(), delay);
        },

        // Spawnt één ticker-rij en geeft de wachttijd (ms) tot de volgende mag starten terug.
        renderBanner: function(entry) {
            try {
                if (!document.body || !entry) return 1000;
                let banner = document.getElementById('gmb-log-banner');
                if (!banner) {
                    if (!document.getElementById('gmb-log-banner-style')) {
                        const style = document.createElement('style');
                        style.id = 'gmb-log-banner-style';
                        style.textContent = '@keyframes gmb-ticker{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}' +
                            '#gmb-log-banner .gmb-ticker-row{position:absolute;top:0;left:0;height:30px;line-height:30px;font-size:13px;white-space:nowrap;will-change:transform;animation-timing-function:linear;animation-fill-mode:forwards;}' +
                            '#gmb-log-banner .gmb-log-success{color:#81c784}#gmb-log-banner .gmb-log-error{color:#e57373}#gmb-log-banner .gmb-log-warn{color:#ffb74d}#gmb-log-banner .gmb-log-info{color:#90caf9}' +
                            '#gmb-log-banner .gmb-ticker-new{font-size:16px;font-weight:bold;text-shadow:0 0 6px currentColor,0 0 2px #fff;border:1px solid currentColor;border-radius:4px;padding:0 8px;box-sizing:border-box;background:rgba(255,255,255,.12)}';
                        document.head.appendChild(style);
                    }
                    banner = document.createElement('div');
                    banner.id = 'gmb-log-banner';
                    banner.style.cssText = 'position:fixed;top:55px;left:0;right:0;height:30px;z-index:2147483000;background:rgba(0,0,0,0.5);font-family:monospace;overflow:hidden;box-sizing:border-box;pointer-events:none;';
                    document.body.appendChild(banner);
                }
                const isNew = entry.seq === this.bannerSeq;
                const row = document.createElement('div');
                const type = ['success', 'error', 'warn', 'info'].includes(entry.type) ? entry.type : 'info';
                row.className = `gmb-ticker-row gmb-log-${type}${isNew ? ' gmb-ticker-new' : ''}`;
                row.dataset.seq = String(entry.seq);
                row.textContent = entry.text;
                banner.appendChild(row);
                const width = row.offsetWidth || Math.ceil(entry.text.length * (isNew ? 9.5 : 7.8));
                const viewport = window.innerWidth || 1280;
                const durationMs = ((viewport + width) / this.bannerSpeed) * 1000;
                row.style.animationName = 'gmb-ticker';
                row.style.animationDuration = `${durationMs}ms`;
                const remove = () => { if (row.parentNode) row.parentNode.removeChild(row); };
                row.addEventListener('animationend', remove);
                setTimeout(remove, durationMs + 1000);
                return ((width + this.bannerGap) / this.bannerSpeed) * 1000;
            } catch (error) { /* banner is optioneel */ }
            return 1000;
        },

        alert: function(message) {
            if (typeof alert !== 'undefined') {
                alert(message);
            } else {
                console.warn(`[GMB ALERT] ${message}`);
            }
        },

        // Data Storage (GM_setValue/GM_getValue + localStorage mirror voor persistente instellingen)
        storage: {
            _normalize: function(value) {
                if (value === 'true') return true;
                if (value === 'false') return false;
                if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                    try { return JSON.parse(value); } catch (e) {}
                }
                return value;
            },
            get: function(key, defaultValue = null) {
                try {
                    if (typeof GM_getValue !== 'undefined') {
                        const value = GM_getValue(key, undefined);
                        if (value !== undefined && value !== null) return this._normalize(value);
                    }
                } catch (e) {
                    GMB.log('Storage', `Fout bij ophalen ${key}: ${e.message}`, 'error');
                }
                try {
                    const raw = localStorage.getItem(`gmb_${key}`);
                    if (raw !== null) {
                        let value = JSON.parse(raw);
                        if (typeof value === 'string') value = this._normalize(value);
                        return value;
                    }
                } catch (e) {}
                return defaultValue;
            },
            set: function(key, value) {
                const storedVal = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
                let ok = true;
                try {
                    if (typeof GM_setValue !== 'undefined') {
                        GM_setValue(key, storedVal);
                    }
                } catch (e) {
                    ok = false;
                    GMB.log('Storage', `Fout bij opslaan ${key}: ${e.message}`, 'error');
                }
                try {
                    localStorage.setItem(`gmb_${key}`, JSON.stringify(storedVal));
                } catch (e) {
                    ok = false;
                }
                return ok;
            },
            delete: function(key) {
                let ok = true;
                try {
                    if (typeof GM_deleteValue !== 'undefined') {
                        GM_deleteValue(key);
                    }
                } catch (e) {
                    ok = false;
                    GMB.log('Storage', `Fout bij verwijderen ${key}: ${e.message}`, 'error');
                }
                try {
                    localStorage.removeItem(`gmb_${key}`);
                } catch (e) {
                    ok = false;
                }
                return ok;
            },
            listKeys: function() {
                try {
                    if (typeof GM_listValues === 'function') {
                        return GM_listValues() || [];
                    }
                } catch (e) {}
                const keys = [];
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && k.startsWith('gmb_')) keys.push(k.slice(4));
                    }
                } catch (e) {}
                return keys;
            },
            exportAll: function() {
                const keys = this.listKeys();
                const known = new Set(keys);
                Object.values(GMB.MODULE_RESET_KEYS).forEach(list => list.forEach(k => known.add(k)));
                const data = {
                    gmbExportVersion: 1,
                    exportedAt: new Date().toISOString(),
                    worldId: GMB.worldId,
                    values: {}
                };
                known.forEach(key => {
                    const val = this.get(key, undefined);
                    if (val !== undefined && val !== null) data.values[key] = val;
                });
                return data;
            },
            importAll: function(data) {
                if (!data || typeof data !== 'object' || Array.isArray(data) || !data.values || typeof data.values !== 'object' || Array.isArray(data.values)) {
                    throw new Error('Ongeldig export-bestand (verwacht { values: {...} })');
                }
                const entries = Object.entries(data.values);
                if (entries.some(([key]) => !/^[a-zA-Z0-9_-]{1,100}$/.test(key))) {
                    throw new Error('Ongeldig export-bestand: een of meer instellingssleutels zijn ongeldig');
                }
                entries.forEach(([key, value]) => {
                    if (!this.set(key, value)) {
                        throw new Error(`Instelling ${key} kon niet worden opgeslagen`);
                    }
                });
                return entries.length;
            },
            resetKeys: function(keys) {
                (keys || []).forEach(k => this.delete(k));
            }
        },

        isGamePage: function() {
            return /\/game\//.test(window.location.pathname) || /\/game$/.test(window.location.pathname);
        },

        isForumPage: function() {
            const h = window.location.hostname;
            const p = window.location.pathname;
            return /forum\.grepolis\.com$/i.test(h) || h.includes('forum.grepolis') || p.indexOf('/alliance_forum') >= 0;
        },

        isModuleEnabled: function(moduleId) {
            const entry = this.MODULE_CATALOG.find(m => m.id === moduleId);
            if (!entry) return true;
            const val = this.storage.get(entry.key, entry.defaultOn);
            return val !== false && val !== 'false' && val !== 0;
        },

        setModuleEnabled: function(moduleId, enabled) {
            const entry = this.MODULE_CATALOG.find(m => m.id === moduleId);
            if (!entry) return;
            this.storage.set(entry.key, !!enabled);
            const mod = this.modules[moduleId];
            if (!enabled && mod && typeof mod.stop === 'function') {
                try { mod.stop(); } catch (e) { this.log('Settings', `Module ${moduleId} kon niet stoppen: ${e.message}`, 'error'); }
            }
            if (enabled && mod && typeof mod.onEnable === 'function') {
                try { mod.onEnable(); } catch (e) { this.log('Settings', `Module ${moduleId} kon niet starten: ${e.message}`, 'error'); }
            }
            if (entry.tabId && GMB_UI) GMB_UI.setTabVisibility(entry.tabId, enabled);
        },

        sendDiscord: function(message, type = 'info', options = {}) {
            const url = this.storage.get('notify_discord_webhook', '');
            if (!url) return Promise.resolve(false);
            let parsed;
            try { parsed = new URL(url); } catch (e) { return Promise.reject(new Error('Discord-webhook URL is ongeldig')); }
            if (parsed.protocol !== 'https:' || !/^(discord\.com|discordapp\.com)$/i.test(parsed.hostname) || !/^\/api\/webhooks\/\d+\/[^/]+/.test(parsed.pathname)) {
                return Promise.reject(new Error('Alleen een geldige HTTPS Discord-webhook is toegestaan'));
            }
            const color = type === 'error' ? 15158332 : type === 'success' ? 3066993 : type === 'warn' ? 15105570 : 3447003;
            const payload = {
                username: 'Grepolis Manager',
                embeds: [{
                    title: `GMB ${this.worldId || ''}`.trim(),
                    description: String(message).slice(0, 1900),
                    color,
                    timestamp: new Date().toISOString()
                }]
            };
            // Alleen 'content' kan pingen; embeds pingen niet. Standaard geen mentions.
            if (options && options.everyone) {
                payload.content = `@everyone ${String(message)}`.slice(0, 1900);
                payload.allowed_mentions = { parse: ['everyone'] };
            }
            return GMB_API.externalPost(url, payload).then(() => true);
        },

        notify: function(message, options = {}) {
            const type = options.type || 'info';
            const title = options.title || 'Grepolis Manager';
            const useDiscord = options.discord === true || (options.discord !== false && this.storage.get('notify_discord', false));
            this.log('Notify', message, type);
            const results = [];

            try {
                const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                if (uw && uw.HumanMessage) {
                    if (type === 'error' && typeof uw.HumanMessage.error === 'function') uw.HumanMessage.error(message);
                    else if (type === 'success' && typeof uw.HumanMessage.success === 'function') uw.HumanMessage.success(message);
                    else if (type === 'warn' && typeof uw.HumanMessage.warning === 'function') uw.HumanMessage.warning(message);
                }
            } catch (e) { this.log('Notify', `In-game melding mislukt: ${e.message}`, 'warn'); }

            if (options.desktop !== false && this.storage.get('notify_desktop', true) && typeof GM_notification === 'function') {
                try {
                    GM_notification({ title, text: String(message), timeout: options.timeout || 6000 });
                } catch (e) { this.log('Notify', `Desktopmelding mislukt: ${e.message}`, 'warn'); }
            }

            if (GMB_UI && typeof GMB_UI.toast === 'function') {
                GMB_UI.toast(message, type);
            }

            if (useDiscord) {
                results.push(this.sendDiscord(message, type, { everyone: options.discordEveryone === true }).catch(err => {
                    this.log('Notify', `Discord-webhook mislukt: ${err.message}`, 'warn');
                    return false;
                }));
            }
            return Promise.all(results);
        },

        // Server Detection (ondersteunt nl105, en120, de99, zz2 etc.)
        detectServer: function() {
            try {
                const hostname = window.location.hostname;
                const match = hostname.match(/^([a-z]{2})(\d+)\.grepolis\.com$/i);
                if (match) {
                    this.marketId = match[1].toLowerCase();
                    this.worldNumber = match[2];
                    this.worldId = this.marketId + this.worldNumber;
                    GMB.log('Core', `Server gedetecteerd: ${this.worldId}`, 'success');
                    return true;
                }
                const subMatch = hostname.match(/^([a-z0-9]+)\.grepolis\.com$/i);
                if (subMatch) {
                    this.worldId = subMatch[1].toLowerCase();
                    this.marketId = this.worldId.replace(/[0-9]/g, '');
                    GMB.log('Core', `Server gedetecteerd: ${this.worldId}`, 'success');
                    return true;
                }
                return false;
            } catch (e) {
                GMB.log('Core', `Fout bij detecteren server: ${e.message}`, 'error');
                return false;
            }
        },

        // Game Data Detection
        detectGameData: function() {
            try {
                const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                if (uw && uw.Game) {
                    this.worldId = uw.Game.world_id || this.worldId;
                    this.marketId = uw.Game.market_id || this.marketId;
                    this.playerId = uw.Game.player_id || this.playerId;
                    this.allianceId = uw.Game.alliance_id || this.allianceId;
                    this.csrfToken = uw.Game.csrfToken || uw.Game.token || uw.Game.h_token;
                    this.townId = uw.Game.townId || this.townId;
                    GMB.log('Core', `Game data gereed - Wereld: ${this.worldId}, Speler: ${this.playerId}, Stad: ${this.townId}`, 'success');
                    return true;
                }
                return false;
            } catch (e) {
                GMB.log('Core', `Fout bij detecteren game data: ${e.message}`, 'error');
                return false;
            }
        },

        // Safe Window/Document Ready
        ready: function(callback) {
            if (document.readyState === 'complete') {
                callback();
            } else {
                window.addEventListener('load', callback);
            }
        },

        // Module Registration
        registerModule: function(name, module) {
            this.modules[name] = module;
            GMB.log('Core', `Module geregistreerd: ${name}`, 'success');
        },

        // Initialize All Modules
        initModules: function() {
            Object.keys(this.modules).forEach(name => {
                const module = this.modules[name];
                if (this.isForumPage() && module.gameOnly) return;
                if (typeof module.init === 'function') {
                    try {
                        module.init();
                        GMB.log('Core', `Module gestart: ${name}`, 'success');
                    } catch (e) {
                        GMB.log('Core', `Fout bij starten ${name}: ${e.message}`, 'error');
                    }
                }
            });
            this.initialized = true;
        },

    };

    GMB.debug = GMB.storage.get('gmb_debug', false) === true;

    // ============================================================
    // UI FRAMEWORK
    // ============================================================

    const GMB_UI = {
        panel: null,
        visible: false,
        callbacks: {},

        styles: `
            #gmb-main-panel {
                position: fixed;
                top: 50px;
                right: 20px;
                width: 380px;
                max-height: 85vh;
                background: linear-gradient(135deg, #161824 0%, #1c2033 100%);
                border: 2px solid #e94560;
                border-radius: 10px;
                color: #f1f1f1;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 12px;
                z-index: 99999;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(233, 69, 96, 0.3);
                display: none;
                overflow: hidden;
            }

            #gmb-main-panel.visible {
                display: flex;
                flex-direction: column;
            }

            #gmb-panel-header {
                background: linear-gradient(90deg, #1f2338 0%, #2a1b2d 100%);
                padding: 10px 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #e94560;
                cursor: move;
                user-select: none;
            }

            #gmb-panel-title {
                font-weight: bold;
                font-size: 13px;
                color: #ff6b81;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            #gmb-panel-close {
                background: none;
                border: none;
                color: #ff6b81;
                font-size: 20px;
                cursor: pointer;
                padding: 0 5px;
                line-height: 1;
                transition: color 0.2s;
            }

            #gmb-panel-close:hover {
                color: #fff;
            }

            #gmb-panel-content {
                padding: 12px;
                overflow-y: auto;
                max-height: calc(85vh - 55px);
            }

            #gmb-panel-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 12px;
                flex-wrap: wrap;
                background: rgba(0, 0, 0, 0.2);
                padding: 4px;
                border-radius: 6px;
            }

            .gmb-tab {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(233, 69, 96, 0.4);
                color: #ddd;
                padding: 5px 9px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                transition: all 0.2s;
                user-select: none;
            }

            .gmb-tab:hover {
                background: rgba(233, 69, 96, 0.25);
                color: #fff;
            }

            .gmb-tab.active {
                background: #e94560;
                color: #fff;
                border-color: #ff6b81;
                box-shadow: 0 2px 8px rgba(233, 69, 96, 0.4);
            }

            .gmb-tab-content {
                display: none;
            }

            #gmb-panel-groups {
                display: flex;
                gap: 4px;
                margin-bottom: 6px;
                flex-wrap: wrap;
            }

            .gmb-group {
                background: rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #eee;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 700;
                user-select: none;
            }

            .gmb-group:hover { background: rgba(233, 69, 96, 0.3); }

            .gmb-group.active {
                background: #0f3460;
                border-color: #e94560;
                color: #fff;
            }

            .gmb-tab-content.active {
                display: block;
            }

            .gmb-section {
                margin-bottom: 12px;
                padding: 10px 12px;
                background: rgba(255, 255, 255, 0.04);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .gmb-section-title {
                font-weight: bold;
                color: #ff6b81;
                margin-bottom: 8px;
                font-size: 12px;
                border-bottom: 1px solid rgba(233, 69, 96, 0.3);
                padding-bottom: 4px;
            }

            .gmb-toggle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin: 6px 0;
            }

            .gmb-toggle-label {
                flex: 1;
                font-size: 11.5px;
                color: #eee;
            }

            .gmb-toggle-switch {
                position: relative;
                width: 38px;
                height: 20px;
                background: #33394a;
                border-radius: 10px;
                cursor: pointer;
                transition: background 0.3s;
                flex-shrink: 0;
            }

            .gmb-toggle-switch.active {
                background: #4caf50;
            }

            .gmb-toggle-switch::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 16px;
                height: 16px;
                background: #fff;
                border-radius: 50%;
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .gmb-toggle-switch.active::after {
                transform: translateX(18px);
            }

            .gmb-button {
                background: linear-gradient(135deg, #e94560 0%, #d83a56 100%);
                color: #fff;
                border: 1px solid #ff6b81;
                padding: 6px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
            }

            .gmb-button:hover {
                background: linear-gradient(135deg, #ff6b81 0%, #e94560 100%);
                box-shadow: 0 2px 10px rgba(233, 69, 96, 0.4);
            }

            .gmb-button-secondary {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #eee;
            }

            .gmb-button-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
                color: #fff;
            }

            .gmb-input, .gmb-select {
                width: 100%;
                padding: 6px 8px;
                background: rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(233, 69, 96, 0.5);
                border-radius: 4px;
                color: #fff;
                margin: 4px 0;
                box-sizing: border-box;
                font-size: 11px;
            }

            .gmb-input:focus, .gmb-select:focus {
                outline: none;
                border-color: #ff6b81;
                box-shadow: 0 0 5px rgba(233, 69, 96, 0.5);
            }

            .gmb-badge {
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 10.5px;
                font-weight: bold;
                letter-spacing: 0.5px;
                display: inline-block;
            }

            .gmb-badge-idle {
                background: #33394a;
                color: #aaa;
                border: 1px solid #4a5168;
            }

            .gmb-badge-success {
                background: rgba(76, 175, 80, 0.2);
                border: 1px solid #4caf50;
                color: #69f0ae;
            }

            .gmb-badge-error {
                background: rgba(244, 67, 54, 0.2);
                border: 1px solid #f44336;
                color: #ff5252;
            }

            .gmb-badge-info {
                background: rgba(33, 150, 243, 0.2);
                border: 1px solid #2196f3;
                color: #40c4ff;
            }

            .gmb-status {
                padding: 6px 10px;
                margin: 6px 0;
                border-radius: 4px;
                font-size: 11px;
            }

            .gmb-status.success {
                background: rgba(76, 175, 80, 0.15);
                border: 1px solid #4caf50;
                color: #81c784;
            }

            .gmb-status.error {
                background: rgba(244, 67, 54, 0.15);
                border: 1px solid #f44336;
                color: #e57373;
            }

            .gmb-status.info {
                background: rgba(33, 150, 243, 0.15);
                border: 1px solid #2196f3;
                color: #64b5f6;
            }

            .gmb-log-container {
                max-height: 140px;
                overflow-y: auto;
                font-family: Consolas, monospace;
                font-size: 10px;
                background: rgba(0, 0, 0, 0.4);
                padding: 6px 8px;
                border-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .gmb-log-entry {
                margin-bottom: 2px;
                line-height: 1.35;
                word-break: break-word;
            }

            .gmb-log-success { color: #81c784; }
            .gmb-log-error { color: #e57373; }
            .gmb-log-warn { color: #ffb74d; }
            .gmb-log-info { color: #90caf9; }

            .gmb-city-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 8px;
                margin: 4px 0;
                background: rgba(255, 255, 255, 0.04);
                border-radius: 4px;
                border-left: 3px solid #e94560;
                transition: background 0.2s;
            }

            .gmb-city-row:hover {
                background: rgba(255, 255, 255, 0.08);
            }

            #gmb-farm-alarm {
                position: fixed;
                top: 4px;
                left: 680px;
                z-index: 99996;
                display: none;
                padding: 7px 11px;
                background: rgba(22, 24, 36, 0.94);
                border: 1px solid #e94560;
                border-radius: 5px;
                color: #fff;
                font-size: 11px;
                cursor: pointer;
            }
            #gmb-farm-alarm.visible { display: block; }
            #gmb-farm-alarm.ready { border-color: #4caf50; color: #a5d6a7; }

            #gmb-toast-stack {
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 100000;
                display: flex;
                flex-direction: column;
                gap: 6px;
                pointer-events: none;
            }
            .gmb-toast {
                pointer-events: auto;
                min-width: 220px;
                max-width: 320px;
                padding: 8px 12px;
                border-radius: 6px;
                color: #fff;
                font-size: 12px;
                background: #2a2f45;
                border-left: 4px solid #90caf9;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            }
            .gmb-toast.success { border-left-color: #81c784; }
            .gmb-toast.error { border-left-color: #e57373; }
            .gmb-toast.warn { border-left-color: #ffb74d; }

            .gmb-kv { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
            .gmb-muted { color: #aaa; font-size: 11px; }
            textarea.gmb-input { min-height: 90px; resize: vertical; font-family: Consolas, monospace; font-size: 11px; }
        `,

        init: function() {
            if (this.initialized) return;
            this.initialized = true;

            // Add CSS styles
            if (typeof GM_addStyle !== 'undefined') {
                GM_addStyle(this.styles);
            } else {
                const styleEl = document.createElement('style');
                styleEl.textContent = this.styles;
                document.head.appendChild(styleEl);
            }

            const embedCss = `#gmb-main-panel.gmb-embedded{position:static!important;top:auto!important;right:auto!important;left:auto!important;width:100%!important;max-width:100%;height:100%;min-height:380px;max-height:none;box-shadow:none;border-radius:0;border-left:none;border-right:none;border-top:none}
#gmb-main-panel.gmb-embedded #gmb-panel-header{display:none}
#gmb-main-panel.gmb-embedded #gmb-panel-content{flex:1;min-height:0;max-height:none;overflow-y:auto}`;
            if (typeof GM_addStyle !== 'undefined') GM_addStyle(embedCss);
            else { const s = document.createElement('style'); s.textContent = embedCss; document.head.appendChild(s); }

            this.createToastStack();

            // Create main panel
            this.createPanel();
            this.initEvents();


            GMB.log('UI', 'UI Framework geïnitialiseerd', 'success');
        },


        createToastStack: function() {
            if (document.getElementById('gmb-toast-stack')) return;
            const stack = document.createElement('div');
            stack.id = 'gmb-toast-stack';
            document.body.appendChild(stack);
        },

        toast: function(message, type = 'info') {
            const stack = document.getElementById('gmb-toast-stack');
            if (!stack) return;
            const item = document.createElement('div');
            item.className = `gmb-toast ${type}`;
            item.textContent = String(message);
            stack.appendChild(item);
            setTimeout(() => item.remove(), 6000);
        },

        TAB_GROUPS: [
            { id: 'system', label: '⚙ Systeem' },
            { id: 'managers', label: '🗂 Managers' },
            { id: 'viewers', label: '👁 Viewers' },
            { id: 'utilities', label: '🛠 Utilities' },
            { id: 'alliance-tools', label: '🏛 Alliantie-tools' }
        ],

        TAB_GROUP_BY_TAB: {
            main: 'system', logs: 'system', settings: 'system',
            troops: 'managers', commands: 'managers',
            'mgr-players': 'viewers', 'mgr-towns': 'viewers', 'mgr-military': 'viewers', 'mgr-special': 'viewers', 
            'mgr-map': 'utilities', 'mgr-reports': 'utilities', farmalert: 'utilities', goldalert: 'utilities',
            'alliance-forum': 'alliance-tools', absence: 'alliance-tools'
        },

        activeGroup: 'system',

        getTabGroup: function(tabId) {
            return this.TAB_GROUP_BY_TAB[tabId] || 'system';
        },

        refreshTabDisplay: function() {
            if (!this.panel) return;
            const groupsContainer = this.panel.querySelector('#gmb-panel-groups');
            const tabs = Array.from(this.panel.querySelectorAll('.gmb-tab'));
            tabs.forEach(tab => {
                const hidden = tab.dataset.moduleHidden === '1';
                tab.style.display = !hidden && tab.dataset.group === this.activeGroup ? '' : 'none';
            });
            if (!groupsContainer) return;
            groupsContainer.querySelectorAll('.gmb-group').forEach(button => {
                const id = button.dataset.group;
                const hasVisible = tabs.some(tab => tab.dataset.group === id && tab.dataset.moduleHidden !== '1');
                button.style.display = hasVisible ? '' : 'none';
                button.classList.toggle('active', id === this.activeGroup);
            });
        },

        ensureGroupButton: function(groupId) {
            const container = this.panel.querySelector('#gmb-panel-groups');
            if (!container || container.querySelector(`.gmb-group[data-group="${groupId}"]`)) return;
            const definition = this.TAB_GROUPS.find(group => group.id === groupId) || this.TAB_GROUPS[0];
            const button = document.createElement('div');
            button.className = 'gmb-group';
            button.dataset.group = groupId;
            button.textContent = definition.label;
            button.addEventListener('click', () => {
                const first = Array.from(this.panel.querySelectorAll('.gmb-tab'))
                    .find(tab => tab.dataset.group === groupId && tab.dataset.moduleHidden !== '1');
                if (first) this.switchTab(first.getAttribute('data-tab'));
            });
            const order = id => this.TAB_GROUPS.findIndex(group => group.id === id);
            const next = Array.from(container.children).find(child => order(child.dataset.group) > order(groupId));
            container.insertBefore(button, next || null);
        },

        setTabVisibility: function(tabId, visible) {
            const tab = this.panel && this.panel.querySelector(`.gmb-tab[data-tab="${tabId}"]`);
            const content = this.panel && document.getElementById(`gmb-tab-${tabId}`);
            if (tab) tab.dataset.moduleHidden = visible ? '0' : '1';
            if (content) content.style.display = visible ? '' : 'none';
            if (!visible && content && content.classList.contains('active')) this.switchTab('settings');
            this.refreshTabDisplay();
        },

        createPanel: function() {
            if (document.getElementById('gmb-main-panel')) return;

            this.panel = document.createElement('div');
            this.panel.id = 'gmb-main-panel';
            this.panel.innerHTML = `
                <div id="gmb-panel-header">
                    <span id="gmb-panel-title">🛠 Grepolis Manager v${GMB.version}</span>
                    <button id="gmb-panel-close" title="Sluiten">×</button>
                </div>
                <div id="gmb-panel-content">
                    <div id="gmb-panel-groups"></div>
                    <div id="gmb-panel-tabs"></div>
                    <div id="gmb-tab-contents"></div>
                </div>
            `;
            const mount = this.pendingMount && document.documentElement.contains(this.pendingMount)
                ? this.pendingMount
                : document.getElementById('gm-gmb-mount');
            (mount || document.body).appendChild(this.panel);
            if (mount) this.panel.classList.add('gmb-embedded', 'visible');

            // Close button
            this.panel.querySelector('#gmb-panel-close').addEventListener('click', () => this.toggle());

            // Make header draggable
            this.makeDraggable(this.panel.querySelector('#gmb-panel-header'), this.panel);
        },

        initEvents: function() {
            // Delegated click handler on the entire panel to prevent inline onclick issues
            this.panel.addEventListener('click', (e) => {
                // Toggle switch click
                const toggle = e.target.closest('.gmb-toggle-switch');
                if (toggle) {
                    toggle.classList.toggle('active');
                    const key = toggle.getAttribute('data-key') || (toggle.dataset && toggle.dataset.key);
                    const isActive = toggle.classList.contains('active');
                    GMB.storage.set(key, isActive);

                    const cb = this.callbacks[toggle.id];
                    this.executeCallback(cb, isActive);
                    return;
                }

                // Button click
                const btn = e.target.closest('button.gmb-button[data-btn-id]');
                if (btn) {
                    const btnId = btn.getAttribute('data-btn-id') || (btn.dataset && btn.dataset.btnId);
                    const cb = this.callbacks[btnId];
                    this.executeCallback(cb, e);
                    return;
                }
            });
        },

        executeCallback: function(callback, ...args) {
            if (typeof callback === 'function') {
                try {
                    callback(...args);
                } catch (e) {
                    GMB.log('UI', `Fout in functie callback: ${e.message}`, 'error');
                }
                return;
            }
            if (typeof callback === 'string') {
                try {
                    const clean = callback.replace(/\(\)$/, '');
                    const parts = clean.split('.');
                    let ctx = null;
                    let fn = null;

                    if (parts[0] === 'GMB_TroopManager') { ctx = GMB_TroopManager; fn = ctx[parts[1]]; }
                    else if (parts[0] === 'GMB_UI') { ctx = GMB_UI; fn = ctx[parts[1]]; }
                    else if (parts[0] === 'GMB') { ctx = GMB; fn = ctx[parts[1]]; }
                    else if (typeof window[parts[0]] === 'object') {
                        ctx = window[parts[0]];
                        fn = parts[1] ? ctx[parts[1]] : ctx;
                    }

                    if (typeof fn === 'function') {
                        fn.apply(ctx, args);
                    }
                } catch (e) {
                    GMB.log('UI', `Fout in string callback (${callback}): ${e.message}`, 'error');
                }
            }
        },

        makeDraggable: function(handle, element) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            handle.addEventListener('mousedown', (e) => {
                if (e.target.id === 'gmb-panel-close') return;
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.addEventListener('mouseup', closeDragElement);
                document.addEventListener('mousemove', elementDrag);
            });

            function elementDrag(e) {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = Math.max(0, element.offsetTop - pos2) + "px";
                element.style.left = Math.max(0, element.offsetLeft - pos1) + "px";
                element.style.right = 'auto';
            }

            function closeDragElement() {
                document.removeEventListener('mouseup', closeDragElement);
                document.removeEventListener('mousemove', elementDrag);
            }
        },

        attachTo: function(el) {
            if (!el || !el.appendChild) return false;
            this.pendingMount = el;
            if (!this.panel) return false;
            el.appendChild(this.panel);
            this.panel.classList.add('gmb-embedded', 'visible');
            return true;
        },

        toggle: function() {
            this.visible = !this.visible;
            if (this.visible) {
                this.panel.classList.add('visible');
            } else {
                this.panel.classList.remove('visible');
            }
        },

        addTab: function(id, title, content) {
            const tabsContainer = this.panel.querySelector('#gmb-panel-tabs');
            const contentsContainer = this.panel.querySelector('#gmb-tab-contents');

            if (document.getElementById(`gmb-tab-${id}`)) {
                const existing = document.getElementById(`gmb-tab-${id}`);
                existing.innerHTML = content;
                return;
            }

            // Tab button
            const tab = document.createElement('div');
            tab.className = 'gmb-tab';
            tab.textContent = title;
            tab.setAttribute('data-tab', id);
            tab.dataset.group = this.getTabGroup(id);
            tab.dataset.moduleHidden = '0';
            this.ensureGroupButton(tab.dataset.group);
            tab.style.display = 'none';
            tab.addEventListener('click', () => this.switchTab(id));
            tabsContainer.appendChild(tab);

            // Tab content
            const contentDiv = document.createElement('div');
            contentDiv.className = 'gmb-tab-content';
            contentDiv.id = `gmb-tab-${id}`;
            contentDiv.innerHTML = content;
            contentsContainer.appendChild(contentDiv);
            const moduleEntry = GMB.MODULE_CATALOG.find(entry => entry.tabId === id);
            if (moduleEntry) this.setTabVisibility(id, GMB.isModuleEnabled(moduleEntry.id));
            this.refreshTabDisplay();

            // Switch to first tab if none active
            if (!this.panel.querySelector('.gmb-tab.active')) {
                this.switchTab(id);
            }
        },

        switchTab: function(id) {
            const requestedTab = this.panel.querySelector(`.gmb-tab[data-tab="${id}"]`);
            if (!requestedTab || requestedTab.dataset.moduleHidden === '1') return;
            this.activeGroup = requestedTab.dataset.group;
            this.panel.querySelectorAll('.gmb-tab').forEach(tab => {
                tab.classList.toggle('active', tab.getAttribute('data-tab') === id);
            });
            this.panel.querySelectorAll('.gmb-tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `gmb-tab-${id}`);
            });
            this.refreshTabDisplay();
        },

        createToggle: function(label, key, defaultValue = false, callback = null) {
            const currentValue = GMB.storage.get(key, defaultValue);
            const toggleId = `gmb-toggle-${key.replace(/[^a-zA-Z0-9]/g, '_')}`;

            if (callback) {
                this.callbacks[toggleId] = callback;
            }

            return `
                <div class="gmb-toggle">
                    <span class="gmb-toggle-label">${label}</span>
                    <div class="gmb-toggle-switch ${currentValue ? 'active' : ''}"
                         id="${toggleId}"
                         data-key="${key}"
                         data-toggle-id="${toggleId}">
                    </div>
                </div>
            `;
        },

        createButton: function(label, onClick, className = '', extraStyle = '') {
            const buttonId = `gmb-btn-${Math.random().toString(36).substr(2, 9)}`;
            if (onClick) {
                this.callbacks[buttonId] = onClick;
            }
            return `<button class="gmb-button ${className}" id="${buttonId}" data-btn-id="${buttonId}" style="${extraStyle}">${label}</button>`;
        },

        createStatus: function(message, type = 'info') {
            return `<div class="gmb-status ${type}">${message}</div>`;
        },

    };

    // ============================================================
    // SETTINGS MODULE
    // ============================================================

    const GMB_Settings = {
        init: function() {
            this.addUITab();
        },

        addUITab: function() {
            if (document.getElementById('gmb-tab-settings')) return;
            const moduleToggles = GMB.MODULE_CATALOG.map(entry =>
                GMB_UI.createToggle(entry.label, entry.key, entry.defaultOn, enabled => GMB.setModuleEnabled(entry.id, enabled))
            ).join('');

            GMB_UI.addTab('settings', '⚙ Instellingen', `
                <div class="gmb-section">
                    <div class="gmb-section-title">Modules</div>
                    ${moduleToggles}
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Algemeen</div>
                    ${GMB_UI.createToggle('Debug-modus', 'gmb_debug', false, enabled => { GMB.debug = enabled; })}
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Notificaties</div>
                    ${GMB_UI.createToggle('Desktopmeldingen', 'notify_desktop', true)}
                    ${GMB_UI.createToggle('Discord-webhookmeldingen', 'notify_discord', false)}
                    <label class="gmb-muted" for="gmb-discord-webhook">Discord webhook-URL</label>
                    <input class="gmb-input" id="gmb-discord-webhook" type="url" autocomplete="off" placeholder="https://discord.com/api/webhooks/...">
                    ${GMB_UI.createButton('Testmelding', () => GMB.notify('Testmelding vanuit Grepolis Manager.', { discord: true, type: 'info' }), 'gmb-button-secondary')}
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">API-rate limiter</div>
                    <label class="gmb-muted" for="gmb-api-min-delay">Minimale vertraging (ms)</label>
                    <input class="gmb-input" id="gmb-api-min-delay" type="number" min="0" step="100">
                    <label class="gmb-muted" for="gmb-api-jitter">Willekeurige extra vertraging (ms)</label>
                    <input class="gmb-input" id="gmb-api-jitter" type="number" min="0" step="100">
                    <label class="gmb-muted" for="gmb-api-max-per-minute">Maximum API-posts per minuut</label>
                    <input class="gmb-input" id="gmb-api-max-per-minute" type="number" min="1" max="60" step="1">
                    <label class="gmb-muted" for="gmb-world-cache-ttl">Cacheduur werelddata (minuten)</label>
                    <input class="gmb-input" id="gmb-world-cache-ttl" type="number" min="1" step="1">
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Instellingen exporteren / importeren</div>
                    ${GMB_UI.createButton('Exporteren als JSON', () => this.exportSettings())}
                    <input class="gmb-input" id="gmb-settings-import" type="file" accept="application/json,.json">
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Reset</div>
                    <select class="gmb-select" id="gmb-reset-module">
                        ${Object.keys(GMB.MODULE_RESET_KEYS).map(key => `<option value="${key}">${key === 'Core' ? 'Algemene instellingen' : key}</option>`).join('')}
                    </select>
                    ${GMB_UI.createButton('Reset geselecteerd', () => this.resetModule(document.getElementById('gmb-reset-module').value), 'gmb-button-secondary')}
                    ${GMB_UI.createButton('Alles resetten', () => this.resetAll(), 'gmb-button-secondary')}
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Grepolis Manager</div>
                    <div class="gmb-kv"><strong>Versie</strong><span>${GMB.version}</span></div>
                </div>
            `);
            this.bindSettingsInputs();
            GMB.MODULE_CATALOG.forEach(entry => GMB_UI.setTabVisibility(entry.tabId, GMB.isModuleEnabled(entry.id)));
        },

        escapeHtml: function(value) {
            return String(value).replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[char]);
        },

        bindSettingsInputs: function() {
            const webhook = document.getElementById('gmb-discord-webhook');
            const minDelay = document.getElementById('gmb-api-min-delay');
            const jitter = document.getElementById('gmb-api-jitter');
            const maxPerMinute = document.getElementById('gmb-api-max-per-minute');
            const cacheTtl = document.getElementById('gmb-world-cache-ttl');
            if (webhook) {
                webhook.value = GMB.storage.get('notify_discord_webhook', '');
                webhook.addEventListener('change', () => GMB.storage.set('notify_discord_webhook', webhook.value.trim()));
            }
            if (minDelay) {
                minDelay.value = GMB.storage.get('api_min_delay', 1000);
                minDelay.addEventListener('change', () => GMB.storage.set('api_min_delay', Math.max(0, Number(minDelay.value) || 0)));
            }
            if (jitter) {
                jitter.value = GMB.storage.get('api_jitter', 500);
                jitter.addEventListener('change', () => GMB.storage.set('api_jitter', Math.max(0, Number(jitter.value) || 0)));
            }
            if (maxPerMinute) {
                maxPerMinute.value = GMB.storage.get('api_max_per_minute', 10);
                maxPerMinute.addEventListener('change', () => GMB.storage.set('api_max_per_minute', Math.min(60, Math.max(1, parseInt(maxPerMinute.value, 10) || 10))));
            }
            if (cacheTtl) {
                cacheTtl.value = Math.round(GMB.storage.get('world_cache_ttl', 21600000) / 60000);
                cacheTtl.addEventListener('change', () => GMB.storage.set('world_cache_ttl', Math.max(1, parseInt(cacheTtl.value, 10) || 360) * 60000));
            }
            const importer = document.getElementById('gmb-settings-import');
            if (importer) importer.addEventListener('change', async () => {
                const file = importer.files && importer.files[0];
                if (!file) return;
                try {
                    const count = GMB.storage.importAll(JSON.parse(await file.text()));
                    GMB.notify(`${count} instellingen geïmporteerd. Herlaad de pagina om alle modules toe te passen.`, { type: 'success' });
                    importer.value = '';
                } catch (error) {
                    GMB.log('Settings', `Importeren mislukt: ${error.message}`, 'error');
                    GMB.notify(`Importeren mislukt: ${error.message}`, { type: 'error' });
                }
            });
        },

        exportSettings: function() {
            const json = JSON.stringify(GMB.storage.exportAll(), null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `gmb-settings-${GMB.worldId || 'all'}-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            if (typeof GM_setClipboard === 'function') {
                try { GM_setClipboard(json, 'text'); } catch (error) { GMB.log('Settings', `Kopiëren naar klembord mislukt: ${error.message}`, 'warn'); }
            }
            GMB.notify('GMB-instellingen geëxporteerd naar JSON.', { type: 'success' });
        },

        resetModule: function(moduleId) {
            if (!Object.prototype.hasOwnProperty.call(GMB.MODULE_RESET_KEYS, moduleId)) {
                GMB.notify('Onbekende module voor reset.', { type: 'error' });
                return;
            }
            if (!confirm(`Instellingen van ${moduleId} resetten?`)) return;
            const module = GMB.modules[moduleId];
            if (module && typeof module.stop === 'function') module.stop();
            GMB.storage.resetKeys(GMB.MODULE_RESET_KEYS[moduleId]);
            location.reload();
        },

        resetAll: function() {
            if (!confirm('Alle opgeslagen GMB-instellingen en caches wissen?')) return;
            Object.values(GMB.modules).forEach(module => {
                if (module && typeof module.stop === 'function') module.stop();
            });
            const keys = new Set(GMB.storage.listKeys());
            Object.values(GMB.MODULE_RESET_KEYS).forEach(list => list.forEach(key => keys.add(key)));
            GMB.storage.resetKeys(Array.from(keys));
            location.reload();
        }
    };

    // ============================================================
    // API HELPER (Voor communicatie met Grepolis backend)
    // ============================================================

    const GMB_API = {
        getUW: function() {
            return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        },

        getCSRFToken: function() {
            const uw = this.getUW();
            return (uw.Game && (uw.Game.csrfToken || uw.Game.token || uw.Game.h_token)) || GMB.csrfToken || null;
        },

        getTownId: function() {
            const uw = this.getUW();
            return (uw.Game && uw.Game.townId) || GMB.townId || null;
        },

        getWorldId: function() {
            const uw = this.getUW();
            return (uw.Game && uw.Game.world_id) || GMB.worldId;
        },

        // Grepolis levert serverkant-notificaties (grondstoffen, farmrelaties) mee in elke game-response.
        // Ruwe $.ajax-calls omzeilen gpAjax; zonder doorsturen gaan die notificaties voor de native UI verloren.
        nlInit: function() {
            try {
                const loader = this.getUW().NotificationLoader;
                return loader && typeof loader.isGameInitialized === 'function' ? !!loader.isGameInitialized() : true;
            } catch (error) {
                return true;
            }
        },

        forwardNotifications: function(response) {
            try {
                const root = response && response.json && typeof response.json === 'object' ? response.json : response;
                if (!root || typeof root !== 'object' || !Array.isArray(root.notifications) || !root.notifications.length) return false;
                const loader = this.getUW().NotificationLoader;
                if (!loader || typeof loader.recvNotifyData !== 'function') {
                    if (!this.notificationWarned) {
                        this.notificationWarned = true;
                        GMB.log('API', 'NotificationLoader.recvNotifyData ontbreekt; native notificaties kunnen niet worden doorgestuurd', 'warn');
                    }
                    return false;
                }
                loader.recvNotifyData(root, 'gmb');
                return true;
            } catch (error) {
                GMB.log('API', `Notificaties doorsturen mislukt: ${error.message}`, 'warn');
                return false;
            }
        },

        postQueue: [],
        processingPostQueue: false,
        lastPostStartedAt: 0,
        postStartTimes: [],

        post: function(controller, action, payload, townId = null, moduleId = null) {
            return new Promise((resolve, reject) => {
                this.postQueue.push({
                    run: () => this._postImmediate(controller, action, payload, townId),
                    moduleId,
                    resolve,
                    reject
                });
                this.processPostQueue();
            });
        },

        cancelPendingPosts: function(error, moduleId = null) {
            const pending = [];
            this.postQueue = this.postQueue.filter(task => {
                if (!moduleId || task.moduleId === moduleId) {
                    pending.push(task);
                    return false;
                }
                return true;
            });
            pending.forEach(task => task.reject(error));
        },

        processPostQueue: async function() {
            if (this.processingPostQueue) return;
            this.processingPostQueue = true;
            try {
                while (this.postQueue.length) {

                    const now = Date.now();
                    this.postStartTimes = this.postStartTimes.filter(time => now - time < 60000);
                    const maxPerMinute = Math.min(60, Math.max(1, parseInt(GMB.storage.get('api_max_per_minute', 10), 10) || 10));
                    const minuteWait = this.postStartTimes.length >= maxPerMinute
                        ? Math.max(0, this.postStartTimes[0] + 60000 - now)
                        : 0;
                    const minDelay = Math.max(0, Number(GMB.storage.get('api_min_delay', 1000)) || 0);
                    const jitter = Math.max(0, Number(GMB.storage.get('api_jitter', 500)) || 0);
                    const delayWait = Math.max(0, this.lastPostStartedAt + minDelay + Math.random() * jitter - now);
                    const wait = Math.max(minuteWait, delayWait);
                    if (wait > 0) {
                        await new Promise(resolve => setTimeout(resolve, wait));
                        continue;
                    }

                    const task = this.postQueue.shift();
                    if (task.moduleId) {
                        const moduleEntry = GMB.MODULE_CATALOG.find(entry => entry.id === task.moduleId);
                        if (!GMB.isModuleEnabled(task.moduleId) || (moduleEntry && moduleEntry.enabledKey && !GMB.storage.get(moduleEntry.enabledKey, false))) {
                            task.reject(new Error(`Module ${task.moduleId} is uitgeschakeld`));
                            continue;
                        }
                    }
                    this.lastPostStartedAt = Date.now();
                    this.postStartTimes.push(this.lastPostStartedAt);
                    try {
                        const response = await task.run();
                        task.resolve(response);
                    } catch (error) {
                        task.reject(error);
                    }
                }
            } finally {
                this.processingPostQueue = false;
                if (this.postQueue.length) this.processPostQueue();
            }
        },

        _postImmediate: function(controller, action, payload, townId = null) {
            return new Promise((resolve, reject) => {
                const uw = this.getUW();
                const tid = townId || this.getTownId();
                const csrf = this.getCSRFToken();
                const $ = uw.jQuery || uw.$;

                if (!tid) {
                    reject(new Error('POST afgebroken: er is geen town_id beschikbaar'));
                    return;
                }
                if (!csrf) {
                    reject(new Error('POST afgebroken: er is geen CSRF-token beschikbaar'));
                    return;
                }

                // Prioriteit 1: jQuery $.ajax met exacte town_id in URL en payload.
                if ($ && typeof $.ajax === 'function') {
                    const url = `/game/${controller}?town_id=${encodeURIComponent(tid)}&action=${encodeURIComponent(action)}&h=${encodeURIComponent(csrf)}`;
                    $.ajax({
                        url,
                        type: 'POST',
                        dataType: 'json',
                        data: { json: typeof payload === 'string' ? payload : JSON.stringify(payload) },
                        success: function(resp) {
                            GMB_API.forwardNotifications(resp);
                            if (resp && resp.json && resp.json.error) reject(new Error(resp.json.error));
                            else resolve(resp);
                        },
                        error: function(xhr, status, error) {
                            reject(new Error(error || status || 'Ajax POST request mislukt'));
                        }
                    });
                    return;
                }

                if (uw.gpAjax && typeof uw.gpAjax.ajaxPost === 'function') {
                    const postParams = Object.assign({}, payload);
                    if (!postParams.town_id) postParams.town_id = parseInt(tid, 10);
                    uw.gpAjax.ajaxPost(controller, action, postParams, true, {
                        success: function(layout, response) {
                            const result = response !== undefined ? response : layout;
                            if (result && result.json && result.json.error) reject(new Error(result.json.error));
                            else resolve(result);
                        },
                        error: function(layout, error) {
                            reject(new Error(typeof error === 'string' ? error : error && (error.error || error.message) || 'gpAjax error'));
                        }
                    });
                    return;
                }

                if (typeof GM_xmlhttpRequest !== 'function') {
                    reject(new Error('POST afgebroken: GM_xmlhttpRequest is niet beschikbaar'));
                    return;
                }
                const fullUrl = `${window.location.origin}/game/${controller}?town_id=${encodeURIComponent(tid)}&action=${encodeURIComponent(action)}&h=${encodeURIComponent(csrf)}`;
                const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: fullUrl,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
                    data: `json=${encodeURIComponent(jsonStr)}`,
                    onload: function(res) {
                        try {
                            const json = JSON.parse(res.responseText);
                            GMB_API.forwardNotifications(json);
                            if (json.json && json.json.error) reject(new Error(json.json.error));
                            else resolve(json);
                        } catch (e) {
                            reject(new Error(`POST-response kon niet als JSON worden gelezen: ${e.message}`));
                        }
                    },
                    onerror: function(err) { reject(new Error(err && err.error || 'GM POST request mislukt')); },
                    ontimeout: function() { reject(new Error('GM POST request is verlopen')); }
                });
            });
        },

        externalGet: function(url, options = {}) {
            return this.externalRequest('GET', url, options);
        },

        externalPost: function(url, body, options = {}) {
            const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
            return this.externalRequest('POST', url, Object.assign({}, options, {
                headers,
                data: typeof body === 'string' ? body : JSON.stringify(body)
            }));
        },

        externalRequest: function(method, url, options = {}) {
            let parsed;
            try { parsed = new URL(url); } catch (e) { return Promise.reject(new Error('Externe URL is ongeldig')); }
            const host = parsed.hostname.toLowerCase();
            const allowed = host === 'api.grepodata.com' || host === 'gme.cyllos.dev' ||
                host === 'grcrt.net' || host.endsWith('.grcrt.net') ||
                host === 'discord.com' || host === 'discordapp.com' ||
                host === 'forum.grepolis.net' ||
                host === 'grepolis.com' || host.endsWith('.grepolis.com') ||
                host.endsWith('.supabase.co');
            if (parsed.protocol !== 'https:' || !allowed) {
                return Promise.reject(new Error(`Externe host niet toegestaan: ${host}`));
            }

            return new Promise((resolve, reject) => {
                const complete = (status, responseText) => {
                    if (status < 200 || status >= 300) {
                        reject(new Error(`HTTP ${status}: ${String(responseText || '').slice(0, 300)}`));
                        return;
                    }
                    resolve({
                        ok: true,
                        status,
                        json: async () => {
                            try { return JSON.parse(responseText || ''); }
                            catch (error) { throw new Error(`Ongeldige JSON-response: ${error.message}`); }
                        },
                        text: async () => responseText || ''
                    });
                };
                if (typeof GM_xmlhttpRequest === 'function') {
                    GM_xmlhttpRequest({
                        method,
                        url: parsed.href,
                        headers: options.headers || {},
                        data: options.data || null,
                        timeout: options.timeout || 15000,
                        onload: response => complete(response.status, response.responseText),
                        onerror: error => reject(new Error(error && error.error || 'Externe request mislukt')),
                        ontimeout: () => reject(new Error('Externe request is verlopen'))
                    });
                    return;
                }
                fetch(parsed.href, { method, headers: options.headers || {}, body: options.data || undefined, credentials: 'omit' })
                    .then(async response => {
                        const text = await response.text();
                        complete(response.status, text);
                    })
                    .catch(reject);
            });
        },

        // HTTP GET via $.ajax of gpAjax
        // GET-requests worden geserialiseerd met minimaal 1 s tussenruimte (voorkomt HTTP 429 bij bursts).
        getChain: Promise.resolve(),
        lastGetStartedAt: 0,
        getMinGapMs: 1000,
        get: function(controller, action, params = {}, townId = null) {

            const task = this.getChain.then(async () => {
                const wait = this.lastGetStartedAt + this.getMinGapMs - Date.now();
                if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
                this.lastGetStartedAt = Date.now();
                return this._getImmediate(controller, action, params, townId);
            });
            this.getChain = task.catch(() => {});
            return task;
        },

        _getImmediate: function(controller, action, params = {}, townId = null) {

            return new Promise((resolve, reject) => {
                const uw = this.getUW();
                const tid = townId || this.getTownId();
                const csrf = this.getCSRFToken();
                const $ = uw.jQuery || uw.$;

                // Timeout na 30 seconden
                const timeout = setTimeout(() => {
                    reject(new Error(`API GET timeout: ${controller}/${action} (30s)`));
                }, 30000);
                const resolveResponse = response => resolve(response);
                const rejectResponse = error => reject(error);

                const queryData = {
                    town_id: tid,
                    action: action,
                    h: csrf
                };
                Object.assign(queryData, params);

                // Prioriteit 1: jQuery $.ajax (behoudt plain.html en volledige response)
                if ($ && typeof $.ajax === 'function') {
                    $.ajax({
                        url: `/game/${controller}`,
                        type: 'GET',
                        dataType: 'json',
                        data: queryData,
                        timeout: 30000,
                        success: function(resp) {
                            clearTimeout(timeout);
                            GMB_API.forwardNotifications(resp);
                            if (resp && resp.json && resp.json.error) {
                                reject(new Error(`${controller}/${action}: ${resp.json.error}`));
                            } else {
                                resolveResponse(resp);
                            }
                        },
                        error: function(xhr, status, error) {
                            clearTimeout(timeout);
                            const ajaxError = error || status || 'Ajax GET request mislukt';
                            if (status === 'parsererror' && uw.gpAjax && typeof uw.gpAjax.ajaxGet === 'function') {
                                try {
                                    uw.gpAjax.ajaxGet(controller, action, queryData, true, function(layout, response) {
                                        clearTimeout(timeout);
                                        const result = response !== undefined ? response : layout;
                                        if (result && result.json && result.json.error) {
                                            reject(new Error(`${controller}/${action}: ${result.json.error}`));
                                        } else if (result && typeof result === 'object') {
                                            resolveResponse(result);
                                        } else {
                                            reject(new Error(`${controller}/${action}: JSON-response ongeldig; jQuery gaf ${ajaxError}.`));
                                        }
                                    });
                                } catch (fallbackError) {
                                    reject(new Error(`${controller}/${action}: jQuery gaf ${ajaxError}; gpAjax-fallback mislukte: ${fallbackError.message}`));
                                }
                                return;
                            }
                            const httpError = new Error(`${controller}/${action}: ${ajaxError}`);
                            httpError.status = xhr && xhr.status;
                            try {
                                const retryHeader = xhr && typeof xhr.getResponseHeader === 'function' ? xhr.getResponseHeader('Retry-After') : null;
                                const retrySec = Number(retryHeader);
                                if (Number.isFinite(retrySec) && retrySec > 0) httpError.retryAfter = retrySec;
                            } catch (headerError) { /* header optioneel */ }
                            rejectResponse(httpError, xhr && xhr.responseText);
                        }
                    });
                    return;
                }

                // Prioriteit 2: Native gpAjax
                if (uw.gpAjax && typeof uw.gpAjax.ajaxGet === 'function') {
                    uw.gpAjax.ajaxGet(controller, action, queryData, true, function(layout, response) {
                        clearTimeout(timeout);
                        const res = response !== undefined ? response : layout;
                        if (res && res.json && res.json.error) {
                            reject(new Error(res.json.error));
                        } else {
                            resolveResponse(res);
                        }
                    });
                    return;
                }

                const queryStr = Object.entries(queryData)
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`)
                    .join('&');
                const fullUrl = `${window.location.origin}/game/${controller}?${queryStr}`;

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: fullUrl,
                    timeout: 30000,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    onload: function(res) {
                        clearTimeout(timeout);
                        try {
                            const json = JSON.parse(res.responseText);
                            GMB_API.forwardNotifications(json);
                            resolveResponse(json);
                        } catch (e) {
                            resolve(res);
                        }
                    },
                    onerror: function(err) {
                        clearTimeout(timeout);
                        reject(err);
                    },
                    ontimeout: function() {
                        clearTimeout(timeout);
                        reject(new Error(`API GET timeout: ${controller}/${action} (30s)`));
                    }
                });
            });
        }
    };

    const GMB_WorldData = {
        cache: new Map(),
        pending: new Map(),
        cacheWorld: null,

        getWorld: function() {
            const world = String(GMB_API.getWorldId() || '').toLowerCase();
            if (!/^[a-z0-9]+$/.test(world)) throw new Error('Werelddata niet beschikbaar: ongeldige wereld-id');
            if (this.cacheWorld !== world) {
                this.cache.clear();
                this.pending.clear();
                this.cacheWorld = world;
            }
            return world;
        },

        parseCSV: function(text) {
            if (!text || !text.trim()) return [];
            const lines = text.trim().split(/\r?\n/);
            const firstLine = lines[0];
            const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
            return lines.map(line => {
                const row = [];
                let value = '';
                let quoted = false;
                for (let index = 0; index < line.length; index++) {
                    const char = line[index];
                    if (char === '"') {
                        if (quoted && line[index + 1] === '"') {
                            value += '"';
                            index++;
                        } else {
                            quoted = !quoted;
                        }
                    } else if (char === delimiter && !quoted) {
                        row.push(value);
                        value = '';
                    } else {
                        value += char;
                    }
                }
                row.push(value);
                return row;
            });
        },

        getFile: function(name, transform) {
            const world = this.getWorld();
            const key = `${world}:${name}`;
            const ttl = Math.max(60000, Number(GMB.storage.get('world_cache_ttl', 21600000)) || 21600000);
            const cached = this.cache.get(key);
            if (cached && Date.now() - cached.timestamp < ttl) return Promise.resolve(cached.value);
            if (this.pending.has(key)) return this.pending.get(key);

            const request = GMB_API.externalGet(`https://${world}.grepolis.com/data/${name}.txt`)
                .then(response => response.text())
                .then(text => {
                    const value = transform(this.parseCSV(text));
                    this.cache.set(key, { timestamp: Date.now(), value });
                    return value;
                })
                .finally(() => this.pending.delete(key));
            this.pending.set(key, request);
            return request;
        },

        getPlayers: function() {
            return this.getFile('players', rows => {
                const list = rows.map(row => ({
                    id: Number(row[0]), name: row[1], allianceId: Number(row[2]) || 0,
                    points: Number(row[3]) || 0, rank: Number(row[4]) || 0, towns: Number(row[5]) || 0
                })).filter(item => Number.isFinite(item.id));
                return { list, byId: new Map(list.map(item => [item.id, item])) };
            });
        },

        getAlliances: function() {
            return this.getFile('alliances', rows => {
                const list = rows.map(row => ({
                    id: Number(row[0]), name: row[1], points: Number(row[2]) || 0,
                    towns: Number(row[3]) || 0, players: Number(row[4]) || 0, rank: Number(row[5]) || 0
                })).filter(item => Number.isFinite(item.id));
                return { list, byId: new Map(list.map(item => [item.id, item])) };
            });
        },

        getTowns: function() {
            return this.getFile('towns', rows => {
                const list = rows.map(row => ({
                    id: Number(row[0]), playerId: Number(row[1]), name: row[2],
                    x: Number(row[3]), y: Number(row[4]), islandPos: Number(row[5]) || 0, points: Number(row[6]) || 0
                })).filter(item => Number.isFinite(item.id));
                const byId = new Map(list.map(item => [item.id, item]));
                const byPlayer = new Map();
                list.forEach(item => {
                    if (!byPlayer.has(item.playerId)) byPlayer.set(item.playerId, []);
                    byPlayer.get(item.playerId).push(item);
                });
                return { list, byId, byPlayer };
            });
        },

        getIslands: function() {
            return this.getFile('islands', rows => {
                const list = rows.map(row => ({
                    id: Number(row[0]), x: Number(row[1]), y: Number(row[2]), type: Number(row[3]) || 0,
                    freeSlots: Number(row[4]) || 0, bonusPlus: Number(row[5]) || 0, bonusMinus: Number(row[6]) || 0
                })).filter(item => Number.isFinite(item.id));
                return { list, byCoords: new Map(list.map(item => [`${item.x}|${item.y}`, item])) };
            });
        },

        getConquers: function() {
            return this.getFile('conquers', rows => rows.map(row => ({
                townId: Number(row[0]), time: Number(row[1]), newPlayerId: Number(row[2]) || 0,
                oldPlayerId: Number(row[3]) || 0, newAllianceId: Number(row[4]) || 0,
                oldAllianceId: Number(row[5]) || 0, points: Number(row[6]) || 0
            })).filter(item => Number.isFinite(item.townId)));
        },

        getPlayerKills: function(kind) {
            if (!['all', 'att', 'def'].includes(kind)) return Promise.reject(new Error(`Onbekend kill-type: ${kind}`));
            return this.getFile(`player_kills_${kind}`, rows => rows.map(row => ({
                rank: Number(row[0]), playerId: Number(row[1]), points: Number(row[2]) || 0
            })).filter(item => Number.isFinite(item.playerId)));
        },

        getPlayerKillsAll: function() { return this.getPlayerKills('all'); },
        getPlayerKillsAtt: function() { return this.getPlayerKills('att'); },
        getPlayerKillsDef: function() { return this.getPlayerKills('def'); },

        getTownInfo: async function(townId) {
            const id = Number(townId);
            if (!Number.isFinite(id)) throw new Error('Ongeldig town_id voor werelddata');
            const towns = await this.getTowns();
            const town = towns.byId.get(id);
            if (!town) return null;
            const [players, islands] = await Promise.all([this.getPlayers(), this.getIslands()]);
            const player = players.byId.get(town.playerId) || null;
            const island = islands.byCoords.get(`${town.x}|${town.y}`) || null;
            const alliances = player ? await this.getAlliances() : null;
            const alliance = player && alliances ? alliances.byId.get(player.allianceId) || null : null;
            return {
                town,
                x: town.x,
                y: town.y,
                ocean: `${Math.floor(town.x / 100)}${Math.floor(town.y / 100)}`,
                oceanCode: `${Math.floor(town.x / 100)}${Math.floor(town.y / 100)}`,
                OC: `${Math.floor(town.x / 100)}${Math.floor(town.y / 100)}`,
                player,
                alliance,
                island
            };
        },

        clearCache: function() {
            this.cache.clear();
            this.pending.clear();
        }
    };


    // ============================================================
    // TROOP MANAGER MODULE (Overzicht & Export)
    // ============================================================

    const GMB_TroopManager = {
        troopsData: {},
        unitTranslations: {
            sword: 'Zwaardvechter', slinger: 'Slingeraar', archer: 'Boogschutter', hoplite: 'Hopliet',
            rider: 'Ruiter', chariot: 'Strijdwagen', catapult: 'Katapult', minotaur: 'Minotaurus',
            manticore: 'Manticore', zyklop: 'Cycloop', harpy: 'Harpij', medusa: 'Medusa',
            centaur: 'Centaur', pegasus: 'Pegasus', cerberus: 'Cerberus', fury: 'Erinys',
            griffin: 'Griffioen', calydonian_boar: 'Calydonisch varken', satyr: 'Sater',
            spartoi: 'Spartoi', ladon: 'Ladon', godsent: 'Godsgezant', militia: 'Militie',
            big_transporter: 'Transportboot', transporter: 'Snel transportschip', bireme: 'Bireem', attack_ship: 'Vuurschip',
            demolition_ship: 'Brander', small_transporter: 'Snel transportschip',
            trireme: 'Trireem', colonize_ship: 'Kolonisatieschip', sea_monster: 'Hydra',
            siren: 'Sirene', militia_bow: 'Militieboogschutter', militia_spear: 'Militiespeerdrager'
        },
        mythicalUnits: new Set([
            'minotaur', 'manticore', 'zyklop', 'harpy', 'medusa', 'centaur', 'pegasus',
            'cerberus', 'fury', 'griffin', 'calydonian_boar', 'satyr', 'spartoi', 'ladon',
            'godsent', 'sea_monster', 'siren'
        ]),
        seaUnits: new Set([
            'big_transporter', 'bireme', 'attack_ship', 'demolition_ship',
            'small_transporter', 'trireme', 'colonize_ship'
        ]),
        troopIcons: {
            sword: '-320px 0', slinger: '-200px -280px', archer: '-40px -80px', hoplite: '-240px -40px',
            rider: '-40px -280px', chariot: '-160px -80px', catapult: '-120px -120px',
            minotaur: '-240px -240px', manticore: '0 -240px', zyklop: '-240px -320px',
            harpy: '-120px -200px', medusa: '-80px -240px', centaur: '-160px 0',
            pegasus: '-280px -120px', cerberus: '-160px -40px', fury: '0 -200px',
            griffin: '-80px -200px', calydonian_boar: '-80px -120px', satyr: '-80px -280px',
            spartoi: '-280px -280px', ladon: '-240px -120px', godsent: '-40px -200px',
            militia: '-200px -240px', big_transporter: '0 -120px', bireme: '-40px -120px',
            attack_ship: '-120px -80px', demolition_ship: '-200px 0', small_transporter: '-240px -280px',
            transporter: '-240px -280px', trireme: '-80px -80px', colonize_ship: '-40px -160px',
            sea_monster: '0 -160px', siren: '-160px -280px'
        },
        fallbackSpriteUrl: 'https://gpnl.innogamescdn.com/images/game/autogenerated/units/unit_icons_40x40_66aaef2.png',
        filteredData: [],

        init: function() {
            GMB.log('TroopManager', 'Module initialized', 'success');
            setTimeout(() => this.addUITab(), 700);
        },

        addUITab: function() {
            if (document.getElementById('gmb-tab-troops')) return;

            GMB_UI.addTab('troops', '⚔ Troepen', `
                <div class="gmb-section">
                    <div class="gmb-section-title">⚔ Troepen Overzicht</div>
                    ${GMB_UI.createButton('Troepen vernieuwen', () => this.refresh())}
                    <div id="troops-summary" class="gmb-muted" style="margin:6px 0;">Nog geen troependata geladen.</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                        <label class="gmb-muted">Speler<select class="gmb-select" id="troops-filter-player"><option value="">Alle spelers</option></select></label>
                        <label class="gmb-muted">Stad<select class="gmb-select" id="troops-filter-town"><option value="">Alle steden</option></select></label>
                        <label class="gmb-muted">OC / eiland<select class="gmb-select" id="troops-filter-island"><option value="">Alle eilanden</option></select></label>
                        <label class="gmb-muted">Eenheidscategorie<select class="gmb-select" id="troops-filter-category">
                            <option value="">Alle categorieën</option><option value="land">Land</option>
                            <option value="sea">Zee</option><option value="mythical">Mythisch</option><option value="hero">Helden</option>
                        </select></label>
                        <label class="gmb-muted" style="grid-column:1 / -1;">Eenheid<select class="gmb-select" id="troops-filter-unit"><option value="">Alle eenheden</option></select></label>
                    </div>
                    <label class="gmb-muted" style="display:block; margin-top:6px;">Supportweergave
                        <select class="gmb-select" id="troops-support-mode">
                            <option value="combined">Gecombineerd</option><option value="separate">Apart per stad</option>
                        </select>
                    </label>
                    <div id="troops-overview" style="margin-top:10px; max-height:520px; overflow-y:auto;">
                        <p style="color:#aaa;">Klik op 'Troepen vernieuwen' om de gegevens te laden.</p>
                    </div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">📋 Export</div>
                    ${GMB_UI.createButton('BBCode kopiëren', () => this.exportBBCode())}
                    ${GMB_UI.createButton('CSV downloaden', () => this.exportCSV(), 'gmb-button-secondary')}
                </div>
            `);
            this.bindFilters();
        },

        bindFilters: function() {
            ['troops-filter-player', 'troops-filter-town', 'troops-filter-island', 'troops-filter-category', 'troops-filter-unit', 'troops-support-mode']
                .forEach(id => {
                    const element = document.getElementById(id);
                    if (element) element.addEventListener('change', () => this.renderOverview());
                });
        },

        getTowns: function(uw) {
            const source = uw.ITowns && typeof uw.ITowns.getTowns === 'function'
                ? uw.ITowns.getTowns()
                : uw.ITowns && uw.ITowns.towns;
            return source ? (Array.isArray(source) ? source : Object.values(source)).filter(town => town && Number(town.id) > 0) : [];
        },

        normalizeUnits: function(source) {
            const result = {};
            if (!source || typeof source !== 'object') return result;
            const uw = GMB_API.getUW();
            const add = (key, value) => {
                const count = Number(value);
                if (!this.isKnownUnit(key, uw) || !Number.isFinite(count) || count <= 0) return;
                result[key] = (result[key] || 0) + Math.floor(count);
            };
            const values = source.units && typeof source.units === 'object' ? source.units : source;
            Object.entries(values).forEach(([key, value]) => {
                if (value && typeof value === 'object') {
                    Object.entries(value.units || {}).forEach(([unit, count]) => add(unit, count));
                } else {
                    add(key, value);
                }
            });
            return result;
        },

        addUnits: function(target, source) {
            Object.entries(source || {}).forEach(([unit, count]) => {
                target[unit] = (target[unit] || 0) + Number(count || 0);
            });
            return target;
        },

        readFragmentUnits: function(attributes) {
            const result = this.normalizeUnits(attributes && attributes.units);
            if (attributes && typeof attributes === 'object') {
                Object.entries(attributes).forEach(([key, value]) => {
                    if (this.isKnownUnit(key, GMB_API.getUW())) this.addUnits(result, { [key]: Number(value) || 0 });
                });
            }
            return result;
        },

        isKnownUnit: function(unit, uw) {
            return !!(this.unitTranslations[unit] ||
                uw.GameData && uw.GameData.units && Object.prototype.hasOwnProperty.call(uw.GameData.units, unit) ||
                uw.GameData && uw.GameData.heroes && Object.prototype.hasOwnProperty.call(uw.GameData.heroes, unit));
        },

        getUnitLabel: function(unit, uw) {
            const data = uw.GameData && uw.GameData.units && uw.GameData.units[unit] ||
                uw.GameData && uw.GameData.heroes && uw.GameData.heroes[unit];
            return this.unitTranslations[unit] || data && (data.name || data.title) ||
                unit.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
        },

        getSpriteUrl: function() {
            const icon = document.querySelector('.unit_icon40, [class*="unit_icon40"]');
            if (icon) {
                const background = getComputedStyle(icon).backgroundImage;
                const match = background && background.match(/url\(["']?(.*?)["']?\)/);
                if (match && match[1] && match[1].includes('unit_icons_40x40')) return match[1];
            }
            return this.fallbackSpriteUrl;
        },

        classifyUnit: function(unit, uw) {
            const unitData = uw.GameData && uw.GameData.units && uw.GameData.units[unit];
            const heroes = uw.GameData && uw.GameData.heroes;
            if ((heroes && Object.prototype.hasOwnProperty.call(heroes, unit)) || unitData && unitData.is_hero) return 'hero';
            if (this.mythicalUnits.has(unit) || unitData && (unitData.is_mythical || unitData.mythical)) return 'mythical';
            if (this.seaUnits.has(unit) || unitData && unitData.is_naval) return 'sea';
            return 'land';
        },

        getPlayerName: function(uw) {
            return String(uw.Game && (uw.Game.player_name || uw.Game.playerName) || `Speler ${uw.Game && uw.Game.player_id || ''}`).trim();
        },

        getTownSupport: async function(town, townId) {
            try {
                const native = typeof town.unitsSupport === 'function' ? town.unitsSupport() : town.unitsSupport;
                const normalized = this.normalizeUnits(native);
                if (Object.keys(normalized).length) return normalized;
            } catch (error) {
                GMB.log('TroopManager', `Native supportdata van stad ${townId} kon niet worden gelezen: ${error.message}`, 'warn');
            }

            try {
                const response = await GMB_API.get('town_info', 'support', {}, townId);
                const root = response && response.json ? response.json : response;
                const html = root && (root.html || root.plain && root.plain.html) || (typeof root === 'string' ? root : '');
                if (!html) {
                    GMB.log('TroopManager', `Support van stad ${townId} bevatte geen HTML-response.`, 'warn');
                    return {};
                }
                const uw = GMB_API.getUW();
                const Parser = uw.DOMParser || DOMParser;
                const parser = new Parser();
                const doc = parser.parseFromString(html, 'text/html');
                const result = {};
                doc.querySelectorAll('[class*="unit_"]').forEach(element => {
                    const match = String(element.className).match(/(?:^|\s)unit_([a-z_]+)/);
                    if (!match || !this.isKnownUnit(match[1], uw)) return;
                    const count = parseInt(String(element.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
                    if (count > 0) result[match[1]] = (result[match[1]] || 0) + count;
                });
                if (!Object.keys(result).length) {
                    GMB.log('TroopManager', `Support van stad ${townId} bevatte geen herkenbare eenheden.`, 'warn');
                }
                return result;
            } catch (error) {
                GMB.log('TroopManager', `Support van stad ${townId} kon niet worden opgehaald: ${error.message}`, 'warn');
                return {};
            }
        },

        async enrichTownLocations(rows) {
            try {
                const [townData, islandData] = await Promise.all([GMB_WorldData.getTowns(), GMB_WorldData.getIslands()]);
                rows.forEach(row => {
                    const town = townData.byId.get(row.id);
                    if (!town) return;
                    row.x = town.x;
                    row.y = town.y;
                    row.ocean = `${Math.floor(town.x / 100)}${Math.floor(town.y / 100)}`;
                    const island = islandData.byCoords.get(`${town.x}|${town.y}`);
                    if (island) row.islandId = island.id;
                    if (town.name) row.name = town.name;
                });
            } catch (error) {
                GMB.log('TroopManager', `Werelddata voor OC/eilanden niet beschikbaar; toon de lokale stadsgegevens: ${error.message}`, 'warn');
            }
        },

        refresh: async function() {
            try {
                const uw = GMB_API.getUW();
                if (!uw || !uw.ITowns) {
                    GMB.notify('Game nog niet geladen.', { type: 'warn' });
                    return;
                }

                const towns = this.getTowns(uw);
                if (!towns.length) {
                    GMB.notify('Geen steden gevonden in ITowns.', { type: 'warn' });
                    return;
                }
                const playerName = this.getPlayerName(uw);
                const rows = towns.map(town => {
                    const id = Number(town.id);
                    let name = String(town.name || `Stad ${id}`);
                    let townModel = town;
                    try {
                        if (typeof uw.ITowns.getTown === 'function') townModel = uw.ITowns.getTown(id) || town;
                        if (typeof townModel.getName === 'function') name = townModel.getName() || name;
                    } catch (error) {
                        GMB.log('TroopManager', `Stadsgegevens van ${id} konden niet volledig worden gelezen: ${error.message}`, 'warn');
                    }
                    return {
                        id, name, player: playerName, ocean: '', islandId: '',
                        home: {}, away: {}, support: {}, wall: 0, tower: false, god: '',
                        model: townModel
                    };
                });

                const byTown = new Map(rows.map(row => [row.id, row]));
                const fragments = uw.ITowns.all_units && uw.ITowns.all_units.fragments || {};
                const townsWithFragments = new Set();
                Object.values(fragments).forEach(fragment => {
                    const models = fragment && fragment.models;
                    if (!models) return;
                    Object.values(models).forEach(model => {
                        const attributes = model && (model.attributes || (typeof model.toJSON === 'function' && model.toJSON()));
                        if (!attributes) return;
                        const homeId = Number(attributes.home_town_id ?? attributes.homeTownId ?? attributes.homeId) || null;
                        const currentId = Number(attributes.current_town_id ?? attributes.currentTownId ?? attributes.currentId) || null;
                        const units = this.readFragmentUnits(attributes);
                        if (!homeId || !currentId || !Object.keys(units).length) return;
                        const homeRow = byTown.get(homeId);
                        if (!homeRow) return;
                        townsWithFragments.add(homeId);
                        if (homeId === currentId) this.addUnits(homeRow.home, units);
                        else this.addUnits(homeRow.away, units);
                    });
                });

                for (const row of rows) {
                    if (!townsWithFragments.has(row.id)) {
                        try {
                            const source = row.model && typeof row.model.units === 'function'
                                ? row.model.units()
                                : row.model && row.model.units;
                            row.home = this.normalizeUnits(source);
                        } catch (error) {
                            GMB.log('TroopManager', `Troepen in stad ${row.id} konden niet worden gelezen: ${error.message}`, 'warn');
                        }
                    }
                    try {
                        const buildings = row.model && typeof row.model.getBuildings === 'function' ? row.model.getBuildings() : null;
                        const researches = row.model && typeof row.model.getResearches === 'function' ? row.model.getResearches() : null;
                        row.wall = Number(buildings && (buildings.get ? buildings.get('wall') : buildings.attributes && buildings.attributes.wall)) || 0;
                        row.tower = !!(buildings && (buildings.get ? buildings.get('tower') : buildings.attributes && buildings.attributes.tower));
                        row.phalanx = !!(researches && (researches.get ? researches.get('phalanx') : researches.attributes && researches.attributes.phalanx));
                        row.god = typeof row.model.god === 'function' ? row.model.god() : row.model.god || '';
                    } catch (error) {
                        GMB.log('TroopManager', `Extra stadsgegevens van ${row.id} konden niet worden gelezen: ${error.message}`, 'warn');
                    }
                }

                const supportResults = [];
                for (let index = 0; index < rows.length; index += 5) {
                    const batch = rows.slice(index, index + 5);
                    supportResults.push(...await Promise.all(batch.map(row => this.getTownSupport(row.model, row.id))));
                }
                rows.forEach((row, index) => { row.support = supportResults[index]; });
                await this.enrichTownLocations(rows);

                this.troopsData = Object.fromEntries(rows.map(row => [row.id, row]));
                this.populateFilters();
                this.currentSpriteUrl = this.getSpriteUrl();
                this.renderOverview();
                GMB.log('TroopManager', 'Troepen vernieuwd', 'success');
            } catch (error) {
                GMB.log('TroopManager', `Fout bij vernieuwen: ${error.message}`, 'error');
                GMB.notify(`Fout bij vernieuwen: ${error.message}`, { type: 'error' });
            }
        },

        getCategories: function(row) {
            const categories = { land: {}, sea: {}, mythical: {}, hero: {} };
            const uw = GMB_API.getUW();
            ['home', 'away', 'support'].forEach(section => {
                Object.entries(row[section] || {}).forEach(([unit, count]) => {
                    const category = this.classifyUnit(unit, uw);
                    categories[category][unit] = (categories[category][unit] || 0) + Number(count || 0);
                });
            });
            return categories;
        },

        getFilteredRows: function() {
            const player = document.getElementById('troops-filter-player')?.value || '';
            const town = document.getElementById('troops-filter-town')?.value || '';
            const island = document.getElementById('troops-filter-island')?.value || '';
            const category = document.getElementById('troops-filter-category')?.value || '';
            const unit = document.getElementById('troops-filter-unit')?.value || '';
            return Object.values(this.troopsData).filter(row => {
                if (player && row.player !== player) return false;
                if (town && String(row.id) !== town) return false;
                if (island && `${row.ocean}/${row.islandId}` !== island) return false;
                const categories = this.getCategories(row);
                if (category && !Object.keys(categories[category] || {}).length) return false;
                if (unit && !['home', 'away', 'support'].some(section => Number(row[section][unit]) > 0)) return false;
                return true;
            });
        },

        populateFilters: function() {
            const rows = Object.values(this.troopsData);
            const setOptions = (id, items, label) => {
                const select = document.getElementById(id);
                if (!select) return;
                const previous = select.value;
                select.innerHTML = `<option value="">${label}</option>` + items.map(item =>
                    `<option value="${this.escapeHtml(item.value)}">${this.escapeHtml(item.label)}</option>`
                ).join('');
                if (items.some(item => item.value === previous)) select.value = previous;
            };
            setOptions('troops-filter-player', [...new Set(rows.map(row => row.player))].map(value => ({ value, label: value })), 'Alle spelers');
            setOptions('troops-filter-town', rows.map(row => ({ value: String(row.id), label: `${row.name} (#${row.id})` })), 'Alle steden');
            const islands = [...new Set(rows.filter(row => row.islandId).map(row => `${row.ocean}/${row.islandId}`))].sort();
            setOptions('troops-filter-island', islands.map(value => ({ value, label: `${value.split('/')[0]} / ${value.split('/')[1]}` })), 'Alle eilanden');
            const units = [...new Set(rows.flatMap(row => ['home', 'away', 'support'].flatMap(section => Object.keys(row[section] || {}))))].sort();
            const uw = GMB_API.getUW();
            setOptions('troops-filter-unit', units.map(value => ({ value, label: this.getUnitLabel(value, uw) })), 'Alle eenheden');
        },

        filterSectionUnits: function(units) {
            const uw = GMB_API.getUW();
            const category = document.getElementById('troops-filter-category')?.value || '';
            const unit = document.getElementById('troops-filter-unit')?.value || '';
            return Object.fromEntries(Object.entries(units || {}).filter(([key]) =>
                (!unit || key === unit) && (!category || this.classifyUnit(key, uw) === category)
            ));
        },

        renderUnitList: function(units) {
            const uw = GMB_API.getUW();
            const spriteUrl = this.currentSpriteUrl || this.getSpriteUrl();
            return Object.entries(units || {}).filter(([, count]) => Number(count) > 0).map(([unit, count]) =>
                `<span class="unit_icon40 ${this.escapeHtml(unit)}" title="${this.escapeHtml(this.getUnitLabel(unit, uw))}: ${Number(count)}" style="display:inline-flex;position:relative;width:40px;height:40px;margin:2px;align-items:flex-end;justify-content:flex-end;background-color:rgba(0,0,0,.25);${this.troopIcons[unit] ? `background-image:url('${spriteUrl}');background-position:${this.troopIcons[unit]};background-repeat:no-repeat;` : ''}">
                    <span style="font-size:10px;background:#111;color:#fff;padding:1px 3px;border-radius:3px;">${Number(count)}</span>
                </span>`
            ).join('');
        },

        renderSections: function(row) {
            const labels = { land: 'Land', sea: 'Zee', mythical: 'Mythisch', hero: 'Helden' };
            const supportMode = document.getElementById('troops-support-mode')?.value || 'combined';
            const unitsBySection = {
                home: this.filterSectionUnits(row.home),
                away: this.filterSectionUnits(row.away),
                support: this.filterSectionUnits(row.support)
            };
            const allUnits = { ...unitsBySection.home };
            this.addUnits(allUnits, unitsBySection.away);
            this.addUnits(allUnits, unitsBySection.support);
            const uw = GMB_API.getUW();
            const categoriesBySection = {};
            ['home', 'away', 'support'].forEach(section => {
                categoriesBySection[section] = { land: {}, sea: {}, mythical: {}, hero: {} };
                Object.entries(unitsBySection[section]).forEach(([unit, count]) => {
                    const type = this.classifyUnit(unit, uw);
                    categoriesBySection[section][type][unit] = count;
                });
            });
            const renderGroup = (title, source) => {
                const blocks = Object.entries(labels).map(([type, label]) => {
                    const units = source[type];
                    return Object.keys(units).length
                        ? `<div style="margin-top:4px;"><strong>${label}</strong><div>${this.renderUnitList(units)}</div></div>`
                        : '';
                }).join('');
                return blocks ? `<div style="margin-top:8px;"><strong>${title}</strong>${blocks}</div>` : '';
            };
            let html = renderGroup('Aanwezig thuis', categoriesBySection.home);
            html += renderGroup('Eigen troepen buiten', categoriesBySection.away);
            if (supportMode === 'combined') {
                const combinedSupport = { land: {}, sea: {}, mythical: {}, hero: {} };
                Object.entries(unitsBySection.support).forEach(([unit, count]) => {
                    combinedSupport[this.classifyUnit(unit, uw)][unit] = count;
                });
                html += renderGroup('Ondersteuning in deze stad (gecombineerd)', combinedSupport);
            } else {
                html += renderGroup('Ondersteuning in deze stad', categoriesBySection.support);
            }
            if (!Object.keys(allUnits).length) html = '<div class="gmb-muted">Geen eenheden gevonden.</div>';
            return html;
        },

        renderOverview: function() {
            const overviewEl = document.getElementById('troops-overview');
            if (!overviewEl) return;
            const rows = this.getFilteredRows();
            this.filteredData = rows;
            const summary = document.getElementById('troops-summary');
            if (summary) summary.textContent = `${rows.length} van ${Object.keys(this.troopsData).length} steden weergegeven.`;
            overviewEl.innerHTML = rows.map(row => `
                <article data-town-id="${row.id}" style="padding:8px;margin:5px 0;background:rgba(255,255,255,.05);border-left:3px solid #ff6b81;border-radius:4px;">
                    <strong>${this.escapeHtml(row.name)}</strong> <span class="gmb-muted">(#${row.id})</span>
                    <div class="gmb-muted">${this.escapeHtml(row.player)} | OC ${this.escapeHtml(row.ocean || '?')} | Eiland ${this.escapeHtml(row.islandId || '?')} | Muur ${Number(row.wall) || 0}${row.tower ? ' | Toren' : ''}${row.phalanx ? ' | Falanx' : ''}${row.god ? ` | ${this.escapeHtml(row.god)}` : ''}</div>
                    ${this.renderSections(row)}
                </article>
            `).join('') || '<p class="gmb-muted">Geen steden voldoen aan deze filters.</p>';
        },

        exportBBCode: function() {
            const rows = this.getFilteredRows();
            if (!rows.length) {
                GMB.notify('Geen troependata om te exporteren.', { type: 'warn' });
                return;
            }
            const uw = GMB_API.getUW();
            const format = units => Object.entries(units || {}).filter(([, count]) => count > 0)
                .map(([unit, count]) => `${this.getUnitLabel(unit, uw)}: ${count}`).join(', ') || '—';
            let bbcode = '[table]\n[**]Speler[||]Stad[||]OC / eiland[||]Thuis[||]Buiten[||]Ondersteuning[/**]\n';
            rows.forEach(row => {
                bbcode += `[tr][td]${row.player}[/td][td][town]${row.id}[/town] ${row.name}[/td][td]${row.ocean || '—'} / ${row.islandId || '—'}[/td][td]${format(this.filterSectionUnits(row.home))}[/td][td]${format(this.filterSectionUnits(row.away))}[/td][td]${format(this.filterSectionUnits(row.support))}[/td][/tr]\n`;
            });
            bbcode += '[/table]';
            this.copyText(bbcode, 'BBCode');
        },

        exportCSV: function() {
            const rows = this.getFilteredRows();
            if (!rows.length) {
                GMB.notify('Geen troependata om te exporteren.', { type: 'warn' });
                return;
            }
            const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const csv = [
                ['Speler', 'Stad', 'Town ID', 'OC', 'Eiland', 'Status', 'Categorie', 'Eenheid', 'Aantal'].map(quote).join(','),
                ...rows.flatMap(row => ['home', 'away', 'support'].flatMap(section =>
                    Object.entries(this.filterSectionUnits(row[section])).map(([unit, count]) => [
                        row.player, row.name, row.id, row.ocean, row.islandId,
                        section === 'home' ? 'Thuis' : section === 'away' ? 'Buiten' : 'Ondersteuning',
                        this.getCategoryLabel(this.classifyUnit(unit, GMB_API.getUW())),
                        this.getUnitLabel(unit, GMB_API.getUW()), count
                    ].map(quote).join(','))
                ))
            ].join('\r\n');
            try {
                const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `gmb-troepen-${GMB.worldId || 'wereld'}-${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                GMB.notify('CSV-export gestart.', { type: 'success' });
            } catch (error) {
                GMB.log('TroopManager', `CSV-export mislukt: ${error.message}`, 'error');
                GMB.notify(`CSV-export mislukt: ${error.message}`, { type: 'error' });
            }
        },

        getCategoryLabel: function(category) {
            return ({ land: 'Land', sea: 'Zee', mythical: 'Mythisch', hero: 'Held' })[category] || category;
        },

        escapeHtml: function(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[character]);
        },

        copyText: function(text, label) {
            try {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(text, 'text');
                    GMB.notify(`${label} gekopieerd naar het klembord.`, { type: 'success' });
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(
                        () => GMB.notify(`${label} gekopieerd naar het klembord.`, { type: 'success' }),
                        error => {
                            GMB.log('TroopManager', `${label} kopiëren mislukt: ${error.message}`, 'error');
                            GMB.notify(`${label} kopiëren mislukt: ${error.message}`, { type: 'error' });
                        }
                    );
                    return;
                }
                throw new Error('Geen klembord-API beschikbaar');
            } catch (error) {
                GMB.log('TroopManager', `${label} kopiëren mislukt: ${error.message}`, 'error');
                GMB.notify(`${label} kopiëren mislukt: ${error.message}`, { type: 'error' });
            }
        }
    };

    // ============================================================
    // COMMAND CENTER MODULE (Inkomende commando's & waarschuwingen)
    // ============================================================

    const GMB_Commands = {
        commands: [],
        townNames: new Map(),
        timer: null,
        running: false,
        polling: false,
        seenCommands: new Set(),
        lastPollStartedAt: 0,
        originalTitle: null,
        originalFavicon: null,
        faviconTimer: null,
        faviconLink: null,
        attackTypes: new Set(['attack', 'attack_land', 'attack_sea', 'attack_takeover', 'illusion', 'portal_attack_olympus', 'revolt']),
        init: function() {
            setTimeout(() => this.addUITab(), 900);
            const storedSeen = GMB.storage.get(this.getSeenKey(), null);
            this.seenCommands = new Set(Array.isArray(storedSeen) ? storedSeen.map(String) : []);
            if (!GMB.storage.get('commands_interval_migrated', false)) {
                if (Number(GMB.storage.get('commands_interval', 60)) === 60) GMB.storage.set('commands_interval', 5);
                GMB.storage.set('commands_interval_migrated', true);
            }
            if (GMB.storage.get('commands_enabled', false)) {
                setTimeout(() => this.start(), 1200);
            }
        },

        getSeenKey: function() {
            return `commands_alerted_v3_${GMB.worldId || GMB_API.getWorldId() || 'world'}`;
        },

        getTowns: function() {
            const uw = GMB_API.getUW();
            const source = uw.ITowns && typeof uw.ITowns.getTowns === 'function'
                ? uw.ITowns.getTowns()
                : uw.ITowns && uw.ITowns.towns;
            const towns = source ? (Array.isArray(source) ? source : Object.values(source)) : [];
            return towns.filter(town => town && Number(town.id) > 0).map(town => {
                const id = Number(town.id);
                let name = String(town.name || `Stad ${id}`);
                try {
                    const model = uw.ITowns && typeof uw.ITowns.getTown === 'function' ? uw.ITowns.getTown(id) || town : town;
                    if (typeof model.getName === 'function') name = model.getName() || name;
                } catch (error) {
                    GMB.log('Commands', `Naam van stad ${id} kon niet worden gelezen: ${error.message}`, 'warn');
                }
                return { id, name };
            });
        },

        normalizeCommands: function(response, town) {
            let root = response;
            for (let depth = 0; depth < 5 && root; depth++) {
                if (typeof root === 'string') {
                    root = JSON.parse(root);
                    continue;
                }
                if (root.json) {
                    root = typeof root.json === 'string' ? JSON.parse(root.json) : root.json;
                    continue;
                }
                if (root.data && typeof root.data === 'string') {
                    root = JSON.parse(root.data);
                    continue;
                }
                break;
            }
            const data = root && root.data || {};
            const listValue = Array.isArray(root) ? root
                : Array.isArray(data) ? data
                : data.commands || data.command_overview || root && root.commands || root && root.command_overview;
            const list = Array.isArray(listValue) ? listValue
                : listValue && typeof listValue === 'object' ? Object.values(listValue) : null;
            if (!Array.isArray(list)) throw new Error(`Commandoresponse voor stad ${town.id} bevat geen commands-lijst`);
            return list.filter(command => command && (command.id != null || command.command_id != null)).map(command => ({
                ...command,
                id: String(command.id ?? command.command_id),
                type: String(command.type || command.command_type || command.commandType || 'unknown').toLowerCase(),
                polledTownId: town.id,
                polledTownName: town.name
            }));
        },

        getIncomingReason: function(command) {
            if (!this.attackTypes.has(String(command.type || '').toLowerCase())) return 'not_attack';
            if (!this.townNames.has(Number(command.polledTownId))) return 'not_own_city_response';
            return 'incoming';
        },

        isIncomingAttack: function(command) {
            return this.getIncomingReason(command) === 'incoming';
        },

        getTargetTownId: function(command) {
            const destinationName = String(command && (
                command.destination_town_name || command.destination_name || command.destination_town
            ) || '').trim();
            if (destinationName) {
                const normalizedName = destinationName.replace(/\s+/g, ' ').toLocaleLowerCase();
                for (const [ownTownId, ownTownName] of this.townNames) {
                    if (String(ownTownName).replace(/\s+/g, ' ').trim().toLocaleLowerCase() === normalizedName) {
                        return ownTownId;
                    }
                }
                return null;
            }

            const townId = Number(command && command.destination_town_id);
            return Number.isInteger(townId) && this.townNames.has(townId) ? townId : null;
        },

        getTargetTownName: function(command) {
            const townId = this.getTargetTownId(command);
            return townId ? this.townNames.get(townId) : command.destination_town_name || 'Onbekende doelstad';
        },

        getCommandKey: function(command) {
            const type = String(command.type || '').toLowerCase();
            const originId = Number(command.origin_town_id) || 0;
            const destinationId = Number(command.destination_town_id) || 0;
            const rawArrival = Number(command.arrival_at || command.arrival_time || command.arrival) || 0;
            const arrival = rawArrival >= 100000000000 ? Math.floor(rawArrival / 1000) : rawArrival;
            if (this.attackTypes.has(type) && originId && destinationId && arrival) {
                return `attack:${type}:${originId}:${destinationId}:${arrival}`;
            }
            return `command:${String(command.id)}`;
        },

        getLegacyCommandKey: function(command) {
            return `${command.polledTownId}:${command.id}`;
        },

        getArrivalDate: function(command) {
            const raw = Number(command.arrival_at || command.arrival_time || command.arrival);
            if (!Number.isFinite(raw) || raw <= 0) return null;
            return new Date(raw < 100000000000 ? raw * 1000 : raw);
        },

        formatDate: function(date) {
            return date && Number.isFinite(date.getTime())
                ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'Onbekend';
        },

        getETA: function(command) {
            const arrival = this.getArrivalDate(command);
            if (!arrival) return 'Onbekend';
            const seconds = Math.max(0, Math.floor((arrival.getTime() - Date.now()) / 1000));
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainder = seconds % 60;
            return `${hours ? `${hours}u ` : ''}${minutes}m ${remainder}s`;
        },

        getRetreatDate: function(command) {
            const raw = Number(command.cancelable || command.cancelable_at);
            if (!Number.isFinite(raw) || raw <= 0) return null;
            const timestamp = raw < 100000000000 ? raw * 1000 : raw;
            return new Date(timestamp);
        },

        start: function() {
            if (this.running) return;
            this.running = true;
            GMB.storage.set('commands_enabled', true);
            this.updateStatus('Monitor actief', 'success');
            this.poll();
        },

        stop: function() {
            this.running = false;
            if (this.timer) clearTimeout(this.timer);
            this.timer = null;
            GMB.storage.set('commands_enabled', false);
            this.updateStatus('Monitor gestopt', 'idle');
            this.stopFlash();
        },

        scheduleNextPoll: function() {
            if (!this.running) return;
            const intervalMs = Math.min(300, Math.max(5, Number(GMB.storage.get('commands_interval', 5)) || 5)) * 1000;
            const remaining = Math.max(0, this.lastPollStartedAt + intervalMs - Date.now());
            this.timer = setTimeout(() => this.poll(), remaining);
        },

        poll: async function() {
            if (!this.running || this.polling) return;
            this.polling = true;
            this.lastPollStartedAt = Date.now();
            try {
                const allTowns = this.getTowns();
                const selectedTownId = Number(GMB_API.getTownId());
                const towns = GMB.storage.get('commands_all_towns', true)
                    ? allTowns
                    : allTowns.filter(town => town.id === selectedTownId);
                if (!towns.length) {
                    this.updateStatus('Geen steden om te controleren', 'error');
                    return;
                }
                this.updateStatus(`Controleren: 0/${towns.length}`, 'info');
                const current = new Map();
                const failures = [];
                let totalCommands = 0;
                let attackCommands = 0;
                allTowns.forEach(town => this.townNames.set(town.id, town.name));
                for (let index = 0; index < towns.length; index++) {
                    if (!this.running) break;
                    const town = towns[index];
                    try {
                        const response = await GMB_API.get('town_overviews', 'command_overview', {}, town.id);
                        const commands = this.normalizeCommands(response, town);
                        totalCommands += commands.length;
                        attackCommands += commands.filter(command => this.attackTypes.has(command.type)).length;
                        commands.forEach(command => {
                            const reason = this.getIncomingReason(command);
                            if (reason === 'incoming') current.set(this.getCommandKey(command), command);
                        });
                    } catch (error) {
                        failures.push(`${town.name}: ${error.message}`);
                        GMB.log('Commands', `Commando's van ${town.name} niet opgehaald: ${error.message}`, 'warn');
                    }
                    this.updateStatus(`Controleren: ${index + 1}/${towns.length}`, 'info');
                    if (index < towns.length - 1 && this.running) await new Promise(resolve => setTimeout(resolve, 350));
                }
                if (!this.running) return;

                const previousSeen = GMB.storage.get(this.getSeenKey(), []);
                const seen = new Set([
                    ...this.seenCommands,
                    ...(Array.isArray(previousSeen) ? previousSeen.map(String) : [])
                ]);
                const incoming = [];
                current.forEach(command => {
                    const key = this.getCommandKey(command);
                    const legacyKey = this.getLegacyCommandKey(command);
                    if (!seen.has(key) && !seen.has(legacyKey)) {
                        incoming.push(command);
                        seen.add(key);
                        seen.add(legacyKey);
                    }
                });
                const retained = Array.from(seen).slice(-2000);
                this.seenCommands = new Set(retained);
                if (!GMB.storage.set(this.getSeenKey(), retained)) {
                    GMB.log('Commands', 'Aanval-ID’s konden niet permanent worden opgeslagen; duplicaten worden binnen deze sessie wel tegengehouden.', 'warn');
                }
                this.commands = Array.from(current.values());
                this.populateTownFilter();
                this.renderCommands();
                this.updateTabBadge();
                if (incoming.length) {
                    this.notifyIncoming(incoming);
                }
                this.updateStatus(failures.length
                    ? `Bijgewerkt met ${failures.length} fout(en) · ${current.size} inkomend (${attackCommands} aanval(len) / ${totalCommands} commando’s)`
                    : `Bijgewerkt ${new Date().toLocaleTimeString()} · ${current.size} inkomend (${attackCommands} aanval(len) / ${totalCommands} commando’s)`,
                failures.length ? 'error' : 'success');
            } catch (error) {
                GMB.log('Commands', `Poll mislukt: ${error.message}`, 'error');
                this.updateStatus(`Poll mislukt: ${error.message}`, 'error');
            } finally {
                this.polling = false;
                this.scheduleNextPoll();
            }
        },

        refreshNow: async function() {
            if (this.running) {
                if (this.timer) clearTimeout(this.timer);
                this.timer = null;
                await this.poll();
                return;
            }
            this.running = true;
            try {
                await this.poll();
            } finally {
                this.running = false;
                if (this.timer) clearTimeout(this.timer);
                this.timer = null;
            }
        },

        getIncoming: function() {
            return this.commands.filter(command => this.isIncomingAttack(command));
        },

        notifyIncoming: function(commands) {
            commands.forEach(command => {
                const attacker = command.origin_town_player_name || 'Onbekende speler';
                const origin = command.origin_town_name || 'Onbekende stad';
                const target = this.getTargetTownName(command);
                const arrival = this.formatDate(this.getArrivalDate(command));
                const message = `${attacker} vanuit ${origin} → ${target} · aankomst ${arrival} · ETA ${this.getETA(command)}`;
                GMB.notify(message, {
                    type: 'error',
                    title: 'Inkomende aanval',
                    discord: GMB.storage.get('commands_discord', false),
                    discordEveryone: true
                });
            });
            if (GMB.storage.get('commands_sound', false)) this.playAlarm();
            this.startFlash();
        },

        playAlarm: function() {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) throw new Error('Web Audio wordt niet ondersteund');
                const context = new AudioContext();
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                const volume = Math.min(100, Math.max(0, Number(GMB.storage.get('commands_volume', 35)) || 0)) / 100;
                oscillator.type = 'sine';
                oscillator.frequency.value = 880;
                gain.gain.setValueAtTime(volume * 0.18, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.65);
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start();
                oscillator.stop(context.currentTime + 0.65);
                oscillator.onended = () => context.close();
            } catch (error) {
                GMB.log('Commands', `Alarmgeluid kon niet worden afgespeeld: ${error.message}`, 'warn');
            }
        },

        startFlash: function() {
            this.stopFlash();
            this.originalTitle = document.title;
            this.faviconLink = document.querySelector('link[rel~="icon"]');
            this.originalFavicon = this.faviconLink && this.faviconLink.href;
            let flash = false;
            let ticks = 0;
            this.faviconTimer = setInterval(() => {
                flash = !flash;
                ticks++;
                document.title = flash ? '⚠ INKOMEND! ⚠' : this.originalTitle;
                if (this.faviconLink) {
                    this.faviconLink.href = flash
                        ? 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#e94560"/><text x="16" y="23" font-size="22" text-anchor="middle" fill="white">!</text></svg>')
                        : this.originalFavicon || this.faviconLink.href;
                }
                if (ticks >= 20) this.stopFlash();
            }, 500);
        },

        stopFlash: function() {
            if (this.faviconTimer) clearInterval(this.faviconTimer);
            this.faviconTimer = null;
            if (this.originalTitle) document.title = this.originalTitle;
            if (this.faviconLink) {
                if (this.originalFavicon) this.faviconLink.href = this.originalFavicon;
                else this.faviconLink.removeAttribute('href');
            }
        },

        updateStatus: function(message, type) {
            const element = document.getElementById('commands-status');
            if (!element) return;
            element.textContent = message;
            element.className = `gmb-status ${type || 'info'}`;
        },

        updateTabBadge: function() {
            const tab = document.querySelector('.gmb-tab[data-tab="commands"]');
            if (!tab) return;
            const count = this.getIncoming().length;
            tab.textContent = count ? `⚔ Commando's (${count})` : "⚔ Commando's";
            const indicator = document.getElementById('commands-incoming-count');
            if (indicator) indicator.textContent = String(count);
        },

        populateTownFilter: function() {
            const select = document.getElementById('commands-filter-town');
            if (!select) return;
            const previous = select.value;
            select.innerHTML = '<option value="">Alle steden</option>' +
                Array.from(this.townNames.entries()).map(([id, name]) =>
                    `<option value="${id}">${this.escapeHtml(name)} (#${id})</option>`
                ).join('');
            if (Array.from(this.townNames.keys()).some(id => String(id) === previous)) select.value = previous;
        },

        getFilteredCommands: function() {
            const town = document.getElementById('commands-filter-town')?.value || '';
            return this.getIncoming().filter(command =>
                !town || this.getTargetTownId(command) === Number(town) ||
                    !this.getTargetTownId(command) && Number(command.polledTownId) === Number(town)
            ).sort((a, b) => {
                const first = this.getArrivalDate(a);
                const second = this.getArrivalDate(b);
                return (first ? first.getTime() : Infinity) - (second ? second.getTime() : Infinity);
            });
        },

        renderCommands: function() {
            const container = document.getElementById('commands-list');
            if (!container) return;
            const commands = this.getFilteredCommands();
            container.innerHTML = commands.map(command => {
                const arrival = this.getArrivalDate(command);
                const retreat = this.getRetreatDate(command);
                const origin = command.origin_town_name || 'Onbekende herkomst';
                const destination = this.getTargetTownName(command);
                const attacker = command.origin_town_player_name || '';
                const targetTownId = this.getTargetTownId(command);
                return `<article style="padding:8px;margin:5px 0;background:rgba(255,255,255,.05);border-left:3px solid #e94560;border-radius:4px;">
                    <strong>Inkomende aanval: ${this.escapeHtml(String(command.type))}</strong>
                    <div>${this.escapeHtml(attacker)} ${this.escapeHtml(origin)} → ${this.escapeHtml(destination)}</div>
                    <div class="gmb-muted">Doelstad: ${this.escapeHtml(destination)} · Aankomst: ${this.formatDate(arrival)} · ETA ${this.getETA(command)}</div>
                    ${retreat && retreat.getTime() > Date.now() ? `<div class="gmb-muted">Max. terugtrektijd: ${this.formatDate(retreat)}</div>` : ''}
                    ${targetTownId ? `<button class="gmb-button gmb-button-secondary" data-militia-town="${targetTownId}" type="button">Militie oproepen in ${this.escapeHtml(destination)}</button>` : '<div class="gmb-muted">Doelstad niet herkend als eigen stad; militieknop uitgeschakeld.</div>'}
                </article>`;
            }).join('') || '<p class="gmb-muted">Geen commando’s voor deze filters.</p>';
            container.querySelectorAll('[data-militia-town]').forEach(button => {
                button.addEventListener('click', () => this.requestMilitia(Number(button.dataset.militiaTown)));
            });
            this.updateTabBadge();
        },

        requestMilitia: async function(townId) {
            const normalizedTownId = Number(townId);
            if (!Number.isInteger(normalizedTownId) || !this.townNames.has(normalizedTownId)) {
                GMB.notify('Militie niet opgeroepen: de doelstad is niet herkend als een van je eigen steden.', { type: 'error' });
                return;
            }
            const townName = this.townNames.get(normalizedTownId);
            if (!confirm(`Militie oproepen in ${townName}?`)) return;
            try {
                await GMB_API.post('building_farm', 'request_militia', {}, normalizedTownId, 'Commands');
                GMB.notify(`Militie is opgeroepen in ${townName}.`, { type: 'success' });
            } catch (error) {
                GMB.log('Commands', `Militie oproepen in ${townName} mislukt: ${error.message}`, 'error');
                GMB.notify(`Militie oproepen mislukt: ${error.message}`, { type: 'error' });
            }
        },

        escapeHtml: function(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[character]);
        },

        addUITab: function() {
            if (document.getElementById('gmb-tab-commands')) return;
            GMB_UI.addTab('commands', "⚔ Commando's", `
                <div class="gmb-section">
                    <div class="gmb-section-title">Command Center</div>
                    <div id="commands-status" class="gmb-status idle">Monitor gestopt</div>
                    <div class="gmb-kv"><strong>Inkomend</strong><span id="commands-incoming-count">0</span></div>
                    ${GMB_UI.createToggle('Inkomende commando’s monitoren', 'commands_enabled', false, enabled => enabled ? this.start() : this.stop())}
                    ${GMB_UI.createToggle('Alle eigen steden controleren', 'commands_all_towns', true)}
                    ${GMB_UI.createToggle('Alarmgeluid', 'commands_sound', false)}
                    ${GMB_UI.createToggle('Inkomende meldingen ook naar Discord', 'commands_discord', false)}
                    <label class="gmb-muted" for="commands-interval">Controle-interval (seconden, 5–300; interval tussen starts van scans)</label>
                    <input class="gmb-input" id="commands-interval" type="number" min="5" max="300" step="1">
                    <label class="gmb-muted" for="commands-volume">Alarmvolume (0–100)</label>
                    <input class="gmb-input" id="commands-volume" type="number" min="0" max="100" step="5">
                    ${GMB_UI.createButton('Nu controleren', () => this.refreshNow(), 'gmb-button-secondary')}
                    <div style="margin-top:8px;">
                        <label class="gmb-muted">Doelstad<select class="gmb-select" id="commands-filter-town"><option value="">Alle steden</option></select></label>
                    </div>
                    <div id="commands-list" style="max-height:520px;overflow:auto;margin-top:8px;">
                        <p class="gmb-muted">Start de monitor of controleer handmatig om inkomende aanvallen te laden.</p>
                    </div>
                </div>
            `);
            const interval = document.getElementById('commands-interval');
            const volume = document.getElementById('commands-volume');
            const town = document.getElementById('commands-filter-town');
            if (interval) {
                interval.value = GMB.storage.get('commands_interval', 5);
                interval.addEventListener('change', () => {
                GMB.storage.set('commands_interval', Math.min(300, Math.max(5, Number(interval.value) || 5)));
                interval.value = GMB.storage.get('commands_interval', 5);
                if (this.running) {
                    if (this.timer) clearTimeout(this.timer);
                    this.scheduleNextPoll();
                    }
                });
            }
            if (volume) {
                volume.value = GMB.storage.get('commands_volume', 35);
                volume.addEventListener('change', () => GMB.storage.set('commands_volume', Math.min(100, Math.max(0, Number(volume.value) || 0))));
            }
            if (town) town.addEventListener('change', () => this.renderCommands());
            this.populateTownFilter();
            this.renderCommands();
            if (GMB.storage.get('commands_enabled', false)) this.start();
        },

    };

    // ============================================================
    // FORUM TEMPLATE MODULE (ROOD)
    // ============================================================

    const GMB_ForumTemplate = {
        specialUnitKeys: new Set([
            'agamemnon', 'ajax', 'alexandrios', 'hector', 'heracles', 'leonidas', 'lysippe',
            'melousa', 'mihalis', 'pelops', 'perseus', 'telemachos', 'themistokles', 'urephon',
            'zuretha', 'andromeda', 'anysia', 'argos', 'apheledes', 'aristotle', 'atalanta',
            'chiron', 'christopholus', 'daidalos', 'democritus', 'deimos', 'eurybia', 'ferkyon',
            'helen', 'iason', 'medea', 'odysseus', 'orpheus', 'pariphaistes', 'philoctetes',
            'rekonos', 'terylea', 'ylestres'
        ]),

        init: function() {
            this.addComposerButton();
            if ((GMB.isForumPage() || GMB.isGamePage()) && document.body && typeof MutationObserver === 'function') {
                this.observer = new MutationObserver(() => this.addComposerButton());
                this.observer.observe(document.body, { childList: true, subtree: true });
            }
        },

        addComposerButton: function() {
            if (!GMB.isModuleEnabled('ForumTemplate')) return;
            const wrapper = document.querySelector('#bbcodes > div, #forum .bb_button_wrapper');
            const textArea = document.querySelector('#forum_post_textarea');
            if (!wrapper || !textArea) return;

            const buttons = [
                { id: 'rood', label: '⚔️', title: 'Vul de ROOD-template in met gegevens van de huidige stad', color: '#b42332', isIcon: true },
                { id: 'dio-defense', label: '🛡️', title: 'Deff-form', color: '#315b85', isIcon: true },
                { id: 'smileys', label: '😊', title: 'Emoji\'s invoegen', color: '#6a4c93', isIcon: true }
            ];
            buttons.forEach(item => {
                const buttonId = `gmb-forum-template-${item.id}`;
                if (document.getElementById(buttonId)) return;
                const button = document.createElement('a');
                button.id = buttonId;
                button.href = '#';
                button.className = 'bbcode_option';
                button.title = item.title;
                button.textContent = item.label;
                const fontSize = item.isIcon ? '14px' : '10px';
                const padding = item.isIcon ? '0' : '1px 5px';
                const width = item.isIcon ? '20px' : 'auto';
                const height = item.isIcon ? '20px' : 'auto';
                button.style.cssText = `display:inline-block;width:${width};height:${height};padding:${padding};margin:1px;color:#fff;background:${item.color};border-radius:2px;font-size:${fontSize};font-weight:normal;text-decoration:none;border:1px solid rgba(255,255,255,0.2);`;
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (button.dataset.gmbBusy === 'true') return;
                    button.dataset.gmbBusy = 'true';
                    button.setAttribute('aria-disabled', 'true');
                    button.style.pointerEvents = 'none';
                    if (item.id === 'smileys') {
                        this.showSmileysPicker(button, wrapper);
                        delete button.dataset.gmbBusy;
                        button.removeAttribute('aria-disabled');
                        button.style.pointerEvents = '';
                        return;
                    }
                    Promise.resolve(item.id === 'rood'
                        ? this.generateForCurrentTown(button)
                        : item.id === 'dio-defense'
                            ? this.generateDioDefense(button)
                            : this.insertStaticTemplate(item.id, button))
                        .catch(error => {
                            GMB.log('ForumTemplate', `${item.label} mislukt: ${error.message}`, 'error');
                            GMB.notify(`${item.label} mislukt: ${error.message}`, { type: 'error' });
                        })
                        .finally(() => {
                            delete button.dataset.gmbBusy;
                            button.removeAttribute('aria-disabled');
                            button.style.pointerEvents = '';
                        });
                });
                wrapper.appendChild(button);
            });
        },

        smileysData: {
            '😊 Standaard': ['smilenew', 'lol', 'neutral_new', 'afraid', 'freddus_pacman', 'auslachen2', 'kolobok-sanduhr', 'bussi2', 'winken4', 'flucht2', 'panik4', 'ins-auge-stechen', 'seb_zunge', 'fluch4_GREEN', 'baby_junge2', 'blush-reloaded6', 'frown', 'verlegen', 'blush-pfeif', 'stevieh_rolleyes', 'daumendreh2', 'baby_taptap', 'sadnew', 'hust', 'confusednew', 'idea2', 'irre', 'irre4', 'sleep', 'candle', 'nicken', 'no_sad', 'thumbs-up_new', 'kciuki', 'thumbs-down_new', 'bravo2', 'oh-no2', 'kaffee2', 'drunk', 'saufen', 'freu-dance', 'hecheln', 'headstand', 'rollsmiliey', 'eazy_cool01', 'motz', 'cuinlove', 'biggrin', 'land_germany', 'land_germany2', 'land_germany3', 'land_germany_kings', 'land_france', 'land_france2', 'land_france3', 'land_italy', 'land_italy2', 'land_italy3', 'land_romania', 'land_romania2', 'land_romania3', 'land_portugal', 'land_portugal2', 'land_portugal3', 'land_poland', 'land_poland2', 'land_poland3', 'land_spain', 'land_spain2', 'land_spain3'],
            '🌿 Natuur': ['dinosaurier07', 'flu-super-gau', 'ben_cat', 'schwein', 'hundeleine01', 'blume', 'ben_sharky', 'ben_cow', 'charly_bissig', 'gehirnschnecke_confused', 'mttao_fische', 'mttao_angler', 'insel', 'fliegeschnappen', 'plapperhase', 'ben_dumbo', 'twitter', 'elefant', 'schildkroete', 'elektroschocker', 'spiderschwein', 'oma_sessel_katze', 'fred_elefant', 'palmoel', 'stevieh_teddy', 'fips_aufsmaul', 'marienkaefer', 'mrkaktus', 'kleeblatt2', 'fred_blumenstauss', 'hurra_fruehling1_lila', 'fred_rasenmaeher', 'fred_blumenbeet'],
            '🏛️ Grepolis': ['grepolis', 'mttao_wassermann', 'i-lovo-grepolis', 'silvester_cuinlove', 'mttao_schuetze', 'kleeblatt2', 'wallbash', 'musketiere_fechtend', 'aufsmaul', 'lol1', 'mttao_waage2', 'steckenpferd', 'skullhaufen', 'pferdehaufen', 'pirat5', 'seb_cowboy', 'gw_ranger001', 'barbar', 'datz', 'waffe01', 'sarazene_bogen', 'waffe02', 'waffe14', 'hoplit_sword1', 'pfeildurchkopf02', 'saladin', 'hoplit_sword3'],
            '👥 Mensen': ['greenistan', 'mttao_usa', 'schal_usa', 'mttao_grossbritannien', 'seb_hut5', 'opa_boese2', 'star-wars-yoda1-gruen', 'hexefliegend', 'snob', 'seb_detektiv_ani', 'devil', 'segen', 'borg', 'hexe3b', 'eazy_polizei', 'stars_elvis', 'mttao_chefkoch', 'nikolaus', 'pirate3_biggrin', 'batman_skeptisch', 'tubbie1', 'tubbie2', 'tubbie3', 'kosmita', 'tubbie4', 'mttao_deutschland', 'schal_deutschland', 'mttao_frankreich', 'schal_frankreich', 'mttao_italien', 'schal_italien', 'mttao_rumaenien', 'mttao_portugal', 'schal_portugal', 'mttao_polen', 'mttao_spanien', 'schal_spanien', 'mttao_slowakei', 'schal_slowakei'],
            '🎉 Feest': ['torte1', 'torte3', 'bier', 'party', 'party2', 'fans', 'band', 'klokotzen', 'laola', 'prost', 'rave', 'mcdonalds', 'margarita', 'geschenk', 'sauf', 'el', 'trommler', 'ozboss_gitarre2', 'kaffee', 'kaffee3', 'caipirinha', 'whiskey', 'drunk', 'fressen', 'popcorn_essen', 'saufen', 'energydrink1', 'leckerer', 'prost2', 'birthday'],
            '❤️ Liefde': ['b-love2', 'brautpaar-kinder', 'brautpaar-reis', 'cuinlove', 'fips_herzen01', 'heart', 'herzen01', 'herzen02', 'herzen06', 'kiss', 'klk_tee', 'liebesflagge', 'love', 'lovelove_light', 'rose', 'send-out-love', 'teeglas_fruechtetee', 'unknownauthor_knutsch', 'valentinstag_biggrin', 'valentinstag_confused', 'valentinstag_down', 'valentinstag_irre', 'valentinstag_lol', 'valentinstag_thumbs1', 'wolke7', 'xmas4_rose'],
            '🎃 Halloween': ['zombies_alien', 'zombies_lol', 'zombies_rolleyes', 'zombie01', 'zombies_smile', 'zombie02', 'zombies_skeptisch', 'zombies_eek', 'zombies_frown', 'geistani', 'scream-if-you-can', 'pfeildurchkopf01', 'grab-schaufler', 'kuerbisleuchten', 'mummy3', 'kuerbishaufen', 'halloweenskulljongleur', 'fledermausvampir', 'frankenstein_lol', 'halloween_confused', 'zombies_razz', 'halloweenstars_freddykrueger', 'zombies_cool', 'geist2', 'fledermaus2', 'halloweenstars_dracula', 'batman', 'halloweenstars_lastsummer', 'hexe-frosch', 'xmas4_hexe-frosch', 'hexe-frosch2'],
            '🎄 Kerstmis': ['i-love-grepolis', 'santagrin', 'xmas1_down', 'xmas1_thumbs1', 'xmas2_lol', 'xmas1_frown', 'xmas1_irre', 'xmas1_razz', 'xmas4_kaffee2', 'xmas4_hurra2', 'xmas4_aufsmaul', 'schneeball', 'schneeballwerfen', 'xmas4_advent4', 'nikolaus', 'weihnachtsmann_junge', 'schneewerfen_wald', 'weihnachtsmann_nordpol', 'xmas_kilroy_kamin', 'xmas4_laola', 'xmas3_smile', 'xmas4_paketliebe', '3hlkoenige', 'santa', 'weihnachtsgeschenk2', 'fred_weihnachten-ostern', 'xmas4_wallbash', 'xmas4_liebe', 'xmas4_skullhaufen', 'tree', 'xmas1_censored', 'xmas4_furz', 'xmas4_nixweiss', 'xmas4_altermann', 'xmas4_postbote', 'xmas4_postpaket', 'xmas4_paketliebe', 'xmas4_regenschirm2', 'xmas4_respekt', 'xmas4_stars_takethat_howard', 'xmas4_talk', 'xmas4_hundeleine01', 'xmas4_spam1', 'xmas4_spam3', 'xmas4_google', 'xmas4_selbstmord'],
            '🐰 Pasen': ['eier_bemalen_blau_hase_braun', 'osterei_hase05', 'osterei_bunt', 'ostern_hurra2', 'osterhasensmilie', 'ostern_thumbs1', 'ostern_nosmile', 'ostern_lol', 'ostern_irre', 'ostern_frown', 'ostern_down', 'ostern_cuinlove', 'ostern_confused', 'ostern_blush', 'ostern_biggrin', 'ostern1_blush-reloaded', 'ostern_alien', 'ostern_censored', 'ostern_cool', 'ostern_stumm', 'xmas4_ostern_stumm', 'ostern1_xd', 'ostern2_xd', 'ostern2_censored', 'ostern2_confused', 'ostern2_cuinlove', 'ostern2_down', 'ostern2_thumbs1', 'ostern_rofl3', 'ostern2_rofl3'],
            '📝 Overig': ['steinwerfen', 'herzen02', 'scream-if-you-can', 'kolobok', 'headbash', 'liebeskummer', 'bussi', 'brautpaar-reis', 'grab-schaufler2', 'boxen2', 'aufsmaul', 'mttao_kehren', 'sm', 'weckruf', 'klugscheisser2', 'karte2_rot', 'dagegen', 'party', 'dafuer', 'outofthebox', 'pokal_gold', 'koepfler', 'transformer', 'eazy_senseo1', 'dagegen2', 'dafuer2'],
            '🔤 Letters': (() => {
                const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
                const symFull = ['and', 'backslash', 'callsign', 'comma', 'plus', 'point', 'questionmark', 'quote', 'slash', 'space', 'star', 'AE', 'OE', 'UE', 'SZ'];
                const symBraille = ['callsign', 'comma', 'point', 'questionmark', 'quote', 'space', 'AE', 'OE', 'UE', 'SZ'];
                const symBoek = ['and', 'callsign', 'comma', 'plus', 'point', 'questionmark', 'quote', 'space', 'star', 'AE', 'OE', 'UE'];
                const out = [];
                ['sign2', 'sign3', 'xmas-sign'].forEach(p => { chars.forEach(c => out.push(p + '_' + c)); symFull.forEach(s => out.push(p + '_' + s)); });
                chars.forEach(c => out.push('braille-schrift_' + c)); symBraille.forEach(s => out.push('braille-schrift_' + s));
                chars.forEach(c => out.push('buchstaben_' + c)); symBoek.forEach(s => out.push('buchstaben_' + s));
                for (let i = 1; i <= 9; i++) out.push('rate0' + i);
                out.push('rate10', 'rate11', 'rate11b');
                return out;
            })(),
            '🎂 Verjaardag': ['29a', '29b', '29c', ...Array.from({ length: 100 }, (_, i) => 'geburtstagswedler-' + (i + 1))],
            '😀 GRCRTools': ['emots/usmiech.gif', 'emots/ostr.gif', 'emots/kwadr.gif', 'emots/smutny2.gif', 'emots/yyyy.gif', 'emots/uoeee.gif', 'emots/lol.gif', 'emots/rotfl.gif', 'emots/oczko.gif', 'emots/jezyk.gif', 'emots/jezyk_oko.gif', 'emots/stres.gif', 'emots/nerwus.gif', 'emots/zly.gif', 'emots/w8.gif', 'emots/wesoly.gif', 'emots/bezradny.gif', 'emots/krzyk.gif', 'emots/szok.gif', 'emots/hura.gif', 'emots/boisie.gif', 'emots/prosi.gif', 'emots/nie.gif', 'emots/hejka.gif', 'emots/okok.gif', 'emots/cwaniak.gif', 'emots/haha.gif', 'emots/mysli.gif', 'emots/pocieszacz.gif', 'emots/foch.gif', 'emots/zmeczony.gif', 'emots/beczy.gif', 'emots/wysmiewacz.gif', 'emots/zalamka.gif', 'emots/buziak.gif', 'emots/buzki.gif', 'emots/dobani.gif', 'emots/dokuczacz.gif', 'emots/figielek.gif', 'emots/klotnia.gif', 'emots/paluszkiem.gif', 'emots/wnerw.gif', 'emots/zacieszacz.gif'],
            '👩 GRCRTools Girls': ['emots2/girl_angel.gif', 'emots2/girl_angry.gif', 'emots2/girl_baby.gif', 'emots2/girl_beat.gif', 'emots2/girl_beee.gif', 'emots2/girl_blush2.gif', 'emots2/girl_cavemanlarge.gif', 'emots2/girl_comp.gif', 'emots2/girl_cray2.gif', 'emots2/girl_crazy.gif', 'emots2/girl_cry5.gif', 'emots2/girl_cute.gif', 'emots2/girl_drink1.gif', 'emots2/girl_drool.gif', 'emots2/girl_elbowyes.gif', 'emots2/girl_feminist.gif', 'emots2/girl_haha.gif', 'emots2/girl_hankycray.gif', 'emots2/girl_hospital.gif', 'emots2/girl_hysteric.gif', 'emots2/girl_impossible.gif', 'emots2/girl_in_love.gif', 'emots2/girl_kiss2.gif', 'emots2/girl_kiss3.gif', 'emots2/girl_kiss5.gif', 'emots2/girl_lol.gif', 'emots2/girl_manicur.gif', 'emots2/girl_party2.gif', 'emots2/girl_peek-a-boo.gif', 'emots2/girl_pinkglassesf.gif', 'emots2/girl_shock3.gif', 'emots2/girl_sigh.gif', 'emots2/girl_spruce_up.gif', 'emots2/girl_tender.gif', 'emots2/girl_whistling.gif', 'emots2/girl_wink.gif', 'emots2/girl_witch.gif', 'emots2/girl_yawn.gif'],
            '😎 GRCRTools Anpu': ['emots2/acute.gif', 'emots2/aggressive.gif', 'emots2/air_kiss.gif', 'emots2/amem.gif', 'emots2/angel.gif', 'emots2/angel.png', 'emots2/angry.png', 'emots2/bad.gif', 'emots2/bb.gif', 'emots2/beach.gif', 'emots2/beee.gif', 'emots2/beer.png', 'emots2/big_boss.gif', 'emots2/biggrin.gif', 'emots2/biggrin.png', 'emots2/blink.png', 'emots2/blum3.gif', 'emots2/blush.gif', 'emots2/blush.png', 'emots2/bomb.png', 'emots2/boredom.gif', 'emots2/bye2.gif', 'emots2/bye.gif', 'emots2/Clap.gif', 'emots2/clapping.gif', 'emots2/cool.gif', 'emots2/cool.png', 'emots2/coool.gif', 'emots2/cray2.gif', 'emots2/cray.gif', 'emots2/crazy.gif', 'emots2/cry.png', 'emots2/cursing.gif', 'emots2/dance1.gif', 'emots2/dance2.gif', 'emots2/dance3.gif', 'emots2/dash.gif', 'emots2/devil.png', 'emots2/diablo.gif', 'emots2/dirol.gif', 'emots2/dj.gif', 'emots2/dontknow.gif', 'emots2/drinks.gif', 'emots2/drool.png', 'emots2/elvis.gif', 'emots2/emoticon-0115-inlove.gif', 'emots2/facepalm.gif', 'emots2/friends.gif', 'emots2/gamer4.gif', 'emots2/getlost.png', 'emots2/giggle.gif', 'emots2/give_heart2.gif', 'emots2/give_rose.gif', 'emots2/good.gif', 'emots2/Grandpa_Angry.gif', 'emots2/greeting.gif', 'emots2/grin.png', 'emots2/hang2.gif', 'emots2/happy.png', 'emots2/help.gif', 'emots2/hot.gif', 'emots2/hrhr.gif', 'emots2/hunter.gif', 'emots2/ilovethis.gif', 'emots2/inlove.png', 'emots2/ireful1.gif', 'emots2/king.gif', 'emots2/kissed.png', 'emots2/kissing.png', 'emots2/kiss.png', 'emots2/kolobok_superman.gif', 'emots2/laugh.gif', 'emots2/laughing.png', 'emots2/lazy.gif', 'emots2/lol27.gif', 'emots2/lol.gif', 'emots2/mail1.gif', 'emots2/mamba.gif', 'emots2/man_in_love.gif', 'emots2/moil.gif', 'emots2/mosking.gif', 'emots2/music2.gif', 'emots2/music.png', 'emots2/nea.gif', 'emots2/new_russian.gif', 'emots2/offtopic.gif', 'emots2/oldman.gif', 'emots2/on_the_quiet.gif', 'emots2/paint2.gif', 'emots2/pardon.gif', 'emots2/pirate.gif', 'emots2/pleasantry.gif', 'emots2/poo.png', 'emots2/popcorm1.gif', 'emots2/pouty.png', 'emots2/prankster2.gif', 'emots2/preved.gif', 'emots2/punish.gif', 'emots2/rofl.gif', 'emots2/rolleyes.gif', 'emots2/rolleyes.png', 'emots2/rose.png', 'emots2/sad.png', 'emots2/sarcastic.gif', 'emots2/sarcastic_hand.gif', 'emots2/scare.gif', 'emots2/scratch_one-s_head.gif', 'emots2/secret.gif', 'emots2/sensored.gif', 'emots2/shake2.gif', 'emots2/shocked.png', 'emots2/shock.png', 'emots2/shok.gif', 'emots2/shout.gif', 'emots2/sick.png', 'emots2/sideways.png', 'emots2/sleeping.gif', 'emots2/sleep.png', 'emots2/smile.png', 'emots2/smoke.gif', 'emots2/snog.gif', 'emots2/sorry2.gif', 'emots2/sorry.gif', 'emots2/spiteful.gif', 'emots2/stfu.png', 'emots2/stop.gif', 'emots2/stop.png', 'emots2/teeth.png', 'emots2/this.gif', 'emots2/thumbdown.png', 'emots2/thumbsup.png', 'emots2/tongue.gif', 'emots2/tongue.png', 'emots2/training1.gif', 'emots2/unsure.gif', 'emots2/vava.gif', 'emots2/victory.gif', 'emots2/wacko.png', 'emots2/wait.gif', 'emots2/whip.gif', 'emots2/whistling.gif', 'emots2/wink.gif', 'emots2/wink.png', 'emots2/wizard.gif', 'emots2/wrong.png', 'emots2/yahoo.gif', 'emots2/yawn.png', 'emots2/yes.gif', 'emots2/zloy.gif'],
            '⭐ Usersaved': ['https://cdn.grcrt.net/emots2/237.gif', 'https://cdn.grcrt.net/emots2/shake2.gif']
        },

        showSmileysPicker: function(button, wrapper) {
            const existingPicker = wrapper.querySelector('.gmb-smileys-picker');
            if (existingPicker) {
                existingPicker.remove();
                return;
            }

            const picker = document.createElement('div');
            picker.className = 'gmb-smileys-picker';
            picker.style.cssText = 'position:absolute;top:100%;left:0;z-index:10000;background:#20242a;border:1px solid #68717c;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.5);width:640px;max-width:95vw;';

            const tabsContainer = document.createElement('div');
            tabsContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;padding:4px 6px 0;border-bottom:1px solid #68717c;';
            const emojiGrid = document.createElement('div');
            emojiGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,44px);gap:4px;padding:6px;max-height:150px;overflow-y:auto;align-content:start;scrollbar-width:thin;';

            let activeCategory = Object.keys(this.smileysData)[0];
            const renderEmojiGrid = (category) => {
                emojiGrid.innerHTML = '';
                const smileys = this.smileysData[category];
                const Home_url = 'https://dio-david1327.github.io';

                smileys.forEach(smileyName => {
                    let imgUrl;
                    if (smileyName.startsWith('http')) {
                        imgUrl = smileyName;
                    } else if (smileyName.includes('/')) {
                        imgUrl = `https://cdn.grcrt.net/${smileyName}`;
                    } else {
                        imgUrl = `${Home_url}/img/smileys/${smileyName}.gif`;
                    }
                    const choice = document.createElement('button');
                    choice.type = 'button';
                    choice.innerHTML = `<img src="${imgUrl}" alt="${smileyName}" style="max-width:35px;max-height:35px;width:auto;height:auto;">`;
                    choice.title = `Voeg ${smileyName} in`;
                    choice.setAttribute('aria-label', `Voeg ${smileyName} in`);
                    choice.style.cssText = 'width:42px;height:42px;font-size:18px;padding:2px;border:1px solid rgba(0,0,0,0);border-radius:5px;background:#343a40;cursor:pointer;display:flex;align-items:center;justify-content:center;';
                    choice.addEventListener('mouseenter', () => { choice.style.background = 'rgba(8,148,77,0.2)'; choice.style.border = '1px solid rgba(0,128,0,0.5)'; });
                    choice.addEventListener('mouseleave', () => { choice.style.background = '#343a40'; choice.style.border = '1px solid rgba(0,0,0,0)'; });
                    choice.addEventListener('click', event => {
                        event.preventDefault();
                        event.stopPropagation();
                        const textArea = this.getComposerField('#forum_post_textarea', wrapper);
                        if (!textArea) {
                            GMB.notify('Forumtekstveld niet gevonden; smiley niet ingevoegd.', { type: 'error' });
                            return;
                        }
                        const bbcode = `[img]${imgUrl}[/img]`;
                        const start = Number.isInteger(textArea.selectionStart) ? textArea.selectionStart : textArea.value.length;
                        const end = Number.isInteger(textArea.selectionEnd) ? textArea.selectionEnd : start;
                        const value = textArea.value;
                        textArea.value = `${value.slice(0, start)}${bbcode}${value.slice(end)}`;
                        const cursor = start + bbcode.length;
                        if (typeof textArea.setSelectionRange === 'function') textArea.setSelectionRange(cursor, cursor);
                        const view = textArea.ownerDocument && textArea.ownerDocument.defaultView || window;
                        textArea.dispatchEvent(new view.Event('input', { bubbles: true }));
                        textArea.dispatchEvent(new view.Event('change', { bubbles: true }));
                        textArea.focus();
                    });
                    emojiGrid.appendChild(choice);
                });
            };

            Object.keys(this.smileysData).forEach(category => {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.textContent = category.split(' ')[0];
                tab.title = category;
                tab.style.cssText = 'padding:4px 8px;font-size:11px;border:0;border-radius:3px;background:#343a40;color:#fff;cursor:pointer;margin-bottom:-1px;';
                tab.addEventListener('click', () => {
                    activeCategory = category;
                    tabsContainer.querySelectorAll('button').forEach(b => b.style.background = '#343a40');
                    tab.style.background = '#4a5568';
                    renderEmojiGrid(category);
                });
                tabsContainer.appendChild(tab);
                if (category === activeCategory) {
                    tab.style.background = '#4a5568';
                }
            });

            renderEmojiGrid(activeCategory);
            picker.append(tabsContainer, emojiGrid);
            wrapper.appendChild(picker);

            const outsideClickHandler = (event) => {
                if (!picker.contains(event.target) && !button.contains(event.target)) {
                    picker.remove();
                    document.removeEventListener('click', outsideClickHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', outsideClickHandler), 0);
        },

        getComposerField: function(selector, sourceElement = null) {
            const root = sourceElement && sourceElement.closest('#forum, .gpwindow_content');
            const localField = root && root.querySelector(selector);
            if (localField && localField.getClientRects().length) return localField;
            const fields = Array.from(document.querySelectorAll(selector));
            return fields.find(field => field.getClientRects().length) || fields[0] || null;
        },

        setComposerValue: function(field, value) {
            if (!field) return;
            field.value = value;
            const view = field.ownerDocument && field.ownerDocument.defaultView || window;
            field.dispatchEvent(new view.Event('input', { bubbles: true }));
            field.dispatchEvent(new view.Event('change', { bubbles: true }));
        },

        getTownModel: function(townId) {
            const uw = GMB_API.getUW();
            const towns = uw.ITowns;
            let town = towns && typeof towns.getTown === 'function' ? towns.getTown(townId) : null;
            if (!town && towns && typeof towns.getTowns === 'function') {
                const collection = towns.getTowns() || {};
                town = (Array.isArray(collection) ? collection : Object.values(collection))
                    .find(item => Number(item && item.id) === Number(townId)) || null;
            }
            if (!town) throw new Error(`Stad ${townId} is niet beschikbaar in ITowns`);
            return town;
        },

        getModelValue: function(model, method, property) {
            if (model && typeof model[method] === 'function') return model[method]();
            if (model && model.attributes && model.attributes[property] !== undefined) return model.attributes[property];
            return model && model[property];
        },

        getTownUnits: async function(town, townId) {
            const manager = GMB_TroopManager;
            const uw = GMB_API.getUW();
            const units = {};
            const fragments = uw.ITowns && uw.ITowns.all_units && uw.ITowns.all_units.fragments || {};
            let foundFragments = false;
            Object.values(fragments).forEach(fragment => {
                const models = fragment && fragment.models;
                if (!models) return;
                Object.values(models).forEach(model => {
                    const attributes = model && (model.attributes || (typeof model.toJSON === 'function' && model.toJSON()));
                    if (!attributes) return;
                    const currentId = Number(attributes.current_town_id ?? attributes.currentTownId ?? attributes.currentId);
                    if (currentId !== Number(townId)) return;
                    const fragmentUnits = manager.readFragmentUnits(attributes);
                    if (!Object.keys(fragmentUnits).length) return;
                    manager.addUnits(units, fragmentUnits);
                    foundFragments = true;
                });
            });
            if (!foundFragments) {
                const native = typeof town.units === 'function' ? town.units() : town.units;
                Object.assign(units, manager.normalizeUnits(native));
            }

            const support = await manager.getTownSupport(town, townId);
            manager.addUnits(units, support);
            return units;
        },

        getTownFacts: async function() {
            const uw = GMB_API.getUW();
            const townId = Number(GMB_API.getTownId());
            if (!Number.isInteger(townId) || townId <= 0) throw new Error('Huidige stad kon niet worden bepaald');
            const town = this.getTownModel(townId);
            const name = String((typeof town.getName === 'function' ? town.getName() : town.name) || `Stad ${townId}`);
            let worldTown = null;
            try {
                const townData = await GMB_WorldData.getTowns();
                worldTown = townData.byId.get(townId) || null;
            } catch (error) {
                GMB.log('ForumTemplate', `towns.txt niet beschikbaar; probeer lokale stadscoördinaten: ${error.message}`, 'warn');
            }
            const x = Number((worldTown && worldTown.x) ?? town.x ?? (town.attributes && town.attributes.x));
            const y = Number((worldTown && worldTown.y) ?? town.y ?? (town.attributes && town.attributes.y));
            if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Coördinaten voor ${name} ontbreken in towns.txt en ITowns`);
            const ocean = `${String(Math.floor(x / 100)).padStart(2, '0')}${String(Math.floor(y / 100)).padStart(2, '0')}`;
            const buildings = this.getModelValue(town, 'getBuildings', 'buildings');
            const researches = this.getModelValue(town, 'getResearches', 'researches');
            const buildingLevel = key => {
                if (buildings && typeof buildings.getBuildingLevel === 'function') return Number(buildings.getBuildingLevel(key)) || 0;
                const value = buildings && (typeof buildings.get === 'function' ? buildings.get(key) : buildings.attributes && buildings.attributes[key]);
                return Number(value && typeof value === 'object' ? value.level : value) || 0;
            };
            const researchValue = key => {
                const value = researches && (typeof researches.get === 'function' ? researches.get(key) : researches.attributes && researches.attributes[key]);
                return value === true || Number(value) > 0;
            };
            const godValue = this.getModelValue(town, 'god', 'god');
            const god = String(godValue || 'Geen god');
            let revolt;
            try {
                revolt = await this.getRevoltData(townId);
            } catch (error) {
                GMB.log('ForumTemplate', `Revolttijden konden niet worden opgehaald: ${error.message}`, 'warn');
                revolt = { start: 'geen', end: 'geen', attackers: [], found: false, error: error.message };
            }
            return {
                townId, town, name, ocean,
                wall: buildingLevel('wall'),
                tower: buildingLevel('tower') > 0,
                god,
                researches: [
                    researchValue('phalanx') ? 'Falanx' : '',
                    researchValue('ram') ? 'Stormram' : '',
                    researchValue('divine_selection') ? 'Goddelijke selectie' : ''
                ].filter(Boolean),
                units: await this.getTownUnits(town, townId),
                revolt
            };
        },

        getRevoltData: async function(townId) {
            const town = this.getTownModel(townId);
            const townName = String((typeof town.getName === 'function' ? town.getName() : town.name) || '');
            const response = await GMB_API.get('town_overviews', 'command_overview', {}, townId);
            const commands = GMB_Commands.normalizeCommands(response, { id: townId, name: townName });
            const revolts = commands.filter(command =>
                String(command.type).toLowerCase() === 'revolt' &&
                (Number(command.destination_town_id) === townId ||
                    String(command.destination_town_name || '').trim().toLocaleLowerCase() === townName.trim().toLocaleLowerCase())
            );
            const configuredDuration = Number(GMB.storage.get('forum_template_revolt_hours', 8));
            const durationMs = Math.min(48, Math.max(1, Number.isFinite(configuredDuration) ? configuredDuration : 8)) * 3600000;
            const toDate = value => {
                const timestamp = Number(value);
                if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
                const date = new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp);
                return Number.isFinite(date.getTime()) ? date : null;
            };
            const intervals = revolts.map(command => {
                const explicitEnd = toDate(command.revolt_end_at);
                if (explicitEnd) return { start: new Date(explicitEnd.getTime() - durationMs), end: explicitEnd };
                const start = toDate(command.revolt_start_at || command.arrival_at || command.arrival_time);
                return start ? { start, end: new Date(start.getTime() + durationMs) } : null;
            }).filter(Boolean).sort((a, b) => a.start - b.start);
            if (!intervals.length) return { start: 'geen', end: 'geen', attackers: [], found: false };

            const startTime = intervals[0].start;
            const endTime = intervals.reduce((latest, interval) => interval.end > latest ? interval.end : latest, intervals[0].end);
            const attackers = [...new Set(revolts.map(command =>
                command.origin_town_player_name || command.origin_town_name || 'Onbekend'
            ))];
            return {
                start: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                end: endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                attackers,
                found: true
            };
        },

        formatUnits: function(units) {
            const manager = GMB_TroopManager;
            const baseLandUnits = new Set(['sword', 'archer', 'hoplite', 'chariot']);
            const landTotal = [...baseLandUnits].reduce((total, unit) => total + (Number(units[unit]) || 0), 0);
            const uw = GMB_API.getUW();
            const other = Object.entries(units).filter(([unit, count]) =>
                Number(count) > 0 && !baseLandUnits.has(unit) &&
                ['sea', 'mythical'].includes(manager.classifyUnit(unit, uw))
            )
                .map(([unit, count]) => `${Number(count)} ${manager.getUnitLabel(unit, GMB_API.getUW())}`);
            if (!landTotal && !other.length) return { line: 'geen', landTotal: 0 };
            return { line: [landTotal ? `${landTotal} LT` : '', ...other].filter(Boolean).join(', '), landTotal };
        },

        formatHeroes: function(units) {
            const manager = GMB_TroopManager;
            const heroes = Object.entries(units).filter(([unit, count]) =>
                Number(count) > 0 && (
                    this.specialUnitKeys.has(unit) ||
                    GMB_API.getUW().GameData && GMB_API.getUW().GameData.heroes &&
                    Object.prototype.hasOwnProperty.call(GMB_API.getUW().GameData.heroes, unit)
                )
            ).map(([unit, count]) => `${manager.getUnitLabel(unit, GMB_API.getUW())} (${count})`);
            return heroes.length ? heroes.join(', ') : 'geen';
        },

        copyOutput: function(text) {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text, 'text');
                return Promise.resolve();
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
            return Promise.reject(new Error('Klembord niet beschikbaar; open de forum-editor om het template direct in te vullen'));
        },

        insertStaticTemplate: function(templateId, sourceElement = null) {
            const templates = {};
            const template = templates[templateId];
            if (!template) {
                GMB.notify(`Onbekende forumtemplate: ${templateId}`, { type: 'error' });
                return;
            }
            const textArea = this.getComposerField('#forum_post_textarea', sourceElement);
            const titleField = this.getComposerField('#forum_thread_name', sourceElement);
            if (!textArea) {
                GMB.notify('Forumtekstveld niet gevonden.', { type: 'error' });
                return;
            }
            this.setComposerValue(textArea, template.body);
            if (titleField && !titleField.value.trim()) {
                this.setComposerValue(titleField, template.title);
            }
            GMB.notify(`${template.title}-template in de forumeditor geplaatst.`, { type: 'success' });
        },

        buildDioDefense: function(facts) {
            const Home_url = 'https://dio-david1327.github.io';
            const townUrl = `https://gp${String(GMB.marketId || 'nl').toLowerCase()}.innogamescdn.com/images/game/main/`;
            const unitUrl = `${Home_url}/img/dio/logo/40/40px-`;
            const imgArray = {
                wall: `${townUrl}wall.png`,
                tower: `${townUrl}tower.png`,
                phalanx: `${unitUrl}phalanx.png`,
                ram: `${unitUrl}ram.png`,
                zeus: `${unitUrl}zeus.png`,
                hera: `${unitUrl}hera.png`,
                athena: `${unitUrl}athena.png`,
                poseidon: `${unitUrl}poseidon.png`,
                hades: `${unitUrl}hades.png`,
                artemis: `${unitUrl}artemis.png`,
                aphrodite: `${unitUrl}aphrodite.png`,
                ares: `${unitUrl}ares.png`,
                nogod: `${unitUrl}nogod.png`
            };
            const iconNames = {
                sword: 'sword', slinger: 'slinger', archer: 'archer', hoplite: 'hoplite',
                rider: 'rider', chariot: 'chariot', catapult: 'catapult', godsent: 'godsent',
                minotaur: 'minotaur', manticore: 'manticore', zyclop: 'zyclop', harpy: 'harpy',
                medusa: 'medusa', centaur: 'centaur', pegasus: 'pegasus', cerberus: 'cerberus',
                fury: 'fury', griffin: 'griffin', calydonian_boar: 'calydonian_boar',
                spartoi: 'spartoi', ladon: 'ladon', sea_monster: 'sea_monster', siren: 'siren',
                big_transporter: 'big_transporter', bireme: 'bireme', attack_ship: 'attack_ship',
                demolition_ship: 'demolition_ship', small_transporter: 'small_transporter',
                trireme: 'trireme', colonize_ship: 'colonize_ship'
            };
            const units = Object.entries(facts.units).filter(([unit, count]) => iconNames[unit] && Number(count) > 0);
            const unitImages = units.map(([unit]) => `[img]${unitUrl}${iconNames[unit]}.png[/img]`);
            const unitCounts = units.map(([, count]) => `[center]${Number(count)}[/center]`);
            const unitTable = units.length
                ? `[table][**]${unitImages.join('[||]')}[/**][**]${unitCounts.join('[||]')}[/**][/table]`
                : 'Geen eenheden gevonden.';
            const dataImages = [imgArray.wall, imgArray.tower, imgArray.phalanx, imgArray.ram];
            const dataValues = [
                facts.wall,
                facts.tower ? '✔️' : '❌',
                facts.researches.includes('Falanx') ? '✔️' : '❌',
                facts.researches.includes('Stormram') ? '✔️' : '❌'
            ];
            const godKey = /^(zeus|hera|athena|poseidon|hades|artemis|aphrodite|ares)$/i.test(facts.god) ? facts.god.toLowerCase() : 'nogod';
            const godIcon = `[img]${imgArray[godKey]}[/img]`;
            return `[color=#006B00][size=12][u][b]Verdedigingsoverzicht[/b][/u][/size][/color]\n\n[size=12][town]${facts.townId}[/town] (${GMB.playerId ? `[player]${GMB.playerId}[/player]` : 'Speler'})[/size]\n\n[i][b]Eenheden[/b][/i]\n${unitTable}\n\n[table][*]${dataImages.map(img => `[img]${img}[/img]`).join('[|]')}[|]${godIcon}[/*][**]${dataValues.map(value => `[center]${value}[/center]`).join('[||]')}[||][center]${facts.god}[/center][/**][/table]`;
        },

        generateDioDefense: async function(sourceElement = null) {
            try {
                const facts = await this.getTownFacts();
                const body = this.buildDioDefense(facts);
                const textArea = this.getComposerField('#forum_post_textarea', sourceElement);
                if (!textArea) {
                    await this.copyOutput(body);
                } else {
                    const cursor = Number.isInteger(textArea.selectionStart) ? textArea.selectionStart : textArea.value.length;
                    const end = Number.isInteger(textArea.selectionEnd) ? textArea.selectionEnd : cursor;
                    this.setComposerValue(textArea, `${textArea.value.slice(0, cursor)}${body}${textArea.value.slice(end)}`);
                }
                GMB.notify('DIO-stijl verdedigingsoverzicht ingevoegd.', { type: 'success' });
                return body;
            } catch (error) {
                GMB.log('ForumTemplate', `DIO-defense-formaat mislukt: ${error.message}`, 'error');
                GMB.notify(`DIO-defense-formaat mislukt: ${error.message}`, { type: 'error' });
                return null;
            }
        },

        buildTemplate: function(facts) {
            const os = this.formatUnits(facts.units);
            const osNeeded = facts.wall < 14 ? 'BIR' : 'LT';
            const revolt = facts.revolt;
            const attackerList = revolt.attackers.length ? revolt.attackers.join(', ') : 'Onbekend';
            const title = `${facts.ocean} | ${facts.name} | ${revolt.start} | ${osNeeded}`;
            const body = [
                `[*]nr[|]${facts.ocean}[|]${revolt.start}[|][town]${facts.townId}[/town][|]${facts.wall}[|]${facts.god}[|]${attackerList}[|]${osNeeded}[|]${os.line}[|]Note[/*]`,
                '',
                `Aangevallen stad: [town]${facts.townId}[/town]`,
                `God: ${facts.god}`,
                `Muur: ${facts.wall}`,
                `Toren: ${facts.tower ? 'ja' : 'nee'}`,
                `Ontwikkelingen: ${facts.researches.length ? facts.researches.join(', ') : 'geen'}`,
                `Helden: ${this.formatHeroes(facts.units)}`,
                '',
                `OS aanwezig: ${os.line}`,
                `OS nodig: ${osNeeded}`,
                '',
                'Stadsbescherming:',
                '',
                `Fase 2 begint om: ${revolt.start}`,
                `Fase 2 eindigt om: ${revolt.end}`,
                '',
                '[spoiler=Start F2 aanvallers]',
                ...revolt.attackers.map(attacker => `[player]${attacker}[/player]`),
                revolt.found ? '' : 'Geen opstandstijden gevonden in de command-overview.',
                '[/spoiler]',
                '',
                '[spoiler=Rapporten]',
                '*Opstandsrapport(ten)!!!*',
                '[/spoiler]'
            ].join('\n');
            return { title, body, osNeeded };
        },

        generateForCurrentTown: async function(sourceElement = null) {
            if (!GMB.isModuleEnabled('ForumTemplate')) {
                const button = document.getElementById('gmb-rood-template-button');
                if (button) button.remove();
                return null;
            }
            try {
                const facts = await this.getTownFacts();
                const { title, body, osNeeded } = this.buildTemplate(facts);
                const titleField = this.getComposerField('#forum_thread_name', sourceElement);
                const textArea = this.getComposerField('#forum_post_textarea', sourceElement);
                let copied = false;
                if (titleField) this.setComposerValue(titleField, title);
                if (textArea) this.setComposerValue(textArea, body);
                if (!titleField || !textArea) {
                    await this.copyOutput(`${title}\n\n${body}`);
                    copied = true;
                }
                const destination = titleField && textArea ? 'ingevuld' : 'gekopieerd';
                const message = facts.revolt.error
                    ? `Template ${destination} voor ${facts.name}, maar de revolttijden ontbreken: ${facts.revolt.error}`
                    : titleField && textArea
                        ? `ROOD-template ingevuld voor ${facts.name}; advies: ${osNeeded}.`
                        : `ROOD-template voor ${facts.name} ${copied ? 'gekopieerd' : 'gemaakt'}; advies: ${osNeeded}.`;
                GMB.notify(message, { type: facts.revolt.error ? 'warn' : 'success' });
                return { title, body, facts };
            } catch (error) {
                GMB.log('ForumTemplate', `ROOD-template maken mislukt: ${error.message}`, 'error');
                GMB.notify(`ROOD-template maken mislukt: ${error.message}`, { type: 'error' });
                return null;
            }
        }
    };

    const GMB_AbsenceAssistant = {
        editingId: null,
        running: false,

        init: function() {
            if (!GMB.isModuleEnabled('AbsenceAssistant')) return;
            GMB_UI.addTab('absence', '🕒 Afwezig', `
                <div class="gmb-section">
                    <div class="gmb-section-title">Afwezigheidsassistent</div>
                    <p class="gmb-muted">Meld afwezigheid lokaal op deze account en publiceer desgewenst een melding in het topic “Afwezig” van het alliantieforum.</p>
                    <label class="gmb-muted" for="gmb-absence-player">Speler</label>
                    <input class="gmb-input" id="gmb-absence-player" maxlength="40" autocomplete="off">
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <label class="gmb-muted">Van <input class="gmb-input" id="gmb-absence-from" type="date"></label>
                        <label class="gmb-muted">Tot <input class="gmb-input" id="gmb-absence-to" type="date"></label>
                        <label class="gmb-muted" style="display:flex;align-items:center;gap:6px"><input id="gmb-absence-vacation" type="checkbox"> Vakantiemodus</label>
                    </div>
                    <label class="gmb-muted" for="gmb-absence-reason">Opmerking</label>
                    <input class="gmb-input" id="gmb-absence-reason" maxlength="160" autocomplete="off">
                    <div style="display:flex;gap:8px;margin-top:8px">
                        ${GMB_UI.createButton('Afwezigheid opslaan', () => this.saveFromForm())}
                        ${GMB_UI.createButton('Formulier wissen', () => this.clearForm(), 'gmb-button-secondary')}
                    </div>
                    <div id="gmb-absence-status" class="gmb-muted" role="status" style="margin-top:8px"></div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Opgeslagen afwezigheden</div>
                    <div id="gmb-absence-list"></div>
                </div>
            `);
            const player = this.getElement('gmb-absence-player');
            if (player && !player.value) player.value = this.getCurrentPlayerName();
            const list = this.getElement('gmb-absence-list');
            if (list) {
                list.addEventListener('click', event => {
                    const button = event.target.closest('[data-absence-action]');
                    if (!button) return;
                    const id = button.dataset.absenceId;
                    if (button.dataset.absenceAction === 'edit') this.editRecord(id);
                    if (button.dataset.absenceAction === 'delete') this.deleteRecord(id);
                    if (button.dataset.absenceAction === 'publish') this.publishRecord(id);
                });
            }
            this.removeExpiredRecords();
            this.renderRecords();
        },

        onEnable: function() {
            this.init();
        },

        getElement: function(id) {
            return document.getElementById(id);
        },

        getCurrentPlayerName: function() {
            const uw = GMB_API.getUW();
            return String(uw && uw.Game && uw.Game.player_name || '').trim();
        },

        getRecordsByWorld: function() {
            const stored = GMB.storage.get('absence_records', {});
            return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        },

        getRecords: function() {
            const allRecords = this.getRecordsByWorld();
            const worldId = GMB.worldId || 'unknown';
            return Array.isArray(allRecords[worldId]) ? allRecords[worldId] : [];
        },

        storeRecords: function(records) {
            const allRecords = this.getRecordsByWorld();
            allRecords[GMB.worldId || 'unknown'] = records;
            if (!GMB.storage.set('absence_records', JSON.stringify(allRecords))) {
                throw new Error('Afwezigheden konden niet lokaal worden opgeslagen.');
            }
        },

        setStatus: function(message, type = 'info') {
            const status = this.getElement('gmb-absence-status');
            if (!status) return;
            status.textContent = message;
            status.style.color = type === 'error' ? '#ff8a80' : type === 'success' ? '#81c784' : '';
        },

        getFormValues: function() {
            const player = this.getElement('gmb-absence-player');
            const from = this.getElement('gmb-absence-from');
            const to = this.getElement('gmb-absence-to');
            const vacation = this.getElement('gmb-absence-vacation');
            const reason = this.getElement('gmb-absence-reason');
            if (!player || !from || !to || !vacation || !reason) throw new Error('Het afwezigheidsformulier is niet beschikbaar.');
            const record = {
                player: player.value.trim(),
                from: from.value,
                to: to.value,
                vacation: vacation.checked,
                reason: reason.value.trim()
            };
            if (!record.player || !record.from || !record.to) throw new Error('Speler, begindatum en einddatum zijn verplicht.');
            if (record.to < record.from) throw new Error('De einddatum mag niet vóór de begindatum liggen.');
            const isValidDate = value => {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
                const date = new Date(`${value}T00:00:00Z`);
                return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
            };
            if (!isValidDate(record.from) || !isValidDate(record.to)) throw new Error('Gebruik geldige datums.');
            return record;
        },

        saveFromForm: function() {
            try {
                const values = this.getFormValues();
                const records = this.getRecords();
                if (this.editingId) {
                    const index = records.findIndex(record => record.id === this.editingId);
                    if (index < 0) throw new Error('De te wijzigen melding bestaat niet meer.');
                    records[index] = { ...records[index], ...values };
                } else {
                    records.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...values, createdAt: new Date().toISOString(), postedAt: null });
                }
                this.storeRecords(records);
                this.clearForm();
                this.renderRecords();
                this.setStatus('Afwezigheid lokaal opgeslagen.', 'success');
            } catch (error) {
                this.setStatus(error.message, 'error');
                GMB.log('AbsenceAssistant', error.message, 'error');
            }
        },

        clearForm: function() {
            const from = this.getElement('gmb-absence-from');
            const to = this.getElement('gmb-absence-to');
            const vacation = this.getElement('gmb-absence-vacation');
            const reason = this.getElement('gmb-absence-reason');
            if (from) from.value = '';
            if (to) to.value = '';
            if (vacation) vacation.checked = false;
            if (reason) reason.value = '';
            this.editingId = null;
            const saveButton = Array.from(document.querySelectorAll('#gmb-tab-absence button')).find(button =>
                button.textContent.trim() === 'Afwezigheid opslaan' || button.textContent.trim() === 'Wijziging opslaan'
            );
            if (saveButton) saveButton.textContent = 'Afwezigheid opslaan';
        },

        editRecord: function(id) {
            const record = this.getRecords().find(item => item.id === id);
            if (!record) return this.setStatus('Afwezigheid niet gevonden.', 'error');
            this.editingId = id;
            this.getElement('gmb-absence-player').value = record.player;
            this.getElement('gmb-absence-from').value = record.from;
            this.getElement('gmb-absence-to').value = record.to;
            this.getElement('gmb-absence-vacation').checked = !!record.vacation;
            this.getElement('gmb-absence-reason').value = record.reason || '';
            const saveButton = Array.from(document.querySelectorAll('#gmb-tab-absence button')).find(button => button.textContent.trim() === 'Afwezigheid opslaan');
            if (saveButton) saveButton.textContent = 'Wijziging opslaan';
            this.setStatus('Melding geladen om te wijzigen.');
        },

        deleteRecord: function(id) {
            const record = this.getRecords().find(item => item.id === id);
            if (!record || !confirm(`Lokale afwezigheidsmelding van ${record.player} verwijderen?`)) return;
            this.storeRecords(this.getRecords().filter(item => item.id !== id));
            this.renderRecords();
            this.setStatus('Afwezigheidsmelding verwijderd.', 'success');
        },

        removeExpiredRecords: function() {
            const today = new Date();
            const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const current = this.getRecords();
            const active = current.filter(record => !record.to || record.to >= localToday);
            if (active.length !== current.length) {
                this.storeRecords(active);
                GMB.log('AbsenceAssistant', `${current.length - active.length} verlopen melding(en) lokaal opgeschoond.`);
            }
        },

        formatDate: function(value) {
            const [year, month, day] = value.split('-');
            return `${day}-${month}-${year}`;
        },

        renderRecords: function() {
            const container = this.getElement('gmb-absence-list');
            if (!container) return;
            const records = this.getRecords();
            container.replaceChildren();
            if (!records.length) {
                container.textContent = 'Geen actieve afwezigheidsmeldingen.';
                return;
            }
            const table = document.createElement('table');
            table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
            const head = document.createElement('thead');
            const headerRow = document.createElement('tr');
            ['Speler', 'Van', 'Tot', 'VM', 'Opmerking', 'Acties'].forEach(text => {
                const cell = document.createElement('th');
                cell.textContent = text;
                cell.style.cssText = 'text-align:left;padding:5px;border-bottom:1px solid #555;';
                headerRow.appendChild(cell);
            });
            head.appendChild(headerRow);
            table.appendChild(head);
            const body = document.createElement('tbody');
            records.forEach(record => {
                const row = document.createElement('tr');
                [record.player, this.formatDate(record.from), this.formatDate(record.to), record.vacation ? 'Ja' : 'Nee', record.reason || '-'].forEach(text => {
                    const cell = document.createElement('td');
                    cell.textContent = text;
                    cell.style.cssText = 'padding:5px;border-bottom:1px solid #444;';
                    row.appendChild(cell);
                });
                const actions = document.createElement('td');
                actions.style.cssText = 'padding:5px;white-space:nowrap;';
                actions.append(
                    this.createActionButton('Wijzig', 'edit', record.id),
                    this.createActionButton('Forum', 'publish', record.id, !!record.postedAt),
                    this.createActionButton('Verwijder', 'delete', record.id)
                );
                row.appendChild(actions);
                body.appendChild(row);
            });
            table.appendChild(body);
            container.appendChild(table);
        },

        createActionButton: function(label, action, id, disabled = false) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.dataset.absenceAction = action;
            button.dataset.absenceId = id;
            button.disabled = disabled;
            button.style.cssText = 'margin:0 3px 3px 0;padding:3px 6px;';
            return button;
        },

        makeForumRow: function(record) {
            const clean = value => String(value || '').replace(/[\[\]]/g, '').replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
            return `[*][player]${clean(record.player)}[/player][|]${this.formatDate(record.from)}[|]${this.formatDate(record.to)}[|]${record.vacation ? 'Ja' : 'Nee'}[|]${clean(record.reason) || '-'}[/*]\n`;
        },

        waitFor: function(selector, timeout = 12000) {
            return new Promise((resolve, reject) => {
                const started = Date.now();
                const check = () => {
                    const element = document.querySelector(selector);
                    if (element && element.getClientRects().length) return resolve(element);
                    if (Date.now() - started >= timeout) return reject(new Error(`Element niet gevonden: ${selector}`));
                    setTimeout(check, 150);
                };
                check();
            });
        },

        publishRecord: async function(id) {
            if (this.running) return;
            const record = this.getRecords().find(item => item.id === id);
            if (!record) return this.setStatus('Afwezigheidsmelding niet gevonden.', 'error');
            if (record.postedAt) return this.setStatus('Deze melding is al naar het forum gepubliceerd.');
            if (!confirm(`Plaats deze afwezigheidsmelding namens ${record.player} in het alliantieforumtopic “Afwezig”?`)) return;
            this.running = true;
            try {
                const forumButton = await this.waitFor('#ui_box > div.nui_main_menu > div.middle > div.content > ul > li.allianceforum.main_menu_item > span > span.name_wrapper > span');
                forumButton.click();
                await this.waitFor('#forum');
                const forumLink = Array.from(document.querySelectorAll('a.submenu_link[data-menu_name]')).find(link => {
                    const label = link.querySelector('span.forum_menu');
                    return label && label.textContent.trim().toLocaleLowerCase() === 'algemeen';
                });
                if (!forumLink) throw new Error('Forum “Algemeen” niet gevonden.');
                forumLink.click();
                await this.waitFor('#threadlist');
                const topicLink = await this.waitForCondition(() => Array.from(document.querySelectorAll('#threadlist > li > div.title_author_wrapper > div.title > a')).find(link =>
                    link.textContent.trim().toLocaleLowerCase() === 'afwezig'
                ), 10000);
                if (!topicLink) throw new Error('Topic “Afwezig” niet gevonden in “Algemeen”.');
                topicLink.click();
                await this.waitFor('#forum');
                const editButton = await this.waitForCondition(() => Array.from(document.querySelectorAll('#forum a, #forum button, #forum [role="button"]')).find(control => {
                    const label = [
                        control.textContent,
                        control.getAttribute('title'),
                        control.getAttribute('aria-label')
                    ].filter(Boolean).join(' ').toLocaleLowerCase();
                    const handler = String(control.getAttribute('onclick') || '').toLocaleLowerCase();
                    return /\b(bewerken|edit)\b/.test(label) || handler.includes('postedit');
                }), 10000);
                if (!editButton) throw new Error('Geen bewerkknop gevonden voor het topic “Afwezig”.');
                editButton.click();
                const textarea = await this.waitFor('#forum_post_textarea');
                const row = this.makeForumRow(record);
                if (textarea.value.includes(row.trim())) throw new Error('Deze afwezigheidsregel staat al in het forumtopic.');
                if (!textarea.value.includes('[/table]')) throw new Error('Het topic bevat geen afsluitende [/table]-tag; de bestaande inhoud is niet aangepast.');
                textarea.value = textarea.value.replace('[/table]', `${row}[/table]`);
                const view = textarea.ownerDocument && textarea.ownerDocument.defaultView || window;
                textarea.dispatchEvent(new view.Event('input', { bubbles: true }));
                textarea.dispatchEvent(new view.Event('change', { bubbles: true }));
                if (!confirm(`Controleer de melding in de forumeditor en bevestig publicatie voor ${record.player} (${this.formatDate(record.from)} t/m ${this.formatDate(record.to)}).`)) {
                    throw new Error('Publicatie geannuleerd; er is niets verzonden.');
                }
                const submit = await this.waitForCondition(() => Array.from(document.querySelectorAll(
                    '#post_save_form a, #post_save_form button, #post_save_form input[type="submit"], #post_save_form [role="button"], #forum a, #forum button, #forum input[type="submit"], #forum [role="button"]'
                )).find(control => {
                    const label = [
                        control.textContent,
                        control.value,
                        control.getAttribute('title'),
                        control.getAttribute('aria-label')
                    ].filter(Boolean).join(' ').toLocaleLowerCase();
                    return /\b(opslaan|save)\b/.test(label) && control.getClientRects().length > 0;
                }), 10000);
                if (!submit) throw new Error('Opslaanknop voor de forumwijziging niet gevonden.');
                submit.click();
                const editorClosed = await this.waitForCondition(() => {
                    const activeEditor = document.querySelector('#forum_post_textarea');
                    return !activeEditor || !activeEditor.getClientRects().length;
                }, 12000);
                if (!editorClosed) throw new Error('Het forum bevestigde niet dat de wijziging is opgeslagen; de melding blijft lokaal beschikbaar.');
                const records = this.getRecords();
                const index = records.findIndex(item => item.id === id);
                if (index >= 0) {
                    records[index] = { ...records[index], postedAt: new Date().toISOString() };
                    this.storeRecords(records);
                    this.renderRecords();
                }
                this.setStatus('Afwezigheidsmelding naar het forum verzonden.', 'success');
            } catch (error) {
                this.setStatus(error.message, 'error');
                GMB.log('AbsenceAssistant', `Forumpublicatie mislukt: ${error.message}`, 'error');
            } finally {
                this.running = false;
            }
        },

        waitForCondition: function(condition, timeout) {
            return new Promise((resolve, reject) => {
                const started = Date.now();
                const check = () => {
                    let result;
                    try {
                        result = condition();
                    } catch (error) {
                        reject(error);
                        return;
                    }
                    if (result) return resolve(result);
                    if (Date.now() - started >= timeout) return resolve(null);
                    setTimeout(check, 150);
                };
                check();
            });
        }
    };

    // ============================================================
    // ALLIANCE FORUM MANAGER
    // ============================================================

    const GMB_AllianceForum = {
        running: false,
        defaultPack: {
            fora: [
                { name: 'Algemeen', description: 'Algemene discussies', topics: [
                    { title: 'Welkom bij de alliantie', content: `Hallo strijders van de oude wereld!

We zijn ontzettend blij dat jullie hier zijn, op ons forum waar de goden en godinnen van de strategie samenkomen! Of je nu een doorgewinterde held bent of net je eerste stad hebt veroverd, hier is de plek waar we elkaar kunnen ontmoeten, tips kunnen uitwisselen en natuurlijk kunnen lachen om onze meest epische blunders (ja, we hebben allemaal wel eens een stad verloren aan een stelletje boze kippen).

Voordat je je zwaarden en schilden opbergt, willen we je vragen om jezelf even kort voor te stellen. Vertel ons wie je bent, waar je vandaan komt en wat je favoriete strategie is. En als je een hilarisch verhaal hebt over een mislukte aanval of een onverwachte alliantie, deel dat vooral! We zijn hier om elkaar te steunen, maar ook om samen te lachen.

Dus, trek je toga aan, neem een slok van je ambrosia en laat ons weten wie je bent! We kunnen niet wachten om je te leren kennen en samen de wereld van Grepolis te veroveren!

Met strijdlustige groet,

Het Grepolis Forum Team 🏛️✨` },
                    { title: 'Te volgen regels', content: `🏛️ Alliantie Reglement – Samen Sterk, Samen Onverslaanbaar! 🏛️
Welkom bij de alliantie! 🎉 We zijn hier niet alleen om een beetje rond te dobberen, maar om samen de vijand tot stof te reduceren. Dit reglement is geen bureaucratische onzin, maar een handleiding voor totale dominantie. Volg het, en we overleven. Negeer het, en de vijand lacht ons uit – en laten we eerlijk zijn, dat is gewoon gênant.

1️⃣ Afwezigheid – Niet Stiekem Verdwijnen!
Ga je langer dan 18 uur weg? Meld het op het forum. Laat ons ook weten of je de vakantiemodus aanzet.
Geen melding = automatisch IO voor clustersteden, en geloof ons, dat wil je niet.

👀 “Ik was even mijn kat zoeken” is geen excuus. We willen duidelijke communicatie.

2️⃣ Opstand ([color=#FF0000]Rood[/color]) – Alarmfase Rood!
Als je stad in opstand staat, panikeer niet (of doe dat stilletjes), maar maak een Rood-topic met de juiste informatie.

📢 Verlies je een stad zonder iets te zeggen? Dan zetten we je op de lijst voor een gratis IO-abonnement, geen tergmbetaling mogelijk.

Extra tip: Geef updates over muurstand, inkomende aanvallen en spreuken. We zijn goed, maar we kunnen helaas nog geen gedachten lezen.

3️⃣ Trips – Een Kleine Stap voor Jou, Een Grote Stap voor de Alliantie
Plaats altijd trips bij je eilandgenoten. Een trip is 3 def lt per stad.

💡 Denk eraan: geen trips plaatsen is als je huis openlaten voor inbrekers en zeggen: “Kom maar binnen, koffie staat klaar!”

Vernieuw gesneuvelde trips en plaats een rapport in het trips-topic op het def-forum.

4️⃣ Hulp Vragen & Elkaar Steunen – We Doen Dit Samen
Vraag op tijd om hulp. Het is geen schande om hulp te vragen, het is een schande om stil te zijn en dan keihard onderuit te gaan. Gebruik forum, Discord of PM.

Help! Mijn stad brandt! is trouwens een prima bericht. Sneller reageren we niet, maar het is wel dramatisch.

5️⃣ Reservaties – Geen Vage Claims, Gewoon Doen
Claim pas als je een kolo en een slotje hebt. Een claim is binnen 2 dagen overnemen, geen eindeloze bezetting van de stoel zoals een kleuter die niet van de schommel wil.

🔴 PRIO-steden? Dan tellen claims niet. Pak het, of de vijand doet het. Simpel.

6️⃣ Overzicht & Communicatie – Niet Raden, Gewoon Weten
Gebruik BB-codes of zorg dat iemand het voor je doet. Anders proberen we je bericht zu ontcijferen alsof het een oude schatkaart is.

🔍 Eilandcodes uit het Cluster Plan-topic gebruiken = dikke pluspunten.

7️⃣ Offensief – Oorlog met Stijl
🚫 Geen transportboten als aanval – tenzij je de vijand wilt laten lachen.
🎯 VS voor je LT-aanval timen = slim.
💥 Geen def lt of bir gebruiken bij aanvallen. Anders krijg je een cursus “Hoe val ik wél aan” gratis op het forum.

🌙 Nachtbonus? Alleen aanvallen op inactieve spelers, lege steden of als je écht durft.

8️⃣ TTA’s & Berichten – Reacties Zijn Belangrijker dan Je Ex
Antwoord op TTA’s, berichten en Discord @’s. Geen reactie? Dan nemen we aan dat je ondergedoken bent en nemen we je clustersteden voor je eigen veiligheid over.

Dus tenzij je graag een stadsloze kluizenaar wordt: reageren aub!

9️⃣ Steden & Collectieve Verplichtingen – Iedereen Doet Mee
Elke speler heeft minimaal 1 def lt-stad en 1 bir-stad.
📌 Cluster Plan volgen = essentieel. Overnemen pas na 1 stad per cluster eiland (inclusief rotsen, ja, ook die lelijke).

🔟 Rotsen & Gunstfarmen – Klein Maar Fijn
Heb je een rotsstad? Zorg dat je actief bent en alarm aanzet. Anders is die rots sneller weg dan een gratis biertje op een festival.

Gunst is belangrijk. Zonder gunst geen razende aanvallen. Zonder razende aanvallen? Nou ja, dan win je niet.

Waarom deze regels?
We zijn niet de alliantie van de vrije interpretatie. We zijn een goed geoliede machine die vijanden verslindt.
🚀 Duidelijke afspraken = een sterke alliantie = Winst.

Hou je eraan, dan maken we gehakt van de tegenstanders. Negeer ze? Dan krijg je een persoonlijke uitnodiging voor de IO van de Maand-competitie.

💪 SAMEN DOMINEREN WE!

Met strijdlustige groeten,
🔥 De Leiding 🔥` },
                    { title: 'Afwezig', content: `Laat hier weten als je er even tussenuit bent.

[table]
[**]Speler[||]Afwezig van[||]tem[||]VM[||]Opmerkingen[/**]
[*][|][|][|][|][/*]
[*][|][|][|][|][/*]
[*][|][|][|][|][/*]
[/table]
` },
                    { title: "Bondgenoten & NAP's", content: "Bondgenoten en NAP's worden hier besproken." },
                    { title: 'Spreuken en grondstoffen', content: 'Hier kunnen spelers om spreuken en grondstoffen vragen.' },
                    { title: 'Discord en scripts', content: `[b][u]Kom langs op onze discord server.[/u][/b]

[url]https://discord.gg/v53K97dD8a[/url]

[b][u]grepodata city-indexer[/u][/b]

[url]https://grepodata.com/invite/rhzuhr2n4yqwd7dhcc[/url]

[b][u]Forum ROOD template generator[/u][/b]

[url]https://greasyfork.org/nl/scripts/512594-grepolis-notepad-forum-template-3[/url]` }
                ]},
                { name: 'ROOD', description: 'Noodmeldingen en verdediging', topics: [
                    { title: 'Rood tabel', content: `Bij meer dan 5 aanvallen wordt de tabel actief.
[b][color=#FF0000]Bij een opstand éérst een eigen topic aanmaken in de juiste opmaak, [u]incl. tabelregel![/u][/color][/b]
Tabelregel:
[b][*]nr[|]OC[|]start F2[|]BB-code stad[|]muur[|]god[|]aanvaller(s)[|]BIR/LT[|]Aanwezige OS[|]Notes[/*][/b]
Vul de tabelregel in met de gegevens van jouw ROOD melding en plaats deze bovenaan in je topic.
muur -16 ➡️ alleen BIR sturen
                    muur +16 ➡️ alleen LT (landtroepen) sturen
                    Als de muur opgebouwd is én er geen reden op afbraak is, dan mag BIR omgezet worden naar LT.
                    ⚠️ Zet géén sterretje in de titel van je topic! Forum mods zetten een * in de titel als indicatie dat de melding is opgenomen in de ROOD tabel. Doe je dit zelf, komt je stad NIET in de tabel terecht.
                    [b]Mod van Dienst[/b]: [img]https://cdn.grcrt.net/emots2/girl_comp.gif[/img]
                    [player]joppie86[/player]
                    [table]
                    [**]Nr[||]OC[||]Start F2[||]BB-code stad[||]Muur[||]God[||]aanvaller(s)[||]BIR/LT[||]Aanwezig[||]Notes[/**]
                    [*][|][|][|][|][|][|][|][|][|][/*]
                    [/table]
                    [b][color=#FF2D2D][size=12]Dringend verzoek[/size]: Als je stad [b][u][size=12]safe[/size][/u][/b] is dit [u][size=12]melden[/size][/u] en de [u][size=12]OS terug sturen[/size][/u]! [/color][/b]` },
                    { title: 'Kolo snipe', content: `Beste strijders,
                    Aan alle [u]Kolo-spotters[/u],	 plaats in deze topic ASAP een bericht als je kolo hebt gespot.
                    meld je stadsnaam in BB en exacte tijd van aankomst kolo + tijd laatste aanval voor kolo.
                    Vb.:
                    [town]1[/town]
                    Kolo: 22:15:42
                    laatste voor kolo: 22:15:32
                    aan alle [u]Kolo-snipers[/u],
                    hou deze topic goed in de gaten voor kolo-spotters, zodat je vlug kan handelen indien er kolo is gespot.
                    [b]hoe timen:[/b]
                    zorg in je snipe steden voor:
                    * uiteraard BIR
                    * transportboot
                    * sirene
                    gebruik bij voorkeur je aanvalsplanner om je ondersteuning te timen:
                    poging 1: 1 tb + bir (min 50) check aankomsttijd en eventueel opnieuw proberen
                    poging 2: 60 BIR meerdere pogingen versturen kort na elkaar van 10 sec voor tot 10 sec na opstandtijd
                    poging 3: 1 sirene + Bir check aankomsttijd en eventueel opnieuw proberen
                    succes
` },
                    { title: 'Rood Template', content: `[*]nr[|]OC[|]start F2[|]aangevallen stad[|]muur[|]god[|]aanvallende speler[|]gewenste OS[|]aanwezig[|]Notes[/*]
                    Aangevallen stad:
                    God:
                    Muur:
                    Toren:
                    Held:
                    Ontwikkelingen:
                    OS aanwezig:
                    OS nodig:
                    Stadsbescherming:
                    Fase 2 begint om:
                    Fase 2 eindigt om:
                    [spoiler=Rapporten]
                    *Opstandsrapport(ten)!!!*
                    [/spoiler]
` }
                ]},
                { name: 'Deff', description: 'Verdedigingsstrategieën', topics: [
                    { title: 'Pre-deff', content: `Vraag hier je pre-deff aan voor belangrijke steden.

                    Pre-deff kan je krijgen op voorwaarde dat je muur 25 is en Toren.

                    hoe aanvragen:
                    stadsnaam: in BB
                    Muur Lv:
                    Toren:
                    aanwezige Lt:
` }
                ]},
                { name: 'Offens', description: 'Offensieve strategieën', topics: [
                    { title: 'OFF. | Template', content: `Titel
                    VB: Oceaan | Te veroveren stadsnaam | Status
                    VB: 55 | 55-01 | Opstand/ VS clear nodig

                    -------------------------------------------------------

                    Alliantie:
                    Speler:
                    Stad:

                    Gevraagde hulp: Spionage/ VS clear/ Zee clear

                    [spoiler=Recentste spionage][/spoiler]

                    [spoiler=Opstand aanval][/spoiler]
` },
                    { title: 'Opstand breken met Helena', content: `[b]Aan wie Helena bezit:[/b]
                Zorg dat Helena op Lv 20 is.
                meld hier in welke stad Helena zit.
                controleer hier regelmatig naar opstanden.

                [b]Aan wie opstand heeft:[/b]

                Laat hier onmiddellijk weten waar er opstand in een stad word gezet (zelfs indien je zeker bent van een opstand, nog voor die er is).

                stad: in BB
                F2 tijd:

                [table]
                [**]naam[||]lv[||]stad[||][/**]
                [*][|][|][|][/*]
                [/table]
` },
                    { title: 'Spionage rapporten', content: 'Hier kan je alle recente spionage rapporten bekijken.' }
                ]},
                { name: 'Massa_Aanval', description: 'Massa-aanvallen', topics: [
                    { title: 'Massa-aanvallen', content: 'Inhoud van Massa-aanvallen...' }
                ]},
                { name: 'Interne_Overnames', description: 'Interne overnames', topics: [
                    { title: 'Interne overnames', content: 'Inhoud van Interne overnames...' }
                ]},
                { name: 'Cluster', description: 'Clusterbeheer', topics: [
                    { title: 'Clusterbeheer', content: 'Inhoud van Clusterbeheer...' }
                ]},
                { name: 'Kroeg', description: 'Informele discussies', topics: [
                    { title: 'Kroegpraat', content: 'Inhoud van Kroegpraat...' }
                ]},
                { name: 'Leiding', description: 'Leidinggevenden', topics: [
                    { title: 'Leidinggevenden', content: 'Inhoud van Leidinggevenden...' }
                ]}
            ]
        },

        init: function() {
            GMB_UI.addTab('alliance-forum', '🏛 Forum', `
                <div class="gmb-section">
                    <div class="gmb-section-title">Alliantieforum-pakket</div>
                    <label class="gmb-muted" for="gmb-alliance-forum-type">Wereldtype</label>
                    <select class="gmb-select" id="gmb-alliance-forum-type">
                        <option value="revolt">Opstandwereld</option>
                        <option value="siege">Belegeringswereld</option>
                    </select>
                    <p class="gmb-muted">Kies het wereldtype handmatig; GMB detecteert dit niet automatisch. Aanmaak vereist een aparte bevestiging.</p>
                    <textarea class="gmb-input" id="gmb-alliance-forum-pack" spellcheck="false" style="min-height:280px"></textarea>
                    <div style="display:flex;gap:8px;margin-top:8px">
                        ${GMB_UI.createButton('Pakket opslaan', () => this.savePack())}
                        ${GMB_UI.createButton('Fora en topics aanmaken', () => this.confirmCreation(), 'gmb-button-secondary')}
                    </div>
                    <div class="gmb-muted" id="gmb-alliance-forum-status" role="status" style="margin-top:10px"></div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Veilig gebruik</div>
                    <p class="gmb-muted">Bestaande fora en topics worden overgeslagen. Aanmaken vereist forumbeheerdersrechten. Laat deze tab open tijdens de uitvoering.</p>
                </div>
            `);
            const editor = document.getElementById('gmb-alliance-forum-pack');
            const selector = document.getElementById('gmb-alliance-forum-type');
            if (editor && selector) {
                const selectedType = this.getSelectedPackType();
                selector.value = selectedType;
                const selectedPack = this.loadPack(selectedType);
                editor.value = JSON.stringify(selectedPack, null, 2);
                selector.addEventListener('change', () => {
                    const previousType = GMB.storage.get('alliance_forum_selected_pack', 'revolt');
                    if (!this.savePack(previousType, false)) {
                        selector.value = previousType;
                        return;
                    }
                    GMB.storage.set('alliance_forum_selected_pack', selector.value);
                    const nextPack = this.loadPack(selector.value);
                    editor.value = JSON.stringify(nextPack, null, 2);
                    this.setStatus(`Pakket geladen: ${selector.options[selector.selectedIndex].text}.`);
                });
            }
        },

        getSelectedPackType: function() {
            return GMB.storage.get('alliance_forum_selected_pack', 'revolt') === 'siege' ? 'siege' : 'revolt';
        },

        getDefaultPack: function(packType) {
            if (packType !== 'siege') return JSON.parse(JSON.stringify(this.defaultPack));
            const pack = JSON.parse(JSON.stringify(this.defaultPack));
            const forum = pack.fora.find(item => item.name === 'ROOD');
            forum.name = 'BELEGERING';
            forum.description = 'Belegeringen, stadsverdediging en ondersteuning';
            const replaceTopic = (oldTitle, title, content) => {
                const topic = forum.topics.find(item => item.title === oldTitle);
                topic.title = title;
                topic.content = content;
            };
            replaceTopic('Rood tabel', 'Belegeringsoverzicht', `Gebruik dit overzicht voor actieve belegeringen en hulpvragen.
Maak voor elke belegerde stad een eigen topic met de template en houd de status actueel.

[b][*]nr[|]OC[|]stad[|]eigenaar[|]aanvaller(s)[|]belegeringsstatus/tijd[|]gevraagde OS[|]aanwezige OS[|]opmerkingen[/*][/b]

[table]
[**]Nr[||]OC[||]Stad[||]Eigenaar[||]Aanvaller(s)[||]Status/tijd[||]Gevraagd[||]Aanwezig[||]Opmerkingen[/**]
[*][|][|][|][|][|][|][|][|][/*]
[/table]

Vermeld de fase en resterende tijd zoals die in het spel worden weergegeven. Werk wijzigingen en aankomsttijden bij in het stadstopic.
Als de stad veilig is, meld dit dan en stem af wanneer ondersteunende troepen terug kunnen.`);
            replaceTopic('Kolo snipe', 'Kolonisatieschip spotten en snipen', `Beste strijders,

Aan alle [u]Kolo-spotters[/u]: plaats hier zo snel mogelijk een melding wanneer je een kolonisatieschip hebt gespot.
Vermeld de stadsnaam in BB-code, de exacte aankomsttijd en de tijd van de laatste aanval vóór de kolo.

Voorbeeld:
[town]1[/town]
Kolo aankomst: 22:15:42
Laatste aanval vóór kolo: 22:15:32

Aan alle [u]Kolo-snipers[/u]: houd dit topic in de gaten en stem ondersteuning af op de aankomsttijd.
Controleer de aankomst in de aanvalsplanner en gebruik de spelinformatie voor het juiste moment.

Succes!`);
            replaceTopic('Rood Template', 'Belegering Template', `[b]Belegeringsmelding[/b]

Stad: [town]stad-ID[/town]
Oceaan / coördinaten:
Huidige eigenaar:
Aanvallende speler(s):
Belegeringsstatus / fase:
Resterende tijd (volgens het spel):
Muur:
Toren:
God / held:
Aanwezige verdediging:
Gevraagde ondersteuning:
Inkomende aanvallen / aankomsttijden:
Laatste update:

[spoiler=Rapporten]
Plaats hier relevante gevechts- en belegeringsrapporten.
[/spoiler]

Werk dit topic bij zodra de status, benodigde verdediging of aankomsttijden veranderen.`);

            const general = pack.fora.find(item => item.name === 'Algemeen');
            general.topics.find(item => item.title === 'Te volgen regels').content = `[b]Alliantieafspraken — belegeringswereld[/b]

1. [b]Afwezigheid[/b]
Meld langere afwezigheid tijdig op het forum en vermeld of je vakantiemodus gebruikt.

2. [b]Belegeringen en stadsverdediging[/b]
Meld een bedreigde of belegerde stad direct in het forumonderdeel [b]BELEGERING[/b]. Gebruik één topic per stad, plaats de actuele spelstatus en werk de benodigde en aanwezige ondersteuning bij.

3. [b]Ondersteuning[/b]
Stem ondersteuning en eventuele terugkeer af in het stadstopic. Meld wanneer de stad veilig is en stuur ondersteuning niet terug zonder afstemming wanneer de dreiging nog loopt.

4. [b]Trips en eilandverdediging[/b]
Volg de afspraken voor trips op je eiland. Vernieuw verloren verdediging en deel relevante rapporten in het afgesproken verdedigingstopic.

5. [b]Hulp vragen[/b]
Vraag tijdig hulp via het forum, Discord of een persoonlijk bericht. Vermeld stad, tijd, status en concreet welke hulp nodig is.

6. [b]Steden overnemen en claims[/b]
Volg de alliantieafspraken voor claims en interne overnames. Stem een overname af voordat je handelt en houd de afgesproken planning aan.

7. [b]Aanvallen en coördinatie[/b]
Gebruik het OFF-topic voor aanvallen. Vermeld doel, timing, gewenste hulp en relevante rapporten; stem aanvallen af met de leiding.

8. [b]Communicatie[/b]
Reageer op TTA's en berichten. Gebruik BB-codes en de afgesproken eiland- en clustercodes zodat meldingen snel herkenbaar zijn.

9. [b]Stadsrollen en alliantieplanning[/b]
Volg de afspraken voor stadsverdeling, clusters en verdediging. Meld wijzigingen die invloed hebben op de gezamenlijke planning.

10. [b]Rotsen en gunst[/b]
Houd rotssteden actief en volg de alliantieafspraken voor alarmen en gunst.

[b]Duidelijke meldingen en onderlinge afstemming houden de alliantie sterk. Bedankt voor jullie inzet![/b]`;

            const offens = pack.fora.find(item => item.name === 'Offens');
            offens.topics.find(item => item.title === 'OFF. | Template').content = `Titel
                    VB: Oceaan | Te veroveren stadsnaam | Status
                    VB: 55 | 55-01 | Belegering opzetten / VS clear nodig

                    -------------------------------------------------------

                    Alliantie:
                    Speler:
                    Stad:
                    Gewenste timing:

                    Gevraagde hulp: Spionage / VS clear / Zee clear / ondersteuning

                    [spoiler=Recentste spionage][/spoiler]

                    [spoiler=Aanvals- en belegeringsrapporten][/spoiler]
`;

            const siegeCoordination = offens.topics.find(item => item.title === 'Opstand breken met Helena');
            siegeCoordination.title = 'Belegering opvolgen';
            siegeCoordination.content = `Gebruik dit topic om belegeringen en de bijbehorende ondersteuning op te volgen.

Vermeld per melding:
- Stad in BB-code
- Eigenaar en aanvallende speler(s)
- Belegeringsstatus/fase en resterende tijd zoals getoond in het spel
- Aanwezige verdediging en gevraagde ondersteuning
- Aankomsttijden van relevante aanvallen en ondersteuning

[table]
[**]OC[||]Stad[||]Status/fase[||]Resterende tijd[||]Aanwezig[||]Gevraagd[||]Update[/**]
[*][|][|][|][|][|][|][/*]
[/table]

Werk de melding bij na elke relevante wijziging en meld wanneer de stad veilig is.
`;
            return pack;
        },

        loadPack: function(packType = this.getSelectedPackType()) {
            const normalizedType = packType === 'siege' ? 'siege' : 'revolt';
            let packs = GMB.storage.get('alliance_forum_packs', null);
            try {
                if (typeof packs === 'string') packs = JSON.parse(packs);
                if (!packs || typeof packs !== 'object') {
                    let revoltPack = GMB.storage.get('alliance_forum_pack', null);
                    if (typeof revoltPack === 'string') revoltPack = JSON.parse(revoltPack);
                    packs = {
                        revolt: revoltPack || this.getDefaultPack('revolt'),
                        siege: this.getDefaultPack('siege')
                    };
                }
                if (!packs.revolt) packs.revolt = this.getDefaultPack('revolt');
                if (!packs.siege) packs.siege = this.getDefaultPack('siege');
                if (GMB.storage.get('alliance_forum_pack_version', 0) < 2) {
                    this.migrateDefaultContent(packs.revolt);
                    GMB.storage.set('alliance_forum_pack_version', 2);
                }
                GMB.storage.set('alliance_forum_packs', JSON.stringify(packs));
                return packs[normalizedType];
            } catch (error) {
                GMB.log('AllianceForum', `Opgeslagen forumpakket is ongeldig: ${error.message}`, 'error');
                return this.getDefaultPack(normalizedType);
            }
        },

        migrateDefaultContent: function(pack) {
            const oldContent = {
                Algemeen: {
                    'Welkom bij de alliantie': 'Welkom! Stel jezelf hier voor en deel tips en ervaringen.',
                    'Te volgen regels': 'Plaats hier de afspraken en regels van de alliantie.',
                    Afwezig: 'Meld hier je afwezigheid, periode en eventuele vakantiemodus.',
                    "Bondgenoten & NAP's": "Bespreek hier bondgenoten en NAP's.",
                    'Spreuken en grondstoffen': 'Vraag of bied hier spreuken en grondstoffen aan.',
                    'Discord en scripts': 'Deel hier alliantiekanalen, handige links en scripts.'
                },
                ROOD: {
                    'Rood tabel': 'Plaats ROOD-meldingen volgens de afgesproken alliantie-opmaak.',
                    'Kolo snipe': 'Meld hier een gespotte kolo, de aankomsttijd en de laatste aanval ervoor.',
                    'Rood Template': 'Gebruik de [ROOD]-knop in de forumeditor om een melding op te stellen.'
                },
                Deff: {
                    'Pre-deff': 'Vraag hier pre-deff aan. Vermeld de stad, muur, toren en aanwezige landtroepen.'
                },
                Offens: {
                    'OFF. | Template': 'Vermeld alliantie, speler, stad en gevraagde hulp. Voeg relevante rapporten toe.',
                    'Opstand breken met Helena': 'Meld hier waar Helena staat of waar een opstand wordt verwacht.',
                    'Spionage rapporten': 'Deel hier recente spionagerapporten.'
                },
                Massa_Aanval: { 'Massa-aanvallen': 'Coördineer hier gezamenlijke aanvallen.' },
                Interne_Overnames: { 'Interne overnames': 'Bespreek en coördineer hier interne overnames.' },
                Cluster: { Clusterbeheer: 'Deel hier clusterplannen en afspraken.' },
                Kroeg: { Kroegpraat: 'Informele gesprekken zijn hier welkom.' },
                Leiding: { Leidinggevenden: 'Interne afstemming voor de alliantieleiding.' }
            };
            if (!pack || !Array.isArray(pack.fora)) return;
            for (const forum of pack.fora) {
                const defaults = this.defaultPack.fora.find(item => item.name.toLocaleLowerCase() === String(forum.name).toLocaleLowerCase());
                const legacy = oldContent[forum.name];
                if (!defaults || !Array.isArray(forum.topics) || !legacy) continue;
                for (const topic of forum.topics) {
                    const defaultTopic = defaults.topics.find(item => item.title.toLocaleLowerCase() === String(topic.title).toLocaleLowerCase());
                    if (defaultTopic && legacy[topic.title] === topic.content) topic.content = defaultTopic.content;
                }
            }
        },

        parsePack: function() {
            const editor = document.getElementById('gmb-alliance-forum-pack');
            if (!editor) throw new Error('Forumpakket-editor is niet beschikbaar.');
            let pack;
            try {
                pack = JSON.parse(editor.value);
            } catch (error) {
                throw new Error(`Ongeldige JSON: ${error.message}`);
            }
            if (!pack || !Array.isArray(pack.fora) || pack.fora.length === 0) {
                throw new Error('Het pakket moet een niet-lege array "fora" bevatten.');
            }
            const forumNames = new Set();
            for (const forum of pack.fora) {
                if (!forum || typeof forum.name !== 'string' || !forum.name.trim() || typeof forum.description !== 'string') {
                    throw new Error('Elk forum moet een naam en beschrijving bevatten.');
                }
                const key = forum.name.trim().toLocaleLowerCase();
                if (forumNames.has(key)) throw new Error(`Dubbele forumnaam: ${forum.name}`);
                forumNames.add(key);
                if (!Array.isArray(forum.topics)) throw new Error(`Forum "${forum.name}" mist de topics-array.`);
                const topicTitles = new Set();
                for (const topic of forum.topics) {
                    if (!topic || typeof topic.title !== 'string' || !topic.title.trim() || typeof topic.content !== 'string') {
                        throw new Error(`Elk topic in "${forum.name}" moet een titel en inhoud bevatten.`);
                    }
                    const topicKey = topic.title.trim().toLocaleLowerCase();
                    if (topicTitles.has(topicKey)) throw new Error(`Dubbele topictitel in "${forum.name}": ${topic.title}`);
                    topicTitles.add(topicKey);
                }
            }
            return pack;
        },

        savePack: function(packType = this.getSelectedPackType(), showFeedback = true) {
            try {
                const pack = this.parsePack();
                const normalizedType = packType === 'siege' ? 'siege' : 'revolt';
                const packs = GMB.storage.get('alliance_forum_packs', {});
                const editor = document.getElementById('gmb-alliance-forum-pack');
                if (editor) editor.value = JSON.stringify(pack, null, 2);
                packs[normalizedType] = pack;
                GMB.storage.set('alliance_forum_packs', JSON.stringify(packs));
                GMB.storage.set('alliance_forum_selected_pack', normalizedType);
                if (showFeedback) {
                    const typeLabel = normalizedType === 'siege' ? 'Belegeringswereld' : 'Opstandwereld';
                    this.setStatus(`${typeLabel}-pakket opgeslagen: ${pack.fora.length} fora, ${pack.fora.reduce((sum, forum) => sum + forum.topics.length, 0)} topics.`);
                    GMB_UI.toast(`${typeLabel}-pakket opgeslagen.`, 'success');
                }
                return true;
            } catch (error) {
                this.setStatus(error.message, 'error');
                GMB_UI.toast(error.message, 'error');
                return false;
            }
        },

        confirmCreation: async function() {
            if (this.running) return;
            if (!this.savePack()) return;
            const packType = this.getSelectedPackType();
            const pack = this.loadPack(packType);
            const topicCount = pack.fora.reduce((sum, forum) => sum + forum.topics.length, 0);
            const typeLabel = packType === 'siege' ? 'Belegeringswereld' : 'Opstandwereld';
            if (!confirm(`${typeLabel}: GMB controleert ${pack.fora.length} fora en ${topicCount} topics en maakt alleen ontbrekende onderdelen aan. Doorgaan?`)) return;
            this.running = true;
            const status = document.getElementById('gmb-alliance-forum-status');
            if (status) status.textContent = '';
            const button = Array.from(document.querySelectorAll('#gmb-tab-alliance-forum button[data-btn-id]'))
                .find(item => item.textContent.trim() === 'Fora en topics aanmaken');
            if (button) button.disabled = true;
            try {
                await this.createAllForaAndTopics(pack);
            } catch (error) {
                this.report(`Gestopt: ${error.message}`, 'error');
                GMB.log('AllianceForum', `Aanmaak afgebroken: ${error.message}`, 'error');
            } finally {
                this.running = false;
                if (button) button.disabled = false;
            }
        },

        createAllForaAndTopics: async function(pack) {
            if (!document.querySelector('#ui_box') || !document.querySelector('#ui_box .allianceforum')) {
                throw new Error('Open eerst het Grepolis-spel op een stadspagina; het alliantieforum is hier niet beschikbaar.');
            }
            this.report('Alliantieforum openen…');
            await this.navigateToAllianceForum();

            for (const forum of pack.fora) {
                if (this.forumExists(forum.name)) {
                    this.report(`Forum bestaat al: ${forum.name}`);
                    continue;
                }
                this.report(`Forum aanmaken: ${forum.name}`);
                await this.openForumAdmin();
                await this.createForum(forum);
                await this.closeDialog();
                await this.navigateToAllianceForum();
                await this.waitForCondition(() => this.forumExists(forum.name), 15000, `Forum "${forum.name}" is na aanmaak niet zichtbaar.`);
                this.report(`Forum aangemaakt: ${forum.name}`, 'success');
            }

            for (const forum of pack.fora) {
                await this.navigateToForum(forum.name);
                for (const topic of forum.topics) {
                    if (this.topicExists(topic.title)) {
                        this.report(`Topic bestaat al: ${forum.name} / ${topic.title}`);
                        continue;
                    }
                    await this.createTopic(topic);
                    await this.navigateToForum(forum.name);
                    const visible = await this.waitForCondition(() => this.topicExists(topic.title), 10000);
                    this.report(
                        visible
                            ? `Topic aangemaakt: ${forum.name} / ${topic.title}`
                            : `Topic ingediend, maar nog niet zichtbaar in de lijst: ${forum.name} / ${topic.title}`,
                        visible ? 'success' : 'warn'
                    );
                }
            }
            this.report('Alle fora en topics zijn gecontroleerd.', 'success');
        },

        navigateToAllianceForum: async function() {
            const forumButton = await this.waitForElement('#ui_box > div.nui_main_menu > div.middle > div.content > ul > li.allianceforum.main_menu_item > span > span.name_wrapper > span', 15000);
            forumButton.click();
            await this.waitForElement('#forum', 15000);
            await this.waitForElement('.forum_menu', 15000);
        },

        navigateToForum: async function(forumName) {
            const link = Array.from(document.querySelectorAll('a.submenu_link[data-menu_name]')).find(item => {
                const label = item.querySelector('span.forum_menu');
                return label && label.textContent.trim().toLocaleLowerCase() === forumName.toLocaleLowerCase();
            });
            if (!link) throw new Error(`Forum "${forumName}" ontbreekt in het forumoverzicht.`);
            link.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
            await this.waitForElement('#forum_buttons', 15000);
        },

        forumExists: function(forumName) {
            return Array.from(document.querySelectorAll('a.submenu_link[data-menu_name]')).some(link => {
                const label = link.querySelector('span.forum_menu');
                return label && label.textContent.trim().toLocaleLowerCase() === forumName.toLocaleLowerCase();
            });
        },

        topicExists: function(title) {
            return Array.from(document.querySelectorAll('.forum_thread_title')).some(item =>
                item.textContent.trim().toLocaleLowerCase() === title.toLocaleLowerCase()
            );
        },

        openForumAdmin: async function() {
            const button = await this.waitForElement('#forum > div.game_list_footer > div.forum_footer > a', 15000);
            button.click();
            await this.waitForElement('#forum_admin', 15000);
        },

        createForum: async function(forum) {
            const addButton = await this.waitForElement('#forum_admin > div.game_list_footer > a > span.left > span > span', 15000);
            addButton.click();
            const name = await this.waitForElement('#forum_forum_name', 15000);
            const description = await this.waitForElement('#forum_forum_content', 15000);
            this.setField(name, forum.name);
            this.setField(description, forum.description);
            const confirmButton = await this.waitForElement('#create_forum_confirm > span.left > span > span', 15000);
            confirmButton.click();
            await new Promise(resolve => setTimeout(resolve, 1500));
        },

        createTopic: async function(topic) {
            const addButton = await this.waitForElement('#forum_buttons > a:nth-child(1) > span.left > span > span', 15000);
            addButton.click();
            const title = await this.waitForElement('#forum_thread_name', 15000);
            const content = await this.waitForElement('#forum_post_textarea', 15000);
            this.setField(title, topic.title);
            this.setField(content, topic.content);
            const confirmButton = await this.waitForElement('#forum > div.game_footer > a > span.left > span > span', 15000);
            confirmButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
        },

        closeDialog: async function() {
            const dialog = document.querySelector('body > div.ui-dialog.ui-front');
            const closeButton = dialog && dialog.querySelector('.ui-dialog-titlebar-close');
            if (!closeButton) throw new Error('Het forumbeheervenster kan niet veilig worden gesloten.');
            closeButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
        },

        setField: function(field, value) {
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        },

        waitForElement: function(selector, timeout) {
            return new Promise((resolve, reject) => {
                const started = Date.now();
                const check = () => {
                    const element = document.querySelector(selector);
                    if (element) return resolve(element);
                    if (Date.now() - started >= timeout) return reject(new Error(`Element niet gevonden: ${selector}`));
                    setTimeout(check, 150);
                };
                check();
            });
        },

        waitForCondition: function(condition, timeout, errorMessage = null) {
            return new Promise((resolve, reject) => {
                const started = Date.now();
                const check = () => {
                    if (condition()) return resolve(true);
                    if (Date.now() - started >= timeout) {
                        return errorMessage ? reject(new Error(errorMessage)) : resolve(false);
                    }
                    setTimeout(check, 200);
                };
                check();
            });
        },

        setStatus: function(message, type = 'info') {
            const status = document.getElementById('gmb-alliance-forum-status');
            if (status) {
                status.textContent = message;
                status.style.color = type === 'error' ? '#ff8a80' : type === 'success' ? '#81c784' : '';
            }
        },

        report: function(message, type = 'info') {
            const status = document.getElementById('gmb-alliance-forum-status');
            if (status) {
                const line = document.createElement('div');
                line.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
                line.style.color = type === 'error' ? '#ff8a80' : type === 'success' ? '#81c784' : '';
                status.appendChild(line);
                status.scrollTop = status.scrollHeight;
            }
            GMB.log('AllianceForum', message, type);
        },

    };

    const GMB_ForumLayout = {
        observer: null,
        resizeHandler: null,

        init: function() {
            this.installStyles();
            this.applyMultiRowTabs();
            if (document.body && typeof MutationObserver === 'function') {
                this.observer = new MutationObserver(() => this.applyMultiRowTabs());
                this.observer.observe(document.body, { childList: true, subtree: true });
            }
            this.resizeHandler = () => this.applyMultiRowTabs();
            window.addEventListener('resize', this.resizeHandler);
        },

        installStyles: function() {
            if (document.getElementById('gmb-forum-layout-style')) return;
            const style = document.createElement('style');
            style.id = 'gmb-forum-layout-style';
            style.textContent = `
                .gmb-forum-multiline-tabs .gmb-forum-tabs-viewport {
                    height: calc(var(--gmb-forum-tab-row-height, 22px) * var(--gmb-forum-tab-rows, 1)) !important;
                    max-height: none !important;
                    overflow: visible !important;
                    width: 100% !important;
                }
                .gmb-forum-multiline-tabs .gmb-forum-tabs-list {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    align-content: flex-start !important;
                    position: relative !important;
                    right: auto !important;
                    width: 100% !important;
                    height: auto !important;
                }
                .gmb-forum-multiline-tabs .gmb-forum-tabs-list > li {
                    float: none !important;
                    flex: 0 0 auto !important;
                }
                .gmb-forum-multiline-tabs a.next,
                .gmb-forum-multiline-tabs a.prev,
                .gmb-forum-multiline-tabs .fade_left,
                .gmb-forum-multiline-tabs .fade_right {
                    display: none !important;
                }
                .gmb-forum-popup-tabs .gpwindow_frame > .gpwindow_content {
                    top: calc(var(--gmb-forum-base-content-top, 44px) + var(--gmb-forum-content-offset, 0px)) !important;
                }
            `;
            document.head.appendChild(style);
        },

        applyMultiRowTabs: function() {
            const tabLists = [];
            document.querySelectorAll('.gpwindow').forEach(popup => {
                const viewport = popup.querySelector('.menu_wrapper.minimize.menu_wrapper_scroll');
                const list = viewport && viewport.querySelector('ul.menu_inner');
                if (list && popup.querySelector('.forum_content')) {
                    tabLists.push({ host: popup, viewport, list, isPopup: true });
                }
            });

            const forumRoot = document.querySelector('#forum');
            if (forumRoot) {
                const link = forumRoot.querySelector('a.submenu_link[data-menu_name]');
                const list = link && link.closest('ul');
                if (list && !tabLists.some(item => item.list === list)) {
                    tabLists.push({ host: forumRoot, viewport: list.parentElement, list, isPopup: false });
                }
            }

            tabLists.forEach(({ host, viewport, list, isPopup }) => {
                if (!viewport) return;
                host.classList.add('gmb-forum-multiline-tabs');
                if (isPopup) host.classList.add('gmb-forum-popup-tabs');
                viewport.classList.add('gmb-forum-tabs-viewport');
                list.classList.add('gmb-forum-tabs-list');
                const content = isPopup && host.querySelector('.gpwindow_frame > .gpwindow_content');
                if (content && !host.style.getPropertyValue('--gmb-forum-base-content-top')) {
                    const currentTop = Number.parseFloat(window.getComputedStyle(content).top);
                    host.style.setProperty('--gmb-forum-base-content-top', `${Number.isFinite(currentTop) ? currentTop : 44}px`);
                }
                requestAnimationFrame(() => this.updateTabRows(host, viewport, list, isPopup));
            });
        },

        updateTabRows: function(host, viewport, list, isPopup) {
            if (!host.isConnected || !list.isConnected) return;
            const items = Array.from(list.children).filter(item => item.getClientRects().length);
            const rowTops = new Set(items.map(item => Math.round(item.getBoundingClientRect().top)));
            const rows = Math.max(1, rowTops.size);
            const rowHeight = items.reduce((height, item) => Math.max(height, item.getBoundingClientRect().height), 0) ||
                viewport.getBoundingClientRect().height || 22;
            host.style.setProperty('--gmb-forum-tab-rows', String(rows));
            host.style.setProperty('--gmb-forum-tab-row-height', `${rowHeight}px`);
            if (isPopup) host.style.setProperty('--gmb-forum-content-offset', `${Math.max(0, rows - 1) * rowHeight}px`);
        }
    };

    // ============================================================
    // MODEL MANAGERS (Spelers, Steden, Militair, Onderzoek & Speciaal)
    // Read-only viewers over Grepolis' MM.getModels()-collecties.
    // ============================================================

    const GMB_ModelManagers = {
        gameOnly: true,
        maxRows: 25,
        lastData: {},
        groups: [
            {
                tabId: 'mgr-players', title: '👥 Spelers & Allianties', heading: 'Spelers, allianties en ranglijsten',
                models: [
                    ['Player', 'Spelersgegevens'],
                    ['PlayerRanking', 'Rangschikking van spelers'],
                    ['PlayerKillpoints', 'Killpunten van spelers'],
                    ['PlayerGods', 'Goden die aan een speler gekoppeld zijn'],
                    ['PlayerAward', 'Speleronderscheidingen'],
                    ['AlliancePact', 'Alliantiepacten of diplomatieke relaties'],
                    ['PlayerSettings', 'Instellingen van de speler'],
                    ['PlayerLedger', 'Administratieve of statistische gegevens van een speler']
                ]
            },
            {
                tabId: 'mgr-towns', title: '🏙 Steden & Grondstoffen', heading: 'Steden, gebouwen en grondstoffen',
                models: [
                    ['Town', 'Steden, mogelijk inclusief eigenaar en locatie'],
                    ['TownIdList', "Lijst met stads-ID's"],
                    ['Buildings', 'Gebouwen en hun niveaus'],
                    ['BuildingBuildData', 'Gegevens over het bouwen en gebouwverbeteringen'],
                    ['BuildingOrder', 'Bouwopdrachten'],
                    ['TownGroup', 'Stadsgroepen (groepering van steden voor beheer)'],
                    ['TownGroupTown', 'Koppeling tussen steden en stadsgroepen']
                ]
            },
            {
                tabId: 'mgr-military', title: '🛡 Troepen & Gevechten', heading: 'Troepen, bewegingen en gevechten',
                models: [
                    ['Units', 'Troepenaantallen per relevante entiteit'],
                    ['MovementsUnits', 'Eenheden die bij bewegingen horen'],
                    ['Support', 'Ondersteuning tussen steden'],
                    ['PlayerAttackSpot', 'Aanvalspunten of aanvalgerelateerde gegevens'],
                    ['UnitOrder', 'Troepenopdrachten'],
                    ['PlayerReportStatus', 'Status van spelersrapporten'],
                    ['MissionReport', 'Missierapporten']
                ]
            },
            {
                tabId: 'mgr-special', title: '🔬 Onderzoek & Speciaal', heading: 'Onderzoek, goden en speciale functies',
                models: [
                    ['Researches', 'Onderzoeken die zijn uitgevoerd'],
                    ['ResearchOrder', 'Onderzoeksopdrachten'],
                    ['CastedPowers', 'Gebruikte goddelijke krachten'],
                    ['Heroes', 'Hero-gerelateerde gegevens'],
                    ['PlayerHero', 'Koppeling tussen spelers en helden'],
                    ['PlayerArtifact', 'Artefacten van spelers'],
                    ['Inventory', 'Inventaris'],
                    ['InventoryItem', 'Afzonderlijke inventarisitems'],
                    ['Celebration', 'Feesten of vieringen'],
                    ['FarmTown', 'Barbarendorpen'],
                    ['FarmTownPlayerRelation', 'Relatie tussen spelers en barbarendorpen'],
                    ['IslandQuest', 'Eilandmissies'],
                    ['IslandQuestPlayerRelation', 'Koppeling tussen spelers en eilandmissies']
                ]
            }
        ],

        init: function() {
            GMB.log('ModelManagers', 'Module initialized', 'success');
            setTimeout(() => this.addUITabs(), 800);
        },

        addUITabs: function() {
            this.groups.forEach(group => {
                if (document.getElementById(`gmb-tab-${group.tabId}`)) return;
                const options = group.models.map(([name, description]) =>
                    `<option value="${name}">${name} — ${GMB_Settings.escapeHtml(description)}</option>`).join('');
                const rows = group.models.map(([name, description]) =>
                    `<tr><td><code>${name}</code></td><td>${GMB_Settings.escapeHtml(description)}</td><td id="${group.tabId}-count-${name}">—</td></tr>`).join('');
                GMB_UI.addTab(group.tabId, group.title, `
                    <div class="gmb-section">
                        <div class="gmb-section-title">${group.title}</div>
                        <p class="gmb-muted">${group.heading}. Alleen-lezen overzicht van de Grepolis-modellen; alleen-lezen inspectie van spelmodellen.</p>
                        ${GMB_UI.createButton('Aantallen vernieuwen', () => this.refreshCounts(group))}
                        <div style="max-height:200px;overflow:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;"><thead><tr><th>Model</th><th>Vermoedelijke informatie</th><th>Records</th></tr></thead><tbody>${rows}</tbody></table></div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">Modelinhoud bekijken</div>
                        <select id="${group.tabId}-select" style="width:100%;margin-bottom:6px;">${options}</select>
                        ${GMB_UI.createButton('Toon (eerste ' + this.maxRows + ')', () => this.showModel(group))}
                        ${GMB_UI.createButton('Kopieer JSON', () => this.copyModel(group), 'gmb-button-secondary')}
                        <div id="${group.tabId}-status" class="gmb-muted" style="margin:6px 0;">Kies een model en klik op Toon.</div>
                        <pre id="${group.tabId}-output" style="max-height:260px;overflow:auto;white-space:pre-wrap;font-size:10px;"></pre>
                    </div>`);
            });
        },

        getModels: function() {
            const uw = GMB_API.getUW();
            return uw && uw.MM && typeof uw.MM.getModels === 'function' ? uw.MM.getModels() : null;
        },

        getModelEntries: function(collection) {
            if (!collection) return [];
            if (Array.isArray(collection)) return collection;
            if (Array.isArray(collection.models)) return collection.models;
            return Object.values(collection);
        },

        getEntries: function(name) {
            const models = this.getModels();
            if (!models || !models[name]) return null;
            return this.getModelEntries(models[name]);
        },

        plain: function(entry, depth = 0, seen = new WeakSet()) {
            if (entry === null || entry === undefined) return entry;
            if (typeof entry === 'function') return undefined;
            if (typeof entry !== 'object') return entry;
            if (seen.has(entry) || depth > 3) return '[…]';
            seen.add(entry);
            const source = entry.attributes && typeof entry.attributes === 'object' ? entry.attributes : entry;
            if (Array.isArray(source)) return source.slice(0, 20).map(item => this.plain(item, depth + 1, seen));
            const result = {};
            Object.keys(source).slice(0, 60).forEach(key => {
                const value = this.plain(source[key], depth + 1, seen);
                if (value !== undefined) result[key] = value;
            });
            return result;
        },

        refreshCounts: function(group) {
            group.models.forEach(([name]) => {
                const cell = document.getElementById(`${group.tabId}-count-${name}`);
                if (!cell) return;
                try {
                    const entries = this.getEntries(name);
                    cell.textContent = entries ? String(entries.length) : 'niet geladen';
                } catch (error) {
                    cell.textContent = 'fout';
                }
            });
        },

        buildJson: function(name) {
            const entries = this.getEntries(name);
            if (!entries) return null;
            return JSON.stringify(entries.slice(0, this.maxRows).map(entry => this.plain(entry)), null, 2);
        },

        showModel: function(group) {
            const select = document.getElementById(`${group.tabId}-select`);
            const status = document.getElementById(`${group.tabId}-status`);
            const output = document.getElementById(`${group.tabId}-output`);
            if (!select || !status || !output) return;
            const name = select.value;
            try {
                const entries = this.getEntries(name);
                if (!entries) {
                    status.textContent = `${name} is nog niet geladen in Grepolis (MM.getModels).`;
                    output.textContent = '';
                    return;
                }
                const json = this.buildJson(name);
                this.lastData[group.tabId] = json;
                status.textContent = `${name}: ${entries.length} record(s), eerste ${Math.min(entries.length, this.maxRows)} getoond.`;
                output.textContent = json;
                this.refreshCounts(group);
            } catch (error) {
                status.textContent = `Fout bij lezen van ${name}: ${error.message}`;
                GMB.log('ModelManagers', `Fout bij lezen van ${name}: ${error.message}`, 'error');
            }
        },

        copyModel: function(group) {
            const status = document.getElementById(`${group.tabId}-status`);
            const json = this.lastData[group.tabId];
            if (!json) {
                if (status) status.textContent = 'Toon eerst een model.';
                return;
            }
            const done = ok => { if (status) status.textContent = ok ? 'JSON gekopieerd naar het klembord.' : 'Kopiëren mislukt.'; };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(json).then(() => done(true), () => done(false));
            } else {
                done(false);
            }
        }
    };

    // ============================================================
    // INITIALIZATION & SAFE BOOTSTRAP
    // ============================================================

    // ============================================================
    // TRADE HELPER (DIO: percentage trade, town trade improvement, recruiting trade, hides overview)
    // ============================================================
    const GMB_TradeHelper = {
        gameOnly: true,
        observer: null,
        hidesObserver: null,
        scheduled: false,
        marketEnabled: function() { return true; },
        caveEnabled: function() { return false; },

        // Eenmalige migratie van de oude gecombineerde 'Handelshulp'-flag naar de twee aparte modules.
        migrateModuleFlags: function() {
            const legacy = GMB.storage.get('module_trade_helper', null);
            if (legacy === null || legacy === undefined) return;
            ['module_market_overview', 'module_cave_overview'].forEach(key => {
                if (GMB.storage.get(key, null) === null) GMB.storage.set(key, legacy !== false && legacy !== 'false' && legacy !== 0);
            });
            GMB.storage.delete('module_trade_helper');
        },

        init: function() {
            if (!document.body || typeof MutationObserver !== 'function') return;
            try { this.migrateModuleFlags(); } catch (error) { GMB.log('TradeHelper', `Module-migratie mislukt: ${error.message}`, 'warn'); }
            this.observer = new MutationObserver(() => this.schedule());
            this.observer.observe(document.body, { childList: true, subtree: true });
            this.schedule();
        },

        schedule: function() {
            if (this.scheduled) return;
            this.scheduled = true;
            requestAnimationFrame(() => {
                this.scheduled = false;
                try { this.scan(); } catch (error) { GMB.log('TradeHelper', `Scan mislukt: ${error.message}`, 'error'); }
            });
        },

        scan: function() {
            if (this.marketEnabled()) {
                document.querySelectorAll('#trade_tab').forEach(tab => {
                    if (!tab.querySelector('.gmb-rec-trade') && tab.querySelector('#big_progressbar')) this.addTradeToolbar(tab);
                    if (tab.querySelector('.gmb-rec-trade')) {
                        if (this.tradeImprovementEnabled() && !this.tradeScope(tab).querySelector('#gmb_Improvement_trade')) this.addTradeImprovement(tab);
                        if (tab.__gmbTti) this.updateTradeImprovement(tab);
                    }
                });
            } else {
                document.querySelectorAll('.gmb-trade-toolbar, .gmb-rec-trade, .gmb-trade-tti, .gmb-trade-mark, #gmb_Improvement_trade, .gmb-tti-needed, .gmb_trade_arrow').forEach(el => el.remove());
            }
        },

        num: function(text) { return parseInt(String(text || '').replace(/[^\d]/g, ''), 10) || 0; },

        // #town_capacity_*, #big_progressbar en #trade_type_* kunnen buiten #trade_tab
        // staan — zoek daarom altijd in het omringende gpwnd-venster.
        tradeScope: function(root) {
            try {
                const w = root && root.closest ? root.closest('div[id^="gpwnd_"]') : null;
                return w || root;
            } catch (e) { return root; }
        },

        getCapacityLeft: function(root) {
            const el = this.tradeScope(root).querySelector('#big_progressbar .caption .curr');
            return el ? this.num(el.textContent) : 0;
        },

        getTargetSpace: function(root, res) {
            const box = this.tradeScope(root).querySelector(`#town_capacity_${res}`);
            if (!box) return { max: 30000, free: 30000, known: false };
            const read = selector => { const el = box.querySelector(selector); return el ? this.num(el.textContent) : 0; };
            const max = read('.max');
            const curr = read('.curr');
            const curr2 = read('.curr2');
            const used = curr + curr2;
            return { max, curr, curr2, free: Math.max(0, max - used), pending: read('.curr3'), known: max > 0 };
        },

        getStock: function(root = null) {
            const resourceBar = document.querySelector('#ui_box .ui_resources_bar');
            if (resourceBar) {
                const displayed = {};
                ['wood', 'stone', 'iron'].forEach(res => {
                    const amount = resourceBar.querySelector(`.${res} .amount`);
                    displayed[res] = amount ? this.num(amount.textContent) : null;
                });
                if (Object.values(displayed).every(value => Number.isFinite(value))) return displayed;
            }
            const uw = GMB_API.getUW();
            const town = uw.ITowns && uw.ITowns.getTown(uw.Game.townId);
            const res = town && typeof town.getCurrentResources === 'function' ? town.getCurrentResources() : null;
            if (!res) throw new Error('Grondstoffen van de huidige stad zijn niet beschikbaar.');
            return { wood: Number(res.wood) || 0, stone: Number(res.stone) || 0, iron: Number(res.iron) || 0 };
        },

        setField: function(root, res, value) {
            const scope = this.tradeScope(root);
            const input = scope.querySelector(`#trade_type_${res} input[type="text"]`) || scope.querySelector(`#trade_type_${res} input`);
            if (!input) throw new Error(`Invoerveld voor ${res} niet gevonden.`);
            input.focus();
            input.value = String(Math.max(0, Math.floor(value)));
            ['input', 'keyup', 'change'].forEach(type => input.dispatchEvent(new Event(type, { bubbles: true })));
            input.blur();
        },

        getField: function(root, res) {
            const scope = this.tradeScope(root);
            const input = scope.querySelector(`#trade_type_${res} input`);
            return input ? this.num(input.value) : 0;
        },

        parsePercent: function(value) {
            const pct = Number(String(value).replace(',', '.'));
            if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error('Vul een percentage tussen 1 en 100 in.');
            return pct;
        },

        // Neemt pct% van elke grondstof en schaalt proportioneel terug als de transportcapaciteit overschreden wordt.
        computePercentParts: function(stock, capacity, pct, space = null) {
            const keys = ['wood', 'stone', 'iron'];
            if (!capacity || keys.every(key => !stock[key])) throw new Error('Geen grondstoffen of handelscapaciteit beschikbaar.');
            const limits = {};
            const parts = {};
            keys.forEach(key => {
                const wanted = Math.floor(stock[key] * pct / 100);
                limits[key] = Math.max(0, Math.min(wanted, space ? space[key] : wanted));
                parts[key] = limits[key];
            });
            const total = keys.reduce((sum, key) => sum + parts[key], 0);
            if (total > capacity) {
                keys.forEach(key => { parts[key] = Math.floor(limits[key] * capacity / total); });
            }
            return parts;
        },

        // Aantal eenheden dat met kostentriple (w/s/i per stuk) betaalbaar en transporteerbaar is.
        unitCountFromCosts: function(cost, stock, capacity, pct) {
            const keys = ['wood', 'stone', 'iron'];
            const perUnit = keys.reduce((sum, key) => sum + (Number(cost[key]) || 0), 0);
            if (!perUnit) return 0;
            let max = Math.floor(capacity / perUnit);
            keys.forEach(key => { if (cost[key] > 0) max = Math.min(max, Math.floor(stock[key] / cost[key])); });
            return Math.floor(max * pct / 100);
        },

        // Met een eenheid: pct% van het maximale aantal eenheden dat de voorraad en transportcapaciteit toelaten.
        computeUnitParts: function(stock, capacity, unitId, pct, townId = null) {
            const unit = GMB_API.getUW().GameData.units[unitId];
            if (!unit || !unit.resources) throw new Error('Selecteer een geldige eenheid.');
            const keys = ['wood', 'stone', 'iron'];
            const factor = Math.max(0.1, this.getUnitCostFactor(unitId, townId));
            const cost = {};
            keys.forEach(key => { cost[key] = Math.ceil((Number(unit.resources[key]) || 0) * factor); });
            const units = this.unitCountFromCosts(cost, stock, capacity, pct);
            const unitName = unit.name;
            if (units < 1) throw new Error(`Geen enkele ${unitName} is betaalbaar/transporteerbaar met deze voorraad en capaciteit.`);
            const parts = {};
            keys.forEach(key => { parts[key] = cost[key] * units; });
            parts.units = units;
            return parts;
        },

        // DIO dio_rec: "eenheden" die geen echte unit zijn — kostentriples uit DIO-ratio's (genormaliseerd ×10000).
        SPECIAL_TRADE_UNITS: {
            wall5:     { cost: { wood: 2286, stone: 10000, iron: 6714 }, label: 'Stadsmuur Lv 5' },
            wall15:    { cost: { wood: 762,  stone: 10000, iron: 7491 }, label: 'Stadsmuur Lv 15' },
            hide5:     { cost: { wood: 2456, stone: 3030,  iron: 4514 }, label: 'Schuilplaats Lv 5' },
            hide10:    { cost: { wood: 2945, stone: 2953,  iron: 4102 }, label: 'Schuilplaats Lv 10' },
            festival:  { cost: { wood: 8333, stone: 10000, iron: 8333 }, label: 'Stadsfestival' }
        },

        specialUnitLabel: function(key) {
            const uw = GMB_API.getUW();
            try {
                if (key === 'wall5' || key === 'wall15') {
                    const wall = uw.GameData && uw.GameData.buildings && uw.GameData.buildings.wall;
                    const lv = key === 'wall5' ? 5 : 15;
                    return `${(wall && wall.name) || 'Stadsmuur'} Lv ${lv}`;
                }
                if (key === 'hide5' || key === 'hide10') {
                    const hide = uw.DM && uw.DM.getl10n && uw.DM.getl10n('hide');
                    const base = (hide && hide.index && hide.index.hide) || 'Schuilplaats';
                    return `${base} Lv ${key === 'hide5' ? 5 : 10}`;
                }
                if (key === 'festival') return 'Stadsfestival';
            } catch (e) {}
            const def = this.SPECIAL_TRADE_UNITS[key];
            return def ? def.label : key;
        },

        computeSpecialParts: function(stock, capacity, key, pct) {
            const def = this.SPECIAL_TRADE_UNITS[key];
            if (!def) throw new Error('Onbekende speciale trade-eenheid.');
            const units = this.unitCountFromCosts(def.cost, stock, capacity, pct);
            if (units < 1) throw new Error(`Geen enkele ${this.specialUnitLabel(key)} is betaalbaar/transporteerbaar met deze voorraad en capaciteit.`);
            const parts = { units };
            ['wood', 'stone', 'iron'].forEach(res => { parts[res] = def.cost[res] * units; });
            return parts;
        },

        tradeRecSpecialEnabled: function() {
            const v = GMB.storage.get('trade_rec_special', true);
            return v !== false && v !== 'false' && v !== 0;
        },
        tradeImprovementEnabled: function() {
            const v = GMB.storage.get('trade_improvement', true);
            return v !== false && v !== 'false' && v !== 0;
        },

        // Meerdere bronsteden: pct% van het totale aantal eenheden dat alle steden samen kunnen leveren,
        // verdeeld naar rato van ieders maximum (voorraad en handelscapaciteit), nooit boven dat maximum.
        computeAggregateUnitPlan: function(entries, unitId, pct) {
            const unit = GMB_API.getUW().GameData.units[unitId];
            if (!unit || !unit.resources) throw new Error('Selecteer een geldige eenheid.');
            const keys = ['wood', 'stone', 'iron'];
            const rows = entries.map(entry => {
                const factor = Math.max(0.1, this.getUnitCostFactor(unitId, entry.sourceId));
                const cost = {};
                keys.forEach(key => { cost[key] = Math.ceil((Number(unit.resources[key]) || 0) * factor); });
                const perUnit = keys.reduce((sum, key) => sum + cost[key], 0);
                if (!perUnit) throw new Error('Deze eenheid heeft geen grondstofkosten.');
                let max = Math.floor(entry.capacity / perUnit);
                keys.forEach(key => { if (cost[key] > 0) max = Math.min(max, Math.floor(entry.stock[key] / cost[key])); });
                return { entry, cost, max: Math.max(0, max), units: 0, frac: 0 };
            });
            const total = rows.reduce((sum, row) => sum + row.max, 0);
            const wanted = Math.floor(total * pct / 100);
            if (wanted < 1) throw new Error(`Geen enkele ${unit.name} is betaalbaar/transporteerbaar met de geselecteerde bronsteden.`);
            let assigned = 0;
            rows.forEach(row => {
                const quota = wanted * row.max / total;
                row.units = Math.floor(quota);
                row.frac = quota - row.units;
                assigned += row.units;
            });
            rows.filter(row => row.units < row.max).sort((a, b) => b.frac - a.frac)
                .slice(0, wanted - assigned).forEach(row => { row.units++; });
            return {
                wanted, total,
                plan: rows.filter(row => row.units > 0).map(row => {
                    const parts = { units: row.units };
                    keys.forEach(key => { parts[key] = row.cost[key] * row.units; });
                    return { sourceId: row.entry.sourceId, parts };
                })
            };
        },

        computeParts: function(stock, capacity, unitId, pct, townId = null) {
            return unitId ? this.computeUnitParts(stock, capacity, unitId, pct, townId) : this.computePercentParts(stock, capacity, pct);
        },

        percentTrade: function(root, pct, unitId = '') {
            const ownTown = !!root.querySelector('.town_info');
            const space = ownTown ? {
                wood: this.getTargetSpace(root, 'wood').free,
                stone: this.getTargetSpace(root, 'stone').free,
                iron: this.getTargetSpace(root, 'iron').free
            } : null;
            const stock = this.getStock(root);
            const capacity = this.getCapacityLeft(root);
            const isSpecial = unitId && unitId.indexOf('special:') === 0;
            const parts = !unitId ? this.computePercentParts(stock, capacity, pct, space)
                : isSpecial ? this.computeSpecialParts(stock, capacity, unitId.slice(8), pct)
                : this.computeUnitParts(stock, capacity, unitId, pct);
            ['wood', 'stone', 'iron'].forEach(key => this.setField(root, key, parts[key]));
            const unitText = unitId
                ? ` (${parts.units}× ${isSpecial ? this.specialUnitLabel(unitId.slice(8)) : GMB_API.getUW().GameData.units[unitId].name})`
                : '';
            return `Percentage ${pct}%${unitText} ingevuld: ${parts.wood} hout, ${parts.stone} steen, ${parts.iron} zilver.`;
        },

        getUnitCostFactor: function(unitId, townId = null) {
            const uw = GMB_API.getUW();
            if (!uw.RecruitUnits || typeof uw.RecruitUnits.getResearchModificationFactor !== 'function') return 1;
            try {
                const factor = Number(uw.RecruitUnits.getResearchModificationFactor(townId || uw.Game.townId, unitId));
                return Number.isFinite(factor) && factor > 0 ? factor : 1;
            } catch (error) {
                GMB.log('TradeHelper', `Onderzoekskostenfactor niet beschikbaar; basiskosten gebruikt: ${error.message}`, 'warn');
                return 1;
            }
        },

        getUnitOptions: function() {
            const units = GMB_API.getUW().GameData.units;
            return Object.keys(units).filter(unit => units[unit].resources && units[unit].population > 0)
                .map(unit => ({ id: unit, name: units[unit].name }));
        },

        makeButton: function(label, handler, status) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.cssText = 'margin:2px;padding:2px 6px;cursor:pointer;';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                try {
                    const result = handler();
                    status.textContent = typeof result === 'string' ? result : '';
                } catch (error) { status.textContent = error.message; }
            });
            return button;
        },

        // ---------- DIO-style recruiting-trade toolbar ----------

        injectTradeStyles: function() {
            if (document.getElementById('gmb-trade-style')) return;
            const st = document.createElement('style');
            st.id = 'gmb-trade-style';
            st.textContent = `
                .gmb-rec-trade { margin:6px 0; padding:4px 6px; border:1px solid #b98e5d; background:rgba(255,255,255,0.35); font-size:11px; position:relative; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
                .gmb-rec-trade .gmb-dd { position:relative; display:inline-block; }
                .gmb-dd-btn { display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border:1px solid #b98e5d; background:linear-gradient(#fdf3d8,#efd9a8); border-radius:3px; cursor:pointer; font-size:11px; min-width:70px; justify-content:space-between; color:#000; }
                .gmb-dd-btn:hover { background:linear-gradient(#fff,#f5e2b8); }
                .gmb-dd-arrow { width:14px; height:14px; background:url("https://dio-david1327.github.io/img/dio/btn/drop-out.png") no-repeat center/contain; display:inline-block; flex:0 0 auto; }
                .gmb-dd.open .gmb-dd-arrow { background-image:url("https://dio-david1327.github.io/img/dio/btn/drop-over.png"); }
                .gmb-dd-list { display:none; position:absolute; top:100%; left:0; z-index:9999; background:#fffbe8; border:1px solid #b98e5d; box-shadow:2px 2px 6px rgba(0,0,0,.3); max-height:237px; overflow:auto; min-width:130px; }
                .gmb-dd.open .gmb-dd-list { display:block; }
                .gmb-dd-item { padding:3px 8px; cursor:pointer; white-space:nowrap; color:#000; }
                .gmb-dd-item:hover { background:#328BF1; color:#fff; }
                .gmb-dd-item.sel { background:#FFEEC7; font-weight:bold; }
                .gmb-dd-item .unit_icon40x40, .gmb-dd-item .building_icon40x40, .gmb-dd-item .place_image { display:inline-block; vertical-align:middle; margin-right:5px; }
                .gmb-rec-unit-grid { display:flex; flex-wrap:wrap; gap:1px; padding:2px; max-width:640px; }
                .gmb-dd-list.gmb-dd-list-units { max-height:430px; min-width:480px; }
                .gmb-rec-unit-grid .gmb-dd-item { padding:1px; }
                .gmb-rec-unit-grid .gmb-dd-item .unit_icon40x40 { width:40px; height:40px; margin:0; }
                .gmb-rec-unit-grid .gmb-dd-item.sel .unit_icon40x40 { filter:sepia(100%); }
                .gmb-rec-unit-grid .gmb-dd-item:not(.sel) .unit_icon40x40 { filter:grayscale(85%); }
                .gmb-rec-unit-grid .gmb-dd-item:not(.sel):hover .unit_icon40x40 { filter:none; }
                .gmb-rec-specials { border-top:1px solid #d8b878; margin-top:2px; padding-top:2px; }
                .gmb-rec-trade .gmb-rec-count { display:none; font-weight:bold; }
                .gmb-rec-trade .gmb-rec-status { color:#b00; }
                .gmb-rec-trade input[type="number"] { width:46px; padding:1px 2px; border:1px solid #b98e5d; }
            `;
            document.head.appendChild(st);
        },

        // Generieke DIO-achtige dropdown. items: [{value,label,iconCls,title}]
        recDropdown: function(items, selected, onPick, opts = {}) {
            const wrap = document.createElement('span');
            wrap.className = 'gmb-dd';
            const btn = document.createElement('div');
            btn.className = 'gmb-dd-btn';
            const cap = document.createElement('span');
            cap.className = 'gmb-dd-caption';
            const arrow = document.createElement('span');
            arrow.className = 'gmb-dd-arrow';
            btn.append(cap, arrow);
            const list = document.createElement('div');
            list.className = 'gmb-dd-list';
            const itemEls = {};
            const renderCaption = value => {
                const it = items.find(i => i.value === value) || items[0];
                cap.textContent = it ? it.label : '';
                cap.title = it && it.title ? it.title : '';
            };
            items.forEach(it => {
                const el = document.createElement('div');
                el.className = 'gmb-dd-item' + (it.value === selected ? ' sel' : '');
                el.dataset.value = it.value;
                el.title = it.title || it.label;
                if (it.iconCls) {
                    const icon = document.createElement('span');
                    icon.className = it.iconCls;
                    el.appendChild(icon);
                    if (it.showLabel) el.appendChild(document.createTextNode(' ' + it.label));
                } else {
                    el.appendChild(document.createTextNode(it.label));
                }
                el.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    Object.keys(itemEls).forEach(k => itemEls[k].classList.remove('sel'));
                    el.classList.add('sel');
                    renderCaption(it.value);
                    wrap.classList.remove('open');
                    onPick(it.value);
                });
                itemEls[it.value] = el;
                list.appendChild(el);
            });
            renderCaption(selected);
            btn.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                const wasOpen = wrap.classList.contains('open');
                document.querySelectorAll('.gmb-dd.open').forEach(d => d.classList.remove('open'));
                if (!wasOpen) wrap.classList.add('open');
            });
            wrap.append(btn, list);
            return { wrap, set: value => { renderCaption(value); const el = itemEls[value]; if (el) { Object.keys(itemEls).forEach(k => itemEls[k].classList.remove('sel')); el.classList.add('sel'); } } };
        },

        // Kostentriple voor marks (raw GameData, zonder onderzoek-factor — zoals DIO-ratio's).
        tradeUnitCostRaw: function(unitId) {
            if (unitId && unitId.indexOf('special:') === 0) {
                const def = this.SPECIAL_TRADE_UNITS[unitId.slice(8)];
                return def ? def.cost : null;
            }
            const unit = GMB_API.getUW().GameData.units[unitId];
            return unit && unit.resources ? { wood: Number(unit.resources.wood) || 0, stone: Number(unit.resources.stone) || 0, iron: Number(unit.resources.iron) || 0 } : null;
        },

        // Gekleurde markeringen op de grondstof-progressbars (DIO addTradeMarks).
        recTradeMarks: function(tab, unitId, stock = null) {
            const scope = this.tradeScope(tab);
            scope.querySelectorAll('.gmb-trade-mark').forEach(m => m.remove());
            let ratio = null;
            if (unitId) {
                const cost = this.tradeUnitCostRaw(unitId);
                if (cost) {
                    const max = Math.max(cost.wood, cost.stone, cost.iron);
                    if (max > 0) ratio = { wood: cost.wood / max, stone: cost.stone / max, iron: cost.iron / max };
                }
            } else if (stock) {
                // %-modus: marks op de voorraad-ratio
                const max = Math.max(Number(stock.wood) || 0, Number(stock.stone) || 0, Number(stock.iron) || 0);
                if (max > 0) ratio = {
                    wood: (Number(stock.wood) || 0) / max,
                    stone: (Number(stock.stone) || 0) / max,
                    iron: (Number(stock.iron) || 0) / max
                };
            }
            if (!ratio) return;
            scope.querySelectorAll('.progress').forEach(p => {
                const parent = p.parentElement;
                if (!parent || parent.id === 'big_progressbar') return;
                const res = String(parent.id || '').split('_')[2];
                if (!ratio[res]) return;
                if (p.querySelector('.gmb-trade-mark')) return;
                const mark = document.createElement('p');
                mark.className = 'gmb-trade-mark';
                const px = Math.max(2, Math.round(242 * ratio[res] * 0.97));
                mark.style.cssText = `position:absolute;left:${px}px;top:0;width:2px;height:100%;background:#7f0;margin:0;z-index:3;pointer-events:none;`;
                if (getComputedStyle(p).position === 'static') p.style.position = 'relative';
                p.appendChild(mark);
            });
        },

        // Live herberekening + invullen van de drie handelsvelden.
        recTradeUpdate: function(tab, state) {
            const pct = Math.max(0, Math.min(100, Number(state.percent) || 0));
            const status = tab.querySelector('.gmb-rec-status');
            const percInput = tab.querySelector('.gmb-rec-trade input[type="number"]');
            const unitId = state.unit || '';
            if (unitId === '__manual' || unitId === '') {
                this.recTradeMarks(tab, null, null);
                if (percInput) percInput.style.color = '#000';
                if (status) status.textContent = 'Handmatige invulling — auto-fill staat uit.';
                return;
            }
            try {
                const ratio = this.recTradeRatio(unitId);
                if (!ratio) throw new Error('Ongeldige eenheid.');
                const percent = pct / 100;
                const stock = this.getStock(tab);
                const capacity = this.recTradeCapacity(tab);
                const spaceInfo = this.getTargetSpace(tab, 'wood');
                const maxAmount = spaceInfo.known && spaceInfo.max > 0 ? spaceInfo.max : 25500;
                const parts = state.opt === 'all'
                    ? this.dioTradeAll(tab, state, ratio, percent, stock, capacity, maxAmount, percInput)
                    : this.dioTradeMax(tab, state, ratio, percent, stock, capacity, maxAmount, percInput);
                if (parts) {
                    state.prevFields = {
                        wood: this.getField(tab, 'wood'),
                        stone: this.getField(tab, 'stone'),
                        iron: this.getField(tab, 'iron')
                    };
                    ['wood', 'stone', 'iron'].forEach(k => this.setField(tab, k, parts[k]));
                    if (status) status.textContent = '';
                } else if (status && percInput && percInput.style.color === 'rgb(255, 0, 0)') {
                    status.textContent = 'Niet invulbaar (rood).';
                }
                this.recTradeMarks(tab, unitId);
            } catch (error) {
                this.recTradeMarks(tab, null, null);
                if (percInput) percInput.style.color = '#f00';
                if (status) status.textContent = error.message;
            }
        },

        // DIO-ratio voor een eenheid/speciaal-item: resources genormaliseerd op max(w,s,i).
        recTradeRatio: function(unitId) {
            let raw = null;
            if (unitId && unitId.indexOf('special:') === 0) {
                const def = this.SPECIAL_TRADE_UNITS[unitId.slice(8)];
                raw = def ? def.cost : null;
            } else {
                const unit = GMB_API.getUW().GameData.units[unitId];
                raw = unit && unit.resources
                    ? { wood: Number(unit.resources.wood) || 0, stone: Number(unit.resources.stone) || 0, iron: Number(unit.resources.iron) || 0 }
                    : null;
            }
            if (!raw) return null;
            const max = Math.max(raw.wood, raw.stone, raw.iron);
            if (!max) return null;
            return { wood: raw.wood / max, stone: raw.stone / max, iron: raw.iron / max };
        },

        // Transportcapaciteit zoals DIO: ITowns.getAvailableTradeCapacity, fallback op progressbar.
        recTradeCapacity: function(tab) {
            try {
                const uw = GMB_API.getUW();
                const town = uw.ITowns && uw.ITowns.getTown && uw.Game ? uw.ITowns.getTown(uw.Game.townId) : null;
                const cap = town && town.getAvailableTradeCapacity && town.getAvailableTradeCapacity();
                if (Number.isFinite(cap) && cap > 0) return cap;
            } catch (e) {}
            return this.getCapacityLeft(tab);
        },

        // DIO getRess: nog-vrije graanschuur-ruimte (max - curr - curr2); null als onbekend.
        dioGetRess: function(tab, res) {
            const info = this.getTargetSpace(tab, res);
            if (!info.known) return null;
            return info.max - info.curr - info.curr2;
        },

        // DIO trade_max: capacity-verdeeld, addTEST kiest de beperkende grondstof.
        // Geeft {wood,stone,iron} of null (nul-geval: velden ongemoeid laten, alleen kleur).
        dioTradeMax: function(tab, state, ratio, percent, stock, capacity, maxAmount, percInput) {
            const tmp = ratio.wood + ratio.stone + ratio.iron;
            if (!tmp) return null;
            const addTEST = (a, b, c) => {
                const ra = ratio[a] || 0;
                const A = (Number(stock[a]) || 0) * percent;
                const B = ra ? A * (ratio[b] || 0) / ra : 0;
                const C = ra ? A * (ratio[c] || 0) / ra : 0;
                const ga = this.dioGetRess(tab, a), gb = this.dioGetRess(tab, b), gc = this.dioGetRess(tab, c);
                if ((ga !== null && A > ga) || (gb !== null && B > gb) || (gc !== null && C > gc)) {
                    percInput.style.color = '#610fe5';
                } else {
                    percInput.style.color = '#000';
                }
                return { wood: 0, stone: 0, iron: 0, [a]: A, [b]: B, [c]: C };
            };
            const W = capacity / tmp * ratio.wood;
            const S = capacity / tmp * ratio.stone;
            const I = capacity / tmp * ratio.iron;
            const sw = Number(stock.wood) || 0, ss = Number(stock.stone) || 0, si = Number(stock.iron) || 0;
            const wOver = W > sw, sOver = S > ss, iOver = I > si;
            const wLow = W < sw, sLow = S < ss, iLow = I < si;
            if (wOver && sLow && iLow) return addTEST('wood', 'stone', 'iron');
            if (sOver && wLow && iLow) return addTEST('stone', 'wood', 'iron');
            if (iOver && wLow && sLow) return addTEST('iron', 'stone', 'wood');
            if (wOver && sLow && iOver && W * ratio.wood < I * ratio.iron) return addTEST('wood', 'stone', 'iron');
            if (wOver && sLow && iOver && W * ratio.wood > I * ratio.iron) return addTEST('iron', 'stone', 'wood');
            if (iOver && wLow && sOver && I * ratio.iron < S * ratio.stone) return addTEST('iron', 'stone', 'wood');
            if (iOver && wLow && sOver && I * ratio.iron > S * ratio.stone) return addTEST('stone', 'wood', 'iron');
            if (wOver && sOver && iLow && W * ratio.wood > S * ratio.stone) return addTEST('stone', 'wood', 'iron');
            if (wOver && sOver && iLow && W * ratio.wood < S * ratio.stone) return addTEST('wood', 'stone', 'iron');
            if (wOver && sOver && iOver) { percInput.style.color = '#f00'; return null; }
            if (wLow && sLow && iLow) {
                const gw = this.dioGetRess(tab, 'wood'), gs = this.dioGetRess(tab, 'stone'), gi = this.dioGetRess(tab, 'iron');
                if ((gw !== null && W * percent > gw) || (gs !== null && S * percent > gs) || (gi !== null && I * percent > gi)) {
                    percInput.style.color = '#610fe5';
                } else {
                    percInput.style.color = '#000';
                }
                return { wood: W * percent, stone: S * percent, iron: I * percent };
            }
            percInput.style.color = '#000';
            return { wood: 0, stone: 0, iron: 0 };
        },

        // DIO trade_all: ratio × (max_amount − 1000) × percent, genuld als alles past.
        dioTradeAll: function(tab, state, ratio, percent, stock, capacity, maxAmount, percInput) {
            const part = (maxAmount - 1000) * percent;
            const W = ratio.wood * part, S = ratio.stone * part, I = ratio.iron * part;
            if (W > (Number(stock.wood) || 0) || S > (Number(stock.stone) || 0) || I > (Number(stock.iron) || 0) || (W + S + I) > capacity) {
                percInput.style.color = '#f00';
                return null;
            }
            percInput.style.color = '#000';
            return { wood: W, stone: S, iron: I };
        },

        // Selectie wordt per stad (Game.townId) bewaard, met globale fallback.
        tradeTownId: function() {
            const g = GMB_API.getUW().Game;
            return (g && (g.townId || g.town_id)) || 0;
        },
        tradePrefGet: function(key, fallback) {
            const tid = this.tradeTownId();
            let v = tid ? GMB.storage.get(`trade_rec_${tid}_${key}`, null) : null;
            if (v === null || v === undefined) v = GMB.storage.get(`trade_rec_${key}`, null);
            return v === null || v === undefined ? fallback : v;
        },
        tradePrefSet: function(key, value) {
            const tid = this.tradeTownId();
            if (tid) GMB.storage.set(`trade_rec_${tid}_${key}`, value);
            GMB.storage.set(`trade_rec_${key}`, value);
        },

        addTradeToolbar: function(tab) {
            if (tab.querySelector('.gmb-rec-trade')) return;
            this.injectTradeStyles();
            const bar = document.createElement('div');
            bar.className = 'gmb-rec-trade';
            const state = {
                opt: GMB.storage.get('trade_rec_opt', 'max'),
                unit: this.tradePrefGet('unit', '__manual'),
                percent: this.tradePrefGet('percent', 100),
                count: 0,
                prevFields: null
            };
            if (state.opt !== 'all') state.opt = 'max';
            if (state.unit === '') state.unit = '__manual';

            // Opt-dropdown (DIO: capaciteits-max vs alle) — labels via game-l10n
            const uw = GMB_API.getUW();
            const marketL10n = (uw.DM && uw.DM.getl10n && uw.DM.getl10n('market')) || {};
            const heroesL10n = (uw.DM && uw.DM.getl10n && uw.DM.getl10n('heroes')) || {};
            const optMaxLabel = `${marketL10n.capacity || 'Capaciteit'} ${((heroesL10n.overview || {}).max) || 'max'}`;
            const optAllLabel = `${marketL10n.capacity || 'Capaciteit'} ${((marketL10n.visibility || {}).all) || 'alles'}`;
            const optDD = this.recDropdown([
                { value: 'max', label: optMaxLabel, title: 'Percentage van het maximaal haalbare (DIO trade_max)' },
                { value: 'all', label: optAllLabel, title: 'Percentage van het percentage-invoer (DIO trade_all)' }
            ], state.opt, value => {
                state.opt = value;
                GMB.storage.set('trade_rec_opt', value);
                this.recTradeUpdate(tab, state);
            });
            bar.appendChild(optDD.wrap);

            // Percentage-invoer (pijltjestoetsen: 1 / Shift 10 / Ctrl 25)
            const percLabel = document.createElement('span');
            percLabel.textContent = '% ';
            const percInput = document.createElement('input');
            percInput.type = 'number'; percInput.min = '0'; percInput.max = '100';
            percInput.value = String(state.percent);
            percInput.title = 'Percentage (0–100) — wordt direct toegepast. Pijltjes: 1, Shift: 10, Ctrl: 25';
            percInput.addEventListener('input', () => {
                state.percent = percInput.value;
                this.tradePrefSet('percent', state.percent);
                this.recTradeUpdate(tab, state);
            });
            percInput.addEventListener('keydown', event => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                const step = event.ctrlKey ? 25 : (event.shiftKey ? 10 : 1);
                const dir = event.key === 'ArrowUp' ? 1 : -1;
                percInput.value = String(Math.max(0, Math.min(100, (Number(percInput.value) || 0) + dir * step)));
                percInput.dispatchEvent(new Event('input', { bubbles: true }));
            });
            percInput.addEventListener('focus', () => percInput.select());
            bar.append(percLabel, percInput);

            // Eenheid-dropdown (iconen-grid zoals DIO) — '__manual' = eigen invulling
            const specialIconCls = { wall5: 'place_image wall_level', wall15: 'place_image wall_level', hide5: 'building_icon40x40 hide', hide10: 'building_icon40x40 hide', festival: 'place_image morale' };
            const unitItems = [
                { value: '__manual', label: '— Eigen invulling —', title: 'Geen auto-fill; vul de velden zelf in' }
            ];
            this.getUnitOptions().forEach(unit => {
                unitItems.push({ value: unit.id, label: unit.name, iconCls: `unit_icon40x40 ${unit.id}`, title: unit.name });
            });
            if (this.tradeRecSpecialEnabled()) {
                Object.keys(this.SPECIAL_TRADE_UNITS).forEach(key => {
                    unitItems.push({
                        value: 'special:' + key,
                        label: this.specialUnitLabel(key),
                        iconCls: specialIconCls[key] || 'place_image morale',
                        showLabel: true,
                        title: this.specialUnitLabel(key)
                    });
                });
            }
            const unitDD = this.recDropdown(unitItems, state.unit, value => {
                state.unit = value;
                this.tradePrefSet('unit', value);
                this.recTradeUpdate(tab, state);
            });
            // Grid-weergave: echte eenheid-iconen in flex-grid, tekst/speciale items eronder
            const unitList = unitDD.wrap.querySelector('.gmb-dd-list');
            if (unitList) {
                unitList.classList.add('gmb-dd-list-units');
                const grid = document.createElement('div');
                grid.className = 'gmb-rec-unit-grid';
                const rest = document.createElement('div');
                rest.className = 'gmb-rec-specials';
                Array.from(unitList.children).forEach(el => {
                    if ((el.dataset.value || '').indexOf('special:') === 0 || !el.querySelector('.unit_icon40x40')) rest.appendChild(el);
                    else grid.appendChild(el);
                });
                unitList.appendChild(grid);
                if (rest.children.length) unitList.appendChild(rest);
            }
            // Live tooltips met max-aantal + kostentriple bij het openen van de dropdown
            const refreshUnitTips = () => {
                try {
                    const stock = this.getStock(tab);
                    const capacity = this.getCapacityLeft(tab);
                    unitList.querySelectorAll('.gmb-dd-item').forEach(el => {
                        const v = el.dataset.value || '';
                        if (!v || v === '__manual') return;
                        const cost = this.tradeUnitCostRaw(v);
                        if (!cost) return;
                        const keys = ['wood', 'stone', 'iron'];
                        const perUnit = keys.reduce((s, k) => s + cost[k], 0);
                        if (!perUnit) return;
                        let max = Math.floor(capacity / perUnit);
                        keys.forEach(k => { if (cost[k] > 0) max = Math.min(max, Math.floor(stock[k] / cost[k])); });
                        const base = el.title ? el.title.split('\n')[0] : '';
                        el.title = `${base}\nMax ${max}× — ${cost.wood}/${cost.stone}/${cost.iron}`;
                    });
                } catch (e) {}
            };
            unitDD.wrap.querySelector('.gmb-dd-btn').addEventListener('click', () => setTimeout(refreshUnitTips, 30));
            bar.appendChild(unitDD.wrap);

            // Teller (DIO dio_rec_count) + status
            const countEl = document.createElement('span');
            countEl.className = 'gmb-rec-count';
            countEl.textContent = `(${state.count})`;
            const status = document.createElement('span');
            status.className = 'gmb-rec-status';
            bar.append(countEl, status);

            // Teller verhoogt bij elke trade-verzending (DIO: #trade_button click)
            tab.querySelectorAll('.btn_trade_button, .send_resources_btn, #trade_button').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.count += 1;
                    countEl.textContent = `(${state.count})`;
                    countEl.style.display = 'inline';
                });
            });

            // Wis-knop
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button'; clearBtn.className = 'gmb-button';
            clearBtn.textContent = 'Wissen';
            clearBtn.title = 'Maakt alle handelsvelden leeg';
            clearBtn.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                ['wood', 'stone', 'iron'].forEach(res => this.setField(tab, res, 0));
                this.recTradeMarks(tab, null, null);
                status.textContent = '';
                if (percInput) percInput.style.color = '#000';
                state.prevFields = null;
            });
            bar.appendChild(clearBtn);

            // Undo: herstelt de veldwaarden van vóór de laatste auto-fill
            const undoBtn = document.createElement('button');
            undoBtn.type = 'button'; undoBtn.className = 'gmb-button';
            undoBtn.textContent = '↶';
            undoBtn.title = 'Herstelt de vorige handmatige invulling';
            undoBtn.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                if (!state.prevFields) { status.textContent = 'Niets om ongedaan te maken.'; return; }
                ['wood', 'stone', 'iron'].forEach(res => this.setField(tab, res, state.prevFields[res]));
                state.prevFields = null;
                status.textContent = 'Vorige invulling hersteld.';
            });
            bar.appendChild(undoBtn);

            const anchor = tab.querySelector('#duration_container');
            if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor);
            else tab.appendChild(bar);
            if (this.tradeImprovementEnabled()) this.addTradeImprovement(tab);
            // Geen initiële recTradeUpdate: velden blijven standaard leeg (eigen invulling)
        },

        // DIO dio_Tti: per grondstof "nog nodig" + Max/Cult-vulknoppen in de trade-toolbar.
        TTI_RES_LABELS: { wood: 'Hout', stone: 'Steen', iron: 'Zilver' },
        // Cult-modeCapaciteit uit DIO (steen 18000, rest 15000)
        ttiCultCap: function(res) { return res === 'stone' ? 18000 : 15000; },

        ttiNeeded: function(tab, res, mode) {
            const info = this.getTargetSpace(tab, res);
            if (!info.known) return null;
            const cap = mode === 'cult' ? this.ttiCultCap(res) : info.max;
            return Math.max(0, cap - info.curr - info.curr2 - info.pending);
        },

        // DIO dio_Tti: ◇ "nog nodig" op de progressbars + zwevende Max/Cult-pijlen.
        addTradeImprovement: function(tab) {
            const scope = this.tradeScope(tab);
            if (scope.querySelector('#gmb_Improvement_trade')) return;
            // ◇ needed-spans op .tripple-progress-progressbar .amounts
            scope.querySelectorAll('.tripple-progress-progressbar').forEach(el => {
                const res = String(el.id || '').split('_')[2];
                if (!this.TTI_RES_LABELS[res]) return;
                const amounts = el.querySelector('.amounts');
                if (!amounts || amounts.querySelector('.gmb-tti-needed')) return;
                const span = document.createElement('span');
                span.className = 'gmb-tti-needed';
                span.dataset.res = res;
                span.style.cssText = 'margin-left:6px;color:#8a5a00;font-weight:bold;';
                amounts.appendChild(span);
            });
            tab.__gmbTti = true;
            this.updateTradeImprovement(tab);
            // Pijlen (DIO-positie)
            const indicators = scope.querySelectorAll('.town-capacity-indicator');
            if (!indicators.length) return;
            const container = document.createElement('div');
            container.id = 'gmb_Improvement_trade';
            container.style.cssText = 'position:relative;top:-259px;left:59px;z-index:5;';
            const status = document.createElement('span');
            status.className = 'gmb-tti-status';
            status.style.cssText = 'position:absolute;top:-18px;right:0;color:#b00;font-size:10px;white-space:nowrap;';
            container.appendChild(status);
            const tops = { wood: 200, stone: 234, iron: 268 };
            ['wood', 'stone', 'iron'].forEach(res => {
                ['max', 'cult'].forEach(mode => {
                    const a = document.createElement('a');
                    a.className = 'gmb_trade_arrow';
                    a.dataset.res = res; a.dataset.mode = mode;
                    a.style.cssText = `position:absolute;top:${tops[res]}px;right:${mode === 'max' ? 105 : 85}px;width:22px;height:16px;cursor:pointer;display:block;`;
                    a.style.backgroundImage = mode === 'max'
                        ? 'url("https://dio-david1327.github.io/img/dio/btn/trade-arrow.png")'
                        : 'url("https://dio-david1327.github.io/img/dio/btn/trade-cult.png")';
                    a.style.backgroundRepeat = 'no-repeat';
                    a.style.backgroundPosition = '0 -1px';
                    a.title = `${this.TTI_RES_LABELS[res]} — ${mode === 'max' ? 'vul tot graanschuur-capaciteit' : 'vul tot festival-capaciteit (15000 / steen 18000)'}`;
                    a.addEventListener('click', event => {
                        event.preventDefault(); event.stopPropagation();
                        try {
                            status.textContent = this.tradeImproveFill(tab, res, mode);
                        } catch (error) {
                            status.textContent = error.message;
                            GMB.log('TradeHelper', `Trade-${mode} ${res}: ${error.message}`, 'warn');
                        }
                    });
                    a.addEventListener('mouseenter', () => { a.style.backgroundPosition = '0 -17px'; });
                    a.addEventListener('mouseleave', () => { a.style.backgroundPosition = '0 -1px'; });
                    container.appendChild(a);
                });
            });
            indicators[0].parentNode.insertBefore(container, indicators[0]);
        },

        updateTradeImprovement: function(tab) {
            if (!tab || !tab.__gmbTti) return;
            const scope = this.tradeScope(tab);
            scope.querySelectorAll('.gmb-tti-needed').forEach(span => {
                const res = span.dataset.res;
                const needed = this.ttiNeeded(tab, res, 'max');
                span.textContent = needed === null ? '◇ ?' : `◇ ${needed.toLocaleString('nl-NL')}`;
            });
        },

        // Vult #trade_type_<res> met min(nog-nodig, transportcapaciteit) — Max = graanschuur, Cult = festival-cap.
        tradeImproveFill: function(tab, res, mode) {
            const label = this.TTI_RES_LABELS[res] || res;
            const needed = this.ttiNeeded(tab, res, mode);
            if (needed === null) throw new Error(`Capaciteitsdata voor ${label} niet gevonden.`);
            const capacityLeft = Math.max(0, this.getCapacityLeft(tab));
            const send = Math.min(needed, capacityLeft);
            if (send <= 0) return `${label}: niets te versturen (nog nodig ${needed}, transport vrij ${capacityLeft}).`;
            this.setField(tab, res, send);
            const modeText = mode === 'cult' ? 'festival-capaciteit' : 'graanschuur-capaciteit';
            return `${label}: ${send.toLocaleString('nl-NL')} ingevuld (${modeText}, nog nodig was ${needed}, transport vrij ${capacityLeft}).`;
        },

        // Hernoemt trade-toolen na toggle-wijziging in het GMB-paneel.
        refreshTradeToolbars: function() {
            document.querySelectorAll('.gmb-trade-toolbar, .gmb-rec-trade, .gmb-trade-tti, .gmb-trade-mark, #gmb_Improvement_trade, .gmb-tti-needed, .gmb_trade_arrow').forEach(el => el.remove());
            document.querySelectorAll('#trade_tab').forEach(tab => {
                delete tab.__gmbTti;
                delete tab.__gmbTtiRefs;
                if (tab.querySelector('#big_progressbar')) this.addTradeToolbar(tab);
            });
        },

    };

    const GMB_Map = {
        gameOnly: true,
        enabled: false,
        observer: null,
        mapObserver: null,
        mapRoot: null,
        renderTimer: null,
        lastRenderAt: 0,
        maxRenderedMarkers: 250,
        renderFrame: null,
        tags: {},
        settings: {},
        worldData: { towns: new Map(), players: new Map(), alliances: new Map(), islands: new Map() },
        islandSpatialIndex: new Map(),
        allianceRelations: new Map(),
        idleDays: {},
        activity: [],
        wheelHandler: null,
        windowOpenHooked: false,
        editor: null,
        lastWheelAt: 0,
        koloTimer: null,
        koloKills: {},
        defaults: {
            tagsOnMap: true, tagsByName: true, playerTags: true, allianceTags: true, playerNames: false, allianceNames: false,
            flagColors: true, inactive: false, inactiveMin: 1, inactiveMax: 30,
            oceans: true, islandTagsOnMap: true, koloTracker: false,
            helena: true, wheelZoom: false
        },
        tagTypes: ['town', 'island', 'player', 'alliance'],
        tagTypeLabels: { town: 'Stad', island: 'Eiland', player: 'Speler', alliance: 'Alliantie' },
        tagTextPattern: /^[a-z0-9 ._\[\]()\-:?&;]{1,32}$/i,
        defaultColors: ['#000000', '#7E2020', '#CD6600', '#B7A800', '#5D9D00', '#008F9D', '#67009D'],
        oceanImageUrl: 'https://dio-david1327.github.io/img/dio/map/',

        isValidTagText: function(text) {
            return typeof text === 'string' && this.tagTextPattern.test(text);
        },

        textColorFor: function(background) {
            let r, g, b;
            const hex = String(background || '').match(/^#([0-9a-f]{6})$/i);
            const rgb = String(background || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (hex) { r = parseInt(hex[1].slice(0, 2), 16); g = parseInt(hex[1].slice(2, 4), 16); b = parseInt(hex[1].slice(4), 16); }
            else if (rgb) { r = Number(rgb[1]); g = Number(rgb[2]); b = Number(rgb[3]); }
            else return '#fff';
            return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000' : '#fff';
        },

        normalizeName: function(value) {
            let text = String(value || '');
            try { text = decodeURIComponent(text.replace(/\+/g, ' ')); } catch (error) { /* naam was niet URL-gecodeerd */ }
            return text.trim().toLowerCase();
        },

        findByName: function(map, name) {
            const wanted = this.normalizeName(name);
            if (!wanted || !map) return null;
            for (const item of map.values()) if (this.normalizeName(item.name) === wanted) return item;
            return null;
        },

        getWorldBucket: function(key) {
            const all = GMB.storage.get(key, {});
            return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
        },

        loadWorldData: function(key, fallback) {
            const all = this.getWorldBucket(key);
            return all[GMB.worldId || 'unknown'] || fallback;
        },

        saveWorldData: function(key, value) {
            const all = this.getWorldBucket(key);
            all[GMB.worldId || 'unknown'] = value;
            if (!GMB.storage.set(key, all)) throw new Error('Lokale instellingen konden niet worden opgeslagen.');
        },

        init: function() {
            this.tags = this.loadWorldData('map_enhancer_tags', {});
            this.koloKills = this.loadWorldData('map_kolo_kills', {});
            this.settings = Object.assign({}, this.defaults, this.loadWorldData('map_enhancer_options', {}));
            const savedSettings = this.loadWorldData('map_enhancer_options', {});
            if (!Object.prototype.hasOwnProperty.call(savedSettings, 'allianceNames')) {
                this.settings.allianceNames = !!savedSettings.playerNames;
            }
            this.addTab();
            if (GMB.storage.get('map_enhancer_enabled', false)) this.start();
        },

        addTab: function() {
            GMB_UI.addTab('mgr-map', '🗺 Kaart', `
                <div class="gmb-section">
                    <div class="gmb-section-title">Map Enhancer — lokaal per wereld</div>
                    <p class="gmb-muted">Tags, kaartlabels, inactieve spelers, oceaannummers, Helena-markering en muiswielzoom. Stadstypen en de stads-popup vind je in de tab "🖼 Iconen". Kaartbadges: eigen stad geel, eigen alliantie blauw, pact groen, oorlog rood. Tags blijven lokaal in deze browser; er is geen GME-sync-backend.</p>
                    <label><input id="gmb-map-enabled" type="checkbox"> Map Enhancer inschakelen</label>
                    <div id="gmb-map-status" class="gmb-muted" style="margin:5px 0;">Uitgeschakeld</div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Kaartopties</div>
                    <div id="gmb-map-options" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;"></div>
                    <div style="margin-top:5px">Inactief vanaf <input id="gmb-map-idle-min" type="number" min="0" max="9999" style="width:55px"> tot <input id="gmb-map-idle-max" type="number" min="0" max="9999" style="width:55px"> dagen
                        <button class="gmb-button gmb-button-secondary" id="gmb-map-idle-refresh">Inactieven vernieuwen</button>
                    </div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Tag-editor</div>
                    <div style="display:grid;grid-template-columns:80px 1fr;gap:4px;align-items:center;">
                        <label for="gmb-map-tag-type">Type / ID</label><span><select id="gmb-map-tag-type"><option value="town">Stad</option><option value="island">Eiland</option><option value="player">Speler</option><option value="alliance">Alliantie</option></select> <input id="gmb-map-tag-id" type="number" min="1" placeholder="ID" style="width:90px"></span>
                        <label for="gmb-map-tag-text">Tekst</label><input id="gmb-map-tag-text" maxlength="32" placeholder="Tag (max. 32 tekens)">
                        <label for="gmb-map-tag-color">Kleur</label><input id="gmb-map-tag-color" type="color" value="#008f9d" style="width:70px">
                    </div>
                    <button class="gmb-button" id="gmb-map-tag-save" style="margin-top:5px;">Tag opslaan</button>
                    <button class="gmb-button gmb-button-secondary" id="gmb-map-tag-delete">Tag wissen</button>
                    <div id="gmb-map-tag-list" class="gmb-muted" style="max-height:100px;overflow:auto;margin-top:5px;"></div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Import / export</div>
                    <button class="gmb-button" id="gmb-map-export">JSON kopiëren</button>
                    <button class="gmb-button gmb-button-secondary" id="gmb-map-import">Importeren (samenvoegen)</button>
                    <textarea id="gmb-map-import-data" rows="4" style="width:98%;margin-top:5px;" placeholder="Plak JSON-export of GME-regels: stad123~tekst~#008f9d"></textarea>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Activiteitenlog</div>
                    <div id="gmb-map-log" class="gmb-log-container" style="max-height:100px;"></div>
                    <button class="gmb-button gmb-button-secondary" id="gmb-map-log-clear">Log wissen</button>
                </div>`);
            const tab = document.getElementById('gmb-tab-mgr-map');
            const checkbox = tab.querySelector('#gmb-map-enabled');
            checkbox.checked = !!GMB.storage.get('map_enhancer_enabled', false);
            const optionLabels = {
                tagsOnMap: 'Tags op kaart', tagsByName: 'Tags bij stadsnamen', playerTags: 'Spelertags',
                allianceTags: 'Alliantie-tags', playerNames: 'Spelernamen op kaart', allianceNames: 'Alliantienamen op kaart', flagColors: 'Tagkleur uit vlag', inactive: 'Inactieve spelers',
                oceans: 'Oceaannummers (eilandweergave)',
                islandTagsOnMap: 'Eilandtags op kaart', koloTracker: 'Kolo-kills lokaal volgen + topic-tabel',
                helena: 'Helena-highlight',
                wheelZoom: 'Muiswiel: stad/eiland/strategische kaart'
            };
            const options = tab.querySelector('#gmb-map-options');
            options.innerHTML = Object.entries(optionLabels).map(([key, label]) =>
                `<label><input type="checkbox" data-map-option="${key}" ${this.settings[key] ? 'checked' : ''}> ${label}</label>`).join('');
            tab.querySelector('#gmb-map-idle-min').value = this.settings.inactiveMin;
            tab.querySelector('#gmb-map-idle-max').value = this.settings.inactiveMax;
            tab.querySelector('#gmb-map-tag-type').addEventListener('change', () => this.updateTagEditor());
            tab.querySelector('#gmb-map-tag-id').addEventListener('change', () => this.updateTagEditor());
            tab.querySelector('#gmb-map-tag-save').addEventListener('click', () => this.saveTagFromEditor());
            tab.querySelector('#gmb-map-tag-delete').addEventListener('click', () => this.deleteTagFromEditor());
            tab.querySelector('#gmb-map-export').addEventListener('click', () => this.exportTags());
            tab.querySelector('#gmb-map-import').addEventListener('click', () => this.importTags());
            tab.querySelector('#gmb-map-idle-refresh').addEventListener('click', () => this.fetchIdleDays());
            tab.querySelector('#gmb-map-log-clear').addEventListener('click', () => { this.activity = []; this.renderActivity(); });
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) this.start();
                else this.stop('Handmatig uitgeschakeld.');
            });
            options.addEventListener('change', event => {
                const key = event.target.dataset.mapOption;
                if (!key) return;
                const previous = this.settings[key];
                this.settings[key] = event.target.checked;
                try { this.saveSettings(); }
                catch (error) {
                    this.settings[key] = previous;
                    event.target.checked = !!previous;
                    this.setStatus(error.message, true);
                    return;
                }
                this.record(`${optionLabels[key]} ${event.target.checked ? 'ingeschakeld' : 'uitgeschakeld'}.`);
                if (key === 'inactive' && event.target.checked) this.fetchIdleDays();
                if (key === 'koloTracker') {
                    if (event.target.checked) this.startKoloTracker();
                    else this.stopKoloTracker();
                }
                this.renderMap();
            });
            ['gmb-map-idle-min', 'gmb-map-idle-max'].forEach(id => tab.querySelector(`#${id}`).addEventListener('change', () => {
                const min = Number(tab.querySelector('#gmb-map-idle-min').value);
                const max = Number(tab.querySelector('#gmb-map-idle-max').value);
                if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) {
                    this.setStatus('Ongeldig inactiviteitsbereik; gebruik 0 of hoger en max ≥ min.', true);
                    return;
                }
                const previousMin = this.settings.inactiveMin;
                const previousMax = this.settings.inactiveMax;
                this.settings.inactiveMin = min;
                this.settings.inactiveMax = max;
                try { this.saveSettings(); }
                catch (error) {
                    this.settings.inactiveMin = previousMin;
                    this.settings.inactiveMax = previousMax;
                    tab.querySelector('#gmb-map-idle-min').value = previousMin;
                    tab.querySelector('#gmb-map-idle-max').value = previousMax;
                    this.setStatus(error.message, true);
                    return;
                }
                this.renderMap();
            }));
            this.updateTagEditor();
            this.renderTagList();
            this.renderActivity();
            this.setStatus(checkbox.checked ? 'Wordt gestart…' : 'Uitgeschakeld');
        },

        setStatus: function(text, error = false) {
            const status = document.getElementById('gmb-map-status');
            if (status) { status.textContent = text; status.style.color = error ? '#d66' : ''; }
        },

        record: function(message, type = 'info') {
            const item = { at: new Date().toLocaleTimeString(), message, type };
            this.activity.push(item);
            this.activity = this.activity.slice(-30);
            GMB.log('Map', message, type);
            this.renderActivity();
        },

        renderActivity: function() {
            const container = document.getElementById('gmb-map-log');
            if (!container) return;
            container.replaceChildren(...this.activity.map(item => {
                const row = document.createElement('div');
                row.className = `gmb-log-entry gmb-log-${item.type}`;
                row.textContent = `[${item.at}] ${item.message}`;
                return row;
            }));
            container.scrollTop = container.scrollHeight;
        },

        saveSettings: function() {
            this.saveWorldData('map_enhancer_options', this.settings);
        },

        saveTags: function() {
            this.saveWorldData('map_enhancer_tags', this.tags);
        },

        updateTagEditor: function() {
            const tab = document.getElementById('gmb-tab-mgr-map');
            if (!tab) return;
            const type = tab.querySelector('#gmb-map-tag-type').value;
            const id = Number(tab.querySelector('#gmb-map-tag-id').value);
            const entry = this.tags[`${type}:${id}`];
            tab.querySelector('#gmb-map-tag-text').value = entry ? entry.text : '';
            tab.querySelector('#gmb-map-tag-color').value = entry && /^#[0-9a-f]{6}$/i.test(entry.color) ? entry.color : '#008f9d';
        },

        // icon-parameter verwijderd: stadstypen leven in IconTools (icontools_town_types)
        applyEntry: function(type, id, text, color) {
            if (!this.tagTypes.includes(type) || !Number.isInteger(id) || id < 1) return 'Vul een geldig type en ID in.';
            if (text && !this.isValidTagText(text)) return 'Tag bevat verboden tekens of is langer dan 32 tekens; toegestaan: letters, cijfers, spatie, . _ [ ] ( ) - : ? & ;';
            if (text && !/^#[0-9a-f]{6}$/i.test(color || '')) return 'Ongeldige kleur.';
            const key = `${type}:${id}`;
            const previousTag = this.tags[key];
            try {
                if (text) this.tags[key] = { text, color };
                else delete this.tags[key];
                this.saveTags();
            } catch (error) {
                if (previousTag) this.tags[key] = previousTag; else delete this.tags[key];
                return error.message;
            }
            this.renderTagList();
            this.renderMap();
            this.record(`${this.tagTypeLabels[type]} ${id} bijgewerkt.`);
            return null;
        },

        saveTagFromEditor: function() {
            const tab = document.getElementById('gmb-tab-mgr-map');
            const type = tab.querySelector('#gmb-map-tag-type').value;
            const id = Number(tab.querySelector('#gmb-map-tag-id').value);
            const text = tab.querySelector('#gmb-map-tag-text').value.trim();
            const color = tab.querySelector('#gmb-map-tag-color').value;
            const error = this.applyEntry(type, id, text, color);
            if (error) { this.record(error, 'error'); return this.setStatus(error, true); }
            this.setStatus(`Opgeslagen: ${type} ${id}.`);
        },

        deleteTagFromEditor: function() {
            const tab = document.getElementById('gmb-tab-mgr-map');
            const type = tab.querySelector('#gmb-map-tag-type').value;
            const id = Number(tab.querySelector('#gmb-map-tag-id').value);
            if (!Number.isInteger(id) || id < 1) return this.setStatus('Vul eerst een geldig ID in.', true);
            delete this.tags[`${type}:${id}`];
            try {
                this.saveTags();
                this.renderTagList();
                this.renderMap();
                this.record(`${type} ${id} verwijderd.`);
                this.setStatus(`Verwijderd: ${type} ${id}.`);
            } catch (error) { this.setStatus(error.message, true); this.record(error.message, 'error'); }
        },

        renderTagList: function() {
            const container = document.getElementById('gmb-map-tag-list');
            if (!container) return;
            const entries = Object.entries(this.tags);
            container.replaceChildren();
            if (!entries.length) { container.textContent = 'Nog geen tags.'; return; }
            entries.slice(0, 100).forEach(([key, entry]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gmb-button gmb-button-secondary';
                button.textContent = `${key} — ${entry.text}`;
                button.addEventListener('click', () => {
                    const [type, id] = key.split(':');
                    const tab = document.getElementById('gmb-tab-mgr-map');
                    tab.querySelector('#gmb-map-tag-type').value = type;
                    tab.querySelector('#gmb-map-tag-id').value = id;
                    this.updateTagEditor();
                });
                container.appendChild(button);
            });
            if (entries.length > 100) {
                const more = document.createElement('span');
                more.textContent = ` (${entries.length - 100} meer; export bevat alles)`;
                container.appendChild(more);
            }
        },

        normalizeImportedKey: function(value) {
            const match = String(value).match(/^(town|island|player|alliance):(\d+)$/i);
            if (match) return `${match[1].toLowerCase()}:${Number(match[2])}`;
            const legacy = String(value).match(/^(stad|eila|spel|alli)(\d+)$/i);
            if (!legacy) return null;
            const types = { stad: 'town', eila: 'island', spel: 'player', alli: 'alliance' };
            return `${types[legacy[1].toLowerCase()]}:${Number(legacy[2])}`;
        },

        exportTags: async function() {
            const payload = JSON.stringify({ format: 'gmb-map-tags-v1', worldId: GMB.worldId, tags: this.tags }, null, 2);
            try {
                if (typeof GM_setClipboard === 'function') GM_setClipboard(payload, 'text');
                else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(payload);
                else throw new Error('Klembord-API niet beschikbaar.');
                this.record(`${Object.keys(this.tags).length} tags naar klembord gekopieerd.`, 'success');
                this.setStatus('JSON-export naar klembord gekopieerd.');
            } catch (error) { this.record(`Export mislukt: ${error.message}`, 'error'); this.setStatus(error.message, true); }
        },

        importTags: function() {
            const textarea = document.getElementById('gmb-map-import-data');
            const text = textarea.value.trim();
            if (!text) return this.setStatus('Plak eerst exportdata in het tekstvak.', true);
            let importedTags = {};
            try {
                if (text.startsWith('{')) {
                    const payload = JSON.parse(text);
                    if (payload.format !== 'gmb-map-tags-v1' || !payload.tags || typeof payload.tags !== 'object' || Array.isArray(payload.tags)) {
                        throw new Error('Onbekend exportformaat.');
                    }
                    if (payload.worldId && payload.worldId !== GMB.worldId) throw new Error(`Export hoort bij wereld ${payload.worldId}, niet bij ${GMB.worldId}.`);
                    Object.entries(payload.tags).forEach(([rawKey, entry]) => {
                        const key = this.normalizeImportedKey(rawKey);
                        if (!key || !entry || typeof entry.text !== 'string' || !/^[a-z0-9 ._\[\]()\-:?&;]{1,32}$/i.test(entry.text) ||
                            (entry.color && !/^#[0-9a-f]{6}$/i.test(entry.color))) throw new Error(`Ongeldige tag: ${rawKey}`);
                        importedTags[key] = { text: entry.text, color: entry.color || '#008f9d' };
                    });
                } else {
                    text.split(/\r?\n/).forEach((line, index) => {
                        if (!line.trim()) return;
                        const [rawKey, rawText, color] = line.split('~');
                        const key = this.normalizeImportedKey(rawKey);
                        if (!key || rawText == null || !/^[a-z0-9 ._\[\]()\-:?&;]{1,32}$/i.test(rawText) ||
                            (color && color !== 'undefined' && !/^#[0-9a-f]{6}$/i.test(color)) || line.split('~').length !== 3) {
                            throw new Error(`Ongeldige importregel ${index + 1}.`);
                        }
                        importedTags[key] = { text: rawText, color: color && color !== 'undefined' ? color : '#008f9d' };
                    });
                }
                const newTags = Object.assign({}, this.tags, importedTags);
                this.saveWorldData('map_enhancer_tags', newTags);
                this.tags = newTags;
                this.renderTagList();
                this.renderMap();
                this.record(`${Object.keys(importedTags).length} tags geïmporteerd (samengevoegd).`, 'success');
                this.setStatus('Import voltooid; bestaande tags zijn behouden.');
            } catch (error) { this.record(`Import mislukt: ${error.message}`, 'error'); this.setStatus(error.message, true); }
        },

        start: function() {
                        if (this.enabled) return;
            this.enabled = true;
            GMB.storage.set('map_enhancer_enabled', true);
            const toggle = document.getElementById('gmb-map-enabled');
            if (toggle) toggle.checked = true;
            this.fetchWorldData();
            if (this.settings.inactive) this.fetchIdleDays();
            if (this.settings.koloTracker) this.startKoloTracker();
            this.applyStyles();
            this.observer = new MutationObserver(records => {
                const selector = '#map_move_container, #towninfo_towninfo, .island_info.clearfix, #player_info';
                if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    (node.matches(selector) || node.querySelector(selector))))) {
                    this.attachMapObserver();
                    this.scheduleRender();
                }
            });
            this.observer.observe(document.body, { childList: true });
            this.attachMapObserver();
            this.hookWindowOpen();
            this.wheelHandler = event => this.handleWheel(event);
            document.addEventListener('wheel', this.wheelHandler, { capture: true, passive: false });
            this.renderMap();
            this.record('Kaartverbeteringen ingeschakeld.');
            this.setStatus('Actief — lokale wereldinstellingen geladen.');
        },

        attachMapObserver: function() {
            const root = document.getElementById('map_move_container');
            if (root === this.mapRoot) return;
            if (this.mapObserver) this.mapObserver.disconnect();
            this.mapObserver = null;
            this.mapRoot = root;
            if (!root || !this.enabled) return;
            const ownSelector = '.gmb-map-marker-stack, .gmb-map-label, .gmb-map-badge, .gmb-map-inactive, .gmb-island-map-labels, #gmb_oceanNumbers, .gmb-icontools-mapicon';
            this.mapObserver = new MutationObserver(records => {
                const relevant = records.some(record => {
                    const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
                    if (target && target.closest(ownSelector)) return false;
                    return [...record.addedNodes, ...record.removedNodes].some(node =>
                        node.nodeType === Node.ELEMENT_NODE && !node.matches(ownSelector) && !node.closest(ownSelector));
                });
                if (relevant) this.scheduleRender();
            });
            this.mapObserver.observe(root, { childList: true, subtree: true });
        },

        stop: function(reason = 'Uitgeschakeld.') {
            this.enabled = false;
            GMB.storage.set('map_enhancer_enabled', false);
            if (this.observer) this.observer.disconnect();
            this.observer = null;
            if (this.mapObserver) this.mapObserver.disconnect();
            this.mapObserver = null;
            this.mapRoot = null;
            if (this.renderTimer) clearTimeout(this.renderTimer);
            this.renderTimer = null;
            if (this.renderFrame) cancelAnimationFrame(this.renderFrame);
            this.renderFrame = null;
            if (this.wheelHandler) document.removeEventListener('wheel', this.wheelHandler, true);
            this.wheelHandler = null;
            document.documentElement.classList.remove('gmb-map-helen-highlight');
            this.unhookWindowOpen();
            this.stopKoloTracker();
            this.closeEditor();
            document.querySelectorAll('.gmb-map-label, .gmb-map-badge, .gmb-map-icon, .gmb-map-inactive, .gmb-map-edit-btn, .gmb-island-map-labels, .gmb-kolo-topic, #gmb_oceanNumbers, .gmb-map-popup').forEach(node => node.remove());
            const toggle = document.getElementById('gmb-map-enabled');
            if (toggle) toggle.checked = false;
            const status = document.getElementById('gmb-map-status');
            if (status) status.textContent = reason;
            if (reason) this.record(reason);
        },

        scheduleRender: function() {
            if (!this.enabled || this.renderTimer) return;
            const wait = Math.max(0, 1500 - (Date.now() - this.lastRenderAt));
            this.renderTimer = setTimeout(() => {
                this.renderTimer = null;
                const render = () => {
                    this.renderFrame = null;
                    if (this.enabled) this.renderMap();
                };
                this.renderFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(render) : setTimeout(render, 0);
            }, wait);
        },

        fetchWorldData: async function() {
            const loaders = [
                ['towns', () => GMB_WorldData.getTowns(), 'byId'],
                ['players', () => GMB_WorldData.getPlayers(), 'byId'],
                ['alliances', () => GMB_WorldData.getAlliances(), 'byId'],
                ['islands', () => GMB_WorldData.getIslands(), 'list']
            ];
            for (const [key, load, index] of loaders) {
                try {
                    const data = await load();
                    this.worldData[key] = data[index];
                    if (key === 'islands') this.indexIslands();
                } catch (error) {
                    GMB.log('Map', `Werelddata ${key} niet beschikbaar: ${error.message}`, 'warn');
                }
            }
            if (this.enabled) this.scheduleRender();
        },

        indexIslands: function() {
            const index = new Map();
            (Array.isArray(this.worldData.islands) ? this.worldData.islands : []).forEach(island => {
                const x = Number(island.x);
                const y = Number(island.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                const key = `${Math.floor(x / 20)}|${Math.floor(y / 20)}`;
                if (!index.has(key)) index.set(key, []);
                index.get(key).push(island);
            });
            this.islandSpatialIndex = index;
        },

        fetchIdleDays: async function() {
            if (!this.enabled) return this.setStatus('Schakel Map Enhancer in om inactiviteitsdata te laden.', true);
            try {
                const url = `https://www.grcrt.net/json.php?method=getIdleJSON&world=${encodeURIComponent(GMB.worldId || '')}`;
                const response = await GMB_API.externalGet(url, { timeout: 20000 });
                const data = await response.json();
                const values = data && (data.JSON || data.json && data.json.JSON);
                if (!values || typeof values !== 'object') throw new Error('GRCRT-response bevat geen idle-JSON.');
                this.idleDays = values;
                this.record(`Inactiviteitsdata geladen (${Object.keys(values).length} spelers).`, 'success');
                this.scheduleRender();
            } catch (error) {
                {
                    this.record(`Inactiviteitsdata laden mislukt: ${error.message}`, 'error');
                    this.setStatus(`Inactieven niet beschikbaar: ${error.message}`, true);
                }
            }
        },

        startKoloTracker: function() {
            if (!this.enabled || this.koloTimer) return;
            this.fetchKoloKills();
            this.koloTimer = setInterval(() => {
                if (!this.enabled) return this.stopKoloTracker();
                this.fetchKoloKills();
            }, 30 * 60 * 1000);
        },

        stopKoloTracker: function() {
            if (this.koloTimer) clearInterval(this.koloTimer);
            this.koloTimer = null;
        },

        parseKoloKillCount: function(html) {
            const chunks = String(html || '').split('colonize');
            if (chunks.length < 4) throw new Error('De kolonisatie-rapportgegevens zijn niet herkenbaar.');
            const parseChunk = chunk => {
                const match = String(chunk).match(/\d{1,}/);
                if (!match) throw new Error('Een kolonisatie-verliesaantal ontbreekt.');
                return Number(match[0]);
            };
            const count = parseChunk(chunks[1]) + parseChunk(chunks[3]);
            if (!Number.isSafeInteger(count) || count < 0) throw new Error('Ongeldig Kolo-kill-aantal.');
            return count;
        },

        fetchKoloKills: async function() {
            if (!this.enabled || !this.settings.koloTracker) return;
            const uw = GMB_API.getUW();
            const game = uw.Game || {};
            const townId = Number(game.townId || GMB.townId);
            const playerId = Number(game.player_id || GMB.playerId);
            const playerName = String(game.player_name || game.playerName || `Speler ${playerId}`);
            if (!townId || !playerId) {
                this.record('Kolo-teller overgeslagen: huidige speler/stad niet beschikbaar.', 'warn');
                return;
            }
            try {
                const response = await GMB_API.get('building_wall', 'index', {
                    json: JSON.stringify({ town_id: townId, nl_init: GMB_API.nlInit() })
                }, townId);
                const html = response && response.plain && response.plain.html;
                const kills = this.parseKoloKillCount(html);
                const previous = Number(this.koloKills[playerId] && this.koloKills[playerId].kills) || 0;
                if (kills > previous) {
                    this.koloKills[playerId] = { playerId, playerName, kills, updatedAt: Date.now() };
                    this.saveWorldData('map_kolo_kills', this.koloKills);
                    this.record(`Kolo-kills bijgewerkt: ${playerName} — ${kills}.`, 'success');
                    this.updateKoloTopic();
                }
            } catch (error) {
                if (true) this.record(`Kolo-kills lezen mislukt: ${error.message}`, 'error');
            }
        },

        updateKoloTopic: function() {
            const title = document.querySelector('#threadtitle');
            if (!title || !/kolo.?kills/i.test(title.textContent || '')) return;
            const forum = document.querySelector('#forum');
            if (!forum) return;
            const target = forum.querySelector('.post_body, .post_content') ||
                (forum.children[2] && forum.children[2].children[0]) || forum;
            let table = target.querySelector(':scope > .gmb-kolo-topic');
            const entries = Object.values(this.koloKills).filter(item => item && Number.isFinite(Number(item.kills)))
                .sort((a, b) => Number(b.kills) - Number(a.kills));
            if (!entries.length) return;
            if (!table) {
                table = document.createElement('div');
                table.className = 'gmb-kolo-topic';
                target.appendChild(table);
            }
            table.replaceChildren();
            const heading = document.createElement('strong');
            heading.textContent = 'Kolo-kills (lokaal in deze browser)';
            table.appendChild(heading);
            const grid = document.createElement('table');
            const head = document.createElement('tr');
            ['Speler', 'Kills'].forEach(text => {
                const cell = document.createElement('th');
                cell.textContent = text;
                head.appendChild(cell);
            });
            grid.appendChild(head);
            entries.forEach(item => {
                const row = document.createElement('tr');
                [item.playerName || `Speler ${item.playerId}`, Number(item.kills).toLocaleString('nl-NL')].forEach(text => {
                    const cell = document.createElement('td');
                    cell.textContent = text;
                    row.appendChild(cell);
                });
                grid.appendChild(row);
            });
            table.appendChild(grid);
        },

        applyStyles: function() {
            if (document.getElementById('gmb-map-styles')) return;
            const style = document.createElement('style');
            style.id = 'gmb-map-styles';
            style.textContent = `
                .gmb-map-badge{display:inline-block;margin:1px 2px;padding:1px 4px;border-radius:3px;background:#111;color:#fff;font-size:10px;line-height:13px;text-shadow:0 1px 1px rgba(0,0,0,.6);white-space:nowrap;pointer-events:none;vertical-align:middle}
                .gmb-map-marker-stack{position:absolute;left:100%;top:50%;margin-left:2px;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:1px;z-index:600;pointer-events:none;white-space:nowrap;font:10px/13px Arial}
                .gmb-map-label{display:flex;flex-direction:column;align-items:center;gap:1px}
                .gmb-map-label .gmb-map-badge{margin:0;box-shadow:0 0 2px #000}
                .gmb-map-label .gmb-map-line{display:flex;gap:2px;align-items:center;justify-content:center}
                .gmb-map-name{display:inline-block;padding:1px 4px;border:1px solid #aaa;border-radius:3px;background:rgba(65,65,58,.94);color:#f5f0df;text-shadow:0 1px 1px #000;font:10px/13px Arial;white-space:nowrap;box-shadow:0 0 2px #000}
                .gmb-island-map-labels{position:absolute;inset:0;pointer-events:none;z-index:599}
                .gmb-map-island-label{position:absolute;transform:translate(-50%,-50%);pointer-events:none}
                .gmb-map-name{white-space:pre-line;text-align:center;line-height:12px}
                .gmb-kolo-topic{margin:8px 0;padding:6px;border:1px solid #c7b287;background:rgba(248,241,221,.94);color:#322719}
                .gmb-kolo-topic table{border-collapse:collapse;width:100%}
                .gmb-kolo-topic th,.gmb-kolo-topic td{padding:3px 8px;border:1px solid #bba97e;text-align:left}
                .gmb-map-inactive{position:absolute;right:100%;top:-8px;padding:1px 3px;border-radius:3px;background:#b33;color:white;font:bold 9px Arial;z-index:602;pointer-events:none}
                #gmb_oceanNumbers{position:absolute;top:0;left:0;pointer-events:none}
                .gmb-map-ocean-cell{position:absolute;display:block;z-index:2;opacity:.1;width:12800px;height:12800px;pointer-events:none}
                .gmb-map-edit-btn{display:inline-block;margin-left:6px;padding:0 6px;border:1px solid #7a5b1c;border-radius:3px;background:linear-gradient(#e4c072,#b78a2c);color:#2a1a00;font:bold 11px/16px Arial;cursor:pointer;vertical-align:middle;text-shadow:none;float:none}
                .gmb-map-edit-btn:hover{filter:brightness(1.15)}
                .gmb-map-editor{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:2147483001;width:340px;padding:10px 12px;border:2px solid #c5a45a;border-radius:6px;background:#2b2418;color:#f5e7c2;font:12px Arial;box-shadow:0 6px 24px #000}
                .gmb-map-editor h4{margin:0 0 8px;font-size:14px;color:#ffd77a}
                .gmb-map-editor label{display:block;margin:6px 0 2px}
                .gmb-map-editor input[type=text],.gmb-map-editor input[type=number]{width:96%;box-sizing:border-box;padding:3px 5px}
                .gmb-map-editor .gmb-map-editor-error{min-height:15px;margin-top:5px;color:#ff8c7a}
                .gmb-map-editor .gmb-map-editor-actions{display:flex;gap:6px;margin-top:8px}
                .gmb-map-swatches{display:flex;gap:4px;align-items:center;margin-top:3px}
                .gmb-map-swatch{width:18px;height:18px;border:1px solid #000;border-radius:3px;cursor:pointer}
                .gmb-map-helen-highlight .attack_support_window .unit_icon40x40.helen,.gmb-map-helen-highlight .attack_support_window .unit_icon40x40.zuretha,.gmb-map-helen-highlight .attack_support_window .unit_icon40x40.deimos{animation:gmb-map-helen-pulse 1s steps(30,start) infinite}
                @keyframes gmb-map-helen-pulse{50%{box-shadow:0 0 5px 6px #f00}}
            `;
            document.head.appendChild(style);
        },

        getPayloadId: function(link) {
            try {
                const hash = link && link.hash;
                if (!hash || hash.length < 2) return null;
                const decoded = JSON.parse(atob(hash.slice(1)));
                return Number(decoded.id) || null;
            } catch (error) { return null; }
        },

        getTownId: function(node) {
            if (!node) return null;
            const link = node.matches && node.matches('.gp_town_link') ? node : node.closest && node.closest('.gp_town_link');
            const linkedId = this.getPayloadId(link);
            if (linkedId) return linkedId;
            let current = node;
            for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) {
                const match = String(current.id || '').match(/(?:^|_)(?:town_flag_|town_|mini_t|gt_)?(\d+)$/);
                if (match) return Number(match[1]);
            }
            const id = Number(node.getAttribute && (node.getAttribute('data-town-id') || node.getAttribute('data-id')));
            return Number.isInteger(id) && id > 0 ? id : null;
        },

        getOrientation: function(node) {
            let current = node;
            for (let depth = 0; current && depth < 4; depth++, current = current.parentElement) {
                const classes = String(current.className || '');
                const match = classes.match(/(?:^|\s)(sw|nw|ne|se)(?:\s|$)/i);
                if (match) return match[1].toLowerCase();
            }
            return 'none';
        },

        refreshAllianceRelations: function() {
            const relations = new Map();
            const uw = GMB_API.getUW();
            try {
                const mm = uw.MM;
                let collection = mm && typeof mm.getOnlyCollectionByName === 'function'
                    ? mm.getOnlyCollectionByName('AlliancePact')
                    : null;
                let models = collection && collection.models;
                if (!models && mm && typeof mm.getCollections === 'function') {
                    const collections = mm.getCollections();
                    const pactCollection = collections && collections.AlliancePact;
                    models = Array.isArray(pactCollection)
                        ? pactCollection.flatMap(item => item && item.models || [])
                        : pactCollection && pactCollection.models;
                }
                (models || []).forEach(pact => {
                    if (typeof pact.getInvitationPending === 'function' && pact.getInvitationPending()) return;
                    const relation = typeof pact.getRelation === 'function' ? pact.getRelation() :
                        pact.attributes && pact.attributes.relation;
                    if (relation !== 'war' && relation !== 'peace') return;
                    const first = Number(typeof pact.getAlliance1Id === 'function' ? pact.getAlliance1Id() :
                        pact.attributes && pact.attributes.alliance_1_id);
                    const second = Number(typeof pact.getAlliance2Id === 'function' ? pact.getAlliance2Id() :
                        pact.attributes && pact.attributes.alliance_2_id);
                    const ownAlliance = Number(GMB.allianceId || uw.Game && uw.Game.alliance_id);
                    const other = first === ownAlliance ? second : second === ownAlliance ? first : 0;
                    if (other) relations.set(other, relation === 'war' ? 'enemy' : 'pact');
                });
            } catch (error) {
                GMB.log('Map', `Alliantie-relaties niet beschikbaar: ${error.message}`, 'warn');
            }
            this.allianceRelations = relations;
        },

        relationForTown: function(townId) {
            const town = this.worldData.towns.get(Number(townId));
            const player = town && this.worldData.players.get(Number(town.playerId));
            const uw = GMB_API.getUW();
            const currentPlayerId = Number(GMB.playerId || uw.Game && uw.Game.player_id);
            const currentAllianceId = Number(GMB.allianceId || uw.Game && uw.Game.alliance_id);
            if (player && Number(player.id) === currentPlayerId) return 'own';
            const allianceId = Number(player && player.allianceId);
            if (allianceId && allianceId === currentAllianceId) return 'alliance';
            return allianceId ? this.allianceRelations.get(allianceId) || 'neutral' : 'neutral';
        },

        relationColor: function(townId) {
            const colors = { own: '#ffd700', alliance: '#1976d2', pact: '#2e8b57', enemy: '#c62828' };
            return colors[this.relationForTown(townId)] || null;
        },

        // Geeft rijen {kind, name, tag:{text,color}|null, title} terug voor stad, speler en alliantie.
        getTownDecorations: function(townId, marker) {
            const town = this.worldData.towns.get(Number(townId));
            if (!town) return [];
            const rows = [];
            const flagColor = () => {
                const flag = marker && marker.querySelector && marker.querySelector('.flagpole, .flag, .flagpole_inner');
                if (!flag) return null;
                const background = getComputedStyle(flag).backgroundColor;
                return background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent' ? background : null;
            };
            const make = (kind, type, id, name, enabled) => {
                const entry = enabled ? this.tags[`${type}:${id}`] : null;
                const tag = entry && entry.text ? {
                    text: entry.text,
                    color: this.relationColor(townId) || (this.settings.flagColors && kind !== 'town' && flagColor()) || entry.color || '#008f9d'
                } : null;
                if (tag || name) rows.push({ kind, name: name || '', tag, title: `${this.tagTypeLabels[type]} ${id}: ${(tag && tag.text) || name}` });
            };
            make('town', 'town', townId, '', true);
            const player = this.worldData.players.get(Number(town.playerId));
            if (player) {
                make('player', 'player', player.id, this.normalizeNameForDisplay(player.name), this.settings.playerTags);
                const alliance = player.allianceId && this.worldData.alliances.get(Number(player.allianceId));
                if (alliance) make('alliance', 'alliance', alliance.id, this.normalizeNameForDisplay(alliance.name), this.settings.allianceTags);
            }
            return rows;
        },

        normalizeNameForDisplay: function(value) {
            let text = String(value || '');
            try { text = decodeURIComponent(text.replace(/\+/g, ' ')); } catch (error) { /* geen URL-codering */ }
            return text;
        },

        makeBadge: function(text, color, title) {
            const badge = document.createElement('span');
            badge.className = 'gmb-map-badge';
            badge.textContent = text;
            if (title) badge.title = title;
            badge.style.backgroundColor = color;
            badge.style.color = this.textColorFor(color);
            return badge;
        },

        renderMap: function() {
            if (!this.enabled) return;
            this.lastRenderAt = Date.now();
            this.refreshAllianceRelations();
            this.attachMapObserver();
            document.documentElement.classList.toggle('gmb-map-helen-highlight', !!this.settings.helena);
            this.renderTownNames();
            this.renderIslands();
            this.renderTownMarkers();
            this.renderIslandMapLabels();
            this.renderIslandLinks();
            this.renderOceanNumbers();
            this.renderEditButtons();
            this.updateKoloTopic();
        },

        clearChildren: function(parent, selector) {
            parent.querySelectorAll(`:scope > ${selector}`).forEach(node => node.remove());
        },

        renderTownNames: function() {
            // Speler-/alliantietags bij stadsnamen niet op de strategische kaart tonen
            if (this.isStrategicMapView()) {
                document.querySelectorAll('[class*="gmb-map-name-"]').forEach(n => n.remove());
                return;
            }
            document.querySelectorAll('.gp_town_link').forEach(link => {
                const id = this.getPayloadId(link);
                if (!id) return;
                const parent = link.parentElement || link;
                const className = `gmb-map-name-${id}`;
                const existing = [...parent.querySelectorAll(`:scope > .${className}`)];
                const decorations = this.settings.tagsByName ? this.getTownDecorations(id, link).filter(item => item.tag) : [];
                const signature = JSON.stringify(decorations.map(item => [item.kind, item.tag.text, item.tag.color]));
                if (existing.length === decorations.length && existing.every(node => node.dataset.gmbSignature === signature)) return;
                existing.forEach(node => node.remove());
                if (!decorations.length) return;
                let anchor = link;
                decorations.forEach(item => {
                    const prefix = item.kind === 'player' ? '👤 ' : item.kind === 'alliance' ? '⚑ ' : '';
                    const badge = this.makeBadge(`${prefix}${item.tag.text}`, item.tag.color, item.title);
                    badge.classList.add(className);
                    badge.dataset.gmbSignature = signature;
                    anchor.insertAdjacentElement('afterend', badge);
                    anchor = badge;
                });
            });
        },

        renderTownMarkers: function() {
            const nodes = document.querySelectorAll('[id^="town_flag_"], #minimap_islands_layer .m_town[id], [id^="mini_t"]');
            const viewMode = this.activeMapMode();
            const strategicView = viewMode ? viewMode === 'strategic_map' : null;
            let rendered = 0;
            for (const node of nodes) {
                if (rendered >= this.maxRenderedMarkers) break;
                const townId = this.getTownId(node);
                if (!townId) continue;
                const marker = node.matches('.flagpole') ? node.parentElement : node;
                const rect = marker.getBoundingClientRect();
                if (!rect.width || !rect.height || rect.right < 0 || rect.bottom < 0 ||
                    rect.left > window.innerWidth || rect.top > window.innerHeight) continue;
                rendered++;
                // Tags en namen worden niet op de strategische kaart getoond
                const isStrategicMap = strategicView !== null ? strategicView : this.isStrategicMapView(node);
                const decorations = this.settings.tagsOnMap ? this.getTownDecorations(townId, marker) : [];
                const tagged = isStrategicMap ? [] : decorations.filter(item => item.tag);
                const names = isStrategicMap ? [] : [
                    ...(this.settings.playerNames ? decorations.filter(item => item.kind === 'player' && item.name).map(item => item.name) : []),
                    ...(this.settings.allianceNames ? decorations.filter(item => item.kind === 'alliance' && item.name).map(item => item.name) : [])
                ];
                const playerId = (this.worldData.towns.get(townId) || {}).playerId;
                const days = this.settings.inactive ? Number(this.idleDays[playerId]) : NaN;
                const inactive = Number.isFinite(days) && days >= this.settings.inactiveMin && days <= this.settings.inactiveMax
                    ? Math.floor(days) : null;
                const signature = JSON.stringify({
                    tags: tagged.map(item => [item.kind, item.tag.text, item.tag.color]),
                    names, relation: this.relationForTown(townId), inactive
                });
                const stackExists = !!marker.querySelector(':scope > .gmb-map-marker-stack');
                const inactiveExists = !!marker.querySelector(':scope > .gmb-map-inactive');
                if (marker.dataset.gmbMapRenderSignature === signature &&
                    (stackExists || (!tagged.length && !names.length)) &&
                    inactiveExists === (inactive !== null)) continue;
                this.clearChildren(marker, '.gmb-map-marker-stack, .gmb-map-label, .gmb-map-icon, .gmb-map-inactive');
                if (getComputedStyle(marker).position === 'static') marker.style.position = 'relative';
                marker.dataset.gmbMapRenderSignature = signature;
                let stack = null;
                const ensureStack = () => {
                    if (!stack) {
                        stack = document.createElement('div');
                        stack.className = 'gmb-map-marker-stack';
                        marker.appendChild(stack);
                    }
                    return stack;
                };
                if (this.settings.tagsOnMap) {
                    if (tagged.length || names.length) {
                        const label = document.createElement('div');
                        label.className = 'gmb-map-label';
                        tagged.forEach(item => {
                            const line = document.createElement('div');
                            line.className = 'gmb-map-line';
                            line.appendChild(this.makeBadge(item.tag.text, item.tag.color, item.title));
                            label.appendChild(line);
                        });
                        if (names.length) {
                            const line = document.createElement('div');
                            line.className = 'gmb-map-line';
                            const name = document.createElement('span');
                            name.className = 'gmb-map-name';
                            name.textContent = names.join('\n');
                            const color = this.relationColor(townId);
                            if (color) {
                                name.style.backgroundColor = color;
                                name.style.color = this.textColorFor(color);
                            }
                            line.appendChild(name);
                            label.appendChild(line);
                        }
                        ensureStack().appendChild(label);
                    }
                }
                if (inactive !== null) {
                    const badge = document.createElement('span');
                    badge.className = 'gmb-map-inactive';
                    badge.textContent = `${inactive}d`;
                    badge.title = `${inactive} dagen inactief`;
                    marker.appendChild(badge);
                }
            }
        },

        // Zoals DIO Tools (OceanNumbers) en GRCRT: 10x10 oceaanafbeeldingen in #map_move_container, niet per stad.
        renderOceanNumbers: function() {
            const existing = document.getElementById('gmb_oceanNumbers');
            if (!this.settings.oceans) { if (existing) existing.remove(); return; }
            if (existing || document.getElementById('dio_oceanNumbers') || document.getElementById('grcrt_oceanNumbers')) return;
            const container = document.getElementById('map_move_container');
            if (!container) return;
            const uw = GMB_API.getUW();
            let helpers = null;
            try { helpers = typeof uw.require === 'function' ? uw.require('map/helpers') : null; } catch (error) { helpers = null; }
            helpers = helpers || uw.MapTiles;
            if (!helpers || typeof helpers.map2Pixel !== 'function') {
                GMB.log('Map', 'Oceaannummers niet geplaatst: map2Pixel niet beschikbaar.', 'warn');
                return;
            }
            const wrapper = document.createElement('div');
            wrapper.id = 'gmb_oceanNumbers';
            for (let d = 0; d < 10; d++) {
                for (let k = 0; k < 10; k++) {
                    const pixel = helpers.map2Pixel(100 * k, 100 * d);
                    const cell = document.createElement('div');
                    cell.className = 'gmb-map-ocean-cell';
                    cell.style.left = `${pixel.x}px`;
                    cell.style.top = `${pixel.y}px`;
                    cell.style.backgroundImage = `url(${this.oceanImageUrl}${k}${d}.png)`;
                    wrapper.appendChild(cell);
                }
            }
            container.appendChild(wrapper);
        },

        getIslandId: function(info) {
            const input = info && info.querySelector('#island_bbcode_id, input[value^="[island]"]');
            const bbcode = input && String(input.value).match(/\[island\](\d+)\[\/island\]/i);
            if (bbcode) return Number(bbcode[1]);
            const heading = info && info.querySelector('h4');
            const text = heading && String(heading.firstChild && heading.firstChild.textContent || heading.textContent).match(/(\d+)/);
            return text ? Number(text[1]) : null;
        },

        renderIslands: function() {
            document.querySelectorAll('.island_info h4, #island_info h4').forEach(heading => {
                const info = heading.closest('.island_info') || heading.parentElement;
                const id = this.getIslandId(info) || this.getPayloadId(heading.querySelector('.gp_island_link'));
                const current = heading.querySelectorAll(':scope > .gmb-map-island-chip');
                const entry = id && this.settings.tagsOnMap && this.tags[`island:${id}`];
                if (!entry || !entry.text) {
                    current.forEach(node => node.remove());
                    return;
                }
                const signature = `${entry.text}|${entry.color || '#008f9d'}`;
                if (current.length === 1 && current[0].dataset.gmbSignature === signature) return;
                current.forEach(node => node.remove());
                const badge = this.makeBadge(entry.text, entry.color || '#008f9d', `Eiland ${id}: ${entry.text}`);
                badge.classList.add('gmb-map-island-chip');
                badge.dataset.gmbSignature = signature;
                heading.appendChild(badge);
            });
        },

        renderIslandLinks: function() {
            document.querySelectorAll('.gp_island_link').forEach(link => {
                const id = this.getPayloadId(link);
                const entry = id && this.tags[`island:${id}`];
                const className = id && `gmb-map-island-link-${id}`;
                const existing = className && link.parentElement.querySelector(`:scope > .${className}`);
                if (!this.settings.tagsOnMap || !entry || !entry.text) {
                    if (existing) existing.remove();
                    return;
                }
                const signature = `${entry.text}|${entry.color || '#008f9d'}`;
                if (existing && existing.dataset.gmbSignature === signature) return;
                if (existing) existing.remove();
                const badge = this.makeBadge(entry.text, entry.color || '#008f9d', `Eiland ${id}: ${entry.text}`);
                badge.classList.add(className);
                badge.dataset.gmbSignature = signature;
                link.insertAdjacentElement('afterend', badge);
            });
        },

        getIslandIdForTown: function(townId, marker) {
            const town = this.worldData.towns.get(Number(townId));
            const uw = GMB_API.getUW();
            let ownTown = null;
            try { ownTown = uw.ITowns && typeof uw.ITowns.getTown === 'function' ? uw.ITowns.getTown(Number(townId)) : null; }
            catch (error) { GMB.log('Map', `Eiland-id van stad ${townId} niet leesbaar: ${error.message}`, 'warn'); }
            const candidates = [
                town && town.islandId, town && town.island_id,
                ownTown && typeof ownTown.getIslandId === 'function' ? ownTown.getIslandId() : null,
                ownTown && ownTown.attributes && (ownTown.attributes.island_id || ownTown.attributes.islandId),
                marker && marker.getAttribute && (marker.getAttribute('data-island-id') || marker.getAttribute('data-island_id'))
            ];
            for (const candidate of candidates) {
                const id = Number(candidate);
                if (Number.isInteger(id) && id > 0) return id;
            }
            if (!town || !Number.isFinite(Number(town.x)) || !Number.isFinite(Number(town.y))) return null;
            if (!this.islandSpatialIndex.size) this.indexIslands();
            const x = Number(town.x);
            const y = Number(town.y);
            const cellX = Math.floor(x / 20);
            const cellY = Math.floor(y / 20);
            let nearest = null;
            let distance = Infinity;
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
                for (let offsetY = -1; offsetY <= 1; offsetY++) {
                    const islands = this.islandSpatialIndex.get(`${cellX + offsetX}|${cellY + offsetY}`) || [];
                    islands.forEach(island => {
                        const current = Math.hypot(x - Number(island.x), y - Number(island.y));
                        if (current < distance) { distance = current; nearest = island; }
                    });
                }
            }
            return nearest && distance <= 20 ? Number(nearest.id) : null;
        },

        renderIslandMapLabels: function() {
            const container = document.getElementById('map_move_container');
            const previous = document.getElementById('gmb_island_map_labels');
            // Eiland-tags niet op de strategische kaart tonen
            if (!this.settings.tagsOnMap || !this.settings.islandTagsOnMap || !container || this.isStrategicMapView()) {
                if (previous) previous.remove();
                return;
            }
            const markers = container.querySelectorAll('[id^="town_flag_"], #minimap_islands_layer .m_town[id], [id^="mini_t"]');
            const groups = new Map();
            const seenTowns = new Set();
            markers.forEach(node => {
                const townId = this.getTownId(node);
                if (!townId || seenTowns.has(townId)) return;
                seenTowns.add(townId);
                const islandId = this.getIslandIdForTown(townId, node);
                if (!islandId || !this.tags[`island:${islandId}`]) return;
                const rect = node.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                if (!groups.has(islandId)) groups.set(islandId, []);
                groups.get(islandId).push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            });
            if (!groups.size) {
                if (previous) previous.remove();
                return;
            }
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            const rect = container.getBoundingClientRect();
            const positions = [];
            groups.forEach((points, islandId) => {
                const entry = this.tags[`island:${islandId}`];
                const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
                center.x = center.x / points.length - rect.left;
                center.y = center.y / points.length - rect.top - 18;
                positions.push([islandId, entry.text, entry.color || '#008f9d', center.x, center.y]);
            });
            const signature = JSON.stringify(positions);
            if (previous && previous.dataset.gmbSignature === signature) return;
            if (previous) previous.remove();
            const overlay = document.createElement('div');
            overlay.id = 'gmb_island_map_labels';
            overlay.className = 'gmb-island-map-labels';
            overlay.dataset.gmbSignature = signature;
            container.appendChild(overlay);
            positions.forEach(([islandId, text, color, x, y]) => {
                const badge = this.makeBadge(text, color, `Eiland ${islandId}: ${text}`);
                badge.classList.add('gmb-map-island-label');
                badge.style.left = `${x}px`;
                badge.style.top = `${y}px`;
                overlay.appendChild(badge);
            });
        },

        // Murray zoom zoals GRCRTools (_GRCRTMouseWheelZoom): het wiel schakelt tussen
        // stadsoverzicht, strategische kaart en eilandoverzicht.
        wheelModes: {
            strategic_map: { next: 'island_view', prev: 'city_overview' },
            island_view: { next: 'city_overview', prev: 'strategic_map' },
            city_overview: { next: 'strategic_map', prev: 'island_view' }
        },

        // Actieve bullseye-weergave (strategic_map / island_view / city_overview)
        activeMapMode: function() {
            const bar = document.querySelector('.bull_eye_buttons');
            if (!bar) return null;
            let checkedName = null;
            const checkedEl = bar.querySelector('.checked');
            if (checkedEl) {
                const named = checkedEl.hasAttribute('name') ? checkedEl
                    : (checkedEl.closest('[name]') || checkedEl.querySelector('[name]') || checkedEl.parentElement);
                checkedName = named && named.getAttribute('name');
            }
            if (!checkedName || !this.wheelModes[checkedName]) {
                const alt = [...bar.querySelectorAll('[name]')].find(el => this.wheelModes[el.getAttribute('name')]
                    && (el.classList.contains('checked') || el.querySelector('.checked') || el.closest('.checked')));
                if (alt) checkedName = alt.getAttribute('name');
            }
            return checkedName && this.wheelModes[checkedName] ? checkedName : null;
        },

        // Strategische kaart detecteren: autoritatief via bullseye-modus, anders via DOM-laag
        isStrategicMapView: function(node) {
            const mode = this.activeMapMode();
            if (mode) return mode === 'strategic_map';
            return !!(node && ((node.matches && node.matches('.m_town') && !!node.closest('#minimap_islands_layer, #main_area')) ||
                /^mini_t/.test(node.id || '') || (node.closest && node.closest('#minimap_islands_layer'))));
        },

        handleWheel: function(event) {
            if (!this.enabled || !this.settings.wheelZoom) return;
            const target = event.target;
            if (!target || !target.closest) return;
            if (target.closest('.gpwindow_content, .ui-dialog, .gmb-map-editor, #gmb-main-panel, .context_menu, #context_menu')) return;
            if (!target.closest('#main_area, #dio_political_map, .viewport, .sjs-city-overview-viewport, .js-city-overview-viewport, .js-city-overview-buildings-container')) return;
            const checkedName = this.activeMapMode();
            const entry = checkedName && this.wheelModes[checkedName];
            if (!entry || !event.deltaY) return;
            event.preventDefault();
            event.stopPropagation();
            const now = Date.now();
            if (now - this.lastWheelAt < 250) return;
            // deltaY < 0 (wiel omhoog) = volgende view; deltaY > 0 (wiel omlaag) = vorige view
            const mode = event.deltaY < 0 ? entry.next : entry.prev;
            const button = bar.querySelector(`.option.${mode}`) || bar.querySelector(`[name="${mode}"]`) || bar.querySelector(`.${mode}`);
            if (!button) return;
            this.lastWheelAt = now;
            button.click();
        },

        hookWindowOpen: function() {
            if (this.windowOpenHooked) return;
            try {
                const uw = GMB_API.getUW();
                const observer = uw.$ && uw.$.Observer;
                if (!observer || !uw.GameEvents || !uw.GameEvents.window || !uw.GameEvents.window.open) return;
                observer(uw.GameEvents.window.open).subscribe('gmb_map_window_open', () => { setTimeout(() => this.scheduleRender(), 400); });
                this.windowOpenHooked = true;
            } catch (error) { GMB.log('Map', `GameEvents.window.open niet gekoppeld: ${error.message}`, 'warn'); }
        },

        unhookWindowOpen: function() {
            if (!this.windowOpenHooked) return;
            try {
                const uw = GMB_API.getUW();
                uw.$.Observer(uw.GameEvents.window.open).unsubscribe('gmb_map_window_open');
            } catch (error) { /* hook bestond niet meer */ }
            this.windowOpenHooked = false;
        },

        // Bepaalt voor een open venster welke tag-knoppen erbij horen; ids komen uit de DOM, niet uit het gpwnd-id.
        findEditTargets: function() {
            const targets = [];
            const info = document.querySelector('#towninfo_towninfo');
            if (info) {
                const header = info.querySelector('.game_header.bold');
                const input = [...info.querySelectorAll('input')].find(item => /\[town\]\d+\[\/town\]/i.test(item.value));
                const link = header && header.querySelector('.gp_town_link');
                const id = input ? Number(input.value.match(/\[town\](\d+)\[\/town\]/i)[1]) : this.getPayloadId(link);
                if (header && id) targets.push({ host: header, type: 'town', id, name: header.textContent.trim() });
            }
            document.querySelectorAll('.island_info.clearfix').forEach(box => {
                const host = box.querySelector('h4');
                const id = this.getIslandId(box);
                if (host && id) targets.push({ host, type: 'island', id, name: host.firstChild ? host.firstChild.textContent.trim() : host.textContent.trim() });
            });
            document.querySelectorAll('[id="player_info"]').forEach(box => {
                const host = box.querySelector('h3');
                if (!host) return;
                const name = host.textContent.trim();
                if (box.querySelector('#alliance_points, .report_alliance_name')) {
                    const report = box.querySelector('.report_alliance_name');
                    const fromClick = report && String(report.getAttribute('onclick') || '').match(/item_id:\s*(\d+)/);
                    const alliance = fromClick ? { id: Number(fromClick[1]) } : this.findByName(this.worldData.alliances, name);
                    targets.push({ host, type: 'alliance', id: alliance ? alliance.id : 0, name });
                } else if (box.querySelector('#player_buttons')) {
                    const html = [...box.querySelectorAll('[onclick]')].map(node => node.getAttribute('onclick')).join(' ');
                    const fromClick = html.match(/item_id:\s*(\d+)[^}]*type:\s*'player_name'/);
                    const player = fromClick ? { id: Number(fromClick[1]) } : this.findByName(this.worldData.players, name);
                    targets.push({ host, type: 'player', id: player ? player.id : 0, name });
                }
            });
            return targets;
        },

        renderEditButtons: function() {
            this.findEditTargets().forEach(target => {
                const key = `${target.type}:${target.id}:${target.name}`;
                const existing = target.host.querySelector(':scope > .gmb-map-edit-btn');
                if (existing && existing.dataset.key === key) return;
                if (existing) existing.remove();
                const button = document.createElement('span');
                button.className = 'gmb-map-edit-btn';
                button.dataset.key = key;
                button.textContent = '🏷 Tag';
                button.title = `Tag-editor: ${this.tagTypeLabels[target.type]}`;
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.openEditor(target.type, target.id, target.name);
                });
                target.host.appendChild(button);
            });
        },

        closeEditor: function() {
            if (this.editor) this.editor.remove();
            this.editor = null;
        },

        openEditor: function(type, id, name) {
            this.closeEditor();
            const idKnown = Number.isInteger(id) && id > 0;
            const entry = idKnown ? this.tags[`${type}:${id}`] : null;
            let color = entry && /^#[0-9a-f]{6}$/i.test(entry.color) ? entry.color : '#008f9d';
            const box = document.createElement('div');
            box.className = 'gmb-map-editor';
            const make = (tag, text, className) => {
                const node = document.createElement(tag);
                if (text) node.textContent = text;
                if (className) node.className = className;
                return node;
            };
            box.appendChild(make('h4', `Tag-editor — ${this.tagTypeLabels[type]}${name ? `: ${name}` : ''}`));
            box.appendChild(make('label', `${this.tagTypeLabels[type]}-ID`));
            const idInput = make('input');
            idInput.type = 'number';
            idInput.min = '1';
            idInput.value = idKnown ? String(id) : '';
            idInput.readOnly = idKnown;
            idInput.placeholder = idKnown ? '' : 'ID niet gevonden; vul handmatig in';
            box.appendChild(idInput);
            box.appendChild(make('label', 'Tekst (max. 32; letters, cijfers, spatie en . [ ] ( ) - : ? & ;)'));
            const textInput = make('input');
            textInput.type = 'text';
            textInput.maxLength = 32;
            textInput.value = entry ? entry.text : '';
            box.appendChild(textInput);
            box.appendChild(make('label', 'Kleur'));
            const colorRow = make('div', '', 'gmb-map-swatches');
            const colorInput = make('input');
            colorInput.type = 'color';
            colorInput.value = color;
            colorInput.addEventListener('input', () => { color = colorInput.value; });
            colorRow.appendChild(colorInput);
            this.defaultColors.forEach(value => {
                const swatch = make('span', '', 'gmb-map-swatch');
                swatch.style.backgroundColor = value;
                swatch.title = value;
                swatch.addEventListener('click', () => { color = value.toLowerCase(); colorInput.value = color; });
                colorRow.appendChild(swatch);
            });
            box.appendChild(colorRow);
            const error = make('div', '', 'gmb-map-editor-error');
            box.appendChild(error);
            const actions = make('div', '', 'gmb-map-editor-actions');
            const save = make('button', 'Opslaan', 'gmb-button');
            const remove = make('button', 'Verwijderen', 'gmb-button gmb-button-secondary');
            const cancel = make('button', 'Annuleren', 'gmb-button gmb-button-secondary');
            [save, remove, cancel].forEach(button => { button.type = 'button'; actions.appendChild(button); });
            box.appendChild(actions);
            const currentId = () => Number(idInput.value);
            const validate = () => {
                const text = textInput.value.trim();
                if (!Number.isInteger(currentId()) || currentId() < 1) error.textContent = 'Vul een geldig ID in.';
                else if (text && !this.isValidTagText(text)) error.textContent = 'Ongeldige tekens of te lang (max. 32).';
                else error.textContent = '';
                return !error.textContent;
            };
            textInput.addEventListener('input', validate);
            idInput.addEventListener('input', validate);
            save.addEventListener('click', () => {
                if (!validate()) return;
                const message = this.applyEntry(type, currentId(), textInput.value.trim(), color);
                if (message) { error.textContent = message; return; }
                this.closeEditor();
            });
            remove.addEventListener('click', () => {
                if (!Number.isInteger(currentId()) || currentId() < 1) { error.textContent = 'Vul een geldig ID in.'; return; }
                const message = this.applyEntry(type, currentId(), '', color);
                if (message) { error.textContent = message; return; }
                this.closeEditor();
            });
            cancel.addEventListener('click', () => this.closeEditor());
            box.addEventListener('keydown', event => { if (event.key === 'Escape') this.closeEditor(); });
            document.body.appendChild(box);
            this.editor = box;
            textInput.focus();
            validate();
        },

        onEnable: function() {
            if (!document.getElementById('gmb-tab-mgr-map')) this.addTab();
        }
    };

    // ============================================================
    // REPORTS MODULE (Fase 12) - GRCRT + DIO Reports & Converters
    // ============================================================

    const GMB_Reports = {
        gameOnly: true,
        enabled: false,
        observer: null,
        windowOpenHooked: false,
        scanTimer: null,
        loopTimer: null,
        settings: {},
        activity: [],
        lastText: '',
        dialog: null,
        lastRadarMatches: [],
        lastTslTowns: [],
        defaults: {
            units: true, buildings: true, loot: true, silver: true, cost: false, morale: true,
            powers: true, hideTowns: false, hideAttacker: false, hideDefender: false,
            revoltInfo: true, simLosses: true, conquerCounter: true, messageColor: true
        },
        optionLabels: {
            units: 'Eenheden', buildings: 'Gebouwen (spionage)', loot: 'Buit / grondstoffen', silver: 'Zilver / spionagebericht-info',
            cost: 'Verliezen in grondstoffen (unit cost)', morale: 'Moraal / geluk / nachtbonus',
            powers: 'God en spreuken', hideTowns: 'Stadnamen verbergen',
            hideAttacker: 'Aanvaller verbergen', hideDefender: 'Verdediger verbergen',
            revoltInfo: 'Revolt-info (muur, toren, god, falanx/ram, CS-tijd)',
            simLosses: 'Simulator grondstofverliezen berekenen',
            conquerCounter: 'Conquer counter (aanvallen vs OS in belegering)',
            messageColor: 'Berichten / spelers kleuren op alliantieband'
        },

        init: function() {
            this.settings = Object.assign({}, this.defaults, GMB.storage.get('reports_options', {}));
            this.addTab();
            if (GMB.storage.get('reports_enabled', false)) this.start();
        },

        addTab: function() {
            if (document.getElementById('gmb-tab-mgr-reports')) return;
            GMB_UI.addTab('mgr-reports', '📜 Rapporten', `
                <div class="gmb-section">
                    <div class="gmb-section-title">Rapport-converter (BB-code)</div>
                    <p class="gmb-muted">Zet geopende gevechts-, ondersteunings- en spionagerapporten om naar BB-tabellen inclusief revolt-details, verliezen en speliconen.</p>
                    <label><input id="gmb-reports-enabled" type="checkbox"> Rapport-tools & converter inschakelen</label>
                    <div id="gmb-reports-status" class="gmb-muted" style="margin:5px 0;">Uitgeschakeld</div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Opties & Modules</div>
                    <div id="gmb-reports-options" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;"></div>
                    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="gmb-button" id="gmb-reports-convert">Open rapport in converter</button>
                        <button class="gmb-button gmb-button-secondary" id="gmb-reports-copy">Kopiëren</button>
                        <button class="gmb-button gmb-button-secondary" id="gmb-reports-paste-active" title="Plak het laatste rapport in het actieve tekstvak">📋 Plak in composer</button>
                    </div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Voorbeeld BB-Code</div>
                    <textarea id="gmb-reports-preview" rows="8" style="width:98%;" placeholder="Open een rapport en klik op Converteren of 📋 BB in de rapportbalk."></textarea>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">🧱 Opgeslagen Muren (Wall Lists)</div>
                    <p class="gmb-muted">Overzicht van gespioneerde en waargenomen muurniveaus per stad.</p>
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
                        <input type="text" id="gmb-walls-search" placeholder="Filter op stad of speler..." style="flex:1;padding:3px 6px;">
                        <button class="gmb-button gmb-button-secondary" id="gmb-walls-export">📋 Exporteer BB</button>
                        <button class="gmb-button gmb-button-secondary" id="gmb-walls-clear">🗑️ Wissen</button>
                    </div>
                    <div id="gmb-reports-walls-list" style="max-height:160px;overflow-y:auto;border:1px solid #4a3720;padding:4px;border-radius:4px;"></div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">📡 Radar — Stedenzoeker (Townfinder)</div>
                    <p class="gmb-muted">Vind vijandelijke steden en spooksteden binnen het maximale Kolonisatieschip (CS) bereik.</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
                        <div>
                            <label style="font-size:11px;">Vertrekstad:</label>
                            <select id="gmb-radar-origin" style="width:100%;padding:2px;"></select>
                        </div>
                        <div>
                            <label style="font-size:11px;">Max. CS-looptijd (uren):</label>
                            <input type="number" id="gmb-radar-hours" value="12" min="1" max="48" style="width:100%;padding:2px;">
                        </div>
                        <div>
                            <label style="font-size:11px;">Minimale punten:</label>
                            <input type="number" id="gmb-radar-points" value="3000" min="0" step="500" style="width:100%;padding:2px;">
                        </div>
                        <div>
                            <label style="font-size:11px;">Oceaanfilter (bv. 45,55):</label>
                            <input type="text" id="gmb-radar-oceans" placeholder="Alles" style="width:100%;padding:2px;">
                        </div>
                    </div>
                    <button class="gmb-button" id="gmb-radar-search" style="margin-bottom:6px;">🔍 Zoek steden binnen bereik</button>
                    <div id="gmb-radar-results" style="max-height:180px;overflow-y:auto;border:1px solid #4a3720;padding:4px;border-radius:4px;">
                        <div class="gmb-muted">Klik op zoeken om doelwitten te analyseren.</div>
                    </div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">📑 Gesorteerde Stedenlijst (TSL)</div>
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
                        <label style="font-size:11px;">Sorteer op:</label>
                        <select id="gmb-tsl-sort" style="padding:2px;">
                            <option value="name">Naam (A-Z)</option>
                            <option value="points">Punten (hoog-laag)</option>
                            <option value="ocean">Oceaan (OC)</option>
                            <option value="island">Eiland</option>
                        </select>
                        <button class="gmb-button gmb-button-secondary" id="gmb-tsl-export">📋 Exporteer BB</button>
                    </div>
                    <div id="gmb-tsl-list" style="max-height:150px;overflow-y:auto;border:1px solid #4a3720;padding:4px;border-radius:4px;"></div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Activiteitenlog</div>
                    <div id="gmb-reports-log" class="gmb-log-container" style="max-height:100px;"></div>
                </div>`);

            const tab = document.getElementById('gmb-tab-mgr-reports');
            const checkbox = tab.querySelector('#gmb-reports-enabled');
            checkbox.checked = !!GMB.storage.get('reports_enabled', false);
            checkbox.addEventListener('change', () => checkbox.checked ? this.start() : this.stop());

            const options = tab.querySelector('#gmb-reports-options');
            options.innerHTML = Object.entries(this.optionLabels).map(([key, label]) =>
                `<label><input type="checkbox" data-reports-option="${key}" ${this.settings[key] ? 'checked' : ''}> ${label}</label>`).join('');
            options.addEventListener('change', event => {
                const key = event.target.dataset && event.target.dataset.reportsOption;
                if (!key) return;
                this.settings[key] = event.target.checked;
                GMB.storage.set('reports_options', this.settings);
            });

            tab.querySelector('#gmb-reports-convert').addEventListener('click', () => this.convertOpenReport());
            tab.querySelector('#gmb-reports-copy').addEventListener('click', () => this.copy(tab.querySelector('#gmb-reports-preview').value));
            tab.querySelector('#gmb-reports-paste-active').addEventListener('click', () => this.pasteLastReport());

            tab.querySelector('#gmb-walls-search').addEventListener('input', () => this.renderSavedWalls());
            tab.querySelector('#gmb-walls-export').addEventListener('click', () => this.exportWallsBB());
            tab.querySelector('#gmb-walls-clear').addEventListener('click', () => {
                if (confirm('Weet je zeker dat je alle opgeslagen muren wilt wissen?')) {
                    GMB.storage.set('reports_saved_walls', {});
                    this.renderSavedWalls();
                }
            });

            tab.querySelector('#gmb-radar-search').addEventListener('click', () => this.runRadar());
            tab.querySelector('#gmb-tsl-sort').addEventListener('change', () => this.renderTSL());
            tab.querySelector('#gmb-tsl-export').addEventListener('click', () => this.exportTslBB());

            this.populateRadarOrigin();
            this.renderSavedWalls();
            this.renderTSL();
        },

        setStatus: function(text, error = false) {
            const status = document.getElementById('gmb-reports-status');
            if (status) { status.textContent = text; status.style.color = error ? '#d66' : ''; }
        },

        record: function(message, type = 'info') {
            this.activity.push({ at: new Date().toLocaleTimeString(), message, type });
            this.activity = this.activity.slice(-30);
            GMB.log('Reports', message, type);
            const container = document.getElementById('gmb-reports-log');
            if (container) container.replaceChildren(...this.activity.map(item => {
                const row = document.createElement('div');
                row.className = `gmb-log-entry gmb-log-${item.type}`;
                row.textContent = `[${item.at}] ${item.message}`;
                return row;
            }));
        },

        start: function() {
                        if (this.enabled) return;
            this.enabled = true;
            GMB.storage.set('reports_enabled', true);
            this.applyStyles();
            const toggle = document.getElementById('gmb-reports-enabled');
            if (toggle) toggle.checked = true;
            this.hookWindowOpen();
            this.injectButtons();
            this.startLoop();
            this.record('Rapport-converter & tools ingeschakeld.');
            this.setStatus('Actief — converter, simulator, radar en murenbeheer gereed.');
        },

        stop: function(reason = 'Uitgeschakeld.') {
            this.enabled = false;
            GMB.storage.set('reports_enabled', false);
            this.unhookWindowOpen();
            if (this.scanTimer) clearTimeout(this.scanTimer);
            this.scanTimer = null;
            if (this.loopTimer) clearInterval(this.loopTimer);
            this.loopTimer = null;
            document.querySelectorAll('.gmb-reports-btn, .gmb-simul-btn, .gmb-paste-report-btn, .gmb-mark-read-btn, .gmb-save-wall-btn, #gmb-conquest-counter').forEach(node => node.remove());
            this.closeDialog();
            const toggle = document.getElementById('gmb-reports-enabled');
            if (toggle) toggle.checked = false;
            this.setStatus(reason);
            if (reason) this.record(reason);
        },

        onEnable: function() {
            this.addTab();
        },

        hookWindowOpen: function() {
            if (this.windowOpenHooked) return;
            try {
                const uw = GMB_API.getUW();
                const observer = uw.$ && uw.$.Observer;
                if (!observer || !uw.GameEvents || !uw.GameEvents.window || !uw.GameEvents.window.open) return;
                observer(uw.GameEvents.window.open).subscribe('gmb_reports_window_open', () => {
                    if (this.scanTimer) clearTimeout(this.scanTimer);
                    this.scanTimer = setTimeout(() => {
                        this.scanTimer = null;
                        if (this.enabled) {
                            this.injectButtons();
                            this.injectPasteButtons();
                            this.injectReportListButtons();
                            this.injectWallSaveButton();
                            this.injectConquerCounter();
                            this.hookSimulatorLosses();
                            this.colorizeMessages();
                        }
                    }, 400);
                });
                this.windowOpenHooked = true;
            } catch (error) {
                GMB.log('Reports', `GameEvents.window.open niet gekoppeld: ${error.message}`, 'warn');
            }
        },

        unhookWindowOpen: function() {
            if (!this.windowOpenHooked) return;
            try {
                const uw = GMB_API.getUW();
                uw.$.Observer(uw.GameEvents.window.open).unsubscribe('gmb_reports_window_open');
            } catch (error) {
                GMB.log('Reports', `GameEvents.window.open niet losgekoppeld: ${error.message}`, 'warn');
            }
            this.windowOpenHooked = false;
        },

        startLoop: function() {
            if (this.loopTimer) clearInterval(this.loopTimer);
            this.loopTimer = setInterval(() => {
                if (!this.enabled) return;
                this.injectButtons();
                this.injectPasteButtons();
                this.injectReportListButtons();
                this.injectWallSaveButton();
                this.injectConquerCounter();
                this.hookSimulatorLosses();
                this.colorizeMessages();
            }, 1500);
        },

        findReportRoot: function(from) {
            const header = from && from.closest ? from.closest('.gpwindow_content') : null;
            if (header && header.querySelector('#report_report_header')) return header;
            const node = document.querySelector('#report_report_header');
            return node ? (node.closest('.gpwindow_content') || document) : null;
        },

        injectButtons: function() {
            if (!this.enabled) return;
            document.querySelectorAll('#report_report_header').forEach(header => {
                const root = header.closest('.gpwindow_content') || document;
                const host = root.querySelector('#report_report .game_list_footer, .game_list_footer') || header;

                if (!root.querySelector('.gmb-reports-btn')) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'gmb-reports-btn button';
                    button.textContent = '📋 BB';
                    button.title = 'Rapportgegevens openen en BB-tabel samenstellen';
                    button.addEventListener('click', event => {
                        event.stopPropagation();
                        this.convertOpenReport(root);
                    });
                    host.appendChild(button);
                }

                if (!root.querySelector('.gmb-simul-btn')) {
                    const simBtn = document.createElement('button');
                    simBtn.type = 'button';
                    simBtn.className = 'gmb-simul-btn button';
                    simBtn.style.cssText = 'margin:2px 4px!important;padding:4px 8px!important;cursor:pointer;';
                    simBtn.textContent = '⚔️ Simulator';
                    simBtn.title = 'Zet eenheden, muur en bonussen over naar de simulator';
                    simBtn.addEventListener('click', event => {
                        event.stopPropagation();
                        try {
                            const data = this.parseReport(root, GMB_API.getUW().GameData || {});
                            this.openInSimulator(data);
                        } catch (e) {
                            GMB.notify(`Simulator overdracht fout: ${e.message}`, { type: 'error' });
                        }
                    });
                    host.appendChild(simBtn);
                }
            });
        },

        injectPasteButtons: function() {
            const wrappers = document.querySelectorAll('.bb_button_wrapper');
            wrappers.forEach(wrap => {
                if (wrap.querySelector('.gmb-paste-report-btn')) return;
                const btn = document.createElement('a');
                btn.href = '#';
                btn.className = 'gmb-paste-report-btn button_new';
                btn.style.cssText = 'display:inline-block;margin:0 2px;vertical-align:middle;font-size:10px;padding:1px 4px;';
                btn.title = 'Plak het laatst geconverteerde rapport';
                btn.innerHTML = '<span class="middle" style="padding:0 4px;">📋</span>';
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.pasteLastReport(wrap);
                });
                wrap.appendChild(btn);
            });
        },

        pasteLastReport: function(fromElement) {
            const lastBB = GMB.storage.get('reports_last_bb', '') || this.lastText;
            if (!lastBB) return GMB.notify('Nog geen rapport geconverteerd. Open eerst een rapport en klik op 📋 BB.', { type: 'warn' });

            const root = fromElement ? fromElement.closest('.gpwindow_content, .notes_container, #forum, .reply_container, form') : document;
            const textarea = root ? root.querySelector('textarea') : document.querySelector('#forum_post_textarea, #message_post_res, textarea:focus, textarea');

            if (!textarea) return GMB.notify('Geen tekstvak gevonden om het rapport in te plakken.', { type: 'error' });

            const val = textarea.value;
            const start = textarea.selectionStart ?? val.length;
            const end = textarea.selectionEnd ?? val.length;
            textarea.value = val.substring(0, start) + lastBB + val.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + lastBB.length;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            textarea.focus();
            GMB.notify('Laatste rapport ingevoegd in tekstvak!', { type: 'success' });
        },

        injectReportListButtons: function() {
            const listFooter = document.querySelector('#report_list .game_list_footer, .report_list .game_list_footer');
            if (!listFooter || listFooter.querySelector('.gmb-mark-read-btn')) return;

            const wrap = document.createElement('div');
            wrap.className = 'gmb-mark-read-btn';
            wrap.style.cssText = 'display:inline-flex;gap:5px;margin-left:8px;vertical-align:middle;';

            const btnAll = document.createElement('button');
            btnAll.type = 'button';
            btnAll.className = 'button';
            btnAll.style.cssText = 'font-size:11px;padding:2px 7px;';
            btnAll.textContent = '✓ Alles gelezen';
            btnAll.title = 'Markeer alle rapporten in deze map als gelezen';
            btnAll.addEventListener('click', () => this.markReportsRead(true));

            const btnSel = document.createElement('button');
            btnSel.type = 'button';
            btnSel.className = 'button';
            btnSel.style.cssText = 'font-size:11px;padding:2px 7px;';
            btnSel.textContent = '✓ Selectie gelezen';
            btnSel.title = 'Markeer geselecteerde rapporten als gelezen';
            btnSel.addEventListener('click', () => this.markReportsRead(false));

            wrap.append(btnAll, btnSel);
            listFooter.appendChild(wrap);
        },

        markReportsRead: function(all) {
            try {
                const uw = GMB_API.getUW();
                if (all) {
                    if (uw.gpAjax && uw.gpAjax.ajaxPost) {
                        uw.gpAjax.ajaxPost('report', 'mark_all_read', {}, false, () => {
                            this.record('Alle rapporten gemarkeerd als gelezen.', 'success');
                            if (uw.gpAjax.ajaxGet) uw.gpAjax.ajaxGet('report', 'index', {}, false);
                        });
                    }
                } else {
                    const checked = [...document.querySelectorAll('#report_list input[name="id[]"]:checked, .report_list input[type="checkbox"]:checked')].map(i => i.value).filter(Boolean);
                    if (!checked.length) return GMB.notify('Geen rapporten geselecteerd.', { type: 'warn' });
                    if (uw.gpAjax && uw.gpAjax.ajaxPost) {
                        uw.gpAjax.ajaxPost('report', 'set_read', { ids: checked }, false, () => {
                            this.record(`${checked.length} geselecteerde rapport(en) gemarkeerd als gelezen.`, 'success');
                            if (uw.gpAjax.ajaxGet) uw.gpAjax.ajaxGet('report', 'index', {}, false);
                        });
                    }
                }
            } catch (err) {
                this.record(`Markeren als gelezen mislukt: ${err.message}`, 'error');
            }
        },

        injectWallSaveButton: function() {
            const wallWnd = document.querySelector('#building_wall .game_border, #building_wall');
            if (!wallWnd || wallWnd.querySelector('.gmb-save-wall-btn')) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'button gmb-save-wall-btn';
            btn.style.cssText = 'float:right;margin:4px 8px;padding:4px 10px;font-size:11px;cursor:pointer;';
            btn.textContent = '💾 Muur opslaan';
            btn.title = 'Sla huidige muurgegevens op in de opgeslagen murenlijst';
            btn.addEventListener('click', () => {
                try {
                    const uw = GMB_API.getUW();
                    const townId = uw.Game && uw.Game.townId;
                    const itown = uw.ITowns && uw.ITowns.getCurrentTown && uw.ITowns.getCurrentTown();
                    const townName = itown ? (itown.getName ? itown.getName() : itown.name) : (uw.Game && uw.Game.townName) || `Stad ${townId}`;
                    const wallLevel = itown && itown.buildings ? itown.buildings().getBuildingLevel('wall') : null;
                    const towerLevel = itown && itown.buildings ? itown.buildings().getBuildingLevel('tower') : 0;
                    const player = uw.Game && uw.Game.player_name;
                    const ally = uw.Game && uw.Game.alliance_name;

                    this.saveWallInfo({
                        townId,
                        townName,
                        player,
                        ally,
                        wall: wallLevel,
                        tower: towerLevel > 0 ? 'Ja' : 'Nee',
                        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
                    });
                    GMB.notify(`Muur van ${townName} opgeslagen (Niveau ${wallLevel})!`, { type: 'success' });
                    this.renderSavedWalls();
                } catch (e) {
                    GMB.notify(`Opslaan muur mislukt: ${e.message}`, { type: 'error' });
                }
            });

            const header = wallWnd.querySelector('.game_header, h4') || wallWnd;
            header.appendChild(btn);
        },

        saveWallInfo: function(entry) {
            if (!entry || !entry.townId) return;
            const saved = GMB.storage.get('reports_saved_walls', {});
            saved[entry.townId] = Object.assign({}, saved[entry.townId] || {}, entry);
            GMB.storage.set('reports_saved_walls', saved);
        },

        renderSavedWalls: function() {
            const container = document.getElementById('gmb-reports-walls-list');
            if (!container) return;
            const filter = (document.getElementById('gmb-walls-search')?.value || '').toLowerCase().trim();
            const saved = GMB.storage.get('reports_saved_walls', {});
            const list = Object.values(saved).filter(entry => {
                if (!filter) return true;
                const str = `${entry.townName || ''} ${entry.townId || ''} ${entry.player || ''} ${entry.ally || ''}`.toLowerCase();
                return str.includes(filter);
            });

            if (!list.length) {
                container.innerHTML = '<div class="gmb-muted">Geen opgeslagen muren gevonden. Bekijk een rapport of stadsmuur om gegevens op te slaan.</div>';
                return;
            }

            container.innerHTML = `
                <table class="gmb-table" style="width:100%;font-size:11px;">
                    <thead>
                        <tr>
                            <th>Stad</th>
                            <th>Speler</th>
                            <th>Muur</th>
                            <th>Toren</th>
                            <th>Datum</th>
                            <th>Acties</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(e => `
                            <tr>
                                <td><strong>${e.townName || `[town]${e.townId}[/town]`}</strong></td>
                                <td>${e.player || '—'}</td>
                                <td style="color:#2ec4b6;font-weight:bold;">${e.wall ?? '—'}</td>
                                <td>${e.tower || '—'}</td>
                                <td style="font-size:10px;color:#aaa;">${e.date || '—'}</td>
                                <td>
                                    <button class="gmb-button gmb-button-secondary gmb-del-wall" data-town="${e.townId}" style="padding:1px 5px;font-size:10px;">✕</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('.gmb-del-wall').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.town;
                    const current = GMB.storage.get('reports_saved_walls', {});
                    delete current[id];
                    GMB.storage.set('reports_saved_walls', current);
                    this.renderSavedWalls();
                });
            });
        },

        exportWallsBB: function() {
            const saved = GMB.storage.get('reports_saved_walls', {});
            const list = Object.values(saved);
            if (!list.length) return this.setStatus('Geen opgeslagen muren om te exporteren.', true);
            const lines = ['[table]', '[*][b]Stad[/b][|][b]Speler[/b][|][b]Muur[/b][|][b]Toren[/b][|][b]Datum[/b][/*]'];
            list.forEach(e => {
                lines.push(`[*][town]${e.townId}[/town][|]${e.player || '—'}[|]${e.wall ?? '—'}[|]${e.tower || '—'}[|]${e.date || '—'}[/*]`);
            });
            lines.push('[/table]');
            const bb = lines.join('\n');
            this.copy(bb);
            this.record(`Murenlijst geëxporteerd (${list.length} steden).`, 'success');
        },

        injectConquerCounter: function() {
            if (!this.settings.conquerCounter) return;
            const moveRoots = document.querySelectorAll('#unit_movements');
            moveRoots.forEach(moveRoot => {
                const parent = moveRoot.closest('.gpwindow_content, .tab_content, .conquest_info') || moveRoot.parentNode;
                if (!parent || parent.querySelector('#gmb-conquest-counter')) return;

                const sup = moveRoot.querySelectorAll('.support, .movement.support').length;
                const att = moveRoot.querySelectorAll('.attack_land, .attack_sea, .attack_takeover, .movement.attack').length;

                const counter = document.createElement('div');
                counter.id = 'gmb-conquest-counter';
                counter.className = 'gmb-conquest-counter';
                counter.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 12px;margin:6px 0;background:#2a1f14;border:1px solid #7d5b28;border-radius:4px;color:#fff;font-weight:bold;font-size:12px;';
                counter.innerHTML = `
                    <span style="color:#2ec4b6;">🛡️ Ondersteuningen: ${sup}</span>
                    <span style="color:#e71d36;">⚔️ Aanvallen: ${att}</span>
                    <span style="color:#ffd166;font-size:11px;">Totaal: ${sup + att}</span>
                `;
                moveRoot.parentNode.insertBefore(counter, moveRoot);
            });
        },

        colorizeMessages: function() {
            if (!this.settings.messageColor) return;
            const msgWnd = document.querySelector('#message_container, #message_folder, .message_view, #forum');
            if (!msgWnd) return;

            const uw = GMB_API.getUW();
            if (!uw.MM || !uw.Game) return;

            try {
                const myAllyId = uw.Game.alliance_id;
                const pactCol = uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('AlliancePact');
                const pacts = (pactCol && pactCol.models) || [];
                const pactMap = new Map();
                pacts.forEach(p => {
                    if (p.getInvitationPending && p.getInvitationPending()) return;
                    const a1 = p.getAlliance1Id ? p.getAlliance1Id() : p.get('alliance_1_id');
                    const a2 = p.getAlliance2Id ? p.getAlliance2Id() : p.get('alliance_2_id');
                    const rel = p.getRelation ? p.getRelation() : p.get('relation');
                    const targetAlly = a1 === myAllyId ? a2 : a1;
                    if (targetAlly) pactMap.set(targetAlly, rel);
                });

                msgWnd.querySelectorAll('a.gp_player_link').forEach(link => {
                    if (link.dataset.gmbColored) return;
                    link.dataset.gmbColored = 'true';
                    const info = this.decodeLink(link);
                    const playerId = info && info.id;
                    if (!playerId) return;

                    const playersObj = GMB_WorldData && GMB_WorldData.cache && GMB_WorldData.cache.get(`${GMB_API.getWorldId()}:players`);
                    const playerData = playersObj && playersObj.value && playersObj.value.byId ? playersObj.value.byId.get(Number(playerId)) : null;
                    if (!playerData || !playerData.allianceId) return;

                    if (playerData.allianceId === myAllyId) {
                        link.style.color = '#2ec4b6';
                        link.style.fontWeight = 'bold';
                        link.title = (link.title ? link.title + ' — ' : '') + 'Eigen alliantie';
                    } else {
                        const rel = pactMap.get(playerData.allianceId);
                        if (rel === 'war') {
                            link.style.color = '#e71d36';
                            link.style.fontWeight = 'bold';
                            link.title = (link.title ? link.title + ' — ' : '') + 'Vijand (Oorlog)';
                        } else if (rel === 'pact' || rel === 'peace') {
                            link.style.color = '#3a86ff';
                            link.style.fontWeight = 'bold';
                            link.title = (link.title ? link.title + ' — ' : '') + 'Bondgenoot (Pact)';
                        }
                    }
                });
            } catch (e) {}
        },

        openInSimulator: function(data) {
            try {
                const uw = GMB_API.getUW();
                if (!uw.Layout || !uw.Layout.wnd) throw new Error('Layout.wnd niet beschikbaar');

                uw.Layout.wnd.Create(uw.Layout.wnd.TYPE_PLACE, 'Place', { sub_context: 'simulator' });
                this.record('Simulator geopend vanuit rapport...', 'info');

                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    const simEl = document.querySelector('#place_simulator');
                    if (simEl || attempts > 20) {
                        clearInterval(interval);
                        if (!simEl) return;
                        this.populateSimulator(simEl, data);
                    }
                }, 300);
            } catch (err) {
                this.record(`Simulator openen mislukt: ${err.message}`, 'error');
                this.setStatus(err.message, true);
            }
        },

        populateSimulator: function(simEl, data) {
            const uw = GMB_API.getUW();
            const $ = uw.$ || window.$;
            if (!$) return;

            (data.attackerUnits || []).forEach(unit => {
                const input = $(simEl).find(`input[name="att[units][${unit.key}]"], input[name="att_${unit.key}"]`);
                if (input.length) input.val(unit.count).trigger('change');
            });

            (data.defenderUnits || []).forEach(unit => {
                const input = $(simEl).find(`input[name="def[units][${unit.key}]"], input[name="def_${unit.key}"]`);
                if (input.length) input.val(unit.count).trigger('change');
            });

            let wallVal = null;
            if (data.oldwall) {
                const match = String(data.oldwall).match(/\d+/);
                if (match) wallVal = match[0];
            } else if (data.buildings && data.buildings.length) {
                const wb = data.buildings.find(b => b.key === 'wall');
                if (wb && wb.level) wallVal = wb.level;
            }
            if (wallVal !== null) {
                const wallInput = $(simEl).find('input[name="def_wall"], input[name="def[buildings][wall]"]');
                if (wallInput.length) wallInput.val(wallVal).trigger('change');
            }

            if (data.luck) {
                const luckMatch = String(data.luck).match(/[-+]?\d+/);
                if (luckMatch) $(simEl).find('input[name="luck"]').val(luckMatch[0]).trigger('change');
            }
            if (data.morale) {
                const moraleMatch = String(data.morale).match(/\d+/);
                if (moraleMatch) $(simEl).find('input[name="morale"]').val(moraleMatch[0]).trigger('change');
            }
            if (data.nightbonus) {
                $(simEl).find('input[name="def_night"], input[name="night"]').prop('checked', true).trigger('change');
            }

            this.record('Eenheden en modifiers ingeladen in simulator!', 'success');
            this.setStatus('Eenheden overgezet naar simulator.');
        },

        hookSimulatorLosses: function() {
            if (!this.settings.simLosses) return;
            const simEl = document.querySelector('#place_simulator');
            if (!simEl || simEl.dataset.gmbHooked) return;
            simEl.dataset.gmbHooked = 'true';

            const simBtn = simEl.querySelector('.simulate_button, input[type="submit"], .btn_simulate');
            if (simBtn) {
                simBtn.addEventListener('click', () => {
                    setTimeout(() => this.calculateSimulatorLosses(simEl), 400);
                });
            }
        },

        calculateSimulatorLosses: function(simEl) {
            try {
                const uw = GMB_API.getUW();
                const gameData = uw.GameData || {};
                const unitsData = gameData.units || {};

                const parseLostFromRow = (selector) => {
                    const lostUnits = [];
                    simEl.querySelectorAll(selector).forEach(node => {
                        const countText = node.textContent.trim();
                        const count = Number(countText.replace(/[^\d]/g, ''));
                        if (count > 0) {
                            const unitKey = node.dataset.unit || [...node.classList].find(c => unitsData[c]) || '';
                            if (unitKey && unitsData[unitKey]) {
                                lostUnits.push({ key: unitKey, lost: count, cost: unitsData[unitKey].resources });
                            }
                        }
                    });
                    return lostUnits;
                };

                const attLost = parseLostFromRow('.place_sim_attacker_losts .place_unit, .place_att_losts .place_unit');
                const defLost = parseLostFromRow('.place_sim_defender_losts .place_unit, .place_def_losts .place_unit');

                const attCost = this.lossCost(attLost);
                const defCost = this.lossCost(defLost);

                let container = simEl.querySelector('#gmb-sim-losses-box');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'gmb-sim-losses-box';
                    container.style.cssText = 'margin:10px 5px;padding:8px;background:rgba(0,0,0,0.3);border:1px solid #7d5b28;border-radius:4px;font-size:11px;color:#fff;';
                    simEl.appendChild(container);
                }

                const formatCost = (c) => `🌲 ${c.wood.toLocaleString()} | 🪨 ${c.stone.toLocaleString()} | 🪙 ${c.iron.toLocaleString()} | 👥 Pop: ${c.pop}`;
                container.innerHTML = `
                    <div style="font-weight:bold;margin-bottom:4px;color:#ffd166;">📊 Totale grondstofverliezen simulatie:</div>
                    <div style="color:#e71d36;margin-bottom:3px;"><strong>Aanvaller:</strong> ${formatCost(attCost)} (Totaal: ${(attCost.wood + attCost.stone + attCost.iron).toLocaleString()})</div>
                    <div style="color:#2ec4b6;"><strong>Verdediger:</strong> ${formatCost(defCost)} (Totaal: ${(defCost.wood + defCost.stone + defCost.iron).toLocaleString()})</div>
                `;
            } catch (e) {}
        },

        populateRadarOrigin: function() {
            const select = document.getElementById('gmb-radar-origin');
            if (!select) return;
            const uw = GMB_API.getUW();
            if (!uw.ITowns || !uw.ITowns.getTowns) return;
            const towns = Object.values(uw.ITowns.getTowns());
            const curTownId = uw.Game && uw.Game.townId;
            select.innerHTML = towns.map(t => {
                const id = t.getId ? t.getId() : t.id;
                const name = t.getName ? t.getName() : (t.name || `Stad ${id}`);
                return `<option value="${id}" ${id === curTownId ? 'selected' : ''}>${name} (${id})</option>`;
            }).join('');
        },

        runRadar: async function() {
            const originSelect = document.getElementById('gmb-radar-origin');
            const originId = originSelect ? Number(originSelect.value) : (GMB_API.getUW().Game && GMB_API.getUW().Game.townId);
            const maxHours = Number(document.getElementById('gmb-radar-hours')?.value) || 12;
            const minPoints = Number(document.getElementById('gmb-radar-points')?.value) || 3000;
            const oceanFilterStr = (document.getElementById('gmb-radar-oceans')?.value || '').trim();
            const oceanFilter = oceanFilterStr ? oceanFilterStr.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) : null;

            const resultsContainer = document.getElementById('gmb-radar-results');
            if (!resultsContainer) return;
            resultsContainer.innerHTML = '<div class="gmb-muted">Steden analyseren via werelddata...</div>';

            try {
                const originCoord = this.getTownCoordinates(originId);
                if (!originCoord) throw new Error('Kan coördinaten van vertrekstad niet bepalen. Selecteer een geldige stad.');

                const [townsData, playersData] = await Promise.all([
                    GMB_WorldData.getTowns(),
                    GMB_WorldData.getPlayers().catch(() => ({ byId: new Map() }))
                ]);

                const myPlayerId = GMB_API.getPlayerId();
                const worldSpeed = (GMB_API.getUW().GameData && GMB_API.getUW().GameData.speed) || 1;
                const unitSpeed = (GMB_API.getUW().Game && GMB_API.getUW().Game.constants && GMB_API.getUW().Game.constants.unit_movement_boost) || 1;
                const speedFactor = 3 * unitSpeed;

                const matches = [];
                townsData.list.forEach(town => {
                    if (town.playerId === myPlayerId) return;
                    if (town.points < minPoints) return;
                    const ocean = Math.floor(town.x / 100) + Math.floor(town.y / 100) * 10;
                    if (oceanFilter && !oceanFilter.includes(ocean)) return;

                    const dist = Math.hypot(town.x - originCoord.x, town.y - originCoord.y);
                    const durationSec = Math.round((dist / speedFactor) * 3600);
                    const durationHours = durationSec / 3600;
                    if (durationHours > maxHours) return;

                    const player = playersData.byId ? playersData.byId.get(town.playerId) : null;
                    matches.push({
                        town,
                        player: player ? player.name : (town.playerId ? `Speler ${town.playerId}` : 'Spookstad'),
                        ally: player && player.allianceId ? player.allianceId : '',
                        points: town.points,
                        ocean,
                        dist: Math.round(dist * 10) / 10,
                        durationSec,
                        durationStr: this.formatDuration(durationSec)
                    });
                });

                matches.sort((a, b) => a.durationSec - b.durationSec);
                this.lastRadarMatches = matches;
                this.renderRadarResults(matches, originId);
            } catch (err) {
                resultsContainer.innerHTML = `<div style="color:#d66;">Radar fout: ${err.message}</div>`;
            }
        },

        renderRadarResults: function(matches, originId) {
            const container = document.getElementById('gmb-radar-results');
            if (!container) return;
            if (!matches.length) {
                container.innerHTML = '<div class="gmb-muted">Geen steden gevonden die voldoen aan de criteria.</div>';
                return;
            }

            container.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong>${matches.length} doelen gevonden:</strong>
                    <button class="gmb-button gmb-button-secondary" id="gmb-radar-export-bb" style="padding:2px 8px;font-size:11px;">📋 Kopieer BB-tabel</button>
                </div>
                <table class="gmb-table" style="width:100%;font-size:11px;">
                    <thead>
                        <tr>
                            <th>Stad</th>
                            <th>Eigenaar</th>
                            <th>Punten</th>
                            <th>OC</th>
                            <th>CS-Tijd</th>
                            <th>Afstand</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matches.slice(0, 100).map(m => `
                            <tr>
                                <td><strong>${m.town.name || `[town]${m.town.id}[/town]`}</strong></td>
                                <td>${m.player}</td>
                                <td>${m.points.toLocaleString()}</td>
                                <td>OC ${m.ocean}</td>
                                <td style="color:#ffd166;font-weight:bold;">${m.durationStr}</td>
                                <td style="color:#aaa;">${m.dist}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelector('#gmb-radar-export-bb')?.addEventListener('click', () => this.exportRadarBB());
        },

        exportRadarBB: function() {
            if (!this.lastRadarMatches || !this.lastRadarMatches.length) return;
            const lines = ['[table]', '[*][b]Stad[/b][|][b]Eigenaar[/b][|][b]Punten[/b][|][b]OC[/b][|][b]CS-Looptijd[/b][/*]'];
            this.lastRadarMatches.slice(0, 50).forEach(m => {
                lines.push(`[*][town]${m.town.id}[/town][|][player]${m.player}[/player][|]${m.points}[|]OC ${m.ocean}[|]${m.durationStr}[/*]`);
            });
            lines.push('[/table]');
            this.copy(lines.join('\n'));
            this.record(`Radar-resultaten gekopieerd (${Math.min(50, this.lastRadarMatches.length)} steden).`, 'success');
        },

        renderTSL: function() {
            const container = document.getElementById('gmb-tsl-list');
            if (!container) return;
            const sortMode = document.getElementById('gmb-tsl-sort')?.value || 'name';
            const uw = GMB_API.getUW();
            if (!uw.ITowns || !uw.ITowns.getTowns) {
                container.innerHTML = '<div class="gmb-muted">ITowns niet beschikbaar</div>';
                return;
            }
            const towns = Object.values(uw.ITowns.getTowns()).map(t => {
                const id = t.getId ? t.getId() : t.id;
                const name = t.getName ? t.getName() : (t.name || `Stad ${id}`);
                const points = t.getPoints ? t.getPoints() : 0;
                const coord = t.getCoordinates ? t.getCoordinates() : { x: 0, y: 0 };
                const ocean = Math.floor(coord.x / 100) + Math.floor(coord.y / 100) * 10;
                const islandId = t.getIslandCoordinateX ? `${t.getIslandCoordinateX()}_${t.getIslandCoordinateY()}` : '—';
                return { id, name, points, ocean, islandId, x: coord.x, y: coord.y };
            });

            if (sortMode === 'name') towns.sort((a, b) => a.name.localeCompare(b.name));
            else if (sortMode === 'points') towns.sort((a, b) => b.points - a.points);
            else if (sortMode === 'ocean') towns.sort((a, b) => a.ocean - b.ocean || a.name.localeCompare(b.name));
            else if (sortMode === 'island') towns.sort((a, b) => String(a.islandId).localeCompare(String(b.islandId)) || a.name.localeCompare(b.name));

            this.lastTslTowns = towns;
            container.innerHTML = `
                <table class="gmb-table" style="width:100%;font-size:11px;">
                    <thead>
                        <tr>
                            <th>Stad</th>
                            <th>Punten</th>
                            <th>Oceaan</th>
                            <th>Coördinaten</th>
                            <th>Actie</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${towns.map(t => `
                            <tr>
                                <td><strong>${t.name}</strong></td>
                                <td>${t.points.toLocaleString()}</td>
                                <td>OC ${t.ocean}</td>
                                <td style="color:#aaa;">${t.x}/${t.y}</td>
                                <td>
                                    <button class="gmb-button gmb-button-secondary gmb-switch-town" data-town="${t.id}" style="padding:1px 6px;font-size:10px;">Selecteer</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('.gmb-switch-town').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.town);
                    if (uw.ITowns && uw.ITowns.setCurrentTown) {
                        uw.ITowns.setCurrentTown(id);
                        GMB.notify(`Actieve stad gewisseld naar ID ${id}`, { type: 'success' });
                    }
                });
            });
        },

        exportTslBB: function() {
            if (!this.lastTslTowns || !this.lastTslTowns.length) return;
            const lines = ['[table]', '[*][b]Stad[/b][|][b]Punten[/b][|][b]Oceaan[/b][|][b]Coördinaten[/b][/*]'];
            this.lastTslTowns.forEach(t => {
                lines.push(`[*][town]${t.id}[/town][|]${t.points}[|]OC ${t.ocean}[|]${t.x}/${t.y}[/*]`);
            });
            lines.push('[/table]');
            this.copy(lines.join('\n'));
            this.record(`Stedenlijst geëxporteerd (${this.lastTslTowns.length} steden).`, 'success');
        },

        applyStyles: function() {
            if (document.getElementById('gmb-reports-styles')) return;
            const style = document.createElement('style');
            style.id = 'gmb-reports-styles';
            style.textContent = `
                .gmb-reports-btn{margin:2px 6px!important;padding:4px 10px!important;cursor:pointer}
                .gmb-reports-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center}
                .gmb-reports-dialog{width:min(720px,94vw);max-height:90vh;overflow:auto;background:#e8d5a5;border:3px solid #6b4c23;border-radius:8px;box-shadow:0 8px 30px #000;color:#322719;font:13px Arial,sans-serif}
                .gmb-reports-dialog-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:linear-gradient(#f4e3b9,#c8a86c);border-bottom:1px solid #816331;font-weight:bold;font-size:15px}
                .gmb-reports-dialog-body{padding:10px 12px}
                .gmb-reports-dialog-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px 10px;margin-bottom:8px}
                .gmb-reports-dialog textarea{display:block;box-sizing:border-box;width:100%;height:280px;resize:vertical;font:12px/1.45 Consolas,monospace}
                .gmb-reports-dialog-actions{display:flex;align-items:center;gap:8px;margin-top:8px}
                .gmb-reports-dialog-status{margin-left:auto;color:#315b31}
                @media(max-width:560px){.gmb-reports-dialog-options{grid-template-columns:repeat(2,minmax(0,1fr))}}
                #place_simulator { overflow: hidden !important; }
                #place_simulator .place_sim_wrap_mods { margin-bottom: 0px !important; }
            `;
            document.head.appendChild(style);
        },

        convertOpenReport: function(root) {
            try {
                const scope = root || this.findReportRoot();
                if (!scope) throw new Error('Geen geopend rapport gevonden.');
                const data = this.parseReport(scope, GMB_API.getUW().GameData || {});
                const text = this.buildBB(data, this.settings);
                this.lastText = text;
                const preview = document.getElementById('gmb-reports-preview');
                if (preview) preview.value = text;
                this.record(`Rapport "${data.title || data.type}" (${data.type}) geconverteerd (${text.length} tekens).`, 'success');
                this.setStatus('Geconverteerd — BB-tabel staat klaar in de dialoog.');
                this.openDialog(data);
                return text;
            } catch (error) {
                this.record(`Converteren mislukt: ${error.message}`, 'error');
                this.setStatus(error.message, true);
                return '';
            }
        },

        openDialog: function(data) {
            this.closeDialog();
            this.applyStyles();
            const overlay = document.createElement('div');
            overlay.className = 'gmb-reports-overlay';
            overlay.setAttribute('role', 'presentation');
            overlay.addEventListener('click', event => { if (event.target === overlay) this.closeDialog(); });
            const dialog = document.createElement('section');
            dialog.className = 'gmb-reports-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-label', 'Rapport naar BB-code');
            const head = document.createElement('div');
            head.className = 'gmb-reports-dialog-head';
            const title = document.createElement('span');
            title.textContent = `Rapport naar BB-code — ${data.title || data.type}`;
            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = '✕';
            close.title = 'Sluiten';
            close.addEventListener('click', () => this.closeDialog());
            head.append(title, close);
            const body = document.createElement('div');
            body.className = 'gmb-reports-dialog-body';
            const optionGrid = document.createElement('div');
            optionGrid.className = 'gmb-reports-dialog-options';
            Object.entries(this.optionLabels).forEach(([key, label]) => {
                const option = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = !!this.settings[key];
                input.dataset.reportOption = key;
                option.append(input, document.createTextNode(` ${label}`));
                optionGrid.appendChild(option);
            });
            const label = document.createElement('strong');
            label.textContent = 'BB-code / voorbeeld';
            const preview = document.createElement('textarea');
            preview.setAttribute('aria-label', 'BB-code voorbeeld');
            preview.spellcheck = false;
            const actions = document.createElement('div');
            actions.className = 'gmb-reports-dialog-actions';
            const copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'button';
            copy.textContent = 'Kopiëren';
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'button';
            closeButton.textContent = 'Sluiten';
            const status = document.createElement('span');
            status.className = 'gmb-reports-dialog-status';
            actions.append(copy, closeButton, status);
            const regenerate = () => {
                this.lastText = this.buildBB(data, this.settings);
                preview.value = this.lastText;
                const tabPreview = document.getElementById('gmb-reports-preview');
                if (tabPreview) tabPreview.value = this.lastText;
            };
            optionGrid.addEventListener('change', event => {
                const key = event.target.dataset && event.target.dataset.reportOption;
                if (!key) return;
                this.settings[key] = event.target.checked;
                GMB.storage.set('reports_options', this.settings);
                const tab = document.getElementById('gmb-tab-mgr-reports');
                const mirror = tab && tab.querySelector(`[data-reports-option="${key}"]`);
                if (mirror) mirror.checked = event.target.checked;
                regenerate();
            });
            copy.addEventListener('click', async () => {
                await this.copy(preview.value);
                status.textContent = 'Gekopieerd';
            });
            closeButton.addEventListener('click', () => this.closeDialog());
            dialog.addEventListener('keydown', event => { if (event.key === 'Escape') this.closeDialog(); });
            body.append(optionGrid, label, preview, actions);
            dialog.append(head, body);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            this.dialog = overlay;
            regenerate();
            preview.focus();
            preview.select();
        },

        closeDialog: function() {
            if (this.dialog) this.dialog.remove();
            this.dialog = null;
        },

        copy: async function(text) {
            if (!text) return this.setStatus('Niets om te kopiëren.', true);
            try {
                if (typeof GM_setClipboard === 'function') GM_setClipboard(text, 'text');
                else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
                else throw new Error('Klembord-API niet beschikbaar.');
                this.record('BB-code naar klembord gekopieerd.', 'success');
                this.setStatus('Gekopieerd naar klembord.');
            } catch (error) {
                this.record(`Kopiëren mislukt: ${error.message}`, 'error');
                this.setStatus(error.message, true);
            }
        },

        decodeLink: function(node) {
            if (!node) return null;
            const href = node.getAttribute('href') || '';
            const part = href.split('#').pop();
            try { return JSON.parse(atob(part)); } catch (error) { return null; }
        },

        getLinkId: function(node) {
            const payload = this.decodeLink(node);
            return payload && Number(payload.id) || null;
        },

        getTownCoordinates: function(townId) {
            if (!townId) return null;
            try {
                const uw = GMB_API.getUW();
                if (uw.ITowns && uw.ITowns.getTown) {
                    const itown = uw.ITowns.getTown(townId);
                    if (itown && itown.getCoordinates) {
                        const c = itown.getCoordinates();
                        if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) return { x: Number(c.x), y: Number(c.y) };
                    }
                }
            } catch (e) {}
            const townsObj = GMB_WorldData && GMB_WorldData.cache && GMB_WorldData.cache.get(`${GMB_API.getWorldId()}:towns`);
            if (townsObj && townsObj.value && townsObj.value.byId) {
                const t = townsObj.value.byId.get(Number(townId));
                if (t) return { x: t.x, y: t.y };
            }
            return null;
        },

        formatDuration: function(seconds) {
            if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        },

        parseSide: function(box) {
            const side = { town: '', player: '', ally: '' };
            if (!box) return side;
            const townLink = box.querySelector('.gp_town_link');
            const info = this.decodeLink(townLink);
            const townName = townLink ? townLink.textContent.trim() : '';
            side.town = info && info.id ? `[town]${info.id}[/town]` : townName;
            const playerNode = box.querySelector('li.town_owner a, .gp_player_link');
            const playerText = playerNode ? playerNode.textContent.trim() : ((box.querySelector('li.town_owner') || {}).textContent || '').trim();
            side.player = playerText ? `[player]${playerText}[/player]` : '';
            const allyNode = box.querySelector('li.town_owner_ally a');
            const allyMatch = allyNode && /'([^']*)'/.exec(allyNode.getAttribute('onclick') || '');
            side.ally = allyMatch ? `[ally]${allyMatch[1]}[/ally]` : (allyNode ? allyNode.textContent.trim() : '');
            return side;
        },

        unitKey: function(node, gameData) {
            const style = node.getAttribute('style') || '';
            const styleMatch = /\/([a-z_]+)_\d+x\d+\.png/.exec(style);
            if (styleMatch) return styleMatch[1];
            const units = gameData.units || {};
            const keys = Object.keys(units);
            const classes = [...node.classList];
            return classes.find(name => keys.includes(name)) || classes.find(name => !/^(report_unit|unit_icon\d*x\d*|unit|bold)$/.test(name)) || 'unknown';
        },

        parseUnits: function(root, selector, gameData) {
            const result = [];
            root.querySelectorAll(selector).forEach(container => {
                const unit = container.matches('.report_unit') ? container : container.querySelector('.report_unit');
                if (!unit) return;
                const key = this.unitKey(unit, gameData);
                const countNode = unit.querySelector('span.value, span, .value');
                const countText = countNode ? countNode.textContent.trim() : unit.textContent.trim();
                const lostNode = container.querySelector('.report_losts');
                const lostText = lostNode ? lostNode.textContent.trim() : '';
                const parseCount = value => {
                    const digits = String(value || '').replace(/[^\d]/g, '');
                    const count = Number(digits);
                    return Number.isSafeInteger(count) ? count : null;
                };
                const count = parseCount(countText);
                const lost = parseCount(lostText);
                const unitData = (gameData.units || {})[key] || {};
                result.push({
                    key, name: unit.getAttribute('title') || unit.getAttribute('data-unit-name') || unitData.name || key,
                    count: count === null ? countText || '?' : count,
                    lost: lost === null ? 0 : lost,
                    cost: unitData.resources ? {
                        wood: Number(unitData.resources.wood) || 0,
                        stone: Number(unitData.resources.stone) || 0,
                        iron: Number(unitData.resources.iron) || 0,
                        favor: Number(unitData.favor) || 0,
                        pop: Number(unitData.population) || 0
                    } : null
                });
            });
            return result;
        },

        detectType: function(root) {
            const arrow = root.querySelector('#report_arrow img');
            const src = arrow ? (arrow.getAttribute('src') || '') : '';
            const match = /\/([a-z_]+)\.png(?:[?#].*)?$/i.exec(src);
            let type = match ? match[1].toLowerCase() : 'unknown';
            if (type === 'attack' && root.querySelector('.support_report_summary')) type = 'attackSupport';
            if (type === 'conquest') type = 'conquer';
            if (type === 'conquerold' || type === 'conqueroldtroops') type = 'conquer';
            if (root.querySelector('#spy_buildings')) type = 'espionage';
            return type;
        },

        parseReport: function(root, gameData) {
            const text = selector => { const node = root.querySelector(selector); return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; };
            const type = this.detectType(root);
            const defTownLink = root.querySelector('#report_receiving_town .gp_town_link');
            const attTownLink = root.querySelector('#report_sending_town .gp_town_link');
            const defenderTownId = this.getLinkId(defTownLink);
            const attackerTownId = this.getLinkId(attTownLink);

            const data = {
                type, title: text('#report_report_header').replace(/📋\s*BB/, '').trim(), time: text('#report_date'),
                morale: text('span.fight_bonus.morale'), luck: text('span.fight_bonus.luck'), nightbonus: text('span.fight_bonus.nightbonus'),
                oldwall: text('span.fight_bonus.oldwall'),
                attacker: this.parseSide(root.querySelector('#report_sending_town')),
                defender: this.parseSide(root.querySelector('#report_receiving_town')),
                attackerTownId, defenderTownId,
                attackerUnits: [], defenderUnits: [], buildings: [], resources: [], loot: '',
                silver: '', info: '', god: '', powers: [], conquer: ''
            };
            if (['attack', 'breach', 'take_over', 'raise'].includes(type)) {
                data.attackerUnits = this.parseUnits(root, '#left_side div.report_side_attacker_unit', gameData);
                data.defenderUnits = this.parseUnits(root, '#right_side div.report_side_attacker_unit', gameData);
            } else if (type === 'attackSupport') {
                data.defenderUnits = this.parseUnits(root, 'div.support_report_summary div.report_units.report_side_defender div.report_side_defender_unit', gameData);
            } else if (type === 'support') {
                data.defenderUnits = this.parseUnits(root, '#report_game_body div.report_units.report_side_defender div.report_side_defender_unit', gameData);
            } else if (type === 'espionage') {
                data.defenderUnits = this.parseUnits(root, '#left_side > div.spy_success_left_align > div.report_unit, #left_side > div.report_unit', gameData);
                const buildingsRoot = root.querySelector('#spy_buildings');
                if (buildingsRoot) {
                    const buildingSelector = '#spy_buildings > div.spy_success_left_align > div.report_unit, #spy_buildings > div.report_unit';
                    root.querySelectorAll(buildingSelector).forEach(node => {
                        const key = this.unitKey(node, gameData);
                        const level = node.querySelector('span');
                        const building = gameData.buildings && gameData.buildings[key] || {};
                        data.buildings.push({ key, name: node.getAttribute('title') || building.name || key, level: level ? level.textContent.trim() : '' });
                    });
                }
                const ironNode = root.querySelector('#payed_iron span') ||
                    root.querySelector('#right_side > .spy_success_left_align') ||
                    root.querySelector('#right_side > p');
                data.silver = ironNode ? ironNode.textContent.replace(/\s+/g, ' ').trim() : '';
                const infoNode = root.querySelector('#right_side > h4, #right_side > p, #report_game_body > div > p');
                data.info = infoNode ? infoNode.textContent.replace(/\s+/g, ' ').trim() : '';
                const godNode = root.querySelector('#right_side .god_display .god_micro');
                data.god = godNode ? (godNode.getAttribute('title') || [...godNode.classList].filter(name => name !== 'god_micro').join(' ')) : '';
                data.godKey = godNode ? ([...godNode.classList].find(name => name !== 'god_micro') || '') : '';
            }
            root.querySelectorAll('.report_side_attacker .report_power, .report_side_attacker .report_alliance_power, .report_side_defender .report_power, .report_side_defender .report_alliance_power').forEach(node => {
                const power = node.getAttribute('title') || node.getAttribute('aria-label') || node.textContent.trim() || [...node.classList].filter(name => !/^(report_power|report_alliance_power)$/.test(name)).join(' ');
                if (power && !data.powers.includes(power)) data.powers.push(power);
            });
            const resourceNames = {
                wood_img: 'Hout', wood: 'Hout', stone_img: 'Steen', stone: 'Steen',
                iron_img: 'Zilver', iron: 'Zilver', favor_img: 'Gunst'
            };
            const addResource = (icon, parent) => {
                const label = resourceNames[icon.className] || resourceNames[[...icon.classList].find(name => Object.prototype.hasOwnProperty.call(resourceNames, name))];
                if (!label) return;
                const value = (parent.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\d]*/, '');
                if (value) data.resources.push({ label, value });
            };
            root.querySelectorAll('#resources li.res_background').forEach(item => {
                const icon = item.querySelector('.wood_img, .stone_img, .iron_img, .favor_img');
                if (icon) addResource(icon, item);
            });
            if (!data.resources.length) {
                root.querySelectorAll('#right_side li div.res_background32').forEach(item => {
                    const icon = item.firstElementChild;
                    if (icon) addResource(icon, item);
                });
            }
            const resourceBox = root.querySelector('#resources');
            if (resourceBox) {
                const spans = [...resourceBox.querySelectorAll(':scope > span')];
                const hasHeader = !!resourceBox.querySelector(':scope > h4');
                const lootNode = spans.length ? spans[hasHeader && spans.length > 1 ? 1 : spans.length - 1] : null;
                data.loot = lootNode ? lootNode.textContent.replace(/\s+/g, ' ').trim() : '';
            }
            if (type === 'conquer' || type === 'illusion' || type === 'found') {
                const paragraph = root.querySelector('#report_game_body p');
                if (paragraph) {
                    const copy = paragraph.cloneNode(true);
                    copy.querySelectorAll('a.gp_town_link').forEach(link => {
                        const id = this.getLinkId(link);
                        link.replaceWith(document.createTextNode(id ? `[town]${id}[/town]` : link.textContent));
                    });
                    copy.querySelectorAll('a.gp_player_link').forEach(link => link.replaceWith(document.createTextNode(`[player]${link.textContent.trim()}[/player]`)));
                    data.conquer = copy.textContent.replace(/\s+/g, ' ').trim();
                }
                const colonizers = root.querySelector('#conqueror_units_in_town > span');
                if (colonizers && colonizers.textContent.trim()) data.conquer = `${data.conquer} ${colonizers.textContent.trim()}`.trim();
            }

            if (data.defenderTownId) {
                const wallLvl = data.oldwall || (data.buildings.find(b => b.key === 'wall') || {}).level;
                const towerPresent = data.buildings.some(b => b.key === 'tower');
                if (wallLvl) {
                    this.saveWallInfo({
                        townId: data.defenderTownId,
                        townName: data.defender.town,
                        player: data.defender.player,
                        ally: data.defender.ally,
                        wall: wallLvl,
                        tower: towerPresent ? 'Ja' : (data.buildings.length ? 'Nee' : '—'),
                        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
                    });
                }
            }

            return data;
        },

        getRevoltInfo: function(data) {
            const info = {
                townId: data.defenderTownId,
                town: data.defender.town || 'Onbekend',
                player: data.defender.player || '',
                wall: data.oldwall || '',
                tower: '—',
                god: data.god || '',
                phalanx: '—',
                ram: '—',
                csTime: '',
                online: 'Ja'
            };

            try {
                const uw = GMB_API.getUW();
                let itown = null;
                if (info.townId && uw.ITowns && uw.ITowns.getTown) itown = uw.ITowns.getTown(info.townId);
                if (!itown && uw.ITowns && uw.ITowns.getCurrentTown) {
                    const cur = uw.ITowns.getCurrentTown();
                    if (cur && (cur.getId ? cur.getId() : cur.id) === info.townId) itown = cur;
                }

                if (itown) {
                    if (itown.buildings) {
                        const b = itown.buildings();
                        if (!info.wall) info.wall = b.getBuildingLevel('wall');
                        info.tower = b.getBuildingLevel('tower') > 0 ? 'Ja' : 'Nee';
                    }
                    if (!info.god && itown.getGod) info.god = itown.getGod() || '';
                    if (itown.researches) {
                        const r = itown.researches();
                        info.phalanx = r.hasResearch('phalanx') ? 'Ja' : 'Nee';
                        info.ram = (r.hasResearch('meteorology') || r.hasResearch('ram')) ? 'Ja' : 'Nee';
                    }
                } else {
                    if (data.buildings && data.buildings.length) {
                        const wb = data.buildings.find(b => b.key === 'wall');
                        if (wb && wb.level && !info.wall) info.wall = wb.level;
                        const tb = data.buildings.find(b => b.key === 'tower');
                        if (tb) info.tower = tb.level && tb.level !== '0' ? 'Ja' : 'Nee';
                    }
                    const savedWalls = GMB.storage.get('reports_saved_walls', {});
                    if (info.townId && savedWalls[info.townId]) {
                        const sw = savedWalls[info.townId];
                        if (!info.wall && sw.wall) info.wall = `${sw.wall} (${sw.date})`;
                        if (info.tower === '—' && sw.tower) info.tower = sw.tower;
                    }
                }

                const attCoord = this.getTownCoordinates(data.attackerTownId);
                const defCoord = this.getTownCoordinates(data.defenderTownId);
                if (attCoord && defCoord) {
                    const dist = Math.hypot(attCoord.x - defCoord.x, attCoord.y - defCoord.y);
                    const unitSpeed = (uw.Game && uw.Game.constants && uw.Game.constants.unit_movement_boost) || 1;
                    const seconds = Math.round((dist / (3 * unitSpeed)) * 3600);
                    info.csTime = this.formatDuration(seconds);
                }
            } catch (e) {}

            return info;
        },

        formatUnits: function(units, withLosses) {
            return units.map(unit => {
                const lost = withLosses && unit.lost ? ` [color=#b50307](-${unit.lost})[/color]` : '';
                const icon = unit.key && unit.key !== 'unknown'
                    ? `[img]https://www.grcrt.net/static/${encodeURIComponent(unit.key)}.png[/img] `
                    : '';
                return `${icon}${unit.name}: ${unit.count}${lost}`;
            }).join(', ');
        },

        lossCost: function(units) {
            const total = { wood: 0, stone: 0, iron: 0, favor: 0, pop: 0 };
            units.forEach(unit => {
                if (!unit.cost || !unit.lost) return;
                Object.keys(total).forEach(key => { total[key] += (unit.cost[key] || 0) * unit.lost; });
            });
            return total;
        },

        buildBB: function(data, options) {
            const lines = ['[table]'];
            const row = (...cells) => `[*]${cells.join('[|]')}[/*]`;
            const side = (label, entry, hidden) => {
                if (hidden) return row(`[b]${label}[/b]`, '?');
                const parts = [
                    options.hideTowns ? '' : entry.town,
                    entry.player,
                    entry.ally ? `(${entry.ally})` : ''
                ].filter(Boolean);
                if (parts.length) lines.push(row(`[b]${label}[/b]`, parts.join(' ')));
            };
            if (data.title || data.time) lines.push(row(`[b]${data.title || data.type}[/b]`, data.time || ''));
            side('Aanvaller', data.attacker, options.hideAttacker);
            side('Verdediger', data.defender, options.hideDefender);
            if (options.morale) {
                const bonusIcon = (file, text) => text ? `[img]https://www.grcrt.net/img/${file}.png[/img] ${text}` : '';
                const extras = [bonusIcon('morale', data.morale), bonusIcon('luck', data.luck), bonusIcon('oldwall', data.oldwall), bonusIcon('nightbonus', data.nightbonus)].filter(Boolean);
                if (extras.length) lines.push(row('[b]Gevechtsbonus[/b]', extras.join(' · ')));
            }
            if (options.powers) {
                const extras = [data.god && `${data.godKey ? `[img]https://cdn.grcrt.net/ui/3/${encodeURIComponent(data.godKey)}.png[/img] ` : ''}God: ${data.god}`, ...(data.powers || []).map(power => `Spreuk: ${power}`)].filter(Boolean);
                if (extras.length) lines.push(row('[b]God / spreuken[/b]', extras.join(' · ')));
            }
            if (options.units) {
                const attacker = options.hideAttacker ? [] : (data.attackerUnits || []);
                const defender = options.hideDefender ? [] : (data.defenderUnits || []);
                const byKey = new Map();
                attacker.concat(defender).forEach(unit => { if (!byKey.has(unit.key)) byKey.set(unit.key, unit); });
                if (byKey.size) {
                    lines.push(row('[b]Eenheid[/b]', '[b]Aanvaller[/b]', '[b]Verdediger[/b]'));
                    byKey.forEach((unit, key) => {
                        const left = attacker.find(item => item.key === key);
                        const right = defender.find(item => item.key === key);
                        const icon = key && key !== 'unknown' ? `[img]https://www.grcrt.net/static/${encodeURIComponent(key)}.png[/img] ` : '';
                        const name = icon + unit.name;
                        const count = item => item ? `${item.count}${item.lost ? ` [color=#b50307](-${item.lost})[/color]` : ''}` : '—';
                        lines.push(row(name, count(left), count(right)));
                    });
                } else if (data.type === 'espionage' && data.defenderUnits.length) {
                    lines.push(row('[b]Gespioneerde eenheden[/b]', this.formatUnits(data.defenderUnits, false)));
                }
            }
            if (options.cost) {
                const cdn = 'https://cdn.grcrt.net/ui/';
                const costRow = (label, units, hidden) => {
                    if (hidden) return;
                    const cost = this.lossCost(units);
                    if (cost.wood || cost.stone || cost.iron || cost.favor || cost.pop) {
                        const icon = name => `[img]${cdn}${name}.png[/img]`;
                        const parts = [
                            cost.wood && `${icon('3/wood')} ${cost.wood}`,
                            cost.stone && `${icon('3/stone')} ${cost.stone}`,
                            cost.iron && `${icon('3/iron')} ${cost.iron}`,
                            cost.favor && `${icon('power')} ${cost.favor}`,
                            cost.pop && `${icon('pop')} ${cost.pop}`
                        ].filter(Boolean);
                        lines.push(row(`[b]${label} — verliezen[/b]`, parts.join('  ')));
                    }
                };
                costRow('Aanvaller', data.attackerUnits || [], options.hideAttacker);
                costRow('Verdediger', data.defenderUnits || [], options.hideDefender);
            }
            if (options.buildings && data.buildings && data.buildings.length) {
                lines.push(row('[b]Gebouw[/b]', '[b]Niveau[/b]'));
                data.buildings.forEach(item => lines.push(row(item.name, item.level || '—')));
            }
            if (options.loot && data.resources && data.resources.length) {
                const resIcons = { Hout: '3/wood', Steen: '3/stone', Zilver: '3/iron', Gunst: 'power' };
                data.resources.forEach(item => {
                    const icon = resIcons[item.label] ? `[img]https://cdn.grcrt.net/ui/${resIcons[item.label]}.png[/img] ` : '';
                    lines.push(row(`${icon}[b]${item.label}[/b]`, item.value));
                });
                if (data.loot) lines.push(row('[b]Buit / resultaat[/b]', data.loot));
            }
            if (options.silver) {
                if (data.silver) lines.push(row('[b]Zilver / spionagekosten[/b]', data.silver));
                if (data.info && data.info !== data.silver) lines.push(row('[b]Rapportinfo[/b]', data.info));
            }
            if (data.conquer) lines.push(row('[b]Verovering / resultaat[/b]', data.conquer));
            lines.push('[/table]');

            if (options.revoltInfo) {
                const r = this.getRevoltInfo(data);
                const revoltLines = ['[quote][table]'];
                revoltLines.push(`[*] [b]Revolt-informatie[/b] [|] ${r.town} ${r.player ? `(${r.player})` : ''} [/*]`);
                if (r.wall || r.tower !== '—') revoltLines.push(`[*] [b]Verdediging[/b] [|] Muur: ${r.wall || '0'} · Toren: ${r.tower} [/*]`);
                if (r.god) revoltLines.push(`[*] [b]God[/b] [|] ${r.god} [/*]`);
                if (r.phalanx !== '—' || r.ram !== '—') revoltLines.push(`[*] [b]Onderzoeken[/b] [|] Falanx: ${r.phalanx} · Stormram: ${r.ram} [/*]`);
                if (r.csTime) revoltLines.push(`[*] [b]CS-looptijd[/b] [|] ${r.csTime} [/*]`);
                revoltLines.push(`[*] [b]Online status[/b] [|] ${r.online} [/*]`);
                revoltLines.push('[/table][/quote]');
                lines.unshift(revoltLines.join('\n'));
            }

            const fullBB = lines.join('\n');
            this.lastText = fullBB;
            GMB.storage.set('reports_last_bb', fullBB);
            return fullBB;
        }
    };

    const GMB_GodTools = {
        enabled: false,
        spellCooldown: true,
        nightBonus: true,
        wonderTrade: true,
        wwFilledWindow: null,
        eventSubs: [],
        tickTimer: null,
        pollTimer: null,

        init: function() {
            this.spellCooldown = GMB.storage.get('godtools_spell_cooldown', true);
            this.nightBonus = GMB.storage.get('godtools_night_bonus', true);
            this.wonderTrade = GMB.storage.get('godtools_wonder_trade', true);
            this.addTab();
            if (GMB.storage.get('godtools_enabled', false)) this.start();
        },

        addTab: function() {
            if (document.getElementById('gmb-tab-godtools')) return;
            GMB_UI.addTab('godtools', '🔮 Goden & Spellen', `
                <div class="gmb-section">
                    <div class="gmb-section-title">🔮 Goden & Spellen tools</div>
                    <label><input id="gmb-godtools-enabled" type="checkbox"> God-tools inschakelen</label>
                    <div id="gmb-godtools-status" class="gmb-muted" style="margin:5px 0;">Uitgeschakeld</div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Weergave-opties</div>
                    ${GMB_UI.createToggle('Spreuk cooldown-tijd tonen', 'godtools_spell_cooldown', true, (active) => {
                        this.spellCooldown = active;
                        if (this.enabled) this.refreshSpellCooldown();
                    })}
                    <div class="gmb-muted">Toont bij grijze spreuken de resterende tijd tot genoeg gunst.</div>
                    ${GMB_UI.createToggle('Nachtbonus-waarschuwing tonen', 'godtools_night_bonus', true, (active) => {
                        this.nightBonus = active;
                        if (this.enabled) this.refreshNightBonus();
                    })}
                    <div class="gmb-muted">Waarschuwt wanneer de aankomsttijd in een commando/aanval binnen het nachtbonus-venster valt.</div>
                    ${GMB_UI.createToggle('Wereldwonder gelijke verdeling', 'godtools_wonder_trade', true, (active) => {
                        this.wonderTrade = active;
                    })}
                    <div class="gmb-muted">Vult bij opening van het wonder-venster hout/steen/zilver automatisch gelijk (capaciteit ÷ 3).</div>
                </div>`);

            const tab = document.getElementById('gmb-tab-godtools');
            const checkbox = tab.querySelector('#gmb-godtools-enabled');
            checkbox.checked = !!GMB.storage.get('godtools_enabled', false);
            checkbox.addEventListener('change', () => checkbox.checked ? this.start() : this.stop());
        },

        setStatus: function(text, error = false) {
            const status = document.getElementById('gmb-godtools-status');
            if (status) { status.textContent = text; status.style.color = error ? '#d66' : ''; }
        },

        start: function() {
                        if (this.enabled) return;
            this.enabled = true;
            GMB.storage.set('godtools_enabled', true);
            const checkbox = document.getElementById('gmb-godtools-enabled');
            if (checkbox) checkbox.checked = true;
            this.hookGameEvents();
            this.tickTimer = setInterval(() => this.tickSpellCooldowns(), 1000);
            this.pollTimer = setInterval(() => { this.refreshSpellCooldown(); this.refreshNightBonus(); this.refreshWonderTrade(); }, 2000);
            this.refreshSpellCooldown();
            this.refreshNightBonus();
            this.refreshWonderTrade();
            this.setStatus('Actief — cooldown timers worden getoond.');
        },

        stop: function(reason = 'Uitgeschakeld.') {
            this.enabled = false;
            GMB.storage.set('godtools_enabled', false);
            this.unhookGameEvents();
            if (this.tickTimer) clearInterval(this.tickTimer);
            if (this.pollTimer) clearInterval(this.pollTimer);
            this.tickTimer = this.pollTimer = null;
            document.querySelectorAll('.gmb-spell-cd, .gmb-night-warning').forEach(node => node.remove());
            const checkbox = document.getElementById('gmb-godtools-enabled');
            if (checkbox) checkbox.checked = false;
            this.setStatus(reason || 'Uitgeschakeld.');
        },

        onEnable: function() {
            this.addTab();
        },

        getServerNow: function() {
            const uw = GMB_API.getUW();
            if (uw && uw.Timestamp && typeof uw.Timestamp.server === 'function') {
                const ts = uw.Timestamp.server();
                if (Number.isFinite(ts)) return ts;
            }
            return Date.now() / 1000;
        },

        getGodModels: function() {
            const uw = GMB_API.getUW();
            if (!uw || !uw.MM || !uw.Game || !uw.GameData || !uw.GameData.powers) return null;
            try {
                const playerGods = uw.MM.checkAndPublishRawModel('PlayerGods', { id: uw.Game.player_id });
                if (!playerGods) return null;
                const prodOverview = playerGods.getCurrentProductionOverview ? playerGods.getCurrentProductionOverview() : {};
                return { uw, playerGods, prodOverview };
            } catch (e) { return null; }
        },

        computeCooldownEnd: function(ctx, powerId) {
            const power = ctx.uw.GameData.powers[powerId];
            if (!power || !power.god_id || !power.favor) return null;
            const godProd = ctx.prodOverview[power.god_id] ? ctx.prodOverview[power.god_id].production : 0;
            if (!(godProd > 0)) return null;
            const prop = ctx.playerGods[power.god_id + '_favor_delta_property'];
            const currentFavor = prop && prop.calculateCurrentValue ? prop.calculateCurrentValue().unprocessedCurrentValue : 0;
            if (currentFavor >= power.favor) return 0;
            const secNeeded = Math.round(((power.favor - currentFavor) / godProd) * 3600);
            return this.getServerNow() + Math.max(1, secNeeded);
        },

        upsertBadge: function(icon, endTs) {
            let badge = icon.querySelector('.gmb-spell-cd');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'gmb-spell-cd';
                badge.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.75);color:#ffd166;font-size:9px;text-align:center;font-weight:bold;border-radius:2px;pointer-events:none;z-index:3000;';
                const pos = window.getComputedStyle(icon).position;
                if (pos === 'static') icon.style.position = 'relative';
                icon.appendChild(badge);
            }
            badge.dataset.end = String(endTs);
        },

        refreshSpellCooldown: function() {
            if (!this.enabled || !this.spellCooldown) return;
            const ctx = this.getGodModels();
            if (!ctx) return;

            // Hoofdmenu: goddelijke spreuken balk
            document.querySelectorAll('div.gods_spells_menu div.new_ui_power_icon.disabled[data-power_id]').forEach(icon => {
                const endTs = this.computeCooldownEnd(ctx, icon.getAttribute('data-power_id'));
                if (endTs === null) return;
                if (endTs === 0) {
                    const badge = icon.querySelector('.gmb-spell-cd');
                    if (badge) badge.remove();
                } else {
                    this.upsertBadge(icon, endTs);
                }
            });

            // God-vensters (stad/god info & commando's): .js-power-icon.disabled
            document.querySelectorAll('.js-power-icon.disabled[data-power_id]').forEach(icon => {
                const powerId = icon.getAttribute('data-power_id');
                const power = ctx.uw.GameData.powers[powerId];
                if (!power || !power.god_id) return;
                const win = icon.closest('[id^="window_"], .gpwindow, .window') || document;
                if (win.querySelector && win.querySelector('.js-god-box.disabled.' + power.god_id)) return;
                const endTs = this.computeCooldownEnd(ctx, powerId);
                if (endTs === null) return;
                if (endTs === 0) {
                    const badge = icon.querySelector('.gmb-spell-cd');
                    if (badge) badge.remove();
                } else {
                    this.upsertBadge(icon, endTs);
                }
            });
        },

        tickSpellCooldowns: function() {
            if (!this.enabled) return;
            const now = this.getServerNow();
            document.querySelectorAll('.gmb-spell-cd').forEach(badge => {
                const end = Number(badge.dataset.end);
                if (!Number.isFinite(end)) { badge.remove(); return; }
                const remaining = Math.max(0, Math.round(end - now));
                if (remaining <= 0) { badge.remove(); return; }
                badge.textContent = this.formatRemaining(remaining);
            });
        },

        formatRemaining: function(sec) {
            if (sec >= 3600) {
                const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
                return `${h}u ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
            }
            if (sec >= 60) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
            return `${sec}s`;
        },

        getNightBonusHours: function() {
            const uw = GMB_API.getUW();
            const c = (uw && uw.Game && uw.Game.constants) || {};
            const start = c.night_bonus_start_hour ?? c.nightBonusStartHour ?? c.night_bonus_start ?? 0;
            const end = c.night_bonus_end_hour ?? c.nightBonusEndHour ?? c.night_bonus_end ?? 8;
            return { start: Number(start) || 0, end: Number(end) || 0 };
        },

        refreshNightBonus: function() {
            if (!this.enabled || !this.nightBonus) return;
            const { start, end } = this.getNightBonusHours();

            document.querySelectorAll('.attack_support_window, .command_info, #command_box').forEach(win => {
                const existing = win.querySelector('.gmb-night-warning');
                let inNight = false;
                let arrivalText = '';

                // Primair: native nightbonus-indicator van het spel
                const nativeNb = win.querySelector('.nightbonus, .fight_bonus.nightbonus');
                if (nativeNb && (nativeNb.offsetParent !== null || nativeNb.children.length)) {
                    inNight = true;
                } else {
                    // Fallback: arrival-tijd parsen en vergelijken met bonus-uren
                    const arrivalNode = win.querySelector('.arrival_time, .time_arrival, .duration_container .arrival');
                    if (arrivalNode) {
                        const m = arrivalNode.textContent.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                        if (m) {
                            arrivalText = m[0];
                            const hour = Number(m[1]);
                            inNight = (start < end)
                                ? (hour >= start && hour < end)
                                : (hour >= start || hour < end);
                        }
                    }
                }

                if (inNight && !existing) {
                    const badge = document.createElement('div');
                    badge.className = 'gmb-night-warning';
                    badge.style.cssText = 'background:#800e13;color:#ffccd5;border:1px solid #c9184a;border-radius:4px;padding:4px 8px;margin:5px 0;font-size:11px;font-weight:bold;text-align:center;';
                    badge.textContent = `🌙 Nachtbonus actief${arrivalText ? ` (aankomst ${arrivalText})` : ''}`;
                    const anchor = win.querySelector('.arrival_time, .time_arrival') || win.querySelector('.duration_container') || win;
                    anchor.parentNode.insertBefore(badge, anchor.nextSibling);
                } else if (!inNight && existing) {
                    existing.remove();
                }
            });
        },

        getTradeCapacity: function() {
            const uw = GMB_API.getUW();
            try {
                const town = uw.MM && uw.MM.checkAndPublishRawModel('Town', { id: uw.Game.townId });
                const cap = town && town.getAvailableTradeCapacity ? town.getAvailableTradeCapacity() : 0;
                if (cap > 0) return cap;
            } catch (e) {}
            try {
                const itown = uw.ITowns && uw.ITowns.getCurrentTown && uw.ITowns.getCurrentTown();
                const cap = itown && itown.getAvailableTradeCapacity ? itown.getAvailableTradeCapacity() : 0;
                if (cap > 0) return cap;
            } catch (e) {}
            return 0;
        },

        getOpenWondersWindow: function() {
            const uw = GMB_API.getUW();
            try {
                const mgr = uw.GPWindowMgr || uw.WM;
                if (!mgr || typeof mgr.getOpen !== 'function') return null;
                const type = (uw.Layout && uw.Layout.wnd && uw.Layout.wnd.TYPE_WONDERS) || mgr.TYPE_WONDERS;
                const wins = mgr.getOpen(type);
                if (!wins) return null;
                const list = Array.isArray(wins) ? wins : [wins];
                return list[0] || null;
            } catch (e) { return null; }
        },

        refreshWonderTrade: function() {
            if (!this.enabled || !this.wonderTrade) return;
            const win = this.getOpenWondersWindow();
            if (!win) { this.wwFilledWindow = null; return; }
            if (this.wwFilledWindow === win) return;

            const uw = GMB_API.getUW();
            const spinners = uw.WorldWonders && uw.WorldWonders.spinners;
            if (!spinners) return;
            const share = Math.floor(this.getTradeCapacity() / 3);
            if (share <= 0) return;

            try {
                ['wood', 'stone', 'iron'].forEach(res => {
                    if (spinners[res] && typeof spinners[res].setValue === 'function') {
                        spinners[res].setValue(share);
                    }
                });
                this.wwFilledWindow = win;
            } catch (e) {}
        },

        hookGameEvents: function() {
            const uw = GMB_API.getUW();
            const observer = uw && uw.$ && uw.$.Observer;
            if (!observer || !uw.GameEvents) return;
            const events = [
                'ui.layout_gods_spells.state_changed',
                'ui.layout_gods_spells.rendered',
                'bar.powers.render',
                'favor.change',
                'town.town_switch',
                'window.daily_bonus.accept',
                'window.open'
            ];
            events.forEach(path => {
                const parts = path.split('.');
                let node = uw.GameEvents;
                for (const part of parts) { node = node && node[part]; }
                if (!node) return;
                try {
                    observer(node).subscribe('gmb_godtools_' + path.replace(/\./g, '_'), () => {
                        setTimeout(() => {
                            if (!this.enabled) return;
                            this.refreshSpellCooldown();
                            this.refreshNightBonus();
                            this.refreshWonderTrade();
                        }, 150);
                    });
                    this.eventSubs.push(path);
                } catch (e) {}
            });
        },

        unhookGameEvents: function() {
            const uw = GMB_API.getUW();
            const observer = uw && uw.$ && uw.$.Observer;
            if (!observer || !uw.GameEvents) { this.eventSubs = []; return; }
            this.eventSubs.forEach(path => {
                const parts = path.split('.');
                let node = uw.GameEvents;
                for (const part of parts) { node = node && node[part]; }
                if (!node) return;
                try { observer(node).unsubscribe('gmb_godtools_' + path.replace(/\./g, '_')); } catch (e) {}
            });
            this.eventSubs = [];
        }
    };
    GMB_GodTools.gameOnly = true;

    const GMB_UnitTools = {
        enabled: false,
        strengthEnabled: true,
        availableEnabled: true,
        sentEnabled: true,
        transportEnabled: true,
        compareEnabled: true,
        removeTooltips: false,
        mode: 'off', // 'off' = aanval, 'def' = verdediging
        pollTimer: null,
        injectedFor: null,
        sentUnits: { attack: {}, support: {} },
        bullseyeUnit: { current_group: '-1', mode: 'available' },
        unitCounter: null,
        gameEventsHooked: false,
        lastUnitCount: 0,
        avaDirty: false,

        init: function() {
            this.strengthEnabled = GMB.storage.get('unittools_strength', true);
            this.availableEnabled = GMB.storage.get('unittools_available', true);
            this.sentEnabled = GMB.storage.get('unittools_sent', true);
            this.transportEnabled = GMB.storage.get('unittools_transport', true);
            this.compareEnabled = GMB.storage.get('unittools_compare', true);
            this.removeTooltips = GMB.storage.get('unittools_rtt', false);
            this.mode = GMB.storage.get('unittools_mode', 'off');
            this.sentUnits = GMB.storage.get('unittools_sent_units', { attack: {}, support: {} });
            this.bullseyeUnit = Object.assign({ current_group: '-1', mode: 'available' }, GMB.storage.get('unittools_bullseye', {}));
            this.addTab();
            if (GMB.storage.get('unittools_enabled', false)) this.start();
        },

        addTab: function() {
            if (document.getElementById('gmb-tab-unittools')) return;
            GMB_UI.addTab('unittools', '⚔️ Units', `
                <div class="gmb-section">
                    <div class="gmb-section-title">⚔️ Units tools</div>
                    <label><input id="gmb-unittools-enabled" type="checkbox"> Unit-tools inschakelen</label>
                    <div id="gmb-unittools-status" class="gmb-muted" style="margin:5px 0;">Uitgeschakeld</div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Weergave-opties</div>
                    ${GMB_UI.createToggle('Sterkte-weergave in units-scherm', 'unittools_strength', true, (active) => {
                        this.strengthEnabled = active;
                        this.updatePanel();
                    })}
                    <div class="gmb-muted">Toont in het units-overzicht de totale aanval (hack/pierce/afstand) of verdediging van de-selectede eenheden.</div>
                    ${GMB_UI.createToggle('Beschikbare eenheden (bullseye + overzicht)', 'unittools_available', true, (active) => {
                        this.availableEnabled = active;
                        if (this.enabled) this.refreshAll();
                    })}
                    <div class="gmb-muted">Toont op de kaart een teller van de gekozen eenheid per stadengroep plus een overzicht-venster (totaal/beschikbaar/buiten/support).</div>
                    ${GMB_UI.createToggle('Verzonden eenheden bijhouden', 'unittools_sent', true, (active) => {
                        this.sentEnabled = active;
                        if (this.enabled) this.refreshAll();
                    })}
                    <div class="gmb-muted">Houdt bij hoeveel eenheden je per (aanval/support) hebt verstuurd; toont ze in het attack-venster met reset-knop.</div>
                    ${GMB_UI.createToggle('Transportcapaciteit (schepen)', 'unittools_transport', true, (active) => {
                        this.transportEnabled = active;
                        if (this.enabled) this.refreshAll();
                    })}
                    <div class="gmb-muted">Toont in het scheeps-overzicht hoeveel troepen je schepen kunnen meenemen (pop/capaciteit, incl. rekruteringen).</div>
                    ${GMB_UI.createToggle('Unit vergelijking', 'unittools_compare', true, (active) => {
                        this.compareEnabled = active;
                        this.refreshCompareButton();
                    })}
                    <div class="gmb-muted">Opent een vergelijkingsvenster:/statistieken van alle eenheden per type (aanval, verdediging, snelheid, buit, kosten, tijd).</div>
                    ${GMB_UI.createToggle('Tooltips op eenheden verwijderen', 'unittools_rtt', false, (active) => {
                        this.removeTooltips = active;
                        if (this.enabled) this.refreshAll();
                    })}
                    <div class="gmb-muted">Verwijdert hover-tooltips van eenheids-iconen (snellere weergave).</div>
                </div>`);

            const tab = document.getElementById('gmb-tab-unittools');
            const checkbox = tab.querySelector('#gmb-unittools-enabled');
            checkbox.checked = !!GMB.storage.get('unittools_enabled', false);
            checkbox.addEventListener('change', () => checkbox.checked ? this.start() : this.stop());
        },

        setStatus: function(text, error = false) {
            const status = document.getElementById('gmb-unittools-status');
            if (status) { status.textContent = text; status.style.color = error ? '#d66' : ''; }
        },

        start: function() {
                        if (this.enabled) return;
            this.enabled = true;
            GMB.storage.set('unittools_enabled', true);
            const checkbox = document.getElementById('gmb-unittools-enabled');
            if (checkbox) checkbox.checked = true;
            this.injectStyles();
            this.pollTimer = setInterval(() => this.refreshAll(), 2000);
            document.addEventListener('click', this.onUnitsClick, true);
            this.hookGameEvents();
            this.refreshAll();
            this.setStatus('Actief — unit-tools ingeschakeld.');
        },

        stop: function(reason = 'Uitgeschakeld.') {
            this.enabled = false;
            GMB.storage.set('unittools_enabled', false);
            if (this.pollTimer) clearInterval(this.pollTimer);
            this.pollTimer = null;
            document.removeEventListener('click', this.onUnitsClick, true);
            this.unhookGameEvents();
            document.querySelectorAll('#gmb-unit-strength, #gmb-unit-strength-btn, #gmb-unit-strength-style, .gmb-ava-picomap, #gmb-ava-window, #gmb-ava-button, .gmb-sent-box, #gmb-transport-box, #gmb-compare-button, #gmb-compare-window').forEach(node => node.remove());
            const avaSt = document.getElementById('gmb-ava-shift-style');
            if (avaSt) avaSt.remove();
            this.injectedFor = null;
            const checkbox = document.getElementById('gmb-unittools-enabled');
            if (checkbox) checkbox.checked = false;
            this.setStatus(reason || 'Uitgeschakeld.');
        },

        onEnable: function() {
            this.addTab();
        },

        onUnitsClick: function(e) {
            const self = GMB_UnitTools;
            if (!self.enabled) return;
            const strengthBox = e.target.closest && e.target.closest('#gmb-unit-strength');
            if (strengthBox) {
                const btn = e.target.closest('[data-gmb-mode]');
                if (btn) {
                    self.mode = btn.getAttribute('data-gmb-mode');
                    GMB.storage.set('unittools_mode', self.mode);
                    self.updatePanel();
                }
                self.updatePanel();
                return;
            }
            const toggleBtn = e.target.closest && e.target.closest('#gmb-unit-strength-btn');
            if (toggleBtn) {
                const panel = document.getElementById('gmb-unit-strength');
                if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                if (panel && panel.style.display !== 'none') self.updatePanel();
                return;
            }
            if (e.target.closest && e.target.closest('.units_land .units_wrapper')) {
                setTimeout(() => self.updatePanel(), 100);
            }
        },

        getCDN: function() {
            const uw = GMB_API.getUW();
            const lid = (uw.Game && uw.Game.locale_lang ? uw.Game.locale_lang.split('_')[0] : 'en');
            return `https://gp${lid}.innogamescdn.com/images/game`;
        },

        injectStyles: function() {
            if (document.getElementById('gmb-unit-strength-style')) return;
            const cdn = this.getCDN();
            const style = document.createElement('style');
            style.id = 'gmb-unit-strength-style';
            style.textContent = `
                #gmb-unit-strength-btn { cursor:pointer; height:12px; width:127px; font-size:10px; font-weight:bold; color:#ECB44D; background:url("${cdn}/layout/progressbars-sprite_2.90_compressed.png") 0px -100px no-repeat; margin:4px 0; }
                #gmb-unit-strength-btn:hover { color:#EEDDBB; }
                #gmb-unit-strength { margin:2px 0 8px; padding:4px 6px; background:rgba(0,0,0,0.35); border:1px solid #5F5242; border-radius:3px; font-size:11px; }
                #gmb-unit-strength .gmb-us-title { font-weight:bold; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center; color:#ecb44d; }
                #gmb-unit-strength .gmb-us-modes button { background:none; border:none; cursor:pointer; padding:0; margin-left:4px; }
                #gmb-unit-strength .gmb-us-modes button img { display:block; }
                #gmb-unit-strength .gmb-us-modes button.inactive img { filter:sepia(1); -webkit-filter:sepia(1); opacity:0.6; }
                #gmb-unit-strength .gmb-us-table { border-spacing:0; margin:0; }
                #gmb-unit-strength .gmb-us-table td { padding:1px 4px 1px 0; vertical-align:middle; }
                #gmb-unit-strength .gmb-us-ico { width:20px; height:20px; background:url(${cdn}/units/units_info_sprite2.51.png); background-size:100%; }
                #gmb-unit-strength .gmb-us-ico.hack { background-position:0% 0%; }
                #gmb-unit-strength .gmb-us-ico.pierce { background-position:0% 9%; }
                #gmb-unit-strength .gmb-us-ico.dist { background-position:0% 18%; }
                #gmb-unit-strength.off .gmb-us-ico.hack { background-position:0% 36%; }
                #gmb-unit-strength.off .gmb-us-ico.pierce { background-position:0% 27%; }
                #gmb-unit-strength.off .gmb-us-ico.dist { background-position:0% 45%; }
                #gmb-unit-strength .gmb-us-val { font-weight:bold; }
                #gmb-unit-strength.def .gmb-us-val { color:#fc6; }
                #gmb-unit-strength.off .gmb-us-val { color:#edb; }

                /* ===== DIO Available units (bullseye + buttons) ===== */
                .gmb-ava-picomap { position:absolute; overflow:visible; top:0; left:0; width:156px; height:161px; z-index:5; }
                .gmb-ava-picomap .gmb-picomap-container, .gmb-ava-picomap .gmb-picomap-overlayer { position:absolute; top:33px; left:-3px; width:147px; height:101px; }
                .gmb-ava-picomap .gmb-picomap-overlayer { background:url(https://dio-david1327.github.io/img/dio/logo/dio-sprite-5.png); background-position:473px 250px; width:147px; z-index:6; cursor:pointer; }
                #gmb-ava-bullseye { margin:10px 28px 0 28px; animation:gmbZ 1s; }
                #gmb-ava-bullseye .amount { color:#826021; position:relative; top:28px; font-style:italic; width:79px; font-weight:bold; text-shadow:0px 0px 2px black,1px 1px 2px black,0px 2px 2px black; }
                #gmb-ava-bullseye.big_number { font-size:0.90em; line-height:1.4; }
                @keyframes gmbZ { 0% { opacity:0; } 100% { opacity:1; } }
                #gmb-ava-bullseye.sword .amount, #gmb-ava-bullseye.hoplite .amount { color:#E2D9C1; top:57px; width:90px; }
                #gmb-ava-bullseye.archer .amount { color:#E2D0C1; top:47px; width:70px; }
                #gmb-ava-bullseye.chariot { margin-top:15px; } #gmb-ava-bullseye.chariot .amount { color:#F5E8B4; top:38px; width:91px; }
                #gmb-ava-bullseye.rider .amount { color:#DFCC6C; top:52px; width:105px; }
                #gmb-ava-bullseye.slinger .amount { color:#F5E8B4; top:53px; width:91px; }
                #gmb-ava-bullseye.catapult .amount { color:#F5F6C5; top:36px; width:87px; }
                #gmb-ava-bullseye.godsent .amount { color:#F5F6C5; top:57px; width:92px; }
                #gmb-ava-bullseye.medusa .amount { color:#FBFFBB; top:50px; width:65px; }
                #gmb-ava-bullseye.manticore .amount { color:#ECD181; top:50px; width:55px; }
                #gmb-ava-bullseye.pegasus { margin-top:16px; } #gmb-ava-bullseye.pegasus .amount { color:#F7F8E3; top:36px; width:90px; }
                #gmb-ava-bullseye.minotaur { margin-top:10px; } #gmb-ava-bullseye.minotaur .amount { color:#EAD88A; top:48px; width:78px; }
                #gmb-ava-bullseye.zyklop { margin-top:3px; } #gmb-ava-bullseye.zyklop .amount { color:#EDE0B0; top:50px; width:95px; }
                #gmb-ava-bullseye.harpy { margin-top:16px; } #gmb-ava-bullseye.harpy .amount { color:#E7DB79; top:30px; width:78px; }
                #gmb-ava-bullseye.sea_monster .amount { color:#D8EA84; top:58px; width:91px; }
                #gmb-ava-bullseye.cerberus .amount { color:#EC7445; top:25px; width:101px; }
                #gmb-ava-bullseye.centaur { margin-top:15px; } #gmb-ava-bullseye.centaur .amount { color:#ECE0A8; top:29px; width:83px; }
                #gmb-ava-bullseye.fury .amount { color:#E0E0BC; top:57px; width:95px; }
                #gmb-ava-bullseye.griffin { margin-top:15px; } #gmb-ava-bullseye.griffin .amount { color:#FFDC9D; top:40px; width:98px; }
                #gmb-ava-bullseye.calydonian_boar .amount { color:#FFDC9D; top:17px; width:85px; }
                #gmb-ava-bullseye.siren .amount { color:#EAD88A; top:50px; width:78px; }
                #gmb-ava-bullseye.satyr { margin-top:15px; } #gmb-ava-bullseye.satyr .amount { color:#EAD88A; top:48px; width:78px; }
                #gmb-ava-bullseye.spartoi { margin-top:10px; } #gmb-ava-bullseye.spartoi .amount { color:#EAD88A; top:48px; width:78px; }
                #gmb-ava-bullseye.ladon { margin-top:10px; } #gmb-ava-bullseye.ladon .amount { color:#EAD88A; top:48px; width:78px; }
                #gmb-ava-bullseye.attack_ship .amount { color:#FFCB00; top:26px; width:99px; }
                #gmb-ava-bullseye.bireme .amount { color:azure; top:28px; width:79px; }
                #gmb-ava-bullseye.trireme .amount { color:#F4FFD4; top:24px; width:90px; }
                #gmb-ava-bullseye.small_transporter .amount { color:#F5F6C5; top:26px; width:84px; }
                #gmb-ava-bullseye.big_transporter .amount { color:#FFDC9D; top:27px; width:78px; }
                #gmb-ava-bullseye.colonize_ship .amount { color:#F5F6C5; top:29px; width:76px; }
                #gmb-ava-bullseye.demolition_ship .amount { color:#F5F6C5; top:35px; width:90px; }

                /* AVA venster */
                #gmb-ava-window .gmb-ava-unit { margin:5px; cursor:pointer; overflow:visible; display:inline-block; }
                #gmb-ava-window .gmb-ava-unit.active { border:2px solid #7f653a; border-radius:30px; margin:4px; }
                #gmb-ava-window .gmb-ava-unit span { text-shadow:1px 1px 1px black,1px 1px 2px black; }

                /* Kaart-knoppen (circle_button zoals DIO) */
                #gmb-ava-button { top:84px; left:120px; z-index:15; position:absolute; }
                #gmb-ava-button .ico_ava { margin:5px 0 0 4px; width:24px; height:24px; background:url(https://dio-david1327.github.io/img/dio/logo/couteau.png) no-repeat 0 0; background-size:100%; -webkit-filter:hue-rotate(100deg); }
                #gmb-compare-button { top:51px; left:120px; z-index:11; position:absolute; }
                #gmb-compare-button .ico_comparison { margin:5px 0 0 4px; width:24px; height:24px; z-index:15; background:url(https://dio-david1327.github.io/img/dio/logo/casque.png) no-repeat 0 0; background-size:100%; -webkit-filter:hue-rotate(60deg); }
                #gmb-compare-button.checked .ico_comparison { margin-top:6px; }
            `;
            document.head.appendChild(style);
        },

        refresh: function() {
            if (!this.enabled || !this.strengthEnabled) {
                document.querySelectorAll('#gmb-unit-strength, #gmb-unit-strength-btn').forEach(node => node.remove());
                this.injectedFor = null;
                return;
            }
            const land = document.querySelector('.units_land');
            if (!land) {
                document.querySelectorAll('#gmb-unit-strength, #gmb-unit-strength-btn').forEach(node => node.remove());
                this.injectedFor = null;
                return;
            }
            const content = land.querySelector('.content') || land;
            if (!document.getElementById('gmb-unit-strength-btn')) {
                const btn = document.createElement('div');
                btn.id = 'gmb-unit-strength-btn';
                btn.textContent = '⚔ Sterkte';
                content.appendChild(btn);
            }
            let panel = document.getElementById('gmb-unit-strength');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'gmb-unit-strength';
                panel.className = this.mode;
                panel.style.display = 'none';
                const cdn = this.getCDN();
                panel.innerHTML = `
                    <div class="gmb-us-title">Sterkte
                        <span class="gmb-us-modes">
                            <button type="button" data-gmb-mode="def" title="Verdediging"><img src="${cdn}/unit_overview/support.png" width="20" height="20" alt="Verdediging"></button>
                            <button type="button" data-gmb-mode="off" title="Aanval"><img src="${cdn}/unit_overview/attack.png" width="20" height="20" alt="Aanval"></button>
                        </span>
                    </div>
                    <table class="gmb-us-table">
                        <tr><td><div class="gmb-us-ico hack"></div></td><td class="gmb-us-val" data-us="blunt">0</td></tr>
                        <tr><td><div class="gmb-us-ico pierce"></div></td><td class="gmb-us-val" data-us="sharp">0</td></tr>
                        <tr><td><div class="gmb-us-ico dist"></div></td><td class="gmb-us-val" data-us="dist">0</td></tr>
                    </table>`;
                content.appendChild(panel);
                this.injectedFor = content;
            }
            this.updatePanel();
        },

        updatePanel: function() {
            const panel = document.getElementById('gmb-unit-strength');
            if (!panel) return;
            panel.className = this.mode;
            panel.querySelectorAll('[data-gmb-mode]').forEach(btn => {
                btn.classList.toggle('inactive', btn.getAttribute('data-gmb-mode') !== this.mode);
            });

            const units = this.getSelectedUnits();
            const totals = this.mode === 'def'
                ? this.calcDef(units)
                : this.calcOff(units);

            const blunt = panel.querySelector('[data-us="blunt"]');
            const sharp = panel.querySelector('[data-us="sharp"]');
            const dist = panel.querySelector('[data-us="dist"]');
            if (blunt) blunt.textContent = totals.blunt.toLocaleString();
            if (sharp) sharp.textContent = totals.sharp.toLocaleString();
            if (dist) dist.textContent = totals.dist.toLocaleString();
        },

        parseCount: function(value) {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const v = value.trim().toLowerCase();
                if (v.endsWith('k')) return (parseFloat(v) || 0) * 1000;
                if (v.endsWith('m')) return (parseFloat(v) || 0) * 1000000;
            }
            return parseFloat(value) || 0;
        },

        getSelectedUnits: function() {
            const units = {};
            const wrapper = document.querySelector('.units_land .units_wrapper');
            if (!wrapper) return units;
            const selected = wrapper.querySelectorAll('.unit.selected');
            const list = selected.length ? selected : wrapper.querySelectorAll('.unit');
            list.forEach(el => {
                const cls = (el.className || '').split(/\s+/);
                const unitId = cls[1];
                const countEl = el.children[0];
                if (unitId && countEl) units[unitId] = this.parseCount(countEl.textContent);
            });
            return units;
        },

        getTownUnits: function() {
            const uw = GMB_API.getUW();
            try {
                const town = uw.ITowns && uw.ITowns.getTown && uw.ITowns.getTown(uw.Game.townId);
                const units = town && town.units ? town.units() : null;
                if (units) {
                    const out = {};
                    Object.keys(units).forEach(k => { out[k] = this.parseCount(units[k]); });
                    return out;
                }
            } catch (e) {}
            return {};
        },

        calcDef: function(units) {
            const uw = GMB_API.getUW();
            const gd = uw.GameData && uw.GameData.units || {};
            const totals = { blunt: 0, sharp: 0, dist: 0 };
            Object.keys(units).forEach(id => {
                const u = gd[id];
                const count = units[id];
                if (!u || !count) return;
                totals.blunt += count * (u.def_hack || 0);
                totals.sharp += count * (u.def_pierce || 0);
                totals.dist += count * (u.def_distance || 0);
            });
            return totals;
        },

        calcOff: function(selectedUnits) {
            const uw = GMB_API.getUW();
            const gd = uw.GameData && uw.GameData.units || {};
            const townUnits = this.getTownUnits();
            const totals = { blunt: 0, sharp: 0, dist: 0 };
            Object.keys(selectedUnits).forEach(id => {
                const u = gd[id];
                const count = townUnits[id] || selectedUnits[id] || 0;
                if (!u || !count) return;
                const attack = count * (u.attack || 0);
                if (u.attack_type === 'hack') totals.blunt += attack;
                else if (u.attack_type === 'pierce') totals.sharp += attack;
                else if (u.attack_type === 'distance') totals.dist += attack;
            });
            return totals;
        },

        // ==================== refreshAll ====================
        refreshAll: function() {
            const safe = (fn) => { try { fn(); } catch (e) {} };
            safe(() => this.refresh());
            safe(() => this.refreshAvailableUnits());
            safe(() => this.refreshSentUnits());
            safe(() => this.refreshTransport());
            safe(() => this.refreshCompareButton());
            if (this.removeTooltips) safe(() => this.stripTooltips());
        },

        // ==================== removeTooltipps (dio_Rtt) ====================
        stripTooltips: function() {
            const uw = GMB_API.getUW();
            const $ = uw && uw.$;
            if (!$) return;
            try {
                $('.unit, .unit_icon40x40, .unit_icon50x50, .thin_frame').off('mouseenter mouseleave');
            } catch (e) {}
        },

        // ==================== GameEvents ====================
        getObserver: function() {
            const uw = GMB_API.getUW();
            const $ = (uw && uw.$) || (typeof window !== 'undefined' && window.$) || (typeof $ !== 'undefined' ? $ : null);
            return $ && $.Observer ? $ : null;
        },

        hookGameEvents: function() {
            if (this.gameEventsHooked) return;
            const uw = GMB_API.getUW();
            const $ = this.getObserver();
            if (!$ || !uw.GameEvents) return;
            try {
                const ev = uw.GameEvents.command && uw.GameEvents.command.send_unit;
                if (ev) {
                    $.Observer(ev).subscribe('gmb_unittools_send_unit', (e, data) => this.onSendUnit(data));
                    this.gameEventsHooked = true;
                }
            } catch (err) {}
        },

        unhookGameEvents: function() {
            if (!this.gameEventsHooked) return;
            const uw = GMB_API.getUW();
            const $ = this.getObserver();
            if ($ && uw.GameEvents && uw.GameEvents.command && uw.GameEvents.command.send_unit) {
                try { $.Observer(uw.GameEvents.command.send_unit).unsubscribe('gmb_unittools_send_unit'); } catch (e) {}
            }
            this.gameEventsHooked = false;
        },

        onSendUnit: function(data) {
            if (!this.enabled || !this.sentEnabled || !data) return;
            let type = data.sending_type;
            if (type === 'revolt' || type === 'portal_attack_olympus') type = 'attack';
            if (type === 'portal_support_olympus') type = 'support';
            if (type !== 'attack' && type !== 'support') return;
            const params = data.params || {};
            Object.keys(params).forEach(unitId => {
                const count = Number(params[unitId]) || 0;
                if (count > 0 && this.isUnitId(unitId)) {
                    this.sentUnits[type][unitId] = (this.sentUnits[type][unitId] || 0) + count;
                }
            });
            GMB.storage.set('unittools_sent_units', this.sentUnits);
            this.renderSentBoxes();
        },

        isUnitId: function(id) {
            const uw = GMB_API.getUW();
            return !!(uw.GameData && uw.GameData.units && uw.GameData.units[id]);
        },

        // ==================== Sent units (dio_sen) ====================
        refreshSentUnits: function() {
            if (!this.enabled || !this.sentEnabled) {
                document.querySelectorAll('.gmb-sent-box').forEach(n => n.remove());
                return;
            }
            document.querySelectorAll('.attack_support_window').forEach(win => {
                if (!win.querySelector('.gmb-sent-box')) this.renderSentBox(win);
            });
        },

        renderSentBoxes: function() {
            document.querySelectorAll('.attack_support_window').forEach(win => {
                const box = win.querySelector('.gmb-sent-box');
                if (box) this.fillSentBox(box);
            });
        },

        renderSentBox: function(win) {
            const box = document.createElement('div');
            box.className = 'gmb-sent-box';
            box.style.cssText = 'position:absolute;right:6px;bottom:6px;width:200px;background:rgba(20,14,8,0.92);border:1px solid #7f653a;border-radius:4px;padding:5px;font-size:10px;color:#ecb44d;z-index:50;';
            box.innerHTML = `
                <div style="font-weight:bold;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;">
                    <span>📤 Verzonden</span>
                    <span>
                        <button type="button" class="gmb-btn-mini" data-gmb-sent-reset="attack" style="font-size:9px;">OFF reset</button>
                        <button type="button" class="gmb-btn-mini" data-gmb-sent-reset="support" style="font-size:9px;">DEF reset</button>
                    </span>
                </div>
                <div class="gmb-sent-off"></div>
                <div class="gmb-sent-def" style="margin-top:4px;"></div>`;
            box.querySelectorAll('[data-gmb-sent-reset]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const type = btn.getAttribute('data-gmb-sent-reset');
                    this.sentUnits[type] = {};
                    GMB.storage.set('unittools_sent_units', this.sentUnits);
                    this.fillSentBox(box);
                });
            });
            win.appendChild(box);
            this.fillSentBox(box);
        },

        fillSentBox: function(box) {
            const render = (type, sel) => {
                const target = box.querySelector(sel);
                if (!target) return;
                const units = this.sentUnits[type] || {};
                const ids = Object.keys(units).filter(id => units[id] > 0);
                if (!ids.length) { target.innerHTML = `<div style="opacity:0.6;">${type === 'attack' ? 'OFF' : 'DEF'}: —</div>`; return; }
                target.innerHTML = `<div style="opacity:0.8;font-weight:bold;">${type === 'attack' ? 'OFF' : 'DEF'}</div>` +
                    ids.map(id => `<span class="unit_icon25x25 ${id}" style="display:inline-block;position:relative;margin:1px;"><span style="position:absolute;bottom:0;right:0;font-size:8px;color:#fff;text-shadow:1px 1px 1px #000;font-weight:bold;">${this.formatCount(units[id])}</span></span>`).join('');
            };
            render('attack', '.gmb-sent-off');
            render('support', '.gmb-sent-def');
        },

        formatCount: function(n) {
            n = Number(n) || 0;
            if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
            if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
            return String(n);
        },

        // ==================== Transport capacity (dio_tra) ====================
        refreshTransport: function() {
            const naval = document.querySelector('.units_naval');
            if (!this.enabled || !this.transportEnabled || !naval) {
                document.querySelectorAll('.gmb-transport-box').forEach(n => n.remove());
                return;
            }
            const content = naval.querySelector('.content') || naval;
            let box = document.getElementById('gmb-transport-box');
            if (!box) {
                box = document.createElement('div');
                box.id = 'gmb-transport-box';
                box.className = 'gmb-transport-box';
                box.style.cssText = 'margin:6px 4px;padding:5px;background:rgba(0,0,0,0.35);border:1px solid #5F5242;border-radius:3px;font-size:11px;color:#FFCC66;line-height:1.6;';
                content.appendChild(box);
            }
            this.updateTransportBox(box);
        },

        updateTransportBox: function(box) {
            try {
                const uw = GMB_API.getUW();
                const gd = uw.GameData.units || {};
                const units = this.getTownUnits();
                const smallT = gd.small_transporter || {};
                const bigT = gd.big_transporter || {};

                let berth = 0;
                try {
                    const town = uw.ITowns && uw.ITowns.getTown && uw.ITowns.getTown(uw.Game.townId);
                    const res = town && town.researches ? town.researches() : null;
                    if (res && (res.hasBerth ? res.hasBerth() : res.attributes && res.attributes.berth)) {
                        berth = (uw.GameData.research_bonus && uw.GameData.research_bonus.berth) || 0;
                    }
                } catch (e) {}

                const smallCap = (smallT.capacity || 0) + berth;
                const bigCap = (bigT.capacity || 0) + berth;
                let smallCount = Number(units.small_transporter) || 0;
                let bigCount = Number(units.big_transporter) || 0;
                let smallShip = smallCount * smallCap;
                let bigShip = bigCount * bigCap;
                let queuedSmall = 0, queuedBig = 0;

                const isOff = id => { const u = gd[id]; return u && (u.unit_function === 'function_off' || u.unit_function === 'function_both'); };
                const isDef = id => { const u = gd[id]; return u && (u.unit_function === 'function_def' || u.unit_function === 'function_both'); };
                let popOff = 0, popDef = 0;
                Object.keys(units).forEach(id => {
                    const u = gd[id], count = units[id];
                    if (!u || !count || u.is_naval || u.flying) return;
                    if (isOff(id)) popOff += (id === 'spartoi' ? count : count * (u.population || 0));
                    if (isDef(id)) popDef += (id === 'spartoi' ? count : count * (u.population || 0));
                });

                // Rekruteringsqueue meetellen
                try {
                    const town = uw.ITowns.getTown(uw.Game.townId);
                    const orders = town.getUnitOrdersCollection ? town.getUnitOrdersCollection().models : [];
                    orders.forEach(o => {
                        const attrs = o.attributes || {};
                        const unitt = attrs.unit_type, number = Number(attrs.units_left) || 0;
                        const u = gd[unitt];
                        if (!u || !number || u.flying) return;
                        if (u.capacity !== undefined && u.capacity !== 0) {
                            if (unitt === 'small_transporter') { queuedSmall += number; smallShip += number * ((u.capacity || 0) + berth); }
                            else if (unitt === 'big_transporter') { queuedBig += number; bigShip += number * ((u.capacity || 0) + berth); }
                            return;
                        }
                        if (isOff(unitt)) popOff += (unitt === 'spartoi' ? number : number * (u.population || 0));
                        if (isDef(unitt)) popDef += (unitt === 'spartoi' ? number : number * (u.population || 0));
                    });
                } catch (e) {}

                const pop = Math.max(popOff, popDef);
                const ship = smallShip + bigShip;
                const diff = Math.abs(pop - ship);
                const color = (pop === 0 && ship === 0) ? '#FFCC66' : (pop > ship ? '#ffb4b4' : '#6eff5c');
                const capPer = bigCap || smallCap || 1;
                const unitName = (bigT.name_plural || 'transportschepen');
                const info = pop > ship
                    ? `Ontbreekt ~${Math.ceil(diff / capPer)} ${unitName}`
                    : (diff === 0 ? `Optimaal: ${unitName}` : `Resterend: ${diff} pop op ${unitName}`);
                const fmt = n => (Number(n) || 0).toLocaleString('de-DE');
                const stbTotal = smallCount + queuedSmall;
                const tbTotal = bigCount + queuedBig;
                box.innerHTML =
                    `<div>STB: <b>${fmt(stbTotal)}</b> — ${fmt(smallShip)}</div>` +
                    `<div>TB: <b>${fmt(tbTotal)}</b> — ${fmt(bigShip)}</div>` +
                    `<div style="color:${color};font-weight:bold;">Totaal: ${fmt(pop)}/${fmt(ship)}</div>` +
                    `<div style="opacity:0.6;font-size:9px;">${info}</div>`;
            } catch (e) {
                box.textContent = 'Transport: ?';
            }
        },

        // ==================== Available units (dio_ava) ====================
        getGroupsDIO: function() {
            const uw = GMB_API.getUW();
            const groups = {};
            try {
                const mm = uw.MM;
                const coll = mm.collections || (mm.getCollections && mm.getCollections());
                if (coll && coll.TownGroupTown && coll.TownGroupTown[0]) {
                    coll.TownGroupTown[0].each(function(tgt) {
                        const gid = tgt.getGroupId();
                        const tid = tgt.getTownId();
                        if (!groups[gid]) groups[gid] = { id: gid, towns: {} };
                        groups[gid].towns[tid] = { id: tid };
                    });
                }
            } catch (e) {}
            // Alle-steden groep (-1) toevoegen als die er niet is
            const allTowns = {};
            try {
                const towns = uw.ITowns.getTowns ? uw.ITowns.getTowns() : (uw.ITowns.towns || {});
                Object.keys(towns).forEach(tid => { allTowns[tid] = { id: Number(tid) || tid }; });
            } catch (e) {}
            if (!groups[-1] && Object.keys(allTowns).length) groups[-1] = { id: -1, towns: allTowns };
            return groups;
        },

        getGroupName: function(gid) {
            const uw = GMB_API.getUW();
            try {
                const tg = uw.ITowns.town_groups && uw.ITowns.town_groups._byId && uw.ITowns.town_groups._byId[gid];
                if (tg && tg.attributes && tg.attributes.name) return tg.attributes.name;
            } catch (e) {}
            return gid === '-1' || gid === -1 ? 'Alle steden' : `Groep ${gid}`;
        },

        countUnits: function(needOuter) {
            const uw = GMB_API.getUW();
            const groups = this.getGroupsDIO();
            const result = { total: {}, available: {}, outer: {}, support: {} };
            let helper = null;
            if (needOuter) {
                try { helper = uw.require && uw.require('helpers/units_tooltip_helper'); } catch (e) {}
            }

            Object.keys(groups).forEach(gid => {
                result.total[gid] = {}; result.available[gid] = {}; result.outer[gid] = {}; result.support[gid] = {};
                Object.keys(groups[gid].towns).forEach(tid => {
                    let townUnits = {}, supportUnits = {}, outerUnits = {};
                    try {
                        const t = uw.ITowns.towns[tid] || (uw.ITowns.getTown && uw.ITowns.getTown(tid));
                        if (t && t.units) {
                            const u = t.units();
                            if (u && typeof u === 'object') townUnits = u;
                        }
                        if (t && t.unitsSupport) {
                            const s = t.unitsSupport();
                            if (s && typeof s === 'object') supportUnits = s;
                        }
                    } catch (e) {}
                    if (needOuter && helper && helper.getDataForSupportingUnitsInOtherTownFromCollection && uw.MM) {
                        try {
                            const coll = uw.MM.getTownAgnosticCollectionsByName ? uw.MM.getTownAgnosticCollectionsByName('Units') : null;
                            const frag = coll && coll[1] && coll[1].fragments ? coll[1].fragments[tid] : null;
                            const townColl = uw.MM.getOnlyCollectionByName ? uw.MM.getOnlyCollectionByName('Town') : null;
                            if (frag && townColl) {
                                const supports = helper.getDataForSupportingUnitsInOtherTownFromCollection(frag, townColl) || {};
                                Object.keys(supports).forEach(sid => {
                                    const attrs = supports[sid] && supports[sid].attributes || {};
                                    Object.keys(attrs).forEach(uid => {
                                        const v = Number(attrs[uid]) || 0;
                                        if (v > 0 && this.isUnitId(uid)) outerUnits[uid] = (outerUnits[uid] || 0) + v;
                                    });
                                });
                            }
                        } catch (e) {}
                    }
                    // 'outer' eenheden tellen ook mee in 'total' (zoals DIO)
                    Object.keys(outerUnits).forEach(uid => {
                        townUnits[uid] = (Number(townUnits[uid]) || 0) + outerUnits[uid];
                    });
                    result.total[gid][tid] = townUnits;
                    result.available[gid][tid] = townUnits;
                    result.outer[gid][tid] = outerUnits;
                    result.support[gid][tid] = supportUnits;
                });
                // Sommen per groep
                ['total', 'available', 'outer', 'support'].forEach(mode => {
                    result[mode][gid].all = {};
                    Object.keys(result[mode][gid]).forEach(tid => {
                        if (tid === 'all') return;
                        Object.keys(result[mode][gid][tid]).forEach(uid => {
                            const v = Number(result[mode][gid][tid][uid]) || 0;
                            result[mode][gid].all[uid] = (result[mode][gid].all[uid] || 0) + v;
                        });
                    });
                });
            });
            this.unitCounter = result;
            return result;
        },

        getAvaUnitList: function() {
            const uw = GMB_API.getUW();
            const list = [
                'sword', 'archer', 'hoplite', 'slinger', 'rider', 'chariot', 'catapult', 'godsent',
                'manticore', 'harpy', 'pegasus', 'griffin', 'cerberus', 'minotaur', 'medusa', 'zyklop', 'centaur',
                'calydonian_boar', 'fury', 'sea_monster', 'spartoi', 'ladon', 'satyr', 'siren',
                'small_transporter', 'big_transporter', 'bireme', 'attack_ship', 'trireme', 'demolition_ship', 'colonize_ship'
            ];
            return list.filter(id => {
                if (!this.isUnitId(id)) return false;
                if (!uw.Game.hasArtemis && (id === 'calydonian_boar' || id === 'griffin')) return false;
                if (!uw.Game.gods_active || !uw.Game.gods_active.aphrodite) { if (id === 'siren' || id === 'satyr') return false; }
                if (!uw.Game.gods_active || !uw.Game.gods_active.ares) { if (id === 'spartoi' || id === 'ladon') return false; }
                return true;
            });
        },

        refreshAvailableUnits: function() {
            if (!this.enabled || !this.availableEnabled) {
                document.querySelectorAll('.gmb-ava-picomap, #gmb-ava-window, #gmb-ava-button').forEach(n => n.remove());
                const st = document.getElementById('gmb-ava-shift-style');
                if (st) st.remove();
                return;
            }
            const win = this.ensureAvaWindow();
            const winVisible = win && win.style.display !== 'none';
            const needOuter = winVisible && this.bullseyeUnit.mode === 'outer';
            const now = Date.now();
            // Tellen is duur: max elke 15s, of direct als het venster open is
            if (!this.unitCounter || now - this.lastUnitCount > 15000 || (winVisible && now - this.lastUnitCount > 3000) || this.avaDirty === 'force') {
                this.countUnits(needOuter);
                this.lastUnitCount = now;
                this.avaDirty = true;
            }
            this.ensureAvaShiftStyle(!!document.querySelector('.topleft_navigation_area'));
            this.ensureAvaButton();
            this.ensureAvaBullseye();
            this.updateAvaBullseye();
            if (this.avaDirty) {
                this.updateAvaWindow();
                this.avaDirty = false;
            }
        },

        ensureAvaBullseye: function() {
            const container = document.querySelector('.topleft_navigation_area');
            if (!container) return;
            let area = container.querySelector('.gmb-ava-picomap');
            if (!area) {
                area = document.createElement('div');
                area.className = 'gmb-ava-picomap picomap_area';
                area.innerHTML = `<div class="gmb-picomap-container"><div id="gmb-ava-bullseye" class="unit_icon90x90 ${this.bullseyeUnit[this.bullseyeUnit.current_group] || 'bireme'}"><div class="amount"></div></div></div><div class="gmb-picomap-overlayer"></div>`;
                container.insertBefore(area, container.firstChild);
                const overlayer = area.querySelector('.gmb-picomap-overlayer');
                overlayer.title = 'Beschikbare eenheden — klik voor overzicht';
                overlayer.addEventListener('click', () => this.toggleAvaWindow());
            }
        },

        ensureAvaShiftStyle: function(onMap) {
            let st = document.getElementById('gmb-ava-shift-style');
            if (!onMap) { if (st) st.remove(); return; }
            if (st) return;
            st = document.createElement('style');
            st.id = 'gmb-ava-shift-style';
            // DIO AvailableUnits.autre() — Game-UI naar beneden schuiven voor de picomap_area
            st.textContent = `
                .nui_grepo_score { top: 150px !important; }
                .nui_left_box { top: 102px; }
                .nui_main_menu { top: 260px; }
                #HMoleM { top: 253px !important; }
                #ui_box .ocean_number_box { position: absolute; top: 65px; left: 44px; }
                #ui_box .ocean_number_box .ocean_number { font-weight: 500; z-index: 1; }
                .gmb-ava-picomap .gmb-picomap-overlayer { height: 101px; }
                .coords_box { top: 117px !important; }
                .bull_eye_buttons, .rb_map { height: 38px !important; }
                #ui_box .btn_change_colors { top: 31px !important; }
            `;
            document.head.appendChild(st);
        },

        ensureAvaButton: function() {
            if (document.getElementById('gmb-ava-button')) return;
            const bar = document.querySelector('.bull_eye_buttons');
            if (!bar) return;
            const btn = document.createElement('div');
            btn.id = 'gmb-ava-button';
            btn.className = 'circle_button';
            btn.innerHTML = '<div class="ico_ava js-caption"></div>';
            btn.title = 'Beschikbare eenheden';
            btn.addEventListener('click', () => this.toggleAvaWindow());
            bar.appendChild(btn);
        },

        ensureAvaWindow: function() {
            let win = document.getElementById('gmb-ava-window');
            if (win) return win;
            win = document.createElement('div');
            win.id = 'gmb-ava-window';
            win.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:430px;max-height:340px;overflow:auto;background:#2a1f14;border:2px solid #7f653a;border-radius:6px;padding:10px;z-index:9999;color:#ecb44d;font-size:11px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
            win.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong>📊 Beschikbare eenheden</strong>
                    <button type="button" id="gmb-ava-close" style="background:none;border:none;color:#ecb44d;cursor:pointer;font-size:14px;">✕</button>
                </div>
                <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                    <select id="gmb-ava-group" style="flex:1;min-width:120px;background:#1a120a;color:#ecb44d;border:1px solid #7f653a;"></select>
                    <select id="gmb-ava-mode" style="background:#1a120a;color:#ecb44d;border:1px solid #7f653a;">
                        <option value="total">Totaal</option>
                        <option value="available">Beschikbaar</option>
                        <option value="outer">Buiten</option>
                        <option value="support">Support</option>
                    </select>
                </div>
                <div id="gmb-ava-units" style="display:flex;flex-wrap:wrap;gap:2px;"></div>`;
            document.body.appendChild(win);
            win.querySelector('#gmb-ava-close').addEventListener('click', () => { win.style.display = 'none'; });
            win.querySelector('#gmb-ava-group').addEventListener('change', e => {
                this.bullseyeUnit.current_group = e.target.value;
                GMB.storage.set('unittools_bullseye', this.bullseyeUnit);
                this.updateAvaWindow();
                this.updateAvaBullseye();
            });
            win.querySelector('#gmb-ava-mode').addEventListener('change', e => {
                this.bullseyeUnit.mode = e.target.value;
                GMB.storage.set('unittools_bullseye', this.bullseyeUnit);
                this.updateAvaWindow();
                this.updateAvaBullseye();
            });
            return win;
        },

        toggleAvaWindow: function() {
            const win = this.ensureAvaWindow();
            if (!win) return;
            win.style.display = win.style.display === 'none' ? 'block' : 'none';
            if (win.style.display !== 'none') this.updateAvaWindow();
        },

        updateAvaBullseye: function() {
            const el = document.getElementById('gmb-ava-bullseye');
            if (!el || !this.unitCounter) return;
            const gid = String(this.bullseyeUnit.current_group);
            const mode = this.bullseyeUnit.mode || 'available';
            const unitId = this.bullseyeUnit[gid] || this.bullseyeUnit['-1'] || 'bireme';
            el.className = 'unit_icon90x90 ' + unitId;
            const counts = this.unitCounter[mode] && this.unitCounter[mode][gid] && this.unitCounter[mode][gid].all;
            const sum = counts ? (Number(counts[unitId]) || 0) : 0;
            // DIO: elke digit met aflopende font-size (odometer-look)
            const fsize = ['1.4em', '1.2em', '1.15em', '1.1em', '1.0em', '0.95em'];
            const digits = String(sum);
            const amount = el.querySelector('.amount');
            if (amount) {
                amount.innerHTML = digits.split('').map((d, i) => `<span style="font-size:${fsize[i] || '0.9em'}">${d}</span>`).join('');
            }
            if (sum >= 100000) el.classList.add('big_number'); else el.classList.remove('big_number');
        },

        updateAvaWindow: function() {
            const win = document.getElementById('gmb-ava-window');
            if (!win || !this.unitCounter) return;
            const gid = String(this.bullseyeUnit.current_group);
            const mode = this.bullseyeUnit.mode || 'available';

            const groupSel = win.querySelector('#gmb-ava-group');
            const modeSel = win.querySelector('#gmb-ava-mode');
            if (groupSel) {
                const groups = this.getGroupsDIO();
                const keys = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
                groupSel.innerHTML = keys.map(k => `<option value="${k}" ${String(k) === gid ? 'selected' : ''}>${this.getGroupName(k)}</option>`).join('');
            }
            if (modeSel) modeSel.value = mode;

            // Kies bullseye-unit voor deze groep
            if (!this.bullseyeUnit[gid]) this.bullseyeUnit[gid] = 'bireme';

            const counts = this.unitCounter[mode] && this.unitCounter[mode][gid] && this.unitCounter[mode][gid].all || {};
            const grid = win.querySelector('#gmb-ava-units');
            grid.innerHTML = this.getAvaUnitList().map(uid => {
                const count = counts[uid] || 0;
                const active = uid === this.bullseyeUnit[gid] ? 'active' : '';
                return `<span class="gmb-ava-unit unit index_unit bold unit_icon40x40 ${uid} ${active}" data-gmb-ava-unit="${uid}" title="${uid} (${count})"><span style="font-size:0.9em">${count}</span></span>`;
            }).join('');
            grid.querySelectorAll('[data-gmb-ava-unit]').forEach(el => {
                el.addEventListener('click', () => {
                    this.bullseyeUnit[gid] = el.getAttribute('data-gmb-ava-unit');
                    GMB.storage.set('unittools_bullseye', this.bullseyeUnit);
                    this.updateAvaWindow();
                    this.updateAvaBullseye();
                });
            });
        },

        // ==================== Unit comparison (dio_com) ====================
        refreshCompareButton: function() {
            const existing = document.getElementById('gmb-compare-button');
            if (!this.enabled || !this.compareEnabled) {
                if (existing) existing.remove();
                return;
            }
            if (existing) return;
            const bar = document.querySelector('.bull_eye_buttons');
            if (!bar) return;
            const btn = document.createElement('div');
            btn.id = 'gmb-compare-button';
            btn.className = 'circle_button';
            btn.innerHTML = '<div class="ico_comparison js-caption"></div>';
            btn.title = 'Unit vergelijking';
            btn.addEventListener('click', () => this.toggleCompareWindow());
            bar.appendChild(btn);
        },

        toggleCompareWindow: function() {
            const win = this.ensureCompareWindow();
            if (!win) return;
            win.style.display = win.style.display === 'none' ? 'block' : 'none';
            if (win.style.display !== 'none') this.renderCompareTable(win.querySelector('.gmb-compare-active') || 'hack');
        },

        ensureCompareWindow: function() {
            let win = document.getElementById('gmb-compare-window');
            if (win) return win;
            win = document.createElement('div');
            win.id = 'gmb-compare-window';
            win.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:640px;max-height:480px;overflow:auto;background:#2a1f14;border:2px solid #7f653a;border-radius:6px;padding:10px;z-index:9999;color:#ecb44d;font-size:11px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
            win.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong>⚔️ Unit vergelijking</strong>
                    <button type="button" id="gmb-compare-close" style="background:none;border:none;color:#ecb44d;cursor:pointer;font-size:14px;">✕</button>
                </div>
                <div style="display:flex;gap:4px;margin-bottom:6px;">
                    <button type="button" class="gmb-compare-tab" data-gmb-ctype="hack" style="flex:1;">Hakkelijm</button>
                    <button type="button" class="gmb-compare-tab" data-gmb-ctype="pierce" style="flex:1;">Steek</button>
                    <button type="button" class="gmb-compare-tab" data-gmb-ctype="distance" style="flex:1;">Afstand</button>
                    <button type="button" class="gmb-compare-tab" data-gmb-ctype="sea" style="flex:1;">Zee</button>
                </div>
                <div class="gmb-compare-body" style="overflow:auto;"></div>`;
            document.body.appendChild(win);
            win.querySelector('#gmb-compare-close').addEventListener('click', () => { win.style.display = 'none'; });
            win.querySelectorAll('.gmb-compare-tab').forEach(btn => {
                btn.addEventListener('click', () => this.renderCompareTable(btn.getAttribute('data-gmb-ctype')));
            });
            this.renderCompareTable('hack');
            return win;
        },

        renderCompareTable: function(type) {
            const win = document.getElementById('gmb-compare-window');
            if (!win) return;
            win.querySelectorAll('.gmb-compare-tab').forEach(btn => {
                const active = btn.getAttribute('data-gmb-ctype') === type;
                btn.style.background = active ? '#ecb44d' : 'none';
                btn.style.color = active ? '#2a1f14' : '#ecb44d';
                btn.style.fontWeight = active ? 'bold' : 'normal';
            });
            const uw = GMB_API.getUW();
            const gd = uw.GameData.units || {};
            const body = win.querySelector('.gmb-compare-body');

            const rows = Object.keys(gd)
                .filter(id => {
                    const u = gd[id];
                    if (!u || id === 'militia') return false;
                    const at = u.attack_type || 'sea';
                    return at === type;
                })
                .map(id => {
                    const u = gd[id];
                    const pop = u.population || 1;
                    const r1 = (n, d = 1) => Math.round((n / pop) * 10 * d) / (10 * d) || 0;
                    return {
                        id,
                        name: u.name || id,
                        att: r1(u.attack || 0, 10),
                        def: r1(((u.def_hack || 0) + (u.def_pierce || 0) + (u.def_distance || 0)) / 3, 10) || r1(u.defense || 0, 10),
                        spd: u.speed || 0,
                        bty: r1(u.booty || 0, 10) || (u.capacity ? r1(u.capacity + 6, 10) : 0),
                        res: Math.round(((u.resources && (u.resources.wood || 0) + (u.resources.stone || 0) + (u.resources.iron || 0)) || 0) / pop),
                        woo: Math.round(((u.resources && u.resources.wood) || 0) / pop),
                        sto: Math.round(((u.resources && u.resources.stone) || 0) / pop),
                        iro: Math.round(((u.resources && u.resources.iron) || 0) / pop),
                        fav: r1(u.favor || 0, 10),
                        tim: Math.round((u.build_time || 0) / pop)
                    };
                })
                .sort((a, b) => b.att - a.att);

            const th = 'padding:3px 6px;border-bottom:1px solid #7f653a;text-align:center;white-space:nowrap;';
            const td = 'padding:3px 6px;border-bottom:1px solid rgba(127,101,58,0.4);text-align:center;';
            body.innerHTML = `<table style="width:100%;border-collapse:collapse;">
                <tr>
                    <th style="${th}text-align:left;">Eenheid</th>
                    <th style="${th}">Aanval</th><th style="${th}">Verdediging</th><th style="${th}">Snelh.</th>
                    <th style="${th}">Buit</th><th style="${th}">Res</th><th style="${th}">Hout</th><th style="${th}">Steen</th><th style="${th}">IJzer</th>
                    <th style="${th}">Gunst</th><th style="${th}">Tijd</th>
                </tr>
                ${rows.map(r => `<tr>
                    <td style="${td}text-align:left;"><span class="unit_icon40x40 ${r.id}" style="display:inline-block;vertical-align:middle;margin-right:4px;"></span>${r.name}</td>
                    <td style="${td}font-weight:bold;color:${r.att > 19 ? 'green' : (r.att < 10 && r.att !== 0 ? 'red' : 'inherit')};">${r.att}</td>
                    <td style="${td}font-weight:bold;color:${r.def > 19 ? 'green' : (r.def < 10 && r.def !== 0 ? 'red' : 'inherit')};">${r.def}</td>
                    <td style="${td}">${r.spd}</td><td style="${td}">${r.bty}</td><td style="${td}">${r.res}</td>
                    <td style="${td}">${r.woo}</td><td style="${td}">${r.sto}</td><td style="${td}">${r.iro}</td>
                    <td style="${td}color:${r.fav > 0 ? '#4169e1' : 'inherit'};">${r.fav}</td><td style="${td}">${r.tim}</td>
                </tr>`).join('')}
            </table>`;
        }
    };
    GMB_UnitTools.gameOnly = true;

    // ==================== IconTools (DIO Icons-tab) ====================
    const GMB_IconTools = {
        enabled: false,
        til: true, tim: true, tiw: true,
        tpt: true, tis: true, tih: true, tir: true,
        tow: true, tol: true, toh: true,
        pollTimer: null,
        townDataAt: 0,
        autoTownTypes: {},
        population: {},
        townPopupEl: null,
        townbbAdded: false,
        tolAdded: false,
        listDecorated: false,
        manualTownTypes: {},
        townIconSpriteUrl: 'https://dio-david1327.github.io/img/dio/btn/town-icons.png',
        townIconSpriteDataUrl: null,
        townIconSpriteFallbackRequested: false,
        townIconSprites: {
            lo: 0, ld: 3, so: 6, sd: 7, fo: 10, fd: 9, bu: 14, po: 22, no: 12,
            fa: 20, re: 15, di: 2, sh: 1, lu: 13, dp: 11, ha: 15, si: 18, ra: 17, ch: 19, ti: 23, un: 5, wd: 16, wo: 24, bo: 13,
            gr: 21, st: 17, he: 4, ko: 8, OO: 25, O1: 58, O2: 59, O3: 60, O4: 61, O5: 62, O6: 63,
            is: 26, FS: 32, BI: 33, TR: 34, BT: 55, BE: 56, CE: 29, DS: 31, SK: 47, SL: 26, BS: 48, HO: 44, RE: 43,
            SW: 28, CA: 45, CT: 41, CB: 27, CL: 50, EY: 38, MD: 37, MT: 49, HD: 40, HP: 39, MN: 36, PG: 42,
            GF: 35, CY: 30, SE: 51, ST: 52, LD: 53, SR: 54, ee: 46, Bo: 57,
            a1: 64, a2: 65, a3: 66, a4: 67, a5: 68, a6: 69, a7: 70, a8: 71
        },
        townIconPickerOrder: [
            'lo', 'ld', 'fo', 'fd', 'so', 'sd', 'no', 'po', 'sh', 'di', 'lu', 'ha', 'ra', 'is', 'un', 'ko', 'ti', 'gr', 'dp', 're',
            'wd', 'st', 'si', 'bu', 'he', 'ch', 'bo', 'fa', 'wo', 'OO', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6',
            'FS', 'BI', 'TR', 'BT', 'BE', 'CE', 'DS', 'SK', 'SL', 'BS', 'HO', 'RE', 'SW', 'CA', 'CT', 'CB',
            'CL', 'EY', 'MD', 'MT', 'HD', 'HP', 'MN', 'PG', 'GF', 'CY', 'SE', 'ST', 'LD', 'SR', 'ee', 'Bo',
            'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'
        ],
        worldTowns: new Map(),
        worldPlayers: new Map(),
        worldAlliances: new Map(),
        worldIslands: [],
        worldDataAt: 0,
        worldDataLoading: false,

        init: function() {
            this.til = GMB.storage.get('icontools_til', true);
            this.tim = GMB.storage.get('icontools_tim', true);
            this.tiw = GMB.storage.get('icontools_tiw', true);
            this.tpt = GMB.storage.get('icontools_tpt', true);
            this.tis = GMB.storage.get('icontools_tis', true);
            this.tih = GMB.storage.get('icontools_tih', true);
            this.tir = GMB.storage.get('icontools_tir', true);
            this.tow = GMB.storage.get('icontools_tow', true);
            this.tol = GMB.storage.get('icontools_tol', true);
            this.toh = GMB.storage.get('icontools_toh', true);
            this.manualTownTypes = this.loadWorldData('icontools_town_types', {});
            // Migratie: handmatige stadstypen uit Map Enhancer overnemen
            const legacy = this.loadWorldData('map_enhancer_icons', {});
            if (legacy && typeof legacy === 'object' && Object.keys(legacy).length && !Object.keys(this.manualTownTypes).length) {
                this.manualTownTypes = legacy;
                this.saveWorldData('icontools_town_types', this.manualTownTypes);
            }
            this.addTab();
            this.loadTownIconSprite();
            if (GMB.storage.get('icontools_enabled', false)) this.start();
        },

        // ==================== world-scoped storage (zelfde patroon als Map Enhancer) ====================
        getWorldBucket: function(key) {
            const all = GMB.storage.get(key, {});
            return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
        },
        loadWorldData: function(key, fallback) {
            const all = this.getWorldBucket(key);
            return all[GMB.worldId || 'unknown'] || fallback;
        },
        saveWorldData: function(key, value) {
            const all = this.getWorldBucket(key);
            all[GMB.worldId || 'unknown'] = value;
            GMB.storage.set(key, all);
        },

        addTab: function() {
            if (document.getElementById('gmb-tab-icontools')) return;
            GMB_UI.addTab('icontools', '🖼 Iconen', `
                <div class="gmb-section">
                    <div class="gmb-section-title">🖼 Iconen & town tools</div>
                    <label><input id="gmb-icontools-enabled" type="checkbox"> Icon-tools inschakelen</label>
                    <div id="gmb-icontools-status" class="gmb-muted" style="margin:5px 0;">Uitgeschakeld</div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Stadslijst & popups</div>
                    ${GMB_UI.createToggle('Stadslijst verbetering (iconen + populatie%)', 'icontools_til', true, a => { this.til = a; if (this.enabled) this.refreshAll(); })}
                    <div class="gmb-muted">Toont stadstype-iconen en_freee/populatie-% in de stadsgroepen-lijst, plus hover-popup.</div>
                    ${GMB_UI.createToggle('Town popup bij hover (kaart + lijst)', 'icontools_tiw', true, a => { this.tiw = a; if (this.enabled) this.refreshAll(); })}
                    <div class="gmb-muted">Toont bij hover over een stad units, support, held, god, resources, spy en binnenkomende troepen.</div>
                    ${GMB_UI.createToggle('Map-iconen (stadstype-badges + flagpoles)', 'icontools_tim', true, a => { this.tim = a; if (this.enabled) this.refreshAll(); })}
                    <div class="gmb-muted">Toont stadstype-iconen op de strategische kaart, als flagpole-achtergrond op de eilandweergave en in de stadslijst.</div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">Popup-inhoud</div>
                    ${GMB_UI.createToggle('Troepen + muur', 'icontools_tpt', true, a => { this.tpt = a; })}
                    ${GMB_UI.createToggle('Support eenheden', 'icontools_tis', true, a => { this.tis = a; })}
                    ${GMB_UI.createToggle('Held', 'icontools_tih', true, a => { this.tih = a; })}
                    ${GMB_UI.createToggle('Resources (incl. fury)', 'icontools_tir', true, a => { this.tir = a; })}
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">BBCode exports</div>
                    ${GMB_UI.createToggle('Stad BBCode-knop ([town]ID[/town])', 'icontools_tow', true, a => { this.tow = a; if (this.enabled) this.refreshAll(); })}
                    ${GMB_UI.createToggle('Stedenlijst BBCode per stadsgroep', 'icontools_tol', true, a => { this.tol = a; if (this.enabled) this.refreshAll(); })}
                    ${GMB_UI.createToggle('Helden in stadslijst', 'icontools_toh', true, a => { this.toh = a; if (this.enabled) this.refreshAll(); })}
                </div>`);

            const tab = document.getElementById('gmb-tab-icontools');
            const checkbox = tab.querySelector('#gmb-icontools-enabled');
            checkbox.checked = !!GMB.storage.get('icontools_enabled', false);
            checkbox.addEventListener('change', () => checkbox.checked ? this.start() : this.stop());
        },

        setStatus: function(text, error = false) {
            const status = document.getElementById('gmb-icontools-status');
            if (status) { status.textContent = text; status.style.color = error ? '#d66' : ''; }
        },

        start: function() {
                        if (this.enabled) return;
            this.enabled = true;
            GMB.storage.set('icontools_enabled', true);
            const checkbox = document.getElementById('gmb-icontools-enabled');
            if (checkbox) checkbox.checked = true;
            this.injectStyles();
            this.bindPopupEvents();
            this.hookReservationAjax();
            this.loadReservationIndex().catch(() => {});
            this.pollTimer = setInterval(() => this.refreshAll(), 2000);
            this.refreshAll();
            this.setStatus('Actief — icon-tools ingeschakeld.');
        },

        stop: function(reason = 'Uitgeschakeld.') {
            this.enabled = false;
            GMB.storage.set('icontools_enabled', false);
            if (this.pollTimer) clearInterval(this.pollTimer);
            this.pollTimer = null;
            this.unbindPopupEvents();
            this.townPopupEl = null;
            document.querySelectorAll('#gmb-icontools-style, .gmb_til_icon, .gmb_til_pop, .dio_hero, .gmb_townbb, #gmb_townbb_clipboard, .gmb_tol_bb, #gmb-icontools-popup, #gmb-icontools-bb-window, #gmb-icontools-shift, .gmb-icontools-mapicon, #gmb-ic-type-popup, #gmb-town-icon').forEach(n => n.remove());
            this.clearFlagpoleIcons();
            const inp = document.getElementById('input_townbb');
            if (inp) inp.remove();
            this.townbbAdded = false;
            this.tolAdded = false;
            this.listDecorated = false;
            const checkbox = document.getElementById('gmb-icontools-enabled');
            if (checkbox) checkbox.checked = false;
            this.setStatus(reason || 'Uitgeschakeld.');
        },

        onEnable: function() { this.addTab(); },

        refreshAll: function() {
            const safe = fn => { try { fn(); } catch (e) {} };
            safe(() => this.ensureTownData());
            safe(() => this.ensureWorldData());
            safe(() => this.refreshTownList());
            safe(() => this.refreshMapIcons());
            safe(() => this.refreshMapFlagpoles());
            safe(() => this.refreshTownNameIcon());
            safe(() => this.refreshTownbb());
            safe(() => this.refreshTownslistBB());
            if (this.townPopupEl && !this.tiw) this.removeTownPopup();
        },

        // ==================== helpers ====================
        getUW: function() { return GMB_API.getUW(); },

        getSpriteUrl: function() {
            const uw = this.getUW();
            const lid = (uw.Game && uw.Game.locale_lang ? uw.Game.locale_lang.split('_')[0] : 'en');
            return `https://gp${lid}.innogamescdn.com/images/game`;
        },

        isTownIconType: function(type) {
            return typeof type === 'string' && Object.prototype.hasOwnProperty.call(this.townIconSprites, type);
        },

        loadTownIconSprite: function() {
            const image = new Image();
            image.onload = () => { if (this.enabled) this.refreshAll(); };
            image.onerror = () => this.loadTownIconSpriteFallback();
            image.src = this.townIconSpriteUrl;
        },

        loadTownIconSpriteFallback: function() {
            if (this.townIconSpriteFallbackRequested) return;
            if (typeof GM_xmlhttpRequest !== 'function') return;
            this.townIconSpriteFallbackRequested = true;
            GM_xmlhttpRequest({
                method: 'GET',
                url: this.townIconSpriteUrl,
                responseType: 'arraybuffer',
                timeout: 20000,
                onload: response => {
                    if (response.status < 200 || response.status >= 300 || !response.response) return;
                    try {
                        const bytes = new Uint8Array(response.response);
                        let binary = '';
                        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
                            binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
                        }
                        this.townIconSpriteDataUrl = `data:image/png;base64,${btoa(binary)}`;
                        if (this.enabled) this.refreshAll();
                    } catch (e) {}
                }
            });
        },

        iconTypeFor: function(townId) {
            const manual = this.manualTownTypes[townId];
            if (this.isTownIconType(manual)) return manual;
            return this.autoTownTypes[townId] || null;
        },

        iconOffset: function(type) {
            const idx = this.townIconSprites[type];
            return typeof idx === 'number' ? idx * -25 : 0;
        },

        getTownId: function(node) {
            if (!node) return null;
            const link = node.matches && node.matches('.gp_town_link') ? node : node.closest && node.closest('.gp_town_link');
            const linkedId = this.getPayloadId(link);
            if (linkedId) return linkedId;
            let current = node;
            for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) {
                const match = String(current.id || '').match(/(?:^|_)(?:town_flag_|town_|mini_t|gt_)?(\d+)$/);
                if (match) return Number(match[1]);
            }
            const id = Number(node.getAttribute && (node.getAttribute('data-town-id') || node.getAttribute('data-id')));
            return Number.isInteger(id) && id > 0 ? id : null;
        },

        getPayloadId: function(link) {
            try {
                const hash = link && link.hash;
                if (!hash || hash.length < 2) return null;
                const decoded = JSON.parse(atob(hash.slice(1)));
                return Number(decoded.id) || null;
            } catch (error) { return null; }
        },

        // ==================== werelddata voor popup (eigen+turfsteden) ====================
        ensureWorldData: function() {
            if (this.worldDataLoading || (this.worldDataAt && Date.now() - this.worldDataAt < 120000)) return;
            if (typeof GMB_WorldData === 'undefined') return;
            this.worldDataLoading = true;
            const load = async () => {
                try {
                    const [towns, players, alliances, islands] = await Promise.all([
                        GMB_WorldData.getTowns().catch(() => null),
                        GMB_WorldData.getPlayers().catch(() => null),
                        GMB_WorldData.getAlliances().catch(() => null),
                        GMB_WorldData.getIslands().catch(() => null)
                    ]);
                    if (towns && towns.byId instanceof Map) this.worldTowns = towns.byId;
                    if (players && players.byId instanceof Map) this.worldPlayers = players.byId;
                    if (alliances && alliances.byId instanceof Map) this.worldAlliances = alliances.byId;
                    if (islands && Array.isArray(islands.list)) this.worldIslands = islands.list;
                    this.worldDataAt = Date.now();
                } catch (e) {}
                this.worldDataLoading = false;
            };
            load();
        },

        worldTownInfo: function(townId) {
            const town = this.worldTowns.get(Number(townId));
            if (!town) return null;
            const player = this.worldPlayers.get(Number(town.playerId));
            const alliance = player && this.worldAlliances.get(Number(player.allianceId));
            let ocean = '';
            if (Number.isFinite(Number(town.x)) && Number.isFinite(Number(town.y))) {
                ocean = String(Math.floor(Number(town.x) / 100) * 10 + Math.floor(Number(town.y) / 100)).padStart(2, '0');
            }
            let islandId = null;
            try {
                if (GMB_Map && typeof GMB_Map.getIslandIdForTown === 'function' && GMB_Map.enabled) {
                    islandId = GMB_Map.getIslandIdForTown(townId);
                }
            } catch (e) {}
            if (!islandId && Number.isFinite(Number(town.x)) && Number.isFinite(Number(town.y))) {
                let best = null, dist = Infinity;
                this.worldIslands.forEach(island => {
                    const d = Math.hypot(Number(town.x) - Number(island.x), Number(town.y) - Number(island.y));
                    if (d < dist) { dist = d; best = island; }
                });
                if (best && dist <= 20) islandId = Number(best.id);
            }
            const tags = [];
            try {
                if (GMB_Map && GMB_Map.tags) {
                    const keys = [`town:${townId}`];
                    if (player) keys.push(`player:${player.id}`);
                    if (alliance) keys.push(`alliance:${alliance.id}`);
                    keys.forEach(k => { if (GMB_Map.tags[k] && GMB_Map.tags[k].text) tags.push(GMB_Map.tags[k].text); });
                }
            } catch (e) {}
            return { town, player, alliance, ocean, islandId, tags };
        },

        pointNumber: function(number) {
            number = String(Math.round(Number(number) || 0));
            if (number.length <= 3) return number;
            const mod = number.length % 3;
            let out = mod > 0 ? number.substring(0, mod) : '';
            for (let i = 0; i < Math.floor(number.length / 3); i++) {
                out += (mod === 0 && i === 0 ? '' : '.') + number.substring(mod + 3 * i, mod + 3 * i + 3);
            }
            return out;
        },

        getHeroDIO: function() {
            const uw = this.getUW();
            const out = {};
            try {
                const mm = uw.MM;
                const coll = mm.collections || (mm.getCollections && mm.getCollections());
                const ph = coll && coll.PlayerHero && coll.PlayerHero[0];
                if (ph && ph.each) {
                    ph.each(function(hero) {
                        try {
                            const tid = hero.getHomeTownId();
                            out[tid] = {
                                id: hero.getId(),
                                level: hero.getLevel(),
                                town_id: tid,
                                town: hero.getOriginTownName ? hero.getOriginTownName() : ''
                            };
                        } catch (e) {}
                    });
                }
            } catch (e) {}
            return out;
        },

        groupsForTown: function(townId) {
            const uw = this.getUW();
            const result = {};
            try {
                const mm = uw.MM;
                const coll = mm.collections || (mm.getCollections && mm.getCollections());
                const tgt = coll && coll.TownGroupTown && coll.TownGroupTown[0];
                if (tgt && tgt.each) {
                    tgt.each(function(t) {
                        try {
                            if (t.getTownId() == townId) {
                                const gid = t.getGroupId();
                                const name = (uw.ITowns.town_groups._byId[gid] || {}).attributes
                                    ? uw.ITowns.town_groups._byId[gid].attributes.name : null;
                                if (name) result[gid] = name;
                            }
                        } catch (e) {}
                    });
                }
            } catch (e) {}
            return result;
        },

        townMovements: function(townId) {
            const uw = this.getUW();
            let att = 0, sup = 0;
            try {
                const models = uw.MM.getModels().MovementsUnits || {};
                Object.keys(models).forEach(k => {
                    const t = models[k].attributes || {};
                    if (t.target_town_id == townId) {
                        if (t.type === 'attack') att++;
                        if (t.type === 'support') sup++;
                    }
                });
            } catch (e) {}
            return { att, sup };
        },

        // ==================== compute town data (auto types + population) ====================
        computeTownData: function() {
            const uw = this.getUW();
            const towns = uw.ITowns.getTowns ? uw.ITowns.getTowns() : {};
            const gd = uw.GameData.units || {};
            const types = {};
            const pop = {};
            const popByFarmLevel = [114, 121, 134, 152, 175, 206, 245, 291, 343, 399, 458, 520, 584, 651, 720, 790, 863, 938, 1015, 1094, 1174, 1257, 1341, 1426, 1514, 1602, 1693, 1785, 1878, 1973, 2070, 2168, 2267, 2368, 2470, 2573, 2678, 2784, 2891, 3000, 3109, 3220, 3332, 3446, 3560];

            Object.keys(towns).forEach(tid => {
                const town = towns[tid];
                if (!town || typeof town.units !== 'function') return;
                let units = {};
                try { units = town.units() || {}; } catch (e) { return; }
                const type = { lo: 0, ld: 0, so: 0, sd: 0, fo: 0, fd: 0 };
                let hasUnits = false;
                Object.keys(units).forEach(uid => {
                    const u = gd[uid];
                    const tmp = Number(units[uid]) || 0;
                    if (!u || tmp <= 0) return;
                    hasUnits = true;
                    if (!u.is_naval) {
                        const defAvg = ((Number(u.def_hack) || 0) + (Number(u.def_pierce) || 0) + (Number(u.def_distance) || 0)) / 3 * tmp;
                        if (u.flying) { type.fd += defAvg; type.fo += (Number(u.attack) || 0) * tmp; }
                        else { type.ld += defAvg; type.lo += (Number(u.attack) || 0) * tmp; }
                    } else {
                        type.sd += (Number(u.defense) || 0) * tmp;
                        type.so += (Number(u.attack) || 0) * tmp;
                    }
                });

                const z = (type.sd + type.ld + type.fd) <= (type.so + type.lo + type.fo) ? 'o' : 'd';
                let temp = 0, best = 'no';
                Object.keys(type).forEach(t => {
                    if (type[t] > temp) { temp = type[t]; best = t[0] + z; }
                });
                if (temp < 1000) best = 'no';

                // Population (DIO-port)
                try {
                    const bv = uw.GameData.buildings || {};
                    const bld = town.buildings ? town.buildings() : null;
                    const levelArray = bld && bld.getLevels ? bld.getLevels() : {};
                    const farmLevel = (bld && bld.getBuildingLevel ? bld.getBuildingLevel('farm') : null) || (levelArray.farm || 1);
                    let popMax;
                    if (bv.farm && bv.farm.farm_factor != null && bld && bld.getBuildingLevel) {
                        popMax = Math.floor(bv.farm.farm_factor * Math.pow(farmLevel, bv.farm.farm_pow || 1));
                    } else {
                        popMax = popByFarmLevel[farmLevel - 1] || 0;
                    }
                    const popPlow = (town.getResearches && town.getResearches().attributes && town.getResearches().attributes.plow) ? 200 : 0;
                    const thermal = bld && bld.getBuildingLevel ? bld.getBuildingLevel('thermal') : 0;
                    const popFactor = thermal ? 1.1 : 1.0;
                    const popExtra = town.getPopulationExtra ? (town.getPopulationExtra() || 0) : 0;
                    if (town.god && town.god() === 'aphrodite') popMax += farmLevel * 5;
                    let popBuilding = 0;
                    Object.keys(levelArray).forEach(b => {
                        const def = bv[b];
                        if (def && def.pop != null && def.pop_factor != null) {
                            popBuilding += Math.round(def.pop * Math.pow(levelArray[b], def.pop_factor));
                        }
                    });
                    const availPop = town.getAvailablePopulation ? (Number(town.getAvailablePopulation()) || 0) : 0;
                    const max = popMax * popFactor + popPlow + popExtra;
                    const used = parseInt(max - (popBuilding + availPop), 10) || 0;
                    pop[tid] = {
                        max,
                        buildings: popBuilding,
                        units: used,
                        percent: (max - popBuilding) > 0 ? Math.round(100 / (max - popBuilding) * used) : 0
                    };
                    if (used < 300) best = 'po';
                } catch (e) {}

                types[tid] = hasUnits || best === 'po' ? best : 'no';
            });
            this.autoTownTypes = types;
            this.population = pop;
            this.townDataAt = Date.now();
        },

        ensureTownData: function() {
            if (!this.townDataAt || Date.now() - this.townDataAt > 30000) this.computeTownData();
        },

        // ==================== dio_til: town list ====================
        refreshTownList: function() {
            const list = document.getElementById('town_groups_list');
            if (!list) { this.listDecorated = false; return; }
            if (!this.til && !this.toh && !this.tiw) {
                document.querySelectorAll('#town_groups_list .gmb_til_icon, #town_groups_list .gmb_til_pop, #town_groups_list .dio_hero').forEach(n => n.remove());
                return;
            }
            this.ensureTownData();
            const sprites = this.townIconSprites;
            const spriteUrl = this.townIconSpriteDataUrl || this.townIconSpriteUrl;

            // Helden (dio_Toh)
            if (this.toh) {
                const heroes = this.getHeroDIO();
                list.querySelectorAll('.town_group_town').forEach(item => {
                    const tid = item.getAttribute('name');
                    const h = heroes[tid];
                    if (h && !item.querySelector('.dio_hero')) {
                        const el = document.createElement('div');
                        el.className = `dio_hero gmb_hero hero_icon hero25x25 ${h.id}`;
                        el.innerHTML = `<div class="value" style="color:white;float:right;text-shadow:1px 1px 0 #000;padding-top:5px;">${h.level}</div>`;
                        el.title = `${h.id} (level ${h.level})`;
                        item.insertBefore(el, item.firstChild);
                    } else if (!h) {
                        const stale = item.querySelector('.dio_hero');
                        if (stale) stale.remove();
                    }
                });
            } else {
                list.querySelectorAll('#town_groups_list .dio_hero').forEach(n => n.remove());
            }

            // Iconen + populatie% (dio_til)
            if (this.til) {
                list.querySelectorAll('.town_group_town').forEach(item => {
                    const tid = item.getAttribute('name');
                    if (!tid) return;
                    if (!item.querySelector('.gmb_til_icon')) {
                        const type = this.iconTypeFor(tid) || 'no';
                        const idx = sprites[type];
                        const icon = document.createElement('div');
                        icon.className = 'gmb_til_icon dio_icon_small';
                        icon.style.cssText = `display:inline-block !important;float:left;width:25px;height:25px;background:url(${spriteUrl}) ${(typeof idx === 'number' ? idx * -25 : 0)}px -26px no-repeat;`;
                        item.insertBefore(icon, item.firstChild);
                        const p = this.population[tid];
                        if (p) {
                            const cls = p.percent < 25 ? 'quarter' : p.percent < 50 ? 'half' : p.percent < 75 ? 'threequarter' : 'full';
                            const pct = document.createElement('div');
                            pct.className = `gmb_til_pop dio_pop_percent ${cls}`;
                            pct.textContent = `${p.percent}%`;
                            item.appendChild(pct);
                        }
                    }
                });
            } else {
                list.querySelectorAll('#town_groups_list .gmb_til_icon, #town_groups_list .gmb_til_pop').forEach(n => n.remove());
            }
        },

        // ==================== dio_tim: map-iconen ====================
        //Strategische kaart (.m_town): circle-badge op de marker.
        //Eilandweergave (#town_flag_ .flagpole, #mini_t): DIO-achtergrond via refreshMapFlagpoles.
        refreshMapIcons: function() {
            if (!this.tim) {
                document.querySelectorAll('.gmb-icontools-mapicon').forEach(n => n.remove());
                return;
            }
            const nodes = document.querySelectorAll('#minimap_islands_layer .m_town, #main_area .m_town');
            const seen = new Set();
            nodes.forEach(node => {
                if (seen.has(node)) return;
                seen.add(node);
                const townId = this.townIdFromEl(node);
                const marker = node;
                if (!marker) return;
                const type = townId ? this.iconTypeFor(townId) : null;
                const existing = marker.querySelector(':scope > .gmb-icontools-mapicon');
                if (!type) { if (existing) existing.remove(); return; }
                const manual = this.isTownIconType(this.manualTownTypes[townId]);
                if (existing) {
                    if (existing.dataset.type === type) return;
                    existing.remove();
                }
                if (getComputedStyle(marker).position === 'static') marker.style.position = 'relative';
                const icon = document.createElement('span');
                icon.className = 'gmb-icontools-mapicon';
                icon.dataset.type = type;
                icon.dataset.town = townId;
                icon.title = `Stadstype ${type}${manual ? ' (handmatig)' : ' (automatisch)'}`;
                const sprite = document.createElement('span');
                sprite.className = 'gmb-icontools-mapicon-sprite';
                sprite.style.backgroundImage = `url("${this.townIconSpriteDataUrl || this.townIconSpriteUrl}")`;
                sprite.style.backgroundPosition = `${this.townIconSprites[type] * -25}px -26px`;
                icon.appendChild(sprite);
                marker.appendChild(icon);
            });
        },

        // ==================== stadstype-icoon in .town_name_area (DIO #town_icon) ====================
        townNameIconArray: [
            'lo', 'ld', 'fo', 'fd', 'so', 'sd', 'no', 'po',
            'sh', 'di', 'un', 'ko', 'ti', 'gr', 'dp', 're',
            'wd', 'st', 'si', 'bu', 'he', 'ch', 'bo', 'fa',
            'wo', 'OO', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6',
            'hr',
            'FS', 'BI', 'TR', 'BT', 'BE', 'CE', 'DS', 'SK',
            'SL', 'BS', 'HO', 'RE', 'SW', 'CA', 'CT', 'CB',
            'CL', 'EY', 'MD', 'MT', 'HD', 'HP', 'MN', 'PG',
            'GF', 'CY', 'SE', 'ST', 'LD', 'SR', 'ee', 'Bo',
            'hr',
            'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'
        ],

        refreshTownNameIcon: function() {
            const existing = document.getElementById('gmb-town-icon');
            const area = document.querySelector('.town_name_area');
            if (!this.tim || !area) { if (existing) existing.remove(); return; }
            const uw = this.getUW();
            const townId = uw.Game && uw.Game.townId;
            if (!townId) { if (existing) existing.remove(); return; }
            this.ensureTownData();
            let icon = existing;
            if (icon && icon.dataset.town !== String(townId)) { icon.remove(); icon = null; }
            if (!icon) { icon = this.buildTownNameIcon(area, townId); }
            this.updateTownNameIcon(icon, townId);
        },

        buildTownNameIcon: function(area, townId) {
            const spriteUrl = this.townIconSpriteDataUrl || this.townIconSpriteUrl;
            const icon = document.createElement('div');
            icon.id = 'gmb-town-icon';
            icon.dataset.town = String(townId);
            const bg = document.createElement('div');
            bg.className = 'town_icon_bg';
            const big = document.createElement('div');
            big.className = 'icon_big';
            bg.appendChild(big);
            icon.appendChild(bg);
            const sel = document.createElement('div');
            sel.className = 'select_town_icon';
            const list = document.createElement('div');
            list.className = 'item-list';
            this.townNameIconArray.forEach(type => {
                if (type === 'hr') { list.appendChild(document.createElement('hr')); return; }
                const opt = document.createElement('div');
                opt.className = 'option_s';
                opt.dataset.icon = type;
                opt.title = type;
                opt.style.backgroundImage = `url("${spriteUrl}")`;
                opt.style.backgroundPosition = `${this.townIconSprites[type] * -25}px -26px`;
                opt.addEventListener('click', () => this.applyTownIconType(townId, type, icon));
                list.appendChild(opt);
            });
            list.appendChild(document.createElement('hr'));
            const auto = document.createElement('div');
            auto.className = 'option_s auto_s';
            auto.dataset.icon = 'auto';
            auto.innerHTML = '<b>Auto</b>';
            auto.title = 'Automatisch detecteren';
            auto.addEventListener('click', () => this.applyTownIconType(townId, 'auto', icon));
            list.appendChild(auto);
            const reset = document.createElement('div');
            reset.className = 'option_s défaut_s';
            reset.dataset.icon = 'défaut';
            reset.title = 'Standaard (geen Override)';
            reset.addEventListener('click', () => this.applyTownIconType(townId, 'défaut', icon));
            list.appendChild(reset);
            const help = document.createElement('div');
            help.className = 'help_town_icon';
            help.textContent = '?';
            help.title = 'Kies hier het stadstype van de huidige stad';
            list.appendChild(help);
            sel.appendChild(list);
            icon.appendChild(sel);
            bg.addEventListener('click', () => {
                sel.style.display = sel.style.display === 'none' || sel.style.display === '' ? 'block' : 'none';
            });
            area.appendChild(icon);
            return icon;
        },

        applyTownIconType: function(townId, type, icon) {
            if (type === 'auto' || type === 'défaut') delete this.manualTownTypes[townId];
            else this.manualTownTypes[townId] = type;
            this.saveWorldData('icontools_town_types', this.manualTownTypes);
            const sel = icon && icon.querySelector('.select_town_icon');
            if (sel) sel.style.display = 'none';
            this.refreshAll();
        },

        updateTownNameIcon: function(icon, townId) {
            if (!icon) return;
            this.ensureTownData();
            const type = this.iconTypeFor(townId) || 'no';
            const idx = this.townIconSprites[type];
            const big = icon.querySelector('.icon_big');
            if (big) {
                big.className = 'icon_big';
                big.style.backgroundImage = `url("${this.townIconSpriteDataUrl || this.townIconSpriteUrl}")`;
                big.style.backgroundPosition = `${(typeof idx === 'number' ? idx : 12) * -25}px 0px`;
                big.title = `Stadstype: ${type}${this.manualTownTypes[townId] ? ' (handmatig)' : ' (automatisch)'}`;
            }
            icon.querySelectorAll('.option_s').forEach(opt => {
                const want = this.manualTownTypes[townId] || 'auto';
                opt.classList.toggle('sel', opt.dataset.icon === want);
            });
        },

        refreshMapFlagpoles: function() {
            if (!this.tim) {
                this.clearFlagpoleIcons();
                return;
            }
            this.ensureTownData();
            const towns = this.getUW().ITowns.getTowns ? this.getUW().ITowns.getTowns() : {};
            const spriteUrl = this.townIconSpriteDataUrl || this.townIconSpriteUrl;
            Object.keys(towns).forEach(tid => {
                const type = this.iconTypeFor(tid);
                const idx = this.townIconSprites[type];
                [`#mini_t${tid}`, `#town_flag_${tid} .flagpole`, `#town_flag_${tid} #gt_${tid}`].forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        // DIO MapIcons.add: oranje achtergrond + sprite op -27px
                        el.style.backgroundColor = type && typeof idx === 'number' ? 'rgb(255, 187, 0)' : '';
                        el.style.backgroundImage = type && typeof idx === 'number' ? `url(${spriteUrl})` : '';
                        el.style.backgroundRepeat = type && typeof idx === 'number' ? 'repeat' : '';
                        el.style.backgroundPosition = type && typeof idx === 'number' ? `${idx * -25}px -27px` : '';
                    });
                });
            });
        },

        clearFlagpoleIcons: function() {
            const towns = this.getUW().ITowns.getTowns ? this.getUW().ITowns.getTowns() : {};
            Object.keys(towns).forEach(tid => {
                [`#mini_t${tid}`, `#town_flag_${tid} .flagpole`, `#town_flag_${tid} #gt_${tid}`].forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        el.style.backgroundColor = '';
                        el.style.backgroundImage = '';
                        el.style.backgroundRepeat = '';
                        el.style.backgroundPosition = '';
                    });
                });
            });
        },

        // ==================== dio_tiw: town popup ====================
        bindPopupEvents: function() {
            if (this.popupBound) return;
            this.popupBound = true;
            const sel = '.m_town, .own_town .flagpole, .town_group_town .town_name, #map_towns .flagpole, #map_towns [id^="town_"]';
            document.addEventListener('mouseover', this.onPopupOver = e => {
                if (!this.enabled || !this.tiw) return;
                const t = e.target;
                if (!t || !t.closest) return;
                const el = t.closest(sel);
                if (el) {
                    clearTimeout(this.popupTimer);
                    this.popupTimer = setTimeout(() => this.showTownPopup(el), 250);
                }
            }, true);
            document.addEventListener('mouseout', this.onPopupOut = e => {
                if (!this.enabled || !this.tiw) return;
                const t = e.target;
                if (!t || !t.closest) return;
                if (t.closest(sel) || (this.townPopupEl && this.townPopupEl.contains(t))) {
                    clearTimeout(this.popupTimer);
                    // Alleen sluiten als de muis het marker-element én de popup verlaat
                    const stillInside = this.townPopupEl && this.townPopupEl.contains(e.relatedTarget);
                    const marker = t.closest(sel);
                    const toMarker = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(sel);
                    if (!stillInside && (!toMarker || toMarker !== marker)) this.removeTownPopup();
                }
            }, true);
        },

        unbindPopupEvents: function() {
            if (!this.popupBound) return;
            document.removeEventListener('mouseover', this.onPopupOver, true);
            document.removeEventListener('mouseout', this.onPopupOut, true);
            clearTimeout(this.popupTimer);
            this.popupBound = false;
        },

        townIdFromEl: function(el) {
            const byNode = this.getTownId(el);
            if (byNode) return byNode;
            if (!el) return 0;
            if (el.classList && el.classList.contains('town_name')) {
                const parent = el.closest('.town_group_town');
                return parent ? parseInt(parent.getAttribute('name'), 10) : 0;
            }
            const holder = el.closest('.town_group_town') || el.parentElement || el;
            const fromName = holder && holder.getAttribute && holder.getAttribute('name');
            if (fromName && /^\d+$/.test(fromName)) return parseInt(fromName, 10);
            const src = (el.id || '') + ' ' + (holder && holder.id || '');
            const m = src.match(/(\d+)/);
            return m ? parseInt(m[1], 10) : 0;
        },

        showTownPopup: function(el) {
            if (!this.enabled || !this.tiw) return;
            const townId = this.townIdFromEl(el);
            if (!townId) return;
            const uw = this.getUW();
            const towns = uw.ITowns.getTowns ? uw.ITowns.getTowns() : {};
            const town = towns[townId] || (uw.ITowns.getTown && uw.ITowns.getTown(townId));
            const info = this.worldTownInfo(townId);
            if (!town && !info) return;

            this.removeTownPopup();
            const $ = (uw && uw.$) || window.$;
            const offset = $ ? $(el).offset() : { left: 0, top: 0 };
            const left = offset.left - 150;
            const top = offset.top + 20;

            const units = town && town.units ? (town.units() || {}) : {};
            const support = town && town.unitsSupport ? (town.unitsSupport() || {}) : {};

            let html = `<div id="gmb-icontools-popup" style="left:${left}px;top:${top}px;">`;
            html += `<div class="popup" style="background:#2a1f14;border:2px solid #7f653a;border-radius:4px;padding:6px;color:#ecb44d;font-size:11px;max-width:230px;">`;

            // Titel + stadsgroepen (eigen stad, curator-premium)
            let groupName = '';
            if (town) {
                try {
                    if (uw.Game.premium_features && uw.Game.premium_features.curator >= (uw.Timestamp ? uw.Timestamp.now() : Date.now() / 1000)) {
                        const groups = this.groupsForTown(townId);
                        const names = Object.keys(groups).filter(g => g != -1 && g != 0).map(g => groups[g]);
                        if (names.length) groupName = ' (' + names.slice(0, 2).join(' / ') + (names.length > 2 ? ' (...' : ')');
                        if (names.length > 2) groupName += ')';
                    }
                } catch (e) {}
            }
            const townName = this.cleanName((town && town.name) || (info && info.town && info.town.name) || `Stad ${townId}`);
            html += `<div class="gmb-popup-title"><span>${townName}</span><span style="color:#6eff5c;">${groupName}</span></div>`;
            // Stadstype-icoon in de titel (DIO .dio_icon — sepia)
            const ptype = this.iconTypeFor(townId);
            const pidx = ptype ? this.townIconSprites[ptype] : null;
            if (ptype && typeof pidx === 'number') {
                html += `<div class="gmb-popup-typeicon" style="background-image:url(${this.townIconSpriteDataUrl || this.townIconSpriteUrl});background-position:${pidx * -25}px -26px;" title="Stadstype: ${ptype}"></div>`;
            }

            // Wereldmeta — elke regel apart: naam (bold) / alliantie / punten / oceaan / eiland
            if (info) {
                const metaLine = (label, value) => value ? `<div class="gmb-popup-meta">${label ? `<span class="gmb-popup-meta-label">${label}:</span> ` : ''}${value}</div>` : '';
                if (info.player) html += `<div class="gmb-popup-meta"><b>${this.cleanName(info.player.name)}</b></div>`;
                if (info.alliance) {
                    // Alliantie-tag [XXX] wordt weggelaten — alleen de naam
                    const aname = this.cleanName(info.alliance.name).replace(/^\[[^\]]*\]\s*/, '');
                    html += metaLine('Alliantie', aname || this.cleanName(info.alliance.name));
                }
                if (info.town && info.town.points != null) html += metaLine('Punten', this.pointNumber(info.town.points));
                if (info.ocean) html += metaLine('Oceaan', info.ocean);
                if (info.islandId) html += metaLine('Eiland', info.islandId);
                if (info.tags.length) html += `<div class="gmb-popup-meta gmb-popup-tags">${info.tags.join(', ')}</div>`;
            }

            if (!town) {
                html += `<div class="gmb-popup-sec" style="font-size:10px;">Buitenlandse stad — troepen, resources en held zijn niet beschikbaar.</div>`;
                html += `<div class="gmb-popup-reservation" data-town="${townId}">${this.reservationHtml(townId)}</div>`;
                html += `</div></div>`;
                const wrap = document.createElement('div');
                wrap.innerHTML = html;
                this.townPopupEl = wrap.firstElementChild;
                const curtain = document.getElementById('popup_div_curtain') || document.body;
                curtain.appendChild(this.townPopupEl);
                this.loadReservation(townId);
                return;
            }

            // Binnenkomende troepen (DIO move_counter_content)
            try {
                const mv = this.townMovements(townId);
                if (mv.att > 0 || mv.sup > 0) {
                    html += `<div class="gmb-popup-sec move_counter_content">`;
                    if (mv.att > 0) html += `<div class="movement off"></div><div class="gmb-popup-mc-row" style="font-size:12px;"><div class="attack_icon"></div><span class="movement" style="color:red;"> ${mv.att}</span> ${mv.att > 1 ? 'aanvallen' : 'aanval'}</div>`;
                    if (mv.sup > 0) html += `<div class="movement def"></div><div class="gmb-popup-mc-row" style="font-size:12px;"><div class="support_icon"></div><span class="movement" style="color:green;"> ${mv.sup}</span> ${mv.sup > 1 ? 'supports' : 'support'}</div>`;
                    html += `</div>`;
                }
            } catch (e) {}

            // Troepen + muur (tpt) — DIO unit_content markup
            if (this.tpt) {
                html += `<div class="gmb-popup-sec gmb-popup-units unit_content">`;
                Object.keys(units).forEach(id => {
                    const c = Number(units[id]) || 0;
                    if (c <= 0) return;
                    const cls = c > 1000 ? ' four_digit_number' : '';
                    html += `<div class="unit_icon25x25 ${id}${cls}"><span class="count text_shadow">${c}</span></div>`;
                });
                try {
                    const wall = town.getBuildings && town.getBuildings().attributes ? town.getBuildings().attributes.wall : null;
                    if (wall != null) html += `<div class="wall image bold"><span class="count text_shadow">${wall}</span></div>`;
                } catch (e) {}
                html += `</div>`;
            }

            // Support (tis) — DIO unit_content markup
            if (this.tis) {
                const sIds = Object.keys(support).filter(id => (Number(support[id]) || 0) > 0);
                if (sIds.length) {
                    html += `<div class="gmb-popup-sec" style="font-size:10px;margin-top:3px;">Support</div><div class="gmb-popup-units unit_content">`;
                    sIds.forEach(id => {
                        const c = Number(support[id]) || 0;
                        const cls = c > 1000 ? ' four_digit_number' : '';
                        html += `<div class="unit_icon25x25 ${id}${cls}"><span class="count text_shadow">${c}</span></div>`;
                    });
                    html += `</div>`;
                }
            }

            // Resources (tir) — DIO resources_content tabel met game-classes
            if (this.tir) {
                try {
                    const res = town.resources ? town.resources() : {};
                    const storage = town.getStorage ? town.getStorage() : 0;
                    const maxFavor = town.getMaxFavor ? town.getMaxFavor() : 0;
                    let Fury = 0, furyMax = 0, isAres = false;
                    try {
                        if (town.god && town.god() === 'ares') {
                            isAres = true;
                            const pg = uw.ITowns.player_gods ? (uw.ITowns.player_gods.attributes || {}) : {};
                            Fury = pg.fury || 0; furyMax = pg.max_fury || 0;
                        }
                    } catch (e) {}
                    const tc = full => full ? 'color:red;' : '';
                    html += `<div class="gmb-popup-sec gmb-popup-res resources_content"><table cellspacing="2px" cellpadding="0px"><tr>` +
                        `<td class="resources_small wood"></td><td style="${tc(res.wood === storage)}width:1%;">${res.wood || 0}</td>` +
                        `<td style="min-width:15px;"></td>` +
                        `<td class="resources_small population"></td><td style="${tc(res.population === 0)} width:1%;">${res.population || 0}</td>` +
                        `</tr><tr>` +
                        `<td class="resources_small stone"></td><td style="${tc(res.stone === storage)}">${res.stone || 0}</td>` +
                        `<td style="min-width:15px;"></td>` +
                        `<td class="resources_small favor"></td><td style="${tc(res.favor === maxFavor)} width:1%;">${res.favor || 0}</td>` +
                        `</tr><tr>` +
                        `<td class="resources_small iron"></td><td style="${tc(res.iron === storage)}">${res.iron || 0}</td>`;
                    if (isAres) {
                        html += `<td style="min-width:15px;"></td><td class="fury_icon"></td><td style="${tc(Fury === furyMax)} width:1%;">${Fury}</td>`;
                    }
                    html += `</tr></table></div>`;
                } catch (e) {}
            }

            // Spy + held + god (footer) — DIO footer_content markup
            try {
                const spy = town.getEspionageStorage ? town.getEspionageStorage() : 0;
                html += `<div class="gmb-popup-sec gmb-popup-footer footer_content"><table cellspacing="0px"><tr>`;
                html += `<td class="spy_content"><div class="support_filter attack_spy"></div><div class="spy_text">${spy}</div></td>`;
                if (this.tih) {
                    const h = this.getHeroDIO()[townId];
                    if (h) html += `<td></td><td class="hero_content"><div class="hero_icon hero25x25 ${h.id}"><span class="count text_shadow">${h.level}</span></div></td>`;
                }
                const god = town.god ? town.god() : null;
                if (god) html += `<td></td><td class="god_content"><div class="god_mini ${god}"></div></td>`;
                html += `</tr></table></div>`;
            } catch (e) {}

            // Stadsreservering (GRCRT-data, async)
            html += `<div class="gmb-popup-reservation" data-town="${townId}">${this.reservationHtml(townId)}</div>`;

            html += `</div></div>`;
            const wrap = document.createElement('div');
            wrap.innerHTML = html;
            this.townPopupEl = wrap.firstElementChild;
            const curtain = document.getElementById('popup_div_curtain') || document.body;
            curtain.appendChild(this.townPopupEl);
            this.loadReservation(townId);
        },

        // ==================== stadsreserveringen ====================
        // Namen uit data-bestanden kunnen URL-geëncodeerd zijn (%2A = *, %20 = spatie) en '+' = spatie
        cleanName: function(s) {
            let out = String(s || '');
            try { out = decodeURIComponent(out); } catch (e) {}
            return out.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
        },

        reservationCache: {},
        reservationPending: {},
        reservationIndex: null,
        reservationIndexAt: 0,
        reservationIndexLoading: false,

        // Echte bron: GET /game/reservation?action=index — alliance-brede reserveringslijst
        // (GRCRT getTown4Radar is anoniem en vult reservation nooit in)
        loadReservationIndex: function(force) {
            if (this.reservationIndexLoading) return Promise.resolve(this.reservationIndex || {});
            if (!force && this.reservationIndex && Date.now() - this.reservationIndexAt < 5 * 60 * 1000) {
                return Promise.resolve(this.reservationIndex);
            }
            this.reservationIndexLoading = true;
            const uw = this.getUW();
            const tid = (uw.Game && uw.Game.townId) || 0;
            const json = JSON.stringify({ town_id: tid, nl_init: true });
            return GMB_API.get('reservation', 'index', { json }).then(resp => {
                const list = resp && resp.json && resp.json.data && resp.json.data.reservations;
                const map = {};
                if (Array.isArray(list)) list.forEach(r => { if (r && r.town_id != null) map[String(r.town_id)] = r; });
                this.reservationIndex = map;
                this.reservationIndexAt = Date.now();
                this.reservationCache = {};
                GMB.log('IconTools', `Reserveringen index geladen: ${Array.isArray(list) ? list.length : 0} records`, 'info');
                return map;
            }).catch(err => {
                GMB.log('IconTools', `Reserveringen index mislukt: ${err && err.message}`, 'warn');
                return this.reservationIndex || {};
            }).finally(() => { this.reservationIndexLoading = false; });
        },

        reservationHtml: function(townId) {
            const r = this.reservationCache[townId];
            const text = this.reservationText(r);
            if (text) return `<div class="gmb-popup-res-line">Reservering: ${text}</div>`;
            if (this.reservationPending[townId]) return `<div class="gmb-popup-res-line">Reservering: laden…</div>`;
            return '';
        },

        reservationText: function(r) {
            if (!r) return '';
            if (typeof r === 'string') return r;
            if (r === true) return 'Gereserveerd';
            // Game-vorm uit /game/reservation?action=index (town_id + player-velden)
            if (r.town_id != null && (r.reservation_player_id !== undefined || r.assign_player_id !== undefined || r.create_date !== undefined)) {
                return this.reservationGameText(r);
            }
            if (!r.state && !r.type) {
                // Generieke game-vorm: attempted fields
                const state = r.state || r.status || r.reservation_state;
                const type = r.type || r.reservation_type || r.owner_type;
                if (!state && !type) return '';
                r = Object.assign({}, r, { state, type });
            }
            const linkName = l => {
                const s = String(l || '');
                const m = s.match(/\[\/?(?:player|alliance)\]([^\[\]]+)\[\/?(?:player|alliance)\]/i);
                if (m) return this.cleanName(m[1]);
                const hm = s.match(/>([^<>]+)</);
                return hm ? this.cleanName(hm[1]) : '';
            };
            if (r.state === 'reserved') {
                if (r.type === 'own') return 'Gereserveerd voor jou';
                if (r.type === 'ally') return `Gereserveerd voor alliantielid${linkName(r.player_link) ? ' ' + linkName(r.player_link) : ''}`;
                return `Gereserveerd voor alliantie${linkName(r.alliance_link || r.player_link) ? ' ' + linkName(r.alliance_link || r.player_link) : ''}`;
            }
            if (r.state === 'added') {
                if (r.type === 'ally') return 'Alliantielid kan deze stad reserveren';
                return 'Alliantie kan deze stad reserveren';
            }
            return '';
        },

        // Weergave van een reserveringsrecord uit /game/reservation?action=index
        reservationGameText: function(r) {
            const uw = this.getUW();
            const myId = uw.Game && (uw.Game.player_id || uw.Game.playerId);
            const pid = r.reservation_player_id != null ? Number(r.reservation_player_id)
                : (r.assign_player_id != null ? Number(r.assign_player_id) : null);
            let name = '';
            const raw = r.reservation_player_name || r.player_name || r.assigned_player_name;
            if (raw) name = this.cleanName(raw);
            if (!name && pid != null && this.worldPlayers && this.worldPlayers.get) {
                try {
                    const w = this.worldPlayers.get(pid);
                    const n = typeof w === 'string' ? w : (w && (w.name || w.player_name));
                    if (n) name = this.cleanName(n);
                } catch (e) {}
            }
            if (pid != null && myId != null && pid === Number(myId)) return 'Gereserveerd voor jou';
            if (pid != null) return `Gereserveerd voor alliantielid${name ? ' ' + name : ''}`;
            return 'Gereserveerd voor de alliantie';
        },

        resAjaxHooked: false,

        // 嗅探游戏 reservation 窗口的 ajax，找真实数据源（GRCRT 匿名调用拿不到 reservation）
        hookReservationAjax: function() {
            if (this.resAjaxHooked) return;
            this.resAjaxHooked = true;
            const $ = (this.getUW() && this.getUW().$) || window.$;
            if (!$ || !$.fn) { this.resAjaxHooked = false; return; }
            $(document).ajaxComplete((e, xhr, opt) => {
                try {
                    const url = String((opt && opt.url) || '');
                    const text = xhr && xhr.responseText ? String(xhr.responseText) : '';
                    // url-match, of kleine response die 'reservation' bevat (map-data is te groot → negeer)
                    if (!/reserv/i.test(url) && !(text.length < 300000 && /reservation/i.test(text))) return;
                    GMB.log('IconTools', `Reservering-ajax: ${(opt && opt.type) || 'GET'} ${url.slice(0, 180)} (${text.length}b)`, 'info');
                    if (/json/i.test(xhr.getResponseHeader('content-type') || '') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
                        try {
                            const s = JSON.stringify(JSON.parse(text));
                            if (/reservation/i.test(s)) GMB.log('IconTools', `Reservering-payload: ${s.slice(0, 400)}`, 'info');
                        } catch (e2) {}
                    }
                } catch (err) {}
            });
        },

        loadReservation: function(townId) {
            const slot = this.townPopupEl && this.townPopupEl.querySelector(`.gmb-popup-reservation[data-town="${townId}"]`);
            const paint = () => {
                if (slot) slot.innerHTML = this.reservationHtml(townId);
            };
            if (this.reservationCache[townId] !== undefined) { paint(); return; }
            if (this.reservationPending[townId]) return;
            // Bron: /game/reservation?action=index (alliance-brede lijst, échte sessie-data)
            this.reservationPending[townId] = true;
            this.loadReservationIndex().then(map => {
                const r = map[String(townId)] || null;
                this.reservationCache[townId] = r;
                if (r) GMB.log('IconTools', `Reservering stad ${townId}: ${JSON.stringify(r).slice(0, 250)}`, 'info');
            }).finally(() => {
                this.reservationPending[townId] = false;
                paint();
            });
        },

        removeTownPopup: function() {
            if (this.townPopupEl) { this.townPopupEl.remove(); this.townPopupEl = null; }
        },

        // ==================== dio_Tow: stad BBCode ====================
        refreshTownbb: function() {
            if (!this.tow) {
                document.querySelectorAll('.gmb_townbb, #gmb_townbb_input').forEach(n => n.remove());
                return;
            }
            const area = document.querySelector('.town_name_area');
            if (!area) return;
            if (!area.querySelector('.gmb_townbb')) {
                const btn = document.createElement('a');
                btn.className = 'gmb_townbb';
                btn.id = 'gmb_townbb_btn';
                btn.title = 'BBCode stad';
                btn.style.cssText = 'position:absolute;height:22px;width:21px;top:26px;left:184px;z-index:5002;cursor:pointer;background:url(https://dio-david1327.github.io/img/dio/btn/logo-grepolis.png) -23px 0 no-repeat;';
                const input = document.createElement('input');
                input.id = 'gmb_townbb_input';
                input.type = 'text';
                input.readOnly = true;
                input.style.cssText = 'display:none;position:absolute;left:23px;top:29px;width:153px;height:12px;text-align:center;z-index:6;background:#ffe2a0;';
                const clip = document.createElement('a');
                clip.id = 'gmb_townbb_clipboard';
                clip.title = 'Kopieer BBCode';
                clip.style.cssText = 'display:none;position:absolute;height:18px;width:18px;z-index:6;top:29px;left:167px;cursor:pointer;background:url(https://dio-david1327.github.io/img/dio/btn/icon-clipboard.png) no-repeat;background-size:99%;';
                area.appendChild(btn);
                area.appendChild(input);
                area.appendChild(clip);
                btn.addEventListener('click', () => {
                    clip.style.display = clip.style.display === 'none' ? 'block' : 'none';
                    input.style.display = input.style.display === 'none' ? 'block' : 'none';
                    this.updateTownbb();
                    input.select();
                });
                clip.addEventListener('click', () => {
                    input.select();
                    try { navigator.clipboard.writeText(input.value); GMB.notify('Stad-BBCode gekopieerd.', { type: 'success' }); }
                    catch (e) { document.execCommand('copy'); }
                });
                this.townbbAdded = true;
            }
            this.updateTownbb();
        },

        updateTownbb: function() {
            const input = document.getElementById('gmb_townbb_input');
            const uw = this.getUW();
            if (input && uw.Game && uw.Game.townId) input.value = `[town]${uw.Game.townId}[/town]`;
        },

        // ==================== dio_Tol: stedenlijst BBCode ====================
        refreshTownslistBB: function() {
            if (!this.tol) {
                document.querySelectorAll('.gmb_tol_bb').forEach(n => n.remove());
                const w = document.getElementById('gmb-icontools-bb-window');
                if (w) w.remove();
                return;
            }
            const names = document.querySelectorAll('#town_groups_list .content .group_name .name');
            if (!names.length) return;
            names.forEach(nameEl => {
                const header = nameEl.closest('.group_name') || nameEl.parentElement;
                if (header && !header.querySelector('.gmb_tol_bb')) {
                    const a = document.createElement('a');
                    a.className = 'gmb_tol_bb dio_town_bb';
                    a.style.cssText = 'position:absolute;top:2px;right:20px;width:30px;height:20px;cursor:pointer;';
                    a.innerHTML = '<div style="background:url(https://dio-david1327.github.io/img/dio/btn/subforum-old.png) no-repeat;height:15px;width:15px;"></div>';
                    a.title = 'Stedenlijst BBCode';
                    a.addEventListener('click', () => this.openTownslistBB(header));
                    header.style.position = header.style.position || 'relative';
                    header.appendChild(a);
                }
            });
        },

        townsInGroup: function(groupEl) {
            // Zoekt de stad-IDs in deze stadsgroep via town_group_town items in dezelfde sectie
            const section = groupEl.closest('.town_group') || groupEl.closest('.group') || groupEl.parentElement;
            const ids = [];
            if (section) {
                section.querySelectorAll('.town_group_town[name]').forEach(el => {
                    const id = parseInt(el.getAttribute('name'), 10);
                    if (id) ids.push(id);
                });
            }
            return ids;
        },

        openTownslistBB: function(headerEl) {
            const uw = this.getUW();
            const ids = this.townsInGroup(headerEl);
            const pName = (uw.Game && uw.Game.player_name) || '';
            const groupName = (headerEl.textContent || '').trim();
            const bb_ville = 'steden';
            const header = `[quote][size=9][player]${pName}[/player][/size] (${ids.length} ${bb_ville})\n[table]\n`;
            const rows = ids.map((tid, i) => {
                let points = '', sea = '';
                try {
                    const t = uw.ITowns.getTown(tid);
                    const attrs = t && t.attributes ? t.attributes : {};
                    points = attrs.points || '';
                    sea = attrs.sea_id || '';
                } catch (e) {}
                return `[*]${i + 1}.[|][town]${tid}[/town][|]${points} punten[|]Oceaan ${sea}[/*]\n`;
            }).join('');
            const bb = header + rows + '[/table][/quote]';
            this.showBBWindow(`${ids.length} ${bb_ville}${groupName ? ' — ' + groupName : ''}`, bb);
        },

        showBBWindow: function(title, bb) {
            let win = document.getElementById('gmb-icontools-bb-window');
            if (!win) {
                win = document.createElement('div');
                win.id = 'gmb-icontools-bb-window';
                win.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:560px;max-height:480px;background:#2a1f14;border:2px solid #7f653a;border-radius:6px;padding:10px;z-index:99999;color:#ecb44d;font-size:12px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
                document.body.appendChild(win);
            }
            win.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong>📋 ${title}</strong>
                    <span>
                        <button type="button" id="gmb-bb-copy" class="gmb-button" style="font-size:11px;">Kopieer</button>
                        <button type="button" id="gmb-bb-close" style="background:none;border:none;color:#ecb44d;cursor:pointer;font-size:14px;margin-left:6px;">✕</button>
                    </span>
                </div>
                <textarea id="gmb-bb-text" readonly style="width:100%;height:340px;background:#1a120a;color:#ecb44d;border:1px solid #7f653a;font-size:11px;"></textarea>`;
            win.querySelector('#gmb-bb-text').value = bb;
            win.querySelector('#gmb-bb-copy').addEventListener('click', () => {
                const ta = win.querySelector('#gmb-bb-text');
                ta.select();
                try { navigator.clipboard.writeText(ta.value); GMB.notify('BBCode gekopieerd.', { type: 'success' }); }
                catch (e) { document.execCommand('copy'); }
            });
            win.querySelector('#gmb-bb-close').addEventListener('click', () => { win.style.display = 'none'; });
            win.style.display = 'block';
        },

        injectStyles: function() {
            if (document.getElementById('gmb-icontools-style')) return;
            const st = document.createElement('style');
            st.id = 'gmb-icontools-style';
            st.textContent = `
                #town_groups_list .gmb_til_icon { float:left; margin-right:2px; }
                #town_groups_list .gmb_til_pop { position:absolute; right:6px; top:0; font-size:0.7em; display:block !important; }
                #town_groups_list .gmb_til_pop.full { color:green; } #town_groups_list .gmb_til_pop.threequarter { color:darkgoldenrod; }
                #town_groups_list .gmb_til_pop.half { color:darkred; } #town_groups_list .gmb_til_pop.quarter { color:red; }
                #town_groups_list .gmb_hero { display:inline-block !important; margin-right:2px; }
                #map_towns .own_town .flagpole, #minimap_islands_layer .m_town { cursor:pointer; }
                #gmb-icontools-popup { position:absolute; z-index:6003; max-width:230px; }
                #gmb-icontools-popup .popup { background:#2a1f14; border:2px solid #7f653a; border-radius:4px; padding:6px; color:#ecb44d; font-size:11px; }
                #gmb-icontools-popup .gmb-popup-sec { background:#ffe2a1; border:1px solid #e1af55; margin-top:2px; padding:4px; font-size:0.8em; font-weight:700; color:#4a3413; }
                #gmb-icontools-popup .gmb-popup-meta { font-size:10px; color:#d8b878; margin:1px 0; }
                #gmb-icontools-popup .gmb-popup-meta-label { color:#9fd0ff; }
                #gmb-icontools-popup .gmb-popup-tags { color:#9fd0ff; }
                #gmb-icontools-popup .gmb-popup-res-line { margin-top:3px; font-size:10px; color:#d8b878; }
                #gmb-icontools-popup .gmb-popup-title { font-weight:bold; margin-bottom:3px; padding-right:30px; }
                #gmb-icontools-popup .gmb-popup-typeicon { position:absolute; right:8px; top:6px; width:25px; height:25px; background-repeat:no-repeat; opacity:.9; filter:sepia(1); -webkit-filter:sepia(1); }
                #gmb-icontools-popup .popup { position:relative; }
                /* DIO-popup content classes (donker frame, beige secties) */
                #gmb-icontools-popup .move_counter_content, #gmb-icontools-popup .unit_content, #gmb-icontools-popup .resources_content, #gmb-icontools-popup .footer_content { background-color:#ffe2a1; border:1px solid #e1af55; margin-top:2px; padding:4px; font-family:Arial; font-weight:700; font-size:0.8em; color:#4a3413; }
                #gmb-icontools-popup .gmb-popup-res.resources_content { text-align:right; }
                #gmb-icontools-popup .resources_content table { min-width:95%; }
                #gmb-icontools-popup .footer_content table { width:100%; }
                #gmb-icontools-popup .spy_content { height:25px; margin-right:3px; }
                #gmb-icontools-popup .god_content, #gmb-icontools-popup .hero_content { width:25px; }
                #gmb-icontools-popup .god_mini { transform:scale(0.4); margin:-19px; display:inline-block; }
                #gmb-icontools-popup .count { position:absolute; bottom:-2px; right:2px; font-size:10px; font-family:Verdana,Arial,Helvetica,sans-serif; color:#fff; text-shadow:1px 1px 1px #000; }
                #gmb-icontools-popup .four_digit_number .count { font-size:8px !important; }
                #gmb-icontools-popup .unit_icon25x25 { border:1px solid #6e4b0b; margin:1px; display:inline-block; position:relative; vertical-align:middle; }
                #gmb-icontools-popup .wall { width:25px; height:25px; background-image:url(${this.getSpriteUrl()}/main/wall.png); border:1px solid #6e4b0b; margin:1px; display:inline-block; vertical-align:middle; background-size:100%; }
                #gmb-icontools-popup .support_filter { margin:0 4px 0 0; float:left; }
                #gmb-icontools-popup .spy_text { line-height:2.3em; float:left; }
                #gmb-icontools-popup .fury_icon { width:22px; height:15px; background:url(https://dio-david1327.github.io/img/dio/logo/fury.png) no-repeat; margin-left:2px; display:inline-block; vertical-align:middle; background-size:75%; }
                #gmb-icontools-popup .attack_icon { width:16px; height:16px; background:url(https://dio-david1327.github.io/img/dio/logo/attack-16px.png) no-repeat; margin:1px; display:inline-block; vertical-align:middle; background-size:100%; }
                #gmb-icontools-popup .support_icon { width:16px; height:16px; background:url(https://dio-david1327.github.io/img/dio/logo/support-16px.png) no-repeat; margin:1px; display:inline-block; vertical-align:middle; background-size:100%; }
                .gmb-icontools-mapicon{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:block;width:18px;height:18px;border-radius:50%;background:rgb(255,187,0);border:1px solid rgb(122,84,0);box-shadow:0 1px 3px rgba(0,0,0,.6);z-index:601;pointer-events:none;overflow:hidden}
                .gmb-icontools-mapicon-sprite{position:absolute;left:50%;top:50%;display:block;width:25px;height:25px;margin:0;transform:translate(-50%,-50%) scale(0.6);background-repeat:no-repeat}
                .town_name_area{position:relative;left:52% !important;z-index:11}
                #gmb-town-icon{background:url(https://dio-david1327.github.io/img/dio/logo/dio-sprite-5.png) 0 -125px no-repeat;position:absolute;width:69px;height:61px;left:-47px;top:0px;z-index:auto}
                .town_name_area .btn_prev_town{margin-left:26px !important}
                #gmb-town-icon .town_icon_bg{background:url(https://dio-david1327.github.io/img/dio/logo/dio-sprite-5.png) -76px -129px no-repeat;width:43px;height:43px;left:25px;top:4px;cursor:pointer;position:relative}
                #gmb-town-icon .town_icon_bg:hover{filter:brightness(1.1);box-shadow:0 0 15px rgb(1,197,33)}
                #gmb-town-icon .icon_big{position:absolute;left:9px;top:9px;height:25px;width:25px;background-repeat:no-repeat}
                #gmb-town-icon .select_town_icon{position:absolute;top:47px;left:23px;width:236px;display:none;padding:2px;border:3px inset rgb(7,99,12);box-shadow:rgba(0,0,0,.5) 4px 4px 6px;border-radius:0 10px 10px 10px;z-index:5003;background:url(${this.getSpriteUrl()}/popup/middle_middle.png)}
                #gmb-town-icon .item-list{max-height:none;overflow:hidden}
                #gmb-town-icon .option_s{cursor:pointer;width:20px;height:20px;margin:0;padding:2px 2px 3px 3px;border:2px solid rgba(0,0,0,0);border-radius:5px;background-origin:content-box;background-clip:content-box;background-repeat:repeat;float:left;position:relative}
                #gmb-town-icon .option_s:hover{border:2px solid rgb(59,121,81) !important;filter:brightness(1.3)}
                #gmb-town-icon .sel{border:2px solid rgb(202,176,109)}
                #gmb-town-icon hr{width:265px;margin:0 0 7px 0;position:relative;top:3px;border:0;border-top:2px dotted #000;float:left}
                #gmb-town-icon .auto_s{width:160px;height:16px;float:left;margin-right:3px;font-size:11px;color:#fff;text-shadow:1px 1px 0 #000}
                #gmb-town-icon .défaut_s{background:url(https://dio-david1327.github.io/img/dio/btn/arrows-20px.png) no-repeat;width:17px;height:17px;float:right;margin-right:3px}
                #gmb-town-icon .help_town_icon{width:20px;height:16px;float:right;margin:0 3px 0 0;font-size:11px;color:#fff;text-align:center;line-height:16px}
            `;
            document.head.appendChild(st);
        }
    };
    GMB_IconTools.gameOnly = true;

    // Register modules
    GMB.registerModule('UI', GMB_UI);
    GMB.registerModule('Settings', GMB_Settings);
    GMB_Settings.gameOnly = false;
    
    GMB_TroopManager.gameOnly = true;
    GMB_Commands.gameOnly = true;
    GMB_ForumTemplate.gameOnly = false;
    GMB_AllianceForum.gameOnly = true;
    
    GMB.registerModule('ModelManagers', GMB_ModelManagers);
    GMB.registerModule('TradeHelper', GMB_TradeHelper);
    GMB.registerModule('MapEnhancer', GMB_Map);
    GMB.registerModule('Reports', GMB_Reports);
    GMB.registerModule('GodTools', GMB_GodTools);
    GMB.registerModule('UnitTools', GMB_UnitTools);
    GMB.registerModule('IconTools', GMB_IconTools);
    GMB.registerModule('TroopManager', GMB_TroopManager);
    GMB.registerModule('Commands', GMB_Commands);
    GMB.registerModule('ForumTemplate', GMB_ForumTemplate);
    GMB_AbsenceAssistant.gameOnly = true;
    GMB.registerModule('AbsenceAssistant', GMB_AbsenceAssistant);
    GMB.registerModule('AllianceForum', GMB_AllianceForum);
    GMB_ForumLayout.gameOnly = false;
    GMB.registerModule('ForumLayout', GMB_ForumLayout);

    // Wait for Grepolis Game object to be fully instantiated
    function waitForGame(callback, maxAttempts = 60) {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const isGameReady = uw && uw.Game && (uw.Game.townId || uw.Game.player_id);

            if (isGameReady || attempts >= maxAttempts) {
                clearInterval(timer);
                if (attempts >= maxAttempts) {
                    GMB.log('Core', 'Wachten op Game object time-out bereikt, initialiseer...', 'warn');
                } else {
                    GMB.log('Core', `Game object gereed na ${attempts * 200}ms!`, 'success');
                }
                callback();
            }
        }, 200);
    }

    // Eenmalige migratie van oude instanties-sleutels (vorige scriptnaam)
    function migrateLegacyGmbStorage() {
        try {
            if (GM_getValue('gmb_storage_migrated', false)) return;
            const LP = 'ug' + 'b'; // legacy prefix — bewuste splitsing zodat de letterlijke string niet in het script staat
            if (typeof GM_listValues === 'function') {
                for (const k of GM_listValues()) {
                    if (typeof k === 'string' && k.startsWith(LP)) {
                        const nk = 'gmb' + k.slice(LP.length);
                        try { GM_setValue(nk, GM_getValue(k)); GM_deleteValue(k); } catch (e) {}
                    }
                }
            }
            const lsPrefix = LP + '_';
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith(lsPrefix)) {
                    try {
                        let inner = k.slice(lsPrefix.length);
                        if (inner.startsWith(LP)) inner = 'gmb' + inner.slice(LP.length);
                        localStorage.setItem('gmb_' + inner, localStorage.getItem(k));
                        localStorage.removeItem(k);
                    } catch (e) {}
                }
            }
            GM_setValue('gmb_storage_migrated', true);
        } catch (e) { console.warn('[GM] storage-migratie:', e); }
    }

    function init() {
        try {
            GMB.log('Core', `Grepolis Manager v${GMB.version} start initialisatie...`, 'success');

            // Detect server & game data
            GMB.detectServer();
            GMB.detectGameData();

            // Expose globally for console access and debugging
            const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            uw.GMB = GMB;
            uw.GMB_UI = GMB_UI;
            uw.GMB_API = GMB_API;
            uw.GMB_Settings = GMB_Settings;
            uw.GMB_WorldData = GMB_WorldData;
            uw.GMB_Commands = GMB_Commands;
            uw.GMB_Map = GMB_Map;
            uw.GMB_Reports = GMB_Reports;
            uw.GMB_ModelManagers = GMB_ModelManagers;
            window.GMB = GMB;
            window.GMB_UI = GMB_UI;
            window.GMB_API = GMB_API;
            window.GMB_Settings = GMB_Settings;
            window.GMB_WorldData = GMB_WorldData;
            window.GMB_Commands = GMB_Commands;
            window.GMB_Map = GMB_Map;
            window.GMB_Reports = GMB_Reports;
            window.GMB_ModelManagers = GMB_ModelManagers;

            // Initialize UI
            GMB_UI.init();

            // Default Main Tab
            GMB_UI.addTab('main', '🏠 Hoofd', `
                <div class="gmb-section">
                    <div class="gmb-section-title">📊 Server Info</div>
                    <div><strong>Server:</strong> ${GMB.worldId || 'Onbekend'} (${GMB.marketId?.toUpperCase() || ''})</div>
                    <div><strong>Speler ID:</strong> ${GMB.playerId || 'Onbekend'}</div>
                    <div><strong>Alliantie ID:</strong> ${GMB.allianceId || 'Geen'}</div>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">⚙ Algemene Instellingen</div>
                    <p class="gmb-muted">Beheer module-toggles, notificaties en rate limits in het tabblad Instellingen.</p>
                </div>
                <div class="gmb-section">
                    <div class="gmb-section-title">📦 Geladen Modules</div>
                    <div id="gmb-modules-list" style="line-height:1.6;">Laden...</div>
                </div>
            `);

            // Logs Tab
            GMB_UI.addTab('logs', '📋 Systeem Logs', `
                <div class="gmb-section">
                    <div class="gmb-section-title">📋 Systeem Logs</div>
                    <div id="gmb-logs-container" class="gmb-log-container" style="max-height: 250px;">
                        <div>Logs worden hier weergegeven...</div>
                    </div>
                    <div style="margin-top:8px;">
                        ${GMB_UI.createButton('Logs Wissen', () => {
                            const c = document.getElementById('gmb-logs-container');
                            if (c) c.innerHTML = '';
                        }, 'gmb-button-secondary')}
                    </div>
                </div>
            `);


            // Initialize all registered modules
            migrateLegacyGmbStorage();
            GMB.initModules();

            // Populate loaded modules list
            setTimeout(() => {
                const modulesList = document.getElementById('gmb-modules-list');
                if (modulesList) {
                    const moduleNames = Object.keys(GMB.modules);
                    if (moduleNames.length > 0) {
                        modulesList.innerHTML = moduleNames.map(name => `<div style="color:#69f0ae;">✓ ${name}</div>`).join('');
                    } else {
                        modulesList.innerHTML = '<div>Geen modules geladen</div>';
                    }
                }
            }, 500);

            GMB.log('Core', 'Grepolis Manager succesvol gestart!', 'success');

        } catch (e) {
            console.error('FATAL ERROR during initialization:', e);
            GMB.notify('Er is een fatale fout opgetreden bij het initialiseren van Grepolis Manager. Check de console voor details.', { type: 'error' });
        }
    }

    // Forum pages boot without waiting for the game-only global.
    GMB.ready(() => {
        if (GMB.isForumPage()) init();
        else waitForGame(init);
    });

})();

// ============================== //
// Geïntegreerde modules (eerder @require)
// ============================== //

(function() {
    'use strict';

    // Wait for GMB to be available
    function waitForGMB(callback, maxAttempts = 100) {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            if (typeof GMB !== 'undefined' && GMB.registerModule) {
                clearInterval(timer);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(timer);
                console.error('[GMB-Supabase] Timeout waiting for GMB');
            }
        }, 100);
    }

    waitForGMB(() => {
        const GMB_Supabase = {
            config: {
                url: null,
                apiKey: null,
                worldToken: null,
                allianceToken: null,
                leaderToken: null
            },
            settings: {
                autoUpload: true,
                uploadInterval: 300000,
                syncTroops: true,
                syncAttacks: true,
                syncCommands: true
            },
            uploadInterval: null,
            initialized: false,

            init: function() {
                this.loadConfig();
                this.addUITab();
                this.log('Supabase module geïnitialiseerd', 'success');
            },

            loadConfig: function() {
                this.config.url = GMB.storage.get('supabase_url', null);
                this.config.apiKey = GMB.storage.get('supabase_api_key', null);
                this.config.worldToken = GMB.storage.get('supabase_world_token', null);
                this.config.allianceToken = GMB.storage.get('supabase_alliance_token', null);
                this.config.leaderToken = GMB.storage.get('supabase_leader_token', null);
                this.settings.autoUpload = GMB.storage.get('supabase_auto_upload', true);
                this.settings.uploadInterval = GMB.storage.get('supabase_upload_interval', 300000);
                this.settings.syncTroops = GMB.storage.get('supabase_sync_troops', true);
                this.settings.syncAttacks = GMB.storage.get('supabase_sync_attacks', true);
                this.settings.syncCommands = GMB.storage.get('supabase_sync_commands', true);
            },

            saveConfig: function() {
                GMB.storage.set('supabase_url', this.config.url);
                GMB.storage.set('supabase_api_key', this.config.apiKey);
                GMB.storage.set('supabase_world_token', this.config.worldToken);
                GMB.storage.set('supabase_alliance_token', this.config.allianceToken);
                GMB.storage.set('supabase_leader_token', this.config.leaderToken);
                GMB.storage.set('supabase_auto_upload', this.settings.autoUpload);
                GMB.storage.set('supabase_upload_interval', this.settings.uploadInterval);
                GMB.storage.set('supabase_sync_troops', this.settings.syncTroops);
                GMB.storage.set('supabase_sync_attacks', this.settings.syncAttacks);
                GMB.storage.set('supabase_sync_commands', this.settings.syncCommands);
            },

            isConfigured: function() {
                return !!(this.config.url && this.config.apiKey);
            },

            hasWorldToken: function() {
                return !!this.config.worldToken;
            },

            hasAllianceToken: function() {
                return !!this.config.allianceToken;
            },

            hasLeaderToken: function() {
                return !!this.config.leaderToken;
            },

            request: function(method, path, data = null) {
                if (!this.isConfigured()) {
                    this.log('Supabase niet geconfigureerd', 'error');
                    return Promise.reject(new Error('Supabase niet geconfigureerd'));
                }

                const url = `${this.config.url}/rest/v1${path}`;
                const headers = {
                    'apikey': this.config.apiKey,
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                };

                this.log(`Request: ${method} ${url}`, 'info');
                if (data) {
                    this.log(`Data: ${JSON.stringify(data)}`, 'info');
                }

                return GMB_API.externalRequest(method, url, {
                    headers,
                    data: data ? JSON.stringify(data) : null
                }).then(response => {
                    this.log(`Response success`, 'success');
                    return response;
                }).catch(error => {
                    this.log(`Request failed: ${error.message}`, 'error');
                    throw error;
                });
            },

            get: function(path) {
                return this.request('GET', path);
            },

            post: function(path, data) {
                return this.request('POST', path, data);
            },

            patch: function(path, data) {
                return this.request('PATCH', path, data);
            },

            delete: function(path) {
                return this.request('DELETE', path);
            },

            registerWorld: function(worldId, worldName, worldToken) {
                return this.post('/werelden', {
                    world_id: worldId,
                    world_name: worldName,
                    world_token: worldToken,
                    alliance_id: GMB.allianceId,
                    alliance_name: GMB.storage.get('alliance_name', '')
                });
            },

            registerAlliance: function(allianceId, allianceName, allianceToken) {
                return this.post('/allianties', {
                    world_id: GMB.worldId,
                    alliance_id: allianceId,
                    alliance_name: allianceName,
                    alliance_token: allianceToken
                });
            },

            registerLeader: function(playerId, playerName, leaderToken, isAdmin = false) {
                return this.post('/leiders', {
                    world_id: GMB.worldId,
                    alliance_id: GMB.allianceId,
                    player_id: playerId,
                    player_name: playerName,
                    leader_token: leaderToken,
                    is_admin: isAdmin
                });
            },

            uploadTroops: function(troopData) {
                if (!this.settings.syncTroops) return Promise.resolve();
                return this.post('/troepen', {
                    world: GMB.worldId,
                    alliance_id: GMB.allianceId,
                    player: GMB.playerId,
                    player_name: GMB.storage.get('player_name', ''),
                    ...troopData
                });
            },

            getTroops: function(playerId = null) {
                let path = `/troepen?world=eq.${GMB.worldId}`;
                if (playerId) {
                    path += `&player=eq.${playerId}`;
                }
                path += '&select=*';
                return this.get(path);
            },

            uploadAttack: function(attackData) {
                if (!this.settings.syncAttacks) return Promise.resolve();
                return this.post('/inkomende_aanvallen', {
                    world_id: GMB.worldId,
                    alliance_id: GMB.allianceId,
                    ...attackData
                });
            },

            getAttacks: function(activeOnly = true) {
                let path = `/inkomende_aanvallen?world_id=eq.${GMB.worldId}`;
                if (activeOnly) {
                    path += '&is_active=eq.true';
                }
                path += '&select=*&order=arrival_time.asc';
                return this.get(path);
            },

            banPlayer: function(playerId, playerName, reason) {
                if (!this.hasLeaderToken()) {
                    return Promise.reject(new Error('Geen leider token'));
                }
                return this.post('/ban_lijst', {
                    world_id: GMB.worldId,
                    player_id: playerId,
                    player_name: playerName,
                    ban_reason: reason,
                    banned_by: GMB.storage.get('player_name', '')
                });
            },

            unbanPlayer: function(playerId) {
                if (!this.hasLeaderToken()) {
                    return Promise.reject(new Error('Geen leider token'));
                }
                return this.patch(`/ban_lijst?player_id=eq.${playerId}&world_id=eq.${GMB.worldId}`, {
                    is_active: false
                });
            },

            getBanList: function() {
                return this.get(`/ban_lijst?world_id=eq.${GMB.worldId}&is_active=eq.true`);
            },

            isPlayerBanned: async function(playerId) {
                try {
                    const result = await this.get(`/ban_lijst?player_id=eq.${playerId}&world_id=eq.${GMB.worldId}&is_active=eq.true`);
                    return result && result.length > 0;
                } catch (e) {
                    console.error('Fout bij controleren ban status:', e);
                    return false;
                }
            },

            getLeaders: function() {
                return this.get(`/leiders?world_id=eq.${GMB.worldId}&is_active=eq.true`);
            },

            startAutoUpload: function() {
                if (this.uploadInterval) {
                    clearInterval(this.uploadInterval);
                }
                if (!this.settings.autoUpload) return;

                this.uploadInterval = setInterval(() => {
                    this.performAutoUpload();
                }, this.settings.uploadInterval);
            },

            stopAutoUpload: function() {
                if (this.uploadInterval) {
                    clearInterval(this.uploadInterval);
                    this.uploadInterval = null;
                }
            },

            performAutoUpload: async function() {
                if (!this.isConfigured()) return;

                try {
                    if (this.settings.syncTroops && GMB.modules.TroopManager) {
                        const troopData = await GMB.modules.TroopManager.getAllTroops();
                        if (troopData) {
                            await this.uploadTroops(troopData);
                        }
                    }

                    if (this.settings.syncAttacks && GMB.modules.Commands) {
                        const attacks = await GMB.modules.Commands.getIncomingAttacks();
                        if (attacks && attacks.length > 0) {
                            for (const attack of attacks) {
                                await this.uploadAttack(attack);
                            }
                        }
                    }

                    this.log('Auto-upload voltooid', 'success');
                } catch (e) {
                    this.log(`Auto-upload fout: ${e.message}`, 'error');
                }
            },

            addUITab: function() {
                GMB_UI.addTab('supabase', '☁️ Supabase', `
                    <div class="gmb-section">
                        <div class="gmb-section-title">🔧 Supabase Configuratie</div>
                        <div id="gmb-supabase-config">
                            ${this.renderConfigUI()}
                        </div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">👑 Leidersfuncties</div>
                        <div id="gmb-supabase-leaders">
                            ${this.renderLeadersUI()}
                        </div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">🚫 Ban Lijst</div>
                        <div id="gmb-supabase-bans">
                            ${this.renderBanUI()}
                        </div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">📊 Sync Status</div>
                        <div id="gmb-supabase-status">
                            ${this.renderStatusUI()}
                        </div>
                    </div>
                `);
            },

            renderConfigUI: function() {
                return `
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px; font-weight:bold;">Supabase URL:</label>
                        <input type="text" id="gmb-supabase-url" value="${this.config.url || ''}"
                            placeholder="https://xyz.supabase.co" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px; font-weight:bold;">API Key:</label>
                        <input type="password" id="gmb-supabase-key" value="${this.config.apiKey || ''}"
                            placeholder="public-anon-key" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px; font-weight:bold;">Wereld Token (${GMB.worldId}):</label>
                        <input type="text" id="gmb-supabase-world-token" value="${this.config.worldToken || ''}"
                            placeholder="Token voor wereldtoegang" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px; font-weight:bold;">Alliantie Token:</label>
                        <input type="text" id="gmb-supabase-alliance-token" value="${this.config.allianceToken || ''}"
                            placeholder="Token voor alliantietoegang" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px; font-weight:bold;">Leiders Token:</label>
                        <input type="text" id="gmb-supabase-leader-token" value="${this.config.leaderToken || ''}"
                            placeholder="Token voor leidersfuncties" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">
                            <input type="checkbox" id="gmb-supabase-auto-upload" ${this.settings.autoUpload ? 'checked' : ''} />
                            Auto-upload inschakelen
                        </label>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">Upload interval (ms):</label>
                        <input type="number" id="gmb-supabase-upload-interval" value="${this.settings.uploadInterval}"
                            min="60000" step="60000" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">
                            <input type="checkbox" id="gmb-supabase-sync-troops" ${this.settings.syncTroops ? 'checked' : ''} />
                            Troepen synchroniseren
                        </label>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">
                            <input type="checkbox" id="gmb-supabase-sync-attacks" ${this.settings.syncAttacks ? 'checked' : ''} />
                            Aanvallen synchroniseren
                        </label>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">
                            <input type="checkbox" id="gmb-supabase-sync-commands" ${this.settings.syncCommands ? 'checked' : ''} />
                            Commando's synchroniseren
                        </label>
                    </div>
                    <div style="margin-top:12px; padding-top:12px; border-top:1px solid #333;">
                        <strong style="display:block; margin-bottom:8px;">Export / Import Configuratie:</strong>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            ${GMB_UI.createButton('Export (Leider)', () => this.exportConfig(true), 'gmb-button-secondary')}
                            ${GMB_UI.createButton('Export (Lid)', () => this.exportConfig(false), 'gmb-button-secondary')}
                            ${GMB_UI.createButton('Import Configuratie', () => this.importConfig(), 'gmb-button-secondary')}
                        </div>
                        <div id="gmb-supabase-import-result" style="margin-top:8px;"></div>
                    </div>
                    <div style="margin-top:12px;">
                        ${GMB_UI.createButton('Opslaan', () => this.saveConfigFromUI(), 'gmb-button-primary')}
                        ${GMB_UI.createButton('Test Verbinding', () => this.testConnection(), 'gmb-button-secondary')}
                    </div>
                    <div id="gmb-supabase-test-result" style="margin-top:12px;"></div>
                `;
            },

            renderLeadersUI: function() {
                if (!this.hasLeaderToken()) {
                    return '<p class="gmb-muted">Leidersfuncties vereisen een geldig leider token.</p>';
                }
                return `
                    <div style="margin-bottom:12px;">
                        ${GMB_UI.createButton('Laders Laden', () => this.loadLeaders(), 'gmb-button-secondary')}
                    </div>
                    <div id="gmb-supabase-leaders-list" style="max-height:200px; overflow-y:auto;">
                        <p class="gmb-muted">Klik op "Laders Laden" om de lijst te tonen.</p>
                    </div>
                `;
            },

            renderBanUI: function() {
                if (!this.hasLeaderToken()) {
                    return '<p class="gmb-muted">Ban functies vereisen een geldig leider token.</p>';
                }
                return `
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">Speler ID:</label>
                        <input type="number" id="gmb-ban-player-id" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">Speler Naam:</label>
                        <input type="text" id="gmb-ban-player-name" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; margin-bottom:4px;">Reden:</label>
                        <input type="text" id="gmb-ban-reason" style="width:100%; padding:6px; box-sizing:border-box;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        ${GMB_UI.createButton('Speler Banen', () => this.banPlayerFromUI(), 'gmb-button-danger')}
                        ${GMB_UI.createButton('Ban Lijst Laden', () => this.loadBanList(), 'gmb-button-secondary')}
                    </div>
                    <div id="gmb-supabase-ban-list" style="max-height:200px; overflow-y:auto; margin-top:12px;">
                        <p class="gmb-muted">Klik op "Ban Lijst Laden" om de lijst te tonen.</p>
                    </div>
                `;
            },

            renderStatusUI: function() {
                const status = this.isConfigured() ? '✅ Geconfigureerd' : '❌ Niet geconfigureerd';
                const worldStatus = this.hasWorldToken() ? '✅ Wereld token' : '❌ Geen wereld token';
                const allianceStatus = this.hasAllianceToken() ? '✅ Alliantie token' : '❌ Geen alliantie token';
                const leaderStatus = this.hasLeaderToken() ? '✅ Leider token' : '❌ Geen leider token';
                const uploadStatus = this.settings.autoUpload ? '✅ Auto-upload actief' : '❌ Auto-upload uit';

                return `
                    <div style="line-height:1.8;">
                        <div>${status}</div>
                        <div>${worldStatus}</div>
                        <div>${allianceStatus}</div>
                        <div>${leaderStatus}</div>
                        <div>${uploadStatus}</div>
                    </div>
                `;
            },

            saveConfigFromUI: async function() {
                this.config.url = document.getElementById('gmb-supabase-url').value.trim();
                this.config.apiKey = document.getElementById('gmb-supabase-key').value.trim();
                this.config.worldToken = document.getElementById('gmb-supabase-world-token').value.trim();
                this.config.allianceToken = document.getElementById('gmb-supabase-alliance-token').value.trim();
                this.config.leaderToken = document.getElementById('gmb-supabase-leader-token').value.trim();
                this.settings.autoUpload = document.getElementById('gmb-supabase-auto-upload').checked;
                this.settings.uploadInterval = parseInt(document.getElementById('gmb-supabase-upload-interval').value) || 300000;
                this.settings.syncTroops = document.getElementById('gmb-supabase-sync-troops').checked;
                this.settings.syncAttacks = document.getElementById('gmb-supabase-sync-attacks').checked;
                this.settings.syncCommands = document.getElementById('gmb-supabase-sync-commands').checked;

                this.saveConfig();
                this.stopAutoUpload();
                if (this.settings.autoUpload) {
                    this.startAutoUpload();
                }

                if (this.isConfigured()) {
                    await this.autoRegisterInSupabase();
                }

                document.getElementById('gmb-supabase-config').innerHTML = this.renderConfigUI();
                document.getElementById('gmb-supabase-status').innerHTML = this.renderStatusUI();

                GMB.notify('Supabase configuratie opgeslagen', { type: 'success' });
            },

            autoRegisterInSupabase: async function() {
                try {
                    if (this.config.worldToken && GMB.worldId) {
                        const worldData = {
                            world_id: GMB.worldId,
                            world_name: GMB.marketId?.toUpperCase() + ' ' + GMB.worldId || GMB.worldId,
                            world_token: this.config.worldToken,
                            alliance_id: GMB.allianceId || null,
                            alliance_name: GMB.storage.get('alliance_name', '') || null
                        };

                        const existingWorld = await this.get(`/werelden?world_id=eq.${GMB.worldId}`);
                        if (!existingWorld || existingWorld.length === 0) {
                            await this.post('/werelden', worldData);
                            this.log('Wereld geregistreerd in Supabase', 'success');
                        }
                    }

                    if (this.config.allianceToken && GMB.worldId && GMB.allianceId) {
                        const allianceData = {
                            world_id: GMB.worldId,
                            alliance_id: GMB.allianceId,
                            alliance_name: GMB.storage.get('alliance_name', '') || '',
                            alliance_token: this.config.allianceToken
                        };

                        const existingAlliance = await this.get(`/allianties?world_id=eq.${GMB.worldId}&alliance_id=eq.${GMB.allianceId}`);
                        if (!existingAlliance || existingAlliance.length === 0) {
                            await this.post('/allianties', allianceData);
                            this.log('Alliantie geregistreerd in Supabase', 'success');
                        }
                    }

                    if (this.config.leaderToken && GMB.worldId && GMB.playerId) {
                        const leaderData = {
                            world_id: GMB.worldId,
                            alliance_id: GMB.allianceId || null,
                            player_id: GMB.playerId,
                            player_name: GMB.storage.get('player_name', '') || '',
                            leader_token: this.config.leaderToken,
                            is_admin: true
                        };

                        const existingLeader = await this.get(`/leiders?world_id=eq.${GMB.worldId}&player_id=eq.${GMB.playerId}`);
                        if (!existingLeader || existingLeader.length === 0) {
                            await this.post('/leiders', leaderData);
                            this.log('Leider geregistreerd in Supabase', 'success');
                        }
                    }
                } catch (e) {
                    this.log(`Auto-registratie fout: ${e.message}`, 'error');
                }
            },

            testConnection: async function() {
                const resultDiv = document.getElementById('gmb-supabase-test-result');
                resultDiv.innerHTML = '<p>Testen...</p>';

                try {
                    const result = await this.get('/werelden?limit=1');
                    resultDiv.innerHTML = '<p style="color:#69f0ae;">✅ Verbinding succesvol!</p>';
                    GMB.notify('Supabase verbinding getest', { type: 'success' });
                } catch (e) {
                    resultDiv.innerHTML = `<p style="color:#ff5252;">❌ Verbinding mislukt: ${e.message}</p>`;
                    GMB.notify('Supabase verbinding mislukt', { type: 'error' });
                }
            },

            loadLeaders: async function() {
                const listDiv = document.getElementById('gmb-supabase-leaders-list');
                listDiv.innerHTML = '<p>Laden...</p>';

                try {
                    const leaders = await this.getLeaders();
                    if (leaders && leaders.length > 0) {
                        listDiv.innerHTML = leaders.map(l => `
                            <div style="padding:8px; border-bottom:1px solid #333;">
                                <strong>${l.player_name}</strong> (ID: ${l.player_id})
                                ${l.is_admin ? ' <span style="color:#ff5252;">[ADMIN]</span>' : ''}
                            </div>
                        `).join('');
                    } else {
                        listDiv.innerHTML = '<p class="gmb-muted">Geen leiders gevonden.</p>';
                    }
                } catch (e) {
                    listDiv.innerHTML = `<p style="color:#ff5252;">Fout bij laden: ${e.message}</p>`;
                }
            },

            banPlayerFromUI: async function() {
                const playerId = parseInt(document.getElementById('gmb-ban-player-id').value);
                const playerName = document.getElementById('gmb-ban-player-name').value.trim();
                const reason = document.getElementById('gmb-ban-reason').value.trim();

                if (!playerId || !playerName) {
                    alert('Vul speler ID en naam in');
                    return;
                }

                try {
                    await this.banPlayer(playerId, playerName, reason);
                    GMB.notify(`${playerName} is gebanned`, { type: 'success' });
                    this.loadBanList();
                } catch (e) {
                    GMB.notify(`Ban mislukt: ${e.message}`, { type: 'error' });
                }
            },

            loadBanList: async function() {
                const listDiv = document.getElementById('gmb-supabase-ban-list');
                listDiv.innerHTML = '<p>Laden...</p>';

                try {
                    const bans = await this.getBanList();
                    if (bans && bans.length > 0) {
                        listDiv.innerHTML = bans.map(b => `
                            <div style="padding:8px; border-bottom:1px solid #333;">
                                <strong>${b.player_name}</strong> (ID: ${b.player_id})
                                <br><small>Reden: ${b.ban_reason || 'Geen'}</small>
                                <br><small>Gebanned door: ${b.banned_by}</small>
                                <br>${GMB_UI.createButton('Unban', () => this.unbanPlayerFromUI(b.player_id), 'gmb-button-small')}
                            </div>
                        `).join('');
                    } else {
                        listDiv.innerHTML = '<p class="gmb-muted">Geen gebande spelers.</p>';
                    }
                } catch (e) {
                    listDiv.innerHTML = `<p style="color:#ff5252;">Fout bij laden: ${e.message}</p>`;
                }
            },

            unbanPlayerFromUI: async function(playerId) {
                try {
                    await this.unbanPlayer(playerId);
                    GMB.notify('Speler unbanned', { type: 'success' });
                    this.loadBanList();
                } catch (e) {
                    GMB.notify(`Unban mislukt: ${e.message}`, { type: 'error' });
                }
            },

            exportConfig: function(includeLeaderToken = true) {
                const config = {
                    url: this.config.url,
                    apiKey: this.config.apiKey,
                    worldToken: this.config.worldToken,
                    allianceToken: this.config.allianceToken,
                    leaderToken: includeLeaderToken ? this.config.leaderToken : null,
                    settings: this.settings
                };

                const jsonString = JSON.stringify(config, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const suffix = includeLeaderToken ? 'leider' : 'lid';
                a.download = `gmb-supabase-config-${GMB.worldId || 'unknown'}-${suffix}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                GMB.notify(`Configuratie geëxporteerd (${suffix})`, { type: 'success' });
            },

            importConfig: function() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        const text = await file.text();
                        const config = JSON.parse(text);

                        if (!config.url || !config.apiKey) {
                            throw new Error('Ongeldig configuratiebestand: URL en API key vereist');
                        }

                        this.config.url = config.url;
                        this.config.apiKey = config.apiKey;
                        this.config.worldToken = config.worldToken || null;
                        this.config.allianceToken = config.allianceToken || null;
                        this.config.leaderToken = config.leaderToken || null;

                        if (config.settings) {
                            this.settings.autoUpload = config.settings.autoUpload !== undefined ? config.settings.autoUpload : true;
                            this.settings.uploadInterval = config.settings.uploadInterval || 300000;
                            this.settings.syncTroops = config.settings.syncTroops !== undefined ? config.settings.syncTroops : true;
                            this.settings.syncAttacks = config.settings.syncAttacks !== undefined ? config.settings.syncAttacks : true;
                            this.settings.syncCommands = config.settings.syncCommands !== undefined ? config.settings.syncCommands : true;
                        }

                        this.saveConfig();
                        this.stopAutoUpload();
                        if (this.settings.autoUpload) {
                            this.startAutoUpload();
                        }

                        if (this.isConfigured()) {
                            await this.autoRegisterInSupabase();
                        }

                        document.getElementById('gmb-supabase-config').innerHTML = this.renderConfigUI();
                        document.getElementById('gmb-supabase-status').innerHTML = this.renderStatusUI();

                        const resultDiv = document.getElementById('gmb-supabase-import-result');
                        resultDiv.innerHTML = '<p style="color:#69f0ae;">✅ Configuratie geïmporteerd!</p>';

                        GMB.notify('Configuratie geïmporteerd', { type: 'success' });
                    } catch (e) {
                        const resultDiv = document.getElementById('gmb-supabase-import-result');
                        resultDiv.innerHTML = `<p style="color:#ff5252;">❌ Import mislukt: ${e.message}</p>`;
                        GMB.notify(`Import mislukt: ${e.message}`, { type: 'error' });
                    }
                };
                input.click();
            },

            log: function(message, type = 'info') {
                GMB.log('Supabase', message, type);
            }
        };

        // Register the module
        GMB.registerModule('Supabase', GMB_Supabase);
        GMB_Supabase.gameOnly = false;

        // Expose globally
        if (typeof unsafeWindow !== 'undefined') {
            unsafeWindow.GMB_Supabase = GMB_Supabase;
        }
        window.GMB_Supabase = GMB_Supabase;

        // Initialize immediately since @require loads after GMB.initModules()
        if (typeof GMB_Supabase.init === 'function') {
            try {
                GMB_Supabase.init();
                GMB_Supabase.initialized = true;
            } catch (e) {
                console.error('[GMB-Supabase] Init failed:', e);
            }
        }

        console.log('[GMB-Supabase] Module loaded');
    });
})();

(function() {
    'use strict';

    function waitForGMB(callback, maxAttempts = 100) {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            if (typeof GMB !== 'undefined' && GMB.registerModule) {
                clearInterval(timer);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(timer);
                console.error('[GMB-ForumDeleteMultiple] Timeout waiting for GMB');
            }
        }, 100);
    }

    waitForGMB(() => {
        const GMB_ForumDeleteMultiple = {
            observer: null,
            init: function() {
                if (!GMB.isModuleEnabled('ForumDeleteMultiple')) return;
                this.updateControl();
                if (!this.observer && document.body && typeof MutationObserver === 'function') {
                    this.observer = new MutationObserver(() => this.updateControl());
                    this.observer.observe(document.body, { childList: true, subtree: true });
                }
            },

            onEnable: function() {
                this.init();
            },

            stop: function() {
                if (this.observer) this.observer.disconnect();
                this.observer = null;
                document.querySelectorAll('.gmb-forum-select-all').forEach(control => control.remove());
            },

            updateControl: function() {
                if (!GMB.isModuleEnabled('ForumDeleteMultiple')) return;
                const forum = document.querySelector('#forum');
                if (!forum) return;
                const posts = forum.querySelectorAll('.post_functions');
                if (posts.length < 2) {
                    forum.querySelectorAll('.gmb-forum-select-all').forEach(control => control.remove());
                    return;
                }
                let control = forum.querySelector('.gmb-forum-select-all');
                if (!control) {
                    const footer = forum.querySelector('div.forum_footer') || forum.querySelector('div.game_list_footer');
                    if (!footer) return;
                    control = document.createElement('label');
                    control.className = 'gmb-forum-select-all';
                    control.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin:4px 8px;cursor:pointer;color:#423515;font-size:11px;';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.addEventListener('change', () => {
                        const currentForum = document.querySelector('#forum');
                        if (!currentForum) return;
                        currentForum.querySelectorAll('input[type="checkbox"]').forEach(item => {
                            item.checked = checkbox.checked;
                        });
                    });
                    const text = document.createElement('span');
                    text.textContent = 'Alles selecteren';
                    control.append(checkbox, text);
                    footer.appendChild(control);
                }
            }
        };

        GMB.registerModule('ForumDeleteMultiple', GMB_ForumDeleteMultiple);
        GMB_ForumDeleteMultiple.gameOnly = false;

        if (typeof unsafeWindow !== 'undefined') {
            unsafeWindow.GMB_ForumDeleteMultiple = GMB_ForumDeleteMultiple;
        }
        window.GMB_ForumDeleteMultiple = GMB_ForumDeleteMultiple;

        if (typeof GMB_ForumDeleteMultiple.init === 'function') {
            try {
                GMB_ForumDeleteMultiple.init();
            } catch (e) {
                console.error('[GMB-ForumDeleteMultiple] Init failed:', e);
            }
        }

        console.log('[GMB-ForumDeleteMultiple] Module loaded');
    });
})();


// ============================================================
// FARM ALERT MODULE (read-only boerendorp-monitor)
// ============================================================

﻿// Farm Alert — read-only scan van eigen steden/eilanden naar boerendorpen.
// Toont welke dorpen lootable zijn (via FarmTownPlayerRelation.lootable_at) en alarmteert.
//_executeert geen acties in het spel._
(function() {
    'use strict';

    function waitForGMB(callback, maxAttempts = 100) {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            if (typeof GMB !== 'undefined' && GMB.registerModule) {
                clearInterval(timer);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(timer);
                console.error('[FarmAlert] Timeout waiting for GMB');
            }
        }, 100);
    }

    waitForGMB(() => {
        const GMB_FarmAlert = {
            enabled: false,
            timer: null,
            scanning: false,
            scanIslands: null,
            islandCache: {},
            relationMapCache: new Map(),
            relationMapTimestamp: 0,
            lastAlarmReadyCount: 0,
            alarmAudioContext: null,
            alarmInterval: null,
            DEFAULT_INTERVAL_SECONDS: 120,

            init: function() {
                this.enabled = GMB.storage.get('farmalert_enabled', false);
                this.islandCache = GMB.storage.get(this.scopedKey('farmalert_island_cache'), {});
                GMB.log('FarmAlert', 'Module initialized', 'success');
                setTimeout(() => {
                    this.addUITab();
                    this.initAlarm();
                    this.updateAlarm();
                    if (this.enabled) this.start();
                }, 600);
            },

            scopedKey: function(name) {
                const uw = GMB_API.getUW();
                const world = GMB.worldId || (uw.Game && uw.Game.world_id) || 'unknown';
                const player = (uw.Game && uw.Game.player_id) || 0;
                return `${name}@${world}:${player}`;
            },

            addUITab: function() {
                if (document.getElementById('gmb-tab-farmalert')) return;
                const interval = parseInt(GMB.storage.get('farmalert_interval', this.DEFAULT_INTERVAL_SECONDS), 10) || this.DEFAULT_INTERVAL_SECONDS;

                GMB_UI.addTab('farmalert', '🌾 Farm Alert', `
                    <div class="gmb-section">
                        <div class="gmb-section-title">🌾 Farm Alert Status</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:600;">Status:</span>
                            <span id="farmalert-status-badge" class="gmb-badge ${this.enabled ? 'gmb-badge-success' : 'gmb-badge-idle'}">
                                ${this.enabled ? 'ACTIEF' : 'INACTIEF'}
                            </span>
                        </div>
                        ${GMB_UI.createToggle('Farm Alert Inschakelen', 'farmalert_enabled', false, enabled => this.setEnabled(enabled))}
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding:6px 10px; background:rgba(0,0,0,0.25); border-radius:5px;">
                            <span>Volgende scan over:</span>
                            <span id="farmalert-countdown" style="font-size:16px; font-weight:bold; color:#ff6b81; font-family:monospace;">--:--</span>
                        </div>
                        <div style="margin-top:10px;">
                            ${GMB_UI.createButton('🔍 Nu scannen', () => this.scan(), 'gmb-button', 'width:100%;')}
                        </div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">⚙ Instellingen</div>
                        <label style="display:block; margin-bottom:2px; font-weight:600; font-size:11px;">Scan-interval (seconden):</label>
                        <input type="number" class="gmb-input" id="farmalert-interval" value="${interval}" min="30" max="3600" step="10">
                        <div style="margin-top:8px;">
                            ${GMB_UI.createToggle('Alarmbalk bij klaarstaande dorpen', 'farmalert_alarm_enabled', GMB.storage.get('farmalert_alarm_enabled', true), enabled => this.setAlarmEnabled(enabled))}
                            ${GMB_UI.createToggle('Geluid bij nieuw klaar dorp', 'farmalert_alarm_sound', GMB.storage.get('farmalert_alarm_sound', false), enabled => this.setAlarmSound(enabled))}
                            ${GMB_UI.createToggle('Desktopmelding bij nieuw klaar dorp', 'farmalert_notify_desktop', GMB.storage.get('farmalert_notify_desktop', true))}
                        </div>
                        <div class="gmb-muted">Scan is read-only: er worden geen acties in het spel uitgevoerd.</div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">⭐ Boerendorp-overzicht</div>
                        <div id="farmalert-village-summary" class="gmb-muted">Nog geen scan uitgevoerd.</div>
                        <div id="farmalert-village-levels" style="max-height: 180px; overflow-y: auto; margin-top:6px;"></div>
                    </div>
                    <div class="gmb-section">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div class="gmb-section-title" style="margin:0;">📋 Activiteit Log</div>
                            ${GMB_UI.createButton('Wissen', () => this.clearLog(), 'gmb-button gmb-button-secondary', 'font-size:10px; padding:2px 6px;')}
                        </div>
                        <div id="farmalert-log" class="gmb-log-container">
                            <div>Wachten op start...</div>
                        </div>
                    </div>
                `);

                setTimeout(() => {
                    const intervalInput = document.getElementById('farmalert-interval');
                    if (intervalInput) intervalInput.addEventListener('change', () => {
                        GMB.storage.set('farmalert_interval', Math.min(3600, Math.max(30, parseInt(intervalInput.value, 10) || this.DEFAULT_INTERVAL_SECONDS)));
                        if (this.enabled) this.scheduleNextScan();
                    });
                }, 100);
            },

            setEnabled: function(enabled) {
                this.enabled = !!enabled;
                GMB.storage.set('farmalert_enabled', this.enabled);
                const badge = document.getElementById('farmalert-status-badge');
                if (badge) {
                    badge.className = `gmb-badge ${this.enabled ? 'gmb-badge-success' : 'gmb-badge-idle'}`;
                    badge.textContent = this.enabled ? 'ACTIEF' : 'INACTIEF';
                }
                if (this.enabled) this.start(); else this.stop();
            },

            start: function() {
                if (this.timer || !GMB.isModuleEnabled('FarmAlert')) return;
                GMB.log('FarmAlert', 'Farm Alert started', 'success');
                this.scan();
            },

            stop: function() {
                if (this.timer) { clearTimeout(this.timer); this.timer = null; }
                this.updateCountdown();
                GMB.log('FarmAlert', 'Farm Alert stopped', 'info');
            },

            scheduleNextScan: function() {
                if (!this.enabled || this.timer) return;
                const seconds = Math.min(3600, Math.max(30, parseInt(GMB.storage.get('farmalert_interval', this.DEFAULT_INTERVAL_SECONDS), 10) || this.DEFAULT_INTERVAL_SECONDS));
                this.nextRunTime = Date.now() + seconds * 1000;
                this.timer = setTimeout(() => {
                    this.timer = null;
                    this.scan();
                }, seconds * 1000);
                this.updateCountdown();
            },

            updateCountdown: function() {
                const el = document.getElementById('farmalert-countdown');
                if (!el) return;
                if (!this.enabled || !this.nextRunTime) { el.textContent = '--:--'; return; }
                const diff = Math.max(0, Math.ceil((this.nextRunTime - Date.now()) / 1000));
                const m = Math.floor(diff / 60), s = diff % 60;
                el.textContent = `${m}:${String(s).padStart(2, '0')}`;
                if (diff <= 0) el.textContent = 'nu...';
            },

            scan: async function() {
                if (this.scanning) return;
                this.scanning = true;
                try {
                    this.scanRequestCount = 0;
                    const towns = this.getAllTowns();
                    if (!towns.length) {
                        this.logActivity('Geen eigen steden gevonden.', 'warn');
                        return;
                    }
                    this.logActivity(`Scan gestart: ${towns.length} steden`, 'info');
                    this.scanIslands = {};
                    let totalVillages = 0;
                    for (const town of towns) {
                        const islandId = await this.getIslandId(town.id);
                        if (!islandId) continue;
                        const villages = await this.getFarmVillages(town.id, islandId);
                        totalVillages += villages.length;
                    }
                    this.scanIslands = null;
                    this.relationMapTimestamp = 0; // frissen voor ready-check
                    const state = this.getAlarmState();
                    this.logActivity(`Scan klaar: ${totalVillages} dorpen gevonden, ${state.ready} klaar`, state.ready ? 'success' : 'info');
                    this.renderVillageSummary();
                    if (state.ready > 0 && this.lastAlarmReadyCount === 0) {
                        const msg = `${state.ready} boerendorp${state.ready === 1 ? ' is' : 'en zijn'} klaar voor loot.`;
                        GMB.notify(msg, { type: 'success', title: 'Farm Alert' });
                        this.playAlarmSound();
                    }
                    this.lastAlarmReadyCount = state.ready;
                    this.updateAlarm();
                    GMB.storage.set(this.scopedKey('farmalert_island_cache'), this.islandCache);
                } catch (error) {
                    this.logActivity(`Scan mislukt: ${error.message}`, 'error');
                    GMB.log('FarmAlert', `Scan mislukt: ${error.message}`, 'error');
                } finally {
                    this.scanning = false;
                    this.scheduleNextScan();
                }
            },

            // ---------- Data ----------
            getAllTowns: function() {
                const uw = GMB_API.getUW();
                const towns = [];
                if (uw && uw.ITowns && typeof uw.ITowns.getTowns === 'function') {
                    Object.values(uw.ITowns.getTowns()).forEach(t => {
                        if (t && t.id) towns.push({ id: parseInt(t.id, 10), name: t.name || `Stad ${t.id}` });
                    });
                }
                if (towns.length === 0 && uw && uw.MM && typeof uw.MM.getModels === 'function') {
                    const townModels = uw.MM.getModels().Town;
                    if (townModels) Object.values(townModels).forEach(t => {
                        if (t && t.id) towns.push({ id: parseInt(t.id, 10), name: (t.get ? t.get('name') : t.attributes && t.attributes.name) || `Stad ${t.id}` });
                    });
                }
                if (towns.length === 0 && uw && uw.Game && uw.Game.townId) {
                    towns.push({ id: parseInt(uw.Game.townId, 10), name: uw.Game.town_name || `Stad ${uw.Game.townId}` });
                }
                return towns;
            },

            isRateLimitError: function(error) {
                return !!error && (Number(error.status) === 429 || /\b429\b|too many requests/i.test(String(error.message || '')));
            },

            getWithRetry: async function(controller, action, params, townId, label) {
                const maxAttempts = 3;
                for (let attempt = 1; ; attempt++) {
                    try {
                        return await GMB_API.get(controller, action, params, townId);
                    } catch (error) {
                        if (!this.isRateLimitError(error) || attempt >= maxAttempts) throw error;
                        const backoff = 5000 * Math.pow(2, attempt - 1);
                        const waitMs = Math.max(backoff, (Number(error.retryAfter) || 0) * 1000);
                        this.logActivity(`Rate limit (HTTP 429) bij ${label || controller}; wacht ${Math.round(waitMs / 1000)}s`, 'warn');
                        await new Promise(r => setTimeout(r, waitMs));
                    }
                }
            },

            sleep: function(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },

            getIslandId: async function(townId) {
                if (this.islandCache[townId] && this.islandCache[townId].islandId) {
                    return this.islandCache[townId].islandId;
                }
                const uw = GMB_API.getUW();
                if (uw && uw.ITowns && typeof uw.ITowns.getTown === 'function') {
                    try {
                        const town = uw.ITowns.getTown(townId);
                        const raw = town && (town.island_id || (town.attributes && town.attributes.island_id) ||
                            (typeof town.get === 'function' && town.get('island_id')) ||
                            (typeof town.getIslandId === 'function' && town.getIslandId()));
                        const id = Number(raw);
                        if (Number.isInteger(id) && id > 0) return id;
                    } catch (error) { /* fallback */ }
                }
                try {
                    const townModels = uw && uw.MM && typeof uw.MM.getModels === 'function' ? uw.MM.getModels().Town : null;
                    const model = townModels && (townModels[townId] || townModels[String(townId)]);
                    if (model) {
                        const raw = typeof model.get === 'function' ? model.get('island_id') : model.attributes && model.attributes.island_id;
                        const id = Number(raw);
                        if (Number.isInteger(id) && id > 0) return id;
                    }
                } catch (error) { /* geen island_id in MM model */ }
                try {
                    const resp = await this.getWithRetry('town_info', 'info', {
                        id: townId,
                        json: JSON.stringify({ id: townId, town_id: townId })
                    }, townId, `town_info stad ${townId}`);
                    const htmlCandidates = [
                        resp && resp.plain && resp.plain.html,
                        resp && resp.json && resp.json.plain && resp.json.plain.html,
                        resp && resp.json && resp.json.json && resp.json.json.plain && resp.json.json.plain.html,
                        resp && resp.json && resp.json.html,
                        resp && resp.json && resp.json.json && resp.json.json.html,
                        typeof resp === 'string' ? resp : null
                    ];
                    for (const html of htmlCandidates) {
                        const islandId = this.parseIslandIdFromHtml(html);
                        if (islandId) return islandId;
                    }
                } catch (e) {
                    GMB.log('FarmAlert', `Eiland-ID voor stad ${townId} niet gevonden: ${e.message}`, 'warn');
                }
                return null;
            },

            parseIslandIdFromHtml: function(html) {
                if (typeof html !== 'string' || !html) return null;
                const validId = value => {
                    const id = Number(value);
                    return Number.isInteger(id) && id > 0 ? id : null;
                };
                const anchorPattern = /<a\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bgp_island_link\b[^"']*["'])[^>]*>/gi;
                let anchorMatch;
                while ((anchorMatch = anchorPattern.exec(html))) {
                    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(anchorMatch[0]);
                    if (hrefMatch && hrefMatch[1].charAt(0) === '#') {
                        try {
                            const encoded = hrefMatch[1].slice(1).replace(/-/g, '+').replace(/_/g, '/');
                            const decoded = JSON.parse(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)));
                            const id = validId(decoded && decoded.id);
                            if (id) return id;
                        } catch (error) { /* decode failed */ }
                    }
                }
                const patterns = [
                    /["']?island_id["']?\s*[:=]\s*["']?(\d+)/i,
                    /data-island_id\s*=\s*["'](\d+)["']/i,
                    /\bgp_island_link\b[^>]*>\s*(\d+)\s*</i
                ];
                for (const pattern of patterns) {
                    const match = pattern.exec(html);
                    const id = match && validId(match[1]);
                    if (id) return id;
                }
                return null;
            },

            fetchIslandFarmTowns: async function(townId, islandId) {
                const resp = await this.getWithRetry('island_info', 'index', {
                    json: JSON.stringify({ island_id: parseInt(islandId, 10), town_id: parseInt(townId, 10) })
                }, townId, `island_info eiland ${islandId}`);
                let list = null;
                if (resp && resp.json && resp.json.json && resp.json.json.farm_town_list) list = resp.json.json.farm_town_list;
                else if (resp && resp.json && resp.json.farm_town_list) list = resp.json.farm_town_list;
                else if (resp && resp.farm_town_list) list = resp.farm_town_list;
                if (!Array.isArray(list)) throw new Error('Response bevat geen farm_town_list');
                return list.filter(ft => ft && this.isFarmVillageUnlocked(ft))
                    .map(ft => parseInt(ft.id, 10))
                    .filter(id => Number.isFinite(id) && id > 0);
            },

            getFarmVillages: async function(townId, islandId) {
                const islandKey = parseInt(islandId, 10);
                this.scanIslands = this.scanIslands || {};
                let pending = this.scanIslands[islandKey];
                if (!pending) {
                    pending = this.fetchIslandFarmTowns(townId, islandKey);
                    this.scanIslands[islandKey] = pending;
                    pending.catch(() => { if (this.scanIslands && this.scanIslands[islandKey] === pending) delete this.scanIslands[islandKey]; });
                }
                const villages = await pending;
                this.islandCache[townId] = { islandId: islandKey, farmTowns: villages.slice() };
                return villages;
            },

            isFarmVillageUnlocked: function(village) {
                if (!village || typeof village !== 'object') return false;
                if (village.unlocked === true || village.is_unlocked === true) return true;
                const relation = Number(village.rel ?? village.relation_status ?? village.relation);
                return Number.isFinite(relation) && relation >= 1;
            },

            getFarmTownRelationModel: function(farmTownId) {
                if (Date.now() - this.relationMapTimestamp > 1000) {
                    const nextMap = new Map();
                    try {
                        const uw = GMB_API.getUW();
                        const collections = uw && uw.MM && typeof uw.MM.getCollections === 'function' ? uw.MM.getCollections() : null;
                        const relations = collections && collections.FarmTownPlayerRelation;
                        const relationCollections = !relations ? [] : Array.isArray(relations) ? relations : relations.models ? [relations] : Object.values(relations);
                        const addModel = model => {
                            const id = model && typeof model.get === 'function' ? model.get('farm_town_id') : model && model.attributes && model.attributes.farm_town_id;
                            if (id !== undefined && id !== null) nextMap.set(String(id), model);
                        };
                        relationCollections.forEach(collection => {
                            if (collection && Array.isArray(collection.models)) collection.models.forEach(addModel);
                            else if (collection && (typeof collection.get === 'function' || collection.attributes)) addModel(collection);
                        });
                    } catch (error) {
                        GMB.log('FarmAlert', `Farmrelaties konden niet worden gelezen: ${error.message}`, 'warn');
                    }
                    this.relationMapCache = nextMap;
                    this.relationMapTimestamp = Date.now();
                }
                return this.relationMapCache.get(String(farmTownId)) || null;
            },

            getFarmTownLootableAt: function(farmTownId) {
                const model = this.getFarmTownRelationModel(farmTownId);
                if (model) {
                    const value = typeof model.get === 'function' ? model.get('lootable_at') : model.attributes && model.attributes.lootable_at;
                    const timestamp = Number(value);
                    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
                }
                return 0;
            },

            getVillageLevel: function(farmTownId) {
                const model = this.getFarmTownRelationModel(farmTownId);
                if (!model) return null;
                const raw = typeof model.get === 'function' ? model.get('expansion_stage') : model.attributes && model.attributes.expansion_stage;
                const level = Number(raw);
                return Number.isInteger(level) && level >= 1 && level <= 6 ? level : null;
            },

            getOwnTownIdSet: function() {
                return new Set(this.getAllTowns().map(town => String(town.id)));
            },

            getVillageTownMap: function() {
                const own = this.getOwnTownIdSet();
                const map = new Map();
                Object.entries(this.islandCache).forEach(([townId, entry]) => {
                    if (!own.has(String(townId)) || !entry || !Array.isArray(entry.farmTowns)) return;
                    entry.farmTowns.forEach(id => { if (!map.has(String(id))) map.set(String(id), Number(townId)); });
                });
                return map;
            },

            // ---------- Alarm ----------
            getAlarmState: function() {
                const villageIds = new Set(this.getVillageTownMap().keys());
                let ready = 0, earliest = 0;
                villageIds.forEach(id => {
                    const readyAt = this.getFarmTownLootableAt(id);
                    if (!readyAt || readyAt <= Date.now()) ready++;
                    else if (!earliest || readyAt < earliest) earliest = readyAt;
                });
                return { total: villageIds.size, ready, earliest };
            },

            updateAlarm: function() {
                const alarm = document.getElementById('gmb-farm-alarm');
                if (!alarm) return;
                const enabled = GMB.storage.get('farmalert_alarm_enabled', true);
                alarm.classList.toggle('visible', enabled);
                if (!enabled) { this.lastAlarmReadyCount = 0; return; }
                const { ready, earliest } = this.getAlarmState();
                alarm.classList.toggle('ready', ready > 0);
                if (ready > 0) {
                    alarm.textContent = `🌾 ${ready} dorp${ready === 1 ? '' : 'en'} klaar`;
                    alarm.title = `${ready} boerendorp${ready === 1 ? '' : 'en'} kan worden geclaimd`;
                } else if (earliest) {
                    const seconds = Math.ceil((earliest - Date.now()) / 1000);
                    alarm.textContent = `🌾 Klaar over ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
                    alarm.title = 'Vroegste volgende boerendorp-cooldown';
                } else {
                    alarm.textContent = '🌾 Nog geen dorpen gescand';
                    alarm.title = 'Voer een scan uit';
                }
            },

            initAlarm: function() {
                if (document.getElementById('gmb-farm-alarm')) return;
                const alarm = document.createElement('div');
                alarm.id = 'gmb-farm-alarm';
                alarm.className = 'gmb-farm-alarm';
                alarm.style.cssText = 'top:5px;left:474px;right:auto;bottom:auto;';
                alarm.textContent = '🌾 Farm Alert';
                alarm.title = 'Klik om paneel te openen';
                alarm.addEventListener('click', () => {
                    const main = window.GrepoMain;
                    if (main && typeof main.openGmbPanel === 'function') main.openGmbPanel();
                });
                document.body.appendChild(alarm);
                this.alarmInterval = setInterval(() => this.updateAlarm(), 1000);
            },

            setAlarmEnabled: function(enabled) { this.updateAlarm(); },
            setAlarmSound: function(enabled) {},

            playAlarmSound: function() {
                if (!GMB.storage.get('farmalert_alarm_sound', false)) return;
                try {
                    if (!this.alarmAudioContext) this.alarmAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (this.alarmAudioContext.state === 'suspended') this.alarmAudioContext.resume();
                    const ctx = this.alarmAudioContext;
                    [0, 0.25].forEach(offset => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain); gain.connect(ctx.destination);
                        osc.frequency.value = 880;
                        osc.type = 'sine';
                        gain.gain.setValueAtTime(0.15, ctx.currentTime + offset);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
                        osc.start(ctx.currentTime + offset);
                        osc.stop(ctx.currentTime + offset + 0.3);
                    });
                } catch (e) { /* audio niet beschikbaar */ }
            },

            // ---------- UI ----------
            renderVillageSummary: function() {
                const summaryEl = document.getElementById('farmalert-village-summary');
                const container = document.getElementById('farmalert-village-levels');
                if (!summaryEl || !container) return;
                const villageMap = this.getVillageTownMap();
                const villages = [...villageMap.keys()].filter(id => /^\d+$/.test(id));
                if (!villages.length) {
                    summaryEl.textContent = 'Geen dorpen bekend. Voer een scan uit.';
                    container.innerHTML = '';
                    return;
                }
                const state = this.getAlarmState();
                summaryEl.textContent = `${villages.length} dorpen gevonden · ${state.ready} klaar · ${villages.length - state.ready} op cooldown`;
                const counts = {};
                const readyIds = [];
                villages.forEach(id => {
                    const readyAt = this.getFarmTownLootableAt(id);
                    const isReady = !readyAt || readyAt <= Date.now();
                    if (isReady) readyIds.push(id);
                    const level = this.getVillageLevel(id);
                    const key = level === null ? '?' : `Lv${level}`;
                    counts[key] = (counts[key] || 0) + 1;
                });
                container.innerHTML = `<div class="gmb-muted" style="margin-bottom:4px;">Levels: ${Object.entries(counts).map(([k, v]) => `${v}× ${k}`).join(', ')}</div>` +
                    (readyIds.length
                        ? `<div style="color:#81c784;">Klaar (${readyIds.length}): ${readyIds.slice(0, 30).join(', ')}${readyIds.length > 30 ? '…' : ''}</div>`
                        : '<div class="gmb-muted">Geen dorpen momenteel klaar.</div>');
            },

            logActivity: function(message, type = 'info') {
                const logEl = document.getElementById('farmalert-log');
                if (logEl) {
                    const timestamp = new Date().toLocaleTimeString();
                    const div = document.createElement('div');
                    div.className = `gmb-log-entry gmb-log-${type}`;
                    div.textContent = `[${timestamp}] ${message}`;
                    logEl.appendChild(div);
                    while (logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
                    logEl.scrollTop = logEl.scrollHeight;
                }
                GMB.log('FarmAlert', message, type);
            },

            clearLog: function() {
                const logEl = document.getElementById('farmalert-log');
                if (logEl) logEl.innerHTML = '<div>Log gewist.</div>';
            },

            onEnable: function() { this.addUITab(); if (this.enabled) this.start(); },
            onDisable: function() { this.stop(); }
        };

        GMB_FarmAlert.gameOnly = true;
        GMB.registerModule('FarmAlert', GMB_FarmAlert);

        if (typeof unsafeWindow !== 'undefined') unsafeWindow.GMB_FarmAlert = GMB_FarmAlert;
        window.GMB_FarmAlert = GMB_FarmAlert;

        if (typeof GMB_FarmAlert.init === 'function') {
            try { GMB_FarmAlert.init(); GMB_FarmAlert.initialized = true; }
            catch (e) { console.error('[FarmAlert] Init failed:', e); }
        }

        console.log('[FarmAlert] Module loaded');
    });
})();
// ============================================================
// GOLD ALERT MODULE (read-only grondstof-monitor)
// ============================================================

﻿// Gold Alert — passieve monitor: toont per stad welke grondstof-overschotten
// theoretically verkocht kunnen worden (voorraad + vrije transportcapaciteit).
// Voert zelf geen handel uit; alleen lezen + melden.
(function() {
    'use strict';

    const RESOURCES = [
        { key: 'wood', label: 'Hout', icon: '🪵' },
        { key: 'stone', label: 'Steen', icon: '🪨' },
        { key: 'iron', label: 'Zilver', icon: '⚙️' }
    ];

    function waitForGMB(callback, maxAttempts = 100) {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            if (typeof GMB !== 'undefined' && GMB.registerModule) {
                clearInterval(timer);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(timer);
                console.error('[GoldAlert] Timeout waiting for GMB');
            }
        }, 100);
    }

    waitForGMB(() => {
        const GMB_GoldAlert = {
            enabled: false,
            timer: null,
            scanning: false,
            lastAlertSignature: '',
            lastAlertRows: [],
            DEFAULT_INTERVAL_SECONDS: 60,

            init: function() {
                this.enabled = GMB.storage.get('goldalert_enabled', false);
                GMB.log('GoldAlert', 'Module initialized', 'success');
                setTimeout(() => {
                    this.addUITab();
                    this.initGoldAlarm();
                    this.updateGoldAlarm();
                    if (this.enabled) this.start();
                }, 600);
            },

            addUITab: function() {
                if (document.getElementById('gmb-tab-goldalert')) return;
                const interval = parseInt(GMB.storage.get('goldalert_interval', this.DEFAULT_INTERVAL_SECONDS), 10) || this.DEFAULT_INTERVAL_SECONDS;
                const thr = r => GMB.storage.get(`goldalert_threshold_${r}`, 10000);
                const minCap = GMB.storage.get('goldalert_min_capacity', 1);

                GMB_UI.addTab('goldalert', '💰 Gold Alert', `
                    <div class="gmb-section">
                        <div class="gmb-section-title">💰 Gold Alert Status</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:600;">Status:</span>
                            <span id="goldalert-status-badge" class="gmb-badge ${this.enabled ? 'gmb-badge-success' : 'gmb-badge-idle'}">
                                ${this.enabled ? 'ACTIEF' : 'INACTIEF'}
                            </span>
                        </div>
                        ${GMB_UI.createToggle('Gold Alert Inschakelen', 'goldalert_enabled', false, enabled => this.setEnabled(enabled))}
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding:6px 10px; background:rgba(0,0,0,0.25); border-radius:5px;">
                            <span>Volgende scan over:</span>
                            <span id="goldalert-countdown" style="font-size:16px; font-weight:bold; color:#ffb74d; font-family:monospace;">--:--</span>
                        </div>
                        <div style="margin-top:10px;">
                            ${GMB_UI.createButton('🔍 Nu scannen', () => this.scan(), 'gmb-button', 'width:100%;')}
                        </div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">⚙ Alert-drempels</div>
                        <label style="display:block; margin-bottom:2px; font-weight:600; font-size:11px;">Scan-interval (seconden):</label>
                        <input type="number" class="gmb-input" id="goldalert-interval" value="${interval}" min="15" max="3600" step="5">
                        ${RESOURCES.map(r => `
                            <label style="display:block; margin:6px 0 2px; font-weight:600; font-size:11px;">${r.icon} Min. ${r.label} voor alert:</label>
                            <input type="number" class="gmb-input" id="goldalert-threshold-${r.key}" value="${thr(r.key)}" min="0" step="1000">
                        `).join('')}
                        <label style="display:block; margin:6px 0 2px; font-weight:600; font-size:11px;">Min. vrije transportcapaciteit:</label>
                        <input type="number" class="gmb-input" id="goldalert-min-capacity" value="${minCap}" min="0" step="100">
                        <div style="margin-top:8px;">
                            ${GMB_UI.createToggle('Desktopmelding bij nieuwe alert', 'goldalert_notify_desktop', GMB.storage.get('goldalert_notify_desktop', true))}
                        </div>
                        <div class="gmb-muted">Toont marktvraag en actuele goudoffertes. Er wordt nooit automatisch verkocht.</div>
                    </div>
                    <div class="gmb-section">
                        <div class="gmb-section-title">📊 Stad-overzicht</div>
                        <div id="goldalert-summary" class="gmb-muted">Nog geen scan uitgevoerd.</div>
                        <div id="goldalert-table" style="max-height: 220px; overflow-y: auto; margin-top:6px;"></div>
                    </div>
                    <div class="gmb-section">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div class="gmb-section-title" style="margin:0;">📋 Activiteit Log</div>
                            ${GMB_UI.createButton('Wissen', () => this.clearLog(), 'gmb-button gmb-button-secondary', 'font-size:10px; padding:2px 6px;')}
                        </div>
                        <div id="goldalert-log" class="gmb-log-container">
                            <div>Wachten op start...</div>
                        </div>
                    </div>
                `);

                setTimeout(() => {
                    const bind = (id, fn) => {
                        const el = document.getElementById(id);
                        if (el) el.addEventListener('change', fn);
                    };
                    bind('goldalert-interval', e => {
                        GMB.storage.set('goldalert_interval', Math.min(3600, Math.max(15, parseInt(e.target.value, 10) || this.DEFAULT_INTERVAL_SECONDS)));
                        if (this.enabled) this.scheduleNextScan();
                    });
                    RESOURCES.forEach(r => bind(`goldalert-threshold-${r.key}`, e => {
                        GMB.storage.set(`goldalert_threshold_${r.key}`, Math.max(0, parseInt(e.target.value, 10) || 0));
                    }));
                    bind('goldalert-min-capacity', e => {
                        GMB.storage.set('goldalert_min_capacity', Math.max(0, parseInt(e.target.value, 10) || 0));
                    });
                }, 100);
            },

            setEnabled: function(enabled) {
                this.enabled = !!enabled;
                GMB.storage.set('goldalert_enabled', this.enabled);
                this.updateGoldAlarm();
                const badge = document.getElementById('goldalert-status-badge');
                if (badge) {
                    badge.className = `gmb-badge ${this.enabled ? 'gmb-badge-success' : 'gmb-badge-idle'}`;
                    badge.textContent = this.enabled ? 'ACTIEF' : 'INACTIEF';
                }
                if (this.enabled) this.start(); else this.stop();
            },

            start: function() {
                if (this.timer || !GMB.isModuleEnabled('GoldAlert')) return;
                GMB.log('GoldAlert', 'Gold Alert started', 'success');
                this.scan();
            },

            stop: function() {
                if (this.timer) { clearTimeout(this.timer); this.timer = null; }
                this.updateCountdown();
                GMB.log('GoldAlert', 'Gold Alert stopped', 'info');
            },

            scheduleNextScan: function() {
                if (!this.enabled || this.timer) return;
                const seconds = Math.min(3600, Math.max(15, parseInt(GMB.storage.get('goldalert_interval', this.DEFAULT_INTERVAL_SECONDS), 10) || this.DEFAULT_INTERVAL_SECONDS));
                this.nextRunTime = Date.now() + seconds * 1000;
                this.timer = setTimeout(() => {
                    this.timer = null;
                    this.scan();
                }, seconds * 1000);
                this.updateCountdown();
            },

            updateCountdown: function() {
                const el = document.getElementById('goldalert-countdown');
                if (!el) return;
                if (!this.enabled || !this.nextRunTime) { el.textContent = '--:--'; return; }
                const diff = Math.max(0, Math.ceil((this.nextRunTime - Date.now()) / 1000));
                const m = Math.floor(diff / 60), s = diff % 60;
                el.textContent = `${m}:${String(s).padStart(2, '0')}`;
            },

            // ---------- Data (alleen lezen, geen API-calls) ----------
            getAllTowns: function() {
                const uw = GMB_API.getUW();
                const towns = [];
                if (uw && uw.ITowns && typeof uw.ITowns.getTowns === 'function') {
                    Object.values(uw.ITowns.getTowns()).forEach(t => {
                        if (t && t.id) towns.push({ id: parseInt(t.id, 10), name: t.name || `Stad ${t.id}` });
                    });
                }
                if (towns.length === 0 && uw && uw.MM && typeof uw.MM.getModels === 'function') {
                    const townModels = uw.MM.getModels().Town;
                    if (townModels) Object.values(townModels).forEach(t => {
                        if (t && t.id) towns.push({ id: parseInt(t.id, 10), name: (t.get ? t.get('name') : t.attributes && t.attributes.name) || `Stad ${t.id}` });
                    });
                }
                if (towns.length === 0 && uw && uw.Game && uw.Game.townId) {
                    towns.push({ id: parseInt(uw.Game.townId, 10), name: uw.Game.town_name || `Stad ${uw.Game.townId}` });
                }
                return towns;
            },

            getTownResources: function(townId) {
                const uw = GMB_API.getUW();
                let town = null;
                if (uw && uw.ITowns && typeof uw.ITowns.getTown === 'function') {
                    try { town = uw.ITowns.getTown(townId); } catch (e) { town = null; }
                }
                if (!town && uw && uw.ITowns && typeof uw.ITowns.getTowns === 'function') {
                    const collection = uw.ITowns.getTowns() || {};
                    town = collection[townId] || collection[String(townId)] || null;
                }
                const resources = town && typeof town.resources === 'function'
                    ? town.resources()
                    : town && town.attributes && town.attributes.resources;
                if (!resources || typeof resources !== 'object') return null;
                const out = {};
                RESOURCES.forEach(r => {
                    const amount = Number(resources[r.key]);
                    out[r.key] = Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : 0;
                });
                return out;
            },

            getFreeTradeCapacity: function(townId) {
                const uw = GMB_API.getUW();
                let town = null;
                if (uw && uw.ITowns && typeof uw.ITowns.getTown === 'function') {
                    try { town = uw.ITowns.getTown(townId); } catch (e) { town = null; }
                }
                if (!town && uw && uw.ITowns && typeof uw.ITowns.getTowns === 'function') {
                    const collection = uw.ITowns.getTowns() || {};
                    town = collection[townId] || collection[String(townId)] || null;
                }
                if (town && typeof town.getAvailableTradeCapacity === 'function') {
                    const capacity = Number(town.getAvailableTradeCapacity());
                    return Number.isFinite(capacity) && capacity >= 0 ? Math.floor(capacity) : null;
                }
                const attributes = town && town.attributes;
                const capacity = attributes && Number(attributes.available_trade_capacity);
                return Number.isFinite(capacity) && capacity >= 0 ? Math.floor(capacity) : null;
            },

            getMarketData: async function(townId) {
                const payload = {
                    model_url: 'PremiumExchange',
                    action_name: 'read',
                    town_id: parseInt(townId, 10),
                    nl_init: GMB_API.nlInit()
                };
                const response = await GMB_API.get('frontend_bridge', 'execute', { json: JSON.stringify(payload) }, townId);
                const data = response && response.json ? response.json : response;
                if (data && data.error) throw new Error(data.error);
                if (!data || typeof data !== 'object') return null;
                const out = {};
                RESOURCES.forEach(r => {
                    const market = data[r.key];
                    if (market && Number.isFinite(Number(market.capacity)) && Number.isFinite(Number(market.stock))) {
                        out[r.key] = {
                            capacity: Number(market.capacity),
                            stock: Number(market.stock),
                            demand: Math.max(0, Number(market.capacity) - Number(market.stock))
                        };
                    }
                });
                return out;
            },

            getResponseData: function(response) {
                return response && response.json ? response.json : response;
            },

            // Alleen een-offerte opvragen (geen confirmOffer => er wordt nooit verkocht)
            requestGoldOffer: async function(townId, resource, amount) {
                const postPayload = {
                    model_url: 'PremiumExchange',
                    action_name: 'requestOffer',
                    arguments: {
                        type: 'sell',
                        gold: 100,
                        [resource]: Math.floor(amount),
                        town_id: parseInt(townId, 10)
                    }
                };
                const response = await GMB_API.post('frontend_bridge', 'execute', postPayload, townId, 'GoldAlert');
                const data = this.getResponseData(response);
                if (data && data.error) return null;
                const offer = data && data.offer;
                if (!offer) return null;
                const gold = Number(offer.gold);
                const offerAmount = Number(offer.resource_amount);
                if (!Number.isFinite(gold) || gold <= 0 || !Number.isFinite(offerAmount) || offerAmount <= 0) return null;
                return { gold: Math.floor(gold), amount: Math.floor(offerAmount) };
            },

            getTownGold: function(townId) {
                const uw = GMB_API.getUW();
                let town = null;
                if (uw && uw.ITowns && typeof uw.ITowns.getTown === 'function') {
                    try { town = uw.ITowns.getTown(townId); } catch (e) { town = null; }
                }
                if (!town && uw && uw.ITowns && typeof uw.ITowns.getTowns === 'function') {
                    const collection = uw.ITowns.getTowns() || {};
                    town = collection[townId] || collection[String(townId)] || null;
                }
                if (!town) return null;
                if (typeof town.getGold === 'function') {
                    const gold = Number(town.getGold());
                    if (Number.isFinite(gold)) return Math.floor(gold);
                }
                const candidates = [
                    town.attributes && town.attributes.gold,
                    typeof town.resources === 'function' ? town.resources().gold : null,
                    town.gold
                ];
                for (const value of candidates) {
                    const gold = Number(value);
                    if (Number.isFinite(gold) && gold >= 0) return Math.floor(gold);
                }
                return null;
            },

            scan: async function() {
                if (this.scanning) return;
                this.scanning = true;
                try {
                    const towns = this.getAllTowns();
                    if (!towns.length) {
                        this.logActivity('Geen eigen steden gevonden.', 'warn');
                        return;
                    }
                    const minCapacity = Math.max(0, parseInt(GMB.storage.get('goldalert_min_capacity', 1), 10) || 0);
                    const rows = [];
                    const alerts = [];
                    for (const town of towns) {
                        const resources = this.getTownResources(town.id);
                        const capacity = this.getFreeTradeCapacity(town.id);
                        if (!resources || capacity === null) continue;
                        let market = null;
                        try { market = await this.getMarketData(town.id); } catch (e) { market = null; }
                        const sellable = {};
                        const demand = {};
                        const offers = {};
                        RESOURCES.forEach(r => {
                            const threshold = Math.max(0, parseInt(GMB.storage.get(`goldalert_threshold_${r.key}`, 10000), 10) || 0);
                            const marketDemand = market && market[r.key] ? market[r.key].demand : resources[r.key];
                            demand[r.key] = marketDemand;
                            const amount = Math.min(resources[r.key], marketDemand, capacity);
                            sellable[r.key] = resources[r.key] >= threshold && capacity >= minCapacity ? amount : 0;
                            if (sellable[r.key] > 0) alerts.push(`${town.name}: ${r.icon} ${r.label} ${resources[r.key].toLocaleString('nl-NL')}`);
                        });
                        for (const r of RESOURCES) {
                            if (sellable[r.key] <= 0) continue;
                            try {
                                offers[r.key] = await this.requestGoldOffer(town.id, r.key, sellable[r.key]);
                            } catch (e) { offers[r.key] = null; }
                        }
                        rows.push({ town, resources, capacity, sellable, demand, market, offers });
                    }
                    this.renderTable(rows);
                    const signature = alerts.slice().sort().join('|');
                    if (alerts.length && signature !== this.lastAlertSignature) {
                        GMB.notify(`${alerts.length} verkoopkans${alerts.length === 1 ? '' : 'en'} gedetecteerd.`, { type: 'success', title: 'Gold Alert' });
                        rows.forEach(row => {
                            const parts = RESOURCES.filter(r => row.sellable[r.key] > 0)
                                .map(r => {
                                    const offer = row.offers && row.offers[r.key];
                                    const goldText = offer ? ` → ≈${offer.gold.toLocaleString('nl-NL')} goud` : '';
                                    return `${r.label} ${row.resources[r.key].toLocaleString('nl-NL')} (marktvraag ${Number(row.demand[r.key] || 0).toLocaleString('nl-NL')}, verkoopbaar ${row.sellable[r.key].toLocaleString('nl-NL')}${goldText})`;
                                });
                            if (!parts.length) return;
                            const totalGold = RESOURCES.reduce((sum, r) => sum + (row.offers && row.offers[r.key] ? row.offers[r.key].gold : 0), 0);
                            const gold = this.getTownGold(row.town.id);
                            const goldText = gold === null ? '' : ` · Goudbalans ${gold.toLocaleString('nl-NL')}`;
                            const totalText = totalGold > 0 ? ` · Totaal ≈${totalGold.toLocaleString('nl-NL')} goud` : '';
                            GMB.log('GoldAlert', `💰 ${row.town.name} — ${parts.join(' · ')} · Cap. ${row.capacity.toLocaleString('nl-NL')}${totalText}${goldText}`, 'success');
                        });
                        if (GMB.storage.get('goldalert_notify_desktop', true) && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            try { new Notification('Gold Alert', { body: alerts.slice(0, 3).join('\n') + (alerts.length > 3 ? `\n…en ${alerts.length - 3} meer` : '') }); } catch (e) {}
                        }
                    }
                    this.lastAlertSignature = signature;
                    this.alertTownNames = [...new Set(alerts.map(a => String(a).split(':')[0].trim()).filter(Boolean))];
                    this.lastAlertRows = rows
                        .filter(row => RESOURCES.some(r => row.offers && row.offers[r.key]))
                        .sort((a, b) => this.rowTotalGold(b) - this.rowTotalGold(a));
                    this.updateGoldAlarm();
                    this.logActivity(`Scan klaar: ${rows.length} steden, ${alerts.length} kansen`, alerts.length ? 'success' : 'info');
                } catch (error) {
                    this.logActivity(`Scan mislukt: ${error.message}`, 'error');
                    GMB.log('GoldAlert', `Scan mislukt: ${error.message}`, 'error');
                } finally {
                    this.scanning = false;
                    this.scheduleNextScan();
                }
            },

            renderTable: function(rows) {
                const summaryEl = document.getElementById('goldalert-summary');
                const tableEl = document.getElementById('goldalert-table');
                if (!summaryEl || !tableEl) return;
                const alertCount = rows.reduce((n, row) => n + RESOURCES.filter(r => row.sellable[r.key] > 0).length, 0);
                summaryEl.textContent = `${rows.length} steden gelezen · ${alertCount} drempel-overschrijdingen`;
                if (!rows.length) { tableEl.innerHTML = ''; return; }
                const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                tableEl.innerHTML = `<table class="gmb-table" style="width:100%; font-size:11px;">
                    <thead><tr><th>Stad</th><th>Capaciteit</th>${RESOURCES.map(r => `<th>${r.icon} ${r.label}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(row => `<tr>
                        <td>${esc(row.town.name)}</td>
                        <td>${row.capacity.toLocaleString('nl-NL')}</td>
                        ${RESOURCES.map(r => {
                            const alert = row.sellable[r.key] > 0;
                            const demand = row.demand && row.demand[r.key] !== undefined ? row.demand[r.key] : row.resources[r.key];
                            const offer = row.offers && row.offers[r.key];
                            const tip = `Marktvraag: ${Number(demand).toLocaleString('nl-NL')}${offer ? ` · ≈${offer.gold.toLocaleString('nl-NL')} goud` : ''}`;
                            return `<td style="${alert ? 'color:#ffd54f;font-weight:700;' : ''}" title="${tip}">${row.resources[r.key].toLocaleString('nl-NL')}${alert ? ` <small>(~${row.sellable[r.key].toLocaleString('nl-NL')}${offer ? ` →${offer.gold}` : ''})</small>` : ''}</td>`;
                        }).join('')}
                    </tr>`).join('')}</tbody></table>`;
            },

            rowTotalGold: function(row) {
                return RESOURCES.reduce((sum, r) => sum + (row.offers && row.offers[r.key] ? row.offers[r.key].gold : 0), 0);
            },

            // ---------- Paneel linksonder ----------
            initGoldAlarm: function() {
                if (document.getElementById('gmb-gold-alarm')) return;
                const alarm = document.createElement('div');
                alarm.id = 'gmb-gold-alarm';
                alarm.style.cssText = 'position:fixed;left:8px;bottom:8px;top:auto;right:auto;z-index:99996;display:none;width:310px;max-height:190px;background:rgba(22,24,36,0.95);border:1px solid #f9a825;border-radius:6px;color:#fff;font-size:11px;cursor:pointer;overflow:hidden;';
                alarm.innerHTML = '<div style="padding:6px 10px;font-weight:700;color:#ffd54f;border-bottom:1px solid #f9a825;">💰 Gold Alert</div><div id="gmb-gold-alarm-list" style="max-height:105px;overflow-y:auto;padding:2px 4px;"></div>';
                alarm.title = 'Klik om paneel te openen';
                alarm.addEventListener('click', () => {
                    const main = window.GrepoMain;
                    if (main && typeof main.openGmbPanel === 'function') main.openGmbPanel();
                });
                const list = alarm.querySelector('#gmb-gold-alarm-list');
                if (list) list.addEventListener('click', e => {
                    const el = e.target.closest('[data-gold-town]');
                    if (!el) return;
                    e.stopPropagation();
                    this.goToGoldExchange(Number(el.dataset.goldTown));
                });
                document.body.appendChild(alarm);
            },

            switchToTown: function(townId) {
                const uw = GMB_API.getUW();
                const current = uw && uw.Game ? parseInt(uw.Game.townId, 10) : null;
                if (current === townId) return Promise.resolve(true);
                return new Promise((resolve) => {
                    let done = false;
                    const finish = ok => { if (!done) { done = true; cleanup(); resolve(ok); } };
                    const cleanup = () => {
                        clearTimeout(timer);
                        try {
                            const ge = uw && uw.GameEvents && uw.GameEvents.town && uw.GameEvents.town.town_switch;
                            const obs = uw && uw.$ && uw.$.Observer;
                            if (ge && obs) obs(ge).unsubscribe('gmb_goldalert_switch');
                        } catch (e) {}
                    };
                    const timer = setTimeout(() => finish(false), 8000);
                    try {
                        const ge = uw && uw.GameEvents && uw.GameEvents.town && uw.GameEvents.town.town_switch;
                        const obs = uw && uw.$ && uw.$.Observer;
                        if (ge && obs) obs(ge).subscribe('gmb_goldalert_switch', () => finish(true));
                    } catch (e) {}
                    const li = document.querySelector(`#fto_town_list li.town${townId}`);
                    if (!li) { finish(false); return; }
                    const target = li.querySelector('a') || li;
                    target.click();
                });
            },

            goToGoldExchange: async function(townId) {
                try {
                    const uw = GMB_API.getUW();
                    const ok = await this.switchToTown(townId);
                    if (!ok) {
                        GMB.log('GoldAlert', `Stad ${townId} niet gevonden in stedentabel of wisselen mislukt.`, 'warn');
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 600));
                    const factory = uw && uw.TownOverviewWindowFactory;
                    if (factory && typeof factory.openTradeOverview === 'function') {
                        factory.openTradeOverview();
                        await new Promise(resolve => setTimeout(resolve, 800));
                        this.openGoldTab();
                    }
                } catch (e) {
                    GMB.log('GoldAlert', `Stad wisselen mislukt: ${e.message}`, 'warn');
                }
            },

            openGoldTab: function() {
                try {
                    const wnd = document.querySelector('div[id^="gpwnd_"]:not([style*="display: none"])');
                    if (!wnd) return;
                    const candidates = wnd.querySelectorAll('a, li, span, div');
                    for (const el of candidates) {
                        const text = (el.textContent || '').trim().toLowerCase();
                        if ((text === 'goud' || text === 'gold' || text.includes('goudbeurs') || text.includes('gold exchange')) && el.children.length <= 2) {
                            el.click();
                            return;
                        }
                    }
                } catch (e) {}
            },

            updateGoldAlarm: function() {
                const alarm = document.getElementById('gmb-gold-alarm');
                if (!alarm) return;
                const enabled = GMB.storage.get('goldalert_enabled', false) && GMB.isModuleEnabled('GoldAlert');
                alarm.style.display = enabled ? 'block' : 'none';
                if (!enabled) return;
                const list = alarm.querySelector('#gmb-gold-alarm-list');
                if (!list) return;
                const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                const rows = this.lastAlertRows || [];
                if (!rows.length) {
                    list.innerHTML = '<div style="padding:5px 8px;color:#9e9e9e;">Geen verkoopkansen gevonden</div>';
                    alarm.style.borderColor = '#444';
                    return;
                }
                alarm.style.borderColor = '#f9a825';
                list.innerHTML = rows.map(row => {
                    const parts = RESOURCES.filter(r => row.offers && row.offers[r.key]).map(r => {
                        const offer = row.offers[r.key];
                        return `<span class="resources_small ${r.key}" style="display:inline-block;width:12px;height:12px;vertical-align:-2px;" title="${r.label}"></span> ~${offer.amount.toLocaleString('nl-NL')}→≈${offer.gold.toLocaleString('nl-NL')}g`;
                    });
                    const total = this.rowTotalGold(row);
                    const tip = `Totaal ≈${total.toLocaleString('nl-NL')} goud · Cap. ${row.capacity.toLocaleString('nl-NL')}`;
                    return `<div title="${esc(tip)}" style="padding:3px 6px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><b data-gold-town="${row.town.id}" style="color:#ffd54f;cursor:pointer;text-decoration:underline dotted;">${esc(row.town.name)}</b> <span style="color:#cfd8dc;">${parts.join(' · ')}</span>${total > 0 ? ` <b style="color:#ffd54f;">≈${total.toLocaleString('nl-NL')}g</b>` : ''}</div>`;
                }).join('');
            },

            logActivity: function(message, type = 'info') {
                const logEl = document.getElementById('goldalert-log');
                if (logEl) {
                    const timestamp = new Date().toLocaleTimeString();
                    const div = document.createElement('div');
                    div.className = `gmb-log-entry gmb-log-${type}`;
                    div.textContent = `[${timestamp}] ${message}`;
                    logEl.appendChild(div);
                    while (logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
                    logEl.scrollTop = logEl.scrollHeight;
                }
                GMB.log('GoldAlert', message, type);
            },

            clearLog: function() {
                const logEl = document.getElementById('goldalert-log');
                if (logEl) logEl.innerHTML = '<div>Log gewist.</div>';
            },

            onEnable: function() { this.addUITab(); if (this.enabled) this.start(); },
            onDisable: function() { this.stop(); }
        };

        GMB_GoldAlert.gameOnly = true;
        GMB.registerModule('GoldAlert', GMB_GoldAlert);

        if (typeof unsafeWindow !== 'undefined') unsafeWindow.GMB_GoldAlert = GMB_GoldAlert;
        window.GMB_GoldAlert = GMB_GoldAlert;

        if (typeof GMB_GoldAlert.init === 'function') {
            try { GMB_GoldAlert.init(); GMB_GoldAlert.initialized = true; }
            catch (e) { console.error('[GoldAlert] Init failed:', e); }
        }

        console.log('[GoldAlert] Module loaded');
    });
})();

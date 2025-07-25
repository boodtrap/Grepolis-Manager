// ==UserScript==
// @name         Grepolis Manager
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Verbeterd en gestructureerd script voor Grepolis
// @author       Zambia1972
// @resource     buttonOff https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/button-off.png
// @resource     buttonOn https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/button-on.png
// @resource     iconGM https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-GM.png
// @resource     iconInstellingen https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/instellingen.png
// @resource     iconAttack https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-attackrange-helper.png
// @resource     iconFeesten https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-feesten.png
// @resource     iconForum https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-forummanager.png
// @resource     iconKaart https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-kaart.png
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
// @match        https://*.grepolis.com/game/*
// ==/UserScript==

(function() {
    'use strict';

    // =========================== //
    // Hoofdklasse GrepolisManager //
    // =========================== //

    class SupabaseSettings {
        static async loadOrPrompt() {
            let url = await GM_getValue('supabase_url', null);
            let key = await GM_getValue('supabase_api_key', null);

            if (url && key) {
                return { SUPABASE_URL: url, SUPABASE_API_KEY: key };
            }

            return new Promise(resolve => {
                const popup = document.createElement('div');
                popup.style = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 99999;
                background: #1e1e1e;
                border: 2px solid #FF0000;
                padding: 20px;
                color: white;
                font-family: sans-serif;
                width: 400px;
                border-radius: 10px;
                box-shadow: 0 0 20px red;
            `;

               popup.innerHTML = `
                <h2 style="color:#FF0000; text-align:center;">Supabase Configuratie</h2>
                <p>Voer hieronder je Supabase gegevens in:</p>
                <label>Supabase URL:<br>
                    <input type="text" id="supabase-url" style="width: 100%; padding: 5px;" placeholder="https://xyz.supabase.co" />
                </label><br><br>
                <label>API Key:<br>
                    <input type="text" id="supabase-key" style="width: 100%; padding: 5px;" placeholder="public-anon-key" />
                </label><br><br>

                <div style="display: flex; justify-content: space-between; align-items:center;">
                    <button id="save-supabase" style="background: #FF0000; color: white; padding: 10px 20px; border: none; border-radius: 5px;">Opslaan</button>
                    <button id="toggle-supabase-help" style="background: #333; color: #FF5555; padding: 6px 12px; border: 1px solid #FF0000; border-radius: 5px;">❔ Handleiding</button>
                </div>

                <div id="supabase-help" style="display:none; margin-top:15px; background:#111; padding:10px; border:1px solid #444; border-radius:8px; max-height:300px; overflow-y:auto; font-size:13px; color:#ccc;">
                    <pre style="white-space:pre-wrap;">${SupabaseSettings.helpText()}</pre>
                </div>
            `;


                document.body.appendChild(popup);

                document.getElementById('save-supabase').addEventListener('click', async () => {
                    const newUrl = document.getElementById('supabase-url').value.trim();
                    const newKey = document.getElementById('supabase-key').value.trim();

                    if (!newUrl || !newKey) {
                        alert("Vul beide velden in.");
                        return;
                    }

                    await GM_setValue('supabase_url', newUrl);
                    await GM_setValue('supabase_api_key', newKey);
                    popup.remove();
                    location.reload(); // Herstart script
                });
                document.getElementById("toggle-supabase-help").addEventListener("click", () => {
                    const help = document.getElementById("supabase-help");
                    help.style.display = (help.style.display === "none") ? "block" : "none";
                });
            });
        }

        static helpText() {
            return `
📦 SUPABASE GEBRUIKSHANDLEIDING VOOR GREPOLIS MANAGER

Wat is Supabase?
Supabase is een open-source alternatief voor Firebase. Dit script gebruikt het om gegevens veilig extern op te slaan (zoals troepen).

────────────────────────────
🔧 STAP 1: Maak een project aan
────────────────────────────
1. Ga naar https://supabase.com/
2. Log in of registreer
3. Klik op 'New Project'
4. Geef een naam, regio en wachtwoord op
5. Klik op 'Create'

────────────────────────────
🔑 STAP 2: API-gegevens ophalen
────────────────────────────
1. Ga naar 'Settings' → 'API'
2. Kopieer:
   - Project URL (→ SUPABASE_URL)
   - anon public key (→ SUPABASE_API_KEY)

────────────────────────────
📁 STAP 3: (Optioneel) Tabellen maken
────────────────────────────
Gebruik 'Table Editor' om bv. een 'troops' tabel aan te maken met:
  player | town_id | unit | amount | timestamp

────────────────────────────
⚙️ Gebruik in dit script
────────────────────────────
- Vul de gegevens hierboven in
- Deze worden lokaal opgeslagen (veilig via GM_setValue)
- Aanpassen kan later via Instellingen → Supabase

────────────────────────────
🧪 TEST
────────────────────────────
Bekijk in je Supabase dashboard of de gegevens worden bijgehouden
`.trim();
        }
    }

    class GrepolisManager {
        constructor() {
            this.uw = unsafeWindow;
            // Configuratie
            this.supabaseConfig = null;
            this.settingsWindow = new SettingsWindow(this);
            this.isUIInjected = false;
            this.modules = {};
            this.buttonStates = [false, false, false, false, false, false, false];
            this.buttonIcons = [
                'iconGM',
                'iconInstellingen',
                'iconAttack',
                'iconFeesten',
                'iconTroop',
                'iconKaart',
                'iconForum'
            ];

            this.iconUrls = {}; // Slaat de icon URLs op

            this.injectStyles();
            this.load(); // Start het asynchrone laadproces
            this.tabs = [
                {
                    id: "dashboard",
                    label: "Dashboard",
                    render: (container) => this.renderDashboardTab(container),
                },
                {
                    id: "spelers",
                    label: "Spelers",
                    render: (container) => this.renderPlayersTab(container),
                },
                // etc.
            ];
        }

        async load() {
            const banned = await GM_getValue('banned_players', []);
            const name = this.modules?.forumManager?.getPlayerName?.() || '';
            if (banned.includes(name)) {
                alert("Je bent geblokkeerd van dit script.");
                throw new Error("Geblokkeerde gebruiker.");
            }
            this.supabaseConfig = await SupabaseSettings.loadOrPrompt();
            await this.loadResources();
            await this.initializeManagers();
            this.initializeButtons();
            window.GrepoMain = this;
            console.log("Supabase config geladen:", this.supabaseConfig);
        }

        async initializeManagers() {
            this.modules.forumManager = new ForumManager(this);
            this.modules.feestenManager = new FeestenFixedManager(this);
            this.modules.attackRangeHelper = new AttackRangeHelperManager(this);
            await this.modules.attackRangeHelper.initialize();
            this.modules.troopManager = new TroopManager(this, this.supabaseConfig);
            this.modules.troopManager.startAutoUploader();
            this.modules.mapmanager = new MapManager(this);
            BigTransporterCapacity.activate();
            this.modules.mapOverlay = new MapOverlayModule(this);
            this.modules.mapOverlay.init();
        }

        async loadResources() {
            // Laad alle resources en sla de URLs op
            try {
                this.iconUrls.buttonOff = await this.getResource('buttonOff');
                this.iconUrls.buttonOn = await this.getResource('buttonOn');

                for (const icon of this.buttonIcons) {
                    this.iconUrls[icon] = await this.getResource(icon);
                }
            } catch (error) {
                console.error('Fout bij laden resources:', error);
                // Fallback naar directe URLs als GM_getResourceURL niet werkt
                this.iconUrls = {
                    buttonOff: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/button-off.png',
                    buttonOn: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/button-on.png',
                    iconGM: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-GM.png',
                    iconInstellingen: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/instellingen.png',
                    iconAttack: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-attackrange-helper.png',
                    iconFeesten: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-feesten.png',
                    iconForum: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-forummanager.png',
                    iconKaart: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-kaart.png',
                    iconTroop: 'https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/icioon-troopmanager.png'
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

            if (this.modules.mapOverlay) {
                const overlaySettingsDiv = document.createElement("div");
                overlaySettingsDiv.id = "overlay-settings";
                overlaySettingsDiv.style.cssText = `
        font-weight: bold;
        text-shadow: 1px 1px 2px #000;
        color: #FFCC66;
        font-size: 10px;
        line-height: 2.1;
        min-width: 48px;
        display: inline-block;
        text-align: left;
        margin-top: 15px;
        background: rgba(255,255,255,0.05);
        padding: 8px;
        border-radius: 6px;
    `;

                this.modules.mapOverlay.renderSettingsUI(overlaySettingsDiv);
                popup.appendChild(overlaySettingsDiv);
            }
        }

        // ========= //
        // Stijlen   //
        // ========= //

        injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
                #gm-button-container {
                    position: fixed;
                    top: 0px;
                    left: 380px;
                    z-index: 9999;
                    display: flex;
                    gap: 0px;
                    padding: 3px;
                }

                .gm-toggle-button {
                    width: 65px;
                    height: 25px;
                    background-size: cover;
                    background-position: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .gm-toggle-button img {
                    height: 20px;
                    pointer-events: none;
                }

                #gm-popup {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    width: 800px;
                    max-width: 90%;
                    height: 600px;
                    max-height: 80vh;
                    transform: translate(-50%, -50%);
                    background: #1e1e1e;
                    border: 2px solid #FF0000;
                    border-radius: 10px;
                    padding: 20px;
                    color: white;
                    z-index: 10000;
                    box-shadow: 0 0 15px #FF0000;
                    overflow-y: auto;
                }

                #gm-popup h2 {
                    color: #FF0000;
                    text-align: center;
                    margin-top: 0;
                }

                .gm-toolbar {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .gm-toolbar button {
                    background: black;
                    color: #FF0000;
                    border: 1px solid #FF0000;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-size: 14px;
                    border-radius: 5px;
                }

                #gm-content {
                    padding: 10px;
                    text-align: center;
                }
                .gm-toggle-button:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 5px #FF0000;
                }

            `;
            document.head.appendChild(style);
        }
        // ============ //
        // initializers //
        // ============ //

        initializeButtons() {
            if (document.getElementById('gm-button-container')) return;

            const container = document.createElement('div');
            container.id = 'gm-button-container';

            const buttonTitles = [
                'Startscherm',
                'Instellingen',
                'AttackRange Helper',
                'Feesten Manager',
                'Troop Manager',
                'Kaart',
                'Forum Manager'
            ];

            const callbacks = [
                (active) => {
                    if (active) {
                        this.showStartscreenPopup();
                    } else {
                        const popup = document.getElementById('gm-popup');
                        if (popup) popup.remove();
                    }
                },
                () => this.settingsWindow.toggle(),
                (active) => this.modules.attackRangeHelper.toggle(active),
                (active) => this.modules.feestenManager.toggle(active),
                (active) => this.modules.troopManager.toggle(active),
                (active) => this.modules.mapmanager.toggle(active),
                (active) => this.modules.forumManager.toggle(active),
            ];

            callbacks.forEach((callback, index) => {
                const button = document.createElement('div');
                button.className = 'gm-toggle-button';
                button.title = buttonTitles[index]; // ✅ Tooltip bij hover
                button.dataset.index = index;
                button.style.backgroundImage = `url("${this.iconUrls.buttonOff}")`;

                const icon = document.createElement('img');
                icon.src = this.iconUrls[this.buttonIcons[index]];
                button.appendChild(icon);

                button.addEventListener('click', () => {
                    this.buttonStates[index] = !this.buttonStates[index];
                    button.style.backgroundImage = this.buttonStates[index]
                        ? `url("${this.iconUrls.buttonOn}")`
                    : `url("${this.iconUrls.buttonOff}")`;
                    callback(this.buttonStates[index]);
                });

                container.appendChild(button);
            });

            document.body.appendChild(container);
        }

        // ================== //
        // Startscherm inhoud //
        // ================== //

        showStartscreenPopup() {
            const playerName = this.modules.forumManager
            ? this.modules.forumManager.getPlayerName()
            : 'Speler';

            const buttonIndex = 0; // Index van de startschermknop
            const startButton = document.querySelector(`#gm-button-container .gm-toggle-button[data-index="${buttonIndex}"]`);

            if (this.buttonStates[buttonIndex]) {
                this.buttonStates[buttonIndex] = false;
                if (startButton) {
                    startButton.style.backgroundImage = `url("${this.iconUrls.buttonOff}")`;
                }
            }

            const popup = document.createElement('div');
            popup.id = 'gm-popup';
            popup.innerHTML = `

                    <h2>Welkom ${playerName} bij Grepolis Manager</h2>
                    <p>Dit script combineert de kracht van populaire Grepolis-tools in één handige oplossing en nog veel meer.</p>
                    <p>Selecteer een module via de knoppenbalk bovenaan het scherm.</p>
                    <h3>Beschikbare modules:</h3>
                    <ul>
                        <li><strong>AttackRange Helper</strong> - Toon aanvalsbereik</li>
                        <li><strong>Feesten Manager</strong> - Beheer stadsfeesten</li>
                        <li><strong>Troop Manager</strong> - Beheer je troepen</li>
                        <li><strong>Forum Manager</strong> - Beheer forums en topics</li>
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
                            <a href="${tool.url}" target="_blank" style="
                                display: inline-block;
                                background-color: #FF0000;
                                color: white;
                                padding: 5px 10px;
                                font-size: 11px;
                                border-radius: 4px;
                                text-decoration: none;
                                margin-top: 5px;
                            ">Download script</a>
                        </div>
                    `).join('')}
                </div>

                <div style="margin-top: 20px; text-align: center;">
                    <p style="font-size: 12px; font-style: italic;">Het Grepolis Manager Team</p>
                    <div style="display: flex; justify-content: center; gap: 20px; margin-top: 10px;">
                        <div>
                            <p style="font-size: 12px; font-weight: bold;">Elona</p>
                            <img src="https://imgur.com/QxTgAHJ.png" alt="Elona Handtekening" style="width: 100px; height: auto; transform: rotate(${Math.floor(Math.random() * 30 - 15)}deg);">
                        </div>
                        <div>
                            <p style="font-size: 12px; font-weight: bold;">Zambia1972</p>
                            <img src="https://imgur.com/uHRXM9u.png" alt="Zambia1972 Handtekening" style="width: 200px; height: auto; transform: rotate(${Math.floor(Math.random() * 30 - 15)}deg);">
                        </div>
                    </div>
                </div>
            `;

            if (this.modules.mapOverlay) {
                const overlaySettingsDiv = document.createElement("div");
                overlaySettingsDiv.id = "overlay-settings";
                this.modules.mapOverlay.renderSettingsUI(overlaySettingsDiv);
                popup.appendChild(overlaySettingsDiv);
            }


            const closeButton = document.createElement('button');
            closeButton.textContent = 'Sluiten';
            closeButton.style.cssText = `
                    display: block;
                    margin: 20px auto 0;
                    padding: 8px 20px;
                    background: #FF0000;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                `;
            closeButton.addEventListener('click', () => {
                popup.remove();
                // Reset de knop status wanneer de popup wordt gesloten
                this.buttonStates[buttonIndex] = false;
                if (startButton) {
                    startButton.style.backgroundImage = `url("${this.iconUrls.buttonOff}")`;
                }
            });

            popup.appendChild(closeButton);
            document.body.appendChild(popup);
        }

        showNotification(message, isSuccess = true) {
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 10px 20px;
                    background-color: ${isSuccess ? '#4CAF50' : '#F44336'};
                    color: white;
                    border-radius: 4px;
                    z-index: 10001;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    animation: fadeIn 0.3s;
                `;

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
            this.uw = mainManager.uw;
        }

        getPlayerName() {
            // Methode 1: Via header element
            const headerName = document.querySelector('.header_nickname');
            if (headerName) return headerName.textContent.trim();

            // Methode 2: Via game API (afhankelijk van Grepolis implementatie)
            if (this.uw.Game && this.uw.Game.player_name) {
                return this.uw.Game.player_name;
            }

            return 'Speler'; // Fallback als naam niet gevonden wordt
        }

        async waitForElementWithRetry(selector, timeout = 5000, maxRetries = 3) {
            let retry = 0;
            while (retry < maxRetries) {
                try {
                    const element = await this.waitForElement(selector, timeout);
                    if (element) return element;
                } catch (error) {
                    retry++;
                    if (retry >= maxRetries) throw error;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            throw new Error(`Element ${selector} niet gevonden na ${maxRetries} pogingen`);
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

    // ============= //
    // Forum Manager //
    // ============= //

    class ForumManager extends BaseManager {
        constructor(mainManager) {
            super(mainManager);
            this.fora = [
                { name: "Algemeen", description: "Algemene discussies" },
                { name: "ROOD", description: "Noodmeldingen en verdediging" },
                { name: "Deff", description: "Verdedigingsstrategieën" },
                { name: "Offens", description: "Offensieve strategieën" },
                { name: "Massa_Aanval", description: "Massa-aanvallen" },
                { name: "Interne_Overnames", description: "Interne overnames" },
                { name: "Cluster", description: "Clusterbeheer" },
                { name: "Kroeg", description: "Informele discussies" },
                { name: "Leiding", description: "Leidinggevenden" },
            ];
            this.topicsData = {
                Algemeen: [
                    {
                        title: "Welkom bij de alliantie", content: "Hallo strijders van de oude wereld!\n" +
                        "\n" +
                        "We zijn ontzettend blij dat jullie hier zijn, op ons forum waar de goden en godinnen van de strategie samenkomen! Of je nu een doorgewinterde held bent of net je eerste stad hebt veroverd, hier is de plek waar we elkaar kunnen ontmoeten, tips kunnen uitwisselen en natuurlijk kunnen lachen om onze meest epische blunders (ja, we hebben allemaal wel eens een stad verloren aan een stelletje boze kippen).\n" +
                        "\n" +
                        "Voordat je je zwaarden en schilden opbergt, willen we je vragen om jezelf even kort voor te stellen. Vertel ons wie je bent, waar je vandaan komt en wat je favoriete strategie is. En als je een hilarisch verhaal hebt over een mislukte aanval of een onverwachte alliantie, deel dat vooral! We zijn hier om elkaar te steunen, maar ook om samen te lachen.\n" +
                        "\n" +
                        "Dus, trek je toga aan, neem een slok van je ambrosia en laat ons weten wie je bent! We kunnen niet wachten om je te leren kennen en samen de wereld van Grepolis te veroveren!\n" +
                        "\n" +
                        "Met strijdlustige groet,\n" +
                        "\n" +
                        "Het Grepolis Forum Team 🏛️✨"
                    },
                    {
                        title: "Te volgen regels", content: "🏛️ Alliantie Reglement – Samen Sterk, Samen Onverslaanbaar! 🏛️\n" +
                        "Welkom bij de alliantie! 🎉 We zijn hier niet alleen om een beetje rond te dobberen, maar om samen de vijand tot stof te reduceren. Dit reglement is geen bureaucratische onzin, maar een handleiding voor totale dominantie. Volg het, en we overleven. Negeer het, en de vijand lacht ons uit – en laten we eerlijk zijn, dat is gewoon gênant.\n" +
                        "\n" +
                        "1️⃣ Afwezigheid – Niet Stiekem Verdwijnen!\n" +
                        "Ga je langer dan 18 uur weg? Meld het op het forum. Laat ons ook weten of je de vakantiemodus aanzet.\n" +
                        "Geen melding = automatisch IO voor clustersteden, en geloof ons, dat wil je niet.\n" +
                        "\n" +
                        "👀 “Ik was even mijn kat zoeken” is geen excuus. We willen duidelijke communicatie.\n" +
                        "\n" +
                        "2️⃣ Opstand ([color=#FF0000]Rood[/color]) – Alarmfase Rood!\n" +
                        "Als je stad in opstand staat, panikeer niet (of doe dat stilletjes), maar maak een Rood-topic met de juiste informatie.\n" +
                        "\n" +
                        "📢 Verlies je een stad zonder iets te zeggen? Dan zetten we je op de lijst voor een gratis IO-abonnement, geen terugbetaling mogelijk.\n" +
                        "\n" +
                        "Extra tip: Geef updates over muurstand, inkomende aanvallen en spreuken. We zijn goed, maar we kunnen helaas nog geen gedachten lezen.\n" +
                        "\n" +
                        "3️⃣ Trips – Een Kleine Stap voor Jou, Een Grote Stap voor de Alliantie\n" +
                        "Plaats altijd trips bij je eilandgenoten. Een trip is 3 def lt per stad.\n" +
                        "\n" +
                        "💡 Denk eraan: geen trips plaatsen is als je huis openlaten voor inbrekers en zeggen: “Kom maar binnen, koffie staat klaar!”\n" +
                        "\n" +
                        "Vernieuw gesneuvelde trips en plaats een rapport in het trips-topic op het def-forum.\n" +
                        "\n" +
                        "4️⃣ Hulp Vragen & Elkaar Steunen – We Doen Dit Samen\n" +
                        "Vraag op tijd om hulp. Het is geen schande om hulp te vragen, het is een schande om stil te zijn en dan keihard onderuit te gaan. Gebruik forum, Discord of PM.\n" +
                        "\n" +
                        "Help! Mijn stad brandt! is trouwens een prima bericht. Sneller reageren we niet, maar het is wel dramatisch.\n" +
                        "\n" +
                        "5️⃣ Reservaties – Geen Vage Claims, Gewoon Doen\n" +
                        "Claim pas als je een kolo en een slotje hebt. Een claim is binnen 2 dagen overnemen, geen eindeloze bezetting van de stoel zoals een kleuter die niet van de schommel wil.\n" +
                        "\n" +
                        "🔴 PRIO-steden? Dan tellen claims niet. Pak het, of de vijand doet het. Simpel.\n" +
                        "\n" +
                        "6️⃣ Overzicht & Communicatie – Niet Raden, Gewoon Weten\n" +
                        "Gebruik BB-codes of zorg dat iemand het voor je doet. Anders proberen we je bericht zu ontcijferen alsof het een oude schatkaart is.\n" +
                        "\n" +
                        "🔍 Eilandcodes uit het Cluster Plan-topic gebruiken = dikke pluspunten.\n" +
                        "\n" +
                        "7️⃣ Offensief – Oorlog met Stijl\n" +
                        "🚫 Geen transportboten als aanval – tenzij je de vijand wilt laten lachen.\n" +
                        "🎯 VS voor je LT-aanval timen = slim.\n" +
                        "💥 Geen def lt of bir gebruiken bij aanvallen. Anders krijg je een cursus “Hoe val ik wél aan” gratis op het forum.\n" +
                        "\n" +
                        "🌙 Nachtbonus? Alleen aanvallen op inactieve spelers, lege steden of als je écht durft.\n" +
                        "\n" +
                        "8️⃣ TTA’s & Berichten – Reacties Zijn Belangrijker dan Je Ex\n" +
                        "Antwoord op TTA’s, berichten en Discord @’s. Geen reactie? Dan nemen we aan dat je ondergedoken bent en nemen we je clustersteden voor je eigen veiligheid over.\n" +
                        "\n" +
                        "Dus tenzij je graag een stadsloze kluizenaar wordt: reageren aub!\n" +
                        "\n" +
                        "9️⃣ Steden & Collectieve Verplichtingen – Iedereen Doet Mee\n" +
                        "Elke speler heeft minimaal 1 def lt-stad en 1 bir-stad.\n" +
                        "📌 Cluster Plan volgen = essentieel. Overnemen pas na 1 stad per cluster eiland (inclusief rotsen, ja, ook die lelijke).\n" +
                        "\n" +
                        "🔟 Rotsen & Gunstfarmen – Klein Maar Fijn\n" +
                        "Heb je een rotsstad? Zorg dat je actief bent en alarm aanzet. Anders is die rots sneller weg dan een gratis biertje op een festival.\n" +
                        "\n" +
                        "Gunst is belangrijk. Zonder gunst geen razende aanvallen. Zonder razende aanvallen? Nou ja, dan win je niet.\n" +
                        "\n" +
                        "Waarom deze regels?\n" +
                        "We zijn niet de alliantie van de vrije interpretatie. We zijn een goed geoliede machine die vijanden verslindt.\n" +
                        "🚀 Duidelijke afspraken = een sterke alliantie = Winst.\n" +
                        "\n" +
                        "Hou je eraan, dan maken we gehakt van de tegenstanders. Negeer ze? Dan krijg je een persoonlijke uitnodiging voor de IO van de Maand-competitie.\n" +
                        "\n" +
                        "💪 SAMEN DOMINEREN WE!\n" +
                        "\n" +
                        "Met strijdlustige groeten,\n" +
                        "🔥 De Leiding 🔥"
                    },
                    {
                        title: "Afwezig", content: "Laat hier weten als je er even tussenuit bent.\n" +
                        "\n" +
                        "[table]\n" +
                        "[**]Speler[||]Afwezig van[||]tem[||]VM[||]Opmerkingen[/**]\n" +
                        "[*][|][|][|][|][/*]\n" +
                        "[*][|][|][|][|][/*]\n" +
                        "[*][|][|][|][|][/*]\n" +
                        "[/table]\n"
                    },
                    {title: "Bondgenoten & NAP's", content: "Bondgenoten en NAP's worden hier besproken."},
                    {
                        title: "Spreuken en grondstoffen",
                        content: "Hier kunnen spelers om spreuken en grondstoffen vragen."
                    },
                    {
                        title: "Discord en scripts", content: "[b][u]Kom langs op onze discord server.[/u][/b]\n" +
                        "\n" +
                        "[url]https://discord.gg/v53K97dD8a[/url]\n" +
                        "\n" +
                        "[b][u]grepodata city-indexer[/u][/b]\n" +
                        "\n" +
                        "[url]https://grepodata.com/invite/rhzuhr2n4yqwd7dhcc[/url]\n" +
                        "\n" +
                        "[b][u]Forum ROOD template generator[/u][/b]\n" +
                        "\n" +
                        "[url]https://greasyfork.org/nl/scripts/512594-grepolis-notepad-forum-template-3[/url]"
                    }
                ],
                ROOD: [
                    {
                        title: "Rood tabel", content: "Bij meer dan 5 aanvallen wordt de tabel actief.\n" +
                        "[b][color=#FF0000]Bij een opstand éérst een eigen topic aanmaken in de juiste opmaak, [u]incl. tabelregel![/u][/color][/b]\n" +
                        "Tabelregel:\n" +
                        "[b][*]nr[|]OC[|]start F2[|]BB-code stad[|]muur[|]god[|]aanvaller(s)[|]BIR/LT[|]Aanwezige OS[|]Notes[/*][/b]\n" +
                        "Vul de tabelregel in met de gegevens van jouw ROOD melding en plaats deze bovenaan in je topic.\n" +
                        "muur -16 ➡️ alleen BIR sturen\n" +
                        "                    muur +16 ➡️ alleen LT (landtroepen) sturen\n" +
                        "                    Als de muur opgebouwd is én er geen reden op afbraak is, dan mag BIR omgezet worden naar LT.\n" +
                        "                    ⚠️ Zet géén sterretje in de titel van je topic! Forum mods zetten een * in de titel als indicatie dat de melding is opgenomen in de ROOD tabel. Doe je dit zelf, komt je stad NIET in de tabel terecht.\n" +
                        "                    [b]Mod van Dienst[/b]: [img]https://cdn.grcrt.net/emots2/girl_comp.gif[/img]\n" +
                        "                    [player]joppie86[/player]\n" +
                        "                    [table]\n" +
                        "                    [**]Nr[||]OC[||]Start F2[||]BB-code stad[||]Muur[||]God[||]aanvaller(s)[||]BIR/LT[||]Aanwezig[||]Notes[/**]\n" +
                        "                    [*][|][|][|][|][|][|][|][|][|][/*]\n" +
                        "                    [/table]\n" +
                        "                    [b][color=#FF2D2D][size=12]Dringend verzoek[/size]: Als je stad [b][u][size=12]safe[/size][/u][/b] is dit [u][size=12]melden[/size][/u] en de [u][size=12]OS terug sturen[/size][/u]! [/color][/b]"
                    },
                    {
                        title: "Kolo snipe", content: "Beste strijders,\n" +
                        "                    Aan alle [u]Kolo-spotters[/u]," +
                        "					 plaats in deze topic ASAP een bericht als je kolo hebt gespot.\n" +
                        "                    meld je stadsnaam in BB en exacte tijd van aankomst kolo + tijd laatste aanval voor kolo.\n" +
                        "                    Vb.:\n" +
                        "                    [town]1[/town]\n" +
                        "                    Kolo: 22:15:42\n" +
                        "                    laatste voor kolo: 22:15:32\n" +
                        "                    aan alle [u]Kolo-snipers[/u],\n" +
                        "                    hou deze topic goed in de gaten voor kolo-spotters, zodat je vlug kan handelen indien er kolo is gespot.\n" +
                        "                    [b]hoe timen:[/b]\n" +
                        "                    zorg in je snipe steden voor:\n" +
                        "                    * uiteraard BIR\n" +
                        "                    * transportboot\n" +
                        "                    * sirene\n" +
                        "                    gebruik bij voorkeur je aanvalsplanner om je ondersteuning te timen:\n" +
                        "                    poging 1: 1 tb + bir (min 50) check aankomsttijd en eventueel opnieuw proberen\n" +
                        "                    poging 2: 60 BIR meerdere pogingen versturen kort na elkaar van 10 sec voor tot 10 sec na opstandtijd\n" +
                        "                    poging 3: 1 sirene + Bir check aankomsttijd en eventueel opnieuw proberen\n" +
                        "                    succes\n"
                    },
                    {
                        title: "Rood Template",
                        content: "[*]nr[|]OC[|]start F2[|]aangevallen stad[|]muur[|]god[|]aanvallende speler[|]gewenste OS[|]aanwezig[|]Notes[/*]\n" +
                        "                    Aangevallen stad: \n" +
                        "                    God: \n" +
                        "                    Muur: \n" +
                        "                    Toren: \n" +
                        "                    Held: \n" +
                        "                    Ontwikkelingen: \n" +
                        "                    OS aanwezig: \n" +
                        "                    OS nodig: \n" +
                        "                    Stadsbescherming: \n" +
                        "                    Fase 2 begint om: \n" +
                        "                    Fase 2 eindigt om: \n" +
                        "                    [spoiler=Rapporten] \n" +
                        "                    *Opstandsrapport(ten)!!!*\n" +
                        "                    [/spoiler]\n"
                    }
                ],
                Deff: [
                    {
                        title: "Pre-deff", content: "Vraag hier je pre-deff aan voor belangrijke steden.\n" +
                        "\n" +
                        "                    Pre-deff kan je krijgen op voorwaarde dat je muur 25 is en Toren.\n" +
                        "\n" +
                        "                    hoe aanvragen:\n" +
                        "                    stadsnaam: in BB\n" +
                        "                    Muur Lv:\n" +
                        "                    Toren:\n" +
                        "                    aanwezige Lt:\n"
                    },
                ],
                Offens: [
                    {
                        title: "OFF. | Template", content: "Titel\n" +
                        "                    VB: Oceaan | Te veroveren stadsnaam | Status\n" +
                        "                    VB: 55 | 55-01 | Opstand/ VS clear nodig\n" +
                        "\n" +
                        "                    -------------------------------------------------------\n" +
                        "\n" +
                        "                    Alliantie:\n" +
                        "                    Speler:\n" +
                        "                    Stad:\n" +
                        "\n" +
                        "                    Gevraagde hulp: Spionage/ VS clear/ Zee clear\n" +
                        "\n" +
                        "                    [spoiler=Recentste spionage][/spoiler]\n" +
                        "\n" +
                        "                    [spoiler=Opstand aanval][/spoiler]\n"
                    },
                    {
                        title: "Opstand breken met Helena", content: "[b]Aan wie Helena bezit:[/b]\n" +
                        "                Zorg dat Helena op Lv 20 is.\n" +
                        "                meld hier in welke stad Helena zit.\n" +
                        "                controleer hier regelmatig naar opstanden.\n" +
                        "\n" +
                        "                [b]Aan wie opstand heeft:[/b]\n" +
                        "\n" +
                        "                Laat hier onmiddellijk weten waar er opstand in een stad word gezet (zelfs indien je zeker bent van een opstand, nog voor die er is).\n" +
                        "\n" +
                        "                stad: in BB\n" +
                        "                F2 tijd:\n" +
                        "\n" +
                        "                [table]\n" +
                        "                [**]naam[||]lv[||]stad[||][/**]\n" +
                        "                [*][|][|][|][/*]\n" +
                        "                [/table]\n"
                    },
                    {
                        title: "Spionage rapporten", content: "Hier kan je alle recente spionage rapporten bekijken."
                    },
                ],
                Massa_Aanval: [
                    {title: "Massa-aanvallen", content: "Inhoud van Massa-aanvallen..."},
                ],
                Interne_Overnames: [
                    {title: "Interne overnames", content: "Inhoud van Interne overnames..."},
                ],
                Cluster: [
                    {title: "Clusterbeheer", content: "Inhoud van Clusterbeheer..."},
                ],
                Kroeg: [
                    {title: "Kroegpraat", content: "Inhoud van Kroegpraat..."},
                ],
                Leiding: [
                    {title: "Leidinggevenden", content: "Inhoud van Leidinggevenden..."},
                ],
            };
        }

        async createAllForaAndTopics() {
            const content = document.getElementById('popup-content');
            content.innerHTML = `
                <h2>Fora en Topics Aanmaken</h2>
                <p>Klik op de knop hieronder om alle fora en topics in één keer aan te maken.</p>
                <button id="start-creation" style="background: black; color: #FF0000; border: 1px solid #FF0000; padding: 10px 20px; cursor: pointer; font-size: 14px; border-radius: 5px;">Start Aanmaken</button>
                <div id="status-messages" style="margin-top: 20px;"></div>
            `;

            const startButton = content.querySelector('#start-creation');
            startButton.addEventListener('click', async () => {
                const statusDiv = document.getElementById('status-messages');
                statusDiv.innerHTML = '';

                try {
                    // Navigeer naar het alliantieforum
                    await this.navigateToAllianceForum();

                    // Open het forumbeheer (alleen voor het eerste forum)
                    let isForumAdminOpen = false;

                    // Maak alle fora aan
                    for (let i = 0; i < this.fora.length; i++) {
                        const forum = this.fora[i];
                        if (await this.forumExists(forum.name)) {
                            statusDiv.innerHTML += `<p>Forum "${forum.name}" bestaat al.</p>`;
                        } else {
                            if (!isForumAdminOpen) {
                                await this.openForumAdmin();
                                isForumAdminOpen = true;
                            }
                            await this.createForum(forum);

                            // Sluit het dialoogvenster alleen na het laatste forum
                            if (i === this.fora.length - 1) {
                                await this.closeDialog();
                            }

                            statusDiv.innerHTML += `<p>Forum "${forum.name}" succesvol aangemaakt.</p>`;
                        }
                    }

                    // Terugkeren naar het alliantieforum
                    await this.navigateToAllianceForum();

                    // Maak alle topics aan
                    for (const forumName in this.topicsData) {
                        const topics = this.topicsData[forumName];

                        // Navigeer naar het juiste forum
                        await this.navigateToForum(forumName);

                        for (const topic of topics) {
                            if (await this.topicExists(forumName, topic.title)) {
                                statusDiv.innerHTML += `<p>Topic "${topic.title}" in forum "${forumName}" bestaat al.</p>`;
                            } else {
                                await this.createTopic(topic);
                                statusDiv.innerHTML += `<p>Topic "${topic.title}" in forum "${forumName}" succesvol aangemaakt.</p>`;

                                // Keer terug naar het forum na het aanmaken van het topic
                                await this.navigateToForum(forumName);
                            }
                        }
                    }

                    // Sluit het dialoogvenster na het aanmaken van alle topics
                    await this.closeDialog();

                    statusDiv.innerHTML += `<p><strong>Alle fora en topics zijn verwerkt!</strong></p>`;
                } catch (error) {
                    statusDiv.innerHTML += `<p style="color: red;">Fout: ${error.message}</p>`;
                    console.error(error);
                }
            });
        }

        async navigateToAllianceForum() {
            console.log("Navigeer naar alliantieforum...");
            const forumButton = await this.waitForElement('#ui_box > div.nui_main_menu > div.middle > div.content > ul > li.allianceforum.main_menu_item > span > span.name_wrapper > span', 15000);
            if (forumButton) {
                forumButton.click();
                await this.waitForElement('.forum_menu', 15000);
            } else {
                throw new Error('Kon het alliantieforum niet vinden.');
            }
        }

        async navigateToForum(forumName) {
            console.log(`Navigeer naar forum: ${forumName}`);

            try {
                // Zoek het forum op basis van de naam
                const forumLinks = document.querySelectorAll('a.submenu_link[data-menu_name]');
                let foundForum = null;

                // Loop door alle forum links
                for (const link of forumLinks) {
                    const forumSpan = link.querySelector('span.forum_menu');
                    if (forumSpan) {
                        const linkText = forumSpan.textContent.trim();
                        if (linkText.toLowerCase() === forumName.toLowerCase()) {
                            foundForum = link;
                            break;
                        }
                    }
                }

                if (!foundForum) {
                    // Toon beschikbare forums voor debuggen
                    const availableForums = Array.from(forumLinks).map(link => {
                        return link.querySelector('span.forum_menu')?.textContent.trim() || 'Onbekend forum';
                    });

                    console.error('Beschikbare forums:', availableForums);
                    throw new Error(`Forum "${forumName}" niet gevonden in de lijst.`);
                }

                // Klik op het forum
                console.log(`Klik op forum: ${forumName}`);
                foundForum.click();

                // Wacht 3 seconden om de pagina te laten laden
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Controleer of het forum leeg is
                const threadList = document.querySelector('.forum_thread_list');
                if (!threadList) {
                    console.log(`Forum "${forumName}" is leeg of het element .forum_thread_list bestaat niet.`);
                    return; // Stop verdere acties voor dit forum
                }

                console.log(`Forum "${forumName}" succesvol geladen.`);

            } catch (error) {
                console.error(`Fout bij navigeren naar forum "${forumName}":`, error);
                throw error; // Gooi de fout opnieuw voor hogere afhandeling
            }
        }

        async forumExists(forumName) {
            const forumLinks = document.querySelectorAll('a.submenu_link[data-menu_name]');
            for (const link of forumLinks) {
                const forumSpan = link.querySelector('span.forum_menu');
                if (forumSpan && forumSpan.textContent.trim().toLowerCase() === forumName.toLowerCase()) {
                    return true;
                }
            }
            return false;
        }

        async topicExists(forumName, topicTitle) {
            const topicTitles = document.querySelectorAll('.forum_thread_title');
            if (topicTitles.length === 0) {
                console.log(`Geen topics gevonden in forum "${forumName}".`);
                return false; // No topics exist in this forum
            }
            for (const title of topicTitles) {
                if (title.textContent.trim().toLowerCase() === topicTitle.toLowerCase()) {
                    return true;
                }
            }
            return false;
        }

        async createForum(forum) {
            console.log(`Maak forum aan: ${forum.name}`);

            // Klik op de knop om een nieuw forum aan te maken
            await this.clickButton("#forum_admin > div.game_list_footer > a > span.left > span > span", 15000);

            // Vul de forumnaam en beschrijving in
            await this.fillField("#forum_forum_name", forum.name, 15000);
            await this.fillField("#forum_forum_content", forum.description, 15000);

            // Klik op de bevestigingsknop
            await this.clickButton("#create_forum_confirm > span.left > span > span", 15000);

            // Wacht tot het forum is aangemaakt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        async createTopic(topic) {
            console.log(`Maak topic aan: ${topic.title}`);

            // Klik op de knop om een nieuw topic aan te maken
            await this.clickButton("#forum_buttons > a:nth-child(1) > span.left > span > span", 15000);

            // Vul de titel in
            await this.fillField("#forum_thread_name", topic.title, 15000);

            // Vul de inhoud in
            await this.fillField("#forum_post_textarea", topic.content, 15000);

            // Klik op de bevestigingsknop
            await this.clickButton("#forum > div.game_footer > a > span.left > span > span", 15000);

            // Wacht tot het topic is aangemaakt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        async closeDialog() {
            console.log("Sluit dialoogvenster...");
            const closeButton = await this.waitForElement(
                'body > div.ui-dialog.ui-corner-all.ui-widget.ui-widget-content.ui-front.ui-draggable.js-window-main-container > div.ui-dialog-titlebar.ui-corner-all.ui-widget-header.ui-helper-clearfix.ui-draggable-handle > button',
                15000
            );
            if (closeButton) {
                closeButton.click();
                console.log("Dialoogvenster gesloten.");
            } else {
                throw new Error('Kon de sluitknop van het dialoogvenster niet vinden.');
            }
        }

        async openForumAdmin() {
            console.log("Open forumbeheer...");
            const forumAdminButton = await this.waitForElement('#forum > div.game_list_footer > div.forum_footer > a', 15000);
            if (forumAdminButton) {
                forumAdminButton.click();
                await this.waitForElement('#forum_admin', 15000);
            } else {
                throw new Error('Kon de forumbeheerknop niet vinden. Controleer of de gebruiker de juiste rechten heeft.');
            }
        }

        async clickButton(selector, timeout = 15000) {
            console.log(`Zoek knop: ${selector}`);
            const button = await this.waitForElement(selector, timeout);
            if (!button) throw new Error(`Knop niet gevonden: ${selector}`);
            button.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        async fillField(selector, value, timeout = 15000) {
            console.log(`Vul veld in: ${selector}`);
            const field = await this.waitForElement(selector, timeout);
            if (!field) throw new Error(`Veld niet gevonden: ${selector}`);
            field.value = value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }

        async waitForElement(selector, timeout = 20000, retries = 3) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                let attempts = 0;

                const check = () => {
                    const element = document.querySelector(selector);
                    if (element) {
                        console.log(`Element gevonden: ${selector}`);
                        resolve(element);
                    } else if (Date.now() - startTime > timeout) {
                        if (attempts < retries) {
                            attempts++;
                            console.log(`Timeout: ${selector} niet gevonden. Poging ${attempts} van ${retries}.`);
                            setTimeout(check, 1000); // Retry after 1 second
                        } else {
                            reject(new Error(`Timeout: ${selector} niet gevonden na ${retries} pogingen.`));
                        }
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        }

        toggle(active) {
            if (active) {
                this.showUI();
            } else {
                this.hideUI();
            }
        }

        hideUI() {
            const forumUI = document.getElementById('forum-manager-ui');
            if (forumUI) forumUI.remove();
            this.main.showNotification('Forum Manager gesloten');
        }

        showUI() {
            this.hideUI();

            const popupContainer = document.createElement('div');
            popupContainer.id = 'forum-manager-ui';
            popupContainer.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1e1e1e;
                border: 2px solid #FF0000;
                border-radius: 10px;
                padding: 20px;
                color: white;
                z-index: 100;
                box-shadow: 0 0 15px #FF0000;
                width: 500px;
                height: 400px;
                max-width: 90%;
                overflow-y: auto;
            `;

            const content = document.createElement('div');
            content.id = 'popup-content';
            content.innerHTML = `
                <h2 style="color:#FF0000;">Fora en Topics Aanmaken</h2>
                <p>Deze actie maakt automatisch alle fora en topics aan in het alliantieforum. Bevestig eerst dat je dit wilt uitvoeren.</p>
                <label style="display:block;margin:10px 0;">
                    <input type="checkbox" id="confirmation-checkbox">
                    Ik weet wat ik doe en wil doorgaan
                </label>
                <button id="confirm-button" style="background:black;color:#FF0000;border:1px solid #FF0000;padding:8px 16px;border-radius:5px;cursor:pointer;">Bevestig en toon aanmaakknop</button>
                <div id="start-container" style="margin-top:15px;display:none;">
                    <button id="start-creation" style="background:#000;color:#FF0000;border:1px solid #FF0000;padding:10px 20px;cursor:pointer;font-size:14px;border-radius:5px;">Start Aanmaken</button>
                </div>
                <div id="status-messages" style="margin-top: 20px;"></div>
            `;

            popupContainer.appendChild(content);
            document.body.appendChild(popupContainer);

            // Event listeners
            document.getElementById('confirm-button').addEventListener('click', () => {
                const checkbox = document.getElementById('confirmation-checkbox');
                const startContainer = document.getElementById('start-container');
                if (checkbox.checked) {
                    startContainer.style.display = 'block';
                } else {
                    alert('Bevestig eerst dat je door wilt gaan.');
                }
            });

            document.getElementById('start-creation').addEventListener('click', () => this.createAllForaAndTopics());
        }

    }

    // ==================== //
    // FeestenFixed Manager //
    // ==================== //

    class FeestenFixedManager extends BaseManager {
        constructor(mainManager) {
            super(mainManager);
            this.isActive = false;
            this.container = null;
            this.box = null;
            this.initialized = false;
            this.interval = null;
            this.init();
        }

        init() {
            if (this.initialized) return;
            this.container = document.createElement('div');
            this.container.id = 'feestenfixed-container';
            this.container.style.position = 'fixed';
            this.container.style.top = '2px';
            this.container.style.right = '590px';
            this.container.style.zIndex = '100';
            this.container.style.display = 'none';
            document.body.appendChild(this.container);

            this.addStyles();
            this.createUIElements();
            this.initialized = true;
        }

        toggle(active) {
            this.isActive = active;
            if (this.isActive) {
                this.show();
                this.main.showNotification('Feesten Manager geactiveerd');
            } else {
                this.hide();
                this.main.showNotification('Feesten Manager gedeactiveerd');
            }
        }

        show() {
            if (!this.container) return;
            this.container.style.display = 'block';
            this.box.style.display = 'block'; // direct tonen
            this.isActive = true;
            this.refreshContent();
            this.interval = setInterval(() => this.refreshContent(), 10000);
        }

        hide() {
            if (!this.container) return;
            this.container.style.display = 'none';
            this.box.style.display = 'none';
            this.isActive = false;
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        }

        addStyles() {
            const styleElement = document.createElement('style');
            styleElement.textContent = `
    .feestenFixedBox {
        position: fixed;
        top: 2px;
        right: 590px;
        background-color: rgba(97, 81, 52, 0.95);
        width: 220px;
        max-height: 200px;
        overflow: auto;
        display: none;
        font-weight: bold;
        text-shadow: 1px 1px 2px #000;
        color: #FFCC66;
        font-size: 10px;
        line-height: 2.1;
        min-width: 30px;
        display: inline-block;
        text-align: left;
        z-index: 100; /* Lager dan popups, hoger dan standaard content */
    }
    .feestenFixedBox div {
        margin: 1px 0;
        padding: 1px;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
    }
    .feestenFixedBox a {
        color: #FF4444;
        text-decoration: none;
    }
    .feestenFixedBox a:hover {
        text-decoration: underline;
    }
    `;
            document.head.appendChild(styleElement);
        }

        createUIElements() {
            // Alleen de content box, geen knoppen
            this.box = document.createElement('div');
            this.box.className = 'feestenFixedBox';
            this.container.appendChild(this.box);
        }

        refreshContent() {
            if (!this.box || !this.isActive) return;

            this.box.innerHTML = '';

            try {
                const celebrations = Object.values(unsafeWindow.MM.getModels().Celebration || {});
                const towns = Object.values(unsafeWindow.ITowns.getTowns() || {});
                let hasContent = false;

                for (const town of towns) {
                    const townId = town.getId();
                    const townName = town.getName();
                    const theaterLevel = town.buildings()?.attributes?.theater || 0;
                    const academyLevel = town.buildings()?.attributes?.academy || 0;

                    const hasParty = celebrations.some(c =>
                                                       c.attributes?.town_id === townId &&
                                                       c.attributes?.celebration_type === 'party'
                                                      );

                    const hasTheater = celebrations.some(c =>
                                                         c.attributes?.town_id === townId &&
                                                         c.attributes?.celebration_type === 'theater'
                                                        );

                    let message = '';
                    if (theaterLevel === 1 && !hasTheater) {
                        message += 'Activeer theater ';
                    }
                    if (academyLevel >= 30 && !hasParty) {
                        message += 'Activeer SF ';
                    }

                    if (message) {
                        hasContent = true;
                        const townLink = this.generateTownLink(townId, townName);
                        const msgElement = document.createElement('div');
                        msgElement.innerHTML = `${townLink}: ${message}`;
                        this.box.insertBefore(msgElement, this.box.firstChild);
                    }
                }

                if (!hasContent) {
                    const defaultMsg = document.createElement('div');
                    defaultMsg.textContent = 'Alle SFs en theaters in gebruik';
                    this.box.appendChild(defaultMsg);
                }
            } catch (error) {
                const errorMsg = document.createElement('div');
                errorMsg.textContent = 'Fout bij ophalen data';
                errorMsg.style.color = '#FF4444';
                this.box.appendChild(errorMsg);
                console.error('FeestenFixed error:', error);
            }
        }

        generateTownLink(townId, townName) {
            const encodedData = btoa(JSON.stringify({
                id: townId,
                ix: 436,
                iy: 445,
                tp: 'town',
                name: townName
            }));
            return `<a href="#${encodedData}" class="gp_town_link">${townName}</a>`;
        }
    }

    // ========================= //
    // AttackRangeHelper Manager //
    // ========================= //

    class AttackRangeHelperManager extends BaseManager {
        constructor(mainManager) {
            super(mainManager);
            this.townInterval = null;
            this.rankingInterval = null;
            this.isActive = false;
            this.playerList = [];
            this.townsList = [];
            this.pPoints = 0;
        }

        async initialize() {
            try {
                this.setupRankingObserver();
                this.injectStyles();
                this.pPoints = await this.fetchPlayerPoints();
                this.playerList = await this.loadPlayerData();
                this.townsList = await this.loadTownData();
            } catch (error) {
                console.error("Fout bij initialiseren AttackRangeHelper:", error);
            }
        }

        toggle(active) {
            this.isActive = active;
            if (this.isActive) {
                this.start();
                this.main.showNotification("AttackRange Helper geactiveerd");
            } else {
                this.stop();
                this.main.showNotification("AttackRange Helper gedeactiveerd", false);
            }
        }

        async fetchPlayerPoints(maxTries = 5) {
            for (let i = 0; i < maxTries; i++) {
                const uw = this.uw;
                if (uw?.Game?.player_points) return uw.Game.player_points;
                if (uw?.Game?.player_data?.points) return uw.Game.player_data.points;
                if (uw?.grepolis?.player?.points) return uw.grepolis.player.points;

                const el = document.querySelector('.player_points');
                if (el) {
                    const val = parseInt(el.textContent.replace(/\D/g, ''), 10);
                    if (val > 0) return val;
                }
                await new Promise(res => setTimeout(res, 1000));
            }
            console.warn("Kon spelerspunten niet vaststellen");
            return 0;
        }

        async loadPlayerData() {
            try {
                const response = await fetch("/data/players.txt");
                const text = await response.text();
                return text.trim().split(/\r?\n/);
            } catch (error) {
                console.error("Fout bij laden spelersdata:", error);
                return [];
            }
        }

        async loadTownData() {
            try {
                const response = await fetch("/data/towns.txt");
                const text = await response.text();
                return text.trim().split(/\r?\n/);
            } catch (error) {
                console.error("Fout bij laden stedendata:", error);
                return [];
            }
        }

        start() {
            if (this.isActive) return;
            this.isActive = true;

            const waitForDOM = setInterval(() => {
                const shields = document.querySelectorAll(".city_shield");
                if (shields.length > 0) {
                    clearInterval(waitForDOM);
                    this.townColoring();
                    this.townInterval = setInterval(() => this.townColoring(), 2500);
                } else {
                    console.log("[AttackRangeHelper] Wacht op .city_shield elementen...");
                }
            }, 1000);
        }

        stop() {
            this.isActive = false;
            clearInterval(this.townInterval);
            clearInterval(this.rankingInterval);
            this.townInterval = null;
            this.rankingInterval = null;
            this.cleanupBlessings();
        }

        townColoring() {
            const towns = document.querySelectorAll('.flag.town');
            if (!towns.length) return;

            for (const town of towns) {
                try {
                    const shieldElement = town.parentElement.querySelector('.city_shield');
                    if (!shieldElement) continue;

                    const content = town.nextElementSibling?.getAttribute("href");
                    if (!content) continue;

                    const decoded = atob(content.substring(1));

                    const getValue = (key) => {
                        const regex = new RegExp(`"${key}":(\d+)`);
                        const match = decoded.match(regex);
                        return match ? match[1] : null;
                    };

                    const ix = getValue("ix");
                    const iy = getValue("iy");
                    const islandId = getValue("island");
                    if (!ix || !iy || !islandId) continue;

                    const search = `${ix},${iy},${islandId}`;
                    const townData = this.townsList.find(t => t.includes(search));
                    if (!townData) continue;

                    const townArr = townData.split(',');
                    const playerId = townArr[1];
                    const playerData = this.playerList.find(p => p.startsWith(playerId + ','));
                    if (!playerData) continue;

                    const playerArr = playerData.split(',');
                    const playerPoints = parseInt(playerArr[3], 10) || 0;

                    shieldElement.classList.remove(
                        "city_shield_blessing",
                        "o_city_shield_blessing",
                        "r_city_shield_blessing",
                        "g_city_shield_blessing",
                        "b_city_shield_blessing"
                    );

                    const isGhostTown = town.querySelector('.ghost') !== null;
                    const inRange = playerPoints >= this.pPoints * 0.8333 && playerPoints <= this.pPoints * 1.2;

                    let newClass = "city_shield_blessing";
                    if (!inRange) {
                        newClass = isGhostTown ? "o_city_shield_blessing" : "r_city_shield_blessing";
                    } else {
                        newClass = isGhostTown ? "g_city_shield_blessing" : "b_city_shield_blessing";
                    }

                    shieldElement.classList.add(newClass);

                } catch (err) {
                    console.error("Fout bij townColoring:", err);
                }
            }
        }

        cleanupBlessings() {
            document.querySelectorAll('.r_city_shield_blessing, .o_city_shield_blessing, .b_city_shield_blessing, .g_city_shield_blessing')
                .forEach(el => el.classList.remove(
                'r_city_shield_blessing', 'o_city_shield_blessing', 'b_city_shield_blessing', 'g_city_shield_blessing'
            ));
        }

        injectStyles() {
            const css = `
            .r_city_shield_blessing {
                background: url(https://i.ibb.co/W05MsxT/dr-city-shield-blessing-a1471e5.png) no-repeat 0 0 !important;
                width: 120px !important;
                height: 72px !important;
                pointer-events: none !important;
            }

            .o_city_shield_blessing {
                background: url(https://i.ibb.co/X8cn1fK/r-city-shield-blessing-a1471e5.png) no-repeat 0 0 !important;
                width: 120px !important;
                height: 72px !important;
                pointer-events: none !important;
            }

            .b_city_shield_blessing {
                background: url(https://i.ibb.co/9crM5x6/b-city-shield-blessing-a1471e5.png) no-repeat 0 0 !important;
                width: 120px !important;
                height: 72px !important;
                pointer-events: none !important;
            }

            .g_city_shield_blessing {
                background: url(https://i.ibb.co/6YmdJVk/g-city-shield-blessing-a1471e5.png) no-repeat 0 0 !important;
                width: 120px !important;
                height: 72px !important;
                pointer-events: none !important;
            }

        `;
            GM_addStyle(css);
        }

        setupRankingObserver() {
            const observer = new MutationObserver(() => {
                const rankingButtons = document.querySelectorAll('.ranking.main_menu_item');
                if (rankingButtons.length > 0) {
                    rankingButtons[0].addEventListener('click', () => {
                        this.startRankingColoring();
                    });
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        startRankingColoring() {
            this.rankingInterval = setInterval(() => this.colorRanking(), 1000);
        }

        colorRanking() {
            try {
                const points = document.querySelectorAll('.r_points');
                points.forEach(point => {
                    const value = parseInt(point.innerHTML.replace(/\D/g, ''), 10);
                    if (!value) return;

                    if (value < this.pPoints * 0.6666) {
                        point.style.color = 'red';
                    } else if (value < this.pPoints * 0.8333) {
                        point.style.color = 'orange';
                    } else if (value <= this.pPoints * 1.2) {
                        point.style.color = 'green';
                    } else {
                        point.style.color = 'blue';
                    }
                });
            } catch (err) {
                console.error('Fout bij kleuren ranglijst:', err);
            }
        }
    }

    // ============= //
    // Troop Manager //
    // ============= //

    class TroopManager {
        constructor(manager, supabaseConfig) {
            this.manager = manager;
            this.uw = unsafeWindow;
            this.world = window.location.host.split('.')[0];
            if (!this.world) this.world = "nl" + new Date().getFullYear().toString().slice(2);
            this.currentData = null;

            this.CONFIG = {
                SUPABASE_URL: supabaseConfig.SUPABASE_URL,
                SUPABASE_API_KEY: supabaseConfig.SUPABASE_API_KEY,
                UPLOAD_INTERVAL: 5 * 60 * 1000,
                TROOP_ICONS_URL: 'https://gpnl.innogamescdn.com/images/game/autogenerated/units/unit_icons_40x40_66aaef2.png'
            };

            // Troep icons
            this.troopIcons = {
                sword: '-320px 0', slinger: '-200px -280px', archer: '-40px -80px',
                hoplite: '-240px -40px', rider: '-40px -280px', chariot: '-160px -80px',
                catapult: '-120px -120px', minotaur: '-240px -240px', manticore: '0px -240px',
                zyklop: '-240px -320px', harpy: '-120px -200px', medusa: '-80px -240px',
                centaur: '-160px 0px', pegasus: '-280px -120px', cerberus: '-160px -40px',
                fury: '0px -200px', griffin: '-80px -200px', calydonian_boar: '-80px -120px',
                satyr: '-80px -280px', spartoi: '-280px -280px', ladon: '-240px -120px',
                godsent: '-40px -200px', militia: '-200px -240px',
                big_transporter: '0 -120px', bireme: '-40px -120px', attack_ship: '-120px -80px',
                demolition_ship: '-200px 0px', small_transporter: '-240px -280px',
                trireme: '-320px -200px', colonize_ship: '-40px -160px', sea_monster: '-120px -280px',
                siren: '-160px -240px'
            };

            // Vertalingen
            this.unitTranslations = {
                sword: 'Zwaardvechter',
                slinger: 'Slingeraar',
                archer: 'Boogschutter',
                hoplite: 'Hopliet',
                rider: 'Ruiter',
                chariot: 'Strijdwagen',
                catapult: 'Katapult',
                minotaur: 'Minotaurus',
                manticore: 'Manticore',
                zyklop: 'Cycloop',
                harpy: 'Harpij',
                medusa: 'Medusa',
                centaur: 'Centaur',
                pegasus: 'Pegasus',
                cerberus: 'Cerberus',
                fury: 'Erinys',
                griffin: 'Griffioen',
                calydonian_boar: 'Calydonisch varken',
                satyr: 'Sater',
                spartoi: 'Spartoi',
                ladon: 'Ladon',
                godsent: 'Godsgezant',
                militia: 'Militie',
                big_transporter: 'Transportboot',
                bireme: 'Bireem',
                attack_ship: 'Vuurschip',
                demolition_ship: 'Brander',
                small_transporter: 'Snel transportschip',
                trireme: 'Trireem',
                colonize_ship: 'Kolonisatieschip',
                sea_monster: 'Hydra',
                siren: 'Sirene'
            };

            this.setupStyles();
        }

        // Land units check
        isLandUnit(unit) {
            const landUnits = [
                'sword', 'slinger', 'archer', 'hoplite', 'rider',
                'chariot', 'catapult', 'minotaur', 'manticore',
                'zyklop', 'harpy', 'medusa', 'centaur', 'pegasus',
                'cerberus', 'fury', 'griffin', 'calydonian_boar',
                'satyr', 'spartoi', 'ladon', 'godsent', 'militia'
            ];
            return landUnits.includes(unit);
        }

        // Sea units check
        isSeaUnit(unit) {
            const seaUnits = [
                'big_transporter', 'bireme', 'attack_ship', 'demolition_ship',
                'small_transporter', 'trireme', 'colonize_ship', 'sea_monster', 'siren'
            ];
            return seaUnits.includes(unit);
        }

        async show() {
            try {
                const data = await this.fetchTroopData();
                if (!data) {
                    this.manager.showNotification("Geen troepdata gevonden.", false);
                    return;
                }
                this.displayAllDataInPopup(data);
            } catch (error) {
                console.error("Fout bij tonen troepen:", error);
                this.manager.showNotification("Fout bij tonen troepen.", false);
            }
        }

        // Icon styling
        getUnitIconStyle(unit) {
            return `background-image: url(${this.CONFIG.TROOP_ICONS_URL}); background-position: ${this.troopIcons[unit] || '0 0'};`;
        }

        showTroopDataInNewTab(data, title = 'Troepenoverzicht') {
            const newWindow = window.open('', '_blank');
            newWindow.document.write(`
        <html>
            <head><title>${title}</title></head>
            <body>
                ${this.generateTroopDataHTML(data)}
            </body>
        </html>
    `);
            newWindow.document.close();
        }

        // Data display functions
        displayAllDataInPopup(data) {
            this.manager.toggleMainWindow();
            const popup = document.getElementById('forum-popup');
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'tm-single-column';

            const grouped = this.groupDataByPlayer(data);

            for (const playerName in grouped) {
                const playerGroup = grouped[playerName];
                const playerInfo = data.PlayerCL.find(p => p.playerName === playerName) || {};

                contentWrapper.innerHTML += `
                <div class="tm-player-block">
                    <h3>${playerName}</h3>
                    <div>Culture Level: ${playerInfo.cultureLevel || '?'}</div>
                    <div>Steden: ${playerInfo.playerVillages || playerGroup.length}</div>
                    <div>Vrije slotjes: ${playerInfo.openSlots ?? '?'}</div>
                    <hr>
                </div>
            `;

                playerGroup.forEach((entry) => {
                    const wall = entry.wall || {};
                    const home = entry.home?.units || {};
                    const away = entry.away?.units || {};
                    const support = entry.support?.units || {};

                    contentWrapper.innerHTML += `
                    <div class="tm-city-block">
                        <strong>Stad:</strong> ${wall.town || 'Onbekend'}<br>
                        Muur: ${wall.wall || 'N/A'}<br>
                        Toren: ${wall.tower ? 'Ja' : 'Nee'}<br>
                        Falanx: ${wall.phalanx ? 'Actief' : 'Inactief'}<br>
                        God: ${wall.god || 'Onbekend'}
                    </div>
                    ${this.renderTroopCategory('Aanwezige troepen', home)}
                    ${this.renderTroopCategory('Troepen buiten', away)}
                    ${this.renderTroopCategory('Ondersteunende troepen', support)}
                    ${this.renderOtherUnitsCategory(home, away, support)}
                    <hr>
                `;
                });
            }

            popup.appendChild(contentWrapper);
            document.body.appendChild(popup);
        }

        async showControlPanel() {
            let popup = document.getElementById('gm-popup');
            if (!popup) {
                popup = document.createElement('div');
                popup.id = 'gm-popup';
                popup.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #1e1e1e;
                    border: 2px solid #FF0000;
                    border-radius: 10px;
                    padding: 20px;
                    color: white;
                    z-index: 10001;
                    box-shadow: 0 0 15px #FF0000;
                    width: 450px;
                    height: 200px;
                    overflow-y: auto;
                `;
                document.body.appendChild(popup);

                const contentDiv = document.createElement('div');
                contentDiv.id = 'popup-content';
                popup.appendChild(contentDiv);
            }

            const content = document.getElementById('popup-content');
            content.innerHTML = `
            <h2>Troop Manager</h2>
            <div style="display: grid; gap: 15px; margin: 20px 0;">
                <!-- Toon troepen -->
                <div style="border: 1px solid #FF0000; padding: 10px; border-radius: 5px;">
                    <h3 style="color: #FF0000;">Toon troepen</h3>
                    <select id="player-select" style="padding: 5px; margin-bottom: 10px;">
                        <option value="">Laden...</option>
                    </select>
                    <button id="show-player-data" class="troop-btn">Toon Data</button>
                    <button id="export-all-data" class="troop-btn">Exporteer Alles</button>
                </div>
            </div>
            <div id="troop-data-container"></div>
        `;

            // Laad spelerslijst
            await this.loadPlayerDropdown();

            // Event listeners

            document.getElementById('show-player-data').addEventListener('click', async () => {
                const select = document.getElementById('player-select');
                const selectedPlayer = select.value;

                if (!selectedPlayer) {
                    this.manager.showNotification("Selecteer eerst een speler", false);
                    return;
                }

                if (selectedPlayer === "-ALL-") {
                    await this.showAllPlayersData();
                } else {
                    const data = await this.fetchPlayerDataFromSupabase(selectedPlayer);
                    if (data) {
                        this.showTroopDataInNewTab(data, `${selectedPlayer}'s Troepen`);
                    } else {
                        this.manager.showNotification("Geen data gevonden voor deze speler", false);
                    }
                }
            });

            document.getElementById('export-all-data').addEventListener('click', this.exportAllData.bind(this));
        }

        async loadPlayerDropdown() {
            const select = document.getElementById('player-select');
            try {
                const players = await this.fetchAvailablePlayers();
                select.innerHTML = `
                <option value="">-- Selecteer een speler --</option>
                <option value="-ALL-">-- Toon Alles --</option>
                ${players.map(player => `
                    <option value="${player}">${player}</option>
                `).join('')}
            `;
            } catch (error) {
                console.error("Fout bij laden spelers:", error);
                select.innerHTML = `
                <option value="">Fout bij laden spelerslijst</option>
            `;
            }
        }

        async fetchAvailablePlayers() {
            try {
                const url = `${this.CONFIG.SUPABASE_URL}/rest/v1/troepen?select=player,world`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'apikey': this.CONFIG.SUPABASE_API_KEY,
                        'Authorization': `Bearer ${this.CONFIG.SUPABASE_API_KEY}`
                    }
                });

                if (!response.ok) throw new Error(`Fout bij ophalen spelers`);
                const result = await response.json();

                return result
                    .filter(entry =>
                            (entry.world || '').trim().toLowerCase() === this.world.trim().toLowerCase()
                           )
                    .map(entry => entry.player);
            } catch (error) {
                return [];
            }
        }

        async fetchPlayerDataFromSupabase(playerName) {
            try {
                const url = `${this.CONFIG.SUPABASE_URL}/rest/v1/troepen?select=player,world,data&player=eq.${encodeURIComponent(playerName)}&world=eq.${encodeURIComponent(this.world)}`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'apikey': this.CONFIG.SUPABASE_API_KEY,
                        'Authorization': `Bearer ${this.CONFIG.SUPABASE_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error(`Fout bij ophalen data`);
                const result = await response.json();
                return result.length > 0 ? result[0].data : null;
            } catch (error) {
                return null;
            }
        }

        async showAllPlayersData() {
            try {
                const allData = await this.fetchAllPlayersData();
                if (!allData.length) {
                    this.manager.showNotification("Geen spelerdata gevonden", false);
                    return;
                }

                const newWindow = window.open('', '_blank');
                newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Alle Troep Data - ${new Date().toLocaleString()}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #FF0000; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .unit-icon {
                        display: inline-block;
                        width: 40px;
                        height: 40px;
                        background-image: url(${this.CONFIG.TROOP_ICONS_URL});
                        position: relative;
                    }
                    .unit-count {
                        position: absolute;
                        bottom: 2px;
                        right: 2px;
                        background: rgba(0,0,0,0.7);
                        color: white;
                        padding: 2px 5px;
                        border-radius: 3px;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <h1>Troep Data - Alle Spelers</h1>
                    ${allData.map(playerData => `
                        <div style="page-break-after: always;">
                            ${this.generateTroopDataHTML(playerData.data)}
                        </div>
                    `).join('')}
                </body>
                </html>
            `);
                newWindow.document.close();
            } catch (error) {
                console.error("Fout bij ophalen alle data:", error);
                this.manager.showNotification("Fout bij laden alle data", false);
            }
        }

        async fetchAllPlayersData() {
            try {
                const url = `${this.CONFIG.SUPABASE_URL}/rest/v1/troepen?select=player,world,data&world=eq.${encodeURIComponent(this.world)}`;
                const response = await fetch(url, {
                    headers: {
                        "apikey": this.CONFIG.SUPABASE_API_KEY,
                        "Authorization": `Bearer ${this.CONFIG.SUPABASE_API_KEY}`
                    }
                });

                if (!response.ok) throw new Error("Kon alle spelerdata niet ophalen");
                return await response.json();
            } catch (error) {
                return [];
            }
        }

        async exportAllData() {
            try {
                const allData = await this.fetchAllPlayersData();
                if (!allData.length) {
                    this.manager.showNotification("Geen data om te exporteren", false);
                    return;
                }

                let csvContent = 'Speler,Culture Level,Steden,Stad,Muur,Toren,Falanx,God,Unit Type,Unit,Count\n';

                allData.forEach(item => {
                    item.data.PlayerCL.forEach(player => {
                        item.data.Wall.forEach((wall, index) => {
                            const troops = item.data.Troepen[index] || { units: {} };
                            Object.entries(troops.units).forEach(([unit, count]) => {
                                csvContent += [
                                    `"${player.playerName}"`,
                                    player.cultureLevel,
                                    player.playerVillages,
                                    `"${wall?.town || 'Unknown'}"`,
                                    wall?.wall || 'N/A',
                                    wall?.tower ? 'Yes' : 'No',
                                    wall?.phalanx ? 'Yes' : 'No',
                                    `"${wall?.god || ''}"`,
                                    this.isLandUnit(unit) ? 'Land' : (this.isSeaUnit(unit) ? 'Sea' : 'Other'),
                                    `"${unit}"`,
                                    count
                                ].join(',') + '\n';
                            });
                        });
                    });
                });

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `alle_troepen_export_${new Date().toISOString().slice(0,10)}.csv`;
                link.click();
            } catch (error) {
                console.error("Export fout:", error);
                this.manager.showNotification("Export mislukt", false);
            }
        }

        generateTroopDataHTML(data) {
            const grouped = this.groupDataByPlayer(data);
            let html = '';

            for (const playerName in grouped) {
                const playerGroup = grouped[playerName];
                const playerInfo = data.PlayerCL.find(p => p.playerName === playerName) || {};

                html += `
                <div style="margin-bottom: 30px;">
                    <h2>${playerName}</h2>
                    <p>
                        <strong>Culture Level:</strong> ${playerInfo.cultureLevel || '?'} |
                        <strong>Steden:</strong> ${playerInfo.playerVillages || playerGroup.length} |
                        <strong>Vrije slotjes:</strong> ${playerInfo.openSlots ?? '?'}
                    </p>
            `;

                playerGroup.forEach((entry, index) => {
                    const wall = entry.wall || {};
                    const home = entry.home?.units || {};
                    const away = entry.away?.units || {};
                    const support = entry.support?.units || {};

                    html += `
                    <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                        <h3>Stad ${index + 1}: ${wall.town || 'Onbekend'}</h3>
                        <p>
                            <strong>Muur:</strong> ${wall.wall || 'N/A'} |
                            <strong>Toren:</strong> ${wall.tower ? 'Ja' : 'Nee'} |
                            <strong>Falanx:</strong> ${wall.phalanx ? 'Actief' : 'Inactief'} |
                            <strong>God:</strong> ${wall.god || 'Onbekend'}
                        </p>

                        ${this.generateTroopCategoryHTML('Aanwezige troepen', home)}
                        ${this.generateTroopCategoryHTML('Troepen buiten', away)}
                        ${this.generateTroopCategoryHTML('Ondersteunende troepen', support)}
                        ${this.generateOtherUnitsHTML(home, away, support)}
                    </div>
                `;
                });

                html += `</div>`;
            }

            return html;
        }

        generateTroopCategoryHTML(title, units) {
            const landUnits = Object.entries(units).filter(([unit]) => this.isLandUnit(unit));
            const seaUnits = Object.entries(units).filter(([unit]) => this.isSeaUnit(unit));

            return `
            <div style="margin-bottom: 15px;">
                <h4>${title}</h4>
                ${landUnits.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px;">
                        ${landUnits.map(([unit, count]) => `
                            <div class="unit-icon" style="background-position: ${this.troopIcons[unit] || '0 0'}"
                                 title="${this.getUnitDescription(unit)}">
                                <div class="unit-count">${count}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>Geen eenheden</p>'}

                ${seaUnits.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${seaUnits.map(([unit, count]) => `
                            <div class="unit-icon" style="background-position: ${this.troopIcons[unit] || '0 0'}"
                                 title="${this.getUnitDescription(unit)}">
                                <div class="unit-count">${count}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        }

        generateOtherUnitsHTML(...unitSets) {
            const combined = Object.assign({}, ...unitSets);
            const otherUnits = Object.entries(combined)
            .filter(([unit]) => !this.isLandUnit(unit) && !this.isSeaUnit(unit))
            .filter(([_, count]) => count > 0);

            return `
            <div style="margin-bottom: 15px;">
                <h4>Andere eenheden</h4>
                <div style="padding-left: 15px;">
                    ${otherUnits.length > 0 ?
                otherUnits.map(([unit, count]) => `
                            <p>${this.getUnitName(unit)}: ${count}</p>
                        `).join('') :
            '<p>Geen andere eenheden</p>'
        }
                </div>
            </div>
        `;
        }

        renderTroopCategory(title, units) {
            const landUnits = Object.entries(units).filter(([unit]) => this.isLandUnit(unit));
            const seaUnits = Object.entries(units).filter(([unit]) => this.isSeaUnit(unit));

            return `
            <div class="tm-troop-category">
                <h4>${title}</h4>
                ${landUnits.length > 0 ? `
                    <div class="tm-units-row">
                        ${landUnits.map(([unit, count]) => this.renderUnitIcon(unit, count)).join('')}
                    </div>
                ` : ''}
                ${seaUnits.length > 0 ? `
                    <div class="tm-units-row">
                        ${seaUnits.map(([unit, count]) => this.renderUnitIcon(unit, count)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        }

        renderOtherUnitsCategory(...unitSets) {
            const combined = Object.assign({}, ...unitSets);
            const otherUnits = Object.entries(combined)
            .filter(([unit]) => !this.isLandUnit(unit) && !this.isSeaUnit(unit))
            .filter(([_, count]) => count > 0);

            return `
            <div class="tm-troop-category">
                <h4>Andere eenheden</h4>
                <div class="tm-other-list">
                    ${otherUnits.length > 0 ?
                otherUnits.map(([unit, count]) => `
                            <div class="tm-other-line">${this.getUnitName(unit)} – ${count}</div>
                        `).join('') :
            '<div class="tm-no-units">Geen eenheden</div>'
        }
                </div>
            </div>
        `;
        }

        renderUnitIcon(unit, count) {
            return `
            <div class="tm-unit" style="${this.getUnitIconStyle(unit)}" title="${this.getUnitDescription(unit)}">
                <div class="tm-unit-count">${count}</div>
            </div>
        `;
        }

        getUnitDescription(unit) {
            return this.unitTranslations[unit] || 'Geen beschrijving beschikbaar';
        }

        getUnitName(unitKey) {
            return this.unitTranslations[unitKey] || unitKey;
        }

        // Export system
        exportToExcel() {
            if (!this.currentData) {
                this.manager.showNotification('No data available to export', false);
                return;
            }

            try {
                const csvContent = this.formatCSVData(this.currentData);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `troop_export_${new Date().toISOString().slice(0,10)}.csv`;
                link.click();
                this.manager.showNotification('Export started successfully!');
            } catch (error) {
                console.error('Export error:', error);
                this.manager.showNotification(`Export failed: ${error.message}`, false);
            }
        }

        formatCSVData(data) {
            let csv = 'Player,Culture Level,Villages,Open Slots,Town,Wall,Tower,Phalanx,God,Unit Type,Unit,Count\n';

            data.PlayerCL.forEach(player => {
                data.Wall.forEach((wall, index) => {
                    const troops = data.Troepen[index] || { units: {} };
                    Object.entries(troops.units).forEach(([unit, count]) => {
                        csv += [
                            `"${player.playerName}"`,
                            player.cultureLevel,
                            player.playerVillages,
                            player.openSlots,
                            `"${wall?.town || 'Unknown'}"`,
                            wall?.wall || 'N/A',
                            wall?.tower ? 'Yes' : 'No',
                            wall?.phalanx ? 'Yes' : 'No',
                            `"${wall?.god || ''}"`,
                            this.isLandUnit(unit) ? 'Land' : (this.isSeaUnit(unit) ? 'Sea' : 'Other'),
                            `"${unit}"`,
                            count
                        ].join(',') + '\n';
                    });
                });
            });

            return csv;
        }

        async performUpload() {
            try {
                const playerName = this.getPlayerName();
                await this.deleteOldDataFromSupabase(playerName);
                await this.uploadDataToSupabase(troopData, playerName);
                this.manager.showNotification('Upload gelukt');
            } catch (error) {
                this.manager.showNotification(`Upload faalde: ${error.message}`, false);
            }
        }

        async deleteOldDataFromSupabase(playerName) {
            try {
                const url = `${this.CONFIG.SUPABASE_URL}/rest/v1/troepen?player=eq.${encodeURIComponent(playerName)}`;
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'apikey': this.CONFIG.SUPABASE_API_KEY,
                        'Authorization': `Bearer ${this.CONFIG.SUPABASE_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal' // sneller
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Supabase DELETE failed: ${errorText}`);
                }

                console.log(`[SUPABASE] Oude data verwijderd voor speler: ${playerName}`);
            } catch (error) {
                console.error('Fout bij verwijderen van oude data:', error);
            }
        }


        // Voeg deze nieuwe methodes toe:

        startAutoUploader() {
            this.autoUploader = setInterval(() => {
                this.uploadTroopData().catch(e => console.warn("Upload mislukt:", e));
            }, this.CONFIG.UPLOAD_INTERVAL);

            // Upload bij start ook meteen
            this.uploadTroopData().catch(e => console.warn("Initiële upload mislukt:", e));
        }

        async uploadTroopData() {
            try {
                const data = await this.fetchTroopData(); // deze moet ook bestaan
                const playerName = this.uw.Game.player_name || "Onbekend";
                await this.uploadDataToSupabase(data, playerName);
                console.log('[TroopManager] Troepen automatisch geüpload naar Supabase');
            } catch (e) {
                console.error('[TroopManager] Automatische upload mislukt:', e);
            }
        }

        setupAutoUpload() {
            function calculateNextUpload() {
                const now = new Date();
                const nextUpload = new Date(now);
                nextUpload.setMinutes(Math.ceil(now.getMinutes() / 5) * 5);
                nextUpload.setSeconds(0);
                nextUpload.setMilliseconds(0);
                return nextUpload - now;
            }

            const performUpload = async () => {
                try {
                    const playerName = this.getPlayerName();
                    const troopData = await this.fetchTroopData();
                    await this.uploadDataToSupabase(troopData, playerName);
                    this.manager.showNotification('Auto-upload successful!');
                } catch (error) {
                    console.error('Auto-upload error:', error);
                    this.manager.showNotification(`Upload failed: ${error.message}`, false);
                }
            };

            setTimeout(() => {
                performUpload();
                setInterval(performUpload, this.CONFIG.UPLOAD_INTERVAL);
            }, calculateNextUpload());
        }

        async uploadDataToSupabase(data, playerName) {
            try {
                const payload = {
                    player: playerName,
                    world: this.world,
                    data: data
                };

                const url = `${this.CONFIG.SUPABASE_URL}/rest/v1/troepen?on_conflict=player,world`;
                const headers = {
                    'apikey': this.CONFIG.SUPABASE_API_KEY,
                    'Authorization': `Bearer ${this.CONFIG.SUPABASE_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=representation'
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify([payload])
                });

                if (!response.ok) throw new Error(`Upsert mislukt`);
            } catch (error) {}
        }

        // Data handling functions
        async fetchTroopData() {
            const playerName = this.uw.Game.player_name || "onbekend";
            const data = {
                HomeTroops: [],
                AwayTroops: [],
                SupportInCity: [],
                PlayerCL: [],
                Wall: [],
                IDs: [],
                Troepen: [],
                timestamp: new Date().toISOString()
            };

            try {
                // Get culture level
                const cldata = this.uw.TooltipFactory.getCultureOverviewTooltip()?.split('<br />') || [];
                const cl = parseInt(cldata[1]?.replace(/<b>.*?<\/b>/g, '').trim()) || 0;
                const open_slots = cl - (this.uw.Game.player_villages || 0);

                data.PlayerCL.push({
                    playerName: playerName,
                    playerVillages: this.uw.Game.player_villages || 0,
                    cultureLevel: cl,
                    openSlots: open_slots
                });

                // Get towns data
                const towns = this.uw.ITowns?.towns || {};
                for (const townId in towns) {
                    const town = towns[townId];
                    if (!town) continue;

                    data.HomeTroops.push({
                        playerName: playerName,
                        townName: town.name,
                        units: town.units?.() || {}
                    });

                    data.AwayTroops.push({
                        playerName: playerName,
                        townName: town.name,
                        units: town.unitsOuter?.() || {}
                    });

                    data.SupportInCity.push({
                        playerName: playerName,
                        townName: town.name,
                        units: town.unitsSupport?.() || {}
                    });

                    data.IDs.push({
                        town: town.name,
                        id: town.id
                    });

                    const townObj = this.uw.ITowns.getTown?.(town.id);
                    data.Wall.push({
                        player: playerName,
                        town: town.name,
                        wall: townObj?.getBuildings?.()?.attributes?.wall || 0,
                        phalanx: townObj?.getResearches?.()?.get?.("phalanx") || false,
                        tower: townObj?.getBuildings?.()?.get?.("tower") || false,
                        god: townObj?.god?.() || 'Unknown'
                    });
                }

                // Get all units
                const allUnits = this.uw.ITowns?.all_units?.fragments || {};
                for (const fragmentId in allUnits) {
                    const fragment = allUnits[fragmentId];
                    if (!fragment?.models) continue;

                    for (const modelId in fragment.models) {
                        const model = fragment.models[modelId];
                        const units = model?.attributes || {};

                        const filteredUnits = {};
                        for (const unit in units) {
                            if (typeof units[unit] === "number" && units[unit] > 0) {
                                filteredUnits[unit] = units[unit];
                            }
                        }

                        if (Object.keys(filteredUnits).length > 0) {
                            data.Troepen.push({
                                player: playerName,
                                units: filteredUnits
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching troop data:', error);
                throw error;
            }

            return data;
        }

        groupDataByPlayer(data) {
            const grouped = {};

            // Controleer of data.IDs bestaat en is een array
            const ids = data.IDs || [];
            const troops = data.Troepen || [];
            const walls = data.Wall || [];
            const homeTroops = data.HomeTroops || [];
            const awayTroops = data.AwayTroops || [];
            const supportTroops = data.SupportInCity || [];

            for (let i = 0; i < ids.length; i++) {
                const player = troops[i]?.player || 'Unknown';

                if (!grouped[player]) {
                    grouped[player] = [];
                }

                grouped[player].push({
                    wall: walls[i] || {},
                    home: homeTroops[i] || { units: {} },
                    away: awayTroops[i] || { units: {} },
                    support: supportTroops[i] || { units: {} }
                });
            }

            return grouped;
        }

        // Helper functions
        getPlayerName() {
            if (!this.uw.Game?.player_name) {
                throw new Error("Could not get player name");
            }
            return this.uw.Game.player_name.startsWith('.') ?
                this.uw.Game.player_name.substring(1) :
            this.uw.Game.player_name;
        }

        setupStyles() {
            // Wait for the DOM to be fully loaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.injectStyles());
            } else {
                this.injectStyles();
            }
        }

        injectStyles() {
            const styleElement = document.createElement('style');
            styleElement.textContent = `
            .tm-grid {
                display: grid;
                gap: 20px;
                padding: 15px;
            }

            .tm-troops-col {
                width: 520px;
                flex-shrink: 0;
            }

            .tm-player-card,
            .tm-city-section,
            .tm-troop-section {
                width: 520px;
                min-height: 110px;
                background: #1dcae0;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
            }

            .tm-unit {
                font: 700 12px Verdana, Arial, Helvetica, sans-serif;
                user-select: none;
                vertical-align: middle;
                width: 39px;
                height: 40px;
                position: relative;
                display: inline-block;
                text-align: right;
                margin: 1px;
                text-shadow: 1px 1px 0 #000;
                cursor: pointer;
                box-shadow: inset 0 0 4px #000;
                background-image: url(${this.CONFIG.TROOP_ICONS_URL});
            }

            .tm-unit:hover {
                transform: scale(1.1);
                z-index: 100;
            }

            .tm-unit-count {
                position: absolute;
                bottom: 2px;
                right: 2px;
                padding: 2px 5px;
                border-radius: 3px;
                font-size: 11px;
                background-color: rgba(0,0,0,0.5);
                color: white;
            }

            .tm-units-row {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                padding: 5px 0;
            }

            .tm-filters {
                display: flex;
                gap: 10px;
                padding: 15px;
                background: #1dcae0;
                border-radius: 8px;
                margin-bottom: 20px;
            }

            .tm-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s;
                font-weight: bold;
                color: white;
            }

            .tm-btn:hover {
                opacity: 0.9;
            }

            .tm-download {
                background: #17d117;
            }

            .tm-export {
                background: #cf1717;
            }

            .tm-close {
                background: #db1a1a;
            }

            .tm-close-btn {
                position: absolute;
                top: 10px;
                right: 15px;
                font-size: 24px;
                cursor: pointer;
                color: #ffd700;
            }

            .tm-close-btn:hover {
                color: #ff0000;
            }

            .tm-troop-category {
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #fc6;
            }

            .tm-troop-category h4 {
                margin: 0 0 10px 0;
                color: #ffd700;
            }

            .tm-other-list {
                padding: 5px 0 0 10px;
            }

            .tm-other-line {
                font-family: Verdana, sans-serif;
                font-size: 13px;
                line-height: 1.5;
                color: #ffd700;
                margin-bottom: 5px;
            }

            .tm-no-units {
                font-style: italic;
                color: #aaa;
            }

            .tm-single-column {
                display: flex;
                flex-direction: column;
                gap: 20px;
                font-family: Verdana, sans-serif;
                font-size: 13px;
                color: #ffd700;
            }

            .tm-player-block {
                padding: 15px;
                background: #1dcae0;
                border-radius: 6px;
                border: 1px solid #fc6;
            }

            .tm-city-block {
                padding: 15px;
                background: #113344;
                border-radius: 6px;
                margin-bottom: 15px;
                border: 1px solid #fc6;
            }

            #troopManagerPopup,
            #troopDataPopup {
                color: #ffd700 !important;
                font-family: Verdana, sans-serif;
            }

            .grep-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 20px;
                background-color: #4CAF50;
                color: white;
                border-radius: 4px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                font-family: Arial, sans-serif;
                animation: fadeIn 0.3s;
            }

            .grep-notification.error {
                background-color: #F44336;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
            if (document.head) {
                document.head.appendChild(styleElement);
            } else {
                console.error('Document head not found');
            }
        }

        toggle(active) {
            const popup = document.getElementById('gm-popup');
            if (active) {
                this.showControlPanel();
                this.manager.showNotification("Troop Manager geactiveerd");
            } else {
                if (popup) popup.remove();
                this.manager.showNotification("Troop Manager gedeactiveerd", false);
            }
        }

    }

    // ===================== //
    // Afwezigheidsassistent //
    // ===================== //

    function injectAfwezigheidsassistent() {
        if (document.getElementById('afwezigheid-ui')) return;

        console.log('[GrepolisManager] Afwezigheidsassistent injectie gestart');

        const ui = document.createElement('div');
        ui.id = 'afwezigheid-ui';
        ui.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin: 20px;
        padding: 10px;
        background: #2c2c2c;
        border: 1px solid #FF0000;
        border-radius: 5px;
        color: white;
        position: fixed;
        top: 50px;
        left: 50px;
        z-index: 9999;
    `;

        const naam = document.createElement('input');
        naam.placeholder = 'Speler';
        naam.value = unsafeWindow.Game?.player_name || '';
        naam.style.width = '120px';
        ui.appendChild(naam);

        const van = document.createElement('input');
        van.type = 'date';
        ui.appendChild(van);

        const tot = document.createElement('input');
        tot.type = 'date';
        ui.appendChild(tot);

        const vm = document.createElement('input');
        vm.type = 'checkbox';
        vm.title = 'Vakantiemodus aan?';
        ui.appendChild(vm);

        const opmerking = document.createElement('input');
        opmerking.placeholder = 'Opmerking';
        opmerking.style.width = '160px';
        ui.appendChild(opmerking);

        const knop = document.createElement('button');
        knop.textContent = 'Voeg toe';
        knop.style.cssText = 'background:#f00;color:white;padding:5px;';
        ui.appendChild(knop);

        document.body.appendChild(ui);

        knop.addEventListener('click', async () => {
            if (!van.value || !tot.value) {
                alert('Start- en einddatum zijn verplicht');
                return;
            }

            // Zoek de eerste bewerkbare post op de pagina
            const editBtn = Array.from(document.querySelectorAll('a')).find(a =>
                                                                            a.textContent.includes('Bewerken') && a.getAttribute('onclick')?.includes('Forum.postEdit')
                                                                           );

            if (!editBtn) {
                alert('Geen Bewerken-knop gevonden op deze pagina');
                return;
            }

            editBtn.click(); // Simuleer klik op Bewerken

            // Wacht tot textarea verschijnt
            let textarea = null;
            const start = Date.now();
            while (!textarea && Date.now() - start < 5000) {
                textarea = document.querySelector('#forum_post_textarea:not([style*="display: none"])');
                await new Promise(res => setTimeout(res, 100));
            }

            if (!textarea) {
                alert('Kon tekstveld niet laden');
                return;
            }

            const newRow = `[*][player]${naam.value}[/player][|]${van.value}[|]${tot.value}[|]${vm.checked ? 'Ja' : 'Nee'}[|]${opmerking.value || '-'}[/*]\n`;
            if (textarea.value.includes('[/table]')) {
                textarea.value = textarea.value.replace('[/table]', `${newRow}[/table]`);
            } else {
                textarea.value += `\n${newRow}`;
            }

            // Zoek Opslaan-knop
            const saveBtn = Array.from(document.querySelectorAll('#post_save_form a')).find(a =>
                                                                                            a.textContent.toLowerCase().includes('opslaan')                                                                      );
            if (saveBtn) saveBtn.click();

            // Reset velden
            van.value = '';
            tot.value = '';
            vm.checked = false;
            opmerking.value = '';
        });
    }

    // ============= //
    // map creator   //
    // ============= //

    class MapDataLoader {
        constructor(world) {
            this.world = world;
            this.baseUrl = `https://${world}.grepolis.com/data`;
        }

        static detectWorld() {
            const hostMatch = window.location.host.match(/^(.*?)\.grepolis\.com/);
            return hostMatch ? hostMatch[1] : null;
        }

        async loadTowns() {
            const url = `${this.baseUrl}/towns.txt`;
            const text = await this.gmFetch(url);
            return this.parseTowns(text);
        }

        gmFetch(url) {
            return new Promise((resolve, reject) => {
                GM.xmlHttpRequest({
                    method: "GET",
                    url,
                    onload: res => resolve(res.responseText),
                    onerror: reject
                });
            });
        }

        parseTowns(text) {
            return text.trim().split('\n').map(line => {
                const [id, player_id, x, y, name, island_x, island_y] = line.split(';');
                return { id, player_id, x, y, name, island_x, island_y };
            });
        }
    }

    class CanvasMap {
        constructor(container, towns) {
            this.container = container;
            this.towns = towns;
            this.zoom = 1.0;
            this.scale = 1.6;
            this.offsetX = 0;
            this.offsetY = 0;
            this.dragging = false;
            this.lastMouse = null;
            this.canvas = document.createElement('canvas');
            this.canvas.width = 2000;
            this.canvas.height = 1600;
            this.ctx = this.canvas.getContext('2d');
            this.container.appendChild(this.canvas);

            this.attachEvents();
            this.draw();
        }

        attachEvents() {
            this.canvas.addEventListener('mousedown', (e) => {
                this.dragging = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
            });
            window.addEventListener('mouseup', () => this.dragging = false);
            this.canvas.addEventListener('mousemove', (e) => {
                if (!this.dragging) return;
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                this.draw();
            });
            this.canvas.addEventListener('wheel', (e) => {
                const scale = e.deltaY < 0 ? 1.2 : 0.8;
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const worldX = (mouseX - this.offsetX) / this.zoom;
                const worldY = (mouseY - this.offsetY) / this.zoom;
                this.zoom *= scale;
                const newMouseX = worldX * this.zoom + this.offsetX;
                const newMouseY = worldY * this.zoom + this.offsetY;
                this.offsetX += mouseX - newMouseX;
                this.offsetY += mouseY - newMouseY;
                this.draw();
            });
        }

        draw() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = "#003366";
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.save();
            ctx.translate(this.offsetX, this.offsetY);
            ctx.scale(this.zoom, this.zoom);

            // Grid
            ctx.strokeStyle = '#336699';
            for (let i = 0; i <= 2000; i += 100) {
                ctx.beginPath(); ctx.moveTo(i * this.scale, 0); ctx.lineTo(i * this.scale, 2000 * this.scale); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i * this.scale); ctx.lineTo(2000 * this.scale, i * this.scale); ctx.stroke();
            }

            // Steden
            for (const town of this.towns) {
                if (!town.x || !town.y) continue;
                const x = parseFloat(town.x) * this.scale;
                const y = parseFloat(town.y) * this.scale;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = town.player_id === "0" ? "#ccc" : "#ffcc00";
                ctx.fill();
            }

            ctx.restore();
        }
    }

    class MapManager {
        constructor(mainManager) {
            this.main = mainManager;
        }

        async toggle(active) {
            if (!active) return;
            const world = MapDataLoader.detectWorld();
            const loader = new MapDataLoader(world);
            const towns = await loader.loadTowns();
            const win = window.open('', '_blank');
            win.document.write(`<html><head><title>Kaart</title><style>body{margin:0;}</style></head>
        <body><div id="mapContainer"></div>
        <script>${CanvasMap.toString()}</script>
        <script>
            const towns = ${JSON.stringify(towns)};
            (function() {
                new CanvasMap(document.body, towns);
            })();
        <\/script></body></html>`);
            win.document.close();
        }
    }

    // ======================== //
    // Transportboot Capaciteit //
    // ======================== //

    const TransporterCapacity = {
        interval: null,

        activate() {
            try {
                // Voeg CSS toe als nog niet aanwezig

                if (!document.getElementById('transporter_capacity_style')) {
                    const style = `
                        #transporter_capacity.cont, #big_transporter.cont {
                            background: url("https://gpnl.innogamescdn.com/images/game/layout/layout_units_nav_border.png");
                            height: 25px;
                            cursor: pointer;
                            margin-bottom: 3px;
                            display: flex;
                            align-items: center;
                            padding: 0 6px;
                        }
                        .trans_ship_icon {
                            background: #ffcc66;
                            border-radius: 4px;
                            padding: 2px;
                            display: inline-flex;
                            align-items: center;
                            margin-right: 3px;
                            position: relative;
                        }
                        #trans_ship, #big_ship {
                            font-weight: bold;
                            text-shadow: 1px 1px 2px #000;
                            color: #FFCC66;
                            font-size: 10px;
                            line-height: 2.1;
                            min-width: 48px;
                            display: inline-block;
                            text-align: left;
                        }
                        .transporter_checkbox {
                            margin-left: 50px;
                            vertical-align: middle;
                            accent-color: #ffcc66;
                            width: 14px;
                            height: 14px;
                            position: absolute;
                            left: 50px;
                            top: 2px;
                        }
                        .transporter_row {
                            display: flex;
                            align-items: center;
                            gap: 3px;
                            height: 22px;
                        }
                    `;
                    $("<style id='transporter_capacity_style'>" + style + "</style>").appendTo('head');
                }

                // HTML
                if ($("#transporter_capacity").length === 0) {
                    $(
                        '<div id="transporter_capacity" class="cont">' +
                        '<div class="transporter_row">' +
                        '<span class="trans_ship_icon" style="position:relative;">' +
                        '<img id="trans_ship_img" class="ico" src="https://imgur.com/f7mTajn.png" style="width:18px;height:18px;">' +
                        '<input type="checkbox" id="trans_recruit" class="transporter_checkbox" checked title="Rekruteringsorders meenemen">' +
                        '</span>' +
                        '<span id="trans_ship" class="bold text_shadow"></span>' +
                        '</div>' +
                        '</div>'
                    ).appendTo(".units_naval .content");
                }
                if ($("#big_transporter").length === 0) {
                    $(
                        '<div id="big_transporter" class="cont">' +
                        '<div class="transporter_row">' +
                        '<span class="trans_ship_icon">' +
                        '<img id="big_ship_img" class="ico" src="https://imgur.com/7SHlyeq.png" style="width:18px;height:18px;">' +
                        '</span>' +
                        '<span id="big_ship" class="bold text_shadow"></span>' +
                        '</div>' +
                        '</div>'
                    ).appendTo(".units_naval .content");
                }

                // Start updater
                if (this.interval) clearInterval(this.interval);
                this.interval = setInterval(() => this.update(), 1000);
                this.update();

                // Checkbox event: update beide bij verandering
                $("#trans_recruit").off("change").on("change", () => this.update());
            } catch (e) {
                console.error("TransporterCapacity.activate():", e);
            }
        },

        update() {
            try {
                const town = ITowns.getTown(Game.townId);
                if (!town) {
                    $("#trans_ship").html("-");
                    $("#big_ship").html("-");
                    return;
                }
                const GD_units = GameData.units;
                const GD_heroes = GameData.heroes;
                const researches = typeof town.researches === 'function' ? town.researches() : null;
                const berth = researches && typeof researches.hasBerth === 'function' && researches.hasBerth()
                ? GameData.research_bonus.berth
                : 0;
                const units = town.units();

                // Snelle transportboten
                const fast_capacity = (units.transporter || 0) * ((GD_units.transporter?.capacity || 0) + berth);
                let fast_required = 0;

                // Grote transportboten
                const big_capacity = (units.big_transporter || 0) * ((GD_units.big_transporter?.capacity || 0) + berth);
                let big_required = 0;

                const isLand = u => GD_units[u] && !GD_units[u].is_naval && !GD_units[u].flying && GD_units[u].capacity === undefined;
                const isTransported = u => isLand(u) && ['function_off','function_def','function_both'].includes(GD_units[u].unit_function);

                for (const u in units) {
                    if (isTransported(u)) {
                        const pop = u === "spartoi" ? units[u] : units[u] * GD_units[u].population;
                        fast_required += pop;
                        big_required += pop;
                    }
                }

                // Rekruteringsorders meenemen?
                if ($("#trans_recruit").is(":checked")) {
                    for (const order of town.getUnitOrdersCollection().models) {
                        const u = order.attributes.unit_type;
                        const amt = order.attributes.units_total;
                        const building = order.attributes.building_type;

                        if ((building === "barracks" || building === "docks") && GD_units[u] && !(u in GD_heroes) && isTransported(u)) {
                            const pop = u === "spartoi" ? amt : amt * GD_units[u].population;
                            fast_required += pop;
                            big_required += pop;
                        }
                    }
                }

                // Update tekst en kleur
                $("#trans_ship").html(
                    `<span style="color:${fast_required > fast_capacity ? "#ffb4b4" : "#6eff5c"}">${fast_required}</span> / <span style="color:#FFCC66">${fast_capacity}</span>`
                );
                $("#big_ship").html(
                    `<span style="color:${big_required > big_capacity ? "#ffb4b4" : "#6eff5c"}">${big_required}</span> / <span style="color:#FFCC66">${big_capacity}</span>`
                );
            } catch (e) {
                console.error("TransporterCapacity.update():", e);
            }
        }
    };

    // Alias voor compatibiliteit met oude scripts
    window.BigTransporterCapacity = TransporterCapacity;

    // ================= //
    // MapOverlay Module //
    // ================= //

    class MapOverlayModule {
        constructor(manager) {
            this.main = manager;
            this.overlaySettings = {};
            this.customTags = {};
            this.audio = new Audio('https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/sounds/bicycle-bell_19-80368.mp3');
            this.aanvalTimeout = null;
            this.bdAlarmTimeout = null;
            this.interval = null;
        }

        init() {
            console.log("Overlaymodule gestart");
            this.loadSettings();
            this.loadCSS();
            this.waitForDocumentReady();
            this.getTagsOnMap();
            this.initFarmAlarm();
            this.initAttackIndicator();
            window.debugOverlay = this;
            this.customTags["stad1768"] = { tag: "TEST", kleur: "#f00" };
        }

        loadSettings() {
            const uw = this.main.uw;
            const get = (key, def = null) => GM_getValue(key + uw.Game.world_id, def);
            this.overlaySettings = {
                token: get("setting_token"),
                key: get("setting_key"),
                discordhook: get("setting_discordhook", "[set webhook]"),
                boerendorpalarm: get("boerendorpalarm", true),
                aanvalsindicator: get("aanvalsindicator", true),
                inactive: get("inactive", true),
                inactiveMin: get("inactiveMin", 1),
                inactiveMax: get("inactiveMax", 50),
            };
        }

        waitForDocumentReady() {
            const checkReady = setInterval(() => {
                if (document.readyState === 'complete') {
                    clearInterval(checkReady);
                    console.log("Document klaar, overlay gereed");
                    $(document.body).on('click', '#fto_claim_button', () => {
                        const uw = this.main.uw;
                        let time = parseInt($('#time_options_wrapper .fto_time_checkbox.active').attr('data-option') || 0);
                        const loyalOpt = $('#time_options_wrapper .time_options_loyalty .fto_time_checkbox.active').attr('data-option');
                        if (loyalOpt && parseInt(loyalOpt) > time) {
                            time = parseInt(loyalOpt);
                        }
                        const ts = Date.now() + time * 1000;
                        GM_setValue(uw.Game.world_id + '_grepolis-claim-ready', ts);
                        this.scheduleFarmAlarm(ts);
                        this.updateFarmCounter(); // ← update teller direct na claim
                    });
                }
            }, 100);
        }

        getTagsOnMap() {
            const original = MapTiles.createTownDiv;
            MapTiles.createTownDiv = (...args) => {
                console.log("✅ createTownDiv aangeroepen", args);
                const result = original.apply(MapTiles, args);
                return result;
            };
        }

        loadIdlePlayers() {
            return $.ajax({
                url: "https://www.grcrt.net/json.php",
                method: "get",
                data: {
                    method: "getIdleJSON",
                    world: this.main.uw.Game.world_id
                },
                cache: true
            });
        }

        applyTownTags(result, townData) {
            const elements = Array.isArray(result) ? result : [result];

            for (let element of elements) {
                if (element?.classList?.contains('flag') && element.classList.contains('town')) {
                    const tagData = this.customTags["stad" + townData.id];

                    if (tagData) {
                        const tagHTML = `<span class="customTag" style="background-color: ${tagData.kleur || '#000'}">${tagData.tag}</span>`;
                        const tagDiv = document.createElement('div');
                        tagDiv.className = "customTagWrapper";
                        tagDiv.innerHTML = tagHTML;
                        element.appendChild(tagDiv);
                    }
                }
            }

            return result;
        }

        initFarmAlarm() {
            const hasCaptain = $(".captain_active").length > 0;
            if (!hasCaptain) return;

            const uw = this.main.uw;
            const nextClaimTs = GM_getValue(uw.Game.world_id + '_grepolis-claim-ready');

            const alarmBox = document.createElement('div');
            alarmBox.className = 'toolbar_button farmAlarmButton';

            const icon = document.createElement('div');
            const isActive = nextClaimTs > Date.now();
            icon.className = 'icon farmAlarmIcon ' + (isActive ? 'inactive' : 'active');

            const count = document.createElement('div');
            count.className = 'count js-caption farmAlarmCounter';
            count.innerText = '0';
            count.style.cssText = `
                font-weight: bold;
                text-shadow: 1px 1px 2px #000;
                color: #FFCC66;
                font-size: 11px;
                line-height: 2.1;
                text-align: center;
            `;

            icon.appendChild(count);
            alarmBox.appendChild(icon);
            $(".toolbar_buttons")[0].append(alarmBox);

            $(".farmAlarmButton").click(() => {
                this.audio.pause();
                this.audio.currentTime = 0;
                clearTimeout(this.bdAlarmTimeout);
                Layout.wnd.Create(Layout.wnd.TYPE_FARM_TOWN_OVERVIEWS, "Farming Town Overview");
            });

            if (nextClaimTs) this.scheduleFarmAlarm(nextClaimTs);

            const world = this.main.uw.Game.world_id;
            const ts = GM_getValue(world + '_grepolis-claim-ready');
            this.scheduleFarmAlarm(ts);
            this.startFarmCounter();
            this.farmCounterInterval = null;
        }

        startFarmCounter() {
            if (this.farmCounterInterval) clearInterval(this.farmCounterInterval);

            this.farmCounterInterval = setInterval(() => {
                const counter = document.querySelector(".farmAlarmCounter");
                if (!counter) return;

                const ts = GM_getValue(this.main.uw.Game.world_id + '_grepolis-claim-ready');
                const now = Date.now();
                const remaining = Math.floor((ts - now) / 1000);
                counter.innerText = remaining <= 0 ? "0" : remaining;
            }, 1000);
        }

        scheduleFarmAlarm(timestamp) {
            const remaining = timestamp - Date.now();
            if (remaining <= 0) return;
            this.bdAlarmTimeout = setTimeout(() => {
                $(".farmAlarmIcon").removeClass("inactive").addClass("active");
                if (this.overlaySettings.boerendorpalarm) this.audio.play();
                setTimeout(() => this.audio.pause(), 2000);
            }, remaining);
        }

        initAttackIndicator() {
            this.previousAttackCount = 0;
            this.checkIncomingAttacks();
        }

        checkIncomingAttacks() {
            const indicator = $(".activity.attack_indicator.active");
            const currentCount = parseInt(indicator.text()) || 0;

            if (currentCount > 0 && currentCount > this.previousAttackCount) {
                this.previousAttackCount = currentCount;
                this.startFaviconFlash();
            } else if (currentCount === 0) {
                this.stopFaviconFlash();
                this.previousAttackCount = 0;
            } else {
                this.previousAttackCount = currentCount;
            }

            setTimeout(() => this.checkIncomingAttacks(), 5000);
        }

        startFaviconFlash() {
            const link = $("link[rel~='icon']").first();
            if (!link.length) return;
            const normalHref = "https://gpnl.innogamescdn.com/images/game/start/favicon.ico";
            const alertHref = "https://raw.githubusercontent.com/zambia1972/Grepolis-Manager/main/icons/incoming.ico";
            let showingAlert = false;
            this.aanvalTimeout = setInterval(() => {
                link.attr("href", showingAlert ? normalHref : alertHref);
                showingAlert = !showingAlert;
            }, 300);
        }

        stopFaviconFlash() {
            clearInterval(this.aanvalTimeout);
            this.aanvalTimeout = null;
            $("link[rel~='icon']").first().attr("href", "https://gpnl.innogamescdn.com/images/game/start/favicon.ico");
        }

        markInactivePlayers(idleData) {
            const game = this.main.uw.Game;
            const settings = this.overlaySettings;
            if (!settings.inactive) return;
            const flagElements = document.querySelectorAll(".flag.town");
            flagElements.forEach(flag => {
                try {
                    const townId = parseInt(flag.id.replace("flag_town_", ""));
                    const town = this.main.uw.ITowns.getTown(townId);
                    const playerId = town.player_id;
                    const daysInactive = Math.floor(idleData.JSON[playerId] || 0);
                    if (playerId && daysInactive >= settings.inactiveMin && daysInactive <= settings.inactiveMax) {
                        const tag = document.createElement("div");
                        tag.innerText = daysInactive + "d";
                        tag.classList.add("inactivetag");
                        flag.appendChild(tag);
                    }
                } catch (e) { console.log("Fout bij inactieve speler:", e); }
            });
        }

        renderSettingsUI(container) {
            const wrapper = document.createElement("div");
            wrapper.style.cssText = `
        font-weight: bold;
        text-shadow: 1px 1px 2px #000;
        color: #FFCC66;
        font-size: 10px;
        line-height: 2.1;
        min-width: 48px;
        display: inline-block;
        text-align: left;
    `;

            const farmAlarmCheckbox = document.createElement("input");
            farmAlarmCheckbox.type = "checkbox";
            farmAlarmCheckbox.id = "farmalarm-toggle";
            const createCheckbox = (id, label, defaultVal) => {
                const div = document.createElement("div");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.id = id;
                input.checked = this.overlaySettings[id] ?? defaultVal;
                div.appendChild(input);
                const labelEl = document.createElement("label");
                labelEl.innerText = " " + label;
                labelEl.htmlFor = id;
                div.appendChild(labelEl);
                return div;
            };

            const createTextbox = (id, label, value = "", width = 200) => {
                const div = document.createElement("div");
                const labelEl = document.createElement("label");
                labelEl.innerText = label + ": ";
                labelEl.htmlFor = id;
                const input = document.createElement("input");
                input.type = "text";
                input.id = id;
                input.value = value;
                input.style.width = width + "px";
                div.appendChild(labelEl);
                div.appendChild(input);
                return div;
            };

            container.innerHTML = "<h3>Instellingen (Overlay Module)</h3>";
            container.appendChild(createCheckbox("boerendorpalarm", "Boerendorpenalarm", true));
            container.appendChild(createCheckbox("aanvalsindicator", "Knipperend icoon bij aanvallen", true));
            container.appendChild(createCheckbox("inactive", "Toon inactieve spelers", true));
            container.appendChild(createTextbox("inactiveMin", "Inactief vanaf (dagen)", this.overlaySettings.inactiveMin));
            container.appendChild(createTextbox("inactiveMax", "Tot max (dagen)", this.overlaySettings.inactiveMax));

            const saveBtn = document.createElement("button");
            saveBtn.innerText = "Opslaan & herladen";
            saveBtn.onclick = () => {
                ["boerendorpalarm", "aanvalsindicator", "inactive"].forEach(id => {
                    const val = document.getElementById(id).checked;
                    GM_setValue(id, val);
                });
                GM_setValue("inactiveMin", parseInt(document.getElementById("inactiveMin").value));
                GM_setValue("inactiveMax", parseInt(document.getElementById("inactiveMax").value));
                location.reload();
            };

            container.appendChild(document.createElement("hr"));
            wrapper.appendChild(farmAlarmCheckbox);
            container.appendChild(wrapper);
            container.appendChild(saveBtn);
        }
        loadCSS() {
            const css = `
        .customTagWrapper { position: absolute; top: -2px; left: -1px; z-index: 20; }
        .customTag { font-size: 10px; background: #444; color: #fff; padding: 1px 2px; border-radius: 2px; }
        .inactivetag { position: absolute; bottom: -3px; left: 1px; font-size: 9px; background-color: rgba(0,0,0,0.7); color: white; padding: 1px 2px; border-radius: 2px; z-index: 10; }
    `;
            const style = document.createElement("style");
            style.innerText = css;
            document.head.appendChild(style);
        }

    }

    // Move hasAdminAccess outside the class
    async function hasAdminAccess(main) {
        const player = main.modules?.forumManager?.getPlayerName()?.toLowerCase();
        const role = main.modules?.forumManager?.getPlayerRole?.()?.toLowerCase();
        const devs = ['boodtrap', 'zambia1972', 'elona', 'joppie86'];

        if (devs.includes(player)) return true;

        const allowLeaders = await GM_getValue('leaders_are_admins', true);
        if (allowLeaders && (role === 'leider' || role === 'oprichter')) return true;

        const manualAdmins = await GM_getValue('admin_list', []);
        return manualAdmins.map(n => n.toLowerCase()).includes(player);
    }

    class SettingsWindow {
        constructor(main) {
            this.main = main;
            this.uw = main.uw;
        }

        async toggle() {
            const playerName = this.main.modules?.forumManager?.getPlayerName() || 'Speler';

            const isAdmin = await hasAdminAccess(this.main);
            if (!isAdmin) return this.main.showNotification("Geen toegang tot instellingen.", false);

            const pin = await GM_getValue('settings_pin', null);
            if (pin) {
                const input = prompt("Voer pincode in:");
                if (input !== pin) return alert("Foutieve pincode.");
            }

            if (document.getElementById('gm-settings')) return;

            const container = document.createElement('div');
            container.id = 'gm-settings';
            container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            background: #1e1e1e;
            border: 2px solid #FF0000;
            padding: 20px;
            color: white;
            font-family: sans-serif;
            width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            border-radius: 10px;
            box-shadow: 0 0 20px red;
        `;

            container.innerHTML = `<h2 style="text-align:center;color:#FF0000;">Instellingen</h2><div id="gm-settings-content"></div>`;
            document.body.appendChild(container);
            this.renderSupabaseTab(container.querySelector('#gm-settings-content'));
        }

        async renderSupabaseTab(container) {
            const supabaseURL = await GM_getValue('supabase_url', '');
            const supabaseKey = await GM_getValue('supabase_api_key', '');
            const banned = await GM_getValue('banned_players', []);
            const autoUpload = await GM_getValue('auto_upload_enabled', true);

            const player = this.main.modules?.forumManager?.getPlayerName() || 'Speler';
            const isBanned = banned.includes(player);

            const html = `
            <h3 style="color:#FF0000;">Supabase Configuratie</h3>
            <label>URL: <input type="text" value="${supabaseURL}" disabled style="width:100%;margin-bottom:5px;" /></label><br>
            <label>API Key: <input type="password" value="${supabaseKey}" disabled style="width:100%;margin-bottom:10px;" /></label><br>
            <button id="gm-reset-supabase" style="margin-right:10px;">🔄 Reset gegevens</button>
            <button id="gm-export" style="margin-right:10px;">⬇️ Exporteer settings</button>
            <button id="gm-import" style="margin-right:10px;">⬆️ Importeer settings</button>
            <label style="margin-left:10px;"><input type="checkbox" id="gm-toggle-upload" ${autoUpload ? 'checked' : ''}> Auto-upload actief</label>
            <hr>
            <h4 style="color:#FF0000;">Spelers bannen</h4>
            <input id="gm-banname" placeholder="Spelernaam" style="width: 50%;margin-bottom:5px;" />
            <button id="gm-ban-add">➕ Ban</button>
            <button id="gm-ban-remove">➖ Unban</button>
            <div id="gm-banlist" style="margin-top:10px;font-size:12px;"></div>
            <hr>
            <h4 style="color:#FF0000;">Pincode instellen (optioneel)</h4>
            <input type="password" id="gm-pin" placeholder="Nieuwe pincode" style="width: 50%;" />
            <button id="gm-save-pin">💾 Opslaan</button>
            <hr>
            <h4 style="color:#FF0000;">Admin toegang beheren</h4>
            <input id="gm-adminname" placeholder="Voeg speler toe als admin" style="width: 50%;" />
            <button id="gm-admin-add">➕ Voeg toe</button>
            <button id="gm-admin-remove">➖ Verwijder</button><br><br>
            <label><input type="checkbox" id="gm-toggle-leaders" ${await GM_getValue('leaders_are_admins', true) ? 'checked' : ''}/> Leiders/Oprichters hebben automatisch toegang</label>
            <div id="gm-adminlist" style="font-size:12px;margin-top:8px;"></div>
            <div id="gm-effective-admins" style="font-size:12px;margin-top:8px;"></div>
            <hr>
            <button id="gm-close-settings" style="margin-top:10px;">❌ Sluiten</button>
        `;

            container.innerHTML = html;

            // Events
            document.getElementById('gm-close-settings').addEventListener('click', () => {
                document.getElementById('gm-settings').remove();
            });

            document.getElementById('gm-reset-supabase').addEventListener('click', async () => {
                await GM_deleteValue('supabase_url');
                await GM_deleteValue('supabase_api_key');
                location.reload();
            });

            document.getElementById('gm-export').addEventListener('click', async () => {
                const keys = ['supabase_url', 'supabase_api_key', 'banned_players', 'settings_pin', 'auto_upload_enabled'];
                const data = {};
                for (const key of keys) data[key] = await GM_getValue(key);
                GM_setClipboard(JSON.stringify(data, null, 2));
                alert("Instellingen gekopieerd naar klembord.");
            });

            document.getElementById('gm-import').addEventListener('click', async () => {
                const json = prompt("Plak hier je JSON instellingen:");
                if (!json) return;
                try {
                    const data = JSON.parse(json);
                    for (const key in data) {
                        await GM_setValue(key, data[key]);
                    }
                    location.reload();
                } catch (e) {
                    alert("Ongeldige JSON.");
                }
            });

            document.getElementById('gm-toggle-upload').addEventListener('change', async (e) => {
                await GM_setValue('auto_upload_enabled', e.target.checked);
                this.main.showNotification('Auto-upload bijgewerkt.');
            });

            document.getElementById('gm-ban-add').addEventListener('click', async () => {
                const name = document.getElementById('gm-banname').value.trim();
                if (!name) return;
                const bans = await GM_getValue('banned_players', []);
                if (!bans.includes(name)) bans.push(name);
                await GM_setValue('banned_players', bans);
                this.renderSupabaseTab(container);
            });

            document.getElementById('gm-ban-remove').addEventListener('click', async () => {
                const name = document.getElementById('gm-banname').value.trim();
                const bans = await GM_getValue('banned_players', []);
                const updated = bans.filter(n => n !== name);
                await GM_setValue('banned_players', updated);
                this.renderSupabaseTab(container);
            });

            document.getElementById('gm-save-pin').addEventListener('click', async () => {
                const pin = document.getElementById('gm-pin').value.trim();
                if (!pin) return alert("Geen pincode ingevoerd.");
                await GM_setValue('settings_pin', pin);
                alert("Pincode opgeslagen.");
            });

            document.getElementById('gm-admin-add').addEventListener('click', async () => {
                const name = document.getElementById('gm-adminname').value.trim();
                if (!name) return;
                const list = await GM_getValue('admin_list', []);
                if (!list.includes(name)) list.push(name);
                await GM_setValue('admin_list', list);
                this.renderSupabaseTab(container);
            });

            document.getElementById('gm-admin-remove').addEventListener('click', async () => {
                const name = document.getElementById('gm-adminname').value.trim();
                let list = await GM_getValue('admin_list', []);
                list = list.filter(n => n !== name);
                await GM_setValue('admin_list', list);
                this.renderSupabaseTab(container);
            });

            document.getElementById('gm-toggle-leaders').addEventListener('change', async (e) => {
                await GM_setValue('leaders_are_admins', e.target.checked);
                this.main.showNotification('Leiders/Oprichters toegang aangepast.');
            });

            const admins = await GM_getValue('admin_list', []);
            document.getElementById('gm-adminlist').innerHTML = `<strong>Manuele admins:</strong> ${admins.length ? admins.join(', ') : '(geen)'}`;
            // Toon lijst van actieve toegang (behalve developers)
            const playerRoles = this.main.modules?.forumManager?.getAllPlayersWithRoles?.() || [];
            const allowLeaders = await GM_getValue('leaders_are_admins', true);
            const effectiveAdmins = new Set();

            if (allowLeaders) {
                for (const { name, role } of playerRoles) {
                    if (['leider', 'oprichter'].includes(role.toLowerCase())) {
                        effectiveAdmins.add(name);
                    }
                }
            }

            admins.forEach(name => effectiveAdmins.add(name));

            // Verwijder ontwikkelaars
            const devs = ['boodtrap', 'zambia1972', 'elona', 'joppie86'];
            devs.forEach(dev => effectiveAdmins.delete(dev));

            // Toon effectief toegestane toegang
            document.getElementById('gm-effective-admins').innerHTML = `
                <strong>Toegang tot instellingen:</strong><br>
                ${Array.from(effectiveAdmins).length ? Array.from(effectiveAdmins).join(', ') : '(geen extra admins)'}
            `;

            // Toon actieve banlijst
            const banlist = document.getElementById('gm-banlist');
            banlist.innerHTML = `<strong>Banlijst:</strong> ${banned.length ? banned.join(', ') : '(geen)'}`;
        }
    }

    // Automatisch activeren bij laden
    $(function() {
    });
    // ============================ //
    // Start Grepolis Manager Init  //
    // ============================ //

    window.addEventListener('load', () => {
        new GrepolisManager();

    });
    GM_registerMenuCommand("🛠️ Supabase instellingen wijzigen", async () => {
        await GM_deleteValue("supabase_url");
        await GM_deleteValue("supabase_api_key");
        location.reload();
    });
})();

# 🏛️ Grepolis Manager

### Alles-in-één Grepolis Script — door *Zambia1972* aka *boodtrap*

---

## 📖 Inhoudsopgave

1. [Overzicht](#-overzicht)
2. [Functies](#-functies)
3. [Installatiehandleiding](#️-installatiehandleiding)
4. [Supabase configureren](#️-supabase-configureren)
5. [Modules en functionaliteit](#-modules-en-functionaliteit)
6. [Veelgestelde vragen](#-veelgestelde-vragen)
7. [Credits & Licentie](#-credits--licentie)

---

## 🧭 Overzicht

**Grepolis Manager** is een geavanceerd Tampermonkey-script dat meerdere hulpmiddelen voor het browsergame *Grepolis* samenbrengt in één uniform systeem.
Het doel is om leiders, strategen en spelers een efficiënte en moderne interface te bieden voor:

* Troepenbeheer
* Wereldinformatie
* Forumautomatisatie
* Externe opslag via Supabase
* Visuele UI met Tailwind-achtige styling
* Automatische synchronisatie van data

Het script is volledig modulair opgebouwd en compatibel met bestaande tools zoals **GrepoData**, **DIO-Tools**, en **GrepoTools**.

---

## ⚙️ Functies

| Module                          | Beschrijving                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| 🏠 **Dashboard**                | Overzichtsscherm met alle actieve modules en extra tools.                                 |
| ⚙️ **Instellingen**             | Beheer Supabase-configuratie, tokens en gebruikersopties.                                 |
| 🌍 **Wereldinfo**               | Automatische weergave van spelers, allianties en steden via officiële Grepolis-datafeeds. |
| 🪖 **Troop Manager**            | Synchroniseer je troepen en upload automatisch naar Supabase.                             |
| 📜 **Forum Manager**            | Genereer en beheer alliantiefora met voorgeformatteerde templates.                        |
| 🕒 **Afwezigheidsassistent**    | Meld afwezigheden met tijdsduur en opmerkingen.                                           |
| 🗺️ **Map Overlay**             | Voegt extra lagen toe op de wereldkaart (markeringen, clusters, filters).                 |
| 🚢 **Big Transporter Capacity** | Schakelt automatisch extra capaciteit in voor grote transporters.                         |

---

## 🧩 Installatiehandleiding

### Vereisten

* ✅ Browser: Chrome, Edge of Firefox
* ✅ Tampermonkey extensie
* ✅ Grepolis-account

### Stappen

1. Installeer [**Tampermonkey**](https://www.tampermonkey.net/).
2. Klik op **“Nieuw script toevoegen”**.
3. Plak de inhoud van `Grepolis Manager-1.0 (8).user.js` in het venster.
4. Sla op (Ctrl + S).
5. Herlaad je Grepolis-pagina.
6. Je ziet nu een **knoppenbalk rechtsboven** in je scherm met het Grepolis Manager-logo.

---

## 🧱 Supabase configureren

Grepolis Manager gebruikt **Supabase** om veilig gegevens extern op te slaan (zoals troepen en instellingen).

### 🔧 Stap 1: Maak een account

1. Ga naar [https://supabase.com](https://supabase.com)
2. Log in of maak een nieuw account aan.
3. Klik op **“New Project”**.
4. Geef het project een naam (bijv. *GrepolisManager*).
5. Kies een regio en klik op **“Create Project”**.

---

### 🔑 Stap 2: Verkrijg je API-gegevens

1. Open je Supabase-project.
2. Ga in het menu naar **Settings → API**.
3. Kopieer de volgende gegevens:

   * **Project URL** → dit wordt je `SUPABASE_URL`
   * **anon public key** → dit wordt je `SUPABASE_API_KEY`

---

### 📦 Stap 3: Voeg de gegevens toe aan het script

Bij de eerste start van Grepolis Manager verschijnt automatisch een **configuratievenster**:

* Vul je **Supabase URL** en **API Key** in.
* Klik op **Opslaan**.

Je gegevens worden **veilig lokaal** bewaard met `GM_setValue`.

---

### 📁 Stap 4 (optioneel): Tabellen aanmaken

Wil je eigen data (zoals troepen) opslaan, maak dan in Supabase een tabel aan via de **Table Editor**.

Bijvoorbeeld:

| Kolom     | Type   | Opmerking       |
| --------- | ------ | --------------- |
| player    | text   | Spelernaam      |
| town_id   | int    | Stad-ID         |
| unit      | text   | Eenheidstype    |
| amount    | int    | Aantal eenheden |
| timestamp | bigint | Tijdstip upload |

Grepolis Manager synchroniseert automatisch deze gegevens zodra de Troop Manager actief is.

---

### 🧪 Testen

* Open je Supabase dashboard.
* Controleer of er records verschijnen in je tabellen.
* De console logt `Supabase config geladen:` met jouw instellingen.

---

## 🧠 Modules en Functionaliteit

### 🎛️ Dashboard

Een startscherm dat alle functies en links toont naar aanbevolen tools:

* GrepoTools
* DIO-Tools
* GRCRTools
* Map Enhancer
* GrepoData
* Forum Template

### ⚙️ Instellingen

Beheer Supabase, GrepoData-token, notificaties, en gebruikersinstellingen.

### 🌍 Wereldinfo

Toont spelers, allianties, steden en veroveringen in real time met data van:

```
https://<wereld>.grepolis.com/data/
```

### 🪖 Troop Manager

* Synchroniseert troepen uit je stadsoverzichten.
* Uploadt automatisch naar Supabase.
* Toont visuele weergave van units met sprites.

### 📜 Forum Manager

* Genereert alliantieforums (ROOD, DEFF, OFF, Cluster, enz.)
* Bevat kant-en-klare sjablonen met BBCode.
* Integreert met de officiële Grepolis forum-API.

### 🕒 Afwezigheidsassistent

* Meld afwezigheidstijden in een tabel (met optionele VM).
* Synchroniseert met Supabase zodat leiding dit kan bekijken.

### 🗺️ Map Overlay

* Extra lagen en filters op de kaart.
* Voorbereid voor toekomstige GRepoData integratie.

---

## ❓ Veelgestelde vragen

**Q: Moet ik Supabase verplicht gebruiken?**
A: Nee. Zonder Supabase blijven modules lokaal werken. Supabase is enkel vereist voor opslag/synchronisatie.

**Q: Worden mijn API-keys gedeeld met anderen?**
A: Nee. De sleutel wordt lokaal opgeslagen in Tampermonkey’s `GM_setValue` en nooit doorgestuurd.

**Q: Hoe verwijder ik mijn Supabase-configuratie?**
A: Via de instellingen in het script of door de Tampermonkey opgeslagen waarden te verwijderen.

**Q: Kan ik meerdere accounts gebruiken?**
A: Ja, elke gebruiker kan zijn eigen Supabase-project koppelen.

---

## 🧾 Credits & Licentie

**Auteur:** Zambia1972 (Hans Gevers)
**Copyright © 2025**
**Licentie:** MIT License

Iconen en grafische elementen © InnoGames / Grepolis
Niet geaffilieerd met InnoGames GmbH.

---

## 💬 Contact & Support

📧 **Support / Bugs / Ideeën:**
[GitHub Issues](https://github.com/zambia1972/Grepolis-Manager/issues)

---

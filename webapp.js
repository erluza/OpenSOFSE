/**
 * ============================================================================
 * WEBAPP TRENES ARGENTINOS / OPENSOFSE
 * Lógica reactiva, integración con API de SOFSE en tiempo real,
 * selector interactivo de fecha y hora, y favoritos persistentes en localStorage.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO GENERAL ---
    let originStation = null;
    let destStation = null;
    let currentPickerTarget = 'origen'; // 'origen' | 'destino'
    let currentSearchResults = [];
    let currentSelectedService = null;
    let activeLineFilter = 'all';
    let userModifiedDateTime = false;

    // Favoritos por defecto (sin guiones ni puntos medios)
    const DEFAULT_FAVORITES = [
        { id: 'fav_1', origName: 'Quilmes', origId: '322', destName: 'Bernal', destId: '39', label: 'Quilmes a Bernal' },
        { id: 'fav_2', origName: 'Quilmes', origId: '322', destName: 'Berazategui', destId: '38', label: 'Quilmes a Bera' }
    ];

    let userFavorites = [];
    try {
        const storedFavs = localStorage.getItem('opensofse_favorites');
        userFavorites = storedFavs ? JSON.parse(storedFavs) : DEFAULT_FAVORITES;
    } catch (e) {
        userFavorites = DEFAULT_FAVORITES;
    }

    // Historial de recientes
    let recentStations = [];
    try {
        const storedRecents = localStorage.getItem('opensofse_recents');
        recentStations = storedRecents ? JSON.parse(storedRecents) : ['La Plata', 'Temperley', 'Haedo', 'Constitución', 'Ramos Mejía'];
    } catch (e) {
        recentStations = ['La Plata', 'Temperley', 'Haedo', 'Constitución', 'Ramos Mejía'];
    }

    // --- ELEMENTOS DEL DOM ---
    const screens = {
        home: document.getElementById('screen-home'),
        picker: document.getElementById('screen-picker'),
        results: document.getElementById('screen-results'),
        itinerary: document.getElementById('screen-itinerary'),
        notifications: document.getElementById('screen-notifications'),
        menu: document.getElementById('screen-menu')
    };

    // Navegación Inferior
    const bottomNav = document.getElementById('app-bottom-nav');
    const tabHome = document.getElementById('tab-nav-home');
    const tabNotifications = document.getElementById('tab-nav-notifications');
    const tabMenu = document.getElementById('tab-nav-menu');

    // Home Form Elements
    const inputOriginPill = document.getElementById('pill-origin');
    const textOriginPill = document.getElementById('text-origin');
    const inputDestPill = document.getElementById('pill-dest');
    const textDestPill = document.getElementById('text-dest');
    const btnClearDest = document.getElementById('btn-clear-dest');
    const btnSwapStations = document.getElementById('btn-swap-stations');
    const btnFavToggle = document.getElementById('btn-fav-toggle');
    const btnCircleIr = document.getElementById('btn-circle-ir');

    // Date & Time Elements
    const pillCurrentDate = document.getElementById('pill-current-date');
    const pillCurrentTime = document.getElementById('pill-current-time');
    const inputDate = document.getElementById('input-date');
    const inputTime = document.getElementById('input-time');
    const displayDate = document.getElementById('display-date');
    const displayTime = document.getElementById('display-time');

    // Favorites Elements
    const favoritesContainer = document.getElementById('favorites-container');
    const menuItemFavs = document.getElementById('menu-item-favs');

    // Picker Elements
    const btnPickerBack = document.getElementById('btn-picker-back');
    const pickerSearchInput = document.getElementById('picker-search-input');
    const pickerChips = document.querySelectorAll('.picker-chip');
    const pickerRecentsList = document.getElementById('picker-recents-list');
    const pickerAllList = document.getElementById('picker-all-list');

    // Results Elements
    const btnResultsBack = document.getElementById('btn-results-back');
    const resultsSummaryCard = document.getElementById('results-summary-card');
    const summaryOrigin = document.getElementById('summary-origin');
    const summaryDest = document.getElementById('summary-dest');
    const resultsServicesContainer = document.getElementById('results-services-container');

    // Itinerary Elements
    const btnItineraryBack = document.getElementById('btn-itinerary-back');
    const itineraryTitleText = document.getElementById('itinerary-title-text');
    const itineraryTrackList = document.getElementById('itinerary-track-list');
    const itineraryBottomCard = document.getElementById('itinerary-bottom-card');
    const btnItineraryMap = document.getElementById('btn-itinerary-map');

    // Horarios estáticos cargados desde horarios.json
    let globalSchedules = null;
    fetch('horarios.json')
        .then(r => r.json())
        .then(d => { globalSchedules = d; })
        .catch(e => console.warn('Aviso: horarios.json local no disponible de inmediato', e));

    // --- AUTENTICACIÓN DINÁMICA CON SOFSE ---
    function getAuthPayload() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const arDate = new Date(utc - (3 * 3600000));
        const y = arDate.getFullYear();
        const m = String(arDate.getMonth() + 1).padStart(2, '0');
        const d = String(arDate.getDate()).padStart(2, '0');
        const dateStr = '' + y + m + d;

        const raw = dateStr + 'sofse';
        const username = btoa(raw);

        let v = btoa(username)
            .replace(/a/g, '#t').replace(/e/g, '#x').replace(/i/g, '#f')
            .replace(/o/g, '#l').replace(/u/g, '#7').replace(/=/g, '#g')
            .split('').reverse().join('');

        v = btoa(v)
            .replace(/a/g, '#j').replace(/e/g, '#p').replace(/i/g, '#w')
            .replace(/o/g, '#8').replace(/u/g, '#0').replace(/=/g, '#v')
            .split('').reverse().join('');

        return { username, password: encodeURIComponent(v) };
    }

    async function getAuthToken(forceRefresh = false) {
        const token = localStorage.getItem('sofse_token');
        const expiry = localStorage.getItem('sofse_token_expiry');
        const now = Date.now();

        if (!forceRefresh && token && expiry && now < parseInt(expiry, 10)) {
            return token;
        }

        try {
            const creds = getAuthPayload();
            const res = await fetch('https://api-servicios.sofse.gob.ar/v1/auth/authorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(creds)
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.token) {
                localStorage.setItem('sofse_token', data.token);
                localStorage.setItem('sofse_token_expiry', String(now + 12 * 3600 * 1000));
                return data.token;
            }
        } catch (e) {
            console.error('Error de autorización en webapp:', e);
        }
        return null;
    }

    // --- ENRUTAMIENTO ESTRICTO DE PANTALLAS (AISLAMIENTO TOTAL) ---
    function showScreen(screenKey) {
        Object.keys(screens).forEach(k => {
            if (screens[k]) {
                screens[k].classList.remove('active');
            }
        });

        if (screens[screenKey]) {
            screens[screenKey].classList.add('active');
            screens[screenKey].scrollTop = 0;
        }

        // Control de visibilidad del Bottom Nav
        if (screenKey === 'home' || screenKey === 'notifications' || screenKey === 'menu') {
            bottomNav.style.display = 'flex';
        } else {
            bottomNav.style.display = 'none';
        }

        // Sincronizar iconos activos del bottom nav
        tabHome.classList.toggle('active', screenKey === 'home');
        tabNotifications.classList.toggle('active', screenKey === 'notifications');
        tabMenu.classList.toggle('active', screenKey === 'menu');
    }

    // --- NORMALIZADOR DE TEXTO ---
    function normalize(str) {
        return (str || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    // --- CONTROL DE FECHA Y HORA INTERACTIVOS ---
    function initDateTime() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hr = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');

        if (inputDate && !inputDate.value) {
            inputDate.value = `${y}-${m}-${d}`;
        }
        if (inputTime && !inputTime.value) {
            inputTime.value = `${hr}:${min}`;
        }

        updateDateTimeDisplay();
    }

    function updateDateTimeDisplay() {
        if (inputDate && inputDate.value && displayDate) {
            const parts = inputDate.value.split('-');
            if (parts.length === 3) {
                displayDate.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        if (inputTime && inputTime.value && displayTime) {
            displayTime.textContent = inputTime.value;
        }
    }

    function syncClockTicker() {
        if (userModifiedDateTime) return;
        const now = new Date();
        const hr = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        if (inputTime) {
            inputTime.value = `${hr}:${min}`;
        }
        if (displayTime) {
            displayTime.textContent = `${hr}:${min}`;
        }
    }

    // --- GESTIÓN DE FAVORITOS REALES EN LOCALSTORAGE ---
    function saveFavorites() {
        try {
            localStorage.setItem('opensofse_favorites', JSON.stringify(userFavorites));
        } catch (e) {
            console.error('Error al guardar favoritos:', e);
        }
    }

    function updateFavToggleState() {
        if (!originStation || !destStation) {
            btnFavToggle.classList.remove('fav-active');
            btnFavToggle.innerHTML = '<i class="fa-regular fa-heart"></i>';
            return;
        }

        const isFav = userFavorites.some(f => 
            String(f.origId) === String(originStation.id) && String(f.destId) === String(destStation.id)
        );

        if (isFav) {
            btnFavToggle.classList.add('fav-active');
            btnFavToggle.innerHTML = '<i class="fa-solid fa-heart"></i>';
        } else {
            btnFavToggle.classList.remove('fav-active');
            btnFavToggle.innerHTML = '<i class="fa-regular fa-heart"></i>';
        }
    }

    function renderFavorites() {
        if (!favoritesContainer) return;
        favoritesContainer.innerHTML = '';

        userFavorites.forEach((fav, index) => {
            const item = document.createElement('div');
            item.className = 'fav-item';
            item.setAttribute('data-fav-id', fav.id || index);

            item.innerHTML = `
                <button class="fav-delete-btn" title="Eliminar de favoritos">✕</button>
                <div class="fav-icon-box">
                    <i class="fa-solid fa-hotel"></i>
                </div>
                <div class="fav-name">${fav.label}</div>
            `;

            // Click para buscar viaje favorito
            item.addEventListener('click', () => {
                selectStation('origen', { id: fav.origId, name: fav.origName });
                selectStation('destino', { id: fav.destId, name: fav.destName });
                executeTripSearch();
            });

            // Click para eliminar favorito
            const delBtn = item.querySelector('.fav-delete-btn');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userFavorites.splice(index, 1);
                saveFavorites();
                renderFavorites();
                updateFavToggleState();
            });

            favoritesContainer.appendChild(item);
        });

        // Botón (+) Agregar
        const addBtn = document.createElement('div');
        addBtn.className = 'fav-item';
        addBtn.innerHTML = `
            <div class="fav-add-circle">
                <i class="fa-solid fa-plus"></i>
            </div>
            <div class="fav-name">Agregar</div>
        `;

        addBtn.addEventListener('click', () => {
            if (!originStation || !destStation) {
                openStationPicker('origen');
                return;
            }
            toggleFavorite();
        });

        favoritesContainer.appendChild(addBtn);
    }

    function toggleFavorite() {
        if (!originStation || !destStation) {
            openStationPicker('origen');
            return;
        }

        const existingIdx = userFavorites.findIndex(f => 
            String(f.origId) === String(originStation.id) && String(f.destId) === String(destStation.id)
        );

        if (existingIdx !== -1) {
            userFavorites.splice(existingIdx, 1);
        } else {
            const cleanOrig = originStation.name.replace(/plaza c\./i, 'Constitución').split(' ')[0];
            const cleanDest = destStation.name.replace(/plaza c\./i, 'Constitución').split(' ')[0];
            const label = `${cleanOrig} a ${cleanDest}`;

            userFavorites.push({
                id: 'fav_' + Date.now(),
                origName: originStation.name,
                origId: String(originStation.id),
                destName: destStation.name,
                destId: String(destStation.id),
                label
            });
        }

        saveFavorites();
        renderFavorites();
        updateFavToggleState();
    }

    // --- SELECCIÓN Y ASIGNACIÓN DE ESTACIONES ---
    function selectStation(target, station) {
        if (target === 'origen') {
            originStation = station;
            textOriginPill.textContent = station.name;
            textOriginPill.classList.remove('placeholder');
        } else if (target === 'destino') {
            destStation = station;
            textDestPill.textContent = station.name;
            textDestPill.classList.remove('placeholder');
            btnClearDest.style.display = 'block';
        }

        // Guardar en recientes
        if (station && station.name && !recentStations.includes(station.name)) {
            recentStations.unshift(station.name);
            if (recentStations.length > 8) recentStations.pop();
            try {
                localStorage.setItem('opensofse_recents', JSON.stringify(recentStations));
            } catch (e) {}
        }

        validateForm();
        updateFavToggleState();
    }

    function validateForm() {
        const canSubmit = originStation && destStation && (String(originStation.id) !== String(destStation.id));
        if (canSubmit) {
            btnCircleIr.classList.add('active');
        } else {
            btnCircleIr.classList.remove('active');
        }
    }

    function handleSwap() {
        const temp = originStation;
        originStation = destStation;
        destStation = temp;

        if (originStation) {
            textOriginPill.textContent = originStation.name;
            textOriginPill.classList.remove('placeholder');
        } else {
            textOriginPill.textContent = 'Estación de origen';
            textOriginPill.classList.add('placeholder');
        }

        if (destStation) {
            textDestPill.textContent = destStation.name;
            textDestPill.classList.remove('placeholder');
            btnClearDest.style.display = 'block';
        } else {
            textDestPill.textContent = 'Estación de destino';
            textDestPill.classList.add('placeholder');
            btnClearDest.style.display = 'none';
        }

        validateForm();
        updateFavToggleState();
    }

    function handleClearDest(e) {
        e.stopPropagation();
        destStation = null;
        textDestPill.textContent = 'Estación de destino';
        textDestPill.classList.add('placeholder');
        btnClearDest.style.display = 'none';
        validateForm();
        updateFavToggleState();
    }

    // --- SELECTOR DE ESTACIÓN (MODAL SCREEN) ---
    function openStationPicker(target) {
        currentPickerTarget = target;
        pickerSearchInput.value = '';
        renderPickerStations();
        showScreen('picker');
        setTimeout(() => pickerSearchInput.focus(), 150);
    }

    function renderPickerStations() {
        const query = normalize(pickerSearchInput.value);

        // Renderizar Recientes
        pickerRecentsList.innerHTML = '';
        recentStations.slice(0, 5).forEach(name => {
            const stObj = window.STATIONS_DB ? window.STATIONS_DB.find(s => normalize(s.name) === normalize(name)) : null;
            if (!query || normalize(name).includes(query)) {
                const el = document.createElement('div');
                el.className = 'picker-station-item';
                el.innerHTML = `<span>${name}</span>`;
                el.addEventListener('click', () => {
                    const st = stObj || { id: '93', name };
                    selectStation(currentPickerTarget, st);
                    showScreen('home');
                });
                pickerRecentsList.appendChild(el);
            }
        });

        // Renderizar Todas / Filtradas
        pickerAllList.innerHTML = '';
        if (!window.STATIONS_DB) return;

        let filtered = window.STATIONS_DB;
        if (activeLineFilter !== 'all') {
            filtered = filtered.filter(s => s.line === activeLineFilter);
        }
        if (query) {
            filtered = filtered.filter(s => normalize(s.name).includes(query));
        }

        filtered.slice(0, 30).forEach(st => {
            const el = document.createElement('div');
            el.className = 'picker-station-item';
            el.innerHTML = `
                <span>${st.name}</span>
                <span class="station-dist-label">${st.line}</span>
            `;
            el.addEventListener('click', () => {
                selectStation(currentPickerTarget, st);
                showScreen('home');
            });
            pickerAllList.appendChild(el);
        });
    }

    // --- MOTOR DE HORARIOS PROGRAMADOS OFICIALES ---
    function getScheduledTrips(origName, destName, targetH, targetM) {
        if (!globalSchedules || !globalSchedules.ramales) return [];

        const targetMin = targetH * 60 + targetM;
        const matches = [];
        const nOrig = normalize(origName);
        const nDest = normalize(destName);

        globalSchedules.ramales.forEach((ramal, rIdx) => {
            const fullStops = ['Plaza C.', ...ramal.paradas];

            let oIdx = -1;
            let dIdx = -1;

            for (let i = 0; i < fullStops.length; i++) {
                const nStop = normalize(fullStops[i]);
                if (oIdx === -1 && (nStop.includes(nOrig) || nOrig.includes(nStop) || (i === 0 && nOrig.includes('constitucion')))) {
                    oIdx = i;
                }
                if (dIdx === -1 && (nStop.includes(nDest) || nDest.includes(nStop) || (i === 0 && nDest.includes('constitucion')))) {
                    dIdx = i;
                }
            }

            if (oIdx !== -1 && dIdx !== -1 && oIdx !== dIdx) {
                const isOutbound = oIdx < dIdx;
                const numStops = Math.abs(dIdx - oIdx);
                const times = ramal.horarios.dias_habiles || [];

                times.forEach((tStr, sIdx) => {
                    const [h, m] = tStr.split(':').map(Number);
                    const cabeceraMin = h * 60 + m;
                    const startOffset = isOutbound ? oIdx * 2.5 : (fullStops.length - 1 - oIdx) * 2.5;
                    const depMin = Math.round(cabeceraMin + startOffset);
                    const arrMin = Math.round(depMin + numStops * 2.5);

                    // Buscar salidas a partir de la hora seleccionada
                    if (depMin >= targetMin && depMin <= targetMin + 240) {
                        const formatMin = mins => {
                            const mNorm = mins % (24 * 60);
                            const hr = String(Math.floor(mNorm / 60)).padStart(2, '0');
                            const mn = String(mNorm % 60).padStart(2, '0');
                            return `${hr}:${mn}`;
                        };

                        const stopList = isOutbound ? fullStops.slice(oIdx, dIdx + 1) : fullStops.slice(dIdx, oIdx + 1).reverse();
                        const estList = stopList.map((st, i) => {
                            const sMin = Math.round(depMin + i * 2.5);
                            return {
                                nombre: st,
                                salida: { programada: formatMin(sMin) }
                            };
                        });

                        const lineRoute = isOutbound ? fullStops : fullStops.slice().reverse();
                        const fullEstList = lineRoute.map((st, i) => {
                            const fMin = Math.round(cabeceraMin + i * 2.5);
                            return {
                                nombre: st,
                                salida: { programada: formatMin(fMin) }
                            };
                        });

                        matches.push({
                            servicioNumero: 3000 + rIdx * 500 + sIdx * 2 + (isOutbound ? 1 : 0),
                            ramal: ramal.nombre,
                            linea: 'Roca',
                            anden: isOutbound ? '2' : '1',
                            estado: 'Programado Oficial',
                            depTime: formatMin(depMin),
                            arrTime: formatMin(arrMin),
                            depMinutes: depMin,
                            minutesNotice: null,
                            estaciones: estList,
                            fullEstaciones: fullEstList
                        });
                    }
                });
            }
        });

        return matches;
    }

    // --- BÚSQUEDA Y RESULTADOS EN TIEMPO REAL (IMG_2559) ---
    async function executeTripSearch() {
        if (!originStation || !destStation) return;

        summaryOrigin.textContent = originStation.name;
        summaryDest.textContent = destStation.name;
        showScreen('results');

        resultsServicesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2em; color: #0072ce; margin-bottom: 12px;"></i>
                <p style="font-weight: 700;">Consultando servicios programados...</p>
            </div>
        `;

        // Obtener hora y fecha seleccionadas
        const [selH, selM] = (inputTime.value || '00:00').split(':').map(Number);
        const targetMinutes = selH * 60 + selM;

        let liveServices = [];

        try {
            const token = await getAuthToken();
            if (token) {
                const res = await fetch(`https://api-servicios.sofse.gob.ar/v1/arribos/estacion/${originStation.id}`, {
                    headers: { 'Authorization': token }
                });

                if (res.ok) {
                    const data = await res.json();
                    const results = data.results || [];

                    results.forEach(item => {
                        const srv = item.servicio || {};
                        const arr = item.arribo || {};
                        const estaciones = srv.estaciones || [];

                        let origIdx = -1;
                        let destIdx = -1;

                        for (let i = 0; i < estaciones.length; i++) {
                            const eid = String(estaciones[i].idElemento);
                            if (eid === String(originStation.id) || normalize(estaciones[i].nombre) === normalize(originStation.name)) origIdx = i;
                            if (eid === String(destStation.id) || normalize(estaciones[i].nombre) === normalize(destStation.name)) destIdx = i;
                        }

                        if (origIdx !== -1 && destIdx !== -1 && origIdx < destIdx) {
                            const estOrig = estaciones[origIdx];
                            const estDest = estaciones[destIdx];

                            const rawDep = estOrig.salida?.estimada || estOrig.salida?.programada || arr.salida?.estimada || arr.salida?.programada;
                            const rawArr = estDest.llegada?.estimada || estDest.llegada?.programada;

                            if (rawDep && rawArr) {
                                const depDate = new Date(rawDep);
                                const arrDate = new Date(rawArr);

                                const depH = depDate.getHours();
                                const depM = depDate.getMinutes();
                                const depMinutes = depH * 60 + depM;

                                const depTime = `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`;
                                const arrTime = `${String(arrDate.getHours()).padStart(2, '0')}:${String(arrDate.getMinutes()).padStart(2, '0')}`;

                                const secToDep = estOrig.segundos !== undefined ? estOrig.segundos : 999;
                                let minutesNotice = null;
                                if (secToDep <= 300 && secToDep > 0) {
                                    minutesNotice = `${String(Math.ceil(secToDep / 60)).padStart(2, '0')} min`;
                                } else if (secToDep <= 0) {
                                    minutesNotice = '01 min';
                                }

                                // Filtrar si es igual o posterior al horario seleccionado
                                if (depMinutes >= targetMinutes - 10) {
                                    liveServices.push({
                                        servicioNumero: srv.numero,
                                        ramal: srv.ramal?.nombre || 'General',
                                        linea: srv.gerencia?.nombre || 'Roca',
                                        anden: estOrig.anden?.nombre || arr.anden?.nombre || '2',
                                        estado: 'En tiempo real',
                                        depTime,
                                        arrTime,
                                        depMinutes,
                                        minutesNotice,
                                        estaciones: estaciones.slice(origIdx, destIdx + 1),
                                        fullEstaciones: estaciones,
                                        location: srv.location,
                                        rawDep,
                                        rawArr
                                    });
                                }
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Aviso al consultar API en vivo:', e);
        }

        // Si la API en vivo no tiene formaciones para ese horario exacto (ej. horarios diurnos fuera de la ventana de 60m o fechas futuras), consultar cronograma programado oficial
        let combinedServices = [...liveServices];

        const scheduledFallback = getScheduledTrips(originStation.name, destStation.name, selH, selM);
        
        // Agregar los servicios programados que no dupliquen a los ya encontrados en vivo
        scheduledFallback.forEach(sch => {
            const alreadyInLive = liveServices.some(ls => Math.abs(ls.depMinutes - sch.depMinutes) <= 3);
            if (!alreadyInLive) {
                combinedServices.push(sch);
            }
        });

        // Ordenar por hora de salida ascendente
        combinedServices.sort((a, b) => a.depMinutes - b.depMinutes);

        currentSearchResults = combinedServices;
        renderSearchResults(combinedServices);
    }

    function renderSearchResults(services) {
        resultsServicesContainer.innerHTML = '';

        if (services.length === 0) {
            resultsServicesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 2em; margin-bottom: 12px;"></i>
                    <p style="font-size: 1.05em; font-weight: 700; color: #1e293b;">Sin servicios para el horario seleccionado</p>
                    <p style="font-size: 0.9em; margin-top: 6px;">No se registran trenes directos entre ${originStation.name} y ${destStation.name} a partir de las ${inputTime.value} hs.</p>
                </div>
            `;
            return;
        }

        services.forEach(srv => {
            const card = document.createElement('div');
            card.className = 'service-ticket-card';
            
            const displayDepTime = srv.minutesNotice ? `<span class="time-countdown">${srv.minutesNotice}</span>` : `<span class="time-big">${srv.depTime}</span>`;

            card.innerHTML = `
                <div class="ticket-header-pill">
                    Ramal ${srv.ramal}
                </div>
                <div class="ticket-body">
                    <div class="ticket-meta-row">
                        <span>Andén ${srv.anden}</span>
                        <span>${srv.estado}</span>
                    </div>
                    <div class="ticket-times-row">
                        ${displayDepTime}
                        <div class="ticket-track-line">
                            <div class="track-dashed"></div>
                            <div class="track-arrow-circle">
                                <i class="fa-solid fa-chevron-right"></i>
                            </div>
                        </div>
                        <span class="time-big">${srv.arrTime}</span>
                    </div>
                    <div class="ticket-labels-row">
                        <div class="ticket-station-label">
                            <small>Origen</small>
                            <strong>${originStation.name}</strong>
                        </div>
                        <div class="ticket-station-label dest">
                            <small>Destino</small>
                            <strong>${destStation.name}</strong>
                            <span class="service-num-tag">${srv.servicioNumero}</span>
                        </div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                openItineraryView(srv);
            });

            resultsServicesContainer.appendChild(card);
        });
    }

    // --- PANTALLA 4: ITINERARIO VERTICAL Y TREN EN VIVO EN LA VÍA (IMG_2560 a 2562) ---
    function openItineraryView(service) {
        currentSelectedService = service;
        showScreen('itinerary');

        itineraryTitleText.textContent = `De ${originStation.name} a ${destStation.name}`;
        itineraryTrackList.innerHTML = '';

        const full = (service.fullEstaciones && service.fullEstaciones.length > 0) ? service.fullEstaciones : service.estaciones;
        const normOrig = normalize(originStation.name);
        const normDest = normalize(destStation.name);

        let userOrigIdx = full.findIndex(s => {
            const ns = normalize(s.nombre);
            return ns.includes(normOrig) || normOrig.includes(ns) || (normOrig.includes('constitucion') && ns.includes('plaza c'));
        });
        let userDestIdx = full.findIndex(s => {
            const ns = normalize(s.nombre);
            return ns.includes(normDest) || normDest.includes(ns) || (normDest.includes('constitucion') && ns.includes('plaza c'));
        });

        if (userOrigIdx === -1) userOrigIdx = 0;
        if (userDestIdx === -1) userDestIdx = full.length - 1;

        // 1. Calcular ubicación real y precisa de la formación
        let trainLoc = { status: 'not_started' };
        const isLive = full.some(s => s.salida?.real || (s.segundos !== undefined && s.segundos !== null));

        if (isLive) {
            // A. Verificar si el tren está actualmente detenido en el andén de una estación
            for (let i = 0; i < full.length; i++) {
                const st = full[i];
                if (st.salida?.enAnden || (st.segundos !== undefined && Math.abs(st.segundos) <= 25 && st.salida?.real)) {
                    trainLoc = {
                        status: 'at_station',
                        stationIdx: i,
                        stationName: st.nombre
                    };
                    break;
                }
            }

            // B. Si no está detenido en andén, verificar entre qué dos estaciones está circulando en este instante
            if (trainLoc.status === 'not_started') {
                let lastPassedIdx = -1;
                for (let i = 0; i < full.length; i++) {
                    const st = full[i];
                    if (st.salida?.real || (st.segundos !== undefined && st.segundos < -15)) {
                        lastPassedIdx = i;
                    }
                }

                if (lastPassedIdx === -1) {
                    trainLoc = { status: 'not_started', startName: full[0].nombre };
                } else if (lastPassedIdx >= full.length - 1) {
                    trainLoc = { status: 'completed', endName: full[full.length - 1].nombre };
                } else {
                    trainLoc = {
                        status: 'in_motion',
                        fromIdx: lastPassedIdx,
                        fromName: full[lastPassedIdx].nombre,
                        toIdx: lastPassedIdx + 1,
                        toName: full[lastPassedIdx + 1].nombre
                    };
                }
            }
        } else {
            // C. En servicios programados oficiales sin GPS directo, calcular según el horario actual
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();

            const [dh, dm] = service.depTime.split(':').map(Number);
            const depMin = dh * 60 + dm;
            const [ah, am] = service.arrTime.split(':').map(Number);
            const arrMin = ah * 60 + am;

            if (nowMin < depMin - 2) {
                trainLoc = { status: 'not_started' };
            } else if (nowMin > arrMin + 4) {
                trainLoc = { status: 'completed' };
            } else {
                const numStops = Math.max(userDestIdx - userOrigIdx, 1);
                const elapsed = nowMin - depMin;
                const dur = Math.max(arrMin - depMin, 1);
                const prog = Math.min(Math.max(elapsed / dur, 0), 1);
                const relIdx = Math.floor(prog * numStops);
                const curIdx = userOrigIdx + relIdx;

                if (curIdx >= userDestIdx) {
                    trainLoc = { status: 'at_station', stationIdx: userDestIdx, stationName: full[userDestIdx].nombre };
                } else {
                    trainLoc = {
                        status: 'in_motion',
                        fromIdx: curIdx,
                        fromName: full[curIdx].nombre,
                        toIdx: curIdx + 1,
                        toName: full[curIdx + 1].nombre
                    };
                }
            }
        }

        // 2. Determinar tramo de estaciones a desplegar en la vía
        // Si el tren está en movimiento acercándose a la estación de origen, mostrar desde donde viene el tren
        let startIdx = userOrigIdx;
        if (trainLoc.status === 'in_motion' && trainLoc.fromIdx < userOrigIdx) {
            startIdx = trainLoc.fromIdx;
        } else if (trainLoc.status === 'at_station' && trainLoc.stationIdx < userOrigIdx) {
            startIdx = trainLoc.stationIdx;
        }

        let endIdx = Math.min(userDestIdx + 1, full.length - 1);
        if (endIdx < userDestIdx) endIdx = userDestIdx;

        const renderedStops = full.slice(startIdx, endIdx + 1);

        // 3. Renderizar estaciones e icono de la formación en la vía
        renderedStops.forEach((est, idx) => {
            const row = document.createElement('div');
            row.className = 'station-stop-row';

            let timeStr = '--:--';
            if (typeof est.salida?.programada === 'string' && est.salida.programada.length === 5) {
                timeStr = est.salida.programada;
            } else {
                const rawTime = est.salida?.estimada || est.salida?.programada || est.llegada?.estimada || est.llegada?.programada;
                const tDate = rawTime ? new Date(rawTime) : null;
                timeStr = tDate && !isNaN(tDate.getTime()) ? `${String(tDate.getHours()).padStart(2, '0')}:${String(tDate.getMinutes()).padStart(2, '0')}` : (service.depTime || '--:--');
            }

            const isTrainStoppedHere = (trainLoc.status === 'at_station' && normalize(est.nombre) === normalize(trainLoc.stationName));
            const nodeClass = isTrainStoppedHere ? 'station-stop-node train-at-platform' : 'station-stop-node';
            const badgeContent = isTrainStoppedHere 
                ? '<span class="time-pill-badge" style="background-color: #0284c7;">En andén</span>' 
                : `<span class="time-pill-badge">${timeStr}</span>`;

            row.innerHTML = `
                <div class="station-stop-name">${est.nombre}</div>
                <div class="${nodeClass}"></div>
                <div class="station-stop-time">
                    ${badgeContent}
                </div>
            `;

            itineraryTrackList.appendChild(row);

            // Inyectar el icono del tren ÚNICA Y EXCLUSIVAMENTE si el tren está en viaje real entre esta estación y la siguiente
            if (trainLoc.status === 'in_motion' &&
                normalize(est.nombre) === normalize(trainLoc.fromName) &&
                idx < renderedStops.length - 1 &&
                normalize(renderedStops[idx + 1].nombre) === normalize(trainLoc.toName)) {

                const trainOnTrack = document.createElement('div');
                trainOnTrack.className = 'live-train-on-track';
                trainOnTrack.innerHTML = `
                    <div class="live-train-icon-badge" title="Tren en movimiento">
                        <i class="fa-solid fa-train-subway"></i>
                    </div>
                `;
                itineraryTrackList.appendChild(trainOnTrack);
            }
        });

        // 4. Ficha Inferior Fija (Exacta a IMG_2560, IMG_2561, IMG_2562)
        const isEnAndenAtOrigin = (trainLoc.status === 'at_station' && normalize(trainLoc.stationName) === normalize(originStation.name));
        const statusLabel = isEnAndenAtOrigin ? 'En Andén' : (service.minutesNotice ? 'Próximo' : 'Normal');

        const displayTime = service.minutesNotice 
            ? `<span class="time-countdown">${service.minutesNotice}</span>` 
            : `<span class="time-big">${service.depTime}</span>`;

        itineraryBottomCard.innerHTML = `
            <div class="service-ticket-card" style="margin: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.18);">
                <div class="ticket-header-pill">
                    Ramal ${service.ramal}
                </div>
                <div class="ticket-body">
                    <div class="ticket-meta-row">
                        <span>Andén ${service.anden}</span>
                        <span>${statusLabel}</span>
                    </div>
                    <div class="ticket-times-row">
                        ${displayTime}
                        <div class="ticket-track-line">
                            <div class="track-dashed"></div>
                            <div class="track-arrow-circle">
                                <i class="fa-solid fa-chevron-right"></i>
                            </div>
                        </div>
                        <span class="time-big">${service.arrTime}</span>
                    </div>
                    <div class="ticket-labels-row">
                        <div class="ticket-station-label">
                            <small>Origen</small>
                            <strong>${originStation.name}</strong>
                        </div>
                        <div class="ticket-station-label dest">
                            <small>Destino</small>
                            <strong>${destStation.name}</strong>
                            <span class="service-num-tag">${service.servicioNumero}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        btnItineraryMap.href = 'mapa.html';
    }

    // --- CONFIGURACIÓN DE EVENTOS ---
    function setupEvents() {
        // Inputs de Origen y Destino abren el selector
        inputOriginPill.addEventListener('click', () => openStationPicker('origen'));
        inputDestPill.addEventListener('click', () => openStationPicker('destino'));

        btnClearDest.addEventListener('click', handleClearDest);
        btnSwapStations.addEventListener('click', handleSwap);

        // Botón Circular Ir
        btnCircleIr.addEventListener('click', () => {
            if (btnCircleIr.classList.contains('active')) {
                executeTripSearch();
            }
        });

        // Date and Time interactivos
        if (inputDate) {
            inputDate.addEventListener('change', () => {
                userModifiedDateTime = true;
                updateDateTimeDisplay();
            });
        }

        if (inputTime) {
            inputTime.addEventListener('change', () => {
                userModifiedDateTime = true;
                updateDateTimeDisplay();
            });
        }

        if (pillCurrentDate) {
            pillCurrentDate.addEventListener('click', () => {
                try {
                    if (inputDate.showPicker) inputDate.showPicker();
                    else inputDate.focus();
                } catch (e) {
                    inputDate.focus();
                }
            });
        }

        if (pillCurrentTime) {
            pillCurrentTime.addEventListener('click', () => {
                try {
                    if (inputTime.showPicker) inputTime.showPicker();
                    else inputTime.focus();
                } catch (e) {
                    inputTime.focus();
                }
            });
        }

        // Toggle Favorito en Origen
        btnFavToggle.addEventListener('click', toggleFavorite);

        // Botón Volver del Selector
        btnPickerBack.addEventListener('click', () => showScreen('home'));
        pickerSearchInput.addEventListener('input', renderPickerStations);

        // Filtros de línea en el selector
        pickerChips.forEach(chip => {
            chip.addEventListener('click', () => {
                pickerChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeLineFilter = chip.dataset.line;
                renderPickerStations();
            });
        });

        // Botón Volver de Resultados
        btnResultsBack.addEventListener('click', () => showScreen('home'));

        // Botón Volver de Itinerario
        btnItineraryBack.addEventListener('click', () => showScreen('results'));

        // Bottom Navigation
        tabHome.addEventListener('click', () => showScreen('home'));
        tabNotifications.addEventListener('click', () => showScreen('notifications'));
        tabMenu.addEventListener('click', () => showScreen('menu'));

        // Menú: Mis Favoritos
        if (menuItemFavs) {
            menuItemFavs.addEventListener('click', () => {
                showScreen('home');
                const favCard = document.querySelector('.favorites-row');
                if (favCard) favCard.scrollIntoView({ behavior: 'smooth' });
            });
        }
    }

    // --- INICIALIZACIÓN ---
    function init() {
        initDateTime();
        setInterval(syncClockTicker, 10000);
        renderFavorites();
        setupEvents();
        showScreen('home');
    }

    init();
});

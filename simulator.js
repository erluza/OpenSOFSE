/**
 * ============================================================================
 * TABLERO EN VIVO - TRENES ARGENTINOS (SOFSE API)
 * Simulación y visualización real en tiempo real de partidas y arribos
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTACIONES PRINCIPALES DE INICIO ---
    const PRIMARY_TERMINALS = {
        '332': {
            id: '332',
            name: 'Retiro',
            line: 'Mitre',
            lineId: 5,
            title: 'RETIRO (MITRE) Próximas Salidas'
        },
        '463': {
            id: '463',
            name: 'Retiro',
            line: 'San Martín',
            lineId: 31,
            title: 'RETIRO (SAN MARTÍN) Próximas Salidas'
        },
        '93': {
            id: '93',
            name: 'Constitución',
            line: 'Roca',
            lineId: 11,
            title: 'PLAZA C. Próximas Salidas'
        },
        '293': {
            id: '293',
            name: 'Once',
            line: 'Sarmiento',
            lineId: 1,
            title: 'ONCE Próximas Salidas'
        },
        '525': {
            id: '525',
            name: 'Dr. Sáenz',
            line: 'Belgrano Sur',
            lineId: 21,
            title: 'DR. A. SÁENZ Próximas Salidas'
        }
    };

    // Logos SVG oficiales para cada línea
    const LINE_LOGOS = {
        'Roca': 'logo_roca.svg',
        'Mitre': 'logo_mitre.svg',
        'San Martín': 'logo_san_martin.svg',
        'Sarmiento': 'logo_sarmiento.svg',
        'Belgrano Sur': 'logo_belgrano_sur.svg'
    };

    // Insignias visuales de línea
    const LINE_PILLS = {
        'Roca': 'pill-roca',
        'Mitre': 'pill-mitre',
        'San Martín': 'pill-sanmartin',
        'Sarmiento': 'pill-sarmiento',
        'Belgrano Sur': 'pill-belgranosur'
    };

    // --- ELEMENTOS DEL DOM ---
    const boardContainer = document.getElementById('board-container');
    const boardTitle = document.getElementById('board-title');
    const clockElement = document.getElementById('clock');
    const tickerMessageElement = document.getElementById('ticker-message');
    const footerLineLogo = document.getElementById('footer-line-logo');
    const liveStatusText = document.getElementById('live-status-text');
    const refreshTimer = document.getElementById('refresh-timer');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnTogglePanel = document.getElementById('btn-toggle-panel');
    const customStationTag = document.getElementById('custom-station-tag');
    const customStationName = document.getElementById('custom-station-name');
    const clearCustomStationBtn = document.getElementById('clear-custom-station-btn');

    // Botones de las 5 terminales
    const terminalTabs = document.querySelectorAll('.terminal-tab');

    // Modal de búsqueda de estación
    const btnSearchStation = document.getElementById('btn-search-station');
    const stationModalOverlay = document.getElementById('station-modal-overlay');
    const closeStationModalBtn = document.getElementById('close-station-modal-btn');
    const stationSearchInput = document.getElementById('station-search-input');
    const stationsListContainer = document.getElementById('stations-list-container');
    const stationsResultCount = document.getElementById('stations-result-count');
    const filterButtons = document.querySelectorAll('.station-line-filters .filter-btn');

    // Panel de Control Manual
    const panelOverlay = document.getElementById('control-panel-overlay');
    const boardSlotSelect = document.getElementById('board-slot-select');
    const ramalSelect = document.getElementById('ramal-select');
    const experimentalCheckbox = document.getElementById('experimental-checkbox');
    const stationToggleList = document.getElementById('station-toggle-list');
    const stationSelect = document.getElementById('station-select');
    const updateTrainBtn = document.getElementById('update-train-btn');
    const clearOverridesBtn = document.getElementById('clear-overrides-btn');
    const updateTickerBtn = document.getElementById('update-ticker-btn');
    const closePanelBtn = document.getElementById('close-panel-btn');

    // --- ESTADO DE LA APLICACIÓN ---
    let currentStation = PRIMARY_TERMINALS['93']; // Constitución por defecto
    let allStationsList = [];                     // Estaciones disponibles
    let liveTrainsOnBoard = [];                   // Trenes reales de la API
    let boardOverrides = {};                      // Sobrescrituras manuales
    let scheduleData = null;                      // Respaldo de horarios para modo manual
    let gerenciasData = [];                       // Alertas oficiales de gerencias
    let tickerMessages = [];                      // Mensajes rotativos para el ticker
    let tickerIndex = 0;
    let autoRefreshCountdown = 30;                // Segundos hasta auto-refresh
    let countdownInterval = null;
    let activeFilterLine = 'all';

    // --- UTILIDAD DE NORMALIZACIÓN PARA BÚSQUEDAS (IGNORA TILDES Y MAYÚSCULAS) ---
    function normalizeSearch(str) {
        return (str || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    // --- TERMINALES Y CABECERAS INTERMEDIAS ---
    const TERMINAL_STATION_IDS = new Set([
        // Línea Roca
        '93', '13', '132', '72', '53', '222', '477', '237', '275', '90', '180', '183', '389', '48', '320', '60',
        // Línea Mitre
        '332', '399', '42', '200', '429', '70', '408',
        // Línea San Martín
        '463', '119', '311', '204', '74',
        // Línea Sarmiento
        '293', '278', '266', '80', '279', '269',
        // Línea Belgrano Sur
        '525', '57', '163', '257', '526', '527', '388'
    ]);

    function isTerminalStation(stId, stName, desde, hasta) {
        if (stId && TERMINAL_STATION_IDS.has(String(stId))) return true;
        const norm = normalizeSearch(stName);
        if (norm && (norm === normalizeSearch(desde) || norm === normalizeSearch(hasta))) return true;
        return false;
    }

    // --- AUTENTICACIÓN DINÁMICA SOFSE (Sin Backend) ---
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

        // Pase 1
        let v = btoa(username)
            .replace(/a/g, '#t').replace(/e/g, '#x').replace(/i/g, '#f')
            .replace(/o/g, '#l').replace(/u/g, '#7').replace(/=/g, '#g')
            .split('').reverse().join('');

        // Pase 2
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

            if (!res.ok) throw new Error(`Error en autenticación SOFSE: HTTP ${res.status}`);
            const data = await res.json();
            if (data.token) {
                localStorage.setItem('sofse_token', data.token);
                // Válido por 12 horas para renovar proactivamente
                localStorage.setItem('sofse_token_expiry', String(now + 12 * 3600 * 1000));
                return data.token;
            }
            throw new Error('No se recibió token en respuesta');
        } catch (err) {
            console.error('Error al autorizar con SOFSE:', err);
            return null;
        }
    }

    // --- PETICIÓN DE ARRIBOS Y PARTIDAS EN VIVO ---
    async function fetchDepartures(stationId) {
        let token = await getAuthToken();
        if (!token) throw new Error('No se pudo obtener credencial de acceso');

        let res = await fetch(`https://api-servicios.sofse.gob.ar/v1/arribos/estacion/${stationId}`, {
            headers: { 'Authorization': token }
        });

        // Si expiró el token en el servidor, renueva una vez y reintenta
        if (res.status === 401 || res.status === 403) {
            token = await getAuthToken(true);
            res = await fetch(`https://api-servicios.sofse.gob.ar/v1/arribos/estacion/${stationId}`, {
                headers: { 'Authorization': token }
            });
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return parseRawDepartures(data.results || [], stationId);
    }

    // --- FORMATEO Y PARSEO DE TRENES ---
    function parseRawDepartures(results, stationId) {
        const trains = [];

        results.forEach(item => {
            const arr = item.arribo || {};
            const srv = item.servicio || {};
            const salida = arr.salida || {};
            const llegada = arr.llegada || {};

            // Determinar hora de partida o llegada
            const rawIso = salida.estimada || salida.programada || llegada.estimada || llegada.programada;
            if (!rawIso) return;

            const timeStr = formatIsoTime(rawIso);
            const platform = arr.anden?.nombre || '-';
            
            // Destino final
            let destination = srv.hasta?.estacion?.nombre 
                           || srv.ramal?.cabeceraFinal?.nombreCorto 
                           || srv.ramal?.cabeceraFinal?.nombre 
                           || srv.ramal?.nombre 
                           || 'DESTINO DESCONOCIDO';
            destination = destination.toUpperCase();

            // Estado del tren
            const statusInfo = computeTrainStatus(arr, srv, stationId);

            // Lista de paradas intermedias
            const stops = extractIntermediateStops(srv.estaciones || [], stationId, arr.orden);

            trains.push({
                time: timeStr,
                iso: rawIso,
                platform: platform,
                destination: destination,
                status: statusInfo.status,
                statusText: statusInfo.text,
                stops: stops,
                serviceName: srv.ramal?.nombre || srv.nombre || destination
            });
        });

        // Ordenar cronológicamente por horario
        trains.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());

        // Filtrar trenes que ya hayan salido hace más de 3 minutos
        const nowMs = Date.now();
        const upcomingTrains = trains.filter(t => {
            const diff = (new Date(t.iso).getTime() - nowMs) / 60000;
            return diff >= -3;
        });

        return upcomingTrains.slice(0, 6);
    }

    function formatIsoTime(isoStr) {
        if (!isoStr) return '--:--';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '--:--';
        return new Intl.DateTimeFormat('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'America/Argentina/Buenos_Aires'
        }).format(d);
    }

    function computeTrainStatus(arr, srv, stationId) {
        if (srv.cancelacion) {
            return { status: 'cancelado', text: 'CANCELADO' };
        }

        const salida = arr.salida || {};
        const llegada = arr.llegada || {};
        const progIso = salida.programada || llegada.programada;
        const estIso = salida.estimada || llegada.estimada;
        const targetIso = estIso || progIso;

        // Comprobación de demoras
        if (progIso && estIso) {
            const diffMins = (new Date(estIso).getTime() - new Date(progIso).getTime()) / 60000;
            if (diffMins >= 4) {
                return { status: 'demorado', text: 'DEMORADO' };
            }
        }

        const diffMins = targetIso ? (new Date(targetIso).getTime() - Date.now()) / 60000 : 999;
        const vel = Number(salida.velocidad) || 0;
        const dist = Number(salida.distancia) || 0;
        const desde = srv.desde?.estacion?.nombre || srv.ramal?.cabeceraInicial?.nombre || '';
        const hasta = srv.hasta?.estacion?.nombre || srv.ramal?.cabeceraFinal?.nombre || '';
        const currentStName = currentStation?.name || '';
        const isTerminal = isTerminalStation(stationId, currentStName, desde, hasta);

        // 1. SI ES TERMINAL O CABECERA INTERMEDIA:
        if (isTerminal) {
            // Si el tren está a velocidad alta y el horario ya pasó, ya partió
            if (vel > 3 && diffMins < 0) {
                return { status: 'programado', text: 'EN VIAJE' };
            }
            // En andén de terminal: tiene andén asignado y faltan <= 12 minutos
            if (arr.anden?.nombre && diffMins >= -1 && diffMins <= 12) {
                return { status: 'en-anden', text: 'EN ANDÉN' };
            }
            return { status: 'programado', text: 'PROGRAMADO' };
        }

        // 2. SI ES ESTACIÓN INTERMEDIA (como Caballito, Lanús, Banfield, Martínez, etc.):
        // En estaciones intermedias comunes los trenes solo paran entre 20 y 45 segundos.
        // NUNCA debe decir "EN ANDÉN" para trenes a minutos de distancia.

        // Si la telemetría GPS directa confirma que está detenido a 0 km/h en la estación:
        if (salida.velocidad !== undefined && vel === 0 && dist <= 70) {
            return { status: 'en-estacion', text: 'EN ESTACIÓN' };
        }

        // Si está en el momento exacto de la parada (menos de 40 segundos antes o después):
        if (diffMins >= -0.5 && diffMins <= 0.6) {
            return { status: 'en-estacion', text: 'EN ESTACIÓN' };
        }

        // Si está aproximando a la estación (entre 45 seg y 2.5 min):
        if (diffMins > 0.6 && diffMins <= 2.5) {
            return { status: 'aproximando', text: 'APROXIMANDO' };
        }

        // Si falta más tiempo (ej. 3 a 15 minutos), el tren está en viaje en horario
        return { status: 'programado', text: 'PROGRAMADO' };
    }

    function extractIntermediateStops(estaciones, stationId, currentOrden) {
        if (!estaciones || estaciones.length === 0) return [];

        let currentIndex = -1;
        if (stationId) {
            currentIndex = estaciones.findIndex(e => String(e.idElemento) === String(stationId));
        }
        if (currentIndex === -1 && typeof currentOrden === 'number') {
            currentIndex = estaciones.findIndex(e => e.orden === currentOrden);
        }

        let futureStops = [];
        if (currentIndex !== -1) {
            futureStops = estaciones.slice(currentIndex + 1)
                .filter(e => e.parada)
                .map(e => e.nombre.toUpperCase());
        } else {
            futureStops = estaciones.filter(e => e.parada).map(e => e.nombre.toUpperCase());
        }

        return futureStops;
    }

    // --- OBTENCIÓN DE ALERTAS OFICIALES (TICKER) ---
    async function fetchGerencias() {
        try {
            const token = await getAuthToken();
            if (!token) return;

            const res = await fetch('https://api-servicios.sofse.gob.ar/v1/infraestructura/gerencias?idEmpresa=1', {
                headers: { 'Authorization': token }
            });
            if (!res.ok) return;

            gerenciasData = await res.json();
            updateTickerMessagesForCurrentLine();
        } catch (e) {
            console.warn('No se pudieron obtener alertas de gerencias:', e);
        }
    }

    function updateTickerMessagesForCurrentLine() {
        tickerMessages = [];
        const lineId = currentStation.lineId;
        const lineData = gerenciasData.find(g => g.id === lineId);

        if (lineData) {
            if (lineData.alerta && lineData.alerta.length > 0) {
                lineData.alerta.forEach(al => {
                    if (al.contenido && al.habilitado) {
                        tickerMessages.push(al.contenido.trim().toUpperCase());
                    }
                });
            }
            if (lineData.estado && lineData.estado.mensaje && lineData.estado.mensaje !== 'Alertas por ramal') {
                tickerMessages.push(`ESTADO LÍNEA ${currentStation.line.toUpperCase()}: ${lineData.estado.mensaje.toUpperCase()}`);
            }
        }

        if (liveTrainsOnBoard.length === 0) {
            tickerMessages.push(`LÍNEA ${currentStation.line.toUpperCase()}: SERVICIOS FINALIZADOS POR HOY O SIN PRÓXIMAS SALIDAS PROGRAMADAS EN ESTA ESTACIÓN`);
        }

        tickerMessages.push(`LÍNEA ${currentStation.line.toUpperCase()} • TRENES ARGENTINOS OPERACIONES`);
        tickerMessages.push("RECUERDE VIAJAR CON SU TARJETA SUBE REGISTRADA Y RESPETAR LA LÍNEA AMARILLA");
        tickerMessages.push("LOS HORARIOS Y ANDENES ESTÁN SUJETOS A MODIFICACIONES POR RAZONES OPERATIVAS");

        if (scheduleData && scheduleData.mensajes) {
            scheduleData.mensajes.forEach(m => {
                if (!tickerMessages.includes(m)) tickerMessages.push(m);
            });
        }
    }

    function rotateTicker() {
        if (!tickerMessages || tickerMessages.length === 0) return;
        tickerMessageElement.textContent = tickerMessages[tickerIndex];
        tickerIndex = (tickerIndex + 1) % tickerMessages.length;
    }

    // --- ACTUALIZACIÓN Y RENDERIZADO DEL TABLERO ---
    async function updateBoardData() {
        try {
            liveStatusText.textContent = 'ACTUALIZANDO...';
            liveStatusText.style.color = '#ffa500';

            const trains = await fetchDepartures(currentStation.id);
            liveTrainsOnBoard = trains;

            liveStatusText.textContent = 'EN VIVO';
            liveStatusText.style.color = '#00e676';
            renderBoard();
        } catch (error) {
            console.error('Error al actualizar arribos en vivo:', error);
            liveStatusText.textContent = 'MODO RESPALDO';
            liveStatusText.style.color = '#ff6b6b';

            fallbackToLocalSchedule();
            renderBoard();
        }
    }

    function renderBoard() {
        boardContainer.innerHTML = '';

        for (let i = 0; i < 6; i++) {
            let train = boardOverrides[i] || liveTrainsOnBoard[i];

            if (train) {
                const isCompact = train.stops && train.stops.length > 12;
                const column = document.createElement('div');
                column.className = 'train-column';
                column.innerHTML = `
                    <div class="train-header">
                        <div class="header-section">
                            <span>ANDÉN</span>
                            <span class="platform">${train.platform || '-'}</span>
                        </div>
                        <div class="header-section">
                            <span>HORA SALIDA</span>
                            <span class="departure-time">${train.time || '--:--'}</span>
                        </div>
                    </div>
                    <div class="destination">${train.destination || '---'}</div>
                    <div class="status-bar ${train.status || 'programado'}">${train.statusText || 'PROGRAMADO'}</div>
                    <ul class="stops-list ${isCompact ? 'compact' : ''}">
                        ${(train.stops || []).map(s => `<li>${s}</li>`).join('')}
                    </ul>
                `;
                boardContainer.appendChild(column);
            } else {
                // Columna Standby si hay menos de 6 trenes
                const isFirstEmpty = (i === 0 && liveTrainsOnBoard.length === 0 && Object.keys(boardOverrides).length === 0);
                const emptyCol = document.createElement('div');
                emptyCol.className = 'train-column standby';
                emptyCol.innerHTML = `
                    <div class="train-header">
                        <div class="header-section">
                            <span>ANDÉN</span>
                            <span class="platform">-</span>
                        </div>
                        <div class="header-section">
                            <span>HORA SALIDA</span>
                            <span class="departure-time">--:--</span>
                        </div>
                    </div>
                    <div class="destination">${isFirstEmpty ? 'FIN DE SERVICIO' : '---'}</div>
                    <div class="status-bar sin-servicio">SIN SERVICIO</div>
                    <ul class="stops-list">
                        ${isFirstEmpty ? '<li>NO HAY SALIDAS</li><li>PROGRAMADAS POR HOY</li><li>CONSULTE CARTELERA</li>' : ''}
                    </ul>
                `;
                boardContainer.appendChild(emptyCol);
            }
        }
    }

    function fallbackToLocalSchedule() {
        if (!scheduleData || !scheduleData.ramales) return;
        const now = new Date();
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        let allNext = [];
        scheduleData.ramales.forEach(ramal => {
            (ramal.horarios.dias_habiles || []).forEach(horario => {
                if (horario > currentTimeStr) {
                    allNext.push({
                        time: horario,
                        platform: (allNext.length % 6) + 1,
                        destination: ramal.paradas[ramal.paradas.length - 1].toUpperCase(),
                        status: 'programado',
                        statusText: 'PROGRAMADO',
                        stops: ramal.paradas.map(p => p.toUpperCase()),
                        serviceName: ramal.nombre
                    });
                }
            });
        });
        allNext.sort((a, b) => a.time.localeCompare(b.time));
        liveTrainsOnBoard = allNext.slice(0, 6);
    }

    // --- CAMBIO DE ESTACIÓN ---
    function selectStation(stationObj) {
        currentStation = stationObj;

        // Actualizar título
        boardTitle.textContent = stationObj.title;

        // Actualizar logo oficial de la línea en el pie de página
        if (footerLineLogo) {
            const logoFile = LINE_LOGOS[stationObj.line] || 'logo_roca.svg';
            footerLineLogo.src = logoFile;
            footerLineLogo.alt = `Trenes Argentinos Línea ${stationObj.line}`;
        }

        // Actualizar estado visual de los botones de terminales
        const isPrimary = PRIMARY_TERMINALS[stationObj.id] !== undefined;
        terminalTabs.forEach(tab => {
            if (tab.dataset.stationId === stationObj.id) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Mostrar u ocultar tag de estación personalizada
        if (!isPrimary) {
            customStationTag.style.display = 'flex';
            customStationName.textContent = `${stationObj.name} (${stationObj.line})`;
        } else {
            customStationTag.style.display = 'none';
        }

        // Reiniciar contador y actualizar datos
        autoRefreshCountdown = 30;
        updateTickerMessagesForCurrentLine();
        rotateTicker();
        updateBoardData();
    }

    // --- CARGA DE LISTA DE TODAS LAS ESTACIONES (ROBUSTA Y SIN FALLAS DE RED) ---
    async function loadAllStations() {
        // 1. Usar STATIONS_DB cargada síncronamente desde stations_data.js (soporte 100% file:///)
        if (window.STATIONS_DB && Array.isArray(window.STATIONS_DB) && window.STATIONS_DB.length > 0) {
            allStationsList = window.STATIONS_DB.map(s => ({
                id: String(s.id),
                name: s.name,
                line: s.line,
                lineId: s.lineId,
                title: `${s.name.toUpperCase()} Próximas Salidas`,
                pillClass: LINE_PILLS[s.line] || 'pill-roca'
            }));
            renderStationsModalList();
            return;
        }

        // 2. Respaldo por fetch en caso de estar corriendo en servidor web
        try {
            const res = await fetch('all_stations.json');
            const data = await res.json();
            allStationsList = [];

            const seen = new Set();
            for (const [lineName, stations] of Object.entries(data)) {
                stations.forEach(s => {
                    const key = `${lineName}-${s.id_estacion}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        allStationsList.push({
                            id: String(s.id_estacion),
                            name: s.nombre,
                            line: lineName,
                            lineId: (PRIMARY_TERMINALS[s.id_estacion]?.lineId) || 1,
                            title: `${s.nombre.toUpperCase()} Próximas Salidas`,
                            pillClass: LINE_PILLS[lineName] || 'pill-roca'
                        });
                    }
                });
            }

            allStationsList.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
            renderStationsModalList();
        } catch (e) {
            console.error('Error al cargar all_stations.json:', e);
        }
    }

    // --- RENDERIZADO DEL BUSCADOR DE ESTACIONES ---
    function renderStationsModalList() {
        const rawQuery = (stationSearchInput.value || '').trim();
        const normQuery = normalizeSearch(rawQuery);
        const queryTerms = normQuery.split(/\s+/).filter(t => t.length > 0);

        stationsListContainer.innerHTML = '';

        const filtered = allStationsList.filter(s => {
            // Filtro por línea
            const matchesLine = (activeFilterLine === 'all' || s.line === activeFilterLine);
            if (!matchesLine) return false;

            // Si no hay búsqueda escrita, pasa el filtro
            if (queryTerms.length === 0) return true;

            // Búsqueda insensible a tildes y caracteres especiales
            const stNameNorm = normalizeSearch(s.name);
            const stLineNorm = normalizeSearch(s.line);

            // Cada término buscado debe coincidir con el nombre o la línea
            return queryTerms.every(term => stNameNorm.includes(term) || stLineNorm.includes(term));
        });

        // Actualizar contador
        if (stationsResultCount) {
            stationsResultCount.textContent = `Mostrando ${filtered.length} estación${filtered.length === 1 ? '' : 'es'}${activeFilterLine !== 'all' ? ` de Línea ${activeFilterLine}` : ''}`;
        }

        if (filtered.length === 0) {
            stationsListContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #8fa0b5;">
                    <p style="font-size: 1.2em; margin-bottom: 6px;">No se encontraron estaciones para "<strong>${rawQuery}</strong>"</p>
                    <p style="font-size: 0.9em; color: #64748b;">Probá escribir parte del nombre, por ejemplo: <em>quilmes, moron, saenz, martin, catan</em></p>
                </div>
            `;
            return;
        }

        filtered.forEach(st => {
            const card = document.createElement('div');
            card.className = 'station-card';
            card.innerHTML = `
                <span class="station-name">${st.name}</span>
                <span class="station-line-badge ${st.pillClass}">${st.line}</span>
            `;
            card.addEventListener('click', () => {
                selectStation(st);
                toggleStationModal(false);
            });
            stationsListContainer.appendChild(card);
        });
    }

    function toggleStationModal(show = null) {
        const isVisible = stationModalOverlay.classList.contains('visible');
        if (show === null ? !isVisible : show) {
            stationModalOverlay.classList.add('visible');
            stationSearchInput.value = '';
            stationSearchInput.focus();
            renderStationsModalList();
        } else {
            stationModalOverlay.classList.remove('visible');
        }
    }

    // --- RELOJ Y TEMPORIZADORES ---
    function updateClock() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        clockElement.textContent = `${hours}:${minutes}`;
    }

    function handleCountdown() {
        autoRefreshCountdown--;
        if (autoRefreshCountdown <= 0) {
            autoRefreshCountdown = 30;
            updateBoardData();
        }
        refreshTimer.textContent = `${autoRefreshCountdown}s`;
    }

    // --- CONFIGURACIÓN DE EVENTOS ---
    function setupEventListeners() {
        // Pestañas de las 5 Terminales de Inicio
        terminalTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const stationId = tab.dataset.stationId;
                const stationObj = PRIMARY_TERMINALS[stationId];
                if (stationObj) {
                    selectStation(stationObj);
                }
            });
        });

        // Botón limpiar estación personalizada
        clearCustomStationBtn.addEventListener('click', () => {
            selectStation(PRIMARY_TERMINALS['93']); // Vuelve a Constitución
        });

        // Modal de búsqueda
        btnSearchStation.addEventListener('click', () => toggleStationModal(true));
        closeStationModalBtn.addEventListener('click', () => toggleStationModal(false));
        stationModalOverlay.addEventListener('click', (e) => {
            if (e.target === stationModalOverlay) toggleStationModal(false);
        });

        // Eventos del input del buscador
        stationSearchInput.addEventListener('input', renderStationsModalList);
        stationSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstCard = stationsListContainer.querySelector('.station-card');
                if (firstCard) {
                    firstCard.click();
                }
            }
        });

        // Botones de filtro de línea en el modal
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilterLine = btn.dataset.filter;
                renderStationsModalList();
            });
        });

        // Refresco manual
        btnRefresh.addEventListener('click', () => {
            autoRefreshCountdown = 30;
            updateBoardData();
            fetchGerencias();
        });

        // Atajo teclado y botón para panel manual
        btnTogglePanel.addEventListener('click', () => togglePanel());
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
                togglePanel();
            }
            if (e.key === 'Escape') {
                toggleStationModal(false);
                togglePanel(false);
            }
        });

        // Eventos del Panel de Control
        boardSlotSelect.addEventListener('change', prefillPanelInputs);
        if (experimentalCheckbox) experimentalCheckbox.addEventListener('change', populatePanelRamals);
        if (ramalSelect) ramalSelect.addEventListener('change', populateStationLists);
        closePanelBtn.addEventListener('click', () => togglePanel(false));
        updateTrainBtn.addEventListener('click', applyTrainChanges);
        clearOverridesBtn.addEventListener('click', () => {
            boardOverrides = {};
            renderBoard();
            togglePanel(false);
        });
        updateTickerBtn.addEventListener('click', () => {
            const msg = document.getElementById('custom-ticker-message').value.trim();
            if (msg) {
                tickerMessages.unshift(msg.toUpperCase());
                tickerIndex = 0;
                rotateTicker();
            }
        });
    }

    // --- PANEL DE CONTROL MANUAL (SIMULADOR) ---
    function togglePanel(show = null) {
        const isVisible = panelOverlay.classList.contains('visible');
        if (show === null ? !isVisible : show) {
            populatePanel();
            panelOverlay.classList.add('visible');
        } else {
            panelOverlay.classList.remove('visible');
        }
    }

    function populatePanel() {
        boardSlotSelect.innerHTML = '';
        for (let i = 1; i <= 6; i++) {
            const option = document.createElement('option');
            option.value = i - 1;
            option.textContent = `Posición ${i}`;
            boardSlotSelect.appendChild(option);
        }
        populatePanelRamals();
        prefillPanelInputs();
    }

    function populatePanelRamals() {
        if (!scheduleData) return;
        ramalSelect.innerHTML = '';
        (scheduleData.ramales || []).forEach((ramal, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = ramal.nombre;
            option.dataset.type = 'normal';
            ramalSelect.appendChild(option);
        });

        if (experimentalCheckbox.checked && scheduleData.ramales_experimentales) {
            scheduleData.ramales_experimentales.forEach((ramal, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `(E) ${ramal.nombre}`;
                option.dataset.type = 'experimental';
                ramalSelect.appendChild(option);
            });
        }
        populateStationLists();
    }

    function populateStationLists() {
        if (!scheduleData) return;
        const selectedOption = ramalSelect.options[ramalSelect.selectedIndex];
        stationToggleList.innerHTML = '';
        stationSelect.innerHTML = '';
        if (!selectedOption) return;

        const ramalType = selectedOption.dataset.type;
        const ramalIndex = selectedOption.value;
        const ramalList = ramalType === 'experimental' ? scheduleData.ramales_experimentales : scheduleData.ramales;
        const ramal = ramalList[ramalIndex];
        if (!ramal) return;

        (ramal.paradas || []).forEach(parada => {
            const option = document.createElement('option');
            option.value = parada;
            option.textContent = parada;
            stationSelect.appendChild(option);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'station-toggle-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `check-${parada.replace(/\s/g, '-')}`;
            checkbox.value = parada;
            checkbox.checked = true;

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = parada;

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            stationToggleList.appendChild(itemDiv);
        });
    }

    function prefillPanelInputs() {
        const slotIndex = boardSlotSelect.value;
        const currentTrain = boardOverrides[slotIndex] || liveTrainsOnBoard[slotIndex];
        if (!currentTrain) {
            document.getElementById('new-platform').value = '';
            document.getElementById('new-time').value = '';
            return;
        }
        document.getElementById('new-platform').value = currentTrain.platform || (parseInt(slotIndex, 10) + 1);
        document.getElementById('new-time').value = currentTrain.time || '';
        document.getElementById('new-status').value = currentTrain.status || 'programado';
    }

    function applyTrainChanges() {
        const slotIndex = boardSlotSelect.value;
        const enabledStops = Array.from(stationToggleList.querySelectorAll('input:checked')).map(cb => cb.value.toUpperCase());
        const finalDestination = stationSelect.value ? stationSelect.value.toUpperCase() : 'DESTINO';
        const newStatusSelect = document.getElementById('new-status');

        boardOverrides[slotIndex] = {
            serviceName: finalDestination,
            destination: finalDestination,
            stops: enabledStops,
            time: document.getElementById('new-time').value || "23:59",
            platform: document.getElementById('new-platform').value || "?",
            status: newStatusSelect.value,
            statusText: newStatusSelect.options[newStatusSelect.selectedIndex].text.toUpperCase()
        };

        renderBoard();
        togglePanel(false);
    }

    // --- INICIALIZACIÓN GENERAL ---
    async function init() {
        updateClock();
        setInterval(updateClock, 1000);

        setupEventListeners();

        // 1. Cargar base de horarios para simulación manual (desde objeto síncrono o fetch)
        if (window.SCHEDULE_FALLBACK) {
            scheduleData = window.SCHEDULE_FALLBACK;
        } else {
            try {
                const hRes = await fetch('horarios.json');
                scheduleData = await hRes.json();
            } catch (e) {
                console.warn('horarios.json local no disponible:', e);
            }
        }

        // 2. Cargar las 254 estaciones para el modal
        await loadAllStations();

        // 3. Cargar alertas oficiales de gerencias
        await fetchGerencias();
        rotateTicker();
        setInterval(rotateTicker, 10000);

        // 4. Inicializar según parámetro de URL (ej. desde el Radar en Vivo) o por defecto en Constitución
        const urlParams = new URLSearchParams(window.location.search);
        const paramStationId = urlParams.get('stationId') || urlParams.get('station');
        let initialStation = PRIMARY_TERMINALS['93'];

        if (paramStationId) {
            if (PRIMARY_TERMINALS[paramStationId]) {
                initialStation = PRIMARY_TERMINALS[paramStationId];
            } else if (allStationsList && allStationsList.length > 0) {
                const customMatch = allStationsList.find(s => String(s.id) === String(paramStationId));
                if (customMatch) initialStation = customMatch;
            }
        }
        selectStation(initialStation);

        // 5. Iniciar cuenta regresiva para refresco periódico
        countdownInterval = setInterval(handleCountdown, 1000);
        setInterval(fetchGerencias, 300000); // Refresca alertas cada 5 minutos
    }

    init();
});
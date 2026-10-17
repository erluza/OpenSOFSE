/**
 * ============================================================================
 * RADAR FERROVIARIO EN VIVO - TRENES ARGENTINOS
 * Mapa satelital interactivo, telemetría GPS y material rodante (SOFSE API)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const mapElement = document.getElementById('map');
    const trainCounterBadge = document.getElementById('trains-active-count');
    const sidebarTrainsCount = document.getElementById('sidebar-trains-count');
    const refreshTimerBadge = document.getElementById('refresh-timer-badge');
    const refreshIcon = document.getElementById('refresh-icon');
    const btnRefreshRadar = document.getElementById('btn-refresh-radar');
    const radarSearchInput = document.getElementById('radar-search-input');
    const radarSearchClear = document.getElementById('radar-search-clear');
    const lineFilterChips = document.querySelectorAll('.line-filter-chip');
    const radarSearchWrapper = document.getElementById('radar-search-wrapper');
    const btnToggleMobileSearch = document.getElementById('btn-toggle-mobile-search');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    
    // Selector de Capas
    const btnLayerMenu = document.getElementById('btn-layer-menu');
    const layerDropdown = document.getElementById('layer-dropdown');
    const currentLayerName = document.getElementById('current-layer-name');
    const layerOptions = document.querySelectorAll('.layer-option');

    // Panel Lateral
    const radarSidebar = document.getElementById('radar-sidebar');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const sidebarTrainsContainer = document.getElementById('sidebar-trains-container');
    const sidebarStationsContainer = document.getElementById('sidebar-stations-container');

    // Ficha Técnica de Formación (Inspector - Punto 3)
    const formationInspector = document.getElementById('formation-inspector');
    const btnCloseInspector = document.getElementById('btn-close-inspector');
    const inspectorFormationCode = document.getElementById('inspector-formation-code');
    const inspectorFormationModel = document.getElementById('inspector-formation-model');
    const inspectorTrainIcon = document.getElementById('inspector-train-icon');
    const inspectorLineBadge = document.getElementById('inspector-line-badge');
    const inspectorTractionBadge = document.getElementById('inspector-traction-badge');
    const inspectorServiceBadge = document.getElementById('inspector-service-badge');
    const inspectorStatusBadge = document.getElementById('inspector-status-badge');
    const inspectorSpeed = document.getElementById('inspector-speed');
    const inspectorPlatform = document.getElementById('inspector-platform');
    const inspectorDistance = document.getElementById('inspector-distance');
    const inspectorGpsCount = document.getElementById('inspector-gps-count');
    const inspectorOrigin = document.getElementById('inspector-origin');
    const inspectorDestination = document.getElementById('inspector-destination');
    const inspectorNextStation = document.getElementById('inspector-next-station');
    const inspectorGpsIds = document.getElementById('inspector-gps-ids');
    const btnFollowTrain = document.getElementById('btn-follow-train');
    const btnViewBoard = document.getElementById('btn-view-board');

    // --- ESTADO GENERAL ---
    let map = null;
    let currentTileLayer = null;
    let labelTileLayer = null;
    let activeFilterLine = 'all';
    let activeTrains = new Map();     // Clave: ID de servicio o formación -> Datos
    let trainMarkers = new Map();    // Clave: ID -> L.marker
    let stationMarkers = [];         // Array de L.circleMarker
    let stationsLayerGroup = null;
    let trainsLayerGroup = null;
    let refreshSeconds = 20;
    let refreshInterval = null;
    let selectedTrain = null;

    // Colores oficiales por línea
    const LINE_COLORS = {
        'Roca': '#30a9e0',
        'Mitre': '#0072ce',
        'San Martín': '#00828a',
        'Sarmiento': '#00853f',
        'Belgrano Sur': '#d9381e'
    };

    // Estaciones estratégicas troncales e intermedias para cobertura completa de la red (AMBA)
    const PROBE_STATIONS = [
        // Línea Roca
        93,  // Plaza Constitución
        386, // Temperley (nudo central ramales Korn, Ezeiza, Bosques)
        322, // Quilmes (corredor La Plata y Bosques vía Quilmes)
        38,  // Berazategui (empalme La Plata / Bosques)
        13,  // Alejandro Korn
        132, // Ezeiza
        43,  // Bosques
        217, // La Plata

        // Línea Mitre
        332, // Retiro Mitre
        34,  // Belgrano C (ramal Tigre)
        389, // Tigre
        409, // Victoria
        190, // J. L. Suárez
        360, // San Martín (corredor José León Suárez / Mitre)
        273, // Bmé. Mitre

        // Línea San Martín
        463, // Retiro San Martín
        415, // Villa del Parque
        67,  // Caseros
        194, // José C. Paz
        306, // Pilar
        51,  // Dr. Domingo Cabred

        // Línea Sarmiento
        293, // Once
        50,  // Caballito
        169, // Haedo (talleres y nudo de enlaces)
        279, // Morón (estación intermedia de mayor tráfico)
        70,  // Castelar
        278, // Moreno

        // Línea Belgrano Sur
        525, // Dr. Antonio Sáenz Viaducto (cabecera CABA)
        385, // Tapiales (nudo empalme González Catán y Marinos)
        154, // González Catán
        259  // Marinos del Crucero Gral. Belgrano
    ];

    // --- ESTACIONES TERMINALES Y CABECERAS INTERMEDIAS ---
    const TERMINAL_STATION_IDS = new Set([
        // Línea Roca
        '93', '13', '132', '386', '217', '43', '38', '322', '72', '53', '222', '477', '237', '275', '90', '180', '183', '60',
        // Línea Mitre
        '332', '389', '34', '190', '273', '409', '429', '70',
        // Línea San Martín
        '463', '51', '306', '194', '67',
        // Línea Sarmiento
        '293', '278', '266', '70', '279', '269', '248',
        // Línea Belgrano Sur
        '525', '121', '154', '259', '385', '57', '526', '527'
    ]);

    function isTerminalStation(stId, stName, desde, hasta) {
        if (stId && TERMINAL_STATION_IDS.has(String(stId))) return true;
        const norm = normalize(stName);
        if (norm && (norm === normalize(desde) || norm === normalize(hasta))) return true;
        return false;
    }

    // --- CÁLCULO DE RUMBO / BEARING EN GRADOS (0-360) ---
    function calculateBearing(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        const toRad = Math.PI / 180;
        const toDeg = 180 / Math.PI;
        const dLon = (lon2 - lon1) * toRad;
        const phi1 = lat1 * toRad;
        const phi2 = lat2 * toRad;
        const y = Math.sin(dLon) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
        return Math.round((Math.atan2(y, x) * toDeg + 360) % 360);
    }

    // --- CÁLCULO DE DISTANCIA HAVERSINE EN KM ---
    function getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // --- ANIMACIÓN FLUIDA DE MOVIMIENTO DE TRENES (GLIDE INTERPOLATION) ---
    function smoothMoveMarker(marker, startLatLng, endLatLng, durationMs = 2000) {
        const startTime = performance.now();
        const startLat = startLatLng[0];
        const startLon = startLatLng[1];
        const endLat = endLatLng[0];
        const endLon = endLatLng[1];

        if (Math.abs(endLat - startLat) < 0.00002 && Math.abs(endLon - startLon) < 0.00002) {
            marker.setLatLng([endLat, endLon]);
            return;
        }

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            // Curva ease-in-out cuadrática suave
            const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
            const curLat = startLat + (endLat - startLat) * ease;
            const curLon = startLon + (endLon - startLon) * ease;
            marker.setLatLng([curLat, curLon]);
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    }

    // --- DETERMINACIÓN RIGUROSA DEL ESTADO OPERATIVO DEL TREN ---
    function calculateTrainStatus({
        vel,
        lastDeparted,
        nextStation,
        isTerminal,
        anden,
        desde,
        hasta,
        trackingMode
    }) {
        const v = Number(vel) || 0;
        const andenStr = (anden && anden !== '-' && anden !== 'null') ? `Andén ${anden}` : '';

        // 1. TREN EN MARCHA REAL (Velocidad > 3 km/h o en tránsito activo entre estaciones)
        if (v > 3) {
            const targetName = nextStation ? nextStation.nombre : hasta;
            return {
                status: 'EN MARCHA',
                badgeClass: 'status-en-marcha',
                badgeText: `${v} km/h`,
                mapBadgeText: `${v} km/h`,
                icon: 'fa-gauge-high',
                color: '#0284c7',
                detailText: `En marcha a ${v} km/h hacia ${targetName}`,
                isAnden: false,
                isMoving: true
            };
        }

        // 2. TREN DETENIDO O A MUY BAJA VELOCIDAD (v <= 3 km/h)
        // Caso A: En cabecera de partida esperando horario de salida
        if (!lastDeparted && nextStation) {
            return {
                status: 'EN ANDÉN',
                badgeClass: 'status-en-anden',
                badgeText: andenStr ? andenStr.toUpperCase() : 'EN ANDÉN',
                mapBadgeText: andenStr || 'ANDÉN',
                icon: 'fa-signs-post',
                color: '#009a44',
                detailText: andenStr ? `${andenStr}, esperando salida en cabecera` : `En andén de cabecera ${desde}`,
                isAnden: true,
                isMoving: false
            };
        }

        // Caso B: Servicio que ya completó su recorrido en cabecera final
        if (lastDeparted && !nextStation) {
            return {
                status: 'FINALIZADO',
                badgeClass: 'status-finalizado',
                badgeText: 'FINALIZADO',
                mapBadgeText: 'DESTINO',
                icon: 'fa-flag-checkered',
                color: '#64748b',
                detailText: `Servicio finalizado en cabecera ${hasta}`,
                isAnden: false,
                isMoving: false
            };
        }

        // Caso C: En estación intermedia o próxima estación
        if (nextStation) {
            const hasArrivedAtNext = !!(nextStation.llegada && nextStation.llegada.real);
            const secToNext = nextStation.segundos !== undefined ? nextStation.segundos : 999;

            // Si la estación registró llegada real o faltan menos de 25 segundos y velocidad <= 3
            if (hasArrivedAtNext || secToNext <= 25) {
                return {
                    status: 'DETENIDO',
                    badgeClass: 'status-detenido-intermedia',
                    badgeText: andenStr ? `${andenStr} (PARADA)` : 'EN ESTACIÓN',
                    mapBadgeText: andenStr || 'PARADA',
                    icon: 'fa-people-group',
                    color: '#0ea5e9',
                    detailText: `Detenido brevemente en ${nextStation.nombre} (ascenso y descenso de pasajeros)`,
                    isAnden: false,
                    isMoving: false
                };
            }

            // Si está detenido entre estaciones (señal en rojo o precaución en vía)
            if (lastDeparted) {
                return {
                    status: 'SEÑAL / ESPERA',
                    badgeClass: 'status-detenido-via',
                    badgeText: 'EN VÍA',
                    mapBadgeText: 'SEÑAL',
                    icon: 'fa-traffic-light',
                    color: '#eab308',
                    detailText: `Detenido momentáneamente en vía entre ${lastDeparted.nombre} y ${nextStation.nombre}`,
                    isAnden: false,
                    isMoving: false
                };
            }
        }

        return {
            status: 'EN VÍA',
            badgeClass: 'status-en-via',
            badgeText: 'EN VÍA',
            mapBadgeText: 'EN VÍA',
            icon: 'fa-train-subway',
            color: '#64748b',
            detailText: `En tránsito en vía hacia ${hasta}`,
            isAnden: false,
            isMoving: false
        };
    }

    // --- MODELOS Y CLASIFICACIÓN TÉCNICA DE MATERIAL RODANTE (PUNTO 3) ---
    function getRollingStockInfo(code, linea, esElectrico) {
        const c = (code || '').toUpperCase().trim();
        let modelo = '';
        let fabricante = '';
        let coches = '';
        let traccion = esElectrico ? 'Eléctrica' : 'Diésel';
        let icono = esElectrico ? 'fa-bolt' : 'fa-gas-pump';
        let alimentacion = '';

        if (linea === 'Roca') {
            if (esElectrico) {
                modelo = 'EMU CSR Zhuzhou';
                fabricante = 'CRRC Zhuzhou Locomotive (China)';
                coches = '7 u 8 coches acoplados';
                alimentacion = '25.000 V CA (Catenaria aérea)';
            } else {
                modelo = 'Locomotora CRRC CKD8G / Materfer';
                fabricante = 'CRRC Dalian / Materfer';
                coches = 'Coches remolcados Materfer';
                alimentacion = 'Diésel-Eléctrico';
            }
        } else if (linea === 'Mitre') {
            if (esElectrico) {
                modelo = 'EMU CSR Zhuzhou';
                fabricante = 'CRRC Zhuzhou (China)';
                coches = '6 coches (Tigre) / 6 coches (Suárez)';
                alimentacion = '830 V CC (Tercer Riel)';
            } else {
                modelo = 'Coche Motor Materfer CM/CR';
                fabricante = 'Materfer (Córdoba, Argentina)';
                coches = 'Dupla / Tripla Diésel';
                alimentacion = 'Diésel Mecánico';
            }
        } else if (linea === 'San Martín') {
            modelo = 'Locomotora CRRC Qishuyan SDD7';
            fabricante = 'CRRC Qishuyan (China)';
            coches = '6 coches remolcados CSR';
            alimentacion = 'Diésel-Eléctrico (Caterpillar 3516B)';
            traccion = 'Diésel';
            icono = 'fa-gas-pump';
        } else if (linea === 'Sarmiento') {
            if (esElectrico) {
                modelo = 'EMU CSR Zhuzhou Chapa RC';
                fabricante = 'CRRC Zhuzhou (China)';
                coches = '9 coches de alta capacidad';
                alimentacion = '830 V CC (Tercer Riel)';
            } else {
                modelo = 'Locomotora EMD GT22 / Materfer';
                fabricante = 'General Motors / Materfer';
                coches = 'Coches remolcados Materfer';
                alimentacion = 'Diésel-Eléctrico';
            }
        } else if (linea === 'Belgrano Sur') {
            modelo = 'DMU CNR Tangshan Tripla';
            fabricante = 'CRRC Tangshan (China)';
            coches = '3 o 6 coches (Trocha Métrica 1000mm)';
            alimentacion = 'Diésel Hidráulico (Voith)';
            traccion = 'Diésel';
            icono = 'fa-gas-pump';
        } else {
            modelo = esElectrico ? 'Formación Eléctrica' : 'Formación Diésel';
            fabricante = 'Trenes Argentinos Operaciones';
            coches = 'Convencional';
            alimentacion = esElectrico ? 'Eléctrica' : 'Diésel';
        }

        return { code: c || 'S/D', modelo, fabricante, coches, traccion, icono, alimentacion };
    }

    // --- NORMALIZACIÓN DE BÚSQUEDA ---
    function normalize(str) {
        return (str || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

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
            console.error('Error de autorización en mapa:', e);
        }
        return null;
    }

    // --- PROVEEDORES DE MAPAS (100% SIN MARCAS DE API KEY) ---
    const TILE_PROVIDERS = {
        satellite: {
            name: 'Satelital HD',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            options: { maxZoom: 19, attribution: 'Imágenes Satelitales &copy; Esri' },
            hasLabels: false
        },
        hybrid: {
            name: 'Satelital Híbrido',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            options: { maxZoom: 19, attribution: 'Satelital &copy; Esri & OpenStreetMap' },
            hasLabels: true
        },
        dark: {
            name: 'Radar Ferroviario Nocturno',
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            options: { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; CartoDB &copy; OpenStreetMap' },
            hasLabels: false
        },
        osm: {
            name: 'OpenStreetMap Estándar',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: { maxZoom: 19, subdomains: 'abc', attribution: '&copy; OpenStreetMap contributors' },
            hasLabels: false
        },
        voyager: {
            name: 'Mapa Estándar Claro',
            url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            options: { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; CartoDB &copy; OpenStreetMap' },
            hasLabels: false
        }
    };

    function setBaseLayer(layerKey) {
        const provider = TILE_PROVIDERS[layerKey] || TILE_PROVIDERS.satellite;

        if (currentTileLayer) map.removeLayer(currentTileLayer);
        if (labelTileLayer) map.removeLayer(labelTileLayer);

        currentTileLayer = L.tileLayer(provider.url, provider.options).addTo(map);

        if (provider.hasLabels && provider.labelsUrl) {
            labelTileLayer = L.tileLayer(provider.labelsUrl, { maxZoom: 19 }).addTo(map);
        }

        currentLayerName.textContent = provider.name;

        layerOptions.forEach(opt => {
            if (opt.dataset.layer === layerKey) opt.classList.add('active');
            else opt.classList.remove('active');
        });

        // Sincronizar botones de acceso directo
        document.querySelectorAll('.quick-mode-btn').forEach(btn => {
            if (btn.dataset.layerQuick === layerKey) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Asegurar que Leaflet dibuje los mosaicos de inmediato
        if (map) {
            map.invalidateSize();
        }
    }

    // --- INICIALIZACIÓN DEL MAPA ---
    function initMap() {
        // Centro en el Área Metropolitana de Buenos Aires (AMBA)
        map = L.map(mapElement, {
            center: [-34.640, -58.450],
            zoom: 11,
            zoomControl: false,
            preferCanvas: true
        });

        // Controles de Zoom abajo a la derecha
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Capa satelital por defecto
        setBaseLayer('satellite');

        // Grupos de capas
        stationsLayerGroup = L.layerGroup().addTo(map);
        trainsLayerGroup = L.layerGroup().addTo(map);

        // Forzar cálculo de dimensiones de Leaflet para garantizar renderizado inmediato
        map.invalidateSize();
        setTimeout(() => { if (map) map.invalidateSize(); }, 100);
        setTimeout(() => { if (map) map.invalidateSize(); }, 400);
        setTimeout(() => { if (map) map.invalidateSize(); }, 1200);
        window.addEventListener('resize', () => { if (map) map.invalidateSize(); });

        // Renderizar las 254 estaciones desde STATIONS_DB
        renderStationsOnMap();
        populateSidebarStations();
    }

    // --- DIBUJADO DE LAS 254 ESTACIONES ---
    function renderStationsOnMap() {
        if (!window.STATIONS_DB) return;
        stationsLayerGroup.clearLayers();
        stationMarkers = [];

        window.STATIONS_DB.forEach(st => {
            if (!st.lat || !st.lon) return;

            // Filtrar si no coincide con la línea activa
            if (activeFilterLine !== 'all' && st.line !== activeFilterLine) return;

            const color = LINE_COLORS[st.line] || '#30a9e0';

            const marker = L.circleMarker([st.lat, st.lon], {
                radius: 5,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.9
            });

            // Popup interactivo de estación
            const popupContent = `
                <div class="station-popup">
                    <h4>${st.name}</h4>
                    <span class="popup-line-pill" style="background-color: ${color};">Línea ${st.line}</span>
                    <div class="popup-info">
                        <div><i class="fa-solid fa-signs-post"></i> Andenes Habilitados: <strong>${st.andenes || '2'}</strong></div>
                        <div><i class="fa-solid fa-hashtag"></i> ID Estación: <strong>${st.id}</strong></div>
                    </div>
                    <a href="tablero.html?stationId=${st.id}" class="popup-btn-board">
                        <i class="fa-solid fa-chalkboard"></i> Ver Tablero en Vivo
                    </a>
                </div>
            `;
            marker.bindPopup(popupContent);

            // Tooltip ligero al pasar el mouse
            marker.bindTooltip(`<strong>${st.name}</strong> (${st.line})`, {
                direction: 'top',
                offset: [0, -6],
                opacity: 0.9
            });

            marker.stationData = st;
            stationsLayerGroup.addLayer(marker);
            stationMarkers.push(marker);
        });
    }

    // --- RECOLECCIÓN Y POSICIONAMIENTO EN VIVO DE FORMACIONES ---
    async function fetchLiveTrains() {
        refreshIcon.classList.add('fa-spin');
        const token = await getAuthToken();
        if (!token) {
            refreshIcon.classList.remove('fa-spin');
            return;
        }

        const now = Date.now();

        try {
            const promises = PROBE_STATIONS.map(stId =>
                fetch(`https://api-servicios.sofse.gob.ar/v1/arribos/estacion/${stId}`, {
                    headers: { 'Authorization': token }
                }).then(r => {
                    if (r.status === 401 || r.status === 403) {
                        getAuthToken(true); // Renovar token en siguiente ciclo
                    }
                    return r.json();
                }).catch(() => null)
            );

            const responses = await Promise.all(promises);
            const discoveredTrains = new Map();

            responses.forEach(data => {
                if (!data || !data.results) return;

                data.results.forEach(item => {
                    const arr = item.arribo || {};
                    const srv = item.servicio || {};
                    const salida = arr.salida || {};

                    const srvNum = srv.numero;
                    const eqNombre = arr.equipo?.nombre || srv.equipo?.nombre;
                    const key = srvNum ? `srv-${srvNum}` : (eqNombre ? `eq-${eqNombre}` : null);
                    if (!key) return;

                    // Si ya descubrimos esta formación, verificar si la nueva respuesta tiene GPS directo
                    const loc = srv.location;
                    const hasDirectGpsInThisItem = !!(loc && loc.lat && (loc.long || loc.lng || loc.longitud));

                    if (discoveredTrains.has(key)) {
                        const existing = discoveredTrains.get(key);
                        // Si ya tiene GPS directo o la nueva tampoco lo tiene, mantener existente
                        if (existing.isDirectGps || !hasDirectGpsInThisItem) {
                            return;
                        }
                    }

                    // Analizar itinerario de paradas (estaciones)
                    const estaciones = srv.estaciones || [];
                    let lastDeparted = null;
                    let nextStation = null;
                    let lastDepartedIdx = -1;
                    let nextStationIdx = -1;

                    for (let i = 0; i < estaciones.length; i++) {
                        const est = estaciones[i];
                        if (est.salida && est.salida.real) {
                            lastDeparted = est;
                            lastDepartedIdx = i;
                        } else if (!nextStation) {
                            nextStation = est;
                            nextStationIdx = i;
                        }
                    }

                    let lat = null;
                    let lon = null;
                    let isDirectGps = false;
                    let trackingMode = 'none';

                    // 1. Prioridad: Coordenadas GPS satelitales en vivo (srv.location)
                    if (hasDirectGpsInThisItem) {
                        lat = Number(loc.lat);
                        lon = Number(loc.long || loc.lng || loc.longitud);
                        isDirectGps = true;
                        trackingMode = 'gps_direct';
                    }
                    // 2. Prioridad: Interpolación en vía férrea entre estación de salida y próxima parada
                    else if (lastDeparted && nextStation) {
                        const st1 = window.STATIONS_DB.find(s => String(s.id) === String(lastDeparted.idElemento));
                        const st2 = window.STATIONS_DB.find(s => String(s.id) === String(nextStation.idElemento));
                        if (st1 && st2) {
                            let p = 0.5;
                            if (nextStation.segundos !== undefined && nextStation.segundos > 0) {
                                const tDepart = new Date(lastDeparted.salida.real).getTime();
                                const estSec = Math.max(1, nextStation.segundos);
                                const elapsedSec = Math.max(0, (now - tDepart) / 1000);
                                p = Math.min(Math.max(elapsedSec / (elapsedSec + estSec), 0.08), 0.92);
                            }
                            lat = st1.lat + (st2.lat - st1.lat) * p;
                            lon = st1.lon + (st2.lon - st1.lon) * p;
                            isDirectGps = false;
                            trackingMode = 'interpolated';
                        }
                    }
                    // 3. Prioridad: Tren en cabecera inicial esperando salida
                    else if (nextStation) {
                        const st = window.STATIONS_DB.find(s => String(s.id) === String(nextStation.idElemento));
                        if (st) {
                            const offset = (discoveredTrains.size % 4 - 2) * 0.0003;
                            lat = st.lat + offset;
                            lon = st.lon + offset;
                            isDirectGps = false;
                            trackingMode = 'origin_terminal';
                        }
                    }
                    // 4. Prioridad: Tren que finalizó recorrido en destino
                    else if (lastDeparted) {
                        const st = window.STATIONS_DB.find(s => String(s.id) === String(lastDeparted.idElemento));
                        if (st) {
                            lat = st.lat;
                            lon = st.lon;
                            isDirectGps = false;
                            trackingMode = 'terminal_dest';
                        }
                    }
                    // 5. Fallback por estación de arribo reportada
                    if (!lat || !lon) {
                        const st = window.STATIONS_DB.find(s => String(s.id) === String(arr.idElemento));
                        if (st) {
                            const offset = (discoveredTrains.size % 4 - 2) * 0.0003;
                            lat = st.lat + offset;
                            lon = st.lon + offset;
                            isDirectGps = false;
                            trackingMode = 'station_fallback';
                        }
                    }

                    if (lat && lon) {
                        const lineaNombre = srv.gerencia?.nombre || 'Roca';
                        const esElectrico = arr.equipo?.esElectrico === 1;
                        const rollingStock = getRollingStockInfo(eqNombre, lineaNombre, esElectrico);

                        const desde = srv.desde?.estacion?.nombre || srv.ramal?.cabeceraInicial?.nombre || 'Origen';
                        const hasta = srv.hasta?.estacion?.nombre || srv.ramal?.cabeceraFinal?.nombre || 'Destino';
                        const isTerminal = isTerminalStation(arr.idElemento, arr.nombre, desde, hasta);

                        // Cálculo de velocidad real y rumbo direccional (bearing)
                        const prevTrain = activeTrains.get(key);
                        let computedSpeed = 0;
                        let bearing = 0;

                        if (prevTrain && prevTrain.lat && prevTrain.lon && prevTrain.timestamp) {
                            const dtSec = (now - prevTrain.timestamp) / 1000;
                            if (dtSec >= 4 && dtSec <= 75) {
                                const distKm = getDistanceKm(prevTrain.lat, prevTrain.lon, lat, lon);
                                const spd = Math.round((distKm / dtSec) * 3600);
                                if (spd >= 0 && spd <= 140) {
                                    computedSpeed = spd;
                                }
                            }
                        }

                        // Si la velocidad calculada por GPS da 0 pero la última estación registró velocidad de salida:
                        if (computedSpeed === 0 && lastDeparted && lastDeparted.salida && lastDeparted.salida.velocidad > 0) {
                            computedSpeed = lastDeparted.salida.velocidad;
                        }

                        // Si la telemetría del arribo tiene velocidad directa:
                        if (computedSpeed === 0 && salida.velocidad > 0) {
                            computedSpeed = salida.velocidad;
                        }

                        // Rumbo (bearing 0-360):
                        if (prevTrain && prevTrain.lat && prevTrain.lon && (Math.abs(lat - prevTrain.lat) > 0.00015 || Math.abs(lon - prevTrain.lon) > 0.00015)) {
                            bearing = calculateBearing(prevTrain.lat, prevTrain.lon, lat, lon);
                        } else if (lastDeparted && nextStation) {
                            const st1 = window.STATIONS_DB.find(s => String(s.id) === String(lastDeparted.idElemento));
                            const st2 = window.STATIONS_DB.find(s => String(s.id) === String(nextStation.idElemento));
                            if (st1 && st2) {
                                bearing = calculateBearing(st1.lat, st1.lon, st2.lat, st2.lon);
                            }
                        } else if (prevTrain && prevTrain.bearing) {
                            bearing = prevTrain.bearing;
                        }

                        // Tramo actual descriptivo
                        let tramoActual = '';
                        if (lastDeparted && nextStation) {
                            tramoActual = `${lastDeparted.nombre} → ${nextStation.nombre}`;
                        } else if (!lastDeparted && nextStation) {
                            tramoActual = `En cabecera ${desde} (próxima: ${nextStation.nombre})`;
                        } else if (lastDeparted && !nextStation) {
                            tramoActual = `Arribado a destino ${hasta}`;
                        } else {
                            tramoActual = `${desde} → ${hasta}`;
                        }

                        // Tiempo estimado a próxima estación
                        const secToNext = nextStation?.segundos;
                        let tiempoRestanteStr = 'Horario regular';
                        if (secToNext !== undefined) {
                            if (secToNext <= 0) tiempoRestanteStr = 'Arribando en este momento';
                            else if (secToNext < 60) tiempoRestanteStr = `en ${secToNext} seg`;
                            else tiempoRestanteStr = `en ${Math.ceil(secToNext / 60)} min`;
                        }

                        const opStatus = calculateTrainStatus({
                            vel: computedSpeed,
                            lastDeparted,
                            nextStation,
                            isTerminal,
                            anden: arr.anden?.nombre,
                            desde,
                            hasta,
                            trackingMode
                        });

                        discoveredTrains.set(key, {
                            key,
                            servicioNumero: srvNum || '---',
                            linea: lineaNombre,
                            ramal: srv.ramal?.nombre || 'General',
                            equipo: eqNombre || 'S/D',
                            idElemento: arr.idElemento,
                            rollingStock,
                            esElectrico,
                            gpss: arr.equipo?.gpss || [],
                            lat,
                            lon,
                            bearing,
                            isDirectGps,
                            trackingMode,
                            velocidad: computedSpeed,
                            distancia: salida.distancia || 0,
                            isTerminal,
                            opStatus,
                            enAnden: opStatus.isAnden,
                            anden: arr.anden?.nombre || '-',
                            desde,
                            hasta,
                            tramoActual,
                            lastDeparted: lastDeparted?.nombre || null,
                            nextStation: nextStation?.nombre || null,
                            tiempoRestanteStr,
                            proximaEstacion: nextStation?.nombre || arr.nombre || 'En tránsito',
                            horaSalida: salida.programada ? salida.programada.slice(11, 16) : '--:--',
                            timestamp: now,
                            estaciones
                        });
                    }
                });
            });

            activeTrains = discoveredTrains;
            updateTrainMarkers();
            updateSidebarTrains();
            
            // Actualizar contadores
            trainCounterBadge.textContent = activeTrains.size;
            sidebarTrainsCount.textContent = activeTrains.size;

            // Si hay una formación seleccionada, refrescar su ficha técnica
            if (selectedTrain && activeTrains.has(selectedTrain.key)) {
                openFormationInspector(activeTrains.get(selectedTrain.key));
            }
        } catch (err) {
            console.error('Error al recolectar telemetría de trenes:', err);
        } finally {
            refreshIcon.classList.remove('fa-spin');
        }
    }

    // --- ACTUALIZACIÓN DE MARCADORES EN EL MAPA ---
    function updateTrainMarkers() {
        const existingKeys = new Set(trainMarkers.keys());
        const activeKeys = new Set();

        activeTrains.forEach(train => {
            // Filtrar por línea activa
            if (activeFilterLine !== 'all' && train.linea !== activeFilterLine) {
                if (trainMarkers.has(train.key)) {
                    trainsLayerGroup.removeLayer(trainMarkers.get(train.key));
                    trainMarkers.delete(train.key);
                }
                return;
            }

            activeKeys.add(train.key);

            const isMoving = train.opStatus.isMoving;
            const hasBearing = isMoving && train.bearing !== undefined && train.bearing !== null;

            // Contenido HTML del marcador con indicador direccional de rumbo y pulso de movimiento
            const markerHtml = `
                <div class="train-map-marker ${isMoving ? 'moving' : 'stopped'}" data-train-key="${train.key}">
                    <div class="train-speed-badge" style="background-color: ${train.opStatus.color};">${train.opStatus.mapBadgeText}</div>
                    <div class="train-marker-body ${train.esElectrico ? 'electric' : 'diesel'}">
                        ${isMoving ? '<div class="train-pulse"></div>' : ''}
                        <i class="fa-solid ${train.rollingStock.icono}"></i>
                        ${hasBearing ? `
                            <div class="train-bearing-arrow" style="transform: rotate(${train.bearing}deg);" title="Rumbo: ${train.bearing}°">
                                <i class="fa-solid fa-caret-up"></i>
                            </div>
                        ` : ''}
                    </div>
                    <div class="train-code-badge">${train.equipo !== 'S/D' ? train.equipo : '#' + train.servicioNumero}</div>
                </div>
            `;

            const icon = L.divIcon({
                className: 'custom-train-leaflet-icon',
                html: markerHtml,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            if (trainMarkers.has(train.key)) {
                // Animar el desplazamiento del tren suavemente entre coordenadas
                const marker = trainMarkers.get(train.key);
                const currentPos = marker.getLatLng();
                smoothMoveMarker(marker, [currentPos.lat, currentPos.lng], [train.lat, train.lon], 2200);
                marker.setIcon(icon);
            } else {
                // Crear nuevo marcador
                const marker = L.marker([train.lat, train.lon], { icon, zIndexOffset: 500 });
                marker.on('click', () => {
                    openFormationInspector(train);
                });
                trainsLayerGroup.addLayer(marker);
                trainMarkers.set(train.key, marker);
            }
        });

        // Eliminar marcadores que ya no estén activos
        existingKeys.forEach(k => {
            if (!activeKeys.has(k)) {
                trainsLayerGroup.removeLayer(trainMarkers.get(k));
                trainMarkers.delete(k);
            }
        });
    }

    // --- FICHA TÉCNICA DE FORMACIÓN (PUNTO 3) ---
    function openFormationInspector(train) {
        selectedTrain = train;

        const rs = train.rollingStock;
        inspectorFormationCode.textContent = `FORMACIÓN ${train.equipo}`;
        inspectorFormationModel.textContent = `${rs.modelo} (${rs.coches})`;

        inspectorTrainIcon.innerHTML = `<i class="fa-solid ${rs.icono}"></i>`;
        inspectorTrainIcon.style.background = train.esElectrico ? '#0284c7' : '#ea580c';

        // Badges
        inspectorLineBadge.textContent = `Línea ${train.linea}`;
        inspectorLineBadge.style.backgroundColor = LINE_COLORS[train.linea] || '#30a9e0';

        inspectorTractionBadge.innerHTML = `<i class="fa-solid ${rs.icono}"></i> ${rs.traccion}`;
        inspectorServiceBadge.textContent = `Servicio #${train.servicioNumero}`;

        const st = train.opStatus;
        inspectorStatusBadge.textContent = st.badgeText;
        inspectorStatusBadge.className = `inspector-badge badge-status ${st.badgeClass}`;
        inspectorStatusBadge.style.backgroundColor = st.color;

        // Telemetría
        inspectorSpeed.textContent = train.velocidad;
        inspectorPlatform.textContent = train.anden !== '-' ? `Andén ${train.anden}` : (st.isMoving ? 'Vía Principal' : 'Por asignar');
        inspectorDistance.textContent = train.distancia ? `${Math.round(train.distancia)} m` : '---';
        inspectorGpsCount.textContent = train.isDirectGps ? '🛰️ GPS Satelital' : '📍 En ruta';

        // Recorrido y tramo
        inspectorOrigin.textContent = train.desde.toUpperCase();
        inspectorDestination.textContent = train.hasta.toUpperCase();

        const tramoInfo = train.tramoActual ? ` (Tramo: ${train.tramoActual})` : '';
        const etaInfo = train.tiempoRestanteStr ? ` (${train.tiempoRestanteStr})` : '';
        inspectorNextStation.textContent = `${train.proximaEstacion.toUpperCase()}${etaInfo}${tramoInfo}`;

        if (train.gpss && train.gpss.length > 0) {
            inspectorGpsIds.textContent = `${train.gpss.join(', ')} (Hardware AVL)`;
        } else if (train.isDirectGps) {
            inspectorGpsIds.textContent = 'Telemetría GPS Satelital Directa SOFSE';
        } else {
            inspectorGpsIds.textContent = 'Cálculo de posición por cantón de vía y horarios';
        }

        // Acciones
        btnFollowTrain.onclick = () => {
            map.flyTo([train.lat, train.lon], 15, { duration: 1.2 });
        };

        if (train.idElemento) {
            btnViewBoard.href = `tablero.html?stationId=${train.idElemento}`;
        } else {
            btnViewBoard.href = 'tablero.html';
        }

        formationInspector.classList.add('visible');
    }

    function closeFormationInspector() {
        formationInspector.classList.remove('visible');
        selectedTrain = null;
    }

    // --- POBLADO DEL PANEL LATERAL DE FORMACIONES ---
    function updateSidebarTrains() {
        sidebarTrainsContainer.innerHTML = '';

        const trainsArray = Array.from(activeTrains.values());

        // Filtrar por línea activa
        const filtered = trainsArray.filter(t => activeFilterLine === 'all' || t.linea === activeFilterLine);

        if (filtered.length === 0) {
            sidebarTrainsContainer.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 25px 10px;">
                    <i class="fa-solid fa-satellite-dish" style="font-size: 2em; margin-bottom: 8px;"></i>
                    <p style="margin: 0; font-size: 0.9em;">No se detectaron formaciones activas en esta línea en este momento.</p>
                </div>
            `;
            return;
        }

        filtered.sort((a, b) => b.velocidad - a.velocidad);

        filtered.forEach(train => {
            const card = document.createElement('div');
            card.className = 'train-list-card';
            const color = LINE_COLORS[train.linea] || '#30a9e0';

            const trackingBadge = train.isDirectGps 
                ? '<span title="GPS Satelital Activo" style="color: #38bdf8; font-size: 0.8em;"><i class="fa-solid fa-satellite"></i> GPS</span>' 
                : '<span title="Estimación en Vía" style="color: #94a3b8; font-size: 0.8em;"><i class="fa-solid fa-route"></i> En Vía</span>';

            card.innerHTML = `
                <div class="train-list-header">
                    <span class="train-list-code">
                        <i class="fa-solid ${train.rollingStock.icono}" style="color: ${color};"></i>
                        <span>${train.equipo}</span>
                        <small style="color: #64748b; font-size: 0.75em;">#${train.servicioNumero}</small>
                        ${trackingBadge}
                    </span>
                    <span class="train-list-status ${train.opStatus.badgeClass}" style="background-color: ${train.opStatus.color};">${train.opStatus.badgeText}</span>
                </div>
                <div class="train-list-route">
                    <strong>${train.desde}</strong>
                    <i class="fa-solid fa-arrow-right-long" style="font-size: 0.75em; color: ${color};"></i>
                    <strong>${train.hasta}</strong>
                </div>
                <div class="train-list-footer">
                    <span><i class="fa-solid fa-location-dot"></i> ${train.tramoActual || train.proximaEstacion}</span>
                    <span style="color: ${color}; font-weight: bold;">Línea ${train.linea}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                map.flyTo([train.lat, train.lon], 14, { duration: 1 });
                openFormationInspector(train);
            });

            sidebarTrainsContainer.appendChild(card);
        });
    }

    // --- POBLADO DEL PANEL LATERAL DE ESTACIONES ---
    function populateSidebarStations() {
        if (!window.STATIONS_DB) return;
        sidebarStationsContainer.innerHTML = '';

        window.STATIONS_DB.forEach(st => {
            const item = document.createElement('div');
            item.className = 'train-list-card';
            const color = LINE_COLORS[st.line] || '#30a9e0';

            item.innerHTML = `
                <div class="train-list-header">
                    <span class="train-list-code">
                        <i class="fa-solid fa-circle-dot" style="color: ${color};"></i>
                        <span>${st.name}</span>
                    </span>
                    <span style="font-size: 0.7em; padding: 2px 5px; border-radius: 3px; background: ${color}; color: white;">${st.line}</span>
                </div>
                <div class="train-list-footer" style="margin-top: 4px;">
                    <span>${st.andenes} andenes habilitados</span>
                    <a href="tablero.html?stationId=${st.id}" style="color: #38bdf8; text-decoration: none; font-weight: bold;">Ver Tablero →</a>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') return;
                map.flyTo([st.lat, st.lon], 15, { duration: 1 });
            });

            sidebarStationsContainer.appendChild(item);
        });
    }

    // --- BÚSQUEDA RÁPIDA (FORMACIONES Y ESTACIONES) ---
    function handleSearch() {
        const query = normalize(radarSearchInput.value);
        radarSearchClear.style.display = query.length > 0 ? 'block' : 'none';

        if (!query) {
            updateSidebarTrains();
            return;
        }

        // 1. Buscar en formaciones
        let foundTrain = null;
        for (const [k, t] of activeTrains) {
            if (normalize(t.equipo).includes(query) || normalize(t.servicioNumero).includes(query) || normalize(t.hasta).includes(query)) {
                foundTrain = t;
                break;
            }
        }

        if (foundTrain) {
            map.flyTo([foundTrain.lat, foundTrain.lon], 14, { duration: 1 });
            openFormationInspector(foundTrain);
            return;
        }

        // 2. Buscar en estaciones
        if (window.STATIONS_DB) {
            const foundStation = window.STATIONS_DB.find(s => normalize(s.name).includes(query));
            if (foundStation && foundStation.lat && foundStation.lon) {
                map.flyTo([foundStation.lat, foundStation.lon], 15, { duration: 1 });
            }
        }
    }

    // --- TEMPORIZADOR DE AUTO-ACTUALIZACIÓN ---
    function handleRefreshCountdown() {
        refreshSeconds--;
        if (refreshSeconds <= 0) {
            refreshSeconds = 20;
            fetchLiveTrains();
        }
        refreshTimerBadge.textContent = `${refreshSeconds}s`;
    }

    // --- CONFIGURACIÓN DE EVENTOS ---
    function setupEvents() {
        // Selector de Capas
        btnLayerMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            layerDropdown.classList.toggle('visible');
        });

        document.addEventListener('click', (e) => {
            if (!layerDropdown.contains(e.target)) {
                layerDropdown.classList.remove('visible');
            }
        });

        layerOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const layer = opt.dataset.layer;
                setBaseLayer(layer);
                layerDropdown.classList.remove('visible');
            });
        });

        // Botones Rápidos de Modo de Mapa (1-Click)
        document.querySelectorAll('.quick-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const layer = btn.dataset.layerQuick;
                if (layer) setBaseLayer(layer);
            });
        });

        // Filtros de Línea
        lineFilterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                lineFilterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeFilterLine = chip.dataset.line;
                renderStationsOnMap();
                updateTrainMarkers();
                updateSidebarTrains();
            });
        });

        // Búsqueda
        radarSearchInput.addEventListener('input', handleSearch);
        radarSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        radarSearchClear.addEventListener('click', () => {
            radarSearchInput.value = '';
            handleSearch();
        });

        // Botón Refrescar
        btnRefreshRadar.addEventListener('click', () => {
            refreshSeconds = 20;
            fetchLiveTrains();
        });

        // Toggle Búsqueda Móvil
        if (btnToggleMobileSearch && radarSearchWrapper) {
            btnToggleMobileSearch.addEventListener('click', () => {
                const isActive = radarSearchWrapper.classList.toggle('mobile-active');
                if (isActive) {
                    radarSearchInput.focus();
                }
            });
        }

        // Panel Lateral con soporte táctil y backdrop
        btnToggleSidebar.addEventListener('click', () => {
            const isVisible = radarSidebar.classList.toggle('visible');
            if (sidebarBackdrop) {
                sidebarBackdrop.classList.toggle('visible', isVisible && window.innerWidth <= 768);
            }
            setTimeout(() => { if (map) map.invalidateSize(); }, 350);
        });

        btnCloseSidebar.addEventListener('click', () => {
            radarSidebar.classList.remove('visible');
            if (sidebarBackdrop) {
                sidebarBackdrop.classList.remove('visible');
            }
            setTimeout(() => { if (map) map.invalidateSize(); }, 350);
        });

        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', () => {
                radarSidebar.classList.remove('visible');
                sidebarBackdrop.classList.remove('visible');
                closeFormationInspector();
            });
        }

        sidebarTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                sidebarTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetTab = tab.dataset.tab;
                if (targetTab === 'trains') {
                    document.getElementById('sidebar-trains-list').classList.add('active');
                    document.getElementById('sidebar-stations-list').classList.remove('active');
                } else {
                    document.getElementById('sidebar-trains-list').classList.remove('active');
                    document.getElementById('sidebar-stations-list').classList.add('active');
                }
            });
        });

        // Inspector Drawer
        btnCloseInspector.addEventListener('click', closeFormationInspector);
    }

    // --- INICIALIZACIÓN ---
    function init() {
        initMap();
        setupEvents();
        fetchLiveTrains();
        refreshInterval = setInterval(handleRefreshCountdown, 1000);
    }

    init();
});

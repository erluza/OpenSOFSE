# OpenSOFSE

Plataforma comunitaria de información ferroviaria metropolitana en tiempo real para los ferrocarriles de la República Argentina.

## Descripción General

OpenSOFSE es un desarrollo informático de código abierto orientado a recopilar, procesar y presentar la información operativa del sistema de trenes de pasajeros del Área Metropolitana de Buenos Aires (AMBA). 

El proyecto integra telemetría satelital en directo, visualización interactiva de cartelería de estación y una aplicación web responsiva diseñada tanto para dispositivos móviles como para computadoras de escritorio.

Toda la plataforma funciona de manera estática y autónoma en el navegador del usuario, sin requerir intermediarios, servidores proxy ni pasarelas pagas.

## Módulos del Sistema

### 1. Portal Central (index.html)
Punto de acceso unificado que vincula los tres entornos principales del ecosistema ferroviario, junto a las especificaciones técnicas y el descargo legal correspondiente.

### 2. Tablero de Salidas y Arribos (tablero.html)
Representación gráfica fiel de las pantallas electrónicas de información al público presentes en las principales estaciones terminales e intermedias.
* Conexión en vivo con el servicio de arribos de Plaza Constitución y selector de estaciones de toda la red.
* Muestra de número de tren, hora programada, hora estimada, andén asignado y estado operativo.
* Tira inferior rotativa con alertas de servicio y comunicados de tráfico en tiempo real.
* Compatibilidad con modo simulador manual mediante panel de control con atajo de teclado Ctrl+Alt+C.

### 3. Radar Satelital GPS en Vivo (mapa.html)
Cartografía interactiva en alta resolución con dos capas seleccionables: satelital y mapa base vectorial limpio sin marcas de agua ni requerimiento de claves de API.
* Monitoreo continuo de formaciones en circulación en las Líneas Roca, Sarmiento, Mitre, San Martín y Belgrano Sur.
* Cálculo de rumbo geográfico, velocidad de marcha en kilómetros por hora y próxima parada.
* Trazado de vías con estaciones cabeceras e intermedias georreferenciadas.
* Ficha técnica detallada al pulsar sobre cada unidad con número de coche, ramal y tiempos de viaje.

### 4. Webapp Oficial (webapp.html)
Aplicación web progresiva orientada a la experiencia ágil del usuario y pasajero en viaje.
* Selector interactivo de fecha y hora para consulta de trenes programados en cualquier momento del día.
* Sistema real de favoritos persistentes en el almacenamiento local del dispositivo con acceso directo en un toque.
* Itinerario vertical del recorrido con seguimiento de la formación entre estaciones y detección automática de estado en andén.
* Panel de novedades con el estado de tráfico oficial de todas las líneas metropolitanas.

## Arquitectura y Fuentes de Datos

* Conectividad directa con la interfaz de programación de aplicaciones oficial de SOFSE mediante CORS habilitado.
* Autenticación dinámica determinista en el cliente para la obtención de tokens de autorización temporales.
* Catálogo de estaciones georreferenciadas con andenes y coordenadas geográficas precisas en stations_data.js.
* Cronogramas y frecuencias oficiales de días hábiles incorporados en horarios.json para cálculo de itinerarios futuros.
* Tipografía corporativa oficial DinPro aplicada a toda la cartelería y elementos gráficos.

## Puesta en Marcha

Para utilizar OpenSOFSE de manera local o en su propio servidor:

1. Clonar este repositorio en su equipo:
```bash
git clone https://github.com/erluza/OpenSOFSE.git
```

2. Abrir el archivo index.html directamente en cualquier navegador web moderno (Google Chrome, Mozilla Firefox, Microsoft Edge o Safari). No se requiere instalación de Node.js ni configuración de servidores web adicionales.

3. También puede ser publicado directamente mediante GitHub Pages activando la opción correspondiente en la configuración del repositorio.

## Créditos y Atribuciones

* API por https://trenes.sofse.apidocs.ar/
* Logos SVG por Hurfer
* Cartografía satelital provista por servicios públicos abiertos de Esri, OpenStreetMap y CartoDB

## Descargo de Responsabilidad Jurídica

Descargo de responsabilidad jurídica según el ordenamiento legal de la República Argentina:

OpenSOFSE es un proyecto independiente de desarrollo comunitario y software libre con propósitos educativos, informativos y de preservación cultural ferroviaria. 

El proyecto no posee vinculación jurídica, administrativa, comercial, laboral, institucional ni societaria de ninguna índole con Ferrocarriles Argentinos Sociedad Anónima Unipersonal (FASAU) ni con Operadora Ferroviaria Sociedad Anónima (SOFSA, ex SOFSE). 

Todas las marcas registradas, nombres comerciales, logotipos, isotipos e imagotipos exhibidos en este repositorio pertenecen de manera exclusiva a sus respectivos titulares legítimos y se utilizan en este ámbito exclusivamente bajo fines de referencia técnica e información pública.

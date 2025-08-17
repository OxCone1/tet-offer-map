/**
 * Translation dictionary for the TET Map application
 * Supports English (en), Russian (ru), and Latvian (lv)
 */

export const translations = {
    en: {
        // Navigation
        "nav.search": "Search",
        "nav.controls": "Controls",
        "nav.map.tools": "Map Tools",
        "nav.search.title": "Address Search",
        "nav.search.description": "Find properties and view their internet connection offers",
        "nav.controls.title": "Map Controls",
        "nav.controls.description": "Configure data layers and visualization settings",

        // Map Legend
        "legend.title": "Legend",
        "legend.mobile.hint": "Tap to collapse, auto-hides when moving map",

        // Data Sources
        "data.tet.official": "TET Official Offers",
        "data.user": "User Data",
        "data.source.official": "Official",
        "data.source.user": "User",

        // Connection Types
        "connection.dsl": "DSL",
        "connection.fiber": "Fiber",
        "connection.mobile": "Mobile",
        "connection.cable": "Cable",
        "connection.unknown": "Unknown Type",

        // Search
        "search.placeholder": "Search for address...",
        "search.no.results": "No results found",
        "search.no.offers": "No offers available",

        // Property Details Modal
        "property.details": "Property Details",
        "property.details.description": "Details about the selected property and its internet offers",
        "property.available.offers": "Available Offers",
        "property.connection.details": "Connection Details",
        "property.speed": "Speed",
        "property.price": "Price",
        "property.terms": "Terms & Conditions",
        "property.features": "Features",
        "property.technical.info": "Technical Information",
        "property.address": "Address",
        "property.connection.type": "Connection Type",

        // Controls
        "controls.data.layers": "Data Layers",
        "controls.sectors": "Sector Analysis",
        "controls.sectors.show": "Show Density Sectors",
        "controls.sectors.radius": "Radius (m)",
        "controls.sectors.min.points": "Min Points",
        "controls.connection.types": "Connection types",
        "controls.connection.no.types": "No connection types available in visible layers",
        "controls.connection.toggle.hint": "Toggle connection types to show/hide on map",
        "controls.file.upload": "Upload Data File",

        // Loading and Messages
        "loading.title": "Loading TET Offers Map...",
        "message.file.success": "Successfully loaded {count} features from {filename}",
        "message.file.error": "Error processing file. Please check the format.",
        "message.no.valid.features": "No valid GeoJSON features found in file",

        // Disclaimer Modal
        "disclaimer.title": "Important Notice",
        "disclaimer.educational": "All data displayed on this website has been gathered for educational purposes only and has no legal or other binding implications.",
        "disclaimer.responsibility": "Users are responsible for double-checking availability and accuracy on the official TET website at",
        "disclaimer.accuracy": "All data has been gathered from openly available sources and may not reflect current or accurate information.",
        "disclaimer.understood": "Understood",

        // General UI
        "ui.close": "Close",
        "ui.cancel": "Cancel",
        "ui.save": "Save",
        "ui.loading": "Loading...",
        "ui.error": "Error",
        "ui.success": "Success",

        // Units and Formatting
        "unit.mbps": "Mbps",
        "unit.gbps": "Gbps",
        "unit.eur.month": "€/month",
        "unit.meters": "meters",
        "unit.count": "{count} items"
    },

    ru: {
        // Navigation
        "nav.search": "Поиск",
        "nav.controls": "Управление",
        "nav.map.tools": "Инструменты карты",
        "nav.search.title": "Поиск адресов",
        "nav.search.description": "Найти недвижимость и просмотреть предложения интернет-подключения",
        "nav.controls.title": "Управление картой",
        "nav.controls.description": "Настройка слоев данных и параметров визуализации",

        // Map Legend
        "legend.title": "Легенда",
        "legend.mobile.hint": "Нажмите для сворачивания, автоматически скрывается при движении карты",

        // Data Sources
        "data.tet.official": "Официальные предложения TET",
        "data.user": "Пользовательские данные",
        "data.source.official": "Официальный",
        "data.source.user": "Пользователь",

        // Connection Types
        "connection.dsl": "DSL",
        "connection.fiber": "Оптоволокно",
        "connection.mobile": "Мобильный",
        "connection.cable": "Кабельный",
        "connection.unknown": "Неизвестный тип",

        // Search
        "search.placeholder": "Поиск по адресу...",
        "search.no.results": "Результаты не найдены",
        "search.no.offers": "Предложения недоступны",

        // Property Details Modal
        "property.details": "Детали недвижимости",
        "property.details.description": "Подробная информация о выбранной недвижимости и ее интернет-предложениях",
        "property.available.offers": "Доступные предложения",
        "property.connection.details": "Детали подключения",
        "property.speed": "Скорость",
        "property.price": "Цена",
        "property.terms": "Условия и положения",
        "property.features": "Особенности",
        "property.technical.info": "Техническая информация",
        "property.address": "Адрес",
        "property.connection.type": "Тип подключения",

        // Controls
        "controls.data.layers": "Слои данных",
        "controls.sectors": "Анализ секторов",
        "controls.sectors.show": "Показать сектора плотности",
        "controls.sectors.radius": "Радиус (м)",
        "controls.sectors.min.points": "Мин. точек",
        "controls.connection.types": "Типы подключения",
        "controls.connection.no.types": "Нет доступных типов подключения в видимых слоях",
        "controls.connection.toggle.hint": "Переключайте типы подключения для отображения/скрытия на карте",
        "controls.file.upload": "Загрузить файл данных",

        // Loading and Messages
        "loading.title": "Загрузка карты предложений TET...",
        "message.file.success": "Успешно загружено {count} объектов из {filename}",
        "message.file.error": "Ошибка обработки файла. Проверьте формат.",
        "message.no.valid.features": "В файле не найдено действительных объектов GeoJSON",

        // Disclaimer Modal
        "disclaimer.title": "Важное уведомление",
        "disclaimer.educational": "Все данные, отображаемые на этом веб-сайте, собраны только в образовательных целях и не имеют юридических или иных обязательных последствий.",
        "disclaimer.responsibility": "Пользователи несут ответственность за двойную проверку доступности и точности на официальном веб-сайте TET по адресу",
        "disclaimer.accuracy": "Все данные собраны из открытых источников и могут не отражать текущую или точную информацию.",
        "disclaimer.understood": "Понятно",

        // General UI
        "ui.close": "Закрыть",
        "ui.cancel": "Отмена",
        "ui.save": "Сохранить",
        "ui.loading": "Загрузка...",
        "ui.error": "Ошибка",
        "ui.success": "Успех",

        // Units and Formatting
        "unit.mbps": "Мбит/с",
        "unit.gbps": "Гбит/с",
        "unit.eur.month": "€/месяц",
        "unit.meters": "метров",
        "unit.count": "{count} элементов"
    },

    lv: {
        // Navigation
        "nav.search": "Meklēšana",
        "nav.controls": "Vadība",
        "nav.map.tools": "Kartes rīki",
        "nav.search.title": "Adrešu meklēšana",
        "nav.search.description": "Atrodiet īpašumus un skatiet to interneta savienojuma piedāvājumus",
        "nav.controls.title": "Kartes vadība",
        "nav.controls.description": "Konfigurēt datu slāņus un vizualizācijas iestatījumus",

        // Map Legend
        "legend.title": "Leģenda",
        "legend.mobile.hint": "Pieskarieties, lai sakļautu, automātiski slēpjas, pārvietojot karti",

        // Data Sources
        "data.tet.official": "TET oficiālie piedāvājumi",
        "data.user": "Lietotāja dati",
        "data.source.official": "Oficiāls",
        "data.source.user": "Lietotājs",

        // Connection Types
        "connection.dsl": "DSL",
        "connection.fiber": "Optika",
        "connection.mobile": "Mobilais",
        "connection.cable": "Kabelis",
        "connection.unknown": "Nezināms tips",

        // Search
        "search.placeholder": "Meklēt pēc adreses...",
        "search.no.results": "Rezultāti nav atrasti",
        "search.no.offers": "Piedāvājumi nav pieejami",

        // Property Details Modal
        "property.details": "Īpašuma detaļas",
        "property.details.description": "Detalizēta informācija par izvēlēto īpašumu un tā interneta piedāvājumiem",
        "property.available.offers": "Pieejamie piedāvājumi",
        "property.connection.details": "Savienojuma detaļas",
        "property.speed": "Ātrums",
        "property.price": "Cena",
        "property.terms": "Noteikumi un nosacījumi",
        "property.features": "Īpašības",
        "property.technical.info": "Tehniskā informācija",
        "property.address": "Adrese",
        "property.connection.type": "Savienojuma tips",

        // Controls
        "controls.data.layers": "Datu slāņi",
        "controls.sectors": "Sektoru analīze",
        "controls.sectors.show": "Rādīt blīvuma sektorus",
        "controls.sectors.radius": "Rādiuss (m)",
        "controls.sectors.min.points": "Min. punkti",
        "controls.connection.types": "Savienojuma tipi",
        "controls.connection.no.types": "Redzamajos slāņos nav pieejamu savienojuma tipu",
        "controls.connection.toggle.hint": "Pārslēdziet savienojuma tipus, lai rādītu/slēptu kartē",
        "controls.file.upload": "Augšupielādēt datu failu",

        // Loading and Messages
        "loading.title": "Ielādē TET piedāvājumu karti...",
        "message.file.success": "Veiksmīgi ielādēti {count} objekti no {filename}",
        "message.file.error": "Kļūda apstrādājot failu. Pārbaudiet formātu.",
        "message.no.valid.features": "Failā nav atrasti derīgi GeoJSON objekti",

        // Disclaimer Modal
        "disclaimer.title": "Svarīgs paziņojums",
        "disclaimer.educational": "Visi šajā tīmekļa vietnē parādītie dati ir apkopoti tikai izglītības nolūkos, un tiem nav juridisku vai citu saistošu seku.",
        "disclaimer.responsibility": "Lietotāji ir atbildīgi par pieejamības un precizitātes dubultpārbaudi oficiālajā TET tīmekļa vietnē",
        "disclaimer.accuracy": "Visi dati ir apkopoti no atklāti pieejamiem avotiem un var neatspoguļot pašreizējo vai precīzu informāciju.",
        "disclaimer.understood": "Sapratu",

        // General UI
        "ui.close": "Aizvērt",
        "ui.cancel": "Atcelt",
        "ui.save": "Saglabāt",
        "ui.loading": "Ielādē...",
        "ui.error": "Kļūda",
        "ui.success": "Veiksmīgi",

        // Units and Formatting
        "unit.mbps": "Mb/s",
        "unit.gbps": "Gb/s",
        "unit.eur.month": "€/mēnesī",
        "unit.meters": "metri",
        "unit.count": "{count} vienumi"
    }
};

/**
 * Get available languages
 */
export const getAvailableLanguages = () => {
    return Object.keys(translations);
};

/**
 * Check if a language is supported
 */
export const isLanguageSupported = (lang) => {
    return lang && Object.prototype.hasOwnProperty.call(translations, lang);
};

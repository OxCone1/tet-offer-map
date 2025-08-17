import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useTranslation } from "../hooks/useTranslation.jsx"

const LanguageSelector = ({ variant = "map" }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const { currentLanguage, changeLanguage, availableLanguages } = useTranslation()

    const handleLanguageSelect = (languageCode) => {
        changeLanguage(languageCode)
        setIsExpanded(false)
    }

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded)
    }

    // Different styling for map vs modal variants
    const containerClasses = variant === "modal" ? "relative" : "fixed top-11 right-2 z-50 sm:top-5 sm:right-2"

    // Language display names
    const languageNames = {
        en: 'EN',
        ru: 'RU', 
        lv: 'LV'
    };

    return (
        <div className={containerClasses}>
            <div className="bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-white/50 overflow-hidden w-12">
                {/* Header - matching MapLegend padding */}
                <div
                    className="flex items-center space-evenly w-full px-2 py-2.5 cursor-pointer bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-white/50 transition-all duration-300 ease-in-out opacity-95"
                    onClick={toggleExpanded}
                >
                    <span className="text-xs font-medium text-gray-700 mr-0.5">{languageNames[currentLanguage] || currentLanguage.toUpperCase()}</span>
                    <button
                        className="p-0 hover:bg-gray-100 rounded transition-colors"
                        onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded()
                        }}
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-3 w-3 text-gray-600" />
                        ) : (
                            <ChevronDown className="h-3 w-3 text-gray-600" />
                        )}
                    </button>
                </div>

                {/* Dropdown Content - matching MapLegend transition and padding */}
                <div
                    className={`transition-all duration-300 ease-in-out ${isExpanded ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                        } overflow-hidden`}
                >
                    <div className="px-2 py-1.5 space-y-1.5">
                        {availableLanguages.map((languageCode) => (
                            <button
                                key={languageCode}
                                onClick={() => handleLanguageSelect(languageCode)}
                                className={`w-full text-center text-xs hover:bg-gray-50 transition-colors rounded px-1 py-0.5 ${currentLanguage === languageCode ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                                    }`}
                            >
                                {languageNames[languageCode] || languageCode.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LanguageSelector
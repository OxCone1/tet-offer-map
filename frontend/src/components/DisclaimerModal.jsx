import { useState, useEffect } from "react"
import { X } from "lucide-react"
import LanguageSelector from "./LanguageSelector"
import { useTranslate } from '../hooks/useTranslation.jsx'

export default function DisclaimerModal() {
    const translate = useTranslate()
    const [showDisclaimer, setShowDisclaimer] = useState(false)

    useEffect(() => {
        // Check if user has already accepted the disclaimer
        const hasAccepted = localStorage.getItem("disclaimer-accepted")
        if (!hasAccepted) {
            setShowDisclaimer(true)
        }
    }, [])

    const handleUnderstood = () => {
        localStorage.setItem("disclaimer-accepted", "true")
        setShowDisclaimer(false)
    }

    if (!showDisclaimer) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 relative">
                <div className="absolute top-4 right-4 z-10">
                    <LanguageSelector variant="modal" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">{translate('disclaimer.title')}</h2>
                    <button
                        onClick={handleUnderstood}
                        className="text-gray-400 hover:text-gray-600 transition-colors ml-16"
                        aria-label={translate('ui.close')}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">
                        {translate('disclaimer.educational')}
                    </p>

                    <p className="text-sm text-gray-700 leading-relaxed">
                        {translate('disclaimer.responsibility')}{" "}
                        <a
                            href="https://www.tet.lv/pieejamiba"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            www.tet.lv/pieejamiba
                        </a>
                    </p>

                    <p className="text-sm text-gray-700 leading-relaxed">
                        {translate('disclaimer.accuracy')}
                    </p>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={handleUnderstood}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        {translate('disclaimer.understood')}
                    </button>
                </div>
            </div>
        </div>
    )
}

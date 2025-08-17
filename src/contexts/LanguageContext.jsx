import { createContext, useContext, useState, useEffect } from "react"

const LanguageContext = createContext()

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider")
    }
    return context
}

export const LanguageProvider = ({ children }) => {
    const [currentLanguage, setCurrentLanguage] = useState("LV")

    useEffect(() => {
        // Load language from localStorage on mount
        const savedLanguage = localStorage.getItem("selectedLanguage")
        if (savedLanguage && ["LV", "RU", "EN"].includes(savedLanguage)) {
            setCurrentLanguage(savedLanguage)
        }
    }, [])

    const changeLanguage = (language) => {
        setCurrentLanguage(language)
        localStorage.setItem("selectedLanguage", language)
    }

    const value = {
        currentLanguage,
        changeLanguage,
        availableLanguages: [
            { code: "LV", name: "Latvian" },
            { code: "RU", name: "Russian" },
            { code: "EN", name: "English" },
        ],
    }

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
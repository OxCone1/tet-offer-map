"use client"

import { useRef, useEffect } from "react"
import { DataUtils } from "../utils.js"
import { Input } from "./ui/input"
// import { Card, CardContent } from './ui/card';
import { Badge } from "./ui/badge"
import { useTranslate } from '../hooks/useTranslation.jsx'

const SearchContainer = ({
  searchQuery,
  searchResults,
  showResults,
  onSearchInput,
  onSearchResultSelect,
  onClearResults,
}) => {
  const translate = useTranslate()
  const searchRef = useRef(null)

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        onClearResults()
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [onClearResults])

  return (
    <div className="search-container" ref={searchRef}>
      <div className="flex flex-col gap-4 w-full">
        <div className="relative">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder={translate('search.placeholder')}
            className="w-full bg-white border-2 border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {showResults && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="p-4 text-slate-500 text-sm text-center">
                <div className="mb-2">🔍</div>
                {translate('search.no.results')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="p-4 hover:bg-blue-50 cursor-pointer transition-colors duration-150 group"
                    onClick={() => onSearchResultSelect(result)}
                  >
                    <div className="font-medium text-sm text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                      📍 {result.address}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {result.offers && result.offers.length > 0 ? (
                        <>
                          <Badge
                            variant="outline"
                            className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-medium"
                          >
                            {translate(`connection.${DataUtils.normalizeConnectionType(result.offers[0].connectionType)}`) || result.offers[0].connectionType}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {DataUtils.formatSpeed(result.offers[0].speed)}
                          </div>
                          <div className="text-xs font-semibold text-slate-900 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                            {DataUtils.formatPrice(result.offers[0].pricePerMonthEur)}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">{translate('search.no.offers')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchContainer

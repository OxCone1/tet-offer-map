"use client"

import { useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import { DataUtils } from '../utils.js'
import { useTranslate } from '../hooks/useTranslation.jsx'

const ControlsContainer = ({
  showTetData,
  showUserData,
  userDataCount,
  onToggleTetData,
  onToggleUserData,
  onFileUpload,
  showSectors,
  onToggleSectors,
  sectorsRadius,
  onChangeSectorsRadius,
  sectorsMinPts,
  onChangeSectorsMinPts,
  typeFilters,
  onChangeTypeFilters,
  tetData,
  userData
}) => {
    const translate = useTranslate()
    const fileInputRef = useRef(null)

    // Calculate available connection types from visible data layers
    const availableTypes = useMemo(() => {
        const types = new Set();
        
        if (showTetData && tetData) {
            tetData.forEach(property => {
                if (property.offers && property.offers[0]) {
                    const norm = DataUtils.normalizeConnectionType(property.offers[0].connectionType);
                    if (norm) types.add(norm);
                }
            });
        }
        
        if (showUserData && userData) {
            userData.forEach(feature => {
                if (feature.properties && feature.properties.connection_type) {
                    const norm = DataUtils.normalizeConnectionType(feature.properties.connection_type);
                    if (norm) types.add(norm);
                }
            });
        }
        
        return Array.from(types).sort();
    }, [showTetData, tetData, showUserData, userData]);  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      onFileUpload(file)
      // Clear the input so the same file can be uploaded again
      event.target.value = ""
    }
  }

  return (
    <div className="controls-container space-y-6">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            {translate('controls.data.layers')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200 transition-all hover:bg-blue-100">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="tet-data"
                checked={showTetData}
                onCheckedChange={onToggleTetData}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <Label htmlFor="tet-data" className="text-sm font-medium text-blue-900 cursor-pointer">
                {translate('data.tet.official')}
              </Label>
            </div>
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 transition-all hover:bg-emerald-100">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="user-data"
                checked={showUserData}
                onCheckedChange={onToggleUserData}
                className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <Label
                htmlFor="user-data"
                className="text-sm font-medium text-emerald-900 cursor-pointer flex items-center gap-2"
              >
                {translate('data.user')}
                {userDataCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-emerald-200 text-emerald-800 border-emerald-300">
                    {userDataCount}
                  </Badge>
                )}
              </Label>
            </div>
            <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            className="w-full mt-4 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 py-6 bg-transparent"
          >
            <div className="flex flex-col items-center gap-2">
              <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm font-medium">{translate('controls.file.upload')}</span>
              <span className="text-xs text-slate-500">JSON, GeoJSON, NDJSON</span>
            </div>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.geojson,.ndjson"
            onChange={handleFileChange}
            className="hidden"
          />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            {translate('controls.sectors')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200 transition-all hover:bg-purple-100">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="sectors"
                checked={showSectors}
                onCheckedChange={onToggleSectors}
                className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
              />
              <Label htmlFor="sectors" className="text-sm font-medium text-purple-900 cursor-pointer">
                {translate('controls.sectors.show')}
              </Label>
            </div>
            <div className="w-3 h-3 bg-purple-600 rounded-full opacity-60"></div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="radius" className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                {translate('controls.sectors.radius')}
              </Label>
              <div className="relative">
                <input
                  id="radius"
                  type="number"
                  min="50"
                  max="1000"
                  step="10"
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  value={sectorsRadius}
                  onChange={(e) => onChangeSectorsRadius?.(Number.parseInt(e.target.value || "0", 10))}
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-slate-400">m</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minpts" className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                {translate('controls.sectors.min.points')}
              </Label>
              <input
                id="minpts"
                type="number"
                min="2"
                max="50"
                step="1"
                className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                value={sectorsMinPts}
                onChange={(e) => onChangeSectorsMinPts?.(Number.parseInt(e.target.value || "0", 10))}
              />
            </div>
          </div>
                    <Card className="mt-3">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{translate('controls.connection.types')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {availableTypes.map(t => (
                          <div key={t} className="flex items-center space-x-2">
                            <Checkbox
                              id={`t-${t}`}
                              checked={typeFilters.includes(t)}
                              onCheckedChange={(checked) => {
                                const newFilters = checked 
                                  ? [...typeFilters, t]
                                  : typeFilters.filter(x => x !== t);
                                onChangeTypeFilters?.(newFilters);
                              }}
                            />
                            <Label htmlFor={`t-${t}`} className="capitalize">
                              {translate(`connection.${t.toLowerCase()}`) || t}
                            </Label>
                          </div>
                        ))}
                        {availableTypes.length === 0 && (
                          <div className="text-xs text-slate-400 italic">{translate('controls.connection.no.types')}</div>
                        )}
                        {availableTypes.length > 0 && (
                          <div className="text-xs text-slate-500">{translate('controls.connection.toggle.hint')}</div>
                        )}
                      </CardContent>
                    </Card>
        </CardContent>
      </Card>
    </div>
  )
}

export default ControlsContainer

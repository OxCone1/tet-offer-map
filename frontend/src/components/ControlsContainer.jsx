"use client"

import { useRef, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import { DataUtils } from '../utils.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
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
  userData,
  userDatasets = [],
  datasetVisibility = {},
  onToggleDataset,
  onDeleteDataset
}) => {
  const translate = useTranslate()
  const fileInputRef = useRef(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [datasetName, setDatasetName] = useState("")
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [showDatasets, setShowDatasets] = useState(false)

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
  }, [showTetData, tetData, showUserData, userData]); const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      setPendingFile(file)
      const base = file.name.replace(/\.(ndjson|geojson|json)$/i, '')
      setDatasetName(base)
      setShowNameDialog(true)
    }
  }

  const confirmUpload = () => {
    if (pendingFile) {
      onFileUpload(pendingFile, datasetName.trim() || pendingFile.name)
    }
    setPendingFile(null)
    setDatasetName("")
    setShowNameDialog(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const cancelUpload = () => {
    setPendingFile(null)
    setDatasetName("")
    setShowNameDialog(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="controls-container space-y-4 h-full">
      <Card className="border-slate-200 shadow-sm overflow-hidden py-0 gap-0">
        <CardHeader className="[.border-b]:pb-2 pt-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
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
            <button
              type="button"
              onClick={() => setShowDatasets(v => !v)}
              className="text-xs text-emerald-700 underline hover:no-underline"
            >
              {showDatasets ? translate('controls.hide') || 'Hide' : translate('controls.show') || 'Show'}
            </button>
          </div>

          {showUserData && showDatasets && (
            <div className="rounded-md border border-emerald-200 p-2 space-y-2 bg-emerald-50/50 max-h-48 overflow-y-auto text-sm">
              {userDatasets.length === 0 && (
                <div className="text-xs text-slate-500 italic">{translate('controls.no.datasets') || 'No datasets yet'}</div>
              )}
              {userDatasets.map(ds => (
                <div key={ds.id} className="flex items-center justify-between gap-2 group">
                  <div className="flex flex-col">
                    <span className="font-medium text-emerald-900 truncate max-w-[120px]" title={ds.name}>{ds.name}</span>
                    <span className="text-[10px] text-emerald-700/70">{ds.count} pts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={datasetVisibility[ds.id] !== false}
                      onCheckedChange={(val) => onToggleDataset?.(ds.id, val)}
                      aria-label={`Toggle ${ds.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteDataset?.(ds.id)}
                      title={translate('controls.delete.dataset')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-700 hover:text-red-600 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            className="w-full mt-4 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 py-6 bg-transparent"
          >
            <div className="flex flex-row items-center">
              <svg className="h-9 w-9 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div className="ml-3 flex flex-col items-start">
                <span className="text-sm font-medium">{translate('controls.file.upload')}</span>
                <span className="text-xs text-slate-500">( JSON, GeoJSON, NDJSON )</span>
              </div>
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

      <Card className="border-slate-200 shadow-sm overflow-hidden py-0 gap-0">
        <CardHeader className="[.border-b]:pb-2 pt-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
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
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translate('controls.name.upload') || 'Name your dataset'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              {translate('controls.dataset.name') || 'Dataset Name'}
            </label>
            <Input
              autoFocus
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder={translate('controls.dataset.name.placeholder') || 'e.g. My Offers February'}
            />
            {pendingFile && (
              <p className="text-[11px] text-slate-500">{translate('controls.original.file') || 'Original file'}: {pendingFile.name}</p>
            )}
          </div>
          <DialogFooter className="mt-2 space-x-2 justify-end sm:flex-row">
            <Button variant="outline" size="sm" onClick={cancelUpload}>{translate('controls.cancel') || 'Cancel'}</Button>
            <Button size="sm" onClick={confirmUpload}>{translate('controls.upload') || 'Upload'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ControlsContainer

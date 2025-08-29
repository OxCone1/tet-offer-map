"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { Menu, X, Search, Settings, Map } from "lucide-react"
import SearchContainer from "./SearchContainer.jsx"
import ControlsContainer from "./ControlsContainer.jsx"
import { useTranslate } from '../hooks/useTranslation.jsx'

// Stable child component to prevent remounting the search input on every parent render
function NavigationContent({
    activeTab,
    setActiveTab,
    // Search props
    searchQuery,
    searchResults,
    showResults,
    onSearchInput,
    onSearchResultSelect,
    onClearResults,
    // Controls props
    showTetData,
    showUserData,
    userDataCount,
    onToggleTetData,
    onToggleUserData,
    onFileUpload,
    typeFilters,
    onChangeTypeFilters,
    showSectors,
    onToggleSectors,
    sectorsRadius,
    onChangeSectorsRadius,
    sectorsMinPts,
    onChangeSectorsMinPts,
    tetData,
    userData,
    userDatasets,
    datasetVisibility,
    onToggleDataset,
    onDeleteDataset,
}) {
    const translate = useTranslate()

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 rounded-t-lg">
                <Button
                    variant={activeTab === "search" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("search")}
                    className={`flex-1 rounded-none rounded-tl-lg ${activeTab === "search"
                        ? "bg-white border-b-2 border-blue-500 text-blue-600"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                >
                    <Search className="h-4 w-4 mr-2" />
                    {translate('nav.search')}
                </Button>
                <Button
                    variant={activeTab === "controls" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("controls")}
                    className={`flex-1 rounded-none rounded-tr-lg ${activeTab === "controls"
                        ? "bg-white border-b-2 border-blue-500 text-blue-600"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                >
                    <Settings className="h-4 w-4 mr-2" />
                    {translate('nav.controls')}
                </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white min-h-0 no-scrollbar">
                {activeTab === "search" && (
                    <div className="p-4">
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <Search className="h-5 w-5 text-blue-600" />
                                {translate('nav.search.title')}
                            </h3>
                            <p className="text-sm text-slate-600">{translate('nav.search.description')}</p>
                        </div>
                        <SearchContainer
                            searchQuery={searchQuery}
                            searchResults={searchResults}
                            showResults={showResults}
                            onSearchInput={onSearchInput}
                            onSearchResultSelect={onSearchResultSelect}
                            onClearResults={onClearResults}
                        />
                    </div>
                )}

                {activeTab === "controls" && (
                    <div className="p-4">
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <Settings className="h-5 w-5 text-blue-600" />
                                {translate('nav.controls.title')}
                            </h3>
                            <p className="text-sm text-slate-600">{translate('nav.controls.description')}</p>
                        </div>
                        <ControlsContainer
                            showTetData={showTetData}
                            showUserData={showUserData}
                            userDataCount={userDataCount}
                            onToggleTetData={onToggleTetData}
                            onToggleUserData={onToggleUserData}
                            onFileUpload={onFileUpload}
                            showSectors={showSectors}
                            onToggleSectors={onToggleSectors}
                            sectorsRadius={sectorsRadius}
                            onChangeSectorsRadius={onChangeSectorsRadius}
                            sectorsMinPts={sectorsMinPts}
                            onChangeSectorsMinPts={onChangeSectorsMinPts}
                            typeFilters={typeFilters}
                            onChangeTypeFilters={onChangeTypeFilters}
                            tetData={tetData}
                            userData={userData}
                            userDatasets={userDatasets}
                            datasetVisibility={datasetVisibility}
                            onToggleDataset={onToggleDataset}
                            onDeleteDataset={onDeleteDataset}
                        />
                    </div>
                )}
                {/* Bottom spacer to ensure last element isn't clipped under safe-area / gesture bar */}
                {/* <div className="h-4" /> */}
            </div>
        </div>
    );
}

const NavigationPanel = ({
    isMobile,
    // Search props
    searchQuery,
    searchResults,
    showResults,
    onSearchInput,
    onSearchResultSelect,
    onClearResults,
    // Controls props
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
    userDatasets,
    datasetVisibility,
    onToggleDataset,
    onDeleteDataset,
    onOpenChange, // Optional callback for panel state changes
}) => {
    const translate = useTranslate()
    const [isOpen, setIsOpen] = useState(!isMobile)
    const [activeTab, setActiveTab] = useState("search")

    // Notify parent of open state changes
    const handleOpenChange = (newIsOpen) => {
        setIsOpen(newIsOpen)
        if (onOpenChange) {
            onOpenChange(newIsOpen)
        }
    }



    if (isMobile) {
        return (
            <>
                {/* Floating Action Button for Mobile */}
                <div className="fixed top-9 left-4 z-50">
                    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
                        <SheetTrigger asChild>
                            <Button
                                size="lg"
                                className="rounded-full w-14 h-14 shadow-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                                variant="outline"
                            >
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-full sm:max-w-md p-0 bg-white">
                            <SheetHeader className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
                                <SheetTitle className="text-left flex items-center gap-2 text-slate-900">
                                    <Map className="h-5 w-5 text-blue-600" />
                                    {translate('nav.map.tools')}
                                </SheetTitle>
                            </SheetHeader>
                            <NavigationContent
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                searchQuery={searchQuery}
                                searchResults={searchResults}
                                showResults={showResults}
                                onSearchInput={onSearchInput}
                                onSearchResultSelect={onSearchResultSelect}
                                onClearResults={onClearResults}
                                showTetData={showTetData}
                                showUserData={showUserData}
                                userDataCount={userDataCount}
                                onToggleTetData={onToggleTetData}
                                onToggleUserData={onToggleUserData}
                                onFileUpload={onFileUpload}
                                showSectors={showSectors}
                                onToggleSectors={onToggleSectors}
                                sectorsRadius={sectorsRadius}
                                onChangeSectorsRadius={onChangeSectorsRadius}
                                sectorsMinPts={sectorsMinPts}
                                onChangeSectorsMinPts={onChangeSectorsMinPts}
                                typeFilters={typeFilters}
                                onChangeTypeFilters={onChangeTypeFilters}
                                tetData={tetData}
                                userData={userData}
                                userDatasets={userDatasets}
                                datasetVisibility={datasetVisibility}
                                onToggleDataset={onToggleDataset}
                                onDeleteDataset={onDeleteDataset}
                            />
                        </SheetContent>
                    </Sheet>
                </div>
            </>
        )
    }

    // Desktop version - collapsible sidebar
    return (
        <>
            <div
                className={`fixed left-0 top-0 h-full z-40 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <Card className="h-full w-96 rounded-none shadow-xl border-r border-slate-200 pt-0 pb-0">
                    <CardContent className="p-0 h-full flex flex-col min-h-0">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <Map className="h-5 w-5 text-blue-600" />
                                {translate('nav.map.tools')}
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenChange(false)}
                                className="hover:bg-red-50 hover:text-red-600"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <NavigationContent
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            searchQuery={searchQuery}
                            searchResults={searchResults}
                            showResults={showResults}
                            onSearchInput={onSearchInput}
                            onSearchResultSelect={onSearchResultSelect}
                            onClearResults={onClearResults}
                            showTetData={showTetData}
                            showUserData={showUserData}
                            userDataCount={userDataCount}
                            onToggleTetData={onToggleTetData}
                            onToggleUserData={onToggleUserData}
                            onFileUpload={onFileUpload}
                            showSectors={showSectors}
                            onToggleSectors={onToggleSectors}
                            sectorsRadius={sectorsRadius}
                            onChangeSectorsRadius={onChangeSectorsRadius}
                            sectorsMinPts={sectorsMinPts}
                            onChangeSectorsMinPts={onChangeSectorsMinPts}
                            typeFilters={typeFilters}
                            onChangeTypeFilters={onChangeTypeFilters}
                            tetData={tetData}
                            userData={userData}
                            userDatasets={userDatasets}
                            datasetVisibility={datasetVisibility}
                            onToggleDataset={onToggleDataset}
                            onDeleteDataset={onDeleteDataset}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Toggle button for desktop - always visible when panel is closed */}
            {!isOpen && (
                <Button
                    onClick={() => handleOpenChange(true)}
                    className="fixed left-4 top-4 z-50 rounded-full w-12 h-12 shadow-lg bg-blue-600 hover:bg-blue-700 text-white border-0"
                    size="sm"
                >
                    <Menu className="h-5 w-5" />
                </Button>
            )}

            {isOpen && <div className="fixed inset-0 bg-black/20 z-30" onClick={() => handleOpenChange(false)} />}
        </>
    )
}

export default NavigationPanel

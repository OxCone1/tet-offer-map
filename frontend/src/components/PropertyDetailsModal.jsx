import { useState } from "react"
import { DataUtils } from "../utils.js"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion"
import { Info, Wifi, Euro, Zap, Shield, Star, MapPin, Crown, Clock, Cable, Smartphone, Router } from "lucide-react"
import { useTranslate } from "../hooks/useTranslation.jsx"

const PropertyDetailsModal = ({ isOpen, properties, isUserData, isMobile, onClose }) => {
  const translate = useTranslate()
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(0)

  if (!isOpen || !properties) return null

  const dataSource = isUserData ? translate("data.source.user") : translate("data.source.official")
  const sourceColor = isUserData ? "text-emerald-600" : "text-blue-600"
  const sourceBgColor = isUserData ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"

  const offers = properties.offers || [properties]

  const sortedOffers = [...offers].sort((a, b) => {
    if (a.promotion && !b.promotion) return -1
    if (!a.promotion && b.promotion) return 1
    return 0
  })

  const selectedOffer = sortedOffers[selectedOfferIndex] || sortedOffers[0]

  const getConnectionIcon = (connectionType) => {
    if (!connectionType) return <Wifi className="h-5 w-5 text-blue-600" />

    const type = connectionType.toLowerCase()
    if (type.includes("fiber") || type.includes("optikas")) {
      return <Cable className="h-5 w-5 text-green-600" />
    } else if (type.includes("mobile") || type.includes("4g") || type.includes("5g")) {
      return <Smartphone className="h-5 w-5 text-purple-600" />
    } else if (type.includes("dsl") || type.includes("adsl")) {
      return <Router className="h-5 w-5 text-orange-600" />
    }
    return <Wifi className="h-5 w-5 text-blue-600" />
  }

  // Fallback speed display for mobile technologies without explicit speed info
  const formatOfferSpeed = (offer) => {
    if (offer?.speed) {
      return DataUtils.formatSpeed(offer.speed, offer.connectionType)
    }
    const ct = (offer?.connectionType || '').toLowerCase()
    if (ct.includes('mobile') || ct.includes('4g') || ct.includes('5g')) {
      return '30–100 Mbps'
    }
    return DataUtils.formatSpeed(offer.speed, offer.connectionType)
  }

  const TooltipFeature = ({ feature, title }) => {
    const [showTooltip, setShowTooltip] = useState(false)

    return (
      <div className="relative inline-flex items-center group">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors duration-200 w-full">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span className="text-slate-700 text-sm font-medium">{feature}</span>
          {title && (
            <div
              className="ml-auto cursor-help text-slate-400 hover:text-slate-600 transition-colors"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <Info className="h-4 w-4" />
              {showTooltip && (
                <div className="absolute z-10 bottom-full right-0 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl max-w-xs border">
                  {title}
                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const OfferCard = ({ offer, index, isSelected, onSelect }) => {
    const isPromotion = offer.promotion
    const hasContract = offer.contractTermMonths > 0
    const isUnlimitedContract = offer.contractTermMonths === 0

    return (
      <Card
        className={`relative cursor-pointer transition-all duration-300 hover:shadow-lg ${isSelected ? "ring-2 ring-blue-500 shadow-lg border-blue-200" : "border-slate-200 hover:border-slate-300"
          }`}
        onClick={() => onSelect(index)}
      >
        {isPromotion && (
          <div className="absolute -top-2 -right-2 z-10">
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold px-2 py-0.5 text-xs shadow-lg">
              <Crown className="h-3 w-3 mr-1" />
              PROMO
            </Badge>
          </div>
        )}

        <CardHeader
          className={`pb-2 ${isMobile ? "pt-3 px-3" : "pt-4 px-4"} ${isSelected ? "bg-gradient-to-r from-blue-50 to-blue-100" : "bg-slate-50"}`}
        >
          <CardTitle
            className={`${isMobile ? "text-sm" : "text-base"} font-bold text-slate-900 flex items-center gap-2`}
          >
            {getConnectionIcon(offer.connectionType)}
            <span className="font-medium">{offer.connectionType || offer.originalTitle}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className={`space-y-3 ${isMobile ? "px-3 pb-3" : "px-4 pb-4"}`}>
          {isMobile ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                <div className="flex items-center justify-center mb-1">
                  <Zap className="h-3 w-3 text-green-600" />
                </div>
                <p className="text-xs font-medium text-green-700 mb-1">Ātrums</p>
                <p className="text-sm font-bold text-green-800">
                  {formatOfferSpeed(offer)}
                </p>
              </div>

              <div className="text-center p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-center justify-center mb-1">
                  <Euro className="h-3 w-3 text-blue-600" />
                </div>
                <p className="text-xs font-medium text-blue-700 mb-1">Cena</p>
                <p className="text-sm font-bold text-blue-800">
                  {DataUtils.formatPrice(offer.pricePerMonthEur || offer.price)}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                <div className="flex items-center justify-center mb-1">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs font-medium text-green-700 mb-1">{translate("property.speed")}</p>
                <p className="text-lg font-bold text-green-800">
                  {formatOfferSpeed(offer)}
                </p>
              </div>

              <div className="text-center p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-center justify-center mb-1">
                  <Euro className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-xs font-medium text-blue-700 mb-1">{translate("property.price")}</p>
                <p className="text-xl font-bold text-blue-800">
                  {DataUtils.formatPrice(offer.pricePerMonthEur || offer.price)}{translate("property.per.month.short")}
                </p>
              </div>
            </>
          )}

          {hasContract ? (
            <div
              className={`flex items-center justify-center gap-1 text-xs text-slate-600 bg-slate-100 rounded-lg ${isMobile ? "p-1.5" : "p-2"}`}
            >
              <Clock className="h-3 w-3" />
              <span>{translate('property.contract.term', { months: offer.contractTermMonths })}</span>
            </div>
          ) : isUnlimitedContract ? (
            <div
              className={`flex items-center justify-center gap-1 text-xs text-green-600 bg-green-50 rounded-lg ${isMobile ? "p-1.5" : "p-2"}`}
            >
              <Shield className="h-3 w-3" />
              <span>{translate('property.contract.unlimited')}</span>
            </div>
          ) : null}

          {offer.features && offer.features.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-700">{translate('property.main.features')}</p>
              <div className="space-y-1">
                {offer.features.slice(0, isMobile ? 1 : 2).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0"></div>
                    <span className="truncate">{feature}</span>
                  </div>
                ))}
                {offer.features.length > (isMobile ? 1 : 2) && (
                  <p className="text-xs text-slate-500">{translate('property.features.more', { count: offer.features.length - (isMobile ? 1 : 2) })}</p>
                )}
              </div>
            </div>
          )}

          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(index)
            }}
          >
            {isSelected ? translate('property.offer.selected') : translate('property.offer.select')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const ModalContent = () => (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10"></div>
        <div className={`relative ${isMobile ? "p-4" : "border border-slate-200 p-6"}`}>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className={`${isMobile ? "text-lg" : "text-xl"} font-bold text-slate-900 leading-tight mb-2`}>
                {properties.address}
              </h2>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${sourceBgColor} ${sourceColor} border`}
              >
                <div className="w-2 h-2 rounded-full bg-current"></div>
                {dataSource}
              </div>
            </div>
          </div>
        </div>
      </div>

      {sortedOffers.length > 1 ? (
        <div className="space-y-4 px-2">
          <div className="text-center">
            <h3
              className={`${isMobile ? "text-base" : "text-lg"} font-bold text-slate-900 flex items-center justify-center gap-2`}
            >
              <Star className="h-5 w-5 text-amber-500" />
              {translate("property.available.offers")} ({sortedOffers.length})
            </h3>
            <p className="text-sm text-slate-600 mt-1">{translate('property.choose.best')}</p>
          </div>

          <div
            className={`grid gap-3 ${isMobile
                ? "grid-cols-1"
                : sortedOffers.length <= 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : sortedOffers.length === 3
                    ? "grid-cols-1 lg:grid-cols-3 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              }`}
          >
            {sortedOffers.map((offer, index) => (
              <OfferCard
                key={index}
                offer={offer}
                index={index}
                isSelected={index === selectedOfferIndex}
                onSelect={setSelectedOfferIndex}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto">
          <OfferCard offer={sortedOffers[0]} index={0} isSelected={true} onSelect={() => { }} />
        </div>
      )}

      <Accordion type="multiple" className="w-full space-y-4">
        {selectedOffer.terms && selectedOffer.terms.length > 0 && (
          <AccordionItem value="terms" className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="text-lg font-bold px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-all">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-slate-600" />
                {translate("property.terms")}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-4">
              <div className="space-y-3">
                {selectedOffer.terms.map((term, index) => (
                  <TooltipFeature key={index} feature={term} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {selectedOffer.features && selectedOffer.features.length > 0 && (
          <AccordionItem value="features" className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="text-lg font-bold px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-all">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-slate-600" />
                {translate("property.features")}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-4">
              <div className="space-y-3">
                {selectedOffer.features.map((feature, index) => (
                  <TooltipFeature key={index} feature={feature} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {selectedOffer.techInfo && (
          <AccordionItem value="techInfo" className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="text-lg font-bold px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-all">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-slate-600" />
                {translate("property.technical.info")}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-4">
              <TooltipFeature feature={selectedOffer.techInfo} title={translate("property.technical.info")} />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "bottom" : "left"}
        className={`${isMobile ? "h-[90vh] rounded-t-xl" : "w-[550px] sm:max-w-[550px]"} bg-white gap-0`}
      >
        <div>
          <SheetTitle className="sr-only">{translate("property.details")}</SheetTitle>
          <SheetDescription className="sr-only">{translate("property.details.description")}</SheetDescription>
        </div>
        <div className={`h-full overflow-y-auto ${isMobile ? "pb-4" : "pb-6"}`}>
          <ModalContent />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default PropertyDetailsModal
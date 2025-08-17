import React, { useState } from 'react';
import { DataUtils } from '../utils.js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { X, Info, Wifi, Euro, Zap, Shield, Star, MapPin } from 'lucide-react';
import { useTranslate } from '../hooks/useTranslation.jsx';

const PropertyDetailsModal = ({ isOpen, properties, isUserData, isMobile, onClose }) => {
  const translate = useTranslate()
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(0);

  if (!isOpen || !properties) return null;

  const dataSource = isUserData ? translate('data.source.user') : translate('data.source.official');
  const sourceColor = isUserData ? 'text-emerald-600' : 'text-blue-600';
  const sourceBgColor = isUserData ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200';

  // For TET data, use offers array; for user data, use properties directly
  const offers = properties.offers || [properties];
  const selectedOffer = offers[selectedOfferIndex] || offers[0];

  const TooltipFeature = ({ feature, title }) => {
    const [showTooltip, setShowTooltip] = useState(false);

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
    );
  };

  const ModalContent = () => (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl"></div>
        <div className="relative p-6 rounded-xl border border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-slate-500" />
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  {properties.address}
                </h2>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${sourceBgColor} ${sourceColor} border`}>
                <div className="w-2 h-2 rounded-full bg-current"></div>
                {dataSource}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Multiple offers selector */}
      {offers.length > 1 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-slate-100/50">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              {translate('property.available.offers')} ({offers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {offers.map((offer, index) => (
              <Button
                key={index}
                variant={index === selectedOfferIndex ? "default" : "outline"}
                size="lg"
                onClick={() => setSelectedOfferIndex(index)}
                className={`w-full justify-between text-left p-4 h-auto ${index === selectedOfferIndex
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
                    : "hover:bg-slate-50 border-slate-200"
                  }`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold">{offer.connectionType || offer.originalTitle}</span>
                  <span className={`text-sm ${index === selectedOfferIndex ? 'text-blue-100' : 'text-slate-500'}`}>
                    {DataUtils.formatSpeed(offer.speed)}
                  </span>
                </div>
                <Badge
                  variant={index === selectedOfferIndex ? "secondary" : "outline"}
                  className={`text-base font-bold px-3 py-1 ${index === selectedOfferIndex ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}
                >
                  {DataUtils.formatPrice(offer.pricePerMonthEur || offer.price)}
                </Badge>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Connection Details - Enhanced */}
      <Card className="border-slate-200 shadow-lg overflow-hidden">
        <CardHeader className="pb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle className="text-lg font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              {translate('property.connection.details')}
            </div>
            <Badge variant="secondary" className="bg-white text-blue-700 font-semibold">
              {translate(`connection.${DataUtils.normalizeConnectionType(selectedOffer.connectionType)}`) || selectedOffer.connectionType || translate('connection.unknown')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <div className="flex items-center justify-center mb-2">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-700 mb-1">{translate('property.speed')}</p>
              <p className="text-2xl font-bold text-green-800">
                {DataUtils.formatSpeed(selectedOffer.speed)}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
              <div className="flex items-center justify-center mb-2">
                <Euro className="h-6 w-6 text-amber-600" />
              </div>
              <p className="text-sm font-medium text-amber-700 mb-1">{translate('property.price')}</p>
              <p className="text-2xl font-bold text-amber-800">
                {DataUtils.formatPrice(selectedOffer.pricePerMonthEur || selectedOffer.price)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Accordion sections */}
      <Accordion type="multiple" className="w-full space-y-4">
        {/* Terms & Conditions */}
        {selectedOffer.terms && selectedOffer.terms.length > 0 && (
          <AccordionItem value="terms" className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="text-lg font-bold px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-all">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-slate-600" />
                {translate('property.terms')}
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

        {/* Features */}
        {selectedOffer.features && selectedOffer.features.length > 0 && (
          <AccordionItem value="features" className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="text-lg font-bold px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-all">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-slate-600" />
                {translate('property.features')}
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

        {/* Technical Information */}
        {selectedOffer.techInfo && (
          <AccordionItem value="techInfo" className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <AccordionTrigger className="text-lg font-bold px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-all">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-slate-600" />
                {translate('property.technical.info')}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-4">
              <TooltipFeature
                feature={selectedOffer.techInfo}
                title={translate('property.technical.info')}
              />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );

  // Use Sheet for both mobile and desktop with different slide directions
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "bottom" : "left"}
        className={`${isMobile ? "h-[90vh]" : "w-[550px] sm:max-w-[550px]"} bg-white`}
      >
        <SheetHeader>
          <SheetTitle className="sr-only">{translate('property.details')}</SheetTitle>
          <SheetDescription className="sr-only">
            {translate('property.details.description')}
          </SheetDescription>
        </SheetHeader>
        <div className={`${isMobile ? "mt-4" : "mt-6"} h-full overflow-y-auto pb-6`}>
          <ModalContent />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PropertyDetailsModal;
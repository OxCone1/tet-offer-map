import React, { useState } from 'react';
import { DataUtils } from '../utils.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { X, Info } from 'lucide-react';

const PropertyDetailsModal = ({ isOpen, properties, isUserData, isMobile, onClose }) => {
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(0);
  
  if (!isOpen || !properties) return null;

  const dataSource = isUserData ? 'User Data' : 'TET Official';
  const sourceColor = isUserData ? 'text-green-600' : 'text-blue-600';
  
  // For TET data, use offers array; for user data, use properties directly
  const offers = properties.offers || [properties];
  const selectedOffer = offers[selectedOfferIndex] || offers[0];

  const TooltipFeature = ({ feature, title }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    
    return (
      <div className="relative inline-flex items-center">
        <span className="text-foreground text-sm">{feature}</span>
        {title && (
          <div 
            className="ml-1 cursor-help text-muted-foreground hover:text-foreground"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info className="h-4 w-4" />
            {showTooltip && (
              <div className="absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg max-w-xs border">
                {title}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const ModalContent = () => (
    <>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            {properties.address}
          </h2>
          <p className={`text-sm ${sourceColor} font-medium mt-1`}>
            {dataSource}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="my-4" />

      {/* Multiple offers selector */}
      {offers.length > 1 && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Available Offers ({offers.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {offers.map((offer, index) => (
              <Button
                key={index}
                variant={index === selectedOfferIndex ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedOfferIndex(index)}
                className="w-full justify-start text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <span>{offer.connectionType || offer.originalTitle}</span>
                  <Badge variant="secondary" className="ml-2">
                    {DataUtils.formatPrice(offer.pricePerMonthEur || offer.price)}
                  </Badge>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selected offer details */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Connection Details
              <Badge variant="outline">
                {selectedOffer.connectionType || 'Unknown Type'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Speed</p>
                <p className="text-foreground">{DataUtils.formatSpeed(selectedOffer.speed)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Price</p>
                <p className="text-foreground font-semibold">
                  {DataUtils.formatPrice(selectedOffer.pricePerMonthEur || selectedOffer.price)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
        {selectedOffer.terms && selectedOffer.terms.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedOffer.terms.map((term, index) => (
                  <TooltipFeature key={index} feature={term} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        {selectedOffer.features && selectedOffer.features.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedOffer.features.map((feature, index) => (
                  <TooltipFeature key={index} feature={feature} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Technical Information */}
        {selectedOffer.techInfo && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Technical Information</CardTitle>
            </CardHeader>
            <CardContent>
              <TooltipFeature 
                feature={selectedOffer.techInfo}
                title="Technical details about the internet connection"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );

  // Use Sheet for mobile, Dialog for desktop
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Property Details</SheetTitle>
            <SheetDescription className="sr-only">
              Details about the selected property and its internet offers
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <ModalContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Property Details</DialogTitle>
          <DialogDescription className="sr-only">
            Details about the selected property and its internet offers
          </DialogDescription>
        </DialogHeader>
        <ModalContent />
      </DialogContent>
    </Dialog>
  );
};

export default PropertyDetailsModal;

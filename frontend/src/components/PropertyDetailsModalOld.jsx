import React, { useState } from 'react';
import { DataUtils } from '../utils.js';

const PropertyDetailsModal = ({ isOpen, properties, isUserData, isMobile, onClose }) => {
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(0);
  
  if (!isOpen || !properties) return null;

  const dataSource = isUserData ? 'User Data' : 'TET Official';
  const sourceColor = isUserData ? 'text-green-600' : 'text-blue-600';
  
  // For TET data, use offers array; for user data, use properties directly
  const offers = properties.offers || [properties];
  const selectedOffer = offers[selectedOfferIndex] || offers[0];

  const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );

  const InfoIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 16v-4"></path>
      <path d="M12 8h.01"></path>
    </svg>
  );

  const TooltipFeature = ({ feature, title }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    
    return (
      <div className="relative inline-flex items-center">
        <span className="text-slate-700 text-sm">{feature}</span>
        {title && (
          <div 
            className="ml-1 cursor-help text-slate-400 hover:text-slate-600"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <InfoIcon />
            {showTooltip && (
              <div className="absolute z-10 bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded shadow-lg max-w-xs">
                {title}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const PropertyContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${sourceColor} bg-opacity-10 px-2 py-1 rounded`}>
          {dataSource}
        </span>
        {offers.length > 1 && (
          <select 
            value={selectedOfferIndex} 
            onChange={(e) => setSelectedOfferIndex(parseInt(e.target.value))}
            className="text-xs border rounded px-2 py-1"
          >
            {offers.map((offer, index) => (
              <option key={index} value={index}>
                {offer.connectionType || offer.originalTitle || `Option ${index + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>
      
      <div>
        <h4 className="font-semibold text-slate-900 mb-2">Address</h4>
        <p className="text-slate-700">{properties.address}</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-slate-900 mb-1">Connection Type</h4>
          <p className="text-slate-700">{selectedOffer.connectionType || 'N/A'}</p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-1">Speed</h4>
          <p className="text-slate-700">{DataUtils.formatSpeed(selectedOffer.speed)}</p>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold text-slate-900 mb-1">Price</h4>
        <p className="text-slate-700 text-lg font-medium">
          {DataUtils.formatPrice(selectedOffer.pricePerMonthEur, selectedOffer.currency)}
        </p>
      </div>
      
      {selectedOffer.terms && selectedOffer.terms.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-1">Terms & Conditions</h4>
          <div className="space-y-1">
            {selectedOffer.terms.map((term, index) => (
              <TooltipFeature key={index} feature={term} />
            ))}
          </div>
        </div>
      )}
      
      {selectedOffer.features && selectedOffer.features.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-1">Features</h4>
          <div className="space-y-1">
            {selectedOffer.features.slice(0, selectedOffer.features.length / 2).map((feature, index) => (
              <TooltipFeature key={index} feature={feature} />
            ))}
          </div>
        </div>
      )}
      
      {selectedOffer.techInfo && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-1">Technical Information</h4>
          <TooltipFeature 
            feature="Technical Details" 
            title={selectedOffer.techInfo}
          />
        </div>
      )}
    </div>
  );

  if (isMobile) {
    // Mobile sheet that slides up from bottom
    return (
      <div className={`mobile-sheet ${!isOpen ? 'hidden' : ''}`}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Property Details</h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="custom-scrollbar max-h-80 overflow-y-auto">
            <PropertyContent />
          </div>
        </div>
      </div>
    );
  }

  // Desktop modal
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Property Details</h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
            >
              <CloseIcon />
            </button>
          </div>
          <PropertyContent />
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailsModal;

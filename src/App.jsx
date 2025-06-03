import React, { useState, useEffect } from 'react';

// Main App component for the Nu Skin Building Bonus Calculator
function App() {
    // State to manage the active tab, reordered to 'sharing', 'building', 'leading'
    const [activeTab, setActiveTab] = useState('sharing');

    // --- Building Bonus States ---
    const [completedBlocksThisMonth, setCompletedBlocksThisMonth] = useState(''); // Number of full BBs completed before current calculation
    const [buildingCalcMethod, setBuildingCalcMethod] = useState('default'); // 'default', 'products', 'direct_csv'
    const [buildingPsvInput, setBuildingPsvInput] = useState(''); // Total PSV for the current calculation period (Building)
    const [buildingCsvInput, setBuildingCsvInput] = useState(''); // Total CSV for the current calculation period (Building)
    const [calculatedBuildingCommission, setCalculatedBuildingCommission] = useState(0); // Final calculated Building bonus
    const [buildingCalculationDetails, setBuildingCalculationDetails] = useState([]); // Breakdown of the Building calculation

    // --- Sharing Bonus States ---
    const [selectedSharingCategory, setSelectedSharingCategory] = useState('');
    const [selectedSharingProductCode, setSelectedSharingProductCode] = useState('');
    const [sharingQuantity, setSharingQuantity] = useState('');
    const [addedSharingProducts, setAddedSharingProducts] = useState([]); // Stores { productCode, quantity, sharingBonusPerUnit, name }
    const [calculatedSharingBonus, setCalculatedSharingBonus] = useState(0); // Final calculated Sharing bonus

    // --- Leading Bonus States ---
    const [totalLtsvInput, setTotalLtsvInput] = useState(''); // Total LTSV for the month
    const [userTotalBlocksForLeading, setUserTotalBlocksForLeading] = useState(''); // User's total blocks for the month (for leading bonus eligibility)
    const [calculatedLeadingBonus, setCalculatedLeadingBonus] = useState(0); // Final calculated Leading bonus
    const [leadingBonusDetails, setLeadingBonusDetails] = useState(''); // Details for Leading bonus calculation

    // --- General Error State ---
    const [errorMessage, setErrorMessage] = useState(''); // General error messages for validation

    // Define product data structured by categories for Sharing Bonus
    // Also includes PSV/CSV for Building Bonus 'products' method
    const productData = {
        'NUTRICENTIALS® FACE CARE': [
            { code: '41001780', name: 'Hydra Clean Creamy Cleansing Lotion - 150 ml', psvPerUnit: 15, csvPerUnit: 196923, sharingBonusPerUnit: 13300 },
            { code: '41001784', name: 'In Balance pH Balance Toner - 150 ml', psvPerUnit: 11, csvPerUnit: 163630, sharingBonusPerUnit: 6500 },
            { code: '41001791', name: 'Celltrex® Always Right Recovery Fluid 30 ml', psvPerUnit: 33, csvPerUnit: 478468, sharingBonusPerUnit: 19700 },
            { code: '41001785', name: 'Day Dream Protective Cream SPF 35-50 ml', psvPerUnit: 23, csvPerUnit: 315140, sharingBonusPerUnit: 21200 },
            { code: '41001788', name: 'Dew All Day Moisture Restore Cream 75 ml', psvPerUnit: 28, csvPerUnit: 367054, sharingBonusPerUnit: 15100 },
            { code: '41001790', name: 'Spa Day Creamy Hydrating Masque - 100 ml', psvPerUnit: 19, csvPerUnit: 257665, sharingBonusPerUnit: 10200 },
            { code: '41001789', name: 'Brighter Day Exfoliant Scrub - 100 ml', psvPerUnit: 8, csvPerUnit: 91956, sharingBonusPerUnit: 7200 },
            { code: '41001796', name: 'Pillow Glow Sleeping Mask - 75 ml', psvPerUnit: 25, csvPerUnit: 321450, sharingBonusPerUnit: 20600 },
            { code: '41001795', name: 'Eye Love Bright Eyes Illuminating Eye Cream - 15 ml', psvPerUnit: 27, csvPerUnit: 361509, sharingBonusPerUnit: 23100 },
        ],
        'EXTENDED FACE CARE': [
            { code: '41101192', name: 'Clay Pack - 100 ml', psvPerUnit: 22, csvPerUnit: 281380, sharingBonusPerUnit: 12200 },
            { code: '4110308', name: 'Enhancer - 100 ml', psvPerUnit: 8, csvPerUnit: 94228, sharingBonusPerUnit: 6200 },
            { code: '41101226', name: 'NaPCA Moisture Mist 250 ml', psvPerUnit: 5, csvPerUnit: 74050, sharingBonusPerUnit: 5400 },
        ],
        'TRU FACE® SERIES': [
            { code: '41102892', name: 'ageLOC® Tru Face® Essence Ultra - 60 caps', psvPerUnit: 155, csvPerUnit: 1856271, sharingBonusPerUnit: 43800 },
            { code: '41102704', name: 'Tru Face Line Corrector - 30 ml', psvPerUnit: 20, csvPerUnit: 462163, sharingBonusPerUnit: 17000 },
        ],
        'TRI-PHASIC BRIGHT®': [
            { code: '41002276', name: 'Tri-Phasic Bright® Cleanser', psvPerUnit: 20, csvPerUnit: 267045, sharingBonusPerUnit: 9900 },
            { code: '41002273', name: 'Tri-Phasic Bright® Toner', psvPerUnit: 23, csvPerUnit: 278884, sharingBonusPerUnit: 10400 },
            { code: '41002277', name: 'Tri-Phasic Bright® Essence', psvPerUnit: 41, csvPerUnit: 506839, sharingBonusPerUnit: 18300 },
            { code: '41002274', name: 'Tri-Phasic Bright® Day Milk Lotion', psvPerUnit: 31, csvPerUnit: 384000, sharingBonusPerUnit: 14200 },
            { code: '41002275', name: 'Tri-Phasic Bright® Night Cream', psvPerUnit: 39, csvPerUnit: 486112, sharingBonusPerUnit: 12800 },
        ],
        'AGELOC® GALVANIC SPA®': [
            { code: '41003876', name: 'ageLOC® Galvanic Spa® Facial Gels - 4 set x 11 ml', psvPerUnit: 39, csvPerUnit: 486112, sharingBonusPerUnit: 12800 },
            { code: '41150337', name: 'ageLOC® Galvanic Spa® Facial Gels 2 Pack - 8 set x 11 ml', psvPerUnit: 50, csvPerUnit: 620505, sharingBonusPerUnit: 19800 },
        ],
        'NUTRIOL®': [
            { code: '41002106', name: 'ageLOC® Nutriol Hair & Scalp Shampoo - 200 ml', psvPerUnit: 22, csvPerUnit: 371038, sharingBonusPerUnit: 23300 },
            { code: '41002107', name: 'ageLOC® Nutriol Hair & Scalp Conditioner - 175 ml', psvPerUnit: 22, csvPerUnit: 371038, sharingBonusPerUnit: 23300 },
            { code: '41002149', name: 'ageLOC® Nutriol® Hair & Scalp Serum - 75 ml', psvPerUnit: 32, csvPerUnit: 487861, sharingBonusPerUnit: 30600 },
        ],
        'AGELOC®': [
            { code: '41003888', name: 'ageLOC® Transformation Set', psvPerUnit: 300, csvPerUnit: 3816530, sharingBonusPerUnit: 88200 },
            { code: '41003882', name: 'ageLOC® Gentle Cleanse & Tone - 60 ml', psvPerUnit: 37, csvPerUnit: 481106, sharingBonusPerUnit: 11500 },
            { code: '41003883', name: 'ageLOC® Future Serum 30 ml', psvPerUnit: 160, csvPerUnit: 1977677, sharingBonusPerUnit: 45700 },
            { code: '41003904', name: 'ageLOC® Radiant Day SPF22-25 ml', psvPerUnit: 58, csvPerUnit: 747119, sharingBonusPerUnit: 17400 },
            { code: '41003880', name: 'ageLOC® Transforming Night - 30 ml', psvPerUnit: 68, csvPerUnit: 866217, sharingBonusPerUnit: 20000 },
        ],
        'AGELOC BOOST ™™': [
            { code: '41001951', name: 'ageLOC Boost™™ 200PV', psvPerUnit: 200, csvPerUnit: 2332051, sharingBonusPerUnit: 148000 },
            { code: '41001927', name: 'ageLOC Boost™™ Activating Treatment', psvPerUnit: 40, csvPerUnit: 568517, sharingBonusPerUnit: 36200 },
        ],
        'AGELOC® LUMISPA®': [
            { code: '41151166', name: 'ageLOC® LumiSpa® iO Blemish Prone Pack', psvPerUnit: 140, csvPerUnit: 1522669, sharingBonusPerUnit: 225000 },
            { code: '41151167', name: 'ageLOC® LumiSpa® iO Dry Pack', psvPerUnit: 140, csvPerUnit: 1522669, sharingBonusPerUnit: 225000 },
            { code: '41151163', name: 'ageLOC® LumiSpa® iO Normal/Combo Pack', psvPerUnit: 140, csvPerUnit: 1522669, sharingBonusPerUnit: 225000 },
            { code: '41151164', name: 'ageLOC® LumiSpa® iO Oily Pack', psvPerUnit: 140, csvPerUnit: 1

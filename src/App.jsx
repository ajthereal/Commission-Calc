import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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

    // --- Firebase States ---
    const [firebaseInitialized, setFirebaseInitialized] = useState(false);
    const [user, setUser] = useState(null);
    const [loadingFirebase, setLoadingFirebase] = useState(true);
    const [db, setDb] = useState(null);
    const [appId, setAppId] = useState(null);

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
            { code: '41151164', name: 'ageLOC® LumiSpa® iO Oily Pack', psvPerUnit: 140, csvPerUnit: 1522669, sharingBonusPerUnit: 225000 },
            { code: '41151165', name: 'ageLOC® LumiSpa® iO Sensitive Pack', psvPerUnit: 140, csvPerUnit: 1522669, sharingBonusPerUnit: 225000 },
            { code: '41002664', name: 'TCS ageLOC® LumiSpa® iO™™ Single Pack Gentle Rose', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41002665', name: 'TCS ageLOC® LumiSpa® OM Single Pack Normal Rose', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41002666', name: 'TCS ageLOC® LumiSpa® OM Single Pack Firm Rose', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41002438', name: 'TCS ageLOC® LumiSpa® iO Single Pack Normal Blue', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41002439', name: 'TCS ageLOC® LumiSpa® iO Single Pack Firm Blue', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41002437', name: 'TCS ageLOC® LumiSpa® iO Single Pack Gentle Blue', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41002440', name: 'Accent ageLOC LumiSpa iO White', psvPerUnit: 40, csvPerUnit: 580775, sharingBonusPerUnit: 85500 },
            { code: '41150834', name: 'LumiSpa Accent TCS Twin Pack', psvPerUnit: 9, csvPerUnit: 140299, sharingBonusPerUnit: 25100 },
            { code: '41002539', name: 'ageLOC LumiSpa Blemish Serum', psvPerUnit: 30, csvPerUnit: 447400, sharingBonusPerUnit: 27700 },
            { code: '41001567', name: 'ageLOC® LumiSpa® IdealEyes', psvPerUnit: 30, csvPerUnit: 445429, sharingBonusPerUnit: 65500 },
            { code: '41001495', name: 'ageLOC® LumiSpa® AC Blemish Prone - 100 ml', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41001494', name: 'ageLOC® LumiSpa® AC Dry - 100 ml', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41001492', name: 'ageLOC® LumiSpa® AC Normal/Combo - 100 ml', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41001493', name: 'ageLOC® LumiSpa® AC Oily - 100 ml', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
            { code: '41001491', name: 'ageLOC® LumiSpa® AC Sensitive - 100 ml', psvPerUnit: 25, csvPerUnit: 361673, sharingBonusPerUnit: 81800 },
        ],
        'AGELOC® WELSPA IO': [
            { code: '41151195', name: 'ageLOC® WellSpa iO 250 PSV Kit', psvPerUnit: 250, csvPerUnit: 3070946, sharingBonusPerUnit: 500000 },
            { code: '41151217', name: 'ageLOC® WellSpa iO 1000 PSV Kit', psvPerUnit: 1000, csvPerUnit: 12283784, sharingBonusPerUnit: 2000000 },
            { code: '41151198', name: 'ageLOC® Body Activating Gel Pack of 4', psvPerUnit: 105, csvPerUnit: 1574400, sharingBonusPerUnit: 104000 },
            { code: '41151199', name: 'ageLOC® Body Serum Pack of 4', psvPerUnit: 105, csvPerUnit: 1574400, sharingBonusPerUnit: 104000 },
            { code: '41151200', name: 'ageLOC® Body Polish Pack of 4', psvPerUnit: 92, csvPerUnit: 1377600, sharingBonusPerUnit: 92000 },
            { code: '41151227', name: 'Body Treatment Pack', psvPerUnit: 55, csvPerUnit: 811394, sharingBonusPerUnit: 54000 },
            { code: '41002889', name: 'ageLOC Body Activating Gel', psvPerUnit: 31, csvPerUnit: 480000, sharingBonusPerUnit: 30700 },
            { code: '41002490', name: 'ageLOC Body Serum', psvPerUnit: 31, csvPerUnit: 480000, sharingBonusPerUnit: 30700 },
            { code: '41002489', name: 'ageLOC Body Polish', psvPerUnit: 27, csvPerUnit: 420000, sharingBonusPerUnit: 27000 },
        ],
        'EPOCH®': [
            { code: '41001990', name: 'Epoch Ava Puhi Shampoo and Light Conditioner - 250 ml', psvPerUnit: 13, csvPerUnit: 168352, sharingBonusPerUnit: 6300 },
            { code: '41001987', name: 'Epoch Glacial Marine Mud® - 125 g', psvPerUnit: 14, csvPerUnit: 219149, sharingBonusPerUnit: 12200 },
        ],
        'ORAL CARE': [
            { code: '41111155', name: 'AP 24 Whitening Toothpaste - 110 gr', psvPerUnit: 3, csvPerUnit: 40264, sharingBonusPerUnit: 9700 },
        ],
        'BODY CARE': [
            { code: '41003903', name: 'ageLOC® Dermatic Effects - 150 ml', psvPerUnit: 42, csvPerUnit: 544661, sharingBonusPerUnit: 12600 },
            { code: '41101216', name: 'Liquid Body Bar - 250 ml', psvPerUnit: 8, csvPerUnit: 76578, sharingBonusPerUnit: 6500 },
            { code: '41102717', name: 'Liquid Body Lufra II - 250 ml', psvPerUnit: 5, csvPerUnit: 90349, sharingBonusPerUnit: 5400 },
            { code: '41100875', name: 'Perennial® Intense Body Moisturizer - 250 ml', psvPerUnit: 16, csvPerUnit: 213097, sharingBonusPerUnit: 13700 },
            { code: '41002652', name: 'Sunright® Solar Screen Mineral Face Sunscreen SPF 50+ PA++++ - 50 ml', psvPerUnit: 21, csvPerUnit: 329207, sharingBonusPerUnit: 21500 },
        ],
        'SCION®': [
            { code: '41138045', name: 'Scion Feminine Wash 125 ml', psvPerUnit: 3, csvPerUnit: 49301, sharingBonusPerUnit: 3600 },
            { code: '41102911', name: 'Scion® Whitening Roll On - 75 ml', psvPerUnit: 3, csvPerUnit: 40996, sharingBonusPerUnit: 5600 },
        ],
        'NU COLOUR®': [
            { code: '41002051', name: '1.1 Ivory - 30 ml (BB+ Skin Loving Foundation)', psvPerUnit: 28, csvPerUnit: 419061, sharingBonusPerUnit: 20500 },
            { code: '41002053', name: '1.3 Linen 30 ml (BB+ Skin Loving Foundation)', psvPerUnit: 28, csvPerUnit: 419061, sharingBonusPerUnit: 20500 },
            { code: '41002057', name: '3.1 Natural Beige - 30 ml (BB+ Skin Loving Foundation)', psvPerUnit: 28, csvPerUnit: 419061, sharingBonusPerUnit: 20500 },
            { code: '41002663', name: 'Nu Colour Lash + Brow Serum', psvPerUnit: 27, csvPerUnit: 462166, sharingBonusPerUnit: 20900 },
        ],
        'PHARMANEX® DIETARY SUPPLEMENT': [
            { code: '41003901', name: 'ageLOC® R2 - 120 cap & 60 cap', psvPerUnit: 100, csvPerUnit: 1396923, sharingBonusPerUnit: 36900 },
            { code: '41001929', name: 'ageLOC® Reset', psvPerUnit: 100, csvPerUnit: 1374962, sharingBonusPerUnit: 85100 },
            { code: '41002751', name: 'ageLOC® TRME® JumpStart - 15 pack', psvPerUnit: 85, csvPerUnit: 1087530, sharingBonusPerUnit: 24800 },
            { code: '41002612', name: 'ageLOC® TRME® TrimShake Coklat - 15 sachet', psvPerUnit: 60, csvPerUnit: 695372, sharingBonusPerUnit: 16300 },
            { code: '41002613', name: 'ageLOC® TRME® TrimShake Vanila - 15 sachet', psvPerUnit: 60, csvPerUnit: 695372, sharingBonusPerUnit: 16300 },
            { code: '41002963', name: 'ageLOC® TRME® TrimShake Mocha - 15 sachet', psvPerUnit: 60, csvPerUnit: 695372, sharingBonusPerUnit: 16300 },
            { code: '41151276', name: 'ageLOC® TRME® TrimShake Twin Pack Coklat - 30 sachet', psvPerUnit: 105, csvPerUnit: 1229627, sharingBonusPerUnit: 32800 },
            { code: '41151277', name: 'ageLOC® TRME® TrimShake Twin Pack Vanila - 30 sachet', psvPerUnit: 105, csvPerUnit: 1229627, sharingBonusPerUnit: 32800 },
            { code: '41151278', name: 'ageLOC® TRME® TrimShake Twin Pack Mocha - 30 sachet', psvPerUnit: 105, csvPerUnit: 1229627, sharingBonusPerUnit: 32800 },
            { code: '41003763', name: 'ageLOC® Y-Span®', psvPerUnit: 120, csvPerUnit: 1825840, sharingBonusPerUnit: 82200 },
            { code: '41150959', name: 'ageLOC® Galvanic Face 1000PV', psvPerUnit: 1000, csvPerUnit: 11242454, sharingBonusPerUnit: 3000000 },
            { code: '41150958', name: 'ageLOC® Galvanic Spa® Face 250PSV', psvPerUnit: 250, csvPerUnit: 2810614, sharingBonusPerUnit: 750000 },
            { code: '41150927', name: 'ageLOC® Nutriol® Hair & Scalp System 100PSV', psvPerUnit: 100, csvPerUnit: 1381803, sharingBonusPerUnit: 89100 },
            { code: '41150468', name: 'ageLOC® R2 Business Builder Pack 500PSV', psvPerUnit: 500, csvPerUnit: 6409932, sharingBonusPerUnit: 155000 },
            { code: '41185580', name: 'ageLOC® Reset 500PSV', psvPerUnit: 500, csvPerUnit: 7129230, sharingBonusPerUnit: 441500 },
            { code: '41150976', name: 'ageLOC® TRME® 1000PV Coklat', psvPerUnit: 1000, csvPerUnit: 12230612, sharingBonusPerUnit: 282400 },
            { code: '41150977', name: 'ageLOC® TRME® 1000PV Vanila', psvPerUnit: 1000, csvPerUnit: 12230612, sharingBonusPerUnit: 282400 },
            { code: '41151170', name: 'ageLOC® TRME® 1000PV Mocha', psvPerUnit: 1000, csvPerUnit: 12230612, sharingBonusPerUnit: 282400 },
            { code: '41150617', name: 'ageLOC® Y-Span® 500 PSV', psvPerUnit: 500, csvPerUnit: 6945744, sharingBonusPerUnit: 209500 },
            { code: '41150623', name: 'ageLOC® Y-Span® 1000 PSV', psvPerUnit: 1000, csvPerUnit: 12775439, sharingBonusPerUnit: 291000 },
            { code: '41151033', name: 'Beauty Skin Treatment Package 500PV', psvPerUnit: 500, csvPerUnit: 4590991, sharingBonusPerUnit: 1000000 },
            { code: '41151173', name: 'Better Together', psvPerUnit: 250, csvPerUnit: 2914134, sharingBonusPerUnit: 310000 },
            { code: '41151180', name: 'Collagen Package', psvPerUnit: 225, csvPerUnit: 3081643, sharingBonusPerUnit: 202000 },
            { code: '41150915', name: 'Daily Fresh Face & Body Pack', psvPerUnit: 50, csvPerUnit: 568446, sharingBonusPerUnit: 24600 },
            { code: '41001703', name: 'EcoSphere® Water Purifier', psvPerUnit: 500, csvPerUnit: 5401577, sharingBonusPerUnit: 1354700 },
            { code: '41151243', name: 'Everywhere Kit', psvPerUnit: 12, csvPerUnit: 142221, sharingBonusPerUnit: 12000 },
            { code: '41150708', name: 'G3 Juice 4 bottles pack (4x900ml)', psvPerUnit: 148, csvPerUnit: 1572506, sharingBonusPerUnit: 83400 },
            { code: '41150249', name: 'Nu Healthy Family Package', psvPerUnit: 100, csvPerUnit: 1191198, sharingBonusPerUnit: 46200 },
            { code: '41150618', name: 'Ultimate Anti Aging Duo 1000 PSV', psvPerUnit: 1000, csvPerUnit: 12775439, sharingBonusPerUnit: 291000 },
            { code: '41001702', name: '3 in 1 Cartridge Eco Water Purifier', psvPerUnit: 100, csvPerUnit: 1631663, sharingBonusPerUnit: 271900 },
        ],
        'VITA MEAL': [
            { code: '41113509', name: 'VitaMeal Donation 2385 gr', psvPerUnit: 22, csvPerUnit: 318384, sharingBonusPerUnit: 0 },
            { code: '41113527', name: 'VitaMeal Donation 5 Bag - 5 x 2385 gr', psvPerUnit: 110, csvPerUnit: 1591919, sharingBonusPerUnit: 0 },
        ],
    };

    // Get list of categories for the dropdown
    const categories = Object.keys(productData);

    // Filter products based on selected category for the second dropdown
    const productsInSelectedCategory = selectedSharingCategory ? productData[selectedSharingCategory] : [];

    // Effect to reset product selection when category changes
    useEffect(() => {
        setSelectedSharingProductCode('');
        setSharingQuantity('');
    }, [selectedSharingCategory]);

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        const initializeFirebaseAndAuth = async () => {
            try {
                // Access global variables provided by the environment
                const config = JSON.parse(window.__firebase_config);
                const initialToken = window.__initial_auth_token;
                const currentAppId = window.__app_id;

                const app = initializeApp(config);
                const auth = getAuth(app);
                const firestoreDb = getFirestore(app);

                setDb(firestoreDb);
                setAppId(currentAppId);

                // Authenticate
                if (initialToken) {
                    await signInWithCustomToken(auth, initialToken);
                    console.log("Signed in with custom token.");
                } else {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously.");
                }

                onAuthStateChanged(auth, (currentUser) => {
                    if (currentUser) {
                        setUser(currentUser);
                        console.log("Firebase Auth State Changed: User UID -", currentUser.uid);
                    } else {
                        setUser(null);
                        console.log("Firebase Auth State Changed: No user.");
                    }
                    setFirebaseInitialized(true);
                    setLoadingFirebase(false);
                });

            } catch (error) {
                console.error("Error initializing Firebase or signing in:", error);
                setErrorMessage("Failed to connect to Firebase. Please check console for details.");
                setLoadingFirebase(false);
            }
        };

        // Check if global variables are defined before attempting to initialize Firebase
        if (typeof window !== 'undefined' && typeof window.__firebase_config !== 'undefined' && typeof window.__app_id !== 'undefined') {
            initializeFirebaseAndAuth();
        } else {
            setLoadingFirebase(false);
            setErrorMessage("Firebase global variables not available. Running without database features.");
        }
    }, []); // Run only once on component mount


    // --- Firestore Operations ---
    // Using a fixed document ID 'last_calculation' for simplicity to demonstrate saving/loading
    // For a real app, you might use unique IDs for each saved calculation or a more complex query.
    const saveCalculation = async (bonusType, data) => {
        if (!db || !user || !appId) {
            console.warn("Firebase not initialized or user not authenticated. Cannot save data.");
            // Do not set errorMessage here to avoid cluttering UI if Firebase is not intended to be used
            return;
        }
        try {
            // Save to private user-specific collection under a fixed document ID
            const docRef = doc(db, `artifacts/${appId}/users/${user.uid}/${bonusType}`, "last_calculation");
            await setDoc(docRef, {
                ...data,
                timestamp: new Date().toISOString(),
                userId: user.uid
            });
            console.log(`Saved ${bonusType} calculation for user ${user.uid}.`);
            // Removed alert() as per instructions, replaced with console log for demonstration
        } catch (e) {
            console.error("Error saving document: ", e);
            setErrorMessage(`Failed to save ${bonusType} data.`);
        }
    };

    const loadLastCalculation = async (bonusType) => {
        if (!db || !user || !appId) {
            console.warn("Firebase not initialized or user not authenticated. Cannot load data.");
            return null;
        }
        try {
            const docRef = doc(db, `artifacts/${appId}/users/${user.uid}/${bonusType}`, "last_calculation");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("Loaded last calculation:", docSnap.data());
                return docSnap.data();
            } else {
                console.log("No last calculation found for", bonusType);
                return null;
            }
        } catch (e) {
            console.error("Error loading document: ", e);
            setErrorMessage(`Failed to load last ${bonusType} data.`);
            return null;
        }
    };


    // Helper to format numbers to IDR currency
    const formatIDR = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Function to get the commission rate based on the block number (for Building Bonus)
    const getBuildingCommissionRate = (blockNumber) => {
        if (blockNumber >= 1 && blockNumber <= 2) return 0.05; // 5%
        if (blockNumber === 3) return 0.10; // 10%
        if (blockNumber === 4) return 0.15; // 15%
        if (blockNumber === 5) return 0.20; // 20%
        if (blockNumber === 6) return 0.25; // 25%
        if (blockNumber === 7) return 0.30; // 30%
        if (blockNumber >= 8 && blockNumber <= 15) return 0.35; // 35%
        if (blockNumber >= 16) return 0.40; // 40%
        return 0; // Default to 0 for invalid block numbers
    };

    // Handler for product quantity changes in Sharing Bonus tab (for adding products)
    const handleSharingQuantityChange = (value) => {
        if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0)) {
            setSharingQuantity(value);
        }
    };

    // Function to add a product to the sharing bonus calculation list
    const addProductForSharing = () => {
        setErrorMessage('');
        if (!selectedSharingProductCode || !sharingQuantity || parseInt(sharingQuantity) <= 0) {
            setErrorMessage('Sharing Bonus: Please select a product and enter a valid quantity.');
            return;
        }

        const product = productsInSelectedCategory.find(p => p.code === selectedSharingProductCode);
        if (product) {
            const quantity = parseInt(sharingQuantity);
            const existingProductIndex = addedSharingProducts.findIndex(p => p.code === product.code);

            if (existingProductIndex > -1) {
                // Update existing product quantity
                const updatedProducts = [...addedSharingProducts];
                updatedProducts[existingProductIndex].quantity += quantity;
                updatedProducts[existingProductIndex].totalBonus += (quantity * product.sharingBonusPerUnit);
                setAddedSharingProducts(updatedProducts);
            } else {
                // Add new product
                setAddedSharingProducts([
                    ...addedSharingProducts,
                    {
                        code: product.code,
                        name: product.name,
                        quantity: quantity,
                        sharingBonusPerUnit: product.sharingBonusPerUnit,
                        totalBonus: quantity * product.sharingBonusPerUnit,
                    },
                ]);
            }
            setSelectedSharingProductCode('');
            setSharingQuantity('');
            // No need to call calculateTotalSharingBonus here, it's handled by useEffect
        }
    };

    // Function to remove a product from the sharing bonus calculation list
    const removeProductForSharing = (codeToRemove) => {
        setAddedSharingProducts(addedSharingProducts.filter(p => p.code !== codeToRemove));
        // No need to call calculateTotalSharingBonus here, it's handled by useEffect
    };

    // Function to calculate the total Sharing Bonus from added products
    const calculateTotalSharingBonus = () => {
        const total = addedSharingProducts.reduce((sum, product) => sum + product.totalBonus, 0);
        setCalculatedSharingBonus(total);
    };

    // Recalculate total sharing bonus whenever added products change
    useEffect(() => {
        calculateTotalSharingBonus();
    }, [addedSharingProducts]);


    // --- Building Bonus Calculation Logic ---
    const calculateBuildingBonus = async () => {
        setErrorMessage('');
        setCalculatedBuildingCommission(0);
        setBuildingCalculationDetails([]);

        const prevCompletedBlocks = parseInt(completedBlocksThisMonth);
        if (isNaN(prevCompletedBlocks) || prevCompletedBlocks < 0) {
            setErrorMessage('Building Bonus: Please enter a valid non-negative number for "Blocks Already Completed This Month".');
            return;
        }

        let currentPeriodPSV = 0;
        let currentPeriodCSV = 0;
        let csvPerPsv = 0;

        if (buildingCalcMethod === 'default') {
            const psv = parseInt(buildingPsvInput);
            if (isNaN(psv) || psv < 0) {
                setErrorMessage('Building Bonus: Please enter a valid non-negative number for "Total Sales Volume (PSV)".');
                return;
            }
            currentPeriodPSV = psv;
            csvPerPsv = 12850; // Default rate based on user's real data
            currentPeriodCSV = currentPeriodPSV * csvPerPsv;
        } else if (buildingCalcMethod === 'products') {
            let totalPsvFromProducts = 0;
            let totalCsvFromProducts = 0;
            let hasValidProductInput = false;

            // Iterate through all categories and products to find selected ones
            for (const categoryKey in productData) {
                productData[categoryKey].forEach(product => {
                    const addedProduct = addedSharingProducts.find(p => p.code === product.code);
                    if (addedProduct) {
                        hasValidProductInput = true;
                        totalPsvFromProducts += addedProduct.quantity * product.psvPerUnit;
                        totalCsvFromProducts += addedProduct.quantity * product.csvPerUnit;
                    }
                });
            }

            if (!hasValidProductInput) {
                setErrorMessage('Building Bonus (Products): Please add at least one product in the Sharing Bonus tab to calculate.');
                return;
            }

            if (totalPsvFromProducts === 0) {
                setErrorMessage('Building Bonus (Products): Total PSV from added products cannot be zero. Please adjust quantities in Sharing Bonus tab.');
                return;
            }

            currentPeriodPSV = totalPsvFromProducts;
            currentPeriodCSV = totalCsvFromProducts;
            csvPerPsv = currentPeriodCSV / currentPeriodPSV;
        } else if (buildingCalcMethod === 'direct_csv') {
            const psv = parseInt(buildingPsvInput);
            const csv = parseInt(buildingCsvInput);
            if (isNaN(psv) || psv < 0 || isNaN(csv) || csv < 0) {
                setErrorMessage('Building Bonus (Direct CSV): Please enter valid non-negative numbers for both "Total Sales Volume (PSV)" and "Total CSV".');
                return;
            }
            if (psv === 0) {
                setErrorMessage('Building Bonus (Direct CSV): Total PSV cannot be zero when directly inputting CSV.');
                return;
            }
            currentPeriodPSV = psv;
            currentPeriodCSV = csv;
            csvPerPsv = currentPeriodCSV / currentPeriodPSV;
        }

        const newFullBlocks = Math.floor(currentPeriodPSV / 500);
        const remainingPSV = currentPeriodPSV % 500;

        let totalBonus = 0;
        const details = [];

        for (let i = 0; i < newFullBlocks; i++) {
            const currentBlockNumber = prevCompletedBlocks + i + 1;
            const commissionRate = getBuildingCommissionRate(currentBlockNumber);
            const blockCSV = 500 * csvPerPsv;
            const blockCommission = blockCSV * commissionRate;

            totalBonus += blockCommission;
            details.push({
                type: 'Full Block',
                blockNumber: currentBlockNumber,
                psv: 500,
                csv: blockCSV,
                rate: commissionRate * 100,
                commission: blockCommission,
            });
        }

        if (remainingPSV > 0) {
            const totalBlocksAfterNewFull = prevCompletedBlocks + newFullBlocks;
            if (totalBlocksAfterNewFull >= 4) {
                const commissionRateForIncomplete = getBuildingCommissionRate(totalBlocksAfterNewFull);
                const incompleteBlockCSV = remainingPSV * csvPerPsv;
                const incompleteBlockCommission = incompleteBlockCSV * commissionRateForIncomplete;

                totalBonus += incompleteBlockCommission;
                details.push({
                    type: 'Incomplete Block',
                    blockNumber: totalBlocksAfterNewFull + 1,
                    psv: remainingPSV,
                    csv: incompleteBlockCSV,
                    rate: commissionRateForIncomplete * 100,
                    commission: incompleteBlockCommission,
                    note: `(paid at ${commissionRateForIncomplete * 100}% rate of Block ${totalBlocksAfterNewFull})`,
                });
            } else {
                details.push({
                    type: 'Incomplete Block',
                    blockNumber: totalBlocksAfterNewFull + 1,
                    psv: remainingPSV,
                    csv: remainingPSV * csvPerPsv,
                    rate: 0,
                    commission: 0,
                    note: '(Not compensated as less than 4 blocks completed for the month)',
                });
            }
        }

        setCalculatedBuildingCommission(totalBonus);
        setBuildingCalculationDetails(details);

        // Save to Firebase
        if (firebaseInitialized && user && db && appId) {
            await saveCalculation("building_bonus", {
                completedBlocksThisMonth: prevCompletedBlocks,
                method: buildingCalcMethod,
                psvInput: buildingPsvInput,
                csvInput: buildingCsvInput,
                calculatedBonus: totalBonus,
                details: details,
            });
        }
    };

    // --- Sharing Bonus Calculation Logic (triggered by button, not useEffect) ---
    const calculateSharingBonus = async () => {
        setErrorMessage('');
        // calculateTotalSharingBonus is already updating calculatedSharingBonus via useEffect
        // This button just triggers the display of the result if needed, but the value is always fresh.
        if (addedSharingProducts.length === 0) {
            setErrorMessage('Sharing Bonus: No products added to calculate.');
            return;
        }
        // The total is already calculated by the useEffect, just ensure no error message if products are present
        if (calculatedSharingBonus <= 0) {
             setErrorMessage('Sharing Bonus: Total bonus is 0. Please check product quantities or if products have sharing bonus.');
        }

        // Save to Firebase
        if (firebaseInitialized && user && db && appId && calculatedSharingBonus > 0) {
            await saveCalculation("sharing_bonus", {
                products: addedSharingProducts,
                calculatedBonus: calculatedSharingBonus,
            });
        }
    };


    // --- Leading Bonus Calculation Logic ---
    const calculateLeadingBonus = async () => {
        setErrorMessage('');
        setCalculatedLeadingBonus(0);
        setLeadingBonusDetails('');

        const totalLtsv = parseInt(totalLtsvInput);
        const totalBlocks = parseInt(userTotalBlocksForLeading);

        if (isNaN(totalLtsv) || totalLtsv < 0) {
            setErrorMessage('Leading Bonus: Please enter a valid non-negative number for "Total Leadership Team Sales Volume (LTSV)".');
            return;
        }
        if (isNaN(totalBlocks) || totalBlocks < 0) {
            setErrorMessage('Leading Bonus: Please enter a valid non-negative number for "Your Total Completed Building Blocks This Month".');
            return;
        }

        if (totalBlocks < 4) {
            setLeadingBonusDetails('You need to complete at least 4 Building Blocks in the month to qualify for Leading Bonus.');
            return;
        }

        const teamCsv = totalLtsv * 12850; // Convert LTSV to Team CSV using the default rate

        let leadingRate = 0;
        if (totalBlocks >= 6) {
            leadingRate = 0.05; // 5% for 6+ blocks
            setLeadingBonusDetails(`Eligible for 5% Leading Bonus (completed ${totalBlocks} blocks).`);
        } else if (totalBlocks >= 4 && totalBlocks <= 5) {
            leadingRate = 0.025; // 2.5% for 4-5 blocks
            setLeadingBonusDetails(`Eligible for 2.5% Leading Bonus (completed ${totalBlocks} blocks).`);
        }

        const bonus = teamCsv * leadingRate;
        setCalculatedLeadingBonus(bonus);
        setLeadingBonusDetails(prev => `${prev} Calculated on Team CSV: ${formatIDR(teamCsv)}.`);

        // Save to Firebase
        if (firebaseInitialized && user && db && appId) {
            await saveCalculation("leading_bonus", {
                totalLtsv: totalLtsv,
                userTotalBlocks: totalBlocks,
                calculatedBonus: bonus,
                details: leadingBonusDetails,
            });
        }
    };


    if (loadingFirebase) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 p-4 sm:p-6 flex items-center justify-center font-sans">
                <div className="text-center text-blue-700 text-2xl font-semibold">
                    Loading application and connecting to Firebase...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 p-4 sm:p-6 flex items-center justify-center font-sans">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-3xl border border-blue-300">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-800 mb-6">
                    #transformwithST Bonus Calculator
                </h1>

                {/* Display User ID if authenticated */}
                {user && (
                    <p className="text-sm text-gray-600 text-center mb-4">
                        User ID: <span className="font-mono bg-gray-100 p-1 rounded">{user.uid}</span>
                    </p>
                )}

                {/* Tab Navigation */}
                <div className="flex justify-center mb-6 border-b-2 border-blue-200">
                    <button
                        className={`py-3 px-6 text-lg font-semibold rounded-t-lg transition-colors duration-300 ${
                            activeTab === 'sharing' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                        onClick={() => setActiveTab('sharing')}
                    >
                        Sharing Bonus
                    </button>
                    <button
                        className={`py-3 px-6 text-lg font-semibold rounded-t-lg transition-colors duration-300 ${
                            activeTab === 'building' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        } ml-2`}
                        onClick={() => setActiveTab('building')}
                    >
                        Building Bonus
                    </button>
                    <button
                        className={`py-3 px-6 text-lg font-semibold rounded-t-lg transition-colors duration-300 ${
                            activeTab === 'leading' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        } ml-2`}
                        onClick={() => setActiveTab('leading')}
                    >
                        Leading Bonus
                    </button>
                </div>

                {/* --- Sharing Bonus Tab Content --- */}
                {activeTab === 'sharing' && (
                    <div>
                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h2 className="text-lg font-semibold text-blue-700 mb-3">
                                Add Products for Sharing Bonus Calculation:
                            </h2>
                            <div className="mb-4">
                                <label htmlFor="sharingCategory" className="block text-base font-medium text-gray-700 mb-1">
                                    Select Category:
                                </label>
                                <select
                                    id="sharingCategory"
                                    value={selectedSharingCategory}
                                    onChange={(e) => setSelectedSharingCategory(e.target.value)}
                                    className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
                                >
                                    <option value="">-- Select a Category --</option>
                                    {categories.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedSharingCategory && (
                                <div className="mb-4">
                                    <label htmlFor="sharingProduct" className="block text-base font-medium text-gray-700 mb-1">
                                        Select Product:
                                    </label>
                                    <select
                                        id="sharingProduct"
                                        value={selectedSharingProductCode}
                                        onChange={(e) => setSelectedSharingProductCode(e.target.value)}
                                        className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
                                    >
                                        <option value="">-- Select a Product --</option>
                                        {productsInSelectedCategory.map(product => (
                                            <option key={product.code} value={product.code}>
                                                {product.name} (Bonus: {formatIDR(product.sharingBonusPerUnit)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {selectedSharingProductCode && (
                                <div className="mb-4">
                                    <label htmlFor="sharingQuantity" className="block text-base font-medium text-gray-700 mb-1">
                                        Quantity:
                                    </label>
                                    <input
                                        type="number"
                                        id="sharingQuantity"
                                        value={sharingQuantity}
                                        onChange={(e) => handleSharingQuantityChange(e.target.value)}
                                        placeholder="e.g., 1, 2"
                                        className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
                                        min="1"
                                    />
                                </div>
                            )}

                            <button
                                onClick={addProductForSharing}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                Add Product
                            </button>
                        </div>

                        {addedSharingProducts.length > 0 && (
                            <div className="mb-6 bg-white p-4 rounded-lg shadow-inner border border-blue-200">
                                <h3 className="text-lg font-semibold text-blue-700 mb-3">Products Added:</h3>
                                <ul className="space-y-2">
                                    {addedSharingProducts.map((item, index) => (
                                        <li key={index} className="flex justify-between items-center p-2 bg-blue-100 rounded-md">
                                            <span className="text-gray-800">
                                                {item.name} x {item.quantity} ({formatIDR(item.totalBonus)})
                                            </span>
                                            <button
                                                onClick={() => removeProductForSharing(item.code)}
                                                className="ml-4 text-red-600 hover:text-red-800 transition-colors duration-200"
                                            >
                                                &times;
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button
                            onClick={calculateSharingBonus}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-75 text-xl"
                        >
                            Calculate Sharing Bonus
                        </button>

                        {errorMessage && activeTab === 'sharing' && (
                            <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center font-medium">
                                {errorMessage}
                            </div>
                        )}

                        {calculatedSharingBonus > 0 && activeTab === 'sharing' && (
                            <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-300 shadow-inner">
                                <h2 className="text-2xl sm:text-3xl font-bold text-center text-green-800 mb-4">
                                    Estimated Sharing Bonus:
                                </h2>
                                <p className="text-4xl sm:text-5xl font-extrabold text-center text-green-700 mb-6">
                                    {formatIDR(calculatedSharingBonus)}
                                </p>
                                <p className="text-sm text-gray-600 mt-4 mb-4 text-center">
                                    * This is an estimate. Actual payments may vary.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Building Bonus Tab Content --- */}
                {activeTab === 'building' && (
                    <div>
                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <label htmlFor="completedBlocks" className="block text-lg font-semibold text-blue-700 mb-2">
                                Blocks Already Completed This Month:
                            </label>
                            <input
                                type="number"
                                id="completedBlocks"
                                value={completedBlocksThisMonth}
                                onChange={(e) => setCompletedBlocksThisMonth(e.target.value)}
                                placeholder="e.g., 0, 2, 5"
                                className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-lg"
                                min="0"
                            />
                            <p className="text-sm text-blue-600 mt-1">
                                Enter the number of full Building Blocks you've already completed this calendar month.
                            </p>
                        </div>

                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h2 className="text-lg font-semibold text-blue-700 mb-3">
                                Choose Calculation Method:
                            </h2>
                            <div className="space-y-2">
                                <label className="flex items-center text-gray-800 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="buildingCalculationMethod"
                                        value="default"
                                        checked={buildingCalcMethod === 'default'}
                                        onChange={() => setBuildingCalcMethod('default')}
                                        className="form-radio h-5 w-5 text-blue-600"
                                    />
                                    <span className="ml-2 text-base">
                                        Use Default Rate (12,850 IDR per 1 PSV)
                                    </span>
                                </label>
                                <label className="flex items-center text-gray-800 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="buildingCalculationMethod"
                                        value="products"
                                        checked={buildingCalcMethod === 'products'}
                                        onChange={() => setBuildingCalcMethod('products')}
                                        className="form-radio h-5 w-5 text-blue-600"
                                    />
                                    <span className="ml-2 text-base">
                                        Use Added Products (from Sharing Bonus tab)
                                    </span>
                                </label>
                                <label className="flex items-center text-gray-800 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="buildingCalculationMethod"
                                        value="direct_csv"
                                        checked={buildingCalcMethod === 'direct_csv'}
                                        onChange={() => setBuildingCalcMethod('direct_csv')}
                                        className="form-radio h-5 w-5 text-blue-600"
                                    />
                                    <span className="ml-2 text-base">
                                        Directly Input Total PSV and CSV
                                    </span>
                                </label>
                            </div>
                        </div>

                        {buildingCalcMethod === 'default' && (
                            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <label htmlFor="buildingPsvInputDefault" className="block text-lg font-semibold text-blue-700 mb-2">
                                    Total Sales Volume (PSV) for this period:
                                </label>
                                <input
                                    type="number"
                                    id="buildingPsvInputDefault"
                                    value={buildingPsvInput}
                                    onChange={(e) => setBuildingPsvInput(e.target.value)}
                                    placeholder="e.g., 1250"
                                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-lg"
                                    min="0"
                                />
                            </div>
                        )}

                        {buildingCalcMethod === 'products' && (
                            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <h3 className="text-lg font-semibold text-blue-700 mb-3">
                                    Products for Building Bonus (from Sharing Bonus tab):
                                </h3>
                                {addedSharingProducts.length > 0 ? (
                                    <ul className="space-y-2">
                                        {addedSharingProducts.map((item, index) => {
                                            // Find the full product data to get PSV and CSV per unit
                                            let fullProductInfo = null;
                                            for (const categoryKey in productData) {
                                                const found = productData[categoryKey].find(p => p.code === item.code);
                                                if (found) {
                                                    fullProductInfo = found;
                                                    break;
                                                }
                                            }
                                            const itemPsv = fullProductInfo ? item.quantity * fullProductInfo.psvPerUnit : 'N/A';
                                            const itemCsv = fullProductInfo ? item.quantity * fullProductInfo.csvPerUnit : 'N/A';

                                            return (
                                                <li key={index} className="p-2 bg-blue-100 rounded-md text-gray-800">
                                                    {item.name} x {item.quantity} (PSV: {itemPsv}, CSV: {typeof itemCsv === 'number' ? formatIDR(itemCsv) : itemCsv})
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="text-gray-600">No products added. Please add products in the Sharing Bonus tab first.</p>
                                )}
                            </div>
                        )}

                        {buildingCalcMethod === 'direct_csv' && (
                            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <div className="mb-4">
                                    <label htmlFor="buildingPsvInputDirect" className="block text-lg font-semibold text-blue-700 mb-2">
                                        Total Sales Volume (PSV) for this period:
                                    </label>
                                    <input
                                        type="number"
                                        id="buildingPsvInputDirect"
                                        value={buildingPsvInput}
                                        onChange={(e) => setBuildingPsvInput(e.target.value)}
                                        placeholder="e.g., 1250"
                                        className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-lg"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="buildingCsvInputDirect" className="block text-lg font-semibold text-blue-700 mb-2">
                                        Total Commissionable Sales Value (CSV) for this period (IDR):
                                    </label>
                                    <input
                                        type="number"
                                        id="buildingCsvInputDirect"
                                        value={buildingCsvInput}
                                        onChange={(e) => setBuildingCsvInput(e.target.value)}
                                        placeholder="e.g., 15000000"
                                        className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-lg"
                                        min="0"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={calculateBuildingBonus}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-75 text-xl"
                        >
                            Calculate Building Bonus
                        </button>

                        {errorMessage && activeTab === 'building' && (
                            <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center font-medium">
                                {errorMessage}
                            </div>
                        )}

                        {calculatedBuildingCommission > 0 && activeTab === 'building' && (
                            <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-300 shadow-inner">
                                <h2 className="text-2xl sm:text-3xl font-bold text-center text-green-800 mb-4">
                                    Estimated Building Bonus:
                                </h2>
                                <p className="text-4xl sm:text-5xl font-extrabold text-center text-green-700 mb-6">
                                    {formatIDR(calculatedBuildingCommission)}
                                </p>

                                <p className="text-sm text-gray-600 mt-4 mb-4 text-center">
                                    * This is an estimate. Actual payments may be lower based on various factors including returns, product mix, exchange rates, changes to price, etc., as per Nu Skin's official disclaimer.
                                </p>

                                <h3 className="text-xl font-semibold text-green-700 mb-3">
                                    Calculation Details:
                                </h3>
                                <div className="space-y-3">
                                    {buildingCalculationDetails.map((detail, index) => (
                                        <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
                                            <p className="font-semibold text-gray-900">
                                                {detail.type === 'Full Block' ? `Block ${detail.blockNumber}` : `Incomplete Block (PSV: ${detail.psv})`}
                                            </p>
                                            <p className="text-gray-700">
                                                PSV: {detail.psv} | CSV: {formatIDR(detail.csv)}
                                            </p>
                                            <p className="text-gray-700">
                                                Rate: {detail.rate}%
                                            </p>
                                            <p className="text-green-600 font-bold">
                                                Commission: {formatIDR(detail.commission)}
                                            </p>
                                            {detail.note && <p className="text-sm text-gray-500 mt-1">{detail.note}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Leading Bonus Tab Content --- */}
                {activeTab === 'leading' && (
                    <div>
                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <label htmlFor="totalLtsv" className="block text-lg font-semibold text-blue-700 mb-2">
                                Total Leadership Team Sales Volume (LTSV) for the month:
                            </label>
                            <input
                                type="number"
                                id="totalLtsv"
                                value={totalLtsvInput}
                                onChange={(e) => setTotalLtsvInput(e.target.value)}
                                placeholder="e.g., 5000, 10000"
                                className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-lg"
                                min="0"
                            />
                            <p className="text-sm text-blue-600 mt-1">
                                Enter the total Sales Volume generated by your Leadership Team (G1-G6).
                            </p>
                        </div>

                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <label htmlFor="userTotalBlocksForLeading" className="block text-lg font-semibold text-blue-700 mb-2">
                                Your Total Completed Building Blocks This Month:
                            </label>
                            <input
                                type="number"
                                id="userTotalBlocksForLeading"
                                value={userTotalBlocksForLeading}
                                onChange={(e) => setUserTotalBlocksForLeading(e.target.value)}
                                placeholder="e.g., 4, 6, 8"
                                className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-lg"
                                min="0"
                            />
                            <p className="text-sm text-blue-600 mt-1">
                                This determines your Leading Bonus percentage (2.5% for 4-5 blocks, 5% for 6+ blocks).
                            </p>
                        </div>

                        <button
                            onClick={calculateLeadingBonus}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-75 text-xl"
                        >
                            Calculate Leading Bonus
                        </button>

                        {errorMessage && activeTab === 'leading' && (
                            <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center font-medium">
                                {errorMessage}
                            </div>
                        )}

                        {(calculatedLeadingBonus > 0 || leadingBonusDetails) && activeTab === 'leading' && (
                            <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-300 shadow-inner">
                                <h2 className="text-2xl sm:text-3xl font-bold text-center text-green-800 mb-4">
                                    Estimated Leading Bonus:
                                </h2>
                                <p className="text-4xl sm:text-5xl font-extrabold text-center text-green-700 mb-6">
                                    {formatIDR(calculatedLeadingBonus)}
                                </p>
                                {leadingBonusDetails && (
                                    <p className="text-md text-gray-700 text-center mb-4">
                                        {leadingBonusDetails}
                                    </p>
                                )}
                                <p className="text-sm text-gray-600 mt-4 mb-4 text-center">
                                    * This is an estimate. Actual payments may vary.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;

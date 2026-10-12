// Minimal i18n. All UI strings live here in en/te/hi. Scientific numbers are
// never translated — only their labels. Crop names are returned raw and can
// be looked up in CROP_NAMES.
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Lang = "en" | "te" | "hi";
const KEY = "aquacrop.lang.v1";

type Dict = Record<string, string>;

const en: Dict = {
  app_name: "AquaCrop AI",
  tagline: "Groundwater-Aware Crop Advisory",
  choose_language: "Choose your language",
  continue: "Continue",
  english: "English",
  telugu: "Telugu",
  hindi: "Hindi",
  home: "Home",
  crops: "Crops",
  compare: "Compare",
  settings: "Settings",
  location: "Location",
  state: "State",
  district: "District",
  area: "Area",
  weather: "Weather",
  temperature: "Temperature",
  humidity: "Humidity",
  rainfall: "Rainfall",
  low: "Low", moderate: "Moderate", high: "High",
  soil: "Soil (NPK)",
  nitrogen: "Nitrogen",
  phosphorus: "Phosphorus",
  potassium: "Potassium",
  groundwater: "Groundwater",
  status: "Status",
  current_level: "Current Level",
  depleting: "Depleting",
  stable: "Stable",
  improving: "Improving",
  top_crop: "Top Recommended Crop",
  view_all_crops: "View All Crops",
  view_invoice: "View Farmer Invoice",
  view_comparison: "With vs Without Groundwater",
  recommended_crops: "Recommended Crops",
  suitability: "Suitability",
  water_demand: "Water Demand",
  groundwater_risk: "Groundwater Risk",
  ml_confidence: "ML Confidence",
  why_this_crop: "Why this crop?",
  voice_read: "Voice Read Recommendation",
  stop: "Stop",
  advisory_invoice: "Crop Recommendation Advisory",
  advisory_note: "This is a farming advisory, NOT a bill or tax invoice.",
  generate_pdf: "Download / Share PDF",
  date: "Date",
  farmer: "Farmer",
  selected_crop: "Selected Crop",
  weather_summary: "Weather",
  ml_score: "ML Score",
  recommendation_reason: "Recommendation Reason",
  change_language: "Change Language",
  voice_readout: "Voice Read-out",
  data_sources: "Data Sources",
  about_methodology: "About / Methodology",
  version: "Version",
  ml_performance: "ML Performance",
  feature_importance: "Feature Importance",
  requesting_location: "Detecting your location...",
  loading_weather: "Fetching live weather...",
  loading_recommendation: "Running AI/ML models...",
  location_denied: "Location permission denied. Using demo location: Telangana, Adilabad.",
  location_error: "Could not detect location. Using demo location.",
  network_error: "Network error. Please retry.",
  retry: "Retry",
  compare_title: "Groundwater Impact Comparison",
  without_groundwater: "Without Groundwater",
  with_groundwater: "With Groundwater",
  rank_change: "Rank Change",
  groundwater_trend: "Groundwater Trend (2021-2023)",
  reason_suitable_soil_weather: "Soil and weather conditions match this crop.",
  reason_low_water_demand: "This crop needs less water — safer for groundwater.",
  reason_balanced_water_demand: "Balanced water demand.",
  reason_low_groundwater_risk: "Low groundwater risk in your area.",
  reason_strong_ml_prediction: "Both Random Forest and XGBoost strongly rank this crop.",
  reason_sustainable_for_depleting_gw: "Sustainable choice while groundwater is depleting.",
  reason_balanced_overall_score: "Balanced overall score across all factors.",
  comparison_explanation_intro: "Traditional advice ranks",
  comparison_explanation_first: "first (soil and weather only).",
  comparison_explanation_gw: "Considering groundwater",
  comparison_explanation_moves: "the top crop becomes",
  comparison_explanation_because: "because it is more sustainable for the water condition detected.",
  mbgl: "metres below ground level",
  data_sources_body:
    "Soil NPK: District-level dataset (final_npk.csv). Groundwater: Historical GWL_Cleaned.csv (2021-2023, Telangana). Crops: crop_scores dataset. Weather: Open-Meteo API. Location: OpenStreetMap Nominatim.",
  methodology_body:
    "Combines Random Forest and XGBoost models trained on the crop suitability scores. Final score = 0.35 × Suitability + 0.35 × ML Ensemble + 0.30 × Groundwater Sustainability. In the WITHOUT-groundwater comparison the sustainability term is dropped so judges can see the difference the groundwater signal makes.",
  disclaimer: "For demonstration only. Combine with local expert advice.",
  no_data: "No data available",
  farmer_advisory: "Farmer Advisory",
  suitability_score: "Suitability Score",
  reference_data_note: "Reference data: Telangana averages (dataset scope).",
  nearest_reference: "Nearest reference",
  pin_this_farm: "Pin this farm",
  farm_pinned: "Farm saved · skips GPS next launch",
  unpin_farm: "Unpin farm",
  saved_farm: "Saved farm",
  no_saved_farm: "No farm pinned",
  demo_mode: "DEMO",
  demo_mode_row: "Judge Demo Mode",
  demo_mode_hint: "Cycle preset districts (also: long-press the AquaCrop AI title on Home).",
  demo_next: "Next preset",
  demo_exit: "Exit demo",
  longpress_hint: "Tip: long-press \"AquaCrop AI\" above to demo other districts.",
  rainfall_7day: "Last 7 days rainfall (mm)",
  voice_read_all: "Voice Read Dashboard",
  voice_read_all_crops: "Read all 5 crops",
  reading: "Reading",
  rain_forecast: "Next 7 days forecast (mm)",
  farm_and_reference: "Your farm & nearest reference",
  farm_label: "Farm",
};

const te: Dict = {
  app_name: "అక్వాక్రాప్ AI",
  tagline: "భూగర్భజల ఆధారిత పంట సలహా",
  choose_language: "మీ భాషను ఎంచుకోండి",
  continue: "కొనసాగించండి",
  english: "English", telugu: "తెలుగు", hindi: "हिंदी",
  home: "హోమ్", crops: "పంటలు", compare: "పోల్చండి", settings: "సెట్టింగ్స్",
  location: "స్థానం", state: "రాష్ట్రం", district: "జిల్లా", area: "ప్రాంతం",
  weather: "వాతావరణం", temperature: "ఉష్ణోగ్రత", humidity: "ఆర్ద్రత", rainfall: "వర్షపాతం",
  low: "తక్కువ", moderate: "మధ్యస్థం", high: "ఎక్కువ",
  soil: "నేల (NPK)", nitrogen: "నత్రజని", phosphorus: "భాస్వరం", potassium: "పొటాషియం",
  groundwater: "భూగర్భజలం", status: "స్థితి", current_level: "ప్రస్తుత స్థాయి",
  depleting: "క్షీణిస్తోంది", stable: "స్థిరం", improving: "మెరుగవుతోంది",
  top_crop: "అత్యుత్తమ పంట", view_all_crops: "అన్ని పంటలు",
  view_invoice: "రైతు సలహా చూడండి", view_comparison: "భూగర్భజలంతో vs లేకుండా",
  recommended_crops: "సిఫార్సు చేయబడిన పంటలు", suitability: "అనుకూలత",
  water_demand: "నీటి అవసరం", groundwater_risk: "భూగర్భజల ప్రమాదం",
  ml_confidence: "ML విశ్వాసం", why_this_crop: "ఈ పంట ఎందుకు?",
  voice_read: "సలహాను వినండి", stop: "ఆపండి",
  advisory_invoice: "పంట సలహా పత్రం",
  advisory_note: "ఇది వ్యవసాయ సలహా పత్రం మాత్రమే — బిల్లు కాదు.",
  generate_pdf: "PDF డౌన్‌లోడ్ / షేర్",
  date: "తేదీ", farmer: "రైతు", selected_crop: "ఎంచుకున్న పంట",
  weather_summary: "వాతావరణం", ml_score: "ML స్కోర్", recommendation_reason: "కారణం",
  change_language: "భాష మార్చండి", voice_readout: "వాయిస్ రీడ్‌అవుట్",
  data_sources: "డేటా మూలాలు", about_methodology: "గురించి / పద్ధతి",
  version: "వెర్షన్", ml_performance: "ML పనితీరు", feature_importance: "ఫీచర్ ప్రాముఖ్యత",
  requesting_location: "మీ స్థానాన్ని కనుగొంటున్నాము...",
  loading_weather: "ప్రత్యక్ష వాతావరణం తీసుకుంటున్నాము...",
  loading_recommendation: "AI/ML మోడల్‌లు నడుస్తున్నాయి...",
  location_denied: "అనుమతి నిరాకరించబడింది. డెమో స్థానం: తెలంగాణ, ఆదిలాబాద్.",
  location_error: "స్థానం కనుగొనబడలేదు. డెమో స్థానం ఉపయోగిస్తున్నాము.",
  network_error: "నెట్‌వర్క్ లోపం. మళ్లీ ప్రయత్నించండి.", retry: "మళ్లీ ప్రయత్నించండి",
  compare_title: "భూగర్భజల ప్రభావ పోలిక",
  without_groundwater: "భూగర్భజలం లేకుండా", with_groundwater: "భూగర్భజలంతో",
  rank_change: "ర్యాంక్ మార్పు",
  groundwater_trend: "భూగర్భజల ధోరణి (2021-2023)",
  reason_suitable_soil_weather: "నేల మరియు వాతావరణం ఈ పంటకు అనుకూలం.",
  reason_low_water_demand: "ఈ పంటకు తక్కువ నీరు కావాలి — భూగర్భజలానికి సురక్షితం.",
  reason_balanced_water_demand: "మధ్యస్థ నీటి అవసరం.",
  reason_low_groundwater_risk: "మీ ప్రాంతంలో తక్కువ ప్రమాదం.",
  reason_strong_ml_prediction: "Random Forest మరియు XGBoost రెండూ దీనిని బలంగా సిఫార్సు చేస్తాయి.",
  reason_sustainable_for_depleting_gw: "భూగర్భజలం క్షీణిస్తున్నప్పుడు స్థిరమైన ఎంపిక.",
  reason_balanced_overall_score: "అన్ని కారకాలలో సమతుల్య స్కోర్.",
  comparison_explanation_intro: "సంప్రదాయ సలహా ప్రకారం",
  comparison_explanation_first: "మొదట (కేవలం నేల/వాతావరణం).",
  comparison_explanation_gw: "భూగర్భజలాన్ని పరిగణించినప్పుడు",
  comparison_explanation_moves: "అత్యుత్తమ పంట మారుతుంది —",
  comparison_explanation_because: "ఎందుకంటే ఇది నీటి పరిస్థితికి మరింత స్థిరమైనది.",
  mbgl: "మీటర్లు భూ ఉపరితలం క్రింద",
  data_sources_body: "నేల NPK, భూగర్భజల చరిత్ర (2021-2023, తెలంగాణ), పంట స్కోర్‌లు, Open-Meteo వాతావరణం, OpenStreetMap స్థానం.",
  methodology_body: "Random Forest + XGBoost నమూనాలు. తుది స్కోర్ = 0.35×అనుకూలత + 0.35×ML + 0.30×భూగర్భజల స్థిరత్వం.",
  disclaimer: "ప్రదర్శన కోసం మాత్రమే. స్థానిక నిపుణుల సలహా తీసుకోండి.",
  no_data: "డేటా అందుబాటులో లేదు", farmer_advisory: "రైతు సలహా",
  suitability_score: "అనుకూలత స్కోర్",
  reference_data_note: "సూచన డేటా: తెలంగాణ సగటులు (డేటాసెట్ పరిధి).",
  nearest_reference: "సమీప సూచన",
  pin_this_farm: "ఈ పొలాన్ని పిన్ చేయండి",
  farm_pinned: "పొలం సేవ్ చేయబడింది · తదుపరిసారి GPS దాటవేస్తుంది",
  unpin_farm: "పొలం తీసివేయండి",
  saved_farm: "సేవ్ చేసిన పొలం",
  no_saved_farm: "పొలం పిన్ చేయబడలేదు",
  demo_mode: "డెమో",
  demo_mode_row: "జడ్జి డెమో మోడ్",
  demo_mode_hint: "ప్రీసెట్ జిల్లాలను చక్రం. (హోమ్‌లో టైటిల్‌ను ఎక్కువసేపు నొక్కండి.)",
  demo_next: "తదుపరి ప్రీసెట్",
  demo_exit: "డెమో నుండి బయటకు",
  longpress_hint: "చిట్కా: ఇతర జిల్లాలను చూపడానికి పైన \"AquaCrop AI\" ను ఎక్కువసేపు నొక్కండి.",
  rainfall_7day: "గత 7 రోజుల వర్షపాతం (mm)",
  voice_read_all: "డాష్‌బోర్డ్ చదవండి",
  voice_read_all_crops: "అన్ని 5 పంటలు చదవండి",
  reading: "చదువుతోంది",
  rain_forecast: "తదుపరి 7 రోజుల అంచనా (mm)",
  farm_and_reference: "మీ పొలం & సమీప సూచన",
  farm_label: "పొలం",
};

const hi: Dict = {
  app_name: "एक्वाक्रॉप AI",
  tagline: "भूजल-आधारित फसल सलाह",
  choose_language: "अपनी भाषा चुनें", continue: "आगे बढ़ें",
  english: "English", telugu: "తెలుగు", hindi: "हिंदी",
  home: "होम", crops: "फसलें", compare: "तुलना", settings: "सेटिंग्स",
  location: "स्थान", state: "राज्य", district: "ज़िला", area: "क्षेत्र",
  weather: "मौसम", temperature: "तापमान", humidity: "आर्द्रता", rainfall: "वर्षा",
  low: "कम", moderate: "मध्यम", high: "अधिक",
  soil: "मिट्टी (NPK)", nitrogen: "नाइट्रोजन", phosphorus: "फ़ॉस्फ़ोरस", potassium: "पोटैशियम",
  groundwater: "भूजल", status: "स्थिति", current_level: "मौजूदा स्तर",
  depleting: "घट रहा है", stable: "स्थिर", improving: "बढ़ रहा है",
  top_crop: "सर्वश्रेष्ठ फसल", view_all_crops: "सभी फसलें",
  view_invoice: "किसान सलाह देखें", view_comparison: "भूजल के साथ बनाम बिना",
  recommended_crops: "अनुशंसित फसलें", suitability: "अनुकूलता",
  water_demand: "पानी की माँग", groundwater_risk: "भूजल जोखिम",
  ml_confidence: "ML विश्वास", why_this_crop: "यह फसल क्यों?",
  voice_read: "सलाह सुनें", stop: "रोकें",
  advisory_invoice: "फसल सलाह पत्र",
  advisory_note: "यह एक कृषि सलाह है — बिल या कर चालान नहीं।",
  generate_pdf: "PDF डाउनलोड / शेयर",
  date: "तारीख", farmer: "किसान", selected_crop: "चुनी हुई फसल",
  weather_summary: "मौसम", ml_score: "ML स्कोर", recommendation_reason: "कारण",
  change_language: "भाषा बदलें", voice_readout: "आवाज़ पढ़ना",
  data_sources: "डेटा स्रोत", about_methodology: "जानकारी / पद्धति",
  version: "वर्शन", ml_performance: "ML प्रदर्शन", feature_importance: "फीचर महत्व",
  requesting_location: "आपका स्थान पता कर रहे हैं...",
  loading_weather: "लाइव मौसम ला रहे हैं...",
  loading_recommendation: "AI/ML मॉडल चला रहे हैं...",
  location_denied: "अनुमति नहीं मिली। डेमो स्थान: तेलंगाना, आदिलाबाद।",
  location_error: "स्थान नहीं मिला। डेमो स्थान का उपयोग हो रहा है।",
  network_error: "नेटवर्क त्रुटि। फिर से प्रयास करें।", retry: "पुनः प्रयास",
  compare_title: "भूजल प्रभाव तुलना",
  without_groundwater: "भूजल के बिना", with_groundwater: "भूजल के साथ",
  rank_change: "रैंक बदलाव",
  groundwater_trend: "भूजल रुझान (2021-2023)",
  reason_suitable_soil_weather: "मिट्टी और मौसम इस फसल के लिए उपयुक्त हैं।",
  reason_low_water_demand: "इस फसल को कम पानी चाहिए — भूजल के लिए सुरक्षित।",
  reason_balanced_water_demand: "मध्यम पानी की माँग।",
  reason_low_groundwater_risk: "आपके क्षेत्र में जोखिम कम है।",
  reason_strong_ml_prediction: "Random Forest और XGBoost दोनों इसे मज़बूती से चुनते हैं।",
  reason_sustainable_for_depleting_gw: "भूजल घटते समय टिकाऊ विकल्प।",
  reason_balanced_overall_score: "सभी कारकों में संतुलित स्कोर।",
  comparison_explanation_intro: "पारंपरिक सलाह में",
  comparison_explanation_first: "पहले स्थान पर है (केवल मिट्टी/मौसम)।",
  comparison_explanation_gw: "भूजल पर विचार करते ही",
  comparison_explanation_moves: "सर्वश्रेष्ठ फसल बदल जाती है —",
  comparison_explanation_because: "क्योंकि यह पानी की स्थिति के लिए अधिक टिकाऊ है।",
  mbgl: "मीटर भूमि सतह से नीचे",
  data_sources_body: "मिट्टी NPK, भूजल इतिहास (2021-2023, तेलंगाना), फसल स्कोर, Open-Meteo मौसम, OpenStreetMap स्थान।",
  methodology_body: "Random Forest + XGBoost मॉडल। अंतिम स्कोर = 0.35×अनुकूलता + 0.35×ML + 0.30×भूजल स्थिरता।",
  disclaimer: "केवल प्रदर्शन के लिए। स्थानीय विशेषज्ञ की सलाह लें।",
  no_data: "कोई डेटा नहीं", farmer_advisory: "किसान सलाह",
  suitability_score: "अनुकूलता स्कोर",
  reference_data_note: "संदर्भ डेटा: तेलंगाना औसत (डेटासेट क्षेत्र)।",
  nearest_reference: "निकटतम संदर्भ",
  pin_this_farm: "यह खेत पिन करें",
  farm_pinned: "खेत सहेजा गया · अगली बार GPS छोड़ेगा",
  unpin_farm: "खेत हटाएँ",
  saved_farm: "सहेजा हुआ खेत",
  no_saved_farm: "कोई खेत पिन नहीं",
  demo_mode: "डेमो",
  demo_mode_row: "जज डेमो मोड",
  demo_mode_hint: "प्रीसेट ज़िले बदलें (होम पर टाइटल पर लंबा दबाएँ)।",
  demo_next: "अगला प्रीसेट",
  demo_exit: "डेमो से बाहर",
  longpress_hint: "टिप: दूसरे ज़िले देखने के लिए ऊपर \"AquaCrop AI\" पर लंबा दबाएँ।",
  rainfall_7day: "पिछले 7 दिन की वर्षा (mm)",
  voice_read_all: "पूरा डैशबोर्ड सुनें",
  voice_read_all_crops: "सभी 5 फसलें सुनें",
  reading: "पढ़ रहे",
  rain_forecast: "अगले 7 दिनों का पूर्वानुमान (mm)",
  farm_and_reference: "आपका खेत और निकटतम संदर्भ",
  farm_label: "खेत",
};

export const DICTS: Record<Lang, Dict> = { en, te, hi };

// Localized crop names (fallback to English).
export const CROP_NAMES: Record<Lang, Record<string, string>> = {
  en: {},
  te: {
    apple: "యాపిల్", banana: "అరటి", blackgram: "మినుములు", chickpea: "శనగ",
    coconut: "కొబ్బరి", coffee: "కాఫీ", cotton: "పత్తి", grapes: "ద్రాక్ష",
    jute: "జనుము", kidneybeans: "రాజ్మా", lentil: "మసూర్", maize: "మొక్కజొన్న",
    mango: "మామిడి", mothbeans: "మఠ్‌బీన్", mungbean: "పెసర", muskmelon: "కర్భూజ",
    orange: "నారింజ", papaya: "బొప్పాయి", pigeonpeas: "కందులు", pomegranate: "దానిమ్మ",
    rice: "వరి", watermelon: "పుచ్చకాయ",
  },
  hi: {
    apple: "सेब", banana: "केला", blackgram: "उड़द", chickpea: "चना",
    coconut: "नारियल", coffee: "कॉफी", cotton: "कपास", grapes: "अंगूर",
    jute: "जूट", kidneybeans: "राजमा", lentil: "मसूर", maize: "मक्का",
    mango: "आम", mothbeans: "मोठ", mungbean: "मूँग", muskmelon: "खरबूजा",
    orange: "संतरा", papaya: "पपीता", pigeonpeas: "अरहर", pomegranate: "अनार",
    rice: "धान", watermelon: "तरबूज़",
  },
};

type Ctx = {
  lang: Lang | null;
  setLang: (l: Lang) => Promise<void>;
  t: (k: keyof typeof en) => string;
  cropName: (raw: string) => string;
};
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "en" || v === "te" || v === "hi") setLangState(v);
      setLoaded(true);
    });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    await AsyncStorage.setItem(KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (k: keyof typeof en) => {
      const dict = lang ? DICTS[lang] : en;
      return dict[k] ?? en[k] ?? String(k);
    },
    [lang],
  );

  const cropName = useCallback(
    (raw: string) => {
      if (!lang || lang === "en") return raw.charAt(0).toUpperCase() + raw.slice(1);
      return CROP_NAMES[lang][raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, cropName }), [lang, setLang, t, cropName]);

  if (!loaded) return null;
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}

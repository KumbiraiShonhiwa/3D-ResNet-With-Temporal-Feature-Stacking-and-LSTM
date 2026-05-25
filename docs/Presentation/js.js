const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "Explainable Fraud Detection in Healthcare Claims";

// Color palette: deep navy + teal + white + soft accent
const C = {
  navy:     "0D1B2A",
  teal:     "0E9AA7",
  tealDark: "0A7581",
  tealLight:"C8EEF2",
  white:    "FFFFFF",
  offWhite: "F4F9FA",
  grey:     "64748B",
  greyLight:"E2EBF0",
  text:     "1A2E3B",
  accent:   "F5A623",
  accentRed:"E05A5A",
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function darkSlide(s) { s.background = { color: C.navy }; }
function lightSlide(s) { s.background = { color: C.offWhite }; }

function slideTitle(s, text, y = 0.32, color = C.white, size = 30) {
  s.addText(text, {
    x: 0.5, y, w: 9, h: 0.65,
    fontSize: size, fontFace: "Calibri", bold: true,
    color, align: "left", margin: 0,
  });
}

function sectionTag(s, text, color = C.teal) {
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.18, w: 1.6, h: 0.28,
    fill: { color }, line: { color },
  });
  s.addText(text.toUpperCase(), {
    x: 0.5, y: 0.18, w: 1.6, h: 0.28,
    fontSize: 9, fontFace: "Calibri", bold: true,
    color: C.white, align: "center", valign: "middle", margin: 0,
  });
}

function bullet(text, sub = false) {
  return {
    text,
    options: {
      bullet: true,
      indentLevel: sub ? 1 : 0,
      fontSize: sub ? 13 : 14.5,
      fontFace: "Calibri",
      color: C.text,
      breakLine: true,
      paraSpaceAfter: sub ? 3 : 6,
    },
  };
}

function statBox(s, x, y, w, h, num, label, bgColor = C.teal) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: bgColor }, line: { color: bgColor },
    shadow: { type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.2 },
  });
  s.addText(num, {
    x, y: y + 0.08, w, h: h * 0.55,
    fontSize: 32, fontFace: "Calibri", bold: true,
    color: C.white, align: "center", valign: "middle", margin: 0,
  });
  s.addText(label, {
    x, y: y + h * 0.55, w, h: h * 0.45,
    fontSize: 11, fontFace: "Calibri",
    color: C.white, align: "center", valign: "top", margin: 0,
  });
}

function layerBox(s, x, y, w, h, num, title, desc, bg) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: bg }, line: { color: bg },
    shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.15 },
  });
  s.addText(num, {
    x, y: y + 0.05, w, h: 0.3,
    fontSize: 10, fontFace: "Calibri", bold: true,
    color: C.white, align: "center", margin: 0,
  });
  s.addText(title, {
    x, y: y + 0.32, w, h: 0.35,
    fontSize: 12, fontFace: "Calibri", bold: true,
    color: C.white, align: "center", margin: 0,
  });
  s.addText(desc, {
    x: x + 0.05, y: y + 0.68, w: w - 0.1, h: h - 0.75,
    fontSize: 10, fontFace: "Calibri",
    color: C.white, align: "center", valign: "top", margin: 0,
  });
}

function card(s, x, y, w, h, title, body, titleColor = C.teal) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
    shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.1 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w: w, h: 0.06, fill: { color: titleColor }, line: { color: titleColor },
  });
  s.addText(title, {
    x: x + 0.1, y: y + 0.1, w: w - 0.2, h: 0.3,
    fontSize: 12, fontFace: "Calibri", bold: true, color: titleColor, margin: 0,
  });
  s.addText(body, {
    x: x + 0.1, y: y + 0.42, w: w - 0.2, h: h - 0.5,
    fontSize: 12, fontFace: "Calibri", color: C.text, valign: "top", margin: 0,
  });
}

// ─── SLIDE 1 – TITLE ────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkSlide(s);

  // Teal accent band left
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
  });

  s.addText("Explainable Fraud Detection\nin Healthcare Claims", {
    x: 0.45, y: 0.85, w: 7.2, h: 1.6,
    fontSize: 34, fontFace: "Calibri", bold: true,
    color: C.white, align: "left", margin: 0,
  });
  s.addText("with Tabular Diffusion and Transformer Models", {
    x: 0.45, y: 2.5, w: 7.2, h: 0.5,
    fontSize: 18, fontFace: "Calibri",
    color: C.tealLight, align: "left", margin: 0,
  });

  // Divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: 3.1, w: 6, h: 0.04, fill: { color: C.teal }, line: { color: C.teal },
  });

  s.addText([
    { text: "Kumbirai Shonhiwa", options: { bold: true, breakLine: true } },
    { text: "BSc (Hons) Computer Systems Engineering  |  University of Sunderland" },
  ], {
    x: 0.45, y: 3.25, w: 7, h: 0.8,
    fontSize: 14, fontFace: "Calibri", color: C.greyLight,
    align: "left", margin: 0,
  });

  s.addText("CET3006 Research Paper", {
    x: 0.45, y: 4.8, w: 6, h: 0.35,
    fontSize: 12, fontFace: "Calibri", color: C.grey,
    align: "left", margin: 0,
  });
}

// ─── SLIDE 2 – OVERVIEW ─────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Overview");
  slideTitle(s, "Presentation Overview", 0.32, C.text, 28);

  const items = [
    ["1", "Problem Context", "Healthcare fraud costs $600–850B/yr; three critical operational gaps"],
    ["2", "Literature Review", "Tabular deep learning, diffusion models, transformer-based detection"],
    ["3", "Methodology", "Four-layer pipeline: Data prep → TabDDPM → TabNet → Explainability"],
    ["4", "Results", "AUC-ROC 0.99, macro F1 0.99, fraud recall 98%"],
    ["5", "Explainability", "SHAP vs LIME analysis and disagreement findings"],
    ["6", "Conclusions", "Contributions, limitations, and future work"],
  ];

  items.forEach(([num, title, desc], i) => {
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    const x = 0.5 + col * 4.75;
    const y = 1.15 + row * 1.32;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.4, h: 1.18,
      fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
      shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.42, h: 1.18, fill: { color: C.teal }, line: { color: C.teal },
    });
    s.addText(num, {
      x, y, w: 0.42, h: 1.18,
      fontSize: 18, fontFace: "Calibri", bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(title, {
      x: x + 0.48, y: y + 0.1, w: 3.82, h: 0.32,
      fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
    });
    s.addText(desc, {
      x: x + 0.48, y: y + 0.42, w: 3.82, h: 0.66,
      fontSize: 11.5, fontFace: "Calibri", color: C.grey, valign: "top", margin: 0,
    });
  });
}

// ─── SLIDE 3 – PROBLEM CONTEXT ──────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkSlide(s);
  sectionTag(s, "Problem");
  slideTitle(s, "The Healthcare Fraud Crisis", 0.32, C.white, 28);

  // Stats row
  statBox(s, 0.5,  1.05, 2.8, 1.4, "$600–850B",  "Annual fraud losses\n(U.S. alone)",  C.tealDark);
  statBox(s, 3.6,  1.05, 2.8, 1.4, "25–35%",     "Claim denial rate\ndue to fraud",   "1D3557");
  statBox(s, 6.7,  1.05, 2.8, 1.4, "~1%",        "Fraud minority class\nin datasets", "0A3D47");

  s.addText("Three Critical Operational Bottlenecks", {
    x: 0.5, y: 2.72, w: 9, h: 0.32,
    fontSize: 14, fontFace: "Calibri", bold: true, color: C.tealLight, margin: 0,
  });

  const bottlenecks = [
    ["Class Imbalance", "Fraudulent claims are rare 'edge cases', causing severe model bias toward majority (legitimate) class"],
    ["Black-Box Dilemma", "Neural networks lack transparency to legally justify claim denials under HIPAA / GDPR obligations"],
    ["Data Privacy", "Strict regulations prevent data centralisation, creating data silos that limit model generalisation"],
  ];

  bottlenecks.forEach(([title, desc], i) => {
    const x = 0.5 + i * 3.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.1, w: 2.9, h: 2.1,
      fill: { color: "132030" }, line: { color: C.teal, pt: 1 },
      shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.2 },
    });
    s.addText(title, {
      x: x + 0.1, y: 3.18, w: 2.7, h: 0.32,
      fontSize: 12, fontFace: "Calibri", bold: true, color: C.teal, margin: 0,
    });
    s.addText(desc, {
      x: x + 0.1, y: 3.52, w: 2.7, h: 1.55,
      fontSize: 11.5, fontFace: "Calibri", color: C.greyLight, valign: "top", margin: 0,
    });
  });
}

// ─── SLIDE 4 – LITERATURE REVIEW ─────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Literature");
  slideTitle(s, "Key Literature Findings", 0.32, C.text, 28);

  const cols = [
    {
      title: "Tabular Deep Learning",
      points: [
        "GBDTs remain dominant on tabular data (Gorishniy et al., 2023)",
        "TabNet uses sequential attention for instance-wise feature selection (Arik & Pfister, 2020)",
        "No universally superior solution between DL and GBDTs exists",
      ],
    },
    {
      title: "Synthetic Data Generation",
      points: [
        "Diffusion models (TabDDPM) outperform GANs and VAEs on tabular fidelity (Kotelnikov et al., 2023)",
        "SMOTE causes privacy leakage via low Distance to Closest Record",
        "TabDDPM uses Gaussian + multinomial diffusion for mixed data types",
      ],
    },
    {
      title: "Fraud Detection",
      points: [
        "Transformer anomaly detection captures long-range dependencies (Aparna et al., 2025)",
        "Static percentile thresholds cause false positives/negatives",
        "Gap remains: no system combining interpretability + class imbalance resolution",
      ],
    },
  ];

  cols.forEach(({ title, points }, i) => {
    const x = 0.42 + i * 3.1;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.1, w: 2.88, h: 4.1,
      fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
      shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.1, w: 2.88, h: 0.42, fill: { color: C.teal }, line: { color: C.teal },
    });
    s.addText(title, {
      x: x + 0.1, y: 1.12, w: 2.68, h: 0.38,
      fontSize: 12.5, fontFace: "Calibri", bold: true, color: C.white,
      valign: "middle", margin: 0,
    });
    const bulletItems = points.map((p, pi) => ({
      text: p,
      options: {
        bullet: true,
        fontSize: 12,
        fontFace: "Calibri",
        color: C.text,
        breakLine: pi < points.length - 1,
        paraSpaceAfter: 8,
      },
    }));
    s.addText(bulletItems, {
      x: x + 0.1, y: 1.62, w: 2.68, h: 3.4, valign: "top", margin: 0,
    });
  });
}

// ─── SLIDE 5 – SYSTEM ARCHITECTURE ──────────────────────────────────────────
{
  const s = pres.addSlide();
  darkSlide(s);
  sectionTag(s, "Architecture");
  slideTitle(s, "Four-Layer Pipeline Architecture", 0.32, C.white, 28);

  const layers = [
    { num: "L1", title: "Data Preparation", desc: "Schema validation\nClass-stratified split\nFeature encoding", bg: "1D4E89" },
    { num: "L2", title: "TabDDPM Synthesis", desc: "Gaussian diffusion (numerical)\nMultinomial diffusion (categorical)\n4,066 synthetic fraud samples", bg: C.tealDark },
    { num: "L3", title: "TabNet Classifier", desc: "Sequential attention\nSoft feature selection\nAUC-ROC 0.99", bg: "1D3557" },
    { num: "L4", title: "Explainability", desc: "SHAP (global)\nLIME (local)\nHuman-readable audit report", bg: "2E4057" },
  ];

  layers.forEach((l, i) => {
    layerBox(s, 0.42 + i * 2.33, 1.08, 2.15, 3.0, l.num, l.title, l.desc, l.bg);
    if (i < 3) {
      // Arrow
      s.addShape(pres.shapes.LINE, {
        x: 0.42 + i * 2.33 + 2.15, y: 2.58, w: 0.18, h: 0,
        line: { color: C.teal, width: 2 },
      });
    }
  });

  // NHIS dataset label
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.42, y: 4.28, w: 9.16, h: 0.62,
    fill: { color: "0A1929" }, line: { color: C.teal, pt: 1 },
  });
  s.addText("Dataset: NHIS Healthcare Claims & Fraud  |  4,390 records  |  1% fraud minority class  |  8 features", {
    x: 0.42, y: 4.28, w: 9.16, h: 0.62,
    fontSize: 12, fontFace: "Calibri", color: C.tealLight,
    align: "center", valign: "middle", margin: 0,
  });
}

// ─── SLIDE 6 – DATA PREPARATION ─────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Layer 1");
  slideTitle(s, "Data Preparation Layer", 0.32, C.text, 28);

  // Left: subsystems
  const subsystems = [
    ["Data Loader", "Validates schema — feature names, data types, required columns. Prevents silent structural errors from propagating into encoding."],
    ["Data Splitter", "Stratified 70/15/15 train-validation-test split before encoding to prevent data leakage. Preserves 1% fraud ratio across all partitions."],
    ["Feature Encoder", "Dual encoding: Gaussian quantile normalisation + integer indices for TabDDPM; minimal batch-norm encoding for TabNet."],
  ];

  subsystems.forEach(([title, desc], i) => {
    const y = 1.12 + i * 1.42;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.42, y, w: 5.5, h: 1.28,
      fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
      shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.42, y, w: 0.06, h: 1.28, fill: { color: C.teal }, line: { color: C.teal },
    });
    s.addText(title, {
      x: 0.58, y: y + 0.08, w: 5.2, h: 0.28,
      fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
    });
    s.addText(desc, {
      x: 0.58, y: y + 0.4, w: 5.2, h: 0.78,
      fontSize: 12, fontFace: "Calibri", color: C.text, valign: "top", margin: 0,
    });
  });

  // Right: dataset features
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.2, y: 1.12, w: 3.3, h: 4.1,
    fill: { color: C.navy }, line: { color: C.teal, pt: 1 },
    shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 },
  });
  s.addText("Dataset Features", {
    x: 6.2, y: 1.18, w: 3.3, h: 0.36,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.teal,
    align: "center", margin: 0,
  });

  const features = [
    ["Numerical", "Age, Amount Billed"],
    ["Categorical", "Gender, Diagnosis, Fraud Type"],
    ["Temporal", "Date of Encounter, Date of Discharge"],
    ["Identifier", "Patient ID (retained as fraud signal)"],
  ];
  features.forEach(([type, feat], i) => {
    s.addText(type, {
      x: 6.3, y: 1.62 + i * 0.82, w: 1.1, h: 0.25,
      fontSize: 10, fontFace: "Calibri", bold: true, color: C.tealLight, margin: 0,
    });
    s.addText(feat, {
      x: 6.3, y: 1.88 + i * 0.82, w: 3.1, h: 0.3,
      fontSize: 11.5, fontFace: "Calibri", color: C.white, margin: 0,
    });
  });
}

// ─── SLIDE 7 – TABDDPM ──────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Layer 2");
  slideTitle(s, "TabDDPM: Synthetic Data Generation", 0.32, C.text, 28);

  // Left explanation
  s.addText([
    { text: "Why Diffusion Models?\n", options: { bold: true, fontSize: 14, color: C.tealDark, breakLine: true } },
    ...["SMOTE produces alarmingly similar samples (low DCR) — privacy risk under GDPR",
       "TabDDPM generates genuinely novel records with higher Distance to Closest Record",
       "Gaussian diffusion for numerical features + multinomial diffusion for categorical",
       "MLP denoising backbone (512→1024→1024→1024→256 units), cosine noise schedule"].map((t, i, a) => ({
      text: t,
      options: { bullet: true, fontSize: 12.5, fontFace: "Calibri", color: C.text, breakLine: i < a.length - 1, paraSpaceAfter: 6 },
    })),
  ], { x: 0.42, y: 1.12, w: 5.3, h: 2.6, valign: "top", margin: 0 });

  // Augmentation result boxes
  s.addText("Augmentation Results", {
    x: 0.42, y: 3.85, w: 5.3, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
  });

  const res = [["Before", "4,390", "records", "1% fraud"], ["After", "8,398", "records", "48.4% fraud"]];
  res.forEach(([label, num, unit, pct], i) => {
    const x = 0.42 + i * 2.7;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 4.18, w: 2.5, h: 1.05,
      fill: { color: i === 1 ? C.teal : C.greyLight }, line: { color: i === 1 ? C.teal : C.greyLight },
      shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.12 },
    });
    s.addText(`${label}\n${num} ${unit}\n${pct}`, {
      x, y: 4.18, w: 2.5, h: 1.05,
      fontSize: 13, fontFace: "Calibri", bold: i === 1, color: i === 1 ? C.white : C.text,
      align: "center", valign: "middle", margin: 0,
    });
  });

  // Key hyperparams table right side
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.0, y: 1.12, w: 3.5, h: 4.1,
    fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
    shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.0, y: 1.12, w: 3.5, h: 0.38, fill: { color: C.teal }, line: { color: C.teal },
  });
  s.addText("Key Hyperparameters", {
    x: 6.05, y: 1.14, w: 3.4, h: 0.34,
    fontSize: 12, fontFace: "Calibri", bold: true, color: C.white,
    align: "center", valign: "middle", margin: 0,
  });

  const params = [
    ["Model type", "MLP"],
    ["Learning rate", "0.00015"],
    ["D_layers", "[512,1024,1024,1024,256]"],
    ["Scheduler", "Cosine"],
    ["Normalisation", "Quantile"],
    ["Loss", "MSE (Gaussian)"],
    ["Steps", "5,000 diffusion steps"],
  ];
  params.forEach(([k, v], i) => {
    const y = 1.58 + i * 0.47;
    s.addText(k, { x: 6.1, y, w: 1.55, h: 0.38, fontSize: 11, fontFace: "Calibri", bold: true, color: C.tealDark, valign: "middle", margin: 0 });
    s.addText(v, { x: 7.65, y, w: 1.75, h: 0.38, fontSize: 11, fontFace: "Calibri", color: C.text, valign: "middle", margin: 0 });
    if (i < params.length - 1) {
      s.addShape(pres.shapes.LINE, { x: 6.1, y: y + 0.38, w: 3.3, h: 0, line: { color: C.greyLight, width: 0.5 } });
    }
  });
}

// ─── SLIDE 8 – TABNET ────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Layer 3");
  slideTitle(s, "TabNet: Fraud Classification", 0.32, C.text, 28);

  // How TabNet works
  s.addText("How TabNet Works", {
    x: 0.42, y: 1.1, w: 5.5, h: 0.32,
    fontSize: 14, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
  });

  const howPoints = [
    "Sequential attention: at each decision step, selects only the most relevant features",
    "Soft feature selection via sparse/entmax attention masks — intrinsically interpretable",
    "Mimics decision tree efficiency while using end-to-end gradient descent",
    "Self-supervised pre-training handles missing values dynamically",
  ];

  const bulletItems = howPoints.map((t, i, a) => ({
    text: t,
    options: { bullet: true, fontSize: 12.5, fontFace: "Calibri", color: C.text, breakLine: i < a.length - 1, paraSpaceAfter: 8 },
  }));
  s.addText(bulletItems, { x: 0.42, y: 1.48, w: 5.5, h: 2.3, valign: "top", margin: 0 });

  // Decision steps visual
  s.addText("Decision Steps (N=3)", {
    x: 0.42, y: 3.85, w: 5.5, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
  });

  ["Step 1\nAttention Mask", "Step 2\nAggregation", "Step 3\nFeature Importance"].forEach((lbl, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.42 + i * 1.85, y: 4.2, w: 1.65, h: 0.9,
      fill: { color: C.teal }, line: { color: C.teal },
      shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.15 },
    });
    s.addText(lbl, {
      x: 0.42 + i * 1.85, y: 4.2, w: 1.65, h: 0.9,
      fontSize: 11, fontFace: "Calibri", bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0,
    });
  });

  // Hyperparams right
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.1, y: 1.1, w: 3.4, h: 4.1,
    fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
    shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.1, y: 1.1, w: 3.4, h: 0.38, fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addText("Key Hyperparameters", {
    x: 6.1, y: 1.12, w: 3.4, h: 0.34,
    fontSize: 12, fontFace: "Calibri", bold: true, color: C.white,
    align: "center", valign: "middle", margin: 0,
  });

  const tabParams = [
    ["Optimiser", "Adam (lr=2e-2)"],
    ["LR Scheduler", "StepLR γ=0.9, step=50"],
    ["Batch size", "1024"],
    ["Virtual batch", "128"],
    ["N_a = N_d", "8"],
    ["N_steps", "3"],
    ["Mask type", "entmax / sparsemax"],
    ["Early stopping", "patience=20"],
  ];
  tabParams.forEach(([k, v], i) => {
    const y = 1.56 + i * 0.42;
    s.addText(k, { x: 6.2, y, w: 1.55, h: 0.38, fontSize: 11, fontFace: "Calibri", bold: true, color: C.tealDark, valign: "middle", margin: 0 });
    s.addText(v, { x: 7.75, y, w: 1.65, h: 0.38, fontSize: 11, fontFace: "Calibri", color: C.text, valign: "middle", margin: 0 });
    if (i < tabParams.length - 1) {
      s.addShape(pres.shapes.LINE, { x: 6.2, y: y + 0.38, w: 3.2, h: 0, line: { color: C.greyLight, width: 0.5 } });
    }
  });
}

// ─── SLIDE 9 – EXPLAINABILITY LAYER ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Layer 4");
  slideTitle(s, "Explainability: SHAP & LIME", 0.32, C.text, 28);

  // SHAP card
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.42, y: 1.1, w: 4.4, h: 4.12,
    fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
    shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.42, y: 1.1, w: 4.4, h: 0.42, fill: { color: C.teal }, line: { color: C.teal },
  });
  s.addText("SHAP — Global Explainability", {
    x: 0.52, y: 1.12, w: 4.2, h: 0.38,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.white, valign: "middle", margin: 0,
  });
  s.addText([
    { text: "Shapley value-based attributions", options: { bullet: true, breakLine: true } },
    { text: "Theoretically consistent & globally coherent", options: { bullet: true, breakLine: true } },
    { text: "Provides beeswarm, bar, heatmap & violin plots", options: { bullet: true, breakLine: true } },
    { text: "Supports HIPAA/GDPR portfolio-wide compliance reporting", options: { bullet: true, breakLine: true } },
    { text: "Cannot justify why a single specific claim was flagged", options: { bullet: true } },
  ].map((item, i, a) => ({
    text: item.text,
    options: { ...item.options, fontSize: 12.5, fontFace: "Calibri", color: C.text, breakLine: i < a.length - 1, paraSpaceAfter: 8 },
  })), { x: 0.52, y: 1.6, w: 4.2, h: 3.5, valign: "top", margin: 0 });

  // LIME card
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.18, y: 1.1, w: 4.4, h: 4.12,
    fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
    shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.18, y: 1.1, w: 4.4, h: 0.42, fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addText("LIME — Local Explainability", {
    x: 5.28, y: 1.12, w: 4.2, h: 0.38,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.white, valign: "middle", margin: 0,
  });
  s.addText([
    "Linear surrogate model per-instance",
    "Rule-style explanations for non-technical stakeholders",
    "Supports claim analysts & legal reviewers",
    "No basis for portfolio-wide compliance on its own",
    "Surrogate may overfit to proxy boundary features",
  ].map((t, i, a) => ({
    text: t,
    options: { bullet: true, fontSize: 12.5, fontFace: "Calibri", color: C.text, breakLine: i < a.length - 1, paraSpaceAfter: 8 },
  })), { x: 5.28, y: 1.6, w: 4.2, h: 3.5, valign: "top", margin: 0 });
}

// ─── SLIDE 10 – EXPERIMENTAL SETUP ──────────────────────────────────────────
{
  const s = pres.addSlide();
  darkSlide(s);
  sectionTag(s, "Experiments");
  slideTitle(s, "Experimental Setup", 0.32, C.white, 28);

  // Dataset split table
  s.addText("Dataset Splits After TabDDPM Augmentation", {
    x: 0.42, y: 1.05, w: 9, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealLight, margin: 0,
  });

  const tableData = [
    [
      { text: "Split", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Total Samples", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Fraud", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Non-Fraud", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Fraud Ratio", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
    ],
    ["Original Dataset", "4,390", "56", "4,332", "1%"],
    [{ text: "After TabDDPM", options: { bold: true, color: C.teal } }, { text: "8,398", options: { bold: true, color: C.teal } }, { text: "4,066", options: { bold: true, color: C.teal } }, "4,332", { text: "48.4%", options: { bold: true, color: C.teal } }],
    ["Training Set", "5,871", "2,839", "3,032", "48.4%"],
    ["Validation Set", "1,258", "608", "650", "48.3%"],
    ["Test Set", "1,259", "609", "650", "48.4%"],
  ];

  s.addTable(tableData, {
    x: 0.42, y: 1.42, w: 9.16, h: 2.5,
    colW: [2.2, 1.8, 1.5, 1.5, 2.16],
    border: { pt: 1, color: "1D3557" },
    fill: { color: "0D1B2A" },
    color: C.greyLight,
    fontSize: 12,
    fontFace: "Calibri",
    valign: "middle",
    align: "center",
  });

  s.addText("Infrastructure", {
    x: 0.42, y: 4.1, w: 9, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealLight, margin: 0,
  });

  const infra = [
    "Python 3.10  |  PyTorch 2.0.1  |  Scikit-Learn",
    "NVIDIA GeForce RTX 3050 GPU  |  30 GB RAM",
    "Git & GitHub version control  |  JSON experiment logging",
  ];
  infra.forEach((t, i) => {
    s.addText(t, {
      x: 0.42, y: 4.42 + i * 0.3, w: 9, h: 0.28,
      fontSize: 12, fontFace: "Calibri", color: C.greyLight, margin: 0,
    });
  });
}

// ─── SLIDE 11 – CLASSIFICATION RESULTS ──────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Results");
  slideTitle(s, "Classification Results", 0.32, C.text, 28);

  // Big stats
  statBox(s, 0.42,  1.08, 2.1, 1.35, "0.99", "AUC-ROC",         C.teal);
  statBox(s, 2.72,  1.08, 2.1, 1.35, "0.99", "Macro F1-Score",  C.tealDark);
  statBox(s, 5.02,  1.08, 2.1, 1.35, "98%",  "Fraud Recall",    C.navy);
  statBox(s, 7.32,  1.08, 2.1, 1.35, "100%", "Fraud Precision", "1D3557");

  // Confusion matrix
  s.addText("Confusion Matrix (Test Set: 1,259 claims)", {
    x: 0.42, y: 2.62, w: 4.5, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
  });

  const cm = [
    [{ text: "", options: { fill: { color: C.offWhite } } }, { text: "Predicted: Non-Fraud", options: { bold: true, fill: { color: C.greyLight }, align: "center" } }, { text: "Predicted: Fraud", options: { bold: true, fill: { color: C.greyLight }, align: "center" } }],
    [{ text: "Actual: Non-Fraud", options: { bold: true, fill: { color: C.greyLight } } }, { text: "640 (TN) ✓", options: { color: "2D6A4F", bold: true, fill: { color: "D8F3DC" }, align: "center" } }, { text: "3 (FP)", options: { color: C.accentRed, fill: { color: "FFE5E5" }, align: "center" } }],
    [{ text: "Actual: Fraud", options: { bold: true, fill: { color: C.greyLight } } }, { text: "10 (FN)", options: { color: C.accentRed, fill: { color: "FFE5E5" }, align: "center" } }, { text: "606 (TP) ✓", options: { color: "2D6A4F", bold: true, fill: { color: "D8F3DC" }, align: "center" } }],
  ];

  s.addTable(cm, {
    x: 0.42, y: 3.0, w: 4.5, h: 1.95,
    colW: [1.6, 1.45, 1.45],
    border: { pt: 1, color: C.greyLight },
    fontSize: 12, fontFace: "Calibri", valign: "middle",
  });

  // Per-class report
  s.addText("Per-Class Classification Report", {
    x: 5.2, y: 2.62, w: 4.4, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
  });

  const report = [
    [{ text: "Class", options: { bold: true, fill: { color: C.teal }, color: C.white } }, { text: "Precision", options: { bold: true, fill: { color: C.teal }, color: C.white } }, { text: "Recall", options: { bold: true, fill: { color: C.teal }, color: C.white } }, { text: "F1", options: { bold: true, fill: { color: C.teal }, color: C.white } }],
    ["0 (Non-Fraud)", "1.00", "0.98", "0.99"],
    ["1 (Fraud)", "0.98", "1.00", "0.99"],
    [{ text: "Macro Avg", options: { bold: true } }, { text: "0.99", options: { bold: true } }, { text: "0.99", options: { bold: true } }, { text: "0.99", options: { bold: true } }],
    [{ text: "Accuracy", options: { bold: true } }, { text: "0.99", options: { bold: true, colspan: 3 } }, "", ""],
  ];

  s.addTable(report, {
    x: 5.2, y: 3.0, w: 4.4, h: 1.95,
    colW: [1.6, 0.93, 0.93, 0.94],
    border: { pt: 1, color: C.greyLight },
    fontSize: 12, fontFace: "Calibri", valign: "middle", align: "center",
  });
}

// ─── SLIDE 12 – COMPARISON ───────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Results");
  slideTitle(s, "Benchmarking Against Baselines", 0.32, C.text, 28);

  // Bar chart
  s.addChart(pres.charts.BAR, [
    { name: "AUC-ROC",    labels: ["Random Forest\n+ SMOTE", "XGBoost\n+ SMOTE", "TabDDPM\n+ TabNet"], values: [0.92, 0.95, 0.99] },
    { name: "F1-Score",   labels: ["Random Forest\n+ SMOTE", "XGBoost\n+ SMOTE", "TabDDPM\n+ TabNet"], values: [0.81, 0.83, 0.99] },
    { name: "Precision",  labels: ["Random Forest\n+ SMOTE", "XGBoost\n+ SMOTE", "TabDDPM\n+ TabNet"], values: [0.83, 0.86, 1.00] },
    { name: "Recall",     labels: ["Random Forest\n+ SMOTE", "XGBoost\n+ SMOTE", "TabDDPM\n+ TabNet"], values: [0.79, 0.81, 0.98] },
  ], {
    x: 0.42, y: 1.08, w: 5.8, h: 4.2,
    barDir: "col",
    barGrouping: "clustered",
    chartColors: ["64748B", "94A3B8", C.teal],
    chartArea: { fill: { color: C.white }, roundedCorners: false },
    catAxisLabelColor: C.grey,
    valAxisLabelColor: C.grey,
    valAxisMinVal: 0.7,
    valAxisMaxVal: 1.05,
    valGridLine: { color: "E2EBF0", size: 0.5 },
    catGridLine: { style: "none" },
    showValue: true,
    dataLabelColor: C.text,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 11,
  });

  // Improvement callouts
  s.addText("vs XGBoost + SMOTE", {
    x: 6.42, y: 1.1, w: 3.1, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
  });

  const improvements = [
    ["+4%", "AUC-ROC improvement"],
    ["+14%", "Precision improvement"],
    ["+17%", "Recall improvement"],
    ["+16%", "F1-Score improvement"],
  ];
  improvements.forEach(([num, label], i) => {
    statBox(s, i < 2 ? 6.42 : 6.42, 1.5 + Math.floor(i / 2) * 1.55 + (i % 2) * 0,
      i % 2 === 0 ? (i === 0 ? 1.45 : 1.45) : 1.45, 1.32,
      num, label, C.teal);
    // simpler: two rows of two
  });

  // Redo as 2x2 grid
  improvements.forEach(([num, label], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 6.42 + col * 1.55;
    const y = 1.52 + row * 1.55;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 1.45, h: 1.32,
      fill: { color: i === 0 || i === 1 ? C.teal : C.tealDark }, line: { color: C.teal },
      shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.2 },
    });
    s.addText(num, {
      x, y: y + 0.1, w: 1.45, h: 0.65,
      fontSize: 26, fontFace: "Calibri", bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
    s.addText(label, {
      x, y: y + 0.72, w: 1.45, h: 0.5,
      fontSize: 10.5, fontFace: "Calibri", color: C.white, align: "center", valign: "top", margin: 0,
    });
  });

  s.addText("Same dataset, same splits, same evaluation metrics", {
    x: 6.42, y: 4.75, w: 3.1, h: 0.45,
    fontSize: 11, fontFace: "Calibri", italic: true, color: C.grey, margin: 0,
  });
}

// ─── SLIDE 13 – SHAP RESULTS ─────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Explainability");
  slideTitle(s, "SHAP Feature Importance Analysis", 0.32, C.text, 28);

  // Horizontal bar chart
  s.addChart(pres.charts.BAR, [{
    name: "Mean |SHAP|",
    labels: ["Patient ID", "Date of Discharge", "Age", "Gender", "Diagnosis", "Date of Encounter", "Amount Billed"],
    values: [0.00, 0.00, 0.00, 0.02, 0.03, 0.05, 0.08],
  }], {
    x: 0.42, y: 1.08, w: 5.6, h: 4.22,
    barDir: "bar",
    barGrouping: "clustered",
    chartColors: [C.teal],
    chartArea: { fill: { color: C.white } },
    catAxisLabelColor: C.text,
    valAxisLabelColor: C.grey,
    valGridLine: { color: "E2EBF0", size: 0.5 },
    catGridLine: { style: "none" },
    showValue: true,
    dataLabelColor: C.text,
    showLegend: false,
  });

  // Interpretations
  const findings = [
    { rank: "#1", feature: "Amount Billed", score: "0.08", note: "Primary driver — unusually high values signal upcoding & phantom billing" },
    { rank: "#2", feature: "Date of Encounter", score: "0.05", note: "Temporal fraud patterns — specific billing periods are disproportionately suspicious" },
    { rank: "#3", feature: "Diagnosis", score: "0.03", note: "High-reimbursement diagnostic codes statistically associated with fraud" },
    { rank: "—", feature: "Patient ID", score: "~0.00", note: "Correctly ignored — model does not rely on identifiers (robustness confirmed)" },
  ];

  findings.forEach(({ rank, feature, score, note }, i) => {
    const y = 1.12 + i * 1.08;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.18, y, w: 3.4, h: 0.95,
      fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
      shadow: { type: "outer", blur: 3, offset: 1, angle: 135, color: "000000", opacity: 0.08 },
    });
    const rankColor = rank === "—" ? C.accentRed : C.teal;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.18, y, w: 0.5, h: 0.95, fill: { color: rankColor }, line: { color: rankColor },
    });
    s.addText(rank, { x: 6.18, y, w: 0.5, h: 0.95, fontSize: 11, fontFace: "Calibri", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText(`${feature}  (${score})`, { x: 6.74, y: y + 0.08, w: 2.74, h: 0.28, fontSize: 12, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0 });
    s.addText(note, { x: 6.74, y: y + 0.38, w: 2.74, h: 0.5, fontSize: 10.5, fontFace: "Calibri", color: C.grey, valign: "top", margin: 0 });
  });
}

// ─── SLIDE 14 – SHAP vs LIME DISAGREEMENT ────────────────────────────────────
{
  const s = pres.addSlide();
  darkSlide(s);
  sectionTag(s, "Explainability");
  slideTitle(s, "SHAP vs LIME Disagreement Analysis", 0.32, C.white, 28);

  // Key finding callout
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.42, y: 1.1, w: 9.16, h: 0.72,
    fill: { color: "1A0A0A" }, line: { color: C.accentRed, pt: 1.5 },
  });
  s.addText("⚠  Key Finding: SHAP and LIME consistently disagree on top feature — LIME overfits to a global proxy boundary on Patient ID ≤ 2670.50, while SHAP captures true transaction-level signals (Amount Billed, Date of Encounter/Discharge).", {
    x: 0.55, y: 1.12, w: 8.9, h: 0.68,
    fontSize: 12, fontFace: "Calibri", color: "FFB3B3", valign: "middle", margin: 0,
  });

  // Comparison table
  const compData = [
    [
      { text: "Block", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Prediction", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Top SHAP Feature", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Top LIME Feature", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
      { text: "Fraud Confidence", options: { bold: true, color: C.white, fill: { color: C.tealDark } } },
    ],
    ["#0",  { text: "Fraud",      options: { color: C.accentRed,  bold: true } }, "Amount Billed (+0.318)", "Patient ID ≤ 2670.50", { text: "93.9%", options: { bold: true, color: C.teal } }],
    ["#9",  { text: "Fraud",      options: { color: C.accentRed,  bold: true } }, "Amount Billed (+0.326)", "Patient ID ≤ 2670.50", { text: "87.7%", options: { bold: true, color: C.teal } }],
    ["#32", { text: "Not Fraud",  options: { color: "90EE90", bold: true } },      "Date of Discharge (-0.353)", "Patient ID ≤ 2670.50", "99.5% (NF)"],
    ["#45", { text: "Not Fraud",  options: { color: "90EE90", bold: true } },      "Date of Encounter (-0.319)", "Patient ID ≤ 2670.50", "98.0% (NF)"],
  ];

  s.addTable(compData, {
    x: 0.42, y: 1.95, w: 9.16, h: 2.35,
    colW: [0.8, 1.2, 2.5, 2.4, 2.26],
    border: { pt: 1, color: "1D3557" },
    fill: { color: "0D1B2A" },
    color: C.greyLight,
    fontSize: 11.5,
    fontFace: "Calibri",
    valign: "middle",
    align: "center",
  });

  // Interpretation
  s.addText("Why This Matters", {
    x: 0.42, y: 4.45, w: 9, h: 0.3,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealLight, margin: 0,
  });
  s.addText("Relying on a single post-hoc explainability framework in regulated healthcare settings is insufficient and potentially misleading. Dual deployment of SHAP + LIME is necessary to detect proxy-boundary overfitting and ensure audit-grade transparency.", {
    x: 0.42, y: 4.78, w: 9.16, h: 0.55,
    fontSize: 12, fontFace: "Calibri", color: C.greyLight, margin: 0,
  });
}

// ─── SLIDE 15 – CONTRIBUTIONS ────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Contributions");
  slideTitle(s, "Research Contributions", 0.32, C.text, 28);

  const contributions = [
    {
      num: "01",
      title: "Unified Framework",
      desc: "First system to simultaneously address class imbalance (via TabDDPM) and model interpretability (via TabNet + SHAP/LIME) in a single pipeline — bridging the gap left by prior works like Aparna et al. (2025).",
    },
    {
      num: "02",
      title: "Privacy-Preserving Oversampling",
      desc: "Demonstrates that diffusion-based synthetic data generation outperforms SMOTE in both ML performance and privacy preservation (higher DCR), directly addressing GDPR/HIPAA constraints.",
    },
    {
      num: "03",
      title: "Explainable Fraud Perspective",
      desc: "Establishes transparent links between billing anomalies, encounter timing, and fraud risk — producing human-readable audit reports to support legally defensible claim denials.",
    },
    {
      num: "04",
      title: "SHAP–LIME Disagreement Analysis",
      desc: "First to demonstrate that LIME's surrogate model overfits to proxy boundary features (Patient ID) in healthcare fraud — proving dual post-hoc explainability is mandatory in regulated settings.",
    },
  ];

  contributions.forEach(({ num, title, desc }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.42 + col * 4.75;
    const y = 1.1 + row * 2.18;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.4, h: 2.0,
      fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
      shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.4, h: 0.06, fill: { color: C.teal }, line: { color: C.teal },
    });
    s.addText(num, {
      x: x + 0.15, y: y + 0.15, w: 0.7, h: 0.4,
      fontSize: 22, fontFace: "Calibri", bold: true, color: C.tealLight, margin: 0,
    });
    s.addText(title, {
      x: x + 0.9, y: y + 0.15, w: 3.35, h: 0.4,
      fontSize: 13, fontFace: "Calibri", bold: true, color: C.tealDark, valign: "middle", margin: 0,
    });
    s.addText(desc, {
      x: x + 0.15, y: y + 0.62, w: 4.1, h: 1.28,
      fontSize: 12, fontFace: "Calibri", color: C.text, valign: "top", margin: 0,
    });
  });
}

// ─── SLIDE 16 – LIMITATIONS ──────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Limitations");
  slideTitle(s, "Limitations & Critical Reflection", 0.32, C.text, 28);

  const lims = [
    { title: "Balanced Test Distribution", desc: "Model evaluated on synthetically balanced data. Real-world fraud rates are typically below 1–5%, meaning performance could degrade significantly in production environments." },
    { title: "10 False Negatives", desc: "Missed fraud cases carry direct financial risk. In a live insurance system, each false negative represents undetected fraudulent claims passing through undetected." },
    { title: "Overfitting Risk", desc: "Near-perfect metrics may reflect overfitting to test set distribution arising from synthetically balanced data — not necessarily true real-world generalisation." },
    { title: "No Cross-Validation", desc: "Evaluation uses a single static test set. Lack of k-fold cross-validation and temporal validation raises questions about generalisation to evolving fraud patterns." },
    { title: "Small Dataset", desc: "4,390 records with 7 informative features is sufficient for proof-of-concept but insufficient to validate generalisation to real-world healthcare fraud complexity." },
    { title: "No Synthetic Quality Metrics", desc: "KS statistic, Coverage, α-Precision and β-Recall metrics were not computed for TabDDPM samples — cannot rule out mode collapse or sample duplication." },
  ];

  lims.forEach(({ title, desc }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.42 + col * 4.75;
    const y = 1.1 + row * 1.48;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.4, h: 1.32,
      fill: { color: C.white }, line: { color: C.greyLight, pt: 1 },
      shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.07 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: 1.32, fill: { color: C.accentRed }, line: { color: C.accentRed },
    });
    s.addText(title, {
      x: x + 0.15, y: y + 0.1, w: 4.15, h: 0.28,
      fontSize: 12.5, fontFace: "Calibri", bold: true, color: C.accentRed, margin: 0,
    });
    s.addText(desc, {
      x: x + 0.15, y: y + 0.4, w: 4.15, h: 0.85,
      fontSize: 11.5, fontFace: "Calibri", color: C.text, valign: "top", margin: 0,
    });
  });
}

// ─── SLIDE 17 – FUTURE WORK ───────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkSlide(s);
  sectionTag(s, "Future Work");
  slideTitle(s, "Directions for Future Research", 0.32, C.white, 28);

  const future = [
    { icon: "▶", title: "Larger & Diverse Datasets", desc: "Replicate and validate on substantially larger real-world healthcare insurance datasets with more diverse feature sets to confirm generalisation." },
    { icon: "▶", title: "Synthetic Data Quality Metrics", desc: "Compute KS statistic, Coverage, α-Precision and β-Recall for TabDDPM samples to rigorously assess fidelity and rule out mode collapse." },
    { icon: "▶", title: "Temporal & Cross-Validation", desc: "Implement k-fold cross-validation and temporal holdout validation to measure robustness to evolving and previously unseen fraud patterns." },
    { icon: "▶", title: "Federated Learning Integration", desc: "Explore federated TabDDPM synthesis across hospital networks to train without centralising sensitive data — resolving the data silo problem." },
    { icon: "▶", title: "Blockchain Auditability", desc: "Investigate blockchain-based immutable audit logging of SHAP/LIME decisions to satisfy HIPAA/GDPR accountability whilst maintaining explainability." },
    { icon: "▶", title: "Production Deployment Testing", desc: "Evaluate system performance under real-world imbalanced conditions (1% fraud rate) with dynamic threshold adjustment to optimise precision-recall trade-off." },
  ];

  future.forEach(({ title, desc }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.42 + col * 4.75;
    const y = 1.12 + row * 1.48;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.4, h: 1.32,
      fill: { color: "0A2540" }, line: { color: C.teal, pt: 0.75 },
      shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.2 },
    });
    s.addText(title, {
      x: x + 0.15, y: y + 0.1, w: 4.1, h: 0.28,
      fontSize: 12.5, fontFace: "Calibri", bold: true, color: C.teal, margin: 0,
    });
    s.addText(desc, {
      x: x + 0.15, y: y + 0.4, w: 4.1, h: 0.85,
      fontSize: 11.5, fontFace: "Calibri", color: C.greyLight, valign: "top", margin: 0,
    });
  });
}

// ─── SLIDE 18 – CONCLUSIONS ───────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "Conclusions");
  slideTitle(s, "Conclusions", 0.32, C.text, 28);

  // Left: key takeaways
  s.addText("Key Takeaways", {
    x: 0.42, y: 1.1, w: 5.5, h: 0.3,
    fontSize: 14, fontFace: "Calibri", bold: true, color: C.tealDark, margin: 0,
  });

  const takeaways = [
    "RQ1 ✓  TabDDPM outperforms SMOTE — 4,066 synthetic samples raised fraud ratio from 1% to 48.4% while preserving privacy (higher DCR)",
    "RQ2 ✓  TabNet outperforms all baselines — AUC-ROC 0.99 vs 0.95 for XGBoost+SMOTE, with +16% F1-Score improvement",
    "Amount Billed and Date of Encounter are the dominant fraud predictors — clinically coherent and statistically grounded",
    "SHAP–LIME disagreement is itself a finding — single post-hoc explainability frameworks are insufficient in regulated healthcare contexts",
    "System is compliance-aware and replicable — bridging predictive performance and real-world regulatory deployability",
  ];

  s.addText(takeaways.map((t, i, a) => ({
    text: t,
    options: { bullet: true, fontSize: 12.5, fontFace: "Calibri", color: C.text, breakLine: i < a.length - 1, paraSpaceAfter: 10 },
  })), { x: 0.42, y: 1.5, w: 5.5, h: 3.8, valign: "top", margin: 0 });

  // Right: impact summary
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.2, y: 1.1, w: 3.38, h: 4.12,
    fill: { color: C.navy }, line: { color: C.teal, pt: 1 },
    shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 },
  });
  s.addText("System Impact", {
    x: 6.2, y: 1.18, w: 3.38, h: 0.35,
    fontSize: 13, fontFace: "Calibri", bold: true, color: C.teal,
    align: "center", margin: 0,
  });

  const impacts = [
    ["Operational", "Automated, auditable fraud detection reducing $600–850B annual loss"],
    ["Legal", "SHAP+LIME dual framework enables defensible claim denials under HIPAA/GDPR"],
    ["Technical", "First unified TabDDPM+TabNet pipeline resolving all three bottlenecks"],
    ["Academic", "SHAP–LIME disagreement finding contributes to XAI literature"],
  ];
  impacts.forEach(([label, text], i) => {
    s.addText(label, { x: 6.3, y: 1.65 + i * 0.88, w: 3.1, h: 0.25, fontSize: 11, fontFace: "Calibri", bold: true, color: C.tealLight, margin: 0 });
    s.addText(text, { x: 6.3, y: 1.9 + i * 0.88, w: 3.1, h: 0.55, fontSize: 11, fontFace: "Calibri", color: C.greyLight, valign: "top", margin: 0 });
  });
}

// ─── SLIDE 19 – REFERENCES ────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  lightSlide(s);
  sectionTag(s, "References");
  slideTitle(s, "Key References", 0.32, C.text, 28);

  const refs = [
    "Arik, S.O. & Pfister, T. (2020). TabNet: Attentive interpretable tabular learning. arXiv:1908.07442",
    "Kotelnikov, A. et al. (2023). TabDDPM: Modelling tabular data with diffusion models. ICML, pp. 17564–17579",
    "Villaizán-Vallelado, M. et al. (2025). Diffusion models for tabular data imputation and synthetic data generation. ACM TKDD",
    "Aparna A, John, R.M. & Dhanya, R. (2025). Transformer model for fraud detection in medical insurance claims. ACCESS 2025",
    "Gorishniy, Y. et al. (2021). Revisiting deep learning models for tabular data. NeurIPS, vol. 34",
    "Reynaud, S. & Roxin, A. (2025). Review of eXplainable AI for cybersecurity systems. Discover AI, vol. 5(1)",
    "Islam, M.M. et al. (2025). Fraud detection in privacy-preserving health insurance using blockchain. Engineering Reports",
    "Bekkaye, C. et al. (2025). Generative hybrid models for fraud detection in auto insurance. Discover AI, vol. 5, art. 313",
    "Chosen, B. (2024). NHIS Healthcare Claims and Fraud Dataset. Kaggle",
    "Zabërgja, G. et al. (2024). Is deep learning finally better than decision trees on tabular data? arXiv:2402.03970",
  ];

  s.addText(refs.map((r, i, a) => ({
    text: r,
    options: { bullet: { type: "number" }, fontSize: 11.5, fontFace: "Calibri", color: C.text, breakLine: i < a.length - 1, paraSpaceAfter: 5 },
  })), { x: 0.42, y: 1.1, w: 9.16, h: 4.3, valign: "top", margin: 0 });
}

// ─── SLIDE 20 – THANK YOU ─────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkSlide(s);

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 9.82, y: 0, w: 0.18, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
  });

  s.addText("Thank You", {
    x: 0.45, y: 0.85, w: 9.1, h: 0.9,
    fontSize: 44, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0,
  });
  s.addText("Questions & Discussion", {
    x: 0.45, y: 1.85, w: 9.1, h: 0.45,
    fontSize: 20, fontFace: "Calibri", color: C.teal, align: "center", margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 2.5, y: 2.52, w: 5, h: 0.04, fill: { color: C.teal }, line: { color: C.teal },
  });

  s.addText([
    { text: "Kumbirai Shonhiwa", options: { bold: true, breakLine: true } },
    { text: "BSc (Hons) Computer Systems Engineering", options: { breakLine: true } },
    { text: "University of Sunderland  |  CET3006", options: {} },
  ], {
    x: 0.45, y: 2.7, w: 9.1, h: 0.9,
    fontSize: 15, fontFace: "Calibri", color: C.greyLight, align: "center", margin: 0,
  });

  // Summary stats
  const finalStats = [["AUC-ROC", "0.99"], ["Macro F1", "0.99"], ["Recall", "98%"], ["Precision", "100%"]];
  finalStats.forEach(([label, val], i) => {
    const x = 1.2 + i * 2.0;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.88, w: 1.7, h: 1.2,
      fill: { color: "0A2540" }, line: { color: C.teal, pt: 1 },
      shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.25 },
    });
    s.addText(val, { x, y: 3.94, w: 1.7, h: 0.55, fontSize: 24, fontFace: "Calibri", bold: true, color: C.teal, align: "center", valign: "middle", margin: 0 });
    s.addText(label, { x, y: 4.5, w: 1.7, h: 0.45, fontSize: 12, fontFace: "Calibri", color: C.greyLight, align: "center", valign: "top", margin: 0 });
  });
}

// ─── WRITE ───────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "Shonhiwa_CET3006_Presentation.pptx" })
  .then(() => console.log("Done!"))
  .catch(e => console.error(e));